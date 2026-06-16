#!/usr/bin/env python3
"""
Maven Publishing — Calculatiemodel
==================================
Berekent de bruto marge per exemplaar per verkoopkanaal
(webshop / retail-CB / B2B) voor elke druk van een titel.

Elke druk heeft z'n eigen oplage, drukkosten en kostenposten.
Er is geen onderscheid meer tussen "eenmalig" en "terugkerend":
je specificeert per druk expliciet welke kosten je maakt.
"""

from dataclasses import dataclass, field


# ──────────────────────────────────────────────────────────────────────
#  DATA MODEL
# ──────────────────────────────────────────────────────────────────────

@dataclass
class StaffelTrede:
    """Eén trede in een royalty-staffel (bv. tot 5000 ex → 6%)."""
    tot_exemplaren: int
    percentage: float


@dataclass
class KostenPost:
    """Eén kostenpost binnen een druk."""
    id: str                # "vormgeving_omslag" (default) of "custom_..." (user)
    naam: str              # "Vormgeving omslag"
    categorie: str         # "productie" | "offline_marketing" | "online_marketing"
    bedrag: float = 0.0


@dataclass
class DrukConfig:
    """Configuratie voor één druk."""
    druknummer: int
    oplage: int
    drukkosten_per_ex: float
    kostenposten: list[KostenPost] = field(default_factory=list)
    # CAC per druk: gemiddelde online-ad-uitgave per webshop-aankoop voor
    # deze druk. Komt vrijwel altijd uit een nieuwe campagne per druk.
    cac_per_ex: float = 0.0


@dataclass
class ExtraDerde:
    """Een flexibele extra derde (bv. tweede vertaler, co-auteur, etc.).

    type='royalty' → percentage van verkoopprijs ex BTW per ex; voorschot
    wordt ingelopen via die royalty.
    type='winstdeling' → percentage van brutowinst; voorschot is conceptueel
    niet van toepassing (geen per-ex stroom om mee in te lopen).
    """
    id: str = ""
    naam: str = ""
    type: str = "royalty"  # "royalty" | "winstdeling"
    percentage: float = 0.0
    staffel: list[StaffelTrede] = field(default_factory=list)
    voorschot: float = 0.0


@dataclass
class TitelInput:
    """Alle invoergegevens voor één titel."""

    titel: str
    auteur: str = ""
    isbn: str = ""
    verschijningsdatum: str = ""
    verschenen: bool = False

    # ── Basisgegevens ──
    verkoopprijs_incl_btw: float = 0.0
    btw_percentage: float = 0.09
    boekhandelskorting: float = 0.48

    # ── Drukken ──
    drukken: list[DrukConfig] = field(default_factory=list)

    # ── Webshop-specifieke kosten ──
    transactiekosten_pct: float = 0.002  # Shopify ~0,2%
    fulfillment_per_ex: float = 4.50
    cac_per_ex: float = 0.0

    # ── Retail/CB-specifieke kosten ──
    distributie_cb_per_ex: float = 1.10

    # ── B2B-specifieke kosten ──
    b2b_porto_per_ex: float = 0.0
    b2b_korting_pct: float = 0.0

    # ── Deal met auteur ──
    # Methode 1: Winstdeling (% van brutowinst)
    auteur_winstdeling_pct: float = 0.0
    # Methode 2: Royalty-staffel (% van verkoopprijs ex BTW)
    auteur_royalty_staffel: list[StaffelTrede] = field(default_factory=list)
    auteur_voorschot: float = 0.0

    # ── Derden: agent ──
    agent_staffel: list[StaffelTrede] = field(default_factory=list)
    agent_pct: float = 0.0
    agent_winstdeling_pct: float = 0.0
    agent_voorschot: float = 0.0

    # ── Derden: vertaler ──
    vertaler_pct: float = 0.0
    vertaler_staffel: list[StaffelTrede] = field(default_factory=list)
    vertaler_winstdeling_pct: float = 0.0
    vertaler_voorschot: float = 0.0

    # ── Derden: illustrator ──
    illustrator_pct: float = 0.0
    illustrator_staffel: list[StaffelTrede] = field(default_factory=list)
    illustrator_winstdeling_pct: float = 0.0
    illustrator_voorschot: float = 0.0

    # ── Extra derden (flexibele lijst) ──
    extra_derden: list["ExtraDerde"] = field(default_factory=list)

    # ── Partnership ──
    heeft_partner: bool = False
    partner_naam: str = ""
    partner_winstdeling_pct: float = 0.5

    # ── Overige kosten (% van netto omzet) ──
    overige_kosten_pct: float = 0.0


# ──────────────────────────────────────────────────────────────────────
#  STAFFEL BEREKENING
# ──────────────────────────────────────────────────────────────────────

def bereken_gemiddeld_staffel_percentage(
    staffel: list[StaffelTrede],
    start_exemplaar: int,
    aantal_exemplaren: int,
) -> float:
    """Gewogen gemiddelde royalty-% over een range van exemplaren."""
    if not staffel or aantal_exemplaren == 0:
        return 0.0

    staffel_sorted = sorted(staffel, key=lambda s: s.tot_exemplaren)
    totaal_gewogen = 0.0
    verwerkt = 0
    huidig_ex = start_exemplaar

    for trede in staffel_sorted:
        if verwerkt >= aantal_exemplaren:
            break
        if huidig_ex > trede.tot_exemplaren:
            continue
        ruimte_in_trede = trede.tot_exemplaren - huidig_ex + 1
        nog_te_verwerken = aantal_exemplaren - verwerkt
        in_deze_trede = min(ruimte_in_trede, nog_te_verwerken)
        totaal_gewogen += in_deze_trede * trede.percentage
        verwerkt += in_deze_trede
        huidig_ex += in_deze_trede

    if verwerkt < aantal_exemplaren:
        restant = aantal_exemplaren - verwerkt
        totaal_gewogen += restant * staffel_sorted[-1].percentage
        verwerkt += restant

    return totaal_gewogen / aantal_exemplaren


# ──────────────────────────────────────────────────────────────────────
#  RESULTAAT MODELS
# ──────────────────────────────────────────────────────────────────────

@dataclass
class KanaalResultaat:
    """Marge-berekening voor één kanaal binnen één druk."""
    kanaal: str                         # "webshop" | "retail" | "b2b"

    verkoopprijs_ex_btw: float = 0.0
    korting_bedrag: float = 0.0
    netto_omzet: float = 0.0

    # Kostenregels
    drukkosten: float = 0.0
    kosten_per_ex: float = 0.0          # som van alle kostenposten / oplage
    fulfillment: float = 0.0            # alleen webshop
    distributie_cb: float = 0.0         # alleen retail
    b2b_porto: float = 0.0              # alleen B2B
    transactiekosten: float = 0.0       # alleen webshop
    cac: float = 0.0                    # alleen webshop
    vertaler: float = 0.0
    illustrator: float = 0.0
    agent: float = 0.0
    overige_kosten: float = 0.0
    # Extra derden — per-naam breakdown voor de waterfall + totaal voor
    # eenvoudige aggregatie elders.
    extra_derden_totaal: float = 0.0
    extra_derden_per_naam: list[dict] = field(default_factory=list)

    totaal_kosten: float = 0.0
    brutowinst: float = 0.0

    # Royalty/winstdeling
    auteur_royalty: float = 0.0
    auteur_winstdeling: float = 0.0
    partner_winstdeling: float = 0.0

    netto_winst_maven: float = 0.0
    marge_pct: float = 0.0              # netto winst / netto omzet


@dataclass
class DrukResultaat:
    """Resultaat voor één druk."""
    druk_type: str                      # "1e druk", "2e druk", ...
    oplage: int = 0
    cumulatief_voor_druk: int = 0
    kosten_totaal: float = 0.0          # som van alle kostenposten in deze druk
    drukkosten_totaal: float = 0.0      # drukkosten_per_ex * oplage
    webshop: KanaalResultaat = None
    retail: KanaalResultaat = None
    b2b: KanaalResultaat = None


@dataclass
class CalculatieResultaat:
    """Compleet resultaat voor één titel."""
    titel: str
    drukken: list[DrukResultaat] = field(default_factory=list)


# ──────────────────────────────────────────────────────────────────────
#  BEREKENINGSLOGICA
# ──────────────────────────────────────────────────────────────────────

def bereken_kanaal(
    t: TitelInput,
    kanaal: str,
    kosten_per_ex: float,
    cumulatief_verkocht: int,
    oplage: int,
    drukkosten_per_ex: float,
    cac_per_ex: float = 0.0,
) -> KanaalResultaat:
    """Bereken de marge voor één kanaal van één druk."""
    r = KanaalResultaat(kanaal=kanaal)

    # ── STAP 1: Omzet ──
    r.verkoopprijs_ex_btw = t.verkoopprijs_incl_btw / (1 + t.btw_percentage)

    if kanaal == "webshop":
        r.korting_bedrag = 0.0
        r.netto_omzet = r.verkoopprijs_ex_btw
    elif kanaal == "retail":
        r.korting_bedrag = r.verkoopprijs_ex_btw * t.boekhandelskorting
        r.netto_omzet = r.verkoopprijs_ex_btw - r.korting_bedrag
    elif kanaal == "b2b":
        r.korting_bedrag = r.verkoopprijs_ex_btw * t.b2b_korting_pct
        r.netto_omzet = r.verkoopprijs_ex_btw - r.korting_bedrag

    # ── STAP 2: Kosten per exemplaar ──
    r.drukkosten = drukkosten_per_ex
    r.kosten_per_ex = kosten_per_ex

    if kanaal == "webshop":
        r.fulfillment = t.fulfillment_per_ex
        r.transactiekosten = t.verkoopprijs_incl_btw * t.transactiekosten_pct
        r.cac = cac_per_ex
    elif kanaal == "retail":
        r.distributie_cb = t.distributie_cb_per_ex
    elif kanaal == "b2b":
        r.b2b_porto = t.b2b_porto_per_ex

    # Derden — royalty mode (staffel of vast %)
    if t.vertaler_winstdeling_pct <= 0:
        if t.vertaler_staffel:
            r.vertaler = r.verkoopprijs_ex_btw * bereken_gemiddeld_staffel_percentage(
                t.vertaler_staffel, cumulatief_verkocht + 1, oplage
            )
        else:
            r.vertaler = r.verkoopprijs_ex_btw * t.vertaler_pct

    if t.illustrator_winstdeling_pct <= 0:
        if t.illustrator_staffel:
            r.illustrator = r.verkoopprijs_ex_btw * bereken_gemiddeld_staffel_percentage(
                t.illustrator_staffel, cumulatief_verkocht + 1, oplage
            )
        else:
            r.illustrator = r.verkoopprijs_ex_btw * t.illustrator_pct

    if t.agent_winstdeling_pct <= 0:
        if t.agent_staffel:
            r.agent = r.verkoopprijs_ex_btw * bereken_gemiddeld_staffel_percentage(
                t.agent_staffel, cumulatief_verkocht + 1, oplage
            )
        else:
            r.agent = r.verkoopprijs_ex_btw * t.agent_pct

    # Extra derden — royalty-mode telt mee als per-ex kost over VKP ex BTW;
    # winstdeling-mode wordt verderop bij STAP 4b verwerkt.
    extra_derden_royalty = 0.0
    for ed in (t.extra_derden or []):
        if ed.type == "royalty":
            if ed.staffel:
                pct = bereken_gemiddeld_staffel_percentage(
                    ed.staffel, cumulatief_verkocht + 1, oplage
                )
                bedrag = r.verkoopprijs_ex_btw * pct
            else:
                bedrag = r.verkoopprijs_ex_btw * (ed.percentage or 0.0)
            extra_derden_royalty += bedrag
            r.extra_derden_per_naam.append({
                "naam": ed.naam or "Extra persoon",
                "type": "royalty",
                "bedrag": bedrag,
            })

    r.overige_kosten = r.netto_omzet * t.overige_kosten_pct

    # ── STAP 3a: Auteur royalty (% van VKP ex BTW — hoort vóór brutowinst) ──
    # Auteur winstdeling wordt verderop bij STAP 4 berekend (% van brutowinst).
    if t.auteur_royalty_staffel:
        r.auteur_royalty = r.verkoopprijs_ex_btw * bereken_gemiddeld_staffel_percentage(
            t.auteur_royalty_staffel, cumulatief_verkocht + 1, oplage
        )

    r.totaal_kosten = (
        r.drukkosten
        + r.kosten_per_ex
        + r.fulfillment
        + r.distributie_cb
        + r.b2b_porto
        + r.transactiekosten
        + r.cac
        + r.vertaler
        + r.illustrator
        + r.agent
        + extra_derden_royalty
        + r.auteur_royalty
        + r.overige_kosten
    )

    # ── STAP 3b: Brutowinst (ná alle royalty's, vóór winstdelingen) ──
    r.brutowinst = r.netto_omzet - r.totaal_kosten

    # ── STAP 4: Auteur winstdeling (% van brutowinst) ──
    if not t.auteur_royalty_staffel and t.auteur_winstdeling_pct > 0:
        r.auteur_winstdeling = r.brutowinst * t.auteur_winstdeling_pct

    auteur_totaal = r.auteur_royalty + r.auteur_winstdeling

    # ── STAP 4b: Derden winstdeling (% van brutowinst) ──
    derden_winstdeling = 0.0
    if t.agent_winstdeling_pct > 0:
        r.agent = r.brutowinst * t.agent_winstdeling_pct
        derden_winstdeling += r.agent
    if t.vertaler_winstdeling_pct > 0:
        r.vertaler = r.brutowinst * t.vertaler_winstdeling_pct
        derden_winstdeling += r.vertaler
    if t.illustrator_winstdeling_pct > 0:
        r.illustrator = r.brutowinst * t.illustrator_winstdeling_pct
        derden_winstdeling += r.illustrator
    # Extra derden in winstdeling-mode
    for ed in (t.extra_derden or []):
        if ed.type == "winstdeling" and (ed.percentage or 0) > 0:
            bedrag = r.brutowinst * ed.percentage
            derden_winstdeling += bedrag
            r.extra_derden_per_naam.append({
                "naam": ed.naam or "Extra persoon",
                "type": "winstdeling",
                "bedrag": bedrag,
            })

    # Totaal voor eenvoudige aggregatie/serialisatie
    r.extra_derden_totaal = sum(x["bedrag"] for x in r.extra_derden_per_naam)

    # ── STAP 5: Partner (informatief) ──
    # Partner-winstdeling (POM/UvNL) wordt buiten de titel-marge gehouden.
    # De afspraak is dat dit via productiehuis-overhead apart wordt geregeld;
    # voor de titel-marge willen we weten wat er ná auteur, vóór partner
    # overblijft. partner_winstdeling blijft berekend en zichtbaar in de
    # uitsplitsing, maar telt NIET mee in netto_winst_maven of marge_pct.
    # Auteur royalty zit al in totaal_kosten verwerkt (boven brutowinst);
    # daarom hoeven we hier alleen winstdelingen af te trekken.
    if t.heeft_partner:
        winst_na_auteur = r.brutowinst - r.auteur_winstdeling - derden_winstdeling
        r.partner_winstdeling = winst_na_auteur * t.partner_winstdeling_pct

    # ── STAP 6: Netto winst Maven (brutowinst − winstdelingen) ──
    r.netto_winst_maven = r.brutowinst - r.auteur_winstdeling - derden_winstdeling

    if r.netto_omzet > 0:
        r.marge_pct = r.netto_winst_maven / r.netto_omzet

    return r


def bereken_titel(t: TitelInput) -> CalculatieResultaat:
    """Volledige calculatie voor één titel (alle drukken)."""
    res = CalculatieResultaat(titel=t.titel)
    cumulatief = 0

    # Drukken altijd op druknummer verwerken: de royalty-staffel loopt
    # cumulatief, dus de volgorde bepaalt welke staffel-trede elke druk pakt.
    # Zo klopt de per-druk uitsplitsing ongeacht de invoervolgorde.
    drukken_gesorteerd = sorted(t.drukken, key=lambda d: d.druknummer)

    for i, druk_cfg in enumerate(drukken_gesorteerd):
        oplage = druk_cfg.oplage
        kosten_totaal = sum(kp.bedrag for kp in druk_cfg.kostenposten)
        kosten_per_ex = kosten_totaal / oplage if oplage > 0 else 0.0

        druk = DrukResultaat(
            druk_type=f"{druk_cfg.druknummer}e druk",
            oplage=oplage,
            cumulatief_voor_druk=cumulatief,
            kosten_totaal=kosten_totaal,
            drukkosten_totaal=druk_cfg.drukkosten_per_ex * oplage,
        )
        # CAC: nieuwe locatie is per druk; valt terug op titel-level voor
        # backward compat met oude data die nog niet gemigreerd is.
        druk_cac = druk_cfg.cac_per_ex if druk_cfg.cac_per_ex else t.cac_per_ex
        for kanaal in ["webshop", "retail", "b2b"]:
            result = bereken_kanaal(
                t, kanaal,
                kosten_per_ex=kosten_per_ex,
                cumulatief_verkocht=cumulatief,
                oplage=oplage,
                drukkosten_per_ex=druk_cfg.drukkosten_per_ex,
                cac_per_ex=druk_cac,
            )
            setattr(druk, kanaal, result)
        res.drukken.append(druk)
        cumulatief += oplage

    return res
