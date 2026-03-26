# Skill: Maven Publishing — Margeberekening per titel

## Wanneer gebruiken
Gebruik deze skill wanneer de gebruiker vraagt om:
- De marge, winst of rendement van een boektitel te berekenen
- Een calculatie of kostprijsberekening te maken voor een boek
- Te bepalen of een titel winstgevend is
- Kosten per exemplaar te berekenen per verkoopkanaal
- Een royalty-staffel of winstdeling door te rekenen

## Context
Maven Publishing verkoopt boeken via 3 kanalen: **Webshop** (direct), **Retail/CB** (boekhandel via Centraal Boekhuis) en **B2B** (zakelijke verkoop). Per kanaal verschilt de kostenstructuur. De marge wordt altijd **per exemplaar** berekend.

## Berekeningsstappen

### Stap 1: Omzet per exemplaar

```
Verkoopprijs ex BTW = verkoopprijs_incl_btw / (1 + btw_percentage)
```
- **BTW boeken**: standaard 9% (0.09)

Per kanaal:
| Kanaal | Korting | Netto omzet |
|--------|---------|-------------|
| Webshop | geen | = verkoopprijs ex BTW |
| Retail | boekhandelskorting (standaard 48%) | = verkoopprijs ex BTW × (1 - 0.48) |
| B2B | B2B-korting (variabel) | = verkoopprijs ex BTW × (1 - b2b_korting%) |

### Stap 2: Kosten per exemplaar

**a) Drukkosten** — per exemplaar, apart tarief voor 1e druk en herdruk

**b) Eenmalige kosten (productie + offline marketing)** — totaalbedrag / oplage, alleen bij 1e druk (€0 bij herdruk)
- Productie: vormgeving omslag, vormgeving binnenwerk, DTP, persklaarmaken, correctie, freelance redactie, e-book productie, audiobook productie, overige
- Offline marketing: evenement, marketingmateriaal, offline campagne, boekhandelsmateriaal, marketing fee, overige

**c) Terugkerende kosten (online marketing)** — totaalbedrag / oplage, bij elke druk
- Online ads, productfotografie, productie ads, software kosten

**d) Kanaal-specifieke kosten:**
| Kanaal | Kosten |
|--------|--------|
| Webshop | fulfillment per ex (standaard €4,50) + transactiekosten (verkoopprijs incl BTW × transactie%) + CAC per ex |
| Retail | distributie CB per ex (standaard €1,10) |
| B2B | porto per ex |

**e) Derden** (% van verkoopprijs ex BTW):
- **Vertaler**: vast % of staffel
- **Illustrator**: vast % of staffel
- **Agent**: vast % of staffel

**f) Overige kosten**: % van netto omzet

```
Totaal kosten = drukkosten + productie/ex + offline_mkt/ex + online_mkt/ex
              + kanaal-specifiek + vertaler + illustrator + agent + overige
```

### Stap 3: Brutowinst

```
Brutowinst = netto omzet - totaal kosten
```

### Stap 4: Auteur — twee modellen (kies één)

**Model A — Royalty-staffel** (% van verkoopprijs ex BTW):
```
Auteur afdracht = verkoopprijs_ex_btw × staffel_percentage
```
Staffel is cumulatief: het percentage hangt af van hoeveel exemplaren al verkocht zijn over alle drukken heen.

**Model B — Winstdeling** (% van brutowinst):
```
Auteur afdracht = brutowinst × winstdeling_percentage
```

### Stap 5: Partner (optioneel)

Als er een partner is (bijv. POM, UvNL): 50/50 deling van winst na auteur.
```
Partner afdracht = (brutowinst - auteur_afdracht) × 0.50
```

### Stap 6: Netto winst Maven

```
Netto winst Maven = brutowinst - auteur_afdracht - partner_afdracht
Marge % = netto winst Maven / netto omzet × 100%
```

## Royalty-staffels

Staffels zijn cumulatief over drukken. Bij een druk die een staffelgrens overschrijdt, wordt het gewogen gemiddelde berekend:

Voorbeeld: staffel wisselt bij 5.000 ex (6% → 7%). Druk start bij 4.000 cumulatief, oplage 3.000:
- 1.000 ex × 6% (tot 5.000)
- 2.000 ex × 7% (5.001–7.000)
- Gewogen gemiddelde = (1.000 × 0.06 + 2.000 × 0.07) / 3.000 = 6,67%

## Herdrukken

Bij een herdruk:
- Eenmalige kosten (productie + offline marketing) = €0
- Drukkosten gebruiken herdruk-tarief
- Online marketing wordt opnieuw over de herdruk-oplage verdeeld
- Staffelpercentages lopen door (cumulatief)

## Rekenvoorbeelden

### Voorbeeld 1: Co-intelligentie
| Parameter | Waarde |
|-----------|--------|
| Verkoopprijs incl BTW | €20,00 |
| Oplage 1e druk | 2.000 |
| Drukkosten 1e druk | €1,20/ex |
| Drukkosten herdruk | €2,00/ex |
| Fulfillment | €4,70/ex |
| Distributie CB | €1,10/ex |
| Transactiekosten | 1% |
| Agent | 11% |
| CAC | €5,00/ex |
| Auteur winstdeling | 50% |

**Resultaat 1e druk:**
- Webshop: netto winst Maven = €2,62/ex (marge 14,3%)
- Retail: netto winst Maven = €2,61/ex (marge 27,4%)

### Voorbeeld 2: Rechts verpest onze seks
| Parameter | Waarde |
|-----------|--------|
| Verkoopprijs incl BTW | €17,50 |
| Oplage 1e druk | 2.000 |
| Drukkosten | €1,20/ex |
| Fulfillment | €4,70/ex |
| Distributie CB | €1,10/ex |
| Transactiekosten | 3% |
| Eenmalige productie | €5.200 |
| Auteur winstdeling | 45% |

**Resultaat 1e druk:**
- Webshop: netto winst Maven = €3,87/ex (marge 24,1%)
- Herdruk webshop: €5,30/ex (eenmalige kosten vallen weg)

## Standaardwaarden
| Parameter | Default |
|-----------|---------|
| BTW | 9% |
| Boekhandelskorting | 48% |
| Fulfillment (B-Logic) | €4,50/ex |
| Distributie CB | €1,10/ex |
| Transactiekosten (Shopify) | 2% |
| Oplage 1e druk | 2.000 |

## Output formaat

Geef het resultaat als overzichtelijke tabel per druk, per kanaal:

```
                    Webshop      Retail       B2B
Netto omzet         €16,06       €8,35       ...
Totaal kosten       €13,44       €5,74       ...
Brutowinst          €2,62        €2,61       ...
Auteur              -€1,31       -€1,31      ...
Netto winst Maven   €1,31        €1,31       ...
Marge %             8,1%         15,6%       ...
```
