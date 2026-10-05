/** TrueCost v2.1 money helpers. Persist integer kobo, never floating-point NGN. */
export const CURRENCY = "NGN" as const;
export type Kobo = number;

export function nairaToKobo(nairaAmount: number): Kobo {
  if (!Number.isFinite(nairaAmount) || nairaAmount < 0) throw new Error("Invalid naira amount.");
  return Math.round(nairaAmount * 100);
}

export function parseNairaInputToKobo(value: string): Kobo {
  const amount = Number(value.replace(/[^0-9.]/g, ""));
  return nairaToKobo(amount);
}

export function koboToNaira(kobo: number): number {
  if (!Number.isInteger(kobo) || kobo < 0) throw new Error("Invalid kobo amount.");
  return kobo / 100;
}

export function formatKobo(kobo: number): string {
  if (!Number.isInteger(kobo) || kobo < 0) throw new Error("Invalid kobo amount.");
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: CURRENCY,
    maximumFractionDigits: 0,
  }).format(kobo / 100);
}
