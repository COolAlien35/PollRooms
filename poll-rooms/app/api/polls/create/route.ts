// app/api/polls/create/route.ts
// Creates a new poll with question + options + settings (deadline, multi-select, blind voting).

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { supabase } from '@/lib/supabase';

interface CreatePollRequest {
    question: string;
    options: string[];
    resultsHidden?: boolean;
    durationMinutes?: number;
    allowMultiple?: boolean;
    expiresAt?: string; // ISO date string for custom end date
}

export async function POST(request: NextRequest) {
    try {
        const body: CreatePollRequest = await request.json();

        // ─── Validation ────────────────────────────────────
        if (!body.question || !body.question.trim()) {
            return NextResponse.json(
                { error: 'Question is required' },
                { status: 400 }
            );
        }

        if (body.question.trim().length > 500) {
            return NextResponse.json(
                { error: 'Question must be 500 characters or less' },
                { status: 400 }
            );
        }

        if (!body.options || !Array.isArray(body.options)) {
            return NextResponse.json(
                { error: 'Options array is required' },
                { status: 400 }
            );
        }

        const validOptions = body.options
            .map((opt) => opt.trim())
            .filter((opt) => opt.length > 0);

        if (validOptions.length < 2) {
            return NextResponse.json(
                { error: 'At least 2 non-empty options are required' },
                { status: 400 }
            );
        }

        if (validOptions.length > 10) {
            return NextResponse.json(
                { error: 'Maximum 10 options allowed' },
                { status: 400 }
            );
        }

        const unique = new Set(validOptions.map((o) => o.toLowerCase()));
        if (unique.size !== validOptions.length) {
            return NextResponse.json(
                { error: 'Duplicate options are not allowed' },
                { status: 400 }
            );
        }

        // ─── Compute expires_at (priority: expiresAt > durationMinutes > null) ──
        let expiresAt: string | null = null;

        if (body.expiresAt) {
            // Custom end date provided — validate it
            const parsed = new Date(body.expiresAt);
            if (isNaN(parsed.getTime())) {
                return NextResponse.json(
                    { error: 'Invalid date format for expiresAt.' },
                    { status: 400 }
                );
            }
            if (parsed.getTime() <= Date.now()) {
                return NextResponse.json(
                    { error: 'End date must be in the future.' },
                    { status: 400 }
                );
            }
            expiresAt = parsed.toISOString();
        } else if (body.durationMinutes && body.durationMinutes > 0) {
            const allowedDurations = [10, 60, 1440];
            if (!allowedDurations.includes(body.durationMinutes)) {
                return NextResponse.json(
                    { error: 'Invalid duration. Allowed: 10, 60, 1440 minutes.' },
                    { status: 400 }
                );
            }
            expiresAt = new Date(
                Date.now() + body.durationMinutes * 60 * 1000
            ).toISOString();
        }

        // ─── Generate unique slug ──────────────────────────
        const slug = nanoid(10);

        // ─── Insert poll ───────────────────────────────────
        const { data: poll, error: pollError } = await supabase
            .from('polls')
            .insert({
                slug,
                question: body.question.trim(),
                results_hidden: body.resultsHidden === true,
                expires_at: expiresAt,
                allow_multiple: body.allowMultiple === true,
            })
            .select()
            .single();

        if (pollError) {
            console.error('Poll creation error:', pollError);
            return NextResponse.json(
                { error: 'Failed to create poll' },
                { status: 500 }
            );
        }

        // ─── Insert options ────────────────────────────────
        const optionsData = validOptions.map((text, index) => ({
            poll_id: poll.id,
            text,
            display_order: index,
            vote_count: 0,
        }));

        const { error: optionsError } = await supabase
            .from('options')
            .insert(optionsData);

        if (optionsError) {
            console.error('Options creation error:', optionsError);
            await supabase.from('polls').delete().eq('id', poll.id);
            return NextResponse.json(
                { error: 'Failed to create poll options' },
                { status: 500 }
            );
        }

        // ─── Return success ─────────────────────────────────
        const baseUrl =
            process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

        return NextResponse.json(
            {
                success: true,
                pollId: poll.id,
                slug,
                shareUrl: `${baseUrl}/p/${slug}`,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Unexpected error creating poll:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
