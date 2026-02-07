"""
Bridge: converteert Pydantic schemas ↔ calculatie.py dataclasses.
Enige plek waar gewogen marge (verdeling) berekend wordt.
"""

import sys
import os

# Import calculatie.py from project root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from calculatie import (
    TitelInput, StaffelTrede, KostenPost, bereken_titel,
    CalculatieResultaat, DrukResultaat, KanaalResultaat,
)
from .models import (
    TitelInputSchema, StaffelTredeSchema, KostenPostSchema,
    CalculateRequest, CalculateResponse,
    DrukResultaatSchema, KanaalResultaatSchema,
)


def schema_to_dataclass(s: TitelInputSchema) -> TitelInput:
    """Converteer Pydantic TitelInputSchema → calculatie.py TitelInput."""
    return TitelInput(
        titel=s.titel,
        isbn=s.isbn,
        druknummer=s.druknummer,
        verkoopprijs_incl_btw=s.verkoopprijs_incl_btw,
        btw_percentage=s.btw_percentage,
        boekhandelskorting=s.boekhandelskorting,
        oplage_1e_druk=s.oplage_1e_druk,
        drukkosten_1e_druk=s.drukkosten_1e_druk,
        drukkosten_herdruk=s.drukkosten_herdruk,
        vormgeving_omslag=s.vormgeving_omslag,
        vormgeving_binnenwerk=s.vormgeving_binnenwerk,
        dtp=s.dtp,
        persklaarmaken=s.persklaarmaken,
        correctie=s.correctie,
        freelance_redactie=s.freelance_redactie,
        ebook_productie=s.ebook_productie,
        audiobook_productie=s.audiobook_productie,
        overige_productie=s.overige_productie,
        evenement=s.evenement,
        marketingmateriaal=s.marketingmateriaal,
        offline_campagne=s.offline_campagne,
        boekhandelsmateriaal=s.boekhandelsmateriaal,
        marketing_fee=s.marketing_fee,
        overige_offline_marketing=s.overige_offline_marketing,
        online_ads=s.online_ads,
        productfotografie=s.productfotografie,
        productie_ads=s.productie_ads,
        software_kosten=s.software_kosten,
        transactiekosten_pct=s.transactiekosten_pct,
        fulfillment_per_ex=s.fulfillment_per_ex,
        cac_per_ex=s.cac_per_ex,
        distributie_cb_per_ex=s.distributie_cb_per_ex,
        b2b_porto_per_ex=s.b2b_porto_per_ex,
        b2b_korting_pct=s.b2b_korting_pct,
        auteur_winstdeling_pct=s.auteur_winstdeling_pct,
        auteur_royalty_staffel=[
            StaffelTrede(t.tot_exemplaren, t.percentage)
            for t in s.auteur_royalty_staffel
        ],
        agent_staffel=[
            StaffelTrede(t.tot_exemplaren, t.percentage)
            for t in s.agent_staffel
        ],
        agent_pct=s.agent_pct,
        vertaler_pct=s.vertaler_pct,
        vertaler_staffel=[
            StaffelTrede(t.tot_exemplaren, t.percentage)
            for t in s.vertaler_staffel
        ],
        illustrator_pct=s.illustrator_pct,
        illustrator_staffel=[
            StaffelTrede(t.tot_exemplaren, t.percentage)
            for t in s.illustrator_staffel
        ],
        heeft_partner=s.heeft_partner,
        partner_naam=s.partner_naam,
        overige_kosten_pct=s.overige_kosten_pct,
        kostenposten=[
            KostenPost(id=kp.id, naam=kp.naam, categorie=kp.categorie, type=kp.type, bedrag=kp.bedrag)
            for kp in s.kostenposten
        ],
        gebruik_kostenposten=s.gebruik_kostenposten,
    )


def kanaal_to_schema(k: KanaalResultaat) -> KanaalResultaatSchema:
    """Converteer calculatie.py KanaalResultaat → Pydantic schema."""
    return KanaalResultaatSchema(
        kanaal=k.kanaal,
        verkoopprijs_ex_btw=k.verkoopprijs_ex_btw,
        korting_bedrag=k.korting_bedrag,
        netto_omzet=k.netto_omzet,
        drukkosten=k.drukkosten,
        productie_per_ex=k.productie_per_ex,
        offline_marketing_per_ex=k.offline_marketing_per_ex,
        online_marketing_per_ex=k.online_marketing_per_ex,
        fulfillment=k.fulfillment,
        distributie_cb=k.distributie_cb,
        b2b_porto=k.b2b_porto,
        transactiekosten=k.transactiekosten,
        cac=k.cac,
        vertaler=k.vertaler,
        illustrator=k.illustrator,
        agent=k.agent,
        overige_kosten=k.overige_kosten,
        totaal_kosten=k.totaal_kosten,
        brutowinst=k.brutowinst,
        auteur_royalty=k.auteur_royalty,
        auteur_winstdeling=k.auteur_winstdeling,
        partner_winstdeling=k.partner_winstdeling,
        netto_winst_maven=k.netto_winst_maven,
        marge_pct=k.marge_pct,
    )


def druk_to_schema(
    d: DrukResultaat,
    verd_ws: float,
    verd_rt: float,
    verd_b2b: float,
) -> DrukResultaatSchema:
    """Converteer DrukResultaat met gewogen marge berekening."""
    ws = kanaal_to_schema(d.webshop)
    rt = kanaal_to_schema(d.retail)
    b2b = kanaal_to_schema(d.b2b)

    gewogen_winst = (
        ws.netto_winst_maven * verd_ws
        + rt.netto_winst_maven * verd_rt
        + b2b.netto_winst_maven * verd_b2b
    )
    gewogen_omzet = (
        ws.netto_omzet * verd_ws
        + rt.netto_omzet * verd_rt
        + b2b.netto_omzet * verd_b2b
    )
    gewogen_marge = gewogen_winst / gewogen_omzet if gewogen_omzet > 0 else 0

    return DrukResultaatSchema(
        druk_type=d.druk_type,
        oplage=d.oplage,
        cumulatief_voor_druk=d.cumulatief_voor_druk,
        webshop=ws,
        retail=rt,
        b2b=b2b,
        gewogen_netto_winst=gewogen_winst,
        gewogen_marge_pct=gewogen_marge,
    )


def run_calculation(req: CalculateRequest) -> CalculateResponse:
    """Voer de volledige calculatie uit."""
    t = schema_to_dataclass(req.titel_input)
    herdrukken = req.herdruk_oplages if req.herdruk_oplages else None
    res = bereken_titel(t, herdruk_oplages=herdrukken)

    return CalculateResponse(
        titel=res.titel,
        drukken=[
            druk_to_schema(d, req.verdeling_webshop, req.verdeling_retail, req.verdeling_b2b)
            for d in res.drukken
        ],
        totaal_productie=res.totaal_productie,
        totaal_offline_marketing=res.totaal_offline_marketing,
        totaal_online_marketing=res.totaal_online_marketing,
        drukkosten_totaal_1e=res.drukkosten_totaal_1e,
    )
