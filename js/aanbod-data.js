// Aanboddata voor de zoekpagina.
//
// SAMPLE_PRODUCTS is voorbeelddata ter illustratie van de lay-out (fictieve
// winkels, geen winkellink). fuslLoadLiveListings() haalt daarnaast
// data/aanbod.json op: het bestand dat de feed-sync vult vanuit de feeds van
// aangesloten winkels. Zodra die sync op een schema draait, komt hier
// automatisch echt, actueel winkelaanbod bij.
//
// FUSL toont alleen showroommodellen, laatste exemplaren en stukken uit
// vorige collecties. Elk stuk krijgt daarom één van deze drie labels.
//
// Let op: data/aanbod.json en data/winkels.json ophalen met fetch() werkt
// alleen via een webserver (de live site op Netlify, of lokaal via
// "python3 -m http.server"). Via file:// valt de pagina terug op de
// voorbeelddata hieronder, zodat de site nooit leeg lijkt.

var FUSL_LABELS = ['Showroommodel', 'Laatste exemplaar', 'Vorige collectie'];

var SAMPLE_PRODUCTS = [
  { id: 's1', name: 'Hudson driezitsbank', category: 'bank', color: 'Groen', style: 'Landelijk', store: 'Woonstijl Verhoeven', storeId: 'woonstijl-verhoeven', type: 'lokaal', price: 899, status: 'Showroommodel' },
  { id: 's2', name: 'Oslo bank', category: 'bank', color: 'Wit', style: 'Scandinavisch', store: 'Meubelhuis Noord', storeId: 'meubelhuis-noord', type: 'lokaal', price: 749, status: 'Laatste exemplaar' },
  { id: 's3', name: 'Chesterfield tweezits', category: 'bank', color: 'Terracotta', style: 'Retro', store: 'StudioKleur', storeId: 'studiokleur', type: 'lokaal', price: 1099, status: 'Showroommodel' },
  { id: 's4', name: 'Robuuste eikentafel', category: 'eettafel', color: 'Naturel hout', style: 'Landelijk', store: 'Interimo', storeId: 'interimo', type: 'keten', price: 625, status: 'Showroommodel' },
  { id: 's5', name: 'Ronde tafel Malmö', category: 'eettafel', color: 'Wit', style: 'Scandinavisch', store: 'De Eetkamerzaak', storeId: 'de-eetkamerzaak', type: 'lokaal', price: 399, status: 'Laatste exemplaar' },
  { id: 's6', name: 'Industriële statafel', category: 'eettafel', color: 'Zwart', style: 'Industrieel', store: 'MetaalWerk Interieur', storeId: 'metaalwerk-interieur', type: 'keten', price: 480, status: 'Vorige collectie' },
  { id: 's7', name: 'Industriële wandkast', category: 'kast', color: 'Zwart', style: 'Industrieel', store: 'MetaalWerk Interieur', storeId: 'metaalwerk-interieur', type: 'keten', price: 540, status: 'Showroommodel' },
  { id: 's8', name: 'Boekenkast Beuk', category: 'kast', color: 'Naturel hout', style: 'Warm minimalisme', store: 'Woonstijl Verhoeven', storeId: 'woonstijl-verhoeven', type: 'lokaal', price: 310, status: 'Laatste exemplaar' },
  { id: 's9', name: 'Vitrinekast landelijk', category: 'kast', color: 'Naturel hout', style: 'Landelijk', store: 'Woonstijl Verhoeven', storeId: 'woonstijl-verhoeven', type: 'lokaal', price: 420, status: 'Showroommodel' },
  { id: 's10', name: 'Fluwelen eetkamerstoel', category: 'stoel', color: 'Terracotta', style: 'Retro', store: 'StudioKleur', storeId: 'studiokleur', type: 'lokaal', price: 149, status: 'Laatste exemplaar' },
  { id: 's11', name: 'Lounge fauteuil', category: 'stoel', color: 'Donkerblauw', style: 'Knus', store: 'Interimo', storeId: 'interimo', type: 'keten', price: 289, status: 'Showroommodel' },
  { id: 's12', name: 'Scandinavische eetkamerstoel', category: 'stoel', color: 'Grijs', style: 'Scandinavisch', store: 'De Eetkamerzaak', storeId: 'de-eetkamerzaak', type: 'lokaal', price: 89, status: 'Vorige collectie' },
  { id: 's13', name: 'Eiken tv-meubel laag', category: 'kast', color: 'Naturel hout', style: 'Japandi', store: 'Woonstijl Verhoeven', storeId: 'woonstijl-verhoeven', type: 'lokaal', price: 365, status: 'Showroommodel' },
  { id: 's14', name: 'Rotan hangstoel', category: 'stoel', color: 'Naturel hout', style: 'Bohemien', store: 'StudioKleur', storeId: 'studiokleur', type: 'lokaal', price: 219, status: 'Laatste exemplaar' },
  { id: 's15', name: 'Fluwelen chesterfield bank', category: 'bank', color: 'Donkerblauw', style: 'Klassiek', store: 'Meubelhuis Noord', storeId: 'meubelhuis-noord', type: 'lokaal', price: 1249, status: 'Showroommodel' },
  { id: 's16', name: 'Rieten loungestoel', category: 'stoel', color: 'Wit', style: 'Kuststijl', store: 'De Eetkamerzaak', storeId: 'de-eetkamerzaak', type: 'lokaal', price: 179, status: 'Laatste exemplaar' },
  { id: 's17', name: 'Art Deco dressoir', category: 'kast', color: 'Zwart', style: 'Art Deco', store: 'Interimo', storeId: 'interimo', type: 'keten', price: 590, status: 'Showroommodel' },
  { id: 's18', name: 'Patchwork bank', category: 'bank', color: 'Terracotta', style: 'Maximalistisch', store: 'StudioKleur', storeId: 'studiokleur', type: 'lokaal', price: 975, status: 'Vorige collectie' },
  { id: 's19', name: 'Boxspring Malmö', category: 'bed', color: 'Grijs', style: 'Scandinavisch', store: 'Meubelhuis Noord', storeId: 'meubelhuis-noord', type: 'lokaal', price: 799, status: 'Showroommodel' },
  { id: 's20', name: 'Houten bedframe landelijk', category: 'bed', color: 'Naturel hout', style: 'Landelijk', store: 'Woonstijl Verhoeven', storeId: 'woonstijl-verhoeven', type: 'lokaal', price: 540, status: 'Laatste exemplaar' }
].map(function (p, i) {
  p.sample = true;
  p.order = i; // volgorde voor "Nieuw binnen" bij voorbeelddata
  return p;
});

// Leidt uit de statustekst van een winkelfeed het FUSL-label af. De rest van
// de tekst (bv. "lichte gebruikssporen") bewaren we als toelichting.
function fuslLabelFor(listing) {
  var s = String(listing.status || '');
  if (/showroom/i.test(s)) return 'Showroommodel';
  if (/laatste|enige|nog (maar )?(één|1)/i.test(s) || listing.stock === 1) return 'Laatste exemplaar';
  return 'Vorige collectie';
}

function fuslConditionNote(listing) {
  var s = String(listing.status || '').trim();
  var m = s.match(/^[^,.]*(?:showroommodel|laatste exemplaar)[^,.]*[,.]\s*(.+)$/i);
  if (!m) return '';
  return m[1].replace(/\.$/, '');
}

// Zet een genormaliseerde aanbod.json-listing om naar dezelfde vorm als
// SAMPLE_PRODUCTS, zodat de rest van de pagina geen onderscheid hoeft te maken.
// "price" is altijd de prijs die de klant nu betaalt.
function fuslMapLiveListing(l) {
  var current = (typeof l.salePrice === 'number' && l.salePrice > 0) ? l.salePrice : l.price;
  return {
    id: String(l.id),
    name: l.name,
    category: l.category,
    color: l.color || 'Overig',
    style: l.style || null,
    store: l.storeName,
    storeId: l.storeId,
    type: l.storeType,
    price: current,
    status: fuslLabelFor(l),
    condition: fuslConditionNote(l),
    imageUrl: l.imageUrl || null,
    productUrl: l.productUrl || null,
    inStock: l.inStock !== false,
    addedAt: l.firstSeen || l.lastSynced || null,
    live: true
  };
}

// Probeert data/aanbod.json te laden. Roept onSuccess(listings) aan zodra het
// gelukt is; doet niets als het bestand ontbreekt of niet opgehaald kan worden
// (dan blijft de voorbeelddata gewoon staan).
function fuslLoadLiveListings(onSuccess) {
  if (typeof fetch !== 'function') return;
  fetch('data/aanbod.json')
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      var listings = (data.listings || []).map(fuslMapLiveListing).filter(function (p) { return p.inStock; });
      onSuccess(listings);
    })
    .catch(function (err) {
      console.info('Live winkelaanbod niet geladen (' + err.message + '), voorbeelddata wordt getoond.');
    });
}

// Winkellocaties (data/winkels.json) voor de afstandsfilter.
function fuslLoadStores(onSuccess) {
  if (typeof fetch !== 'function') return;
  fetch('data/winkels.json')
    .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
    .then(function (data) { onSuccess(data.winkels || []); })
    .catch(function () { /* geen winkeldata: afstand blijft gewoon leeg */ });
}
