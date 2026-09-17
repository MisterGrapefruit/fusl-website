// Klantprofiel — voorlopig opgeslagen in de browser (localStorage) zodat de
// stijlkeuze en kleurvoorkeuren per klik verfijnd en onthouden worden binnen
// dit apparaat/deze browser. Zodra er echte klantaccounts zijn (via het CMS/
// backend), verhuist dit naar een server zodat het profiel overal meegaat.

var FUSL_PROFILE_KEY = 'fusl_profile';

var FUSL_COLORS = [
  { name: 'Naturel hout', hex: '#b8916a' },
  { name: 'Wit', hex: '#ffffff' },
  { name: 'Beige', hex: '#e3ddc9' },
  { name: 'Grijs', hex: '#9a9a92' },
  { name: 'Zwart', hex: '#2b2b28' },
  { name: 'Donkerblauw', hex: '#35506b' },
  { name: 'Groen', hex: '#5f7a52' },
  { name: 'Terracotta', hex: '#a54a28' }
];

function fuslGetProfile() {
  try {
    var raw = window.localStorage.getItem(FUSL_PROFILE_KEY);
    if (!raw) return { roomStyle: null, colors: {} };
    var parsed = JSON.parse(raw);
    if (!parsed.colors) parsed.colors = {};
    return parsed;
  } catch (e) {
    return { roomStyle: null, colors: {} };
  }
}

function fuslSaveProfile(partial) {
  var current = fuslGetProfile();
  var next = Object.assign({}, current, partial);
  if (partial && partial.colors) {
    next.colors = Object.assign({}, current.colors, partial.colors);
  }
  try {
    window.localStorage.setItem(FUSL_PROFILE_KEY, JSON.stringify(next));
  } catch (e) {
    // localStorage niet beschikbaar (bv. privénavigatie) — profiel geldt dan alleen voor dit bezoek.
  }
  return next;
}
