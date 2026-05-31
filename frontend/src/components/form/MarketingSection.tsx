import type { TitelInput } from '../../api/types';
import { NumberInput } from './NumberInput';

interface Props {
  titelInput: TitelInput;
  updateField: <K extends keyof TitelInput>(field: K, value: TitelInput[K]) => void;
}

/**
 * Marketing-uitgaven die per webshop-verkoop worden gemaakt.
 *
 * CAC = Customer Acquisition Cost: gemiddeld bedrag dat je aan ads
 * uitgeeft om één extra webshop-verkoop te genereren. Hoort conceptueel
 * niet bij webshop-fulfillment (= operationele kanaalkosten), vandaar
 * een eigen sectie.
 *
 * Eenmalige marketing-budgetten (campagne, evenement, boekmateriaal)
 * staan per druk onder "Productie & kosten" als offline/online marketing.
 */
export function MarketingSection({ titelInput, updateField }: Props) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-x-3 gap-y-3">
        <NumberInput
          label="CAC per ex (webshop)"
          value={titelInput.cac_per_ex}
          onChange={v => updateField('cac_per_ex', v)}
          prefix="€"
          help="Gemiddelde online-ad-uitgave per webshop-aankoop"
        />
      </div>
      <p className="text-[11px] text-[var(--text-tertiary)]">
        Eenmalige marketing-budgetten (campagne, materiaal, fee) staan
        per druk onder Productie &amp; kosten.
      </p>
    </div>
  );
}
