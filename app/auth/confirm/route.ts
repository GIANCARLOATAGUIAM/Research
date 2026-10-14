import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

// Email confirmation callback (SYSTEM_SPEC §8.10). Supports both link styles:
// PKCE (?code=...) from the default template and ?token_hash=&type= from a
// custom template. Only same-site paths are accepted as the next page.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const nextParam = url.searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";
  const supabase = await createClient();

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      : { error: new Error("missing token") };

  return NextResponse.redirect(new URL(error ? "/login?error=confirm" : next, url.origin));
}
