# Ontwerp — Marketing-budgetplanner per titel

*Status: ontwerp, ter review. Datum: 2026-09-16.*

## Doel

Een berekend marketingbudget per titel tonen (op basis van de eerste
oplage), dat budget verdelen over vaste marketingonderdelen, en per
onderdeel de fase van het geld volgen: **toegewezen → committed →
besteed**. De planner vervangt de huidige losse offline/online-marketing
kostenposten en levert de marketingkost die in de marge meeloopt.

We bouwen voort op de bestaande opzet: de huidige marketing-kostenposten
worden gepromoveerd tot planner-onderdelen; hun namen en Offline/Online-
groepering blijven behouden.

## Berekend marketingbudget

```
budget = marketing_budget_pct × eerste_oplage ×
         Σ_kanaal ( aandeel[kanaal] × basis_per_ex[kanaal] )
```

- `marketing_budget_pct`: aanpasbaar veld op titel-niveau, **default 8%** (0.08).
- `eerste_oplage`: oplage van de eerste druk (`drukken[0].oplage`).
- `aandeel[kanaal]`: `verdeling_webshop` / `verdeling_retail` / `verdeling_b2b`.
- `basis_per_ex` per kanaal (verkoopprijs − btw − wat het kanaal kost):

| Kanaal | `basis_per_ex` |
|---|---|
| retail | `vkp_ex_btw − (vkp_ex_btw × boekhandelskorting)` — **CB-distributie NIET meegerekend** |
| webshop | `vkp_ex_btw − fulfillment_per_ex − (vkp_incl_btw × transactiekosten_pct)` |
| b2b | `vkp_ex_btw − (vkp_ex_btw × b2b_korting_pct) − b2b_porto_per_ex` |

waarbij `vkp_ex_btw = verkoopprijs_incl_btw / (1 + btw_percentage)`.

Het budget is **read-only** (afgeleid); alleen `marketing_budget_pct` is
invoerbaar.

Edge-case: als `budget = 0` (geen oplage/prijs), toon percentages leeg en
laat %-invoer niets doen tot het budget > 0 is.

## Onderdelen (de planner-regels)

Basislijst bij een nieuwe titel = de 7 bestaande marketing-kostenposten,
met behoud van groep:

- **Offline marketing:** Evenement, Marketingmateriaal, Offline campagne,
  Boekhandelsmateriaal
- **Online marketing:** Productfotografie, Productie ads, Software kosten

Eigenschappen per onderdeel:

```
{ id, naam, groep: "offline_marketing" | "online_marketing",
  volgorde, toegewezen: €, committed: €, besteed: € }
```

- Rijen zijn **vast + zelf toevoegen**: de basislijst staat er altijd, de
  gebruiker kan extra rijen toevoegen/verwijderen per titel.
- Bedragen worden in **euro's** opgeslagen. Het percentage bij
  *Toegewezen* is afgeleid: `toegewezen_% = toegewezen_€ / budget × 100`.

## Marge-integratie

- Marge-kost per onderdeel = **`max(toegewezen, committed, besteed)`**
  (het plan is de ondergrens; overschrijdingen tellen extra mee).
- Totale marketingkost = `Σ max(...)` over alle onderdelen.
- Deze kost **vervangt** de oude offline/online-marketing kostenposten in
  de marge. Productie-kostenposten blijven ongewijzigd.
- De kost hangt aan de **eerste druk** (launch-budget), uitgesmeerd over de
  eerste-druk-oplage: `marketing_per_ex = Σ max(...) / eerste_oplage`,
  toegevoegd aan de kost per exemplaar van elk kanaal van de eerste druk.
  Herdrukken krijgen geen planner-marketingkost (`marketing_per_ex = 0`).

## CAC (Customer Acquisition Cost)

CAC is € per webshop-verkoop (variabel, raakt alleen het webshop-kanaal)
en blijft mechanisch los van de lumpsum-onderdelen.

- **Marge:** ongewijzigd — CAC blijft `cac_per_ex` op het webshop-kanaal.
  Wordt **niet** als lumpsum toegevoegd (geen dubbeltelling).
- **UI/overzicht:** het CAC-invoerveld verhuist naar de Online-groep van de
  planner. Het €-equivalent wordt getoond in de marketing-totalen voor een
  compleet beeld:
  `cac_euro = cac_per_ex × (aandeel_webshop × eerste_oplage)`.
- CAC krijgt **geen** toegewezen/committed/besteed-velden.

## UI

Nieuwe sectie in het calculatie-formulier.

**Kop (kaart/tile):**
> **Berekend marketingbudget: € X** — met aanpasbaar %-veld (default 8%).

**Tabel**, gegroepeerd Offline / Online:

| Onderdeel | Toegewezen € | Toegewezen % | Committed € | Besteed € |
|---|---|---|---|---|
| Evenement | … | … | … | … |
| … | | | | |
| **+ onderdeel** | | | | |

- *Toegewezen €* en *Toegewezen %* staan **naast elkaar**, beide
  bewerkbaar; de ander beweegt automatisch mee. Onder water opgeslagen als
  €; typ je %, dan wordt het direct omgerekend naar € (% = % van het
  huidige budget).
- *Committed* en *Besteed*: alleen euro's.
- CAC verschijnt als aparte (per-ex) regel binnen de Online-groep, met z'n
  €-equivalent in de totalen (zie CAC-sectie).

**Totaalregel:**

| | Toegewezen | Committed | Besteed |
|---|---|---|---|
| **Totaal** | Σ | Σ | Σ |
| **Nog over** | budget − Σ toegewezen | | |

"Nog over" wordt gemeten t.o.v. *toegewezen* (wat nog niet verdeeld is).

`cac_euro` telt **niet** mee in de kolomtotalen (het is geen toegewezen/
committed/besteed bedrag). Het wordt als aparte informatieregel onder de
totalen getoond, zodat het marketingoverzicht compleet is zonder de fase-
kolommen te vervuilen.

## Datamodel & persistentie

Volgt het bestaande patroon (geneste collecties als JSON-kolom op `Titel`).

Nieuwe kolommen op `titels`:

- `marketing_budget_pct` — `Numeric(8,6)`, default `0.08`.
- `marketing_onderdelen` — `JSON`, default `list`. Lijst van
  onderdeel-objecten zoals hierboven.

Schema-migratie via `ensure_schema()` (idempotente `ALTER TABLE titels ADD
COLUMN ...`), conform de bestaande aanpak (bv. `version`).

**Datamigratie (on-the-fly, idempotent, zoals `cac_per_ex`):** bij het
laden/opslaan van een titel zonder `marketing_onderdelen`:

1. Verzamel alle kostenposten met categorie `offline_marketing` /
   `online_marketing` uit **alle** drukken; consolideer per `id` (som
   `bedrag`). Behoud `naam` en groep.
2. Vul de basislijst aan met onderdelen die nog ontbreken (bedrag 0).
3. Zet het geconsolideerde `bedrag` → `toegewezen`; `committed` en
   `besteed` starten op 0.
4. Verwijder de offline/online-kostenposten uit `drukken[].kostenposten`
   (productie blijft). Zo geen dubbeltelling in de marge.

## Raakvlakken

- **`KostenpostenSection` (frontend):** de categorieën `offline_marketing`
  en `online_marketing` verdwijnen uit deze sectie (worden de planner);
  alleen `productie` blijft. Het CAC-invoerveld (nu leadingRow onder
  online_marketing) verhuist naar de planner-Online-groep.
- **Engine (`calculatie.py`):** `bereken_titel` berekent `marketing_per_ex`
  voor de eerste druk uit `Σ max(...)`, en telt dat mee in de kost per
  exemplaar per kanaal van de eerste druk. Losse marketing-kostenposten
  tellen niet meer mee.
- **API (`api_calculatie.py`):** input/output uitbreiden met
  `marketing_budget_pct`, `marketing_onderdelen` en het berekende budget +
  totalen.
- **Excel-export:** planner-regels en totalen meenemen.
- **MCP (`titel_detail`):** planner-regels + berekend budget teruggeven.

## Beslissingen (log)

- Budget: 8% (aanpasbaar) × eerste oplage × gewogen netto-basis per ex.
- Retail-basis: alleen boekhandelskorting, niet CB-distributie.
- Webshop-basis: min fulfillment + transactiekosten. B2B-basis: min
  b2b-korting + porto.
- Onderdelen: vast (7 bestaande) + zelf toevoegen; Evenement blijft.
- Marge-kost per onderdeel = `max(toegewezen, committed, besteed)`.
- Planner vervangt losse offline/online-kostenposten; hangt aan eerste druk.
- Toegewezen: € en % naast elkaar, beide bewerkbaar, opgeslagen als €.
- Committed/Besteed: alleen €.
- CAC: marge ongewijzigd (per-ex, webshop); in planner alleen tonen +
  €-equivalent in totalen; geen fases.
- "Nog over" = budget − Σ toegewezen.

## Openstaand / expliciet buiten scope

- Formules-in-Excel (aparte PR, niet hier).
- Read-write MCP-tools (alleen `titel_detail` uitbreiden, read-only).
- Per-druk marketingbudget (v1 = alleen eerste druk).

---

## Addendum v2 (na preview-feedback, 2026-09-16)

Drie wijzigingen t.o.v. v1, in één herbouw:

### 1. Per druk i.p.v. titel-niveau + eerste-druk
`marketing_budget_pct` en `marketing_onderdelen` verhuizen van `TitelInput`
naar **`DrukConfig`** (elke druk eigen budget + eigen 7 basis-onderdelen),
opgeslagen in de bestaande `drukken`-JSON. De twee titel-kolommen
(`marketing_budget_pct`, `marketing_onderdelen`) vervallen weer — geen
nieuwe DB-kolommen nodig.
- Budget per druk = `pct × druk.oplage × Σ aandeel×basis` (prijs/korting/
  verdeling blijven titel-niveau).
- Marge: elke druk telt z'n eigen `Σ marge_kost` mee, uitgesmeerd over díe
  druk-oplage. Het "alleen eerste druk"-special-case in `bereken_titel`
  vervalt. CAC was al per druk.
- Migratie: per druk worden de oude offline/online-kostenposten van díe
  druk z'n `marketing_onderdelen`.

### 2. Marge-kost = encumbrance-model
`MarketingOnderdeel.marge_kost()` = **`max(toegewezen, committed + besteed)`**
(was `max(toegewezen, committed, besteed)`). Committed = vastgelegd maar
onbetaald; besteed = betaald; disjunct en optelbaar. Discipline: betaalde
bedragen verschuiven van committed naar besteed.

### 3. Compacte, inklapbare UI in de rail (per druk)
Onder de groep "Marketing" één inklapbare `Section` **per druk** (zoals
Productie). Elke sectie:
- Budget-tile van díe druk + %-veld.
- Altijd-zichtbare samenvattingsbalk: Σ toegewezen · Σ committed ·
  Σ besteed · nog over (= budget − Σ toegewezen).
- Compacte onderdeel-rijen: ingeklapt tonen ze `(committed+besteed) /
  toegewezen` rechts (rood bij overschrijding); uitgeklapt de gelabelde
  velden Toegewezen (€ + %), Committed (€), Besteed (€).
- "+ onderdeel" per groep; CAC-regel van díe druk informatief onder Online.
