"""
API-blueprint voor de Resultaten-module (achter ``RESULTATEN_ENABLED``).

Geregistreerd onder ``/resultaten/api``. Read-endpoints voor de twee views
(overzicht alle titels + detail per titel) en — voor de kwartaal-flow —
import/reconcile van Exact-kosten met de zelflerende mapping.
"""

import os
import tempfile

from flask import Blueprint, jsonify, request

from datetime import datetime

from . import bereken, sales_sync
from .models import KostenGeboekt, Mapping, Verklaring, KwartaalStatus, DispositieRegel
from .exact_import import import_exact
from .storage_posten import calculatie_posten_voor
from ..db import db

bp = Blueprint("resultaten", __name__)


@bp.get("/ping")
def ping():
    """Healthcheck — bevestigt dat de module geladen en bereikbaar is."""
    return jsonify({"ok": True, "module": "resultaten"})


@bp.get("/periodes")
def periodes():
    """Beschikbare periodes (jaar + alle kwartalen) + het kwartaal om standaard
    te openen (het meest recente afgesloten kwartaal)."""
    return jsonify({"periodes": sales_sync.beschikbare_periodes(),
                    "default": sales_sync.default_periode()})


@bp.get("/titels")
def titels_lijst():
    """Lichte titel-lijst (recept_id, titel, isbn) — voor de titel-kiezer bij
    het toewijzen van een Exact-regel aan een titel."""
    from ..storage_calculatie import load_all
    # Alleen titels mét ISBN — toewijzen (herkoppel) vereist een ISBN, dus een
    # titel zonder ISBN in de kiezer zou altijd op een 400 stranden.
    uit = [{"recept_id": rid, "titel": rec.get("titel_input", {}).get("titel", ""),
            "isbn": rec.get("titel_input", {}).get("isbn", "")}
           for rid, rec in load_all().items()
           if rec.get("titel_input", {}).get("isbn")]
    uit.sort(key=lambda x: x["titel"].lower())
    return jsonify({"titels": uit})


@bp.get("/overzicht")
def overzicht():
    """View 1 — alle titels samen + Maven-totaal voor een periode."""
    periode = request.args.get("periode", "2026")
    return jsonify(bereken.bereken_overzicht(periode))


@bp.get("/titel/<recept_id>")
def titel(recept_id):
    """View 2 — detail per titel (stroom-uitsplitsing, kanalen, vormen)."""
    periode = request.args.get("periode", "2026")
    data = bereken.bereken_titel(recept_id, periode)
    if data is None:
        return jsonify({"error": "onbekende titel"}), 404
    return jsonify(data)


# ── Kwartaal-flow: Exact-import + reconcile + leren ────────────────────────

@bp.post("/import/exact")
def import_exact_route():
    """Upload een Exact FinTransactions-export (.xlsx) → res_kosten_geboekt.

    Idempotent op exact_ref, dus dezelfde export opnieuw uploaden is veilig.
    """
    f = request.files.get("file")
    if not f:
        return jsonify({"error": "geen bestand"}), 400
    fd, path = tempfile.mkstemp(suffix=".xlsx")
    os.close(fd)
    try:
        f.save(path)
        res = import_exact(path)
    except ValueError as e:                 # herkenbare parse-fout uit de importer
        return jsonify({"error": str(e)}), 400
    except Exception:                       # geen geldige .xlsx → nette 400, geen 500
        return jsonify({"error": "Kon het bestand niet lezen — is dit een geldige .xlsx?"}), 400
    finally:
        os.unlink(path)
    return jsonify(res)


@bp.post("/import/sfp")
def import_sfp_route():
    """Upload de SFP-historie-export (.xlsx) → res_historie (opening balance).

    Form-velden: ``file`` + ``cutover_datum`` (ISO, t/m-datum van de export).
    Idempotent op (isbn, cutover_datum).
    """
    from .sfp_import import import_sfp_historie
    f = request.files.get("file")
    cutover = (request.form.get("cutover_datum") or "").strip()
    if not f:
        return jsonify({"error": "geen bestand"}), 400
    if not cutover:
        return jsonify({"error": "cutover_datum vereist (bv. 2026-01-01)"}), 400
    fd, path = tempfile.mkstemp(suffix=".xlsx")
    os.close(fd)
    try:
        f.save(path)
        res = import_sfp_historie(path, cutover)
    except Exception:                       # geen geldige .xlsx → nette 400, geen 500
        return jsonify({"error": "Kon het bestand niet lezen — is dit een geldige SFP-.xlsx?"}), 400
    finally:
        os.unlink(path)
    return jsonify(res)


@bp.get("/kosten/<isbn>")
def kosten(isbn):
    """Geboekte Exact-regels voor een ISBN (voor de detail-uitklap per stroom)."""
    periode = request.args.get("periode")
    q = bereken.filter_periode(KostenGeboekt.query.filter_by(isbn=isbn),
                               KostenGeboekt.periode, periode)
    regels = [{
        "exact_ref": r.exact_ref, "datum": r.datum, "relatie": r.relatie,
        "grootboek": r.grootboek, "omschrijving": r.omschrijving,
        "stroom": r.stroom, "categorie": r.categorie, "bedrag": float(r.bedrag or 0),
        # resultaten-stroom uit dezelfde mapping als de reken-laag, zodat de
        # frontend de regels onder de juiste kostenpost hangt zonder eigen kopie
        "resultaten_stroom": bereken.stroom_key(r),
        "calculatie_post": r.calculatie_post, "match_bron": r.match_bron,
        "match_confidence": float(r.match_confidence) if r.match_confidence is not None else None,
    } for r in q.order_by(KostenGeboekt.bedrag.desc()).all()]
    return jsonify({"isbn": isbn, "regels": regels})


@bp.post("/reconcile")
def reconcile_route():
    """Reconcilieer geboekte regels van een titel tegen de calculatie-posten.

    ``dry_run`` (of geen API-key) slaat de LLM-call over en geeft alleen de
    deterministische tellingen + de samengestelde prompt terug.
    """
    body = request.get_json(silent=True) or {}
    recept_id = body.get("recept_id")
    rec = bereken.get_titel(recept_id) if recept_id else None
    if not rec:
        return jsonify({"error": "onbekende titel"}), 404
    isbn = rec.get("titel_input", {}).get("isbn", "")
    posten = calculatie_posten_voor(rec)
    dry = bool(body.get("dry_run")) or not os.environ.get("ANTHROPIC_API_KEY")

    from .reconcile import reconcile_titel
    if dry:
        out = reconcile_titel(isbn, posten, dry_run=True)
        out["dry_run"] = True
        return jsonify(out)
    reconcile_titel(isbn, posten)
    return jsonify({"dry_run": False, "ok": True})


# ── Calculatie-check: verklaringen + kwartaal afsluiten ────────────────────

@bp.post("/verklaring")
def verklaring_zetten():
    """Verklaar een verschil begroot↔geboekt per (periode, titel, stroom).

    Body: ``{recept_id, periode, stroom, status, notitie}``. ``status`` leeg →
    verklaring verwijderen (terug naar auto-classificatie).
    """
    b = request.get_json(silent=True) or {}
    recept_id, periode, stroom = b.get("recept_id"), b.get("periode"), b.get("stroom")
    if not (recept_id and periode and stroom):
        return jsonify({"error": "recept_id, periode en stroom vereist"}), 400
    v = Verklaring.query.filter_by(
        periode=periode, calculatie_titel_id=recept_id, stroom=stroom).first()
    status = (b.get("status") or "").strip()
    if not status:                                  # verklaring intrekken
        if v:
            db.session.delete(v)
            db.session.commit()
        return jsonify({"ok": True, "status": ""})
    if v is None:
        v = Verklaring(periode=periode, calculatie_titel_id=recept_id, stroom=stroom)
        db.session.add(v)
    v.status = status
    v.notitie = (b.get("notitie") or "").strip()
    v.door = "Hugo"
    db.session.commit()
    return jsonify({"ok": True, "status": v.status, "notitie": v.notitie})


@bp.post("/afsluiten")
def afsluiten():
    """Sluit een kwartaal af of heropen het. Body: ``{periode, afgesloten}``.

    Afgesloten → de app vraagt elk resterend gat te verklaren ('onverklaard').
    """
    b = request.get_json(silent=True) or {}
    periode = b.get("periode")
    if not periode:
        return jsonify({"error": "periode vereist"}), 400
    s = KwartaalStatus.query.filter_by(periode=periode).first()
    if s is None:
        s = KwartaalStatus(periode=periode)
        db.session.add(s)
    s.afgesloten = bool(b.get("afgesloten", True))
    s.afgesloten_at = datetime.utcnow()
    s.door = "Hugo"
    db.session.commit()
    return jsonify({"ok": True, "periode": periode, "afgesloten": s.afgesloten})


@bp.post("/zoek-kosten")
def zoek_kosten():
    """Scenario 2 — zoek overhead-regels die bij deze titel horen (LLM).

    Body: ``{recept_id, dry_run?}``. Zonder API-key automatisch dry-run.
    """
    from . import overhead
    b = request.get_json(silent=True) or {}
    recept_id = b.get("recept_id")
    if not recept_id or not bereken.get_titel(recept_id):
        return jsonify({"error": "onbekende titel"}), 404
    dry = bool(b.get("dry_run")) or not os.environ.get("ANTHROPIC_API_KEY")
    return jsonify(overhead.zoek_kandidaten(recept_id, dry_run=dry))


@bp.post("/herkoppel")
def herkoppel():
    """Koppel een overhead-regel alsnog aan een titel. Body: ``{exact_ref, recept_id}``."""
    from . import overhead
    b = request.get_json(silent=True) or {}
    rec = bereken.get_titel(b.get("recept_id"))
    if not rec:
        return jsonify({"error": "onbekende titel"}), 404
    isbn = rec.get("titel_input", {}).get("isbn", "")
    if not b.get("exact_ref") or not isbn:
        return jsonify({"error": "exact_ref en titel met ISBN vereist"}), 400
    return jsonify(overhead.herkoppel(b["exact_ref"], isbn))


@bp.post("/dispositie")
def dispositie_zetten():
    """Bepaal wat er met een niet-gekoppelde Exact-regel gebeurt.

    Body: ``{exact_ref?, relatie?, dispositie, onthoud?}``. ``dispositie`` =
    "verdeeld" (overige verkoopkosten, over titels verdeeld) | "genegeerd" |
    "" (terug naar te beoordelen). Met ``relatie`` (of ``onthoud``) geldt de
    keuze voor álle regels van die relatie, nu en bij volgende imports.
    """
    b = request.get_json(silent=True) or {}
    disp = (b.get("dispositie") or "").strip()
    if disp not in ("", "verdeeld", "genegeerd"):
        return jsonify({"error": "ongeldige dispositie"}), 400
    exact_ref = b.get("exact_ref")
    relatie = (b.get("relatie") or "").strip()
    onthoud = bool(b.get("onthoud")) or bool(relatie and not exact_ref)

    geraakt = 0
    if exact_ref and not onthoud:
        r = KostenGeboekt.query.filter_by(exact_ref=exact_ref).first()
        if not r:
            return jsonify({"error": "regel niet gevonden"}), 404
        r.dispositie = disp
        relatie = relatie or r.relatie
        geraakt = 1
    else:
        # Hele relatie: pak 'm van de regel als alleen exact_ref gegeven is.
        if not relatie and exact_ref:
            r = KostenGeboekt.query.filter_by(exact_ref=exact_ref).first()
            relatie = r.relatie if r else ""
        if not relatie:
            return jsonify({"error": "relatie of exact_ref vereist"}), 400
        for r in KostenGeboekt.query.filter_by(relatie=relatie, isbn="").all():
            r.dispositie = disp
            geraakt += 1

    # Onthoud-regel bijwerken (per relatie), zodat volgende imports het overnemen.
    if onthoud and relatie:
        norm = relatie.strip().lower()
        reg = DispositieRegel.query.filter_by(relatie=norm).first()
        if disp:
            if reg is None:
                reg = DispositieRegel(relatie=norm)
                db.session.add(reg)
            reg.dispositie = disp
            reg.door = "Hugo"
        elif reg is not None:
            db.session.delete(reg)

    db.session.commit()
    return jsonify({"ok": True, "dispositie": disp, "geraakt": geraakt,
                    "relatie": relatie, "onthouden": onthoud})


@bp.get("/exact-audit")
def exact_audit():
    """Verantwoording van de Exact-import: wat is er met elke regel gebeurd?

    Per periode (query-param, leeg = alles): totalen (regels/bedrag, gekoppeld
    aan titel vs. overhead-pool), uitsplitsing per grootboek, en alle regels met
    hun bestemming — zodat elk geïmporteerd bedrag te herleiden is.
    """
    periode = request.args.get("periode", "")
    summary = request.args.get("summary") == "1"   # alleen totalen (licht)
    q = bereken.filter_periode(KostenGeboekt.query, KostenGeboekt.periode, periode)
    regels = q.all()

    titel_namen = {}   # isbn → titelnaam (voor leesbare bestemming)
    per_grootboek: dict = {}
    # Vier bestemmingen: aan titel gekoppeld · verdeeld (overige verkoopkosten) ·
    # genegeerd · nog te beoordelen.
    tot = {"regels": 0, "bedrag": 0.0,
           "titel_regels": 0, "titel_bedrag": 0.0,
           "verdeeld_regels": 0, "verdeeld_bedrag": 0.0,
           "genegeerd_regels": 0, "genegeerd_bedrag": 0.0,
           "tebeoordelen_regels": 0, "tebeoordelen_bedrag": 0.0}

    def _bestemming(r):
        if r.isbn:
            return "titel"
        if r.dispositie == "verdeeld":
            return "verdeeld"
        if r.dispositie == "genegeerd":
            return "genegeerd"
        return "tebeoordelen"

    uit = []
    for r in regels:
        bedrag = float(r.bedrag or 0)
        bestemming = _bestemming(r)
        tot["regels"] += 1
        tot["bedrag"] += bedrag
        tot[f"{bestemming}_regels"] += 1
        tot[f"{bestemming}_bedrag"] += bedrag
        if summary:
            continue
        g = per_grootboek.setdefault(r.grootboek or "(geen grootboek)",
                                     {"regels": 0, "bedrag": 0.0,
                                      "titel": 0, "verdeeld": 0,
                                      "genegeerd": 0, "tebeoordelen": 0})
        g["regels"] += 1
        g["bedrag"] += bedrag
        g[bestemming] += 1
        if r.isbn and r.isbn not in titel_namen:
            titel_namen[r.isbn] = sales_sync.titel_naam_voor_isbn(r.isbn)
        uit.append({
            "exact_ref": r.exact_ref, "datum": r.datum, "periode": r.periode,
            "relatie": r.relatie, "grootboek": r.grootboek,
            "omschrijving": r.omschrijving, "bedrag": bedrag,
            "stroom": r.stroom, "categorie": r.categorie,
            "isbn": r.isbn, "titel": titel_namen.get(r.isbn, ""),
            "dispositie": r.dispositie or "", "bestemming": bestemming,
            "calculatie_post": r.calculatie_post,
            "match_bron": r.match_bron,
        })

    for d in (tot, *per_grootboek.values()):
        d["bedrag"] = round(d["bedrag"], 2)
    for k in ("titel", "verdeeld", "genegeerd", "tebeoordelen"):
        tot[f"{k}_bedrag"] = round(tot[f"{k}_bedrag"], 2)
    if summary:
        return jsonify({"periode": periode, "totaal": tot})
    uit.sort(key=lambda x: abs(x["bedrag"]), reverse=True)
    return jsonify({"periode": periode, "totaal": tot,
                    "per_grootboek": per_grootboek, "regels": uit})


@bp.post("/ontkoppel")
def ontkoppel():
    """Haal een Exact-regel van een titel af → terug naar 'te beoordelen'.

    Body: ``{exact_ref}``. Tegenhanger van /herkoppel; daarna kun je de regel
    opnieuw toewijzen, verdelen of negeren (in de Exact-verantwoording).
    """
    b = request.get_json(silent=True) or {}
    r = KostenGeboekt.query.filter_by(exact_ref=b.get("exact_ref")).first()
    if not r:
        return jsonify({"error": "regel niet gevonden"}), 404
    r.isbn = ""
    r.dispositie = ""
    r.match_bron = "mens"
    db.session.commit()
    return jsonify({"ok": True, "exact_ref": r.exact_ref})


@bp.get("/mapping")
def mapping_list():
    """Geleerde mappings (leverancier/patroon → calculatie-post)."""
    rows = [{"patroon": m.patroon, "calculatie_post": m.calculatie_post,
             "bron": m.bron, "bevestigd": m.bevestigd} for m in Mapping.query.all()]
    return jsonify({"mappings": rows})


@bp.post("/mapping/bevestig")
def mapping_bevestig():
    """Bevestig (of corrigeer) een mapping → vanaf nu deterministisch.

    Body: ``{patroon, calculatie_post}``. Maakt aan of werkt bij, zet bevestigd.
    """
    body = request.get_json(silent=True) or {}
    patroon = (body.get("patroon") or "").strip().lower()
    post = (body.get("calculatie_post") or "").strip()
    if not patroon or not post:
        return jsonify({"error": "patroon en calculatie_post vereist"}), 400
    m = Mapping.query.filter_by(patroon=patroon).first()
    if m is None:
        m = Mapping(patroon=patroon)
        db.session.add(m)
    m.calculatie_post = post
    m.bron = "mens"
    m.bevestigd = True
    db.session.commit()
    return jsonify({"ok": True, "patroon": patroon, "calculatie_post": post})
