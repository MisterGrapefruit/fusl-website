# Instellingen in Netlify

Deze waarden zet je in Netlify bij **Site configuration → Environment variables**. Zet ze nooit in de code of in een chatbericht.

| Variabele | Nodig voor | Wat vul je in |
|---|---|---|
| `ANTHROPIC_API_KEY` | Slim zoeken en moodboard | De API-sleutel uit console.anthropic.com. Zonder sleutel valt het zoeken terug op de eigen woordenlijst en staat het moodboard op "Binnenkort". |
| `AI_MAANDBUDGET_USD` | Kostenplafond | Bijvoorbeeld `25`. Boven dit bedrag per maand zet de site de AI-functies uit tot de volgende maand. Standaard is het 25. |
| `MOODBOARDS_PER_DAG` | Limiet per bezoeker | Standaard `5`. |
| `RAPPORT_SLEUTEL` | Klikrapport voor winkels | Een lang, willekeurig wachtwoord. |
| `KLIK_GEHEIM` | Kliks tellen zonder IP-adres | Een lange, willekeurige tekst. |

Optioneel:
- `AI_MODEL`: standaard `claude-haiku-5-5`.
- `AI_PRIJS_INPUT` en `AI_PRIJS_OUTPUT`: de prijs in dollar per miljoen tokens. Die wordt gebruikt om het budget bij te houden.

Zet daarnaast in de Anthropic Console zelf ook een maandlimiet. Dan heb je dubbele zekerheid.

## Kliksdashboard
`https://fuslfurniture.nl/kliks.html`

Een eigen overzicht (geen Google) van hoeveel bezoekers per winkel en per stuk
worden doorverwezen — als basis voor de maandfactuur per klik. Bij het eerste
bezoek vraagt de pagina om je rapportsleutel (dezelfde als `RAPPORT_SLEUTEL`
hieronder); die blijft daarna alleen in die browser bewaard. Niet gelinkt
vanuit het hoofdmenu en met `noindex`, dus alleen te vinden als je de link
hebt. Met de maandpijltjes blader je terug, met "CSV downloaden" krijg je
hetzelfde bestand als via de link hieronder.

## Klikrapport (ruwe data)
`https://fuslfurniture.nl/api/klik-rapport?maand=2026-11&sleutel=JOUW_RAPPORT_SLEUTEL`

Voeg `&formaat=csv` toe voor een Excel-bestand. Vooral handig voor een
boekhoudkoppeling of losse export; voor zelf rondkijken is het kliksdashboard
hierboven prettiger.

## Wat het dashboard laat zien
- **Doorverwijzingen naar winkels** en de **omzet** volgens de tarieven per winkel. Tarieven stel je in het dashboard zelf in (standaardtarief, eigen tarief, maximum per maand, gratis periode); ze staan in Netlify Blobs en niet in de openbare bestanden.
- **Waar kliks vandaan komen:** zoekpagina, zoeken met jouw stijl, Mijn selectie of gedeelde selectie.
- **Bezoekers** van de eigen teller (`js/teller.js` → `/api/bezoek`): geen cookies, geen IP-adressen; één bezoeker = één persoon per dag. Met herkomst (zoekmachine, social, direct, andere website, campagne via `utm_source`) en de meest bekeken pagina's.
- **Per dag of per week** voor de gekozen maand.

## Wat wordt waar bewaard
- **Alleen in de browser van de bezoeker:** stijlprofiel, Mijn selectie en postcode. De postcode wordt één keer opgezocht bij de PDOK Locatieserver van de overheid.
- **Netlify Blobs:**
  - kliktellingen en bezoekerstellingen (zonder IP-adres; met een hash die elke dag verandert);
  - de tarieven per winkel;
  - gedeelde selecties en reacties (alleen voornamen), tot de link wordt uitgezet;
  - AI-dagtellers en het maandbudget.
- **Moodboard-afbeeldingen:** worden verkleind en alleen voor de analyse naar Anthropic gestuurd. FUSL bewaart ze niet.
