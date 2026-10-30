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

## Klikrapport
`https://fuslfurniture.nl/api/klik-rapport?maand=2026-11&sleutel=JOUW_RAPPORT_SLEUTEL`

Voeg `&formaat=csv` toe voor een Excel-bestand.

## Wat wordt waar bewaard
- **Alleen in de browser van de bezoeker:** stijlprofiel, Mijn selectie en postcode. De postcode wordt één keer opgezocht bij de PDOK Locatieserver van de overheid.
- **Netlify Blobs:**
  - kliktellingen (zonder IP-adres; met een hash die elke dag verandert);
  - gedeelde selecties en reacties (alleen voornamen), tot de link wordt uitgezet;
  - AI-dagtellers en het maandbudget.
- **Moodboard-afbeeldingen:** worden verkleind en alleen voor de analyse naar Anthropic gestuurd. FUSL bewaart ze niet.
