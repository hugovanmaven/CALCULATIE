import type { TitelInput } from '../../api/types';
import { Section } from '../layout/Section';
import { BasisgegevensSection } from './BasisgegevensSection';
import { KostenpostenSection } from './KostenpostenSection';
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
  herdrukOplages?: number[];
  setHerdrukOplages?: (v: number[]) => void;
  verdeling: { webshop: number; retail: number; b2b: number };
  setVerdeling: (v: { webshop: number; retail: number; b2b: number }) => void;
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
}: Props) {
  return (
    <div className="space-y-1">
      {/* ─── TITEL & BOEK ─── */}
      <Section title="Basisgegevens" defaultOpen>
        <BasisgegevensSection titelInput={titelInput} updateField={updateField} />
      </Section>

      {/* ─── PRODUCTIE & KOSTEN ─── */}
      <GroupLabel>Productie &amp; kosten</GroupLabel>

      <Section title="Kostenposten" defaultOpen>
        <KostenpostenSection titelInput={titelInput} updateField={updateField} />
      </Section>

      {/* ─── VERKOOPKANALEN ─── */}
      <GroupLabel>Verkoopkanalen</GroupLabel>

      <Section title="Verdeling kanalen" defaultOpen>
        <VerdelingSection verdeling={verdeling} setVerdeling={setVerdeling} />
      </Section>

      <Section title="Webshop kosten">
        <WebshopKostenSection titelInput={titelInput} updateField={updateField} />
      </Section>

      <Section title="Retail / CB kosten">
        <RetailKostenSection titelInput={titelInput} updateField={updateField} />
      </Section>

      <Section title="B2B kosten">
        <B2bKostenSection titelInput={titelInput} updateField={updateField} />
      </Section>

      {/* ─── DEALS & PARTNERS ─── */}
      <GroupLabel>Deals &amp; partners</GroupLabel>

      <Section title="Auteur deal" defaultOpen>
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
