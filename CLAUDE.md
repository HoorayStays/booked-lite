# CLAUDE.md: instructions for Claude Code

This repo is **B👀KED Lite**, a free, open-source (MIT) booking page app (a simple Calendly alternative) made by
**CoHost Studio** for short-term-rental hosts. Most people opening this repo are **hosts, not programmers**.
Many are using Claude Code for the first time.

## If the person says "set this up for me" (or anything like it)

Walk them through **[SETUP.md](SETUP.md)**, one step at a time. How to do it well:

1. **Start with a short welcome**: what we'll do (5 free accounts → live booking page), about 45–60 minutes,
   and the one rule (below). Ask whether they already have any of the accounts (GitHub, Vercel, Google…) so you can skip ahead.
2. **One step at a time.** Give at most 3–5 clicks per message, numbered, with the exact button names in **bold**.
   Then **stop and wait** for them to say it's done (or what they see). Never dump the whole guide at once.
3. **Plain words.** No jargon. If you must use a term (e.g. "environment variable"), explain it in a few words
   ("a setting stored safely in Vercel"). Be warm and encouraging. Celebrate milestones.
4. **Expect screens to differ.** Google/Vercel/Turso/Resend change their UIs. If the person can't find a button,
   ask what they see and guide from that. Offer the closest match. It's fine to say "the button may be called X or Y."
5. **Verify as you go.** After step 4 (Vercel deploy), ask for their site address (e.g. `https://my-booking-page.vercel.app`;
   this is **not** secret) and check `https://THEIR-SITE/api/health` with WebFetch or `curl -s`. It reports which
   settings are present (true/false) plus `googleRedirectUri`, never secret values. Use it after every redeploy.
   Use `googleRedirectUri` from that page when they reach step 6d, so they paste the exact right value.
6. **Remind them to Redeploy** in Vercel after changing environment variables. It's the #1 cause of "it didn't work".
7. **Finish with the Final checklist** in SETUP.md, and suggest a test booking from their phone.
8. Use the **Troubleshooting** section of SETUP.md when something goes wrong.

### 🔐 The secrets rule (never break this)

- **Never ask for, accept, display, or store secret values** (API keys, tokens, client secrets, AUTH_SECRET,
  CRON_SECRET, database tokens). They go **only** into Vercel → Settings → Environment Variables
  (or GitHub → Settings → Secrets for the optional reminder workflow).
- Don't generate secrets in the terminal for them to copy. Point them to https://generate-secret.vercel.app/32,
  which they open in their own browser.
- If they paste a secret into the chat anyway: don't repeat it, gently tell them to delete that key on the
  provider's site, create a new one, and put the new one in Vercel.
- Never write secrets into files in this repo. `.env` is git-ignored and only for local development; `.env.example`
  holds names only. Never commit `.env`.
- Not secret (fine to share): their site URL, their email, their Google **Client ID**, their timezone.

### What you can do for them yourself

- Run things locally to preview: `npm install`, `npm run db:seed` (demo data), then `npm run dev` → http://localhost:3000/demo.
  With no keys set, emails print in the terminal and the sign-in page shows the login link (dev only).
  Add `ALLOWED_EMAILS=demo@example.com` and `CALENDAR_PROVIDER=fake` to `.env` to try the admin with a test calendar.
- Make changes they ask for (colors, wording, new fields), run the checks, commit, and push. Vercel redeploys automatically
  when the main branch on GitHub changes.

## Project map (for code changes)

- **Stack:** Next.js 16 (App Router) + React 19, TypeScript, Drizzle ORM on **Turso/libSQL** (SQLite locally),
  Resend over plain HTTPS, Google Calendar over plain HTTPS (no SDKs), Luxon for timezone math (server only).
  Note: this Next.js version has breaking changes from older ones. See `AGENTS.md` and `node_modules/next/dist/docs/`.
- `src/lib/slots.ts`: **availability engine** (pure function; weekly hours + overrides − busy, buffers,
  minimum notice, daily limit, booking window, DST-safe). Covered by `tests/slots.test.ts`.
- `src/lib/bookings.ts`: create / reschedule / cancel bookings, calendar writes, emails, reminders.
- `src/lib/calendar/`: `google.ts` (OAuth + freebusy + events), `fake.ts` (JSON-file calendar for tests),
  `index.ts` (picks the provider, refreshes tokens). Tokens are encrypted with AES-GCM (`src/lib/crypto.ts`).
- `src/lib/email/`: `send.ts` (Resend, or log to console/`.data/outbox.jsonl` when no key) and `templates.ts`.
- `src/lib/ics.ts`: calendar invite files. `src/lib/location.ts` handles Jitsi rooms on meet.jit.si, links, phone, and in-person.
- `src/lib/auth.ts`: magic-link sign-in (only emails in `ALLOWED_EMAILS`), sessions in the DB.
- Public pages: `src/app/[user]/page.tsx` (profile), `src/app/[user]/[event]/` (booking page + `BookingWidget.tsx`),
  `src/app/booking/[id]/` (confirmation / cancel). Admin: `src/app/admin/*` with server actions in `src/app/admin/actions.ts`.
- API: `/api/slots`, `/api/bookings`, `/api/bookings/[id]/reschedule`, `/api/bookings/[id]/ics`,
  `/api/google/connect|callback`, `/api/cron/reminders` (needs `CRON_SECRET`), `/api/health`, `/api/img/...`.
- Database schema: `src/lib/db/schema.ts`. After changing it run `npm run db:generate` and commit the new file in `drizzle/`.
  Migrations run automatically before `dev` and `build` (so every Vercel deploy updates the DB).
- **Look & feel:** all colors/sizes are CSS variables at the top of `src/app/globals.css`. Each host's brand color
  overrides `--brand` on their pages (`src/lib/brand.ts`). No CSS framework.

## Checks (run before every commit)

```bash
npm run lint && npm run typecheck && npm test
npm run test:e2e   # Playwright: full booking flow with a fake calendar (builds the app; ~1 min)
```

CI (`.github/workflows/ci.yml`) runs all of these on every pull request.

## House rules

- Keep it **small, fast on phones, and beginner-friendly**. Avoid adding services that need another account.
- Keep the **"Built by CoHost Studio"** credit and upgrade note in the footer (`src/components/Footer.tsx`) and README.
- Write user-facing text in plain, friendly English.
- Don't add analytics or tracking without the host asking.
