import { buildDocx } from "@/lib/docx";
import { ResumeResultSchema } from "@/lib/schema";
import { supabaseAdmin, userFromRequest } from "@/lib/server";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await userFromRequest(req);
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });
  const { id } = await ctx.params;

  const { data: job } = await supabaseAdmin()
    .from("jobs")
    .select("status,result")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!job || job.status !== "done" || !job.result) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  const parsed = ResumeResultSchema.safeParse(job.result);
  if (!parsed.success) return Response.json({ error: "Result is unreadable." }, { status: 500 });

  const buf = await buildDocx(parsed.data);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": 'attachment; filename="federal-resume.docx"',
      "Cache-Control": "no-store",
    },
  });
}
