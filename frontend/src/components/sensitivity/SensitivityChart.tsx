import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts';
import type { SensitivityResponse } from '../../api/types';

interface Props {
  data: SensitivityResponse;
  variableLabel: string;
  variablePrefix?: string;
}

export function SensitivityChart({ data, variableLabel, variablePrefix = '€' }: Props) {
  const chartData = data.rows.map((row) => ({
    x: row.variable_value,
    webshop: +(row.webshop_marge_pct * 100).toFixed(1),
    retail: +(row.retail_marge_pct * 100).toFixed(1),
    b2b: +(row.b2b_marge_pct * 100).toFixed(1),
    gewogen: +(row.gewogen_marge_pct * 100).toFixed(1),
  }));

  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-600 mb-2">{data.druk_type}</h4>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 20, left: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="x"
            label={{ value: variableLabel, position: 'insideBottom', offset: -10, fontSize: 12 }}
            tickFormatter={(v) => `${variablePrefix}${v}`}
            fontSize={11}
          />
          <YAxis
            label={{ value: 'Marge %', angle: -90, position: 'insideLeft', fontSize: 12 }}
            tickFormatter={(v) => `${v}%`}
            fontSize={11}
          />
          <Tooltip
            formatter={(v, name) => [`${Number(v ?? 0).toFixed(1)}%`, name ?? '']}
            labelFormatter={(v) => `${variableLabel}: ${variablePrefix}${Number(v).toFixed(2)}`}
          />
          <Legend verticalAlign="top" height={30} />
          <ReferenceLine
            y={25}
            stroke="#374151"
            strokeDasharray="6 3"
            strokeWidth={1.5}
            label={{ value: '25% doel', position: 'right', fontSize: 10, fill: '#6b7280' }}
          />
          <Line type="monotone" dataKey="webshop" stroke="#3b82f6" strokeWidth={2} dot={false} name="Webshop" />
          <Line type="monotone" dataKey="retail" stroke="#10b981" strokeWidth={2} dot={false} name="Retail" />
          <Line type="monotone" dataKey="b2b" stroke="#f59e0b" strokeWidth={2} dot={false} name="B2B" />
          <Line type="monotone" dataKey="gewogen" stroke="#8b5cf6" strokeWidth={3} dot={false} name="Gewogen" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
