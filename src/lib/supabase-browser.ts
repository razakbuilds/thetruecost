import { createBrowserClient } from '@supabase/ssr';

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

console.log('Supabase URL exists:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);

console.log(
  'Supabase key exists:',
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
