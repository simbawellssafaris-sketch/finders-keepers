import { createBrowserClient } from '@supabase/ssr';

// Browser-side Supabase client (publishable key only; Row Level Security in the database decides what visitors may do).
// Returns null when the environment variables are missing so the site keeps working without a database.
let client = null;

export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  if (!client) client = createBrowserClient(url, key);
  return client;
}
