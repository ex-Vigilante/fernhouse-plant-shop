import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../mode.js';

let client;

/** Loads the Supabase client on first use, so the demo build never downloads it. */
export function getSupabase() {
  client ||= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  );
  return client;
}
