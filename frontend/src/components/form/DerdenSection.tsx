import type { TitelInput, StaffelTrede } from '../../api/types';
import { NumberInput } from './NumberInput';
import { StaffelEditor } from './StaffelEditor';

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

/** Reusable block for agent/vertaler/illustrator with vast% vs staffel toggle */
function DerdeBlock({
  label,
  radioName,
  pctValue,
  onPctChange,
  staffel,
  onStaffelChange,
  help,
}: {
  label: string;
  radioName: string;
  pctValue: number;
  onPctChange: (v: number) => void;
  staffel: StaffelTrede[];
  onStaffelChange: (s: StaffelTrede[]) => void;
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
      <p className="text-xs font-semibold text-gray-600 uppercase">{label}</p>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={radioName}
            checked={mode === 'vast'}
            onChange={() => setMode('vast')}
            className="text-blue-600"
          />
          <span className="text-sm">Vast %</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={radioName}
            checked={mode === 'staffel'}
            onChange={() => setMode('staffel')}
            className="text-blue-600"
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
        <StaffelEditor
          staffel={staffel}
          onChange={onStaffelChange}
        />
      )}
    </div>
  );
}

export function DerdenSection({ titelInput, updateField }: Props) {
  return (
    <div className="space-y-4">
      <DerdeBlock
        label="Agent"
        radioName="agent_mode"
        pctValue={titelInput.agent_pct}
        onPctChange={v => updateField('agent_pct', v)}
        staffel={titelInput.agent_staffel}
        onStaffelChange={s => updateField('agent_staffel', s)}
      />

      <DerdeBlock
        label="Vertaler"
        radioName="vertaler_mode"
        pctValue={titelInput.vertaler_pct}
        onPctChange={v => updateField('vertaler_pct', v)}
        staffel={titelInput.vertaler_staffel}
        onStaffelChange={s => updateField('vertaler_staffel', s)}
      />

      <DerdeBlock
        label="Illustrator"
        radioName="illustrator_mode"
        pctValue={titelInput.illustrator_pct}
        onPctChange={v => updateField('illustrator_pct', v)}
        staffel={titelInput.illustrator_staffel}
        onStaffelChange={s => updateField('illustrator_staffel', s)}
      />
    </div>
  );
}
