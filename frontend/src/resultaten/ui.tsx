// Gedeelde bouwstenen van de Resultaten-module (tile-taal van de calculatie-app).
import type { TitelKeuze } from './api';

/** KPI-tile: uppercase label + groot getal, zoals de kanaaltiles in de calculatie. */
export function Tile({ label, value, sub, extra }: { label: string; value: string; sub?: string; extra?: React.ReactNode }) {
  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
      <div className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-2">{label}</div>
      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{value}</span>
        {extra}
      </div>
      {sub && <div className="text-xs text-[var(--text-tertiary)] mt-1">{sub}</div>}
    </div>
  );
}

/** Titel-kiezer voor het toewijzen van een Exact-regel aan een titel. */
export function TitelSelect({
  titels,
  placeholder,
  exclude,
  disabled,
  onKies,
  onBlur,
  className = '',
}: {
  titels: TitelKeuze[];
  placeholder: string;
  exclude?: string | null;
  disabled?: boolean;
  onKies: (receptId: string) => void;
  onBlur?: () => void;
  className?: string;
}) {
  return (
    <select
      autoFocus
      defaultValue=""
      disabled={disabled}
      onChange={(e) => { if (e.target.value) onKies(e.target.value); }}
      onBlur={onBlur}
      className={`text-xs border border-[var(--border)] rounded-md px-1.5 py-0.5 bg-[var(--bg-secondary)] text-[var(--text-primary)] ${className}`}
    >
      <option value="" disabled>{placeholder}</option>
      {titels.filter((t) => t.recept_id !== exclude).map((t) => (
        <option key={t.recept_id} value={t.recept_id}>{t.titel}</option>
      ))}
    </select>
  );
}
