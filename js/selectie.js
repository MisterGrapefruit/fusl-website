// Mijn selectie (selectie.html): bewaarde stukken per kamer of per winkel,
// beschikbaarheid, vergelijken en delen met duimpjes.
(function () {
  var U = FUSL_UI, esc = U.esc;
  var main = document.getElementById('sl-main');
  var DEEL_KEY = 'fusl_deel';           // { id, sleutel, naam, sync }
  var GEZIEN_KEY = 'fusl_reacties_gezien';

  var PRODUCTS = SAMPLE_PRODUCTS.map(function (p) { p.style = fuslCanonStyle(p.style); return p; });
  var liveLoaded = false;
  var location_ = fuslGetLocation();
  var STORES = [];

  var ui = {
    group: U.store('fusl_selectie_groep') || 'kamer',
    compare: [],
    comparing: false,
    shareOpen: false,
    tab: 'deel',
    approvedOnly: false,
    copied: '',
    busy: false,
    error: ''
  };
  var deel = U.store(DEEL_KEY);
  var reacties = [];
  var gezien = U.store(GEZIEN_KEY) || {};

  // ---------- Data ----------
  function current(id) {
    for (var i = 0; i < PRODUCTS.length; i++) if (String(PRODUCTS[i].id) === id) return PRODUCTS[i];
    return null;
  }

  // Elk bewaard stuk + status ten opzichte van het moment van bewaren.
  function items() {
    var info = fuslGetFavoriteInfo();
    var changed = false;
    var list = fuslGetFavorites().map(function (id) {
      var snap = info[id];
      var now = current(id);
      if (!snap && now) { snap = info[id] = fuslFavoriteSnapshot(now); changed = true; }
      if (!snap) return null;
      var p = Object.assign({}, snap, now || {});
      p.id = id;
      p.savedPrice = snap.price;
      if (!now) {
        // Echt stuk dat uit het aanbod is: verkocht. Zolang het aanbod nog
        // laadt, tonen we het gewoon als beschikbaar.
        // Voorbeeldstukken (niet live) blijven gewoon zichtbaar.
        if (snap.live) p.state = liveLoaded ? 'Verkocht' : 'Beschikbaar';
        else p.state = snap.status === 'Laatste exemplaar' ? 'Laatste exemplaar' : 'Beschikbaar';
      } else if (typeof snap.price === 'number' && now.price !== snap.price) {
        p.state = 'Prijs gewijzigd';
      } else {
        p.state = now.status === 'Laatste exemplaar' ? 'Laatste exemplaar' : 'Beschikbaar';
      }
      p.link = !!(now ? now.productUrl : snap.link);
      return p;
    }).filter(Boolean);
    if (changed) fuslSaveFavoriteInfo(info);
    return list;
  }

  function kmOf(p) {
    if (!location_) return null;
    var s = null;
    STORES.forEach(function (x) { if ((p.storeId && x.id === p.storeId) || x.naam === p.store) s = x; });
    if (!s || !s.vestigingen) return null;
    return Math.max(1, Math.round(Math.min.apply(null, s.vestigingen.map(function (v) { return fuslKmBetween(location_, v); }))));
  }

  // ---------- Reacties ----------
  function votesFor(id) {
    var up = [], down = [];
    reacties.forEach(function (r) {
      if (r.oordelen[id] === 'op') up.push(r.voornaam);
      if (r.oordelen[id] === 'neer') down.push(r.voornaam);
    });
    return { up: up, down: down };
  }

  function api(method, path, body) {
    var headers = { 'Content-Type': 'application/json' };
    if (deel && deel.sleutel) headers['X-Eigenaar'] = deel.sleutel;
    return fetch('/api/selectie' + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok) { var e = new Error(data.fout || ('HTTP ' + res.status)); e.status = res.status; throw e; }
          return data;
        });
      });
  }

  function shareItems() {
    return items().filter(function (p) { return p.state !== 'Verkocht'; }).map(function (p) {
      return { id: p.id, name: p.name, store: p.store, storeId: p.storeId, type: p.type, category: p.category, color: p.color, style: p.style, price: p.price, status: p.status, live: !!p.live, link: !!p.link };
    });
  }
  function signature() { return JSON.stringify(shareItems().map(function (p) { return [p.id, p.price]; })) + '|' + (deel ? deel.naam : ''); }

  function syncShare() {
    if (!deel) return;
    var sig = signature();
    if (deel.sync === sig) return;
    api('PUT', '/' + deel.id, { stukken: shareItems(), naam: deel.naam || '' })
      .then(function () { deel.sync = sig; U.store(DEEL_KEY, deel); })
      .catch(function (e) { if (e.status === 404 || e.status === 403) dropShare(); });
  }
  function loadReactions() {
    if (!deel) return;
    api('GET', '/' + deel.id + '/reacties').then(function (data) {
      reacties = data.reacties || [];
      render();
    }).catch(function (e) { if (e.status === 404 || e.status === 403) { dropShare(); render(); } });
  }
  function dropShare() { deel = null; reacties = []; U.store(DEEL_KEY, null); }

  function shareUrl() { return deel ? location.origin + '/gedeeld.html?s=' + deel.id : ''; }
  function inviteUrl() { return location.origin + '/?via=uitnodiging'; }
  var INVITE_TEXT = 'Ik stel mijn meubelselectie samen op FUSL: showroommodellen en laatste exemplaren van woonwinkels. Ontdek je stijl en maak je eigen selectie!';

  // ---------- Render ----------
  function render() {
    var list = items();
    if (!list.length) { main.innerHTML = emptyHtml(); return; }
    if (ui.comparing) { main.innerHTML = compareHtml(list); return; }
    ui.compare = ui.compare.filter(function (id) { return list.some(function (p) { return p.id === id && p.state !== 'Verkocht'; }); });

    var shown = ui.approvedOnly ? list.filter(function (p) { return votesFor(p.id).up.length > 0; }) : list;
    var groups = {};
    var order = [];
    shown.forEach(function (p) {
      var key = ui.group === 'winkel' ? p.store : U.roomOf(p);
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(p);
    });
    if (ui.group === 'kamer') order.sort(function (a, b) { return U.ROOMS.indexOf(a) - U.ROOMS.indexOf(b); });
    else order.sort();

    var total = list.filter(function (p) { return p.state !== 'Verkocht'; }).reduce(function (s, p) { return s + (p.price || 0); }, 0);
    var n = ui.compare.length;
    var html = '';
    html += '<div class="sl-toolbar">' +
      '<div class="sl-seg" role="group" aria-label="Orden mijn selectie">' +
        '<button type="button" data-act="groep" data-v="kamer" aria-pressed="' + (ui.group === 'kamer') + '">Per kamer</button>' +
        '<button type="button" data-act="groep" data-v="winkel" aria-pressed="' + (ui.group === 'winkel') + '">Per winkel</button>' +
      '</div>' +
      '<div class="sl-tools">' +
        '<span class="sl-hint">' + (n >= 2 ? '' : (n === 1 ? 'Kies nog 1 of 2 stukken om te vergelijken.' : 'Vink 2 of 3 stukken aan om ze te vergelijken.')) + '</span>' +
        (n >= 2 ? '<button type="button" class="btn btn-green sl-small" data-act="vergelijk">Vergelijk ' + n + ' stukken →</button>' : '') +
        '<a href="aanbod.html" class="text-link">+ Voeg meer toe</a>' +
        '<button type="button" class="sl-share-btn" data-act="deel-open" aria-expanded="' + ui.shareOpen + '"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>Deel mijn selectie</button>' +
      '</div></div>';
    html += '<p class="sl-total">' + list.length + (list.length === 1 ? ' stuk' : ' stukken') + ' · samen ' + fuslEuro(total) + (list.some(function (p) { return p.state === 'Verkocht'; }) ? ' (zonder verkochte stukken)' : '') + '</p>';
    if (ui.shareOpen) html += shareHtml();
    html += reactionsHtml();

    if (!shown.length) html += '<div class="zk-empty">Nog geen stukken met een duim omhoog. <button type="button" class="zk-link-btn" data-act="goedgekeurd">Toon alles</button></div>';
    order.forEach(function (key) {
      var g = groups[key];
      var avail = g.filter(function (p) { return p.state !== 'Verkocht'; });
      var sub = avail.reduce(function (s, p) { return s + (p.price || 0); }, 0);
      var meta = ui.group === 'winkel'
        ? (g[0].type === 'keten' ? 'Keten' : 'Zelfstandige winkel') + (kmOf(g[0]) != null ? ' · ' + kmOf(g[0]) + ' km' : '')
        : g.length + (g.length === 1 ? ' stuk' : ' stukken');
      html += '<section class="sl-group"><div class="sl-group-head"><div><h2>' + esc(key) + '</h2><span>' + esc(meta) + '</span></div>' +
        '<span class="sl-sub">' + fuslEuro(sub) + '</span></div><div class="sl-grid">' + g.map(itemHtml).join('') + '</div></section>';
    });
    html += '<p class="sl-foot"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg>' +
      '<span>Je koopt rechtstreeks bij de winkel. Je selectie staat alleen in deze browser; de beschikbaarheid wordt bijgewerkt zodra een winkel een stuk verkoopt.</span></p>';
    main.innerHTML = html;
  }

  var STATE_CLASS = { 'Beschikbaar': 'ok', 'Laatste exemplaar': 'last', 'Prijs gewijzigd': 'price', 'Verkocht': 'sold' };

  function itemHtml(p) {
    var sold = p.state === 'Verkocht';
    var v = votesFor(p.id);
    var picked = ui.compare.indexOf(p.id) >= 0;
    var reaction = '';
    if (v.up.length || v.down.length) {
      reaction = '<span class="sl-reaction">' + U.THUMB +
        [v.up.length ? esc(v.up.join(', ')) + ': mooi' : '', v.down.length ? esc(v.down.join(', ')) + ': liever niet' : ''].filter(Boolean).join(' · ') + '</span>';
    }
    var km = kmOf(p);
    return '<article class="sl-item' + (sold ? ' sold' : '') + '">' +
      '<div class="sl-media" style="background:' + esc(U.bg(p)) + '">' + U.media(p) +
        '<span class="sl-state ' + STATE_CLASS[p.state] + '">' + esc(p.state) + '</span>' +
        '<button type="button" class="zk-heart" data-act="weg" data-id="' + esc(p.id) + '" aria-label="Haal ' + esc(p.name) + ' uit mijn selectie"><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg></button>' +
      '</div><div class="sl-body">' +
        '<h3>' + esc(p.name) + '</h3>' +
        '<span class="sl-meta">' + esc(ui.group === 'winkel' ? [p.style, p.color].filter(Boolean).join(' · ') : p.store + (km != null ? ' · ' + km + ' km' : '')) + '</span>' +
        reaction +
        '<span class="sl-price">' + (p.price != null ? fuslEuro(p.price) : '') +
          (p.state === 'Prijs gewijzigd' && typeof p.savedPrice === 'number' ? ' <span class="sl-was">was ' + fuslEuro(p.savedPrice) + '</span>' : '') + '</span>' +
        '<span class="zk-grow"></span>' +
        (sold
          ? '<a class="text-link" href="aanbod.html?q=' + encodeURIComponent((p.style || '') + ' ' + (p.category || '')) + '">Bekijk vergelijkbare stukken →</a>'
          : '<div class="sl-actions">' +
              (p.link ? '<a class="zk-cta" href="/naar/' + encodeURIComponent(p.id) + '" target="_blank" rel="noopener sponsored nofollow" data-click="' + esc(p.id) + '">Bekijk bij ' + esc(p.store) + ' →</a>'
                      : '<span class="zk-cta zk-cta-off" title="Voorbeeldstuk: nog niet gekoppeld aan een winkel">Bekijk bij ' + esc(p.store) + ' →</span>') +
              '<button type="button" class="sl-pick" data-act="kies" data-id="' + esc(p.id) + '" aria-pressed="' + picked + '"' + (!picked && ui.compare.length >= 3 ? ' disabled' : '') + '><span class="zk-box' + (picked ? ' on' : '') + '"></span>Vergelijk</button>' +
            '</div>') +
      '</div></article>';
  }

  function reactionsHtml() {
    if (!deel || !reacties.length) return '';
    var html = '';
    reacties.forEach(function (r) {
      var keys = Object.keys(r.oordelen);
      if (!keys.length) return;
      var key = r.voornaam.toLowerCase();
      if (gezien[key] && gezien[key] >= r.bijgewerkt) return;
      var up = keys.filter(function (k) { return r.oordelen[k] === 'op'; }).length;
      html += '<div class="sl-notice"><span class="sl-avatar" aria-hidden="true">' + esc(r.voornaam.charAt(0).toUpperCase()) + '</span>' +
        '<span><strong>' + esc(r.voornaam) + '</strong> heeft op ' + keys.length + (keys.length === 1 ? ' stuk' : ' stukken') + ' gereageerd: ' + up + ' omhoog, ' + (keys.length - up) + ' omlaag.</span>' +
        '<button type="button" class="sl-x" data-act="gezien" data-v="' + esc(key) + '" data-t="' + r.bijgewerkt + '" aria-label="Melding van ' + esc(r.voornaam) + ' sluiten">×</button></div>';
    });
    html += '<div class="sl-approved"><button type="button" class="sl-toggle" data-act="goedgekeurd" aria-pressed="' + ui.approvedOnly + '"><span class="zk-switch" aria-hidden="true"><span></span></span>Alleen stukken met een duim omhoog</button></div>';
    return html;
  }

  function shareHtml() {
    var tabs = '<div class="sl-panel-head"><div class="sl-tabs" role="tablist" aria-label="Delen">' +
      '<button type="button" role="tab" data-act="tab" data-v="deel" aria-selected="' + (ui.tab === 'deel') + '">Deel je selectie</button>' +
      '<button type="button" role="tab" data-act="tab" data-v="uitnodigen" aria-selected="' + (ui.tab === 'uitnodigen') + '">Nodig iemand uit</button></div>' +
      '<button type="button" class="sl-x" data-act="deel-open" aria-label="Sluiten">×</button></div>';
    var body;
    if (ui.tab === 'uitnodigen') {
      var url = inviteUrl();
      body = '<div class="sl-panel-intro"><strong>Nodig iemand uit om een eigen selectie te maken</strong><span>Ook aan het inrichten? Stuur een vriend, partner of huisgenoot een uitnodiging voor FUSL.</span></div>' +
        '<div class="sl-quote"><img src="images/capy-face.png" alt=""><span>"' + esc(INVITE_TEXT) + '"</span></div>' +
        linkRow('Uitnodigingslink', 'sl-invite-link', url, 'uitnodiging') +
        '<div class="sl-via"><a href="https://wa.me/?text=' + encodeURIComponent(INVITE_TEXT + ' ' + url) + '" target="_blank" rel="noopener">Via WhatsApp</a>' +
        '<a href="mailto:?subject=' + encodeURIComponent('Maak ook je eigen meubelselectie') + '&body=' + encodeURIComponent(INVITE_TEXT + '\n\n' + url) + '">Via e-mail</a></div>';
    } else if (!deel) {
      body = '<div class="sl-panel-intro"><strong>Laat anderen meekijken</strong><span>Wie de link heeft, ziet je selectie en kan per stuk een duim omhoog of omlaag geven. Handig om samen te beslissen.</span></div>' +
        '<div class="sl-field"><label for="sl-naam">Naam bij je selectie (optioneel)</label><input id="sl-naam" type="text" maxlength="40" placeholder="Bijv. Martijn" autocomplete="given-name"></div>' +
        '<button type="button" class="btn btn-green" data-act="maak-link"' + (ui.busy ? ' disabled' : '') + '>' + (ui.busy ? 'Even geduld…' : 'Maak een deellink') + '</button>' +
        (ui.error ? '<p class="sl-error" role="alert">' + esc(ui.error) + '</p>' : '') +
        privacyLine();
    } else {
      var su = shareUrl();
      var msg = (deel.naam ? deel.naam + ' deelt' : 'Ik deel') + ' een meubelselectie met je op FUSL. Wat vind je ervan?';
      body = '<div class="sl-panel-intro"><strong>Je selectie is gedeeld</strong><span>Wie de link heeft, ziet je selectie en kan duimpjes geven. Wijzig je je selectie, dan ziet de ander dat ook.</span></div>' +
        linkRow('Deellink', 'sl-share-link', su, 'deel') +
        '<div class="sl-via"><a href="https://wa.me/?text=' + encodeURIComponent(msg + ' ' + su) + '" target="_blank" rel="noopener">Via WhatsApp</a>' +
        '<a href="mailto:?subject=' + encodeURIComponent('Mijn meubelselectie') + '&body=' + encodeURIComponent(msg + '\n\n' + su) + '">Via e-mail</a>' +
        '<a href="' + esc(su) + '" target="_blank" rel="noopener">Bekijk zoals de ontvanger het ziet →</a></div>' +
        '<button type="button" class="zk-link-btn" data-act="link-uit"' + (ui.busy ? ' disabled' : '') + '>Link uitzetten</button>' +
        (ui.error ? '<p class="sl-error" role="alert">' + esc(ui.error) + '</p>' : '') +
        privacyLine(true);
    }
    return '<div class="sl-panel" id="sl-panel">' + tabs + '<div class="sl-panel-body">' + body + '</div></div>';
  }
  function linkRow(label, id, url, kind) {
    return '<div class="sl-field"><label for="' + id + '">' + label + '</label><div class="sl-link-row">' +
      '<input id="' + id + '" type="text" readonly value="' + esc(url) + '">' +
      '<button type="button" class="sl-copy" data-act="kopieer" data-v="' + id + '" data-k="' + kind + '">' + (ui.copied === kind ? 'Gekopieerd ✓' : 'Kopieer') + '</button></div></div>';
  }
  function privacyLine(withOff) {
    return '<p class="sl-privacy"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>' +
      'Er worden geen e-mailadressen of andere gegevens van jou gedeeld. ' + (withOff ? 'Zet je de link uit, dan worden ook alle reacties gewist.' : 'Je kunt de link altijd weer uitzetten.') + '</p>';
  }

  function emptyHtml() {
    return '<div class="sl-empty"><h2>Begin je selectie</h2><p>Je hebt nog niets bewaard. Tik op het hartje bij een meubel om het hier te verzamelen.</p>' +
      '<div class="sl-empty-grid">' +
        '<div class="sl-empty-card"><img src="images/capy-face.png" alt=""><div><strong>Nog op zoek naar je stijl?</strong><span>Capy laat je stukken zien die bij jouw smaak passen.</span><a href="stijl.html" class="text-link">Ontdek je stijl →</a></div></div>' +
        '<div class="sl-empty-card"><span class="sl-empty-icon"><svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg></span><div><strong>Weet je al wat je zoekt?</strong><span>Zoek direct in het aanbod van alle aangesloten woonwinkels.</span><a href="aanbod.html" class="text-link">Zoek in het aanbod →</a></div></div>' +
      '</div></div>';
  }

  function compareHtml(list) {
    var cols = ui.compare.map(function (id) { return list.filter(function (p) { return p.id === id; })[0]; }).filter(Boolean);
    var catLabel = {}; FUSL_CATS.forEach(function (c) { catLabel[c[0]] = c[2]; });
    var rows = [
      ['Prijs', function (p) { return fuslEuro(p.price); }],
      ['Soort', function (p) { return catLabel[p.category] || p.category; }],
      ['Stijl', function (p) { return p.style || '–'; }],
      ['Kleur', function (p) { return FUSL_COLOR_LABEL[p.color] || p.color; }],
      ['Staat', function (p) { return p.status; }],
      ['Beschikbaarheid', function (p) { return p.state; }],
      ['Winkel', function (p) { return p.store; }],
      ['Soort winkel', function (p) { return p.type === 'keten' ? 'Keten' : 'Zelfstandige winkel'; }],
      ['Afstand', function (p) { var km = kmOf(p); return km != null ? km + ' km' : (location_ ? 'onbekend' : 'vul je postcode in bij Zoeken'); }]
    ];
    if (deel && reacties.length) rows.push(['Reacties', function (p) { var v = votesFor(p.id); return (v.up.length ? '👍 ' + v.up.join(', ') : '') + (v.up.length && v.down.length ? ' · ' : '') + (v.down.length ? '👎 ' + v.down.join(', ') : '') || '–'; }]);
    return '<button type="button" class="st-back" data-act="terug">← Terug naar mijn selectie</button>' +
      '<h2 class="sl-cmp-title">Vergelijk ' + cols.length + ' stukken</h2>' +
      '<div class="sl-cmp-wrap"><table class="sl-cmp"><thead><tr><td></td>' + cols.map(function (p) {
        return '<th scope="col"><div class="sl-cmp-swatch" style="background:' + esc(U.bg(p)) + '">' + U.media(p, 56) + '</div>' + esc(p.name) + '</th>';
      }).join('') + '</tr></thead><tbody>' + rows.map(function (r) {
        return '<tr><th scope="row">' + r[0] + '</th>' + cols.map(function (p) { return '<td>' + esc(r[1](p)) + '</td>'; }).join('') + '</tr>';
      }).join('') + '<tr><td></td>' + cols.map(function (p) {
        return '<td>' + (p.link ? '<a class="zk-cta" href="/naar/' + encodeURIComponent(p.id) + '" target="_blank" rel="noopener sponsored nofollow" data-click="' + esc(p.id) + '">Bekijk bij ' + esc(p.store) + ' →</a>' : '<span class="zk-cta zk-cta-off">Bekijk bij ' + esc(p.store) + ' →</span>') + '</td>';
      }).join('') + '</tr></tbody></table></div>';
  }

  // ---------- Acties ----------
  function refocus(sel) { var el = main.querySelector(sel); if (el) el.focus(); }

  main.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]');
    if (!t) {
      var link = e.target.closest('[data-click]');
      if (link && typeof fuslTrackStoreClick === 'function') {
        var p = items().filter(function (x) { return x.id === link.getAttribute('data-click'); })[0];
        if (p) fuslTrackStoreClick({ winkelNaam: p.store, winkelType: p.type, categorie: p.category, productNaam: p.name });
      }
      return;
    }
    var act = t.getAttribute('data-act'), v = t.getAttribute('data-v'), id = t.getAttribute('data-id');
    if (act === 'groep') { ui.group = v; U.store('fusl_selectie_groep', v); render(); refocus('[data-act="groep"][data-v="' + v + '"]'); }
    else if (act === 'weg') {
      fuslToggleFavorite(id);
      ui.compare = ui.compare.filter(function (x) { return x !== id; });
      render(); syncShare();
    }
    else if (act === 'kies') {
      var i = ui.compare.indexOf(id);
      if (i >= 0) ui.compare.splice(i, 1); else if (ui.compare.length < 3) ui.compare.push(id);
      render(); refocus('[data-act="kies"][data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
    }
    else if (act === 'vergelijk') { ui.comparing = true; render(); window.scrollTo({ top: 0 }); refocus('.sl-cmp-title'); }
    else if (act === 'terug') { ui.comparing = false; render(); }
    else if (act === 'deel-open') { ui.shareOpen = !ui.shareOpen; ui.error = ''; render(); refocus(ui.shareOpen ? '#sl-panel [role="tab"][aria-selected="true"]' : '[data-act="deel-open"]'); }
    else if (act === 'tab') { ui.tab = v; ui.copied = ''; render(); refocus('[data-act="tab"][data-v="' + v + '"]'); }
    else if (act === 'goedgekeurd') { ui.approvedOnly = !ui.approvedOnly; render(); }
    else if (act === 'gezien') { gezien[v] = +t.getAttribute('data-t'); U.store(GEZIEN_KEY, gezien); render(); }
    else if (act === 'kopieer') {
      var input = document.getElementById(v);
      var done = function () { ui.copied = t.getAttribute('data-k'); render(); setTimeout(function () { ui.copied = ''; render(); }, 2000); };
      if (navigator.clipboard) navigator.clipboard.writeText(input.value).then(done, function () { input.select(); });
      else { input.select(); try { document.execCommand('copy'); done(); } catch (err) {} }
    }
    else if (act === 'maak-link') {
      var naam = (document.getElementById('sl-naam') || {}).value || '';
      ui.busy = true; ui.error = ''; render();
      fetch('/api/selectie', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ naam: naam, stukken: shareItems() }) })
        .then(function (res) { return res.json().then(function (d) { if (!res.ok) throw new Error(d.fout || 'mislukt'); return d; }); })
        .then(function (d) {
          deel = { id: d.id, sleutel: d.sleutel, naam: naam.trim() };
          deel.sync = signature();
          U.store(DEEL_KEY, deel);
        })
        .catch(function (err) { ui.error = 'Het lukte niet om een deellink te maken. ' + (err.message && err.message !== 'Failed to fetch' ? err.message : 'Probeer het later nog eens.'); })
        .then(function () { ui.busy = false; render(); refocus('#sl-share-link'); });
    }
    else if (act === 'link-uit') {
      ui.busy = true; ui.error = ''; render();
      api('DELETE', '/' + deel.id)
        .then(function () { dropShare(); })
        .catch(function (err) { if (err.status === 404) dropShare(); else ui.error = 'Uitzetten lukte niet. Probeer het later nog eens.'; })
        .then(function () { ui.busy = false; render(); });
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && ui.shareOpen) { ui.shareOpen = false; render(); refocus('[data-act="deel-open"]'); }
  });

  // ---------- Start ----------
  render();
  fuslLoadStores(function (s) { STORES = s; render(); });
  fuslLoadLiveListings(function (live) {
    live.forEach(function (p) { p.style = fuslCanonStyle(p.style); });
    var keys = live.map(function (p) { return (p.name + '|' + p.store).toLowerCase(); });
    PRODUCTS = live.concat(PRODUCTS.filter(function (p) { return keys.indexOf((p.name + '|' + p.store).toLowerCase()) < 0; }));
    liveLoaded = true;
    render();
    syncShare();
  });
  loadReactions();
})();
