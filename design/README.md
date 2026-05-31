# `/design/` — handover-pakket voor Claude Design

Klaargemaakte context voor een **Claude Design**-sessie. Werkt zo:

1. Open een nieuwe chat op [claude.ai](https://claude.ai/) (of in een
   Project)
2. Upload deze drie bestanden:
   - `HANDOVER.md` (altijd)
   - **óf** `BRIEF-UI-POLISH.md` (voor het opfrissen van de bestaande UI)
   - **óf** `BRIEF-NACALCULATIE.md` (voor mockups van de nieuwe tool)
3. Upload de relevante screenshots uit `screenshots/`
4. Vraag Claude om mockups, iteratie tot je tevreden bent

## Wat zit in deze folder?

| Bestand | Wat het is |
|---|---|
| `HANDOVER.md` | App-oriëntatie + tech stack + design tokens + alle schermen |
| `BRIEF-UI-POLISH.md` | Prompt om huidige UI strakker te maken |
| `BRIEF-NACALCULATIE.md` | Prompt om de nacalculatie-tool te ontwerpen |
| `screenshots/` | Visuele referenties van huidige app |

## Voor de nacalculatie-brief

Voeg ook toe (als bijlage in dezelfde chat):

- `../CONTEXT_VOOR_KWARTAALMARGE.md` — uitgewerkte logica + datamodel
- `../CONTEXT_HUGO_EN_MAVEN.md` — gebruiker-context

Beide bestanden staan al in de repo root.

## Screenshots maken (één keer, ~2 min)

Voor de detail-pagina werkt headless screenshot-capture niet (de SPA
gebruikt React-state, geen URL-routing). Snel zelf doen:

1. Open https://calculatie.maven-company.com/calculatie/
2. Open een titel
3. **Cmd+Shift+4** → drag over wat je wil capturen
4. Sla op als `02-detail-formulier.png`, `03-detail-resultaten.png`,
   `04-kostenopbouw.png` in `screenshots/`

Of: doe `Cmd+Shift+5` voor video-capture als je flows wil laten zien.

## Daarna

Als Claude Design je mockups geeft die je goed vindt, kun je:
- Ze als JPG's terug naar deze folder committen onder
  `mockups/<datum>-<thema>.png`
- Of de gegenereerde Tailwind-code direct vragen om in de app te
  implementeren
