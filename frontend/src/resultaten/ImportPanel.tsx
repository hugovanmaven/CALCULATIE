// Kwartaal-flow: upload een Exact FinTransactions-export → geboekte kosten.
import { useRef, useState } from 'react';
import { importExact } from './api';
import { Upload, Check } from 'lucide-react';

export default function ImportPanel({ onImported }: { onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const handle = async (file: File) => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await importExact(file);
      setMsg(`${r.rijen} regels verwerkt (${r.nieuw} nieuw, ${r.bijgewerkt} bijgewerkt).`);
      onImported();
    } catch {
      setErr('Import mislukt — is dit een Exact FinTransactions-export (.xlsx)?');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-secondary)] p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Exact-kosten importeren</h3>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
            Upload de kwartaal-export uit Exact (FinTransactions, .xlsx). Geboekte kosten overschrijven
            de begroting per stroom. Opnieuw uploaden is veilig (idempotent).
          </p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
        >
          <Upload className="w-4 h-4" /> {busy ? 'Bezig…' : 'Kies bestand'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handle(f);
            e.target.value = '';
          }}
        />
      </div>
      {msg && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-700">
          <Check className="w-4 h-4" /> {msg}
        </div>
      )}
      {err && <div className="mt-3 text-xs text-red-600">{err}</div>}
    </div>
  );
}
