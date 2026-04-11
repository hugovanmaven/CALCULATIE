interface NumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  min?: number;
  max?: number;
  help?: string;
  /**
   * Width of the input wrapper.
   *  - xs: ~2 digits (BTW%, korting)
   *  - sm: ~4-5 digits (verkoopprijs, CAC)
   *  - md: ~6-7 digits (oplage, grotere bedragen)
   *  - full: fills parent container (default)
   */
  width?: 'xs' | 'sm' | 'md' | 'full';
}

const WIDTH_CLASS: Record<NonNullable<NumberInputProps['width']>, string> = {
  xs: 'max-w-[96px]',
  sm: 'max-w-[140px]',
  md: 'max-w-[180px]',
  full: '',
};

export function NumberInput({
  label, value, onChange, prefix, suffix, step = 0.01, min, max, help, width = 'full',
}: NumberInputProps) {
  return (
    <div className={WIDTH_CLASS[width]}>
      <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1 break-words leading-tight">
        {label}
      </label>
      <div className="flex items-center">
        {prefix && (
          <span className="inline-flex items-center px-2 py-1.5 text-sm text-[var(--text-tertiary)] bg-[var(--bg-secondary)] border border-r-0 border-[var(--border)] rounded-l-lg">
            {prefix}
          </span>
        )}
        <input
          type="number"
          value={value || ''}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          step={step}
          min={min}
          max={max}
          className={`w-full min-w-0 px-3 py-1.5 text-sm border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-right tabular-nums focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] outline-none ${
            prefix ? '' : 'rounded-l-lg'
          } ${suffix ? '' : 'rounded-r-lg'}`}
        />
        {suffix && (
          <span className="inline-flex items-center px-2 py-1.5 text-sm text-[var(--text-tertiary)] bg-[var(--bg-secondary)] border border-l-0 border-[var(--border)] rounded-r-lg">
            {suffix}
          </span>
        )}
      </div>
      {help && <p className="mt-1 text-xs text-[var(--text-tertiary)]">{help}</p>}
    </div>
  );
}
