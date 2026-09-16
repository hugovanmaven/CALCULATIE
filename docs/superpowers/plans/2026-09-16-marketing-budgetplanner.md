# Marketing-budgetplanner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een berekend marketingbudget per titel (o.b.v. de eerste oplage) tonen, dat verdeelbaar is over vaste marketingonderdelen met drie fases (toegewezen/committed/besteed), waarbij `max(...)` per onderdeel als marketingkost in de marge meeloopt en de losse offline/online-kostenposten vervangt.

**Architecture:** Pure rekenlogica in `calculatie.py` (engine, TDD via pytest); persistentie als JSON-kolom op `Titel` met idempotente on-the-fly migratie (patroon `cac_per_ex`); API breidt input-parsing en calc-output uit; React-formulier krijgt een nieuwe planner-sectie, de oude offline/online kostenpost-categorieën verdwijnen en het CAC-veld verhuist mee.

**Tech Stack:** Flask 3.1 + SQLAlchemy 2 + Postgres (backend), pytest (tests), React 19 + TypeScript + Vite + Tailwind v4 (frontend), openpyxl (Excel-export).

**Spec:** `docs/superpowers/specs/2026-09-16-marketing-budgetplanner-design.md`

## Global Constraints

- Backend werk-dir voor tests/run: `deploy/`. Tests draaien met `python3 -m pytest` vanuit `deploy/`.
- Geen nieuwe Python-dependencies (alles met stdlib + bestaande libs).
- Bedragen worden in **euro's** opgeslagen; percentages zijn altijd afgeleid.
- `marketing_budget_pct` default = **0.08** (8%).
- Marketing-basislijst (vaste 7 onderdelen), exact deze ids/namen/groepen:
  - offline_marketing: `evenement`/"Evenement", `marketingmateriaal`/"Marketingmateriaal", `offline_campagne`/"Offline campagne", `boekhandelsmateriaal`/"Boekhandelsmateriaal"
  - online_marketing: `productfotografie`/"Productfotografie", `productie_ads`/"Productie ads", `software_kosten`/"Software kosten"
- Marge-kost per onderdeel = `max(toegewezen, committed, besteed)`.
- Planner-marketingkost hangt alleen aan de **eerste druk** (laagste druknummer), uitgesmeerd over die oplage.
- CAC blijft ongewijzigd in de marge (per-ex, alleen webshop); in de planner alleen tonen + €-equivalent, géén fases.
- Frontend heeft geen unit-testrunner. Frontend-taken verifiëren via `npm run build` (typecheck) + preview-screenshot ter goedkeuring (Maven-werkwijze), niet via automated tests.

## File Structure

**Backend:**
- `deploy/app/calculatie.py` — nieuwe `MarketingOnderdeel` dataclass, `TitelInput`-velden, `bereken_marketing_budget()`, marge-integratie in `KanaalResultaat`/`bereken_kanaal`/`bereken_titel`.
- `deploy/app/routes/api_calculatie.py` — parsing (`_marketing_onderdelen_list`, `dict_to_titel_input`) + calc-output (`run_calculation`).
- `deploy/app/db.py` — twee kolommen op `Titel`.
- `deploy/app/storage_calculatie.py` — veldenlijsten, `ensure_schema()` ALTER, on-the-fly migratie.
- `deploy/app/routes/mcp.py` — `titel_detail`-output.
- `deploy/tests/test_calculatie.py` — engine-tests (uitbreiden).
- `deploy/tests/test_marketing_migratie.py` — nieuwe migratietest.

**Frontend:**
- `frontend/src/api/types.ts` — interface + defaults + kostenposten-herschikking.
- `frontend/src/lib/marketing.ts` — nieuw: TS-budgetformule (spiegel van Python) + helpers.
- `frontend/src/components/form/MarketingPlannerSection.tsx` — nieuw: de planner.
- `frontend/src/components/form/KostenpostenSection.tsx` — offline/online categorieën + CAC-leadingRow verwijderen.
- `frontend/src/components/form/CalculatieForm.tsx` — planner inhaken.
- `frontend/src/api/client.ts` — payload-velden (indien nodig).
- `frontend/src/components/results/UnifiedDashboard.tsx` — marketing-kostregel + budgettile tonen.
- `frontend/src/components/export/ExportButtons.tsx` — n.v.t. (Excel zit backend).

---

## Task 1: MarketingOnderdeel dataclass + TitelInput-velden

**Files:**
- Modify: `deploy/app/calculatie.py` (na `KostenPost`, rond regel 34; en `TitelInput` rond regel 129)
- Test: `deploy/tests/test_calculatie.py`

**Interfaces:**
- Produces: `MarketingOnderdeel(id, naam, groep, volgorde, toegewezen, committed, besteed)` met methode `marge_kost() -> float`; `TitelInput.marketing_budget_pct: float`, `TitelInput.marketing_onderdelen: list[MarketingOnderdeel]`.

- [ ] **Step 1: Write the failing test**

Voeg toe onderaan `deploy/tests/test_calculatie.py`:

```python
from app.calculatie import MarketingOnderdeel


class TestMarketingOnderdeel:
    def test_marge_kost_neemt_maximum(self):
        o = MarketingOnderdeel(id="x", naam="X", groep="offline_marketing",
                               toegewezen=1000, committed=500, besteed=200)
        assert o.marge_kost() == pytest.approx(1000, abs=TOL)

    def test_marge_kost_committed_groter(self):
        o = MarketingOnderdeel(id="x", naam="X", toegewezen=300, committed=900, besteed=100)
        assert o.marge_kost() == pytest.approx(900, abs=TOL)

    def test_titelinput_heeft_marketing_defaults(self):
        t = _titel()
        assert t.marketing_budget_pct == pytest.approx(0.08, abs=TOL)
        assert t.marketing_onderdelen == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd deploy && python3 -m pytest tests/test_calculatie.py::TestMarketingOnderdeel -v`
Expected: FAIL met `ImportError: cannot import name 'MarketingOnderdeel'`.

- [ ] **Step 3: Write minimal implementation**

In `deploy/app/calculatie.py`, direct ná de `KostenPost`-dataclass (rond regel 34):

```python
@dataclass
class MarketingOnderdeel:
    """Eén onderdeel in de marketing-budgetplanner (titel-niveau).

    Drie fases van het geld: toegewezen (gepland) → committed (toegezegd/
    in progress) → besteed (factuur betaald). In de marge telt het maximum
    van de drie mee: het plan is de ondergrens, overschrijdingen tellen extra.
    """
    id: str = ""
    naam: str = ""
    groep: str = "offline_marketing"   # "offline_marketing" | "online_marketing"
    volgorde: int = 0
    toegewezen: float = 0.0
    committed: float = 0.0
    besteed: float = 0.0

    def marge_kost(self) -> float:
        return max(self.toegewezen, self.committed, self.besteed)
```

In `TitelInput`, ná `overige_kosten_pct` (regel 129):

```python
    # ── Marketing-budgetplanner (titel-niveau) ──
    marketing_budget_pct: float = 0.08
    marketing_onderdelen: list["MarketingOnderdeel"] = field(default_factory=list)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd deploy && python3 -m pytest tests/test_calculatie.py::TestMarketingOnderdeel -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add deploy/app/calculatie.py deploy/tests/test_calculatie.py
git commit -m "feat(marketing): MarketingOnderdeel dataclass + TitelInput-velden"
```

---

## Task 2: bereken_marketing_budget()

**Files:**
- Modify: `deploy/app/calculatie.py` (nieuwe functie na `bereken_gemiddeld_staffel_percentage`, rond regel 170)
- Test: `deploy/tests/test_calculatie.py`

**Interfaces:**
- Consumes: `TitelInput` (uit Task 1).
- Produces: `bereken_marketing_budget(t: TitelInput, verdeling_webshop: float, verdeling_retail: float, verdeling_b2b: float) -> float`.

- [ ] **Step 1: Write the failing test**

Voeg toe aan `deploy/tests/test_calculatie.py`:

```python
from app.calculatie import bereken_marketing_budget


class TestMarketingBudget:
    def test_retail_only(self):
        # vkp_ex=10, retail_basis = 10 - 10*0.48 = 5.20
        # budget = 0.08 * 2000 * 5.20 = 832
        t = _titel()
        b = bereken_marketing_budget(t, verdeling_webshop=0, verdeling_retail=1, verdeling_b2b=0)
        assert b == pytest.approx(832.0, abs=1e-2)

    def test_webshop_only(self):
        # webshop_basis = 10 - 4.50 - 10.90*0.002 = 5.4782
        # budget = 0.08 * 2000 * 5.4782 = 876.512
        t = _titel()
        b = bereken_marketing_budget(t, verdeling_webshop=1, verdeling_retail=0, verdeling_b2b=0)
        assert b == pytest.approx(876.512, abs=1e-2)

    def test_b2b_only_met_korting_en_porto(self):
        # b2b_basis = 10 - 10*0.20 - 0.50 = 7.50
        # budget = 0.08 * 2000 * 7.50 = 1200
        t = _titel(b2b_korting_pct=0.20, b2b_porto_per_ex=0.50)
        b = bereken_marketing_budget(t, verdeling_webshop=0, verdeling_retail=0, verdeling_b2b=1)
        assert b == pytest.approx(1200.0, abs=1e-2)

    def test_pct_aanpasbaar(self):
        t = _titel(marketing_budget_pct=0.10)
        b = bereken_marketing_budget(t, 0, 1, 0)
        # 0.10 * 2000 * 5.20 = 1040
        assert b == pytest.approx(1040.0, abs=1e-2)

    def test_gebruikt_eerste_druk_oplage(self):
        from app.calculatie import DrukConfig
        t = _titel(drukken=[
            DrukConfig(druknummer=2, oplage=5000, drukkosten_per_ex=1.0),
            DrukConfig(druknummer=1, oplage=1000, drukkosten_per_ex=1.0),
        ])
        # eerste druk = druknummer 1 → oplage 1000; 0.08*1000*5.20 = 416
        b = bereken_marketing_budget(t, 0, 1, 0)
        assert b == pytest.approx(416.0, abs=1e-2)

    def test_geen_drukken_geeft_nul(self):
        t = _titel(drukken=[])
        assert bereken_marketing_budget(t, 0, 1, 0) == pytest.approx(0.0, abs=TOL)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd deploy && python3 -m pytest tests/test_calculatie.py::TestMarketingBudget -v`
Expected: FAIL met `ImportError: cannot import name 'bereken_marketing_budget'`.

- [ ] **Step 3: Write minimal implementation**

In `deploy/app/calculatie.py`, na `bereken_gemiddeld_staffel_percentage` (rond regel 170):

```python
def bereken_marketing_budget(
    t: TitelInput,
    verdeling_webshop: float,
    verdeling_retail: float,
    verdeling_b2b: float,
) -> float:
    """Berekend marketingbudget o.b.v. de eerste oplage.

    budget = pct × eerste_oplage × Σ_kanaal ( aandeel × basis_per_ex ),
    waarbij basis_per_ex = verkoopprijs ex btw minus wat het kanaal kost:
      retail  : − boekhandelskorting (NIET CB-distributie)
      webshop : − fulfillment/ex − transactiekosten/ex
      b2b     : − b2b-korting − porto/ex
    """
    if not t.drukken:
        return 0.0
    eerste_oplage = sorted(t.drukken, key=lambda d: d.druknummer)[0].oplage
    vkp_ex = t.verkoopprijs_incl_btw / (1 + t.btw_percentage)

    retail_basis = vkp_ex - vkp_ex * t.boekhandelskorting
    webshop_basis = (
        vkp_ex - t.fulfillment_per_ex - t.verkoopprijs_incl_btw * t.transactiekosten_pct
    )
    b2b_basis = vkp_ex - vkp_ex * t.b2b_korting_pct - t.b2b_porto_per_ex

    gewogen_basis = (
        verdeling_webshop * webshop_basis
        + verdeling_retail * retail_basis
        + verdeling_b2b * b2b_basis
    )
    return t.marketing_budget_pct * eerste_oplage * gewogen_basis
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd deploy && python3 -m pytest tests/test_calculatie.py::TestMarketingBudget -v`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add deploy/app/calculatie.py deploy/tests/test_calculatie.py
git commit -m "feat(marketing): bereken_marketing_budget engine-formule"
```

---

## Task 3: Marge-integratie (marketing_per_ex op eerste druk)

**Files:**
- Modify: `deploy/app/calculatie.py` — `KanaalResultaat` (regel ~190), `bereken_kanaal` (signatuur ~236 + `totaal_kosten` ~327), `bereken_titel` (~408-432)
- Test: `deploy/tests/test_calculatie.py`

**Interfaces:**
- Consumes: `MarketingOnderdeel.marge_kost()` (Task 1).
- Produces: `KanaalResultaat.marketing_per_ex: float`; `bereken_kanaal(..., marketing_per_ex: float = 0.0)`; `bereken_titel` past `marketing_per_ex` alleen op de eerste druk toe.

- [ ] **Step 1: Write the failing test**

Voeg toe aan `deploy/tests/test_calculatie.py`:

```python
class TestMarketingMargeIntegratie:
    def _titel_met_onderdelen(self, **kw):
        onderdelen = [
            MarketingOnderdeel(id="a", naam="A", toegewezen=1000, committed=500, besteed=200),
            MarketingOnderdeel(id="b", naam="B", toegewezen=0, committed=0, besteed=600),
        ]
        # Σ max = max(1000,500,200)=1000 + max(0,0,600)=600 = 1600
        return _titel(marketing_onderdelen=onderdelen, **kw)

    def test_marketing_per_ex_op_eerste_druk(self):
        # 1600 / 2000 = 0.80 per exemplaar op elk kanaal
        d = _bereken(self._titel_met_onderdelen())
        assert d.webshop.marketing_per_ex == pytest.approx(0.80, abs=TOL)
        assert d.retail.marketing_per_ex == pytest.approx(0.80, abs=TOL)
        assert d.b2b.marketing_per_ex == pytest.approx(0.80, abs=TOL)

    def test_marketing_verlaagt_brutowinst(self):
        basis = _bereken(_titel()).retail.brutowinst
        met = _bereken(self._titel_met_onderdelen()).retail.brutowinst
        assert met == pytest.approx(basis - 0.80, abs=TOL)

    def test_alleen_eerste_druk_krijgt_marketing(self):
        from app.calculatie import DrukConfig, bereken_titel
        t = self._titel_met_onderdelen(drukken=[
            DrukConfig(druknummer=1, oplage=2000, drukkosten_per_ex=1.0),
            DrukConfig(druknummer=2, oplage=2000, drukkosten_per_ex=1.0),
        ])
        res = bereken_titel(t)
        assert res.drukken[0].webshop.marketing_per_ex == pytest.approx(0.80, abs=TOL)
        assert res.drukken[1].webshop.marketing_per_ex == pytest.approx(0.0, abs=TOL)

    def test_geen_onderdelen_geen_marketingkost(self):
        d = _bereken(_titel())
        assert d.retail.marketing_per_ex == pytest.approx(0.0, abs=TOL)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd deploy && python3 -m pytest tests/test_calculatie.py::TestMarketingMargeIntegratie -v`
Expected: FAIL met `AttributeError: 'KanaalResultaat' object has no attribute 'marketing_per_ex'`.

- [ ] **Step 3: Write minimal implementation**

In `KanaalResultaat`, ná `kosten_per_ex` (regel 185):

```python
    marketing_per_ex: float = 0.0      # planner-marketing, alleen eerste druk
```

In `bereken_kanaal`-signatuur (regel 236-244), voeg parameter toe:

```python
    cac_per_ex: float = 0.0,
    marketing_per_ex: float = 0.0,
) -> KanaalResultaat:
```

Direct na `r.kosten_per_ex = kosten_per_ex` (regel 263):

```python
    r.marketing_per_ex = marketing_per_ex
```

In de `r.totaal_kosten`-som (regel 327), voeg `+ r.marketing_per_ex` toe direct na `+ r.kosten_per_ex`:

```python
    r.totaal_kosten = (
        r.drukkosten
        + r.kosten_per_ex
        + r.marketing_per_ex
        + r.fulfillment
        ...
    )
```

In `bereken_titel` (regel 398-434), bereken de totale marketing-margekost vóór de druk-loop en pas 'm alleen op de eerste druk toe:

```python
def bereken_titel(t: TitelInput) -> CalculatieResultaat:
    """Volledige calculatie voor één titel (alle drukken)."""
    res = CalculatieResultaat(titel=t.titel)
    cumulatief = 0

    # Marketing-planner: Σ max(toegewezen, committed, besteed). Deze kost
    # hangt aan de eerste (launch-)druk, uitgesmeerd over die oplage.
    marketing_marge_totaal = sum(o.marge_kost() for o in (t.marketing_onderdelen or []))

    drukken_gesorteerd = sorted(t.drukken, key=lambda d: d.druknummer)

    for i, druk_cfg in enumerate(drukken_gesorteerd):
        oplage = druk_cfg.oplage
        kosten_totaal = sum(kp.bedrag for kp in druk_cfg.kostenposten)
        kosten_per_ex = kosten_totaal / oplage if oplage > 0 else 0.0

        marketing_per_ex = (
            marketing_marge_totaal / oplage if (i == 0 and oplage > 0) else 0.0
        )

        druk = DrukResultaat(
            druk_type=f"{druk_cfg.druknummer}e druk",
            oplage=oplage,
            cumulatief_voor_druk=cumulatief,
            kosten_totaal=kosten_totaal,
            drukkosten_totaal=druk_cfg.drukkosten_per_ex * oplage,
        )
        druk_cac = druk_cfg.cac_per_ex if druk_cfg.cac_per_ex else t.cac_per_ex
        for kanaal in ["webshop", "retail", "b2b"]:
            result = bereken_kanaal(
                t, kanaal,
                kosten_per_ex=kosten_per_ex,
                cumulatief_verkocht=cumulatief,
                oplage=oplage,
                drukkosten_per_ex=druk_cfg.drukkosten_per_ex,
                cac_per_ex=druk_cac,
                marketing_per_ex=marketing_per_ex,
            )
            setattr(druk, kanaal, result)
        res.drukken.append(druk)
        cumulatief += oplage

    return res
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd deploy && python3 -m pytest tests/test_calculatie.py -v`
Expected: PASS — nieuwe klasse groen én alle bestaande tests blijven groen (marketing_onderdelen default leeg → geen gedragsverandering).

- [ ] **Step 5: Commit**

```bash
git add deploy/app/calculatie.py deploy/tests/test_calculatie.py
git commit -m "feat(marketing): marketing_per_ex telt mee in marge op eerste druk"
```

---

## Task 4: API-parsing + calc-output

**Files:**
- Modify: `deploy/app/routes/api_calculatie.py` — import (regel 13), `_marketing_onderdelen_list` (nieuw, na `_kostenposten_list` ~38), `dict_to_titel_input` (~116), `run_calculation` (~155-185)
- Test: `deploy/tests/test_calculatie.py` (of nieuwe `deploy/tests/test_api_marketing.py`)

**Interfaces:**
- Consumes: `bereken_marketing_budget` (Task 2), `MarketingOnderdeel` (Task 1).
- Produces: `run_calculation(data)` retourneert extra keys `marketing_budget`, `marketing_marge_totaal`, `marketing_cac_euro`. `dict_to_titel_input` vult `marketing_budget_pct` + `marketing_onderdelen`.

- [ ] **Step 1: Write the failing test**

Nieuw bestand `deploy/tests/test_api_marketing.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd deploy && python3 -m pytest tests/test_api_marketing.py -v`
Expected: FAIL — `dict_to_titel_input` levert nog geen marketing-velden (`AttributeError`/KeyError).

- [ ] **Step 3: Write minimal implementation**

In `api_calculatie.py`, breid de import uit (regel 13):

```python
    TitelInput, StaffelTrede, KostenPost, DrukConfig, ExtraDerde,
    MarketingOnderdeel, bereken_marketing_budget,
```

(Let op: controleer de volledige importregel; `bereken_titel`, `KanaalResultaat`, `DrukResultaat` blijven staan.)

Na `_kostenposten_list` (regel 38) nieuwe helper:

```python
def _marketing_onderdelen_list(items: list[dict]) -> list[MarketingOnderdeel]:
    return [
        MarketingOnderdeel(
            id=o.get("id", ""),
            naam=o.get("naam", ""),
            groep=o.get("groep", "offline_marketing"),
            volgorde=o.get("volgorde", i),
            toegewezen=o.get("toegewezen", 0.0),
            committed=o.get("committed", 0.0),
            besteed=o.get("besteed", 0.0),
        )
        for i, o in enumerate(items)
    ]
```

In `dict_to_titel_input`, vóór de sluitende `)` (na `overige_kosten_pct`, regel 115):

```python
        overige_kosten_pct=d.get("overige_kosten_pct", 0.0),
        marketing_budget_pct=d.get("marketing_budget_pct", 0.08),
        marketing_onderdelen=_marketing_onderdelen_list(d.get("marketing_onderdelen", [])),
    )
```

In `run_calculation`, na `res = bereken_titel(t)` (regel 163) en in de return-dict (regel 180):

```python
    res = bereken_titel(t)

    marketing_budget = bereken_marketing_budget(t, verd_ws, verd_rt, verd_b2b)
    marketing_marge_totaal = sum(o.marge_kost() for o in (t.marketing_onderdelen or []))
    # CAC-€-equivalent (informatief, telt NIET in de kolomtotalen):
    # cac eerste druk × verwachte webshop-verkopen van de eerste oplage.
    if t.drukken:
        eerste = sorted(t.drukken, key=lambda d: d.druknummer)[0]
        eerste_cac = eerste.cac_per_ex if eerste.cac_per_ex else t.cac_per_ex
        marketing_cac_euro = eerste_cac * verd_ws * eerste.oplage
    else:
        marketing_cac_euro = 0.0
```

En breid de return-dict uit:

```python
    return {
        "titel": res.titel,
        "drukken": drukken_out,
        "gewogen_marge_pct_totaal": marge_totaal,
        "totaal_oplage": sum(d["oplage"] for d in drukken_out),
        "marketing_budget": marketing_budget,
        "marketing_marge_totaal": marketing_marge_totaal,
        "marketing_cac_euro": marketing_cac_euro,
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd deploy && python3 -m pytest tests/test_api_marketing.py -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add deploy/app/routes/api_calculatie.py deploy/tests/test_api_marketing.py
git commit -m "feat(marketing): API parseert onderdelen + geeft budget/cac in calc-output"
```

---

## Task 5: DB-kolommen + veldenlijsten + ensure_schema

**Files:**
- Modify: `deploy/app/db.py` — `Titel`-model (na `overige_kosten_items`, regel ~127)
- Modify: `deploy/app/storage_calculatie.py` — `_SCALAR_FIELDS` (regel 76), `_JSON_FIELDS` (regel 91), `ensure_schema` (regel 492)
- Test: `deploy/tests/test_marketing_migratie.py` (aangemaakt in Task 6; deze taak checkt kolom-persistentie handmatig)

**Interfaces:**
- Produces: `Titel.marketing_budget_pct` (Numeric), `Titel.marketing_onderdelen` (JSON); beide in de serialisatie-veldenlijsten; `ensure_schema()` voegt ontbrekende kolommen toe.

- [ ] **Step 1: Voeg kolommen toe aan het model**

In `deploy/app/db.py`, na `overige_kosten_items = Column(JSON, default=list)` (regel 127):

```python
    # ── Marketing-budgetplanner (titel-niveau) ──
    marketing_budget_pct = Column(Numeric(8, 6), default=0.08)
    marketing_onderdelen = Column(JSON, default=list)
```

- [ ] **Step 2: Voeg toe aan serialisatie-veldenlijsten**

In `deploy/app/storage_calculatie.py`, `_SCALAR_FIELDS` (voeg toe ná `"overige_kosten_pct"`):

```python
    "overige_kosten_pct",
    "marketing_budget_pct",
]
```

`_JSON_FIELDS` (voeg toe ná `"overige_kosten_items"`):

```python
    "overige_kosten_items",
    "marketing_onderdelen",
]
```

- [ ] **Step 3: Voeg ALTER toe aan ensure_schema**

Lees eerst `ensure_schema()` (regel 492-513) om het exacte patroon te volgen. Vervang het `version`-blok door één dat ook de marketing-kolommen dekt:

```python
def ensure_schema():
    """Lichte, idempotente schema-migratie (kolommen die create_all niet
    toevoegt aan bestaande tabellen)."""
    insp = inspect(db.engine)
    if "titels" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("titels")}
    with db.engine.begin() as conn:
        if "version" not in cols:
            conn.exec_driver_sql(
                "ALTER TABLE titels ADD COLUMN version INTEGER NOT NULL DEFAULT 1"
            )
        if "marketing_budget_pct" not in cols:
            conn.exec_driver_sql(
                "ALTER TABLE titels ADD COLUMN marketing_budget_pct NUMERIC(8,6) DEFAULT 0.08"
            )
        if "marketing_onderdelen" not in cols:
            conn.exec_driver_sql(
                "ALTER TABLE titels ADD COLUMN marketing_onderdelen JSON DEFAULT '[]'"
            )
```

(Behoud de bestaande imports/structuur; pas alleen aan wat nodig is. Als `ensure_schema` al een `with db.engine.begin()`-blok gebruikt, voeg dan alleen de twee `if`-checks toe.)

- [ ] **Step 4: Verifieer dat de app opstart en de tabel de kolommen krijgt**

Run: `cd deploy && python3 -c "import run"` — verwacht geen import-fout. (Volledige DB-verificatie loopt via Task 6-test.)

- [ ] **Step 5: Commit**

```bash
git add deploy/app/db.py deploy/app/storage_calculatie.py
git commit -m "feat(marketing): DB-kolommen marketing_budget_pct + marketing_onderdelen"
```

---

## Task 6: On-the-fly migratie oude kostenposten → onderdelen

**Files:**
- Modify: `deploy/app/storage_calculatie.py` — module-constante `DEFAULT_MARKETING_ONDERDELEN`, helper `_migrate_marketing`, aanroep in `titel_to_dict` (regel 109-134)
- Test: `deploy/tests/test_marketing_migratie.py` (nieuw)

**Interfaces:**
- Consumes: dict-vorm van `titel_input` met `drukken[].kostenposten`.
- Produces: `_migrate_marketing(titel_input: dict) -> None` (muteert in-place, idempotent): vult `marketing_onderdelen`, strijkt offline/online-kostenposten uit `drukken`.

- [ ] **Step 1: Write the failing test**

Nieuw bestand `deploy/tests/test_marketing_migratie.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd deploy && python3 -m pytest tests/test_marketing_migratie.py -v`
Expected: FAIL met `ImportError: cannot import name '_migrate_marketing'`.

- [ ] **Step 3: Write minimal implementation**

In `deploy/app/storage_calculatie.py`, near de top (na de veldenlijsten, rond regel 105):

```python
DEFAULT_MARKETING_ONDERDELEN = [
    {"id": "evenement", "naam": "Evenement", "groep": "offline_marketing"},
    {"id": "marketingmateriaal", "naam": "Marketingmateriaal", "groep": "offline_marketing"},
    {"id": "offline_campagne", "naam": "Offline campagne", "groep": "offline_marketing"},
    {"id": "boekhandelsmateriaal", "naam": "Boekhandelsmateriaal", "groep": "offline_marketing"},
    {"id": "productfotografie", "naam": "Productfotografie", "groep": "online_marketing"},
    {"id": "productie_ads", "naam": "Productie ads", "groep": "online_marketing"},
    {"id": "software_kosten", "naam": "Software kosten", "groep": "online_marketing"},
]


def _migrate_marketing(titel_input: dict) -> None:
    """On-the-fly, idempotente migratie: bouw ``marketing_onderdelen`` uit de
    oude offline/online-marketing kostenposten en strip die uit de drukken.

    Doet niets als ``marketing_onderdelen`` al gevuld is."""
    if titel_input.get("marketing_onderdelen"):
        return

    bedragen: dict[str, float] = {}
    namen: dict[str, str] = {}
    groepen: dict[str, str] = {}
    for druk in (titel_input.get("drukken") or []):
        if not isinstance(druk, dict):
            continue
        overgebleven = []
        for kp in (druk.get("kostenposten") or []):
            if kp.get("categorie") in ("offline_marketing", "online_marketing"):
                kid = kp.get("id", "")
                bedragen[kid] = bedragen.get(kid, 0.0) + (kp.get("bedrag") or 0.0)
                namen[kid] = kp.get("naam", kid)
                groepen[kid] = kp["categorie"]
            else:
                overgebleven.append(kp)
        druk["kostenposten"] = overgebleven

    onderdelen = []
    seen = set()
    for i, base in enumerate(DEFAULT_MARKETING_ONDERDELEN):
        kid = base["id"]
        seen.add(kid)
        onderdelen.append({
            "id": kid, "naam": base["naam"], "groep": base["groep"], "volgorde": i,
            "toegewezen": bedragen.get(kid, 0.0), "committed": 0.0, "besteed": 0.0,
        })
    volgorde = len(onderdelen)
    for kid, bedrag in bedragen.items():
        if kid in seen:
            continue
        onderdelen.append({
            "id": kid, "naam": namen.get(kid, kid),
            "groep": groepen.get(kid, "offline_marketing"), "volgorde": volgorde,
            "toegewezen": bedrag, "committed": 0.0, "besteed": 0.0,
        })
        volgorde += 1

    titel_input["marketing_onderdelen"] = onderdelen
```

In `titel_to_dict`, direct ná het cac-migratieblok (vóór de `return`, regel ~125):

```python
    # Migratie on-the-fly: oude offline/online-marketing kostenposten →
    # marketing_onderdelen (idempotent).
    _migrate_marketing(titel_input)

    return {
        "titel_input": titel_input,
        ...
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd deploy && python3 -m pytest tests/test_marketing_migratie.py -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Run de volledige backend-suite**

Run: `cd deploy && python3 -m pytest -v`
Expected: alles groen.

- [ ] **Step 6: Commit**

```bash
git add deploy/app/storage_calculatie.py deploy/tests/test_marketing_migratie.py
git commit -m "feat(marketing): idempotente migratie oude kostenposten -> onderdelen"
```

---

## Task 7: Frontend types + defaults + kostenposten-herschikking

**Files:**
- Modify: `frontend/src/api/types.ts` — nieuwe interface, `TitelInput`-velden, `DEFAULT_KOSTENPOSTEN` (regel 237-256), nieuwe `DEFAULT_MARKETING_ONDERDELEN`, `DEFAULT_TITEL_INPUT`

**Interfaces:**
- Produces: `interface MarketingOnderdeel`; `TitelInput.marketing_budget_pct: number`, `TitelInput.marketing_onderdelen: MarketingOnderdeel[]`; `DEFAULT_MARKETING_ONDERDELEN`.

- [ ] **Step 1: Voeg de interface toe**

In `frontend/src/api/types.ts`, bij de overige interfaces (na `KostenPost`, rond regel 12):

```typescript
export interface MarketingOnderdeel {
  id: string;
  naam: string;
  groep: 'offline_marketing' | 'online_marketing';
  volgorde: number;
  toegewezen: number;
  committed: number;
  besteed: number;
}
```

- [ ] **Step 2: Breid TitelInput uit**

Voeg aan de `TitelInput`-interface toe:

```typescript
  marketing_budget_pct: number;
  marketing_onderdelen: MarketingOnderdeel[];
```

- [ ] **Step 3: Haal marketing uit DEFAULT_KOSTENPOSTEN en voeg DEFAULT_MARKETING_ONDERDELEN toe**

Verwijder in `DEFAULT_KOSTENPOSTEN` (regel 248-256) alle items met categorie `offline_marketing` en `online_marketing` (laat alleen `productie` staan). Voeg daarna toe:

```typescript
export const DEFAULT_MARKETING_ONDERDELEN: MarketingOnderdeel[] = [
  { id: 'evenement', naam: 'Evenement', groep: 'offline_marketing', volgorde: 0, toegewezen: 0, committed: 0, besteed: 0 },
  { id: 'marketingmateriaal', naam: 'Marketingmateriaal', groep: 'offline_marketing', volgorde: 1, toegewezen: 0, committed: 0, besteed: 0 },
  { id: 'offline_campagne', naam: 'Offline campagne', groep: 'offline_marketing', volgorde: 2, toegewezen: 0, committed: 0, besteed: 0 },
  { id: 'boekhandelsmateriaal', naam: 'Boekhandelsmateriaal', groep: 'offline_marketing', volgorde: 3, toegewezen: 0, committed: 0, besteed: 0 },
  { id: 'productfotografie', naam: 'Productfotografie', groep: 'online_marketing', volgorde: 4, toegewezen: 0, committed: 0, besteed: 0 },
  { id: 'productie_ads', naam: 'Productie ads', groep: 'online_marketing', volgorde: 5, toegewezen: 0, committed: 0, besteed: 0 },
  { id: 'software_kosten', naam: 'Software kosten', groep: 'online_marketing', volgorde: 6, toegewezen: 0, committed: 0, besteed: 0 },
];
```

- [ ] **Step 4: Vul DEFAULT_TITEL_INPUT aan**

Voeg aan `DEFAULT_TITEL_INPUT` toe (na `extra_derden: []`):

```typescript
  marketing_budget_pct: 0.08,
  marketing_onderdelen: [...DEFAULT_MARKETING_ONDERDELEN],
```

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npm run build`
Expected: build slaagt (TypeScript-fouten in `KostenpostenSection`/`CalculatieForm` over verwijderde categorieën worden in Task 9 opgelost; als de build hier faalt puur daarop, ga door — Task 9 herstelt het. Commit deze taak pas als de types zelf kloppen; los compile-fouten die alléén uit deze wijziging voortkomen hier op).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/types.ts
git commit -m "feat(marketing): frontend-types + defaults, marketing uit kostenposten"
```

---

## Task 8: TS-budgethelper + MarketingPlannerSection

**Files:**
- Create: `frontend/src/lib/marketing.ts`
- Create: `frontend/src/components/form/MarketingPlannerSection.tsx`

**Interfaces:**
- Consumes: `TitelInput`, `MarketingOnderdeel` (Task 7).
- Produces: `berekenMarketingBudget(t, verdeling) -> number`; React-component `MarketingPlannerSection` met props `{ titelInput, updateField, verdeling, cacPerEx, setCacPerEx }`.

> **Bewuste duplicatie:** `berekenMarketingBudget` spiegelt de Python-formule uit Task 2, zodat de budget-tile live meebeweegt terwijl je typt zonder API-roundtrip. De backend blijft de bron van waarheid voor de marge. Houd beide formules identiek.

- [ ] **Step 1: Schrijf de budgethelper**

`frontend/src/lib/marketing.ts`:

```typescript
import type { TitelInput, MarketingOnderdeel } from '../api/types';

export interface Verdeling {
  webshop: number;
  retail: number;
  b2b: number;
}

/** Spiegel van bereken_marketing_budget in calculatie.py (Task 2). */
export function berekenMarketingBudget(t: TitelInput, v: Verdeling): number {
  if (!t.drukken.length) return 0;
  const eersteOplage = [...t.drukken].sort((a, b) => a.druknummer - b.druknummer)[0].oplage;
  const vkpEx = t.verkoopprijs_incl_btw / (1 + t.btw_percentage);
  const retailBasis = vkpEx - vkpEx * t.boekhandelskorting;
  const webshopBasis = vkpEx - t.fulfillment_per_ex - t.verkoopprijs_incl_btw * t.transactiekosten_pct;
  const b2bBasis = vkpEx - vkpEx * t.b2b_korting_pct - t.b2b_porto_per_ex;
  const gewogen = v.webshop * webshopBasis + v.retail * retailBasis + v.b2b * b2bBasis;
  return t.marketing_budget_pct * eersteOplage * gewogen;
}

export function margeKost(o: MarketingOnderdeel): number {
  return Math.max(o.toegewezen, o.committed, o.besteed);
}

export function generateOnderdeelId(): string {
  return 'custom_' + Math.random().toString(36).slice(2, 9);
}
```

- [ ] **Step 2: Schrijf de planner-component**

`frontend/src/components/form/MarketingPlannerSection.tsx`. Volg de stijl van bestaande form-secties (Tailwind-classes met `var(--...)`-tokens, zoals in `VerdelingSection`/`KostenpostenSection`). Structuur:

```tsx
import type { TitelInput, MarketingOnderdeel } from '../../api/types';
import { berekenMarketingBudget, margeKost, generateOnderdeelId, type Verdeling } from '../../lib/marketing';
import { Plus, X } from 'lucide-react';

interface Props {
  titelInput: TitelInput;
  updateField: <K extends keyof TitelInput>(field: K, value: TitelInput[K]) => void;
  verdeling: Verdeling;
  cacPerEx: number;
  setCacPerEx: (v: number) => void;
}

const GROEPEN: { key: MarketingOnderdeel['groep']; label: string }[] = [
  { key: 'offline_marketing', label: 'Offline marketing' },
  { key: 'online_marketing', label: 'Online marketing' },
];

function euro(n: number): string {
  return n.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function MarketingPlannerSection({ titelInput, updateField, verdeling, cacPerEx, setCacPerEx }: Props) {
  const onderdelen = titelInput.marketing_onderdelen;
  const budget = berekenMarketingBudget(titelInput, verdeling);
  const pct = Math.round(titelInput.marketing_budget_pct * 100);

  const eersteOplage = titelInput.drukken.length
    ? [...titelInput.drukken].sort((a, b) => a.druknummer - b.druknummer)[0].oplage
    : 0;
  const cacEuro = cacPerEx * verdeling.webshop * eersteOplage;

  const totToegewezen = onderdelen.reduce((s, o) => s + o.toegewezen, 0);
  const totCommitted = onderdelen.reduce((s, o) => s + o.committed, 0);
  const totBesteed = onderdelen.reduce((s, o) => s + o.besteed, 0);
  const nogOver = budget - totToegewezen;

  const patch = (id: string, veld: keyof MarketingOnderdeel, waarde: number) => {
    updateField('marketing_onderdelen', onderdelen.map(o =>
      o.id === id ? { ...o, [veld]: waarde } : o));
  };
  const setToegewezenPct = (id: string, p: number) => {
    patch(id, 'toegewezen', budget > 0 ? (p / 100) * budget : 0);
  };
  const addRij = (groep: MarketingOnderdeel['groep']) => {
    updateField('marketing_onderdelen', [...onderdelen, {
      id: generateOnderdeelId(), naam: '', groep,
      volgorde: onderdelen.length, toegewezen: 0, committed: 0, besteed: 0,
    }]);
  };
  const removeRij = (id: string) => {
    updateField('marketing_onderdelen', onderdelen.filter(o => o.id !== id));
  };

  return (
    <div className="space-y-4">
      {/* Budget-tile + %-veld */}
      <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Berekend marketingbudget</div>
          <div className="text-2xl font-semibold text-[var(--text-primary)]">€ {euro(budget)}</div>
        </div>
        <div className="text-right">
          <label className="block text-xs text-[var(--text-secondary)] mb-1">% van eerste oplage</label>
          <div className="flex items-center">
            <input
              type="number" value={pct} step={1} min={0} max={100}
              onChange={e => updateField('marketing_budget_pct', (parseFloat(e.target.value) || 0) / 100)}
              className="w-16 px-2 py-1.5 text-sm border border-[var(--border)] rounded-l bg-[var(--bg-primary)] text-[var(--text-primary)]"
            />
            <span className="inline-flex items-center px-2 py-1.5 text-xs text-[var(--text-tertiary)] bg-[var(--bg-secondary)] border border-l-0 border-[var(--border)] rounded-r">%</span>
          </div>
        </div>
      </div>

      {/* Tabel per groep */}
      {GROEPEN.map(groep => (
        <div key={groep.key} className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">{groep.label}</div>
          {onderdelen.filter(o => o.groep === groep.key).map(o => (
            <div key={o.id} className="grid grid-cols-[1.4fr_0.9fr_0.6fr_0.9fr_0.9fr_auto] gap-2 items-center">
              <input
                value={o.naam} placeholder="Naam"
                onChange={e => updateField('marketing_onderdelen', onderdelen.map(x => x.id === o.id ? { ...x, naam: e.target.value } : x))}
                className="px-2 py-1.5 text-sm border border-[var(--border)] rounded bg-[var(--bg-primary)] text-[var(--text-primary)]"
              />
              {/* Toegewezen € */}
              <input type="number" value={Math.round(o.toegewezen) || ''} step={50}
                onChange={e => patch(o.id, 'toegewezen', parseFloat(e.target.value) || 0)}
                className="px-2 py-1.5 text-sm border border-[var(--border)] rounded bg-[var(--bg-primary)] text-[var(--text-primary)]" />
              {/* Toegewezen % */}
              <input type="number" value={budget > 0 ? Math.round((o.toegewezen / budget) * 100) : 0} step={1}
                onChange={e => setToegewezenPct(o.id, parseFloat(e.target.value) || 0)}
                className="px-2 py-1.5 text-sm border border-[var(--border)] rounded bg-[var(--bg-primary)] text-[var(--text-primary)]" />
              {/* Committed € */}
              <input type="number" value={Math.round(o.committed) || ''} step={50}
                onChange={e => patch(o.id, 'committed', parseFloat(e.target.value) || 0)}
                className="px-2 py-1.5 text-sm border border-[var(--border)] rounded bg-[var(--bg-primary)] text-[var(--text-primary)]" />
              {/* Besteed € */}
              <input type="number" value={Math.round(o.besteed) || ''} step={50}
                onChange={e => patch(o.id, 'besteed', parseFloat(e.target.value) || 0)}
                className="px-2 py-1.5 text-sm border border-[var(--border)] rounded bg-[var(--bg-primary)] text-[var(--text-primary)]" />
              <button onClick={() => removeRij(o.id)} className="text-[var(--text-tertiary)] hover:text-red-500 p-1" title="Verwijderen">
                <X size={14} />
              </button>
            </div>
          ))}
          {/* CAC-regel binnen online marketing (informatief) */}
          {groep.key === 'online_marketing' && (
            <div className="grid grid-cols-[1.4fr_0.9fr_0.6fr_0.9fr_0.9fr_auto] gap-2 items-center opacity-90">
              <span className="text-sm text-[var(--text-secondary)] pl-1">CAC per webshop-aankoop</span>
              <div className="flex items-center">
                <span className="text-xs text-[var(--text-tertiary)] pr-1">€</span>
                <input type="number" value={cacPerEx || ''} step={0.5}
                  onChange={e => setCacPerEx(parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 text-sm border border-[var(--border)] rounded bg-[var(--bg-primary)] text-[var(--text-primary)]" />
              </div>
              <span className="text-xs text-[var(--text-tertiary)]">/ex</span>
              <span className="col-span-2 text-xs text-[var(--text-tertiary)]">≈ € {euro(cacEuro)} bij deze oplage (telt niet in kolomtotalen)</span>
              <span />
            </div>
          )}
          <button onClick={() => addRij(groep.key)} className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline mt-1">
            <Plus size={12} /> onderdeel
          </button>
        </div>
      ))}

      {/* Totalen */}
      <div className="grid grid-cols-[1.4fr_0.9fr_0.6fr_0.9fr_0.9fr_auto] gap-2 items-center border-t border-[var(--border)] pt-2 text-sm font-medium">
        <span>Totaal</span>
        <span>€ {euro(totToegewezen)}</span>
        <span>{budget > 0 ? Math.round((totToegewezen / budget) * 100) : 0}%</span>
        <span>€ {euro(totCommitted)}</span>
        <span>€ {euro(totBesteed)}</span>
        <span />
      </div>
      <div className="grid grid-cols-[1.4fr_0.9fr_0.6fr_0.9fr_0.9fr_auto] gap-2 items-center text-sm">
        <span className="text-[var(--text-secondary)]">Nog over (t.o.v. toegewezen)</span>
        <span className={nogOver < 0 ? 'text-red-500 font-semibold' : 'text-[var(--text-primary)]'}>€ {euro(nogOver)}</span>
        <span /><span /><span /><span />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npm run build`
Expected: `marketing.ts` en de component compileren (de rest van de app kan nog falen tot Task 9; los alleen fouten binnen deze twee bestanden op).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/marketing.ts frontend/src/components/form/MarketingPlannerSection.tsx
git commit -m "feat(marketing): budgethelper + MarketingPlannerSection component"
```

---

## Task 9: Formulier inhaken + oude categorieën/CAC verwijderen

**Files:**
- Modify: `frontend/src/components/form/KostenpostenSection.tsx` — `CATEGORIE_CONFIG` (regel 14-18), `MARKETING_CATEGORIES` (regel 24-27), de `online_marketing` leadingRow (CAC, regel ~239)
- Modify: `frontend/src/components/form/CalculatieForm.tsx` — planner-sectie inhaken, CAC/verdeling doorgeven
- Modify: `frontend/src/api/client.ts` — indien payload expliciet velden opsomt: marketing-velden toevoegen (anders n.v.t.)

**Interfaces:**
- Consumes: `MarketingPlannerSection` (Task 8), `berekenMarketingBudget` (Task 8).

- [ ] **Step 1: Lees de bestaande structuur**

Lees `frontend/src/components/form/CalculatieForm.tsx` volledig en `KostenpostenSection.tsx` (regel 1-30 en 210-260) om te zien hoe secties worden gerenderd, hoe `verdeling` en `updateField` beschikbaar zijn, en hoe `cac_per_ex` (per druk) nu wordt gezet.

- [ ] **Step 2: Verwijder marketing uit KostenpostenSection**

In `KostenpostenSection.tsx`: haal `offline_marketing` en `online_marketing` uit `CATEGORIE_CONFIG` (alleen `productie` blijft). Verwijder de export `MARKETING_CATEGORIES` (of leeg 'm). Verwijder de `else if (cat.key === 'online_marketing')`-tak met de CAC-`leadingRow` (die verhuist naar de planner). Verwijder ongebruikte imports die hierdoor overblijven.

- [ ] **Step 3: Haak de planner in CalculatieForm**

Voeg in `CalculatieForm.tsx` een nieuwe sectie toe (volg het bestaande `Section`/sectie-patroon), bijvoorbeeld met titel "Marketing":

```tsx
import { MarketingPlannerSection } from './MarketingPlannerSection';
// ...
<MarketingPlannerSection
  titelInput={titelInput}
  updateField={updateField}
  verdeling={verdeling}
  cacPerEx={eersteDruk.cac_per_ex}
  setCacPerEx={(v) => updateEersteDrukCac(v)}
/>
```

`verdeling` is het `{ webshop, retail, b2b }`-object dat ook `VerdelingSection` gebruikt. `cacPerEx`/`setCacPerEx` binden aan de **eerste druk** (`drukken[0].cac_per_ex`); implementeer `updateEersteDrukCac` conform hoe drukken elders worden bijgewerkt (map over `drukken`, patch de eerste op druknummer). Als er geen druk is, geef 0 en no-op.

- [ ] **Step 4: Controleer de client-payload**

Open `frontend/src/api/client.ts`. Als de calc-/save-payload het volledige `titelInput`-object doorstuurt (spread), zijn `marketing_budget_pct`/`marketing_onderdelen` automatisch meegenomen — geen wijziging nodig. Als velden expliciet worden opgesomd, voeg beide toe. Zorg dat de calc-response-types (indien getypeerd) `marketing_budget`, `marketing_marge_totaal`, `marketing_cac_euro` bevatten.

- [ ] **Step 5: Build + preview**

Run: `cd frontend && npm run build`
Expected: volledige build slaagt (geen TS-fouten meer).

Start daarna de preview (`.claude/launch.json` → `flask-calculatie`, port 5001) en maak een screenshot van: (a) de budget-tile met een ingevuld bedrag/oplage, (b) €↔% dat meebeweegt, (c) totalen + "nog over". **Deel de screenshot met Hugo/gebruiker ter goedkeuring vóór de PR** (Maven-werkwijze: geen UI zonder preview-akkoord).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/form/KostenpostenSection.tsx frontend/src/components/form/CalculatieForm.tsx frontend/src/api/client.ts
git commit -m "feat(marketing): planner in formulier, oude marketing-kostenposten + CAC-veld verplaatst"
```

---

## Task 10: Marketing zichtbaar in resultaten-dashboard

**Files:**
- Modify: `frontend/src/components/results/UnifiedDashboard.tsx`

**Interfaces:**
- Consumes: calc-response met `webshop/retail/b2b.marketing_per_ex` per druk + top-level `marketing_budget`, `marketing_marge_totaal`, `marketing_cac_euro`.

- [ ] **Step 1: Lees het dashboard**

Lees `UnifiedDashboard.tsx` en zoek waar de kostenregels per kanaal (bv. `kosten_per_ex`, `fulfillment`, `cac`) in de waterfall/uitsplitsing worden getoond.

- [ ] **Step 2: Voeg de marketing-kostregel toe**

Toon `marketing_per_ex` als eigen kostregel in de per-kanaal uitsplitsing, in dezelfde stijl als de bestaande regels (label "Marketing"). Zo blijft de waterfall kloppen: de som van de kostregels moet `totaal_kosten` blijven.

- [ ] **Step 3: (Optioneel, als er een titel-brede samenvatting is) toon budgetoverzicht**

Als het dashboard een titel-niveau samenvatting heeft, toon daar het berekende marketingbudget en `Σ max`-marketingkost; anders overslaan (de planner-sectie toont dit al).

- [ ] **Step 4: Build + preview**

Run: `cd frontend && npm run build`
Expected: build slaagt. Preview + screenshot van de uitsplitsing met de nieuwe Marketing-regel; deel ter goedkeuring.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/results/UnifiedDashboard.tsx
git commit -m "feat(marketing): marketing_per_ex als kostregel in resultaten-dashboard"
```

---

## Task 11: Excel-export

**Files:**
- Modify: `deploy/app/routes/api_calculatie.py` — de Excel-export-functie (rond regel 1050-1090, de `label(...)`-blokken voor verdeling)

**Interfaces:**
- Consumes: `data` (request dict met `titel_input.marketing_onderdelen`, `marketing_budget_pct`) + `run_calculation`-output.

- [ ] **Step 1: Lees de export-functie**

Lees in `api_calculatie.py` de Excel-export rond regel 1050-1090 (waar `label()` gebruikt wordt) om het patroon te volgen: hoe rijen, labels en waarden worden weggeschreven.

- [ ] **Step 2: Voeg een marketing-blok toe**

Voeg in de Calculatie- of Resultaat-tab een blok toe met: het berekende budget (uit `run_calculation`), en per onderdeel een rij met naam, toegewezen, committed, besteed. Sluit af met een totaalregel en "nog over". Volg exact de bestaande `label()`/celschrijf-stijl; geen formules (dat is een aparte, latere PR — zie spec "buiten scope").

- [ ] **Step 3: Verifieer de export**

Genereer lokaal een export voor een titel met ingevulde onderdelen (via de UI-preview of het bestaande export-endpoint) en open het bestand; controleer dat het marketing-blok klopt en niets anders brak.

- [ ] **Step 4: Commit**

```bash
git add deploy/app/routes/api_calculatie.py
git commit -m "feat(marketing): marketing-blok in Excel-export"
```

---

## Task 12: MCP titel_detail

**Files:**
- Modify: `deploy/app/routes/mcp.py` — `_tool_titel_detail` (regel ~159)

**Interfaces:**
- Consumes: titel-dict met `marketing_budget_pct` + `marketing_onderdelen`; `bereken_marketing_budget` / `run_calculation`.

- [ ] **Step 1: Lees `_tool_titel_detail`**

Lees `_tool_titel_detail` (regel 159-177) om te zien hoe de titel-samenvatting als tekst wordt opgebouwd.

- [ ] **Step 2: Voeg marketing toe aan de output**

Neem in de tekstuele output op: het berekende marketingbudget en per onderdeel de drie fases (toegewezen/committed/besteed). Read-only; geen nieuwe tools.

- [ ] **Step 3: Verifieer**

Run: `cd deploy && python3 -m pytest tests/test_mcp.py -v`
Expected: bestaande MCP-tests blijven groen. Voeg zo nodig een assert toe dat de output "marketingbudget" bevat voor een titel met onderdelen.

- [ ] **Step 4: Commit**

```bash
git add deploy/app/routes/mcp.py deploy/tests/test_mcp.py
git commit -m "feat(marketing): marketingbudget + onderdelen in MCP titel_detail"
```

---

## Afronding

- [ ] Volledige backend-suite groen: `cd deploy && python3 -m pytest -v`
- [ ] Frontend build groen: `cd frontend && npm run build`
- [ ] UI-previews goedgekeurd door gebruiker (Task 9 + 10)
- [ ] PR openen tegen `main` (`gh pr create --base main`) met samenvatting + screenshots; Hugo reviewt vóór merge. Niet zelf mergen.

## Self-Review (uitgevoerd bij schrijven)

- **Spec-dekking:** budgetformule (T2), max()-marge + eerste druk (T3), onderdelen vast+toevoegen (T7/T8), €/% naast elkaar (T8), CAC tonen-niet-dubbel (T3 laat marge ongemoeid, T8 toont €-equivalent), vervangen oude kostenposten (T6 migratie + T9 UI), datamodel/migratie (T5/T6), Excel (T11), MCP (T12), "nog over" t.o.v. toegewezen (T8). Alle spec-secties gedekt.
- **Type-consistentie:** `marketing_onderdelen`/`marketing_budget_pct` consistent in Python (dataclass), API-parsing, DB-veldenlijsten, TS-interface. `marge_kost()` (Py) ↔ `margeKost()` (TS). `bereken_marketing_budget` (Py) ↔ `berekenMarketingBudget` (TS), identieke formule.
- **Bewuste duplicatie** (TS-budgetformule) expliciet gemarkeerd in Task 8 met instructie ze gelijk te houden.
