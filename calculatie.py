#!/usr/bin/env python3
"""
Maven Publishing — Calculatiemodel v2
======================================
Berekent de bruto marge per exemplaar per verkoopkanaal
(webshop / retail-CB / B2B) voor 1e druk en herdrukken.

Features:
  - 3 verkoopkanalen: webshop, retail/CB, B2B
  - Royalty-staffels (cumulatief over drukken)
  - Eenmalige kosten verdeeld over oplage (1e druk)
  - Herdrukken: productie- en offline marketingkosten vervallen
  - Winstdeling auteur + partnership model
"""

from dataclasses import dataclass, field
from typing import Optional


# ──────────────────────────────────────────────────────────────────────
#  DATA MODEL
# ──────────────────────────────────────────────────────────────────────

@dataclass
class StaffelTrede:
    """Eén trede in een royalty-staffel.

    Voorbeeld: tot 5000 exemplaren → 6%
    """
    tot_exemplaren: int    # cumulatieve grens (bijv. 5000)
    percentage: float      # bijv. 0.06 voor 6%


@dataclass
class KostenPost:
    """Eén kostenpost met flexibel eenmalig/terugkerend type.

    type = "eenmalig"    → gespreid over 1e druk, 0 bij herdruk
    type = "terugkerend" → gespreid over élke druk z'n eigen oplage
    """
    id: str               # "vormgeving_omslag" (default) of UUID (custom)
    naam: str             # "Vormgeving omslag"
    categorie: str        # "productie" | "offline_marketing" | "online_marketing"
    type: str             # "eenmalig" | "terugkerend"
    bedrag: float = 0.0


@dataclass
class TitelInput:
    """Alle invoergegevens voor één titel."""

    titel: str
    isbn: str = ""                       # ISBN-13
    druknummer: int = 1                  # 1 = 1e druk, 2 = herdruk, etc.

    # ── Basisgegevens ──
    verkoopprijs_incl_btw: float = 0.0  # bijv. 17.50
    btw_percentage: float = 0.09       # standaard 9% (boeken)
    boekhandelskorting: float = 0.48   # korting voor boekhandel/CB
    oplage_1e_druk: int = 2000

    # ── Drukkosten ──
    drukkosten_1e_druk: float = 0.0    # per exemplaar
    drukkosten_herdruk: float = 0.0    # per exemplaar (vaak anders bij andere oplage)

    # ── Eenmalige productiekosten (vervallen bij herdruk) ──
    vormgeving_omslag: float = 0.0
    vormgeving_binnenwerk: float = 0.0
    dtp: float = 0.0
    persklaarmaken: float = 0.0
    correctie: float = 0.0
    freelance_redactie: float = 0.0
    ebook_productie: float = 0.0
    audiobook_productie: float = 0.0
    overige_productie: float = 0.0

    # ── Offline marketing (eenmalig, vervalt bij herdruk) ──
    evenement: float = 0.0
    marketingmateriaal: float = 0.0
    offline_campagne: float = 0.0
    boekhandelsmateriaal: float = 0.0
    marketing_fee: float = 0.0
    overige_offline_marketing: float = 0.0

    # ── Online marketing (blijft ook bij herdruk) ──
    online_ads: float = 0.0            # totaalbedrag (los van CAC per ex)
    productfotografie: float = 0.0
    productie_ads: float = 0.0
    software_kosten: float = 0.0

    # ── Webshop-specifieke kosten ──
    transactiekosten_pct: float = 0.02   # Shopify 1-2%
    fulfillment_per_ex: float = 4.50     # B-Logic handling per ex
    cac_per_ex: float = 0.0              # Customer Acquisition Cost per ex (stuurvariabele)

    # ── Retail/CB-specifieke kosten ──
    distributie_cb_per_ex: float = 1.10

    # ── B2B-specifieke kosten ──
    b2b_porto_per_ex: float = 0.0
    b2b_korting_pct: float = 0.0         # korting die Maven zelf biedt

    # ── Deal met auteur ──
    # Methode 1: Winstdeling (percentage van netto winst na alle kosten)
    auteur_winstdeling_pct: float = 0.0  # bijv. 0.50 voor 50-50
    # Methode 2: Royalty-staffel (percentage van verkoopprijs ex BTW)
    auteur_royalty_staffel: list[StaffelTrede] = field(default_factory=list)

    # ── Derden: agent ──
    agent_staffel: list[StaffelTrede] = field(default_factory=list)
    # Of simpel percentage (als geen staffel)
    agent_pct: float = 0.0

    # ── Derden: vertaler ──
    vertaler_pct: float = 0.0           # % van verkoopprijs ex BTW (als geen staffel)
    vertaler_staffel: list[StaffelTrede] = field(default_factory=list)

    # ── Derden: illustrator ──
    illustrator_pct: float = 0.0        # % van verkoopprijs ex BTW (als geen staffel)
    illustrator_staffel: list[StaffelTrede] = field(default_factory=list)

    # ── Partnership ──
    heeft_partner: bool = False          # ja = 50-50 netto winst deling
    partner_naam: str = ""               # bijv. "POM" of "UvNL"

    # ── Overige kosten (percentage van netto omzet) ──
    overige_kosten_pct: float = 0.0

    # ── Flexibele kostenposten (v2) ──
    # Als gebruik_kostenposten=True, worden kostenposten lijst gebruikt
    # i.p.v. de individuele productie/marketing velden hierboven.
    kostenposten: list[KostenPost] = field(default_factory=list)
    gebruik_kostenposten: bool = False


# ──────────────────────────────────────────────────────────────────────
#  STAFFEL BEREKENING
# ──────────────────────────────────────────────────────────────────────

def bereken_staffel_percentage(
    staffel: list[StaffelTrede],
    cumulatief_verkocht: int,
) -> float:
    """
    Bepaal het geldende royalty-percentage op basis van cumulatief
    verkocht aantal en de staffel.

    De staffel is gesorteerd op tot_exemplaren. Het percentage geldt
    voor het blok TOT dat aantal (cumulatief).

    Voorbeeld staffel:
      [StaffelTrede(5000, 0.06), StaffelTrede(10000, 0.07),
       StaffelTrede(50000, 0.09), StaffelTrede(999999, 0.11)]

    Bij 7500 cumulatief verkocht → 0.07 (zit in blok 5001-10000)
    """
    if not staffel:
        return 0.0

    for trede in sorted(staffel, key=lambda s: s.tot_exemplaren):
        if cumulatief_verkocht <= trede.tot_exemplaren:
            return trede.percentage

    # Boven de hoogste staffel → gebruik laatste percentage
    return staffel[-1].percentage


def bereken_gemiddeld_staffel_percentage(
    staffel: list[StaffelTrede],
    start_exemplaar: int,
    aantal_exemplaren: int,
) -> float:
    """
    Bereken het gewogen gemiddelde royalty-percentage over een range
    van exemplaren, rekening houdend met staffelgrenzen.

    Dit is nodig omdat binnen één druk de staffel kan wisselen.

    Voorbeeld: druk van 3000 ex, staffel wisselt bij 5000.
    Als we al 4000 hebben verkocht, dan:
      - 1000 ex @ 6% (tot 5000)
      - 2000 ex @ 7% (5001-7000)
      - gewogen gemiddelde = (1000*6% + 2000*7%) / 3000
    """
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

        # Hoeveel exemplaren vallen in deze trede?
        ruimte_in_trede = trede.tot_exemplaren - huidig_ex + 1
        nog_te_verwerken = aantal_exemplaren - verwerkt
        in_deze_trede = min(ruimte_in_trede, nog_te_verwerken)

        totaal_gewogen += in_deze_trede * trede.percentage
        verwerkt += in_deze_trede
        huidig_ex += in_deze_trede

    # Eventueel restant boven de hoogste staffel
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
    """Marge-berekening voor één kanaal."""
    kanaal: str                         # "webshop", "retail", "b2b"

    verkoopprijs_ex_btw: float = 0.0
    korting_bedrag: float = 0.0        # boekhandelskorting of B2B-korting
    netto_omzet: float = 0.0

    # Kostenregels
    drukkosten: float = 0.0
    productie_per_ex: float = 0.0      # eenmalige productiekosten / oplage
    offline_marketing_per_ex: float = 0.0
    online_marketing_per_ex: float = 0.0
    fulfillment: float = 0.0           # alleen webshop
    distributie_cb: float = 0.0        # alleen retail
    b2b_porto: float = 0.0            # alleen B2B
    transactiekosten: float = 0.0      # alleen webshop
    cac: float = 0.0                   # alleen webshop
    vertaler: float = 0.0
    illustrator: float = 0.0
    agent: float = 0.0
    overige_kosten: float = 0.0

    totaal_kosten: float = 0.0
    brutowinst: float = 0.0

    # Royalty/winstdeling
    auteur_royalty: float = 0.0        # als royalty-model
    auteur_winstdeling: float = 0.0    # als winstdeling-model
    partner_winstdeling: float = 0.0

    netto_winst_maven: float = 0.0
    marge_pct: float = 0.0             # netto winst / netto omzet


@dataclass
class DrukResultaat:
    """Resultaat voor één druk."""
    druk_type: str                     # "1e druk", "2e druk", etc.
    oplage: int = 0
    cumulatief_voor_druk: int = 0      # hoeveel al verkocht voor deze druk
    webshop: KanaalResultaat = None
    retail: KanaalResultaat = None
    b2b: KanaalResultaat = None


@dataclass
class CalculatieResultaat:
    """Compleet resultaat voor één titel."""
    titel: str
    drukken: list[DrukResultaat] = field(default_factory=list)

    # Eenmalige kosten samenvatting
    totaal_productie: float = 0.0
    totaal_offline_marketing: float = 0.0
    totaal_online_marketing: float = 0.0
    drukkosten_totaal_1e: float = 0.0


# ──────────────────────────────────────────────────────────────────────
#  BEREKENINGSLOGICA
# ──────────────────────────────────────────────────────────────────────

def bereken_eenmalige_productie(t: TitelInput) -> float:
    """Totaal eenmalige productiekosten (excl. drukkosten)."""
    return (
        t.vormgeving_omslag
        + t.vormgeving_binnenwerk
        + t.dtp
        + t.persklaarmaken
        + t.correctie
        + t.freelance_redactie
        + t.ebook_productie
        + t.audiobook_productie
        + t.overige_productie
    )


def bereken_eenmalige_offline_marketing(t: TitelInput) -> float:
    """Totaal eenmalige offline marketingkosten."""
    return (
        t.evenement
        + t.marketingmateriaal
        + t.offline_campagne
        + t.boekhandelsmateriaal
        + t.marketing_fee
        + t.overige_offline_marketing
    )


def bereken_online_marketing(t: TitelInput) -> float:
    """Totaal online marketingkosten (blijven ook bij herdruk)."""
    return (
        t.online_ads
        + t.productfotografie
        + t.productie_ads
        + t.software_kosten
    )


def bereken_kostenposten_totalen(kostenposten: list[KostenPost]) -> tuple[float, float]:
    """Bereken totalen voor eenmalige en terugkerende kostenposten.

    Returns: (totaal_eenmalig, totaal_terugkerend)
    """
    totaal_eenmalig = sum(kp.bedrag for kp in kostenposten if kp.type == "eenmalig")
    totaal_terugkerend = sum(kp.bedrag for kp in kostenposten if kp.type == "terugkerend")
    return totaal_eenmalig, totaal_terugkerend


def bereken_kanaal(
    t: TitelInput,
    kanaal: str,
    is_herdruk: bool,
    productie_per_ex: float,
    offline_mkt_per_ex: float,
    online_mkt_per_ex: float,
    cumulatief_verkocht: int,
    oplage: int,
    # v2: flexibele kostenposten — als gezet, overschrijven productie/offline/online
    eenmalig_per_ex: float | None = None,
    terugkerend_per_ex: float | None = None,
) -> KanaalResultaat:
    """
    Berekent de marge per exemplaar voor één kanaal.

    STAPPEN:
    ═══════

    1. OMZET
       Verkoopprijs ex BTW = prijs_incl / (1 + btw%)
       Webshop: geen korting → netto omzet = prijs ex BTW
       Retail:  boekhandelskorting → netto = prijs ex BTW × (1 - korting%)
       B2B:     B2B-korting → netto = prijs ex BTW × (1 - korting%)

    2. KOSTEN PER EXEMPLAAR
       a) Drukkosten (1e druk of herdruk tarief)
       b) Productie /ex (eenmalig / oplage; 0 bij herdruk)
       c) Offline marketing /ex (eenmalig / oplage; 0 bij herdruk)
       d) Online marketing /ex (totaal / oplage; ook bij herdruk)
       e) Kanaal-specifiek:
          - Webshop: fulfillment + transactiekosten + CAC
          - Retail: distributie CB
          - B2B: porto
       f) Derden: vertaler% + illustrator% + agent (staffel of %)
       g) Overige kosten (% van netto omzet)

    3. BRUTOWINST = netto omzet - totaal kosten

    4. AUTEUR
       Methode A (royalty): auteur-staffel% × verkoopprijs ex BTW
       Methode B (winstdeling): auteur% × brutowinst

    5. PARTNER (indien van toepassing)
       50% van (brutowinst - auteur afdracht)

    6. NETTO WINST MAVEN = brutowinst - auteur - partner
    """
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

    # ── STAP 2: Kosten ──

    # a) Drukkosten
    r.drukkosten = t.drukkosten_herdruk if is_herdruk else t.drukkosten_1e_druk

    if eenmalig_per_ex is not None and terugkerend_per_ex is not None:
        # v2: flexibele kostenposten pad
        r.productie_per_ex = 0.0 if is_herdruk else eenmalig_per_ex
        r.offline_marketing_per_ex = 0.0  # niet apart nodig — zit in eenmalig_per_ex
        r.online_marketing_per_ex = terugkerend_per_ex
    else:
        # Legacy pad: hardcoded eenmalig/terugkerend
        # b) Productie per exemplaar (0 bij herdruk)
        r.productie_per_ex = 0.0 if is_herdruk else productie_per_ex

        # c) Offline marketing per exemplaar (0 bij herdruk)
        r.offline_marketing_per_ex = 0.0 if is_herdruk else offline_mkt_per_ex

        # d) Online marketing per exemplaar (altijd)
        r.online_marketing_per_ex = online_mkt_per_ex

    # e) Kanaal-specifiek
    if kanaal == "webshop":
        r.fulfillment = t.fulfillment_per_ex
        r.transactiekosten = t.verkoopprijs_incl_btw * t.transactiekosten_pct
        r.cac = t.cac_per_ex
    elif kanaal == "retail":
        r.distributie_cb = t.distributie_cb_per_ex
    elif kanaal == "b2b":
        r.b2b_porto = t.b2b_porto_per_ex

    # f) Derden
    # Vertaler: staffel of vast percentage
    if t.vertaler_staffel:
        r.vertaler = r.verkoopprijs_ex_btw * bereken_gemiddeld_staffel_percentage(
            t.vertaler_staffel, cumulatief_verkocht + 1, oplage
        )
    else:
        r.vertaler = r.verkoopprijs_ex_btw * t.vertaler_pct

    # Illustrator: staffel of vast percentage
    if t.illustrator_staffel:
        r.illustrator = r.verkoopprijs_ex_btw * bereken_gemiddeld_staffel_percentage(
            t.illustrator_staffel, cumulatief_verkocht + 1, oplage
        )
    else:
        r.illustrator = r.verkoopprijs_ex_btw * t.illustrator_pct

    # Agent: staffel of vast percentage
    if t.agent_staffel:
        r.agent = r.verkoopprijs_ex_btw * bereken_gemiddeld_staffel_percentage(
            t.agent_staffel, cumulatief_verkocht + 1, oplage
        )
    else:
        r.agent = r.verkoopprijs_ex_btw * t.agent_pct

    # g) Overige kosten
    r.overige_kosten = r.netto_omzet * t.overige_kosten_pct

    # Totaal kosten
    r.totaal_kosten = (
        r.drukkosten
        + r.productie_per_ex
        + r.offline_marketing_per_ex
        + r.online_marketing_per_ex
        + r.fulfillment
        + r.distributie_cb
        + r.b2b_porto
        + r.transactiekosten
        + r.cac
        + r.vertaler
        + r.illustrator
        + r.agent
        + r.overige_kosten
    )

    # ── STAP 3: Brutowinst ──
    r.brutowinst = r.netto_omzet - r.totaal_kosten

    # ── STAP 4: Auteur ──
    if t.auteur_royalty_staffel:
        # Methode A: Royalty-staffel over verkoopprijs ex BTW
        r.auteur_royalty = r.verkoopprijs_ex_btw * bereken_gemiddeld_staffel_percentage(
            t.auteur_royalty_staffel, cumulatief_verkocht + 1, oplage
        )
    elif t.auteur_winstdeling_pct > 0:
        # Methode B: Winstdeling (% van brutowinst)
        r.auteur_winstdeling = r.brutowinst * t.auteur_winstdeling_pct

    auteur_totaal = r.auteur_royalty + r.auteur_winstdeling

    # ── STAP 5: Partner ──
    if t.heeft_partner:
        winst_na_auteur = r.brutowinst - auteur_totaal
        r.partner_winstdeling = winst_na_auteur * 0.5

    # ── STAP 6: Netto winst Maven ──
    r.netto_winst_maven = r.brutowinst - auteur_totaal - r.partner_winstdeling

    # Marge als % van netto omzet
    if r.netto_omzet > 0:
        r.marge_pct = r.netto_winst_maven / r.netto_omzet

    return r


def bereken_titel(
    t: TitelInput,
    herdruk_oplages: list[int] | None = None,
) -> CalculatieResultaat:
    """
    Volledige calculatie voor één titel.

    Args:
        t: TitelInput met alle parameters
        herdruk_oplages: optionele lijst van herdruk-oplages, bijv. [1000, 2000]
                         Elke entry is een extra druk.
    """
    res = CalculatieResultaat(titel=t.titel)

    # Drukkosten totaal 1e druk
    druk_totaal = t.drukkosten_1e_druk * t.oplage_1e_druk
    res.drukkosten_totaal_1e = druk_totaal

    if t.gebruik_kostenposten and t.kostenposten:
        # ═══ v2: FLEXIBELE KOSTENPOSTEN PAD ═══
        totaal_eenmalig, totaal_terugkerend = bereken_kostenposten_totalen(t.kostenposten)

        # Bewaar subtotalen per categorie voor weergave
        res.totaal_productie = sum(kp.bedrag for kp in t.kostenposten if kp.categorie == "productie")
        res.totaal_offline_marketing = sum(kp.bedrag for kp in t.kostenposten if kp.categorie == "offline_marketing")
        res.totaal_online_marketing = sum(kp.bedrag for kp in t.kostenposten if kp.categorie == "online_marketing")

        # Per exemplaar
        if t.oplage_1e_druk > 0:
            eenmalig_per_ex = totaal_eenmalig / t.oplage_1e_druk
            terugkerend_per_ex = totaal_terugkerend / t.oplage_1e_druk
        else:
            eenmalig_per_ex = terugkerend_per_ex = 0.0

        # ── 1e druk ──
        druk1 = DrukResultaat(
            druk_type="1e druk",
            oplage=t.oplage_1e_druk,
            cumulatief_voor_druk=0,
        )
        for kanaal in ["webshop", "retail", "b2b"]:
            result = bereken_kanaal(
                t, kanaal, is_herdruk=False,
                productie_per_ex=0.0, offline_mkt_per_ex=0.0, online_mkt_per_ex=0.0,
                cumulatief_verkocht=0, oplage=t.oplage_1e_druk,
                eenmalig_per_ex=eenmalig_per_ex,
                terugkerend_per_ex=terugkerend_per_ex,
            )
            setattr(druk1, kanaal, result)
        res.drukken.append(druk1)

        # ── Herdrukken ──
        if herdruk_oplages:
            cumulatief = t.oplage_1e_druk
            for i, herdruk_opl in enumerate(herdruk_oplages, start=2):
                if herdruk_opl > 0:
                    terugkerend_herdruk = totaal_terugkerend / herdruk_opl
                else:
                    terugkerend_herdruk = 0.0

                druk = DrukResultaat(
                    druk_type=f"{i}e druk",
                    oplage=herdruk_opl,
                    cumulatief_voor_druk=cumulatief,
                )
                for kanaal in ["webshop", "retail", "b2b"]:
                    result = bereken_kanaal(
                        t, kanaal, is_herdruk=True,
                        productie_per_ex=0.0, offline_mkt_per_ex=0.0, online_mkt_per_ex=0.0,
                        cumulatief_verkocht=cumulatief, oplage=herdruk_opl,
                        eenmalig_per_ex=0.0,
                        terugkerend_per_ex=terugkerend_herdruk,
                    )
                    setattr(druk, kanaal, result)
                res.drukken.append(druk)
                cumulatief += herdruk_opl

    else:
        # ═══ LEGACY PAD: hardcoded kostenvelden ═══
        totaal_productie = bereken_eenmalige_productie(t)
        totaal_offline_mkt = bereken_eenmalige_offline_marketing(t)
        totaal_online_mkt = bereken_online_marketing(t)

        res.totaal_productie = totaal_productie
        res.totaal_offline_marketing = totaal_offline_mkt
        res.totaal_online_marketing = totaal_online_mkt

        # Per exemplaar verdeeld over 1e druk oplage
        if t.oplage_1e_druk > 0:
            productie_per_ex = totaal_productie / t.oplage_1e_druk
            offline_mkt_per_ex = totaal_offline_mkt / t.oplage_1e_druk
            online_mkt_per_ex = totaal_online_mkt / t.oplage_1e_druk
        else:
            productie_per_ex = offline_mkt_per_ex = online_mkt_per_ex = 0.0

        # ── 1e druk ──
        druk1 = DrukResultaat(
            druk_type="1e druk",
            oplage=t.oplage_1e_druk,
            cumulatief_voor_druk=0,
        )
        for kanaal in ["webshop", "retail", "b2b"]:
            result = bereken_kanaal(
                t, kanaal, is_herdruk=False,
                productie_per_ex=productie_per_ex,
                offline_mkt_per_ex=offline_mkt_per_ex,
                online_mkt_per_ex=online_mkt_per_ex,
                cumulatief_verkocht=0,
                oplage=t.oplage_1e_druk,
            )
            setattr(druk1, kanaal, result)
        res.drukken.append(druk1)

        # ── Herdrukken ──
        if herdruk_oplages:
            cumulatief = t.oplage_1e_druk
            for i, herdruk_opl in enumerate(herdruk_oplages, start=2):
                if herdruk_opl > 0:
                    online_mkt_herdruk = totaal_online_mkt / herdruk_opl
                else:
                    online_mkt_herdruk = 0.0

                druk = DrukResultaat(
                    druk_type=f"{i}e druk",
                    oplage=herdruk_opl,
                    cumulatief_voor_druk=cumulatief,
                )
                for kanaal in ["webshop", "retail", "b2b"]:
                    result = bereken_kanaal(
                        t, kanaal, is_herdruk=True,
                        productie_per_ex=0.0,
                        offline_mkt_per_ex=0.0,
                        online_mkt_per_ex=online_mkt_herdruk,
                        cumulatief_verkocht=cumulatief,
                        oplage=herdruk_opl,
                    )
                    setattr(druk, kanaal, result)
                res.drukken.append(druk)
                cumulatief += herdruk_opl

    return res


# ──────────────────────────────────────────────────────────────────────
#  OUTPUT FORMATTING
# ──────────────────────────────────────────────────────────────────────

def fmt(val: float) -> str:
    return f"€{val:>8.2f}"


def fmt4(val: float) -> str:
    return f"€{val:>9.4f}"


def pct(val: float) -> str:
    return f"{val:>7.1%}"


def print_kanaal_detail(k: KanaalResultaat):
    """Print de details van één kanaal."""
    w = 32  # label width
    print(f"  {'Verkoopprijs ex BTW':<{w}} {fmt4(k.verkoopprijs_ex_btw)}")
    if k.korting_bedrag != 0:
        label = "Boekhandelskorting" if k.kanaal == "retail" else "B2B korting"
        print(f"  {label:<{w}} {fmt4(-k.korting_bedrag)}")
    print(f"  {'Netto omzet':<{w}} {fmt4(k.netto_omzet)}")
    print(f"  {'─' * 52}")

    # Kostenregels
    kosten_items = [
        ("Drukkosten", k.drukkosten),
        ("Productie /ex", k.productie_per_ex),
        ("Offline marketing /ex", k.offline_marketing_per_ex),
        ("Online marketing /ex", k.online_marketing_per_ex),
        ("Fulfillment / B-Logic", k.fulfillment),
        ("Distributie CB", k.distributie_cb),
        ("Porto B2B", k.b2b_porto),
        ("Transactiekosten", k.transactiekosten),
        ("CAC (online advertising)", k.cac),
        ("Vertaler", k.vertaler),
        ("Illustrator", k.illustrator),
        ("Agent", k.agent),
        ("Overige kosten", k.overige_kosten),
    ]

    for label, val in kosten_items:
        if val != 0:
            pct_val = val / k.netto_omzet if k.netto_omzet else 0
            print(f"  {label:<{w}} {fmt4(val):<16s} {pct(pct_val)}")

    print(f"  {'─' * 52}")
    pct_kosten = k.totaal_kosten / k.netto_omzet if k.netto_omzet else 0
    print(f"  {'TOTAAL KOSTEN':<{w}} {fmt4(k.totaal_kosten):<16s} {pct(pct_kosten)}")
    print()

    pct_bruto = k.brutowinst / k.netto_omzet if k.netto_omzet else 0
    print(f"  {'Brutowinst':<{w}} {fmt4(k.brutowinst):<16s} {pct(pct_bruto)}")

    if k.auteur_royalty != 0:
        print(f"  {'Auteur royalty':<{w}} {fmt4(-k.auteur_royalty)}")
    if k.auteur_winstdeling != 0:
        print(f"  {'Auteur winstdeling':<{w}} {fmt4(-k.auteur_winstdeling)}")
    if k.partner_winstdeling != 0:
        print(f"  {'Partner winstdeling':<{w}} {fmt4(-k.partner_winstdeling)}")

    print(f"  {'═' * 52}")
    print(f"  {'NETTO WINST MAVEN':<{w}} {fmt4(k.netto_winst_maven):<16s} {pct(k.marge_pct)} v. netto omzet")


def print_resultaat(res: CalculatieResultaat):
    """Print het volledige resultaat."""
    print()
    print(f"{'═' * 70}")
    print(f"  MAVEN PUBLISHING — CALCULATIE: {res.titel.upper()}")
    print(f"{'═' * 70}")

    # Eenmalige kosten samenvatting
    print(f"\n  EENMALIGE KOSTEN")
    print(f"  {'Productie (redactie/vormgeving)':<40s} {fmt(res.totaal_productie)}")
    print(f"  {'Offline marketing (eenmalig)':<40s} {fmt(res.totaal_offline_marketing)}")
    print(f"  {'Online marketing':<40s} {fmt(res.totaal_online_marketing)}")
    print(f"  {'Drukkosten 1e druk':<40s} {fmt(res.drukkosten_totaal_1e)}")
    totaal = res.totaal_productie + res.totaal_offline_marketing + res.totaal_online_marketing + res.drukkosten_totaal_1e
    print(f"  {'TOTAAL':<40s} {fmt(totaal)}")

    for druk in res.drukken:
        print(f"\n{'─' * 70}")
        cum_na = druk.cumulatief_voor_druk + druk.oplage
        print(f"  {druk.druk_type.upper()} — oplage: {druk.oplage:,}  "
              f"(cumulatief: {druk.cumulatief_voor_druk:,} → {cum_na:,})")
        print(f"{'─' * 70}")

        for kanaal_naam, kanaal_obj in [
            ("WEBSHOP", druk.webshop),
            ("RETAIL (CB)", druk.retail),
            ("B2B", druk.b2b),
        ]:
            if kanaal_obj and (kanaal_obj.netto_omzet > 0 or kanaal_naam == "WEBSHOP"):
                print(f"\n  ┌─ {kanaal_naam}")
                print_kanaal_detail(kanaal_obj)

    # Samenvatting
    print(f"\n{'═' * 70}")
    print(f"  SAMENVATTING — NETTO WINST MAVEN PER EXEMPLAAR")
    print(f"{'═' * 70}")
    print(f"  {'Druk':<15s} {'Webshop':>12s} {'Retail':>12s} {'B2B':>12s}")
    print(f"  {'─' * 52}")
    for druk in res.drukken:
        ws = fmt(druk.webshop.netto_winst_maven) if druk.webshop else "n/a"
        rt = fmt(druk.retail.netto_winst_maven) if druk.retail else "n/a"
        b2b = fmt(druk.b2b.netto_winst_maven) if druk.b2b else "n/a"
        print(f"  {druk.druk_type:<15s} {ws:>12s} {rt:>12s} {b2b:>12s}")

    print(f"\n  {'Druk':<15s} {'Webshop':>12s} {'Retail':>12s} {'B2B':>12s}")
    print(f"  {'─' * 52}")
    for druk in res.drukken:
        ws = pct(druk.webshop.marge_pct) if druk.webshop else "n/a"
        rt = pct(druk.retail.marge_pct) if druk.retail else "n/a"
        b2b = pct(druk.b2b.marge_pct) if druk.b2b else "n/a"
        print(f"  {druk.druk_type:<15s} {ws:>12s} {rt:>12s} {b2b:>12s}")

    print()


# ──────────────────────────────────────────────────────────────────────
#  VALIDATIE
# ──────────────────────────────────────────────────────────────────────

def valideer(label: str, berekend: float, verwacht: float, tol: float = 0.005) -> bool:
    verschil = abs(berekend - verwacht)
    ok = verschil <= tol
    sym = "✓" if ok else "✗"
    print(f"  {sym} {label:<40s} berekend={berekend:>10.4f}  verwacht={verwacht:>10.4f}  Δ={verschil:.6f}")
    return ok


def run_validatie():
    """Valideer tegen Excel-waarden uit Calculaties 2026."""
    print("\n" + "=" * 70)
    print("  VALIDATIE TEGEN EXCEL-WAARDEN")
    print("=" * 70)

    fouten = 0

    # ── Co-intelligentie ──
    co = TitelInput(
        titel="Co-intelligentie",
        verkoopprijs_incl_btw=20.0,
        btw_percentage=0.09,
        boekhandelskorting=0.48,
        oplage_1e_druk=2000,
        drukkosten_1e_druk=1.2,
        drukkosten_herdruk=2.0,
        fulfillment_per_ex=4.7,
        distributie_cb_per_ex=1.1,
        transactiekosten_pct=0.01,
        agent_pct=0.11,
        cac_per_ex=5.0,
        auteur_winstdeling_pct=0.5,
    )
    res = bereken_titel(co, herdruk_oplages=[2000])
    d1, d2 = res.drukken[0], res.drukken[1]

    print(f"\n  ── Co-intelligentie: 1e druk ──")
    if not valideer("WS netto winst", d1.webshop.netto_winst_maven, 2.6151): fouten += 1
    if not valideer("WS marge %", d1.webshop.marge_pct, 0.1425): fouten += 1
    if not valideer("RT netto winst", d1.retail.netto_winst_maven, 2.6115): fouten += 1
    # RT marge: 2.6115 / 9.5413 (netto omzet retail) = 0.2737
    if not valideer("RT marge %", d1.retail.marge_pct, 0.2737): fouten += 1

    print(f"\n  ── Co-intelligentie: herdruk ──")
    if not valideer("WS netto winst", d2.webshop.netto_winst_maven, 2.2151): fouten += 1
    if not valideer("RT netto winst", d2.retail.netto_winst_maven, 2.2115): fouten += 1

    # ── Rechts verpest onze seks ──
    # Excel "Calculaties 2026.xlsx" waarden (correcte formule):
    rechts = TitelInput(
        titel="Rechts verpest onze seks",
        verkoopprijs_incl_btw=17.5,
        btw_percentage=0.09,
        boekhandelskorting=0.48,
        oplage_1e_druk=2000,
        drukkosten_1e_druk=1.2,
        drukkosten_herdruk=1.2,
        fulfillment_per_ex=4.7,
        distributie_cb_per_ex=1.1,
        transactiekosten_pct=0.03,
        auteur_winstdeling_pct=0.45,
        overige_productie=5200,
    )
    res2 = bereken_titel(rechts, herdruk_oplages=[2000])
    d1r, d2r = res2.drukken[0], res2.drukken[1]

    print(f"\n  ── Rechts verpest onze seks: 1e druk ──")
    # Verwachte waarden uit Calculaties 2026.xlsx (correcte formule):
    # WS: netto p/e = 7.030, Maven = 3.8665 (55% van 7.030)
    if not valideer("WS netto winst", d1r.webshop.netto_winst_maven, 3.8665): fouten += 1
    if not valideer("WS marge %", d1r.webshop.marge_pct, 0.2408): fouten += 1

    print(f"\n  ── Rechts verpest onze seks: herdruk ──")
    # Herdruk: redactie = 0, dus netto = 9.630, Maven = 5.2965
    if not valideer("WS netto winst", d2r.webshop.netto_winst_maven, 5.2965): fouten += 1
    if not valideer("RT netto winst", d2r.retail.netto_winst_maven, 3.3267): fouten += 1

    print(f"\n  {'─' * 50}")
    total = 10
    print(f"  {total - fouten}/{total} checks geslaagd" +
          (" — ALLES OK" if fouten == 0 else f" — {fouten} fouten"))

    return fouten == 0


# ──────────────────────────────────────────────────────────────────────
#  CLI
# ──────────────────────────────────────────────────────────────────────

def vraag(prompt: str, default=None):
    suffix = f" [{default}]" if default is not None else ""
    raw = input(f"  {prompt}{suffix}: ").strip()
    if raw == "" and default is not None:
        return default
    return raw


def vraag_float(prompt: str, default: float = 0.0) -> float:
    try:
        return float(vraag(prompt, default))
    except ValueError:
        return default


def vraag_int(prompt: str, default: int = 0) -> int:
    try:
        return int(vraag(prompt, default))
    except ValueError:
        return default


def vraag_staffel(label: str) -> list[StaffelTrede]:
    """Vraag een royalty-staffel op."""
    staffel = []
    print(f"\n  ── {label} ──")
    print(f"  Voer staffeltredes in (leeg = klaar):")
    i = 1
    while True:
        grens = vraag(f"  Trede {i} — tot hoeveel exemplaren", "")
        if grens == "":
            break
        try:
            grens = int(grens)
        except ValueError:
            break
        pct_val = vraag_float(f"  Trede {i} — percentage (bijv. 0.06 voor 6%)", 0.0)
        staffel.append(StaffelTrede(tot_exemplaren=grens, percentage=pct_val))
        i += 1
    return staffel


def cli_voorbeeld_co():
    """Voorbeeld: Co-intelligentie."""
    t = TitelInput(
        titel="Co-intelligentie",
        verkoopprijs_incl_btw=20.0,
        oplage_1e_druk=2000,
        drukkosten_1e_druk=1.2,
        drukkosten_herdruk=2.0,
        fulfillment_per_ex=4.7,
        distributie_cb_per_ex=1.1,
        transactiekosten_pct=0.01,
        agent_pct=0.11,
        cac_per_ex=5.0,
        auteur_winstdeling_pct=0.5,
    )
    res = bereken_titel(t, herdruk_oplages=[2000])
    print_resultaat(res)


def cli_voorbeeld_rechts():
    """Voorbeeld: Rechts verpest onze seks."""
    t = TitelInput(
        titel="Rechts verpest onze seks",
        verkoopprijs_incl_btw=17.5,
        oplage_1e_druk=2000,
        drukkosten_1e_druk=1.2,
        drukkosten_herdruk=1.2,
        fulfillment_per_ex=4.7,
        distributie_cb_per_ex=1.1,
        transactiekosten_pct=0.03,
        auteur_winstdeling_pct=0.45,
        overige_productie=5200,
    )
    res = bereken_titel(t, herdruk_oplages=[2000])
    print_resultaat(res)


def cli_voorbeeld_staffel():
    """Voorbeeld met royalty-staffel."""
    t = TitelInput(
        titel="Voorbeeld met staffel",
        verkoopprijs_incl_btw=22.50,
        oplage_1e_druk=3000,
        drukkosten_1e_druk=1.50,
        drukkosten_herdruk=1.80,
        fulfillment_per_ex=4.50,
        distributie_cb_per_ex=1.10,
        transactiekosten_pct=0.02,
        vormgeving_omslag=2000,
        dtp=1500,
        correctie=800,
        marketingmateriaal=1000,
        online_ads=2000,
        agent_staffel=[
            StaffelTrede(5000, 0.06),
            StaffelTrede(10000, 0.07),
            StaffelTrede(50000, 0.09),
            StaffelTrede(999999, 0.11),
        ],
        auteur_royalty_staffel=[
            StaffelTrede(5000, 0.08),
            StaffelTrede(10000, 0.10),
            StaffelTrede(50000, 0.12),
            StaffelTrede(999999, 0.15),
        ],
        heeft_partner=True,
        partner_naam="POM",
    )
    res = bereken_titel(t, herdruk_oplages=[3000, 5000])
    print_resultaat(res)


def cli_nieuw():
    """Interactief nieuw scenario invoeren."""
    print(f"\n{'─' * 50}")
    print("  NIEUW SCENARIO")
    print(f"{'─' * 50}")

    titel = vraag("Titel", "Test titel")

    print("\n  ── Basisgegevens ──")
    prijs = vraag_float("Verkoopprijs incl BTW", 20.0)
    btw = vraag_float("BTW %", 0.09)
    korting = vraag_float("Boekhandelskorting %", 0.48)
    oplage = vraag_int("Oplage 1e druk", 2000)

    print("\n  ── Drukkosten ──")
    druk1 = vraag_float("Drukkosten /ex (1e druk)", 1.20)
    druk2 = vraag_float("Drukkosten /ex (herdruk)", druk1)

    print("\n  ── Productiekosten (eenmalig) ──")
    vorm_o = vraag_float("Vormgeving omslag", 0)
    vorm_b = vraag_float("Vormgeving binnenwerk", 0)
    dtp_k = vraag_float("DTP", 0)
    pers = vraag_float("Persklaarmaken", 0)
    corr = vraag_float("Correctie", 0)
    free = vraag_float("Freelance redactie", 0)
    ebook = vraag_float("E-book productie", 0)
    audio = vraag_float("Audiobook productie", 0)
    ov_prod = vraag_float("Overige productie", 0)

    print("\n  ── Offline marketing (eenmalig) ──")
    event = vraag_float("Evenement", 0)
    mkt_mat = vraag_float("Marketingmateriaal", 0)
    off_camp = vraag_float("Offline campagne", 0)
    bh_mat = vraag_float("Boekhandelsmateriaal", 0)
    mkt_fee = vraag_float("Marketing fee", 0)
    ov_off = vraag_float("Overige offline marketing", 0)

    print("\n  ── Online marketing ──")
    on_ads = vraag_float("Online ads (totaal)", 0)
    foto = vraag_float("Productfotografie", 0)
    prod_ads = vraag_float("Productie ads", 0)
    soft = vraag_float("Software kosten", 0)

    print("\n  ── Kanaal: Webshop ──")
    trans = vraag_float("Transactiekosten % (Shopify)", 0.02)
    fulfill = vraag_float("Fulfillment per ex (B-Logic)", 4.50)
    cac = vraag_float("CAC per ex (online advertising)", 0)

    print("\n  ── Kanaal: Retail/CB ──")
    distrib = vraag_float("Distributie CB per ex", 1.10)

    print("\n  ── Kanaal: B2B ──")
    b2b_porto = vraag_float("Porto per ex", 0)
    b2b_kort = vraag_float("B2B korting %", 0)

    print("\n  ── Auteur ──")
    auteur_methode = vraag("Winstdeling (w) of royalty-staffel (r)?", "w")
    auteur_winstdeling = 0.0
    auteur_staffel = []
    if auteur_methode.lower() == "r":
        auteur_staffel = vraag_staffel("Auteur royalty-staffel")
    else:
        auteur_winstdeling = vraag_float("Auteur winstdeling %", 0.50)

    print("\n  ── Derden ──")
    heeft_agent_staffel = vraag("Agent: staffel (s) of vast % (v)?", "v")
    agent_staffel = []
    agent_pct = 0.0
    if heeft_agent_staffel.lower() == "s":
        agent_staffel = vraag_staffel("Agent staffel")
    else:
        agent_pct = vraag_float("Agent %", 0)

    vertaler = vraag_float("Vertaler %", 0)
    illustrator = vraag_float("Illustrator %", 0)

    print("\n  ── Partnership ──")
    partner = vraag("Partnership? (j/n)", "n").lower() == "j"
    partner_naam = ""
    if partner:
        partner_naam = vraag("Partner naam", "POM")

    overig = vraag_float("Overige kosten % (van netto omzet)", 0)

    print("\n  ── Herdrukken ──")
    herdrukken = []
    while True:
        hd = vraag("Herdruk oplage (leeg = geen meer)", "")
        if hd == "":
            break
        try:
            herdrukken.append(int(hd))
        except ValueError:
            break

    t = TitelInput(
        titel=titel,
        verkoopprijs_incl_btw=prijs,
        btw_percentage=btw,
        boekhandelskorting=korting,
        oplage_1e_druk=oplage,
        drukkosten_1e_druk=druk1,
        drukkosten_herdruk=druk2,
        vormgeving_omslag=vorm_o,
        vormgeving_binnenwerk=vorm_b,
        dtp=dtp_k,
        persklaarmaken=pers,
        correctie=corr,
        freelance_redactie=free,
        ebook_productie=ebook,
        audiobook_productie=audio,
        overige_productie=ov_prod,
        evenement=event,
        marketingmateriaal=mkt_mat,
        offline_campagne=off_camp,
        boekhandelsmateriaal=bh_mat,
        marketing_fee=mkt_fee,
        overige_offline_marketing=ov_off,
        online_ads=on_ads,
        productfotografie=foto,
        productie_ads=prod_ads,
        software_kosten=soft,
        transactiekosten_pct=trans,
        fulfillment_per_ex=fulfill,
        cac_per_ex=cac,
        distributie_cb_per_ex=distrib,
        b2b_porto_per_ex=b2b_porto,
        b2b_korting_pct=b2b_kort,
        auteur_winstdeling_pct=auteur_winstdeling,
        auteur_royalty_staffel=auteur_staffel,
        agent_staffel=agent_staffel,
        agent_pct=agent_pct,
        vertaler_pct=vertaler,
        illustrator_pct=illustrator,
        heeft_partner=partner,
        partner_naam=partner_naam,
        overige_kosten_pct=overig,
    )

    res = bereken_titel(t, herdruk_oplages=herdrukken if herdrukken else None)
    print_resultaat(res)


def main():
    print(f"\n{'═' * 55}")
    print("  MAVEN PUBLISHING — CALCULATIEMODEL v2")
    print(f"{'═' * 55}")

    while True:
        print(f"\n  Opties:")
        print(f"    1  Voorbeeld: Co-intelligentie")
        print(f"    2  Voorbeeld: Rechts verpest onze seks")
        print(f"    3  Voorbeeld: Met royalty-staffel + partnership")
        print(f"    4  Nieuw scenario invoeren")
        print(f"    5  Validatie (vergelijk met Excel)")
        print(f"    q  Afsluiten")

        keuze = input("\n  Keuze: ").strip().lower()

        if keuze == "1":
            cli_voorbeeld_co()
        elif keuze == "2":
            cli_voorbeeld_rechts()
        elif keuze == "3":
            cli_voorbeeld_staffel()
        elif keuze == "4":
            cli_nieuw()
        elif keuze == "5":
            run_validatie()
        elif keuze == "q":
            print("  Tot ziens!")
            break
        else:
            print("  Ongeldige keuze.")


if __name__ == "__main__":
    main()
