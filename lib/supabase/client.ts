import { createBrowserClient } from "@supabase/ssr";

import { supabasePublishableKey, supabaseUrl } from "./env";

// Browser client for Client Components. Uses the publishable key only.
export function createClient() {
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
