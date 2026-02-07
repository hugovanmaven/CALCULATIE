interface Props {
  verdeling: { webshop: number; retail: number; b2b: number };
  setVerdeling: (v: { webshop: number; retail: number; b2b: number }) => void;
}

export function VerdelingSection({ verdeling, setVerdeling }: Props) {
  const sum = verdeling.webshop + verdeling.retail + verdeling.b2b;
  const isValid = Math.abs(sum - 1.0) < 0.001;

  const update = (field: 'webshop' | 'retail' | 'b2b', pct: number) => {
    setVerdeling({ ...verdeling, [field]: pct / 100 });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">Verwachte verdeling van verkopen over kanalen</p>
      <div className="grid grid-cols-3 gap-2">
        {(['webshop', 'retail', 'b2b'] as const).map(kanaal => (
          <div key={kanaal}>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              {kanaal === 'retail' ? 'Retail / CB' : kanaal === 'b2b' ? 'B2B' : 'Webshop'}
            </label>
            <div className="flex items-center">
              <input
                type="number"
                value={Math.round(verdeling[kanaal] * 100) || ''}
                onChange={e => update(kanaal, parseFloat(e.target.value) || 0)}
                step={5}
                min={0}
                max={100}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-l focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <span className="inline-flex items-center px-2 py-1.5 text-xs text-gray-500 bg-gray-100 border border-l-0 border-gray-300 rounded-r">
                %
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Visual bar */}
      <div className="h-3 rounded-full overflow-hidden flex bg-gray-200">
        {verdeling.webshop > 0 && (
          <div
            className="bg-blue-500 transition-all"
            style={{ width: `${verdeling.webshop * 100}%` }}
            title={`Webshop ${(verdeling.webshop * 100).toFixed(0)}%`}
          />
        )}
        {verdeling.retail > 0 && (
          <div
            className="bg-emerald-500 transition-all"
            style={{ width: `${verdeling.retail * 100}%` }}
            title={`Retail ${(verdeling.retail * 100).toFixed(0)}%`}
          />
        )}
        {verdeling.b2b > 0 && (
          <div
            className="bg-amber-500 transition-all"
            style={{ width: `${verdeling.b2b * 100}%` }}
            title={`B2B ${(verdeling.b2b * 100).toFixed(0)}%`}
          />
        )}
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Webshop</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Retail</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> B2B</span>
      </div>

      {!isValid && (
        <p className="text-xs text-red-500 font-medium">
          Totaal is {(sum * 100).toFixed(0)}% — moet 100% zijn
        </p>
      )}
    </div>
  );
}
