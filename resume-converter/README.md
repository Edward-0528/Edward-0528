# Federal Resume Converter

Paste a resume and a USAJOBS announcement; get a federal-format resume mapped to the announcement's
requirements (strong / partial / missing), a "add these before you submit" list, and an editable DOCX.
Pay per announcement via Stripe Checkout. **Stripe runs in test mode until you deliberately go live.**

Stack: Next.js 16 (App Router) · Supabase (auth + Postgres) · Stripe Checkout · Claude API · Vercel.

## How it works
1. User signs in with an email link (Supabase). The browser sends its access token to the API routes.
2. `POST /api/convert` validates input, then calls the Postgres function `start_job`, which atomically
   checks the balance and rate limit and takes 1 credit. The Claude call then runs in the background
   (`after()`), writing the result with `complete_job`.
3. If anything fails, `fail_job` refunds the credit exactly once. A job stuck "running" for 10 minutes is
   refunded the next time its status is polled.
4. Stripe `checkout.session.completed` -> `/api/stripe/webhook` verifies the signature and calls
   `grant_purchase`, which is idempotent on the Checkout session id. Credit amounts come from
   `src/lib/packs.ts`, never from request metadata.

## Safety properties (all tested)
- Never invents facts: the prompt forbids it, missing fields become `null` + a to-do, and the DOCX shows `[ADD ...]` placeholders.
- Resume and announcement text are treated as untrusted data (prompt-injection hardening).
- Users can only read their own rows; only the service role can write or call the credit functions.
- Concurrent requests cannot overspend a credit; duplicate webhooks cannot double-grant.
- A `sk_live_` Stripe key is refused unless `STRIPE_ALLOW_LIVE=true`.
- Provider error details never reach the user.

## Setup (about 20 minutes)
1. **Supabase**: create a project. Run `supabase/migrations/001_init.sql` in the SQL editor.
   Auth > URL Configuration: set Site URL to your site URL and add `http://localhost:3000` to redirect URLs.
2. **Stripe (test mode)**: copy the `sk_test_...` secret key. No products needed: prices are created inline at checkout.
3. **Anthropic**: create an API key. Set a **monthly spend limit** on the workspace.
4. `cp .env.example .env.local` and fill it in.
5. `npm install && npm run dev`
6. **Webhook locally**: `stripe listen --forward-to localhost:3000/api/stripe/webhook`, copy the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`.
7. Sign in, click Buy, pay with test card `4242 4242 4242 4242` (any future date, any CVC), and watch the credits appear.

## Deploy (Vercel)
Import the repo, set **Root Directory** to `resume-converter`, add the env vars from `.env.example`, deploy.
Then in the Stripe dashboard (test mode) add a webhook endpoint `https://YOUR-SITE/api/stripe/webhook`
for the `checkout.session.completed` event and put its signing secret in `STRIPE_WEBHOOK_SECRET`.
The convert route sets `maxDuration = 300`; check your Vercel plan's limit.

## Cost
Default model is `claude-opus-5-5` ($4 in / $20 out per 1M tokens). A typical job (roughly 15K in, 5K out)
should cost on the order of $0.15 against a $19 price. `CLAUDE_MODEL=claude-sonnet-5-5` roughly halves that.
Check `jobs.input_tokens` / `jobs.output_tokens` after real runs and adjust. Confirm prices on Anthropic's pricing page.

## Going live (only when you are ready)
1. Test end to end in test mode with real resumes and read the output critically.
2. Add a privacy policy and terms; state clearly that output is an AI draft.
3. Swap in live Stripe keys, set `STRIPE_ALLOW_LIVE=true` and `NEXT_PUBLIC_STRIPE_TEST_MODE=false`, create the live webhook.
4. Schedule `select public.purge_old_jobs()` daily (pg_cron) so resume text is deleted after 30 days.

## Tests
`npm test` runs 27 tests: SQL credit logic (embedded Postgres, including permission and RLS checks),
prompt/pipeline, job runner, webhook signature handling, DOCX output.

## Not verified yet (needs your keys)
- Real Supabase email delivery and Stripe Checkout redirect (tested only against local stand-ins).
- The Claude request against the live API (request shape was checked against the SDK docs and a local stand-in).
- Output quality on real federal announcements: read several results yourself before charging anyone.

## Ideas for later
Free "match check" preview (cheap model, rate limited) to improve conversion; PDF/DOCX resume upload;
re-run with edits; other resume niches (nursing, military-to-civilian).
