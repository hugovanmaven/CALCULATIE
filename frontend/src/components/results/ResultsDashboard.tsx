import { useState } from 'react';
import type { CalculateResponse } from '../../api/types';
import { SummaryTable } from './SummaryTable';
import { DrukResultCard } from './DrukResultCard';
import { WeightedMarginBar } from './WeightedMarginBar';
import { EenmaligOverzicht } from './EenmaligOverzicht';

interface Props {
  results: CalculateResponse;
}

type Tab = 'overzicht' | 'detail';

export function ResultsDashboard({ results }: Props) {
  const [tab, setTab] = useState<Tab>('overzicht');

  return (
    <div className="space-y-4">
      {/* Weighted margin bars for each druk */}
      <div className="space-y-2">
        {results.drukken.map((druk) => (
          <WeightedMarginBar
            key={druk.druk_type}
            marge_pct={druk.gewogen_marge_pct}
            label={`${druk.druk_type} — gewogen marge`}
          />
        ))}
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setTab('overzicht')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'overzicht'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Overzicht
        </button>
        <button
          onClick={() => setTab('detail')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'detail'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Detail per druk
        </button>
      </div>

      {/* Tab content */}
      {tab === 'overzicht' && (
        <div className="space-y-4">
          <SummaryTable results={results} />
          <EenmaligOverzicht results={results} />
        </div>
      )}

      {tab === 'detail' && (
        <div className="space-y-4">
          {results.drukken.map((druk) => (
            <DrukResultCard key={druk.druk_type} druk={druk} />
          ))}
        </div>
      )}
    </div>
  );
}
