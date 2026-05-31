"""
Database setup en modellen voor de calculatie-app.

Hybride aanpak:
- Scalar velden (prijs, kortingen, voorschotten) als kolommen → queryable
- Geneste collecties (drukken, kostenposten, staffels) als JSON → flexibel

Op Postgres gebruikt SQLAlchemy automatisch JSONB voor de JSON-kolommen.
"""

from datetime import datetime

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Column, String, Text, Boolean, Numeric, DateTime, JSON

db = SQLAlchemy()


class Titel(db.Model):
    __tablename__ = "titels"

    # ── Identiteit ──
    id = Column(String(36), primary_key=True)
    titel = Column(Text, nullable=False, default="")
    auteur = Column(Text, default="")
    isbn = Column(String(20), index=True, default="")
    verschijningsdatum = Column(Text, default="")  # ISO-string (optional)
    verschenen = Column(Boolean, default=False)

    # Future: titelgroep-laag
    titelgroep_id = Column(String(36), nullable=True, index=True)

    # ── Basisprijzen ──
    verkoopprijs_incl_btw = Column(Numeric(10, 4), default=0)
    btw_percentage = Column(Numeric(8, 6), default=0.09)
    boekhandelskorting = Column(Numeric(8, 6), default=0.48)

    # ── Webshop ──
    transactiekosten_pct = Column(Numeric(8, 6), default=0.002)
    fulfillment_per_ex = Column(Numeric(10, 4), default=4.50)
    cac_per_ex = Column(Numeric(10, 4), default=0)

    # ── Retail/CB ──
    distributie_cb_per_ex = Column(Numeric(10, 4), default=1.10)

    # ── B2B ──
    b2b_porto_per_ex = Column(Numeric(10, 4), default=0)
    b2b_korting_pct = Column(Numeric(8, 6), default=0)

    # ── Auteur ──
    auteur_winstdeling_pct = Column(Numeric(8, 6), default=0)
    auteur_voorschot = Column(Numeric(12, 2), default=0)

    # ── Agent ──
    agent_pct = Column(Numeric(8, 6), default=0)
    agent_winstdeling_pct = Column(Numeric(8, 6), default=0)
    agent_voorschot = Column(Numeric(12, 2), default=0)

    # ── Vertaler ──
    vertaler_pct = Column(Numeric(8, 6), default=0)
    vertaler_winstdeling_pct = Column(Numeric(8, 6), default=0)
    vertaler_voorschot = Column(Numeric(12, 2), default=0)

    # ── Illustrator ──
    illustrator_pct = Column(Numeric(8, 6), default=0)
    illustrator_winstdeling_pct = Column(Numeric(8, 6), default=0)
    illustrator_voorschot = Column(Numeric(12, 2), default=0)

    # ── Partner ──
    heeft_partner = Column(Boolean, default=False)
    partner_naam = Column(Text, default="")
    partner_winstdeling_pct = Column(Numeric(8, 6), default=0.5)

    # ── Overig ──
    overige_kosten_pct = Column(Numeric(8, 6), default=0)

    # ── Verdeling (top-level, niet in titel_input) ──
    verdeling_webshop = Column(Numeric(8, 6), default=0.10)
    verdeling_retail = Column(Numeric(8, 6), default=0.85)
    verdeling_b2b = Column(Numeric(8, 6), default=0.05)

    # ── Status ──
    archived = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ── Geneste collecties (JSON / JSONB op Postgres) ──
    drukken = Column(JSON, default=list)
    auteur_royalty_staffel = Column(JSON, default=list)
    agent_staffel = Column(JSON, default=list)
    vertaler_staffel = Column(JSON, default=list)
    illustrator_staffel = Column(JSON, default=list)
    extra_derden = Column(JSON, default=list)
    overige_kosten_items = Column(JSON, default=list)
