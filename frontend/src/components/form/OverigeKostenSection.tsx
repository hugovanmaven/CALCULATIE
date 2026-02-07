import type { TitelInput } from '../../api/types';
import { NumberInput } from './NumberInput';

interface Props {
  titelInput: TitelInput;
  updateField: <K extends keyof TitelInput>(field: K, value: TitelInput[K]) => void;
}

export function OverigeKostenSection({ titelInput, updateField }: Props) {
  return (
    <NumberInput
      label="Overige kosten"
      value={titelInput.overige_kosten_pct * 100}
      onChange={v => updateField('overige_kosten_pct', v / 100)}
      suffix="%"
      step={0.5}
      help="% van netto omzet per kanaal"
    />
  );
}
