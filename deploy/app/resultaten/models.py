"""
Datamodel voor de Resultaten-module (v0 — concept, reageer gerust op de kolommen).

Drie tabellen, allemaal met prefix ``res_`` zodat ze los staan van de
calculatie-tabellen en in één keer te verwijderen zijn:

1. ``res_sales_snapshot``   — wekelijkse verkoop-snapshot uit de sales-MCP.
2. ``res_kosten_geboekt``   — geboekte kosten uit de Exact-export.
3. ``res_kwartaal_afsluiting`` — bevroren kwartaalstaat ('de balans opgemaakt').

De marge zelf rekenen we live af: Exact-bedrag wáár geboekt, anders
recept × verkochte stuks. Deze tabellen bewaren dus de *feiten* (verkoop,
geboekte kosten) en de *afgesloten* kwartalen — niet de live-berekening.
"""

from datetime import datetime

from sqlalchemy import (
    Column,
    String,
    Integer,
    Numeric,
    Text,
    DateTime,
    Boolean,
    JSON,
    UniqueConstraint,
)

from ..db import db


class SalesSnapshot(db.Model):
    """Wekelijkse verkoop-snapshot uit de sales-MCP.

    Granulariteit: titel × kanaal × jaar/week × verschijningsvorm. We bewaren
    zowel de sales-identiteit (isbn/titel_naam) als een optionele link naar de
    calculatie-titel (het 'recept'), zodat fysiek/e-book/audio onder één
    calculatie kunnen rollen.
    """

    __tablename__ = "res_sales_snapshot"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # ── Identiteit / koppeling ──
    isbn = Column(String(20), index=True, default="")
    titel_naam = Column(Text, default="")                # zoals in de sales-MCP
    calculatie_titel_id = Column(String(36), index=True, nullable=True)  # → Titel.id (recept)

    # ── Kanaal & vorm ──
    kanaal = Column(Text, default="")                    # genormaliseerd: CB / Webshop / B2B
    bron = Column(Text, default="")                      # Centraal Boekhuis / Shopify / Moneybird B2B
    verschijningsvorm = Column(String(20), default="")   # paperback/hardcover/e-book/audiobook

    # ── Periode & cijfers ──
    jaar = Column(Integer, index=True)
    weeknummer = Column(Integer)
    stuks = Column(Integer, default=0)
    omzet = Column(Numeric(12, 2), default=0)

    snapshot_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint(
            "isbn", "kanaal", "bron", "jaar", "weeknummer",
            name="uq_res_sales_week",
        ),
    )


class KostenGeboekt(db.Model):
    """Geboekte kosten uit de Exact-export.

    Per titel × kwartaal × stroom × categorie. ``isbn`` leeg = algemene
    overhead zonder titel → telt alleen mee in 'Maven als geheel'.
    """

    __tablename__ = "res_kosten_geboekt"

    id = Column(Integer, primary_key=True, autoincrement=True)

    periode = Column(String(10), index=True)             # "2026-Q2"
    isbn = Column(String(20), index=True, default="")    # leeg = overhead
    calculatie_titel_id = Column(String(36), index=True, nullable=True)

    stroom = Column(String(30))      # kosten_per_ex | vast | royalty | winstdeling | voorraad
    categorie = Column(Text, default="")   # productie | campagne | fulfillment | cb-distributie | ...
    grootboek = Column(Text, default="")   # bv. "7005 - Drukwerk" — herkomst/controle
    bedrag = Column(Numeric(12, 2), default=0)
    omschrijving = Column(Text, default="")

    # ── Exact-herkomst (voor reconciliatie + leren) ──
    datum = Column(String(10), default="")            # "2026-03-30"
    relatie = Column(Text, default="")                # leverancier, bv. "Wilco" / "T-Druk"
    exact_ref = Column(String(60), unique=True)       # boekstuk/regel — idempotente import
    # Fijnere calculatie-post die de reconciliatie toewijst (deterministisch/LLM/mens).
    # bv. "sticker", "vormgeving". Leeg = nog niet verfijnd.
    calculatie_post = Column(Text, default="")
    match_bron = Column(String(10), default="")       # regel | llm | mens
    match_confidence = Column(Numeric(4, 3))          # 0..1, alleen bij llm

    import_batch = Column(String(40), default="")
    imported_at = Column(DateTime, default=datetime.utcnow)


class KwartaalAfsluiting(db.Model):
    """Bevroren kwartaalstaat per titel — 'de balans opgemaakt'.

    Bewaart het berekende resultaat op het moment van afsluiten, zodat een
    afgesloten kwartaal niet meer verschuift als het recept of de sales later
    nog wijzigen. ``calculatie_titel_id`` leeg = de Maven-totaalstaat.
    """

    __tablename__ = "res_kwartaal_afsluiting"

    id = Column(Integer, primary_key=True, autoincrement=True)

    periode = Column(String(10), index=True)             # "2026-Q2"
    calculatie_titel_id = Column(String(36), index=True, nullable=True)  # leeg = Maven-totaal

    snapshot_json = Column(JSON)         # volledige berekende staat bij afsluiten
    netto_omzet = Column(Numeric(12, 2), default=0)
    netto_resultaat = Column(Numeric(12, 2), default=0)
    marge_pct = Column(Numeric(6, 4), default=0)
    dekkingsgraad_pct = Column(Numeric(6, 4), default=0)

    afgesloten_at = Column(DateTime, default=datetime.utcnow)
    afgesloten_door = Column(Text, default="")

    __table_args__ = (
        UniqueConstraint(
            "periode", "calculatie_titel_id",
            name="uq_res_afsluiting",
        ),
    )


class Mapping(db.Model):
    """Geleerde koppeling leverancier/patroon → calculatie-post.

    Het geheugen van de reconciliatie: bevestig je één keer "T-Druk → sticker",
    dan staat dat hier en gaat de volgende keer deterministisch (geen LLM nodig).
    De LLM mag voorstellen doen (bevestigd=False); pas na jouw bevestiging
    (bevestigd=True) is het leidend.
    """

    __tablename__ = "res_mapping"

    id = Column(Integer, primary_key=True, autoincrement=True)
    patroon = Column(Text, index=True)          # genormaliseerd, bv. "t-druk" (leverancier)
    calculatie_post = Column(Text)              # bv. "sticker"
    bron = Column(String(10), default="llm")    # llm | mens
    bevestigd = Column(Boolean, default=False)  # door mens bevestigd?
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint("patroon", name="uq_res_mapping"),)


class Historie(db.Model):
    """Opening-balance / verkoophistorie per editie, geïmporteerd uit SFP.

    Eén rij per ISBN: cumulatief verkocht (saldo = verkopen − retouren) +
    cumulatieve netto-omzet t/m de cutover-datum. Rijen met dezelfde
    ``titel_naam`` vormen samen één titel(groep) — zo telt SFP de edities al
    voor ons op (Co-int: 3 ISBN's onder 'Co-intelligentie / Co-intelligence').

    Doet dubbel werk: bepaalt de staffel-trede (via groep-cumulatief) én levert
    de zichtbare verkoophistorie in de Resultaten-tab.
    """

    __tablename__ = "res_historie"

    id = Column(Integer, primary_key=True, autoincrement=True)

    isbn = Column(String(20), index=True, default="")
    titel_naam = Column(Text, default="")               # SFP-titelnaam = groepssleutel
    verschijningsvorm = Column(String(20), default="")  # Paperback/Hardcover/E-book/...

    cutover_datum = Column(String(10), default="")      # t/m-datum, ISO "2026-01-01"
    cumulatief_stuks = Column(Integer, default=0)       # saldo (verkopen − retouren)
    cumulatief_netto_omzet = Column(Numeric(12, 2), default=0)

    bron = Column(Text, default="SFP")
    import_batch = Column(String(40), default="")
    imported_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("isbn", "cutover_datum", name="uq_res_historie"),
    )


class Verklaring(db.Model):
    """Verklaring van een gat tussen begroot en geboekt — de 'calculatie-check'.

    Per (periode, titel, stroom) leggen we vast hoe een verschil verklaard is:
    de kosten komen nog (verwacht_nog), zijn niet gemaakt (niet_gemaakt, met
    notitie waarom), of stonden verkeerd geboekt en zijn herkoppeld
    (verkeerd_geboekt). Geen verklaring + afgesloten kwartaal = 'onverklaard'
    → de app herinnert eraan. Dit is een audittrail: we moeten elk verschil
    kunnen verklaren, niet de calculatie automatisch bijstellen.
    """

    __tablename__ = "res_verklaring"

    id = Column(Integer, primary_key=True, autoincrement=True)

    periode = Column(String(10), index=True)             # "2026-Q2"
    calculatie_titel_id = Column(String(36), index=True) # → Titel.id (recept)
    stroom = Column(String(30))                          # productie | vast | campagne | royalty | overig

    status = Column(String(20), default="")             # verwacht_nog | niet_gemaakt | verkeerd_geboekt | akkoord
    notitie = Column(Text, default="")

    bijgewerkt_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    door = Column(Text, default="")

    __table_args__ = (
        UniqueConstraint(
            "periode", "calculatie_titel_id", "stroom",
            name="uq_res_verklaring",
        ),
    )


class KwartaalStatus(db.Model):
    """Markeert of een kwartaal is 'afgesloten' (de balans opgemaakt).

    Vóór afsluiten telt een ongeboekt-begroot als 'verwacht nog' (timing); ná
    afsluiten vraagt de app om elk resterend gat te verklaren. Losse tabel naast
    de bevroren ``res_kwartaal_afsluiting`` (die de berekende staat snapshot);
    dit is enkel de open/dicht-vlag per periode.
    """

    __tablename__ = "res_kwartaal_status"

    id = Column(Integer, primary_key=True, autoincrement=True)
    periode = Column(String(10), unique=True, index=True)   # "2026-Q2"
    afgesloten = Column(Boolean, default=False)
    afgesloten_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    door = Column(Text, default="")
