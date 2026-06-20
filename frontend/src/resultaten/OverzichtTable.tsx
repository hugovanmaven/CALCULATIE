// View 1 — alle titels samen + Maven-totaal.
import type { Overzicht } from './api';
import { euro, pct, getal } from './api';
import { MargeBadge } from './MargeBadge';
import { ChevronRight } from 'lucide-react';

export default function OverzichtTable({
  data,
  onOpen,
}: {
  data: Overzicht;
  onOpen: (id: string) => void;
}) {
  const m = data.maven_totaal;

  return (
    <div className="space-y-4">
      {/* Maven-totaal */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Maven als geheel</h2>
          <span className="text-xs text-[var(--text-tertiary)]">{m.aantal_titels} titels · {data.periode}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Kpi label="Netto omzet" value={euro(m.netto_omzet)} />
          <Kpi label="Brutowinst" value={euro(m.brutowinst)} />
          <Kpi
            label="Brutomarge"
            value={pct(m.marge_pct)}
            extra={<MargeBadge marge={m.marge_pct} status={m.status} />}
            sub={`streef ${pct(m.streef_pct)}`}
          />
          <Kpi label="Resultaat (na winstdeling)" value={euro(m.resultaat)} sub={pct(m.resultaat_marge_pct)} />
        </div>
      </div>

      {/* Titels */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--text-tertiary)] text-xs">
              <th className="text-left font-medium px-4 py-2.5">Titel</th>
              <th className="text-right font-medium px-3 py-2.5">Verkocht</th>
              <th className="text-right font-medium px-3 py-2.5">Netto omzet</th>
              <th className="text-right font-medium px-3 py-2.5">Brutomarge</th>
              <th className="text-right font-medium px-3 py-2.5">Resultaat</th>
              <th className="text-right font-medium px-3 py-2.5 hidden sm:table-cell">Geboekt</th>
              <th className="px-2 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {data.titels.map((t) => (
              <tr
                key={t.recept_id}
                onClick={() => onOpen(t.recept_id)}
                className="border-b border-[var(--border)] last:border-0 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
              >
                <td className="px-4 py-2.5">
                  <div className="font-medium text-[var(--text-primary)]">{t.titel}</div>
                  <div className="text-xs text-[var(--text-tertiary)]">{t.isbn}</div>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-[var(--text-secondary)]">{getal(t.verkocht.totaal)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-[var(--text-primary)]">{euro(t.netto_omzet)}</td>
                <td className="px-3 py-2.5 text-right"><MargeBadge marge={t.marge_pct} status={t.status} /></td>
                <td className="px-3 py-2.5 text-right tabular-nums text-[var(--text-secondary)]">{euro(t.resultaat)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-[var(--text-tertiary)] hidden sm:table-cell">
                  {t.dekkingsgraad_pct > 0 ? pct(t.dekkingsgraad_pct) : '—'}
                </td>
                <td className="px-2 py-2.5 text-[var(--text-tertiary)]"><ChevronRight className="w-4 h-4" /></td>
              </tr>
            ))}
            {data.titels.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--text-tertiary)] text-sm">
                  Geen titels met verkoop in deze periode.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[var(--text-tertiary)] px-1">
        Marge = brutowinst / netto-omzet (vóór winstdeling), afgezet tegen streef {pct(m.streef_pct)} / ondergrens{' '}
        {pct(m.ondergrens_pct)}. "Geboekt" = aandeel kosten dat al uit Exact komt; de rest is begroot uit de calculatie.
      </p>
    </div>
  );
}

function Kpi({ label, value, sub, extra }: { label: string; value: string; sub?: string; extra?: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-[var(--text-tertiary)] mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold text-[var(--text-primary)] tabular-nums">{value}</span>
        {extra}
      </div>
      {sub && <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{sub}</div>}
    </div>
  );
}
