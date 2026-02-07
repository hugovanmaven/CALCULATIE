import type { TitelInput } from '../../api/types';
import { NumberInput } from './NumberInput';

interface Props {
  titelInput: TitelInput;
  updateField: <K extends keyof TitelInput>(field: K, value: TitelInput[K]) => void;
}

export function B2bKostenSection({ titelInput, updateField }: Props) {
  return (
    <div className="space-y-3">
      <NumberInput
        label="Porto per ex"
        value={titelInput.b2b_porto_per_ex}
        onChange={v => updateField('b2b_porto_per_ex', v)}
        prefix="€"
      />
      <NumberInput
        label="B2B korting"
        value={titelInput.b2b_korting_pct * 100}
        onChange={v => updateField('b2b_korting_pct', v / 100)}
        suffix="%"
        step={1}
        help="Korting die Maven biedt aan B2B klanten"
      />
    </div>
  );
}
