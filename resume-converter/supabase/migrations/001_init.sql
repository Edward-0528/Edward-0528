-- Resume converter schema. Run in the Supabase SQL editor (or `supabase db push`).
-- All writes happen through service-role-only functions; clients can only read their own rows.

create table if not exists public.credits_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  delta integer not null,
  reason text not null check (reason in ('purchase', 'job', 'refund', 'manual')),
  stripe_session_id text unique,
  job_id uuid,
  created_at timestamptz not null default now()
);
-- A job can be charged once and refunded once.
create unique index if not exists credits_ledger_job_reason_idx
  on public.credits_ledger (job_id, reason) where job_id is not null;
create index if not exists credits_ledger_user_idx on public.credits_ledger (user_id);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  resume_text text,
  announcement_text text,
  result jsonb,
  error text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists jobs_user_created_idx on public.jobs (user_id, created_at desc);

alter table public.credits_ledger enable row level security;
alter table public.jobs enable row level security;

drop policy if exists "read own ledger" on public.credits_ledger;
create policy "read own ledger" on public.credits_ledger
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "read own jobs" on public.jobs;
create policy "read own jobs" on public.jobs
  for select to authenticated using (user_id = auth.uid());

-- No insert/update/delete policies: only the service role (which bypasses RLS) can write.

create or replace function public.credit_balance(p_user uuid)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(sum(delta), 0)::integer from public.credits_ledger where user_id = p_user;
$$;

-- Atomically check balance + rate limit, create the job and take 1 credit.
create or replace function public.start_job(
  p_user uuid, p_resume text, p_announcement text, p_max_per_hour integer default 10
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_job uuid;
begin
  -- Serialise per user so two concurrent requests cannot both spend the last credit.
  perform pg_advisory_xact_lock(hashtext(p_user::text));

  if (select count(*) from public.jobs
      where user_id = p_user and created_at > now() - interval '1 hour') >= p_max_per_hour then
    raise exception 'rate_limited';
  end if;

  if public.credit_balance(p_user) < 1 then
    raise exception 'insufficient_credits';
  end if;

  insert into public.jobs (user_id, resume_text, announcement_text)
  values (p_user, p_resume, p_announcement) returning id into v_job;

  insert into public.credits_ledger (user_id, delta, reason, job_id)
  values (p_user, -1, 'job', v_job);

  return v_job;
end $$;

create or replace function public.complete_job(
  p_job uuid, p_result jsonb, p_in integer, p_out integer
) returns void language sql security definer set search_path = public as $$
  update public.jobs
     set status = 'done', result = p_result, input_tokens = p_in, output_tokens = p_out,
         finished_at = now()
   where id = p_job and status = 'running';
$$;

-- Mark failed and refund the credit exactly once.
create or replace function public.fail_job(p_job uuid, p_error text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
begin
  update public.jobs set status = 'failed', error = left(p_error, 500), finished_at = now()
   where id = p_job and status = 'running'
   returning user_id into v_user;

  if v_user is not null then
    insert into public.credits_ledger (user_id, delta, reason, job_id)
    values (v_user, 1, 'refund', p_job)
    on conflict do nothing;
  end if;
end $$;

-- Idempotent purchase grant keyed by the Stripe Checkout session id.
-- Returns true if credits were added, false if this session was already processed.
create or replace function public.grant_purchase(p_user uuid, p_credits integer, p_session text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_rows integer;
begin
  insert into public.credits_ledger (user_id, delta, reason, stripe_session_id)
  values (p_user, p_credits, 'purchase', p_session)
  on conflict (stripe_session_id) do nothing;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end $$;

-- Privacy: remove resume text after 30 days. Schedule with pg_cron or a Supabase scheduled function:
--   select cron.schedule('purge-old-jobs', '0 3 * * *', 'select public.purge_old_jobs()');
create or replace function public.purge_old_jobs()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_rows integer;
begin
  update public.jobs
     set resume_text = null, announcement_text = null, result = null
   where created_at < now() - interval '30 days' and (resume_text is not null or result is not null);
  get diagnostics v_rows = row_count;
  return v_rows;
end $$;

-- Lock the functions down: service role only.
revoke all on function public.credit_balance(uuid) from public, anon, authenticated;
revoke all on function public.start_job(uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.complete_job(uuid, jsonb, integer, integer) from public, anon, authenticated;
revoke all on function public.fail_job(uuid, text) from public, anon, authenticated;
revoke all on function public.grant_purchase(uuid, integer, text) from public, anon, authenticated;
revoke all on function public.purge_old_jobs() from public, anon, authenticated;
grant execute on function public.credit_balance(uuid) to service_role;
grant execute on function public.start_job(uuid, text, text, integer) to service_role;
grant execute on function public.complete_job(uuid, jsonb, integer, integer) to service_role;
grant execute on function public.fail_job(uuid, text) to service_role;
grant execute on function public.grant_purchase(uuid, integer, text) to service_role;
grant execute on function public.purge_old_jobs() to service_role;
