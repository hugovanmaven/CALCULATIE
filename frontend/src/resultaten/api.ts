// API-client voor de Resultaten-module. Los van de calculatie-client zodat de
// hele map in één keer te verwijderen is.

const BASE = '/resultaten/api';

export interface Stroom {
  key: string;
  label: string;
  begroot: number;
  geboekt: number;
  gebruikt: number;
  overschrijding: boolean;
}

export interface KanaalAgg {
  stuks: number;
  omzet: number;
  prijs_ex_btw: number;
}

export interface TitelResultaat {
  recept_id: string;
  titel: string;
  isbn: string;
  titel_naam: string;
  periode: string;
  verkocht: { totaal: number; per_kanaal: Record<string, number> };
  netto_omzet: number;
  kanalen: Record<string, KanaalAgg>;
  vormen: Record<string, { stuks: number; omzet: number }>;
  stromen: Stroom[];
  kosten_totaal: number;
  brutowinst: number;
  marge_pct: number;
  winstdeling: number;
  resultaat: number;
  resultaat_marge_pct: number;
  royalty_staffel_pct: number;
  cumulatief_opening: number;
  dekkingsgraad_pct: number;
  streef_pct: number;
  ondergrens_pct: number;
  status: 'groen' | 'oranje' | 'rood';
}

export interface MavenTotaal {
  netto_omzet: number;
  kosten_totaal: number;
  brutowinst: number;
  winstdeling: number;
  resultaat: number;
  stuks: number;
  marge_pct: number;
  resultaat_marge_pct: number;
  streef_pct: number;
  ondergrens_pct: number;
  status: 'groen' | 'oranje' | 'rood';
  aantal_titels: number;
}

export interface Overzicht {
  periode: string;
  maven_totaal: MavenTotaal;
  titels: TitelResultaat[];
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`Resultaten API ${res.status}`);
  return res.json();
}

/** True als de module aan staat (flag); 404/ping faalt → uit. */
export async function checkEnabled(): Promise<boolean> {
  try {
    const res = await fetch(BASE + '/ping');
    return res.ok;
  } catch {
    return false;
  }
}

export interface GeboekteRegel {
  exact_ref: string;
  datum: string;
  relatie: string;
  grootboek: string;
  omschrijving: string;
  stroom: string;
  categorie: string;
  bedrag: number;
  calculatie_post: string;
  match_bron: string;
  match_confidence: number | null;
}

export async function importExact(file: File): Promise<{ rijen: number; nieuw: number; bijgewerkt: number }> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(BASE + '/import/exact', { method: 'POST', body: fd });
  if (!res.ok) throw new Error(`Import ${res.status}`);
  return res.json();
}

export const getKosten = (isbn: string, periode: string) =>
  get<{ isbn: string; regels: GeboekteRegel[] }>(`/kosten/${isbn}?periode=${encodeURIComponent(periode)}`).then(r => r.regels);

export const getPeriodes = () => get<{ periodes: string[] }>('/periodes').then(r => r.periodes);
export const getOverzicht = (periode: string) => get<Overzicht>(`/overzicht?periode=${encodeURIComponent(periode)}`);
export const getTitel = (id: string, periode: string) =>
  get<TitelResultaat>(`/titel/${id}?periode=${encodeURIComponent(periode)}`);

// ── Formatters ──
export const euro = (n: number) =>
  n.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
export const euro2 = (n: number) =>
  n.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
export const getal = (n: number) => n.toLocaleString('nl-NL');

export const KANAAL_LABEL: Record<string, string> = {
  retail: 'Retail / CB',
  webshop: 'Webshop',
  b2b: 'B2B',
  overig: 'Overig',
};
