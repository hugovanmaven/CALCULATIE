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
}

export function NumberInput({
  label, value, onChange, prefix, suffix, step = 0.01, min, max, help,
}: NumberInputProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
        {label}
      </label>
      <div className="flex items-center">
        {prefix && (
          <span className="inline-flex items-center px-2 py-1.5 text-sm text-gray-500 bg-gray-100 border border-r-0 border-gray-300 rounded-l">
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
          className={`w-full px-3 py-1.5 text-sm border border-gray-300 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none ${
            prefix ? '' : 'rounded-l'
          } ${suffix ? '' : 'rounded-r'}`}
        />
        {suffix && (
          <span className="inline-flex items-center px-2 py-1.5 text-sm text-gray-500 bg-gray-100 border border-l-0 border-gray-300 rounded-r">
            {suffix}
          </span>
        )}
      </div>
      {help && <p className="mt-1 text-xs text-gray-400">{help}</p>}
    </div>
  );
}
