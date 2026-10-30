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

function fuslToggleFavorite(id) {
  id = String(id);
  var favs = fuslGetFavorites();
  var idx = favs.indexOf(id);
  if (idx === -1) {
    favs.push(id);
  } else {
    favs.splice(idx, 1);
  }
  try {
    window.localStorage.setItem(FUSL_FAVORITES_KEY, JSON.stringify(favs));
  } catch (e) {
    // localStorage niet beschikbaar (bv. privénavigatie) — favorieten gelden dan alleen voor dit bezoek.
  }
  return favs;
}
