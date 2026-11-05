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
  var PRIJS_KEY = 'fusl_prijs_per_klik';
  var STANDAARD_PRIJS = 0.45;

  var el = {};
  var state = {
    sleutel: '',
    maand: huidigeMaand(),
    test: false,
    cache: {}, // "maand|test" -> rapport-object
    prijs: leesPrijs(),
    huidig: null,
    trend: [],
    watals: null // null = volgt de prognose
  };

  function leesPrijs() {
    try { var v = parseFloat(window.localStorage.getItem(PRIJS_KEY)); if (v >= 0) return v; } catch (e) {}
    return STANDAARD_PRIJS;
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
        verversAlles();
      },
      function (err) {
        toonGate(foutmelding(err.code));
      }
    );
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
        state.trend = trendMaanden.map(function (m) { return { maand: m, totaal: bijMaand[m] ? bijMaand[m].totaal : null }; });
        renderStats(huidig, bijMaand[vorigeMaand]);
        renderTrend(state.trend);
      })
      .catch(function () { toonFoutmelding(); });
  }

  function toonFoutmelding() {
    el.error.textContent = foutmelding('netwerk');
    el.error.hidden = false;
  }

  function renderStats(data, vorigeData) {
    el.statTotal.textContent = getal(data.totaal);
    el.statStores.textContent = String(data.winkels.length);
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
    el.omzet.textContent = euro(data.totaal * state.prijs);
    el.omzetUitleg.textContent = getal(data.totaal) + ' kliks × ' + euro(state.prijs);

    var prog = prognose(data);
    if (prog != null) {
      el.prognoseLabel.textContent = 'Prognose deze maand';
      el.prognose.textContent = euro(prog * state.prijs);
      el.prognoseUitleg.textContent = 'ca. ' + getal(prog) + ' kliks bij het huidige tempo';
    } else {
      var trendMetData = state.trend.filter(function (r) { return r.totaal; });
      var gem = trendMetData.length ? trendMetData.reduce(function (t, r) { return t + r.totaal; }, 0) / trendMetData.length : 0;
      el.prognoseLabel.textContent = 'Gemiddeld per maand';
      el.prognose.textContent = euro(gem * state.prijs);
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
          '<span class="kl-bar-amount">' + euro(w.kliks * state.prijs) + '</span>' +
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
              '<span class="kl-bar-detail-count">' + euro(p.kliks * state.prijs) + '</span>' +
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
      return '<tr><td>' + escapeHtml(w.winkel) + '</td><td class="kl-table-num">' + w.kliks.toLocaleString('nl-NL') + '</td><td class="kl-table-num">' + euro(w.kliks * state.prijs) + '</td></tr>';
    }).join('');
    el.tableWrap.innerHTML =
      '<table class="kl-table"><thead><tr><th>Winkel</th><th class="kl-table-num">Kliks</th><th class="kl-table-num">Bedrag</th></tr></thead><tbody>' + rijen +
      '</tbody><tfoot><tr><th>Totaal</th><th class="kl-table-num">' + getal(data.totaal) + '</th><th class="kl-table-num">' + euro(data.totaal * state.prijs) + '</th></tr></tfoot></table>';
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
        toonTooltip(ev, maandLabel(r.maand) + ': ' + (r.totaal === null ? 'geen data' : r.totaal.toLocaleString('nl-NL') + ' kliks · ' + euro(r.totaal * state.prijs)));
      });
      c.addEventListener('mousemove', verplaatsTooltip);
      c.addEventListener('mouseleave', verbergTooltip);
    });
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
    var bedrag = function (n) { return (n * state.prijs).toFixed(2).replace('.', ','); };
    var regels = ['maand;winkel;stuk;kliks;prijs per klik;bedrag'];
    data.winkels.forEach(function (w) {
      w.producten.forEach(function (p) {
        regels.push([state.maand, q(w.winkel), q(p.product), p.kliks, state.prijs.toFixed(2).replace('.', ','), bedrag(p.kliks)].join(';'));
      });
      regels.push([state.maand, q(w.winkel), q('Totaal ' + w.winkel), w.kliks, state.prijs.toFixed(2).replace('.', ','), bedrag(w.kliks)].join(';'));
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
    el.statStores = document.getElementById('kl-stat-stores');
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

    el.prijs.value = state.prijs.toFixed(2);
    el.prijs.addEventListener('input', function () {
      var v = parseFloat(String(el.prijs.value).replace(',', '.'));
      if (!(v >= 0)) return;
      state.prijs = v;
      try { window.localStorage.setItem(PRIJS_KEY, String(v)); } catch (e) {}
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
