// Top-level van de Resultaten-module: periode-keuze + overzicht/detail-routing.
import { useEffect, useState } from 'react';
import { getOverzicht, getPeriodes, getTitel } from './api';
import type { Overzicht, TitelResultaat } from './api';
import OverzichtTable from './OverzichtTable';
import TitelDetail from './TitelDetail';
import ImportPanel from './ImportPanel';

export default function ResultatenView() {
  const [periodes, setPeriodes] = useState<string[]>([]);
  const [periode, setPeriode] = useState<string>('2026');
  const [overzicht, setOverzicht] = useState<Overzicht | null>(null);
  const [detail, setDetail] = useState<TitelResultaat | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    getPeriodes()
      .then((ps) => {
        setPeriodes(ps);
        if (ps.length && !ps.includes(periode)) setPeriode(ps[0]);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
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
    if (detail) getTitel(detail.recept_id, periode).then(setDetail).catch(() => {});
  };

  return (
    <div className="px-3 sm:px-4 py-4 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Resultaten</h1>
          <p className="text-xs text-[var(--text-tertiary)]">Nacalculatie — wat houdt Maven ná kosten over?</p>
        </div>
        <select
          value={periode}
          onChange={(e) => {
            setDetail(null);
            setPeriode(e.target.value);
          }}
          className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
        >
          {periodes.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
      {loading && !overzicht ? (
        <div className="text-sm text-[var(--text-tertiary)] py-12 text-center">Laden…</div>
      ) : detail ? (
        <TitelDetail data={detail} onBack={() => setDetail(null)} onRefresh={refreshDetail} />
      ) : overzicht ? (
        <div className="space-y-4">
          <OverzichtTable data={overzicht} onOpen={openDetail} />
          <ImportPanel onImported={() => setReloadKey((k) => k + 1)} />
        </div>
      ) : null}
    </div>
  );
}
