// Top-level van de Resultaten-module: periode-keuze + overzicht/verantwoording/detail.
import { useEffect, useState } from 'react';
import { getOverzicht, getPeriodes, getTitel, periodeLabel } from './api';
import type { Overzicht, TitelResultaat } from './api';
import OverzichtTable from './OverzichtTable';
import TitelDetail from './TitelDetail';
import ImportPanel from './ImportPanel';
import ExactAuditPanel from './ExactAuditPanel';
import { ChevronRight } from 'lucide-react';

type Tab = 'overzicht' | 'exact';

export default function ResultatenView({ initialTitelId = null }: { initialTitelId?: string | null }) {
  const [periodes, setPeriodes] = useState<string[]>([]);
  const [periode, setPeriode] = useState<string>('');
  const [tab, setTab] = useState<Tab>('overzicht');
  const [overzicht, setOverzicht] = useState<Overzicht | null>(null);
  const [detail, setDetail] = useState<TitelResultaat | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Vanuit de calculatie op een titel hierheen → open direct diezelfde titel.
  useEffect(() => {
    if (initialTitelId && periode) {
      getTitel(initialTitelId, periode).then(setDetail).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTitelId, periode]);

  useEffect(() => {
    getPeriodes()
      .then(({ periodes: ps, default: def }) => {
        setPeriodes(ps);
        setPeriode((cur) => cur || def || ps[0] || '2026');
      })
      .catch(() => setPeriode((cur) => cur || '2026'));
  }, []);

  useEffect(() => {
    if (!periode) return;
    setLoading(true);
    setError(null);
    getOverzicht(periode)
      .then((d) => setOverzicht(d))
      .catch(() => setError('Kon resultaten niet laden.'))
      .finally(() => setLoading(false));
  }, [periode, reloadKey]);

  const openDetail = (id: string) => {
    getTitel(id, periode)
      .then((d) => setDetail(d))
      .catch(() => setError('Kon titel niet laden.'));
  };

  const refreshDetail = () => {
    if (detail?.recept_id) getTitel(detail.recept_id, periode).then(setDetail).catch(() => {});
    setReloadKey((k) => k + 1);
  };

  const afgesloten = overzicht?.maven_totaal.afgesloten;

  return (
    <div className="px-3 sm:px-4 py-4 max-w-screen-xl mx-auto">
      {/* Kop: kwartaal-context + navigatie */}
      <div className="flex items-end justify-between mb-4 gap-3 flex-wrap">
        <div>
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)] mb-1">
            <span>Resultaten</span>
            <ChevronRight className="w-3 h-3" />
            <button
              onClick={() => setDetail(null)}
              className={detail ? 'hover:text-[var(--text-primary)] transition-colors' : 'text-[var(--text-secondary)]'}
            >
              {tab === 'exact' && !detail ? 'Exact-verantwoording' : 'Overzicht'}
            </button>
            {detail && (
              <>
                <ChevronRight className="w-3 h-3" />
                <span className="text-[var(--text-secondary)]">{detail.titel}</span>
              </>
            )}
          </div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">
            {periodeLabel(periode)}
            {periode.includes('-') && (
              <span
                className={`ml-2 align-middle inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md ring-1 ring-inset ${
                  afgesloten
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                    : 'bg-sky-50 text-sky-700 ring-sky-600/20'
                }`}
              >
                {afgesloten ? 'afgesloten' : 'nog open'}
              </span>
            )}
          </h1>
          <p className="text-xs text-[var(--text-tertiary)]">
            Nacalculatie — resultaat per titel na directe kosten (excl. algemene overhead).
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!detail && (
            <div className="flex rounded-lg border border-[var(--border)] overflow-hidden text-sm">
              {(
                [
                  ['overzicht', 'Overzicht'],
                  ['exact', 'Exact-verantwoording'],
                ] as [Tab, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`px-3 py-1.5 transition-colors ${
                    tab === key
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <select
            value={periode}
            onChange={(e) => {
              setDetail(null);
              setPeriode(e.target.value);
            }}
            className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
          >
            {periodes.map((p) => (
              <option key={p} value={p}>{periodeLabel(p)}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
      {loading && !overzicht ? (
        <div className="text-sm text-[var(--text-tertiary)] py-12 text-center">Laden…</div>
      ) : detail ? (
        <TitelDetail data={detail} onBack={() => setDetail(null)} onRefresh={refreshDetail} />
      ) : tab === 'exact' ? (
        <ExactAuditPanel periode={periode} onChanged={() => setReloadKey((k) => k + 1)} />
      ) : overzicht ? (
        <div className="space-y-4">
          <OverzichtTable
            data={overzicht}
            onOpen={openDetail}
            onGaNaarExact={() => setTab('exact')}
            onChanged={() => setReloadKey((k) => k + 1)}
          />
          <ImportPanel onImported={() => setReloadKey((k) => k + 1)} />
        </div>
      ) : null}
    </div>
  );
}
