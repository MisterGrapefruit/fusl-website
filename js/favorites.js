// Favorieten/verlanglijstje — net als het klantprofiel (profile.js) voorlopig
// alleen lokaal opgeslagen in de browser van de bezoeker (localStorage), geen
// server nodig. Zodra er echte klantaccounts zijn, kan dit meeverhuizen.

var FUSL_FAVORITES_KEY = 'fusl_favorites';

function fuslGetFavorites() {
  try {
    var raw = window.localStorage.getItem(FUSL_FAVORITES_KEY);
    var list = raw ? JSON.parse(raw) : [];
    // Voorbeeldstukken hadden eerst nummers als id (1 t/m 20), nu 's1' t/m 's20'.
    return list.map(function (id) { id = String(id); return /^\d{1,2}$/.test(id) ? 's' + id : id; });
  } catch (e) {
    return [];
  }
}

function fuslIsFavorite(id) {
  return fuslGetFavorites().indexOf(String(id)) !== -1;
}

// Bij elk bewaard stuk onthouden we ook een momentopname (naam, winkel,
// prijs...). Zo kan Mijn selectie laten zien of de prijs veranderd is, en
// blijft een stuk zichtbaar als "Verkocht" als de winkel het verkocht heeft.
var FUSL_FAVORITES_INFO_KEY = 'fusl_favorites_info';

function fuslFavoriteSnapshot(p) {
  if (!p) return null;
  return {
    id: String(p.id), name: p.name, store: p.store, storeId: p.storeId || null, type: p.type,
    category: p.category, color: p.color, style: p.style, price: p.price, status: p.status,
    live: !!p.live, link: !!p.productUrl, savedAt: Date.now()
  };
}

function fuslGetFavoriteInfo() {
  try {
    var raw = window.localStorage.getItem(FUSL_FAVORITES_INFO_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function fuslSaveFavoriteInfo(info) {
  try { window.localStorage.setItem(FUSL_FAVORITES_INFO_KEY, JSON.stringify(info)); } catch (e) {}
}

function fuslSaveFavorites(favs) {
  try {
    window.localStorage.setItem(FUSL_FAVORITES_KEY, JSON.stringify(favs));
  } catch (e) {
    // localStorage niet beschikbaar (bv. privénavigatie) — favorieten gelden dan alleen voor dit bezoek.
  }
}

// product is optioneel: geef het mee om de momentopname te bewaren.
function fuslToggleFavorite(id, product) {
  id = String(id);
  var favs = fuslGetFavorites();
  var info = fuslGetFavoriteInfo();
  var idx = favs.indexOf(id);
  if (idx === -1) {
    favs.push(id);
    if (product) info[id] = fuslFavoriteSnapshot(product);
  } else {
    favs.splice(idx, 1);
    delete info[id];
  }
  fuslSaveFavorites(favs);
  fuslSaveFavoriteInfo(info);
  return favs;
}
