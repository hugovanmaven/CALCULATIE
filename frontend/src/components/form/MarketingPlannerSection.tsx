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
  const budget = berekenMarketingBudget(titelInput, verdeling);
  const pct = Math.round((druk.marketing_budget_pct ?? 0.08) * 100);
  // Afgeleid uit Ad-spend; is er geen ad-spend, val terug op een reeds
  // ingevulde cac_per_ex (bestaande titels) zodat de getoonde CAC klopt.
  const gemiddeldeCac = berekenGemiddeldeCac(titelInput, verdeling) || (druk.cac_per_ex ?? 0);
  const totaleOplage = titelInput.drukken.reduce((s, d) => s + d.oplage, 0);
  const webshopVerkopen = verdeling.webshop * totaleOplage;

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

  const setOnderdelen = (next: MarketingOnderdeel[]) =>
    onDrukChange({ ...druk, marketing_onderdelen: next });
  const patchNum = (id: string, veld: 'toegewezen' | 'committed' | 'besteed', waarde: number) =>
    setOnderdelen(onderdelen.map(o => (o.id === id ? { ...o, [veld]: waarde } : o)));
  const patchNaam = (id: string, naam: string) =>
    setOnderdelen(onderdelen.map(o => (o.id === id ? { ...o, naam } : o)));
  const addRij = (groep: MarketingOnderdeel['groep']) =>
    setOnderdelen([...onderdelen, {
      id: generateOnderdeelId(), naam: '', groep,
      volgorde: onderdelen.length, toegewezen: 0, committed: 0, besteed: 0,
    }]);
  const removeRij = (id: string) => setOnderdelen(onderdelen.filter(o => o.id !== id));

  const numCls = "w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--bg-primary)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] outline-none";

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

      {/* Trechter: budget → toegewezen → committed → besteed */}
      {(() => {
        const nogToeTeWijzen = budget - totToegewezen;
        const toegewezenNietBesteed = totToegewezen - totBesteed;
        const totaalNogUitTeGeven = budget - totBesteed;
        const base = Math.max(budget, totToegewezen, 1);
        const wBesteed = (totBesteed / base) * 100;
        const wCommitted = (Math.max(0, totCommitted - totBesteed) / base) * 100;
        const wToegewezen = (Math.max(0, totToegewezen - totCommitted) / base) * 100;
        const stat = [
          { label: 'Nog toe te wijzen', val: nogToeTeWijzen },
          { label: 'Toegewezen, nog niet besteed', val: toegewezenNietBesteed },
          { label: 'Totaal nog uit te geven', val: totaalNogUitTeGeven },
        ];
        return (
          <div className="space-y-2">
            <div className="h-2.5 rounded-full overflow-hidden flex bg-[var(--border)]">
              <div className="h-full" style={{ width: `${wBesteed}%`, backgroundColor: 'var(--accent)' }} title={`Besteed € ${euro(totBesteed)}`} />
              <div className="h-full" style={{ width: `${wCommitted}%`, backgroundColor: 'var(--accent)', opacity: 0.6 }} title={`Toegezegd, nog te betalen € ${euro(Math.max(0, totCommitted - totBesteed))}`} />
              <div className="h-full" style={{ width: `${wToegewezen}%`, backgroundColor: 'var(--accent)', opacity: 0.3 }} title={`Toegewezen, nog niet toegezegd € ${euro(Math.max(0, totToegewezen - totCommitted))}`} />
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-[var(--text-tertiary)]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: 'var(--accent)' }} /> Besteed € {euro(totBesteed)}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: 'var(--accent)', opacity: 0.6 }} /> Committed € {euro(totCommitted)}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: 'var(--accent)', opacity: 0.3 }} /> Toegewezen € {euro(totToegewezen)}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--border)] inline-block" /> Vrij € {euro(Math.max(0, nogToeTeWijzen))}</span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-center pt-1">
              {stat.map(s => (
                <div key={s.label} className="rounded bg-[var(--bg-secondary)] px-1 py-1.5">
                  <div className="text-[9px] uppercase tracking-wide text-[var(--text-tertiary)] leading-tight">{s.label}</div>
                  <div className={`text-xs font-semibold ${s.val < 0 ? 'text-red-500' : 'text-[var(--text-primary)]'}`}>€ {euro(s.val)}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {GROEPEN.map(groep => (
        <div key={groep.key} className="space-y-1">
          <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">{groep.label}</div>
          {onderdelen.filter(o => o.groep === groep.key).map(o => {
            const isOpen = open.has(o.id);
            // Trechter: committed (incl. besteed) zit ín toegewezen.
            const over = o.committed > o.toegewezen && o.toegewezen > 0;
            const nogToeTeZeggen = o.toegewezen - o.committed;
            const isAdSpend = o.id === AD_SPEND_ID;
            return (
              <div key={o.id}>
                <div className="rounded border border-[var(--border)]">
                  <button type="button" onClick={() => toggle(o.id)} className="w-full flex items-center gap-2 px-2 py-1.5 text-left">
                    {isOpen ? <ChevronDown size={14} className="text-[var(--text-tertiary)] shrink-0" /> : <ChevronRight size={14} className="text-[var(--text-tertiary)] shrink-0" />}
                    <span className="text-sm text-[var(--text-primary)] truncate flex-1">{o.naam || 'Naamloos'}</span>
                    <span className={`text-xs tabular-nums ${over ? 'text-red-500 font-semibold' : 'text-[var(--text-secondary)]'}`}>€ {euro(o.committed)} / € {euro(o.toegewezen)}</span>
                  </button>
                  {isOpen && (
                    <div className="px-2 pb-2 pt-1 space-y-2 border-t border-[var(--border)]">
                      <input value={o.naam} placeholder="Naam onderdeel" onChange={e => patchNaam(o.id, e.target.value)} className={numCls} />
                      <div>
                        <label className="block text-[10px] text-[var(--text-secondary)] mb-0.5">Toegewezen €</label>
                        <div className="flex items-center">
                          <span className="text-xs text-[var(--text-tertiary)] pr-1">€</span>
                          <input type="number" value={Math.round(o.toegewezen) || ''} step={50} onChange={e => patchNum(o.id, 'toegewezen', parseFloat(e.target.value) || 0)} className={numCls} />
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
                      <div className={`text-xs ${nogToeTeZeggen < 0 ? 'text-red-500 font-semibold' : 'text-[var(--text-secondary)]'}`}>
                        Nog toe te zeggen: € {euro(nogToeTeZeggen)}
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
