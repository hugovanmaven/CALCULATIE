import type { TitelInput, MarketingOnderdeel } from '../api/types';

export interface Verdeling {
  webshop: number;
  retail: number;
  b2b: number;
}

/** Spiegel van bereken_marketing_budget in calculatie.py (Task 2). */
export function berekenMarketingBudget(t: TitelInput, v: Verdeling): number {
  if (!t.drukken.length) return 0;
  const eersteOplage = [...t.drukken].sort((a, b) => a.druknummer - b.druknummer)[0].oplage;
  const vkpEx = t.verkoopprijs_incl_btw / (1 + t.btw_percentage);
  const retailBasis = vkpEx - vkpEx * t.boekhandelskorting;
  const webshopBasis = vkpEx - t.fulfillment_per_ex - t.verkoopprijs_incl_btw * t.transactiekosten_pct;
  const b2bBasis = vkpEx - vkpEx * t.b2b_korting_pct - t.b2b_porto_per_ex;
  const gewogen = v.webshop * webshopBasis + v.retail * retailBasis + v.b2b * b2bBasis;
  return t.marketing_budget_pct * eersteOplage * gewogen;
}

export function margeKost(o: MarketingOnderdeel): number {
  return Math.max(o.toegewezen, o.committed, o.besteed);
}

export function generateOnderdeelId(): string {
  return 'custom_' + Math.random().toString(36).slice(2, 9);
}
