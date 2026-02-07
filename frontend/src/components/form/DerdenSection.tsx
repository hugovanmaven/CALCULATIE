import type { TitelInput } from '../../api/types';
import { NumberInput } from './NumberInput';
import { StaffelEditor } from './StaffelEditor';

interface Props {
  titelInput: TitelInput;
  updateField: <K extends keyof TitelInput>(field: K, value: TitelInput[K]) => void;
}

export function DerdenSection({ titelInput, updateField }: Props) {
  const agentMode = titelInput.agent_staffel.length > 0 ? 'staffel' : 'vast';

  const setAgentMode = (mode: string) => {
    if (mode === 'vast') {
      updateField('agent_staffel', []);
    } else {
      updateField('agent_pct', 0);
      if (titelInput.agent_staffel.length === 0) {
        updateField('agent_staffel', [
          { tot_exemplaren: 5000, percentage: 0.06 },
          { tot_exemplaren: 10000, percentage: 0.07 },
          { tot_exemplaren: 50000, percentage: 0.09 },
          { tot_exemplaren: 999999, percentage: 0.11 },
        ]);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Agent */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-600 uppercase">Agent</p>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="agent_mode"
              checked={agentMode === 'vast'}
              onChange={() => setAgentMode('vast')}
              className="text-blue-600"
            />
            <span className="text-sm">Vast %</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="agent_mode"
              checked={agentMode === 'staffel'}
              onChange={() => setAgentMode('staffel')}
              className="text-blue-600"
            />
            <span className="text-sm">Staffel</span>
          </label>
        </div>
        {agentMode === 'vast' ? (
          <NumberInput
            label="Agent %"
            value={titelInput.agent_pct * 100}
            onChange={v => updateField('agent_pct', v / 100)}
            suffix="%"
            step={1}
            help="% van verkoopprijs ex BTW"
          />
        ) : (
          <StaffelEditor
            staffel={titelInput.agent_staffel}
            onChange={s => updateField('agent_staffel', s)}
          />
        )}
      </div>

      {/* Vertaler & Illustrator */}
      <div className="grid grid-cols-2 gap-3">
        <NumberInput
          label="Vertaler %"
          value={titelInput.vertaler_pct * 100}
          onChange={v => updateField('vertaler_pct', v / 100)}
          suffix="%"
          help="% van prijs ex BTW"
        />
        <NumberInput
          label="Illustrator %"
          value={titelInput.illustrator_pct * 100}
          onChange={v => updateField('illustrator_pct', v / 100)}
          suffix="%"
          help="% van prijs ex BTW"
        />
      </div>
    </div>
  );
}
