import { useEffect } from 'react';
import type { TitelInput, DrukConfig } from '../../api/types';
import { Section } from '../layout/Section';
import { BasisgegevensSection } from './BasisgegevensSection';
import { TitelgroepPicker } from './TitelgroepPicker';
import { DrukKostenBlock, PRODUCTIE_CATEGORIES } from './KostenpostenSection';
import { MarketingPlannerSection } from './MarketingPlannerSection';
import { WebshopKostenSection } from './WebshopKostenSection';
import { RetailKostenSection } from './RetailKostenSection';
import { B2bKostenSection } from './B2bKostenSection';
import { AuteurDealSection } from './AuteurDealSection';
import { DerdenSection } from './DerdenSection';
import { PartnershipSection } from './PartnershipSection';
import { OverigeKostenSection } from './OverigeKostenSection';
import { VerdelingSection } from './VerdelingSection';

interface Props {
  titelInput: TitelInput;
  updateField: <K extends keyof TitelInput>(field: K, value: TitelInput[K]) => void;
  verdeling: { webshop: number; retail: number; b2b: number };
  setVerdeling: (v: { webshop: number; retail: number; b2b: number }) => void;
  titelgroepId: string | null;
  setTitelgroepId: (id: string | null) => void;
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-3 pb-1 px-1">
      <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">
        {children}
      </span>
      <div className="flex-1 h-px bg-[var(--border)]" />
    </div>
  );
}

export function CalculatieForm({
  titelInput, updateField,
  verdeling, setVerdeling,
  titelgroepId, setTitelgroepId,
}: Props) {
  const drukken = titelInput.drukken ?? [];

  const updateDruk = (idx: number, updated: DrukConfig) => {
    updateField('drukken', drukken.map((d, i) => (i === idx ? updated : d)));
  };

  // Houd cac_per_ex per druk in sync met de afgeleide gemiddelde CAC (ad-spend / webshop-verkopen),
  // zodat de engine/marge (die cac_per_ex op het webshop-kanaal leest) klopt.
  useEffect(() => {
    let changed = false;
    const next = drukken.map(d => {
      const ad = (d.marketing_onderdelen ?? []).find(o => o.id === 'ad_spend');
      // Alleen afleiden zodra er ad-spend is toegewezen. Is Ad-spend € 0
      // (o.a. bestaande titels), dan laten we een reeds ingevulde cac_per_ex
      // staan i.p.v. 'm naar 0 te overschrijven.
      if (!ad || ad.toegewezen <= 0) return d;
      const webshopVerkopen = verdeling.webshop * d.oplage;
      const derived = webshopVerkopen > 0 ? ad.toegewezen / webshopVerkopen : 0;
      if (Math.abs((d.cac_per_ex ?? 0) - derived) > 1e-6) { changed = true; return { ...d, cac_per_ex: derived }; }
      return d;
    });
    if (changed) updateField('drukken', next);
  }, [drukken, verdeling]);

  return (
    <div className="space-y-1">
      {/* ─── TITEL & BOEK ─── */}
      <Section title="Basisgegevens" defaultOpen>
        <BasisgegevensSection titelInput={titelInput} updateField={updateField} />
        <div className="mt-3 pt-3 border-t border-[var(--border)]">
          <TitelgroepPicker value={titelgroepId} onChange={setTitelgroepId} />
        </div>
      </Section>

      {/* ─── PRODUCTIE — Section per druk ─── */}
      <GroupLabel>Productie</GroupLabel>

      {drukken.map((druk, idx) => (
        <Section
          key={`prod-${idx}`}
          title={`${druk.druknummer}e druk`}
          subtitle={`${druk.oplage.toLocaleString('nl-NL')} ex`}
          defaultOpen={idx === 0}
        >
          <DrukKostenBlock
            druk={druk}
            onDrukChange={updated => updateDruk(idx, updated)}
            categorieën={PRODUCTIE_CATEGORIES}
            totaalLabel="Totaal productie deze druk"
          />
        </Section>
      ))}

      {/* ─── MARKETING — budgetplanner per druk ─── */}
      <GroupLabel>Marketing</GroupLabel>

      {drukken.map((druk, idx) => (
        <Section
          key={`mkt-${idx}`}
          title={`${druk.druknummer}e druk`}
          subtitle={`${druk.oplage.toLocaleString('nl-NL')} ex`}
          defaultOpen={idx === 0}
        >
          <MarketingPlannerSection
            druk={druk}
            onDrukChange={updated => updateDruk(idx, updated)}
            titelInput={titelInput}
            verdeling={verdeling}
          />
        </Section>
      ))}

      {/* ─── VERKOOPKANALEN ─── */}
      <GroupLabel>Verkoopkanalen</GroupLabel>

      <Section title="Verdeling kanalen" defaultOpen>
        <VerdelingSection verdeling={verdeling} setVerdeling={setVerdeling} />
      </Section>

      <Section title="Webshopkosten">
        <WebshopKostenSection titelInput={titelInput} updateField={updateField} />
      </Section>

      <Section title="Retail / CB kosten">
        <RetailKostenSection titelInput={titelInput} updateField={updateField} />
      </Section>

      <Section title="B2B-kosten">
        <B2bKostenSection titelInput={titelInput} updateField={updateField} />
      </Section>

      {/* ─── DEALS & PARTNERS ─── */}
      <GroupLabel>Deals &amp; partners</GroupLabel>

      <Section title="Auteur" defaultOpen>
        <AuteurDealSection titelInput={titelInput} updateField={updateField} />
      </Section>

      <Section title="Derden (agent, vertaler, illustrator)">
        <DerdenSection titelInput={titelInput} updateField={updateField} />
      </Section>

      <Section title="Partnership">
        <PartnershipSection titelInput={titelInput} updateField={updateField} />
      </Section>

      {/* ─── OVERIG ─── */}
      <GroupLabel>Overig</GroupLabel>

      <Section title="Overige kosten">
        <OverigeKostenSection titelInput={titelInput} updateField={updateField} />
      </Section>
    </div>
  );
}
