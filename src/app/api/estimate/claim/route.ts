import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { requireUser } from '@/lib/truecost/auth';

import {
  ANONYMOUS_ESTIMATE_COOKIE,
  hashAnonymousSessionToken,
} from '@/lib/truecost/anonymous-estimate';

import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST() {
  try {
    const { user } = await requireUser();

    const cookieStore = await cookies();

    const sessionToken = cookieStore.get(ANONYMOUS_ESTIMATE_COOKIE)?.value;

    if (!sessionToken) {
      return NextResponse.json(
        {
          error: 'No anonymous estimate found.',
        },
        { status: 404 }
      );
    }

    const tokenHash = hashAnonymousSessionToken(sessionToken);

    const admin = getSupabaseAdmin();

    const { data: draft, error: draftError } = await admin
      .from('anonymous_estimates')
      .select('*')
      .eq('session_token_hash', tokenHash)
      .maybeSingle();

    if (draftError) {
      console.error('Claim draft lookup failed:', draftError);
      throw draftError;
    }

    if (!draft) {
      return NextResponse.json(
        {
          error: 'Your estimate draft could not be found.',
        },
        { status: 404 }
      );
    }

    if (draft.claimed_by_user_id && draft.claimed_by_user_id !== user.id) {
      return NextResponse.json(
        {
          error: 'This estimate belongs to another account.',
        },
        { status: 409 }
      );
    }

    // Already claimed by this user.
    if (draft.claimed_by_user_id === user.id && draft.claimed_at) {
      return NextResponse.json({
        success: true,
        alreadyClaimed: true,
      });
    }

    const snapshot = draft.result_snapshot as {
      eventType: string;
      city: string;
      styleTier: string;
      guestCount: number;
      lines: Array<{
        category: string;
        amount: number;
        pct_of_total: number;
      }>;
    };

    /*
     * Use the trusted admin client after requireUser()
     * so this flow does not depend on client-side RLS
     * for creating the claimed event/baseline.
     */
    const { data: event, error: eventError } = await admin
      .from('events')
      .insert({
        user_id: user.id,
        host_user_id: user.id,
        created_by_user_id: user.id,

        event_type: snapshot.eventType,
        city: snapshot.city,
        guest_count: snapshot.guestCount,
        style_tier: snapshot.styleTier,

        status: 'planning',
      })
      .select('id')
      .single();

    if (eventError) {
      console.error('Claim event creation failed:', eventError);
      throw eventError;
    }

    const budgetRows = snapshot.lines.map((line) => ({
      event_id: event.id,
      category: line.category,
      category_code: line.category,
      budgeted_amount: Math.round(Number(line.amount)),
      budgeted_amount_kobo: Math.round(Number(line.amount) * 100),
      pct_of_total: Number(line.pct_of_total),
      benchmark_version: 'legacy-seed-v1',
    }));

    const { error: budgetError } = await admin
      .from('budget_estimates')
      .insert(budgetRows);

    if (budgetError) {
      console.error('Claim budget creation failed:', budgetError);

      // Prevent leaving a partially-created event behind.
      await admin.from('events').delete().eq('id', event.id);

      throw budgetError;
    }

    const now = new Date().toISOString();

    const { data: claimedDraft, error: claimError } = await admin
      .from('anonymous_estimates')
      .update({
        claimed_by_user_id: user.id,
        claimed_at: now,
      })
      .eq('id', draft.id)
      .is('claimed_by_user_id', null)
      .select('id, claimed_by_user_id, claimed_at')
      .maybeSingle();

    if (claimError) {
      console.error('Anonymous estimate claim update failed:', claimError);

      // Clean up the event/baseline because the claim did not complete.
      await admin.from('budget_estimates').delete().eq('event_id', event.id);

      await admin.from('events').delete().eq('id', event.id);

      throw claimError;
    }

    if (!claimedDraft) {
      return NextResponse.json(
        {
          error: 'The estimate was already claimed or could not be claimed.',
        },
        { status: 409 }
      );
    }

    const response = NextResponse.json({
      success: true,
      eventId: event.id,
      claimedEstimateId: claimedDraft.id,
    });

    response.cookies.set({
      name: ANONYMOUS_ESTIMATE_COOKIE,
      value: '',
      maxAge: 0,
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    return response;
  } catch (error) {
    if (error instanceof Error && error.message === 'AUTHENTICATION_REQUIRED') {
      return NextResponse.json(
        {
          error: 'Authentication required.',
        },
        { status: 401 }
      );
    }

    console.error('POST /api/estimate/claim failed:', error);

    return NextResponse.json(
      {
        error: 'Could not save your estimate.',
      },
      { status: 500 }
    );
  }
}
