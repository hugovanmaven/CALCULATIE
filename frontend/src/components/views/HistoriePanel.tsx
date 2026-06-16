import { useEffect, useState } from 'react';
import { X, RotateCcw, Loader2, History as HistoryIcon } from 'lucide-react';
import { getHistorie, restoreHistorie, ApiError } from '../../api/client';
import type { HistorieEntry } from '../../api/types';

interface Props {
  titelId: string;
  onClose: () => void;
  /** Aangeroepen na een geslaagde restore, zodat de detailpagina kan herladen. */
  onRestored: () => void;
}

function formatMoment(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('nl-NL', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default function HistoriePanel({ titelId, onClose, onRestored }: Props) {
  const [entries, setEntries] = useState<HistorieEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getHistorie(titelId)
      .then((e) => { if (active) setEntries(e); })
      .catch(() => { if (active) setError('Geschiedenis kon niet geladen worden.'); });
    return () => { active = false; };
  }, [titelId]);

  const handleRestore = async (entry: HistorieEntry) => {
    const wanneer = formatMoment(entry.created_at);
    if (!window.confirm(
      `Titel terugzetten naar de versie van ${wanneer}?\n\n` +
      'De huidige waarden worden overschreven. Deze actie wordt zelf ook als ' +
      'een wijziging vastgelegd, dus je kunt het later weer terugdraaien.'
    )) return;

    setRestoringId(entry.id);
    try {
      await restoreHistorie(titelId, entry.id);
      onRestored();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        alert('Deze titel is intussen door iemand anders aangepast. Herlaad de titel voordat je terugzet.');
      } else {
        alert('Terugzetten is mislukt. Probeer het opnieuw.');
      }
      setRestoringId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-full max-w-md h-full bg-[var(--bg-secondary)] border-l border-[var(--border)] shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2 text-[var(--text-primary)]">
            <HistoryIcon size={18} />
            <h2 className="text-sm font-semibold">Versiegeschiedenis</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 -mr-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors"
            title="Sluiten"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {error && <p className="text-sm text-red-500">{error}</p>}

          {!entries && !error && (
            <div className="flex items-center justify-center py-12 text-[var(--text-tertiary)]">
              <Loader2 size={24} className="animate-spin" />
            </div>
          )}

          {entries && entries.length === 0 && (
            <p className="text-sm text-[var(--text-tertiary)] py-8 text-center">
              Nog geen wijzigingen vastgelegd.
            </p>
          )}

          {entries && entries.length > 0 && (
            <ol className="space-y-3">
              {entries.map((entry, i) => {
                const isCurrent = i === 0;
                const aangemaakt = entry.changes.some((c) => c.veld === '_aangemaakt');
                return (
                  <li
                    key={entry.id}
                    className="rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] p-3"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-medium text-[var(--text-secondary)] flex items-center gap-2">
                        {formatMoment(entry.created_at)}
                        {isCurrent && (
                          <span className="rounded-full bg-emerald-500/15 text-emerald-600 px-2 py-0.5 text-[10px] font-semibold">
                            huidig
                          </span>
                        )}
                      </span>
                      {!isCurrent && (
                        <button
                          onClick={() => handleRestore(entry)}
                          disabled={restoringId !== null}
                          className="shrink-0 flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
                          title="Zet de titel terug naar deze versie"
                        >
                          {restoringId === entry.id
                            ? <Loader2 size={12} className="animate-spin" />
                            : <RotateCcw size={12} />}
                          Terugzetten
                        </button>
                      )}
                    </div>

                    {aangemaakt ? (
                      <p className="text-sm text-[var(--text-tertiary)] italic">Titel aangemaakt</p>
                    ) : (
                      <ul className="space-y-1">
                        {entry.changes.map((c, j) => (
                          <li key={j} className="text-sm text-[var(--text-primary)]">
                            <span className="text-[var(--text-tertiary)]">{c.label}:</span>{' '}
                            {c.oud !== null && (
                              <span className="text-[var(--text-tertiary)] line-through">{c.oud}</span>
                            )}
                            {c.oud !== null && ' → '}
                            <span className="font-medium">{c.nieuw}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
