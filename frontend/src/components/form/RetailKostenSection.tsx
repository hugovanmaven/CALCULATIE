import type { TitelInput } from '../../api/types';
import { NumberInput } from './NumberInput';

interface Props {
  titelInput: TitelInput;
  updateField: <K extends keyof TitelInput>(field: K, value: TitelInput[K]) => void;
}

export function RetailKostenSection({ titelInput, updateField }: Props) {
  return (
    <div className="space-y-3">
      <NumberInput
        label="Distributie CB per ex"
        value={titelInput.distributie_cb_per_ex}
        onChange={v => updateField('distributie_cb_per_ex', v)}
        prefix="€"
        help="CB logistiek + distributie per exemplaar"
      />
      <p className="text-xs text-gray-400">
        Boekhandelskorting ({(titelInput.boekhandelskorting * 100).toFixed(0)}%) is ingesteld bij Basisgegevens
      </p>
    </div>
  );
}
