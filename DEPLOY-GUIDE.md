# Maven Publishing - Deployment Guide voor maven-company.com

## Wat is dit?

`maven-company.com` is het interne app-platform van Maven Publishing. Na inloggen via Cloudflare Zero Trust (one-time PIN per e-mail) kom je op een **portal** met app-tegels. Momenteel staat daar alleen de **PR CRM**, maar het systeem is opgezet om meerdere interne apps te hosten.

**Architectuur:**
```
maven-company.com/          → Portal (app-tegels)
maven-company.com/crm/      → PR CRM applicatie
maven-company.com/jouw-app/  → Jouw nieuwe app (voorbeeld)
```

Alles draait in **één Flask-applicatie** op Railway. Cloudflare Zero Trust is de voordeur — als je daar doorheen bent, zijn alle apps toegankelijk zonder extra authenticatie.

---

## Benodigde toegang

Om te deployen heb je het volgende nodig:

| Wat | Details | Vraag aan |
|-----|---------|-----------|
| **GitHub repo** | `github.com/sandermaven/maven-pr-crm` (privé) | Sander — moet je als collaborator toevoegen |
| **Railway account** | Project "maven-pr-crm" op railway.app | Sander — moet je aan het project toevoegen |
| **Cloudflare account** | Zero Trust dashboard (voor Access policies) | Sander — alleen nodig als je login-regels wilt wijzigen |

**Je hebt NIET nodig:**
- Toegang tot de server zelf (Railway regelt alles)
- Database-credentials (SQLite, zit in het volume)
- Cloudflare DNS toegang (al geconfigureerd)

---

## Tech stack

- **Backend**: Python 3 + Flask 3.1.1
- **Frontend**: Vanilla JavaScript SPA + Tailwind CSS (CDN)
- **Database**: SQLite (op Railway volume `/data/`)
- **Server**: Gunicorn
- **Hosting**: Railway (auto-deploy vanuit GitHub)
- **Beveiliging**: Cloudflare Zero Trust Access
- **Domein**: maven-company.com (DNS via Cloudflare)

---

## Projectstructuur

```
maven-pr-crm/
├── app/
│   ├── __init__.py              # Flask app factory
│   ├── config.py                # Configuratie (DB pad, etc.)
│   ├── models.py                # Database queries
│   ├── routes/
│   │   ├── __init__.py          # Blueprint registratie
│   │   ├── pages.py             # Portal + SPA routes
│   │   ├── api_contacten.py     # CRM API: contacten
│   │   ├── api_boeken.py        # CRM API: boeken
│   │   ├── api_mailings.py      # CRM API: mailings
│   │   ├── api_mailing_types.py # CRM API: mailing types
│   │   └── api_dashboard.py     # CRM API: dashboard stats
│   ├── templates/
│   │   ├── portal.html          # Portal homepage met app-tegels
│   │   └── index.html           # CRM SPA shell
│   └── static/
│       ├── css/app.css
│       └── js/
│           ├── app.js           # SPA router
│           ├── components/      # Herbruikbare UI (toast, modal, datatable)
│           └── pages/           # Pagina-logica per sectie
├── Maven PR CRM.db              # SQLite database (bundled voor eerste deploy)
├── requirements.txt             # Python dependencies
├── Procfile                     # Gunicorn start command
├── railway.toml                 # Railway deploy config
└── CLAUDE.md                    # Project context voor Claude Code
```

---

## Hoe de portal werkt

De portal (`app/templates/portal.html`) is een eenvoudige pagina met een grid van app-tegels. Elke tegel is een `<a>`-tag die linkt naar het subpad van de app.

### URL-structuur

| URL | Wat het serveert |
|-----|------------------|
| `/` | Portal homepage (`portal.html`) |
| `/crm/` | CRM SPA shell (`index.html`) |
| `/crm/<alles>` | CRM SPA shell (catch-all voor hash-routing) |
| `/crm/api/*` | CRM REST API |
| `/static/*` | Statische bestanden (CSS, JS) |

### Routes in Flask (`app/routes/pages.py`)

```python
@bp.route("/")
def portal():
    return render_template("portal.html")

@bp.route("/crm/")
@bp.route("/crm/<path:path>")
def crm(path=None):
    return render_template("index.html")
```

### API blueprints (`app/routes/__init__.py`)

```python
app.register_blueprint(pages_bp)                              # Portal + SPA
app.register_blueprint(contacten_bp, url_prefix="/crm/api")   # CRM APIs
app.register_blueprint(boeken_bp, url_prefix="/crm/api")
# ... etc.
```

---

## Een nieuwe app toevoegen

### Stap 1: Tegel toevoegen aan de portal

Bewerk `app/templates/portal.html`. Voeg een nieuw `<a>`-blok toe in de `<!-- App Grid -->` div:

```html
<!-- Jouw Nieuwe App -->
<a href="/jouw-app/" class="group bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg hover:border-primary-300 transition-all duration-200">
    <div class="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-emerald-200 transition-colors">
        <svg class="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <!-- Kies een passend icoon van heroicons.com -->
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M..."/>
        </svg>
    </div>
    <h2 class="text-lg font-semibold text-gray-900 group-hover:text-primary-700 transition-colors">App Naam</h2>
    <p class="text-sm text-gray-500 mt-1">Korte beschrijving van de app</p>
</a>
```

Het grid past zich automatisch aan (1 kolom mobiel, 2 tablet, 3 desktop).

### Stap 2: Route toevoegen

Bewerk `app/routes/pages.py`:

```python
@bp.route("/jouw-app/")
@bp.route("/jouw-app/<path:path>")
def jouw_app(path=None):
    return render_template("jouw_app.html")
```

### Stap 3: Template maken

Maak `app/templates/jouw_app.html` — dit kan een volledig eigen SPA zijn of een eenvoudige pagina. Gebruik dezelfde Tailwind setup als de bestaande templates.

### Stap 4: (Optioneel) API endpoints toevoegen

Als je app een backend API nodig heeft:

1. Maak `app/routes/api_jouw_app.py` met een Flask Blueprint
2. Registreer in `app/routes/__init__.py`:
   ```python
   from .api_jouw_app import bp as jouw_app_bp
   app.register_blueprint(jouw_app_bp, url_prefix="/jouw-app/api")
   ```
3. API is dan bereikbaar op `/jouw-app/api/*`

### Stap 5: Deploy

```bash
git add .
git commit -m "Nieuwe app: Jouw App Naam"
git push origin main
```

Railway deployt automatisch binnen ~2 minuten.

---

## Lokaal ontwikkelen

### Eerste keer setup

```bash
git clone https://github.com/sandermaven/maven-pr-crm.git
cd maven-pr-crm
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### App starten

```bash
python3 run.py
```

Opent automatisch `http://localhost:5001` in je browser.

Of handmatig:

```bash
source .venv/bin/activate
flask run --port 5001 --debug
```

### Database

Lokaal gebruikt Flask de `Maven PR CRM.db` uit de project-root. Op Railway staat deze op het persistent volume `/data/Maven PR CRM.db`. Bij de eerste deploy wordt de database automatisch gekopieerd van de repo naar het volume.

**Let op:** wijzigingen aan de lokale database worden NIET mee-gedeployed. De productie-database op Railway is leidend.

---

## Deploy-proces

```
Code push → GitHub → Railway webhook → Nixpacks build → Gunicorn start
```

1. **Push naar `main` branch** op GitHub
2. **Railway** detecteert de push automatisch (webhook)
3. **Nixpacks** bouwt de Python-omgeving en installeert `requirements.txt`
4. **Gunicorn** start de Flask app op de dynamische Railway-poort
5. **Cloudflare** proxied `maven-company.com` naar Railway
6. De app is live binnen ~2 minuten

### Railway configuratie

**`railway.toml`:**
```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "gunicorn app:app --bind 0.0.0.0:$PORT"
healthcheckPath = "/"
healthcheckTimeout = 300
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

**Environment variables op Railway:**
- `RAILWAY_VOLUME_MOUNT_PATH=/data`

**Volume:** gemount op `/data` — hier staat de SQLite database.

---

## Cloudflare Zero Trust Access

Alle verzoeken aan `maven-company.com` gaan eerst door Cloudflare Access. Dit is de enige authenticatielaag — individuele apps hoeven GEEN eigen login te hebben.

**Configuratie:**
- **Team**: `maven-team`
- **Login methode**: One-time PIN (e-mail)
- **Sessieduur**: 24 uur
- **Toegestane e-mails**: `*@mavenpublishing.nl`, `sander@ruys.cc`

**Nieuwe gebruiker toevoegen:**
1. Ga naar Cloudflare Zero Trust dashboard → Access controls → Applications
2. Open "Maven PR CRM" → Policies
3. Voeg het e-mailadres toe aan de "Include" rules
4. De gebruiker ontvangt een one-time PIN bij het bezoeken van maven-company.com

---

## Belangrijke conventies

- **API prefix per app**: `/crm/api/`, `/jouw-app/api/`, etc.
- **Static files**: gedeeld op `/static/` (alle apps gebruiken dezelfde map)
- **Styling**: Tailwind CSS via CDN, Inter font, blauwe primary kleuren
- **Database**: SQLite, foreign keys aan, WAL journal mode
- **Frontend**: Vanilla JavaScript (geen React/Vue/etc.), hash-based SPA routing
- **Geen extra auth**: Cloudflare Access is de enige login-laag

---

## Troubleshooting

| Probleem | Oplossing |
|----------|-----------|
| App start niet op Railway | Check logs in Railway dashboard. Vaak een import error of missing dependency. |
| Database leeg na deploy | De DB wordt alleen gekopieerd als er GEEN bestaande DB op het volume staat. Verwijder `/data/Maven PR CRM.db` via Railway shell als je wilt resetten. |
| Static files laden niet | Controleer of paden beginnen met `/static/`. Probeer hard refresh (Cmd+Shift+R). |
| API geeft 404 | Check of de blueprint geregistreerd is in `app/routes/__init__.py` met de juiste `url_prefix`. |
| Cloudflare login werkt niet | Check of e-mailadres in de Access policy staat. OTP-mails komen van `noreply@notify.cloudflareaccess.org` — whitelist dit bij je mailprovider. |
| Wijzigingen niet zichtbaar | Railway deployt alleen bij push naar `main`. Check of je commit gepusht is. Cloudflare kan ook cachen — wacht even of purge de cache. |
