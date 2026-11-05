// FUSL-bezoekersteller: meldt een paginaweergave bij /api/bezoek.
// Geen cookies, geen opslag in de browser, geen Google. Wat er wordt
// meegestuurd: de pagina, de verwijzende website en een eventuele utm_source.
(function () {
  try {
    if (!/^https?:$/.test(location.protocol) || /^(localhost|127\.)/.test(location.hostname)) return;
    if (navigator.webdriver) return; // geautomatiseerde browsers niet meetellen
    var u = new URLSearchParams(location.search).get('utm_source') || '';
    var data = JSON.stringify({ p: location.pathname, r: document.referrer || '', u: u });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/bezoek', data);
    else fetch('/api/bezoek', { method: 'POST', body: data, keepalive: true });
  } catch (e) { /* tellen mag de site nooit hinderen */ }
})();
