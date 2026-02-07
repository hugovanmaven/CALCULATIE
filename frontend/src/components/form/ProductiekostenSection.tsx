import type { TitelInput } from '../../api/types';
import { NumberInput } from './NumberInput';

interface Props {
  titelInput: TitelInput;
  updateField: <K extends keyof TitelInput>(field: K, value: TitelInput[K]) => void;
}

const fields: { key: keyof TitelInput; label: string }[] = [
  { key: 'vormgeving_omslag', label: 'Vormgeving omslag' },
  { key: 'vormgeving_binnenwerk', label: 'Vormgeving binnenwerk' },
  { key: 'dtp', label: 'DTP' },
  { key: 'persklaarmaken', label: 'Persklaarmaken' },
  { key: 'correctie', label: 'Correctie' },
  { key: 'freelance_redactie', label: 'Freelance redactie' },
  { key: 'ebook_productie', label: 'E-book productie' },
  { key: 'audiobook_productie', label: 'Audiobook productie' },
  { key: 'overige_productie', label: 'Overige productie' },
];

export function ProductiekostenSection({ titelInput, updateField }: Props) {
  const subtotal = fields.reduce((sum, f) => sum + (titelInput[f.key] as number), 0);

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400">Eenmalige kosten — vervallen bij herdruk</p>
      <div className="grid grid-cols-2 gap-2">
        {fields.map(f => (
          <NumberInput
            key={f.key}
            label={f.label}
            value={titelInput[f.key] as number}
            onChange={v => updateField(f.key, v)}
            prefix="€"
            step={10}
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
