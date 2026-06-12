import { useState } from 'react';
import type { CalculateResponse, TitelInput, SensitivityResponse, OplageSimResponse } from '../../api/types';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';

// Streefmarge: 35% van wat er na kortingen + BTW binnenkomt (netto-omzet),
// per kanaal toegepast op de eigen netto-omzet. Het euro-doel is daardoor
// hoger bij webshop en lager (min de boekhandelskorting) bij CB.
// De kleurcode hangt alleen aan de gewogen marge bovenin; in de kanaal-tiles
// wordt de marge neutraal getoond (alleen de verhouding t.o.v. 35% telt).
const STREEFMARGE = {
  retail: 0.35,
  webshop: 0.35,
  b2b: 0.35,
  gewogen: 0.35,
} as const;
type KanaalSleutel = keyof typeof STREEFMARGE;

interface Props {
  results: CalculateResponse;
  titelInput: TitelInput;
  verdeling: { webshop: number; retail: number; b2b: number };
  cacSens: SensitivityResponse[] | null;
  priceSens: SensitivityResponse[] | null;
  oplageSim: OplageSimResponse | null;
}

function margeColor(pct: number, kanaal: KanaalSleutel = 'gewogen'): string {
  const target = STREEFMARGE[kanaal];
  if (pct >= target) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (pct >= 0.20) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

function fmt(v: number, decimals = 2): string {
  return v.toFixed(decimals);
}

function fmtK(v: number): string {
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1).replace('.0', '') + 'k';
  return v.toFixed(0);
}

function pct(v: number): string {
  return (v * 100).toFixed(1) + '%';
}

async function downloadFile(endpoint: string, body: unknown, titel: string, ext: string) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `calculatie_${(titel || 'export').replace(/\s+/g, '_').slice(0, 30)}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

export function UnifiedDashboard({ results, titelInput, verdeling, cacSens, priceSens, oplageSim }: Props) {
  const druk = results.drukken[0];
  if (!druk) return null;

  const totaalExemplaren = results.totaal_oplage ?? results.drukken.reduce((sum, d) => sum + d.oplage, 0);
  const margeTotaal = results.gewogen_marge_pct_totaal ?? druk.gewogen_marge_pct;

  const exportBody = { titel_input: titelInput, verdeling_webshop: verdeling.webshop, verdeling_retail: verdeling.retail, verdeling_b2b: verdeling.b2b };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <button
          onClick={() => downloadFile('/calculatie/api/export/excel', exportBody, titelInput.titel, 'xlsx')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-secondary)] text-xs hover:bg-[var(--bg-secondary)] transition-colors"
        >
          <Download size={13} />
          Excel
        </button>
        <button
          onClick={() => downloadFile('/calculatie/api/export/pdf', exportBody, titelInput.titel, 'pdf')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-secondary)] text-xs hover:bg-[var(--bg-secondary)] transition-colors"
        >
          <Download size={13} />
          PDF
        </button>
      </div>
      <HeadlineStats marge={margeTotaal} totaalExemplaren={totaalExemplaren} />
      <KanaalCards druk={druk} verdeling={verdeling} />

      {/* Oplage simulatie */}
      {oplageSim && oplageSim.rows.length > 0 && (
        <OplageSimulatie sim={oplageSim} />
      )}

      {cacSens && cacSens.length > 0 && verdeling.webshop > 0 && (
        <CacBandbreedte cacSens={cacSens} currentCac={
          (() => {
            // CAC zit per druk; toon de bandbreedte voor de laatste druk
            // (uitgaande dat eerdere drukken zijn uitverkocht).
            const dr = titelInput.drukken ?? [];
            const last = dr.length > 0 ? dr[dr.length - 1] : null;
            return last?.cac_per_ex ?? titelInput.cac_per_ex ?? 0;
          })()
        } />
      )}
      {priceSens && priceSens.length > 0 && (
        <VerkoopprijsAdvies priceSens={priceSens} currentPrice={titelInput.verkoopprijs_incl_btw} />
      )}
      <DetailWaterfall druk={druk} verdeling={verdeling} titelInput={titelInput} />
    </div>
  );
}

// ──────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────

function HeadlineStats({ marge, totaalExemplaren }: { marge: number; totaalExemplaren: number }) {
  const margeVal = marge * 100;
  const barWidth = Math.min(Math.max(margeVal, 0), 70);
  const targetLeft = (STREEFMARGE.gewogen * 100 / 70) * 100;

  return (
    <div className="grid grid-cols-3 gap-3">
      {/* Gewogen marge — 2/3 width */}
      <div className={`col-span-2 p-4 rounded-xl border ${margeColor(marge)}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Gewogen marge</span>
          <span className="text-2xl font-bold tabular-nums">{pct(marge)}</span>
        </div>
        <div className="relative h-2.5 bg-black/5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${marge >= STREEFMARGE.gewogen ? 'bg-emerald-500' : marge >= 0.20 ? 'bg-amber-500' : 'bg-red-500'}`}
            style={{ width: `${barWidth / 70 * 100}%` }}
          />
          <div className="absolute top-0 h-full w-0.5 bg-black/30" style={{ left: `${targetLeft}%` }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] opacity-50">0%</span>
          <span className="text-[10px] opacity-50" style={{ marginLeft: `${targetLeft - 15}%` }}>streef {pct(STREEFMARGE.gewogen)}</span>
          <span className="text-[10px] opacity-50">70%</span>
        </div>
      </div>

      {/* Totaal exemplaren — 1/3 width */}
      <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">
          {totaalExemplaren.toLocaleString('nl-NL')}
        </span>
        <span className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide mt-1">Exemplaren</span>
      </div>
    </div>
  );
}

function KanaalCards({ druk, verdeling }: { druk: any; verdeling: { webshop: number; retail: number; b2b: number } }) {
  const kanalen = [
    { label: 'Webshop', key: 'webshop', data: druk.webshop, pct: verdeling.webshop },
    { label: 'Retail / CB', key: 'retail', data: druk.retail, pct: verdeling.retail },
    { label: 'B2B', key: 'b2b', data: druk.b2b, pct: verdeling.b2b },
  ].filter(k => k.pct > 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {kanalen.map(k => {
        // Marge per kanaal t.o.v. de eigen netto-omzet van dat kanaal.
        // Streefmarge = 35% van die netto-omzet (plat percentage voor elk kanaal);
        // het euro-doel is daardoor vanzelf hoger bij webshop en lager bij CB.
        const marge = k.data.netto_omzet > 0 ? k.data.netto_winst_maven / k.data.netto_omzet : 0;
        const streef = STREEFMARGE[k.key as KanaalSleutel];
        return (
        <div key={k.key} className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">{k.label}</span>
            <span className="text-[10px] text-[var(--text-tertiary)]">{(k.pct * 100).toFixed(0)}%</span>
          </div>
          <div className="text-2xl font-bold text-[var(--text-primary)] mb-1.5 tabular-nums">&euro; {fmt(k.data.netto_winst_maven)}</div>
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md ring-1 ring-inset bg-[var(--bg-primary)] text-[var(--text-secondary)] ring-[var(--border)]">
            {pct(marge)} marge <span className="opacity-60 ml-1">/ streef {pct(streef)}</span>
          </span>
          <div className="mt-3 text-[11px] text-[var(--text-tertiary)] space-y-0.5">
            <div className="flex justify-between"><span>Netto omzet</span><span className="tabular-nums">&euro; {fmt(k.data.netto_omzet)}</span></div>
            <div className="flex justify-between"><span>Brutowinst</span><span className="tabular-nums">&euro; {fmt(k.data.brutowinst)}</span></div>
          </div>
        </div>
        );
      })}
    </div>
  );
}

function OplageSimulatie({ sim }: { sim: OplageSimResponse }) {
  // Break-even eerst, dan voorschot-terugverdiend, dan oplopend op volume
  const sortedRows = [...sim.rows].sort((a, b) => {
    const aKey = a.is_break_even ? 0 : a.is_voorschot_earn_out ? 1 : 2;
    const bKey = b.is_break_even ? 0 : b.is_voorschot_earn_out ? 1 : 2;
    if (aKey !== bKey) return aKey - bKey;
    return a.oplage - b.oplage;
  });

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
        Oplage simulatie
      </h3>
      <p className="text-xs text-[var(--text-tertiary)] mb-3">
        Netto resultaat bij verschillende verkoopaantallen (incl. eenmalige kosten &amp; voorschotten)
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {sortedRows.map((row, i) => {
          const isBreakEven = row.is_break_even;
          const isEarnOut = row.is_voorschot_earn_out;
          const isHighlight = isBreakEven || isEarnOut;
          const isPositive = row.netto_resultaat >= 0;
          const stripeColor = isBreakEven ? 'bg-[var(--accent)]'
            : isEarnOut ? 'bg-violet-500'
            : row.marge_pct >= STREEFMARGE.gewogen ? 'bg-emerald-500'
            : row.marge_pct >= 0 ? 'bg-amber-500'
            : 'bg-red-400';
          return (
            <div
              key={i}
              className={`rounded-lg overflow-hidden transition-colors ${
                isHighlight
                  ? (isBreakEven ? 'ring-1 ring-[var(--accent)]/30' : 'ring-1 ring-violet-400/40')
                  : ''
              }`}
            >
              <div className={`h-1 w-full ${stripeColor}`} />
              <div className={`text-center p-3 ${
                isBreakEven ? 'bg-[var(--accent)]/10'
                : isEarnOut ? 'bg-violet-50'
                : 'bg-[var(--bg-primary)]'
              }`}>
                {/* Label / kopje */}
                <div className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${
                  isBreakEven ? 'text-[var(--accent)]'
                  : isEarnOut ? 'text-violet-700'
                  : 'text-[var(--text-tertiary)]'
                }`}>
                  {isBreakEven ? 'Break-even'
                   : isEarnOut ? 'Voorschot terugverdiend'
                   : 'Exemplaren'}
                </div>
                {/* Volume number */}
                <div className={`text-xl font-bold tabular-nums mb-1.5 ${
                  isBreakEven ? 'text-[var(--accent)]'
                  : isEarnOut ? 'text-violet-700'
                  : 'text-[var(--text-primary)]'
                }`}>
                  {row.oplage.toLocaleString('nl-NL')}
                </div>
                {/* Net result */}
                <div className={`text-sm font-semibold tabular-nums ${
                  isPositive ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  &euro; {fmtK(row.netto_resultaat)}
                </div>
                {/* Margin */}
                <div className={`text-xs font-medium tabular-nums ${
                  row.marge_pct >= STREEFMARGE.gewogen ? 'text-emerald-600'
                  : row.marge_pct >= 0 ? 'text-amber-600'
                  : 'text-red-600'
                }`}>
                  {row.marge_pct > -9 ? pct(row.marge_pct) : 'n.v.t.'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CacBandbreedte({ cacSens, currentCac }: { cacSens: SensitivityResponse[]; currentCac: number }) {
  // Toon de bandbreedte voor de LAATSTE druk — uitgangspunt is dat
  // eerdere drukken zijn uitverkocht en de campagne nu de huidige
  // druk pusht.
  const sens = cacSens[cacSens.length - 1];
  if (!sens || !sens.rows.length) return null;

  // Dynamic range centered on currentCac, step size depends on magnitude
  const step = currentCac <= 4 ? 1 : currentCac <= 10 ? 2 : 3;
  const numTiles = 6;
  const halfRange = Math.floor(numTiles / 2) * step;
  const startCac = Math.max(0, Math.round((currentCac - halfRange) / step) * step);
  const cacLevels = Array.from({ length: numTiles }, (_, i) => startCac + i * step);

  const keyRows = cacLevels
    .map(v => sens.rows.find(r => Math.abs(r.variable_value - v) < 0.01))
    .filter((r): r is NonNullable<typeof r> => r != null);

  if (keyRows.length === 0) return null;

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
        CAC bandbreedte <span className="font-normal text-[var(--text-tertiary)]">({sens.druk_type ?? 'webshop'})</span>
      </h3>
      <p className="text-xs text-[var(--text-tertiary)] mb-3">Kosten om 1 klant te werven via online ads</p>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {keyRows.map((row, i) => {
          const isCurrent = Math.abs(row.variable_value - currentCac) < 0.01;
          const marge = row.webshop_marge_pct;
          const stripeColor = marge >= STREEFMARGE.webshop ? 'bg-emerald-500'
            : marge >= 0.20 ? 'bg-amber-500'
            : 'bg-red-400';
          return (
            <div key={i} className={`rounded-lg overflow-hidden ${
              isCurrent ? 'ring-1 ring-[var(--accent)]/40' : ''
            }`}>
              {/* Colored top stripe — scannable at a glance */}
              <div className={`h-1 w-full ${isCurrent ? 'bg-[var(--accent)]' : stripeColor}`} />
              <div className={`text-center p-2.5 ${
                isCurrent ? 'bg-[var(--accent)]/10' : 'bg-[var(--bg-primary)]'
              }`}>
                {/* Kopje: CAC value as label */}
                <div className={`text-xs font-semibold tabular-nums mb-0.5 ${
                  isCurrent ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'
                }`}>
                  &euro; {fmt(row.variable_value, 0)} CAC
                </div>
                {/* Margin — primary metric */}
                <div className={`text-lg font-bold tabular-nums ${
                  marge >= STREEFMARGE.webshop ? 'text-emerald-600'
                  : marge >= 0.20 ? 'text-amber-600'
                  : 'text-red-600'
                }`}>{pct(marge)}</div>
                {/* Secondary: winst per ex */}
                <div className="text-[10px] text-[var(--text-tertiary)] tabular-nums mt-0.5">
                  &euro; {fmt(row.webshop_winst)} /ex
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VerkoopprijsAdvies({ priceSens, currentPrice }: { priceSens: SensitivityResponse[]; currentPrice: number }) {
  const sens = priceSens[0];
  if (!sens || !sens.rows.length) return null;

  const rows = sens.rows;
  const minPrice = currentPrice - 3;
  const maxPrice = currentPrice + 3;
  const filteredRows = rows.filter(r => r.variable_value >= minPrice - 0.01 && r.variable_value <= maxPrice + 0.01);
  if (filteredRows.length === 0) return null;

  const currentRow = filteredRows.find(r => Math.abs(r.variable_value - currentPrice) < 0.01);
  const currentMarge = currentRow?.gewogen_marge_pct ?? 0;
  const needsHigher = currentMarge < STREEFMARGE.gewogen;
  const targetRow = rows.find(r => r.gewogen_marge_pct >= STREEFMARGE.gewogen);

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Verkoopprijs advies</h3>
        {currentRow && (
          <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md ring-1 ring-inset ${
            needsHigher ? 'bg-amber-50 text-amber-700 ring-amber-600/20' : 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
          }`}>
            {needsHigher ? '\u2191 Duurder overwegen' : '\u2713 Prijs is goed'}
          </span>
        )}
      </div>
      {targetRow && needsHigher && (
        <p className="text-xs text-[var(--text-tertiary)] mb-3">
          Voor {pct(STREEFMARGE.gewogen)} marge: minimaal <strong className="text-[var(--text-primary)]">&euro; {fmt(targetRow.variable_value)}</strong>
        </p>
      )}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {filteredRows.map((row, i) => {
          const isCurrent = Math.abs(row.variable_value - currentPrice) < 0.01;
          const marge = row.gewogen_marge_pct;
          const stripeColor = marge >= STREEFMARGE.gewogen ? 'bg-emerald-500'
            : marge >= 0.20 ? 'bg-amber-500'
            : 'bg-red-400';
          return (
            <div key={i} className={`rounded-lg overflow-hidden ${isCurrent ? 'ring-1 ring-[var(--accent)]/40' : ''}`}>
              <div className={`h-1 w-full ${isCurrent ? 'bg-[var(--accent)]' : stripeColor}`} />
              <div className={`text-center p-2.5 ${isCurrent ? 'bg-[var(--accent)]/10' : 'bg-[var(--bg-primary)]'}`}>
                <div className={`text-xs font-semibold tabular-nums mb-0.5 ${isCurrent ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>
                  &euro; {fmt(row.variable_value)}
                  {isCurrent && <span className="ml-1 font-normal opacity-70">huidig</span>}
                </div>
                <div className={`text-lg font-bold tabular-nums ${
                  marge >= STREEFMARGE.gewogen ? 'text-emerald-600' : marge >= 0.20 ? 'text-amber-600' : 'text-red-600'
                }`}>{pct(marge)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type KostenTab = 'gemiddelde' | 'retail' | 'webshop' | 'b2b';
const KOSTEN_TABS: { key: KostenTab; label: string }[] = [
  { key: 'gemiddelde', label: 'Gemiddelde' },
  { key: 'retail', label: 'Retail / CB' },
  { key: 'webshop', label: 'Webshop' },
  { key: 'b2b', label: 'B2B' },
];

function DetailWaterfall({ druk, verdeling, titelInput }: { druk: any; verdeling: { webshop: number; retail: number; b2b: number }; titelInput: TitelInput }) {
  // Bepaal per derde-partij de mode. Royalty-mode hoort BOVEN de brutowinst
  // (% van VKP ex BTW), winstdeling-mode hoort ERONDER (% van brutowinst).
  const agentMode: 'royalty' | 'winstdeling' = (titelInput.agent_winstdeling_pct ?? 0) > 0 ? 'winstdeling' : 'royalty';
  const vertalerMode: 'royalty' | 'winstdeling' = (titelInput.vertaler_winstdeling_pct ?? 0) > 0 ? 'winstdeling' : 'royalty';
  const illustratorMode: 'royalty' | 'winstdeling' = (titelInput.illustrator_winstdeling_pct ?? 0) > 0 ? 'winstdeling' : 'royalty';
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<KostenTab>('gemiddelde');

  const v = (field: string): number => {
    if (activeTab === 'gemiddelde') {
      return druk.webshop[field] * verdeling.webshop
        + druk.retail[field] * verdeling.retail
        + druk.b2b[field] * verdeling.b2b;
    }
    return druk[activeTab]?.[field] ?? 0;
  };

  // Extra derden — bouw per-naam regels op. Royalty-derden komen vóór
  // 'Brutowinst' (zoals illustrator/vertaler/agent); winstdeling-derden
  // ná 'Brutowinst' (zoals auteur winstdeling).
  type DerdeRegel = { naam: string; bedrag: number };
  const extraDerdenRegels: { royalty: DerdeRegel[]; winstdeling: DerdeRegel[] } = (() => {
    const naamMap = new Map<string, { naam: string; type: 'royalty' | 'winstdeling'; bedrag: number }>();
    const accumuleer = (kanaalData: any, weight: number) => {
      const lijst = kanaalData?.extra_derden_per_naam ?? [];
      for (const ed of lijst) {
        const key = `${ed.naam}|${ed.type}`;
        const existing = naamMap.get(key);
        const bedrag = (ed.bedrag ?? 0) * weight;
        if (existing) existing.bedrag += bedrag;
        else naamMap.set(key, { naam: ed.naam, type: ed.type, bedrag });
      }
    };
    if (activeTab === 'gemiddelde') {
      accumuleer(druk.webshop, verdeling.webshop);
      accumuleer(druk.retail, verdeling.retail);
      accumuleer(druk.b2b, verdeling.b2b);
    } else {
      accumuleer(druk[activeTab], 1);
    }
    const royalty: DerdeRegel[] = [];
    const winstdeling: DerdeRegel[] = [];
    for (const v of naamMap.values()) {
      (v.type === 'royalty' ? royalty : winstdeling).push({ naam: v.naam, bedrag: v.bedrag });
    }
    return { royalty, winstdeling };
  })();

  // Helper: regel voor één van de drie vaste derden, alleen tonen als
  // bedrag > 0, gelabeld met de mode tussen haakjes als winstdeling.
  const derdeRegel = (label: string, field: string, mode: 'royalty' | 'winstdeling') => ({
    label: mode === 'winstdeling' ? `${label} (winstdeling)` : label,
    value: -v(field),
    mode,
  });

  const agentRegel = derdeRegel('Agent', 'agent', agentMode);
  const vertalerRegel = derdeRegel('Vertaler', 'vertaler', vertalerMode);
  const illustratorRegel = derdeRegel('Illustrator', 'illustrator', illustratorMode);

  const royaltyDerden = [vertalerRegel, illustratorRegel, agentRegel].filter(r => r.mode === 'royalty');
  const winstdelingDerden = [vertalerRegel, illustratorRegel, agentRegel].filter(r => r.mode === 'winstdeling');

  const lines: { label: string; value: number; type?: 'subtotal' | 'info' }[] = [
    { label: 'Verkoopprijs ex BTW', value: v('verkoopprijs_ex_btw') },
    { label: activeTab === 'retail' || activeTab === 'gemiddelde' ? 'Boekhandelskorting' : 'Korting', value: -v('korting_bedrag') },
    { label: 'Netto omzet', value: v('netto_omzet'), type: 'subtotal' },
    { label: 'Drukkosten /ex', value: -v('drukkosten') },
    { label: 'Kostenposten /ex', value: -v('kosten_per_ex') },
    { label: 'Fulfillment', value: -v('fulfillment') },
    { label: 'Distributie CB', value: -v('distributie_cb') },
    { label: 'B2B porto', value: -v('b2b_porto') },
    { label: 'Transactiekosten', value: -v('transactiekosten') },
    { label: 'CAC', value: -v('cac') },
    // Royalty-derden (% van VKP ex BTW) — boven brutowinst
    { label: 'Auteur royalty', value: -v('auteur_royalty') },
    ...royaltyDerden.map(({ label, value }) => ({ label, value })),
    ...extraDerdenRegels.royalty.map(r => ({ label: r.naam, value: -r.bedrag })),
    { label: 'Overige kosten', value: -v('overige_kosten') },
    { label: 'Brutowinst', value: v('brutowinst'), type: 'subtotal' },
    // Winstdeling-derden (% van brutowinst) — onder brutowinst
    { label: 'Auteur winstdeling', value: -v('auteur_winstdeling') },
    ...winstdelingDerden.map(({ label, value }) => ({ label, value })),
    ...extraDerdenRegels.winstdeling.map(r => ({ label: `${r.naam} (winstdeling)`, value: -r.bedrag })),
    { label: 'Netto winst Maven', value: v('netto_winst_maven'), type: 'subtotal' },
    { label: 'Partner winstdeling (informatief, niet in marge)', value: -v('partner_winstdeling'), type: 'info' },
  ].filter((l): l is { label: string; value: number; type?: 'subtotal' | 'info' } => Math.abs(l.value) > 0.001 || l.type === 'subtotal');

  const nettoOmzet = v('netto_omzet');

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
      >
        <span>Kostenopbouw</span>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {open && (
        <div className="px-4 pb-4">
          {/* Tabs */}
          <div className="flex w-fit rounded-lg border border-[var(--border)] overflow-hidden text-xs mb-3">
            {KOSTEN_TABS.map((tab, i) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 font-medium transition-colors ${i > 0 ? 'border-l border-[var(--border)]' : ''} ${
                  activeTab === tab.key
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Waterfall lines */}
          <div className="space-y-0.5">
            {lines.map((line, i) => (
              <div key={i} className={`flex items-center justify-between text-sm py-1.5 px-3 rounded-lg ${
                line.type === 'subtotal' ? 'bg-[var(--bg-primary)] font-semibold mt-1'
                : line.type === 'info' ? 'italic text-[var(--text-tertiary)] mt-1'
                : ''
              }`}>
                <span className={line.type === 'info' ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-secondary)]'}>{line.label}</span>
                <div className="flex items-center gap-3 tabular-nums">
                  <span className={
                    line.type === 'info' ? 'text-[var(--text-tertiary)]'
                    : line.value < 0 ? 'text-red-600' : 'text-[var(--text-primary)]'
                  }>&euro; {fmt(line.value)}</span>
                  {nettoOmzet > 0 && (
                    <span className="text-[10px] text-[var(--text-tertiary)] w-12 text-right">
                      {((line.value / nettoOmzet) * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
