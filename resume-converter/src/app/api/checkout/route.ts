import { getPack } from "@/lib/packs";
import { siteUrl, stripe, userFromRequest } from "@/lib/server";

export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { packId?: string };
  const pack = getPack(body.packId || "");
  if (!pack) return Response.json({ error: "Unknown pack." }, { status: 400 });

  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    client_reference_id: user.id,
    customer_email: user.email ?? undefined,
    metadata: { user_id: user.id, pack_id: pack.id },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: pack.priceCents,
          product_data: { name: `Federal Resume Converter: ${pack.name}` },
        },
      },
    ],
    success_url: `${siteUrl()}/?paid=1`,
    cancel_url: `${siteUrl()}/?canceled=1`,
  });

  return Response.json({ url: session.url });
}
