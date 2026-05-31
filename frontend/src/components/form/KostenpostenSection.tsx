import { useState } from 'react';
import type { KostenPost, DrukConfig } from '../../api/types';
import { DEFAULT_KOSTENPOSTEN } from '../../api/types';
import { Plus } from 'lucide-react';

/* ───── helpers ───── */

function generateId(): string {
  return 'custom_' + Math.random().toString(36).slice(2, 9);
}

type CategorieConfig = { key: KostenPost['categorie']; label: string };

const CATEGORIE_CONFIG: CategorieConfig[] = [
  { key: 'productie', label: 'Productie' },
  { key: 'offline_marketing', label: 'Offline marketing' },
  { key: 'online_marketing', label: 'Online marketing' },
];

export const PRODUCTIE_CATEGORIES: CategorieConfig[] = [
  { key: 'productie', label: 'Productie' },
];

export const MARKETING_CATEGORIES: CategorieConfig[] = [
  { key: 'offline_marketing', label: 'Offline' },
  { key: 'online_marketing', label: 'Online' },
];

function formatEuro(n: number): string {
  return n.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/* ───── Kosten row (2-row: label above, input below) ───── */

function KostenRij({
  label,
  bedrag,
  onBedragChange,
  isCustom,
  onRemove,
  step = 10,
  suffix,
}: {
  label: string;
  bedrag: number;
  onBedragChange: (bedrag: number) => void;
  isCustom?: boolean;
  onRemove?: () => void;
  step?: number;
  suffix?: string;
}) {
  const isEmpty = !bedrag;
  return (
    <div
      className={`py-1.5 transition-opacity ${
        isEmpty ? 'opacity-45 hover:opacity-100 focus-within:opacity-100' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-0.5 gap-2">
        <span className="text-xs text-[var(--text-secondary)] leading-tight break-words min-w-0">
          {label}
        </span>
        {isCustom && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-[var(--text-tertiary)] hover:text-red-500 transition-colors shrink-0 w-4 text-center leading-none text-sm"
            title="Verwijderen"
          >
            &times;
          </button>
        )}
      </div>
      <div className="flex items-center">
        <span className="inline-flex items-center px-2 py-1 text-xs text-[var(--text-tertiary)] bg-[var(--bg-secondary)] border border-r-0 border-[var(--border)] rounded-l-lg">
          &euro;
        </span>
        <input
          type="number"
          value={bedrag || ''}
          onChange={e => onBedragChange(parseFloat(e.target.value) || 0)}
          step={step}
          min={0}
          className={`w-full min-w-0 px-2 py-1 text-sm border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-right tabular-nums focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] outline-none ${
            suffix ? '' : 'rounded-r-lg'
          }`}
          placeholder="0"
        />
        {suffix && (
          <span className="inline-flex items-center px-2 py-1 text-xs text-[var(--text-tertiary)] bg-[var(--bg-secondary)] border border-l-0 border-[var(--border)] rounded-r-lg whitespace-nowrap">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

/* ───── Categorie group ───── */

function CategorieGroep({
  label,
  items,
  subtotal,
  onBedragChange,
  onRemove,
  onAddClick,
  isAdding,
  children: leadingRow,
}: {
  label: string;
  items: KostenPost[];
  subtotal: number;
  onBedragChange: (id: string, bedrag: number) => void;
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

      <div className="grid grid-cols-2 gap-x-3">
        {items.map(kp => (
          <KostenRij
            key={kp.id}
            label={kp.naam}
            bedrag={kp.bedrag}
            onBedragChange={b => onBedragChange(kp.id, b)}
            isCustom={kp.id.startsWith('custom_')}
            onRemove={() => onRemove(kp.id)}
          />
        ))}
      </div>

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

/* ───── Per-druk kostenposten block (zonder eigen wrapper — wordt in Section gerenderd) ───── */

export function DrukKostenBlock({
  druk,
  onDrukChange,
  categorieën = CATEGORIE_CONFIG,
  totaalLabel = 'Totaal kosten deze druk',
}: {
  druk: DrukConfig;
  onDrukChange: (updated: DrukConfig) => void;
  categorieën?: CategorieConfig[];
  totaalLabel?: string;
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

  const shownKeys = new Set(categorieën.map(c => c.key));
  const includesProductie = shownKeys.has('productie');
  const kostenTotaal = kostenposten
    .filter(kp => shownKeys.has(kp.categorie))
    .reduce((s, kp) => s + kp.bedrag, 0);
  const drukkostenTotaal = includesProductie ? druk.drukkosten_per_ex * druk.oplage : 0;
  const totaal = kostenTotaal + drukkostenTotaal;

  return (
    <div className="space-y-3">
      {categorieën.map((cat, idx) => {
        const items = kostenposten.filter(kp => kp.categorie === cat.key);
        const subtotal = items.reduce((sum, kp) => sum + kp.bedrag, 0);

        // Drukkosten-rij wordt vooraan in de productie-categorie getoond.
        // Voor online marketing: CAC per webshop-aankoop (per-ex variabel).
        let leadingRow: React.ReactNode = null;
        if (cat.key === 'productie') {
          leadingRow = (
            <div className="grid grid-cols-2 gap-x-3">
              <KostenRij
                label="Drukkosten per exemplaar"
                bedrag={druk.drukkosten_per_ex}
                onBedragChange={v => onDrukChange({ ...druk, drukkosten_per_ex: v })}
                step={0.1}
                suffix="/ex"
              />
            </div>
          );
        } else if (cat.key === 'online_marketing') {
          leadingRow = (
            <div className="grid grid-cols-2 gap-x-3">
              <KostenRij
                label="CAC per webshop-aankoop"
                bedrag={druk.cac_per_ex ?? 0}
                onBedragChange={v => onDrukChange({ ...druk, cac_per_ex: v })}
                step={0.5}
                suffix="/ex"
              />
            </div>
          );
        }

        const displaySubtotal =
          cat.key === 'productie' ? subtotal + drukkostenTotaal : subtotal;

        return (
          <div key={cat.key}>
            {idx > 0 && <div className="h-px bg-[var(--border)] my-3" />}
            <CategorieGroep
              label={cat.label}
              items={items}
              subtotal={displaySubtotal}
              onBedragChange={handleBedragChange}
              onRemove={handleRemove}
              onAddClick={() => setAddingTo(cat.key)}
              isAdding={addingTo === cat.key}
            >
              {leadingRow}
            </CategorieGroep>

            {/* Inline add form */}
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

      {/* Divider + totaal */}
      <div className="h-px bg-[var(--border)]" />
      <div className="flex justify-between text-sm font-bold text-[var(--text-primary)]">
        <span>{totaalLabel}</span>
        <span className="tabular-nums">&euro; {formatEuro(totaal)}</span>
      </div>
    </div>
  );
}

/* KostenpostenSection (outer wrapper) is verwijderd — drukken worden nu
 * individueel als Section gerenderd in CalculatieForm. Hergebruik
 * DrukKostenBlock voor de inhoud van zo'n Section. */
