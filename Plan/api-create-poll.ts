// app/api/polls/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { supabase } from '@/lib/supabase';

interface CreatePollRequest {
  question: string;
  options: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: CreatePollRequest = await request.json();
    
    // Validation
    if (!body.question || !body.question.trim()) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    if (!body.options || body.options.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 options are required' },
        { status: 400 }
      );
    }

    // Filter empty options
    const validOptions = body.options
      .map(opt => opt.trim())
      .filter(opt => opt.length > 0);

    if (validOptions.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 non-empty options are required' },
        { status: 400 }
      );
    }

    // Generate unique slug
    const slug = nanoid(10); // 10 characters, URL-safe

    // Insert poll
    const { data: poll, error: pollError } = await supabase
      .from('polls')
      .insert({
        slug,
        question: body.question.trim(),
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

    // Insert options
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
      // Rollback: delete poll
      await supabase.from('polls').delete().eq('id', poll.id);
      return NextResponse.json(
        { error: 'Failed to create poll options' },
        { status: 500 }
      );
    }

    // Return success with share URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const shareUrl = `${baseUrl}/p/${slug}`;

    return NextResponse.json({
      success: true,
      pollId: poll.id,
      slug: slug,
      shareUrl: shareUrl,
    }, { status: 201 });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
