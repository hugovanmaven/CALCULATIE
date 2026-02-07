from fastapi import APIRouter
from ..models import (
    SensitivityCacRequest, SensitivityPriceRequest,
    SensitivityResponse, SensitivityRow,
    CalculateRequest,
)
from ..bridge import run_calculation

router = APIRouter()


@router.post("/sensitivity/cac", response_model=list[SensitivityResponse])
def sensitivity_cac(req: SensitivityCacRequest):
    """CAC sensitivity: varieer CAC en meet impact op marge."""
    results = []
    n_drukken = 1 + len(req.herdruk_oplages)

    for druk_idx in range(n_drukken):
        rows = []
        for cac_val in req.cac_range:
            modified = req.titel_input.model_copy(update={"cac_per_ex": cac_val})
            calc_req = CalculateRequest(
                titel_input=modified,
                herdruk_oplages=req.herdruk_oplages,
                verdeling_webshop=req.verdeling_webshop,
                verdeling_retail=req.verdeling_retail,
                verdeling_b2b=req.verdeling_b2b,
            )
            res = run_calculation(calc_req)
            druk = res.drukken[druk_idx]
            rows.append(SensitivityRow(
                variable_value=cac_val,
                webshop_winst=druk.webshop.netto_winst_maven,
                webshop_marge_pct=druk.webshop.marge_pct,
                retail_winst=druk.retail.netto_winst_maven,
                retail_marge_pct=druk.retail.marge_pct,
                b2b_winst=druk.b2b.netto_winst_maven,
                b2b_marge_pct=druk.b2b.marge_pct,
                gewogen_winst=druk.gewogen_netto_winst,
                gewogen_marge_pct=druk.gewogen_marge_pct,
            ))
        results.append(SensitivityResponse(
            variable_name="cac_per_ex",
            druk_type=res.drukken[druk_idx].druk_type,
            rows=rows,
        ))
    return results


@router.post("/sensitivity/price", response_model=list[SensitivityResponse])
def sensitivity_price(req: SensitivityPriceRequest):
    """Prijs sensitivity: varieer verkoopprijs en meet impact op marge."""
    results = []
    n_drukken = 1 + len(req.herdruk_oplages)

    for druk_idx in range(n_drukken):
        rows = []
        for price_val in req.price_range:
            modified = req.titel_input.model_copy(
                update={"verkoopprijs_incl_btw": price_val}
            )
            calc_req = CalculateRequest(
                titel_input=modified,
                herdruk_oplages=req.herdruk_oplages,
                verdeling_webshop=req.verdeling_webshop,
                verdeling_retail=req.verdeling_retail,
                verdeling_b2b=req.verdeling_b2b,
            )
            res = run_calculation(calc_req)
            druk = res.drukken[druk_idx]
            rows.append(SensitivityRow(
                variable_value=price_val,
                webshop_winst=druk.webshop.netto_winst_maven,
                webshop_marge_pct=druk.webshop.marge_pct,
                retail_winst=druk.retail.netto_winst_maven,
                retail_marge_pct=druk.retail.marge_pct,
                b2b_winst=druk.b2b.netto_winst_maven,
                b2b_marge_pct=druk.b2b.marge_pct,
                gewogen_winst=druk.gewogen_netto_winst,
                gewogen_marge_pct=druk.gewogen_marge_pct,
            ))
        results.append(SensitivityResponse(
            variable_name="verkoopprijs_incl_btw",
            druk_type=res.drukken[druk_idx].druk_type,
            rows=rows,
        ))
    return results
