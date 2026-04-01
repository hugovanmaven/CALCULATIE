import { useState } from 'react';
import type { CalculateResponse, TitelInput, SensitivityResponse, OplageSimResponse } from '../../api/types';
import { ChevronDown, ChevronRight } from 'lucide-react';

const STREEFMARGE = 0.35;

interface Props {
  results: CalculateResponse;
  titelInput: TitelInput;
  verdeling: { webshop: number; retail: number; b2b: number };
  cacSens: SensitivityResponse[] | null;
  priceSens: SensitivityResponse[] | null;
  oplageSim: OplageSimResponse | null;
}

function margeBadge(pct: number): string {
  if (pct >= STREEFMARGE) return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20';
  if (pct >= 0.20) return 'bg-amber-50 text-amber-700 ring-amber-600/20';
  return 'bg-red-50 text-red-700 ring-red-600/20';
}

function margeColor(pct: number): string {
  if (pct >= STREEFMARGE) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
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

export function UnifiedDashboard({ results, titelInput, verdeling, cacSens, priceSens, oplageSim }: Props) {
  const druk = results.drukken[0];
  if (!druk) return null;

  return (
    <div className="space-y-4">
      <HeadlineMarge marge={druk.gewogen_marge_pct} />
      <KanaalCards druk={druk} verdeling={verdeling} />

      {/* Oplage simulatie */}
      {oplageSim && oplageSim.rows.length > 0 && (
        <OplageSimulatie sim={oplageSim} />
      )}

      {cacSens && cacSens.length > 0 && verdeling.webshop > 0 && (
        <CacBandbreedte cacSens={cacSens} currentCac={titelInput.cac_per_ex} />
      )}
      {priceSens && priceSens.length > 0 && (
        <VerkoopprijsAdvies priceSens={priceSens} currentPrice={titelInput.verkoopprijs_incl_btw} />
      )}
      <DetailWaterfall druk={druk} verdeling={verdeling} />
    </div>
  );
}

// ──────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────

function HeadlineMarge({ marge }: { marge: number }) {
  const margeVal = marge * 100;
  const barWidth = Math.min(Math.max(margeVal, 0), 70);
  const targetLeft = (STREEFMARGE * 100 / 70) * 100;

  return (
    <div className={`p-4 rounded-xl border ${margeColor(marge)}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Gewogen marge</span>
        <span className="text-2xl font-bold tabular-nums">{pct(marge)}</span>
      </div>
      <div className="relative h-2.5 bg-black/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${marge >= STREEFMARGE ? 'bg-emerald-500' : marge >= 0.20 ? 'bg-amber-500' : 'bg-red-500'}`}
          style={{ width: `${barWidth / 70 * 100}%` }}
        />
        <div className="absolute top-0 h-full w-0.5 bg-black/30" style={{ left: `${targetLeft}%` }} />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] opacity-50">0%</span>
        <span className="text-[10px] opacity-50" style={{ marginLeft: `${targetLeft - 15}%` }}>streef {pct(STREEFMARGE)}</span>
        <span className="text-[10px] opacity-50">70%</span>
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
      {kanalen.map(k => (
        <div key={k.key} className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">{k.label}</span>
            <span className="text-[10px] text-[var(--text-tertiary)]">{(k.pct * 100).toFixed(0)}%</span>
          </div>
          <div className="text-2xl font-bold text-[var(--text-primary)] mb-1.5 tabular-nums">&euro; {fmt(k.data.netto_winst_maven)}</div>
          <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md ring-1 ring-inset ${margeBadge(k.data.marge_pct)}`}>
            {pct(k.data.marge_pct)} marge
          </span>
          <div className="mt-3 text-[11px] text-[var(--text-tertiary)] space-y-0.5">
            <div className="flex justify-between"><span>Netto omzet</span><span className="tabular-nums">&euro; {fmt(k.data.netto_omzet)}</span></div>
            <div className="flex justify-between"><span>Brutowinst</span><span className="tabular-nums">&euro; {fmt(k.data.brutowinst)}</span></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function OplageSimulatie({ sim }: { sim: OplageSimResponse }) {
  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
        Oplage simulatie
      </h3>
      <p className="text-xs text-[var(--text-tertiary)] mb-3">
        Netto resultaat bij verschillende verkoopaantallen (incl. eenmalige kosten &amp; voorschotten)
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {sim.rows.map((row, i) => {
          const isBreakEven = row.is_break_even;
          const isPositive = row.netto_resultaat >= 0;
          return (
            <div
              key={i}
              className={`text-center p-3 rounded-lg transition-colors ${
                isBreakEven
                  ? 'bg-[var(--accent)]/10 ring-1 ring-[var(--accent)]/30'
                  : 'bg-[var(--bg-primary)]'
              }`}
            >
              <div className={`text-lg font-bold tabular-nums mb-0.5 ${
                isBreakEven ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'
              }`}>
                {row.oplage.toLocaleString('nl-NL')}
              </div>
              <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1.5">
                {isBreakEven ? 'break-even' : 'exemplaren'}
              </div>
              <div className={`text-sm font-semibold tabular-nums ${
                isPositive ? 'text-emerald-600' : 'text-red-600'
              }`}>
                &euro; {fmtK(row.netto_resultaat)}
              </div>
              <div className={`text-xs font-medium tabular-nums ${
                row.marge_pct >= STREEFMARGE ? 'text-emerald-600'
                : row.marge_pct >= 0 ? 'text-amber-600'
                : 'text-red-600'
              }`}>
                {row.marge_pct > -9 ? pct(row.marge_pct) : 'n.v.t.'}
              </div>
            </div>
          );
        })}
      </div>
      {sim.break_even_oplage != null && (
        <p className="text-xs text-[var(--text-tertiary)] mt-2 text-center">
          Break-even bij <strong className="text-[var(--text-primary)]">{sim.break_even_oplage.toLocaleString('nl-NL')} exemplaren</strong>
        </p>
      )}
    </div>
  );
}

function CacBandbreedte({ cacSens, currentCac }: { cacSens: SensitivityResponse[]; currentCac: number }) {
  const sens = cacSens[0];
  if (!sens || !sens.rows.length) return null;

  const cacLevels = [0, 1, 2, 3, 5, 8];
  const keyRows = cacLevels
    .map(v => sens.rows.find(r => Math.abs(r.variable_value - v) < 0.01))
    .filter((r): r is NonNullable<typeof r> => r != null);

  if (keyRows.length === 0) return null;

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
        CAC bandbreedte <span className="font-normal text-[var(--text-tertiary)]">(webshop)</span>
      </h3>
      <p className="text-xs text-[var(--text-tertiary)] mb-3">Kosten om 1 klant te werven via online ads</p>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {keyRows.map((row, i) => {
          const isCurrent = Math.abs(row.variable_value - currentCac) < 0.01;
          return (
            <div key={i} className={`text-center p-2.5 rounded-lg ${
              isCurrent ? 'bg-[var(--accent)]/10 ring-1 ring-[var(--accent)]/30' : 'bg-[var(--bg-primary)]'
            }`}>
              <div className={`text-lg font-bold tabular-nums mb-0.5 ${isCurrent ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                &euro; {fmt(row.variable_value, 0)}
              </div>
              <div className="text-[10px] text-[var(--text-tertiary)] mb-1 uppercase tracking-wide">CAC</div>
              <div className={`text-sm font-semibold tabular-nums ${
                row.webshop_marge_pct >= STREEFMARGE ? 'text-emerald-600' : row.webshop_marge_pct >= 0.20 ? 'text-amber-600' : 'text-red-600'
              }`}>{pct(row.webshop_marge_pct)}</div>
              <div className="text-[10px] text-[var(--text-tertiary)] tabular-nums">&euro; {fmt(row.webshop_winst)} /ex</div>
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
  const needsHigher = currentMarge < STREEFMARGE;
  const targetRow = rows.find(r => r.gewogen_marge_pct >= STREEFMARGE);

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
          Voor {pct(STREEFMARGE)} marge: minimaal <strong className="text-[var(--text-primary)]">&euro; {fmt(targetRow.variable_value)}</strong>
        </p>
      )}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {filteredRows.map((row, i) => {
          const isCurrent = Math.abs(row.variable_value - currentPrice) < 0.01;
          return (
            <div key={i} className={`text-center p-2.5 rounded-lg ${
              isCurrent ? 'bg-[var(--accent)]/10 ring-1 ring-[var(--accent)]/30' : 'bg-[var(--bg-primary)]'
            }`}>
              <div className={`text-base font-bold tabular-nums mb-0.5 ${isCurrent ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                &euro; {fmt(row.variable_value)}
              </div>
              {isCurrent && <div className="text-[9px] text-[var(--accent)] uppercase tracking-wide mb-0.5">huidig</div>}
              <div className={`text-sm font-semibold tabular-nums ${
                row.gewogen_marge_pct >= STREEFMARGE ? 'text-emerald-600' : row.gewogen_marge_pct >= 0.20 ? 'text-amber-600' : 'text-red-600'
              }`}>{pct(row.gewogen_marge_pct)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DetailWaterfall({ druk, verdeling }: { druk: any; verdeling: { webshop: number; retail: number; b2b: number } }) {
  const [open, setOpen] = useState(false);

  const w = (field: string) => {
    return druk.webshop[field] * verdeling.webshop
      + druk.retail[field] * verdeling.retail
      + druk.b2b[field] * verdeling.b2b;
  };

  const lines: { label: string; value: number; type?: 'subtotal' }[] = [
    { label: 'Verkoopprijs ex BTW', value: w('verkoopprijs_ex_btw') },
    { label: 'Boekhandelskorting', value: -w('korting_bedrag') },
    { label: 'Netto omzet', value: w('netto_omzet'), type: 'subtotal' },
    { label: 'Drukkosten', value: -w('drukkosten') },
    { label: 'Productie /ex', value: -w('productie_per_ex') },
    { label: 'Offline marketing /ex', value: -w('offline_marketing_per_ex') },
    { label: 'Online marketing /ex', value: -w('online_marketing_per_ex') },
    { label: 'Fulfillment', value: -w('fulfillment') },
    { label: 'Distributie CB', value: -w('distributie_cb') },
    { label: 'B2B porto', value: -w('b2b_porto') },
    { label: 'Transactiekosten', value: -w('transactiekosten') },
    { label: 'CAC', value: -w('cac') },
    { label: 'Vertaler', value: -w('vertaler') },
    { label: 'Illustrator', value: -w('illustrator') },
    { label: 'Agent', value: -w('agent') },
    { label: 'Overige kosten', value: -w('overige_kosten') },
    { label: 'Brutowinst', value: w('brutowinst'), type: 'subtotal' },
    { label: 'Auteur royalty', value: -w('auteur_royalty') },
    { label: 'Auteur winstdeling', value: -w('auteur_winstdeling') },
    { label: 'Partner winstdeling', value: -w('partner_winstdeling') },
    { label: 'Netto winst Maven', value: w('netto_winst_maven'), type: 'subtotal' },
  ].filter((l): l is { label: string; value: number; type?: 'subtotal' } => Math.abs(l.value) > 0.001 || l.type === 'subtotal');

  const nettoOmzet = w('netto_omzet');

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
      >
        <span>Kostenopbouw (gewogen gemiddelde)</span>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-0.5">
          {lines.map((line, i) => (
            <div key={i} className={`flex items-center justify-between text-sm py-1.5 px-3 rounded-lg ${
              line.type === 'subtotal' ? 'bg-[var(--bg-primary)] font-semibold mt-1' : ''
            }`}>
              <span className="text-[var(--text-secondary)]">{line.label}</span>
              <div className="flex items-center gap-3 tabular-nums">
                <span className={line.value < 0 ? 'text-red-600' : 'text-[var(--text-primary)]'}>&euro; {fmt(line.value)}</span>
                {nettoOmzet > 0 && (
                  <span className="text-[10px] text-[var(--text-tertiary)] w-12 text-right">
                    {((line.value / nettoOmzet) * 100).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
