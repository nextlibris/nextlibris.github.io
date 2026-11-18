/* Next Libris · app, parte 10 di 10 (app-avvio.js): eventi, installazione e condivisione dell'app, avvio.
   Dal 17/11/2026 app.js è diviso in 10 file (prima era una sola funzione). Sono script classici, senza import:
   le funzioni e le variabili di primo livello sono globali e servono a tutte le parti; l'ordine in index.html
   e in SHELL di sw.js conta (app.js, app-aggiungi.js, …, app-avvio.js: l'ultima fa partire l'app). */
'use strict';
/* ---------- eventi ---------- */
var list = $('#list');
list.addEventListener('input', function (e) {
  var el = e.target, row = el.closest('.row');
  if (!row || row.dataset.ex || !el.dataset.k) return;
  var b = get(row.dataset.id);
  if (!b) return;
  var k = el.dataset.k;
  if (k === 'y') { var v = el.value.replace(/\D/g, '').slice(0, 4); if (v !== el.value) el.value = v; b.y = v; }
  else if (k === 'c') { b.c = L.parseNum(el.value); }
  else if (k === 'i') { var w = el.value.replace(/[^\dXx]/g, '').toUpperCase(); if (w !== el.value) el.value = w; b.i = w; }
  else if (k === 'pg') { var pv = el.value.replace(/\D/g, '').slice(0, 5); if (pv !== el.value) el.value = pv; b.pg = pv; }
  else if (k === 'pp') {                                // segnalibro: solo cifre; la barra e la percentuale si aggiornano mentre scrivi
    var qv = el.value.replace(/\D/g, '').slice(0, 5); if (qv !== el.value) el.value = qv; b.pp = qv; b.ppd = qv ? today() : '';
    var qi = ppInfo(b), box = el.closest('.pp');
    if (box) { var pc = box.querySelector('.pp-pct'), br = box.querySelector('.pp-bar i'); if (pc) pc.textContent = qi.pct != null ? qi.pct + '%' : ''; if (br) br.style.width = (qi.pct || 0) + '%'; }
  }
  else if (k === 'sn' || k === 'sq') { var sv = el.value.replace(/\D/g, '').slice(0, 3); if (sv !== el.value) el.value = sv; b[k] = sv; }
  else { b[k] = el.value.replace(/\s*[\r\n]+\s*/g, ' '); if (el.tagName === 'TEXTAREA') autosize(el); }
  if (b.g.indexOf(k) >= 0) {
    b.g = b.g.filter(function (x) { return x !== k; });
    var f = el.closest('.f');
    if (f) { f.classList.remove('is-guess'); f.removeAttribute('title'); }
    var fl = row.querySelector('.flags');
    if (fl) fl.innerHTML = flagsHTML(b, computeDups());
  }
  touch(); updateSummary();
});
list.addEventListener('change', function (e) {
  var el = e.target;
  if (!el.dataset || !el.dataset.k) return;
  var row = el.closest('.row'), b = row && get(row.dataset.id);
  if (!b) return;
  if (el.dataset.k === 'se' || el.dataset.k === 'sn' || el.dataset.k === 'sq') seriesChanged(b, row, el.dataset.k);
  if (el.dataset.k === 'c') el.value = b.c == null ? '' : L.fmtNum(b.c);
  if (el.dataset.k === 'i') {
    var code = L.toIsbn13(b.i);
    if (code) {
      b.i = code; el.value = code; b.nf = false;
      var other = findByIsbn(code);
      touch();
      if (!b.t && (!other || other.id === b.id)) { S[b.id] = Object.assign(S[b.id] || {}, { st: 'queued' }); refreshRow(b.id); lookupPool(function () { return doLookup(b.id); }); }
      else refreshRow(b.id);
    } else { refreshRow(b.id); }
    updateSummary();
  }
});
/* il riquadro Descrizione: ricorda se è aperto e alla prima apertura cerca il testo */
list.addEventListener('toggle', function (e) {
  var d = e.target;
  if (!d.classList || !d.classList.contains('desc')) return;
  if (d.classList.contains('quotes')) { quoteOpen[d.dataset.id] = d.open; return; }
  descOpen[d.dataset.id] = d.open;
  if (d.open) loadDesc(d.dataset.id, false);
}, true);
list.addEventListener('keydown', function (e) {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset && (((e.target.dataset.act === 'verify' || e.target.dataset.act === 'loan' || e.target.dataset.act === 'recv' || e.target.dataset.act === 'dup') && e.target.classList.contains('tag')) || (e.target.dataset.act === 'toggle' && e.target.classList.contains('sum')) || (e.target.dataset.act === 'zoom' && e.target.classList.contains('thumb')))) { e.preventDefault(); e.target.click(); return; }
  if (e.key === 'Enter' && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT')) { e.preventDefault(); e.target.blur(); }
});
function grpToggle(h, open) {                          // apre o chiude un gruppo (sezione, copertina o riga) e se lo ricorda
  var key = h.dataset.gk, gb = document.getElementById(h.getAttribute('aria-controls'));
  h.setAttribute('aria-expanded', open ? 'true' : 'false'); h.classList.toggle('on', open);
  if (gb) { gb.hidden = !open; if (open) { gcPlace(gb); aufWatch(gb); } }
  if ($('#list').classList.contains('grp-exp') && !h.dataset.pk) { if (open) delete grpShutX[key]; else grpShutX[key] = 1; return; }   // serie e copie: sempre ricordate
  if (open) settings.grpOpen[key] = 1; else delete settings.grpOpen[key];
  saveSettings();
}
list.addEventListener('click', function (e) {          // gruppi a copertine o a righe, riquadro dei libri, Espandi / Comprimi tutto
  var x = e.target.closest('.gcard, .grow, .gp-x, [data-gx], .gp-who'); if (!x || (selOn && !/^p:/.test(x.dataset.gk || ''))) return;   // in selezione si aprono serie e copie (giro 1)
  e.stopImmediatePropagation();
  if (x.dataset.gx) {
    var on = x.dataset.gx === '1'; grpShutX = {};
    if (q || activeCount()) grpFltShut = on ? '' : fltSig();   // con filtri o ricerca non cambia la scelta di sempre
    else { settings.grpExp = on ? 1 : 0; grpFltShut = ''; }
    if (!on) settings.grpOpen = {};
    saveSettings(); renderList(); return;
  }
  if (x.classList.contains('gp-who')) { openAuthor(x.dataset.gid, x.dataset.gau); return; }
  if (x.classList.contains('gp-x')) { var c = $('#list').querySelector('.gcard[data-gk="' + CSS.escape(x.dataset.gk) + '"], .grow[data-gk="' + CSS.escape(x.dataset.gk) + '"]'); if (c) { grpToggle(c, false); try { c.focus({ preventScroll: true }); } catch (er) { nlErr(er); } } return; }
  grpToggle(x, x.getAttribute('aria-expanded') !== 'true');
}, true);
list.addEventListener('click', function (e) {          // sezioni «In lettura» / «Gli altri libri»: si aprono e chiudono, e se lo ricorda
  var sh = e.target.closest('.shelf-h'); if (!sh) return;
  e.stopImmediatePropagation();
  var k = sh.dataset.shelf, open = sh.getAttribute('aria-expanded') !== 'true';
  sh.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (sh.dataset.gk) { grpToggle(sh, open); return; }  // gruppo di «Raggruppa per»
  var body = document.getElementById('shelf-' + k); if (body) { body.hidden = !open; if (open) { gcPlace(body); aufWatch(body); } }
  settings.shelfShut = settings.shelfShut || {}; if (open) delete settings.shelfShut[k]; else settings.shelfShut[k] = 1; saveSettings();
}, true);
list.addEventListener('click', function (e) {
  var cov = e.target.closest('.cover');
  if (cov) { openFromGrid(cov.dataset.id); return; }
  var btn = e.target.closest('[data-act]');
  if (!btn) return;
  if (btn.dataset.act === 'clearflt') { clearFilters(); return; }
  if (btn.dataset.act === 'typeadd') { openIsbnSheet(); return; }
  if (btn.dataset.act === 'way-scan') { $('#btnScan').click(); return; }
  if (btn.dataset.act === 'way-photo') { $('#btnPhoto').click(); return; }
  if (btn.dataset.act === 'way-type') { $('#btnType').click(); return; }
  if (btn.dataset.act === 'restore') { $('#fileBackup').click(); return; }
  var row = btn.closest('.row');
  if (!row) return;
  var id = row.dataset.id, act = btn.dataset.act;
  if (act === 'del') {                                       // prima chiedo conferma (non per una riga vuota appena aggiunta)
    var db0 = get(id);
    if (db0 && hasData(db0)) askConfirm('Eliminare il libro?', '«' + (db0.t || db0.i || 'Senza titolo') + '»' + (db0.a ? ' di ' + db0.a : '') + '. Subito dopo puoi ancora annullare.', 'Elimina', function () { delBook(id); });
    else delBook(id);
  }
  else if (act === 'retry') retryRow(id);
  else if (act === 'choose') openPick(id);
  else if (act === 'manual') openManual(id);
  else if (act === 'ocrtext') applyOcrText(id);
  else if (act === 'loan') openLoan(id);
  else if (act === 'returned') { loanId = id; returnLoan(); }
  else if (act === 'recv') emit('recv', id);      // «Prestato da …»: lo gestisce il modulo amici
  else if (act === 'toggle') toggleRow(id);
  else if (act === 'dup') openDup(id);
  else if (act === 'facet') applyFacet(btn.dataset.f, btn.dataset.v, btn.dataset.name);
  else if (act === 'towish') moveToWish(id);
  else if (act === 'fav') toggleFav(id);
  else if (act === 'lc') toggleLc(id);
  else if (act === 'quotepin') togglePin(id, +btn.dataset.i);
  else if (act === 'share') { var sb = get(id); if (sb) openShare([sb], { kind: 'book' }); }
  else if (act === 'tolib') moveToLib(id);
  else if (act === 'addcopy') addCopy(id);
  else if (act === 'serall') seriesAll(id);
  else if (act === 'sermiss') seriesMissing(id);
  else if (act === 'quoteadd') openQuote(id, null);
  else if (act === 'quoteshareall') shareAllQuotes(id);
  else if (act === 'quoteshare') shareQuote(id, +btn.dataset.i);
  else if (act === 'quotedel') { var qb = get(id), qi = +btn.dataset.i; if (qb && qb.qs && qb.qs[qi]) { var qold = qb.qs.splice(qi, 1)[0]; touch(); paintQuotes(id); toast('Citazione eliminata.', { label: 'Annulla', fn: function () { var x = get(id); if (x) { x.qs.splice(Math.min(qi, x.qs.length), 0, qold); touch(); paintQuotes(id); } } }); } }
  else if (act === 'quoteedit') openQuote(id, +btn.dataset.i);
  else if (act === 'descmore') { descFull[id] = true; paintDesc(id); }
  else if (act === 'descdel') { var dd = get(id); if (dd) { dd.ds = ''; dd.dsf = ''; dd.dsl = ''; dd.dsn = Date.now(); touch(); paintDesc(id); toast('Descrizione rimossa'); } }
  else if (act === 'rs' || act === 'rt') setRead(id, act, btn.dataset.v);
  else if (act === 'auinfo') openAuthor(id, btn.dataset.n);
  else if (act === 'auedit') editAuthor(id);
  else if (act === 'author') { q = btn.dataset.q; $('#q').value = q; flt = ''; readFlt = ''; shFlt = ''; genFlt = ''; renderList(); updateSummary(); window.scrollTo({ top: 0 }); toast('Libri di ' + q + '. Svuota la ricerca per vederli tutti.'); }
  else if (act === 'zoom') openCover(id);
  else if (act === 'coverphoto') coverTap(id);
  else if (act === 'kdpphoto') photoForBook(id);
  else if (act === 'bought') moveToLib(id);
  else if (act === 'priceweb') {
    var pw = get(id);
    if (pw) window.open('https://www.google.com/search?q=' + encodeURIComponent((L.toIsbn13(pw.i) || [pw.t, pw.a].filter(Boolean).join(' ')) + ' prezzo di copertina libro'), '_blank', 'noopener');
  }
  else if (act === 'verify') {
    var vb = get(id);
    if (vb && vb.g.length) {
      var snap = vb.g.slice();
      vb.g = []; refreshRow(id); touch(); updateSummary();
      toast('Segnato come verificato.', { label: 'Annulla', fn: function () { var x = get(id); if (x) { x.g = snap; refreshRow(id); touch(); updateSummary(); } } });
    }
  }
  else if (act === 'web' || act === 'websearch') {
    var wb = get(id);
    if (wb) window.open('https://www.google.com/search?q=' + encodeURIComponent(wb.t ? [wb.t, L.str(wb.a).split(/[,;]/)[0], 'libro'].filter(Boolean).join(' ') : (L.toIsbn13(wb.i) || wb.i) + ' libro'), '_blank', 'noopener');
  }
  else if (act === 'lookup') {
    var b = get(id);
    if (b) { b.nf = false; S[id] = Object.assign(S[id] || {}, { st: 'queued' }); refreshRow(id); lookupPool(function () { return doLookup(id); }); }
  }
});

bindFile('#fileCam', function (f) { addPhotos(f, true); });
bindFile('#fileGal', function (f) {
  var n = Array.prototype.filter.call(f || [], function (x) { return !x.type || x.type.indexOf('image/') === 0; }).length;
  addPhotos(f, n === 1);                       // una foto sola: chiede anche il prezzo, come dalla fotocamera
  if (n > 1) toast((n > 60 ? 'Ne ho prese 60 su ' + n : 'Aggiunte ' + n + ' foto') + ': le riconosco una alla volta, intanto puoi continuare.');
});
$('#priceSkip').addEventListener('click', closePriceAsk);
$('#priceUndo').addEventListener('click', function () {
  var id = askId, b = bookFor(id); closePriceAsk();
  if (b) { state.books = state.books.filter(function (x) { return x.id !== b.id; }); delete S[b.id]; } else if (id) { state.books = state.books.filter(function (x) { return x.id !== id; }); delete S[id]; }
  touch(); renderList(); updateSummary(); toast('Libro tolto.');
});
$('#priceAskIn').addEventListener('input', function () { $('#priceAskErr').hidden = true; });
bindFile('#fileBackup', function (f) { restore(f[0]); });
$('#btnScan').addEventListener('click', startScan);
$('#btnPhoto').addEventListener('click', function () { $('#photoSheet').hidden = false; });
$('#photoCam').addEventListener('click', function () { $('#photoSheet').hidden = true; snapPhoto('Foto del libro', '#fileCam').then(function (f) { if (f) addPhotos([f], true); }); });
$('#photoGal').addEventListener('click', function () { $('#photoSheet').hidden = true; $('#fileGal').click(); });
$('#photoClose').addEventListener('click', function () { $('#photoSheet').hidden = true; });
$('#btnType').addEventListener('click', openIsbnSheet);
$('#scanClose').addEventListener('click', function () { stopScan(false); });
$('#scanDone').addEventListener('click', function () { stopScan(false); });
$('#scanTorch').addEventListener('click', toggleTorch);
$('#scanFlash').addEventListener('click', toggleScanFlash);
window.addEventListener('popstate', function () { if (scanning) { pushed = false; stopScan(true); } });
$('#isbnCancel').addEventListener('click', function () { $('#isbnSheet').hidden = true; });
$('#isbnGo').addEventListener('click', submitIsbn);
$('#pickClose').addEventListener('click', function () { if (flow.id === pickId) flow.id = null; closePick(); });
$('#pickText').addEventListener('click', function () { var id = pickId; closePick(); if (id) { applyOcrText(id); flowAfterPick(id); } });
$('#pickMan').addEventListener('click', function () { var id = pickId, inFlow = flow.id === id; closePick(); if (id) { if (inFlow) flow.id = null; openManual(id, inFlow); } });
$('#pickList').addEventListener('click', function (e) {
  var b = e.target.closest('.cand');
  if (!b || pickId == null) return;
  var s = S[pickId], c = s && s.cands && s.cands[+b.dataset.i];
  var id = pickId;
  closePick();
  if (c) { applyCandidate(id, c); flowAfterPick(id); }
});
$('#copyClose').addEventListener('click', function () { $('#copySheet').hidden = true; });
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  if (drawerOpen) { closeDrawer(); return; }
  if (optOpen) { closeOptions(); return; }
  if (!$('#lightbox').hidden) { closeCover(false); return; }
  if (!$('#instSheet').hidden) { closeInstallHelp(); return; }
  if (!$('#covSheet').hidden) { closeCovAsk(); return; }
  if (!$('#shareSheet').hidden) { closeShare(); return; }
  if (!$('#importSheet').hidden) { closeImport(); return; }
  if (!$('#quoteSheet').hidden) { closeQuote(); return; }
  if (!$('#ped').hidden) { closePed(null); return; }
  if (!$('#snap').hidden) { closeSnap(null); return; }
  if (!$('#phView').hidden) { closePh(false); return; }
  if (!$('#logSheet').hidden) { closeLog(); return; }
  if (!$('#woSheet').hidden) { closeWorks(); return; }
  if (!$('#filmSheet').hidden) { closeFilms(); return; }
  if (!$('#auSheet').hidden) { closeAuthor(); return; }
  if (!$('#confirmSheet').hidden) { $('#confirmSheet').hidden = true; confirmFn = null; return; }
  if (!$('#bulkSheet').hidden) { $('#bulkSheet').hidden = true; return; }
  if (selOn) { endSel(false); return; }
  if (!$('#donSheet').hidden) { closeDon(); return; }
  if (!$('#manSheet').hidden) { closeManual(); return; }
  if (!$('#recSheet').hidden) { flowLater(); return; }
  if (!$('#allqSheet').hidden) { closeAllQuotes(); return; }
  if (!$('#newsSheet').hidden) { $('#newsSheet').hidden = true; return; }
  if (!$('#suggSheet').hidden) { closeSugg(); return; }
  if (!$('#wnSheet').hidden) { closeWhatsNew(); return; }
  if (!$('#priceAsk').hidden) closePriceAsk();
  if (!$('#bkFailSheet').hidden) { $('#bkFailSheet').hidden = true; return; }
  ['#statsSheet', '#exportSheet', '#pubSheet', '#dupSheet', '#photoSheet'].forEach(function (k) { $(k).hidden = true; });
  if (!$('#loanSheet').hidden) closeLoan();
});
/* ---- Finestre dal basso: si chiudono anche trascinandole verso il basso (se il contenuto e' gia' in cima).
   La finestra segue il dito; oltre una certa distanza, o con un gesto veloce, si chiude come con la sua X. ---- */
var sdrag = null;
function closeSheetEl(sh) {
  function hide() { sh.hidden = true; }
  var map = {
    covSheet: closeCovAsk, shareSheet: closeShare, importSheet: closeImport,
    quoteSheet: closeQuote, suggSheet: closeSugg, wnSheet: closeWhatsNew, logSheet: function () { closeLog(); }, auSheet: closeAuthor, donSheet: function () { closeDon(); }, manSheet: closeManual,
    recSheet: flowLater, allqSheet: closeAllQuotes, priceAsk: closePriceAsk, loanSheet: closeLoan, instSheet: closeInstallHelp,
    confirmSheet: function () { hide(); confirmFn = null; },
    pickSheet: function () { $('#pickClose').click(); }, isbnSheet: function () { $('#isbnCancel').click(); }, copySheet: function () { $('#copyClose').click(); }
  };
  try { (map[sh.id] || hide)(); } catch (e) { nlErr(e); }
  if (!sh.hidden) hide();
}
function scrolledInside(el, top) { for (; el && el !== top.parentNode; el = el.parentElement) if (el.scrollTop > 0) return true; return false; }
document.addEventListener('touchstart', function (e) {
  sdrag = null;
  if (e.touches.length !== 1) return;
  var t = e.target, sh = t.closest && t.closest('.sheet');
  if (!sh || sh.hidden) return;
  var inn = sh.querySelector('.sheet-in');
  if (!inn || !inn.contains(t) || t.closest('input, textarea, select, canvas, #bkPrev, [data-nodrag]') || scrolledInside(t, inn)) return;
  sdrag = { sh: sh, inn: inn, y0: e.touches[0].clientY, x0: e.touches[0].clientX, t0: Date.now(), dy: 0, on: false };
}, { passive: true });
document.addEventListener('touchmove', function (e) {
  if (!sdrag) return;
  var p = e.touches[0], dy = p.clientY - sdrag.y0, dx = p.clientX - sdrag.x0;
  if (!sdrag.on) {
    if (Math.abs(dy) < 8 && Math.abs(dx) < 8) return;
    if (dy <= 0 || Math.abs(dx) > dy) { sdrag = null; return; }       // verso l'alto o di lato: si scorre come sempre
    sdrag.on = true; sdrag.t0 = Date.now(); sdrag.y0 = p.clientY - 1;
    sdrag.inn.style.transition = 'none'; sdrag.sh.style.transition = 'none';
  }
  sdrag.dy = Math.max(0, p.clientY - sdrag.y0);
  sdrag.inn.style.transform = 'translateY(' + sdrag.dy + 'px)';
  sdrag.sh.style.backgroundColor = 'rgba(0,0,0,' + (0.5 * Math.max(0.2, 1 - sdrag.dy / 600)).toFixed(3) + ')';
  if (e.cancelable) e.preventDefault();
}, { passive: false });
function endSheetDrag() {
  var d = sdrag; sdrag = null;
  if (!d || !d.on) return;
  var h = d.inn.getBoundingClientRect().height, v = d.dy / Math.max(1, Date.now() - d.t0);
  var close = d.dy > Math.min(140, h * 0.35) || (v > 0.6 && d.dy > 40);
  d.inn.style.transition = 'transform .2s ease';
  function reset() { d.inn.style.transform = ''; d.inn.style.transition = ''; d.sh.style.backgroundColor = ''; d.sh.style.transition = ''; }
  if (close) { d.inn.style.transform = 'translateY(' + Math.round(h + 40) + 'px)'; setTimeout(function () { closeSheetEl(d.sh); reset(); }, 190); }
  else { d.inn.style.transform = ''; d.sh.style.backgroundColor = ''; setTimeout(reset, 220); }
}
document.addEventListener('touchend', endSheetDrag);
document.addEventListener('touchcancel', endSheetDrag);
$('#q').addEventListener('input', function (e) { q = e.target.value; collapseCards(); renderList(); });
$('#qX').addEventListener('click', function () { q = ''; $('#q').value = ''; collapseCards(); renderList(); updateSummary(); });   // solo il testo: i filtri restano (giro 5)
/* × in alto a destra in tutte le finestre (Piero, 17/11/2026 sera): si aggiunge da sola a ogni finestra che ha «Chiudi» o «Ho capito»
   (anche a quelle create dai moduli) e fa lo stesso tocco di quel tasto, che resta in fondo. Le richieste con «Annulla» restano com'erano. */
function sheetCloser(s) {
  var bs = Array.prototype.slice.call(s.querySelectorAll('.sheet-in button')).filter(function (b) { return !b.classList.contains('sh-x') && !b.closest('.sheet-in .sheet'); });
  return bs.filter(function (b) { return /^\s*Chiudi\s*$/.test(b.textContent); }).pop() || bs.filter(function (b) { return /^\s*Ho capito\s*$/.test(b.textContent); }).pop() || null;
}
function sheetX(s) {
  if (s.dataset.x) return;
  var inn = s.querySelector(':scope > .sheet-in'); if (!inn) return;
  var has = Array.prototype.some.call(inn.querySelectorAll('button'), function (b) { return /^×$/.test(b.textContent.trim()); });   // ha gia' la sua ×
  if (has) { s.dataset.x = '1'; return; }
  if (!sheetCloser(s)) return;                     // senza «Chiudi»: si riprova quando la finestra cambia
  s.dataset.x = '1';
  var x = document.createElement('button'); x.type = 'button'; x.className = 'ico sh-x'; x.setAttribute('aria-label', 'Chiudi'); x.textContent = '×';
  x.addEventListener('click', function (e) { e.stopPropagation(); var c = sheetCloser(s); if (c) c.click(); else s.hidden = true; });
  inn.insertBefore(x, inn.firstChild); inn.classList.add('has-x');
}
function sheetsX() { Array.prototype.forEach.call(document.querySelectorAll('.sheet:not([data-x])'), sheetX); }
if (window.MutationObserver) new MutationObserver(function (ms) {
  if (ms.some(function (m) { return m.type === 'childList' ? m.addedNodes.length : m.target.classList && m.target.classList.contains('sheet') && !m.target.hidden; })) sheetsX();
}).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
sheetsX();
/* «Ordina per» e «Raggruppa per»: al posto della tendina del telefono (Android la apre scura e fuori stile) un tasto che apre
   una finestrella dell'app con l'elenco e i pallini (Piero, 17/11/2026 sera). La <select> resta, nascosta: tiene il valore. */
var pickOpen = null;
function pickSync() {
  Array.prototype.forEach.call(document.querySelectorAll('select.dsel'), function (s) {
    var b = s.nextElementSibling; if (!b || !b.classList.contains('dpick')) return;
    var o = s.options[s.selectedIndex], pre = s.dataset.pre || '';   // nella riga sotto la ricerca: «Raggruppa: Autore», senza gruppo solo «Raggruppa»
    b.querySelector('.dp-t').textContent = !o ? '' : !o.value && s.dataset.none ? s.dataset.none : pre + (o.dataset.s || o.textContent);
    b.classList.toggle('sb-on', !!(o && o.value && s.dataset.none));
  });
}
function pickClose(focus) {
  var m = $('#pickPop'); if (!m || m.hidden) return;
  m.hidden = true; if (pickOpen) { pickOpen.btn.setAttribute('aria-expanded', 'false'); if (focus) pickOpen.btn.focus(); }
  pickOpen = null;
}
function pickShow(s, btn) {
  var m = $('#pickPop');
  if (!m) {
    m = document.createElement('div'); m.id = 'pickPop'; m.className = 'pick-pop'; m.setAttribute('role', 'listbox'); m.hidden = true;
    m.addEventListener('click', function (e) {
      var o = e.target.closest('[data-v]'); if (!o || !pickOpen) return;
      var sel = pickOpen.sel; pickClose(true);
      if (sel.value !== o.dataset.v) { sel.value = o.dataset.v; sel.dispatchEvent(new Event('change', { bubbles: true })); }
      pickSync();
    });
  }
  var bar = btn.closest('.sortbar');                       // nella riga «Ordina · Raggruppa» l'elenco va sotto la riga intera
  if (bar) bar.appendChild(m); else btn.parentNode.insertBefore(m, btn.nextSibling);
  var lab = document.getElementById(s.getAttribute('aria-labelledby'));
  m.setAttribute('aria-label', lab ? lab.textContent : '');
  m.innerHTML = Array.prototype.map.call(s.options, function (o) {
    var on = o.value === s.value;
    return '<button type="button" class="pk-o" role="option" data-v="' + esc(o.value) + '" aria-selected="' + on + '"><span class="pk-dot" aria-hidden="true"></span><span>' + esc(o.textContent) + '</span></button>';
  }).join('');
  m.hidden = false; pickOpen = { sel: s, btn: btn }; btn.setAttribute('aria-expanded', 'true');
  var cur = m.querySelector('[aria-selected="true"]') || m.querySelector('.pk-o'); try { cur.focus({ preventScroll: true }); } catch (e) { nlErr(e); }
  try { m.scrollIntoView({ block: 'nearest' }); } catch (e) { nlErr(e); }
}
Array.prototype.forEach.call(document.querySelectorAll('select.dsel'), function (s) {
  var b = document.createElement('button'); b.type = 'button'; b.className = 'dpick'; b.setAttribute('aria-haspopup', 'listbox'); b.setAttribute('aria-expanded', 'false');
  if (s.getAttribute('aria-labelledby')) b.setAttribute('aria-labelledby', s.getAttribute('aria-labelledby') + ' ' + (s.id + 'Pick'));
  var ic = s.id === 'sort' ? '<svg class="sb-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/></svg>'
    : s.id === 'grp' ? '<svg class="sb-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="14" y="4" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>' : '';
  b.innerHTML = ic + '<span class="dp-t" id="' + s.id + 'Pick"></span><svg class="dp-c" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  s.hidden = true; s.tabIndex = -1; s.parentNode.insertBefore(b, s.nextSibling);
  b.addEventListener('click', function () { if (pickOpen && pickOpen.btn === b) pickClose(); else { pickClose(); pickShow(s, b); } });
  s.addEventListener('change', pickSync);
});
document.addEventListener('click', function (e) { if (pickOpen && !e.target.closest('#pickPop, .dpick')) pickClose(); }, true);
window.addEventListener('keydown', function (e) {
  if (!pickOpen) return;
  if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); pickClose(true); return; }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    var os = Array.prototype.slice.call(document.querySelectorAll('#pickPop .pk-o')), i = os.indexOf(document.activeElement);
    e.preventDefault(); (os[Math.max(0, Math.min(os.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))] || os[0]).focus();
  }
}, true);
pickSync();
$('#sort').addEventListener('change', function (e) { sortBy = e.target.value; if (!guest && SORTS.indexOf(sortBy) >= 0) { settings.sortBy = sortBy; saveSettings(); } renderList(); });   // l'ultimo ordine resta (giro 1)
$('#grp').addEventListener('change', function (e) { settings.grp = GRP_TXT[e.target.value] ? e.target.value : ''; saveSettings(); renderList(); if (drawerOpen) { updateDrawerFoot(); renderDrawer(); } });
$('#fltGuess').addEventListener('click', function () { flt = flt === 'guess' ? '' : 'guess'; collapseCards(); updateSummary(); renderList(); });
$('#fltLoan').addEventListener('click', function () {
  collapseCards();
  var on = !(flt === 'loan' && tab === 'lib');
  if (tab !== 'lib') setTab('lib');
  flt = on ? 'loan' : '';
  updateSummary(); renderList();
  if (on) toast(allLoansText());
});
function allLoansText() {
  var n = state.books.filter(function (b) { return !b.w && !b.xs && isLoan(b); }).length;
  return n ? (n === 1 ? '1 libro in prestito.' : n + ' libri in prestito: prestati a e prestati da, per persona.') + (document.querySelector('#fltLoan') && document.querySelector('#fltLoan').offsetParent ? ' Tocca di nuovo «Prestati» per vederli tutti.' : ' Tocca di nuovo «in prestito» per vederli tutti.') : 'Nessun libro in prestito.';
}
$('#tabLib').addEventListener('click', function () { if (guest) guestExit(true); setTab('lib'); });   // Libreria e Desideri: sempre i tuoi (Piero, 17/11/2026 sera)
$('#tabWish').addEventListener('click', function () { if (guest) guestExit(true); setTab('wish'); });
$('#btnView').addEventListener('click', function () {
  gridRet = null;
  setView(settings.view === 'grid' ? 'list' : 'grid');
  if (!guest) { settings.viewDef = settings.view; saveSettings(); }   // l'app ricorda l'ultima vista (giro 1, 18/11/2026)
  renderList();
});
$('#btnCheck').addEventListener('click', function () { startScan('check'); });
$('#btnStats').addEventListener('click', openStats);
$('#statsClose').addEventListener('click', function () { $('#statsSheet').hidden = true; });
$('#statsBody').addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.id === 'goalIn') { e.preventDefault(); saveGoal(); } });
$('#statsBody').addEventListener('click', function (e) {
  if (e.target.closest('#goalSave')) { saveGoal(); return; }
  var sq = e.target.closest('[data-q]');               // serie e collane: come «Vedi i libri della serie», con la ricerca
  if (sq) { flt = ''; readFlt = ''; shFlt = ''; genFlt = ''; autFlt = ''; autName = ''; edFlt = ''; frFlt = ''; paFlt = ''; q = sq.dataset.q; $('#q').value = q; $('#statsSheet').hidden = true; collapseCards(); renderList(); updateSummary(); window.scrollTo({ top: 0 }); return; }
  var r = e.target.closest('[data-sf]');
  if (!r) return;
  /* un vero filtro (autore, casa editrice, genere, scaffale), non una ricerca: si vede e si toglie dai filtri del menu (Piero, 16/11/2026) */
  var f = r.dataset.sf, v = r.dataset.sv;
  $('#statsSheet').hidden = true;
  if (f === 'pa') { applyFacet('pa', v, wdCName(v)); return; }   // paese dell'autore: la chiave e' il codice
  applyFacet(f, facetKey(v), v);
});
function openExport() {
  if (guest) guestExit(true);                      // «Per te» e il Menu parlano sempre della tua libreria (Piero, 17/11/2026 sera)
  var n = exportBooks().length;
  $('#exportMsg').textContent = n ? 'Esporto i ' + n + (n === 1 ? ' libro' : ' libri') + ' della scheda ' + (tab === 'wish' ? 'Desideri' : 'Libreria') + ', con le colonne che hanno dei dati.' : 'La scheda ' + (tab === 'wish' ? 'Desideri' : 'Libreria') + ' è vuota.';
  updateBackupInfo();
  $('#backupNote').textContent = '';
  prepBackup();
  $('#exportSheet').hidden = false;
}
$('#btnExport').addEventListener('click', openExport);
$('#exportClose').addEventListener('click', function () { $('#exportSheet').hidden = true; });
$('#btnXlsx').addEventListener('click', saveXLSX);
$('#btnShareBackup').addEventListener('click', shareBackup);
$('#loanCancel').addEventListener('click', closeLoan);
$('#loanSave').addEventListener('click', saveLoan);
$('#loanBack').addEventListener('click', returnLoan);
$('#loanKind').addEventListener('click', function (e) { var x = e.target.closest('[data-k]'); if (x) setLoanKind(x.dataset.k); });
$('#loanWho').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); saveLoan(); } });
$('#btnPubs').addEventListener('click', openPubs);
$('#pubCancel').addEventListener('click', function () { $('#pubSheet').hidden = true; });
$('#pubApply').addEventListener('click', applyPubs);
$('#pubList').addEventListener('change', function (e) {
  if (e.target.type !== 'radio') return;
  var gi = e.target.name.slice(2);
  document.querySelectorAll('#pubList input[data-g="' + gi + '"]').forEach(function (cb) { var me = cb.dataset.n === e.target.value; cb.disabled = me; if (me) cb.checked = true; });
});
$('#btnFill').addEventListener('click', fillMissing);
$('#btnMergeDups').addEventListener('click', mergeDups);
$('#dupCopies').addEventListener('click', dupCopies);
$('#dupMerge').addEventListener('click', dupMerge);
$('#dupUnmark').addEventListener('click', dupUnmark);
$('#dupClose').addEventListener('click', closeDup);
$('#btnShareWish').addEventListener('click', shareWish);
$('#btnPrint').addEventListener('click', printCatalog);
$('#sort').addEventListener('change', function () { if (drawerOpen) updateDrawerFoot(); });
$('#btnVerifyAll').addEventListener('click', function () {
  var snapshot = JSON.stringify(state.books), n = 0;
  state.books.forEach(function (b) { if (b.g.length) { b.g = []; n++; } });
  if (!n) { toast('Non ci sono libri da verificare.'); return; }
  if (flt === 'guess') flt = '';
  renderList(); touch(); updateSummary();
  toast(n + (n === 1 ? ' libro segnato come verificato.' : ' libri segnati come verificati.'), { label: 'Annulla', fn: function () { state.books = JSON.parse(snapshot); renderList(); touch(); updateSummary(); } });
});
$('#btnTodo').addEventListener('click', runTodo);
$('#btnCopy').addEventListener('click', copyTSV);
$('#btnCsv').addEventListener('click', saveCSV);
$('#btnBackup').addEventListener('click', backup);
$('#btnRestore').addEventListener('click', function () { $('#fileBackup').click(); });
$('#btnDiag').addEventListener('click', async function () {
  var out = $('#diagOut'), btn = $('#btnDiag');
  btn.disabled = true; out.hidden = false; out.textContent = 'Provo le banche dati…';
  try {
    var res = await L.diagnose(lookupOpts());
    out.innerHTML = res.map(function (r) { return '<div class="' + (r.ok ? 'diag-ok' : 'diag-bad') + '"><b>' + (r.ok ? '✓ ' : '✗ ') + r.name + '</b>: ' + esc(r.msg) + '</div>'; }).join('');
  } catch (e) { out.textContent = 'Prova non riuscita.'; }
  btn.disabled = false;
});
$('#btnGuessPub').addEventListener('click', function () {
  var snapshot = JSON.stringify(state.books), n = 0, sure = 0, missing = 0;
  state.books.forEach(function (b) {
    if (b.e || !L.toIsbn13(b.i)) return;
    var r = guessEditor(b);
    if (r) { n++; if (r === 'sure') sure++; } else missing++;
  });
  if (!n) { toast(missing ? 'Non riesco a dedurre le case editrici: servono altri libri dello stesso editore già completi.' : 'Tutti i libri hanno già la casa editrice.'); return; }
  renderList(); touch(); updateSummary();
  var unsure = n - sure;
  toast('Dedotte ' + n + (n === 1 ? ' casa editrice' : ' case editrici') + ' dall\'ISBN' + (sure ? ': ' + sure + (sure === 1 ? ' confermata' : ' confermate') + ' dai tuoi libri' : '') + (unsure ? (sure ? ', ' : ': ') + unsure + ' «Da verificare»' : '') + '.', { label: 'Annulla', fn: function () { state.books = JSON.parse(snapshot); renderList(); touch(); updateSummary(); } });
});
$('#btnInstDiag').addEventListener('click', async function () {
  var out = $('#instOut'), btn = $('#btnInstDiag');
  btn.disabled = true; out.hidden = false; out.textContent = 'Controllo…';
  var rows = [];
  function add(ok, name, msg) { rows.push('<div class="' + (ok ? 'diag-ok' : 'diag-bad') + '"><b>' + (ok ? '✓ ' : '✗ ') + esc(name) + '</b>: ' + esc(msg) + '</div>'); }
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  if (standalone) rows.push('<div class="diag-ok"><b>✓ Stai già usando l\'app installata.</b></div>');
  var secureOk = location.protocol === 'https:' || location.hostname === 'localhost';
  add(secureOk, 'Indirizzo sicuro (https)',
    secureOk ? 'ok' : 'l\'indirizzo inizia con «' + location.protocol + '»: Chrome installa solo da indirizzi https (per esempio https://nome.netlify.app). Apri la versione pubblicata, non il file sul telefono o sul computer.');
  var ua = navigator.userAgent || '';
  var inApp = /; wv\)|FBAN|FBAV|Instagram|Line\/|Telegram|WhatsApp|GSA\/|Snapchat/i.test(ua);
  var other = /SamsungBrowser|OPR\/|Firefox|EdgA|Edg\/|DuckDuckGo|Brave/i.test(ua);
  add(/Chrome\//.test(ua) && !inApp && !other, 'Aperta in Google Chrome',
    inApp ? 'sembra aperta dentro un\'altra app (WhatsApp, Gmail, Telegram…): copia l\'indirizzo e aprilo direttamente in Chrome.'
      : (other || !/Chrome\//.test(ua)) ? 'non sembra Chrome: apri l\'indirizzo con Google Chrome.' : 'ok');
  var siteOk = secureOk;
  try {
    var reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    var swErr = '';
    if (!(reg && reg.active) && 'serviceWorker' in navigator) {
      try {
        reg = await navigator.serviceWorker.register('sw.js');
        await Promise.race([navigator.serviceWorker.ready, new Promise(function (_, no) { setTimeout(function () { no(new Error('non si attiva entro 6 secondi: probabilmente manca qualche file')); }, 6000); })]);
      } catch (e5) { swErr = (e5 && e5.message) || String(e5); }
      reg = await navigator.serviceWorker.getRegistration();
    }
    var swOk = !!(reg && reg.active);
    siteOk = siteOk && swOk;
    add(swOk, 'Funzionamento offline (service worker)', swOk ? 'attivo' : 'non parte' + (swErr ? ': ' + swErr : '') + '. Chiudi e riapri la pagina e ricontrolla; se resta cosi\' ricarica la cartella su Netlify (manca qualche file).');
  } catch (e) { siteOk = false; add(false, 'Funzionamento offline (service worker)', 'non disponibile in questo browser.'); }
  try {
    var mlink = document.querySelector('link[rel="manifest"]').href;
    var mr = await fetch(mlink, { cache: 'no-store' });
    var ct = mr.headers.get('content-type') || '';
    var mj = mr.ok ? await mr.json() : null;
    var icons = (mj && mj.icons) || [];
    var has = function (sz) { return icons.some(function (ic) { return (ic.sizes || '').split(/\s+/).indexOf(sz) >= 0; }); };
    var mOk = !!(mj && mj.name && mj.start_url && has('192x192') && has('512x512'));
    siteOk = siteOk && mOk;
    add(mOk, 'Scheda dell\'app (manifest)', mr.ok ? (mOk ? 'ok (' + (ct.split(';')[0] || 'tipo non indicato') + ')' : 'incompleta: mancano nome, start_url o icone 192 e 512 px')
      : (mr.status === 401 || mr.status === 403) ? 'errore ' + mr.status + ': il server rifiuta l\'accesso a questo file. Il sito sembra protetto (password o accesso riservato) oppure e\' un sito temporaneo non ancora collegato a un account: nelle impostazioni del sito su Netlify cerca la protezione con password / accesso riservato e disattivala, poi ricontrolla.'
      : 'errore ' + mr.status + ' nel caricarla: ricarica la cartella su Netlify.');
    var bad = [];
    for (var ii = 0; ii < icons.length; ii++) {
      try {
        var ir = await fetch(new URL(icons[ii].src, mlink).href, { cache: 'no-store' });
        var ict = ir.headers.get('content-type') || '';
        if (!ir.ok) bad.push(icons[ii].src + ' (errore ' + ir.status + ')');
        else if (!/image\//.test(ict)) bad.push(icons[ii].src + ' (non e\' un\'immagine: ' + (ict || 'tipo ignoto') + ')');
      } catch (e6) { bad.push(icons[ii].src + ' (non raggiungibile)'); }
    }
    siteOk = siteOk && !bad.length;
    add(!bad.length && icons.length > 0, 'Icone dell\'app', !icons.length ? 'nessuna icona nella scheda dell\'app.' : bad.length ? 'non si caricano: ' + bad.join(', ') + '. Ricarica la cartella intera su Netlify, cartella «icons» compresa.' : 'ok (' + icons.length + ')');
  } catch (e) { siteOk = false; add(false, 'Scheda dell\'app (manifest)', 'non riesco a leggerla.'); }
  try {
    var probes = ['manifest.json', 'style.css', 'sw.js', 'icons/next-libris-192.png'], res = [], odd = false;
    for (var pk = 0; pk < probes.length; pk++) {
      var st;
      try { st = (await fetch(probes[pk] + '?t=' + Date.now(), { cache: 'no-store' })).status; } catch (e7) { st = 'rete'; }
      if (st !== 200) odd = true;
      res.push(probes[pk].split('/').pop() + ' ' + st);
    }
    add(!odd, 'Accesso ai file del sito', res.join(', ') + (odd ? '. Se un file risponde 401 o 403 e gli altri 200, quel file e\' bloccato dal server: manda questo risultato.' : ''));
    if (odd) siteOk = false;
  } catch (e) { nlErr(e); }
  var cv = (ua.match(/Chrome\/(\d+)/) || [])[1];
  add(!!deferred, 'Chrome ha offerto l\'installazione', deferred ? 'sì: ora puoi premere «Installa l\'app» qui sopra.'
    : (standalone ? 'non serve, è già installata.' : siteOk
      ? 'no, anche se la pagina è a posto. In questo caso il problema è nel telefono: Chrome crea l\'app tramite Google Play, quindi servono Play Store e «Google Play Services» aggiornati, con la connessione attiva' + (cv ? ' (Chrome ' + cv + ')' : '') + '. Aggiorna Chrome e Play Store, riavvia il telefono, riapri l\'indirizzo in Chrome e controlla di nuovo il menu (⋮).'
      : 'no: correggi prima le voci con ✗ qui sopra, poi ricarica la pagina.'));
  out.innerHTML = rows.join('');
  btn.disabled = false;
});
$('#gbKey').value = '';
$('#optPrice').addEventListener('change', function (e) { settings.price = e.target.checked; saveSettings(); toast(settings.price ? 'Dopo ogni libro ti chiederò il prezzo (puoi sempre saltarlo).' : 'Non chiederò più il prezzo: puoi scriverlo quando vuoi nel campo «Costo» della scheda.'); });
/* l'indirizzo del worker si puo' incollare anche senza https:// o con ?isbn=... della prova a mano */
function cleanWorker(v) {
  v = String(v || '').trim().split(/[?#]/)[0].replace(/\/+$/, '');
  if (v && !/^[a-z][a-z0-9+.-]*:\/\//i.test(v) && /^[^\s/]+\.[a-z]{2,}(\/|$)/i.test(v)) v = 'https://' + v;
  return v;
}
$('#sbnUrl').addEventListener('change', function (e) {
  var v = cleanWorker(e.target.value), before = settings.sbnUrl;
  if (v && !/^https:\/\/[^\s/]+\.[^\s]+$/.test(v)) { toast('L\'indirizzo deve iniziare con https:// (es. https://sbn-libri.tuonome.workers.dev).'); return; }
  if (v === before) { e.target.value = v; return; }
  e.target.value = v; setSvc('sbn', v);
  if (v) toast('Worker SBN in uso. Premi «Prova la ricerca ISBN» per controllare.');
  else toast('Worker tolto: ora cerco senza il catalogo SBN.', { label: 'Annulla', fn: function () { setSvc('sbn', before); } });
});
$('#gbShow').addEventListener('click', function () { gbShown = !gbShown; renderSvc(); });
$('#gbKey').addEventListener('click', function (e) { if (e.target.dataset.mask === '1') { gbShown = true; renderSvc(); e.target.focus(); } });   // tocco sulla chiave coperta: si scopre per cambiarla
$('#gbKey').addEventListener('change', function (e) {
  if (e.target.dataset.mask === '1') return;
  var v = e.target.value.replace(/\s+/g, ''), before = settings.gbKey;
  if (v === before) { e.target.value = v; return; }
  e.target.value = v; setSvc('key', v);
  if (!v) toast('Chiave tolta: ora cerco su Google senza chiave.', { label: 'Annulla', fn: function () { setSvc('key', before); } });
  else toast(/^AIza[\w-]{30,}$/.test(v) ? 'Chiave in uso. Premi «Prova la ricerca ISBN» per controllare.' : 'Chiave in uso, ma non sembra una chiave Google (di solito inizia con AIza e ha 39 caratteri): controlla.');
});
function clearSvc(k) {
  var before = svcVal(k);
  if (!before) return;
  setSvc(k, '');
  toast(k === 'sbn' ? 'Worker tolto. Resta tra i salvati.' : 'Chiave tolta. Resta tra le salvate.',
    { label: 'Annulla', fn: function () { setSvc(k, before); } });
}
$('#sbnClear').addEventListener('click', function () { clearSvc('sbn'); });
$('#gbClear').addEventListener('click', function () { clearSvc('key'); });
$('#svcRestore').addEventListener('click', function () {
  var did = [];
  if (!settings.sbnUrl && saved.sbn[0]) { setSvc('sbn', saved.sbn[0]); did.push('sbn'); }
  if (!settings.gbKey && saved.key[0]) { setSvc('key', saved.key[0]); did.push('key'); }
  if (!did.length) return;
  toast(did.length === 2 ? 'Chiave e worker rimessi.' : did[0] === 'sbn' ? 'Worker rimesso.' : 'Chiave rimessa.',
    { label: 'Annulla', fn: function () { did.forEach(function (k) { setSvc(k, ''); }); } });
});
$('#svcSbn').parentNode.addEventListener('click', function (e) {
  var u = e.target.closest('.schip-use'), x = e.target.closest('.schip-x');
  if (u) {
    var k = u.dataset.k, v = saved[k][+u.dataset.i], before = svcVal(k);
    if (!v) return;
    setSvc(k, v);
    toast(k === 'sbn' ? 'Worker rimesso: ' + svcShort(k, v) + '.' : 'Chiave rimessa: ' + svcShort(k, v) + '.', { label: 'Annulla', fn: function () { setSvc(k, before); } });
  } else if (x) {
    var k2 = x.dataset.k, i2 = +x.dataset.forget, v2 = saved[k2][i2];
    if (!v2) return;
    saved[k2].splice(i2, 1); ls.set(LS_SAVED, JSON.stringify(saved)); renderSvc();
    toast((k2 === 'sbn' ? 'Worker tolto dai salvati.' : 'Chiave tolta dalle salvate.'), { label: 'Annulla', fn: function () { saved[k2].splice(i2, 0, v2); ls.set(LS_SAVED, JSON.stringify(saved)); renderSvc(); } });
  }
});
$('#btnClearGuess').addEventListener('click', function () {
  var snapshot = JSON.stringify(state.books), n = 0;
  state.books.forEach(function (b) {
    if (b.g.length) { b.g.forEach(function (k) { if (k !== 'i') b[k] = ''; n++; }); b.g = []; }
  });
  if (!n) { toast('Non ci sono ipotesi da svuotare.'); return; }
  renderList(); touch(); updateSummary();
  toast('Svuotate ' + n + ' ipotesi', { label: 'Annulla', fn: function () { state.books = JSON.parse(snapshot); renderList(); touch(); updateSummary(); } });
});
/* ---------- installazione e condivisione dell'app ---------- */
/* Finche' l'app si usa dal browser, in alto c'e' la scheda «Installa»: un tocco apre la richiesta di Chrome
   (quando Chrome la offre), altrimenti spiega i passi giusti per quel telefono e browser. */
/* indirizzo dell'app: quello da cui gira (cosi' link e condivisioni seguono un eventuale cambio di nome); di riserva quello pubblicato */
var APP_URL = /\.github\.io$/.test(location.hostname) ? location.origin + location.pathname.replace(/[^/]*$/, '') : 'https://nextlibris.github.io/';
var APP_SCOPE = location.pathname.replace(/[^/]*$/, '');      // es. /next-libris/: l'app installata e' legata a questa cartella
var SHARE_TXT = 'Next Libris: il catalogo della libreria di casa. Inquadri il codice a barre e il libro si compila da solo. Aprilo con Chrome e premi «Installa».';
var deferred = null;
function isStandalone() {
  try {
    if (window.matchMedia && ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'].some(function (m) { return matchMedia('(display-mode: ' + m + ')').matches; })) return true;
  } catch (e) { nlErr(e); }
  return navigator.standalone === true || /^android-app:\/\//.test(document.referrer || '');
}
function browserKind() {
  var ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/; wv\)|FBAN|FBAV|Instagram|Line\/|Telegram|WhatsApp|GSA\/|Snapchat/i.test(ua)) return 'inapp';
  if (/SamsungBrowser/i.test(ua)) return 'samsung';
  if (/Firefox/i.test(ua)) return 'firefox';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}
function updateInstallUi() {
  var inst = isStandalone();
  if (inst && (!settings.installed || settings.instScope !== APP_SCOPE)) { settings.installed = true; settings.instScope = APP_SCOPE; saveSettings(); }   // l'app installata e Chrome condividono i dati: da qui in poi niente scheda
  var kind = browserKind();
  var show = !inst && !settings.installed && Date.now() - settings.instSnooze > 14 * 86400000;
  $('#instCard').hidden = !show;
  $('#instGo').textContent = kind === 'inapp' && !deferred ? 'Apri in Chrome' : 'Installa';
  $('#instMsg').textContent = kind === 'inapp' && !deferred
    ? 'Sei dentro un\'altra app: aprila in Chrome per averla tra le app del telefono, a schermo intero e anche senza rete.'
    : 'Avrai l\'icona tra le app del telefono: si apre a schermo intero e funziona anche senza rete.';
  $('#btnInstall').hidden = inst;
  $('#instOkTxt').hidden = !inst;
}
var INST_STEPS = {
  android: { lead: 'Chrome non ha ancora proposto l\'installazione: si fa dal suo menu.',
    steps: ['Tocca <b>⋮</b> in alto a destra.', 'Scegli <b>Installa app</b> (su alcuni telefoni <b>Aggiungi a schermata Home</b>, poi <b>Installa</b>).', 'Conferma: l\'icona di Next Libris compare tra le app.'],
    note: 'Se nel menu c\'è <b>Apri in Chrome</b>, sei dentro un\'altra app (Gmail, Telegram…): toccalo e poi premi «Installa» qui in alto. Se nel menu c\'è <b>Apri app</b>, è già installata.' },
  inapp: { lead: 'Il link si è aperto dentro un\'altra app, che non può installarla. Serve Chrome.',
    steps: ['Tocca <b>⋮</b> (i tre puntini) in alto a destra.', 'Scegli <b>Apri in Chrome</b> o <b>Apri nel browser</b>.', 'In Chrome premi <b>Installa</b> nella scheda in alto.'],
    note: 'Se non trovi la voce, copia il link e incollalo nella barra degli indirizzi di Chrome.', copy: true, chrome: true },
  ios: { lead: 'Su iPhone e iPad si aggiunge alla schermata Home da Safari.',
    steps: ['Tocca <b>Condividi</b> (il quadrato con la freccia in su).', 'Scorri e scegli <b>Aggiungi alla schermata Home</b>.', 'Tocca <b>Aggiungi</b>.'],
    note: 'Se la voce non c\'è, copia il link e aprilo in Safari.', copy: true },
  samsung: { lead: 'In Samsung Internet si fa dal menu in basso.',
    steps: ['Tocca il menu <b>≡</b> in basso a destra.', 'Scegli <b>Aggiungi pagina a</b>, poi <b>Schermata Home</b>.', 'Conferma con <b>Aggiungi</b>.'],
    note: 'In alternativa apri il link in Chrome: lì basta premere «Installa».', copy: true },
  firefox: { lead: 'In Firefox si fa dal menu.',
    steps: ['Tocca <b>⋮</b>.', 'Scegli <b>Installa</b> o <b>Aggiungi alla schermata principale</b>.', 'Conferma.'],
    note: 'In alternativa apri il link in Chrome: lì basta premere «Installa».', copy: true },
  desktop: { lead: 'Sul computer si installa da Chrome o Edge.',
    steps: ['Nella barra dell\'indirizzo, a destra, clicca l\'icona <b>Installa</b>.', 'Se non c\'è: menu <b>⋮</b> › <b>Trasmetti, salva e condividi</b> › <b>Installa pagina come app</b>.', 'Conferma con <b>Installa</b>.'],
    note: 'Sul telefono è più comoda: apri Menu › Info e aiuto › Condivisione e inquadra il QR code.' }
};
var instPushed = false;
function openInstallHelp() {
  var k = browserKind(), h = INST_STEPS[k], reuse = false;
  if (optOpen) { reuse = optPushed; optPushed = false; $('#optSheet').hidden = true; optOpen = false; }   // dalle Opzioni: il foglio prende il loro posto
  $('#instLead').textContent = h.lead;
  $('#instSteps').innerHTML = h.steps.map(function (x) { return '<li><span>' + x + '</span></li>'; }).join('');
  $('#instNote').innerHTML = h.note;
  $('#instCopy').hidden = !h.copy;
  var ch = $('#instChrome');
  ch.hidden = !(h.chrome && /Android/i.test(navigator.userAgent || ''));
  ch.href = 'intent://' + APP_URL.replace(/^https:\/\//, '') + '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent(APP_URL) + ';end';
  $('#instWhy').hidden = k !== 'android' && k !== 'desktop';
  $('#instSheet').hidden = false;
  if (reuse) { try { history.replaceState({ inst: 1 }, ''); instPushed = true; } catch (e) { nlErr(e); } }
  else if (!instPushed) { try { history.pushState({ inst: 1 }, ''); instPushed = true; } catch (e) { nlErr(e); } }
  $('#instOk').focus({ preventScroll: true });
}
function closeInstallHelp(fromPop) {
  if ($('#instSheet').hidden) return;
  $('#instSheet').hidden = true;
  if (instPushed && !fromPop) { instPushed = false; try { history.back(); } catch (e) { nlErr(e); } }
  else instPushed = false;
}
window.addEventListener('popstate', function () { if (!$('#instSheet').hidden) { instPushed = false; closeInstallHelp(true); } });
async function doInstall() {
  if (!deferred) { openInstallHelp(); return; }
  var d = deferred, out = null;
  d.prompt();
  try { out = await d.userChoice; } catch (e) { nlErr(e); }
  deferred = null;
  if (out && out.outcome === 'dismissed') toast('Va bene. Quando vuoi: Menu › Impostazioni › Installazione sul telefono.');
  updateInstallUi();
}
window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; updateInstallUi(); });
window.addEventListener('appinstalled', function () {
  deferred = null; settings.installed = true; settings.instScope = APP_SCOPE; saveSettings(); updateInstallUi();
  toast('Next Libris è installata: la trovi tra le app del telefono.');
});
$('#btnInstall').addEventListener('click', doInstall);
$('#instGo').addEventListener('click', doInstall);
$('#instLater').addEventListener('click', function () {
  settings.instSnooze = Date.now(); saveSettings(); updateInstallUi();
  toast('Quando vuoi: Menu › Impostazioni › Installazione sul telefono.', { label: 'Annulla', fn: function () { settings.instSnooze = 0; saveSettings(); updateInstallUi(); } });
});
$('#instOk').addEventListener('click', function () { closeInstallHelp(); });
$('#instSheet').addEventListener('click', function (e) { if (e.target === e.currentTarget) closeInstallHelp(); });
$('#instCopy').addEventListener('click', copyAppLink);
$('#instWhy').addEventListener('click', function () {
  var had = instPushed; instPushed = false; $('#instSheet').hidden = true;
  openOptions('app', had);
  setTimeout(function () { $('#btnInstDiag').click(); }, 60);
});
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch (e) { nlErr(e); }
  try {
    var ta = document.createElement('textarea');
    ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta); ta.select();
    var ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch (e) { return false; }
}
async function copyAppLink() {
  toast(await copyText(APP_URL) ? 'Link copiato: incollalo in WhatsApp, in un messaggio o in una mail.' : 'Non riesco a copiarlo. Il link è ' + APP_URL);
}
async function shareApp() {
  if (navigator.share) {
    try { await navigator.share({ title: 'Next Libris', text: SHARE_TXT, url: APP_URL }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  copyAppLink();
}
$('#shareApp').addEventListener('click', shareApp);
$('#copyApp').addEventListener('click', copyAppLink);
if (window.matchMedia) { try { var smq = matchMedia('(display-mode: standalone)'); var onSm = function () { updateInstallUi(); }; if (smq.addEventListener) smq.addEventListener('change', onSm); else if (smq.addListener) smq.addListener(onSm); } catch (e) { nlErr(e); } }
function resumeLookups(silent) {
  var waiting = state.books.filter(function (b) { var s = S[b.id]; return s && s.st === 'wait'; });
  waiting.forEach(function (b) { var s = S[b.id]; clearTimeout(s.timer); s.st = 'queued'; refreshRow(b.id); lookupPool(function () { return doLookup(b.id); }); });
  var n = waiting.length + todoRows().length;
  if (todoRows().length) runTodo();
  if (n && !silent) toast('Di nuovo online: cerco ' + n + (n === 1 ? ' libro rimasto in attesa.' : ' libri rimasti in attesa.'));
  return n;
}
window.addEventListener('online', function () { persist(); offlineNoted = false; resumeLookups(false); });
window.addEventListener('offline', persist);
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') { clearTimeout(tSave); persist(); } });
var rz = null;
window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { autosizeAll(list); }, 150); });

/* ---------- avvio ---------- */
if (COPIA) {                                       // copia parallela (prova, social…): si vede subito, per non confonderla con quella vera
  document.documentElement.classList.add('prova', 'copia-' + COPIA);
  document.title = 'Next Libris (' + COPIA + ')';
  var h1 = document.querySelector('h1');
  if (h1) h1.insertAdjacentHTML('beforeend', ' <span class="prova-tag" title="Copia ' + esc(COPIA) + ': dati separati da quelli della versione vera">' + esc(COPIA.toUpperCase()) + '</span>');
}
loadAll();
settings.donOpens = Math.min(9999, settings.donOpens + 1);   // un accesso in piu' (per la riga «Sostieni»)
saveSettings();                                  // salva subito eventuali scelte aggiornate (es. palette predefinita)
if (settings.donGo) {                            // l'app e' stata riaperta mentre si era su PayPal (il telefono l'aveva chiusa)
  if (Date.now() - settings.donGo < 2 * DON_DAY) setTimeout(donBack, 1200);
  else { settings.donGo = 0; settings.donHid = false; saveSettings(); }
}
loadSaved();
renderSvc();
$('#optName').value = settings.name || '';
renderOwner();
$('#optPrice').checked = settings.price;
paintSound();
$('#optCamNative').checked = !!settings.camNative;
paintLensState();
$('#lensRun').addEventListener('click', runLensCheck);
$('#lightRun').addEventListener('click', runLightTest);
$('#lightYes').addEventListener('click', function () { lightAnswer(true); });
$('#lightNo').addEventListener('click', function () { lightAnswer(false); });
$('#optCamNative').addEventListener('change', function (e) { settings.camNative = e.target.checked; saveSettings(); toast(settings.camNative ? 'Foto con la fotocamera del telefono.' : 'Foto con la fotocamera dell\'app.'); });
$('#optSound').addEventListener('change', function (e) { setSound(e.target.checked, true); });
/* Avvisi chiusi ma ancora validi (prestiti lunghi, backup, «Hai finito…», e quelli dei moduli): un triangolino nel riepilogo li riapre */
function closedNotices() {
  var out = [], DAY = 864e5, now = Date.now();
  var showing = $('#notice').hidden ? '' : noticeKind;
  var longLoans = state.books.some(function (b) { return !b.w && b.p && b.pd && now - Date.parse(b.pd) > 30 * DAY; });
  if (longLoans && showing !== 'loan' && now - settings.loanSnooze < 7 * DAY) out.push({ k: 'loan', reopen: function () { settings.loanSnooze = 0; saveSettings(); if (!$('#notice').hidden && noticeKind !== 'loan') $('#notice').hidden = true; noticeKind = ''; checkLoanNag(); } });
  var n = storable().length;
  if (backupDue(true) && !backupDue() && showing !== 'backup')   // giro 7: stessa regola del promemoria (45 giorni o 40 libri nuovi)
    out.push({ k: 'backup', reopen: function () { settings.snooze = 0; saveSettings(); if ($('#notice').hidden) checkBackupNag(); } });
  var last = nxJustRead();
  if (last && settings.nxSeen === last.id && !state.books.some(function (b) { return !b.w && b.rs === 'in'; }) && nextList().length)
    out.push({ k: 'next', reopen: function () { settings.nxSeen = ''; saveSettings(); nxBoxPaint(); } });
  emit('closed', out);                            // i moduli aggiungono i loro
  return out;
}
/* avvisi aperti in cima (prestiti, backup, «Hai finito…», trimestre, installazione, sostieni, avvisi dei moduli) */
var OPEN_NOTES = '#notice, #nxBox, #wrapAsk, #donAsk, #instCard, #donRow, .lay-note';
function openNotices() { return Array.prototype.filter.call(document.querySelectorAll(OPEN_NOTES), function (e) { return !e.hidden && e.isConnected && !e.closest('[hidden]'); }); }
function alertBtn() {                             // il triangolino c'e' quando ci sono avvisi, aperti o chiusi (Piero, 16/11/2026)
  if (tab !== 'lib') return '';
  var c = closedNotices().length, o = openNotices().length, n = c + o;
  var lbl = c ? (c === 1 ? 'Riapri l\'avviso chiuso' : 'Riapri i ' + c + ' avvisi chiusi') : (o === 1 ? 'Vai all\'avviso' : 'Vai ai ' + o + ' avvisi');
  return n ? ' <button type="button" class="sum-alert" data-sum="alert" aria-label="' + lbl + '" title="' + (c ? 'Riapri gli avvisi' : 'Vai agli avvisi') + '">' +
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4.5M12 17.2v.01"/></svg></button>' : '';
}
function reopenNotices() {
  closedNotices().forEach(function (x) { try { x.reopen(); } catch (e) { nlErr(e); } });
  emit('reopen');
  updateSummary(); window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(function () {                        // l'avviso in vista lampeggia un attimo, per far vedere dove sono
    var e = openNotices().filter(function (x) { return !x.classList.contains('lay-later'); })[0];
    if (e) { e.classList.remove('flash'); void e.offsetWidth; e.classList.add('flash'); setTimeout(function () { e.classList.remove('flash'); }, 1400); }
  }, 350);
}
(function () {                                   // un avviso compare o sparisce: il triangolino si aggiorna
  var t = null, last = -1;
  new MutationObserver(function () {
    clearTimeout(t);
    t = setTimeout(function () { var n = openNotices().length; if (n !== last) { last = n; updateSummary(); } }, 120);
  }).observe(document.querySelector('main') || document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] });
})();
/* riepilogo in alto: cosa mostrare (valore e «non più in libreria» spenti di predefinito) */
function paintSumOpts() {
  [['#optSumEur', 'sumEur'], ['#optSumLoan', 'sumLoan'], ['#optSumGone', 'sumGone'], ['#optShowSync', 'showSync']].forEach(function (x) { var e = $(x[0]); if (e) e.checked = settings[x[1]] !== false && (x[1] === 'sumLoan' || x[1] === 'showSync' || settings[x[1]] === true); });
}
[['#optSumEur', 'sumEur'], ['#optSumLoan', 'sumLoan'], ['#optSumGone', 'sumGone'], ['#optShowSync', 'showSync']].forEach(function (x) {
  var e = $(x[0]); if (!e) return;
  e.addEventListener('change', function () { settings[x[1]] = e.checked; saveSettings(); updateSummary(); persist(); emit('list'); });
});
$('#summary').addEventListener('click', function (e) { if (e.target.closest('[data-sum="loan"]')) $('#fltLoan').click(); else if (e.target.closest('[data-sum="alert"]')) reopenNotices(); });
$('#scanSound').addEventListener('click', function () { setSound(settings.sound === false, true); });
(function () {                                   // ?vista=elenco / ?vista=copertine nell'indirizzo: quella vista per questa apertura (comodo per i link e per le prove)
  var m = /[?&]vista=(elenco|copertine)\b/.exec(location.search);
  if (m) settings.view = m[1] === 'elenco' ? 'list' : 'grid';
})();
setView(settings.view);
applyCols();
loadQuota();
applyLook(false);
updateInstallUi();
setTimeout(function () {
  checkVersion().then(function (j) {
    if (j && j.v > APP_VERSION.v) notice('È disponibile la versione ' + j.v + ' dell\'app (stai usando la ' + APP_VERSION.v + ').', 'Aggiorna adesso', updateNow);
    else if (verNewer(j)) notice('C\'è un aggiornamento ' + (PROVA ? 'della copia di prova' : 'della copia ' + COPIA) + ((j.copia || j.prova) ? ' (' + (j.copia || j.prova) + ', del ' : ' (del ') + buildText(j.build) + ').', 'Aggiorna adesso', updateNow);
  });
}, 2500);
confirmLearnedPublishers();
if (state.books.filter(markKdp).length) touch();      // libri 979-8 gia' «non trovati»: casa editrice «Amazon (pubblicazione in proprio)»
if (!settings.swiped) setTimeout(function () { var t = $('#edgeTab'); t.classList.add('nudge'); setTimeout(function () { t.classList.remove('nudge'); }, 3000); }, 1500);
setTab('lib');
updateBackupInfo();
loadCovers();
setTimeout(function () { if (navigator.onLine !== false) { var n = resumeLookups(true); if (n) toast('Cerco ' + n + (n === 1 ? ' libro rimasto in attesa.' : ' libri rimasti in attesa.')); } }, 1200);
setTimeout(checkLoanNag, 2500);
try { if (navigator.storage && navigator.storage.persisted) navigator.storage.persisted().then(function (p) { if (!p && state.books.length >= 5) askPersist(); }); } catch (e) { nlErr(e); }
updateSummary();
persist();
checkIncoming();
setTimeout(checkWhatsNew, 900);
loadNews(); loadSugg(); setTimeout(autoNews, 12000); setTimeout(autoSugg, 20000); setTimeout(runDescQueue, 6000);
/* schermata d'apertura (solo app installata): resta almeno ~0,7 s dall'avvio, poi sfuma */
(function () {
  var el = document.getElementById('splash');
  if (!el || !document.documentElement.hasAttribute('data-splash')) { if (el) el.remove(); return; }
  if (settings.name) $('#splashWho').textContent = 'Libreria di ' + settings.name;
  // tempo fisso da quando l'app e' pronta: la schermata di Android copre la pagina finche' non e' caricata
  setTimeout(function () {
    document.documentElement.classList.add('splash-out'); el.classList.add('out');
    setTimeout(function () { el.remove(); document.documentElement.removeAttribute('data-splash'); document.documentElement.classList.remove('splash-out'); applyLook(false); }, 380);
  }, 600);
})();
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { nlErr(e); }
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(function () {});
}
/* ---- Moduli aggiuntivi: file a parte (per esempio wrap.js) che si agganciano qui. Se il file non c'e', l'app funziona uguale.
   Un modulo si toglie cancellando i suoi file e le sue righe in index.html e sw.js (vedi togli_modulo.py nel ramo prove). ---- */
window.NL = {
  openPh: function (src, cap) { openPh(src, cap); },   // foto dell'amico a tutto schermo (giro 10)
  inst: { standalone: isStandalone, kind: browserKind, go: doInstall },   // per la guida (giro 10)
  setKey: function (v) { setSvc('key', v); }, openDon: function () { openDon(); },   // dalla guida della chiave (18/11/2026)
  ownKey: function () { return mine('key'); },
  qThumb: function (c) { return qThumb(c); },   // miniatura della foto di una citazione (profilo, 18/11/2026)   // la TUA chiave, anche mentre usi quella di un amico (giro 8)
  renderOwner: function () { renderOwner(); }, emit: function (n, a) { emit(n, a); },   // (nella 104.8 queste due erano finite dentro il commento: rimesse)
  on: function (name, fn) { (hooks[name] || (hooks[name] = [])).push(fn); },
  L: L, esc: esc, $: $, ls: ls, toast: toast, eur: eur, hue: hue, bigImg: bigImg, authorsOf: authorsOf, coll: coll, PROVA: PROVA, COPIA: COPIA,
  books: function () { return state.books; }, quotes: allQuotes, tab: function () { return tab; }, settings: settings, saveSettings: saveSettings,
  name: function () { return settings.name || ''; }, setName: function (v) { saveName(v); }, newId: newId, today: today,
  esempio: function () { return esempio(); }, firstRun: function () { return nlFirstRun; },   // guida di primo avvio (giro 4)
  openCard: function (id) { var b = get(id); if (!b) return false; if (b.w !== (tab === 'wish')) setTab(b.w ? 'wish' : 'lib'); if (settings.view === 'grid') { openFromGrid(id); return true; } openState[id] = true; renderList(); var el = rowEl(id); if (el) el.scrollIntoView({ block: 'start' }); return true; },   // apre un libro senza uscire dalla libreria mostrata
  guest: function () { return guest ? guest.name : null; }, showBook: showBook, guestEnter: guestEnter, guestExit: function () { guestExit(); }, myBooks: myBooks, addMine: addMine, removeMine: removeMine, restoreMine: restoreMine, isMine: isMine,
  setFlt: function (v) { flt = v; collapseCards(); renderList(); updateSummary(); if (typeof updateActiveFilters === 'function') updateActiveFilters(); }, flt: function () { return flt; }, goal: function () { return settings.goal || 0; },
  closeDrawer: function () { closeDrawer(); }, fromMenu: fromMenu, refresh: function () { renderList(); updateSummary(); },
  icon: icon, setTab: function (t) { setTab(t); }, openMenu: function () { openDrawer('opt'); }, openSugg: function (t) { openSugg(t); },
  wdBookCountry: wdBookCountry, wdFlag: wdFlag, wdFlagImg: wdFlagImg, wdCName: wdCName, films: function () { return filmsMine(); }, openFilms: function () { openFilms(); }, openWorks: function () { openWorks('', '', true); },   // Wikidata (giro 2)
  openQuotes: function () { openAllQuotes(); }, openStats: function () { openStats(); }, openExport: function () { openExport(); }, nQuotes: function () { return allQuotes().length; },
  updateStick: function () { updateStick(); }, summary: function () { updateSummary(); }, autosize: function (el) { autosizeAll(el); },
  rdLong: function (v) { return rdLong(v); }, get: function (id) { return get(id); }, itDate: function (d) { return L.itDate(d); }, refreshRow: function (id) { refreshRow(id); },
  quota: function () { rollQuota(); return { d: quota.d, ds: quota.ds, g: quota.g, s: quota.s }; },   // contatore condiviso (modulo ricerche.js)
  setShared: function (k, n, day) { if (k === 'g') { shared.g = n; shared.d = day; } else { shared.s = n; shared.ds = day; } if (!$('#optSheet').hidden) updateQuotaInfo(); },
  svc: function () { return { gbKey: settings.gbKey, sbnUrl: settings.sbnUrl }; }, contactURL: function () { return contactURL(); }, backupCfg: function () { return backupCfg(); }, openOptions: function (sec) { openOptions(sec); }, svcFold: function (k, o) { svcFold(k, o); },
  togglePin: function (id, i) { return togglePin(id, i); }, pinned: function () { return pinned(); }, PIN_MAX: PIN_MAX,   // citazioni in evidenza (giro 6)
  fields: FIELDS, clean: function (x) { return cleanBook(x); }, stored: function () { return storable(); }, save: function () { touch(); }   // per la sincronizzazione (modulo social)
};
window.__ped = { st: function () { return ped; }, handles: function (o) { return pedHandles(o); }, stickers: function () { return pedStickers(); } };
window.__app = { openLoan: openLoan, openShare: openShare, sugg: function () { return sugg; }, suggRank: function () { return { a: suggAuthors().map(function (x) { return x.name + ':' + x.n + '/' + x.books; }), g: suggGenres().map(function (x) { return x.name + ':' + x.n + '/' + x.books; }) }; }, autoSugg: autoSugg, openSugg: openSugg, nextList: nextList, sounds: function () { return { beep: beep.n || 0, chime: chime.n || 0, fail: failSound.n || 0 }; }, snapInfo: function () { return { lum: snap.lum, dark: !!snap.dark, taps: snap.taps || 0, msg: $('#snapMsg').textContent }; }, flow: function () { return flow.id; }, chimes: function () { return chime.n || 0; }, openManual: openManual, processPhoto: processPhoto, donAway: function (ms) { donHiddenAt = Date.now() - ms; }, donPaint: donPaint, donBack: donBack, openDon: openDon, buildBackup: buildBackup, filtersAll: function () { return { frFlt: frFlt, autFlt: autFlt, edFlt: edFlt, genFlt: genFlt, shFlt: shFlt, q: q }; }, openDrawer: openDrawer, closeDrawer: closeDrawer, openOptions: function (s) { openOptions(s || 'search'); }, closeOptions: function () { closeOptions(); }, filters: function () { return { flt: flt, readFlt: readFlt, shFlt: shFlt, genFlt: genFlt, sortBy: sortBy }; }, state: state, S: S, openState: function () { return openState; }, addIsbn: addIsbn, addPhotos: addPhotos, settings: settings, setTab: setTab, onScanned: onScanned, startScan: startScan,
  get scanning() { return scanning; }, setScanMode: function (m) { scanMode = m; }, setScanKind: setScanKind, get scanKind() { return scanKind; } };
