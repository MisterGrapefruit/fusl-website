// Zoekpagina (aanbod.html): zoekbalk die filters instelt, filterbalk,
// sorteren, "dichtst in de buurt" en de stijlschakelaar.
(function () {
  // Oude link naar de favorieten: die staan nu op een eigen pagina
  if (location.hash === '#favorieten') { location.replace('selectie.html'); return; }
  var COLOR_HEX = {};
  FUSL_COLORS.forEach(function (c) { COLOR_HEX[c.name] = c.hex; });
  COLOR_HEX['Wit'] = '#ebe6dc'; // anders valt een wit stuk weg tegen de witte kaart
  var CAT_LABEL = {}; FUSL_CATS.forEach(function (c) { CAT_LABEL[c[0]] = c[2]; });
  var CAT_ICON = {
    bank: '<path d="M4 12v-2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2"/><path d="M3 12a1.5 1.5 0 0 1 3 0v2h12v-2a1.5 1.5 0 0 1 3 0v5H3z"/><path d="M5 17v2M19 17v2"/>',
    eettafel: '<path d="M3 9h18"/><path d="M5 9v10M19 9v10"/><path d="M8 9v4h8V9"/>',
    kast: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M12 3v18"/><path d="M10 11v2M14 11v2"/>',
    stoel: '<path d="M7 3v10h10V3"/><path d="M6 13h12"/><path d="M7 13v8M17 13v8"/>',
    bed: '<path d="M3 18V8"/><path d="M3 14h18v4"/><path d="M21 15a3 3 0 0 0-3-3h-8v2"/><circle cx="6.5" cy="11.5" r="1.5"/>'
  };
  var HEART = '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="FILL" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';
  var CHEVRON = '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  // ---------- Data ----------
  var PRODUCTS = SAMPLE_PRODUCTS.map(prep);
  var STORES = [];
  var location_ = fuslGetLocation();

  function prep(p) {
    p.style = fuslCanonStyle(p.style);
    return p;
  }

  // ---------- Stijlmix uit "Ontdek je stijl" ----------
  // Fase 3 bewaart profile.mix = [{ name, pct }]. Oudere profielen hebben
  // alleen roomStyles; die tellen dan even zwaar mee.
  function readMix() {
    var profile = fuslGetProfile();
    var mix = Array.isArray(profile.mix) && profile.mix.length
      ? profile.mix
      : (profile.roomStyles || []).map(function (s) { return { name: s, pct: 0 }; });
    return mix.map(function (m) { return { name: fuslCanonStyle(m.name), pct: m.pct || 0 }; })
      .filter(function (m) { return FUSL_STYLES.indexOf(m.name) >= 0; });
  }

  var params = new URLSearchParams(location.search);
  var mix = readMix();
  var mixNames = mix.map(function (m) { return m.name; });
  var arriveFromStyle = params.get('van') === 'stijl' && mixNames.length > 0;

  // ---------- State ----------
  var state = {
    q: '',
    f: fuslEmptyFilters(),
    searched: false,
    aiKeys: [],
    released: false,
    open: null,
    sort: 'relevantie',
    pcError: ''
  };
  if (arriveFromStyle) state.f.styles = mixNames.slice();

  function mixActive() {
    var s = state.f.styles;
    return mixNames.length > 0 && s.length === mixNames.length && mixNames.every(function (n) { return s.indexOf(n) >= 0; });
  }

  // ---------- Afstand ----------
  function storeFor(p) {
    for (var i = 0; i < STORES.length; i++) {
      var s = STORES[i];
      if ((p.storeId && s.id === p.storeId) || s.naam === p.store) return s;
    }
    return null;
  }
  var kmCache = {};
  function kmOf(p) {
    if (!location_) return null;
    var key = p.id;
    if (key in kmCache) return kmCache[key];
    var s = storeFor(p);
    var km = null;
    if (s && s.vestigingen && s.vestigingen.length) {
      km = Math.min.apply(null, s.vestigingen.map(function (v) { return fuslKmBetween(location_, v); }));
      km = Math.max(1, Math.round(km));
    }
    kmCache[key] = km;
    return km;
  }
  function resetKm() { kmCache = {}; }

  // ---------- Zoeken ----------
  var runSeq = 0;
  function run(text) {
    var seq = ++runSeq;
    var btn = document.querySelector('.zk-submit');
    if (text.trim()) {
      btn.disabled = true; btn.textContent = 'Capy zoekt…';
      document.getElementById('zk-note').hidden = false;
      document.getElementById('zk-note-text').textContent = 'Capy leest je zoekopdracht…';
    }
    var done = function (r) {
      btn.disabled = false; btn.textContent = 'Zoeken';
      if (seq === runSeq) apply(text, r.parsed);
    };
    if (!text.trim()) { done({ parsed: {} }); return; }
    fuslSmartParse(text).then(done);
  }

  function apply(text, parsed) {
    var f = Object.assign({}, state.f);
    var keys = [];
    ['cats', 'colors', 'styles', 'shop'].forEach(function (k) { if (parsed[k] !== undefined) { f[k] = parsed[k]; keys.push(k); } });
    if (parsed.min !== undefined || parsed.max !== undefined) {
      f.min = parsed.min == null ? null : parsed.min;
      f.max = parsed.max == null ? null : parsed.max;
      keys.push('prijs');
    }
    // Concrete zoekopdracht zonder stijlwoord: stijlmix even loslaten, zodat je genoeg ziet.
    var released = false;
    if (mixActive() && parsed.styles === undefined && keys.length) { f.styles = []; released = true; }
    state.q = text;
    state.f = f;
    state.searched = true;
    state.aiKeys = keys;
    state.released = released;
    state.open = null;
    render();
  }

  function setFilters(patch) {
    state.f = Object.assign({}, state.f, patch);
    state.aiKeys = [];
    state.released = false;
    render();
  }

  function toggleIn(key, val) {
    var arr = state.f[key].slice();
    var i = arr.indexOf(val);
    if (i >= 0) arr.splice(i, 1); else arr.push(val);
    var p = {}; p[key] = arr;
    setFilters(p);
  }

  function clearAll() {
    state.f = fuslEmptyFilters();
    state.q = '';
    state.searched = false;
    state.aiKeys = [];
    state.released = false;
    state.open = null;
    document.getElementById('zk-input').value = '';
    render();
  }

  // ---------- Filterdefinities ----------
  function priceLabel(f) {
    if (f.min == null && f.max == null) return '';
    var preset = FUSL_PRICES.filter(function (p) { return p[0] === f.min && p[1] === f.max; })[0];
    if (preset) return preset[2];
    if (f.min != null && f.max != null) return fuslEuro(f.min) + ' – ' + fuslEuro(f.max);
    return f.max != null ? 'Tot ' + fuslEuro(f.max) : 'Vanaf ' + fuslEuro(f.min);
  }
  function summary(arr, labelOf, word) {
    return arr.length === 0 ? '' : (arr.length === 1 ? labelOf(arr[0]) : arr.length + ' ' + word);
  }

  function filterDefs() {
    var f = state.f;
    var colorNames = FUSL_COLORS.map(function (c) { return c.name; });
    var priceOpts = FUSL_PRICES.map(function (p) {
      return { label: p[2], on: p[0] === f.min && p[1] === f.max, round: true, pick: function () { setFilters({ min: p[0], max: p[1] }); } };
    });
    var custom = priceLabel(f) && !FUSL_PRICES.some(function (p) { return p[0] === f.min && p[1] === f.max; });
    if (custom) priceOpts.splice(1, 0, { label: priceLabel(f) + ' (uit je zoekopdracht)', on: true, round: true, pick: function () {} });

    return [
      { key: 'soort', name: 'Meubelsoort', value: summary(f.cats, function (c) { return CAT_LABEL[c]; }, 'soorten'),
        options: FUSL_CATS.map(function (c) { return { label: c[1], on: f.cats.indexOf(c[0]) >= 0, pick: function () { toggleIn('cats', c[0]); } }; }),
        clear: function () { setFilters({ cats: [] }); } },
      { key: 'stijl', name: 'Stijl', value: summary(f.styles, function (s) { return s; }, 'stijlen'),
        options: FUSL_STYLES.map(function (s) { return { label: s, on: f.styles.indexOf(s) >= 0, pick: function () { toggleIn('styles', s); } }; }),
        clear: function () { setFilters({ styles: [] }); } },
      { key: 'kleur', name: 'Kleur', value: summary(f.colors, function (c) { return FUSL_COLOR_LABEL[c] || c; }, 'kleuren'),
        options: colorNames.map(function (c) { return { label: FUSL_COLOR_LABEL[c] || c, on: f.colors.indexOf(c) >= 0, color: COLOR_HEX[c], pick: function () { toggleIn('colors', c); } }; }),
        clear: function () { setFilters({ colors: [] }); } },
      { key: 'prijs', name: 'Prijs', value: priceLabel(f), options: priceOpts,
        clear: function () { setFilters({ min: null, max: null }); } },
      { key: 'afstand', name: 'Afstand', value: f.maxKm ? 'binnen ' + f.maxKm + ' km' : '', postcode: true,
        options: [[null, 'Elke afstand'], [10, 'Binnen 10 km'], [25, 'Binnen 25 km'], [50, 'Binnen 50 km']].map(function (o) {
          return { label: o[1], on: f.maxKm === o[0], round: true, pick: function () {
            if (o[0] && !location_) { state.pcError = 'Vul eerst je postcode in, bijvoorbeeld 1234 AB.'; render(); var el = document.getElementById('zk-postcode'); if (el) el.focus(); return; }
            setFilters({ maxKm: o[0] });
          } };
        }),
        clear: function () { setFilters({ maxKm: null }); } },
      { key: 'winkel', name: 'Soort winkel', value: f.shop === 'lokaal' ? 'Zelfstandig' : (f.shop === 'keten' ? 'Ketens' : ''),
        options: [[null, 'Alle winkels'], ['lokaal', 'Zelfstandige winkels'], ['keten', 'Ketens']].map(function (o) {
          return { label: o[1], on: f.shop === o[0], round: true, pick: function () { setFilters({ shop: o[0] }); } };
        }),
        clear: function () { setFilters({ shop: null }); } }
    ];
  }

  // ---------- Render: filterbalk ----------
  var currentDefs = [];

  function renderFilters() {
    currentDefs = filterDefs();
    var html = currentDefs.map(function (d, di) {
      var active = !!d.value;
      var open = state.open === d.key;
      var panel = '';
      if (open) {
        var pc = '';
        if (d.postcode) {
          var help = state.pcError
            ? '<span class="zk-pc-help zk-pc-error" role="alert">' + esc(state.pcError) + '</span>'
            : (location_
              ? '<span class="zk-pc-help">' + esc(location_.postcode + (location_.plaats ? ', ' + location_.plaats : '')) + ' · <button type="button" class="zk-link-btn zk-small" data-pc-forget>vergeet</button></span>'
              : '<span class="zk-pc-help">Alleen nodig om afstanden te berekenen. We bewaren hem alleen in je browser.</span>');
          pc = '<form class="zk-pc" data-pc-form>' +
            '<label for="zk-postcode">Jouw postcode</label>' +
            '<div class="zk-pc-row"><input id="zk-postcode" type="text" inputmode="text" autocomplete="postal-code" placeholder="1234 AB" value="' + esc(location_ ? location_.postcode : '') + '">' +
            '<button type="submit" class="zk-pc-go">OK</button></div>' + help + '</form>';
        }
        var opts = d.options.map(function (o, oi) {
          var box = o.color
            ? '<span class="zk-box zk-box-color' + (o.on ? ' on' : '') + '" style="background:' + esc(o.color) + '"></span>'
            : '<span class="zk-box' + (o.round ? ' round' : '') + (o.on ? ' on' : '') + '"></span>';
          return '<button type="button" class="zk-opt" aria-pressed="' + (o.on ? 'true' : 'false') + '" data-def="' + di + '" data-opt="' + oi + '">' + box + esc(o.label) + '</button>';
        }).join('');
        panel = '<div class="zk-panel" role="group" aria-label="' + esc(d.name) + '">' + pc + '<div class="zk-opts">' + opts + '</div>' +
          '<div class="zk-panel-foot"><button type="button" class="zk-link-btn" data-clear-def="' + di + '">Wissen</button>' +
          '<button type="button" class="zk-done" data-close>Klaar</button></div></div>';
      }
      return '<div class="zk-filter">' +
        '<button type="button" class="zk-filter-btn' + (active ? ' active' : '') + '" aria-expanded="' + (open ? 'true' : 'false') + '" data-toggle="' + d.key + '">' +
        esc(active ? d.name + ': ' + d.value : d.name) + CHEVRON + '</button>' + panel + '</div>';
    }).join('');
    document.getElementById('zk-filter-list').innerHTML = html;

    var mixBtn = document.getElementById('zk-mix');
    var hasMix = mixNames.length > 0;
    mixBtn.hidden = !hasMix;
    document.getElementById('zk-mix-sep').hidden = !hasMix;
    if (hasMix) {
      var on = mixActive();
      mixBtn.setAttribute('aria-checked', on ? 'true' : 'false');
      mixBtn.classList.toggle('on', on);
      document.getElementById('zk-mix-title').textContent = mixNames.length > 1
        ? mixNames.slice(0, -1).join(', ') + ' & ' + mixNames[mixNames.length - 1]
        : mixNames[0];
    }
    document.getElementById('zk-clear-all').hidden = !fuslHasFilters(state.f);

    var names = { cats: 'meubelsoort', colors: 'kleur', styles: 'stijl', shop: 'soort winkel', prijs: 'prijs' };
    var note = '';
    if (state.aiKeys.length) {
      note = 'Capy heeft op basis van je zoekopdracht deze filters ingesteld: ' + state.aiKeys.map(function (k) { return names[k]; }).join(', ') + '.' +
        (state.released ? ' Jouw stijl staat hiervoor even uit, zodat je meer ziet.' : '') + ' Pas ze gerust aan.';
    }
    document.getElementById('zk-note').hidden = !note;
    document.getElementById('zk-note-text').textContent = note;
  }

  // ---------- Render: resultaten ----------
  function order(a, b) {
    if (state.sort === 'prijs-op') return a.price - b.price;
    if (state.sort === 'prijs-af') return b.price - a.price;
    if (state.sort === 'nieuw') {
      var ta = a.addedAt ? Date.parse(a.addedAt) : 0, tb = b.addedAt ? Date.parse(b.addedAt) : 0;
      if (ta !== tb) return tb - ta;
      return (a.order || 0) - (b.order || 0);
    }
    if (state.sort === 'afstand') return (kmOf(a) == null ? 9999 : kmOf(a)) - (kmOf(b) == null ? 9999 : kmOf(b));
    // Relevantie: stukken die het best bij je stijlmix passen eerst.
    var pa = mixPct(a), pb = mixPct(b);
    return pb - pa;
  }
  function mixPct(p) {
    for (var i = 0; i < mix.length; i++) if (mix[i].name === p.style) return mix[i].pct || 1;
    return 0;
  }

  function cardHtml(p, diffs) {
    var saved = fuslIsFavorite(p.id);
    var km = kmOf(p);
    var ink = (p.color === 'Wit' || p.color === 'Beige') ? '#3a2c20' : '#ffffff';
    var media = p.imageUrl
      ? '<img class="zk-photo" src="' + esc(p.imageUrl) + '" alt="" loading="lazy" onerror="this.remove()">'
      : '';
    var icon = '<svg aria-hidden="true" width="84" height="84" viewBox="0 0 24 24" fill="none" stroke="' + ink + '" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">' + (CAT_ICON[p.category] || CAT_ICON.kast) + '</svg>';
    var cta;
    if (p.productUrl) {
      cta = '<a class="zk-cta" href="/naar/' + encodeURIComponent(p.id) + '" target="_blank" rel="noopener sponsored nofollow" data-click="' + esc(p.id) + '">Bekijk bij ' + esc(p.store) + ' →</a>';
    } else {
      cta = '<span class="zk-cta zk-cta-off" title="Voorbeeldstuk: nog niet gekoppeld aan een winkel">Bekijk bij ' + esc(p.store) + ' →</span>';
    }
    return '<article class="zk-card">' +
      '<div class="zk-media" style="background:' + esc(COLOR_HEX[p.color] || '#e3ddc9') + '">' + icon + media +
        '<span class="zk-label' + (p.status === 'Laatste exemplaar' ? ' dark' : '') + '">' + esc(p.status) + '</span>' +
        '<button type="button" class="zk-heart" data-fav="' + esc(p.id) + '" aria-pressed="' + (saved ? 'true' : 'false') + '" aria-label="Bewaar ' + esc(p.name) + ' in mijn selectie">' + HEART.replace('FILL', saved ? 'currentColor' : 'none') + '</button>' +
      '</div>' +
      '<div class="zk-body">' +
        '<h3 class="zk-name">' + esc(p.name) + '</h3>' +
        '<span class="zk-meta">' + esc(p.store) + ' · ' + (p.type === 'keten' ? 'Keten' : 'Zelfstandige winkel') + (km != null ? ' · ' + km + ' km' : '') + '</span>' +
        '<span class="zk-meta zk-small">' + esc([p.style, p.color].filter(Boolean).join(' · ')) + '</span>' +
        (p.condition ? '<span class="zk-meta zk-small">' + esc(p.condition) + '</span>' : '') +
        '<span class="zk-price">' + fuslEuro(p.price) + '</span>' +
        (diffs && diffs.length ? '<span class="zk-diff">' + esc(diffs.join(' · ')) + '</span>' : '') +
        '<span class="zk-grow"></span>' + cta +
      '</div></article>';
  }

  function renderResults() {
    var f = state.f;
    var grid = document.getElementById('zk-grid');
    var title = document.getElementById('zk-title');
    var any = fuslHasFilters(f);
    var noExact = false;
    var list;

    var exact = PRODUCTS.filter(function (p) { return fuslFits(p, f, kmOf); });
    if (exact.length || !any) {
      list = exact.slice().sort(order);
    } else {
      noExact = true;
      list = PRODUCTS.map(function (p) { return { p: p, s: fuslScore(p, f, kmOf) }; })
        .filter(function (x) { return x.s > 0; })
        .sort(function (a, b) { return b.s - a.s; })
        .slice(0, 4).map(function (x) { return x.p; });
    }

    var otherFilters = f.cats.length || f.colors.length || f.min != null || f.max != null || f.shop || f.maxKm;
    if (noExact) title.textContent = 'Dit komt het dichtst in de buurt';
    else if (arriveFromStyle && mixActive() && !state.searched && !otherFilters) title.textContent = 'Dit past bij jouw stijl · ' + list.length + ' stukken';
    else if (!any) title.textContent = 'Alle stukken · ' + list.length;
    else title.textContent = list.length === 1 ? '1 stuk' : list.length + ' stukken';

    document.getElementById('zk-noexact').hidden = !noExact || !list.length;
    document.getElementById('zk-nounderstand').hidden = !(state.searched && state.q.trim() && !state.aiKeys.length);

    grid.innerHTML = list.length
      ? list.map(function (p) { return cardHtml(p, noExact ? fuslDiffs(p, f, kmOf) : null); }).join('')
      : '<div class="zk-empty">Niets gevonden dat in de buurt komt. <button type="button" class="zk-link-btn" data-clear-all>Wis alle filters</button></div>';

    var count = fuslGetFavorites().filter(function (id) { return PRODUCTS.some(function (p) { return String(p.id) === id; }); }).length;
    document.getElementById('zk-savedbar').hidden = count === 0;
    document.getElementById('zk-saved-count').textContent = count;
  }

  function render() {
    renderFilters();
    var sortSel = document.getElementById('zk-sort');
    sortSel.querySelector('option[value="afstand"]').hidden = !location_;
    if (!location_ && state.sort === 'afstand') state.sort = 'relevantie';
    sortSel.value = state.sort;
    renderResults();
  }

  // ---------- Events ----------
  var input = document.getElementById('zk-input');
  document.getElementById('zk-form').addEventListener('submit', function (e) {
    e.preventDefault();
    run(input.value);
  });
  document.querySelectorAll('[data-example]').forEach(function (b) {
    b.addEventListener('click', function () { input.value = b.textContent; run(b.textContent); });
  });

  document.getElementById('zk-mix').addEventListener('click', function () {
    state.f = Object.assign({}, state.f, { styles: mixActive() ? [] : mixNames.slice() });
    state.released = false;
    state.aiKeys = [];
    render();
  });
  document.getElementById('zk-clear-all').addEventListener('click', clearAll);
  document.getElementById('zk-sort').addEventListener('change', function (e) { state.sort = e.target.value; render(); });
  var filterbar = document.getElementById('zk-filterbar');
  filterbar.addEventListener('click', function (e) {
    var t = e.target.closest('button');
    if (!t) return;
    if (t.hasAttribute('data-toggle')) {
      var key = t.getAttribute('data-toggle');
      state.open = state.open === key ? null : key;
      state.pcError = '';
      render();
      var first = document.querySelector('.zk-panel input, .zk-panel .zk-opt');
      if (first && state.open) first.focus();
    } else if (t.hasAttribute('data-opt')) {
      var d = currentDefs[+t.getAttribute('data-def')];
      d.options[+t.getAttribute('data-opt')].pick();
      var again = document.querySelector('.zk-opt[data-def="' + t.getAttribute('data-def') + '"][data-opt="' + t.getAttribute('data-opt') + '"]');
      if (again) again.focus();
    } else if (t.hasAttribute('data-clear-def')) {
      currentDefs[+t.getAttribute('data-clear-def')].clear();
    } else if (t.hasAttribute('data-close')) {
      closeMenus(true);
    } else if (t.hasAttribute('data-pc-forget')) {
      location_ = null; fuslSaveLocation(null); resetKm();
      setFilters({ maxKm: null });
    }
  });
  filterbar.addEventListener('submit', function (e) {
    if (!e.target.hasAttribute('data-pc-form')) return;
    e.preventDefault();
    var val = document.getElementById('zk-postcode').value;
    if (!fuslNormalizePostcode(val)) { state.pcError = 'Dit lijkt geen postcode. Probeer bijvoorbeeld 1234 AB.'; render(); return; }
    state.pcError = 'Even zoeken…';
    render();
    fuslGeocodePostcode(val).then(function (loc) {
      location_ = loc; fuslSaveLocation(loc); resetKm();
      state.pcError = '';
      if (!state.f.maxKm) state.f = Object.assign({}, state.f, { maxKm: 25 });
      render();
    }).catch(function () {
      state.pcError = 'We konden deze postcode niet vinden. Controleer hem of probeer het later nog eens.';
      render();
    });
  });

  function closeMenus(focusButton) {
    var key = state.open;
    if (!key) return;
    state.open = null;
    render();
    if (focusButton) { var b = document.querySelector('[data-toggle="' + key + '"]'); if (b) b.focus(); }
  }
  document.addEventListener('click', function (e) {
    if (state.open && !e.target.closest('.zk-filter')) closeMenus(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && state.open) closeMenus(true);
  });

  document.addEventListener('click', function (e) {
    var c = e.target.closest('[data-clear-all]');
    if (c) clearAll();
  });

  document.getElementById('zk-grid').addEventListener('click', function (e) {
    var heart = e.target.closest('[data-fav]');
    if (heart) {
      var id = heart.getAttribute('data-fav');
      fuslToggleFavorite(id, PRODUCTS.filter(function (x) { return String(x.id) === id; })[0]);
      render();
      var again = document.querySelector('[data-fav="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
      if (again) again.focus();
      return;
    }
    var link = e.target.closest('[data-click]');
    if (link && typeof fuslTrackStoreClick === 'function') {
      var p = PRODUCTS.filter(function (x) { return String(x.id) === link.getAttribute('data-click'); })[0];
      if (p) fuslTrackStoreClick({ winkelNaam: p.store, winkelType: p.type, categorie: p.category, productNaam: p.name });
    }
  });

  // Zoekopdracht via de link (?q=...), bijv. vanaf de homepage
  if (params.get('q')) { input.value = params.get('q'); run(params.get('q')); }
  render();

  fuslLoadStores(function (stores) { STORES = stores; resetKm(); render(); });
  fuslLoadLiveListings(function (live) {
    live = live.map(prep);
    var key = function (p) { return (p.name + '|' + p.store).toLowerCase(); };
    var liveKeys = live.map(key);
    PRODUCTS = live.concat(SAMPLE_PRODUCTS.map(prep).filter(function (p) { return liveKeys.indexOf(key(p)) < 0; }));
    resetKm();
    render();
  });
})();
