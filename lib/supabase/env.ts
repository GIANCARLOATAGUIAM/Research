// Public Supabase settings. Both values are safe to expose to the browser.
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export function isSupabaseConfigured() {
  return supabaseUrl.length > 0 && supabasePublishableKey.length > 0;
}
