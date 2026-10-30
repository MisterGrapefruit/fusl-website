// Gedeelde selectie (gedeeld.html?s=<id>): de ontvanger vult een voornaam in
// en geeft per stuk een duim omhoog of omlaag. Er is geen account nodig.
(function () {
  var U = FUSL_UI, esc = U.esc;
  var main = document.getElementById('gd-main');
  var id = new URLSearchParams(location.search).get('s') || '';
  var me = U.store('fusl_reageerder') || {};
  if (!me.id) { me.id = U.id(); U.store('fusl_reageerder', me); }
  var votesKey = 'fusl_oordelen_' + id;
  var votes = U.store(votesKey) || {};
  var data = null;
  var editing = !me.voornaam;
  var status = '';

  function render() {
    if (!data) return;
    var owner = data.naam || 'De maker';
    document.getElementById('gd-title').textContent = data.naam ? 'De selectie van ' + data.naam : 'Gedeelde selectie';
    var up = 0, down = 0;
    Object.keys(votes).forEach(function (k) { if (votes[k] === 'op') up++; if (votes[k] === 'neer') down++; });
    var html = '';
    if (editing) {
      html += '<form class="gd-name" id="gd-name-form"><div class="sl-field"><label for="gd-voornaam">Hoe heet je?</label>' +
        '<span class="sl-meta">Zo weet ' + esc(owner) + ' van wie de reacties komen. Alleen je voornaam, verder niets.</span>' +
        '<input id="gd-voornaam" type="text" maxlength="30" autocomplete="given-name" placeholder="Je voornaam" value="' + esc(me.voornaam || '') + '" required></div>' +
        '<button type="submit" class="btn btn-green">Verder</button></form>';
    } else {
      html += '<div class="gd-who"><span class="sl-avatar" aria-hidden="true">' + esc(me.voornaam.charAt(0).toUpperCase()) + '</span>' +
        '<span>Je reageert als <strong>' + esc(me.voornaam) + '</strong></span><button type="button" class="zk-link-btn" data-act="naam">Wijzig</button></div>';
    }
    html += '<p class="sl-total"><strong>' + data.stukken.length + '</strong> stukken · jouw reactie: <strong>' + up + '</strong> omhoog, <strong>' + down + '</strong> omlaag' +
      '<span class="gd-status" role="status">' + esc(status) + '</span></p>';
    html += '<div class="sl-grid">' + data.stukken.map(function (p) {
      var v = votes[p.id];
      var dis = editing ? ' disabled title="Vul eerst je voornaam in"' : '';
      return '<article class="sl-item' + (p.verkocht ? ' sold' : '') + '">' +
        '<div class="sl-media" style="background:' + esc(U.bg(p)) + '">' + U.media(p) +
          '<span class="sl-state ' + (p.verkocht ? 'sold' : (p.status === 'Laatste exemplaar' ? 'last' : 'ok')) + '">' + esc(p.verkocht ? 'Verkocht' : p.status) + '</span></div>' +
        '<div class="sl-body"><h3>' + esc(p.name) + '</h3>' +
          '<span class="sl-meta">' + esc([p.store, p.style, p.color].filter(Boolean).join(' · ')) + '</span>' +
          '<span class="sl-price">' + (p.price != null ? fuslEuro(p.price) : '') + '</span><span class="zk-grow"></span>' +
          '<div class="gd-vote" role="group" aria-label="Wat vind je van ' + esc(p.name) + '?">' +
            '<button type="button" class="gd-up" data-act="stem" data-id="' + esc(p.id) + '" data-v="op" aria-pressed="' + (v === 'op') + '"' + dis + '>' + U.THUMB + '<span>Mooi</span></button>' +
            '<button type="button" class="gd-down" data-act="stem" data-id="' + esc(p.id) + '" data-v="neer" aria-pressed="' + (v === 'neer') + '"' + dis + '>' + U.THUMB + '<span>Liever niet</span></button>' +
          '</div>' +
          (p.link && !p.verkocht ? '<a class="text-link gd-shop" href="/naar/' + encodeURIComponent(p.id) + '" target="_blank" rel="noopener sponsored nofollow">Bekijk bij ' + esc(p.store) + ' →</a>' : '') +
        '</div></article>';
    }).join('') + '</div>';
    html += '<div class="gd-invite"><img src="images/capy-face.png" alt=""><div><strong>Zelf ook aan het inrichten?</strong>' +
      '<span>Ontdek je stijl met Capy en maak je eigen selectie uit showroommodellen en laatste exemplaren van woonwinkels.</span></div>' +
      '<a href="stijl.html" class="btn btn-rust">Maak je eigen selectie →</a></div>';
    main.innerHTML = html;
  }

  function send(changed) {
    status = 'Opslaan…'; render();
    fetch('/api/selectie/' + encodeURIComponent(id) + '/reactie', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reageerder: me.id, voornaam: me.voornaam, oordelen: changed })
    }).then(function (res) { return res.json().then(function (d) { if (!res.ok) throw new Error(d.fout || 'mislukt'); return d; }); })
      .then(function () { status = 'Opgeslagen ✓'; })
      .catch(function (e) { status = 'Niet opgeslagen: ' + e.message; })
      .then(function () { render(); });
  }

  main.addEventListener('submit', function (e) {
    if (e.target.id !== 'gd-name-form') return;
    e.preventDefault();
    var v = document.getElementById('gd-voornaam').value.trim();
    if (!v) return;
    var renamed = me.voornaam && me.voornaam !== v;
    me.voornaam = v; U.store('fusl_reageerder', me);
    editing = false;
    render();
    if (renamed || Object.keys(votes).length) send(votes);
  });
  main.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]');
    if (!t) return;
    if (t.getAttribute('data-act') === 'naam') { editing = true; render(); var i = document.getElementById('gd-voornaam'); if (i) i.focus(); return; }
    if (t.getAttribute('data-act') === 'stem') {
      var pid = t.getAttribute('data-id'), v = t.getAttribute('data-v');
      var next = votes[pid] === v ? null : v;
      if (next) votes[pid] = next; else delete votes[pid];
      U.store(votesKey, votes);
      var ch = {}; ch[pid] = next;
      send(ch);
      var again = main.querySelector('[data-act="stem"][data-id="' + (window.CSS && CSS.escape ? CSS.escape(pid) : pid) + '"][data-v="' + v + '"]');
      if (again) again.focus();
    }
  });

  if (!/^[A-Za-z0-9_-]{16,32}$/.test(id)) {
    main.innerHTML = '<div class="sl-empty"><h2>Deze link werkt niet</h2><p>Controleer of je de hele link hebt gekopieerd.</p><a href="stijl.html" class="btn btn-rust">Maak je eigen selectie →</a></div>';
    return;
  }
  fetch('/api/selectie/' + encodeURIComponent(id))
    .then(function (res) { return res.json().then(function (d) { if (!res.ok) { var e = new Error(d.fout || 'mislukt'); e.status = res.status; throw e; } return d; }); })
    .then(function (d) { data = d; render(); if (editing) { var i = document.getElementById('gd-voornaam'); if (i) i.focus({ preventScroll: true }); } })
    .catch(function (e) {
      main.innerHTML = '<div class="sl-empty"><h2>' + (e.status === 404 ? 'Deze selectie is niet meer gedeeld' : 'De selectie kon niet geladen worden') + '</h2>' +
        '<p>' + (e.status === 404 ? 'De maker heeft de link uitgezet. Vraag gerust om een nieuwe link.' : 'Probeer het later nog eens.') + '</p>' +
        '<a href="stijl.html" class="btn btn-rust">Maak je eigen selectie →</a></div>';
    });
})();
