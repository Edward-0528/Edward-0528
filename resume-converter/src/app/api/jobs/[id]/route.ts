import { isStuck } from "@/lib/jobs";
import { supabaseAdmin, userFromRequest } from "@/lib/server";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await userFromRequest(req);
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });
  const { id } = await ctx.params;

  const db = supabaseAdmin();
  const { data: job } = await db
    .from("jobs")
    .select("id,status,result,error,created_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!job) return Response.json({ error: "Not found." }, { status: 404 });

  // Lazily recover jobs whose worker was killed: mark failed and refund the credit.
  if (isStuck(job.status, job.created_at)) {
    await db.rpc("fail_job", { p_job: id, p_error: "The job timed out. Your credit has been refunded." });
    return Response.json({ status: "failed", error: "The job timed out. Your credit has been refunded." });
  }

  return Response.json({ status: job.status, result: job.result, error: job.error });
}
