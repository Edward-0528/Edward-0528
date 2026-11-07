/** Credit packs sold through Stripe Checkout. Prices live here, server-side only. */
export type Pack = { id: string; name: string; credits: number; priceCents: number };

export const PACKS: Pack[] = [
  { id: "single", name: "1 job announcement", credits: 1, priceCents: 1900 },
  { id: "triple", name: "3 job announcements", credits: 3, priceCents: 3900 },
];

export function getPack(id: string): Pack | undefined {
  return PACKS.find((p) => p.id === id);
}
