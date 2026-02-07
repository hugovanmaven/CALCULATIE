import type { CalculateResponse } from '../../api/types';

interface Props {
  results: CalculateResponse;
}

export function EenmaligOverzicht({ results }: Props) {
  const lines = [
    { label: 'Productiekosten', value: results.totaal_productie },
    { label: 'Offline marketing', value: results.totaal_offline_marketing },
    { label: 'Online marketing', value: results.totaal_online_marketing },
    { label: 'Drukkosten 1e druk (totaal)', value: results.drukkosten_totaal_1e },
  ];

  const totaal = lines.reduce((sum, l) => sum + l.value, 0);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-600 mb-3">Eenmalige kosten overzicht</h3>
      <div className="space-y-1">
        {lines.map((line) => (
          <div key={line.label} className="flex justify-between text-sm">
            <span className="text-gray-600">{line.label}</span>
            <span className="font-mono text-gray-800">€{line.value.toFixed(2)}</span>
          </div>
        ))}
        <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-1 mt-1">
          <span className="text-gray-700">Totaal eenmalig</span>
          <span className="font-mono text-gray-900">€{totaal.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
