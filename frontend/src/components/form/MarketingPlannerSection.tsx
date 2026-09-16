import type { TitelInput, MarketingOnderdeel } from '../../api/types';
import { berekenMarketingBudget, generateOnderdeelId, type Verdeling } from '../../lib/marketing';
import { Plus, X } from 'lucide-react';

interface Props {
  titelInput: TitelInput;
  updateField: <K extends keyof TitelInput>(field: K, value: TitelInput[K]) => void;
  verdeling: Verdeling;
  cacPerEx: number;
  setCacPerEx: (v: number) => void;
}

const GROEPEN: { key: MarketingOnderdeel['groep']; label: string }[] = [
  { key: 'offline_marketing', label: 'Offline marketing' },
  { key: 'online_marketing', label: 'Online marketing' },
];

function euro(n: number): string {
  return n.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function MarketingPlannerSection({ titelInput, updateField, verdeling, cacPerEx, setCacPerEx }: Props) {
  const onderdelen = titelInput.marketing_onderdelen;
  const budget = berekenMarketingBudget(titelInput, verdeling);
  const pct = Math.round(titelInput.marketing_budget_pct * 100);

  const eersteOplage = titelInput.drukken.length
    ? [...titelInput.drukken].sort((a, b) => a.druknummer - b.druknummer)[0].oplage
    : 0;
  const cacEuro = cacPerEx * verdeling.webshop * eersteOplage;

  const totToegewezen = onderdelen.reduce((s, o) => s + o.toegewezen, 0);
  const totCommitted = onderdelen.reduce((s, o) => s + o.committed, 0);
  const totBesteed = onderdelen.reduce((s, o) => s + o.besteed, 0);
  const nogOver = budget - totToegewezen;

  const patch = (id: string, veld: keyof MarketingOnderdeel, waarde: number) => {
    updateField('marketing_onderdelen', onderdelen.map(o =>
      o.id === id ? { ...o, [veld]: waarde } : o));
  };
  const setToegewezenPct = (id: string, p: number) => {
    patch(id, 'toegewezen', budget > 0 ? (p / 100) * budget : 0);
  };
  const addRij = (groep: MarketingOnderdeel['groep']) => {
    updateField('marketing_onderdelen', [...onderdelen, {
      id: generateOnderdeelId(), naam: '', groep,
      volgorde: onderdelen.length, toegewezen: 0, committed: 0, besteed: 0,
    }]);
  };
  const removeRij = (id: string) => {
    updateField('marketing_onderdelen', onderdelen.filter(o => o.id !== id));
  };

  return (
    <div className="space-y-4">
      {/* Budget-tile + %-veld */}
      <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Berekend marketingbudget</div>
          <div className="text-2xl font-semibold text-[var(--text-primary)]">€ {euro(budget)}</div>
        </div>
        <div className="text-right">
          <label className="block text-xs text-[var(--text-secondary)] mb-1">% van eerste oplage</label>
          <div className="flex items-center">
            <input
              type="number" value={pct} step={1} min={0} max={100}
              onChange={e => updateField('marketing_budget_pct', (parseFloat(e.target.value) || 0) / 100)}
              className="w-16 px-2 py-1.5 text-sm border border-[var(--border)] rounded-l bg-[var(--bg-primary)] text-[var(--text-primary)]"
            />
            <span className="inline-flex items-center px-2 py-1.5 text-xs text-[var(--text-tertiary)] bg-[var(--bg-secondary)] border border-l-0 border-[var(--border)] rounded-r">%</span>
          </div>
        </div>
      </div>

      {/* Tabel per groep */}
      {GROEPEN.map(groep => (
        <div key={groep.key} className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">{groep.label}</div>
          {onderdelen.filter(o => o.groep === groep.key).map(o => (
            <div key={o.id} className="grid grid-cols-[1.4fr_0.9fr_0.6fr_0.9fr_0.9fr_auto] gap-2 items-center">
              <input
                value={o.naam} placeholder="Naam"
                onChange={e => updateField('marketing_onderdelen', onderdelen.map(x => x.id === o.id ? { ...x, naam: e.target.value } : x))}
                className="px-2 py-1.5 text-sm border border-[var(--border)] rounded bg-[var(--bg-primary)] text-[var(--text-primary)]"
              />
              {/* Toegewezen € */}
              <input type="number" value={Math.round(o.toegewezen) || ''} step={50}
                onChange={e => patch(o.id, 'toegewezen', parseFloat(e.target.value) || 0)}
                className="px-2 py-1.5 text-sm border border-[var(--border)] rounded bg-[var(--bg-primary)] text-[var(--text-primary)]" />
              {/* Toegewezen % */}
              <input type="number" value={budget > 0 ? Math.round((o.toegewezen / budget) * 100) : 0} step={1}
                onChange={e => setToegewezenPct(o.id, parseFloat(e.target.value) || 0)}
                className="px-2 py-1.5 text-sm border border-[var(--border)] rounded bg-[var(--bg-primary)] text-[var(--text-primary)]" />
              {/* Committed € */}
              <input type="number" value={Math.round(o.committed) || ''} step={50}
                onChange={e => patch(o.id, 'committed', parseFloat(e.target.value) || 0)}
                className="px-2 py-1.5 text-sm border border-[var(--border)] rounded bg-[var(--bg-primary)] text-[var(--text-primary)]" />
              {/* Besteed € */}
              <input type="number" value={Math.round(o.besteed) || ''} step={50}
                onChange={e => patch(o.id, 'besteed', parseFloat(e.target.value) || 0)}
                className="px-2 py-1.5 text-sm border border-[var(--border)] rounded bg-[var(--bg-primary)] text-[var(--text-primary)]" />
              <button onClick={() => removeRij(o.id)} className="text-[var(--text-tertiary)] hover:text-red-500 p-1" title="Verwijderen">
                <X size={14} />
              </button>
            </div>
          ))}
          {/* CAC-regel binnen online marketing (informatief) */}
          {groep.key === 'online_marketing' && (
            <div className="grid grid-cols-[1.4fr_0.9fr_0.6fr_0.9fr_0.9fr_auto] gap-2 items-center opacity-90">
              <span className="text-sm text-[var(--text-secondary)] pl-1">CAC per webshop-aankoop</span>
              <div className="flex items-center">
                <span className="text-xs text-[var(--text-tertiary)] pr-1">€</span>
                <input type="number" value={cacPerEx || ''} step={0.5}
                  onChange={e => setCacPerEx(parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 text-sm border border-[var(--border)] rounded bg-[var(--bg-primary)] text-[var(--text-primary)]" />
              </div>
              <span className="text-xs text-[var(--text-tertiary)]">/ex</span>
              <span className="col-span-2 text-xs text-[var(--text-tertiary)]">≈ € {euro(cacEuro)} bij deze oplage (telt niet in kolomtotalen)</span>
              <span />
            </div>
          )}
          <button onClick={() => addRij(groep.key)} className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline mt-1">
            <Plus size={12} /> onderdeel
          </button>
        </div>
      ))}

      {/* Totalen */}
      <div className="grid grid-cols-[1.4fr_0.9fr_0.6fr_0.9fr_0.9fr_auto] gap-2 items-center border-t border-[var(--border)] pt-2 text-sm font-medium">
        <span>Totaal</span>
        <span>€ {euro(totToegewezen)}</span>
        <span>{budget > 0 ? Math.round((totToegewezen / budget) * 100) : 0}%</span>
        <span>€ {euro(totCommitted)}</span>
        <span>€ {euro(totBesteed)}</span>
        <span />
      </div>
      <div className="grid grid-cols-[1.4fr_0.9fr_0.6fr_0.9fr_0.9fr_auto] gap-2 items-center text-sm">
        <span className="text-[var(--text-secondary)]">Nog over (t.o.v. toegewezen)</span>
        <span className={nogOver < 0 ? 'text-red-500 font-semibold' : 'text-[var(--text-primary)]'}>€ {euro(nogOver)}</span>
        <span /><span /><span /><span />
      </div>
    </div>
  );
}
