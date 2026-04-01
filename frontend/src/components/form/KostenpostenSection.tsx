import { useState } from 'react';
import type { TitelInput, KostenPost, DrukConfig } from '../../api/types';
import { DEFAULT_KOSTENPOSTEN } from '../../api/types';
import { NumberInput } from './NumberInput';

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
}[] = [
  { key: 'productie', label: 'Productie', color: 'bg-blue-50 border-blue-200' },
  { key: 'offline_marketing', label: 'Offline marketing', color: 'bg-amber-50 border-amber-200' },
  { key: 'online_marketing', label: 'Online marketing', color: 'bg-green-50 border-green-200' },
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
      <span className="text-sm text-[var(--text-secondary)] flex-1 min-w-0">{kp.naam}</span>

      <select
        value={kp.type}
        onChange={e => onTypeChange(e.target.value as 'eenmalig' | 'terugkerend')}
        className="text-xs border border-[var(--border)] rounded px-1.5 py-1 bg-[var(--bg-secondary)] text-[var(--text-tertiary)] outline-none shrink-0"
      >
        <option value="eenmalig">Eenmalig</option>
        <option value="terugkerend">Terugkerend</option>
      </select>

      <div className="flex items-center shrink-0">
        <span className="inline-flex items-center px-1.5 py-1 text-xs text-[var(--text-tertiary)] bg-[var(--bg-hover)] border border-r-0 border-[var(--border)] rounded-l">
          &euro;
        </span>
        <input
          type="number"
          value={kp.bedrag || ''}
          onChange={e => onBedragChange(parseFloat(e.target.value) || 0)}
          step={10}
          min={0}
          className="w-20 px-2 py-1 text-sm border border-[var(--border)] rounded-r outline-none text-right bg-[var(--bg-secondary)]"
          placeholder="0"
        />
      </div>

      {isCustom && onRemove ? (
        <button
          onClick={onRemove}
          className="text-[var(--text-tertiary)] hover:text-red-500 transition-colors shrink-0 w-5 text-center"
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
      <h4 className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wide mb-1">{label}</h4>
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
      <div className="flex justify-between items-center border-t border-gray-300/40 pt-2 mt-2">
        <span className="text-xs font-semibold text-[var(--text-tertiary)] uppercase">Subtotaal</span>
        <span className="text-sm font-semibold text-[var(--text-primary)] font-mono">
          &euro; {subtotal.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </span>
      </div>
    </div>
  );
}

/* ───── Per-druk kostenposten block ───── */

function DrukKostenBlock({
  druk,
  onDrukChange,
  isFirst,
}: {
  druk: DrukConfig;
  onDrukChange: (updated: DrukConfig) => void;
  isFirst: boolean;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newNaam, setNewNaam] = useState('');
  const [newCategorie, setNewCategorie] = useState<KostenPost['categorie']>('productie');

  const kostenposten = druk.kostenposten ?? [...DEFAULT_KOSTENPOSTEN];

  const updateKostenposten = (newList: KostenPost[]) => {
    onDrukChange({ ...druk, kostenposten: newList });
  };

  const handleBedragChange = (id: string, bedrag: number) => {
    updateKostenposten(kostenposten.map(kp => (kp.id === id ? { ...kp, bedrag } : kp)));
  };

  const handleTypeChange = (id: string, type: 'eenmalig' | 'terugkerend') => {
    updateKostenposten(kostenposten.map(kp => (kp.id === id ? { ...kp, type } : kp)));
  };

  const handleRemove = (id: string) => {
    updateKostenposten(kostenposten.filter(kp => kp.id !== id));
  };

  const handleAddCustom = () => {
    if (!newNaam.trim()) return;
    updateKostenposten([...kostenposten, {
      id: generateId(),
      naam: newNaam.trim(),
      categorie: newCategorie,
      type: 'eenmalig',
      bedrag: 0,
    }]);
    setNewNaam('');
    setShowAddForm(false);
  };

  const totaalEenmalig = kostenposten.filter(kp => kp.type === 'eenmalig').reduce((s, kp) => s + kp.bedrag, 0);
  const totaalTerugkerend = kostenposten.filter(kp => kp.type === 'terugkerend').reduce((s, kp) => s + kp.bedrag, 0);

  return (
    <div className={`space-y-3 p-3 rounded-xl border ${isFirst ? 'bg-[var(--accent-light)] border-[var(--accent)]/20' : 'bg-[var(--bg-primary)] border-[var(--border)]'}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">
          {druk.druknummer}e druk — {druk.oplage.toLocaleString('nl-NL')} ex
        </h4>
      </div>

      {/* Drukkosten per ex */}
      <NumberInput
        label="Drukkosten per exemplaar"
        value={druk.drukkosten_per_ex}
        onChange={v => onDrukChange({ ...druk, drukkosten_per_ex: v })}
        prefix="&euro;"
        step={0.1}
        help="Kosten per gedrukt exemplaar"
      />

      {/* Categorie groepen */}
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

      {/* Add custom */}
      {!showAddForm ? (
        <button
          onClick={() => setShowAddForm(true)}
          className="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium flex items-center gap-1 transition-colors"
        >
          <span className="text-base leading-none">+</span> Kostenpost toevoegen
        </button>
      ) : (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)]">
          <div className="flex-1">
            <label className="block text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1">Naam</label>
            <input
              type="text"
              value={newNaam}
              onChange={e => setNewNaam(e.target.value)}
              placeholder="bijv. Vertaalkosten"
              className="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded outline-none bg-[var(--bg-primary)]"
              onKeyDown={e => e.key === 'Enter' && handleAddCustom()}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1">Categorie</label>
            <select
              value={newCategorie}
              onChange={e => setNewCategorie(e.target.value as KostenPost['categorie'])}
              className="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded outline-none bg-[var(--bg-primary)]"
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
              className="px-3 py-1.5 text-sm font-medium text-white bg-[var(--accent)] rounded hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-colors"
            >
              Toevoegen
            </button>
            <button
              onClick={() => { setShowAddForm(false); setNewNaam(''); }}
              className="px-3 py-1.5 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Annuleren
            </button>
          </div>
        </div>
      )}

      {/* Totals */}
      <div className="bg-[var(--bg-secondary)] rounded-lg p-3 border border-[var(--border)]">
        <div className="flex justify-between text-xs text-[var(--text-tertiary)] mb-1">
          <span>Eenmalig totaal</span>
          <span className="font-mono">&euro; {totaalEenmalig.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
        </div>
        <div className="flex justify-between text-xs text-[var(--text-tertiary)] mb-1">
          <span>Terugkerend totaal</span>
          <span className="font-mono">&euro; {totaalTerugkerend.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
        </div>
        <div className="flex justify-between text-sm font-bold text-[var(--text-primary)] border-t border-[var(--border)] pt-1 mt-1">
          <span>Totaal alle kosten</span>
          <span className="font-mono">&euro; {(totaalEenmalig + totaalTerugkerend).toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
        </div>
      </div>
    </div>
  );
}

/* ───── main component ───── */

export function KostenpostenSection({ titelInput, updateField }: Props) {
  const drukken = titelInput.drukken ?? [];

  const updateDruk = (idx: number, updated: DrukConfig) => {
    const next = drukken.map((d, i) => i === idx ? updated : d);
    updateField('drukken', next);
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--text-tertiary)]">
        Elke druk heeft eigen kosten. Selecteer per post of deze <strong>eenmalig</strong> (alleen deze druk) of <strong>terugkerend</strong> (elke druk) is.
      </p>

      {drukken.map((druk, idx) => (
        <DrukKostenBlock
          key={idx}
          druk={druk}
          onDrukChange={updated => updateDruk(idx, updated)}
          isFirst={idx === 0}
        />
      ))}
    </div>
  );
}
