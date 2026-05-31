# Brief — UI Polish van bestaande calculatie-app

> Plak deze brief (of relevant deel) in een Claude Design-chat samen met
> `HANDOVER.md` en je eigen screenshots van de huidige app. Laat Claude
> drie tot vijf mockup-iteraties maken.

---

## Context

Lees eerst `HANDOVER.md` — daarin staan tech stack, design tokens, en
beschrijving van alle schermen.

## Wat ik wil

Een **stillere, strakkere, overzichtelijkere** versie van de bestaande
schermen, zonder ingrijpend de informatie-architectuur te veranderen.
Dezelfde features, dezelfde flows — maar visueel kalmer en sneller te
lezen.

## Focusvragen per scherm

### Titellijst (homepage)

- Voelt de tabel nu wat **leeg en koud** in z'n huidige white-table-met-
  border-form. Kan dit warmer/uitnodigender zonder druk te worden?
- De **margebadge** (32.2% in oranje pill) is functioneel, maar zou
  visueler kunnen — bijvoorbeeld een mini-staafje of gradient om in één
  oogopslag te zien wie groen/oranje/rood is over een lange lijst.
- Bij groei (40-50 titels) wil ik **groepering per titelgroep**
  optioneel kunnen tonen. Hoe zou een collapsed group-row eruit zien?

### Detail-view formulier (linker kolom)

- De **collapsible Sections** stapelen nu lekker, maar bij 8-10 Sections
  open wordt het lang scrollen. Kan er een **side-nav** of een sticky
  Section-overview helpen om snel te jumpen?
- De **Drukken-editor** (in Basisgegevens) is nu een rijtje rows met
  oplage + druknummer. Kan dit als een visueler "stack" voelen?
- **Auto-save indicator** ("Opgeslagen") staat nu klein bovenaan. Kan
  dit subtieler maar duidelijker — bv. een fade?

### Detail-view resultaten (rechter kolom)

- **Hoofdmetric (gewogen marge)** is nu een progress-bar 0-70%. Werkt,
  maar voelt wat ouderwets. Vergelijk met moderne dashboard-headlines —
  hoe scoort die in dit scherm?
- De **3 kanaal-tiles** tonen netto winst, %, /streef, netto omzet,
  brutowinst. Veel informatie in een kleine kaart. Wat is de hiërarchie?
  Wat zou ik wegstrepen voor rust?
- De **5 oplage-simulatie tiles** zijn nu rijtjes mini-cards met
  gekleurde stripes. Werkt scan-baar, maar de stripes zijn klein. Kan
  het 'breaker-even-moment' visueel sterker?
- De **CAC-bandbreedte** is een sensitivity-strook. Zou een mini-grafiek
  daar nog meer betekenis aan geven?
- De **Kostenopbouw waterfall** is nu een collapsible. De rijen-met-
  euro-bedragen werken, maar de visuele uitdrukking van "deze post is
  X% van de omzet" kan sterker. Echte waterfall-grafiek? Of bars?

## Wat je NIET hoeft te veranderen

- De **structuur** (linker formulier, rechter dashboard) is gegeven.
  Hugo werkt al twee maanden zo en dat is ingebakken.
- De **Section-collapsible-pattern** blijft — alleen kalmer of slimmer
  georganiseerd, niet vervangen door tabs of een wizard.
- De **CSS-variabelen / accent-kleur** zijn vast. Geen nieuw kleurschema.

## Output-vorm

Per scherm één mockup, met korte uitleg per design-keuze. Tailwind-
classes zijn welkom; geen UI-library imports (Shadcn etc.) want we
hebben die niet. Idealiter krijg ik 2-3 varianten per scherm zodat ik
kan kiezen.

## Stijl-baken

Denk: **Linear, Notion, Stripe Dashboard, Vercel** — strak, veel
witruimte, getal-eerst, status-kleur subtiel. Niet: dense enterprise-
BI-tool, niet: speels consumer-app.
