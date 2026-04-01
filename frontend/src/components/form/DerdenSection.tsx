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

function DerdeBlock({
  label,
  radioName,
  pctValue,
  onPctChange,
  staffel,
  onStaffelChange,
  voorschot,
  onVoorschotChange,
  help,
}: {
  label: string;
  radioName: string;
  pctValue: number;
  onPctChange: (v: number) => void;
  staffel: StaffelTrede[];
  onStaffelChange: (s: StaffelTrede[]) => void;
  voorschot?: number;
  onVoorschotChange?: (v: number) => void;
  help?: string;
}) {
  const mode = staffel.length > 0 ? 'staffel' : 'vast';

  const setMode = (newMode: string) => {
    if (newMode === 'vast') {
      onStaffelChange([]);
    } else {
      onPctChange(0);
      if (staffel.length === 0) {
        onStaffelChange([...DEFAULT_STAFFEL]);
      }
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase">{label}</p>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={radioName}
            checked={mode === 'vast'}
            onChange={() => setMode('vast')}
            className="text-[var(--accent)]"
          />
          <span className="text-sm">Vast %</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={radioName}
            checked={mode === 'staffel'}
            onChange={() => setMode('staffel')}
            className="text-[var(--accent)]"
          />
          <span className="text-sm">Staffel</span>
        </label>
      </div>
      {mode === 'vast' ? (
        <NumberInput
          label={`${label} %`}
          value={pctValue * 100}
          onChange={v => onPctChange(v / 100)}
          suffix="%"
          step={1}
          help={help ?? '% van verkoopprijs ex BTW'}
        />
      ) : (
        <>
          <StaffelEditor
            staffel={staffel}
            onChange={onStaffelChange}
          />
          {onVoorschotChange && (
            <NumberInput
              label="Voorschot"
              value={voorschot ?? 0}
              onChange={onVoorschotChange}
              prefix="&euro;"
              step={500}
              help="Wordt ingelopen via royalty per verkocht exemplaar"
            />
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
  const mode = derde.staffel.length > 0 ? 'staffel' : 'vast';

  return (
    <div className="space-y-2 p-3 bg-[var(--bg-primary)] rounded-lg border border-[var(--border)]">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={derde.naam}
          onChange={e => onChange({ ...derde, naam: e.target.value })}
          placeholder="Naam (bijv. Co-auteur)"
          className="flex-1 px-2 py-1 text-sm border border-[var(--border)] rounded focus:ring-1 focus:ring-[var(--accent)]/30 outline-none bg-[var(--bg-secondary)]"
        />
        <select
          value={derde.type}
          onChange={e => onChange({ ...derde, type: e.target.value as 'royalty' | 'winstdeling' })}
          className="px-2 py-1 text-sm border border-[var(--border)] rounded outline-none bg-[var(--bg-secondary)]"
        >
          <option value="royalty">Royalty</option>
          <option value="winstdeling">Winstdeling</option>
        </select>
        <button
          onClick={onRemove}
          className="p-1 text-[var(--text-tertiary)] hover:text-red-500 transition-colors"
          title="Verwijderen"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {derde.type === 'royalty' && (
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={`extra_${derde.id}_mode`}
              checked={mode === 'vast'}
              onChange={() => onChange({ ...derde, staffel: [] })}
              className="text-[var(--accent)]"
            />
            <span className="text-sm">Vast %</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={`extra_${derde.id}_mode`}
              checked={mode === 'staffel'}
              onChange={() => {
                if (derde.staffel.length === 0) {
                  onChange({ ...derde, percentage: 0, staffel: [...DEFAULT_STAFFEL] });
                }
              }}
              className="text-[var(--accent)]"
            />
            <span className="text-sm">Staffel</span>
          </label>
        </div>
      )}

      {mode === 'vast' || derde.type === 'winstdeling' ? (
        <NumberInput
          label={`${derde.naam || 'Extra'} %`}
          value={derde.percentage * 100}
          onChange={v => onChange({ ...derde, percentage: v / 100 })}
          suffix="%"
          step={1}
          help={derde.type === 'royalty' ? '% van verkoopprijs ex BTW' : '% van brutowinst'}
        />
      ) : (
        <StaffelEditor
          staffel={derde.staffel}
          onChange={s => onChange({ ...derde, staffel: s })}
        />
      )}

      {/* Voorschot — only for royalty */}
      {derde.type === 'royalty' && (
        <NumberInput
          label="Voorschot"
          value={derde.voorschot ?? 0}
          onChange={v => onChange({ ...derde, voorschot: v })}
          prefix="&euro;"
          step={500}
          help="Wordt ingelopen via royalty"
        />
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
    <div className="space-y-4">
      <DerdeBlock
        label="Agent"
        radioName="agent_mode"
        pctValue={titelInput.agent_pct}
        onPctChange={v => updateField('agent_pct', v)}
        staffel={titelInput.agent_staffel}
        onStaffelChange={s => updateField('agent_staffel', s)}
        voorschot={titelInput.agent_voorschot}
        onVoorschotChange={v => updateField('agent_voorschot', v)}
      />

      <DerdeBlock
        label="Vertaler"
        radioName="vertaler_mode"
        pctValue={titelInput.vertaler_pct}
        onPctChange={v => updateField('vertaler_pct', v)}
        staffel={titelInput.vertaler_staffel}
        onStaffelChange={s => updateField('vertaler_staffel', s)}
        voorschot={titelInput.vertaler_voorschot}
        onVoorschotChange={v => updateField('vertaler_voorschot', v)}
      />

      <DerdeBlock
        label="Illustrator"
        radioName="illustrator_mode"
        pctValue={titelInput.illustrator_pct}
        onPctChange={v => updateField('illustrator_pct', v)}
        staffel={titelInput.illustrator_staffel}
        onStaffelChange={s => updateField('illustrator_staffel', s)}
        voorschot={titelInput.illustrator_voorschot}
        onVoorschotChange={v => updateField('illustrator_voorschot', v)}
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
