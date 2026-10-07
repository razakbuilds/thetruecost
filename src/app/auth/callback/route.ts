import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

const ALLOWED_NEXT_PREFIXES = [
  '/dashboard',
  '/events',
  '/billing',
  '/planner',
  '/vendors',
];

function getSafeNext(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get('next');

  if (!next) {
    return '/dashboard';
  }

  const allowed = ALLOWED_NEXT_PREFIXES.some(
    (prefix) => next === prefix || next.startsWith(`${prefix}/`)
  );

  return allowed ? next : '/dashboard';
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(
      new URL('/auth?error=missing_code', url.origin)
    );
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('Auth callback error:', error);

    return NextResponse.redirect(
      new URL('/auth?error=auth_failed', url.origin)
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL('/auth?error=session_failed', url.origin)
    );
  }

  // Ensure every authenticated user has the default host role.
  // The DB trigger should normally already do this.
  await supabase.from('user_roles').upsert(
    {
      user_id: user.id,
      role: 'host',
    },
    {
      onConflict: 'user_id,role',
      ignoreDuplicates: true,
    }
  );

  return NextResponse.redirect(new URL(getSafeNext(request), url.origin));
}
