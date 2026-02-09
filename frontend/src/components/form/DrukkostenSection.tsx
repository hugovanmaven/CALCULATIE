import type { TitelInput } from '../../api/types';
import { NumberInput } from './NumberInput';

interface Props {
  titelInput: TitelInput;
  updateField: <K extends keyof TitelInput>(field: K, value: TitelInput[K]) => void;
}

export function DrukkostenSection({ titelInput, updateField }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <NumberInput
        label="Drukkosten /ex (1e druk)"
        value={titelInput.drukkosten_1e_druk}
        onChange={v => updateField('drukkosten_1e_druk', v)}
        prefix="€"
        help="Per exemplaar"
      />
      <NumberInput
        label="Drukkosten /ex (herdruk)"
        value={titelInput.drukkosten_herdruk}
        onChange={v => updateField('drukkosten_herdruk', v)}
        prefix="€"
        help="Vaak anders bij kleinere oplage"
      />
    </div>
  );
}
