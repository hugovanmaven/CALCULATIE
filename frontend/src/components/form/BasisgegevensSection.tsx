import type { TitelInput } from '../../api/types';
import { NumberInput } from './NumberInput';

interface Props {
  titelInput: TitelInput;
  updateField: <K extends keyof TitelInput>(field: K, value: TitelInput[K]) => void;
}

export function BasisgegevensSection({ titelInput, updateField }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
          Titel
        </label>
        <input
          type="text"
          value={titelInput.titel}
          onChange={e => updateField('titel', e.target.value)}
          placeholder="Bijv. Rechts verpest onze seks"
          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberInput
          label="Verkoopprijs incl BTW"
          value={titelInput.verkoopprijs_incl_btw}
          onChange={v => updateField('verkoopprijs_incl_btw', v)}
          prefix="€"
          step={0.5}
        />
        <NumberInput
          label="BTW %"
          value={titelInput.btw_percentage * 100}
          onChange={v => updateField('btw_percentage', v / 100)}
          suffix="%"
          step={1}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberInput
          label="Boekhandelskorting"
          value={titelInput.boekhandelskorting * 100}
          onChange={v => updateField('boekhandelskorting', v / 100)}
          suffix="%"
          step={1}
          help="Standaard 48%"
        />
        <NumberInput
          label="Oplage 1e druk"
          value={titelInput.oplage_1e_druk}
          onChange={v => updateField('oplage_1e_druk', Math.round(v))}
          step={100}
          min={0}
        />
      </div>
    </div>
  );
}
