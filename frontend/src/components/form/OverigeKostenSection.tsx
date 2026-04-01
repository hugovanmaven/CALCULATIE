import type { TitelInput, OverigeKostenItem } from '../../api/types';
import { NumberInput } from './NumberInput';
import { Plus, Trash2 } from 'lucide-react';

interface Props {
  titelInput: TitelInput;
  updateField: <K extends keyof TitelInput>(field: K, value: TitelInput[K]) => void;
}

export function OverigeKostenSection({ titelInput, updateField }: Props) {
  const items = titelInput.overige_kosten_items ?? [];

  const addItem = () => {
    const newItem: OverigeKostenItem = {
      id: `ok_${Date.now()}`,
      naam: '',
      type: 'bedrag',
      waarde: 0,
    };
    updateField('overige_kosten_items', [...items, newItem]);
  };

  const updateItem = (idx: number, updated: OverigeKostenItem) => {
    const next = [...items];
    next[idx] = updated;
    updateField('overige_kosten_items', next);
  };

  const removeItem = (idx: number) => {
    updateField('overige_kosten_items', items.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      {/* Legacy % field — keep for backwards compat but show only if nonzero and no items */}
      {titelInput.overige_kosten_pct > 0 && items.length === 0 && (
        <NumberInput
          label="Overige kosten (oud)"
          value={titelInput.overige_kosten_pct * 100}
          onChange={v => updateField('overige_kosten_pct', v / 100)}
          suffix="%"
          step={0.5}
          help="% van netto omzet — migreer naar items hieronder"
        />
      )}

      {items.map((item, i) => (
        <div key={item.id} className="flex items-end gap-2 p-2 bg-gray-50 rounded border border-gray-200">
          <div className="flex-1">
            <input
              type="text"
              value={item.naam}
              onChange={e => updateItem(i, { ...item, naam: e.target.value })}
              placeholder="Omschrijving"
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <select
            value={item.type}
            onChange={e => updateItem(i, { ...item, type: e.target.value as 'bedrag' | 'percentage' })}
            className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
          >
            <option value="bedrag">Bedrag</option>
            <option value="percentage">%</option>
          </select>
          <div className="w-24">
            <NumberInput
              label=""
              value={item.type === 'percentage' ? item.waarde * 100 : item.waarde}
              onChange={v => updateItem(i, { ...item, waarde: item.type === 'percentage' ? v / 100 : v })}
              prefix={item.type === 'bedrag' ? '\u20ac' : undefined}
              suffix={item.type === 'percentage' ? '%' : undefined}
              step={item.type === 'bedrag' ? 10 : 0.5}
            />
          </div>
          <button
            onClick={() => removeItem(i)}
            className="p-1 text-gray-400 hover:text-red-500 transition-colors mb-0.5"
            title="Verwijderen"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      <button
        onClick={addItem}
        className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
      >
        <Plus size={14} />
        Kostenpost toevoegen
      </button>
    </div>
  );
}
