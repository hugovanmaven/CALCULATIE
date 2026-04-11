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
      {/* Mode toggle */}
      <div className="flex w-fit rounded-lg border border-[var(--border)] overflow-hidden text-sm">
        <button
          onClick={() => setMode('winstdeling')}
          className={`px-3 py-1.5 font-medium transition-colors ${
            mode === 'winstdeling'
              ? 'bg-[var(--accent)] text-white'
              : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
          }`}
        >
          Winstdeling
        </button>
        <button
          onClick={() => setMode('royalty')}
          className={`px-3 py-1.5 font-medium border-l border-[var(--border)] transition-colors ${
            mode === 'royalty'
              ? 'bg-[var(--accent)] text-white'
              : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
          }`}
        >
          Royalty-staffel
        </button>
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
        <>
          <StaffelEditor
            staffel={titelInput.auteur_royalty_staffel}
            onChange={s => updateField('auteur_royalty_staffel', s)}
            label="Auteur royalty-staffel (% van prijs ex BTW)"
          />
          <NumberInput
            label="Voorschot"
            value={titelInput.auteur_voorschot ?? 0}
            onChange={v => updateField('auteur_voorschot', v)}
            prefix="€"
            step={500}
            help="Wordt ingelopen via royalty per verkocht exemplaar"
          />
        </>
      )}
    </div>
  );
}
