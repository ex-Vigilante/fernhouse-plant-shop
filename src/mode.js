// Decides between production mode (Supabase + Stripe) and the public demo.
// VITE_* values are inlined at build time. The anon key is public by design: every table is
// protected by Row Level Security. No secret keys are ever read by the browser code.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const PROD = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
