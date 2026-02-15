// app/api/polls/[slug]/route.ts
// Fetches a single poll by slug, including options, settings, and computed state.

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;

        if (!slug || !/^[a-zA-Z0-9_-]{1,20}$/.test(slug)) {
            return NextResponse.json(
                { error: 'Invalid poll slug' },
                { status: 400 }
            );
        }

        const { data: poll, error } = await supabase
            .from('polls')
            .select(
                `
                id,
                slug,
                question,
                created_at,
                is_active,
                results_hidden,
                expires_at,
                allow_multiple,
                options (
                  id,
                  text,
                  vote_count,
                  display_order
                )
                `
            )
            .eq('slug', slug)
            .single();

        if (error || !poll) {
            return NextResponse.json(
                { error: 'Poll not found' },
                { status: 404 }
            );
        }

        // Check if poll has expired
        const isExpired = poll.expires_at && new Date() > new Date(poll.expires_at);
        const isActive = poll.is_active && !isExpired;

        const options = (poll.options || []).sort(
            (a: { display_order: number }, b: { display_order: number }) =>
                a.display_order - b.display_order
        );

        const totalVotes = options.reduce(
            (sum: number, opt: { vote_count: number }) => sum + opt.vote_count,
            0
        );

        return NextResponse.json({
            id: poll.id,
            slug: poll.slug,
            question: poll.question,
            createdAt: poll.created_at,
            isActive,
            resultsHidden: poll.results_hidden ?? false,
            expiresAt: poll.expires_at,
            allowMultiple: poll.allow_multiple ?? false,
            options,
            totalVotes,
        });
    } catch (error) {
        console.error('Error fetching poll:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
