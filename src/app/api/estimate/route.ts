console.log('[TRUECOST ENV]', {
  supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
  anonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  serviceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
});

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { getSupabase } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

import type { City, EventType, StyleTier } from '@/lib/types';

import {
  ANONYMOUS_ESTIMATE_COOKIE,
  createAnonymousSessionToken,
  hashAnonymousSessionToken,
} from '@/lib/truecost/anonymous-estimate';

const baseByCity: Record<City, number> = {
  Lagos: 1.08,
  Abuja: 1.12,
  'Port Harcourt': 0.98,
};

const guestsPerBase = 55_000;

const eventFactor: Record<EventType, number> = {
  Wedding: 1.35,
  'Naming Ceremony': 0.62,
  'Burial / Memorial': 0.78,
  'Corporate Event': 0.88,
};

const styleFactor: Record<StyleTier, number> = {
  Essential: 0.78,
  Classic: 1,
  Premium: 1.42,
};

/**
 * GET /api/estimate
 *
 * Restores the latest anonymous estimate using
 * the httpOnly anonymous session cookie.
 */
export async function GET() {
  try {
    const cookieStore = await cookies();

    const sessionToken = cookieStore.get(ANONYMOUS_ESTIMATE_COOKIE)?.value;

    // No anonymous estimate session exists.
    if (!sessionToken) {
      return NextResponse.json({
        estimate: null,
      });
    }

    const sessionTokenHash = hashAnonymousSessionToken(sessionToken);

    const admin = getSupabaseAdmin();

    const { data, error } = await admin
      .from('anonymous_estimates')
      .select('result_snapshot, expires_at')
      .eq('session_token_hash', sessionTokenHash)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error) {
      console.error('Anonymous estimate restore error:', error);
      throw error;
    }

    // No valid saved estimate was found.
    if (!data) {
      return NextResponse.json({
        estimate: null,
      });
    }

    return NextResponse.json({
      estimate: data.result_snapshot,
    });
  } catch (error) {
    console.error('[TRUECOST_ESTIMATE_GET_ERROR]', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/estimate
 *
 * Generates an estimate and persists an anonymous snapshot
 * so it can survive refresh and later be claimed by an account.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const eventType = body.eventType as EventType;
    const city = body.city as City;
    const styleTier = body.styleTier as StyleTier;
    const guestCount = Number(body.guestCount);

    if (
      !eventType ||
      !city ||
      !styleTier ||
      !Number.isFinite(guestCount) ||
      guestCount < 20 ||
      guestCount > 2000
    ) {
      return NextResponse.json(
        {
          error: 'Please provide valid estimate inputs.',
        },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    if (!supabase) {
      return NextResponse.json(
        {
          error: 'Supabase is not configured.',
        },
        { status: 503 }
      );
    }

    const { data, error } = await supabase
      .from('benchmark_data')
      .select('category,pct_of_total,sample_size')
      .eq('event_type', eventType)
      .eq('city', city)
      .eq('style_tier', styleTier)
      .order('category');

    if (error) {
      throw error;
    }

    if (!data?.length) {
      return NextResponse.json(
        {
          error: 'No benchmark data exists for this combination yet.',
        },
        { status: 404 }
      );
    }

    const total =
      Math.round(
        (guestCount *
          guestsPerBase *
          baseByCity[city] *
          eventFactor[eventType] *
          styleFactor[styleTier]) /
          10_000
      ) * 10_000;

    const lines = data.map((row) => ({
      category: row.category,
      pct_of_total: Number(row.pct_of_total),
      sample_size: Number(row.sample_size),
      amount:
        Math.round((total * Number(row.pct_of_total)) / 100 / 1000) * 1000,
      risk: Number(row.pct_of_total) >= 16,
    }));

    const resultSnapshot = {
      total,
      lines,
      eventType,
      city,
      styleTier,
      guestCount,

      // Transitional metadata.
      // Full benchmark versioning comes in the benchmark-engine chunk.
      benchmarkVersion: 'legacy-seed-v1',
      confidence: 'Limited',
    };

    const cookieStore = await cookies();

    let sessionToken = cookieStore.get(ANONYMOUS_ESTIMATE_COOKIE)?.value;

    let setCookie = false;

    if (!sessionToken) {
      sessionToken = createAnonymousSessionToken();
      setCookie = true;
    }

    const sessionTokenHash = hashAnonymousSessionToken(sessionToken);

    const admin = getSupabaseAdmin();

    const { error: draftError } = await admin
      .from('anonymous_estimates')
      .upsert(
        {
          session_token_hash: sessionTokenHash,

          inputs: {
            eventType,
            city,
            styleTier,
            guestCount,
          },

          result_snapshot: resultSnapshot,

          benchmark_version: 'legacy-seed-v1',

          expires_at: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          ).toISOString(),

          claimed_by_user_id: null,
          claimed_at: null,
        },
        {
          onConflict: 'session_token_hash',
        }
      );

    if (draftError) {
      console.error('Anonymous draft error:', draftError);

      throw draftError;
    }

    const response = NextResponse.json(resultSnapshot);

    if (setCookie) {
      response.cookies.set({
        name: ANONYMOUS_ESTIMATE_COOKIE,
        value: sessionToken,

        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',

        sameSite: 'lax',
        path: '/',

        maxAge: 7 * 24 * 60 * 60,
      });
    }

    return response;
  } catch (error) {
    console.error('[TRUECOST_ESTIMATE_ERROR]', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
