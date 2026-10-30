// Ontdek je stijl (stijl.html): kamers kiezen -> 8 meubels swipen ->
// stijlmix in woorden -> door naar de zoekpagina met jouw stijl aan.
(function () {
  var DECK_SIZE = 8;
  var ROOM_IMG = {
    'Landelijk': 'landelijk.jpg', 'Scandinavisch': 'scandinavisch.jpg', 'Industrieel': 'industrieel.jpg',
    'Knus': 'knus.jpg', 'Warm minimalisme': 'beige.jpg', 'Retro': 'hip.jpg'
  };
  var COLOR_HEX = {};
  FUSL_COLORS.forEach(function (c) { COLOR_HEX[c.name] = c.hex; });
  COLOR_HEX['Wit'] = '#ebe6dc';
  var CAT_ICON = {
    bank: '<path d="M4 12v-2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2"/><path d="M3 12a1.5 1.5 0 0 1 3 0v2h12v-2a1.5 1.5 0 0 1 3 0v5H3z"/><path d="M5 17v2M19 17v2"/>',
    eettafel: '<path d="M3 9h18"/><path d="M5 9v10M19 9v10"/><path d="M8 9v4h8V9"/>',
    kast: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M12 3v18"/><path d="M10 11v2M14 11v2"/>',
    stoel: '<path d="M7 3v10h10V3"/><path d="M6 13h12"/><path d="M7 13v8M17 13v8"/>',
    bed: '<path d="M3 18V8"/><path d="M3 14h18v4"/><path d="M21 15a3 3 0 0 0-3-3h-8v2"/><circle cx="6.5" cy="11.5" r="1.5"/>'
  };
  var ADJ = { 'Landelijk': 'landelijke', 'Scandinavisch': 'Scandinavische', 'Industrieel': 'industriële', 'Knus': 'knusse', 'Warm minimalisme': 'warm-minimalistische', 'Retro': 'retro', 'Japandi': 'Japandi', 'Klassiek': 'klassieke', 'Bohemien': 'bohemien', 'Kuststijl': 'kust-', 'Art Deco': 'Art Deco-', 'Maximalistisch': 'maximalistische' };
  var BUBBLES = {
    start: 'Hoi, ik ben Capy! Kies hieronder hoe je wilt beginnen, dan help ik je verder.',
    kies: 'Kies één tot drie kamers die je aanspreken. Ik zoek de rest.',
    swipe: 'Naar rechts als je het leuk vindt, naar links als het niet bij je past. Zo leer ik je smaak kennen.',
    done: 'Jouw smaak is een mix, en daar zoek ik ook naar!'
  };
  var HEADINGS = { start: 'Ontdek welke stijl bij jou past', kies: 'Welke kamers spreken je aan?', swipe: 'Verfijn je smaak', done: 'Dit is jouw stijl' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function $(id) { return document.getElementById(id); }

  var PRODUCTS = SAMPLE_PRODUCTS.map(function (p) { p.style = fuslCanonStyle(p.style); return p; });
  fuslLoadLiveListings(function (live) {
    live.forEach(function (p) { p.style = fuslCanonStyle(p.style); });
    var keys = live.map(function (p) { return (p.name + '|' + p.store).toLowerCase(); });
    PRODUCTS = live.concat(PRODUCTS.filter(function (p) { return keys.indexOf((p.name + '|' + p.store).toLowerCase()) < 0; }));
  });

  var st = { screen: 'start', picked: [], deck: [], idx: 0, likes: [], nopes: 0, busy: false };

  // ---------- Schermen ----------
  function show(screen, focusHeading) {
    st.screen = screen;
    var section = screen === 'done' ? 'swipe' : screen;
    document.querySelectorAll('[data-screen]').forEach(function (el) { el.hidden = el.getAttribute('data-screen') !== section; });
    $('st-heading').textContent = HEADINGS[screen];
    $('st-bubble').textContent = BUBBLES[screen];
    if (focusHeading) { $('st-heading').focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-go]');
    if (!b) return;
    show(b.getAttribute('data-go'), true);
    if (b.getAttribute('data-go') === 'kies') renderRooms();
  });

  // ---------- Kamers ----------
  function renderRooms() {
    document.querySelectorAll('.st-room').forEach(function (b) {
      var name = b.getAttribute('data-room');
      var on = st.picked.indexOf(name) >= 0;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.classList.toggle('on', on);
      b.classList.toggle('dim', !on && st.picked.length >= 3);
    });
    var n = st.picked.length;
    var go = $('st-to-swipe');
    go.hidden = n === 0;
    go.textContent = 'Ga verder met ' + n + ' ' + (n === 1 ? 'kamer' : 'kamers') + ' →';
    $('st-kies-hint').textContent = n >= 3
      ? 'Je hebt er drie gekozen. Haal er eerst een weg als je een andere wilt.'
      : 'Kies één tot drie kamers die je aanspreken. Daarna laat Capy je 8 meubels zien om je smaak te verfijnen.';
  }
  document.querySelectorAll('.st-room').forEach(function (b) {
    b.addEventListener('click', function () {
      var name = b.getAttribute('data-room');
      var i = st.picked.indexOf(name);
      if (i >= 0) st.picked.splice(i, 1);
      else if (st.picked.length < 3) st.picked.push(name);
      renderRooms();
    });
  });
  $('st-to-swipe').addEventListener('click', startSwipe);

  // ---------- Kaartjes ----------
  // Afwisselend een meubel uit je gekozen stijlen en een ander meubel, zodat
  // je smaak ook buiten je eerste keuze kan blijken. Elke soort meubel komt
  // zo veel mogelijk aan bod.
  function buildDeck(styles) {
    var shuffled = PRODUCTS.slice().sort(function () { return Math.random() - 0.5; });
    var seen = {};
    var byCatFirst = function (list) {
      var a = [], b = [];
      list.forEach(function (p) { (seen[p.category] ? b : a).push(p); seen[p.category] = true; });
      return a.concat(b);
    };
    var match = byCatFirst(shuffled.filter(function (p) { return styles.indexOf(p.style) >= 0; }));
    seen = {};
    var rest = byCatFirst(shuffled.filter(function (p) { return styles.indexOf(p.style) < 0; }));
    var deck = [];
    while (deck.length < DECK_SIZE && (match.length || rest.length)) {
      if (match.length) deck.push(match.shift());
      if (rest.length && deck.length < DECK_SIZE) deck.push(rest.shift());
    }
    return deck;
  }

  function startSwipe() {
    st.deck = buildDeck(st.picked);
    st.idx = 0; st.likes = []; st.nopes = 0;
    show('swipe', true);
    $('st-swiping').hidden = false;
    $('st-result').hidden = true;
    document.querySelector('.st-swipe-layout').classList.remove('done');
    $('st-skip').hidden = false;
    renderCard();
    renderSide();
    saveMix(); // zodat "Sla over" ook al jouw kamers meeneemt
  }

  function renderCard() {
    var total = st.deck.length;
    var p = st.deck[st.idx];
    if (!p) { finish(); return; }
    $('st-progress-bar').style.width = Math.round(st.idx / total * 100) + '%';
    $('st-card-no').textContent = 'Kaart ' + (st.idx + 1) + ' van ' + total;
    $('st-under').hidden = st.idx + 1 >= total;
    var media = $('st-card-media');
    var ink = (p.color === 'Wit' || p.color === 'Beige') ? '#3a2c20' : '#ffffff';
    media.style.background = COLOR_HEX[p.color] || '#e3ddc9';
    media.querySelectorAll('svg, img').forEach(function (n) { n.remove(); });
    media.insertAdjacentHTML('afterbegin', '<svg aria-hidden="true" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="' + ink + '" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">' + (CAT_ICON[p.category] || CAT_ICON.kast) + '</svg>' +
      (p.imageUrl ? '<img class="st-card-photo" src="' + esc(p.imageUrl) + '" alt="" onerror="this.remove()">' : ''));
    $('st-card-name').textContent = p.name;
    var card = $('st-card');
    card.setAttribute('aria-label', p.name + '. Kaart ' + (st.idx + 1) + ' van ' + total);
    // Nieuwe kaart zonder terugvlieg-animatie op zijn plek zetten
    card.style.transition = 'none';
    setDrag(0, true);
    card.style.opacity = '1';
    void card.offsetWidth;
    card.style.transition = '';
  }

  function setDrag(dx, dragging) {
    var card = $('st-card');
    card.style.transition = dragging ? 'none' : '';
    card.style.transform = 'translateX(' + dx + 'px) rotate(' + (dx / 18).toFixed(1) + 'deg)';
    $('st-stamp-like').style.opacity = Math.max(0, Math.min(1, dx / 110));
    $('st-stamp-nope').style.opacity = Math.max(0, Math.min(1, -dx / 110));
  }

  function decide(dir) {
    if (st.busy || st.idx >= st.deck.length) return;
    st.busy = true;
    var card = $('st-card');
    setDrag(dir === 'like' ? 640 : -640, false);
    $(dir === 'like' ? 'st-stamp-like' : 'st-stamp-nope').style.opacity = 1;
    card.style.opacity = '0';
    setTimeout(function () {
      var p = st.deck[st.idx];
      if (dir === 'like') st.likes.push(p); else st.nopes += 1;
      st.idx += 1;
      st.busy = false;
      renderCard();
      renderSide();
      saveMix();
      if (st.idx < st.deck.length) card.focus({ preventScroll: true });
    }, 260);
  }
  $('st-like').addEventListener('click', function () { decide('like'); });
  $('st-nope').addEventListener('click', function () { decide('nope'); });
  $('st-card').addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); decide('like'); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); decide('nope'); }
  });

  var drag = null;
  $('st-card').addEventListener('pointerdown', function (e) {
    if (st.busy) return;
    drag = { x0: e.clientX, dx: 0 };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
  });
  $('st-card').addEventListener('pointermove', function (e) {
    if (!drag) return;
    drag.dx = e.clientX - drag.x0;
    setDrag(drag.dx, true);
  });
  function endDrag() {
    if (!drag) return;
    var dx = drag.dx; drag = null;
    if (dx > 110) decide('like');
    else if (dx < -110) decide('nope');
    else setDrag(0, false);
  }
  $('st-card').addEventListener('pointerup', endDrag);
  $('st-card').addEventListener('pointercancel', endDrag);

  // ---------- Stijlmix ----------
  function computeMix() {
    var src = {};
    if (st.likes.length) st.likes.forEach(function (p) { if (p.style) src[p.style] = (src[p.style] || 0) + 1; });
    else st.picked.forEach(function (n) { src[n] = 1; });
    var total = Object.keys(src).reduce(function (s, k) { return s + src[k]; }, 0) || 1;
    var arr = Object.keys(src).map(function (k) { return { name: k, n: src[k] }; })
      .sort(function (a, b) { return b.n - a.n || (st.picked.indexOf(b.name) >= 0) - (st.picked.indexOf(a.name) >= 0); })
      .slice(0, 3);
    var sum = arr.reduce(function (s, m) { return s + m.n; }, 0) || total;
    var used = 0;
    arr.forEach(function (m, i) { m.pct = i === arr.length - 1 ? 100 - used : Math.round(m.n / sum * 100); used += m.pct; });
    return arr;
  }

  function low(n) { return ['Scandinavisch', 'Japandi', 'Art Deco'].indexOf(n) >= 0 ? n : n.charAt(0).toLowerCase() + n.slice(1); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function mixWords(arr) {
    if (!arr.length) return '';
    if (arr.length === 1) return 'Helemaal ' + low(arr[0].name);
    var a = arr[0], b = arr[1];
    var toets = function (x) { return ADJ[x.name] && !/-$/.test(ADJ[x.name]) ? 'een ' + ADJ[x.name] + ' toets' : 'invloeden van ' + low(x.name); };
    if (arr.length === 2) {
      if (Math.abs(a.pct - b.pct) <= 10) return cap(low(a.name)) + ' en ' + low(b.name) + ' in balans';
      return 'Vooral ' + low(a.name) + ', met ' + toets(b);
    }
    return 'Vooral ' + low(a.name) + ', met invloeden van ' + low(b.name) + ' en ' + low(arr[2].name);
  }

  function mixHtml(arr) {
    return arr.map(function (m) {
      return '<div class="st-mix-row"><div class="st-mix-label"><span>' + esc(m.name) + '</span><span>' + m.pct + '%</span></div>' +
        '<div class="st-mix-track"><div class="st-mix-bar" style="width:' + m.pct + '%"></div></div></div>';
    }).join('');
  }

  function topColors() {
    var t = {};
    st.likes.forEach(function (p) { if (p.color) t[p.color] = (t[p.color] || 0) + 1; });
    return Object.keys(t).sort(function (a, b) { return t[b] - t[a]; }).slice(0, 3);
  }

  function renderSide() {
    $('st-side-rooms').innerHTML = st.picked.map(function (n) {
      return '<span class="st-chip"><img src="images/' + ROOM_IMG[n] + '" alt="">' + esc(n) + '</span>';
    }).join('');
    $('st-side-count').innerHTML = '<strong>' + st.likes.length + '</strong> leuk · <strong>' + st.nopes + '</strong> niet mijn stijl';
    $('st-side-mix').innerHTML = mixHtml(computeMix());
    $('st-liked').innerHTML = st.likes.length
      ? st.likes.map(function (p) { return '<span class="st-liked-item"><span class="st-dot" style="background:' + esc(COLOR_HEX[p.color] || '#e3ddc9') + '"></span>' + esc(p.name) + '</span>'; }).join('')
      : '<span class="st-muted">Nog niets. Swipe een meubel naar rechts.</span>';
  }

  function saveMix() {
    var mix = computeMix().map(function (m) { return { name: m.name, pct: m.pct }; });
    fuslSaveProfile({ mix: mix, roomStyles: mix.map(function (m) { return m.name; }), likedColors: topColors(), updatedAt: Date.now() });
  }

  function finish() {
    var mix = computeMix();
    saveMix();
    $('st-swiping').hidden = true;
    $('st-result').hidden = false;
    document.querySelector('.st-swipe-layout').classList.add('done');
    $('st-skip').hidden = true;
    show('done', false);
    $('st-mix-title').textContent = mixWords(mix);
    $('st-result-intro').textContent = st.likes.length
      ? 'Je vond ' + st.likes.length + ' van de ' + st.deck.length + ' meubels mooi. Hiermee zoekt Capy het aanbod voor je door.'
      : 'Je vond geen van deze meubels echt jouw stijl. Capy gaat uit van de kamers die je koos; swipe gerust opnieuw voor andere meubels.';
    $('st-result-mix').innerHTML = mixHtml(mix);
    var colors = topColors();
    $('st-colors').hidden = !colors.length;
    $('st-colors').innerHTML = '<span class="st-side-label">Kleuren die je aanspreken:</span>' + colors.map(function (c) {
      return '<span class="st-color"><span class="st-dot" style="background:' + esc(COLOR_HEX[c] || '#e3ddc9') + '"></span>' + esc(FUSL_COLOR_LABEL[c] || c) + '</span>';
    }).join('');
    $('st-mix-title').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  $('st-restart').addEventListener('click', startSwipe);

  // Direct naar de kamers via stijl.html#kamers (bijv. vanaf de homepage)
  if (location.hash === '#kamers') { show('kies', false); renderRooms(); }
})();
