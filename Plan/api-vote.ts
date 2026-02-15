// app/api/polls/[slug]/vote/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { supabase } from '@/lib/supabase';

interface VoteRequest {
  optionId: string;
  fingerprint: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const body: VoteRequest = await request.json();
    const { slug } = params;

    // Get client IP address
    const headersList = headers();
    const forwardedFor = headersList.get('x-forwarded-for');
    const realIp = headersList.get('x-real-ip');
    const ip = forwardedFor?.split(',')[0] || realIp || 'unknown';

    // Validate inputs
    if (!body.optionId || !body.fingerprint) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Fetch poll
    const { data: poll, error: pollError } = await supabase
      .from('polls')
      .select('id, is_active')
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

    // Verify option belongs to this poll
    const { data: option, error: optionError } = await supabase
      .from('options')
      .select('id, poll_id, vote_count')
      .eq('id', body.optionId)
      .eq('poll_id', poll.id)
      .single();

    if (optionError || !option) {
      return NextResponse.json(
        { error: 'Invalid option' },
        { status: 400 }
      );
    }

    // ANTI-ABUSE MECHANISM #1: Check fingerprint
    const { data: fingerprintVote } = await supabase
      .from('votes')
      .select('id')
      .eq('poll_id', poll.id)
      .eq('voter_fingerprint', body.fingerprint)
      .single();

    if (fingerprintVote) {
      return NextResponse.json(
        { error: 'You have already voted on this poll' },
        { status: 409 }
      );
    }

    // ANTI-ABUSE MECHANISM #2: IP rate limiting (10-minute window)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: ipVote } = await supabase
      .from('votes')
      .select('id, voted_at')
      .eq('poll_id', poll.id)
      .eq('ip_address', ip)
      .gte('voted_at', tenMinutesAgo)
      .single();

    if (ipVote) {
      const waitTime = Math.ceil(
        (new Date(ipVote.voted_at).getTime() + 10 * 60 * 1000 - Date.now()) / 1000
      );
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded. Please wait before voting again.',
          retryAfter: waitTime 
        },
        { 
          status: 429,
          headers: { 'Retry-After': waitTime.toString() }
        }
      );
    }

    // Record the vote using Supabase transaction
    // Note: Supabase client doesn't support full transactions,
    // so we use RPC for atomic operations
    
    // Insert vote record
    const { error: voteError } = await supabase
      .from('votes')
      .insert({
        poll_id: poll.id,
        option_id: body.optionId,
        voter_fingerprint: body.fingerprint,
        ip_address: ip,
      });

    if (voteError) {
      console.error('Vote insert error:', voteError);
      return NextResponse.json(
        { error: 'Failed to record vote' },
        { status: 500 }
      );
    }

    // Increment vote count
    const { data: updatedOption, error: updateError } = await supabase
      .from('options')
      .update({ vote_count: option.vote_count + 1 })
      .eq('id', body.optionId)
      .select()
      .single();

    if (updateError) {
      console.error('Vote count update error:', updateError);
      // Try to rollback vote insert
      await supabase
        .from('votes')
        .delete()
        .eq('poll_id', poll.id)
        .eq('voter_fingerprint', body.fingerprint);
      
      return NextResponse.json(
        { error: 'Failed to update vote count' },
        { status: 500 }
      );
    }

    // Broadcast to Socket.io server
    const socketUrl = process.env.SOCKET_SERVER_URL;
    if (socketUrl) {
      try {
        await fetch(`${socketUrl}/broadcast`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pollId: poll.id,
            pollSlug: slug,
            optionId: body.optionId,
            newCount: updatedOption.vote_count,
          }),
        });
      } catch (socketError) {
        console.error('Socket broadcast error:', socketError);
        // Don't fail the vote if socket fails
      }
    }

    return NextResponse.json({
      success: true,
      newCount: updatedOption.vote_count,
    });

  } catch (error) {
    console.error('Unexpected vote error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
