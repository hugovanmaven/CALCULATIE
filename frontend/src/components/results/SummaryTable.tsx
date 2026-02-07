import type { CalculateResponse } from '../../api/types';

function margeColor(pct: number): string {
  if (pct >= 0.25) return 'bg-green-100 text-green-800';
  if (pct >= 0.15) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}

function fmt(n: number): string {
  return `€${n.toFixed(2)}`;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

interface Props {
  results: CalculateResponse;
}

export function SummaryTable({ results }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-gray-300">
            <th className="text-left py-2 pr-4 font-semibold text-gray-600">Druk</th>
            <th className="text-center px-2 font-semibold text-gray-600" colSpan={2}>Webshop</th>
            <th className="text-center px-2 font-semibold text-gray-600" colSpan={2}>Retail / CB</th>
            <th className="text-center px-2 font-semibold text-gray-600" colSpan={2}>B2B</th>
            <th className="text-center px-2 font-semibold text-gray-600" colSpan={2}>Gewogen</th>
          </tr>
          <tr className="border-b border-gray-200 text-xs text-gray-400">
            <th></th>
            <th className="px-2 py-1 font-normal">€/ex</th>
            <th className="px-2 py-1 font-normal">Marge</th>
            <th className="px-2 py-1 font-normal">€/ex</th>
            <th className="px-2 py-1 font-normal">Marge</th>
            <th className="px-2 py-1 font-normal">€/ex</th>
            <th className="px-2 py-1 font-normal">Marge</th>
            <th className="px-2 py-1 font-normal">€/ex</th>
            <th className="px-2 py-1 font-normal">Marge</th>
          </tr>
        </thead>
        <tbody>
          {results.drukken.map((druk) => (
            <tr key={druk.druk_type} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2 pr-4 font-medium text-gray-700">
                <div>{druk.druk_type}</div>
                <div className="text-xs text-gray-400">{druk.oplage.toLocaleString()} ex.</div>
              </td>
              <td className="px-2 text-center font-mono text-sm">{fmt(druk.webshop.netto_winst_maven)}</td>
              <td className="px-2 text-center">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${margeColor(druk.webshop.marge_pct)}`}>
                  {pct(druk.webshop.marge_pct)}
                </span>
              </td>
              <td className="px-2 text-center font-mono text-sm">{fmt(druk.retail.netto_winst_maven)}</td>
              <td className="px-2 text-center">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${margeColor(druk.retail.marge_pct)}`}>
                  {pct(druk.retail.marge_pct)}
                </span>
              </td>
              <td className="px-2 text-center font-mono text-sm">{fmt(druk.b2b.netto_winst_maven)}</td>
              <td className="px-2 text-center">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${margeColor(druk.b2b.marge_pct)}`}>
                  {pct(druk.b2b.marge_pct)}
                </span>
              </td>
              <td className="px-2 text-center font-mono text-sm font-bold">{fmt(druk.gewogen_netto_winst)}</td>
              <td className="px-2 text-center">
                <span className={`inline-block px-3 py-0.5 rounded text-xs font-bold ${margeColor(druk.gewogen_marge_pct)}`}>
                  {pct(druk.gewogen_marge_pct)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
