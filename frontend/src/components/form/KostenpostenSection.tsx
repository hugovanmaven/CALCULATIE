import { useState } from 'react';
import type { TitelInput, KostenPost } from '../../api/types';

interface Props {
  titelInput: TitelInput;
  updateField: <K extends keyof TitelInput>(field: K, value: TitelInput[K]) => void;
}

/* ───── helpers ───── */

function generateId(): string {
  return 'custom_' + Math.random().toString(36).slice(2, 9);
}

const CATEGORIE_CONFIG: {
  key: KostenPost['categorie'];
  label: string;
  color: string;
  borderColor: string;
}[] = [
  {
    key: 'productie',
    label: 'Productie',
    color: 'bg-blue-50 border-blue-200',
    borderColor: 'border-blue-300',
  },
  {
    key: 'offline_marketing',
    label: 'Offline marketing',
    color: 'bg-amber-50 border-amber-200',
    borderColor: 'border-amber-300',
  },
  {
    key: 'online_marketing',
    label: 'Online marketing',
    color: 'bg-green-50 border-green-200',
    borderColor: 'border-green-300',
  },
];

/* ───── sub-components ───── */

function KostenPostRij({
  kp,
  onBedragChange,
  onTypeChange,
  onRemove,
  isCustom,
}: {
  kp: KostenPost;
  onBedragChange: (bedrag: number) => void;
  onTypeChange: (type: 'eenmalig' | 'terugkerend') => void;
  onRemove?: () => void;
  isCustom: boolean;
}) {
  return (
    <div className="flex items-center gap-2 py-1.5 group">
      {/* naam — full width, no truncation */}
      <span className="text-sm text-gray-700 flex-1 min-w-0">{kp.naam}</span>

      {/* type dropdown */}
      <select
        value={kp.type}
        onChange={e => onTypeChange(e.target.value as 'eenmalig' | 'terugkerend')}
        className="text-xs border border-gray-300 rounded px-1.5 py-1 bg-white text-gray-600 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none shrink-0"
      >
        <option value="eenmalig">Eenmalig</option>
        <option value="terugkerend">Terugkerend</option>
      </select>

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
      {isCustom && onRemove ? (
        <button
          onClick={onRemove}
          className="text-gray-300 hover:text-red-500 transition-colors shrink-0 w-5 text-center"
          title="Verwijderen"
        >
          &times;
        </button>
      ) : (
        <span className="w-5 shrink-0" />
      )}
    </div>
  );
}

function CategorieGroep({
  label,
  color,
  items,
  onBedragChange,
  onTypeChange,
  onRemove,
}: {
  label: string;
  color: string;
  items: KostenPost[];
  onBedragChange: (id: string, bedrag: number) => void;
  onTypeChange: (id: string, type: 'eenmalig' | 'terugkerend') => void;
  onRemove: (id: string) => void;
}) {
  const subtotal = items.reduce((sum, kp) => sum + kp.bedrag, 0);

  if (items.length === 0) return null;

  return (
    <div className={`rounded-lg border p-3 ${color}`}>
      <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">{label}</h4>

      <div className="divide-y divide-gray-200/50">
        {items.map(kp => (
          <KostenPostRij
            key={kp.id}
            kp={kp}
            onBedragChange={bedrag => onBedragChange(kp.id, bedrag)}
            onTypeChange={type => onTypeChange(kp.id, type)}
            onRemove={kp.id.startsWith('custom_') ? () => onRemove(kp.id) : undefined}
            isCustom={kp.id.startsWith('custom_')}
          />
        ))}
      </div>

      {/* subtotaal */}
      <div className="flex justify-between items-center border-t border-gray-300/40 pt-2 mt-2">
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
  const [showAddForm, setShowAddForm] = useState(false);
  const [newNaam, setNewNaam] = useState('');
  const [newCategorie, setNewCategorie] = useState<KostenPost['categorie']>('productie');

  const kostenposten = titelInput.kostenposten;

  /* --- update helpers --- */
  const updateKostenposten = (newList: KostenPost[]) => {
    updateField('kostenposten', newList);
  };

  const handleBedragChange = (id: string, bedrag: number) => {
    updateKostenposten(
      kostenposten.map(kp => (kp.id === id ? { ...kp, bedrag } : kp))
    );
  };

  const handleTypeChange = (id: string, type: 'eenmalig' | 'terugkerend') => {
    updateKostenposten(
      kostenposten.map(kp => (kp.id === id ? { ...kp, type } : kp))
    );
  };

  const handleRemove = (id: string) => {
    updateKostenposten(kostenposten.filter(kp => kp.id !== id));
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
  const totaalEenmalig = kostenposten
    .filter(kp => kp.type === 'eenmalig')
    .reduce((s, kp) => s + kp.bedrag, 0);
  const totaalTerugkerend = kostenposten
    .filter(kp => kp.type === 'terugkerend')
    .reduce((s, kp) => s + kp.bedrag, 0);
  const totaalAlles = totaalEenmalig + totaalTerugkerend;

  return (
    <div className="space-y-3">
      {/* uitleg */}
      <p className="text-xs text-gray-400">
        Selecteer per kostenpost of deze <strong>eenmalig</strong> (alleen 1e druk) of <strong>terugkerend</strong> (elke druk) is.
      </p>

      {/* 3 categorie-groepen gestapeld */}
      {CATEGORIE_CONFIG.map(cat => (
        <CategorieGroep
          key={cat.key}
          label={cat.label}
          color={cat.color}
          items={kostenposten.filter(kp => kp.categorie === cat.key)}
          onBedragChange={handleBedragChange}
          onTypeChange={handleTypeChange}
          onRemove={handleRemove}
        />
      ))}

      {/* add custom kostenpost */}
      {!showAddForm ? (
        <button
          onClick={() => setShowAddForm(true)}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 transition-colors"
        >
          <span className="text-base leading-none">+</span> Kostenpost toevoegen
        </button>
      ) : (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
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
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            >
              <option value="productie">Productie</option>
              <option value="offline_marketing">Offline marketing</option>
              <option value="online_marketing">Online marketing</option>
            </select>
          </div>
          <div className="flex gap-2">
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
