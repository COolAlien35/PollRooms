// app/api/polls/[slug]/vote/route.ts
// Records a ballot (one or more optionIds) with anti-abuse:
//   1. Device fingerprint (one ballot per poll)
//   2. IP rate limiting (10-minute sliding window)
//   3. Expiration check
// Uses supabase.rpc('increment_vote_count') for ATOMIC counting.

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { supabase } from '@/lib/supabase';

interface VoteRequest {
    optionIds: string[];
    fingerprint: string;
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const body: VoteRequest = await request.json();
        const { slug } = await params;

        // ─── Get client IP ──────────────────────────────────
        const headersList = await headers();
        const forwardedFor = headersList.get('x-forwarded-for');
        const realIp = headersList.get('x-real-ip');
        const ip = forwardedFor?.split(',')[0]?.trim() || realIp || '0.0.0.0';

        // ─── Validate inputs ────────────────────────────────
        if (!body.optionIds || !Array.isArray(body.optionIds) || body.optionIds.length === 0) {
            return NextResponse.json(
                { error: 'At least one optionId is required' },
                { status: 400 }
            );
        }

        if (!body.fingerprint || typeof body.fingerprint !== 'string' || body.fingerprint.length > 64) {
            return NextResponse.json(
                { error: 'Invalid fingerprint' },
                { status: 400 }
            );
        }

        // Deduplicate
        const uniqueOptionIds = [...new Set(body.optionIds)];

        // ─── Fetch poll with settings ───────────────────────
        const { data: poll, error: pollError } = await supabase
            .from('polls')
            .select('id, is_active, expires_at, allow_multiple')
            .eq('slug', slug)
            .single();

        if (pollError || !poll) {
            return NextResponse.json(
                { error: 'Poll not found' },
                { status: 404 }
            );
        }

        if (!poll.is_active) {
            return NextResponse.json(
                { error: 'This poll is no longer active' },
                { status: 403 }
            );
        }

        // ─── Expiration check ───────────────────────────────
        if (poll.expires_at && new Date() > new Date(poll.expires_at)) {
            return NextResponse.json(
                { error: 'This poll has expired' },
                { status: 403 }
            );
        }

        // ─── Multi-select guard ─────────────────────────────
        if (!poll.allow_multiple && uniqueOptionIds.length > 1) {
            return NextResponse.json(
                { error: 'This poll only allows one selection' },
                { status: 400 }
            );
        }

        // ─── Verify all options belong to this poll ─────────
        const { data: validOptions, error: optError } = await supabase
            .from('options')
            .select('id')
            .eq('poll_id', poll.id)
            .in('id', uniqueOptionIds);

        if (optError || !validOptions || validOptions.length !== uniqueOptionIds.length) {
            return NextResponse.json(
                { error: 'One or more options are invalid for this poll' },
                { status: 400 }
            );
        }

        // ─── ANTI-ABUSE #1: Fingerprint check ──────────────
        // Check if this user has already submitted ANY vote on this poll
        const { count: existingVotes } = await supabase
            .from('votes')
            .select('id', { count: 'exact', head: true })
            .eq('poll_id', poll.id)
            .eq('voter_fingerprint', body.fingerprint);

        if (existingVotes && existingVotes > 0) {
            return NextResponse.json(
                { error: 'You have already voted on this poll' },
                { status: 409 }
            );
        }

        // ─── ANTI-ABUSE #2: IP Rate Limiting (10-min window) ─
        const tenMinutesAgo = new Date(
            Date.now() - 10 * 60 * 1000
        ).toISOString();

        const { data: ipVote } = await supabase
            .from('votes')
            .select('id, voted_at')
            .eq('poll_id', poll.id)
            .eq('ip_address', ip)
            .gte('voted_at', tenMinutesAgo)
            .limit(1)
            .maybeSingle();

        if (ipVote) {
            const waitTime = Math.ceil(
                (new Date(ipVote.voted_at).getTime() +
                    10 * 60 * 1000 -
                    Date.now()) /
                1000
            );
            return NextResponse.json(
                {
                    error: 'Rate limit exceeded. Please wait before voting again.',
                    retryAfter: Math.max(waitTime, 1),
                },
                {
                    status: 429,
                    headers: {
                        'Retry-After': Math.max(waitTime, 1).toString(),
                    },
                }
            );
        }

        // ─── Record all votes (the ballot) ──────────────────
        const userAgent = headersList.get('user-agent') || null;
        const voteRows = uniqueOptionIds.map((optionId) => ({
            poll_id: poll.id,
            option_id: optionId,
            voter_fingerprint: body.fingerprint,
            ip_address: ip,
            user_agent: userAgent,
        }));

        const { error: voteError } = await supabase.from('votes').insert(voteRows);

        if (voteError) {
            if (voteError.code === '23505') {
                return NextResponse.json(
                    { error: 'You have already voted on this poll' },
                    { status: 409 }
                );
            }
            console.error('Vote insert error:', voteError);
            return NextResponse.json(
                { error: 'Failed to record vote' },
                { status: 500 }
            );
        }

        // ─── ATOMIC INCREMENT for each selected option ──────
        const results: Record<string, number> = {};

        for (const optionId of uniqueOptionIds) {
            const { data: newCount, error: rpcError } = await supabase.rpc(
                'increment_vote_count',
                { p_option_id: optionId }
            );

            if (rpcError) {
                console.error('RPC increment error for', optionId, rpcError);
                // Continue with remaining — partial failure is better than full rollback at this stage
                continue;
            }
            results[optionId] = newCount;
        }

        // ─── Broadcast to Socket.io ─────────────────────────
        const socketUrl = process.env.SOCKET_SERVER_URL;
        if (socketUrl) {
            for (const [optionId, newCount] of Object.entries(results)) {
                try {
                    await fetch(`${socketUrl}/broadcast`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            pollId: poll.id,
                            pollSlug: slug,
                            optionId,
                            newCount,
                        }),
                    });
                } catch (socketError) {
                    console.error('Socket broadcast error:', socketError);
                }
            }
        }

        // ─── Return success ─────────────────────────────────
        return NextResponse.json({
            success: true,
            results,
        });
    } catch (error) {
        console.error('Unexpected vote error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
