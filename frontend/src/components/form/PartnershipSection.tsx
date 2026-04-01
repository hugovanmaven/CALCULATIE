import type { TitelInput } from '../../api/types';
import { NumberInput } from './NumberInput';

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
          className="rounded text-[var(--accent)]"
        />
        <span className="text-sm">Partnership (winstdeling na auteur)</span>
      </label>
      {titelInput.heeft_partner && (
        <>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">
              Partner naam
            </label>
            <input
              type="text"
              value={titelInput.partner_naam}
              onChange={e => updateField('partner_naam', e.target.value)}
              placeholder="Bijv. POM"
              className="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] outline-none"
            />
          </div>
          <NumberInput
            label="Partner aandeel"
            value={(titelInput.partner_winstdeling_pct ?? 0.50) * 100}
            onChange={v => updateField('partner_winstdeling_pct', v / 100)}
            suffix="%"
            step={5}
            help="% van winst na auteur — bijv. 50 = partner krijgt 50%, Maven 50%"
          />
        </>
      )}
    </div>
  );
}
