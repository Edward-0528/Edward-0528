import { PACKS } from "@/lib/packs";
import { supabaseAdmin, userFromRequest } from "@/lib/server";

export async function GET(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });
  const { data, error } = await supabaseAdmin().rpc("credit_balance", { p_user: user.id });
  if (error) return Response.json({ error: "Could not load balance." }, { status: 500 });
  return Response.json({
    email: user.email,
    credits: data ?? 0,
    packs: PACKS.map((p) => ({ id: p.id, name: p.name, credits: p.credits, priceCents: p.priceCents })),
  });
}
