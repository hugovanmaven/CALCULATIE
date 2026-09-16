import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from app.routes.api_calculatie import dict_to_titel_input, run_calculation

TOL = 1e-2


def _payload(**over):
    ti = {
        "titel": "T",
        "verkoopprijs_incl_btw": 10.90,
        "btw_percentage": 0.09,
        "boekhandelskorting": 0.48,
        "fulfillment_per_ex": 4.50,
        "transactiekosten_pct": 0.002,
        "drukken": [{"druknummer": 1, "oplage": 2000, "drukkosten_per_ex": 1.0}],
        "marketing_budget_pct": 0.08,
        "marketing_onderdelen": [
            {"id": "a", "naam": "A", "groep": "offline_marketing",
             "toegewezen": 1000, "committed": 0, "besteed": 0},
        ],
    }
    data = {"titel_input": ti, "verdeling_webshop": 0, "verdeling_retail": 1, "verdeling_b2b": 0}
    data.update(over)
    return data


def test_dict_to_titel_input_parseert_marketing():
    t = dict_to_titel_input(_payload()["titel_input"])
    assert t.marketing_budget_pct == pytest.approx(0.08, abs=1e-6)
    assert len(t.marketing_onderdelen) == 1
    assert t.marketing_onderdelen[0].toegewezen == pytest.approx(1000, abs=TOL)


def test_run_calculation_geeft_budget():
    out = run_calculation(_payload())
    # retail-only: 0.08 * 2000 * 5.20 = 832
    assert out["marketing_budget"] == pytest.approx(832.0, abs=TOL)
    assert out["marketing_marge_totaal"] == pytest.approx(1000.0, abs=TOL)


def test_run_calculation_cac_euro():
    data = _payload()
    data["titel_input"]["drukken"][0]["cac_per_ex"] = 2.0
    data["verdeling_webshop"] = 0.25
    data["verdeling_retail"] = 0.75
    out = run_calculation(data)
    # cac_euro = 2.0 * 0.25 * 2000 = 1000
    assert out["marketing_cac_euro"] == pytest.approx(1000.0, abs=TOL)


def test_run_calculation_negeert_marketing_kostenposten_dubbeltelling():
    """Marketing leeft in marketing_onderdelen. Een niet-gemigreerde
    titel_input (bv. via de MCP what-if 'bereken'-route) kan nog een
    oude offline_marketing/online_marketing kostenpost bevatten naast
    marketing_onderdelen. Die kostenpost mag niet meetellen in
    kosten_per_ex, anders wordt marketing dubbel geteld."""
    baseline = _payload()
    out_baseline = run_calculation(baseline)

    met_oude_kostenpost = _payload()
    met_oude_kostenpost["titel_input"]["drukken"][0]["kostenposten"] = [
        {"id": "k1", "naam": "Oude marketingpost", "categorie": "offline_marketing", "bedrag": 500.0},
    ]
    out_met_oude_kostenpost = run_calculation(met_oude_kostenpost)

    # De oude offline_marketing kostenpost mag NIET meetellen in kosten_per_ex
    # (anders dubbeltelling met marketing_onderdelen).
    assert (
        out_met_oude_kostenpost["drukken"][0]["kosten_totaal"]
        == pytest.approx(out_baseline["drukken"][0]["kosten_totaal"], abs=TOL)
    )
    assert (
        out_met_oude_kostenpost["drukken"][0]["retail"]["kosten_per_ex"]
        == pytest.approx(out_baseline["drukken"][0]["retail"]["kosten_per_ex"], abs=TOL)
    )
    assert (
        out_met_oude_kostenpost["gewogen_marge_pct_totaal"]
        == pytest.approx(out_baseline["gewogen_marge_pct_totaal"], abs=TOL)
    )


def test_run_calculation_houdt_productie_kostenposten_wel_mee():
    """Sanity check: het filter mag alleen marketing-categorieën raken,
    niet productie-kostenposten."""
    data = _payload()
    data["titel_input"]["drukken"][0]["kostenposten"] = [
        {"id": "k1", "naam": "Productiekost", "categorie": "productie", "bedrag": 500.0},
    ]
    out = run_calculation(data)
    assert out["drukken"][0]["kosten_totaal"] == pytest.approx(500.0, abs=TOL)
