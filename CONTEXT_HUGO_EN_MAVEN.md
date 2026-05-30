# Context: Hugo & Maven Publishing

> Achtergrond over de persoon en het bedrijf voor wie deze tool gebouwd wordt.
> Bedoeld als oriëntatie voor een Claude-project dat denkt over volgende features.

## Hugo van Doornum

- Product owner / oprichter binnen **Maven Publishing**
- Werkt in **NL/EN mix** — beide is goed, switch is geen issue
- Houdt van **beknopte updates**, geen bulk-tekst; uitleg mag, maar to-the-point
- Denkt graag **mee over ontwerp** voor er gebouwd wordt — eerst ideeën
  uitwerken, dan implementeren
- Geeft **duidelijke, directe feedback** ("dit klopt niet", "graag anders",
  zonder veel omwegen)
- Werkt met een collega, **Sander** — samen doen ze o.a. acquisitie van
  nieuwe titels (intake, beoordeling, deals)
- Git: `hugovanmaven`

## Werkstijl

- **Nooit UI-wijzigingen committen zonder preview** — eerst lokaal builden,
  screenshot delen, goedkeuring afwachten
- **Backend / data-fixes** mogen direct gepusht worden naar productie
  (Railway redeployt vanzelf vanaf `main`)
- Vertrouwt op snelle iteraties: bouwen → checken → bijschaven

## Maven Publishing

Nederlandse **non-fictie uitgeverij**. Focus: ideeën-boeken,
maatschappij, technologie, persoonlijke ontwikkeling.

### Verkoopkanalen

Maven verkoopt via drie kanalen — elk met eigen kostenstructuur:

| Kanaal | Wat | Typische cijfers |
|---|---|---|
| **Retail / CB** | Boekhandel via Centraal Boekhuis | boekhandelskorting 40–48%, CB-distributie ~€1,10/ex |
| **Webshop** | Eigen Shopify-shop | transactiekosten ~2%, fulfillment B-Logic ~€4,50/ex, CAC stuurvariabele |
| **B2B** | Bedrijven, bulk, partnerships | eigen kortingen, soms porto |

Gewogen verdeling typisch: **retail ~85% / webshop ~10% / B2B ~5%**
(varieert per titel).

### Deals & derden

- **Auteursdeal**: óf royalty-staffel (% van prijs ex BTW per oplage-schijf),
  óf winstdeling (% van brutowinst, vaak 50/50)
- **Voorschotten**: Maven betaalt soms vooraf (auteur, agent, vertaler,
  illustrator) — wordt ingelopen via per-ex royalty/commissie
- **Partnerships**: bv. POM, UvNL — soms 50/50 nettowinstdeling

### Streefmarge

**35% brutowinst / netto omzet** (vóór auteur-winstdeling). Eerste druk
mag verlies dragen (eenmalige kosten zwaar), herdrukken trekken de
totaalmarge omhoog.

### Titels (voorbeelden uit de huidige database)

Internationaal vertaald + eigen Maven-titels. Een greep:

- *Co-intelligentie* (Ethan Mollick)
- *Piratenverlichting* (David Graeber)
- *Als iemand dit bouwt, gaat iedereen dood* (Yudkowsky/Soares?)
- *Smartphonevrij Opgroeien*
- *DRIVE*, *FLOW*, *MINDFCK Challenges*
- *Generatie Zelfvertrouwen*, *Intentioneel leven*
- *Eat that frog* (vertaling)

Schaal: 20–30 actieve titels, niet honderden. Per titel meestal 1–3 drukken.

### Operationeel

- **Boekhouding / verkoopdata** ligt grotendeels bij CB (retail),
  Shopify (webshop) en Maven's eigen administratie (B2B)
- **Acquisitietraject**: Hugo en Sander beheren samen in Notion een
  acquisitie-database ("Acquisitie Meeting") waar nieuwe titels/auteurs
  worden ingevoerd vóórdat ze in de calculatie-app komen
- **Kantoor**: NL

## Wat dit betekent voor nieuwe features

- **Kleinschalig + ambachtelijk**: features hoeven niet enterprise-grade
  te zijn; één gebruiker (Hugo) of een handvol mensen is realistisch
- **Echte beslis-vraag**: Hugo bouwt geen dashboard om het dashboard.
  Elke feature moet een terugkerende vraag beantwoorden die nu in zijn
  hoofd of in Excel zit
- **Data-import liever simpel**: CSV/Excel-upload werkt prima; geen
  permanente API-integraties tenzij echt nodig
- **Voorschot- en royalty-tracking** zit dicht bij wat Maven dagelijks
  bezighoudt (auteurscommunicatie, kwartaalafrekening) — dáár ligt
  realistische waarde
