// Aanboddata voor de aanbodpagina.
//
// SAMPLE_PRODUCTS is voorbeelddata ter illustratie van de lay-out.
// fuslLoadLiveListings() haalt daarnaast data/aanbod.json op — het bestand dat
// tools/sync-feed.js vult vanuit de feeds van aangesloten winkels (zie
// tools/partners.config.json). Zodra die sync draait op een schema, komt hier
// automatisch echt, actueel winkelaanbod bij — inclusief kortingsacties.
//
// Let op: data/aanbod.json ophalen met fetch() werkt alleen als de pagina via
// een webserver wordt bekeken (bv. de live site op Netlify, of lokaal via
// "python3 -m http.server"). Open je index.html rechtstreeks vanaf schijf
// (file://), dan blokkeert de browser dit verzoek — de pagina valt dan terug
// op de voorbeelddata hieronder, zodat de site nooit leeg lijkt.

var SAMPLE_PRODUCTS = [
  { id: 1, name: 'Hudson driezitsbank', category: 'bank', color: 'Groen', style: 'Landelijk', store: 'Woonstijl Verhoeven', type: 'lokaal', price: 899, salePrice: null, status: 'Showroommodel' },
  { id: 2, name: 'Oslo bank', category: 'bank', color: 'Wit', style: 'Scandinavisch', store: 'Meubelhuis Noord', type: 'lokaal', price: 749, salePrice: null, status: 'In de verkoop' },
  { id: 3, name: 'Chesterfield tweezits', category: 'bank', color: 'Terracotta', style: 'Hip', store: 'StudioKleur', type: 'lokaal', price: 1099, salePrice: null, status: 'Showroommodel' },
  { id: 4, name: 'Robuuste eikentafel', category: 'eettafel', color: 'Naturel hout', style: 'Landelijk', store: 'Interimo', type: 'keten', price: 625, salePrice: null, status: 'Showroommodel' },
  { id: 5, name: 'Ronde tafel Malmö', category: 'eettafel', color: 'Wit', style: 'Scandinavisch', store: 'De Eetkamerzaak', type: 'lokaal', price: 399, salePrice: null, status: 'In de verkoop' },
  { id: 6, name: 'Industriële statafel', category: 'eettafel', color: 'Zwart', style: 'Industrieel', store: 'MetaalWerk Interieur', type: 'keten', price: 480, salePrice: null, status: 'In de verkoop' },
  { id: 7, name: 'Industriële wandkast', category: 'kast', color: 'Zwart', style: 'Industrieel', store: 'MetaalWerk Interieur', type: 'keten', price: 540, salePrice: null, status: 'Showroommodel' },
  { id: 8, name: 'Boekenkast Beuk', category: 'kast', color: 'Naturel hout', style: 'Beige', store: 'Woonstijl Verhoeven', type: 'lokaal', price: 310, salePrice: null, status: 'In de verkoop' },
  { id: 9, name: 'Vitrinekast landelijk', category: 'kast', color: 'Naturel hout', style: 'Landelijk', store: 'Woonstijl Verhoeven', type: 'lokaal', price: 420, salePrice: null, status: 'Showroommodel' },
  { id: 10, name: 'Fluwelen eetkamerstoel', category: 'stoel', color: 'Terracotta', style: 'Hip', store: 'StudioKleur', type: 'lokaal', price: 149, salePrice: null, status: 'In de verkoop' },
  { id: 11, name: 'Lounge fauteuil', category: 'stoel', color: 'Donkerblauw', style: 'Knus', store: 'Interimo', type: 'keten', price: 289, salePrice: null, status: 'Showroommodel' },
  { id: 12, name: 'Scandinavische eetkamerstoel', category: 'stoel', color: 'Grijs', style: 'Scandinavisch', store: 'De Eetkamerzaak', type: 'lokaal', price: 89, salePrice: null, status: 'In de verkoop' }
];

// Zet een genormaliseerde aanbod.json-listing om naar hetzelfde vorm als
// SAMPLE_PRODUCTS, zodat de rest van de pagina geen onderscheid hoeft te maken.
function fuslMapLiveListing(l) {
  return {
    id: l.id,
    name: l.name,
    category: l.category,
    color: l.color || 'Overig',
    style: l.style || null,
    store: l.storeName,
    type: l.storeType,
    price: l.price,
    salePrice: l.salePrice,
    status: l.status || (l.salePrice ? 'Kortingsactie' : 'In de verkoop'),
    imageUrl: l.imageUrl || null,
    productUrl: l.productUrl || null,
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
      var listings = (data.listings || []).map(fuslMapLiveListing);
      onSuccess(listings);
    })
    .catch(function (err) {
      // Verwacht bij file:// of als er nog geen sync gedraaid is — stille fallback.
      console.info('Live winkelaanbod niet geladen (' + err.message + '), voorbeelddata wordt getoond.');
    });
}
