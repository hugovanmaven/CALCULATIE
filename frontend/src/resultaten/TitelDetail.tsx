// View 2 — detail per titel: stroom-uitsplitsing, kanalen, vormen, royalty.
import { useEffect, useState } from 'react';
import type { TitelResultaat, GeboekteRegel } from './api';
import { euro, euro2, pct, getal, getKosten, KANAAL_LABEL } from './api';
import { MargeBadge } from './MargeBadge';
import { ArrowLeft } from 'lucide-react';

export default function TitelDetail({ data, onBack }: { data: TitelResultaat; onBack: () => void }) {
  const [regels, setRegels] = useState<GeboekteRegel[]>([]);
  useEffect(() => {
    getKosten(data.isbn, data.periode).then(setRegels).catch(() => setRegels([]));
  }, [data.isbn, data.periode]);

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Terug naar overzicht
      </button>

      <div>
        <h2 className="text-xl font-bold text-[var(--text-primary)]">{data.titel}</h2>
        <div className="text-sm text-[var(--text-tertiary)]">
          {data.isbn} · alle vormen samen · {data.periode}
        </div>
      </div>

      {/* KPI's */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card label="Verkocht" value={getal(data.verkocht.totaal)} sub="exemplaren" />
        <Card label="Netto omzet" value={euro(data.netto_omzet)} />
        <Card
          label="Brutowinst"
          value={euro(data.brutowinst)}
          extra={<MargeBadge marge={data.marge_pct} status={data.status} />}
          sub={`streef ${pct(data.streef_pct)}`}
        />
        <Card label="Resultaat" value={euro(data.resultaat)} sub={`na winstdeling · ${pct(data.resultaat_marge_pct)}`} />
      </div>

      {/* Marge-balk vs streef/ondergrens */}
      <MargeBalk marge={data.marge_pct} streef={data.streef_pct} ondergrens={data.ondergrens_pct} />

      {/* Stromen */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[var(--border)] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Kosten per stroom</h3>
          <span className="text-xs text-[var(--text-tertiary)]">
            {data.dekkingsgraad_pct > 0 ? `${pct(data.dekkingsgraad_pct)} geboekt` : 'nog geen kosten geboekt'}
          </span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[var(--text-tertiary)] text-xs border-b border-[var(--border)]">
              <th className="text-left font-medium px-4 py-2">Stroom</th>
              <th className="text-right font-medium px-3 py-2">Begroot</th>
              <th className="text-right font-medium px-3 py-2">Geboekt</th>
              <th className="text-right font-medium px-3 py-2">Gebruikt</th>
              <th className="text-left font-medium px-3 py-2 hidden sm:table-cell">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.stromen.map((s) => (
              <tr key={s.key} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-2 text-[var(--text-primary)]">{s.label}</td>
                <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">{euro(s.begroot)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">
                  {s.geboekt > 0 ? euro(s.geboekt) : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium text-[var(--text-primary)]">{euro(s.gebruikt)}</td>
                <td className="px-3 py-2 hidden sm:table-cell text-xs">
                  <StroomStatus begroot={s.begroot} geboekt={s.geboekt} overschrijding={s.overschrijding} />
                </td>
              </tr>
            ))}
            <tr className="bg-[var(--bg-hover)] font-semibold">
              <td className="px-4 py-2 text-[var(--text-primary)]">Totaal kosten</td>
              <td></td>
              <td></td>
              <td className="px-3 py-2 text-right tabular-nums text-[var(--text-primary)]">{euro(data.kosten_totaal)}</td>
              <td className="hidden sm:table-cell"></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Kanalen + vormen */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] px-4 py-2.5 border-b border-[var(--border)]">
            Per kanaal
          </h3>
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(data.kanalen).map(([k, v]) => (
                <tr key={k} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-2 text-[var(--text-primary)]">{KANAAL_LABEL[k] ?? k}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">{getal(v.stuks)} ex</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text-primary)]">{euro(v.omzet)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-[var(--text-tertiary)]">{euro2(v.prijs_ex_btw)}/ex</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] px-4 py-2.5 border-b border-[var(--border)]">
            Per vorm
          </h3>
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(data.vormen).map(([k, v]) => (
                <tr key={k} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-2 text-[var(--text-primary)] capitalize">{k}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">{getal(v.stuks)} ex</td>
                  <td className="px-4 py-2 text-right tabular-nums text-[var(--text-primary)]">{euro(v.omzet)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Geboekte Exact-regels achter de cijfers */}
      {regels.length > 0 && (
        <details className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden group">
          <summary className="px-4 py-2.5 cursor-pointer select-none text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-hover)]">
            Geboekte Exact-regels ({regels.length})
          </summary>
          <table className="w-full text-sm border-t border-[var(--border)]">
            <thead>
              <tr className="text-[var(--text-tertiary)] text-xs border-b border-[var(--border)]">
                <th className="text-left font-medium px-4 py-2">Datum</th>
                <th className="text-left font-medium px-3 py-2">Relatie</th>
                <th className="text-left font-medium px-3 py-2 hidden sm:table-cell">Grootboek</th>
                <th className="text-left font-medium px-3 py-2">Stroom</th>
                <th className="text-right font-medium px-4 py-2">Bedrag</th>
              </tr>
            </thead>
            <tbody>
              {regels.map((r) => (
                <tr key={r.exact_ref} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-2 text-[var(--text-tertiary)] tabular-nums">{r.datum}</td>
                  <td className="px-3 py-2 text-[var(--text-primary)]">{r.relatie || '—'}</td>
                  <td className="px-3 py-2 text-[var(--text-tertiary)] hidden sm:table-cell">{r.grootboek}</td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">{r.categorie}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-[var(--text-primary)]">{euro(r.bedrag)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {data.royalty_staffel_pct > 0 && (
        <p className="text-xs text-[var(--text-tertiary)] px-1">
          Royalty-staffel op {pct(data.royalty_staffel_pct)} (groep-cumulatief ± {getal(data.cumulatief_opening)} ex bij
          aanvang periode). Royalty wordt jaarlijks tegen SFP afgerekend (true-up).
        </p>
      )}
    </div>
  );
}

function Card({ label, value, sub, extra }: { label: string; value: string; sub?: string; extra?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-3">
      <div className="text-xs text-[var(--text-tertiary)] mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold text-[var(--text-primary)] tabular-nums">{value}</span>
        {extra}
      </div>
      {sub && <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{sub}</div>}
    </div>
  );
}

function StroomStatus({ begroot, geboekt, overschrijding }: { begroot: number; geboekt: number; overschrijding: boolean }) {
  if (overschrijding) {
    return <span className="text-red-600">€{Math.round(geboekt - begroot).toLocaleString('nl-NL')} boven begroting ⚠</span>;
  }
  if (geboekt > 0 && geboekt < begroot) {
    return <span className="text-[var(--text-tertiary)]">€{Math.round(begroot - geboekt).toLocaleString('nl-NL')} nog te verwachten</span>;
  }
  if (geboekt === 0 && begroot > 0) {
    return <span className="text-[var(--text-tertiary)]">begroot</span>;
  }
  return <span className="text-emerald-600">geboekt</span>;
}

function MargeBalk({ marge, streef, ondergrens }: { marge: number; streef: number; ondergrens: number }) {
  const max = Math.max(streef * 1.6, marge * 1.1, 0.5);
  const x = (v: number) => `${Math.min((v / max) * 100, 100)}%`;
  const barColor = marge >= streef ? 'bg-emerald-500' : marge >= ondergrens ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
      <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)] mb-2">
        <span>Brutomarge</span>
        <span>{pct(marge)}</span>
      </div>
      <div className="relative h-3 rounded-full bg-[var(--bg-hover)]">
        <div className={`absolute inset-y-0 left-0 rounded-full ${barColor}`} style={{ width: x(marge) }} />
        {/* ondergrens + streef markers */}
        <Marker pos={x(ondergrens)} label={`ondergrens ${pct(ondergrens)}`} />
        <Marker pos={x(streef)} label={`streef ${pct(streef)}`} strong />
      </div>
      <div className="h-5" />
    </div>
  );
}

function Marker({ pos, label, strong }: { pos: string; label: string; strong?: boolean }) {
  return (
    <div className="absolute top-0 bottom-0" style={{ left: pos }}>
      <div className={`w-px h-full ${strong ? 'bg-[var(--text-secondary)]' : 'bg-[var(--text-tertiary)]'}`} />
      <div className="absolute top-3.5 -translate-x-1/2 whitespace-nowrap text-[10px] text-[var(--text-tertiary)]">{label}</div>
    </div>
  );
}
