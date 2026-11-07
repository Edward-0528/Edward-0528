import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}

let admin: SupabaseClient | null = null;
/** Service-role client. Server only. Bypasses RLS. */
export function supabaseAdmin(): SupabaseClient {
  if (!admin) {
    admin = createClient(need("NEXT_PUBLIC_SUPABASE_URL"), need("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}

/** Verify the bearer token sent by the browser and return the user id, or null. */
export async function userFromRequest(req: Request): Promise<{ id: string; email: string | null } | null> {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  const { data, error } = await supabaseAdmin().auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

/**
 * Throws if a live Stripe key is configured without explicit opt-in.
 * Keeps the project in test mode until you deliberately go live.
 */
export function assertStripeKeyAllowed(key: string, allowLive: string | undefined): void {
  if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) {
    if (allowLive !== "true") {
      throw new Error("Refusing to use a live Stripe key. Use sk_test_... or set STRIPE_ALLOW_LIVE=true deliberately.");
    }
  }
}

let stripeClient: Stripe | null = null;
export function stripe(): Stripe {
  if (!stripeClient) {
    const key = need("STRIPE_SECRET_KEY");
    assertStripeKeyAllowed(key, process.env.STRIPE_ALLOW_LIVE);
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}
