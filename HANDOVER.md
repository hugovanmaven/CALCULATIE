# Handover — Maven Calculatie-app

> Korte oriëntatie voor een nieuwe Claude-sessie. Lees dit eerst.

## Wat is dit project

**Maven Publishing Calculatie-app** — webtool voor marge-berekening per
titel. Live op Railway: https://calculatie.maven-company.com

**Repo**: `github.com/hugovanmaven/CALCULATIE`
**Werk-dir**: `/Users/hugovandoornum/Desktop/CLAUDE/Calculatie`

## Stack

| Laag | Tech |
|---|---|
| Backend | Flask 3.1 + SQLAlchemy 2 + Postgres (Railway-managed) |
| Frontend | React 19 + TypeScript + Vite + Tailwind v4 |
| Hosting | Railway (auto-deploy van `main`) |
| Storage | Postgres + persistent volume (`/data`) voor JSON-backups |

## Belangrijkste folders

```
deploy/                     # Flask-app (Railway buildDir = deploy)
├── app/
│   ├── calculatie.py       # Engine: bereken_titel, KanaalResultaat etc.
│   ├── db.py               # SQLAlchemy models (Titel, Titelgroep)
│   ├── storage_calculatie.py  # CRUD + JSON-vangrails-backups
│   └── routes/api_calculatie.py  # Alle API-endpoints (~1500 regels)
└── requirements.txt

frontend/
├── src/
│   ├── api/{types,client}.ts
│   ├── components/{form,results,views}/
│   ├── hooks/useTitelDetail.ts
│   └── App.tsx

design/                     # Handover voor Claude Design (PR #6 nog open)
CONTEXT_HUGO_EN_MAVEN.md    # Achtergrond Hugo & Maven Publishing
CONTEXT_VOOR_KWARTAALMARGE.md  # Plannen voor nacalculatie-tool
```

## Werkwijze afspraken

| Type wijziging | Hoe |
|---|---|
| **Fundamenteel** (datamodel, engine, dependencies, schema) | Feature branch + PR + Hugo reviewt + merge |
| **UI-wijzigingen** | Eerst preview via `.claude/launch.json` flask-calculatie → screenshot delen → goedkeuring → PR |
| **Bugfix/kleine tweak** | Direct naar main mag |
| **Lokaal dev** | `python3 run.py` in `deploy/` (port 5001) |

Geen Excel/screenshots committen zonder reden. Geen `__pycache__/` in
git. Voor nieuwe Python-deps: in `deploy/requirements.txt`.

## Status nu (na de afgelopen sessie)

### Wat er werkt op productie

- Calculatie per titel incl. multi-druk, CAC per druk, kostenposten per
  categorie en deals voor alle partijen (auteur, agent, vertaler,
  illustrator, extra derden, partner)
- Marge per kanaal (retail/CB, webshop, B2B + gewogen) waarbij:
  - Royalty-deals **boven** brutowinst
  - Winstdeling-deals **onder** brutowinst
  - Partner = informatief, niet in titel-marge
- Oplage-simulatie met break-even + voorschot-earn-out tiles
- CAC-bandbreedte tile (laatste druk)
- Verkoopprijs-advies tile
- Titelgroepen (DRIVE/paperback/hardcover/ebook etc.)
- CSV-import (multi-druk groepering op ISBN) + Excel-template
- **Excel-export** — twee tabbladen (Calculatie + Resultaat) met
  Voorschot-ingelopen blok (recent gemerged in PR #9)

### Wat open staat

1. **PR #6 (design-handover)** — nog niet gemerged. Bevat
   `design/HANDOVER.md`, briefs voor UI-polish en nacalculatie-mockups.
   Mergen wanneer Hugo wil starten met Claude Design.
2. **Code-cleanup vervolgstappen** (na PR #8 dode code):
   - **B**: Engine-tests (pytest, ~10 scenario's). Doen voor we
     nacalculatie-tool bouwen — vangnet bij refactors
   - **C**: File-splits (`UnifiedDashboard.tsx` ~700 regels,
     `api_calculatie.py` ~1500 regels). Doen tegelijk met B
3. **Excel-export PR2 (formules)** — Hugo wil dat output-cellen
   formules worden die naar input-cellen verwijzen. Aparte PR, ~4-5
   uur. Niet urgent.
4. **Nacalculatie-tool** — grote feature. Plan staat in
   `CONTEXT_VOOR_KWARTAALMARGE.md`. Werkelijke marge per kwartaal,
   integreren met Sanders sales-MCP. Pas starten na engine-tests.
5. **Sales-MCP integratie** — Sanders bestaande tool kan in onze
   werksessies gebruikt worden. Niet bouwen, gewoon inzetten als Hugo
   data van Sander nodig heeft.
6. ~~**Calculatie-MCP**~~ — **gebouwd** (read-only). Zie sectie hieronder.
   Vervolg: OAuth (org-connector zonder token-geplak) + optioneel
   read-write-tools.

### Recent gemerged (afgelopen sessie)

- PR #7: Derden-en-voorschot logica + waterfall herordening
- PR #8: Dode code en historische bestanden opruimen (30 files weg)
- Hotfix: voorschot alleen meetellen bij actieve royalty-deal
- PR #9: Excel-export herzien (2 tabs + alle deals + voorschot-blok)

## Calculatie-MCP (read-only)

MCP-server zodat je in elke Claude-chat met de calculatie-app kunt praten.
Eén Flask-blueprint (`deploy/app/routes/mcp.py`), top-level op `/mcp`, dat de
bestaande API in-process aanroept. Geen extra dependencies, geen tweede service.

- **Connector-URL**: `https://calculatie.maven-company.com/mcp`
- **Auth**: bearer-token in Railway env-var `MCP_TOKEN` (lange random string).
  Zonder die var is het endpoint dicht (503, fail-closed).
- **Tools** (alleen lezen): `lijst_titels`, `titel_detail`, `bereken`
  (what-if), `simuleer_oplage`, `gevoeligheid_cac`, `gevoeligheid_prijs`.
- **Toevoegen in een client** (Claude Desktop/Code → custom connector):
  URL `https://calculatie.maven-company.com/mcp` + header
  `Authorization: Bearer <MCP_TOKEN>`. Eén keer per teamlid.
- **Lokaal testen**: `MCP_TOKEN=... python3 run.py`, dan POST JSON-RPC naar
  `localhost:5001/mcp`. Tests: `pytest tests/test_mcp.py`.
- **Vervolg**: OAuth (org-breed zonder token-geplak) + evt. read-write.

## Belangrijke logica om te onthouden

### Voorschot-recoupment

- **Royalty-mode**: voorschot wordt ingelopen via per-ex royalty (cumulatief)
- **Winstdeling-mode**: geen voorschot mogelijk (geen per-ex stroom)
- **Niet-terugvorderbaar**: als royalty < voorschot, Maven betaalt voorschot, geen claw-back
- Formule: `cost = max(voorschot, cumulatieve_royalty)`
- Voorschot wordt **alleen meegeteld als er ook een actieve royalty-deal is** (pct > 0 OF staffel niet leeg) — anders is het een achtergebleven veld zonder deal

### Marge-definitie

- Per kanaal: `netto_winst / netto_omzet` (na korting)
- Streefmarge: 35% van wat na kortingen binnenkomt (finance-man's berekening)
- Webshop/Retail/B2B kanaaltiles: marge t.o.v. verkoopprijs ex BTW als noemer (voor vergelijkbaarheid), streefmarge dynamisch per kanaal afgeleid van 35% × (netto_omzet / VKP)

### Brutowinst-orde

```
Netto omzet
− Drukkosten, kostenposten, fulfillment, CB-distributie, B2B porto, transactiekosten, CAC
− Auteur royalty (% van VKP ex BTW)
− Agent/Vertaler/Illustrator (royalty-mode)
− Extra derden (royalty-mode)
− Overige kosten
= Brutowinst
− Auteur winstdeling (% van brutowinst)
− Agent/Vertaler/Illustrator (winstdeling-mode)
− Extra derden (winstdeling-mode)
= Netto winst Maven
(− Partner winstdeling: informatief, niet in marge)
```

### Datamodel hoogtepunten

- `Titel.titelgroep_id` — optionele FK naar `Titelgroep` (DRIVE-merk over meerdere ISBN's)
- `DrukConfig.cac_per_ex` — sinds recent per druk i.p.v. per titel
- `ExtraDerde` — flexibele lijst met `type: royalty|winstdeling`

## Hugo's context

Zie `CONTEXT_HUGO_EN_MAVEN.md` voor uitgebreid. Kort:
- Product owner Maven Publishing, doet acquisitie samen met Sander
- NL/EN-mix, prefereert beknopte updates
- Denkt graag mee voor er gebouwd wordt
- Geen UI-commits zonder preview-screenshot

## Eerste stappen voor nieuwe sessie

1. Check `git status` en `git log --oneline -5` voor recente staat
2. Voor nieuwe features: check `CONTEXT_VOOR_KWARTAALMARGE.md` als
   relevant
3. Voor design-werk: zie `design/HANDOVER.md` (na merge PR #6)
4. Voor preview: `.claude/launch.json` → `flask-calculatie` op port 5001

---

*Laatste update: na merge van PR #9 (Excel-export-herziening).*
