import { useState, useMemo, useRef } from 'react';
import type { TitelListItem } from '../../api/types';
import { Search, Plus, Trash2, Archive, ArchiveRestore, Upload, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  items: TitelListItem[];
  loading: boolean;
  showArchived: boolean;
  onToggleArchived: (v: boolean) => void;
  onOpenTitel: (id: string) => void;
  onNewTitel: () => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onDelete: (ids: string[]) => void;
  onImportCsv: (file: File) => void;
}

function MargeLabel({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-text-tertiary text-xs">—</span>;
  const v = pct * 100;
  const cls = v >= 35
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
    : v >= 20
    ? 'bg-amber-50 text-amber-700 ring-amber-600/20'
    : 'bg-red-50 text-red-700 ring-red-600/20';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md ring-1 ring-inset ${cls}`}>
      {v.toFixed(1)}%
    </span>
  );
}

export default function DatabaseView({
  items, loading, showArchived, onToggleArchived,
  onOpenTitel, onNewTitel, onArchive, onUnarchive,
  onDelete, onImportCsv,
}: Props) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'titel' | 'auteur' | 'gewogen_marge_pct'>('titel');
  const [sortAsc, setSortAsc] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = items.filter(item =>
      item.titel.toLowerCase().includes(q) ||
      item.auteur.toLowerCase().includes(q) ||
      item.isbn.includes(q)
    );
    list.sort((a, b) => {
      let va: string | number = a[sortKey] ?? '';
      let vb: string | number = b[sortKey] ?? '';
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
    return list;
  }, [items, search, sortKey, sortAsc]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(i => i.id)));
  };

  const handleDelete = () => {
    if (selected.size === 0) return;
    if (confirm(`${selected.size} titel(s) definitief verwijderen?`)) {
      onDelete(Array.from(selected));
      setSelected(new Set());
    }
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportCsv(file);
      e.target.value = '';
    }
  };

  const SortIcon = ({ col }: { col: typeof sortKey }) => {
    if (sortKey !== col) return null;
    return sortAsc
      ? <ChevronUp size={14} className="inline ml-0.5 text-[var(--accent)]" />
      : <ChevronDown size={14} className="inline ml-0.5 text-[var(--accent)]" />;
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* ─── Header ─── */}
      <header className="bg-[var(--bg-secondary)] border-b border-[var(--border)] sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-[var(--text-primary)]">Calculatie</h1>
              <p className="text-sm text-[var(--text-secondary)] mt-0.5">Margeberekening per titel</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                onChange={handleCsvUpload}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
              >
                <Upload size={14} />
                <span className="hidden sm:inline">Import CSV</span>
              </button>
              <button
                onClick={onNewTitel}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-[var(--accent)] rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
              >
                <Plus size={14} />
                Nieuwe titel
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Toolbar ─── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-5 pb-3">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              type="text"
              placeholder="Zoek op titel, auteur of ISBN..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-3">
            {selected.size > 0 && (
              <button
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
              >
                <Trash2 size={14} />
                Verwijder ({selected.size})
              </button>
            )}
            <label className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={e => onToggleArchived(e.target.checked)}
                className="rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]/20"
              />
              Archief
            </label>
          </div>
        </div>
      </div>

      {/* ─── Table ─── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-8">
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-16 text-center text-[var(--text-tertiary)]">
              <div className="inline-block w-5 h-5 border-2 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin mb-3" />
              <p className="text-sm">Laden...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-16 text-center">
              <div className="text-[var(--text-tertiary)] mb-1">
                {search ? 'Geen titels gevonden' : 'Geen titels'}
              </div>
              <p className="text-sm text-[var(--text-tertiary)]">
                {search ? 'Probeer een andere zoekopdracht' : 'Maak een nieuwe titel aan of importeer een CSV'}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.size === filtered.length && filtered.length > 0}
                      onChange={toggleAll}
                      className="rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]/20"
                    />
                  </th>
                  <th
                    className="text-left px-3 py-3 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer select-none hover:text-[var(--text-primary)]"
                    onClick={() => toggleSort('titel')}
                  >
                    Titel <SortIcon col="titel" />
                  </th>
                  <th
                    className="text-left px-3 py-3 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer select-none hover:text-[var(--text-primary)] hidden sm:table-cell"
                    onClick={() => toggleSort('auteur')}
                  >
                    Auteur <SortIcon col="auteur" />
                  </th>
                  <th className="text-center px-3 py-3 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider w-16">
                    Drukken
                  </th>
                  <th
                    className="text-right px-3 py-3 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer select-none hover:text-[var(--text-primary)] w-24"
                    onClick={() => toggleSort('gewogen_marge_pct')}
                  >
                    Marge <SortIcon col="gewogen_marge_pct" />
                  </th>
                  <th className="w-10 px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map(item => {
                  const isSelected = selected.has(item.id);
                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors cursor-pointer ${
                        item.archived
                          ? 'opacity-50'
                          : isSelected
                          ? 'bg-[var(--accent)]/5'
                          : 'hover:bg-[var(--bg-hover)]'
                      }`}
                      onClick={() => !item.archived && onOpenTitel(item.id)}
                    >
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          onClick={e => toggleSelect(item.id, e)}
                          className="rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]/20"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-[var(--text-primary)]">{item.titel || 'Naamloze titel'}</div>
                        <div className="text-xs text-[var(--text-tertiary)] sm:hidden mt-0.5">{item.auteur}</div>
                      </td>
                      <td className="px-3 py-3 text-[var(--text-secondary)] hidden sm:table-cell">{item.auteur}</td>
                      <td className="px-3 py-3 text-center text-[var(--text-secondary)]">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-[var(--bg-primary)] text-xs font-medium tabular-nums">
                          {item.drukken_count}×
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <MargeLabel pct={item.gewogen_marge_pct} />
                      </td>
                      <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                        {item.archived ? (
                          <button
                            onClick={() => onUnarchive(item.id)}
                            className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--accent)] rounded-md hover:bg-[var(--bg-hover)] transition-colors"
                            title="Herstel uit archief"
                          >
                            <ArchiveRestore size={14} />
                          </button>
                        ) : (
                          <button
                            onClick={() => onArchive(item.id)}
                            className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] rounded-md hover:bg-[var(--bg-hover)] transition-colors"
                            title="Archiveer"
                          >
                            <Archive size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <p className="text-xs text-[var(--text-tertiary)] mt-3 text-center">
          {filtered.length} titel{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}
