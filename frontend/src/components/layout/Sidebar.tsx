import { useState } from 'react';
import { Search, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import type { TitelState } from '../../hooks/useTitels';

interface Props {
  titels: TitelState[];
  activeIndex: number;
  onSwitch: (index: number) => void;
  onAdd: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ titels, activeIndex, onSwitch, onAdd, isOpen, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [verschenenOpen, setVerschenenOpen] = useState(true);
  const [voorbereidingOpen, setVoorbereidingOpen] = useState(true);

  const query = search.toLowerCase().trim();

  // Filter titels by search
  const filtered = titels.map((t, i) => ({ titel: t, index: i })).filter(({ titel }) => {
    if (!query) return true;
    const name = (titel.titelInput.titel || 'Nieuwe titel').toLowerCase();
    const isbn = (titel.titelInput.isbn || '').toLowerCase();
    return name.includes(query) || isbn.includes(query);
  });

  // Group by verschenen status
  const verschenen = filtered.filter(({ titel }) => titel.titelInput.verschenen);
  const voorbereiding = filtered.filter(({ titel }) => !titel.titelInput.verschenen);

  const renderTitelItem = ({ titel, index }: { titel: TitelState; index: number }) => {
    const isActive = index === activeIndex;
    const name = titel.titelInput.titel || 'Nieuwe titel';
    const isbn = titel.titelInput.isbn;
    const isDirty = titel.dirty;

    return (
      <button
        key={titel.id ?? `new-${index}`}
        onClick={() => { onSwitch(index); onClose(); }}
        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-start gap-2 ${
          isActive
            ? 'bg-blue-50 text-blue-900 font-medium'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        {isDirty && (
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-1.5" title="Niet opgeslagen" />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate">{name}</div>
          {isbn && (
            <div className="text-[11px] text-gray-400 font-mono truncate">{isbn}</div>
          )}
        </div>
        {titel.titelInput.verschenen && (
          <span className="text-[9px] font-semibold uppercase px-1 py-0.5 rounded bg-green-50 text-green-600 border border-green-200 shrink-0 mt-0.5">
            Live
          </span>
        )}
      </button>
    );
  };

  const GroupHeader = ({
    label,
    count,
    isOpen: open,
    onToggle,
  }: {
    label: string;
    count: number;
    isOpen: boolean;
    onToggle: () => void;
  }) => (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-1 px-2 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors"
    >
      {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      {label}
      <span className="text-[10px] font-normal text-gray-300 ml-auto">{count}</span>
    </button>
  );

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed lg:static top-0 left-0 z-50 h-full lg:h-auto
          w-[260px] lg:w-[240px] lg:min-w-[240px]
          bg-white border-r border-gray-200
          transform transition-transform duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          lg:transform-none
          flex flex-col
          lg:sticky lg:top-[52px] lg:h-[calc(100vh-52px)]
        `}
      >
        {/* Search */}
        <div className="p-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Zoeken..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none bg-gray-50"
            />
          </div>
        </div>

        {/* Titel list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {/* Verschenen group */}
          {verschenen.length > 0 && (
            <div>
              <GroupHeader
                label="Verschenen"
                count={verschenen.length}
                isOpen={verschenenOpen}
                onToggle={() => setVerschenenOpen(!verschenenOpen)}
              />
              {verschenenOpen && (
                <div className="space-y-0.5 ml-1">
                  {verschenen.map(renderTitelItem)}
                </div>
              )}
            </div>
          )}

          {/* In voorbereiding group */}
          {voorbereiding.length > 0 && (
            <div>
              <GroupHeader
                label="In voorbereiding"
                count={voorbereiding.length}
                isOpen={voorbereidingOpen}
                onToggle={() => setVoorbereidingOpen(!voorbereidingOpen)}
              />
              {voorbereidingOpen && (
                <div className="space-y-0.5 ml-1">
                  {voorbereiding.map(renderTitelItem)}
                </div>
              )}
            </div>
          )}

          {/* No results */}
          {filtered.length === 0 && query && (
            <p className="text-xs text-gray-400 text-center py-4">
              Geen titels gevonden voor &ldquo;{search}&rdquo;
            </p>
          )}
        </div>

        {/* Add button */}
        <div className="p-3 border-t border-gray-100">
          <button
            onClick={() => { onAdd(); onClose(); }}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nieuwe titel
          </button>
        </div>
      </aside>
    </>
  );
}
