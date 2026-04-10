import { useState } from 'react';
import type { TitelInput, KostenPost, DrukConfig } from '../../api/types';
import { DEFAULT_KOSTENPOSTEN } from '../../api/types';
import { Plus } from 'lucide-react';

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
}[] = [
  { key: 'productie', label: 'Productie' },
  { key: 'offline_marketing', label: 'Offline marketing' },
  { key: 'online_marketing', label: 'Online marketing' },
];

function formatEuro(n: number): string {
  return n.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/* ───── Type pill (Eenmalig ↔ Terugkerend) ───── */

function TypePill({
  type,
  onToggle,
  dimmed,
}: {
  type: 'eenmalig' | 'terugkerend';
  onToggle: () => void;
  dimmed?: boolean;
}) {
  const isEenmalig = type === 'eenmalig';
  return (
    <button
      type="button"
      onClick={onToggle}
      title={`Klik om te wisselen naar ${isEenmalig ? 'terugkerend' : 'eenmalig'}`}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors shrink-0 min-w-[88px] ${dimmed ? 'opacity-60' : ''}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${isEenmalig ? 'bg-[var(--text-tertiary)]' : 'bg-[var(--accent)]'}`}
      />
      {isEenmalig ? 'Eenmalig' : 'Terugkerend'}
    </button>
  );
}

/* ───── Static "per ex" tag (voor drukkosten) ───── */

function PerExTag() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-transparent text-[var(--text-tertiary)] shrink-0 min-w-[88px]">
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)]/50" />
      per exemplaar
    </span>
  );
}

/* ───── Kosten row ───── */

function KostenRij({
  label,
  bedrag,
  onBedragChange,
  trailing,
  isCustom,
  onRemove,
  step = 10,
}: {
  label: string;
  bedrag: number;
  onBedragChange: (bedrag: number) => void;
  trailing: React.ReactNode;
  isCustom?: boolean;
  onRemove?: () => void;
  step?: number;
}) {
  const isEmpty = !bedrag;
  return (
    <div
      className={`flex items-center gap-2 py-1.5 transition-opacity ${
        isEmpty ? 'opacity-45 hover:opacity-100 focus-within:opacity-100' : ''
      }`}
    >
      <span className="text-sm text-[var(--text-primary)] flex-1 min-w-0 leading-tight break-words">{label}</span>

      <div className="flex items-center shrink-0">
        <span className="inline-flex items-center px-2 py-1 text-xs text-[var(--text-tertiary)] bg-[var(--bg-secondary)] border border-r-0 border-[var(--border)] rounded-l-lg">
          &euro;
        </span>
        <input
          type="number"
          value={bedrag || ''}
          onChange={e => onBedragChange(parseFloat(e.target.value) || 0)}
          step={step}
          min={0}
          className="w-[72px] px-2 py-1 text-sm border border-[var(--border)] rounded-r-lg bg-[var(--bg-primary)] text-[var(--text-primary)] text-right tabular-nums focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] outline-none"
          placeholder="0"
        />
      </div>

      {trailing}

      {isCustom && onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="text-[var(--text-tertiary)] hover:text-red-500 transition-colors shrink-0 w-4 text-center leading-none"
          title="Verwijderen"
        >
          &times;
        </button>
      ) : (
        <span className="w-4 shrink-0" />
      )}
    </div>
  );
}

/* ───── Categorie group ───── */

function CategorieGroep({
  label,
  items,
  subtotal,
  onBedragChange,
  onTypeChange,
  onRemove,
  onAddClick,
  isAdding,
  children: leadingRow,
}: {
  label: string;
  items: KostenPost[];
  subtotal: number;
  onBedragChange: (id: string, bedrag: number) => void;
  onTypeChange: (id: string, type: 'eenmalig' | 'terugkerend') => void;
  onRemove: (id: string) => void;
  onAddClick: () => void;
  isAdding: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
          {label}
        </h4>
        <span className="text-xs text-[var(--text-tertiary)] tabular-nums">
          &euro; {formatEuro(subtotal)}
        </span>
      </div>

      {leadingRow}

      {items.map(kp => (
        <KostenRij
          key={kp.id}
          label={kp.naam}
          bedrag={kp.bedrag}
          onBedragChange={b => onBedragChange(kp.id, b)}
          trailing={
            <TypePill
              type={kp.type}
              onToggle={() =>
                onTypeChange(kp.id, kp.type === 'eenmalig' ? 'terugkerend' : 'eenmalig')
              }
              dimmed={!kp.bedrag}
            />
          }
          isCustom={kp.id.startsWith('custom_')}
          onRemove={() => onRemove(kp.id)}
        />
      ))}

      {!isAdding && (
        <button
          type="button"
          onClick={onAddClick}
          className="flex items-center gap-1.5 text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium mt-1 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Kostenpost toevoegen
        </button>
      )}
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
  const [addingTo, setAddingTo] = useState<KostenPost['categorie'] | null>(null);
  const [newNaam, setNewNaam] = useState('');

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
    if (!newNaam.trim() || !addingTo) return;
    updateKostenposten([
      ...kostenposten,
      {
        id: generateId(),
        naam: newNaam.trim(),
        categorie: addingTo,
        type: 'eenmalig',
        bedrag: 0,
      },
    ]);
    setNewNaam('');
    setAddingTo(null);
  };

  const cancelAdd = () => {
    setNewNaam('');
    setAddingTo(null);
  };

  const totaalEenmalig = kostenposten
    .filter(kp => kp.type === 'eenmalig')
    .reduce((s, kp) => s + kp.bedrag, 0);
  const totaalTerugkerend = kostenposten
    .filter(kp => kp.type === 'terugkerend')
    .reduce((s, kp) => s + kp.bedrag, 0);
  const totaal = totaalEenmalig + totaalTerugkerend;

  return (
    <div
      className={`space-y-3 p-4 rounded-xl border ${
        isFirst
          ? 'bg-[var(--accent-light)] border-[var(--accent)]/20'
          : 'bg-[var(--bg-primary)] border-[var(--border)]'
      }`}
    >
      <h4 className="text-sm font-semibold text-[var(--text-primary)]">
        {druk.druknummer}e druk — {druk.oplage.toLocaleString('nl-NL')} ex
      </h4>

      {CATEGORIE_CONFIG.map((cat, idx) => {
        const items = kostenposten.filter(kp => kp.categorie === cat.key);
        const subtotal = items.reduce((sum, kp) => sum + kp.bedrag, 0);

        // Merge drukkosten into the productie group as a leading row
        const leadingRow =
          cat.key === 'productie' ? (
            <KostenRij
              label="Drukkosten"
              bedrag={druk.drukkosten_per_ex}
              onBedragChange={v => onDrukChange({ ...druk, drukkosten_per_ex: v })}
              step={0.1}
              trailing={<PerExTag />}
            />
          ) : null;

        // Include drukkosten in subtotal for productie
        const displaySubtotal =
          cat.key === 'productie' ? subtotal + druk.drukkosten_per_ex * druk.oplage : subtotal;

        return (
          <div key={cat.key}>
            {idx > 0 && <div className="h-px bg-[var(--border)] my-3" />}
            <CategorieGroep
              label={cat.label}
              items={items}
              subtotal={displaySubtotal}
              onBedragChange={handleBedragChange}
              onTypeChange={handleTypeChange}
              onRemove={handleRemove}
              onAddClick={() => setAddingTo(cat.key)}
              isAdding={addingTo === cat.key}
            >
              {leadingRow}
            </CategorieGroep>

            {/* Inline add form for this category */}
            {addingTo === cat.key && (
              <div className="flex items-center gap-2 mt-2 p-2 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)]">
                <input
                  type="text"
                  value={newNaam}
                  onChange={e => setNewNaam(e.target.value)}
                  placeholder="Naam kostenpost"
                  className="flex-1 min-w-0 px-2 py-1 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] outline-none"
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAddCustom();
                    if (e.key === 'Escape') cancelAdd();
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleAddCustom}
                  disabled={!newNaam.trim()}
                  className="px-2.5 py-1 text-xs font-medium text-white bg-[var(--accent)] rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-colors"
                >
                  Toevoegen
                </button>
                <button
                  type="button"
                  onClick={cancelAdd}
                  className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  Annuleren
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Divider before totals */}
      <div className="h-px bg-[var(--border)]" />

      {/* Totals */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-[var(--text-tertiary)]">
          <span>Eenmalig totaal</span>
          <span className="tabular-nums">&euro; {formatEuro(totaalEenmalig)}</span>
        </div>
        <div className="flex justify-between text-xs text-[var(--text-tertiary)]">
          <span>Terugkerend totaal</span>
          <span className="tabular-nums">&euro; {formatEuro(totaalTerugkerend)}</span>
        </div>
        <div className="flex justify-between text-sm font-bold text-[var(--text-primary)] pt-1">
          <span>Totaal alle kosten</span>
          <span className="tabular-nums">&euro; {formatEuro(totaal)}</span>
        </div>
      </div>
    </div>
  );
}

/* ───── main component ───── */

export function KostenpostenSection({ titelInput, updateField }: Props) {
  const drukken = titelInput.drukken ?? [];

  const updateDruk = (idx: number, updated: DrukConfig) => {
    const next = drukken.map((d, i) => (i === idx ? updated : d));
    updateField('drukken', next);
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--text-tertiary)]">
        Klik op het <span className="font-medium">eenmalig/terugkerend</span> label om te wisselen.
        Eenmalige kosten tellen alleen bij de 1e druk.
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
