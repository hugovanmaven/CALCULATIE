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
