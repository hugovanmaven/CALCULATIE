import { Download } from 'lucide-react';
import type { TitelInput } from '../../api/types';

interface Props {
  titelInput: TitelInput;
  verdeling: { webshop: number; retail: number; b2b: number };
}

export function ExportButtons({ titelInput, verdeling }: Props) {
  const handleExportCsv = async () => {
    try {
      const res = await fetch('/calculatie/api/export/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titel_input: titelInput,
          verdeling_webshop: verdeling.webshop,
          verdeling_retail: verdeling.retail,
          verdeling_b2b: verdeling.b2b,
        }),
      });

      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `calculatie_${titelInput.titel.replace(/\s+/g, '_') || 'export'}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export error:', e);
      alert('Export mislukt. Controleer of alle gegevens correct zijn ingevuld.');
    }
  };

  return (
    <button
      onClick={handleExportCsv}
      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
    >
      <Download size={16} />
      Download CSV
    </button>
  );
}
