"""
Maven Calculatiemodel — Stresstests
====================================
Verifieert alle rekenkundige invarianten en deal-scenario's van calculatie.py.

Structuur:
  A. Omzetberekening (VKP, BTW, kortingen per kanaal)
  B. Kosten per kanaal (drukkosten, kostenposten, fulfillment, CB, transactie, CAC)
  C. Brutowinst-invariant (altijd: brutowinst = netto_omzet − totaal_kosten)
  D. Auteur-deal (royalty-staffel vs. winstdeling)
  E. Derden-deals (agent, vertaler, illustrator)
  F. Partner-winstdeling (informatief — telt NIET mee in netto_winst_maven)
  G. Extra derden (royalty-mode vs. winstdeling-mode)
  H. Staffel-berekening (meerdere treden, cumulatief over drukken)
  I. Multi-druk (cumulatief_voor_druk, gewogen marge over drukken)
  J. Netto-winst-invariant en marge-consistentie
  K. Edge cases (nul-oplage, lege staffel, nul-exemplaren)
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from app.calculatie import (
    TitelInput, DrukConfig, KostenPost, StaffelTrede, ExtraDerde,
    bereken_titel, bereken_gemiddeld_staffel_percentage,
)

# Tolerantie: €0,0001 (ruim voldoende voor floating-point afrondingen)
TOL = 1e-4


# ─────────────────────────────────────────────────────────────────────
#  HELPERS
# ─────────────────────────────────────────────────────────────────────

def _druk(**kwargs):
    """Maak een DrukConfig met defaults."""
    defaults = dict(druknummer=1, oplage=2000, drukkosten_per_ex=1.00, kostenposten=[], cac_per_ex=0.0)
    defaults.update(kwargs)
    return DrukConfig(**defaults)


def _titel(**kwargs):
    """
    Maak een TitelInput met vaste, bekende defaults zodat tests
    precies berekend kunnen worden.

    VKP incl. BTW = €10,90 bij BTW 9%  →  VKP ex. BTW = €10,00 exact.
    """
    defaults = dict(
        titel="Testboek",
        verkoopprijs_incl_btw=10.90,   # 10.90 / 1.09 = 10.00 exact
        btw_percentage=0.09,
        boekhandelskorting=0.48,
        drukken=[_druk()],
        fulfillment_per_ex=4.50,
        transactiekosten_pct=0.002,
        distributie_cb_per_ex=1.10,
        b2b_porto_per_ex=0.00,
        b2b_korting_pct=0.00,
        auteur_winstdeling_pct=0.0,
        auteur_royalty_staffel=[],
        auteur_voorschot=0.0,
        agent_pct=0.0, agent_staffel=[], agent_winstdeling_pct=0.0, agent_voorschot=0.0,
        vertaler_pct=0.0, vertaler_staffel=[], vertaler_winstdeling_pct=0.0, vertaler_voorschot=0.0,
        illustrator_pct=0.0, illustrator_staffel=[], illustrator_winstdeling_pct=0.0, illustrator_voorschot=0.0,
        extra_derden=[],
        heeft_partner=False,
        partner_naam="",
        partner_winstdeling_pct=0.5,
        overige_kosten_pct=0.0,
    )
    defaults.update(kwargs)
    return TitelInput(**defaults)


def _bereken(t):
    return bereken_titel(t).drukken[0]


# ─────────────────────────────────────────────────────────────────────
#  A. OMZETBEREKENING
# ─────────────────────────────────────────────────────────────────────

class TestOmzetBerekening:
    def test_vkp_ex_btw(self):
        d = _bereken(_titel())
        assert d.retail.verkoopprijs_ex_btw == pytest.approx(10.00, abs=TOL)

    def test_retail_netto_omzet(self):
        # 10.00 × (1 − 0.48) = 5.20
        d = _bereken(_titel())
        assert d.retail.netto_omzet == pytest.approx(5.20, abs=TOL)
        assert d.retail.korting_bedrag == pytest.approx(4.80, abs=TOL)

    def test_webshop_geen_korting(self):
        d = _bereken(_titel())
        assert d.webshop.netto_omzet == pytest.approx(10.00, abs=TOL)
        assert d.webshop.korting_bedrag == pytest.approx(0.00, abs=TOL)

    def test_b2b_geen_korting_default(self):
        d = _bereken(_titel())
        assert d.b2b.netto_omzet == pytest.approx(10.00, abs=TOL)
        assert d.b2b.korting_bedrag == pytest.approx(0.00, abs=TOL)

    def test_b2b_met_korting(self):
        # 20% B2B-korting → netto omzet = 10.00 × 0.80 = 8.00
        d = _bereken(_titel(b2b_korting_pct=0.20))
        assert d.b2b.netto_omzet == pytest.approx(8.00, abs=TOL)
        assert d.b2b.korting_bedrag == pytest.approx(2.00, abs=TOL)

    def test_boekhandelskorting_variatie(self):
        # 40% korting
        d = _bereken(_titel(boekhandelskorting=0.40))
        assert d.retail.netto_omzet == pytest.approx(6.00, abs=TOL)

    def test_hoge_btw(self):
        # VKP incl. BTW = 21.00 bij 21% BTW → ex = 21.00/1.21 ≈ 17.3554
        t = _titel(verkoopprijs_incl_btw=21.00, btw_percentage=0.21)
        d = _bereken(t)
        assert d.webshop.verkoopprijs_ex_btw == pytest.approx(21.00 / 1.21, abs=TOL)


# ─────────────────────────────────────────────────────────────────────
#  B. KOSTEN PER KANAAL
# ─────────────────────────────────────────────────────────────────────

class TestKostenPerKanaal:
    def test_drukkosten_per_ex(self):
        d = _bereken(_titel())
        for kanaal in (d.webshop, d.retail, d.b2b):
            assert kanaal.drukkosten == pytest.approx(1.00, abs=TOL)

    def test_kostenposten_per_ex(self):
        # Totaal €3 000 kostenposten / 2 000 ex = €1,50/ex
        kp = [
            KostenPost("v_oml", "Vormgeving omslag", "productie", 2000.0),
            KostenPost("zet", "Zetwerk", "productie", 1000.0),
        ]
        d = _bereken(_titel(drukken=[_druk(kostenposten=kp)]))
        for kanaal in (d.webshop, d.retail, d.b2b):
            assert kanaal.kosten_per_ex == pytest.approx(1.50, abs=TOL)

    def test_kostenposten_nul_bedrag_telt_niet_mee(self):
        kp = [
            KostenPost("v_oml", "Vormgeving", "productie", 1000.0),
            KostenPost("leeg", "Leeg veld", "productie", 0.0),
        ]
        d = _bereken(_titel(drukken=[_druk(kostenposten=kp)]))
        # Enkel 1000 / 2000 = 0.50
        for kanaal in (d.webshop, d.retail, d.b2b):
            assert kanaal.kosten_per_ex == pytest.approx(0.50, abs=TOL)

    def test_fulfillment_alleen_webshop(self):
        d = _bereken(_titel(fulfillment_per_ex=4.50))
        assert d.webshop.fulfillment == pytest.approx(4.50, abs=TOL)
        assert d.retail.fulfillment == pytest.approx(0.00, abs=TOL)
        assert d.b2b.fulfillment == pytest.approx(0.00, abs=TOL)

    def test_transactiekosten_op_incl_btw(self):
        # Shopify rekent over bruto verkoopprijs: 10.90 × 0.002 = 0.0218
        d = _bereken(_titel(transactiekosten_pct=0.002))
        assert d.webshop.transactiekosten == pytest.approx(0.0218, abs=TOL)
        assert d.retail.transactiekosten == pytest.approx(0.00, abs=TOL)
        assert d.b2b.transactiekosten == pytest.approx(0.00, abs=TOL)

    def test_distributie_cb_alleen_retail(self):
        d = _bereken(_titel(distributie_cb_per_ex=1.10))
        assert d.retail.distributie_cb == pytest.approx(1.10, abs=TOL)
        assert d.webshop.distributie_cb == pytest.approx(0.00, abs=TOL)
        assert d.b2b.distributie_cb == pytest.approx(0.00, abs=TOL)

    def test_b2b_porto_alleen_b2b(self):
        d = _bereken(_titel(b2b_porto_per_ex=2.00))
        assert d.b2b.b2b_porto == pytest.approx(2.00, abs=TOL)
        assert d.webshop.b2b_porto == pytest.approx(0.00, abs=TOL)
        assert d.retail.b2b_porto == pytest.approx(0.00, abs=TOL)

    def test_cac_per_druk(self):
        d = _bereken(_titel(drukken=[_druk(cac_per_ex=3.00)]))
        assert d.webshop.cac == pytest.approx(3.00, abs=TOL)
        assert d.retail.cac == pytest.approx(0.00, abs=TOL)
        assert d.b2b.cac == pytest.approx(0.00, abs=TOL)

    def test_cac_fallback_naar_titel_niveau(self):
        # cac_per_ex op druk = 0 → valt terug op titel-level
        d = _bereken(_titel(cac_per_ex=5.00, drukken=[_druk(cac_per_ex=0.0)]))
        assert d.webshop.cac == pytest.approx(5.00, abs=TOL)

    def test_overige_kosten_pct_van_netto_omzet(self):
        d = _bereken(_titel(overige_kosten_pct=0.10))
        # retail: 5.20 × 0.10 = 0.52
        assert d.retail.overige_kosten == pytest.approx(0.52, abs=TOL)
        # webshop: 10.00 × 0.10 = 1.00
        assert d.webshop.overige_kosten == pytest.approx(1.00, abs=TOL)
        # b2b (geen korting): 10.00 × 0.10 = 1.00
        assert d.b2b.overige_kosten == pytest.approx(1.00, abs=TOL)


# ─────────────────────────────────────────────────────────────────────
#  C. BRUTOWINST-INVARIANT
# ─────────────────────────────────────────────────────────────────────

class TestBrutowinstInvariant:
    """brutowinst moet altijd gelijk zijn aan netto_omzet − totaal_kosten."""

    def _check_alle_kanalen(self, t):
        d = _bereken(t)
        for kanaal in (d.webshop, d.retail, d.b2b):
            assert kanaal.brutowinst == pytest.approx(
                kanaal.netto_omzet - kanaal.totaal_kosten, abs=TOL
            ), f"brutowinst-invariant fout voor {kanaal.kanaal}"

    def test_basis_scenario(self):
        self._check_alle_kanalen(_titel())

    def test_met_kostenposten(self):
        kp = [KostenPost("v", "V", "productie", 1500.0)]
        self._check_alle_kanalen(_titel(drukken=[_druk(kostenposten=kp)]))

    def test_met_royalty(self):
        self._check_alle_kanalen(_titel(auteur_royalty_staffel=[
            StaffelTrede(tot_exemplaren=5000, percentage=0.08)
        ]))

    def test_met_alle_kosten(self):
        self._check_alle_kanalen(_titel(
            fulfillment_per_ex=4.50,
            transactiekosten_pct=0.003,
            distributie_cb_per_ex=1.20,
            b2b_porto_per_ex=1.50,
            b2b_korting_pct=0.15,
            overige_kosten_pct=0.05,
            vertaler_pct=0.10,
            auteur_royalty_staffel=[StaffelTrede(tot_exemplaren=5000, percentage=0.08)],
        ))


# ─────────────────────────────────────────────────────────────────────
#  D. AUTEUR-DEAL
# ─────────────────────────────────────────────────────────────────────

class TestAuteurDeal:
    """
    Gebruik B2B zonder korting en zonder porto voor schone berekeningen:
      netto_omzet = 10.00, drukkosten = 1.00 → brutowinst = 9.00
    """

    def test_geen_deal(self):
        d = _bereken(_titel())
        assert d.b2b.auteur_royalty == pytest.approx(0.00, abs=TOL)
        assert d.b2b.auteur_winstdeling == pytest.approx(0.00, abs=TOL)
        # Marge = netto_winst / netto_omzet = 9.00 / 10.00 = 90%
        assert d.b2b.netto_winst_maven == pytest.approx(9.00, abs=TOL)
        assert d.b2b.marge_pct == pytest.approx(0.90, abs=TOL)

    def test_auteur_winstdeling_50pct(self):
        d = _bereken(_titel(auteur_winstdeling_pct=0.50))
        # brutowinst B2B = 9.00
        # auteur_winstdeling = 9.00 × 0.50 = 4.50
        assert d.b2b.auteur_winstdeling == pytest.approx(4.50, abs=TOL)
        assert d.b2b.auteur_royalty == pytest.approx(0.00, abs=TOL)
        # netto_winst = 9.00 − 4.50 = 4.50
        assert d.b2b.netto_winst_maven == pytest.approx(4.50, abs=TOL)
        assert d.b2b.marge_pct == pytest.approx(0.45, abs=TOL)

    def test_auteur_royalty_staffel_8pct(self):
        d = _bereken(_titel(
            auteur_royalty_staffel=[StaffelTrede(tot_exemplaren=10_000, percentage=0.08)]
        ))
        # royalty = 10.00 × 0.08 = 0.80 → zit in totaal_kosten
        assert d.b2b.auteur_royalty == pytest.approx(0.80, abs=TOL)
        assert d.b2b.auteur_winstdeling == pytest.approx(0.00, abs=TOL)
        # brutowinst = 10.00 − 1.00 (druk) − 0.80 (royalty) = 8.20
        assert d.b2b.brutowinst == pytest.approx(8.20, abs=TOL)
        assert d.b2b.netto_winst_maven == pytest.approx(8.20, abs=TOL)

    def test_royalty_staffel_sluit_winstdeling_uit(self):
        # Als staffel aanwezig is, wordt auteur_winstdeling_pct genegeerd
        d = _bereken(_titel(
            auteur_royalty_staffel=[StaffelTrede(tot_exemplaren=10_000, percentage=0.08)],
            auteur_winstdeling_pct=0.50,  # mag niet meetellen
        ))
        assert d.b2b.auteur_winstdeling == pytest.approx(0.00, abs=TOL)
        assert d.b2b.auteur_royalty == pytest.approx(0.80, abs=TOL)

    def test_royalty_retail(self):
        # Royalty is % van verkoopprijs ex BTW (niet van netto omzet)
        d = _bereken(_titel(
            auteur_royalty_staffel=[StaffelTrede(tot_exemplaren=10_000, percentage=0.08)]
        ))
        # Zowel retail als webshop: royalty = 10.00 × 0.08 = 0.80
        assert d.retail.auteur_royalty == pytest.approx(0.80, abs=TOL)
        assert d.webshop.auteur_royalty == pytest.approx(0.80, abs=TOL)
        assert d.b2b.auteur_royalty == pytest.approx(0.80, abs=TOL)

    def test_auteur_winstdeling_pct_van_brutowinst(self):
        # brutowinst retail = 5.20 − 1.00 (druk) − 1.10 (CB) = 3.10
        # auteur 50% = 1.55
        d = _bereken(_titel(auteur_winstdeling_pct=0.50))
        assert d.retail.auteur_winstdeling == pytest.approx(1.55, abs=TOL)
        assert d.retail.netto_winst_maven == pytest.approx(1.55, abs=TOL)


# ─────────────────────────────────────────────────────────────────────
#  E. DERDEN-DEALS (agent, vertaler, illustrator)
# ─────────────────────────────────────────────────────────────────────

class TestDerdenDeal:
    def test_vertaler_royalty_vast_pct(self):
        d = _bereken(_titel(vertaler_pct=0.10))
        # 10.00 × 0.10 = 1.00 → in totaal_kosten (boven brutowinst)
        assert d.b2b.vertaler == pytest.approx(1.00, abs=TOL)
        assert d.b2b.brutowinst == pytest.approx(9.00 - 1.00, abs=TOL)

    def test_vertaler_winstdeling(self):
        d = _bereken(_titel(vertaler_winstdeling_pct=0.20))
        # brutowinst B2B = 9.00 → vertaler = 9.00 × 0.20 = 1.80 (ónder brutowinst)
        assert d.b2b.brutowinst == pytest.approx(9.00, abs=TOL)
        assert d.b2b.vertaler == pytest.approx(1.80, abs=TOL)
        assert d.b2b.netto_winst_maven == pytest.approx(9.00 - 1.80, abs=TOL)

    def test_vertaler_winstdeling_overschrijft_royalty_pct(self):
        # Als winstdeling_pct > 0, wordt royalty_pct genegeerd
        d = _bereken(_titel(vertaler_pct=0.10, vertaler_winstdeling_pct=0.20))
        # brutowinst ongewijzigd (geen royalty afgetrokken)
        assert d.b2b.brutowinst == pytest.approx(9.00, abs=TOL)
        assert d.b2b.vertaler == pytest.approx(1.80, abs=TOL)

    def test_agent_royalty_vast_pct(self):
        d = _bereken(_titel(agent_pct=0.15))
        assert d.b2b.agent == pytest.approx(1.50, abs=TOL)
        assert d.b2b.brutowinst == pytest.approx(9.00 - 1.50, abs=TOL)

    def test_agent_staffel(self):
        # Agent staffel 10% tot 3000 ex
        d = _bereken(_titel(agent_staffel=[StaffelTrede(tot_exemplaren=3_000, percentage=0.10)]))
        assert d.b2b.agent == pytest.approx(1.00, abs=TOL)

    def test_agent_winstdeling(self):
        d = _bereken(_titel(agent_winstdeling_pct=0.10))
        assert d.b2b.brutowinst == pytest.approx(9.00, abs=TOL)
        assert d.b2b.agent == pytest.approx(0.90, abs=TOL)
        assert d.b2b.netto_winst_maven == pytest.approx(8.10, abs=TOL)

    def test_illustrator_royalty_vast_pct(self):
        d = _bereken(_titel(illustrator_pct=0.05))
        assert d.b2b.illustrator == pytest.approx(0.50, abs=TOL)

    def test_illustrator_winstdeling(self):
        d = _bereken(_titel(illustrator_winstdeling_pct=0.15))
        assert d.b2b.brutowinst == pytest.approx(9.00, abs=TOL)
        assert d.b2b.illustrator == pytest.approx(9.00 * 0.15, abs=TOL)

    def test_auteur_plus_vertaler_plus_agent(self):
        # Gecombineerd scenario: royalty's vóór brutowinst, dan winstdeling erna
        # Auteur royalty 8%, vertaler royalty 10%, agent winstdeling 10%
        d = _bereken(_titel(
            auteur_royalty_staffel=[StaffelTrede(tot_exemplaren=10_000, percentage=0.08)],
            vertaler_pct=0.10,
            agent_winstdeling_pct=0.10,
        ))
        b = d.b2b
        # brutowinst = 10.00 − 1.00 (druk) − 0.80 (auteur royalty) − 1.00 (vertaler) = 7.20
        assert b.brutowinst == pytest.approx(7.20, abs=TOL)
        # agent winstdeling = 7.20 × 0.10 = 0.72
        assert b.agent == pytest.approx(0.72, abs=TOL)
        # netto winst = 7.20 − 0.72 = 6.48
        assert b.netto_winst_maven == pytest.approx(6.48, abs=TOL)


# ─────────────────────────────────────────────────────────────────────
#  F. PARTNER-WINSTDELING
# ─────────────────────────────────────────────────────────────────────

class TestPartnerWinstdeling:
    def test_partner_niet_in_netto_winst_maven(self):
        # Partner is informatief en telt NIET mee in netto_winst_maven
        d = _bereken(_titel(heeft_partner=True, partner_winstdeling_pct=0.50))
        b = d.b2b
        # brutowinst = 9.00, geen auteur/derden
        assert b.partner_winstdeling == pytest.approx(4.50, abs=TOL)
        # Netto winst Maven ongewijzigd: partner is buiten de titel-marge
        assert b.netto_winst_maven == pytest.approx(9.00, abs=TOL)
        assert b.marge_pct == pytest.approx(0.90, abs=TOL)

    def test_partner_grondslag_na_auteur_en_derden(self):
        # Partner-grondslag = brutowinst − auteur_winstdeling − derden_winstdeling
        d = _bereken(_titel(
            heeft_partner=True,
            partner_winstdeling_pct=0.50,
            auteur_winstdeling_pct=0.40,
            vertaler_winstdeling_pct=0.10,
        ))
        b = d.b2b
        # brutowinst = 9.00
        # auteur = 9.00 × 0.40 = 3.60
        # vertaler = 9.00 × 0.10 = 0.90
        # grondslag partner = 9.00 − 3.60 − 0.90 = 4.50
        # partner = 4.50 × 0.50 = 2.25
        assert b.auteur_winstdeling == pytest.approx(3.60, abs=TOL)
        assert b.vertaler == pytest.approx(0.90, abs=TOL)
        assert b.partner_winstdeling == pytest.approx(2.25, abs=TOL)
        # netto_winst_maven = 9.00 − 3.60 − 0.90 = 4.50 (partner NIET afgetrokken)
        assert b.netto_winst_maven == pytest.approx(4.50, abs=TOL)

    def test_geen_partner(self):
        d = _bereken(_titel(heeft_partner=False))
        assert d.b2b.partner_winstdeling == pytest.approx(0.00, abs=TOL)


# ─────────────────────────────────────────────────────────────────────
#  G. EXTRA DERDEN
# ─────────────────────────────────────────────────────────────────────

class TestExtraDerden:
    def test_extra_royalty_voor_brutowinst(self):
        extra = ExtraDerde(id="e1", naam="Co-auteur", type="royalty", percentage=0.06)
        d = _bereken(_titel(extra_derden=[extra]))
        b = d.b2b
        # royalty = 10.00 × 0.06 = 0.60, in totaal_kosten
        assert b.extra_derden_totaal == pytest.approx(0.60, abs=TOL)
        # brutowinst = 10.00 − 1.00 − 0.60 = 8.40
        assert b.brutowinst == pytest.approx(8.40, abs=TOL)
        assert b.netto_winst_maven == pytest.approx(8.40, abs=TOL)

    def test_extra_winstdeling_na_brutowinst(self):
        extra = ExtraDerde(id="e1", naam="Co-auteur", type="winstdeling", percentage=0.20)
        d = _bereken(_titel(extra_derden=[extra]))
        b = d.b2b
        # brutowinst = 9.00 (niet geraakt door winstdeling)
        assert b.brutowinst == pytest.approx(9.00, abs=TOL)
        # winstdeling = 9.00 × 0.20 = 1.80
        assert b.extra_derden_totaal == pytest.approx(1.80, abs=TOL)
        # netto winst = 9.00 − 1.80 = 7.20
        assert b.netto_winst_maven == pytest.approx(7.20, abs=TOL)

    def test_extra_royalty_staffel(self):
        extra = ExtraDerde(
            id="e1", naam="Bewerker", type="royalty",
            staffel=[StaffelTrede(tot_exemplaren=5_000, percentage=0.05)]
        )
        d = _bereken(_titel(extra_derden=[extra]))
        b = d.b2b
        # staffel 5% → 10.00 × 0.05 = 0.50
        assert b.extra_derden_totaal == pytest.approx(0.50, abs=TOL)

    def test_extra_derden_per_naam_gevuld(self):
        extras = [
            ExtraDerde(id="e1", naam="Persoon A", type="royalty", percentage=0.05),
            ExtraDerde(id="e2", naam="Persoon B", type="winstdeling", percentage=0.10),
        ]
        d = _bereken(_titel(extra_derden=extras))
        b = d.b2b
        namen = [x["naam"] for x in b.extra_derden_per_naam]
        assert "Persoon A" in namen
        assert "Persoon B" in namen

    def test_meerdere_extra_royalty_derden(self):
        extras = [
            ExtraDerde(id="e1", naam="A", type="royalty", percentage=0.05),
            ExtraDerde(id="e2", naam="B", type="royalty", percentage=0.05),
        ]
        d = _bereken(_titel(extra_derden=extras))
        b = d.b2b
        # Totaal royalty = 10.00 × (0.05 + 0.05) = 1.00 → voor brutowinst
        assert b.brutowinst == pytest.approx(9.00 - 1.00, abs=TOL)


# ─────────────────────────────────────────────────────────────────────
#  H. STAFFEL-BEREKENING
# ─────────────────────────────────────────────────────────────────────

class TestStaffelBerekening:
    def test_lege_staffel_geeft_nul(self):
        assert bereken_gemiddeld_staffel_percentage([], 1, 2000) == pytest.approx(0.0)

    def test_nul_exemplaren_geeft_nul(self):
        s = [StaffelTrede(1000, 0.08)]
        assert bereken_gemiddeld_staffel_percentage(s, 1, 0) == pytest.approx(0.0)

    def test_enkelvoudige_trede_alle_ex_erin(self):
        s = [StaffelTrede(5_000, 0.08)]
        pct = bereken_gemiddeld_staffel_percentage(s, 1, 2_000)
        assert pct == pytest.approx(0.08, abs=TOL)

    def test_twee_treden_druk1(self):
        s = [StaffelTrede(1_000, 0.06), StaffelTrede(3_000, 0.08)]
        # ex 1–1000: 0.06 (1000 ex), ex 1001–2000: 0.08 (1000 ex)
        # gewogen = (1000×0.06 + 1000×0.08) / 2000 = 0.07
        pct = bereken_gemiddeld_staffel_percentage(s, 1, 2_000)
        assert pct == pytest.approx(0.07, abs=TOL)

    def test_twee_treden_druk2(self):
        s = [StaffelTrede(1_000, 0.06), StaffelTrede(3_000, 0.08)]
        # Druk 2 start bij ex 2001, 1000 ex → in trede 2 (0.08)
        pct = bereken_gemiddeld_staffel_percentage(s, 2_001, 1_000)
        assert pct == pytest.approx(0.08, abs=TOL)

    def test_voorbij_alle_treden_gebruik_laatste(self):
        s = [StaffelTrede(1_000, 0.06), StaffelTrede(2_000, 0.08)]
        # Start bij ex 3001 (buiten alle treden) → laatste trede: 0.08
        pct = bereken_gemiddeld_staffel_percentage(s, 3_001, 500)
        assert pct == pytest.approx(0.08, abs=TOL)

    def test_drie_treden(self):
        s = [
            StaffelTrede(1_000, 0.06),
            StaffelTrede(3_000, 0.08),
            StaffelTrede(6_000, 0.10),
        ]
        # 3000 ex start bij 1: ex 1–1000 (0.06), ex 1001–3000 (0.08)
        # gewogen = (1000×0.06 + 2000×0.08) / 3000 = 220/3000
        pct = bereken_gemiddeld_staffel_percentage(s, 1, 3_000)
        assert pct == pytest.approx(220 / 3000, abs=TOL)

    def test_staffel_grens_exact(self):
        s = [StaffelTrede(1_000, 0.06), StaffelTrede(2_000, 0.08)]
        # Exact 1000 ex vanaf ex 1: alles in trede 1 (0.06)
        pct = bereken_gemiddeld_staffel_percentage(s, 1, 1_000)
        assert pct == pytest.approx(0.06, abs=TOL)

    def test_staffel_een_ex_op_grens(self):
        s = [StaffelTrede(1_000, 0.06), StaffelTrede(2_000, 0.08)]
        # Ex 1000 (exact grens) → in trede 1 (0.06)
        pct = bereken_gemiddeld_staffel_percentage(s, 1_000, 1)
        assert pct == pytest.approx(0.06, abs=TOL)

    def test_staffel_een_ex_na_grens(self):
        s = [StaffelTrede(1_000, 0.06), StaffelTrede(2_000, 0.08)]
        # Ex 1001 → in trede 2 (0.08)
        pct = bereken_gemiddeld_staffel_percentage(s, 1_001, 1)
        assert pct == pytest.approx(0.08, abs=TOL)


# ─────────────────────────────────────────────────────────────────────
#  I. MULTI-DRUK BEREKENING
# ─────────────────────────────────────────────────────────────────────

class TestMultiDruk:
    def _twee_drukken(self, **kwargs):
        return TitelInput(
            titel="Twee drukken",
            verkoopprijs_incl_btw=10.90,
            btw_percentage=0.09,
            boekhandelskorting=0.48,
            drukken=[
                DrukConfig(druknummer=1, oplage=2_000, drukkosten_per_ex=1.00),
                DrukConfig(druknummer=2, oplage=3_000, drukkosten_per_ex=0.80),
            ],
            fulfillment_per_ex=4.50,
            transactiekosten_pct=0.002,
            distributie_cb_per_ex=1.10,
            b2b_porto_per_ex=0.0,
            b2b_korting_pct=0.0,
            **kwargs,
        )

    def test_cumulatief_voor_druk_correct(self):
        res = bereken_titel(self._twee_drukken())
        assert res.drukken[0].cumulatief_voor_druk == 0
        assert res.drukken[1].cumulatief_voor_druk == 2_000

    def test_drukkosten_per_druk_apart(self):
        res = bereken_titel(self._twee_drukken())
        assert res.drukken[0].b2b.drukkosten == pytest.approx(1.00, abs=TOL)
        assert res.drukken[1].b2b.drukkosten == pytest.approx(0.80, abs=TOL)

    def test_staffel_cumulatief_over_drukken(self):
        # Staffel: tot 2000 ex → 6%, daarna → 8%
        s = [StaffelTrede(2_000, 0.06), StaffelTrede(6_000, 0.08)]
        res = bereken_titel(self._twee_drukken(auteur_royalty_staffel=s))
        # Druk 1 (ex 1–2000): in trede 1 → 0.06 → royalty = 10.00×0.06=0.60
        assert res.drukken[0].b2b.auteur_royalty == pytest.approx(0.60, abs=TOL)
        # Druk 2 (ex 2001–5000): in trede 2 → 0.08 → royalty = 10.00×0.08=0.80
        assert res.drukken[1].b2b.auteur_royalty == pytest.approx(0.80, abs=TOL)

    def test_gewogen_marge_totaal(self):
        # Alleen retail (100%), eenvoudig controleerbaar.
        from app.routes.api_calculatie import run_calculation
        data = {
            "titel_input": {
                "titel": "Gewogen test",
                "verkoopprijs_incl_btw": 10.90,
                "btw_percentage": 0.09,
                "boekhandelskorting": 0.48,
                "drukken": [
                    {"druknummer": 1, "oplage": 2000, "drukkosten_per_ex": 1.00, "kostenposten": [], "cac_per_ex": 0},
                    {"druknummer": 2, "oplage": 3000, "drukkosten_per_ex": 0.80, "kostenposten": [], "cac_per_ex": 0},
                ],
                "fulfillment_per_ex": 0, "transactiekosten_pct": 0,
                "distributie_cb_per_ex": 1.10, "b2b_porto_per_ex": 0, "b2b_korting_pct": 0,
                "auteur_winstdeling_pct": 0.50, "auteur_royalty_staffel": [], "auteur_voorschot": 0,
                "agent_pct": 0, "agent_staffel": [], "agent_winstdeling_pct": 0, "agent_voorschot": 0,
                "vertaler_pct": 0, "vertaler_staffel": [], "vertaler_winstdeling_pct": 0, "vertaler_voorschot": 0,
                "illustrator_pct": 0, "illustrator_staffel": [], "illustrator_winstdeling_pct": 0, "illustrator_voorschot": 0,
                "heeft_partner": False, "partner_naam": "", "partner_winstdeling_pct": 0.5,
                "overige_kosten_pct": 0, "extra_derden": [],
            },
            "verdeling_webshop": 0.0,
            "verdeling_retail": 1.0,
            "verdeling_b2b": 0.0,
        }
        result = run_calculation(data)

        # Druk 1 retail: netto_omzet=5.20, brutowinst=5.20−1.00−1.10=3.10
        #   auteur=1.55, netto=1.55
        # Druk 2 retail: netto_omzet=5.20, brutowinst=5.20−0.80−1.10=3.30
        #   auteur=1.65, netto=1.65
        # total_winst = 2000×1.55 + 3000×1.65 = 3100 + 4950 = 8050
        # total_omzet = 2000×5.20 + 3000×5.20 = 10400 + 15600 = 26000
        expected = 8050 / 26000
        assert result["gewogen_marge_pct_totaal"] == pytest.approx(expected, abs=0.001)

        # Individuele drukken ook controleren
        assert result["drukken"][0]["retail"]["netto_winst_maven"] == pytest.approx(1.55, abs=TOL)
        assert result["drukken"][1]["retail"]["netto_winst_maven"] == pytest.approx(1.65, abs=TOL)


# ─────────────────────────────────────────────────────────────────────
#  J. NETTO-WINST-INVARIANT EN MARGE-CONSISTENTIE
# ─────────────────────────────────────────────────────────────────────

class TestNettoWinstInvariant:
    """
    Twee invarianten die altijd moeten kloppen:
      1. netto_winst_maven = brutowinst − auteur_winstdeling − derden_winstdeling
      2. marge_pct = netto_winst_maven / netto_omzet
    """

    def _check_invarianten(self, t, kanaal_naam):
        d = _bereken(t)
        k = getattr(d, kanaal_naam)
        # Invariant 1
        assert k.netto_winst_maven == pytest.approx(
            k.brutowinst - k.auteur_winstdeling - k.vertaler - k.illustrator - k.agent
            - k.extra_derden_totaal + sum(
                x["bedrag"] for x in k.extra_derden_per_naam if x["type"] == "royalty"
            ),
            abs=TOL,
        ), f"netto_winst_maven-invariant fout voor {kanaal_naam}"
        # Invariant 2
        if k.netto_omzet > 0:
            assert k.marge_pct == pytest.approx(
                k.netto_winst_maven / k.netto_omzet, abs=TOL
            ), f"marge_pct-invariant fout voor {kanaal_naam}"

    def test_marge_pct_consistentie_retail(self):
        t = _titel(auteur_winstdeling_pct=0.50)
        d = _bereken(t)
        rt = d.retail
        assert rt.marge_pct == pytest.approx(rt.netto_winst_maven / rt.netto_omzet, abs=TOL)

    def test_marge_pct_consistentie_webshop(self):
        t = _titel(auteur_winstdeling_pct=0.50)
        d = _bereken(t)
        ws = d.webshop
        assert ws.marge_pct == pytest.approx(ws.netto_winst_maven / ws.netto_omzet, abs=TOL)

    def test_volledig_scenario_alle_invarianten(self):
        # Rijke configuratie: royalty auteur + winstdeling vertaler + extra derden
        t = _titel(
            auteur_royalty_staffel=[StaffelTrede(5_000, 0.08)],
            vertaler_winstdeling_pct=0.10,
            agent_pct=0.15,
            extra_derden=[ExtraDerde("e1", "Co", "royalty", 0.05)],
            overige_kosten_pct=0.02,
            heeft_partner=True,
            partner_winstdeling_pct=0.50,
        )
        d = _bereken(t)
        for kanaal in (d.webshop, d.retail, d.b2b):
            # brutowinst-invariant
            assert kanaal.brutowinst == pytest.approx(
                kanaal.netto_omzet - kanaal.totaal_kosten, abs=TOL
            )
            # marge-invariant
            if kanaal.netto_omzet > 0:
                assert kanaal.marge_pct == pytest.approx(
                    kanaal.netto_winst_maven / kanaal.netto_omzet, abs=TOL
                )
            # partner zit NIET in netto_winst_maven
            # netto_winst = brutowinst − auteur_winstdeling(0) − derden_winstdeling(vertaler+agent via winstdeling)
            # let op: agent is royalty-mode hier (agent_pct=0.15, agent_winstdeling=0)
            assert kanaal.netto_winst_maven == pytest.approx(
                kanaal.brutowinst - kanaal.auteur_winstdeling - kanaal.vertaler,
                abs=TOL,
            )


# ─────────────────────────────────────────────────────────────────────
#  K. EDGE CASES
# ─────────────────────────────────────────────────────────────────────

class TestEdgeCases:
    def test_nul_oplage_geen_deling_door_nul(self):
        t = _titel(drukken=[_druk(oplage=0)])
        # Moet geen exception gooien
        d = _bereken(t)
        assert d.retail.kosten_per_ex == pytest.approx(0.00, abs=TOL)

    def test_nul_verkoopprijs(self):
        t = _titel(verkoopprijs_incl_btw=0.0)
        d = _bereken(t)
        assert d.retail.netto_omzet == pytest.approx(0.00, abs=TOL)
        assert d.retail.marge_pct == pytest.approx(0.00, abs=TOL)

    def test_hoge_drukkosten_negatieve_marge(self):
        # Drukkosten > netto omzet → negatieve brutowinst, negatieve marge
        t = _titel(drukken=[_druk(drukkosten_per_ex=20.00)])
        d = _bereken(t)
        # retail netto omzet = 5.20, drukkosten = 20.00
        assert d.retail.brutowinst < 0
        assert d.retail.marge_pct < 0

    def test_boekhandelskorting_100pct(self):
        t = _titel(boekhandelskorting=1.00)
        d = _bereken(t)
        assert d.retail.netto_omzet == pytest.approx(0.00, abs=TOL)

    def test_extra_derden_leeg(self):
        t = _titel(extra_derden=[])
        d = _bereken(t)
        assert d.b2b.extra_derden_totaal == pytest.approx(0.00, abs=TOL)

    def test_geen_drukken_geeft_lege_lijst(self):
        t = _titel(drukken=[])
        res = bereken_titel(t)
        assert res.drukken == []
