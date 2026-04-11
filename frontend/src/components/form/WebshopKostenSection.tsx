import type { TitelInput } from '../../api/types';
import { NumberInput } from './NumberInput';

interface Props {
  titelInput: TitelInput;
  updateField: <K extends keyof TitelInput>(field: K, value: TitelInput[K]) => void;
}

export function WebshopKostenSection({ titelInput, updateField }: Props) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-3">
      <NumberInput
        label="Fulfillment per ex"
        value={titelInput.fulfillment_per_ex}
        onChange={v => updateField('fulfillment_per_ex', v)}
        prefix="€"
        help="Handling + verzending"
      />
      <NumberInput
        label="Transactiekosten"
        value={titelInput.transactiekosten_pct * 100}
        onChange={v => updateField('transactiekosten_pct', v / 100)}
        suffix="%"
        step={0.5}
        help="% van verkoopprijs incl BTW"
      />
      <NumberInput
        label="CAC per ex"
        value={titelInput.cac_per_ex}
        onChange={v => updateField('cac_per_ex', v)}
        prefix="€"
        help="Customer Acquisition Cost"
      />
    </div>
  );
}
