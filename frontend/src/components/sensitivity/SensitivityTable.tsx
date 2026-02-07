import type { SensitivityResponse } from '../../api/types';

function margeColor(pct: number): string {
  if (pct >= 0.25) return 'text-green-700';
  if (pct >= 0.15) return 'text-yellow-700';
  return 'text-red-700';
}

interface Props {
  data: SensitivityResponse;
  variableLabel: string;
  variablePrefix?: string;
  variableSuffix?: string;
}

export function SensitivityTable({ data, variableLabel, variablePrefix = '€', variableSuffix = '' }: Props) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-600 mb-2">{data.druk_type}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-1.5 pr-3 font-medium text-gray-500">{variableLabel}</th>
              <th className="px-2 text-center font-medium text-gray-500">WS €</th>
              <th className="px-2 text-center font-medium text-gray-500">WS %</th>
              <th className="px-2 text-center font-medium text-gray-500">RT €</th>
              <th className="px-2 text-center font-medium text-gray-500">RT %</th>
              <th className="px-2 text-center font-medium text-gray-500">B2B €</th>
              <th className="px-2 text-center font-medium text-gray-500">B2B %</th>
              <th className="px-2 text-center font-medium text-gray-500">Gew €</th>
              <th className="px-2 text-center font-medium text-gray-500">Gew %</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-1 pr-3 font-mono font-medium text-gray-700">
                  {variablePrefix}{row.variable_value.toFixed(2)}{variableSuffix}
                </td>
                <td className="px-2 text-center font-mono">€{row.webshop_winst.toFixed(2)}</td>
                <td className={`px-2 text-center font-mono font-medium ${margeColor(row.webshop_marge_pct)}`}>
                  {(row.webshop_marge_pct * 100).toFixed(1)}%
                </td>
                <td className="px-2 text-center font-mono">€{row.retail_winst.toFixed(2)}</td>
                <td className={`px-2 text-center font-mono font-medium ${margeColor(row.retail_marge_pct)}`}>
                  {(row.retail_marge_pct * 100).toFixed(1)}%
                </td>
                <td className="px-2 text-center font-mono">€{row.b2b_winst.toFixed(2)}</td>
                <td className={`px-2 text-center font-mono font-medium ${margeColor(row.b2b_marge_pct)}`}>
                  {(row.b2b_marge_pct * 100).toFixed(1)}%
                </td>
                <td className="px-2 text-center font-mono font-bold">€{row.gewogen_winst.toFixed(2)}</td>
                <td className={`px-2 text-center font-mono font-bold ${margeColor(row.gewogen_marge_pct)}`}>
                  {(row.gewogen_marge_pct * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
