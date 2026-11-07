import { describe, it, expect, beforeEach } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

const MIGRATION = fs.readFileSync(path.join(__dirname, "../supabase/migrations/001_init.sql"), "utf8");
const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";

async function freshDb() {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    insert into auth.users values ('${A}'), ('${B}');
  `);
  await db.exec(MIGRATION);
  await db.exec(`grant select on all tables in schema public to authenticated;`);
  return db;
}

const balance = async (db: PGlite, u: string) =>
  (await db.query<{ b: number }>(`select public.credit_balance('${u}') as b`)).rows[0].b;

describe("credits ledger SQL", () => {
  let db: PGlite;
  beforeEach(async () => { db = await freshDb(); });

  it("grant_purchase is idempotent per Stripe session", async () => {
    const first = await db.query<{ g: boolean }>(`select public.grant_purchase('${A}', 3, 'cs_1') as g`);
    const again = await db.query<{ g: boolean }>(`select public.grant_purchase('${A}', 3, 'cs_1') as g`);
    expect(first.rows[0].g).toBe(true);
    expect(again.rows[0].g).toBe(false);
    expect(await balance(db, A)).toBe(3);
  });

  it("start_job requires a credit and takes exactly one", async () => {
    await expect(db.query(`select public.start_job('${A}', 'r', 'a')`)).rejects.toThrow(/insufficient_credits/);
    await db.query(`select public.grant_purchase('${A}', 1, 'cs_2')`);
    const job = await db.query<{ id: string }>(`select public.start_job('${A}', 'resume', 'ann') as id`);
    expect(job.rows[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await balance(db, A)).toBe(0);
    await expect(db.query(`select public.start_job('${A}', 'r', 'a')`)).rejects.toThrow(/insufficient_credits/);
  });

  it("fail_job refunds exactly once", async () => {
    await db.query(`select public.grant_purchase('${A}', 1, 'cs_3')`);
    const { rows } = await db.query<{ id: string }>(`select public.start_job('${A}', 'r', 'a') as id`);
    const id = rows[0].id;
    await db.query(`select public.fail_job('${id}', 'boom')`);
    await db.query(`select public.fail_job('${id}', 'boom again')`);
    expect(await balance(db, A)).toBe(1);
    const job = await db.query<{ status: string; error: string }>(`select status, error from public.jobs where id='${id}'`);
    expect(job.rows[0]).toEqual({ status: "failed", error: "boom" });
  });

  it("a completed job is never refunded", async () => {
    await db.query(`select public.grant_purchase('${A}', 1, 'cs_4')`);
    const { rows } = await db.query<{ id: string }>(`select public.start_job('${A}', 'r', 'a') as id`);
    const id = rows[0].id;
    await db.query(`select public.complete_job('${id}', '{"ok":true}'::jsonb, 10, 20)`);
    await db.query(`select public.fail_job('${id}', 'late failure')`);
    expect(await balance(db, A)).toBe(0);
    const job = await db.query<{ status: string }>(`select status from public.jobs where id='${id}'`);
    expect(job.rows[0].status).toBe("done");
  });

  it("rate limits jobs per hour", async () => {
    await db.query(`select public.grant_purchase('${A}', 5, 'cs_5')`);
    await db.query(`select public.start_job('${A}', 'r', 'a', 2)`);
    await db.query(`select public.start_job('${A}', 'r', 'a', 2)`);
    await expect(db.query(`select public.start_job('${A}', 'r', 'a', 2)`)).rejects.toThrow(/rate_limited/);
    expect(await balance(db, A)).toBe(3); // the blocked attempt did not charge
  });

  it("users cannot touch the ledger or call the functions directly", async () => {
    await db.query(`select public.grant_purchase('${A}', 2, 'cs_6'), public.grant_purchase('${B}', 9, 'cs_7')`);
    await db.exec(`set role authenticated; set request.jwt.sub = '${A}';`);
    const own = await db.query<{ user_id: string }>(`select user_id from public.credits_ledger`);
    expect(own.rows.map((r) => r.user_id)).toEqual([A]); // RLS hides B's rows
    await expect(db.query(`insert into public.credits_ledger (user_id, delta, reason) values ('${A}', 100, 'manual')`))
      .rejects.toThrow(/permission denied|row-level security/);
    await expect(db.query(`select public.grant_purchase('${A}', 100, 'cs_evil')`)).rejects.toThrow(/permission denied/);
    await expect(db.query(`select public.start_job('${A}', 'r', 'a')`)).rejects.toThrow(/permission denied/);
    await db.exec(`reset role;`);
    expect(await balance(db, A)).toBe(2);
  });

  it("purge_old_jobs clears resume text after 30 days", async () => {
    await db.query(`select public.grant_purchase('${A}', 1, 'cs_8')`);
    const { rows } = await db.query<{ id: string }>(`select public.start_job('${A}', 'secret resume', 'ann') as id`);
    await db.query(`update public.jobs set created_at = now() - interval '31 days' where id='${rows[0].id}'`);
    const purged = await db.query<{ n: number }>(`select public.purge_old_jobs() as n`);
    expect(purged.rows[0].n).toBe(1);
    const job = await db.query<{ resume_text: string | null }>(`select resume_text from public.jobs where id='${rows[0].id}'`);
    expect(job.rows[0].resume_text).toBeNull();
  });
});
