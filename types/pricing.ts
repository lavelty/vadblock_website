export interface Tier {
  name: 'Starter' | 'Pro' | 'Advanced';
  description: string;
  features: string[];
  priceId: { month: string; year: string };
  badge?: string;
  featured?: boolean;
}

export type BillingCycle = 'month' | 'year';

export interface PriceMap {
  [priceId: string]: string; // formatted total string from Paddle (e.g., "$10.00", "£8.00")
}
