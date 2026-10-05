import { createSupabaseServerClient } from '@/lib/supabase-server';

export type AppRole = 'host' | 'planner' | 'vendor' | 'admin';

export const APP_ROLES: readonly AppRole[] = [
  'host',
  'planner',
  'vendor',
  'admin',
];

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      supabase,
      user: null,
    };
  }

  return {
    supabase,
    user,
  };
}

export async function getCurrentUserRoles(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string
): Promise<AppRole[]> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Unable to load user roles: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => row.role)
    .filter((role): role is AppRole => APP_ROLES.includes(role as AppRole));
}

export async function requireUser() {
  const result = await getCurrentUser();

  if (!result.user) {
    throw new Error('AUTHENTICATION_REQUIRED');
  }

  return result;
}

export async function requireRole(role: AppRole) {
  const { supabase, user } = await requireUser();

  const roles = await getCurrentUserRoles(supabase, user.id);

  if (!roles.includes(role)) {
    throw new Error('FORBIDDEN');
  }

  return {
    supabase,
    user,
    roles,
  };
}

export async function hasRole(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  role: AppRole
) {
  const roles = await getCurrentUserRoles(supabase, userId);

  return roles.includes(role);
}
