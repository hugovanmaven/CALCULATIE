import { useState, useEffect, useRef } from 'react';
import { Search, X, Book, Loader2 } from 'lucide-react';
import { searchSalesTitels, getSalesTitelDetail } from '../../api/client';
import type { TitelInput, SalesEditie, SalesSource } from '../../api/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (patch: Partial<TitelInput>) => void;
}

interface SearchHit {
  id: number;
  titel_id: string;
  titel: string;
  auteur: string;
  imprint_naam?: string;
}

interface TitelDetail {
  id: number;
  titel_id: string;
  titel: string;
  auteur: string;
  imprint_naam?: string;
  edities: SalesEditie[];
}

export function SalesTitelSearch({ open, onClose, onPick }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<TitelDetail | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSelected(null);
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open || query.length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const items = await searchSalesTitels(query);
        setResults(items);
      } catch (e) {
        setError(
          'Kon niet verbinden met sales dashboard. Check of je ingelogd bent op maven-company.com en of CORS is toegestaan.'
        );
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query, open]);

  async function handlePickTitel(hit: SearchHit) {
    setLoading(true);
    setError(null);
    try {
      const detail = await getSalesTitelDetail(hit.id);
      setSelected(detail);
    } catch (e) {
      setError('Kon titeldetail niet ophalen.');
    } finally {
      setLoading(false);
    }
  }

  function handlePickEditie(editie: SalesEditie) {
    if (!selected) return;
    const today = new Date().toISOString().slice(0, 10);
    const verschenen = editie.publicatiedatum
      ? editie.publicatiedatum <= today
      : false;

    const source: SalesSource = {
      sales_titel_id: selected.titel_id,
      sales_editie_isbn: editie.isbn,
      imprint: selected.imprint_naam,
      laatst_gesynchroniseerd: new Date().toISOString(),
    };

    onPick({
      titel: selected.titel,
      auteur: selected.auteur,
      isbn: editie.isbn,
      verkoopprijs_incl_btw: editie.adviesprijs || 20,
      verschijningsdatum: editie.publicatiedatum || '',
      verschenen,
      sales_source: source,
    });
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 pt-20"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[var(--bg-primary)] rounded-2xl shadow-2xl border border-[var(--border)] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Zoek titel in Sales Dashboard
            </h2>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
              Eénrichting — wijzigingen hier hebben geen invloed op de sales-database
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search input */}
        <div className="p-4 border-b border-[var(--border)]">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Typ titel, auteur of titel-code…"
              className="w-full pl-9 pr-10 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg-secondary)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] outline-none"
            />
            {loading && (
              <Loader2
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] animate-spin"
              />
            )}
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto">
          {error && (
            <div className="p-4 m-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}

          {!error && !selected && query.length >= 2 && results.length === 0 && !loading && (
            <div className="p-8 text-center text-sm text-[var(--text-tertiary)]">
              Geen titels gevonden voor "{query}"
            </div>
          )}

          {!error && !selected && query.length < 2 && (
            <div className="p-8 text-center text-sm text-[var(--text-tertiary)]">
              Minimaal 2 tekens om te zoeken
            </div>
          )}

          {/* Search results */}
          {!selected && results.length > 0 && (
            <ul className="divide-y divide-[var(--border)]">
              {results.map(hit => (
                <li key={hit.id}>
                  <button
                    onClick={() => handlePickTitel(hit)}
                    className="w-full text-left px-4 py-3 hover:bg-[var(--bg-secondary)] transition-colors flex items-start gap-3"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[var(--accent-light)] flex items-center justify-center shrink-0 mt-0.5">
                      <Book size={14} className="text-[var(--accent)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {hit.titel}
                      </div>
                      <div className="text-xs text-[var(--text-tertiary)] truncate">
                        {hit.auteur || 'Onbekende auteur'}
                        {hit.imprint_naam && ` · ${hit.imprint_naam}`}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Editie picker */}
          {selected && (
            <div>
              <div className="px-4 py-3 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
                <button
                  onClick={() => setSelected(null)}
                  className="text-xs text-[var(--accent)] hover:underline mb-1"
                >
                  ← Terug naar zoeken
                </button>
                <div className="text-sm font-semibold text-[var(--text-primary)]">
                  {selected.titel}
                </div>
                <div className="text-xs text-[var(--text-tertiary)]">
                  {selected.auteur || 'Onbekende auteur'}
                  {selected.imprint_naam && ` · ${selected.imprint_naam}`}
                </div>
              </div>
              <div className="p-4">
                <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                  Kies editie
                </p>
                {selected.edities.length === 0 ? (
                  <p className="text-sm text-[var(--text-tertiary)] py-4 text-center">
                    Geen edities gekoppeld aan deze titel.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {selected.edities.map(editie => (
                      <li key={editie.id}>
                        <button
                          onClick={() => handlePickEditie(editie)}
                          className="w-full text-left p-3 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent-light)] transition-all group"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-[var(--text-primary)] capitalize">
                                {editie.verschijningsvorm}
                              </div>
                              <div className="text-xs text-[var(--text-tertiary)] font-mono mt-0.5">
                                {editie.isbn}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">
                                €{(editie.adviesprijs ?? 0).toFixed(2)}
                              </div>
                              {editie.publicatiedatum && (
                                <div className="text-[10px] text-[var(--text-tertiary)]">
                                  {editie.publicatiedatum}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
