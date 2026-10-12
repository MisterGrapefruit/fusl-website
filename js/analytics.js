// FUSL — verkeersmonitoring.
//
// Dit bestand doet twee dingen, los van elkaar:
//
// 1) Google Analytics 4 (GA4) — algemeen inzicht in bezoekersaantallen,
//    paginaweergaven en herkomst van bezoekers. Het Measurement ID wordt
//    NIET hardcoded hier, maar staat in data/analytics-config.json — dat
//    bestand is aanpasbaar via het /admin-beheerscherm (CMS), onder
//    "Instellingen → Analytics (Google Analytics 4)". Zolang daar geen ID is
//    ingevuld, wordt er niets geladen of verstuurd. Zie ANALYTICS-SETUP.md
//    voor de stappen om zelf een gratis GA4-property aan te maken.
//    GA4 zet cookies, dus laden we 'm pas na toestemming via het
//    cookiebalkje hieronder (AVG/GDPR).
//
// 2) Een eigen, GA4-onafhankelijke manier om te zien hoeveel bezoekers FUSL
//    naar een partnerwinkel doorstuurt: elke "Bekijk bij <winkel>"-link
//    krijgt (a) UTM-parameters, zodat de winkel het zelf ook terugziet in
//    hún eigen analytics, en (b) stuurt — als er toestemming is — een eigen
//    "winkel_klik"-event naar GA4 met de winkelnaam als los veld, zodat FUSL
//    dit altijd zelf kan opvragen, onafhankelijk van medewerking van de
//    winkel zelf.

var FUSL_CONSENT_KEY = 'fusl_analytics_consent'; // 'granted' | 'denied'

function fuslGetConsent() {
  try {
    return window.localStorage.getItem(FUSL_CONSENT_KEY);
  } catch (e) {
    return null;
  }
}

function fuslSetConsent(value) {
  try {
    window.localStorage.setItem(FUSL_CONSENT_KEY, value);
  } catch (e) {
    // localStorage niet beschikbaar — toestemming geldt dan alleen voor dit bezoek.
  }
}

// Laadt gtag.js en initialiseert GA4. Wordt pas aangeroepen zodra zowel een
// Measurement ID bekend is als de bezoeker toestemming heeft gegeven.
function fuslLoadGA4(measurementId) {
  if (!measurementId || window.fuslGA4Loaded) return;
  window.fuslGA4Loaded = true;

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', measurementId, { anonymize_ip: true });

  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(measurementId);
  document.head.appendChild(script);
}

// Verstuurt FUSL's eigen "winkel_klik"-event (alleen als GA4 daadwerkelijk
// geladen is — dus met toestemming en een ingesteld Measurement ID).
function fuslTrackStoreClick(details) {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', 'winkel_klik', {
    winkel_naam: details.winkelNaam || '',
    winkel_type: details.winkelType || '',
    meubel_categorie: details.categorie || '',
    product_naam: details.productNaam || ''
  });
}

// Voegt UTM-parameters toe aan een winkel-URL, zodat de winkel ook in hún
// eigen analytics kan zien dat het bezoek van FUSL afkomstig is. Dit werkt
// altijd, ook zonder cookietoestemming — het zijn gewone linkparameters,
// geen cookies of tracking aan FUSL's kant.
function fuslWithUtm(url, extra) {
  try {
    var u = new URL(url);
    u.searchParams.set('utm_source', 'fusl');
    u.searchParams.set('utm_medium', 'referral');
    u.searchParams.set('utm_campaign', 'marketplace');
    if (extra && extra.content) u.searchParams.set('utm_content', String(extra.content));
    return u.toString();
  } catch (e) {
    return url; // onbekend/niet te parsen URL-formaat — ongewijzigd teruggeven
  }
}

function fuslShowCookieBanner(onAccept, onDecline) {
  if (document.getElementById('cookie-banner')) return;

  var banner = document.createElement('div');
  banner.className = 'cookie-banner';
  banner.id = 'cookie-banner';
  banner.innerHTML =
    '<div class="cookie-banner-text">We gebruiken analytics-cookies om te zien hoe de site gebruikt wordt — ook om partnerwinkels te kunnen laten zien hoeveel bezoekers we doorsturen. Vind je dat goed?</div>' +
    '<div class="cookie-banner-actions">' +
      '<button type="button" class="btn btn-white" id="cookie-decline">Liever niet</button>' +
      '<button type="button" class="btn btn-accent" id="cookie-accept">Akkoord</button>' +
    '</div>';
  document.body.appendChild(banner);

  document.getElementById('cookie-accept').addEventListener('click', function () {
    banner.remove();
    onAccept();
  });
  document.getElementById('cookie-decline').addEventListener('click', function () {
    banner.remove();
    onDecline();
  });
}

function fuslInitAnalytics() {
  fetch('data/analytics-config.json', { cache: 'no-store' })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (cfg) {
      var measurementId = cfg && cfg.ga4MeasurementId ? String(cfg.ga4MeasurementId).trim() : '';
      if (!measurementId) return; // nog geen GA4-ID ingesteld via het CMS — niets te doen

      var consent = fuslGetConsent();
      if (consent === 'granted') {
        fuslLoadGA4(measurementId);
        return;
      }
      if (consent === 'denied') return; // eerder al bewust geweigerd

      fuslShowCookieBanner(
        function () { fuslSetConsent('granted'); fuslLoadGA4(measurementId); },
        function () { fuslSetConsent('denied'); }
      );
    })
    .catch(function () {
      // geen config bereikbaar (bv. bij file:// of nog geen sync) — gewoon geen tracking
    });
}

fuslInitAnalytics();
