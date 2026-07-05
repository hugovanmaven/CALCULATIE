// Gedeelde marge-badge — kleur op streef (35%) / ondergrens (30%), berekend
// over het resultaat ná winstdeling. 'onbekend' = titel zonder calculatie.
import { pct } from './api';

export function MargeBadge({ marge, status }: { marge: number; status: 'groen' | 'oranje' | 'rood' | 'onbekend' }) {
  const cls =
    status === 'groen'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
      : status === 'oranje'
      ? 'bg-amber-50 text-amber-700 ring-amber-600/20'
      : status === 'rood'
      ? 'bg-red-50 text-red-700 ring-red-600/20'
      : 'bg-[var(--bg-hover)] text-[var(--text-secondary)] ring-[var(--border)]';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-md ring-1 ring-inset ${cls}`}>
      {status === 'onbekend' ? `± ${pct(marge)}` : pct(marge)}
    </span>
  );
}
