import type { TitelInput } from '../../api/types';

interface Props {
  titelInput: TitelInput;
  updateField: <K extends keyof TitelInput>(field: K, value: TitelInput[K]) => void;
}

export function PartnershipSection({ titelInput, updateField }: Props) {
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={titelInput.heeft_partner}
          onChange={e => updateField('heeft_partner', e.target.checked)}
          className="rounded text-blue-600"
        />
        <span className="text-sm">Partnership (50/50 netto winst deling)</span>
      </label>
      {titelInput.heeft_partner && (
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Partner naam
          </label>
          <input
            type="text"
            value={titelInput.partner_naam}
            onChange={e => updateField('partner_naam', e.target.value)}
            placeholder="Bijv. POM"
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
      )}
    </div>
  );
}
