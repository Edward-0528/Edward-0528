import type Stripe from "stripe";
import { getPack } from "./packs";

export type Grant = (userId: string, credits: number, sessionId: string) => Promise<boolean>;

export type WebhookOutcome =
  | { handled: true; granted: boolean; credits?: number }
  | { handled: false; reason: string };

/**
 * Handle a verified Stripe event. Credits come from OUR pack table (by pack id),
 * never from numbers in the event metadata. Idempotent via the session id.
 */
export async function handleStripeEvent(event: Stripe.Event, grant: Grant): Promise<WebhookOutcome> {
  if (event.type !== "checkout.session.completed") {
    return { handled: false, reason: `ignored event type ${event.type}` };
  }
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid") {
    return { handled: false, reason: "session not paid" };
  }
  const userId = session.client_reference_id || session.metadata?.user_id;
  const pack = getPack(session.metadata?.pack_id || "");
  if (!userId || !pack) {
    return { handled: false, reason: "missing user or unknown pack" };
  }
  const granted = await grant(userId, pack.credits, session.id);
  return { handled: true, granted, credits: pack.credits };
}
