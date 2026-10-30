// FUSL zoeklogica: vertaalt een zoekzin naar filters, en bepaalt welke stukken
// passen of er het dichtst bij komen.
//
// fuslParseQuery() werkt volledig in de browser met vaste woordenlijsten. In
// fase 5 komt daar een AI-variant bij (Netlify function); deze lokale versie
// blijft dan de terugvaloptie als de AI niet bereikbaar is.

var FUSL_CATS = [['bank', 'Banken', 'Bank'], ['eettafel', 'Eettafels', 'Eettafel'], ['stoel', 'Stoelen', 'Stoel'], ['kast', 'Kasten', 'Kast'], ['bed', 'Bedden', 'Bed']];
var FUSL_STYLES = ['Landelijk', 'Scandinavisch', 'Industrieel', 'Knus', 'Warm minimalisme', 'Retro', 'Japandi', 'Bohemien', 'Klassiek', 'Kuststijl', 'Art Deco', 'Maximalistisch'];
var FUSL_COLOR_LABEL = { 'Terracotta': 'Rood / terracotta', 'Naturel hout': 'Hout', 'Donkerblauw': 'Blauw' };
var FUSL_PRICES = [[null, null, 'Alle prijzen'], [null, 250, 'Tot € 250'], [250, 500, '€ 250 – € 500'], [500, 750, '€ 500 – € 750'], [750, null, '€ 750 en meer']];

var FUSL_CAT_WORDS = [
  ['bank', /\b(bank|banken|bankje|sofa|bankstel|driezits|tweezits|chesterfield|hoekbank)\b/],
  ['eettafel', /\b(tafel|tafels|eettafel|eettafels|eetkamertafel)\b/],
  ['stoel', /\b(stoel|stoelen|fauteuil|fauteuils|loungestoel|eetkamerstoel|eetkamerstoelen)\b/],
  ['kast', /\b(kast|kasten|dressoir|tv-meubel|tv meubel|boekenkast|vitrinekast|wandkast)\b/],
  ['bed', /\b(bed|bedden|boxspring|bedframe)\b/]
];
var FUSL_COLOR_WORDS = [
  ['Terracotta', /\b(rood|rode|terracotta|roestbruin|roest|bordeaux|oranje)\b/],
  ['Donkerblauw', /\b(blauw|blauwe|donkerblauw|donkerblauwe|navy)\b/],
  ['Groen', /\b(groen|groene)\b/],
  ['Wit', /\b(wit|witte|crème|creme)\b/],
  ['Zwart', /\b(zwart|zwarte)\b/],
  ['Grijs', /\b(grijs|grijze|antraciet)\b/],
  ['Beige', /\b(beige|zand|zandkleur\w*)\b/],
  ['Naturel hout', /\b(hout|houten|eiken|eikenhout|naturel|beuken|walnoot|rotan|riet)\b/]
];
var FUSL_STYLE_WORDS = [
  ['Landelijk', /\blandelijk\w*/], ['Scandinavisch', /\bscandinavisch\w*|\bscandi\b/], ['Industrieel', /\bindustri\w*/],
  ['Knus', /\bknus\w*|\bgezellig\w*/], ['Warm minimalisme', /\bminimalis\w*/], ['Retro', /\bretro\b|\bvintage\b/],
  ['Japandi', /\bjapandi\b/], ['Bohemien', /\bboho\b|\bbohemi\w*/], ['Klassiek', /\bklassie\w*/],
  ['Kuststijl', /\bkust\w*|\bstrand\w*/], ['Art Deco', /\bart ?deco\b/], ['Maximalistisch', /\bmaximalis\w*/]
];

// Zet een stijlnaam om naar de vaste schrijfwijze ("Warm Minimalisme" -> "Warm minimalisme").
function fuslCanonStyle(name) {
  if (!name) return null;
  var low = String(name).toLowerCase();
  for (var i = 0; i < FUSL_STYLES.length; i++) if (FUSL_STYLES[i].toLowerCase() === low) return FUSL_STYLES[i];
  return name;
}

function fuslEuro(n) { return '€ ' + Math.round(n).toLocaleString('nl-NL'); }

// Zoekzin -> filters. Alleen de sleutels die herkend zijn, staan in het resultaat.
function fuslParseQuery(q) {
  var t = ' ' + String(q || '').toLowerCase().replace(/€/g, ' € ') + ' ';
  var f = {};
  FUSL_CAT_WORDS.forEach(function (c) { if (!f.cats && c[1].test(t)) f.cats = [c[0]]; });
  FUSL_COLOR_WORDS.forEach(function (c) { if (!f.colors && c[1].test(t)) f.colors = [c[0]]; });
  FUSL_STYLE_WORDS.forEach(function (s) { if (!f.styles && s[1].test(t)) f.styles = [s[0]]; });
  var m;
  if ((m = t.match(/tussen\s*(?:€\s*)?(\d+)\s*(?:euro)?\s*(?:en|tot|-)\s*(?:€\s*)?(\d+)/))) { f.min = +m[1]; f.max = +m[2]; }
  else if ((m = t.match(/(?:€\s*)?(\d+)\s*(?:-|tot)\s*(?:€\s*)?(\d+)\s*(?:euro|€)?/)) && /euro|€/.test(t)) { f.min = +m[1]; f.max = +m[2]; }
  else {
    if ((m = t.match(/(?:onder|tot|maximaal|max\.?|hooguit|niet meer dan|minder dan|budget(?: van)?)\s*(?:de\s*)?(?:€\s*)?(\d+)/))) { f.min = null; f.max = +m[1]; }
    if ((m = t.match(/(?:vanaf|boven|minimaal|meer dan)\s*(?:de\s*)?(?:€\s*)?(\d+)/))) { f.min = +m[1]; if (f.max === undefined) f.max = null; }
  }
  if (f.min != null && f.max != null && f.min > f.max) { var x = f.min; f.min = f.max; f.max = x; }
  if (/\bzelfstandig\w*|\blokal\w*|\bonafhankelijk\w*/.test(t)) f.shop = 'lokaal';
  else if (/\bketen\w*/.test(t)) f.shop = 'keten';
  return f;
}

function fuslEmptyFilters() { return { cats: [], styles: [], colors: [], min: null, max: null, shop: null, maxKm: null }; }

function fuslHasFilters(f) {
  return !!(f.cats.length || f.styles.length || f.colors.length || f.min != null || f.max != null || f.shop || f.maxKm);
}

// kmOf(p) geeft de afstand in km of null als die (nog) niet bekend is.
function fuslFits(p, f, kmOf) {
  if (f.cats.length && f.cats.indexOf(p.category) < 0) return false;
  if (f.styles.length && f.styles.indexOf(p.style) < 0) return false;
  if (f.colors.length && f.colors.indexOf(p.color) < 0) return false;
  if (f.min != null && p.price < f.min) return false;
  if (f.max != null && p.price > f.max) return false;
  if (f.shop && p.type !== f.shop) return false;
  if (f.maxKm) { var km = kmOf(p); if (km == null || km > f.maxKm) return false; }
  return true;
}

// Wat wijkt af van de filters? Getoond bij "Dit komt het dichtst in de buurt".
function fuslDiffs(p, f, kmOf) {
  var d = [];
  var catLabel = {}; FUSL_CATS.forEach(function (c) { catLabel[c[0]] = c[2]; });
  if (f.cats.length && f.cats.indexOf(p.category) < 0) d.push('andere soort: ' + (catLabel[p.category] || p.category).toLowerCase());
  if (f.styles.length && f.styles.indexOf(p.style) < 0) d.push('andere stijl: ' + String(p.style || 'onbekend').toLowerCase());
  if (f.colors.length && f.colors.indexOf(p.color) < 0) d.push('andere kleur: ' + String(p.color).toLowerCase());
  if (f.max != null && p.price > f.max) d.push(fuslEuro(p.price - f.max) + ' boven je budget');
  if (f.min != null && p.price < f.min) d.push('onder je prijsrange');
  if (f.shop && p.type !== f.shop) d.push(p.type === 'keten' ? 'keten' : 'zelfstandige winkel');
  if (f.maxKm) { var km = kmOf(p); if (km != null && km > f.maxKm) d.push(km + ' km, verder dan ' + f.maxKm + ' km'); }
  return d;
}

function fuslScore(p, f, kmOf) {
  var s = 0;
  if (f.cats.length) s += f.cats.indexOf(p.category) >= 0 ? 6 : -6;
  if (f.colors.length && f.colors.indexOf(p.color) >= 0) s += 3;
  if (f.styles.length && f.styles.indexOf(p.style) >= 0) s += 2;
  if (f.shop && p.type === f.shop) s += 1;
  if (f.maxKm) { var km = kmOf(p); if (km != null) s += km <= f.maxKm ? 2 : Math.max(0, 1 - (km - f.maxKm) / 30); }
  if (f.max != null || f.min != null) {
    var lo = f.min != null ? f.min : 0, hi = f.max != null ? f.max : Infinity;
    if (p.price >= lo && p.price <= hi) s += 3;
    else { var gap = p.price > hi ? p.price - hi : lo - p.price; s += Math.max(0, 2 - gap / 250); }
  }
  return s;
}

// ---------- Afstand ----------

function fuslKmBetween(a, b) {
  var R = 6371, rad = Math.PI / 180;
  var dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

function fuslNormalizePostcode(pc) {
  var m = String(pc || '').toUpperCase().replace(/\s+/g, '').match(/^(\d{4})([A-Z]{2})?$/);
  if (!m) return null;
  return m[2] ? m[1] + ' ' + m[2] : m[1];
}

var FUSL_LOCATION_KEY = 'fusl_locatie';

function fuslGetLocation() {
  try { var raw = window.localStorage.getItem(FUSL_LOCATION_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
function fuslSaveLocation(loc) {
  try { if (loc) window.localStorage.setItem(FUSL_LOCATION_KEY, JSON.stringify(loc)); else window.localStorage.removeItem(FUSL_LOCATION_KEY); } catch (e) {}
}

// Zoekt de coördinaten van een postcode op via de PDOK Locatieserver (open
// dienst van de Nederlandse overheid, geen sleutel nodig). Alleen de postcode
// gaat mee; het resultaat bewaren we alleen in de browser van de bezoeker.
function fuslGeocodePostcode(pc) {
  var norm = fuslNormalizePostcode(pc);
  if (!norm) return Promise.reject(new Error('ongeldig'));
  var compact = norm.replace(' ', '');
  var q = compact.length === 6 ? 'postcode:' + compact : 'postcode:' + compact + '*';
  var url = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?fq=type:postcode&rows=1&fl=centroide_ll,woonplaatsnaam,postcode&q=' + encodeURIComponent(q);
  return fetch(url)
    .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
    .then(function (data) {
      var doc = data && data.response && data.response.docs && data.response.docs[0];
      var m = doc && String(doc.centroide_ll || '').match(/POINT\(([-\d.]+) ([-\d.]+)\)/);
      if (!m) throw new Error('niet gevonden');
      return { postcode: norm, plaats: doc.woonplaatsnaam || '', lat: +m[2], lng: +m[1] };
    });
}

// ---------- Slimme zoekfunctie (fase 5) ----------
// Vraagt de AI-functie om de zoekzin te begrijpen. Valt bij elke fout (geen
// sleutel ingesteld, limiet, traag netwerk) stil terug op fuslParseQuery.
// Resultaat: { parsed, bron: 'ai' | 'lokaal' }.
function fuslSmartParse(q) {
  var local = function () { return { parsed: fuslParseQuery(q), bron: 'lokaal' }; };
  if (typeof fetch !== 'function' || !/^https?:/.test(location.protocol)) return Promise.resolve(local());
  var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 6000);
  return fetch('/api/zoek', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: q }), signal: ctrl ? ctrl.signal : undefined
  }).then(function (res) {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }).then(function (d) {
    var f = d && d.filters;
    if (!f) throw new Error('leeg');
    var parsed = {};
    if (f.cats && f.cats.length) parsed.cats = f.cats;
    if (f.styles && f.styles.length) parsed.styles = f.styles;
    if (f.colors && f.colors.length) parsed.colors = f.colors;
    if (f.min != null || f.max != null) { parsed.min = f.min; parsed.max = f.max; }
    if (f.shop) parsed.shop = f.shop;
    // Herkent de AI niets maar de woordenlijst wel, dan die gebruiken.
    if (!Object.keys(parsed).length) return local();
    return { parsed: parsed, bron: 'ai' };
  }).catch(function () { return local(); })
    .then(function (r) { clearTimeout(timer); return r; });
}
