// Kleine gedeelde bouwstenen voor Mijn selectie en de gedeelde selectie.
var FUSL_UI = (function () {
  var COLOR_HEX = {};
  FUSL_COLORS.forEach(function (c) { COLOR_HEX[c.name] = c.hex; });
  COLOR_HEX['Wit'] = '#ebe6dc';
  var ICON = {
    bank: '<path d="M4 12v-2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2"/><path d="M3 12a1.5 1.5 0 0 1 3 0v2h12v-2a1.5 1.5 0 0 1 3 0v5H3z"/><path d="M5 17v2M19 17v2"/>',
    eettafel: '<path d="M3 9h18"/><path d="M5 9v10M19 9v10"/><path d="M8 9v4h8V9"/>',
    kast: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M12 3v18"/><path d="M10 11v2M14 11v2"/>',
    stoel: '<path d="M7 3v10h10V3"/><path d="M6 13h12"/><path d="M7 13v8M17 13v8"/>',
    bed: '<path d="M3 18V8"/><path d="M3 14h18v4"/><path d="M21 15a3 3 0 0 0-3-3h-8v2"/><circle cx="6.5" cy="11.5" r="1.5"/>'
  };
  var ROOM = { bank: 'Woonkamer', kast: 'Woonkamer', eettafel: 'Eetkamer', stoel: 'Eetkamer', bed: 'Slaapkamer' };
  var ROOMS = ['Woonkamer', 'Eetkamer', 'Slaapkamer', 'Overig'];
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function media(p, size) {
    var ink = (p.color === 'Wit' || p.color === 'Beige') ? '#3a2c20' : '#ffffff';
    return '<svg aria-hidden="true" width="' + (size || 76) + '" height="' + (size || 76) + '" viewBox="0 0 24 24" fill="none" stroke="' + ink + '" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">' + (ICON[p.category] || ICON.kast) + '</svg>';
  }
  function bg(p) { return COLOR_HEX[p.color] || '#e3ddc9'; }
  function roomOf(p) { return ROOM[p.category] || 'Overig'; }
  function id() {
    var a = new Uint8Array(12);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function store(key, val) {
    try {
      if (val === undefined) { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
      if (val === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(val));
    } catch (e) { return null; }
  }
  var THUMB = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 11v9H4v-9z"/><path d="M7 11l4-7a2 2 0 0 1 3 1.7V9h5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 20H7"/></svg>';
  return { esc: esc, media: media, bg: bg, roomOf: roomOf, ROOMS: ROOMS, id: id, store: store, THUMB: THUMB, COLOR_HEX: COLOR_HEX };
})();
