import type { SensitivityResponse } from '../../api/types';
import { SensitivityTable } from './SensitivityTable';
import { SensitivityChart } from './SensitivityChart';

interface Props {
  cacSens: SensitivityResponse[] | null;
  priceSens: SensitivityResponse[] | null;
}

export function SensitivityPanel({ cacSens, priceSens }: Props) {
  if (!cacSens && !priceSens) {
    return (
      <div className="text-center text-gray-400 py-8 text-sm">
        Vul gegevens in om sensitivity analyse te zien
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* CAC Sensitivity */}
      {cacSens && cacSens.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-gray-700">CAC Sensitivity</h3>
          <p className="text-xs text-gray-500">
            Impact van Customer Acquisition Cost (per exemplaar) op de marge per kanaal.
          </p>
          {cacSens.map((sens, i) => (
            <div key={i} className="space-y-4">
              <SensitivityChart data={sens} variableLabel="CAC /ex" variablePrefix="€" />
              <SensitivityTable data={sens} variableLabel="CAC /ex" variablePrefix="€" />
            </div>
          ))}
        </div>
      )}

      {/* Price Sensitivity */}
      {priceSens && priceSens.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-gray-700">Prijs Sensitivity</h3>
          <p className="text-xs text-gray-500">
            Impact van de verkoopprijs (incl. BTW) op de marge per kanaal.
          </p>
          {priceSens.map((sens, i) => (
            <div key={i} className="space-y-4">
              <SensitivityChart data={sens} variableLabel="Prijs incl. BTW" variablePrefix="€" />
              <SensitivityTable data={sens} variableLabel="Prijs incl. BTW" variablePrefix="€" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
