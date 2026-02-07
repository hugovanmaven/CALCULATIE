import type { TitelInput } from '../../api/types';
import { NumberInput } from './NumberInput';
import { StaffelEditor } from './StaffelEditor';

interface Props {
  titelInput: TitelInput;
  updateField: <K extends keyof TitelInput>(field: K, value: TitelInput[K]) => void;
}

export function AuteurDealSection({ titelInput, updateField }: Props) {
  const mode = titelInput.auteur_royalty_staffel.length > 0 ? 'royalty' : 'winstdeling';

  const setMode = (newMode: string) => {
    if (newMode === 'winstdeling') {
      updateField('auteur_royalty_staffel', []);
      if (titelInput.auteur_winstdeling_pct === 0) {
        updateField('auteur_winstdeling_pct', 0.50);
      }
    } else {
      updateField('auteur_winstdeling_pct', 0);
      if (titelInput.auteur_royalty_staffel.length === 0) {
        updateField('auteur_royalty_staffel', [
          { tot_exemplaren: 5000, percentage: 0.08 },
          { tot_exemplaren: 10000, percentage: 0.10 },
        ]);
      }
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="auteur_mode"
            checked={mode === 'winstdeling'}
            onChange={() => setMode('winstdeling')}
            className="text-blue-600"
          />
          <span className="text-sm">Winstdeling</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="auteur_mode"
            checked={mode === 'royalty'}
            onChange={() => setMode('royalty')}
            className="text-blue-600"
          />
          <span className="text-sm">Royalty-staffel</span>
        </label>
      </div>

      {mode === 'winstdeling' ? (
        <NumberInput
          label="Auteur winstdeling"
          value={titelInput.auteur_winstdeling_pct * 100}
          onChange={v => updateField('auteur_winstdeling_pct', v / 100)}
          suffix="%"
          step={5}
          help="% van brutowinst — bijv. 45 = auteur krijgt 45%, Maven 55%"
        />
      ) : (
        <StaffelEditor
          staffel={titelInput.auteur_royalty_staffel}
          onChange={s => updateField('auteur_royalty_staffel', s)}
          label="Auteur royalty-staffel (% van prijs ex BTW)"
        />
      )}
    </div>
  );
}
