#!/usr/bin/env node
// One-time creation of the first WUPCare administrator (docs/AUTH_PROVISIONING.md §4).
//
// Usage (from the project root, with .env.local filled in):
//   node scripts/create-admin.mjs --email admin@your-school.edu --name "Full Name"
// The password is read from the ADMIN_PASSWORD environment variable, or asked
// for interactively (not echoed). It is never printed or stored.
//
// Refuses to run when an administrator already exists. Later administrators
// and all clinic personnel are created in the app (Users page).
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function readEnv() {
  const env = { ...process.env };
  if (fs.existsSync(".env.local")) {
    for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].trim();
    }
  }
  return env;
}

function askHidden(prompt) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) return reject(new Error("Set ADMIN_PASSWORD when not running in a terminal."));
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    let value = "";
    const onData = (buf) => {
      for (const ch of buf.toString("utf8")) {
        if (ch === "\r" || ch === "\n") {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.off("data", onData);
          process.stdout.write("\n");
          return resolve(value);
        }
        if (ch === "\u0003") process.exit(130);
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else value += ch;
      }
    };
    process.stdin.on("data", onData);
  });
}

const email = arg("email")?.trim().toLowerCase();
const fullName = arg("name")?.trim();
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !fullName) {
  console.error('Usage: node scripts/create-admin.mjs --email <email> --name "<full name>"');
  process.exit(1);
}

const env = readEnv();
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (.env.local).");
  process.exit(1);
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { count, error: countError } = await supabase
  .from("profiles")
  .select("id", { count: "exact", head: true })
  .eq("role", "admin");
if (countError) {
  console.error("Could not check existing administrators:", countError.message);
  process.exit(1);
}
if (count) {
  console.error("An administrator already exists. Create further accounts from the Users page.");
  process.exit(1);
}

const password = env.ADMIN_PASSWORD || (await askHidden("Password for the new administrator (min. 12 characters): "));
if (password.length < 12) {
  console.error("Use a password of at least 12 characters for the administrator.");
  process.exit(1);
}

// The profile is created by the database trigger from app_metadata
// (migrations 0003/0009), in the same transaction as the auth user.
const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  app_metadata: { wupcare_role: "admin", full_name: fullName },
});
if (error) {
  console.error("Could not create the administrator:", error.message);
  process.exit(1);
}

const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", data.user.id).maybeSingle();
if (profile?.role !== "admin" || !profile.is_active) {
  console.error("The account was created but no active admin profile was found. Check migrations 0003 and 0009.");
  process.exit(1);
}
console.log(`Administrator created: ${email}. Sign in at /login.`);
