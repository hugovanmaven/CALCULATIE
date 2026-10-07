import type { TitelInput, MarketingOnderdeel } from '../api/types';

export interface Verdeling { webshop: number; retail: number; b2b: number; }

/** Spiegel van bereken_marketing_budget (calculatie.py): TOTALE oplage, pct van de eerste druk. */
export function berekenMarketingBudget(t: TitelInput, v: Verdeling): number {
  if (!t.drukken.length) return 0;
  const eerste = [...t.drukken].sort((a, b) => a.druknummer - b.druknummer)[0];
  const totaleOplage = t.drukken.reduce((s, d) => s + d.oplage, 0);
  const vkpEx = t.verkoopprijs_incl_btw / (1 + t.btw_percentage);
  const retailBasis = vkpEx - vkpEx * t.boekhandelskorting;
  const webshopBasis = vkpEx - t.fulfillment_per_ex - t.verkoopprijs_incl_btw * t.transactiekosten_pct;
  const b2bBasis = vkpEx - vkpEx * t.b2b_korting_pct - t.b2b_porto_per_ex;
  const gewogen = v.webshop * webshopBasis + v.retail * retailBasis + v.b2b * b2bBasis;
  return (eerste.marketing_budget_pct ?? 0.08) * totaleOplage * gewogen;
}

export function margeKost(o: MarketingOnderdeel): number {
  return o.toegewezen;
}

export function generateOnderdeelId(): string {
  return 'custom_' + Math.random().toString(36).slice(2, 9);
}

export const AD_SPEND_ID = 'ad_spend';

/** Afgeleide gemiddelde CAC op basis van ad-spend (eerste druk) / webshop-verkopen (totale oplage). */
export function berekenGemiddeldeCac(t: TitelInput, v: Verdeling): number {
  if (!t.drukken.length) return 0;
  const eerste = [...t.drukken].sort((a, b) => a.druknummer - b.druknummer)[0];
  const ad = (eerste.marketing_onderdelen ?? []).find(o => o.id === AD_SPEND_ID);
  const totaleOplage = t.drukken.reduce((s, d) => s + d.oplage, 0);
  const webshopVerkopen = v.webshop * totaleOplage;
  if (!ad || webshopVerkopen <= 0) return 0;
  return ad.toegewezen / webshopVerkopen;
}
