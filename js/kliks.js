// FUSL — eigen kliksdashboard (/kliks.html).
//
// Los van Google Analytics: dit scherm leest rechtstreeks de cijfers die het
// bestaande /api/klik-rapport al bijhoudt (doorverwijzingen per winkel/stuk,
// opgebouwd als basis voor de maandfactuur per klik). Dit bestand bouwt er
// alleen een overzichtelijk scherm omheen — er wordt hier niets nieuws geteld.
//
// De rapportsleutel (RAPPORT_SLEUTEL in Netlify) wordt na het invullen alleen
// in localStorage van déze browser bewaard, en bij elke aanvraag als header
// (x-rapport-sleutel) verstuurd — nooit als deel van een URL, zodat hij niet
// in de adresbalk of browsegeschiedenis terechtkomt.

(function () {
  var SLEUTEL_KEY = 'fusl_rapport_sleutel';
  var STANDAARD_PRIJS = 0.45;

  var el = {};
  var state = {
    sleutel: '',
    maand: huidigeMaand(),
    test: false,
    cache: {}, // "maand|test" -> rapport-object
    prijs: STANDAARD_PRIJS,
    huidig: null,
    trend: [],
    watals: null, // null = volgt de prognose
    tarieven: { standaard: STANDAARD_PRIJS, winkels: {} },
    winkelLijst: [], // { id, naam } van alle bekende winkels, voor de tarieven
    periode: 'dag'
  };

  var BRON_LABEL = { zoeken: 'Zoekpagina', stijl: 'Zoeken met jouw stijl', selectie: 'Mijn selectie', gedeeld: 'Gedeelde selectie', onbekend: 'Onbekend (van vóór deze meting)' };
  var PAGINA_LABEL = { '/': 'Homepage', '/aanbod': 'Zoeken', '/stijl': 'Ontdek je stijl', '/selectie': 'Mijn selectie', '/gedeeld': 'Gedeelde selectie', '/over-ons': 'Over FUSL', '/aanmelding-verzonden': 'Aanmelding verzonden' };

  // Bedrag voor één winkel volgens de ingestelde tarieven.
  function bedragWinkel(w) {
    var t = state.tarieven.winkels[w.winkelId] || {};
    var tarief = t.tarief != null ? t.tarief : state.tarieven.standaard;
    if (t.gratisTot && state.maand <= t.gratisTot) return { bedrag: 0, tarief: tarief, notitie: 'gratis t/m ' + maandLabel(t.gratisTot) };
    var b = w.kliks * tarief;
    if (t.max && b > t.max) return { bedrag: t.max, tarief: tarief, notitie: 'maximum bereikt' };
    return { bedrag: b, tarief: tarief, notitie: '' };
  }
  function omzetTotaal(data) {
    return data.winkels.reduce(function (s, w) { return s + bedragWinkel(w).bedrag; }, 0);
  }
  function apiFetch(pad, opties) {
    opties = opties || {};
    opties.headers = Object.assign({ 'x-rapport-sleutel': state.sleutel }, opties.headers || {});
    return fetch(pad, opties).then(function (res) {
      if (!res.ok) { var e = new Error('HTTP ' + res.status); e.status = res.status; throw e; }
      return res.json();
    });
  }

  function euro(n) { return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n || 0); }
  function getal(n) { return Math.round(n || 0).toLocaleString('nl-NL'); }

  // Prognose voor de lopende maand: tempo tot nu toe doorgetrokken naar de hele maand.
  function prognose(data) {
    if (!data || state.maand !== huidigeMaand()) return null;
    var nu = new Date();
    var dagen = new Date(nu.getFullYear(), nu.getMonth() + 1, 0).getDate();
    var verstreken = nu.getDate() - 1 + nu.getHours() / 24;
    if (verstreken < 1) return null; // eerste dag: nog te weinig om iets over te zeggen
    return Math.round(data.totaal / verstreken * dagen);
  }

  function huidigeMaand() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function verschuifMaand(maand, delta) {
    var jaar = Number(maand.slice(0, 4));
    var mnd = Number(maand.slice(5, 7)) - 1 + delta;
    jaar += Math.floor(mnd / 12);
    mnd = ((mnd % 12) + 12) % 12;
    return jaar + '-' + String(mnd + 1).padStart(2, '0');
  }

  function maandLabel(maand) {
    var d = new Date(Number(maand.slice(0, 4)), Number(maand.slice(5, 7)) - 1, 1);
    return new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' }).format(d);
  }

  function maandKort(maand) {
    var d = new Date(Number(maand.slice(0, 4)), Number(maand.slice(5, 7)) - 1, 1);
    return new Intl.DateTimeFormat('nl-NL', { month: 'short' }).format(d);
  }

  function cacheKey(maand, test) { return maand + '|' + (test ? '1' : '0'); }

  // Haalt een maandrapport op. Geeft het JSON-object terug, of gooit een Error
  // met .code ('auth' | 'config' | 'netwerk') zodat de aanroeper kan bepalen
  // welke melding te tonen.
  function haalRapport(maand, test) {
    var key = cacheKey(maand, test);
    if (state.cache[key]) return Promise.resolve(state.cache[key]);
    var url = 'api/klik-rapport?maand=' + encodeURIComponent(maand) + (test ? '&test=1' : '');
    return fetch(url, { headers: { 'x-rapport-sleutel': state.sleutel } })
      .then(function (res) {
        if (res.status === 401) { var e = new Error('auth'); e.code = 'auth'; throw e; }
        if (res.status === 503) { var e2 = new Error('config'); e2.code = 'config'; throw e2; }
        if (!res.ok) { var e3 = new Error('netwerk'); e3.code = 'netwerk'; throw e3; }
        return res.json();
      })
      .then(function (data) {
        state.cache[key] = data;
        return data;
      });
  }

  function foutmelding(code) {
    if (code === 'auth') return 'Deze sleutel klopt niet (meer). Vul je rapportsleutel opnieuw in.';
    if (code === 'config') return 'Er is nog geen RAPPORT_SLEUTEL ingesteld bij Netlify. Zet die eerst bij Site configuration → Environment variables.';
    return 'Kon de cijfers niet laden. Probeer het straks nog eens.';
  }

  // ---- Toegang (sleutel) ----

  function toonGate(foutTekst) {
    el.gate.hidden = false;
    el.dashboard.hidden = true;
    if (foutTekst) {
      el.gateError.textContent = foutTekst;
      el.gateError.hidden = false;
    } else {
      el.gateError.hidden = true;
    }
  }

  function probeerOntgrendelen(sleutel) {
    state.sleutel = sleutel;
    state.cache = {};
    return haalRapport(state.maand, state.test).then(
      function () {
        try { window.localStorage.setItem(SLEUTEL_KEY, sleutel); } catch (e) {}
        el.gate.hidden = true;
        el.dashboard.hidden = false;
        return laadTarieven().then(verversAlles, verversAlles);
      },
      function (err) {
        toonGate(foutmelding(err.code));
      }
    );
  }

  // ---- Tarieven ----

  function laadTarieven() {
    var winkels = {};
    var bekend = function (id, naam) { if (id && !winkels[id]) winkels[id] = naam || id; };
    return Promise.all([
      apiFetch('api/tarieven').then(function (t) { state.tarieven = { standaard: t.standaard != null ? t.standaard : STANDAARD_PRIJS, winkels: t.winkels || {} }; }),
      fetch('data/aanbod.json').then(function (r) { return r.ok ? r.json() : {}; }).then(function (d) { (d.listings || []).forEach(function (l) { bekend(l.storeId, l.storeName); }); }).catch(function () {}),
      fetch('data/winkels.json').then(function (r) { return r.ok ? r.json() : {}; }).then(function (d) { (d.winkels || []).forEach(function (w) { bekend(w.id, w.naam); }); }).catch(function () {})
    ]).then(function () {
      Object.keys(state.tarieven.winkels).forEach(function (id) { bekend(id, id); });
      state.winkelLijst = Object.keys(winkels).map(function (id) { return { id: id, naam: winkels[id] }; })
        .sort(function (a, b) { return a.naam.localeCompare(b.naam, 'nl'); });
      if (!state.prijsAangepast) { state.prijs = state.tarieven.standaard; el.prijs.value = state.prijs.toFixed(2); }
      renderTarieven();
    });
  }

  function renderTarieven() {
    el.standaard.value = Number(state.tarieven.standaard).toFixed(2);
    var aantalEigen = Object.keys(state.tarieven.winkels).length;
    el.tarievenSamenvatting.textContent = euro(state.tarieven.standaard) + ' per klik' + (aantalEigen ? ' · ' + aantalEigen + (aantalEigen === 1 ? ' winkel' : ' winkels') + ' met eigen afspraak' : '');
    el.tariefRijen.innerHTML = state.winkelLijst.map(function (w) {
      var t = state.tarieven.winkels[w.id] || {};
      var id = escapeHtml(w.id);
      return '<tr data-winkel="' + id + '"><td>' + escapeHtml(w.naam) + '</td>' +
        '<td><span class="kl-money-input"><span aria-hidden="true">€</span><input type="number" min="0" step="0.05" data-veld="tarief" aria-label="Tarief per klik voor ' + escapeHtml(w.naam) + '" placeholder="' + Number(state.tarieven.standaard).toFixed(2) + '" value="' + (t.tarief != null ? t.tarief : '') + '"></span></td>' +
        '<td><span class="kl-money-input"><span aria-hidden="true">€</span><input type="number" min="0" step="5" data-veld="max" aria-label="Maximum per maand voor ' + escapeHtml(w.naam) + '" placeholder="geen" value="' + (t.max != null ? t.max : '') + '"></span></td>' +
        '<td><input type="month" data-veld="gratisTot" aria-label="Gratis tot en met maand voor ' + escapeHtml(w.naam) + '" value="' + (t.gratisTot || '') + '"></td></tr>';
    }).join('') || '<tr><td colspan="4">Nog geen winkels bekend.</td></tr>';
  }

  function slaTarievenOp() {
    var nieuw = { standaard: parseFloat(String(el.standaard.value).replace(',', '.')), winkels: {} };
    el.tariefRijen.querySelectorAll('tr[data-winkel]').forEach(function (tr) {
      var r = {};
      tr.querySelectorAll('input[data-veld]').forEach(function (inp) {
        var v = String(inp.value).trim();
        if (!v) return;
        r[inp.getAttribute('data-veld')] = inp.type === 'month' ? v : parseFloat(v.replace(',', '.'));
      });
      if (Object.keys(r).length) nieuw.winkels[tr.getAttribute('data-winkel')] = r;
    });
    el.tarievenStatus.textContent = 'Opslaan…';
    apiFetch('api/tarieven', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nieuw) })
      .then(function (t) {
        state.tarieven = { standaard: t.standaard, winkels: t.winkels || {} };
        if (!state.prijsAangepast) { state.prijs = state.tarieven.standaard; el.prijs.value = state.prijs.toFixed(2); }
        el.tarievenStatus.textContent = 'Opgeslagen ✓';
        renderTarieven();
        renderOmzet();
      })
      .catch(function () { el.tarievenStatus.textContent = 'Opslaan lukte niet. Probeer het opnieuw.'; });
  }

  // ---- Dashboard opbouwen ----

  function huidigIsGeselecteerd() { return state.maand >= huidigeMaand(); }

  function verversAlles() {
    el.monthLabel.textContent = maandLabel(state.maand);
    el.nextBtn.disabled = huidigIsGeselecteerd();
    el.error.hidden = true;

    var vorigeMaand = verschuifMaand(state.maand, -1);
    var trendMaanden = [];
    for (var i = 5; i >= 0; i--) trendMaanden.push(verschuifMaand(huidigeMaand(), -i));

    var alleMaanden = trendMaanden.slice();
    if (alleMaanden.indexOf(state.maand) === -1) alleMaanden.push(state.maand);
    if (alleMaanden.indexOf(vorigeMaand) === -1) alleMaanden.push(vorigeMaand);

    Promise.all(alleMaanden.map(function (m) { return haalRapport(m, state.test).catch(function () { return null; }); }))
      .then(function (resultaten) {
        var bijMaand = {};
        alleMaanden.forEach(function (m, idx) { bijMaand[m] = resultaten[idx]; });

        var huidig = bijMaand[state.maand];
        if (!huidig) { toonFoutmelding(); return; }

        state.huidig = huidig;
        var huidigeMaandBewaard = state.maand;
        state.trend = trendMaanden.map(function (m) {
          if (!bijMaand[m]) return { maand: m, totaal: null };
          state.maand = m; var o = omzetTotaal(bijMaand[m]); state.maand = huidigeMaandBewaard;
          return { maand: m, totaal: bijMaand[m].totaal, omzet: o };
        });
        renderStats(huidig, bijMaand[vorigeMaand]);
        renderTrend(state.trend);
        renderDagen(huidig);
        renderBronnen(huidig);
        renderBezoek(huidig);
      })
      .catch(function () { toonFoutmelding(); });
  }

  function toonFoutmelding() {
    el.error.textContent = foutmelding('netwerk');
    el.error.hidden = false;
  }

  function renderStats(data, vorigeData) {
    el.statTotal.textContent = getal(data.totaal);
    var bz = data.bezoek || { bezoekers: 0 };
    el.statBezoekers.textContent = getal(bz.bezoekers);
    el.statRatio.textContent = bz.bezoekers ? Math.round(data.totaal / bz.bezoekers * 100) + '% klikt door naar een winkel' : 'Nog geen bezoekers geteld';
    el.statTop.textContent = data.winkels.length ? data.winkels[0].winkel : '—';

    var delta = '';
    if (vorigeData && typeof vorigeData.totaal === 'number') {
      var verschil = data.totaal - vorigeData.totaal;
      if (vorigeData.totaal > 0) {
        var pct = Math.round((verschil / vorigeData.totaal) * 100);
        delta = (verschil >= 0 ? '↑ ' : '↓ ') + Math.abs(pct) + '% t.o.v. vorige maand (' + getal(vorigeData.totaal) + ')';
      } else if (data.totaal > 0) {
        delta = 'Vorige maand: 0';
      }
    }
    el.statDelta.textContent = delta;
    renderOmzet();
  }

  // Alles wat van de prijs per klik afhangt; opnieuw bij elke prijswijziging.
  function renderOmzet() {
    var data = state.huidig;
    if (!data) return;
    var omzet = omzetTotaal(data);
    var eigen = data.winkels.some(function (w) { return state.tarieven.winkels[w.winkelId]; });
    el.omzet.textContent = euro(omzet);
    el.omzetUitleg.textContent = eigen ? getal(data.totaal) + ' kliks, volgens de tarieven per winkel' : getal(data.totaal) + ' kliks × ' + euro(state.tarieven.standaard);
    var perKlik = data.totaal ? omzet / data.totaal : state.tarieven.standaard;

    var prog = prognose(data);
    if (prog != null) {
      el.prognoseLabel.textContent = 'Prognose deze maand';
      el.prognose.textContent = euro(prog * perKlik);
      el.prognoseUitleg.textContent = 'ca. ' + getal(prog) + ' kliks bij het huidige tempo';
    } else {
      var trendMetData = state.trend.filter(function (r) { return r.totaal; });
      var gem = trendMetData.length ? trendMetData.reduce(function (t, r) { return t + r.totaal; }, 0) / trendMetData.length : 0;
      el.prognoseLabel.textContent = 'Gemiddeld per maand';
      el.prognose.textContent = euro(gem * perKlik);
      el.prognoseUitleg.textContent = 'ca. ' + getal(gem) + ' kliks, laatste 6 maanden';
    }

    var basis = state.watals != null ? state.watals : (prog != null ? prog : data.totaal);
    if (state.watals == null) { el.watals.value = basis; }
    el.slider.max = Math.max(1000, Math.ceil(basis * 3 / 100) * 100);
    el.slider.value = basis;
    el.calcMaand.textContent = euro(basis * state.prijs);
    el.calcJaar.textContent = euro(basis * state.prijs * 12);

    renderBars(data);
    renderTabel(data);
  }

  function renderBars(data) {
    el.bars.innerHTML = '';
    el.empty.hidden = data.winkels.length > 0;
    document.querySelector('.kl-bar-head').hidden = !data.winkels.length || el.bars.hidden;
    if (!data.winkels.length) return;

    var max = data.winkels[0].kliks || 1;

    data.winkels.forEach(function (w) {
      var row = document.createElement('div');
      row.className = 'kl-bar-row';

      var pct = Math.max(2, Math.round((w.kliks / max) * 100));
      row.innerHTML =
        '<button type="button" class="kl-bar-btn kl-bar-row-main" aria-expanded="false">' +
          '<span class="kl-bar-label">' + escapeHtml(w.winkel) + '</span>' +
          '<span class="kl-bar-track"><span class="kl-bar-fill" style="width:' + pct + '%"></span></span>' +
          '<span class="kl-bar-count">' + w.kliks.toLocaleString('nl-NL') + '</span>' +
          '<span class="kl-bar-amount">' + euro(bedragWinkel(w).bedrag) + (bedragWinkel(w).notitie ? '<small>' + escapeHtml(bedragWinkel(w).notitie) + '</small>' : '') + '</span>' +
          '<span class="kl-bar-chevron">▸</span>' +
        '</button>' +
        '<div class="kl-bar-detail"></div>';

      var btn = row.querySelector('.kl-bar-btn');
      var detail = row.querySelector('.kl-bar-detail');

      btn.addEventListener('click', function () {
        var open = row.classList.contains('kl-open');
        btn.setAttribute('aria-expanded', open ? 'false' : 'true');
        if (open) { row.classList.remove('kl-open'); return; }
        if (!detail.dataset.gevuld) {
          detail.innerHTML = w.producten.map(function (p) {
            var ppct = Math.max(4, Math.round((p.kliks / w.kliks) * 100));
            return '<div class="kl-bar-detail-row">' +
              '<span class="kl-bar-detail-label">' + escapeHtml(p.product) + '</span>' +
              '<span class="kl-bar-detail-track"><span class="kl-bar-detail-fill" style="width:' + ppct + '%"></span></span>' +
              '<span class="kl-bar-detail-count">' + p.kliks.toLocaleString('nl-NL') + '</span>' +
              '<span class="kl-bar-detail-count">' + euro(p.kliks * bedragWinkel(w).tarief) + '</span>' +
            '</div>';
          }).join('');
          detail.dataset.gevuld = '1';
        }
        row.classList.add('kl-open');
      });

      var totaalDitRapport = data.totaal || 1;
      btn.title = w.winkel + ': ' + Math.round((w.kliks / totaalDitRapport) * 100) + '% van alle kliks deze maand. Klik voor de stukken.';

      el.bars.appendChild(row);
    });
  }

  function renderTabel(data) {
    if (!data.winkels.length) { el.tableWrap.hidden = true; el.tableWrap.innerHTML = ''; return; }
    var rijen = data.winkels.map(function (w) {
      var b = bedragWinkel(w);
      return '<tr><td>' + escapeHtml(w.winkel) + '</td><td class="kl-table-num">' + w.kliks.toLocaleString('nl-NL') + '</td><td class="kl-table-num">' + euro(b.tarief) + '</td><td class="kl-table-num">' + euro(b.bedrag) + (b.notitie ? ' <small>(' + escapeHtml(b.notitie) + ')</small>' : '') + '</td></tr>';
    }).join('');
    el.tableWrap.innerHTML =
      '<table class="kl-table"><thead><tr><th>Winkel</th><th class="kl-table-num">Kliks</th><th class="kl-table-num">Tarief</th><th class="kl-table-num">Bedrag</th></tr></thead><tbody>' + rijen +
      '</tbody><tfoot><tr><th>Totaal</th><th class="kl-table-num">' + getal(data.totaal) + '</th><th></th><th class="kl-table-num">' + euro(omzetTotaal(data)) + '</th></tr></tfoot></table>';
  }

  function renderTrend(reeks) {
    var w = 640, h = 140, padL = 8, padR = 8, padT = 16, padB = 24;
    var waarden = reeks.map(function (r) { return r.totaal || 0; });
    var max = Math.max.apply(null, waarden.concat([1]));
    var stapX = (w - padL - padR) / (reeks.length - 1 || 1);

    var punten = reeks.map(function (r, i) {
      var x = padL + stapX * i;
      var y = padT + (h - padT - padB) * (1 - (r.totaal || 0) / max);
      return { x: x, y: y, r: r };
    });

    var lijn = punten.map(function (p, i) { return (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1); }).join(' ');

    var cirkels = punten.map(function (p, i) {
      return '<circle class="kl-trend-point" data-i="' + i + '" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="4" fill="#387c28" />' +
        '<circle data-i="' + i + '" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="14" fill="transparent" style="cursor:pointer" />';
    }).join('');

    var labels = punten.map(function (p, i) {
      return '<text x="' + p.x.toFixed(1) + '" y="' + (h - 6) + '" text-anchor="middle" font-size="11" font-family="Manrope, sans-serif" fill="rgba(58,44,32,0.55)">' + maandKort(reeks[i].maand) + '</text>';
    }).join('');

    el.trend.innerHTML =
      '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Totaal kliks per maand, laatste 6 maanden">' +
        '<line x1="' + padL + '" y1="' + (h - padB) + '" x2="' + (w - padR) + '" y2="' + (h - padB) + '" stroke="rgba(58,44,32,0.12)" stroke-width="1" />' +
        '<path d="' + lijn + '" fill="none" stroke="#387c28" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />' +
        cirkels + labels +
      '</svg>';

    var pts = el.trend.querySelectorAll('circle[data-i]');
    pts.forEach(function (c) {
      c.addEventListener('mouseenter', function (ev) {
        var i = Number(c.getAttribute('data-i'));
        var r = reeks[i];
        toonTooltip(ev, maandLabel(r.maand) + ': ' + (r.totaal === null ? 'geen data' : r.totaal.toLocaleString('nl-NL') + ' kliks · ' + euro(r.omzet != null ? r.omzet : r.totaal * state.tarieven.standaard)));
      });
      c.addEventListener('mousemove', verplaatsTooltip);
      c.addEventListener('mouseleave', verbergTooltip);
    });
  }

  // ---- Per dag / per week ----

  function dagenVanMaand(maand) {
    var j = Number(maand.slice(0, 4)), m = Number(maand.slice(5, 7));
    var n = new Date(j, m, 0).getDate();
    var uit = [];
    for (var d = 1; d <= n; d++) uit.push(maand + '-' + String(d).padStart(2, '0'));
    return uit;
  }
  function weekVan(datum) { // ISO-weeknummer
    var d = new Date(Date.UTC(+datum.slice(0, 4), +datum.slice(5, 7) - 1, +datum.slice(8, 10)));
    var dag = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dag);
    var jaarStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - jaarStart) / 86400000 + 1) / 7);
  }

  function renderDagen(data) {
    var kliks = data.perDag || {};
    var bezoek = (data.bezoek && data.bezoek.perDag) || {};
    var vandaag = new Date();
    var vandaagStr = vandaag.getFullYear() + '-' + String(vandaag.getMonth() + 1).padStart(2, '0') + '-' + String(vandaag.getDate()).padStart(2, '0');
    var groepen = [];
    dagenVanMaand(state.maand).forEach(function (d) {
      var label = state.periode === 'week' ? 'wk ' + weekVan(d) : String(Number(d.slice(8, 10)));
      var g = groepen[groepen.length - 1];
      if (!g || g.label !== label) { g = { label: label, van: d, tot: d, kliks: 0, bezoekers: 0, toekomst: d > vandaagStr }; groepen.push(g); }
      g.tot = d;
      g.kliks += kliks[d] || 0;
      g.bezoekers += (bezoek[d] && bezoek[d].bezoekers) || 0;
      if (d <= vandaagStr) g.toekomst = false;
    });

    var smal = el.dagen.clientWidth && el.dagen.clientWidth < 520;
    var w = smal ? 360 : 720, h = smal ? 230 : 200, padL = 30, padR = 6, padT = 12, padB = 26;
    var maxK = Math.max.apply(null, groepen.map(function (g) { return Math.max(g.kliks, g.bezoekers); }).concat([4]));
    var ruimte = (w - padL - padR) / groepen.length;
    var bw = Math.max(2, Math.min(18, ruimte * 0.36));
    var y = function (v) { return padT + (h - padT - padB) * (1 - v / maxK); };
    var stap = maxK <= 5 ? 1 : Math.ceil(maxK / 4);
    var raster = '';
    for (var v = 0; v <= maxK; v += stap) {
      raster += '<line x1="' + padL + '" x2="' + (w - padR) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '" stroke="rgba(58,44,32,0.08)"/>' +
        '<text x="' + (padL - 6) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end" font-size="11" fill="rgba(58,44,32,0.55)" font-family="Manrope, sans-serif">' + v + '</text>';
    }
    var labelElke = state.periode === 'week' ? 1 : (groepen.length > 20 ? (smal ? 7 : 5) : 1);
    var staven = groepen.map(function (g, i) {
      var x = padL + ruimte * i + ruimte / 2;
      var t = g.toekomst ? ' opacity="0.25"' : '';
      return '<g class="kl-dag" data-i="' + i + '">' +
        '<rect x="' + (x - bw - 1).toFixed(1) + '" y="' + y(g.bezoekers).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (h - padB - y(g.bezoekers)).toFixed(1) + '" rx="2" fill="#9fc99e"' + t + '/>' +
        '<rect x="' + (x + 1).toFixed(1) + '" y="' + y(g.kliks).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (h - padB - y(g.kliks)).toFixed(1) + '" rx="2" fill="#213b1e"' + t + '/>' +
        '<rect x="' + (x - ruimte / 2).toFixed(1) + '" y="' + padT + '" width="' + ruimte.toFixed(1) + '" height="' + (h - padT - padB) + '" fill="transparent"/>' +
        ((i % labelElke === 0 || i === groepen.length - 1) ? '<text x="' + x.toFixed(1) + '" y="' + (h - 8) + '" text-anchor="middle" font-size="11" fill="rgba(58,44,32,0.55)" font-family="Manrope, sans-serif">' + g.label + '</text>' : '') +
        '</g>';
    }).join('');
    el.dagen.innerHTML = '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Bezoekers en doorverwijzingen ' + (state.periode === 'week' ? 'per week' : 'per dag') + ' in ' + maandLabel(state.maand) + '">' + raster + staven + '</svg>';
    el.dagen.querySelectorAll('.kl-dag').forEach(function (gEl) {
      var g = groepen[+gEl.getAttribute('data-i')];
      var datum = function (d) { return new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' }).format(new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))); };
      var tekst = (g.van === g.tot ? datum(g.van) : g.label + ' (' + datum(g.van) + ' – ' + datum(g.tot) + ')') + ': ' +
        g.bezoekers + ' bezoekers, ' + g.kliks + ' doorverwijzingen' + (g.bezoekers ? ' (' + Math.round(g.kliks / g.bezoekers * 100) + '%)' : '');
      gEl.addEventListener('mouseenter', function (ev) { toonTooltip(ev, tekst); });
      gEl.addEventListener('mousemove', verplaatsTooltip);
      gEl.addEventListener('mouseleave', verbergTooltip);
    });
  }

  // ---- Herkomst van kliks en bezoekers ----

  function balkLijst(paren, totaal, leeg) {
    if (!paren.length) return '<p class="kl-empty-msg">' + leeg + '</p>';
    var max = paren[0][1] || 1;
    return paren.map(function (p) {
      return '<div class="kl-mini-row"><span class="kl-mini-label">' + escapeHtml(p[0]) + '</span>' +
        '<span class="kl-mini-track"><span class="kl-mini-fill" style="width:' + Math.max(3, Math.round(p[1] / max * 100)) + '%"></span></span>' +
        '<span class="kl-mini-count">' + getal(p[1]) + '</span><span class="kl-mini-pct">' + (totaal ? Math.round(p[1] / totaal * 100) : 0) + '%</span></div>';
    }).join('');
  }
  function gesorteerd(obj, labels) {
    return Object.keys(obj || {}).map(function (k) { return [labels && labels[k] ? labels[k] : k, obj[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
  }
  function renderBronnen(data) {
    el.bronnen.innerHTML = balkLijst(gesorteerd(data.perBron, BRON_LABEL), data.totaal, 'Nog geen doorverwijzingen deze maand.');
  }
  function renderBezoek(data) {
    var bz = data.bezoek || { bezoekers: 0, weergaven: 0, herkomst: {}, paginas: {} };
    el.herkomst.innerHTML = balkLijst(gesorteerd(bz.herkomst), bz.bezoekers, 'Nog geen bezoekers geteld deze maand. De teller loopt vanaf het moment dat deze versie live staat.');
    el.paginas.innerHTML = balkLijst(gesorteerd(bz.paginas, PAGINA_LABEL).slice(0, 6), bz.weergaven, 'Nog geen paginaweergaven.');
  }

  // ---- Tooltip ----

  function toonTooltip(ev, tekst) {
    el.tooltip.textContent = tekst;
    el.tooltip.hidden = false;
    verplaatsTooltip(ev);
  }
  function toonTooltipBijElement(element, tekst) {
    var rect = element.getBoundingClientRect();
    el.tooltip.textContent = tekst;
    el.tooltip.hidden = false;
    el.tooltip.style.left = (rect.left) + 'px';
    el.tooltip.style.top = (rect.top - 36) + 'px';
  }
  function verplaatsTooltip(ev) {
    el.tooltip.style.left = (ev.clientX + 14) + 'px';
    el.tooltip.style.top = (ev.clientY - 12) + 'px';
  }
  function verbergTooltip() { el.tooltip.hidden = true; }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---- CSV-export (via fetch + blob, zodat de sleutel nooit in een URL staat) ----

  function downloadCsv() {
    var data = state.huidig;
    if (!data) return;
    var q = function (x) { return '"' + String(x).replace(/"/g, '""') + '"'; };
    var nl = function (n) { return n.toFixed(2).replace('.', ','); };
    var regels = ['maand;winkel;stuk;kliks;tarief per klik;bedrag;opmerking'];
    data.winkels.forEach(function (w) {
      var b = bedragWinkel(w);
      w.producten.forEach(function (p) {
        regels.push([state.maand, q(w.winkel), q(p.product), p.kliks, nl(b.tarief), nl(p.kliks * b.tarief), ''].join(';'));
      });
      regels.push([state.maand, q(w.winkel), q('Totaal ' + w.winkel), w.kliks, nl(b.tarief), nl(b.bedrag), q(b.notitie)].join(';'));
    });
    var blob = new Blob(['\ufeff' + regels.join('\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    var objectUrl = URL.createObjectURL(blob);
    a.href = objectUrl;
    a.download = 'fusl-factuuroverzicht-' + state.maand + (state.test ? '-test' : '') + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 1000);
  }

  // ---- Init ----

  function init() {
    el.gate = document.getElementById('kl-gate');
    el.gateForm = document.getElementById('kl-gate-form');
    el.gateInput = document.getElementById('kl-gate-input');
    el.gateError = document.getElementById('kl-gate-error');
    el.dashboard = document.getElementById('kl-dashboard');
    el.error = document.getElementById('kl-error');
    el.monthLabel = document.getElementById('kl-month-label');
    el.prevBtn = document.getElementById('kl-prev-month');
    el.nextBtn = document.getElementById('kl-next-month');
    el.testToggle = document.getElementById('kl-test-toggle');
    el.csvBtn = document.getElementById('kl-csv-btn');
    el.lockBtn = document.getElementById('kl-lock-btn');
    el.statTotal = document.getElementById('kl-stat-total');
    el.statDelta = document.getElementById('kl-stat-delta');
    el.statTop = document.getElementById('kl-stat-top');
    el.bars = document.getElementById('kl-bars');
    el.tableToggle = document.getElementById('kl-table-toggle');
    el.tableWrap = document.getElementById('kl-table-wrap');
    el.empty = document.getElementById('kl-empty');
    el.trend = document.getElementById('kl-trend');
    el.tooltip = document.getElementById('kl-tooltip');
    el.omzet = document.getElementById('kl-omzet');
    el.omzetUitleg = document.getElementById('kl-omzet-uitleg');
    el.prognose = document.getElementById('kl-prognose');
    el.prognoseLabel = document.getElementById('kl-prognose-label');
    el.prognoseUitleg = document.getElementById('kl-prognose-uitleg');
    el.prijs = document.getElementById('kl-prijs');
    el.watals = document.getElementById('kl-watals');
    el.slider = document.getElementById('kl-watals-slider');
    el.calcMaand = document.getElementById('kl-calc-maand');
    el.calcJaar = document.getElementById('kl-calc-jaar');
    el.statBezoekers = document.getElementById('kl-stat-bezoekers');
    el.statRatio = document.getElementById('kl-stat-ratio');
    el.standaard = document.getElementById('kl-standaard');
    el.tariefRijen = document.getElementById('kl-tarief-rijen');
    el.tarievenStatus = document.getElementById('kl-tarieven-status');
    el.tarievenSamenvatting = document.getElementById('kl-tarieven-samenvatting');
    el.dagen = document.getElementById('kl-dagen');
    el.bronnen = document.getElementById('kl-bronnen');
    el.herkomst = document.getElementById('kl-herkomst');
    el.paginas = document.getElementById('kl-paginas');
    document.getElementById('kl-tarieven-opslaan').addEventListener('click', slaTarievenOp);
    document.querySelectorAll('[data-periode]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.periode = b.getAttribute('data-periode');
        document.querySelectorAll('[data-periode]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        if (state.huidig) renderDagen(state.huidig);
      });
    });

    el.prijs.value = state.prijs.toFixed(2);
    el.prijs.addEventListener('input', function () {
      var v = parseFloat(String(el.prijs.value).replace(',', '.'));
      if (!(v >= 0)) return;
      state.prijs = v;
      state.prijsAangepast = true;
      renderOmzet();
    });
    el.watals.addEventListener('input', function () {
      var v = parseInt(el.watals.value, 10);
      state.watals = v >= 0 ? v : null;
      renderOmzet();
    });
    el.slider.addEventListener('input', function () {
      state.watals = parseInt(el.slider.value, 10);
      el.watals.value = state.watals;
      renderOmzet();
    });

    el.gateForm.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var sleutel = el.gateInput.value.trim();
      if (!sleutel) return;
      probeerOntgrendelen(sleutel);
    });

    el.prevBtn.addEventListener('click', function () { state.maand = verschuifMaand(state.maand, -1); state.watals = null; verversAlles(); });
    el.nextBtn.addEventListener('click', function () { if (!huidigIsGeselecteerd()) { state.maand = verschuifMaand(state.maand, 1); state.watals = null; verversAlles(); } });

    el.testToggle.addEventListener('change', function () { state.test = el.testToggle.checked; state.cache = {}; verversAlles(); });
    el.csvBtn.addEventListener('click', downloadCsv);

    el.lockBtn.addEventListener('click', function () {
      try { window.localStorage.removeItem(SLEUTEL_KEY); } catch (e) {}
      state.sleutel = '';
      state.cache = {};
      el.gateInput.value = '';
      toonGate(null);
    });

    el.tableToggle.addEventListener('click', function () {
      var naarTabel = el.bars.hidden === false;
      el.bars.hidden = naarTabel;
      el.tableWrap.hidden = !naarTabel;
      el.tableToggle.textContent = naarTabel ? 'Toon als balken' : 'Toon als tabel';
      document.querySelector('.kl-bar-head').hidden = naarTabel;
    });

    var opgeslagen = null;
    try { opgeslagen = window.localStorage.getItem(SLEUTEL_KEY); } catch (e) {}
    if (opgeslagen) {
      probeerOntgrendelen(opgeslagen);
    } else {
      toonGate(null);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
