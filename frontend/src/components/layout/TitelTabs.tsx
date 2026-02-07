import { Plus, X, Copy } from 'lucide-react';
import type { TitelState } from '../../hooks/useTitels';

interface Props {
  titels: TitelState[];
  activeIndex: number;
  onSwitch: (index: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onDuplicate: () => void;
}

export function TitelTabs({
  titels, activeIndex, onSwitch, onAdd, onRemove, onDuplicate,
}: Props) {
  return (
    <div className="flex items-center gap-0.5 bg-gray-100 px-2 py-1 overflow-x-auto">
      {titels.map((titel, i) => {
        const isActive = i === activeIndex;
        const name = titel.titelInput.titel || 'Nieuwe titel';
        const druk = titel.titelInput.druknummer;
        const isDirty = titel.dirty;

        return (
          <button
            key={titel.id ?? `new-${i}`}
            onClick={() => onSwitch(i)}
            className={`group relative flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-t-md transition-colors max-w-[200px] ${
              isActive
                ? 'bg-white text-gray-900 shadow-sm font-medium'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {/* Dirty indicator */}
            {isDirty && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" title="Niet opgeslagen" />
            )}

            {/* Title text */}
            <span className="truncate">{name}</span>

            {/* Druk badge */}
            {druk > 1 && (
              <span className="text-[10px] text-gray-400 shrink-0">{druk}e</span>
            )}

            {/* Close button (only on hover, not for last tab) */}
            {titels.length > 1 && (
              <span
                onClick={e => { e.stopPropagation(); onRemove(i); }}
                className={`shrink-0 p-0.5 rounded hover:bg-red-100 hover:text-red-500 transition-colors ${
                  isActive ? 'opacity-60 hover:opacity-100' : 'opacity-0 group-hover:opacity-60'
                }`}
              >
                <X className="w-3 h-3" />
              </span>
            )}
          </button>
        );
      })}

      {/* Add + Duplicate buttons */}
      <div className="flex items-center gap-0.5 ml-1 shrink-0">
        <button
          onClick={onAdd}
          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
          title="Nieuwe titel"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={onDuplicate}
          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
          title="Dupliceer huidige titel"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
