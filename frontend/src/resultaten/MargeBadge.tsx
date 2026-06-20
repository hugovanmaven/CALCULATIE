// Gedeelde marge-badge — kleur op streef (35%) / ondergrens (30%).
import { pct } from './api';

export function MargeBadge({ marge, status }: { marge: number; status: 'groen' | 'oranje' | 'rood' }) {
  const cls =
    status === 'groen'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
      : status === 'oranje'
      ? 'bg-amber-50 text-amber-700 ring-amber-600/20'
      : 'bg-red-50 text-red-700 ring-red-600/20';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-md ring-1 ring-inset ${cls}`}>
      {pct(marge)}
    </span>
  );
}
