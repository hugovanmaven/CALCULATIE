// View 2 — detail per titel: verifieerbare opbouw van omzet naar resultaat,
// met calculatie-check op de boekbare kosten. Terminologie volgt de calculatie-app.
import { useEffect, useMemo, useState } from 'react';
import type { TitelResultaat, GeboekteRegel, Stroom, OverheadKandidaat, TitelKeuze } from './api';
import { euro, euro2, pct, getal, getKosten, setVerklaring, afsluiten, zoekKosten, herkoppel, ontkoppel, wijsToe, getTitels, KANAAL_LABEL, STROOM_STATUS } from './api';
import { MargeBadge } from './MargeBadge';
import { Tile, TitelSelect } from './ui';
import { ArrowLeft, Lock, Unlock, Search, Info, ChevronRight, ChevronDown } from 'lucide-react';

const GAP_STATUSSEN = new Set(['verwacht_nog', 'onverklaard', 'niet_gemaakt', 'verkeerd_geboekt']);
// Afwijking is 'materieel' (vraagt actief om toelichting) vanaf dit bedrag;
// kleinere gaten (een paar honderd euro) tonen we rustig, zonder aandrang.
const MATERIEEL = 1000;

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
  const [openStroom, setOpenStroom] = useState<string | null>(null);
  const [titels, setTitels] = useState<TitelKeuze[]>([]);
  const isKwartaal = data.periode.includes('-');

  useEffect(() => {
    getKosten(data.isbn, data.periode).then(setRegels).catch(() => setRegels([]));
  }, [data.isbn, data.periode]);
  useEffect(() => { getTitels().then(setTitels).catch(() => {}); }, []);

  const regelsPerStroom = useMemo(() => {
    const map: Record<string, GeboekteRegel[]> = {};
    for (const r of regels) (map[r.resultaten_stroom] ??= []).push(r);
    return map;
  }, [regels]);

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

      {/* KPI's — zelfde volgorde als de opbouw: omzet → brutowinst → resultaat */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tile label="Verkocht" value={getal(data.verkocht.totaal)} sub="exemplaren" />
        <Tile label="Netto omzet" value={euro(data.netto_omzet)} />
        <Tile label="Brutowinst" value={euro(data.brutowinst)} sub={`marge ${pct(data.marge_pct)}`} />
        <Tile
          label="Resultaat na winstdeling"
          value={euro(data.resultaat)}
          extra={<MargeBadge marge={data.resultaat_marge_pct} status={data.status} />}
          sub={`streef ${pct(data.streef_pct)}`}
        />
      </div>

      <MargeBalk marge={data.resultaat_marge_pct} streef={data.streef_pct} ondergrens={data.ondergrens_pct} />

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
                  — {teVerklaren} kostenpost{teVerklaren === 1 ? '' : 'en'} wijk{teVerklaren === 1 ? 't' : 'en'} af van de calculatie zonder
                  toelichting.
                </span>
              ) : (
                <span className="text-emerald-700">— alle afwijkingen t.o.v. de calculatie zijn toegelicht ✓</span>
              )
            ) : (
              <span className="text-[var(--text-tertiary)]">
                — kwartaal is nog open: nog niet geboekte kosten gelden als "nog te boeken". Sluit het kwartaal af
                om de balans op te maken.
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

      {/* Opbouw van het resultaat — elk bedrag herleidbaar, geboekte regels uitklapbaar */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Van omzet naar resultaat</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[var(--text-tertiary)] text-xs border-b border-[var(--border)]">
              <th className="text-left font-medium px-4 py-2">Post</th>
              <th className="text-right font-medium px-3 py-2">Begroot</th>
              <th className="text-right font-medium px-3 py-2">In Exact</th>
              <th className="text-right font-medium px-3 py-2">Telt mee</th>
              <th className="text-left font-medium px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[var(--border)] font-medium">
              <td className="px-4 py-2 text-[var(--text-primary)]">Netto omzet</td>
              <td></td>
              <td></td>
              <td className="px-3 py-2 text-right tabular-nums text-[var(--text-primary)]">{euro(data.netto_omzet)}</td>
              <td className="px-3 py-2 text-xs text-[var(--text-tertiary)]">uit sales</td>
            </tr>
            {data.stromen
              .filter((s) => s.status !== 'leeg')
              .map((s) => (
                <StroomRow
                  key={s.key}
                  s={s}
                  regels={regelsPerStroom[s.key] ?? []}
                  titels={titels}
                  eigenReceptId={data.recept_id}
                  expanded={openStroom === s.key}
                  onToggle={() => setOpenStroom(openStroom === s.key ? null : s.key)}
                  editing={edit === s.key}
                  onEdit={() => setEdit(edit === s.key ? null : s.key)}
                  onSave={async (status, notitie) => {
                    if (!data.recept_id) return;
                    await setVerklaring(data.recept_id, data.periode, s.key, status, notitie);
                    setEdit(null);
                    onRefresh();
                  }}
                  onRegelsChanged={() => {
                    getKosten(data.isbn, data.periode).then(setRegels).catch(() => {});
                    onRefresh();
                  }}
                />
              ))}
            <TotaalRij label="Brutowinst" bedrag={data.brutowinst} sub={`marge ${pct(data.marge_pct)}`} />
            {data.winstdeling > 0 && (
              <tr className="border-b border-[var(--border)]">
                <td className="px-4 py-2 text-[var(--text-primary)]">Winstdeling auteurs & derden</td>
                <td></td>
                <td></td>
                <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">− {euro(data.winstdeling)}</td>
                <td className="px-3 py-2 text-xs text-[var(--text-tertiary)]">{pct(data.winstdeling_pct)} van brutowinst</td>
              </tr>
            )}
            <TotaalRij
              label="Resultaat"
              bedrag={data.resultaat}
              sub={pct(data.resultaat_marge_pct)}
              strong={data.overige_verkoopkosten <= 0.5}
            />
            {data.overige_verkoopkosten > 0.5 && (
              <>
                <tr className="border-b border-[var(--border)]">
                  <td className="px-4 py-2 text-[var(--text-primary)]">Overige verkoopkosten (toegerekend)</td>
                  <td></td>
                  <td></td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">− {euro(data.overige_verkoopkosten)}</td>
                  <td className="px-3 py-2 text-xs text-[var(--text-tertiary)]">naar rato van omzet</td>
                </tr>
                <TotaalRij label="Resultaat na verdeling" bedrag={data.resultaat_na_verdeling} strong />
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Voorschotten — informatief (balans/cash), telt niet in de kwartaalmarge */}
      {data.voorschotten?.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Voorschotten</h3>
          <div className="space-y-1.5">
            {data.voorschotten.map((v) => (
              <div key={v.partij} className="flex items-center justify-between gap-3 text-sm flex-wrap">
                <span className="text-[var(--text-secondary)]">
                  {v.partij} — voorschot {euro(v.voorschot)}
                </span>
                {v.open <= 0.5 ? (
                  <span className="text-xs text-emerald-700">volledig ingelopen ✓</span>
                ) : (
                  <span className="text-xs text-[var(--text-tertiary)]">
                    {euro(v.ingelopen)} ingelopen · <span className="text-amber-700">{euro(v.open)} open</span>
                    {' '}(royalty verdiend t/m nu: {euro(v.verdiend)})
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-[var(--text-tertiary)] mt-2">
            Inloopstatus over het hele leven van de titel (incl. SFP-historie). Dit is cash/balans-informatie —
            de kwartaalmarge rekent met de royalty die dít kwartaal verdiend is.
          </p>
        </div>
      )}

      {/* Scenario 2 — ontbrekende kosten in de overhead-pool opsporen */}
      {data.recept_id && <OntbrekendeKosten receptId={data.recept_id} onChanged={onRefresh} />}

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

      {data.royalty_staffel_pct > 0 && (
        <p className="text-xs text-[var(--text-tertiary)] px-1">
          Royalty & derden berekend op {pct(data.royalty_staffel_pct)} van de verkoopprijs ex BTW (staffelstand:{' '}
          {getal(data.cumulatief_opening)} ex cumulatief verkocht bij aanvang periode, inclusief SFP-historie).
          Royalty wordt jaarlijks tegen SFP afgerekend (true-up).
        </p>
      )}
    </div>
  );
}

function TotaalRij({ label, bedrag, sub, strong }: { label: string; bedrag: number; sub?: string; strong?: boolean }) {
  return (
    <tr className={`border-b border-[var(--border)] ${strong ? 'bg-[var(--bg-hover)]' : ''} font-semibold`}>
      <td className="px-4 py-2 text-[var(--text-primary)]">{label}</td>
      <td></td>
      <td></td>
      <td className="px-3 py-2 text-right tabular-nums text-[var(--text-primary)]">{euro(bedrag)}</td>
      <td className="px-3 py-2 text-xs text-[var(--text-tertiary)]">{sub}</td>
    </tr>
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
            Doorzoekt de Exact-kosten zonder titel op posten die eigenlijk bij deze titel horen —
            zo zie je geen gemaakte kosten over het hoofd.
          </p>
        </div>
        <button
          onClick={zoek}
          disabled={busy}
          className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)] disabled:opacity-50 transition-colors"
        >
          <Search className="w-4 h-4" /> {busy ? 'Zoeken…' : 'Zoek in overige kosten'}
        </button>
      </div>

      {res && res.dry_run && (
        <p className="mt-3 text-xs text-[var(--text-tertiary)]">
          LLM-zoeken vereist de <code>ANTHROPIC_API_KEY</code> (op de server). Pool: {res.pool} regels
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
        <p className="mt-3 text-xs text-[var(--text-tertiary)]">Geen kandidaten gevonden in {res.pool} regels.</p>
      ))}
    </div>
  );
}

function StroomRow({
  s,
  regels,
  titels,
  eigenReceptId,
  expanded,
  onToggle,
  editing,
  onEdit,
  onSave,
  onRegelsChanged,
}: {
  s: Stroom;
  regels: GeboekteRegel[];
  titels: TitelKeuze[];
  eigenReceptId: string | null;
  expanded: boolean;
  onToggle: () => void;
  editing: boolean;
  onEdit: () => void;
  onSave: (status: string, notitie: string) => void;
  onRegelsChanged: () => void;
}) {
  const meta = STROOM_STATUS[s.status] ?? { label: s.status, cls: 'bg-[var(--bg-hover)] text-[var(--text-secondary)] ring-[var(--border)]', uitleg: '' };
  const isGap = GAP_STATUSSEN.has(s.status);
  const materieel = Math.abs(s.verschil) >= MATERIEEL;
  const heeftRegels = regels.length > 0;

  return (
    <>
      <tr className="border-b border-[var(--border)]">
        <td className="px-4 py-2 text-[var(--text-primary)]">
          <button
            onClick={heeftRegels ? onToggle : undefined}
            className={`inline-flex items-center gap-1 ${heeftRegels ? 'hover:text-[var(--accent)]' : 'cursor-default'}`}
            title={heeftRegels ? `${regels.length} geboekte regel(s) tonen` : undefined}
          >
            {heeftRegels && (expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />)}
            <span className={heeftRegels ? '' : 'pl-[18px]'}>− {s.label}</span>
            {heeftRegels && <span className="text-[10px] text-[var(--text-tertiary)]">({regels.length})</span>}
          </button>
        </td>
        {s.berekend ? (
          <>
            <td className="px-3 py-2 text-right tabular-nums text-[var(--text-tertiary)]">—</td>
            <td className="px-3 py-2 text-right tabular-nums text-[var(--text-tertiary)]">
              {s.geboekt > 0 ? <span title="Staat wel in Exact (bv. voorschot), maar telt niet dubbel">({euro(s.geboekt)})</span> : '—'}
            </td>
          </>
        ) : (
          <>
            <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">{euro(s.begroot)}</td>
            <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">{s.geboekt > 0 ? euro(s.geboekt) : '—'}</td>
          </>
        )}
        <td className="px-3 py-2 text-right tabular-nums text-[var(--text-primary)]">{euro(s.gebruikt)}</td>
        <td className="px-3 py-2">
          {meta.label && (
            <span
              title={meta.uitleg}
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md ring-1 ring-inset cursor-help ${meta.cls}`}
            >
              {meta.label}
              {meta.uitleg && <Info className="w-3 h-3 opacity-60" />}
            </span>
          )}
          {isGap && (
            <button
              onClick={onEdit}
              className={`ml-2 text-xs whitespace-nowrap ${
                materieel ? 'text-[var(--accent)] hover:underline font-medium' : 'text-[var(--text-tertiary)] hover:underline'
              }`}
            >
              {editing ? 'sluiten' : 'toelichten'}
            </button>
          )}
          {s.notitie && !editing && (
            <span className="block text-xs text-[var(--text-tertiary)] mt-0.5 italic">"{s.notitie}"</span>
          )}
        </td>
      </tr>
      {expanded && heeftRegels && (
        <tr className="bg-[var(--bg-hover)]/40">
          <td colSpan={5} className="px-4 py-2">
            <table className="w-full text-xs ml-4">
              <tbody>
                {regels.map((r) => (
                  <RegelActieRij
                    key={r.exact_ref}
                    r={r}
                    titels={titels}
                    eigenReceptId={eigenReceptId}
                    onChanged={onRegelsChanged}
                  />
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
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

function RegelActieRij({
  r,
  titels,
  eigenReceptId,
  onChanged,
}: {
  r: GeboekteRegel;
  titels: TitelKeuze[];
  eigenReceptId: string | null;
  onChanged: () => void;
}) {
  const [kies, setKies] = useState(false);
  const [busy, setBusy] = useState(false);

  const doe = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); onChanged(); } finally { setBusy(false); setKies(false); }
  };

  return (
    <tr className="text-[var(--text-tertiary)]">
      <td className="py-1 pr-3 tabular-nums whitespace-nowrap">{r.datum}</td>
      <td className="py-1 pr-3 text-[var(--text-secondary)]">{r.relatie || '—'}</td>
      <td className="py-1 pr-3 hidden sm:table-cell">{r.grootboek}</td>
      <td className="py-1 pr-3 text-right tabular-nums text-[var(--text-primary)]">{euro(r.bedrag)}</td>
      <td className="py-1 text-right whitespace-nowrap">
        {kies ? (
          <TitelSelect
            titels={titels}
            placeholder="Verplaats naar…"
            exclude={eigenReceptId}
            disabled={busy}
            onKies={(id) => doe(() => wijsToe(r.exact_ref, id))}
            onBlur={() => setKies(false)}
            className="max-w-[180px]"
          />
        ) : (
          <>
            <button
              onClick={() => setKies(true)}
              disabled={busy}
              className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:underline mr-2"
              title="Deze regel bij een andere titel onderbrengen"
            >
              andere titel
            </button>
            <button
              onClick={() => doe(() => ontkoppel(r.exact_ref))}
              disabled={busy}
              className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:underline"
              title="Van deze titel afhalen — terug naar 'te beoordelen' in de Exact-verantwoording"
            >
              ontkoppel
            </button>
          </>
        )}
      </td>
    </tr>
  );
}

function VerklaarEditor({ s, onSave }: { s: Stroom; onSave: (status: string, notitie: string) => void }) {
  const [notitie, setNotitie] = useState(s.notitie || '');
  const keuzes = [
    { key: 'verwacht_nog', label: 'Boeking komt nog' },
    { key: 'niet_gemaakt', label: 'Kosten niet gemaakt' },
    { key: 'verkeerd_geboekt', label: 'Stond elders geboekt' },
    { key: '', label: 'Wis toelichting' },
  ];
  return (
    <div className="space-y-2">
      <div className="text-xs text-[var(--text-secondary)]">
        Op <strong>{s.label}</strong> is {euro(s.begroot)} begroot maar {s.geboekt > 0 ? `pas ${euro(s.geboekt)}` : 'nog niets'} in
        Exact geboekt ({euro(Math.max(s.verschil, 0))} open). Hoe zit dat?
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
        placeholder="Notitie (bv. welke boekingen je nog verwacht) — opgeslagen bij je keuze"
        className="w-full text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 bg-[var(--bg-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
      />
    </div>
  );
}

function MargeBalk({ marge, streef, ondergrens }: { marge: number; streef: number; ondergrens: number }) {
  const max = Math.max(streef * 1.6, marge * 1.1, 0.5);
  const x = (v: number) => `${Math.min((v / max) * 100, 100)}%`;
  const barColor = marge >= streef ? 'bg-emerald-500' : marge >= ondergrens ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
      <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)] mb-4">
        <span>Marge na winstdeling</span>
        <span className="font-medium text-[var(--text-primary)]">{pct(marge)}</span>
      </div>
      <div className="relative h-3 rounded-full bg-[var(--bg-hover)]">
        <div className={`absolute inset-y-0 left-0 rounded-full ${barColor}`} style={{ width: x(marge) }} />
        {/* labels om-en-om (ondergrens onder, streef boven) zodat ze nooit overlappen */}
        <Marker pos={x(ondergrens)} label={`ondergrens ${pct(ondergrens)}`} below />
        <Marker pos={x(streef)} label={`streef ${pct(streef)}`} strong />
      </div>
      <div className="h-5" />
    </div>
  );
}

function Marker({ pos, label, strong, below }: { pos: string; label: string; strong?: boolean; below?: boolean }) {
  return (
    <div className="absolute top-0 bottom-0" style={{ left: pos }}>
      <div className={`w-px h-full ${strong ? 'bg-[var(--text-secondary)]' : 'bg-[var(--text-tertiary)]'}`} />
      <div
        className={`absolute -translate-x-1/2 whitespace-nowrap text-[10px] text-[var(--text-tertiary)] ${
          below ? 'top-3.5' : '-top-4'
        }`}
      >
        {label}
      </div>
    </div>
  );
}
