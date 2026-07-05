// Exact-verantwoording — per geïmporteerde regel bepalen wat ermee gebeurt:
// aan een titel toewijzen, verdelen (overige verkoopkosten), of negeren.
import { useEffect, useMemo, useState } from 'react';
import type { ExactAudit, ExactAuditRegel, TitelKeuze, Bestemming } from './api';
import { euro, getal, getExactAudit, getTitels, setDispositie, wijsToe } from './api';
import { TitelSelect } from './ui';
import { CheckCircle2, HelpCircle, Split, Ban, Tag } from 'lucide-react';

type Filter = 'tebeoordelen' | 'alle' | 'titel' | 'verdeeld' | 'genegeerd';

const BESTEMMING_META: Record<Bestemming, { label: string; cls: string }> = {
  titel: { label: 'aan titel', cls: 'text-emerald-700' },
  verdeeld: { label: 'verdeeld', cls: 'text-sky-700' },
  genegeerd: { label: 'genegeerd', cls: 'text-[var(--text-tertiary)] line-through' },
  tebeoordelen: { label: 'te beoordelen', cls: 'text-amber-700' },
};

export default function ExactAuditPanel({ periode, onChanged }: { periode: string; onChanged: () => void }) {
  const [audit, setAudit] = useState<ExactAudit | null>(null);
  const [titels, setTitels] = useState<TitelKeuze[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('tebeoordelen');

  const laad = () => {
    getExactAudit(periode).then(setAudit).catch(() => setError('Kon de Exact-verantwoording niet laden.'));
  };
  useEffect(laad, [periode]);
  useEffect(() => { getTitels().then(setTitels).catch(() => {}); }, []);

  const muteer = async (fn: () => Promise<unknown>) => {
    await fn();
    laad();
    onChanged();
  };

  const t = audit?.totaal;
  const regels = useMemo(
    () => (audit?.regels ?? []).filter((r) => (filter === 'alle' ? true : r.bestemming === filter)),
    [audit, filter]
  );

  if (error) return <div className="text-sm text-red-600">{error}</div>;
  if (!audit || !t) return <div className="text-sm text-[var(--text-tertiary)] py-8 text-center">Laden…</div>;

  return (
    <div className="space-y-4">
      {/* Totalen — vier bestemmingen */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
          Wat is er met de Exact-kosten gebeurd?{' '}
          <span className="font-normal text-[var(--text-tertiary)]">· {periode || 'alle periodes'} · {getal(t.regels)} regels · {euro(t.bedrag)}</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Kpi label="Aan titels" value={euro(t.titel_bedrag)} sub={`${getal(t.titel_regels)} regels`} icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />} />
          <Kpi label="Overige verkoopkosten" value={euro(t.verdeeld_bedrag)} sub={`${getal(t.verdeeld_regels)} regels — verdeeld`} icon={<Split className="w-4 h-4 text-sky-600" />} />
          <Kpi label="Genegeerd" value={euro(t.genegeerd_bedrag)} sub={`${getal(t.genegeerd_regels)} regels`} icon={<Ban className="w-4 h-4 text-[var(--text-tertiary)]" />} />
          <Kpi label="Nog te beoordelen" value={euro(t.tebeoordelen_bedrag)} sub={`${getal(t.tebeoordelen_regels)} regels`} icon={<HelpCircle className="w-4 h-4 text-amber-600" />} />
        </div>
        <p className="text-xs text-[var(--text-tertiary)] mt-3">
          Kosten zonder kostenplaats in Exact vallen onder "nog te beoordelen". Wijs ze toe aan een titel, verdeel ze
          als <strong>overige verkoopkosten</strong> (naar rato van omzet over alle titels — bv. LibrisLBZ verkoopkosten),
          of negeer ze (bv. een overlegkost). Kies "hele relatie" om het te onthouden voor volgende imports.
        </p>
      </div>

      {/* Per grootboek — compact raadpleeg-overzicht */}
      <details className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden">
        <summary className="px-4 py-2.5 cursor-pointer select-none text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-hover)]">
          Per grootboek ({Object.keys(audit.per_grootboek).length})
        </summary>
        <table className="w-full text-sm border-t border-[var(--border)]">
          <thead>
            <tr className="text-[var(--text-tertiary)] text-xs border-b border-[var(--border)]">
              <th className="text-left font-medium px-4 py-2">Grootboek</th>
              <th className="text-right font-medium px-3 py-2">Regels</th>
              <th className="text-right font-medium px-3 py-2">Aan titel</th>
              <th className="text-right font-medium px-3 py-2">Verdeeld</th>
              <th className="text-right font-medium px-3 py-2">Te beoordelen</th>
              <th className="text-right font-medium px-4 py-2">Bedrag</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(audit.per_grootboek)
              .sort(([, a], [, b]) => b.bedrag - a.bedrag)
              .map(([gb, g]) => (
                <tr key={gb} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-2 text-[var(--text-primary)]">{gb}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">{g.regels}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{g.titel || ''}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-sky-700">{g.verdeeld || ''}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${g.tebeoordelen > 0 ? 'text-amber-700' : 'text-[var(--text-tertiary)]'}`}>
                    {g.tebeoordelen || ''}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-[var(--text-primary)]">{euro(g.bedrag)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>

      {/* Regels met dispositie-acties */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[var(--border)] flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Regels ({regels.length})</h3>
          <div className="flex gap-1.5 flex-wrap">
            {([
              ['tebeoordelen', 'Te beoordelen'],
              ['verdeeld', 'Verdeeld'],
              ['genegeerd', 'Genegeerd'],
              ['titel', 'Aan titels'],
              ['alle', 'Alle'],
            ] as [Filter, string][]).map(([f, label]) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                  filter === f
                    ? 'border-[var(--accent)] text-[var(--text-primary)] bg-[var(--accent-light)]'
                    : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {regels.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-[var(--text-tertiary)]">
            {filter === 'tebeoordelen' ? 'Niets meer te beoordelen — alle kosten hebben een bestemming ✓' : 'Geen regels in dit filter.'}
          </div>
        ) : (
          <div className="max-h-[32rem] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--bg-secondary)] z-10">
                <tr className="text-[var(--text-tertiary)] text-xs border-b border-[var(--border)]">
                  <th className="text-left font-medium px-4 py-2">Datum</th>
                  <th className="text-left font-medium px-3 py-2">Relatie</th>
                  <th className="text-left font-medium px-3 py-2 hidden md:table-cell">Grootboek</th>
                  <th className="text-right font-medium px-3 py-2">Bedrag</th>
                  <th className="text-left font-medium px-4 py-2">Bestemming / actie</th>
                </tr>
              </thead>
              <tbody>
                {regels.map((r) => (
                  <RegelRij key={r.exact_ref} r={r} titels={titels} muteer={muteer} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function RegelRij({
  r,
  titels,
  muteer,
}: {
  r: ExactAuditRegel;
  titels: TitelKeuze[];
  muteer: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [kies, setKies] = useState(false);
  const [heleRelatie, setHeleRelatie] = useState(false);
  const meta = BESTEMMING_META[r.bestemming];
  const teBeoordelen = r.bestemming === 'tebeoordelen';

  return (
    <>
      <tr className="border-b border-[var(--border)] last:border-0">
        <td className="px-4 py-2 text-[var(--text-tertiary)] tabular-nums whitespace-nowrap">{r.datum}</td>
        <td className="px-3 py-2 text-[var(--text-primary)]">{r.relatie || '—'}</td>
        <td className="px-3 py-2 text-[var(--text-tertiary)] hidden md:table-cell">{r.grootboek}</td>
        <td className="px-3 py-2 text-right tabular-nums text-[var(--text-primary)]">{euro(r.bedrag)}</td>
        <td className="px-4 py-2">
          {r.bestemming === 'titel' ? (
            <span className="text-xs text-emerald-700">{r.titel || r.isbn}</span>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs ${meta.cls}`}>{meta.label}</span>
              <div className="flex items-center gap-1">
                <ActieKnop
                  actief={false}
                  icon={<Tag className="w-3 h-3" />}
                  label="Aan titel"
                  onClick={() => setKies((k) => !k)}
                />
                <ActieKnop
                  actief={r.bestemming === 'verdeeld'}
                  icon={<Split className="w-3 h-3" />}
                  label="Verdelen"
                  onClick={() => muteer(() => setDispositie({
                    exact_ref: r.exact_ref, relatie: heleRelatie ? r.relatie : undefined,
                    dispositie: r.bestemming === 'verdeeld' ? '' : 'verdeeld', onthoud: heleRelatie,
                  }))}
                />
                <ActieKnop
                  actief={r.bestemming === 'genegeerd'}
                  icon={<Ban className="w-3 h-3" />}
                  label="Negeren"
                  onClick={() => muteer(() => setDispositie({
                    exact_ref: r.exact_ref, relatie: heleRelatie ? r.relatie : undefined,
                    dispositie: r.bestemming === 'genegeerd' ? '' : 'genegeerd', onthoud: heleRelatie,
                  }))}
                />
              </div>
              {teBeoordelen && r.relatie && (
                <label className="inline-flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] cursor-pointer">
                  <input type="checkbox" checked={heleRelatie} onChange={(e) => setHeleRelatie(e.target.checked)} className="w-3 h-3" />
                  hele relatie
                </label>
              )}
            </div>
          )}
          {kies && (
            <div className="mt-2">
              <TitelSelect
                titels={titels}
                placeholder="Kies een titel…"
                onKies={(id) => muteer(() => wijsToe(r.exact_ref, id)).then(() => setKies(false))}
                className="max-w-xs"
              />
            </div>
          )}
        </td>
      </tr>
    </>
  );
}

function ActieKnop({ actief, icon, label, onClick }: { actief: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border transition-colors ${
        actief
          ? 'border-[var(--accent)] bg-[var(--accent-light)] text-[var(--text-primary)]'
          : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
      }`}
      title={label}
    >
      {icon} {label}
    </button>
  );
}

function Kpi({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] mb-1">
        {icon}
        {label}
      </div>
      <div className="text-lg font-semibold text-[var(--text-primary)] tabular-nums">{value}</div>
      {sub && <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{sub}</div>}
    </div>
  );
}
