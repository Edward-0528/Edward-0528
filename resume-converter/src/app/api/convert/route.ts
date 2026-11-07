import { after } from "next/server";
import { ConvertInputSchema } from "@/lib/schema";
import { runJob } from "@/lib/jobs";
import { supabaseAdmin, userFromRequest } from "@/lib/server";

export const maxDuration = 300;

export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = ConvertInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const { resume, announcement } = parsed.data;

  const db = supabaseAdmin();
  const { data: jobId, error } = await db.rpc("start_job", {
    p_user: user.id,
    p_resume: resume,
    p_announcement: announcement,
  });
  if (error) {
    if (error.message.includes("insufficient_credits")) {
      return Response.json({ error: "You need a credit. Buy one to continue." }, { status: 402 });
    }
    if (error.message.includes("rate_limited")) {
      return Response.json({ error: "Too many requests. Try again in a little while." }, { status: 429 });
    }
    console.error("start_job error", error.message);
    return Response.json({ error: "Could not start the job." }, { status: 500 });
  }

  after(() =>
    runJob(jobId as string, resume, announcement, {
      complete: async (id, out) => {
        const { error: e } = await db.rpc("complete_job", {
          p_job: id,
          p_result: out.result,
          p_in: out.inputTokens,
          p_out: out.outputTokens,
        });
        if (e) throw new Error(e.message);
      },
      fail: async (id, message) => {
        const { error: e } = await db.rpc("fail_job", { p_job: id, p_error: message });
        if (e) throw new Error(e.message);
      },
    }),
  );

  return Response.json({ jobId });
}
