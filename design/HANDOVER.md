# Design Handover — Maven Calculatie-app

Bedoeld als startpakket voor een Claude Design-sessie. Eén pagina app
oriëntatie + design tokens + lijst van schermen.

> **Live**: https://calculatie.maven-company.com/calculatie/
> **Repo**: github.com/hugovanmaven/CALCULATIE

---

## De app in 5 zinnen

Maven Publishing is een Nederlandse non-fictie-uitgeverij. De calculatie-
app berekent **vooraf** (begroting, ex ante) de marge per titel: gegeven
verkoopprijs, oplagen, drukkosten, kostenposten, dealtermen met de
auteur en agents, plus een verdeling over drie verkoopkanalen
(retail/CB, eigen Shopify-webshop, B2B). De uitkomst is een dashboard
met gewogen marge, kanaalmarges, CAC-bandbreedte, oplage-simulatie met
break-even en voorschot-recoupment. Eén gebruiker (Hugo) primair, plus
collega Sander; schaal: 25-50 titels, 1-3 drukken per titel.

Nieuwe richting: er komt een **nacalculatie-tool** bij die de werkelijke
marge per kwartaal berekent op basis van sales-data — zie
`BRIEF-NACALCULATIE.md`.

---

## Tech stack

| Laag | Tech |
|---|---|
| Backend | Flask 3.1 + SQLAlchemy 2 + PostgreSQL |
| Frontend | React 19 + TypeScript + Vite |
| Styling | **Tailwind CSS v4** + CSS custom properties (geen UI-lib) |
| Icons | **lucide-react** |
| Hosting | Railway (auto-deploy van `main`) |

Belangrijk voor designers: er is **geen Shadcn / MUI / Chakra**. Alles
is hand-gebouwd in Tailwind. Mockups die UI-libs gebruiken zijn moeilijk
1-op-1 over te zetten — Tailwind-only of pure HTML/CSS werkt beter.

---

## Design tokens (CSS variables)

Gebruik in mockups deze tokens — ze matchen de live app exact.

```css
:root {
  /* Achtergronden */
  --bg-primary: #ffffff;      /* hoofdkanvas */
  --bg-secondary: #fafaf9;    /* cards, sidebars */
  --bg-hover: #f5f5f4;        /* hover state */

  /* Tekst */
  --text-primary: #1c1917;    /* headlines, body */
  --text-secondary: #57534e;  /* labels, secondary */
  --text-tertiary: #a8a29e;   /* helper text, hints */

  /* Borders */
  --border: #e7e5e4;          /* subtiele scheidingslijnen */

  /* Accent (Maven oranje-bruin) */
  --accent: #c2410c;          /* knoppen, links, focus */
  --accent-hover: #9a3412;
  --accent-light: #fff7ed;    /* accent-tinted backgrounds */
}
```

Plus standaard Tailwind palet voor states:
- **emerald-500/600** voor groen (≥35% marge → 'gezond')
- **amber-500/600** voor oranje (20-35% → 'oppassen')
- **red-400/600** voor rood (<20% → 'probleem')
- **violet-500** voor titelgroep-badges

## Typografie

- **Font**: system-ui stack (geen custom font geladen)
- **Hiërarchie**: `text-xs` (11px) / `text-sm` (14px) / `text-lg` (18px)
  / `text-2xl` (24px) / `text-3xl` (30px)
- **Tabular nums** overal waar cijfers staan (`tabular-nums` class)

## Spacing & layout

- Cards/panels: `rounded-xl` (12px) + `border border-[var(--border)]`
- Padding cards: `p-4`
- Gap tussen elementen: `gap-3` of `space-y-3`
- Sections (collapsibles): `<details>` met chevron, see `Section.tsx`

---

## Schermen van de huidige app

### 1. Titellijst — de homepage

Tabel met alle titels: titel + auteur + aantal drukken + gewogen marge
(als gekleurde badge). Boven: zoekbalk, archief-toggle, Import CSV,
Nieuwe titel. Multi-select via checkboxes voor bulk archive/delete.
Klik op een rij opent de detail-view.

> Screenshot: `screenshots/01-titellijst.png`

### 2. Detail — formulier (linker kolom op desktop, ~440px breed)

Verticale stack van collapsible Sections, gegroepeerd onder labels:

- **Basisgegevens**: titel, auteur, ISBN, datum, prijs incl BTW,
  boekhandelskorting, drukken-editor (per druk: druknummer + oplage),
  Titelgroep-picker
- **Productie** (group label): één Section per druk met titel
  "1e druk" + subtitle "X.XXX ex". Binnen: productie-kostenposten
  (vormgeving, redactie, vertaling, etc.) + drukkosten/ex
- **Marketing** (group label): per druk "Campagne Ne druk" met:
  CAC per webshop-aankoop bovenaan + offline/online marketing-budget
- **Verkoopkanalen**: verdeling (slider/sliders) + per kanaal de
  kostenstructuur (Webshop: fulfillment + transactiekosten / Retail:
  CB-distributie / B2B: korting + porto)
- **Deals & partners**: auteurdeal (winstdeling óf royalty-staffel) +
  derden (agent, vertaler, illustrator met voorschot) + partnership
  (POM/UvNL informatief)
- **Overig**: overige kostenposten

Auto-save op 1.5s debounce, auto-calc op 400ms debounce.

> Screenshot: `screenshots/02-detail-formulier.png` *(maak zelf)*

### 3. Detail — resultaten (rechter kolom, vult de rest)

Live dashboard, ververst bij elke wijziging links:

- **Headline**: gewogen marge in grote progress-bar (0-70%, target 35%) +
  totaal-exemplaren-tile
- **3 kanaal-tiles**: webshop / retail / b2b, met absolute winst per ex,
  marge%, "/ streef X%", netto omzet, brutowinst
- **Oplage-simulatie**: 5 tiles met break-even, voorschot-terugverdiend,
  huidige oplage, +5k, +10k — elk met netto resultaat en marge
- **CAC-bandbreedte**: 6 tiles met variërende CAC-waardes, gekleurde
  stripes voor scan-baarheid
- **Verkoopprijs-advies**: 10 tiles met variërende verkoopprijzen
- **Kostenopbouw** (collapsible): waterfall van verkoopprijs → netto
  winst Maven, met 4 tabs: Gemiddelde / Retail / Webshop / B2B

> Screenshot: `screenshots/03-detail-resultaten.png` *(maak zelf)*

### 4. Excel-export

PDF-achtig sjabloon met basisgegevens, drukken, marge per kanaal,
oplage-simulatietabel met voorschot-recoupment, deals. Niet de focus
voor designwerk.

---

## Componenten / patterns die we al hebben

- **Section** (`components/layout/Section.tsx`) — collapsible card met
  chevron + title + subtitle
- **NumberInput** met prefix/suffix (€, %), label boven, helper-tekst
  onder
- **Segmented control** voor toggles (Winstdeling / Royalty-staffel)
- **StaffelEditor** voor royalty-staffels (van/tm/percentage rows)
- **Verdelingsbalk** (3-segment progress) voor kanaalverdeling
- **Margebadge** (gekleurd pill: emerald/amber/red)

---

## Wat we waarderen in design

- **Compact maar leesbaar** — Hugo werkt veel met deze tool, scrollen
  is duur
- **Informatie-dichtheid** — getallen primair, decoratie minimaal
- **Eén taal** — kies óf marge % óf €/ex als hoofdmetric, geen mix
- **Kleur als signaal** — emerald/amber/red exclusief voor status,
  niet decoratief
- **Mobile-aware** — niet primair maar wel respectabel
- **Geen modal overkill** — inline editing en collapsibles boven popups

## Specifieke gebruikers-context

Hugo en Sander hebben:
- **Veel domeinkennis** (publishing), dus jargon mag (royalty-staffel,
  CB-distributie, kanaalverdeling)
- **Korte iteratie-cycli** — bouwen 1 feature, gebruiken een week,
  passen aan. Designs hoeven niet 100% af; werkbare richting belangrijker
- **Eén tool voor zowel begroting als straks realisatie** — daarom
  consistente patterns over de twee features heen
