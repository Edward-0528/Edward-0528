# Site: landing page + free calculators

Static site, no build step. Everything is configured in `config.js`.

- `index.html`: landing page for the Launch Pack. Runs as a **waitlist** until you add a `checkoutUrl`, then switches to **buy** mode.
- `tools/index.html`: three calculators (store payout, AdMob revenue, subscription LTV). Rates are editable inputs, so they never go stale in the code.
- `calc.js`: the math (pure functions) and form wiring. `waitlist.js`: email capture and mode switching.

## Preview locally
```
cd site && python3 -m http.server 8123
# open http://localhost:8123
```

## Deploy (Vercel, free tier)
1. Import the GitHub repo in Vercel.
2. Set **Root Directory** to `site`. Framework preset: Other. No build command.
3. Deploy. (Netlify works the same way: publish directory `site`.)

## Connect the email list (Supabase)
Run this in the Supabase SQL editor. It lets the public site insert emails but never read them:

```sql
create table public.waitlist (
  id bigint generated always as identity primary key,
  email text not null unique,
  source text,
  created_at timestamptz not null default now()
);
alter table public.waitlist enable row level security;
create policy "anyone can sign up" on public.waitlist
  for insert to anon with check (true);
```

Then in `config.js`:
```js
waitlist: {
  endpoint: "https://YOUR-PROJECT.supabase.co/rest/v1/waitlist",
  headers: { apikey: "YOUR_ANON_KEY", Authorization: "Bearer YOUR_ANON_KEY", Prefer: "return=minimal" }
}
```
The anon (publishable) key is meant to be public. Never put the service-role key here.
A duplicate email returns an error, and the page shows its generic "something went wrong" message; that is expected.

## Switch to selling
Create a Lemon Squeezy or Stripe payment link for the guide, paste it into `checkoutUrl`, and redeploy. Only do this once the guide exists.

## Before going live
- Rename the product in `config.js` if you like.
- Fill in `links.appStore` and `links.googlePlay` (hidden while empty).
- Add a privacy policy page before collecting emails at scale.
- Check the current store fee rates and update the calculator defaults and the note under it.
