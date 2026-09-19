export const EVENT_TYPES = ["Wedding", "Naming Ceremony", "Burial / Memorial", "Corporate Event"] as const;
export const CITIES = ["Lagos", "Abuja", "Port Harcourt"] as const;
export const STYLE_TIERS = ["Essential", "Classic", "Premium"] as const;
export type EventType = typeof EVENT_TYPES[number];
export type City = typeof CITIES[number];
export type StyleTier = typeof STYLE_TIERS[number];

export type BenchmarkRow = {
  category: string;
  pct_of_total: number;
  sample_size: number;
};

export type EstimateLine = BenchmarkRow & { amount: number; risk: boolean };
export type Estimate = { total: number; lines: EstimateLine[]; eventType: EventType; city: City; styleTier: StyleTier; guestCount: number };
