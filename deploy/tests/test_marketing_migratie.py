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
    per_id = {o["id"]: o for o in ti["marketing_onderdelen"]}
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
    ids = {o["id"] for o in ti["marketing_onderdelen"]}
    for basis in ["evenement", "marketingmateriaal", "offline_campagne",
                  "boekhandelsmateriaal", "productfotografie", "productie_ads",
                  "software_kosten"]:
        assert basis in ids


def test_migratie_is_idempotent():
    ti = _titel_input_oud()
    _migrate_marketing(ti)
    eerste = [dict(o) for o in ti["marketing_onderdelen"]]
    _migrate_marketing(ti)  # tweede keer: mag niets veranderen
    assert ti["marketing_onderdelen"] == eerste
