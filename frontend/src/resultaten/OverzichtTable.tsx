// View 1 — kwartaalresultaat als dashboard (zelfde tile-taal als de calculatie-app):
// bovenaan raadplegen (marge-headline + KPI-tiles + titels), daaronder doen (acties).
import { useEffect, useState } from 'react';
import type { Overzicht, TitelResultaat } from './api';
import { euro, pct, getal, periodeLabel, getExactAuditSummary, afsluiten } from './api';
import { MargeBadge } from './MargeBadge';
import { Tile } from './ui';
import { ChevronRight, ChevronDown, ClipboardList, Lock, Unlock } from 'lucide-react';

// Zelfde kleurcombinaties als de calculatie-tiles (UnifiedDashboard.margeColor),
// maar op onze drempels: streef 35% (groen) / ondergrens 30% (amber) / rood.
function margeTileColor(status: string): string {
  if (status === 'groen') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (status === 'oranje') return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

export default function OverzichtTable({
  data,
  onOpen,
  onGaNaarExact,
  onChanged,
}: {
  data: Overzicht;
  onOpen: (id: string) => void;
  onGaNaarExact: () => void;
  onChanged: () => void;
}) {
  const m = data.maven_totaal;
  const heeftPool = m.overige_verkoopkosten > 0.5;
  const isKwartaal = data.periode.includes('-');

  return (
    <div className="space-y-4">
      {/* Headline: marge-tile (calculatie-stijl) + exemplaren */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`col-span-3 sm:col-span-2 p-4 rounded-xl border ${margeTileColor(m.status)}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Marge na winstdeling · {periodeLabel(data.periode)}</span>
            <span className="text-2xl font-bold tabular-nums">{pct(m.resultaat_marge_pct)}</span>
          </div>
          <MargeBalkMini marge={m.resultaat_marge_pct} streef={m.streef_pct} />
          <div className="flex justify-between mt-1 text-[10px] opacity-60">
            <span>0%</span>
            <span>streef {pct(m.streef_pct)} · ondergrens {pct(m.ondergrens_pct)}</span>
            <span>70%</span>
          </div>
        </div>
        <div className="col-span-3 sm:col-span-1 p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{getal(m.stuks)}</span>
          <span className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide mt-1">
            Exemplaren · {m.aantal_titels} titels
          </span>
        </div>
      </div>

      {/* KPI-tiles in kanaaltile-stijl */}
      <div className={`grid grid-cols-2 ${heeftPool ? 'sm:grid-cols-3 lg:grid-cols-6' : 'sm:grid-cols-4'} gap-3`}>
        <Tile label="Netto omzet" value={euro(m.netto_omzet)} />
        <Tile label="Brutowinst" value={euro(m.brutowinst)} sub={`marge ${pct(m.marge_pct)}`} />
        <Tile label="Winstdeling" value={`− ${euro(m.winstdeling)}`} sub="auteurs & derden" />
        <Tile label="Titelresultaat" value={euro(m.resultaat)} sub={`${pct(m.resultaat_marge_pct)} na winstdeling`} />
        {heeftPool && (
          <>
            <Tile label="Overige verkoopkosten" value={`− ${euro(m.overige_verkoopkosten)}`} sub="verdeeld over titels" />
            <Tile label="Na verdeling" value={euro(m.resultaat_na_verdeling)} sub={`${pct(m.resultaat_na_verdeling_marge_pct)} · vóór overhead`} />
          </>
        )}
      </div>

      {/* Titels: top-25 + backlist, uitklapbaar naar de kostenstromen */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--text-tertiary)] text-xs">
              <th className="text-left font-medium px-4 py-2.5">Titel</th>
              <th className="text-right font-medium px-3 py-2.5">Verkocht</th>
              <th className="text-right font-medium px-3 py-2.5">Netto omzet</th>
              <th className="text-right font-medium px-3 py-2.5">Resultaat</th>
              <th className="text-right font-medium px-3 py-2.5">Marge</th>
              <th className="px-2 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {data.titels.map((t) => (
              <TitelRij key={t.recept_id ?? t.titel_naam} t={t} onOpen={onOpen} />
            ))}
            {data.backlist && (
              <tr className="border-b border-[var(--border)] last:border-0 bg-[var(--bg-hover)]/50">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-[var(--text-secondary)]">
                    Backlist — {data.backlist.aantal_titels} overige titels
                  </div>
                  <div className="text-xs text-[var(--text-tertiary)]">
                    {data.backlist.zonder_calculatie > 0
                      ? `waarvan ${data.backlist.zonder_calculatie} zonder calculatie`
                      : 'alles buiten de top 25'}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-[var(--text-secondary)]">{getal(data.backlist.stuks)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-[var(--text-secondary)]">{euro(data.backlist.netto_omzet)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-[var(--text-secondary)]">{euro(data.backlist.resultaat)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-xs text-[var(--text-tertiary)]">
                  {pct(data.backlist.resultaat_marge_pct)}
                </td>
                <td className="px-2 py-2.5"></td>
              </tr>
            )}
            {data.titels.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-tertiary)] text-sm">
                  Geen titels met verkoop in dit kwartaal.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[var(--text-tertiary)] px-1">
        Marge = titelresultaat ná winstdeling / netto-omzet, tegen streef {pct(m.streef_pct)} en ondergrens{' '}
        {pct(m.ondergrens_pct)}. Dit is het resultaat vóór algemene overhead (huur, personeel) — dus geen netto bedrijfswinst.
      </p>

      {/* ── Doen: openstaande acties voor deze periode ── */}
      <ActiesBlok
        periode={data.periode}
        isKwartaal={isKwartaal}
        afgesloten={m.afgesloten}
        teVerklaren={m.te_verklaren}
        onGaNaarExact={onGaNaarExact}
        onChanged={onChanged}
      />
    </div>
  );
}

function ActiesBlok({
  periode,
  isKwartaal,
  afgesloten,
  teVerklaren,
  onGaNaarExact,
  onChanged,
}: {
  periode: string;
  isKwartaal: boolean;
  afgesloten: boolean;
  teVerklaren: number;
  onGaNaarExact: () => void;
  onChanged: () => void;
}) {
  const [teBeoordelen, setTeBeoordelen] = useState<{ regels: number; bedrag: number } | null>(null);

  useEffect(() => {
    getExactAuditSummary(periode)
      .then((a) => setTeBeoordelen({ regels: a.totaal.tebeoordelen_regels, bedrag: a.totaal.tebeoordelen_bedrag }))
      .catch(() => setTeBeoordelen(null));
  }, [periode]);

  const klaar = (!teBeoordelen || teBeoordelen.regels === 0) && teVerklaren === 0;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <ClipboardList className="w-4 h-4 text-[var(--text-tertiary)]" />
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Acties voor {periodeLabel(periode)}</h3>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {teBeoordelen && teBeoordelen.regels > 0 && (
          <button
            onClick={onGaNaarExact}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors"
          >
            {teBeoordelen.regels} Exact-regel{teBeoordelen.regels === 1 ? '' : 's'} te beoordelen · {euro(teBeoordelen.bedrag)}
          </button>
        )}
        {teVerklaren > 0 && (
          <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800">
            {teVerklaren} kostenpost{teVerklaren === 1 ? '' : 'en'} toe te lichten (open de titel)
          </span>
        )}
        {isKwartaal && (
          <button
            onClick={async () => { await afsluiten(periode, !afgesloten); onChanged(); }}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            {afgesloten ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            {afgesloten ? 'Kwartaal heropenen' : 'Kwartaal afsluiten'}
          </button>
        )}
        {klaar && (
          <span className="text-sm text-emerald-700">
            {afgesloten || !isKwartaal ? 'Alles verwerkt ✓' : 'Alles verwerkt — klaar om af te sluiten ✓'}
          </span>
        )}
      </div>
    </div>
  );
}

function MargeBalkMini({ marge, streef }: { marge: number; streef: number }) {
  // Zelfde 0–70%-schaal als de calculatie-headline.
  const barWidth = Math.min(Math.max(marge * 100, 0), 70);
  const targetLeft = (streef * 100 / 70) * 100;
  return (
    <div className="relative h-2.5 bg-black/5 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500 bg-current opacity-70"
        style={{ width: `${(barWidth / 70) * 100}%` }}
      />
      <div className="absolute top-0 h-full w-0.5 bg-black/30" style={{ left: `${targetLeft}%` }} />
    </div>
  );
}

function TitelRij({ t, onOpen }: { t: TitelResultaat; onOpen: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const heeftStromen = !!t.stromen?.length;

  return (
    <>
      <tr
        onClick={() => t.recept_id && onOpen(t.recept_id)}
        className={`border-b border-[var(--border)] last:border-0 transition-colors ${
          t.recept_id ? 'cursor-pointer hover:bg-[var(--bg-hover)]' : ''
        }`}
      >
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2">
            {heeftStromen && (
              <button
                onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                title="Kostenstromen tonen"
              >
                {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            )}
            <div>
              <div className="font-medium text-[var(--text-primary)]">{t.titel}</div>
              <div className="text-xs text-[var(--text-tertiary)]">
                {t.zonder_calculatie ? 'geen calculatie — alleen omzet en geboekte kosten' : t.isbn}
              </div>
            </div>
          </div>
        </td>
        <td className="px-3 py-2.5 text-right tabular-nums text-[var(--text-secondary)]">{getal(t.verkocht.totaal)}</td>
        <td className="px-3 py-2.5 text-right tabular-nums text-[var(--text-primary)]">{euro(t.netto_omzet)}</td>
        <td className="px-3 py-2.5 text-right tabular-nums text-[var(--text-primary)]">{euro(t.resultaat)}</td>
        <td className="px-3 py-2.5 text-right">
          <MargeBadge marge={t.resultaat_marge_pct} status={t.status} />
        </td>
        <td className="px-2 py-2.5 text-[var(--text-tertiary)]">
          {t.recept_id && <ChevronRight className="w-4 h-4" />}
        </td>
      </tr>
      {open && heeftStromen && (
        <tr className="bg-[var(--bg-hover)]/40 border-b border-[var(--border)]">
          <td colSpan={6} className="px-4 py-3">
            <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs pl-6">
              <span className="text-[var(--text-tertiary)]">Netto omzet <span className="text-[var(--text-primary)] tabular-nums font-medium">{euro(t.netto_omzet)}</span></span>
              {t.stromen.filter((s) => s.gebruikt > 0.5).map((s) => (
                <span key={s.key} className="text-[var(--text-tertiary)]">
                  − {s.label}{' '}
                  <span className="text-[var(--text-secondary)] tabular-nums">{euro(s.gebruikt)}</span>
                </span>
              ))}
              <span className="text-[var(--text-tertiary)]">= Brutowinst <span className="text-[var(--text-primary)] tabular-nums font-medium">{euro(t.brutowinst)}</span></span>
              {t.winstdeling > 0 && (
                <span className="text-[var(--text-tertiary)]">− Winstdeling {pct(t.winstdeling_pct)} <span className="text-[var(--text-secondary)] tabular-nums">{euro(t.winstdeling)}</span></span>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

