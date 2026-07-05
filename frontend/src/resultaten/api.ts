// API-client voor de Resultaten-module. Los van de calculatie-client zodat de
// hele map in één keer te verwijderen is.

const BASE = '/resultaten/api';

export interface Stroom {
  key: string;
  label: string;
  berekend: boolean;         // true = app berekent (kanaalkosten, royalty) — geen Exact-vergelijking
  begroot: number;
  geboekt: number;
  gebruikt: number;
  verschil: number;
  overschrijding: boolean;
  status: string;            // berekend|geboekt|overschrijding|verwacht_nog|niet_gemaakt|verkeerd_geboekt|onverklaard|leeg
  verklaring_status: string;
  notitie: string;
}

export interface Accuratesse {
  posten: number;
  geboekt: number;
  overschrijding: number;
  verwacht_nog: number;
  niet_gemaakt: number;
  verkeerd_geboekt: number;
  onverklaard: number;
  te_verklaren: number;
}

export interface KanaalAgg {
  stuks: number;
  omzet: number;
  prijs_ex_btw: number;
}

// Voorschot-inloopstatus per partij — informatief, telt niet in de marge.
export interface Voorschot {
  partij: string;
  voorschot: number;
  verdiend: number;
  ingelopen: number;
  open: number;
}

export interface TitelResultaat {
  recept_id: string | null;   // null = sales zonder calculatie-recept
  zonder_calculatie?: boolean;
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
  winstdeling_pct: number;
  resultaat: number;
  resultaat_marge_pct: number;
  overige_verkoopkosten: number;
  resultaat_na_verdeling: number;
  resultaat_na_verdeling_marge_pct?: number;
  royalty_staffel_pct: number;
  cumulatief_opening: number;
  voorschotten: Voorschot[];
  streef_pct: number;
  ondergrens_pct: number;
  status: 'groen' | 'oranje' | 'rood' | 'onbekend';
  afgesloten: boolean;
  accuratesse: Accuratesse;
}

export interface MavenTotaal {
  netto_omzet: number;
  kosten_totaal: number;
  brutowinst: number;
  winstdeling: number;
  resultaat: number;
  overige_verkoopkosten: number;
  resultaat_na_verdeling: number;
  resultaat_na_verdeling_marge_pct: number;
  stuks: number;
  marge_pct: number;
  resultaat_marge_pct: number;
  streef_pct: number;
  ondergrens_pct: number;
  status: 'groen' | 'oranje' | 'rood';
  aantal_titels: number;
  te_verklaren: number;
  afgesloten: boolean;
}

export interface Backlist {
  aantal_titels: number;
  zonder_calculatie: number;
  stuks: number;
  netto_omzet: number;
  kosten_totaal: number;
  brutowinst: number;
  winstdeling: number;
  resultaat: number;
  overige_verkoopkosten: number;
  resultaat_na_verdeling: number;
  resultaat_marge_pct: number;
}

export interface Overzicht {
  periode: string;
  maven_totaal: MavenTotaal;
  titels: TitelResultaat[];
  backlist: Backlist | null;
  overige_verkoopkosten_pool: number;
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
  resultaten_stroom: string;  // stroom-key uit de reken-laag (zelfde mapping als backend)
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

export async function importSfp(file: File, cutoverDatum: string): Promise<{ rijen: number; nieuw: number; bijgewerkt: number }> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('cutover_datum', cutoverDatum);
  const res = await fetch(BASE + '/import/sfp', { method: 'POST', body: fd });
  if (!res.ok) throw new Error(`Import ${res.status}`);
  return res.json();
}

export type Bestemming = 'titel' | 'verdeeld' | 'genegeerd' | 'tebeoordelen';

export interface ExactAuditRegel extends GeboekteRegel {
  periode: string;
  isbn: string;
  titel: string;
  dispositie: string;
  bestemming: Bestemming;
}

export interface ExactAudit {
  periode: string;
  totaal: {
    regels: number; bedrag: number;
    titel_regels: number; titel_bedrag: number;
    verdeeld_regels: number; verdeeld_bedrag: number;
    genegeerd_regels: number; genegeerd_bedrag: number;
    tebeoordelen_regels: number; tebeoordelen_bedrag: number;
  };
  per_grootboek: Record<string, { regels: number; bedrag: number; titel: number; verdeeld: number; genegeerd: number; tebeoordelen: number }>;
  regels: ExactAuditRegel[];
}

export const getExactAudit = (periode: string) =>
  get<ExactAudit>(`/exact-audit?periode=${encodeURIComponent(periode)}`);

// Lichte variant: alleen de totalen (voor het acties-blok — geen regels laden).
export const getExactAuditSummary = (periode: string) =>
  get<Pick<ExactAudit, 'periode' | 'totaal'>>(`/exact-audit?periode=${encodeURIComponent(periode)}&summary=1`);

export interface TitelKeuze { recept_id: string; titel: string; isbn: string }

// Titel-lijst verandert zelden binnen een sessie — één fetch, daarna memo.
let _titelsCache: Promise<TitelKeuze[]> | null = null;
export const getTitels = () =>
  (_titelsCache ??= get<{ titels: TitelKeuze[] }>('/titels').then(r => r.titels).catch((e) => {
    _titelsCache = null;   // mislukte fetch niet cachen
    throw e;
  }));

// Dispositie zetten: dispositie '' | 'verdeeld' | 'genegeerd'. onthoud = geldt
// voor de hele relatie (ook bij volgende imports).
export const setDispositie = (
  args: { exact_ref?: string; relatie?: string; dispositie: string; onthoud?: boolean }
) => post<{ ok: boolean; geraakt: number }>('/dispositie', args);

// Regel aan een titel toewijzen (herkoppel zet de ISBN).
export const wijsToe = (exact_ref: string, recept_id: string) =>
  post('/herkoppel', { exact_ref, recept_id });

// Regel van een titel afhalen → terug naar 'te beoordelen'.
export const ontkoppel = (exact_ref: string) =>
  post('/ontkoppel', { exact_ref });

export const getKosten = (isbn: string, periode: string) =>
  get<{ isbn: string; regels: GeboekteRegel[] }>(`/kosten/${isbn}?periode=${encodeURIComponent(periode)}`).then(r => r.regels);

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Resultaten API ${res.status}`);
  return res.json();
}

export const setVerklaring = (recept_id: string, periode: string, stroom: string, status: string, notitie: string) =>
  post('/verklaring', { recept_id, periode, stroom, status, notitie });

export const afsluiten = (periode: string, afgesloten: boolean) =>
  post('/afsluiten', { periode, afgesloten });

export interface OverheadKandidaat {
  exact_ref: string;
  relatie: string;
  grootboek: string;
  omschrijving: string;
  bedrag: number;
  confidence: number;
  reden: string;
}

export const zoekKosten = (recept_id: string) =>
  post<{ dry_run: boolean; pool: number; kandidaten?: OverheadKandidaat[] }>('/zoek-kosten', { recept_id });

export const herkoppel = (exact_ref: string, recept_id: string) =>
  post('/herkoppel', { exact_ref, recept_id });

// Status van een stroom (calculatie-check) → label + chip-kleur + uitleg
// (tooltip/hulptekst zodat direct duidelijk is wat er speelt en wat je kunt doen).
export const STROOM_STATUS: Record<string, { label: string; cls: string; uitleg: string }> = {
  berekend: {
    label: 'berekend', cls: 'bg-[var(--bg-hover)] text-[var(--text-secondary)] ring-[var(--border)]',
    uitleg: 'Deze kosten boekt Exact niet per titel — de app berekent ze uit de calculatie × verkochte exemplaren.',
  },
  geboekt: {
    label: 'volledig geboekt', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    uitleg: 'De facturen in Exact dekken de begroting — deze post is compleet.',
  },
  overschrijding: {
    label: 'boven begroting', cls: 'bg-red-50 text-red-700 ring-red-600/20',
    uitleg: 'Er is méér geboekt dan begroot — de calculatie was hier te optimistisch.',
  },
  verwacht_nog: {
    label: 'nog te boeken', cls: 'bg-sky-50 text-sky-700 ring-sky-600/20',
    uitleg: 'Begroot maar (deels) nog niet in Exact geboekt — er staan waarschijnlijk nog boekingen open. Bij kwartaal-afsluiting bevestig je dit.',
  },
  niet_gemaakt: {
    label: 'niet gemaakt', cls: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    uitleg: 'Door jou bevestigd: deze begrote kosten zijn (nog) niet gemaakt.',
  },
  verkeerd_geboekt: {
    label: 'stond elders', cls: 'bg-sky-50 text-sky-700 ring-sky-600/20',
    uitleg: 'Door jou bevestigd: deze kosten stonden elders geboekt en zijn herkoppeld.',
  },
  onverklaard: {
    label: 'actie nodig', cls: 'bg-amber-100 text-amber-800 ring-amber-600/30',
    uitleg: 'Kwartaal is afgesloten maar dit gat is nog niet verklaard — geef aan wat er speelt.',
  },
  leeg: { label: '', cls: '', uitleg: '' },
};

export const getPeriodes = () => get<{ periodes: string[]; default: string }>('/periodes');
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

// '2026-Q1' → 'Q1 2026'; '2026' → 'Jaar 2026'.
export const periodeLabel = (p: string) => {
  if (!p) return '';
  const [jaar, q] = p.split('-');
  return q ? `${q} ${jaar}` : `Jaar ${jaar}`;
};
