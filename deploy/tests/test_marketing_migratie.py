import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from app.storage_calculatie import _migrate_marketing


def _titel_input_oud():
    return {
        "titel": "Oud",
        "drukken": [{
            "druknummer": 1, "oplage": 2000, "drukkosten_per_ex": 1.0,
            "kostenposten": [
                {"id": "dtp", "naam": "DTP", "categorie": "productie", "bedrag": 500},
                {"id": "evenement", "naam": "Evenement", "categorie": "offline_marketing", "bedrag": 300},
                {"id": "custom_x", "naam": "Podcast-ad", "categorie": "online_marketing", "bedrag": 150},
            ],
        }],
    }


def test_migratie_zet_marketing_bedrag_in_toegewezen():
    ti = _titel_input_oud()
    _migrate_marketing(ti)
    onderdelen = ti["drukken"][0]["marketing_onderdelen"]
    per_id = {o["id"]: o for o in onderdelen}
    assert per_id["evenement"]["toegewezen"] == pytest.approx(300)
    assert per_id["evenement"]["committed"] == 0
    assert per_id["custom_x"]["toegewezen"] == pytest.approx(150)
    assert per_id["custom_x"]["naam"] == "Podcast-ad"


def test_migratie_verwijdert_marketing_uit_kostenposten():
    ti = _titel_input_oud()
    _migrate_marketing(ti)
    cats = [kp["categorie"] for kp in ti["drukken"][0]["kostenposten"]]
    assert cats == ["productie"]  # DTP blijft, marketing weg


def test_migratie_bevat_alle_basis_onderdelen():
    ti = _titel_input_oud()
    _migrate_marketing(ti)
    ids = {o["id"] for o in ti["drukken"][0]["marketing_onderdelen"]}
    for basis in ["evenement", "marketingmateriaal", "offline_campagne",
                  "boekhandelsmateriaal", "productfotografie", "productie_ads",
                  "software_kosten"]:
        assert basis in ids


def test_migratie_is_idempotent():
    ti = _titel_input_oud()
    _migrate_marketing(ti)
    eerste = [dict(o) for o in ti["drukken"][0]["marketing_onderdelen"]]
    _migrate_marketing(ti)  # tweede keer: mag niets veranderen
    assert ti["drukken"][0]["marketing_onderdelen"] == eerste


def test_migratie_per_druk_onafhankelijk():
    """Elke druk migreert z'n EIGEN kostenposten naar z'n EIGEN
    marketing_onderdelen — geen vermenging tussen drukken."""
    ti = {
        "titel": "Multi",
        "drukken": [
            {
                "druknummer": 1, "oplage": 2000, "drukkosten_per_ex": 1.0,
                "kostenposten": [
                    {"id": "evenement", "naam": "Evenement", "categorie": "offline_marketing", "bedrag": 300},
                ],
            },
            {
                "druknummer": 2, "oplage": 1000, "drukkosten_per_ex": 1.0,
                "kostenposten": [
                    {"id": "evenement", "naam": "Evenement", "categorie": "offline_marketing", "bedrag": 50},
                ],
            },
        ],
    }
    _migrate_marketing(ti)
    d1 = {o["id"]: o for o in ti["drukken"][0]["marketing_onderdelen"]}
    d2 = {o["id"]: o for o in ti["drukken"][1]["marketing_onderdelen"]}
    assert d1["evenement"]["toegewezen"] == pytest.approx(300)
    assert d2["evenement"]["toegewezen"] == pytest.approx(50)


def test_migratie_skipt_druk_die_al_onderdelen_heeft():
    """Idempotent PER druk: een druk die al marketing_onderdelen heeft,
    wordt overgeslagen — inclusief het niet-strippen van z'n kostenposten."""
    ti = _titel_input_oud()
    bestaand = [{"id": "custom", "naam": "Al gevuld", "toegewezen": 999, "committed": 0, "besteed": 0}]
    ti["drukken"][0]["marketing_onderdelen"] = bestaand
    _migrate_marketing(ti)
    assert ti["drukken"][0]["marketing_onderdelen"] == bestaand
    cats = [kp["categorie"] for kp in ti["drukken"][0]["kostenposten"]]
    assert "offline_marketing" in cats  # niet gestript, want deze druk werd overgeslagen
