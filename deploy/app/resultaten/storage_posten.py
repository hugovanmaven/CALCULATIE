"""
Leid de lijst calculatie-posten af waartegen de reconciliatie matcht.

De LLM kiest per Exact-regel één van deze labels (of "overig"). We nemen de
echte kostenpost-namen uit het recept (bv. "Vormgeving omslag", "Sticker") plus
een vaste set kern-stromen, zodat ook posten zonder eigen regel in het recept
(royalty, distributie, fulfillment, campagne) een doel hebben.
"""

# Kern-posten die altijd kunnen voorkomen, ook als ze niet als losse
# kostenpost in het recept staan.
KERN_POSTEN = [
    "Drukkosten",
    "Royalty auteur",
    "Royalty agent",
    "Royalty vertaler",
    "Campagne / promotie",
    "CB-distributie",
    "Fulfillment",
    "Transactiekosten",
]


def calculatie_posten_voor(rec: dict) -> list[str]:
    """Unieke, geordende lijst calculatie-post-labels voor een recept-dict."""
    ti = rec.get("titel_input", {})
    posten: list[str] = []
    for druk in ti.get("drukken", []) or []:
        for p in druk.get("kostenposten", []) or []:
            naam = (p.get("naam") or "").strip()
            if naam and naam not in posten:
                posten.append(naam)
    for k in KERN_POSTEN:
        if k not in posten:
            posten.append(k)
    return posten
