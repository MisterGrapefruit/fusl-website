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

  var el = {};
  var state = {
    sleutel: '',
    maand: huidigeMaand(),
    test: false,
    cache: {} // "maand|test" -> rapport-object
  };

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

        renderStats(huidig, bijMaand[vorigeMaand]);
        renderBars(huidig);
        renderTabel(huidig);
        renderTrend(trendMaanden.map(function (m) { return { maand: m, totaal: bijMaand[m] ? bijMaand[m].totaal : null }; }));
      })
      .catch(function () { toonFoutmelding(); });
  }

  function toonFoutmelding() {
    el.error.textContent = foutmelding('netwerk');
    el.error.hidden = false;
  }

  function renderStats(data, vorigeData) {
    el.statTotal.textContent = data.totaal.toLocaleString('nl-NL');
    el.statStores.textContent = String(data.winkels.length);
    el.statTop.textContent = data.winkels.length ? data.winkels[0].winkel : '—';

    if (vorigeData && typeof vorigeData.totaal === 'number') {
      var verschil = data.totaal - vorigeData.totaal;
      if (vorigeData.totaal > 0) {
        var pct = Math.round((verschil / vorigeData.totaal) * 100);
        el.statDelta.textContent = (verschil >= 0 ? '↑ ' : '↓ ') + Math.abs(pct) + '% t.o.v. vorige maand';
      } else if (data.totaal > 0) {
        el.statDelta.textContent = '↑ nieuw t.o.v. vorige maand';
      } else {
        el.statDelta.textContent = '';
      }
    } else {
      el.statDelta.textContent = '';
    }
  }

  function renderBars(data) {
    el.bars.innerHTML = '';
    el.empty.hidden = data.winkels.length > 0;
    if (!data.winkels.length) return;

    var max = data.winkels[0].kliks || 1;

    data.winkels.forEach(function (w) {
      var row = document.createElement('div');
      row.className = 'kl-bar-row';

      var pct = Math.max(2, Math.round((w.kliks / max) * 100));
      row.innerHTML =
        '<button type="button" class="kl-bar-btn kl-bar-row-main">' +
          '<span class="kl-bar-label">' + escapeHtml(w.winkel) + '</span>' +
          '<span class="kl-bar-track"><span class="kl-bar-fill" style="width:' + pct + '%"></span></span>' +
          '<span class="kl-bar-count">' + w.kliks.toLocaleString('nl-NL') + '</span>' +
          '<span class="kl-bar-chevron">▸</span>' +
        '</button>' +
        '<div class="kl-bar-detail"></div>';

      var btn = row.querySelector('.kl-bar-btn');
      var detail = row.querySelector('.kl-bar-detail');

      btn.addEventListener('click', function () {
        var open = row.classList.contains('kl-open');
        if (open) { row.classList.remove('kl-open'); return; }
        if (!detail.dataset.gevuld) {
          detail.innerHTML = w.producten.map(function (p) {
            var ppct = Math.max(4, Math.round((p.kliks / w.kliks) * 100));
            return '<div class="kl-bar-detail-row">' +
              '<span class="kl-bar-detail-label">' + escapeHtml(p.product) + '</span>' +
              '<span class="kl-bar-detail-track"><span class="kl-bar-detail-fill" style="width:' + ppct + '%"></span></span>' +
              '<span class="kl-bar-detail-count">' + p.kliks.toLocaleString('nl-NL') + '</span>' +
            '</div>';
          }).join('');
          detail.dataset.gevuld = '1';
        }
        row.classList.add('kl-open');
      });

      var totaalDitRapport = data.totaal || 1;
      btn.addEventListener('mouseenter', function (ev) { toonTooltip(ev, w.winkel + ': ' + w.kliks.toLocaleString('nl-NL') + ' kliks (' + Math.round((w.kliks / totaalDitRapport) * 100) + '% van de maand)'); });
      btn.addEventListener('mousemove', verplaatsTooltip);
      btn.addEventListener('mouseleave', verbergTooltip);
      btn.addEventListener('focus', function (ev) { toonTooltipBijElement(btn, w.winkel + ': ' + w.kliks.toLocaleString('nl-NL') + ' kliks'); });
      btn.addEventListener('blur', verbergTooltip);

      el.bars.appendChild(row);
    });
  }

  function renderTabel(data) {
    if (!data.winkels.length) { el.tableWrap.hidden = true; el.tableWrap.innerHTML = ''; return; }
    var rijen = data.winkels.map(function (w) {
      return '<tr><td>' + escapeHtml(w.winkel) + '</td><td class="kl-table-num">' + w.kliks.toLocaleString('nl-NL') + '</td></tr>';
    }).join('');
    el.tableWrap.innerHTML =
      '<table class="kl-table"><thead><tr><th>Winkel</th><th class="kl-table-num">Kliks</th></tr></thead><tbody>' + rijen + '</tbody></table>';
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
        toonTooltip(ev, maandLabel(r.maand) + ': ' + (r.totaal === null ? 'geen data' : r.totaal.toLocaleString('nl-NL') + ' kliks'));
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
    var url = 'api/klik-rapport?maand=' + encodeURIComponent(state.maand) + '&formaat=csv' + (state.test ? '&test=1' : '');
    fetch(url, { headers: { 'x-rapport-sleutel': state.sleutel } })
      .then(function (res) { if (!res.ok) throw new Error('netwerk'); return res.blob(); })
      .then(function (blob) {
        var a = document.createElement('a');
        var objectUrl = URL.createObjectURL(blob);
        a.href = objectUrl;
        a.download = 'fusl-kliks-' + state.maand + (state.test ? '-test' : '') + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 1000);
      })
      .catch(function () { toonFoutmelding(); });
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

    el.gateForm.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var sleutel = el.gateInput.value.trim();
      if (!sleutel) return;
      probeerOntgrendelen(sleutel);
    });

    el.prevBtn.addEventListener('click', function () { state.maand = verschuifMaand(state.maand, -1); verversAlles(); });
    el.nextBtn.addEventListener('click', function () { if (!huidigIsGeselecteerd()) { state.maand = verschuifMaand(state.maand, 1); verversAlles(); } });

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
