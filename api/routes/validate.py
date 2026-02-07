import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi import APIRouter
from ..models import ValidateResponse, ValidateCheck
from calculatie import TitelInput, bereken_titel

router = APIRouter()


def _check(label: str, berekend: float, verwacht: float, tol: float = 0.005) -> ValidateCheck:
    verschil = abs(berekend - verwacht)
    return ValidateCheck(
        label=label,
        berekend=round(berekend, 6),
        verwacht=round(verwacht, 6),
        verschil=round(verschil, 6),
        ok=verschil <= tol,
    )


@router.get("/validate", response_model=ValidateResponse)
def validate():
    """Valideer berekeningen tegen bekende Excel-waarden."""
    checks = []

    # Co-intelligentie
    co = TitelInput(
        titel="Co-intelligentie",
        verkoopprijs_incl_btw=20.0, btw_percentage=0.09,
        boekhandelskorting=0.48, oplage_1e_druk=2000,
        drukkosten_1e_druk=1.2, drukkosten_herdruk=2.0,
        fulfillment_per_ex=4.7, distributie_cb_per_ex=1.1,
        transactiekosten_pct=0.01, agent_pct=0.11,
        cac_per_ex=5.0, auteur_winstdeling_pct=0.5,
    )
    res = bereken_titel(co, herdruk_oplages=[2000])
    d1, d2 = res.drukken[0], res.drukken[1]

    checks.append(_check("Co-intel 1e WS winst", d1.webshop.netto_winst_maven, 2.6151))
    checks.append(_check("Co-intel 1e WS marge%", d1.webshop.marge_pct, 0.1425))
    checks.append(_check("Co-intel 1e RT winst", d1.retail.netto_winst_maven, 2.6115))
    checks.append(_check("Co-intel 1e RT marge%", d1.retail.marge_pct, 0.2737))
    checks.append(_check("Co-intel 2e WS winst", d2.webshop.netto_winst_maven, 2.2151))
    checks.append(_check("Co-intel 2e RT winst", d2.retail.netto_winst_maven, 2.2115))

    # Rechts verpest onze seks
    rechts = TitelInput(
        titel="Rechts verpest onze seks",
        verkoopprijs_incl_btw=17.5, btw_percentage=0.09,
        boekhandelskorting=0.48, oplage_1e_druk=2000,
        drukkosten_1e_druk=1.2, drukkosten_herdruk=1.2,
        fulfillment_per_ex=4.7, distributie_cb_per_ex=1.1,
        transactiekosten_pct=0.03, auteur_winstdeling_pct=0.45,
        overige_productie=5200,
    )
    res2 = bereken_titel(rechts, herdruk_oplages=[2000])
    d1r, d2r = res2.drukken[0], res2.drukken[1]

    checks.append(_check("Rechts 1e WS winst", d1r.webshop.netto_winst_maven, 3.8665))
    checks.append(_check("Rechts 1e WS marge%", d1r.webshop.marge_pct, 0.2408))
    checks.append(_check("Rechts 2e WS winst", d2r.webshop.netto_winst_maven, 5.2965))
    checks.append(_check("Rechts 2e RT winst", d2r.retail.netto_winst_maven, 3.3267))

    passed = sum(1 for c in checks if c.ok)
    return ValidateResponse(
        passed=passed,
        total=len(checks),
        all_ok=passed == len(checks),
        checks=checks,
    )
