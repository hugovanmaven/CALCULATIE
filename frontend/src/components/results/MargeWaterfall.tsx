import type { DrukResultaat, TitelInput } from '../../api/types';

interface WaterfallLine {
  label: string;
  value: number;
  type: 'revenue' | 'cost' | 'subtotal';
}

function buildWeightedWaterfall(
  druk: DrukResultaat,
  verdeling: { webshop: number; retail: number; b2b: number },
): WaterfallLine[] {
  const ws = druk.webshop;
  const rt = druk.retail;
  const b2b = druk.b2b;
  const vw = verdeling.webshop;
  const vr = verdeling.retail;
  const vb = verdeling.b2b;

  // Weighted average helper
  const w = (field: keyof typeof ws) =>
    (ws[field] as number) * vw + (rt[field] as number) * vr + (b2b[field] as number) * vb;

  const lines: WaterfallLine[] = [];

  lines.push({ label: 'Verkoopprijs ex BTW', value: w('verkoopprijs_ex_btw'), type: 'revenue' });

  const korting = w('korting_bedrag');
  if (korting > 0) {
    lines.push({ label: 'Boekhandelskorting', value: -korting, type: 'cost' });
  }

  lines.push({ label: 'Netto omzet', value: w('netto_omzet'), type: 'subtotal' });
  lines.push({ label: 'Drukkosten', value: -w('drukkosten'), type: 'cost' });

  const prod = w('productie_per_ex');
  if (prod > 0) lines.push({ label: 'Productie /ex', value: -prod, type: 'cost' });

  const offm = w('offline_marketing_per_ex');
  if (offm > 0) lines.push({ label: 'Offline marketing /ex', value: -offm, type: 'cost' });

  const onm = w('online_marketing_per_ex');
  if (onm > 0) lines.push({ label: 'Online marketing /ex', value: -onm, type: 'cost' });

  const ful = w('fulfillment');
  if (ful > 0) lines.push({ label: 'Fulfillment', value: -ful, type: 'cost' });

  const dcb = w('distributie_cb');
  if (dcb > 0) lines.push({ label: 'Distributie CB', value: -dcb, type: 'cost' });

  const bp = w('b2b_porto');
  if (bp > 0) lines.push({ label: 'B2B porto', value: -bp, type: 'cost' });

  const tr = w('transactiekosten');
  if (tr > 0) lines.push({ label: 'Transactiekosten', value: -tr, type: 'cost' });

  const cac = w('cac');
  if (cac > 0) lines.push({ label: 'CAC', value: -cac, type: 'cost' });

  const vert = w('vertaler');
  if (vert > 0) lines.push({ label: 'Vertaler', value: -vert, type: 'cost' });

  const ill = w('illustrator');
  if (ill > 0) lines.push({ label: 'Illustrator', value: -ill, type: 'cost' });

  const ag = w('agent');
  if (ag > 0) lines.push({ label: 'Agent', value: -ag, type: 'cost' });

  const ov = w('overige_kosten');
  if (ov > 0) lines.push({ label: 'Overige kosten', value: -ov, type: 'cost' });

  lines.push({ label: 'Brutowinst', value: w('brutowinst'), type: 'subtotal' });

  const ar = w('auteur_royalty');
  if (ar > 0) lines.push({ label: 'Auteur royalty', value: -ar, type: 'cost' });

  const aw = w('auteur_winstdeling');
  if (aw > 0) lines.push({ label: 'Auteur winstdeling', value: -aw, type: 'cost' });

  const pw = w('partner_winstdeling');
  if (pw > 0) lines.push({ label: 'Partner winstdeling', value: -pw, type: 'cost' });

  lines.push({ label: 'Netto winst Maven', value: w('netto_winst_maven'), type: 'subtotal' });

  return lines;
}

interface Props {
  druk: DrukResultaat;
  verdeling: { webshop: number; retail: number; b2b: number };
  titelInput?: TitelInput;
}

export function MargeWaterfall({ druk, verdeling }: Props) {
  const lines = buildWeightedWaterfall(druk, verdeling);
  const verkoopprijs = lines[0]?.value || 1;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-600 mb-1">
        Marge per exemplaar
        <span className="text-xs font-normal text-gray-400 ml-2">
          {druk.druk_type} &mdash; gewogen gemiddelde
        </span>
      </h3>
      <p className="text-xs text-gray-400 mb-3">
        Gebaseerd op verdeling: webshop {(verdeling.webshop * 100).toFixed(0)}%, retail {(verdeling.retail * 100).toFixed(0)}%, B2B {(verdeling.b2b * 100).toFixed(0)}%
      </p>

      <div className="space-y-0">
        {lines.map((line, i) => {
          const pct = (line.value / verkoopprijs) * 100;
          const isSubtotal = line.type === 'subtotal';
          const isFirst = i === 0;
          const prefix = isSubtotal ? '= ' : isFirst ? '' : '\u2500 ';

          return (
            <div
              key={i}
              className={`flex items-center px-2 py-1 rounded text-sm ${
                isSubtotal ? 'bg-gray-100 font-semibold' : ''
              }`}
            >
              {/* label */}
              <span className="text-gray-600 flex-1 min-w-0">
                <span className="text-gray-400">{prefix}</span>
                {line.label}
              </span>

              {/* bedrag */}
              <span
                className={`font-mono w-24 text-right shrink-0 ${
                  line.value < 0 ? 'text-red-600' : 'text-gray-900'
                }`}
              >
                {line.value < 0 ? '-' : ''}&euro;{Math.abs(line.value).toFixed(2)}
              </span>

              {/* percentage */}
              <span
                className={`font-mono w-16 text-right shrink-0 text-xs ${
                  pct < 0 ? 'text-red-400' : 'text-gray-400'
                }`}
              >
                {pct >= 0 ? '' : ''}{pct.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>

      {/* marge % summary */}
      <div className="flex justify-between items-center px-2 py-1.5 mt-2 border-t border-gray-200">
        <span className="text-xs text-gray-500">Gewogen marge</span>
        <span className={`text-sm font-bold ${druk.gewogen_marge_pct >= 0 ? 'text-green-700' : 'text-red-600'}`}>
          {(druk.gewogen_marge_pct * 100).toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
