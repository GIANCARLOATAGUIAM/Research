# WUPCare — Deployment Checklist

Deploy only with explicit authorization. Nothing here has been done yet.

## 1. Before deploying

- [ ] **Rotate the Supabase service-role key.** The current key was exposed during development. Create a new secret key (`sb_secret_…`) or rotate the JWT secret, then disable the legacy keys.
- [ ] Apply migration `0010_student_self_registration.sql` (if student self-registration is wanted) and regenerate `types/database.ts`.
- [ ] Re-run the Supabase security advisor. Expect only the 12 known SECURITY DEFINER WARNs.
- [ ] Decide on email delivery for student confirmation (spec Q-A1): an institutional SMTP server, or "Confirm email" off with clinic approval as the access gate. The built-in service delivers only to the project's team members.
- [ ] Remove development accounts (`dev-admin@`, `dev-nurse@`, `dev-student@wupcare.test`) and delete their local credentials file.
- [ ] Decide whether the demo data stays for the defense or is removed (`supabase/remove-demo.sql`). No real student data before institutional authorization.
- [ ] Confirm backups: Supabase plan backups, or a documented manual export (spec Q-T3).

## 2. Supabase Auth settings (Dashboard → Authentication)

- [ ] Site URL: the production domain (for example `https://wupcare.example.edu`).
- [ ] Redirect URLs: `https://<domain>/auth/confirm` (and `http://localhost:3000/auth/confirm` for development).
- [ ] Email sign-ups: on only if student self-registration is used; otherwise off.
- [ ] "Confirm email": on for production. If it is turned off for a demonstration, see `docs/AUTH_PROVISIONING.md` §7 for the risks.
- [ ] Minimum password length: 8 or more.
- [ ] Leaked-password protection: on if the plan supports it.
- [ ] Optional: CAPTCHA on sign-up.

## 3. Vercel project

- [ ] Import the repository; framework preset: Next.js. Build command `next build`.
- [ ] Environment variables (Production and Preview):

| Variable | Value | Exposed to the browser |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | project URL | yes |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | new secret key | **no** (never prefix `NEXT_PUBLIC_`) |
| `STUDENT_REGISTRATION` | `enabled` only after 0010 and the Auth settings above | no |

- [ ] Region close to the Supabase project (ap-south-1).

## 4. After deploying

- [ ] Create the first administrator: `node scripts/create-admin.mjs --email <email> --name "<name>"` (run locally against the production project). Then create clinic personnel in Users.
- [ ] Smoke test each role: sign in, home page, sign out. Signed-out access to `/dashboard` redirects to `/login`.
- [ ] Clinic personnel: add a student, record a visit with medication, approve an appointment, run a report and print it.
- [ ] Administrator: reports show whole months and "<5"; no student names anywhere.
- [ ] If registration is enabled: register a test student, approve the link, request an appointment, then deactivate the test account.
- [ ] Check the Supabase logs for errors.
