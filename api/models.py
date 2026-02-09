"""Pydantic schemas — 1:1 mapping met calculatie.py dataclasses."""

from pydantic import BaseModel, Field
from typing import Optional


class StaffelTredeSchema(BaseModel):
    tot_exemplaren: int
    percentage: float  # bijv. 0.06 voor 6%


class KostenPostSchema(BaseModel):
    id: str
    naam: str
    categorie: str  # "productie" | "offline_marketing" | "online_marketing"
    type: str        # "eenmalig" | "terugkerend"
    bedrag: float = 0.0


class TitelInputSchema(BaseModel):
    titel: str = "Nieuwe titel"
    isbn: str = ""
    druknummer: int = 1
    verschijningsdatum: str = ""
    verschenen: bool = False

    # Basisgegevens
    verkoopprijs_incl_btw: float = 20.0
    btw_percentage: float = 0.09
    boekhandelskorting: float = 0.48
    oplage_1e_druk: int = 2000

    # Drukkosten
    drukkosten_1e_druk: float = 0.0
    drukkosten_herdruk: float = 0.0

    # Eenmalige productiekosten (vervallen bij herdruk)
    vormgeving_omslag: float = 0.0
    vormgeving_binnenwerk: float = 0.0
    dtp: float = 0.0
    persklaarmaken: float = 0.0
    correctie: float = 0.0
    freelance_redactie: float = 0.0
    ebook_productie: float = 0.0
    audiobook_productie: float = 0.0
    overige_productie: float = 0.0

    # Offline marketing (eenmalig, vervalt bij herdruk)
    evenement: float = 0.0
    marketingmateriaal: float = 0.0
    offline_campagne: float = 0.0
    boekhandelsmateriaal: float = 0.0
    marketing_fee: float = 0.0
    overige_offline_marketing: float = 0.0

    # Online marketing (blijft ook bij herdruk)
    online_ads: float = 0.0
    productfotografie: float = 0.0
    productie_ads: float = 0.0
    software_kosten: float = 0.0

    # Webshop
    transactiekosten_pct: float = 0.02
    fulfillment_per_ex: float = 4.50
    cac_per_ex: float = 0.0

    # Retail/CB
    distributie_cb_per_ex: float = 1.10

    # B2B
    b2b_porto_per_ex: float = 0.0
    b2b_korting_pct: float = 0.0

    # Auteur (mutually exclusive)
    auteur_winstdeling_pct: float = 0.0
    auteur_royalty_staffel: list[StaffelTredeSchema] = []

    # Derden
    agent_staffel: list[StaffelTredeSchema] = []
    agent_pct: float = 0.0
    vertaler_pct: float = 0.0
    vertaler_staffel: list[StaffelTredeSchema] = []
    illustrator_pct: float = 0.0
    illustrator_staffel: list[StaffelTredeSchema] = []

    # Partnership
    heeft_partner: bool = False
    partner_naam: str = ""

    # Overige
    overige_kosten_pct: float = 0.0

    # Flexibele kostenposten (v2)
    kostenposten: list[KostenPostSchema] = []
    gebruik_kostenposten: bool = False


# ── Request / Response ──

class CalculateRequest(BaseModel):
    titel_input: TitelInputSchema
    herdruk_oplages: list[int] = []
    verdeling_webshop: float = 0.10
    verdeling_retail: float = 0.85
    verdeling_b2b: float = 0.05


class KanaalResultaatSchema(BaseModel):
    kanaal: str
    verkoopprijs_ex_btw: float
    korting_bedrag: float
    netto_omzet: float
    drukkosten: float
    productie_per_ex: float
    offline_marketing_per_ex: float
    online_marketing_per_ex: float
    fulfillment: float
    distributie_cb: float
    b2b_porto: float
    transactiekosten: float
    cac: float
    vertaler: float
    illustrator: float
    agent: float
    overige_kosten: float
    totaal_kosten: float
    brutowinst: float
    auteur_royalty: float
    auteur_winstdeling: float
    partner_winstdeling: float
    netto_winst_maven: float
    marge_pct: float


class DrukResultaatSchema(BaseModel):
    druk_type: str
    oplage: int
    cumulatief_voor_druk: int
    webshop: KanaalResultaatSchema
    retail: KanaalResultaatSchema
    b2b: KanaalResultaatSchema
    gewogen_marge_pct: float
    gewogen_netto_winst: float


class CalculateResponse(BaseModel):
    titel: str
    drukken: list[DrukResultaatSchema]
    totaal_productie: float
    totaal_offline_marketing: float
    totaal_online_marketing: float
    drukkosten_totaal_1e: float


# ── Sensitivity ──

class SensitivityCacRequest(BaseModel):
    titel_input: TitelInputSchema
    herdruk_oplages: list[int] = []
    cac_range: list[float] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15]
    verdeling_webshop: float = 0.10
    verdeling_retail: float = 0.85
    verdeling_b2b: float = 0.05


class SensitivityPriceRequest(BaseModel):
    titel_input: TitelInputSchema
    herdruk_oplages: list[int] = []
    price_range: list[float] = [14.99, 15.99, 16.99, 17.50, 17.99, 18.99, 19.99, 20.99, 22.50, 24.99]
    verdeling_webshop: float = 0.10
    verdeling_retail: float = 0.85
    verdeling_b2b: float = 0.05


class SensitivityRow(BaseModel):
    variable_value: float
    webshop_winst: float
    webshop_marge_pct: float
    retail_winst: float
    retail_marge_pct: float
    b2b_winst: float
    b2b_marge_pct: float
    gewogen_winst: float
    gewogen_marge_pct: float


class SensitivityResponse(BaseModel):
    variable_name: str
    druk_type: str
    rows: list[SensitivityRow]


# ── Validate ──

class ValidateCheck(BaseModel):
    label: str
    berekend: float
    verwacht: float
    verschil: float
    ok: bool


class ValidateResponse(BaseModel):
    passed: int
    total: int
    all_ok: bool
    checks: list[ValidateCheck]
