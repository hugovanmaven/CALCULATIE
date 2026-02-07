import type { KanaalResultaat } from '../../api/types';

interface CostLine {
  label: string;
  value: number;
  highlight?: boolean;
}

function buildCostLines(k: KanaalResultaat): CostLine[] {
  const lines: CostLine[] = [
    { label: 'Verkoopprijs ex BTW', value: k.verkoopprijs_ex_btw },
  ];

  if (k.korting_bedrag > 0) {
    lines.push({ label: 'Boekhandelskorting', value: -k.korting_bedrag });
  }

  lines.push({ label: 'Netto omzet', value: k.netto_omzet, highlight: true });
  lines.push({ label: 'Drukkosten', value: -k.drukkosten });

  if (k.productie_per_ex > 0) lines.push({ label: 'Productie /ex', value: -k.productie_per_ex });
  if (k.offline_marketing_per_ex > 0) lines.push({ label: 'Offline marketing /ex', value: -k.offline_marketing_per_ex });
  if (k.online_marketing_per_ex > 0) lines.push({ label: 'Online marketing /ex', value: -k.online_marketing_per_ex });
  if (k.fulfillment > 0) lines.push({ label: 'Fulfillment', value: -k.fulfillment });
  if (k.distributie_cb > 0) lines.push({ label: 'Distributie CB', value: -k.distributie_cb });
  if (k.b2b_porto > 0) lines.push({ label: 'B2B porto', value: -k.b2b_porto });
  if (k.transactiekosten > 0) lines.push({ label: 'Transactiekosten', value: -k.transactiekosten });
  if (k.cac > 0) lines.push({ label: 'CAC', value: -k.cac });
  if (k.vertaler > 0) lines.push({ label: 'Vertaler', value: -k.vertaler });
  if (k.illustrator > 0) lines.push({ label: 'Illustrator', value: -k.illustrator });
  if (k.agent > 0) lines.push({ label: 'Agent', value: -k.agent });
  if (k.overige_kosten > 0) lines.push({ label: 'Overige kosten', value: -k.overige_kosten });

  lines.push({ label: 'Brutowinst', value: k.brutowinst, highlight: true });

  if (k.auteur_royalty > 0) lines.push({ label: 'Auteur royalty', value: -k.auteur_royalty });
  if (k.auteur_winstdeling > 0) lines.push({ label: 'Auteur winstdeling', value: -k.auteur_winstdeling });
  if (k.partner_winstdeling > 0) lines.push({ label: 'Partner winstdeling', value: -k.partner_winstdeling });

  lines.push({ label: 'Netto winst Maven', value: k.netto_winst_maven, highlight: true });

  return lines;
}

interface Props {
  kanaal: KanaalResultaat;
  label: string;
}

export function KanaalDetail({ kanaal, label }: Props) {
  const lines = buildCostLines(kanaal);

  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-600 mb-2">{label}</h4>
      <div className="space-y-0.5">
        {lines.map((line, i) => (
          <div
            key={i}
            className={`flex justify-between items-center px-2 py-1 rounded text-sm ${
              line.highlight ? 'bg-gray-100 font-semibold' : ''
            }`}
          >
            <span className="text-gray-600">{line.label}</span>
            <span className={`font-mono ${line.value < 0 ? 'text-red-600' : 'text-gray-900'}`}>
              €{line.value.toFixed(2)}
            </span>
          </div>
        ))}
        <div className="flex justify-between items-center px-2 py-1 mt-1 border-t border-gray-200">
          <span className="text-xs text-gray-500">Marge %</span>
          <span className="text-sm font-bold text-gray-800">{(kanaal.marge_pct * 100).toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}
