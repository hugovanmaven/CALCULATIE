// Kwartaal-flow: importeer verkoop (sales), Exact-kosten en SFP-verkoophistorie.
import { useRef, useState } from 'react';
import { importExact, importSfp, importSales, periodeLabel } from './api';
import { Upload, Check, History, ShoppingCart } from 'lucide-react';

export default function ImportPanel({
  onImported,
  periode,
  laatsteSync,
}: {
  onImported: () => void;
  periode: string;
  laatsteSync: string | null;
}) {
  return (
    <div className="space-y-4">
      <SalesImport onImported={onImported} periode={periode} laatsteSync={laatsteSync} />
      <div className="grid sm:grid-cols-2 gap-4">
        <ExactImport onImported={onImported} />
        <SfpImport onImported={onImported} />
      </div>
    </div>
  );
}

// '2026-Q2' → {jaar:'2026', kwartaal:'2'}; jaartotaal → leeg (dan vraagt de UI erom).
function splitPeriode(p: string): { jaar: string; kwartaal: string } {
  const [jaar, q] = (p || '').split('-Q');
  return { jaar: jaar || '', kwartaal: q || '' };
}

function SalesImport({ onImported, periode, laatsteSync }: { onImported: () => void; periode: string; laatsteSync: string | null }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const init = splitPeriode(periode);
  const [jaar, setJaar] = useState(init.jaar || '2026');
  const [kwartaal, setKwartaal] = useState(init.kwartaal || '1');

  const handle = async (file: File) => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await importSales(file, jaar, kwartaal);
      setMsg(`${r.rijen} verkoopregels verwerkt (${r.nieuw} nieuw, ${r.bijgewerkt} bijgewerkt).`);
      onImported();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Import mislukt.');
    } finally {
      setBusy(false);
    }
  };

  const syncTekst = laatsteSync
    ? `Laatste sync: ${new Date(laatsteSync).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' })}`
    : 'Nog geen verkoopdata geladen — upload een export om te beginnen.';

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-1.5">
            <ShoppingCart className="w-4 h-4 text-[var(--text-secondary)]" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Verkoop importeren (sales)</h3>
          </div>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5 max-w-xl">
            Upload een verkoopexport (CSV of .xlsx) per kwartaal — herkent kolommen als isbn, titel, kanaal,
            stuks en omzet. Dit vult het overzicht met omzet en titels. {' '}
            <span className={laatsteSync ? 'text-[var(--text-secondary)]' : 'text-amber-700'}>{syncTekst}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={jaar}
            onChange={(e) => setJaar(e.target.value)}
            className="text-sm border border-[var(--border)] rounded-lg px-2 py-1.5 bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
          >
            {['2024', '2025', '2026', '2027'].map((j) => <option key={j} value={j}>{j}</option>)}
          </select>
          <select
            value={kwartaal}
            onChange={(e) => setKwartaal(e.target.value)}
            title="Voor welk kwartaal geldt dit bestand? (tenzij het bestand zelf jaar/kwartaal-kolommen heeft)"
            className="text-sm border border-[var(--border)] rounded-lg px-2 py-1.5 bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
          >
            {['1', '2', '3', '4'].map((q) => <option key={q} value={q}>Q{q}</option>)}
          </select>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
          >
            <Upload className="w-4 h-4" /> {busy ? 'Bezig…' : 'Kies bestand'}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx"
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
          <Check className="w-4 h-4" /> {msg} <span className="text-[var(--text-tertiary)]">({periodeLabel(`${jaar}-Q${kwartaal}`)})</span>
        </div>
      )}
      {err && <div className="mt-3 text-xs text-red-600">{err}</div>}
    </div>
  );
}

function ExactImport({ onImported }: { onImported: () => void }) {
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
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Exact-kosten importeren</h3>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
            De kwartaal-export uit Exact (FinTransactions, .xlsx). Opnieuw uploaden is veilig.
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

function SfpImport({ onImported }: { onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cutover, setCutover] = useState('2026-01-01');

  const handle = async (file: File) => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await importSfp(file, cutover);
      setMsg(`${r.rijen} edities verwerkt (${r.nieuw} nieuw, ${r.bijgewerkt} bijgewerkt).`);
      onImported();
    } catch {
      setErr('Import mislukt — is dit een SFP-export (.xlsx) en klopt de datum?');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-secondary)] p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">SFP-historie importeren</h3>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
            Cumulatieve verkoop per titel t/m de cutover-datum — bepaalt de royalty-staffelstand en de
            verkoophistorie.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={cutover}
            onChange={(e) => setCutover(e.target.value)}
            title="T/m welke datum loopt deze export?"
            className="text-sm border border-[var(--border)] rounded-lg px-2 py-1.5 bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)] disabled:opacity-50 transition-colors"
          >
            <History className="w-4 h-4" /> {busy ? 'Bezig…' : 'Kies bestand'}
          </button>
        </div>
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
