import { NextResponse } from 'next/server';
import { getCurrentUser, getCurrentUserRoles } from '@/lib/truecost/auth';

export async function GET() {
  try {
    const { supabase, user } = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          authenticated: false,
        },
        { status: 401 }
      );
    }

    const roles = await getCurrentUserRoles(supabase, user.id);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id,email,phone,full_name,avatar_url,status')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email ?? null,
        phone: user.phone ?? null,
      },
      profile,
      roles,
      defaultRole: roles.includes('host') ? 'host' : (roles[0] ?? null),
    });
  } catch (error) {
    console.error('GET /api/me', error);

    return NextResponse.json(
      {
        error: 'Unable to load account information.',
      },
      { status: 500 }
    );
  }
}
