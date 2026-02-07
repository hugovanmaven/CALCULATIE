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
        Vul gegevens in om margeverbeteringen te zien
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* CAC — wat als we meer/minder aan klantenwerving uitgeven? */}
      {cacSens && cacSens.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-gray-700">
            Wat als: klantenwerving (CAC)
          </h3>
          <p className="text-xs text-gray-500">
            Hoe verandert de marge als de kosten per klant (webshop) stijgen of dalen?
          </p>
          {cacSens.map((sens, i) => (
            <div key={i} className="space-y-4">
              <SensitivityChart data={sens} variableLabel="CAC /ex" variablePrefix="&euro;" />
              <SensitivityTable data={sens} variableLabel="CAC /ex" variablePrefix="&euro;" />
            </div>
          ))}
        </div>
      )}

      {/* Prijs — wat als we de verkoopprijs aanpassen? */}
      {priceSens && priceSens.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-gray-700">
            Wat als: verkoopprijs
          </h3>
          <p className="text-xs text-gray-500">
            Hoe verandert de marge bij een andere verkoopprijs?
          </p>
          {priceSens.map((sens, i) => (
            <div key={i} className="space-y-4">
              <SensitivityChart data={sens} variableLabel="Prijs incl. BTW" variablePrefix="&euro;" />
              <SensitivityTable data={sens} variableLabel="Prijs incl. BTW" variablePrefix="&euro;" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
