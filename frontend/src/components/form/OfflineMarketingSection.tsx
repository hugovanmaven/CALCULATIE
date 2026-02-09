import type { TitelInput } from '../../api/types';
import { NumberInput } from './NumberInput';

interface Props {
  titelInput: TitelInput;
  updateField: <K extends keyof TitelInput>(field: K, value: TitelInput[K]) => void;
}

const fields: { key: keyof TitelInput; label: string }[] = [
  { key: 'evenement', label: 'Evenement' },
  { key: 'marketingmateriaal', label: 'Marketingmateriaal' },
  { key: 'offline_campagne', label: 'Offline campagne' },
  { key: 'boekhandelsmateriaal', label: 'Boekhandelsmateriaal' },
  { key: 'marketing_fee', label: 'Marketing fee' },
  { key: 'overige_offline_marketing', label: 'Overige offline' },
];

export function OfflineMarketingSection({ titelInput, updateField }: Props) {
  const subtotal = fields.reduce((sum, f) => sum + (titelInput[f.key] as number), 0);

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400">Eenmalige kosten — vervallen bij herdruk</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {fields.map(f => (
          <NumberInput
            key={f.key}
            label={f.label}
            value={titelInput[f.key] as number}
            onChange={v => updateField(f.key, v)}
            prefix="€"
            step={100}
          />
        ))}
      </div>
      <div className="flex justify-between items-center border-t border-gray-200 pt-2 mt-2">
        <span className="text-xs font-semibold text-gray-600 uppercase">Subtotaal</span>
        <span className="text-sm font-semibold text-gray-800">
          € {subtotal.toLocaleString('nl-NL', { minimumFractionDigits: 0 })}
        </span>
      </div>
    </div>
  );
}
