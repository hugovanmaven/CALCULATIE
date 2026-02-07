import type { DrukResultaat } from '../../api/types';
import { KanaalDetail } from './KanaalDetail';

interface Props {
  druk: DrukResultaat;
}

export function DrukResultCard({ druk }: Props) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">{druk.druk_type}</h3>
        <div className="text-sm text-gray-500">
          Oplage: {druk.oplage.toLocaleString()} ex.
          {druk.cumulatief_voor_druk > 0 && (
            <span className="ml-2 text-xs text-gray-400">
              (cum. {druk.cumulatief_voor_druk.toLocaleString()} vóór druk)
            </span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KanaalDetail kanaal={druk.webshop} label="Webshop" />
        <KanaalDetail kanaal={druk.retail} label="Retail / CB" />
        <KanaalDetail kanaal={druk.b2b} label="B2B" />
      </div>
    </div>
  );
}
