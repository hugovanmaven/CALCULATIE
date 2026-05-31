# Brief — Nacalculatie-tool (preview / mockup)

> Plak deze brief in Claude Design samen met `HANDOVER.md` (voor design
> tokens) en `../CONTEXT_VOOR_KWARTAALMARGE.md` (voor logica). Doel:
> visuele preview van een tool die nog niet bestaat.

---

## Context in één paragraaf

Maven Publishing heeft een werkende **calculatie-app** (begroting,
ex ante per titel). We bouwen daar een **nacalculatie-tool** naast — de
tegenhanger die per kwartaal de **werkelijke** marge berekent op basis
van verkoopdata. Beide leven in dezelfde app, delen het datamodel
(titelgroep → editie/ISBN → druk → deal). Sales-data komt uit een
aparte database (Sanders tool) waar Maven op ISBN-niveau verkopen per
maand/kanaal in opslaat.

## Wat ik wil

Een **dashboard-mockup** die laat zien hoe een nacalculatie-view voelt
voor één titel én voor een overzicht van alle titels. Niet alleen
"tabellen vol getallen", maar een visuele beleving die antwoord geeft
op de vraag: *verdienen we de kosten van de lopende druk terug?*

## Twee hoofdschermen

### Scherm A — Portfolio-overzicht ("stoplicht" per titel)

Lijst/grid van alle actieve titels met per titel:

- **Titel + auteur + ISBN** (of titelgroep als gebundeld)
- **Stoplicht** (groen / oranje / rood) — geeft *niet* "was Q4 winst-
  gevend?" weer, maar: "**dekt de omzet van de lopende druk (bij
  uitverkoop) alle kosten van die druk?**". Groen = ja met marge,
  oranje = krap aan, rood = nee
- **Lopende druk + voortgang** — bv. "2e druk, 3.247 van 5.000 verkocht
  (65%)"
- **Marge Q[n]** — werkelijke marge van het lopende kwartaal
- **Voorschot-status** — voor titels met voorschot: "€20.000 uitstaand,
  €12.300 ingelopen tot nu (61%)"

Filter/sort op stoplicht-status, auteur, partner, etc.

Backlist-titels (druk allang uitverkocht) staan automatisch groen en
zakken naar onder.

### Scherm B — Titel-detail (één titel, één kwartaal)

- **Header** met titel, auteur, ISBN, lopende druk + voortgangsbalk
- **Begroting vs realisatie** waterfall: per regel (drukkosten,
  productie, kanaal-kosten, marketing, royalties) **begroot** (uit
  calculatie-app) en **werkelijk** (uit sales-data + Exact), met delta.
  Visueel: links de begroting-staaf, rechts de werkelijkheid, kleurcode
  op afwijking
- **Verkopen per kanaal** (retail/CB, webshop, B2B) over het kwartaal,
  bv. mini bar-chart of donut
- **Voorschot-tracker** (alleen als van toepassing): een tijdlijn die
  toont wanneer welke royalties zijn verdiend en wanneer het voorschot
  is/wordt ingelopen
- **Cumulatief life-to-date** vs **dit kwartaal** — toggleable
- Link naar de calculatie van diezelfde titel (cross-reference)

## Margemodel (relevant voor wat je toont)

Per druk:

```
Omzet (per kanaal)
 − Channel costs       (CB ~€1.10/ex · Shopify ~€4.50/ex + 0.2% · B2B ~€1.10/ex)
 − COGS                (drukkosten/ex × verkocht  +  productie van de
                        lopende druk, uitgesmeerd over die druk)
 − Period costs        (marketing dit kwartaal — uit Exact)
 − Deals               (auteur / agent / vertaler)
 = Nettoresultaat kwartaal
```

Principes die voor de UI relevant zijn:
- **COGS reist mee met verkochte exemplaar**, niet met de oplage
- **Periode-kosten** (marketing) horen bij het kwartaal waarin ze zijn
  gemaakt, niet bij de levensduur van de titel
- **Voorschot loopt in** via royalty's; zolang het niet ingelopen is
  betaalt Maven niets extra aan de auteur boven het voorschot
- **E-book / audio** hebben géén drukkosten (zit op het papieren boek)

## Specifiek waar ik graag richting in wil

1. **Hoe los je het stoplicht visueel op?** Een pill is voor de hand
   liggend, maar misschien is er iets sterkers — bijvoorbeeld een
   ring rond de titel-naam, of een gradient-achtige status.
2. **Hoe maak je begroting vs realisatie scan-baar?** Een waterfall
   met links/rechts? Twee staven met verbindingslijnen? Een tabel met
   delta-kolom?
3. **Hoe toon je 'voorschot ingelopen' visueel?** Een progress-bar
   tussen €0 en het voorschot-bedrag? Een mini-grafiek per kwartaal?
4. **Hoe combineer je 'huidig kwartaal' en 'cumulatief life-to-date'?**
   Toggle, tabs, of beide naast elkaar?
5. **Welk niveau geef je default voorrang?** Titel-detail of portfolio-
   overzicht? Waar landt Hugo bij maandelijkse review-sessies?

## Gebruikscontext

Hugo opent dit dashboard **één keer per kwartaal** (review-sessie van ~1
uur, samen met Sander). Verder af-en-toe ad-hoc om snel te checken hoe
een specifieke titel het doet. Doel: snel zien wat aandacht nodig heeft
+ kunnen rapporteren naar partners en het team.

## Niet doen

- Geen "live realtime" feel (data ververst maandelijks/kwartaal-basis,
  niet per minuut)
- Geen drill-down naar transactie-niveau — granulariteit stopt bij
  kwartaal × titel × kanaal
- Geen forecast/voorspelling — dat doet de calculatie-app al

## Stijl-baken

Consistent met de bestaande calculatie-app (zie `HANDOVER.md`). Dezelfde
design tokens, dezelfde rust. Denk **Linear's analytics-views, Stripe
dashboard, Vercel analytics** — strak, status-driven, getal-eerst.

## Output-vorm

Twee mockups (Scherm A en Scherm B), elk in 1-2 varianten. Korte uitleg
per design-keuze. Tailwind-only, geen UI-library.
