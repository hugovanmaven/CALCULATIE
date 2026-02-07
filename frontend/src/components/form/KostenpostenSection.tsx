import { useState, useRef } from 'react';
import type { TitelInput, KostenPost } from '../../api/types';

interface Props {
  titelInput: TitelInput;
  updateField: <K extends keyof TitelInput>(field: K, value: TitelInput[K]) => void;
}

/* ───── helpers ───── */

function generateId(): string {
  return 'custom_' + Math.random().toString(36).slice(2, 9);
}

const CATEGORIE_LABELS: Record<string, string> = {
  productie: 'Productie',
  offline_marketing: 'Offline marketing',
  online_marketing: 'Online marketing',
};

const CATEGORIE_COLORS: Record<string, string> = {
  productie: 'bg-blue-50 border-blue-200 text-blue-700',
  offline_marketing: 'bg-amber-50 border-amber-200 text-amber-700',
  online_marketing: 'bg-green-50 border-green-200 text-green-700',
};

/* ───── sub-components ───── */

function KostenPostCard({
  kp,
  onBedragChange,
  onRemove,
  isCustom,
  dragHandlers,
}: {
  kp: KostenPost;
  onBedragChange: (bedrag: number) => void;
  onRemove?: () => void;
  isCustom: boolean;
  dragHandlers: {
    onDragStart: (e: React.DragEvent) => void;
    onDragEnd: (e: React.DragEvent) => void;
  };
}) {
  return (
    <div
      draggable
      onDragStart={dragHandlers.onDragStart}
      onDragEnd={dragHandlers.onDragEnd}
      className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow group"
    >
      {/* drag handle */}
      <span className="text-gray-300 group-hover:text-gray-500 shrink-0 select-none" title="Sleep naar andere kolom">
        ⠿
      </span>

      {/* categorie badge */}
      <span
        className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border shrink-0 ${
          CATEGORIE_COLORS[kp.categorie] ?? 'bg-gray-50 border-gray-200 text-gray-600'
        }`}
      >
        {kp.categorie === 'productie' ? 'P' : kp.categorie === 'offline_marketing' ? 'OF' : 'ON'}
      </span>

      {/* naam */}
      <span className="text-sm text-gray-700 truncate flex-1 min-w-0">{kp.naam}</span>

      {/* bedrag input */}
      <div className="flex items-center shrink-0">
        <span className="inline-flex items-center px-1.5 py-1 text-xs text-gray-500 bg-gray-100 border border-r-0 border-gray-300 rounded-l">
          &euro;
        </span>
        <input
          type="number"
          value={kp.bedrag || ''}
          onChange={e => onBedragChange(parseFloat(e.target.value) || 0)}
          step={10}
          min={0}
          className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-r focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-right"
          placeholder="0"
        />
      </div>

      {/* remove button (custom only) */}
      {isCustom && onRemove && (
        <button
          onClick={onRemove}
          className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
          title="Verwijderen"
        >
          &times;
        </button>
      )}
    </div>
  );
}

function DropColumn({
  title,
  subtitle,
  type,
  items,
  onBedragChange,
  onRemove,
  onDragStart,
  onDragEnd,
  onDrop,
  isDragOver,
  onDragOver,
  onDragLeave,
}: {
  title: string;
  subtitle: string;
  type: 'eenmalig' | 'terugkerend';
  items: KostenPost[];
  onBedragChange: (id: string, bedrag: number) => void;
  onRemove: (id: string) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, targetType: 'eenmalig' | 'terugkerend') => void;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
}) {
  const subtotal = items.reduce((sum, kp) => sum + kp.bedrag, 0);

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={e => onDrop(e, type)}
      className={`rounded-lg border-2 border-dashed p-3 transition-colors min-h-[120px] ${
        isDragOver
          ? 'border-blue-400 bg-blue-50/50'
          : 'border-gray-200 bg-gray-50/30'
      }`}
    >
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wide">{title}</h4>
        <span className="text-[10px] text-gray-400">{subtitle}</span>
      </div>

      <div className="space-y-1.5">
        {items.length === 0 && (
          <p className="text-xs text-gray-400 italic py-4 text-center">
            Sleep kostenposten hierheen
          </p>
        )}
        {items.map(kp => (
          <KostenPostCard
            key={kp.id}
            kp={kp}
            onBedragChange={bedrag => onBedragChange(kp.id, bedrag)}
            onRemove={kp.id.startsWith('custom_') ? () => onRemove(kp.id) : undefined}
            isCustom={kp.id.startsWith('custom_')}
            dragHandlers={{
              onDragStart: e => onDragStart(e, kp.id),
              onDragEnd,
            }}
          />
        ))}
      </div>

      {/* subtotaal */}
      <div className="flex justify-between items-center border-t border-gray-200 pt-2 mt-3">
        <span className="text-xs font-semibold text-gray-500 uppercase">Subtotaal</span>
        <span className="text-sm font-semibold text-gray-800 font-mono">
          &euro; {subtotal.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </span>
      </div>
    </div>
  );
}

/* ───── main component ───── */

export function KostenpostenSection({ titelInput, updateField }: Props) {
  const [dragOverCol, setDragOverCol] = useState<'eenmalig' | 'terugkerend' | null>(null);
  const dragItemId = useRef<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newNaam, setNewNaam] = useState('');
  const [newCategorie, setNewCategorie] = useState<KostenPost['categorie']>('productie');

  const kostenposten = titelInput.kostenposten;
  const eenmalig = kostenposten.filter(kp => kp.type === 'eenmalig');
  const terugkerend = kostenposten.filter(kp => kp.type === 'terugkerend');

  /* --- update helpers --- */
  const updateKostenposten = (newList: KostenPost[]) => {
    updateField('kostenposten', newList);
  };

  const handleBedragChange = (id: string, bedrag: number) => {
    updateKostenposten(
      kostenposten.map(kp => (kp.id === id ? { ...kp, bedrag } : kp))
    );
  };

  const handleRemove = (id: string) => {
    updateKostenposten(kostenposten.filter(kp => kp.id !== id));
  };

  /* --- drag & drop --- */
  const handleDragStart = (e: React.DragEvent, id: string) => {
    dragItemId.current = id;
    e.dataTransfer.effectAllowed = 'move';
    // Make the drag image slightly transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    dragItemId.current = null;
    setDragOverCol(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  const handleDragOver = (e: React.DragEvent, col: 'eenmalig' | 'terugkerend') => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(col);
  };

  const handleDragLeave = (_e: React.DragEvent) => {
    setDragOverCol(null);
  };

  const handleDrop = (_e: React.DragEvent, targetType: 'eenmalig' | 'terugkerend') => {
    _e.preventDefault();
    setDragOverCol(null);
    const id = dragItemId.current;
    if (!id) return;

    updateKostenposten(
      kostenposten.map(kp =>
        kp.id === id ? { ...kp, type: targetType } : kp
      )
    );
    dragItemId.current = null;
  };

  /* --- add custom --- */
  const handleAddCustom = () => {
    if (!newNaam.trim()) return;
    const newKp: KostenPost = {
      id: generateId(),
      naam: newNaam.trim(),
      categorie: newCategorie,
      type: 'eenmalig',
      bedrag: 0,
    };
    updateKostenposten([...kostenposten, newKp]);
    setNewNaam('');
    setShowAddForm(false);
  };

  /* --- totals --- */
  const totaalEenmalig = eenmalig.reduce((s, kp) => s + kp.bedrag, 0);
  const totaalTerugkerend = terugkerend.reduce((s, kp) => s + kp.bedrag, 0);
  const totaalAlles = totaalEenmalig + totaalTerugkerend;

  return (
    <div className="space-y-3">
      {/* uitleg */}
      <p className="text-xs text-gray-400">
        Sleep kostenposten tussen de kolommen om aan te geven of ze <strong>eenmalig</strong> (alleen 1e druk) of <strong>terugkerend</strong> (elke druk) zijn.
      </p>

      {/* legend */}
      <div className="flex gap-3 flex-wrap">
        {Object.entries(CATEGORIE_LABELS).map(([key, label]) => (
          <span
            key={key}
            className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${
              CATEGORIE_COLORS[key]
            }`}
          >
            {label}
          </span>
        ))}
      </div>

      {/* two-column drag & drop */}
      <div className="grid grid-cols-2 gap-3">
        <DropColumn
          title="Eenmalig"
          subtitle="alleen 1e druk"
          type="eenmalig"
          items={eenmalig}
          onBedragChange={handleBedragChange}
          onRemove={handleRemove}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDrop={handleDrop}
          isDragOver={dragOverCol === 'eenmalig'}
          onDragOver={e => handleDragOver(e, 'eenmalig')}
          onDragLeave={handleDragLeave}
        />
        <DropColumn
          title="Terugkerend"
          subtitle="elke druk"
          type="terugkerend"
          items={terugkerend}
          onBedragChange={handleBedragChange}
          onRemove={handleRemove}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDrop={handleDrop}
          isDragOver={dragOverCol === 'terugkerend'}
          onDragOver={e => handleDragOver(e, 'terugkerend')}
          onDragLeave={handleDragLeave}
        />
      </div>

      {/* add custom kostenpost */}
      {!showAddForm ? (
        <button
          onClick={() => setShowAddForm(true)}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 transition-colors"
        >
          <span className="text-base leading-none">+</span> Kostenpost toevoegen
        </button>
      ) : (
        <div className="flex items-end gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Naam
            </label>
            <input
              type="text"
              value={newNaam}
              onChange={e => setNewNaam(e.target.value)}
              placeholder="bijv. Vertaalkosten"
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
              onKeyDown={e => e.key === 'Enter' && handleAddCustom()}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Categorie
            </label>
            <select
              value={newCategorie}
              onChange={e => setNewCategorie(e.target.value as KostenPost['categorie'])}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            >
              <option value="productie">Productie</option>
              <option value="offline_marketing">Offline marketing</option>
              <option value="online_marketing">Online marketing</option>
            </select>
          </div>
          <button
            onClick={handleAddCustom}
            disabled={!newNaam.trim()}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Toevoegen
          </button>
          <button
            onClick={() => { setShowAddForm(false); setNewNaam(''); }}
            className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Annuleren
          </button>
        </div>
      )}

      {/* grand total */}
      <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Eenmalig totaal</span>
          <span className="font-mono">&euro; {totaalEenmalig.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
        </div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Terugkerend totaal</span>
          <span className="font-mono">&euro; {totaalTerugkerend.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
        </div>
        <div className="flex justify-between text-sm font-bold text-gray-800 border-t border-gray-200 pt-1 mt-1">
          <span>Totaal alle kosten</span>
          <span className="font-mono">&euro; {totaalAlles.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
        </div>
      </div>
    </div>
  );
}
