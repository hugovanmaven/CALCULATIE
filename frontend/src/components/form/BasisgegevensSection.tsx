import type { TitelInput, DrukConfig } from '../../api/types';
import { NumberInput } from './NumberInput';
import { Plus, Trash2 } from 'lucide-react';

interface Props {
  titelInput: TitelInput;
  updateField: <K extends keyof TitelInput>(field: K, value: TitelInput[K]) => void;
}

export function BasisgegevensSection({ titelInput, updateField }: Props) {
  const drukken = titelInput.drukken ?? [{ druknummer: 1, oplage: 2000, drukkosten_per_ex: 1.20 }];

  const updateDruk = (idx: number, field: keyof DrukConfig, value: number) => {
    const next = drukken.map((d, i) => i === idx ? { ...d, [field]: value } : d);
    updateField('drukken', next);
  };

  const addDruk = () => {
    const lastDruk = drukken[drukken.length - 1];
    const nextNr = lastDruk ? lastDruk.druknummer + 1 : 1;
    updateField('drukken', [...drukken, {
      druknummer: nextNr,
      oplage: lastDruk?.oplage ?? 2000,
      drukkosten_per_ex: lastDruk?.drukkosten_per_ex ?? 1.20,
    }]);
  };

  const removeDruk = (idx: number) => {
    if (drukken.length <= 1) return;
    updateField('drukken', drukken.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      {/* Titel + Auteur */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">
            Titel
          </label>
          <input
            type="text"
            value={titelInput.titel}
            onChange={e => updateField('titel', e.target.value)}
            placeholder="Bijv. Rechts verpest onze seks"
            className="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">
            Auteur
          </label>
          <input
            type="text"
            value={titelInput.auteur}
            onChange={e => updateField('auteur', e.target.value)}
            placeholder="Bijv. David Graeber"
            className="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] outline-none"
          />
        </div>
      </div>

      {/* ISBN + Verschijningsdatum */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">
            ISBN
          </label>
          <input
            type="text"
            value={titelInput.isbn}
            onChange={e => updateField('isbn', e.target.value)}
            placeholder="978-..."
            maxLength={17}
            className="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] outline-none font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">
            Verschijningsdatum
          </label>
          <input
            type="date"
            value={titelInput.verschijningsdatum}
            onChange={e => updateField('verschijningsdatum', e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] outline-none"
          />
        </div>
      </div>

      <div className="flex items-center">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={titelInput.verschenen}
            onChange={e => updateField('verschenen', e.target.checked)}
            className="w-4 h-4 rounded border-[var(--border)] text-emerald-600 focus:ring-emerald-500/20"
          />
          <span className="text-sm text-[var(--text-secondary)]">Verschenen</span>
          {titelInput.verschenen && (
            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
              Gepubliceerd
            </span>
          )}
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <NumberInput
          label="Verkoopprijs incl BTW"
          value={titelInput.verkoopprijs_incl_btw}
          onChange={v => updateField('verkoopprijs_incl_btw', v)}
          prefix="&euro;"
          step={0.5}
        />
        <NumberInput
          label="BTW %"
          value={titelInput.btw_percentage * 100}
          onChange={v => updateField('btw_percentage', v / 100)}
          suffix="%"
          step={1}
        />
      </div>
      <NumberInput
        label="Boekhandelskorting"
        value={titelInput.boekhandelskorting * 100}
        onChange={v => updateField('boekhandelskorting', v / 100)}
        suffix="%"
        step={1}
        help="Standaard 48%"
      />

      {/* ─── Drukken ─── */}
      <div>
        <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-2">
          Drukken
        </label>
        <div className="space-y-2">
          {drukken.map((druk, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-2 p-2.5 rounded-lg border ${
                idx === 0
                  ? 'bg-[var(--accent-light)] border-[var(--accent)]/20'
                  : 'bg-[var(--bg-primary)] border-[var(--border)]'
              }`}
            >
              {/* Druknummer */}
              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="number"
                  min={1}
                  value={druk.druknummer}
                  onChange={e => {
                    const v = parseInt(e.target.value);
                    if (v >= 1) updateDruk(idx, 'druknummer', v);
                  }}
                  className="w-12 px-1.5 py-1 text-sm border border-[var(--border)] rounded text-center bg-[var(--bg-secondary)] tabular-nums outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
                />
                <span className="text-xs text-[var(--text-tertiary)]">e druk</span>
              </div>

              {/* Oplage */}
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <input
                  type="number"
                  min={1}
                  step={100}
                  value={druk.oplage}
                  onChange={e => {
                    const v = parseInt(e.target.value);
                    if (v >= 1) updateDruk(idx, 'oplage', v);
                  }}
                  className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--bg-secondary)] tabular-nums outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
                  placeholder="Oplage"
                />
                <span className="text-xs text-[var(--text-tertiary)] shrink-0">ex</span>
              </div>

              {/* Drukkosten/ex */}
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-xs text-[var(--text-tertiary)]">&euro;</span>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={druk.drukkosten_per_ex}
                  onChange={e => updateDruk(idx, 'drukkosten_per_ex', parseFloat(e.target.value) || 0)}
                  className="w-16 px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--bg-secondary)] tabular-nums outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
                />
                <span className="text-xs text-[var(--text-tertiary)]">/ex</span>
              </div>

              {/* Remove */}
              {drukken.length > 1 && (
                <button
                  onClick={() => removeDruk(idx)}
                  className="p-1 text-[var(--text-tertiary)] hover:text-red-500 transition-colors shrink-0"
                  title="Verwijder druk"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={addDruk}
          className="flex items-center gap-1.5 text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium mt-2 transition-colors"
        >
          <Plus size={14} />
          Herdruk toevoegen
        </button>
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
          1e druk: alle kosten meegenomen. Herdrukken: eenmalige kosten vervallen.
        </p>
      </div>
    </div>
  );
}
