// View 2 — detail per titel: stroom-uitsplitsing + calculatie-check, kanalen, vormen.
import { useEffect, useState } from 'react';
import type { TitelResultaat, GeboekteRegel, Stroom, OverheadKandidaat } from './api';
import { euro, euro2, pct, getal, getKosten, setVerklaring, afsluiten, zoekKosten, herkoppel, KANAAL_LABEL, STROOM_STATUS } from './api';
import { MargeBadge } from './MargeBadge';
import { ArrowLeft, Lock, Unlock, Search } from 'lucide-react';

const GAP_STATUSSEN = new Set(['verwacht_nog', 'onverklaard', 'niet_gemaakt', 'verkeerd_geboekt']);

export default function TitelDetail({
  data,
  onBack,
  onRefresh,
}: {
  data: TitelResultaat;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const [regels, setRegels] = useState<GeboekteRegel[]>([]);
  const [edit, setEdit] = useState<string | null>(null); // stroom-key in bewerking
  const isKwartaal = data.periode.includes('-');

  useEffect(() => {
    getKosten(data.isbn, data.periode).then(setRegels).catch(() => setRegels([]));
  }, [data.isbn, data.periode]);

  const teVerklaren = data.accuratesse.te_verklaren;

  const toggleAfsluiten = async () => {
    await afsluiten(data.periode, !data.afgesloten);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Terug naar overzicht
      </button>

      <div>
        <h2 className="text-xl font-bold text-[var(--text-primary)]">{data.titel}</h2>
        <div className="text-sm text-[var(--text-tertiary)]">
          {data.isbn} · alle vormen samen · {data.periode}
        </div>
      </div>

      {/* KPI's */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card label="Verkocht" value={getal(data.verkocht.totaal)} sub="exemplaren" />
        <Card label="Netto omzet" value={euro(data.netto_omzet)} />
        <Card
          label="Brutowinst"
          value={euro(data.brutowinst)}
          extra={<MargeBadge marge={data.marge_pct} status={data.status} />}
          sub={`streef ${pct(data.streef_pct)}`}
        />
        <Card label="Resultaat" value={euro(data.resultaat)} sub={`na winstdeling · ${pct(data.resultaat_marge_pct)}`} />
      </div>

      <MargeBalk marge={data.marge_pct} streef={data.streef_pct} ondergrens={data.ondergrens_pct} />

      {/* Calculatie-check banner + kwartaal afsluiten */}
      {isKwartaal && (
        <div
          className={`rounded-xl border p-3 flex items-center justify-between gap-3 flex-wrap ${
            data.afgesloten && teVerklaren > 0
              ? 'border-amber-300 bg-amber-50'
              : 'border-[var(--border)] bg-[var(--bg-secondary)]'
          }`}
        >
          <div className="text-sm">
            <span className="font-semibold text-[var(--text-primary)]">Calculatie-check</span>{' '}
            {data.afgesloten ? (
              teVerklaren > 0 ? (
                <span className="text-amber-800">
                  — {teVerklaren} {teVerklaren === 1 ? 'post' : 'posten'} nog te verklaren: klopt het dat die kosten
                  niet gemaakt zijn, of komen ze nog?
                </span>
              ) : (
                <span className="text-emerald-700">— alle verschillen verklaard ✓</span>
              )
            ) : (
              <span className="text-[var(--text-tertiary)]">
                — kwartaal nog open; ongeboekte posten gelden als 'verwacht nog'. Sluit af om de balans op te maken.
              </span>
            )}
          </div>
          <button
            onClick={toggleAfsluiten}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            {data.afgesloten ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            {data.afgesloten ? 'Heropenen' : 'Kwartaal afsluiten'}
          </button>
        </div>
      )}

      {/* Stromen + verklaring */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[var(--border)] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Kosten per stroom</h3>
          <span className="text-xs text-[var(--text-tertiary)]">
            {data.dekkingsgraad_pct > 0 ? `${pct(data.dekkingsgraad_pct)} geboekt` : 'nog geen kosten geboekt'}
          </span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[var(--text-tertiary)] text-xs border-b border-[var(--border)]">
              <th className="text-left font-medium px-4 py-2">Stroom</th>
              <th className="text-right font-medium px-3 py-2">Begroot</th>
              <th className="text-right font-medium px-3 py-2">Geboekt</th>
              <th className="text-right font-medium px-3 py-2">Verschil</th>
              <th className="text-left font-medium px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.stromen.map((s) => (
              <StroomRow
                key={s.key}
                s={s}
                editing={edit === s.key}
                onEdit={() => setEdit(edit === s.key ? null : s.key)}
                onSave={async (status, notitie) => {
                  await setVerklaring(data.recept_id, data.periode, s.key, status, notitie);
                  setEdit(null);
                  onRefresh();
                }}
              />
            ))}
            <tr className="bg-[var(--bg-hover)] font-semibold">
              <td className="px-4 py-2 text-[var(--text-primary)]">Totaal kosten</td>
              <td></td>
              <td></td>
              <td></td>
              <td className="px-3 py-2 text-[var(--text-primary)] tabular-nums">{euro(data.kosten_totaal)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Scenario 2 — ontbrekende kosten in de overhead-pool opsporen */}
      <OntbrekendeKosten receptId={data.recept_id} onChanged={onRefresh} />

      {/* Kanalen + vormen */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] px-4 py-2.5 border-b border-[var(--border)]">
            Per kanaal
          </h3>
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(data.kanalen).map(([k, v]) => (
                <tr key={k} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-2 text-[var(--text-primary)]">{KANAAL_LABEL[k] ?? k}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">{getal(v.stuks)} ex</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text-primary)]">{euro(v.omzet)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-[var(--text-tertiary)]">{euro2(v.prijs_ex_btw)}/ex</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] px-4 py-2.5 border-b border-[var(--border)]">
            Per vorm
          </h3>
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(data.vormen).map(([k, v]) => (
                <tr key={k} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-2 text-[var(--text-primary)] capitalize">{k}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">{getal(v.stuks)} ex</td>
                  <td className="px-4 py-2 text-right tabular-nums text-[var(--text-primary)]">{euro(v.omzet)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Geboekte Exact-regels achter de cijfers */}
      {regels.length > 0 && (
        <details className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden group">
          <summary className="px-4 py-2.5 cursor-pointer select-none text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-hover)]">
            Geboekte Exact-regels ({regels.length})
          </summary>
          <table className="w-full text-sm border-t border-[var(--border)]">
            <thead>
              <tr className="text-[var(--text-tertiary)] text-xs border-b border-[var(--border)]">
                <th className="text-left font-medium px-4 py-2">Datum</th>
                <th className="text-left font-medium px-3 py-2">Relatie</th>
                <th className="text-left font-medium px-3 py-2 hidden sm:table-cell">Grootboek</th>
                <th className="text-left font-medium px-3 py-2">Stroom</th>
                <th className="text-right font-medium px-4 py-2">Bedrag</th>
              </tr>
            </thead>
            <tbody>
              {regels.map((r) => (
                <tr key={r.exact_ref} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-2 text-[var(--text-tertiary)] tabular-nums">{r.datum}</td>
                  <td className="px-3 py-2 text-[var(--text-primary)]">{r.relatie || '—'}</td>
                  <td className="px-3 py-2 text-[var(--text-tertiary)] hidden sm:table-cell">{r.grootboek}</td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">{r.categorie}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-[var(--text-primary)]">{euro(r.bedrag)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {data.royalty_staffel_pct > 0 && (
        <p className="text-xs text-[var(--text-tertiary)] px-1">
          Royalty-staffel op {pct(data.royalty_staffel_pct)} (groep-cumulatief ± {getal(data.cumulatief_opening)} ex bij
          aanvang periode). Royalty wordt jaarlijks tegen SFP afgerekend (true-up).
        </p>
      )}
    </div>
  );
}

function OntbrekendeKosten({ receptId, onChanged }: { receptId: string; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ dry_run: boolean; pool: number; kandidaten?: OverheadKandidaat[] } | null>(null);
  const [gekoppeld, setGekoppeld] = useState<Set<string>>(new Set());

  const zoek = async () => {
    setBusy(true);
    try {
      setRes(await zoekKosten(receptId));
    } catch {
      setRes(null);
    } finally {
      setBusy(false);
    }
  };

  const koppel = async (ref: string) => {
    await herkoppel(ref, receptId);
    setGekoppeld((s) => new Set(s).add(ref));
    onChanged();
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Ontbrekende kosten opsporen</h3>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
            Doorzoekt de Exact-overhead (kosten zonder titel) op posten die eigenlijk bij deze titel horen —
            zo zie je geen gemaakte kosten over het hoofd.
          </p>
        </div>
        <button
          onClick={zoek}
          disabled={busy}
          className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)] disabled:opacity-50 transition-colors"
        >
          <Search className="w-4 h-4" /> {busy ? 'Zoeken…' : 'Zoek in overhead'}
        </button>
      </div>

      {res && res.dry_run && (
        <p className="mt-3 text-xs text-[var(--text-tertiary)]">
          LLM-zoeken vereist de <code>ANTHROPIC_API_KEY</code> (op de server). Overhead-pool: {res.pool} regels
          klaar om te doorzoeken.
        </p>
      )}
      {res && !res.dry_run && (res.kandidaten?.length ? (
        <div className="mt-3 space-y-2">
          {res.kandidaten.map((k) => (
            <div key={k.exact_ref} className="flex items-start justify-between gap-3 border border-[var(--border)] rounded-lg p-2.5">
              <div className="text-sm">
                <div className="text-[var(--text-primary)]">
                  {k.relatie} · {euro(k.bedrag)} <span className="text-[var(--text-tertiary)]">({Math.round(k.confidence * 100)}%)</span>
                </div>
                <div className="text-xs text-[var(--text-tertiary)]">{k.grootboek} — {k.reden}</div>
              </div>
              {gekoppeld.has(k.exact_ref) ? (
                <span className="text-xs text-emerald-700 whitespace-nowrap">gekoppeld ✓</span>
              ) : (
                <button
                  onClick={() => koppel(k.exact_ref)}
                  className="text-xs font-medium px-2.5 py-1 rounded-md bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] whitespace-nowrap"
                >
                  Koppel aan titel
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-[var(--text-tertiary)]">Geen kandidaten gevonden in {res.pool} overhead-regels.</p>
      ))}
    </div>
  );
}

function StroomRow({
  s,
  editing,
  onEdit,
  onSave,
}: {
  s: Stroom;
  editing: boolean;
  onEdit: () => void;
  onSave: (status: string, notitie: string) => void;
}) {
  const meta = STROOM_STATUS[s.status] ?? { label: s.status, cls: 'bg-gray-100 text-gray-600 ring-gray-500/20' };
  const isGap = GAP_STATUSSEN.has(s.status);
  return (
    <>
      <tr className="border-b border-[var(--border)]">
        <td className="px-4 py-2 text-[var(--text-primary)]">{s.label}</td>
        <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">{euro(s.begroot)}</td>
        <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">{s.geboekt > 0 ? euro(s.geboekt) : '—'}</td>
        <td className="px-3 py-2 text-right tabular-nums text-[var(--text-tertiary)]">
          {Math.abs(s.verschil) > 0.5 ? euro(s.verschil) : '—'}
        </td>
        <td className="px-3 py-2">
          {meta.label && (
            <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md ring-1 ring-inset ${meta.cls}`}>
              {meta.label}
            </span>
          )}
          {isGap && (
            <button
              onClick={onEdit}
              className="ml-2 text-xs text-[var(--accent)] hover:underline"
            >
              {editing ? 'sluiten' : 'verklaar'}
            </button>
          )}
          {s.notitie && !editing && (
            <span className="block text-xs text-[var(--text-tertiary)] mt-0.5 italic">"{s.notitie}"</span>
          )}
        </td>
      </tr>
      {editing && (
        <tr className="bg-[var(--bg-hover)]">
          <td colSpan={5} className="px-4 py-3">
            <VerklaarEditor s={s} onSave={onSave} />
          </td>
        </tr>
      )}
    </>
  );
}

function VerklaarEditor({ s, onSave }: { s: Stroom; onSave: (status: string, notitie: string) => void }) {
  const [notitie, setNotitie] = useState(s.notitie || '');
  const keuzes = [
    { key: 'verwacht_nog', label: 'Komt nog' },
    { key: 'niet_gemaakt', label: 'Niet gemaakt' },
    { key: 'verkeerd_geboekt', label: 'Stond elders geboekt' },
    { key: '', label: 'Wis verklaring' },
  ];
  return (
    <div className="space-y-2">
      <div className="text-xs text-[var(--text-secondary)]">
        Verschil van {euro(s.verschil)} op <strong>{s.label}</strong> verklaren:
      </div>
      <div className="flex flex-wrap gap-1.5">
        {keuzes.map((k) => (
          <button
            key={k.key || 'wis'}
            onClick={() => onSave(k.key, notitie)}
            className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
              s.verklaring_status === k.key
                ? 'border-[var(--accent)] text-[var(--text-primary)] bg-[var(--accent-light)]'
                : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>
      <input
        value={notitie}
        onChange={(e) => setNotitie(e.target.value)}
        placeholder="Notitie (bv. waarom niet gemaakt) — opgeslagen bij je keuze"
        className="w-full text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 bg-[var(--bg-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
      />
    </div>
  );
}

function Card({ label, value, sub, extra }: { label: string; value: string; sub?: string; extra?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-3">
      <div className="text-xs text-[var(--text-tertiary)] mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold text-[var(--text-primary)] tabular-nums">{value}</span>
        {extra}
      </div>
      {sub && <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{sub}</div>}
    </div>
  );
}

function MargeBalk({ marge, streef, ondergrens }: { marge: number; streef: number; ondergrens: number }) {
  const max = Math.max(streef * 1.6, marge * 1.1, 0.5);
  const x = (v: number) => `${Math.min((v / max) * 100, 100)}%`;
  const barColor = marge >= streef ? 'bg-emerald-500' : marge >= ondergrens ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
      <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)] mb-2">
        <span>Brutomarge</span>
        <span>{pct(marge)}</span>
      </div>
      <div className="relative h-3 rounded-full bg-[var(--bg-hover)]">
        <div className={`absolute inset-y-0 left-0 rounded-full ${barColor}`} style={{ width: x(marge) }} />
        <Marker pos={x(ondergrens)} label={`ondergrens ${pct(ondergrens)}`} />
        <Marker pos={x(streef)} label={`streef ${pct(streef)}`} strong />
      </div>
      <div className="h-5" />
    </div>
  );
}

function Marker({ pos, label, strong }: { pos: string; label: string; strong?: boolean }) {
  return (
    <div className="absolute top-0 bottom-0" style={{ left: pos }}>
      <div className={`w-px h-full ${strong ? 'bg-[var(--text-secondary)]' : 'bg-[var(--text-tertiary)]'}`} />
      <div className="absolute top-3.5 -translate-x-1/2 whitespace-nowrap text-[10px] text-[var(--text-tertiary)]">{label}</div>
    </div>
  );
}
