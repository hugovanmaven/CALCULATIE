import type { TitelInput, StaffelTrede, ExtraDerde } from '../../api/types';
import { NumberInput } from './NumberInput';
import { StaffelEditor } from './StaffelEditor';
import { Plus, Trash2 } from 'lucide-react';

interface Props {
  titelInput: TitelInput;
  updateField: <K extends keyof TitelInput>(field: K, value: TitelInput[K]) => void;
}

const DEFAULT_STAFFEL: StaffelTrede[] = [
  { tot_exemplaren: 5000, percentage: 0.06 },
  { tot_exemplaren: 10000, percentage: 0.07 },
  { tot_exemplaren: 50000, percentage: 0.09 },
  { tot_exemplaren: 999999, percentage: 0.11 },
];

function ModeToggle({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex w-fit rounded-lg border border-[var(--border)] overflow-hidden text-sm">
      {options.map((opt, i) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 font-medium transition-colors ${
            i > 0 ? 'border-l border-[var(--border)]' : ''
          } ${
            value === opt.value
              ? 'bg-[var(--accent)] text-white'
              : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function DerdeBlock({
  label,
  pctValue,
  onPctChange,
  staffel,
  onStaffelChange,
  voorschot,
  onVoorschotChange,
  winstdelingPct,
  onWinstdelingPctChange,
}: {
  label: string;
  pctValue: number;
  onPctChange: (v: number) => void;
  staffel: StaffelTrede[];
  onStaffelChange: (s: StaffelTrede[]) => void;
  voorschot?: number;
  onVoorschotChange?: (v: number) => void;
  winstdelingPct?: number;
  onWinstdelingPctChange?: (v: number) => void;
}) {
  const hasRoyalty = staffel.length > 0 || pctValue > 0;
  const hasWinstdeling = (winstdelingPct ?? 0) > 0;
  const mainMode = hasRoyalty ? 'royalty' : hasWinstdeling ? 'winstdeling' : 'royalty';
  const royaltyMode = staffel.length > 0 ? 'staffel' : 'vast';

  const setMainMode = (newMode: string) => {
    if (newMode === 'winstdeling') {
      onPctChange(0);
      onStaffelChange([]);
      if ((winstdelingPct ?? 0) === 0 && onWinstdelingPctChange) {
        onWinstdelingPctChange(0.10);
      }
    } else {
      if (onWinstdelingPctChange) onWinstdelingPctChange(0);
    }
  };

  const setRoyaltyMode = (newMode: string) => {
    if (newMode === 'vast') {
      onStaffelChange([]);
    } else {
      onPctChange(0);
      if (staffel.length === 0) onStaffelChange([...DEFAULT_STAFFEL]);
    }
  };

  return (
    <div className="space-y-2.5 p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)]">
      <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">{label}</p>

      {onWinstdelingPctChange && (
        <ModeToggle
          options={[{ label: 'Royalty', value: 'royalty' }, { label: 'Winstdeling', value: 'winstdeling' }]}
          value={mainMode}
          onChange={setMainMode}
        />
      )}

      {mainMode === 'winstdeling' ? (
        <NumberInput
          label={`${label} winstdeling`}
          value={(winstdelingPct ?? 0) * 100}
          onChange={v => onWinstdelingPctChange?.(v / 100)}
          suffix="%"
          step={5}
          help="% van brutowinst"
        />
      ) : (
        <>
          <ModeToggle
            options={[{ label: 'Vast %', value: 'vast' }, { label: 'Staffel', value: 'staffel' }]}
            value={royaltyMode}
            onChange={setRoyaltyMode}
          />

          {royaltyMode === 'vast' ? (
            <NumberInput
              label={`${label} %`}
              value={pctValue * 100}
              onChange={v => onPctChange(v / 100)}
              suffix="%"
              step={1}
              help="% van verkoopprijs ex BTW"
            />
          ) : (
            <>
              <StaffelEditor staffel={staffel} onChange={onStaffelChange} />
              {onVoorschotChange && (
                <NumberInput
                  label="Voorschot"
                  value={voorschot ?? 0}
                  onChange={onVoorschotChange}
                  prefix="€"
                  step={500}
                  help="Wordt ingelopen via royalty"
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function ExtraDerdeBlock({
  derde,
  onChange,
  onRemove,
}: {
  derde: ExtraDerde;
  onChange: (updated: ExtraDerde) => void;
  onRemove: () => void;
}) {
  const isWinstdeling = derde.type === 'winstdeling';
  const royaltyMode = derde.staffel.length > 0 ? 'staffel' : 'vast';

  return (
    <div className="space-y-2.5 p-3 bg-[var(--bg-primary)] rounded-lg border border-[var(--border)]">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={derde.naam}
          onChange={e => onChange({ ...derde, naam: e.target.value })}
          placeholder="Naam (bijv. Co-auteur)"
          className="flex-1 px-2 py-1 text-sm border border-[var(--border)] rounded-lg focus:ring-1 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] outline-none bg-[var(--bg-secondary)] text-[var(--text-primary)]"
        />
        <button
          onClick={onRemove}
          className="p-1 text-[var(--text-tertiary)] hover:text-red-500 transition-colors"
          title="Verwijderen"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <ModeToggle
        options={[{ label: 'Royalty', value: 'royalty' }, { label: 'Winstdeling', value: 'winstdeling' }]}
        value={isWinstdeling ? 'winstdeling' : 'royalty'}
        onChange={v => onChange({ ...derde, type: v as 'royalty' | 'winstdeling', ...(v === 'winstdeling' ? { staffel: [] } : {}) })}
      />

      {isWinstdeling ? (
        <NumberInput
          label={`${derde.naam || 'Extra'} winstdeling`}
          value={derde.percentage * 100}
          onChange={v => onChange({ ...derde, percentage: v / 100 })}
          suffix="%"
          step={5}
          help="% van brutowinst"
        />
      ) : (
        <>
          <ModeToggle
            options={[{ label: 'Vast %', value: 'vast' }, { label: 'Staffel', value: 'staffel' }]}
            value={royaltyMode}
            onChange={v => {
              if (v === 'vast') {
                onChange({ ...derde, staffel: [] });
              } else if (derde.staffel.length === 0) {
                onChange({ ...derde, percentage: 0, staffel: [...DEFAULT_STAFFEL] });
              }
            }}
          />

          {royaltyMode === 'vast' ? (
            <NumberInput
              label={`${derde.naam || 'Extra'} %`}
              value={derde.percentage * 100}
              onChange={v => onChange({ ...derde, percentage: v / 100 })}
              suffix="%"
              step={1}
              help="% van verkoopprijs ex BTW"
            />
          ) : (
            <StaffelEditor
              staffel={derde.staffel}
              onChange={s => onChange({ ...derde, staffel: s })}
            />
          )}

          <NumberInput
            label="Voorschot"
            value={derde.voorschot ?? 0}
            onChange={v => onChange({ ...derde, voorschot: v })}
            prefix="€"
            step={500}
            help="Wordt ingelopen via royalty"
          />
        </>
      )}
    </div>
  );
}

export function DerdenSection({ titelInput, updateField }: Props) {
  const extraDerden = titelInput.extra_derden ?? [];

  const addExtra = () => {
    const newDerde: ExtraDerde = {
      id: `extra_${Date.now()}`,
      naam: '',
      type: 'royalty',
      percentage: 0,
      staffel: [],
      voorschot: 0,
    };
    updateField('extra_derden', [...extraDerden, newDerde]);
  };

  const updateExtra = (idx: number, updated: ExtraDerde) => {
    const next = [...extraDerden];
    next[idx] = updated;
    updateField('extra_derden', next);
  };

  const removeExtra = (idx: number) => {
    updateField('extra_derden', extraDerden.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      <DerdeBlock
        label="Agent"
        pctValue={titelInput.agent_pct}
        onPctChange={v => updateField('agent_pct', v)}
        staffel={titelInput.agent_staffel}
        onStaffelChange={s => updateField('agent_staffel', s)}
        voorschot={titelInput.agent_voorschot}
        onVoorschotChange={v => updateField('agent_voorschot', v)}
        winstdelingPct={titelInput.agent_winstdeling_pct}
        onWinstdelingPctChange={v => updateField('agent_winstdeling_pct', v)}
      />

      <DerdeBlock
        label="Vertaler"
        pctValue={titelInput.vertaler_pct}
        onPctChange={v => updateField('vertaler_pct', v)}
        staffel={titelInput.vertaler_staffel}
        onStaffelChange={s => updateField('vertaler_staffel', s)}
        voorschot={titelInput.vertaler_voorschot}
        onVoorschotChange={v => updateField('vertaler_voorschot', v)}
        winstdelingPct={titelInput.vertaler_winstdeling_pct}
        onWinstdelingPctChange={v => updateField('vertaler_winstdeling_pct', v)}
      />

      <DerdeBlock
        label="Illustrator"
        pctValue={titelInput.illustrator_pct}
        onPctChange={v => updateField('illustrator_pct', v)}
        staffel={titelInput.illustrator_staffel}
        onStaffelChange={s => updateField('illustrator_staffel', s)}
        voorschot={titelInput.illustrator_voorschot}
        onVoorschotChange={v => updateField('illustrator_voorschot', v)}
        winstdelingPct={titelInput.illustrator_winstdeling_pct}
        onWinstdelingPctChange={v => updateField('illustrator_winstdeling_pct', v)}
      />

      {extraDerden.map((d, i) => (
        <ExtraDerdeBlock
          key={d.id}
          derde={d}
          onChange={updated => updateExtra(i, updated)}
          onRemove={() => removeExtra(i)}
        />
      ))}

      <button
        onClick={addExtra}
        className="flex items-center gap-1.5 text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium transition-colors"
      >
        <Plus size={14} />
        Extra persoon toevoegen
      </button>
    </div>
  );
}
