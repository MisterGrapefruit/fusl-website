// Favorieten/verlanglijstje — net als het klantprofiel (profile.js) voorlopig
// alleen lokaal opgeslagen in de browser van de bezoeker (localStorage), geen
// server nodig. Zodra er echte klantaccounts zijn, kan dit meeverhuizen.

var FUSL_FAVORITES_KEY = 'fusl_favorites';

function fuslGetFavorites() {
  try {
    var raw = window.localStorage.getItem(FUSL_FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
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
