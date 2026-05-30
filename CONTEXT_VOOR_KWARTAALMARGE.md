# Context: Maven Publishing Calculatie-app

> Korte oriëntatie voor het Claude-project waarin we nadenken over een
> nieuwe kwartaal-marge-analyse-feature.

## Wat is er nu

**Calculatie-app** — webtool voor margeberekening per titel.
Live op Railway: https://calculatie.maven-company.com

**Tech**: Flask backend (Python 3.13) + React/TypeScript/Vite frontend.
Repo: github.com/hugovanmaven/CALCULATIE

## Wat de app vandaag doet

Per titel een **calculatie vooraf** maken: gegeven verkoopprijs, oplage,
drukkosten, kostenposten, kanaalverdeling en deals → wat is de
verwachte marge?

Kernconcepten in de calculatie:

- **Drukken**: een titel kan meerdere drukken hebben, elk met eigen
  oplage, drukkosten per ex en eenmalige kostenposten
  (vormgeving, marketing, etc.).
- **Drie kanalen** met eigen kostenstructuur:
  - **Retail/CB** (boekhandelskorting, CB-distributie)
  - **Webshop** (CAC, fulfillment, transactiekosten)
  - **B2B** (B2B-korting, porto)
  - Gewogen marge over kanalen via een verdelingspercentage (bv 85/10/5).
- **Auteursdeal**: óf royalty-staffel (% van prijs ex BTW per
  staffelschijf), óf winstdeling (% van brutowinst).
- **Derden met voorschot + commissie**: agent, vertaler, illustrator.
  Voorschot wordt ingelopen via per-ex commissie.
- **CAC-bandbreedte** en **prijssensitiviteit** als what-if panels.
- **Oplage-simulatie** met break-even en voorschot-terugverdiend.
- **Excel-export** van de complete calculatie.

## Welk gat de nieuwe feature wil dichten

De huidige calculatie is **ex-ante** (vooraf, op aannames). Er is geen
koppeling met **werkelijke verkoopcijfers**. Ik wil 1× per kwartaal per
titel kunnen zien:

- Hoe ver zitten we van de calculatie af?
- Welke marge realiseren we echt, kanaal voor kanaal?
- Is een voorschot al ingelopen of staat dat nog open?
- Per titel: koers op groen / oranje / rood?

## Open vragen om over te denken

1. **Aparte tool of integreren in calculatie-app?**
   - Aparte tool = cleaner mentaal model, eigen UX
   - Integreren = data en deals zitten al in calculatie
2. **Databronnen**: CB (retail), Shopify (webshop), eigen administratie
   (B2B). Hoe komen die binnen — handmatige import per kwartaal, API's,
   CSV-upload?
3. **Datamodel**: per titel × kwartaal × kanaal een rij verkochte
   exemplaren + omzet? Of granulair op transactieniveau?
4. **Voorschot-tracking**: hoeveel royalty heeft de auteur tot nu toe
   "verdiend"; staat het voorschot nog open?
5. **Output**: dashboard met overzicht alle titels? Per-titel deep dive?
   Geëxporteerd kwartaalrapport voor jouw eigen administratie?
6. **Relatie met calculatie**: één bron (calculatie als baseline +
   werkelijkheid ernaast) of twee losse views?

## Tech-architectuur die je kunt hergebruiken

- Backend route-patroon: `deploy/app/routes/api_calculatie.py`
- Frontend component-structuur: `frontend/src/components/`
- Data-opslag: JSON-blob in `deploy/data/calculatie_titels.json`
  (ja, geen DB — werkt prima op deze schaal, maar bij verkoopdata wordt
  het misschien tijd voor SQLite of Postgres)
- Excel-export pattern: openpyxl in een Flask endpoint
- CSV-import pattern: groeperen op ISBN, kolomaliassen, OrderedDict

## Praktisch

- **Stijl**: minimal Tailwind, CSS-variabelen voor theming
  (`var(--accent)`, `var(--border)`, etc.), geen hardcoded gray-* /
  blue-* klassen.
- **Werkstijl Hugo**: prefereert beknopte updates, NL/EN mix,
  geen UI-commits zonder preview.
- **Deploy**: Railway auto-deploy vanaf `main`.

---

*Tip voor het denk-traject: misschien begin met één titel handmatig
doorlopen — als je voor 1 titel kwartaal Q1-2026 alle data hebt, hoe zou
het dashboard eruit moeten zien? Dan vanuit die schets terugredeneren naar
datamodel en imports.*
