"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getBrowserClient } from "@/lib/browser";
import type { ResumeResult } from "@/lib/schema";

type Pack = { id: string; name: string; credits: number; priceCents: number };
type Me = { email: string | null; credits: number; packs: Pack[] };
type JobView = { status: "running" | "done" | "failed"; result?: ResumeResult | null; error?: string | null };

// Set NEXT_PUBLIC_STRIPE_TEST_MODE=false when you go live to hide the test-mode notices.
const TEST_MODE = process.env.NEXT_PUBLIC_STRIPE_TEST_MODE !== "false";
const dollars = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;

export default function Home() {
  const supabase = getBrowserClient();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!supabase) { setReady(true); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const authed = useCallback(
    (path: string, init: RequestInit = {}) =>
      fetch(path, {
        ...init,
        headers: { ...(init.headers || {}), "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
      }),
    [session],
  );

  const refreshMe = useCallback(async () => {
    if (!session) { setMe(null); return; }
    const res = await authed("/api/me");
    if (res.ok) setMe(await res.json());
  }, [session, authed]);

  useEffect(() => { refreshMe(); }, [refreshMe]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("paid")) setNotice("Payment received. Your credits will appear in a moment.");
    if (q.get("canceled")) setNotice("Checkout canceled. You were not charged.");
  }, []);

  // After returning from Stripe the webhook may take a few seconds: poll briefly.
  useEffect(() => {
    if (!notice.startsWith("Payment received") || !session) return;
    const t = setInterval(refreshMe, 3000);
    const stop = setTimeout(() => clearInterval(t), 30000);
    return () => { clearInterval(t); clearTimeout(stop); };
  }, [notice, session, refreshMe]);

  if (!ready) return <div className="wrap"><p className="note" style={{ marginTop: 40 }}>Loading...</p></div>;
  if (!supabase) {
    return (
      <div className="wrap">
        <h1>Setup needed</h1>
        <p>Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example), then restart.</p>
      </div>
    );
  }

  return (
    <div className="wrap">
      <header className="top">
        <span className="brand">Federal Resume Converter</span>
        {session && me ? (
          <span className="row">
            <span className="note">{me.email} &middot; {me.credits} credit{me.credits === 1 ? "" : "s"}</span>
            <button className="btn secondary" onClick={() => supabase.auth.signOut()}>Sign out</button>
          </span>
        ) : null}
      </header>
      {notice ? <p className="ok" role="status" style={{ marginTop: 16 }}>{notice}</p> : null}
      {!session ? <SignIn /> : <App me={me} authed={authed} refreshMe={refreshMe} />}
      <p className="note" style={{ marginTop: 40 }}>
        AI-generated drafts. You are responsible for the accuracy of anything you submit. This is not legal or career advice.
        Resume text is stored for up to 30 days and is not shared.{TEST_MODE ? " Test mode: no real charges." : ""}
      </p>
    </div>
  );
}

function SignIn() {
  const supabase = getBrowserClient()!;
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setMsg(""); setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) setErr("Could not send the sign-in link. Please check the email address and try again.");
    else setMsg("Check your email for a sign-in link.");
  }

  return (
    <>
      <h1>Turn your resume into a USAJOBS-style federal resume.</h1>
      <p className="lead">
        Paste your resume and the job announcement. Get a federal-format resume mapped to the announcement's requirements,
        a gap list of what to add, and an editable Word file.
      </p>
      <div className="card">
        <form onSubmit={submit}>
          <label className="field" htmlFor="email">Email (we send you a sign-in link)</label>
          <div className="row">
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={{ flex: "1 1 240px" }} />
            <button className="btn" type="submit" disabled={busy}>Get started</button>
          </div>
        </form>
        {msg ? <p className="ok" role="status">{msg}</p> : null}
        {err ? <p className="err" role="alert">{err}</p> : null}
      </div>
      <h2>How it works</h2>
      <ul>
        <li>It only uses facts from your resume. Anything missing (hours per week, salary, supervisor) becomes a to-do for you instead of an invented detail.</li>
        <li>Every requirement in the announcement is rated strong, partial or missing, with evidence.</li>
        <li>Pay per announcement. No subscription.</li>
      </ul>
    </>
  );
}

function App({ me, authed, refreshMe }: {
  me: Me | null;
  authed: (p: string, i?: RequestInit) => Promise<Response>;
  refreshMe: () => Promise<void>;
}) {
  const [resume, setResume] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobView | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  async function buy(packId: string) {
    setErr("");
    const res = await authed("/api/checkout", { method: "POST", body: JSON.stringify({ packId }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.url) window.location.href = data.url;
    else setErr(data.error || "Could not start checkout.");
  }

  function poll(id: string) {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(async () => {
      const res = await authed(`/api/jobs/${id}`);
      if (!res.ok) return;
      const data: JobView = await res.json();
      setJob(data);
      if (data.status !== "running") {
        if (timer.current) clearInterval(timer.current);
        refreshMe();
      }
    }, 3000);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true); setJob(null);
    const res = await authed("/api/convert", { method: "POST", body: JSON.stringify({ resume, announcement, confirm }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(data.error || "Something went wrong."); return; }
    setJobId(data.jobId);
    setJob({ status: "running" });
    refreshMe();
    poll(data.jobId);
  }

  async function download() {
    if (!jobId) return;
    const res = await authed(`/api/jobs/${jobId}/docx`);
    if (!res.ok) { setErr("Could not download the file."); return; }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url; a.download = "federal-resume.docx"; a.click();
    URL.revokeObjectURL(url);
  }

  const credits = me?.credits ?? 0;
  const running = job?.status === "running";

  return (
    <>
      <h1>Convert a resume</h1>

      {credits < 1 && me ? (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Buy credits</h2>
          <p className="note">One credit converts one resume for one job announcement. Failed conversions are refunded automatically.{TEST_MODE ? " Test mode: use card 4242 4242 4242 4242." : ""}</p>
          <div className="packs">
            {me.packs.map((p) => (
              <div className="pack" key={p.id}>
                <div className="price">{dollars(p.priceCents)}</div>
                <div>{p.name}</div>
                <button className="btn" style={{ marginTop: 10 }} onClick={() => buy(p.id)}>Buy</button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <form className="card" onSubmit={submit}>
        <label className="field" htmlFor="ann">Job announcement (paste the full text from USAJOBS)</label>
        <textarea id="ann" value={announcement} onChange={(e) => setAnnouncement(e.target.value)} required minLength={200} maxLength={30000} />
        <label className="field" htmlFor="res">Your current resume (paste the text)</label>
        <textarea id="res" value={resume} onChange={(e) => setResume(e.target.value)} required minLength={200} maxLength={30000} />
        <p className="note">Remove anything sensitive you don't want processed, such as your SSN. Text is sent to an AI provider to generate the result.</p>
        <label className="row" style={{ margin: "10px 0" }}>
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
          <span>I understand this is an AI draft and I will check every line for accuracy before submitting.</span>
        </label>
        <button className="btn" type="submit" disabled={busy || running || !confirm || credits < 1}>
          {running ? "Working..." : "Convert (1 credit)"}
        </button>
        {err ? <p className="err" role="alert">{err}</p> : null}
      </form>

      {running ? <p role="status">Generating your resume. This usually takes 1 to 3 minutes. You can leave this page open.</p> : null}
      {job?.status === "failed" ? <p className="err" role="alert">{job.error || "The job failed. Your credit was refunded."}</p> : null}
      {job?.status === "done" && job.result ? <Result r={job.result} onDownload={download} /> : null}
    </>
  );
}

function Result({ r, onDownload }: { r: ResumeResult; onDownload: () => void }) {
  return (
    <div className="job">
      <h2>Your result</h2>
      <p><button className="btn" onClick={onDownload}>Download Word file (.docx)</button></p>

      {r.missing_info.length ? (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Add these before you submit</h3>
          <ul>{r.missing_info.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      ) : null}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>How you match the announcement</h3>
        <table>
          <thead><tr><th>Requirement</th><th>Match</th><th>Evidence</th></tr></thead>
          <tbody>
            {r.requirement_mapping.map((m, i) => (
              <tr key={i}><td>{m.requirement}</td><td><span className={`badge ${m.strength}`}>{m.strength}</span></td><td>{m.evidence}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      {r.work_experience.map((w, i) => (
        <div className="card" key={i}>
          <strong>{w.title}, {w.employer}</strong>
          <div className="note">{[w.start_date, w.end_date].filter(Boolean).join(" to ")}</div>
          <ul>{w.duties.map((d, j) => <li key={j}>{d}</li>)}</ul>
        </div>
      ))}

      {r.notes.length ? (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Notes</h3>
          <ul>{r.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </div>
      ) : null}
    </div>
  );
}
