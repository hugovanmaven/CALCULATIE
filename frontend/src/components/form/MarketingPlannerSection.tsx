import { useState } from 'react';
import type { TitelInput, DrukConfig, MarketingOnderdeel } from '../../api/types';
import { berekenMarketingBudget, berekenGemiddeldeCac, generateOnderdeelId, AD_SPEND_ID, type Verdeling } from '../../lib/marketing';
import { Plus, X, ChevronRight, ChevronDown } from 'lucide-react';

interface Props {
  druk: DrukConfig;
  onDrukChange: (druk: DrukConfig) => void;
  titelInput: TitelInput;
  verdeling: Verdeling;
}

const GROEPEN: { key: MarketingOnderdeel['groep']; label: string }[] = [
  { key: 'offline_marketing', label: 'Offline marketing' },
  { key: 'online_marketing', label: 'Online marketing' },
];

function euro(n: number): string {
  return n.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function MarketingPlannerSection({ druk, onDrukChange, titelInput, verdeling }: Props) {
  const onderdelen = druk.marketing_onderdelen ?? [];
  const budget = berekenMarketingBudget(druk, titelInput, verdeling);
  const pct = Math.round((druk.marketing_budget_pct ?? 0.08) * 100);
  const gemiddeldeCac = berekenGemiddeldeCac(druk, verdeling);
  const webshopVerkopen = verdeling.webshop * druk.oplage;

  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const totToegewezen = onderdelen.reduce((s, o) => s + o.toegewezen, 0);
  const totCommitted = onderdelen.reduce((s, o) => s + o.committed, 0);
  const totBesteed = onderdelen.reduce((s, o) => s + o.besteed, 0);
  const teBesteden = totToegewezen - totCommitted - totBesteed;

  const setOnderdelen = (next: MarketingOnderdeel[]) =>
    onDrukChange({ ...druk, marketing_onderdelen: next });
  const patchNum = (id: string, veld: 'toegewezen' | 'committed' | 'besteed', waarde: number) =>
    setOnderdelen(onderdelen.map(o => (o.id === id ? { ...o, [veld]: waarde } : o)));
  const patchNaam = (id: string, naam: string) =>
    setOnderdelen(onderdelen.map(o => (o.id === id ? { ...o, naam } : o)));
  const setToegewezenPct = (id: string, p: number) =>
    patchNum(id, 'toegewezen', budget > 0 ? (p / 100) * budget : 0);
  const addRij = (groep: MarketingOnderdeel['groep']) =>
    setOnderdelen([...onderdelen, {
      id: generateOnderdeelId(), naam: '', groep,
      volgorde: onderdelen.length, toegewezen: 0, committed: 0, besteed: 0,
    }]);
  const removeRij = (id: string) => setOnderdelen(onderdelen.filter(o => o.id !== id));

  const numCls = "w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--bg-primary)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] outline-none";
  const samenvatting = [
    { label: 'Toegewezen', val: totToegewezen, warn: false },
    { label: 'Committed', val: totCommitted, warn: false },
    { label: 'Besteed', val: totBesteed, warn: false },
    { label: 'Te besteden', val: teBesteden, warn: teBesteden < 0 },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2.5">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">Berekend marketingbudget</div>
          <div className="text-xl font-semibold text-[var(--text-primary)]">€ {euro(budget)}</div>
        </div>
        <div className="text-right">
          <label className="block text-[10px] text-[var(--text-secondary)] mb-0.5">% van oplage</label>
          <div className="flex items-center">
            <input type="number" value={pct} step={1} min={0} max={100}
              onChange={e => onDrukChange({ ...druk, marketing_budget_pct: (parseFloat(e.target.value) || 0) / 100 })}
              className="w-14 px-2 py-1 text-sm border border-[var(--border)] rounded-l bg-[var(--bg-primary)] text-[var(--text-primary)]" />
            <span className="inline-flex items-center px-2 py-1 text-xs text-[var(--text-tertiary)] bg-[var(--bg-secondary)] border border-l-0 border-[var(--border)] rounded-r">%</span>
          </div>
        </div>
      </div>

      {/* Dun balkje: oranje = committed+besteed, grijze track = te besteden */}
      <div className="h-1.5 rounded-full overflow-hidden bg-[var(--border)]">
        <div
          className="bg-amber-500 h-full transition-all"
          style={{ width: `${totToegewezen > 0 ? Math.min(100, ((totCommitted + totBesteed) / totToegewezen) * 100) : 0}%` }}
        />
      </div>

      <div className="grid grid-cols-4 gap-1 text-center">
        {samenvatting.map(s => (
          <div key={s.label} className="rounded bg-[var(--bg-secondary)] px-1 py-1.5">
            <div className="text-[9px] uppercase tracking-wide text-[var(--text-tertiary)]">{s.label}</div>
            <div className={`text-xs font-semibold ${s.warn ? 'text-red-500' : 'text-[var(--text-primary)]'}`}>€ {euro(s.val)}</div>
          </div>
        ))}
      </div>

      {GROEPEN.map(groep => (
        <div key={groep.key} className="space-y-1">
          <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">{groep.label}</div>
          {onderdelen.filter(o => o.groep === groep.key).map(o => {
            const isOpen = open.has(o.id);
            const verbruikt = o.committed + o.besteed;
            const over = verbruikt > o.toegewezen && o.toegewezen > 0;
            const teBestedenRij = o.toegewezen - o.committed - o.besteed;
            const isAdSpend = o.id === AD_SPEND_ID;
            return (
              <div key={o.id}>
                <div className="rounded border border-[var(--border)]">
                  <button type="button" onClick={() => toggle(o.id)} className="w-full flex items-center gap-2 px-2 py-1.5 text-left">
                    {isOpen ? <ChevronDown size={14} className="text-[var(--text-tertiary)] shrink-0" /> : <ChevronRight size={14} className="text-[var(--text-tertiary)] shrink-0" />}
                    <span className="text-sm text-[var(--text-primary)] truncate flex-1">{o.naam || 'Naamloos'}</span>
                    <span className={`text-xs tabular-nums ${over ? 'text-red-500 font-semibold' : 'text-[var(--text-secondary)]'}`}>€ {euro(verbruikt)} / € {euro(o.toegewezen)}</span>
                  </button>
                  {isOpen && (
                    <div className="px-2 pb-2 pt-1 space-y-2 border-t border-[var(--border)]">
                      <input value={o.naam} placeholder="Naam onderdeel" onChange={e => patchNaam(o.id, e.target.value)} className={numCls} />
                      <div>
                        <label className="block text-[10px] text-[var(--text-secondary)] mb-0.5">Toegewezen</label>
                        <div className="flex gap-1">
                          <div className="flex items-center flex-1">
                            <span className="text-xs text-[var(--text-tertiary)] pr-1">€</span>
                            <input type="number" value={Math.round(o.toegewezen) || ''} step={50} onChange={e => patchNum(o.id, 'toegewezen', parseFloat(e.target.value) || 0)} className={numCls} />
                          </div>
                          <div className="flex items-center w-20">
                            <input type="number" value={budget > 0 ? Math.round((o.toegewezen / budget) * 100) : 0} step={1} onChange={e => setToegewezenPct(o.id, parseFloat(e.target.value) || 0)} className={numCls} />
                            <span className="text-xs text-[var(--text-tertiary)] pl-1">%</span>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-[var(--text-secondary)] mb-0.5">Committed €</label>
                          <input type="number" value={Math.round(o.committed) || ''} step={50} onChange={e => patchNum(o.id, 'committed', parseFloat(e.target.value) || 0)} className={numCls} />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[var(--text-secondary)] mb-0.5">Besteed €</label>
                          <input type="number" value={Math.round(o.besteed) || ''} step={50} onChange={e => patchNum(o.id, 'besteed', parseFloat(e.target.value) || 0)} className={numCls} />
                        </div>
                      </div>
                      <div className={`text-xs ${teBestedenRij < 0 ? 'text-red-500 font-semibold' : 'text-[var(--text-secondary)]'}`}>
                        Te besteden: € {euro(teBestedenRij)}
                      </div>
                      <button type="button" onClick={() => removeRij(o.id)} className="flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-red-500">
                        <X size={12} /> verwijderen
                      </button>
                    </div>
                  )}
                </div>
                {isAdSpend && (
                  <div className="text-[10px] text-[var(--text-tertiary)] px-2 pt-0.5">
                    Gemiddelde CAC ≈ {webshopVerkopen > 0 ? `€ ${gemiddeldeCac.toFixed(2)}` : '—'} per webshop-aankoop
                  </div>
                )}
              </div>
            );
          })}
          <button type="button" onClick={() => addRij(groep.key)} className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline mt-0.5 px-2">
            <Plus size={12} /> onderdeel
          </button>
        </div>
      ))}
    </div>
  );
}
