import { handleStripeEvent } from "@/lib/webhook";
import { stripe, supabaseAdmin } from "@/lib/server";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!secret || !signature) return new Response("Bad request", { status: 400 });

  // Signature verification needs the exact raw body.
  const raw = await req.text();
  let event;
  try {
    event = stripe().webhooks.constructEvent(raw, signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    const outcome = await handleStripeEvent(event, async (userId, credits, sessionId) => {
      const { data, error } = await supabaseAdmin().rpc("grant_purchase", {
        p_user: userId,
        p_credits: credits,
        p_session: sessionId,
      });
      if (error) throw new Error(error.message);
      return data === true;
    });
    return Response.json({ received: true, ...outcome });
  } catch (err) {
    console.error("webhook error", err instanceof Error ? err.message : err);
    // 500 makes Stripe retry; grants are idempotent so a retry is safe.
    return new Response("Webhook handler failed", { status: 500 });
  }
}
