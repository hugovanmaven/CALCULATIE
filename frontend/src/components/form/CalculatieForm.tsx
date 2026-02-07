import type { TitelInput } from '../../api/types';
import { Section } from '../layout/Section';
import { BasisgegevensSection } from './BasisgegevensSection';
import { DrukkostenSection } from './DrukkostenSection';
import { ProductiekostenSection } from './ProductiekostenSection';
import { OfflineMarketingSection } from './OfflineMarketingSection';
import { OnlineMarketingSection } from './OnlineMarketingSection';
import { WebshopKostenSection } from './WebshopKostenSection';
import { RetailKostenSection } from './RetailKostenSection';
import { B2bKostenSection } from './B2bKostenSection';
import { AuteurDealSection } from './AuteurDealSection';
import { DerdenSection } from './DerdenSection';
import { PartnershipSection } from './PartnershipSection';
import { OverigeKostenSection } from './OverigeKostenSection';
import { HerdrukkenSection } from './HerdrukkenSection';
import { VerdelingSection } from './VerdelingSection';

interface Props {
  titelInput: TitelInput;
  updateField: <K extends keyof TitelInput>(field: K, value: TitelInput[K]) => void;
  herdrukOplages: number[];
  setHerdrukOplages: (v: number[]) => void;
  verdeling: { webshop: number; retail: number; b2b: number };
  setVerdeling: (v: { webshop: number; retail: number; b2b: number }) => void;
}

export function CalculatieForm({
  titelInput, updateField,
  herdrukOplages, setHerdrukOplages,
  verdeling, setVerdeling,
}: Props) {
  return (
    <div className="space-y-1">
      <Section title="Basisgegevens" defaultOpen>
        <BasisgegevensSection titelInput={titelInput} updateField={updateField} />
      </Section>

      <Section title="Drukkosten">
        <DrukkostenSection titelInput={titelInput} updateField={updateField} />
      </Section>

      <Section
        title="Productiekosten"
        subtitle="eenmalig"
      >
        <ProductiekostenSection titelInput={titelInput} updateField={updateField} />
      </Section>

      <Section title="Offline marketing" subtitle="eenmalig">
        <OfflineMarketingSection titelInput={titelInput} updateField={updateField} />
      </Section>

      <Section title="Online marketing">
        <OnlineMarketingSection titelInput={titelInput} updateField={updateField} />
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

      <Section title="Auteur deal" defaultOpen>
        <AuteurDealSection titelInput={titelInput} updateField={updateField} />
      </Section>

      <Section title="Derden (agent, vertaler, illustrator)">
        <DerdenSection titelInput={titelInput} updateField={updateField} />
      </Section>

      <Section title="Partnership">
        <PartnershipSection titelInput={titelInput} updateField={updateField} />
      </Section>

      <Section title="Overige kosten">
        <OverigeKostenSection titelInput={titelInput} updateField={updateField} />
      </Section>

      <Section title="Herdrukken">
        <HerdrukkenSection
          herdrukOplages={herdrukOplages}
          setHerdrukOplages={setHerdrukOplages}
        />
      </Section>

      <Section title="Verdeling kanalen" defaultOpen>
        <VerdelingSection verdeling={verdeling} setVerdeling={setVerdeling} />
      </Section>
    </div>
  );
}
