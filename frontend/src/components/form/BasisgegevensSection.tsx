import { useState } from 'react';
import type { TitelInput, DrukConfig } from '../../api/types';
import { DEFAULT_KOSTENPOSTEN } from '../../api/types';
import { NumberInput } from './NumberInput';
import { SalesTitelSearch } from './SalesTitelSearch';
import { Plus, Trash2, Search, Link2, RefreshCw } from 'lucide-react';

interface Props {
  titelInput: TitelInput;
  updateField: <K extends keyof TitelInput>(field: K, value: TitelInput[K]) => void;
  mergeFields?: (patch: Partial<TitelInput>) => void;
}

export function BasisgegevensSection({ titelInput, updateField, mergeFields }: Props) {
  const [searchOpen, setSearchOpen] = useState(false);
  const salesSource = titelInput.sales_source;
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
      kostenposten: [...DEFAULT_KOSTENPOSTEN],
    }]);
  };

  const removeDruk = (idx: number) => {
    if (drukken.length <= 1) return;
    updateField('drukken', drukken.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      {/* Sales dashboard sync banner */}
      {salesSource ? (
        <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[var(--accent-light)] border border-[var(--accent)]/20">
          <div className="flex items-center gap-2 min-w-0">
            <Link2 size={14} className="text-[var(--accent)] shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-medium text-[var(--text-primary)] truncate">
                Gekoppeld aan Sales Dashboard
                {salesSource.imprint && ` · ${salesSource.imprint}`}
              </div>
              <div className="text-[10px] text-[var(--text-tertiary)] truncate">
                ISBN {salesSource.sales_editie_isbn} · laatst gesynct{' '}
                {new Date(salesSource.laatst_gesynchroniseerd).toLocaleDateString('nl-NL')}
              </div>
            </div>
          </div>
          <button
            onClick={() => setSearchOpen(true)}
            className="shrink-0 flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md text-[var(--accent)] hover:bg-[var(--bg-primary)] transition-colors"
            title="Ververs uit Sales Dashboard"
          >
            <RefreshCw size={11} />
            Ververs
          </button>
        </div>
      ) : (
        <button
          onClick={() => setSearchOpen(true)}
          className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg border border-dashed border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent-light)] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors text-xs font-medium"
        >
          <Search size={14} />
          Zoek titel in Sales Dashboard
        </button>
      )}

      <SalesTitelSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onPick={patch => {
          if (mergeFields) {
            mergeFields(patch);
          } else {
            // Fallback: update fields one by one
            (Object.keys(patch) as Array<keyof TitelInput>).forEach(k => {
              updateField(k, patch[k] as TitelInput[typeof k]);
            });
          }
        }}
      />

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
