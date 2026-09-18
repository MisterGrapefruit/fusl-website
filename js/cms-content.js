// Laadt tekst die via het /admin-beheerscherm (Decap CMS) is aangepast.
// Elk element met een data-cms-attribuut krijgt de bijbehorende tekst uit het
// opgegeven JSON-bestand. Blijft het bestand onbereikbaar (of ontbreekt een
// sleutel), dan blijft gewoon de tekst staan die al in de HTML stond.
function fuslApplyCmsContent(jsonPath) {
  fetch(jsonPath, { cache: 'no-store' })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) {
      if (!data) return;
      document.querySelectorAll('[data-cms]').forEach(function (el) {
        var key = el.getAttribute('data-cms');
        if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
          el.textContent = data[key];
        }
      });
    })
    .catch(function () { /* fallback-tekst in de HTML blijft staan */ });
}
