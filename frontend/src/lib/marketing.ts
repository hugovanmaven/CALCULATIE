import type { TitelInput, DrukConfig, MarketingOnderdeel } from '../api/types';

export interface Verdeling { webshop: number; retail: number; b2b: number; }

/** Spiegel van bereken_marketing_budget (calculatie.py): per druk. */
export function berekenMarketingBudget(druk: DrukConfig, t: TitelInput, v: Verdeling): number {
  const vkpEx = t.verkoopprijs_incl_btw / (1 + t.btw_percentage);
  const retailBasis = vkpEx - vkpEx * t.boekhandelskorting;
  const webshopBasis = vkpEx - t.fulfillment_per_ex - t.verkoopprijs_incl_btw * t.transactiekosten_pct;
  const b2bBasis = vkpEx - vkpEx * t.b2b_korting_pct - t.b2b_porto_per_ex;
  const gewogen = v.webshop * webshopBasis + v.retail * retailBasis + v.b2b * b2bBasis;
  return (druk.marketing_budget_pct ?? 0.08) * druk.oplage * gewogen;
}

export function margeKost(o: MarketingOnderdeel): number {
  return o.toegewezen;
}

export function generateOnderdeelId(): string {
  return 'custom_' + Math.random().toString(36).slice(2, 9);
}

export const AD_SPEND_ID = 'ad_spend';

/** Afgeleide gemiddelde CAC op basis van ad-spend toegewezen budget / webshop-verkopen. */
export function berekenGemiddeldeCac(druk: DrukConfig, v: Verdeling): number {
  const ad = (druk.marketing_onderdelen ?? []).find(o => o.id === AD_SPEND_ID);
  const webshopVerkopen = v.webshop * druk.oplage;
  if (!ad || webshopVerkopen <= 0) return 0;
  return ad.toegewezen / webshopVerkopen;
}
