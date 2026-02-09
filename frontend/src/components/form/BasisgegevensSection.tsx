import type { TitelInput } from '../../api/types';
import { NumberInput } from './NumberInput';

interface Props {
  titelInput: TitelInput;
  updateField: <K extends keyof TitelInput>(field: K, value: TitelInput[K]) => void;
}

const DRUK_OPTIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function BasisgegevensSection({ titelInput, updateField }: Props) {
  return (
    <div className="space-y-3">
      {/* Titel + ISBN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            ISBN
          </label>
          <input
            type="text"
            value={titelInput.isbn}
            onChange={e => updateField('isbn', e.target.value)}
            placeholder="978-..."
            maxLength={17}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
          />
        </div>
      </div>

      {/* Verschijningsdatum + Verschenen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Verschijningsdatum
          </label>
          <input
            type="date"
            value={titelInput.verschijningsdatum}
            onChange={e => updateField('verschijningsdatum', e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        <div className="flex items-end pb-0.5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={titelInput.verschenen}
              onChange={e => updateField('verschenen', e.target.checked)}
              className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
            />
            <span className="text-sm text-gray-700">Verschenen</span>
            {titelInput.verschenen && (
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
                Gepubliceerd
              </span>
            )}
          </label>
        </div>
      </div>

      {/* Druknummer */}
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
          Druk
        </label>
        <div className="flex gap-1 flex-wrap">
          {DRUK_OPTIES.map(n => (
            <button
              key={n}
              onClick={() => updateField('druknummer', n)}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                titelInput.druknummer === n
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {n}e
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-400">
          {titelInput.druknummer === 1
            ? 'Eerste druk \u2014 alle kosten worden meegenomen'
            : `${titelInput.druknummer}e druk \u2014 eenmalige kosten vervallen`}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <NumberInput
          label="Verkoopprijs incl BTW"
          value={titelInput.verkoopprijs_incl_btw}
          onChange={v => updateField('verkoopprijs_incl_btw', v)}
          prefix="&euro;"
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
