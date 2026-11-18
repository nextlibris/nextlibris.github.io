/* Next Libris · app, parte 3 di 10 (app-vista.js): vista, uscita con due Indietro, selezione di più libri, fotocamera.
   Dal 17/11/2026 app.js è diviso in 10 file (prima era una sola funzione). Sono script classici, senza import:
   le funzioni e le variabili di primo livello sono globali e servono a tutte le parti; l'ordine in index.html
   e in SHELL di sw.js conta (app.js, app-aggiungi.js, …, app-avvio.js: l'ultima fa partire l'app). */
'use strict';
/* ---------- vista ---------- */
function visible() {
  var a = tabBooks();
  var nq = L.norm(q);
  if (nq) a = a.filter(function (b) { return L.norm([b.t, b.a, b.e, b.i, b.sh, b.gen, b.n, b.p, b.xa, b.ds, b.se].concat((b.qs || []).map(function (c) { return c.x; })).join(' ')).indexOf(nq) >= 0; });
  if (flt === 'guess') a = a.filter(function (b) { return b.g.length; });
  if (flt === 'gone') a = a.filter(function (b) { return b.xs; });
  if (flt === 'notmine' && guest) a = a.filter(function (b) { return !isMine(b); });
  if (flt === 'common' && guest) a = a.filter(isMine);   // libreria di un amico: «In comune», i libri che avete tutti e due (giro 1, 18/11/2026)
  if (flt === 'fav') a = a.filter(function (b) { return b.fav; });
  if (flt === 'qs') a = a.filter(function (b) { return b.qs && b.qs.length; });
  if (frFlt) a = a.filter(function (b) { return b.fr === frFlt; });
  if (flt === 'dup') { var dm = L.analyzeDups(dupPool()); a = a.filter(function (b) { return dm[b.id]; }); }
  if (shFlt) a = a.filter(function (b) { return facetKey(b.sh) === shFlt; });
  if (genFlt) a = a.filter(function (b) { return facetKey(b.gen) === genFlt; });
  if (autFlt) a = a.filter(function (b) { return authorsOf(b).some(function (n) { return auKey(n) === autFlt; }); });   // autori simili insieme (giro 1)
  if (edFlt) a = a.filter(function (b) { return facetKey(b.e) === edFlt; });
  if (paFlt) a = a.filter(function (b) { return (wdBookCountry(b) || NONE) === paFlt; });   // paese dell'autore (giro 2, 18/11/2026)
  if (readFlt && tab === 'lib') a = a.filter(function (b) { return readFlt === 'no' ? !b.rs : b.rs === readFlt; });
  if (flt === 'loan') {
    return a.filter(isLoan).sort(function (x, y) { return (x.pd || '9') < (y.pd || '9') ? -1 : (x.pd || '9') > (y.pd || '9') ? 1 : cmpFor('titolo')(x, y); });
  }
  return a.sort(cmpFor(sortBy));
}
function isLoan(b) { return !!b.p || ((b.sk === 'p' || b.sk === 'q') && !b.xs); }   // prestato da te, o ricevuto da un amico (Piero, 17/11/2026)
function cmpFor(k) {
  var byTitle = function (x, y) { return coll.compare(L.sortKeyTitle(x.t) || '~', L.sortKeyTitle(y.t) || '~'); };
  var byAuthor = function (x, y) { return coll.compare(L.sortKeyAuthor(x.a, settings.auCut) || '~', L.sortKeyAuthor(y.a, settings.auCut) || '~'); };
  if (k === 'titolo') return byTitle;
  if (k === 'autore') return function (x, y) { return byAuthor(x, y) || byTitle(x, y); };
  if (k === 'editore') return function (x, y) { return coll.compare(x.e || '~', y.e || '~') || byAuthor(x, y) || byTitle(x, y); };
  if (k === 'anno') return function (x, y) { return (Number(x.y) || 99999) - (Number(y.y) || 99999) || byTitle(x, y); };
  if (k === 'voto') return function (x, y) { return (y.rt || 0) - (x.rt || 0) || byTitle(x, y); };
  if (k === 'letti') return function (x, y) { return (y.rd || '') < (x.rd || '') ? -1 : (y.rd || '') > (x.rd || '') ? 1 : byTitle(x, y); };
  if (k === 'scaffale') return function (x, y) { return coll.compare(x.sh || '~', y.sh || '~') || byAuthor(x, y) || byTitle(x, y); };
  return function (x, y) { return y.ts - x.ts; };
}
function dupPool() { return state.books.filter(function (b) { return !b.p && !b.sx && !b.sk; }); }   // prestati o in prestito: mai uniti come doppioni (Piero, 16/11/2026)
function computeDups() { return L.analyzeDups(dupPool()); }
function kdpHint(b, busy) {
  if (busy || b.t || !b.nf || !isKdp(b)) return '';
  return '<div class="kdp-hint"><p><b>Libro pubblicato in proprio tramite Amazon.</b> Le banche dati di solito non lo conoscono: fotografa la copertina per riconoscerlo, oppure cercalo sul web.</p>' +
    '<div class="kdp-acts"><button type="button" class="btn primary" data-act="kdpphoto">' + icon('cam') + 'Fotografa la copertina</button><button type="button" class="btn" data-act="websearch">' + icon('search') + 'Cerca sul web</button></div></div>';
}
function photoForBook(id) {                      // foto della copertina per riconoscere un libro che ha gia' il suo ISBN
  snapPhoto('Foto della copertina', '#fileCover').then(function (f) {
    var b = get(id); if (!f || !b) return;
    var s = S[id] || (S[id] = {});
    s.keep = true; s.st = 'queued'; s.file = f; delete s.manual;
    refreshRow(id);
    photoPool(function () { return processPhoto(id, f); });
    startFlow(id);
  });
}
function flagsHTML(b, dups) {
  var s = S[b.id] || {}, o = '';
  if (b.p) o += '<span class="tag loan tap" data-act="loan" role="button" tabindex="0" title="In prestito' + (b.pd ? ' dal ' + esc(L.itDate(b.pd)) : '') + '. Toccalo per segnarlo come restituito.">' + esc(loanText(b)) + '</span>' +
    '<button type="button" class="btn sm ret-btn" data-act="returned">È tornato: segna restituito</button>';
  o += goneTag(b);
  o += recvTag(b);
  if (b.sk === 'p' && !b.xs) o += '<button type="button" class="btn sm ret-btn" data-act="recv">Restituiscilo</button>';   // tasto vero, pieno (Piero, 17/11/2026)
  o += fromTag(b);
  if (b.g.length) o += '<span class="tag warn tap" data-act="verify" role="button" tabindex="0" title="Dati dedotti (dalla copertina o dal codice ISBN): controllali, potrebbero non coincidere con il tuo libro. Toccalo quando hai controllato.">Da verificare ✓</span>';
  o += dupTag(dups && dups[b.id]);
  if (b.i && !L.toIsbn13(b.i)) o += '<span class="tag bad" title="La cifra di controllo non torna: ricontrolla le cifre">ISBN non valido</span>';
  else if (!b.t && b.i && !s.st) o += b.nf ? '<span class="tag warn" title="Nessuna banca dati conosce questo codice: scrivi i dati a mano">Non trovato</span>' : '<span class="tag" title="Titolo ancora da cercare">Da completare</span>';
  return o;
}
/* Scheda chiusa (solo titolo e autore) o aperta (tutti i campi). Di regola chiusa; aperta da sola se manca il titolo
   e il libro non e' in lavorazione (va compilato a mano). Una volta aperta resta aperta finche' non la chiudi. */
function isOpen(b) {
  if (settings.openAll) return true;
  if (openState[b.id] != null) return openState[b.id];
  var st = (S[b.id] || {}).st, busy = st === 'queued' || st === 'reading' || st === 'lookup' || st === 'search';
  /* senza titolo («Non trovato»): si apre da sola una volta sola, appena aggiunta in questa sessione; mai tutte insieme
     quando l'elenco si ridisegna (filtro tolto, cambio vista, riapertura dell'app). Piero, 16/11/2026 */
  if (!guest && !b.t && !busy && S[b.id] && !autoOpened[b.id]) { autoOpened[b.id] = 1; openState[b.id] = true; return true; }
  return false;
}
/* libro arrivato da una condivisione: da chi, e da quale lista */
function fromTag(b) {
  if (!b.fr) return '';
  return '<span class="tag from" title="' + esc('Ricevuto da ' + b.fr + (b.fl ? ', dalla lista «' + b.fl + '»' : '')) + '">Da ' + esc(b.fr) + '</span>';
}
var GONE_VERB = { v: 'Venduto', r: 'Regalato', s: 'Smarrito', b: 'Restituito' };
function aChi(p) { return (/^[aA]/.test(p) ? 'ad ' : 'a ') + p; }
function goneText(b) {
  if (!b.xs) return '';
  var d = b.xd ? L.itDate(b.xd) : '';
  if (b.xs === 's') return 'Smarrito' + (d ? ' dal ' + d : '');
  return GONE_VERB[b.xs] + (b.xa ? ' ' + aChi(b.xa) : '') + (d ? ' il ' + d : '');
}
function goneTag(b) {
  if (b.xs === 'b') return '<span class="tag gone">' + esc(goneText(b)) + '</span>';   // prestito ricevuto, restituito: solo storico
  return b.xs ? '<span class="tag gone tap" data-act="loan" role="button" tabindex="0" title="Non è più in libreria. Tocca per cambiare o se è tornato.">' + esc(goneText(b)) + '</span>' : '';
}
/* ricevuto da un amico dell'app: «Prestato da Anna» (toccandolo: restituito) o «Regalato da Anna» */
function recvTag(b) {
  if (!b.sk || !b.sda || b.xs) return '';
  if (b.sk === 'p') return '<span class="tag loan tap recv" data-act="recv" role="button" tabindex="0" title="Te l\'ha prestato ' + esc(b.sda) + '. Toccalo quando l\'hai restituito.">Prestato da ' + esc(b.sda) + '</span>';
  if (b.sk === 'q') return '<span class="tag loan wait" title="Hai detto di averlo restituito: ' + esc(b.sda) + ' deve confermare">Restituito ' + esc(aChi(b.sda)) + ' · da confermare</span>';
  return '<span class="tag from">Regalato da ' + esc(b.sda) + '</span>';
}
function prestatoA(p) { return 'Prestato ' + (/^[aA]/.test(p) ? 'ad ' : 'a ') + p; }   // «ad Anna», «a Marco»
function loanText(b) {
  if (!b.pd) return prestatoA(b.p);
  var ago = L.agoText(Date.parse(b.pd));
  return prestatoA(b.p) + ' · ' + (ago === 'oggi' ? 'da oggi' : ago === 'ieri' ? 'da ieri' : 'da ' + ago.replace(/ fa$/, ''));
}
function summaryHTML(b, dups, status) {
  var s = S[b.id] || {}, tags = '';
  if (b.p) tags += '<span class="tag loan tap" data-act="loan" role="button" tabindex="0" title="Tocca per segnarlo come restituito">' + esc(loanText(b)) + '</span>';
  tags += goneTag(b);
  tags += recvTag(b);
  if (b.fav && !b.w) tags += '<span class="tag fav">Lo consigli</span>';
  tags += fromTag(b);
  /* «Da verificare» nella riga chiusa: un tocco e' verificato, senza aprire la scheda (giro 1, 18/11/2026); da amico solo da leggere */
  if (b.g.length) tags += guest ? '<span class="tag warn">Da verificare</span>' : '<span class="tag warn tap" data-act="verify" role="button" tabindex="0" title="Dati dedotti: toccalo quando hai controllato">Da verificare ✓</span>';
  if (!b.w && (b.rs === 'in' || b.rs === 'ok')) { var qq = b.rs === 'in' ? ppInfo(b) : {}; tags += '<span class="tag read' + (b.rs === 'in' ? ' now' : '') + (qq.pct != null ? ' has-pp" style="--pp:' + qq.pct + '%' : '') + '">' + esc(readLabel(b)) + '</span>'; }
  tags += dupTag(dups && dups[b.id]);
  if (b.i && !L.toIsbn13(b.i)) tags += '<span class="tag bad">ISBN non valido</span>';
  else if (!b.t && b.i && !s.st && b.nf) tags += '<span class="tag warn">Non trovato</span>';
  var title = b.t || (b.i ? 'ISBN ' + b.i : 'Senza titolo');
  var vol = b.t && String(b.sn || '').trim() ? ', ' + String(b.sn).trim() : '';   // numero del volume nella serie, accanto al titolo
  var img = smallImg(b);
  var cover = img ? '<span class="sum-img zoom" data-act="zoom" title="Ingrandisci la copertina"><img src="' + esc(img) + '" alt="Copertina: tocca per ingrandire" loading="lazy" referrerpolicy="no-referrer"></span>'
    : '<span class="sum-img ph" style="--h:' + hue(b.t + b.a + b.i) + '" aria-hidden="true">' + esc((b.t || '?').replace(/^(il|lo|la|i|gli|le|un|uno|una|l')\s*/i, '').charAt(0).toUpperCase() || '?') + '</span>';
  return '<article class="row closed' + (status.indexOf('status err') >= 0 ? ' bad' : '') + (b.xs ? ' gone' : '') + '" data-id="' + b.id + '">' +
    '<div class="sum" data-act="toggle" role="button" tabindex="0" aria-expanded="false" aria-label="' + esc(title + (vol ? ', volume ' + vol.slice(2) : '') + (b.a ? ', ' + b.a : '') + '. Apri la scheda') + '">' + cover +
    '<span class="sum-txt"><span class="sum-t' + (b.t ? '' : ' none') + '">' + esc(title) + (vol ? '<span class="sum-vol">' + esc(vol) + '</span>' : '') + '</span>' +
    (b.a ? '<span class="sum-a">' + esc(b.a) + '</span>' : '') +
    (tags ? '<span class="sum-tags">' + tags + '</span>' : '') + '</span>' +
    '<span class="chev" aria-hidden="true">' + icon('chev') + '</span></div>' + status + '</article>';
}
var cardPushed = null;                         // scheda aperta con il tocco: Indietro (o la freccetta) la chiude e torna all'elenco
function toggleRow(id, fromPop) {
  var b = get(id);
  if (!b) return;
  var open = !isOpen(b);
  if (open && !settings.openAll) {
    Object.keys(openState).forEach(function (k) { var x = get(k); if (k !== id && openState[k] && x && x.t) { openState[k] = false; refreshRow(k); } });   // una scheda alla volta
    try { if (cardPushed) history.replaceState({ card: id }, ''); else history.pushState({ card: id }, ''); cardPushed = id; } catch (e) { nlErr(e); }
  } else if (!open && cardPushed && !fromPop) { cardPushed = null; try { history.back(); } catch (e) { nlErr(e); } }
  openState[id] = open;
  if (!open && gridRet && (gridRet.id === id || !anyOpen()) && backToGrid()) { updateStick(); return; }   // aperta dalle copertine: si torna li'
  refreshRow(id);
  updateStick();
  var el = rowEl(id);
  if (el) { el.scrollIntoView({ block: 'nearest' }); var f = el.querySelector(open ? '.chev-btn' : '.sum'); if (f) f.focus({ preventScroll: true }); }
}
window.addEventListener('popstate', function (e) {
  if (!cardPushed || (e.state && (e.state.card || e.state.opt || e.state.log || e.state.drawer))) return;   // si torna a una finestra con la sua cronologia
  if (document.querySelector('.sheet:not([hidden])')) {          // prima la finestra in primo piano, la scheda resta aperta
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    try { history.pushState({ card: cardPushed }, ''); } catch (x) {}
    return;
  }
  var id = cardPushed; cardPushed = null;
  var b = get(id);
  if (b && isOpen(b) && !settings.openAll) toggleRow(id, true);
});
/* ---- uscire dall'app: serve premere Indietro due volte ---- */
var exitArmed = 0;
try { history.scrollRestoration = 'manual'; } catch (e) { nlErr(e); }   // le schede usano la cronologia: il browser non deve riportare la pagina dove era (filtro da un'etichetta finiva a meta' elenco, 16/11/2026)
(function () {
  var push = history.pushState.bind(history);
  history.pushState = function (st, t, u) { if (history.state && history.state.root) push({ guard: 1 }, ''); return push(st, t, u); };   // sotto ogni finestra c'e' sempre la «guardia»
  try { history.replaceState({ root: 1 }, ''); push({ guard: 1 }, ''); } catch (e) { nlErr(e); }
  window.addEventListener('popstate', function (e) {
    if (!(e.state && e.state.root)) return;
    if (document.querySelector('.sheet:not([hidden]), .lightbox:not([hidden])')) {        // finestre senza cronologia: Indietro le chiude
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      try { push({ guard: 1 }, ''); } catch (x) {}
      return;
    }
    var openIds = settings.openAll ? [] : Object.keys(openState).filter(function (k) { var x = get(k); return openState[k] && x && x.t; });
    if (openIds.length) {                                                                    // schede aperte senza cronologia: Indietro le chiude
      openIds.forEach(function (k) { openState[k] = false; refreshRow(k); });
      if (gridRet) backToGrid();
      try { push({ guard: 1 }, ''); } catch (x) {}
      return;
    }
    if (guest) { guestExit(); try { push({ guard: 1 }, ''); } catch (x) {} return; }   // dalla libreria di un amico si torna alla tua
    exitArmed = Date.now();
    toast('Premi di nuovo Indietro per uscire', null, 2500);
    setTimeout(function () { if (history.state && history.state.root) { try { push({ guard: 1 }, ''); } catch (x) {} } }, 2500);
  });
})();
/* ---- selezione di più libri: tieni premuto un libro, poi tocca gli altri ---- */
var selSeq = 0, selOn = false, sel = {}, selPushed = false, lp = { t: 0, x: 0, y: 0, fired: false };
function selIds() { return Object.keys(sel).filter(function (id) { var b = get(id); return b && inTab(b); }); }
function selBooks() { return selIds().map(get); }
function paintSel() {
  document.body.classList.toggle('selecting', selOn);
  $('#selBar').hidden = !selOn;
  if (!selOn) return;
  Array.prototype.forEach.call($('#list').querySelectorAll('.row[data-id], .cover[data-id]'), function (el) {
    var on = !!sel[el.dataset.id];
    el.classList.toggle('sel', on); el.setAttribute('aria-selected', on ? 'true' : 'false');
    if (on) el.dataset.ord = selRank(el.dataset.id); else delete el.dataset.ord;          // ordine in cui l'hai toccato
  });
  var n = selIds().length;
  $('#selN').innerHTML = '<b>' + n + '</b><small>' + (n === 1 ? 'selezionato' : 'selezionati') + '</small>';
  $('#selDel').disabled = $('#selEdit').disabled = !n;
  var all = visible().length;
  $('#selAll').textContent = n && n >= all ? 'Nessuno' : 'Tutti';
}
function startSel(id) {
  if (guest) return;
  if (scanning) return;
  if (!selOn) {
    selOn = true; sel = {};
    collapseCards(); openState = {};
    try { history.pushState({ sel: 1 }, ''); selPushed = true; } catch (e) { nlErr(e); }
    renderList();
    if (!settings.selTip) { settings.selTip = 1; saveSettings(); toast('Tocca altri libri per aggiungerli. Poi Elimina o Modifica qui sotto.', null, 4500); }
  }
  if (id) { sel[id] = ++selSeq; paintSel(); }
  try { if (navigator.vibrate) navigator.vibrate(25); } catch (e) { nlErr(e); }
}
function toggleSel(id) { if (sel[id]) delete sel[id]; else sel[id] = ++selSeq; paintSel(); }
function selOrdered() { return selIds().sort(function (a, b) { return sel[a] - sel[b]; }).map(get); }
function selRank(id) { var ids = selIds().sort(function (a, b) { return sel[a] - sel[b]; }); return ids.indexOf(id) + 1; }
function endSel(fromPop) {
  if (!selOn) return;
  selOn = false; sel = {};
  Array.prototype.forEach.call($('#list').querySelectorAll('.sel'), function (el) { el.classList.remove('sel'); el.removeAttribute('aria-selected'); });
  paintSel();
  ['#bulkSheet', '#confirmSheet'].forEach(function (k) { $(k).hidden = true; });
  if (selPushed && !fromPop) { selPushed = false; try { history.back(); } catch (e) { nlErr(e); } }
}
window.addEventListener('popstate', function (e) { if (selOn && !(e.state && e.state.sel)) { selPushed = false; endSel(true); } });
/* pressione lunga sulla riga chiusa o sulla copertina */
(function () {
  var listEl = $('#list');
  function target(e) { var el = e.target.closest('.row:not(.open), .cover'); return el && el.dataset.id && !el.closest('[data-ex]') && el.dataset.ex == null ? el : null; }
  listEl.addEventListener('pointerdown', function (e) {
    lp.fired = false;
    if (e.button > 0) return;
    var el = target(e); if (!el || e.target.closest('input, textarea, select')) return;
    lp.x = e.clientX; lp.y = e.clientY; clearTimeout(lp.t);
    lp.t = setTimeout(function () { lp.fired = true; if (selOn) toggleSel(el.dataset.id); else startSel(el.dataset.id); }, 480);
  });
  function cancel() { clearTimeout(lp.t); }
  listEl.addEventListener('pointermove', function (e) { if (Math.abs(e.clientX - lp.x) > 10 || Math.abs(e.clientY - lp.y) > 10) cancel(); });
  listEl.addEventListener('pointerup', function () { cancel(); if (lp.fired) setTimeout(function () { lp.fired = false; }, 400); }); listEl.addEventListener('pointercancel', cancel);
  window.addEventListener('scroll', cancel, { passive: true });
  listEl.addEventListener('contextmenu', function (e) { if (target(e)) e.preventDefault(); });
  /* durante la selezione un tocco aggiunge o toglie; dopo la pressione lunga il tocco che segue non apre la scheda */
  listEl.addEventListener('click', function (e) {
    if (lp.fired) { lp.fired = false; e.preventDefault(); e.stopPropagation(); return; }
    if (!selOn) return;
    var el = e.target.closest('.row[data-id], .cover[data-id]');
    if (!el) return;
    e.preventDefault(); e.stopPropagation();
    toggleSel(el.dataset.id);
  }, true);
})();
$('#selExit').addEventListener('click', function () { endSel(false); });
$('#selAll').addEventListener('click', function () {
  var vis = visible(), n = selIds().length;
  sel = {};
  if (!(n && n >= vis.length)) vis.forEach(function (b) { sel[b.id] = ++selSeq; });
  paintSel();
});
/* numerazione dei volumi: ordine scelto, primo numero, anteprima */
var bkFromTouched = false;
function numFrom() { return Math.max(1, Math.min(999, parseInt($('#bkFrom').value, 10) || 1)); }
var bkCust = null;                                   // ordine personalizzato: { ids: [...], nums: { id: numero } }
function numHow() { return ($('#bulkSheet').querySelector('input[name="bkOrd"]:checked') || {}).value || 'sel'; }
function numOrder(how) {
  how = how || numHow();
  if (how === 'custom' && bkCust) return bkCust.ids.map(get).filter(function (b) { return b && sel[b.id]; });
  if (how === 'custom') how = 'sel';
  if (how === 'list') return visible().filter(function (b) { return sel[b.id]; });
  var books = selOrdered();
  if (how === 'year') books = books.slice().sort(function (x, y) { return (parseInt(x.y, 10) || 9999) - (parseInt(y.y, 10) || 9999) || sel[x.id] - sel[y.id]; });
  return books;
}
function numPreview() {
  var on = $('#bkSeNum').checked;
  $('#bkNumBox').hidden = !on;
  if (!on) return;
  var val = $('#bkSe').value.replace(/\s+/g, ' ').trim();
  if (!bkFromTouched) {                                                    // serie che hai gia': riparto dal numero dopo l'ultimo
    var max = 0;
    if (val) state.books.forEach(function (b) { if (!sel[b.id] && L.serKey(b.se) === L.serKey(val)) max = Math.max(max, parseInt(b.sn, 10) || 0); });
    $('#bkFrom').value = String(max + 1);
  }
  var from = numFrom(), how = numHow();
  $('#bkCustHint').hidden = how !== 'custom';
  $('#bkPrev').classList.toggle('cust', how === 'custom');
  if (how === 'custom') {
    var ids = numOrder().map(function (b) { return b.id; });
    $('#bkPrev').innerHTML = ids.map(function (id, i) {
      var b = get(id), n = bkCust.nums[id];
      return '<li data-id="' + id + '"><button type="button" class="bk-drag" aria-label="Trascina per spostare">≡</button>' +
        '<input class="bk-n" type="text" inputmode="numeric" maxlength="3" value="' + (n || '') + '" aria-label="Numero del volume">' +
        '<span>' + esc(b.t || b.i || 'Senza titolo') + (b.y ? ' <small>' + esc(b.y) + '</small>' : '') + '</span>' +
        '<button type="button" class="bk-mv" data-mv="-1" aria-label="Sposta su"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button type="button" class="bk-mv" data-mv="1" aria-label="Sposta giù"' + (i === ids.length - 1 ? ' disabled' : '') + '>↓</button></li>';
    }).join('');
    return;
  }
  $('#bkPrev').innerHTML = numOrder().map(function (b, i) {
    return '<li><b>' + (from + i) + '</b><span>' + esc(b.t || b.i || 'Senza titolo') + (b.y ? ' <small>' + esc(b.y) + '</small>' : '') + '</span></li>';
  }).join('');
}
function custRenumber() { var from = numFrom(); bkCust.ids.forEach(function (id, i) { bkCust.nums[id] = from + i; }); }
/* numeri da assegnare: [{ b, n }] oppure null (con l'avviso) se i numeri scritti a mano non vanno */
function numPlan() {
  var from = numFrom();
  if (numHow() !== 'custom') return numOrder().map(function (b, i) { return { b: b, n: from + i }; });
  var plan = numOrder().map(function (b) { return { b: b, n: parseInt(bkCust.nums[b.id], 10) || 0 }; }), seen = {};
  for (var i = 0; i < plan.length; i++) {
    if (!(plan[i].n >= 1 && plan[i].n <= 999)) { toast('Manca il numero di «' + (plan[i].b.t || plan[i].b.i) + '».'); return null; }
    if (seen[plan[i].n]) { toast('Il numero ' + plan[i].n + ' è usato due volte: correggi l\'anteprima.'); return null; }
    seen[plan[i].n] = 1;
  }
  return plan;
}
$('#bkSeNum').addEventListener('change', numPreview);
$('#bkSe').addEventListener('input', numPreview);
$('#bkFrom').addEventListener('input', function () { bkFromTouched = true; if (bkCust && numHow() === 'custom') custRenumber(); numPreview(); });
$('#bulkSheet').addEventListener('change', function (e) {
  if (e.target.name !== 'bkOrd') return;
  if (e.target.value === 'custom' && !bkCust) {                // si parte dall'ordine che vedevi
    var prevHow = ($('#bulkSheet').dataset.lastHow) || 'sel';
    bkCust = { ids: numOrder(prevHow).map(function (b) { return b.id; }), nums: {} }; custRenumber();
  }
  if (e.target.value !== 'custom') $('#bulkSheet').dataset.lastHow = e.target.value;
  numPreview();
});
/* personalizzato: frecce, numeri scritti a mano, trascinamento con la maniglia */
$('#bkPrev').addEventListener('click', function (e) {
  var mv = e.target.closest('[data-mv]'); if (!mv || !bkCust) return;
  var id = mv.closest('li').dataset.id, ids = bkCust.ids, i = ids.indexOf(id), j = i + (+mv.dataset.mv);
  if (i < 0 || j < 0 || j >= ids.length) return;
  ids.splice(i, 1); ids.splice(j, 0, id); custRenumber(); numPreview();
  var again = $('#bkPrev').querySelector('li[data-id="' + id + '"] [data-mv="' + mv.dataset.mv + '"]'); if (again && !again.disabled) again.focus(); else { var any = $('#bkPrev').querySelector('li[data-id="' + id + '"] .bk-drag'); if (any) any.focus(); }
});
$('#bkPrev').addEventListener('input', function (e) {
  if (!e.target.classList.contains('bk-n') || !bkCust) return;
  var v = e.target.value.replace(/\D/g, '').slice(0, 3); if (v !== e.target.value) e.target.value = v;
  bkCust.nums[e.target.closest('li').dataset.id] = v ? parseInt(v, 10) : '';
});
(function () {
  var drag = null;
  $('#bkPrev').addEventListener('pointerdown', function (e) {
    var hnd = e.target.closest('.bk-drag'); if (!hnd || !bkCust) return;
    e.preventDefault(); var li = hnd.closest('li');
    try { hnd.setPointerCapture(e.pointerId); } catch (x) {}
    drag = { li: li, id: li.dataset.id }; li.classList.add('dragging');
  });
  $('#bkPrev').addEventListener('pointermove', function (e) {
    if (!drag) return;
    var rows = Array.prototype.slice.call($('#bkPrev').children).filter(function (x) { return x !== drag.li; });
    var before = rows.find(function (x) { var r = x.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; });
    if (before) { if (drag.li.nextSibling !== before) $('#bkPrev').insertBefore(drag.li, before); }
    else if ($('#bkPrev').lastElementChild !== drag.li) $('#bkPrev').appendChild(drag.li);
  });
  function end() {
    if (!drag) return;
    drag.li.classList.remove('dragging');
    bkCust.ids = Array.prototype.map.call($('#bkPrev').children, function (x) { return x.dataset.id; }).concat(bkCust.ids.filter(function (id) { return !$('#bkPrev').querySelector('li[data-id="' + id + '"]'); }));
    drag = null; custRenumber(); numPreview();
  }
  $('#bkPrev').addEventListener('pointerup', end); $('#bkPrev').addEventListener('pointercancel', end);
})();
/* annulla per le modifiche di gruppo: copia dei libri com'erano */
function bulkSnap(books) { return books.map(function (b) { return JSON.parse(JSON.stringify(b)); }); }
function bulkUndo(snap) {
  return { label: 'Annulla', fn: function () {
    snap.forEach(function (o) { var i = state.books.findIndex(function (x) { return x.id === o.id; }); if (i >= 0) state.books[i] = o; else state.books.push(o); });
    touch(); renderList(); updateSummary();
  } };
}
function plural(n, one, many) { return n === 1 ? '1 ' + one : n + ' ' + many; }
var confirmFn = null;
function askConfirm(title, msg, okLabel, fn) {
  $('#confirmH').textContent = title; $('#confirmMsg').textContent = msg; $('#confirmOk').textContent = okLabel;
  confirmFn = fn; $('#confirmSheet').hidden = false;
  setTimeout(function () { try { $('#confirmNo').focus(); } catch (e) { nlErr(e); } }, 50);
}
$('#confirmOk').addEventListener('click', function () { var f = confirmFn; confirmFn = null; $('#confirmSheet').hidden = true; if (f) f(); });
$('#confirmNo').addEventListener('click', function () { confirmFn = null; $('#confirmSheet').hidden = true; });
$('#confirmSheet').addEventListener('click', function (e) { if (e.target === e.currentTarget) { confirmFn = null; $('#confirmSheet').hidden = true; } });
$('#selDel').addEventListener('click', function () {
  var books = selBooks(), n = books.length;
  if (!n) return;
  var names = books.slice(0, 3).map(function (b) { return '«' + (b.t || b.i || 'Senza titolo') + '»'; }).join(', ') + (n > 3 ? ' e altri ' + (n - 3) : '');
  askConfirm(n === 1 ? 'Eliminare il libro?' : 'Eliminare ' + n + ' libri?', names + '. Subito dopo puoi ancora annullare.', n === 1 ? 'Elimina' : 'Elimina ' + n + ' libri', function () {
    var snap = bulkSnap(books), ids = {};
    books.forEach(function (b) { ids[b.id] = 1; delete S[b.id]; });
    state.books = state.books.filter(function (b) { return !ids[b.id]; });
    endSel(false); touch(); renderList(); updateSummary();
    toast(plural(n, 'libro eliminato', 'libri eliminati'), bulkUndo(snap));
  });
});
function openBulk() {
  var n = selIds().length;
  if (!n) return;
  fillDatalists();
  $('#bulkMsg').textContent = 'Le modifiche valgono per ' + plural(n, 'libro selezionato', 'libri selezionati') + '. Dopo ognuna c\'è «Annulla».';
  ['#bkSe', '#bkSh', '#bkGen'].forEach(function (k) { $(k).value = ''; });
  $('#bkSeNum').checked = false; $('#bkNumBox').hidden = true; $('#bkFrom').value = '1'; bkFromTouched = false; bkCust = null; $('#bulkSheet').dataset.lastHow = 'sel';
  var r0 = $('#bulkSheet').querySelector('input[name="bkOrd"][value="sel"]'); if (r0) r0.checked = true;
  Array.prototype.forEach.call($('#bulkSheet').querySelectorAll('.bk-lib'), function (el) { el.hidden = tab === 'wish'; });
  $('#bulkSheet').querySelector('[data-bk="move"]').textContent = tab === 'wish' ? 'Sposta in Libreria' : 'Sposta nei Desideri';
  $('#bulkSheet').hidden = false;
}
$('#selEdit').addEventListener('click', openBulk);
$('#bulkClose').addEventListener('click', function () { $('#bulkSheet').hidden = true; });
$('#bulkSheet').addEventListener('click', function (e) {
  if (e.target === e.currentTarget) { $('#bulkSheet').hidden = true; return; }
  var x = e.target.closest('[data-bk]'); if (!x) return;
  var k = x.dataset.bk, v = x.dataset.v, books = selBooks(), n = books.length;
  if (!n) return;
  if (k === 'share') { $('#bulkSheet').hidden = true; openShare(books, { kind: 'list', title: '' }); return; }
  var snap = bulkSnap(books), msg = '';
  if (k === 'se' || k === 'sh' || k === 'gen') {
    var val = $({ se: '#bkSe', sh: '#bkSh', gen: '#bkGen' }[k]).value.replace(/\s+/g, ' ').trim().slice(0, 80);
    if (k === 'se' && $('#bkSeNum').checked) {
      if (!val) { toast('Scrivi il nome della serie per numerare i volumi.'); return; }
      var plan = numPlan();
      if (!plan) return;
      plan.forEach(function (p) { p.b.se = val; p.b.sn = String(p.n); });
      var tot = L.seriesInfo(state.books)[L.serKey(val)], ns = plan.map(function (p) { return p.n; }).sort(function (a, b) { return a - b; });
      var seq = ns.every(function (x, i) { return !i || x === ns[i - 1] + 1; });
      msg = plural(n, 'libro', 'libri') + ' nella serie «' + val + '», ' + (seq ? 'numerati da ' + ns[0] + ' a ' + ns[ns.length - 1] : 'con i numeri ' + ns.join(', ')) + '.';
      if (tot && tot.total) books.forEach(function (b) { if (!b.sq) b.sq = String(tot.total); });
    } else {
      books.forEach(function (b) { b[k] = val; if (k === 'se' && !val) { b.sn = ''; b.sq = ''; } });
      var what = { se: 'Serie', sh: 'Scaffale', gen: 'Genere' }[k];
      msg = val ? what + ' «' + val + '» per ' + plural(n, 'libro', 'libri') + '.' : what + ' tolto da ' + plural(n, 'libro', 'libri') + '.';
    }
  } else if (k === 'rs') {
    books.forEach(function (b) { if (b.w) return; b.rs = v; if (v === 'ok' && !b.rd) b.rd = today(); });
    msg = plural(n, 'libro segnato', 'libri segnati') + ' «' + L.READ_LABEL[v] + '».';
  } else if (k === 'fav') {
    books.forEach(function (b) { if (!b.w) b.fav = b.lc = v === '1'; });
    msg = v === '1' ? plural(n, 'libro aggiunto', 'libri aggiunti') + ' tra i consigliati.' : plural(n, 'libro tolto', 'libri tolti') + ' dai consigliati.';
  } else if (k === 'verify') {
    books.forEach(function (b) { b.g = []; });
    msg = plural(n, 'libro segnato', 'libri segnati') + ' come verificati.';
  } else if (k === 'move') {
    var toWish = tab !== 'wish';
    books.forEach(function (b) {
      b.w = toWish; b.ts = Date.now();
      if (toWish) { b.p = ''; b.pd = ''; b.xs = ''; b.xd = ''; b.xa = ''; b.rs = ''; b.rt = 0; b.rd = ''; b.cp = false; b.fav = false; }
      else if (!b.rs) b.rs = 'da';
    });
    msg = plural(n, 'libro spostato', 'libri spostati') + (toWish ? ' nei Desideri.' : ' in Libreria.');
    $('#bulkSheet').hidden = true; endSel(false);
  } else return;
  touch(); renderList(); updateSummary();
  toast(msg, bulkUndo(snap));
});
/* ---- fotocamera dentro l'app: sempre quella posteriore (l'app Fotocamera del telefono a volte riparte da quella frontale) ---- */
var snap = { stream: null, done: null, pushed: false, track: null, torch: false };
/* ---- Obiettivo con la luce: i telefoni hanno piu' obiettivi posteriori e il flash e' collegato a uno solo.
   La prima volta li provo uno per uno, scelgo quello che dichiara la luce e me lo ricordo (settings.torchCam:
   deviceId, oppure 'none' se nessuno ce l'ha: allora i pulsanti della luce non compaiono). ---- */
async function torchOnTrack(tr, on) {
  var ok = false;
  try { await tr.applyConstraints({ advanced: [{ torch: !!on }] }); ok = true; } catch (e) { nlErr(e); }
  try { await tr.applyConstraints({ torch: !!on }); ok = true; } catch (e) { nlErr(e); }
  return ok;
}
function trackTorch(st) { try { var t = st && st.getVideoTracks()[0], c = t && t.getCapabilities ? t.getCapabilities() : {}; return !!c.torch; } catch (e) { return false; } }
function lensMsg(t) { if (!$('#snap').hidden) $('#snapMsg').textContent = t; else if (scanning) scanMsg(t); else if (optOpen) $('#lensMsg').textContent = t; else toast(t); }
/* Impostazioni › Aggiunta dei libri › «Fotocamera e luce»: prova gli obiettivi e mostra quali hanno la luce (per capire perche' non si accende) */
function lensRows(list, pick) {
  return list.map(function (r) {
    return '<li><b>' + esc(r.label) + '</b><span>' + (r.ok ? (r.back === false ? 'anteriore' : r.back ? 'posteriore' : 'lato non indicato') + ' · ' + (r.torch ? '<em class="yes">luce sì</em>' : 'luce no') : 'non si apre') +
      (pick && pick.id === r.id ? ' · <em class="yes">in uso</em>' : '') + '</span></li>';
  }).join('');
}
function paintLensState() {
  var t = settings.torchCam;
  $('#lensState').textContent = !t ? 'Non ancora controllato: si controlla da solo la prima volta che apri la fotocamera, oppure qui.' :
    t === 'none' ? 'Nessun obiettivo dichiara la luce a Chrome: i pulsanti della luce non compaiono. Per il flash usa la fotocamera del telefono.' :
    'Trovato un obiettivo con la luce: l\'app usa quello.' + (settings.lightOk ? ' La luce si accende.' : ' Se toccando 🔦 la luce non si accende, usa «Prova la luce».');
}
/* alcuni telefoni (es. Galaxy A32) dichiarano la luce e dicono di averla accesa, ma resta spenta: l'app non puo' saperlo.
   Qui la accendo per qualche secondo e chiedo: se non si e' vista, niente pulsanti della luce (settings.torchCam = 'none'). */
var lightTest = null;
async function runLightTest() {
  var b = $('#lightRun'); b.disabled = true; $('#lightAsk').hidden = true;
  $('#lensMsg').textContent = 'Accendo la luce per qualche secondo: guarda il retro del telefono…';
  try {
    if (settings.torchCam === 'none') settings.torchCam = '';          // riprova da capo
    var st = await rearStream({ width: { ideal: 1920 }, height: { ideal: 1080 } }), tr = st.getVideoTracks()[0];
    lightTest = st;
    var v = document.createElement('video'); v.muted = true; v.playsInline = true; v.srcObject = st; try { await v.play(); } catch (e) { nlErr(e); }   // su alcuni telefoni la luce va solo con l'immagine attiva
    if (!trackTorch(st)) { stopLightTest(); $('#lensMsg').textContent = 'Nessun obiettivo dichiara la luce a Chrome: i pulsanti della luce non compaiono. Per il flash usa la fotocamera del telefono.'; settings.torchCam = 'none'; saveSettings(); paintLensState(); b.disabled = false; return; }
    await torchOnTrack(tr, true);
    await new Promise(function (r) { setTimeout(r, 2500); });
    await torchOnTrack(tr, false);
    stopLightTest();
    $('#lensMsg').textContent = 'Hai visto accendersi la luce sul retro del telefono?';
    $('#lightAsk').hidden = false;
  } catch (e) { stopLightTest(); $('#lensMsg').textContent = 'Non riesco ad aprire la fotocamera: controlla il permesso del sito.'; }
  b.disabled = false;
}
function stopLightTest() { if (lightTest) { lightTest.getTracks().forEach(function (t) { t.stop(); }); lightTest = null; } }
function lightAnswer(seen) {
  $('#lightAsk').hidden = true;
  if (seen) { settings.lightOk = true; $('#lensMsg').textContent = 'Bene: nella fotocamera dell\'app trovi la luce 🔦 (e il flash ⚡ per le copertine).'; }
  else { settings.torchCam = 'none'; settings.lightOk = false; $('#lensMsg').textContent = 'Ok: tolgo i pulsanti della luce. Per il flash usa «Usa la fotocamera del telefono», nella fotocamera dell\'app.'; }
  saveSettings(); paintLensState();
}
async function runLensCheck() {
  var b = $('#lensRun'); b.disabled = true; $('#lensList').innerHTML = ''; $('#lensMsg').textContent = 'Provo gli obiettivi uno per uno…';
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('no');
    var st = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); st.getTracks().forEach(function (t) { t.stop(); });   // permesso e nomi degli obiettivi
    var res = await chooseLightLens(function (r, i, n) { $('#lensMsg').textContent = 'Provo gli obiettivi: ' + (i + 1) + ' di ' + n + '…'; });
    $('#lensList').innerHTML = lensRows(res.list, res.pick);
    $('#lensMsg').textContent = res.pick ? 'Fatto: d\'ora in poi la fotocamera dell\'app usa l\'obiettivo con la luce.' : 'Fatto: nessun obiettivo ha la luce disponibile da Chrome.';
  } catch (e) { $('#lensMsg').textContent = 'Non riesco ad aprire la fotocamera: controlla il permesso del sito.'; }
  b.disabled = false; paintLensState();
}
async function probeLenses(onStep) {
  var md = navigator.mediaDevices, out = [];
  var devs = (await md.enumerateDevices()).filter(function (d) { return d.kind === 'videoinput'; });
  for (var i = 0; i < devs.length; i++) {
    var d = devs[i], r = { id: d.deviceId, label: d.label || ('Obiettivo ' + (i + 1)), back: null, torch: false, ok: false };
    try {
      var st = await md.getUserMedia({ video: { deviceId: { exact: d.deviceId } }, audio: false });
      var t = st.getVideoTracks()[0], c = t.getCapabilities ? t.getCapabilities() : {}, se = t.getSettings ? t.getSettings() : {};
      var fm = se.facingMode || (c.facingMode && c.facingMode[0]) || '';
      r.ok = true; r.torch = !!c.torch;
      r.back = fm ? fm === 'environment' : /back|rear|posterior|environment/i.test(r.label) ? true : /front|user|anterior|frontale/i.test(r.label) ? false : null;
      st.getTracks().forEach(function (x) { x.stop(); });
      await new Promise(function (ok) { setTimeout(ok, 150); });   // alcuni telefoni non riaprono subito un'altra fotocamera
    } catch (e) { nlErr(e); }
    out.push(r);
    if (onStep) onStep(r, i, devs.length);
  }
  return out;
}
async function chooseLightLens(onStep) {
  var list = await probeLenses(onStep);
  var pick = list.find(function (r) { return r.torch && r.back !== false; }) || null;
  settings.torchCam = pick ? pick.id : 'none'; saveSettings();
  return { pick: pick, list: list };
}
async function rearStream(res) {
  var md = navigator.mediaDevices, hi = res || { width: { ideal: 3264 }, height: { ideal: 2448 } };
  if (settings.torchCam && settings.torchCam !== 'none') {        // l'obiettivo con la luce, gia' trovato
    try { return await md.getUserMedia({ video: Object.assign({ deviceId: { exact: settings.torchCam } }, hi), audio: false }); }
    catch (e) { settings.torchCam = ''; saveSettings(); }          // non c'e' piu' (o ha cambiato nome): lo ricerco
  }
  var st = await rearStreamBase(hi);
  if (settings.torchCam) return st;                                // 'none': gia' provati tutti, nessuno ha la luce
  if (trackTorch(st)) { try { settings.torchCam = st.getVideoTracks()[0].getSettings().deviceId || ''; saveSettings(); } catch (e) { nlErr(e); } return st; }
  try {                                                            // prima volta e senza luce: provo gli altri obiettivi
    st.getTracks().forEach(function (t) { t.stop(); });
    lensMsg('Cerco l\'obiettivo con il flash (solo la prima volta)…');
    var found = await chooseLightLens();
    if (found.pick) { try { return await md.getUserMedia({ video: Object.assign({ deviceId: { exact: found.pick.id } }, hi), audio: false }); } catch (e) { nlErr(e); } }
  } catch (e) { nlErr(e); }
  return await rearStreamBase(hi);
}
async function rearStreamBase(hi) {
  var md = navigator.mediaDevices;
  try { return await md.getUserMedia({ video: Object.assign({ facingMode: { exact: 'environment' } }, hi), audio: false }); }
  catch (e) {
    var st = await md.getUserMedia({ video: Object.assign({ facingMode: { ideal: 'environment' } }, hi), audio: false });
    var tr = st.getVideoTracks()[0], set = tr && tr.getSettings ? tr.getSettings() : {};
    if (set.facingMode === 'user' || /front|anterior|frontale/i.test(tr && tr.label || '')) {     // ha dato quella frontale: cerco la posteriore per nome
      try {
        var cams = (await md.enumerateDevices()).filter(function (d) { return d.kind === 'videoinput'; });
        var back = cams.find(function (d) { return /back|rear|posterior|environment/i.test(d.label); });
        if (back) { st.getTracks().forEach(function (t) { t.stop(); }); return await md.getUserMedia({ video: Object.assign({ deviceId: { exact: back.deviceId } }, hi), audio: false }); }
      } catch (x) {}
    }
    return st;
  }
}
/* resolve(File) con la foto scattata o scelta dalla galleria, oppure null; senza fotocamera usa il selettore del telefono */
/* la fotocamera del telefono: scatta con il suo flash e restituisce la foto (un input a parte, che non aggiunge libri da solo) */
function nativePhoto(resolve) {
  var inp = $('#fileNative'), done = false;
  function on() { inp.removeEventListener('change', on); done = true; var f = inp.files && inp.files[0]; inp.value = ''; resolve(f || null); }
  inp.addEventListener('change', on); inp.click();
  window.addEventListener('focus', function back() { window.removeEventListener('focus', back); setTimeout(function () { if (!done) { inp.removeEventListener('change', on); resolve(null); } }, 1500); });
}
function snapPhoto(title, fallbackInput) {
  return new Promise(async function (resolve) {
    if (settings.camNative && !scanning) { nativePhoto(resolve); return; }      // scelta nelle Opzioni: sempre quella del telefono
    function viaInput(sel) {
      var inp = $(sel), done = false;
      function on() { inp.removeEventListener('change', on); done = true; var f = inp.files && inp.files[0]; inp.value = ''; resolve(f || null); }
      inp.addEventListener('change', on); inp.click();
      window.addEventListener('focus', function back() { window.removeEventListener('focus', back); setTimeout(function () { if (!done) { inp.removeEventListener('change', on); resolve(null); } }, 1200); });
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || scanning) { viaInput(fallbackInput); return; }
    snap.done = resolve;
    $('#snapH').textContent = title || 'Foto'; $('#snapMsg').textContent = 'Apro la fotocamera…';
    $('#snap').hidden = false; document.body.classList.add('snapping');
    try {
      snap.stream = await rearStream();
      if ($('#snap').hidden) { stopSnapStream(); return; }
      try { history.pushState({ snap: 1 }, ''); snap.pushed = true; } catch (e) { nlErr(e); }       // solo a fotocamera aperta: Indietro la chiude
      var v = $('#snapVideo'); v.srcObject = snap.stream; try { await v.play(); } catch (e) { nlErr(e); }
      snap.track = snap.stream.getVideoTracks()[0];
      var caps = {};
      try {
        caps = snap.track.getCapabilities ? snap.track.getCapabilities() : {};
        $('#snapTorch').hidden = !caps.torch || settings.torchCam === 'none';     // 'none': nessuna luce, o non si accende davvero
        if (caps.focusMode && caps.focusMode.indexOf('continuous') >= 0) snap.track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(function () {});
      } catch (e) { nlErr(e); }
      snap.caps = caps || {};
      $('#snapMsg').textContent = 'Tocca il libro sullo schermo per mettere a fuoco.';
      clearInterval(snap.lt); snap.lt = setInterval(snapLight, 700);
    } catch (e) {                                  // fotocamera non disponibile o negata: uso quella del telefono
      snap.done = null; stopSnapStream();
      $('#snap').hidden = true; document.body.classList.remove('snapping');
      viaInput(fallbackInput);
    }
  });
}
function stopSnapStream() {
  if (snap.stream) snap.stream.getTracks().forEach(function (t) { t.stop(); });
  snap.stream = null; snap.track = null; snap.torch = false; snap.dark = false;
  clearInterval(snap.lt); clearTimeout(snap.ft);
  $('#snapTorch').setAttribute('aria-pressed', 'false'); $('#snapTorch').classList.remove('hint'); $('#snapMsg').classList.remove('dark'); $('#snapFocus').hidden = true;
}
/* poca luce: la messa a fuoco fatica e la foto viene mossa. Misuro la luminosita' dell'inquadratura e lo dico,
   suggerendo «Luce» se il telefono ce l'ha (con isteresi, per non far lampeggiare l'avviso) */
function snapLight() {
  var v = $('#snapVideo');
  if (!snap.track || !v.videoWidth) return;
  try {
    var c = snap.lc || (snap.lc = document.createElement('canvas')); c.width = 32; c.height = 24;
    var x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(v, 0, 0, 32, 24);
    var d = x.getImageData(0, 0, 32, 24).data, sum = 0;
    for (var i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    var lum = sum / (d.length / 4);
    snap.lum = Math.round(lum);
    var dark = snap.torch ? false : snap.dark ? lum < 72 : lum < 55;
    if (dark === snap.dark) return;
    snap.dark = dark;
    var m = $('#snapMsg'), torch = !!(snap.caps && snap.caps.torch);
    m.classList.toggle('dark', dark);
    m.textContent = dark ? (torch ? 'Poca luce: accendi «Luce», la foto viene più nitida.' : 'Poca luce: avvicinati a una lampada, la foto verrebbe sfocata.') : 'Tocca il libro sullo schermo per mettere a fuoco.';
    $('#snapTorch').classList.toggle('hint', dark && torch);
  } catch (e) { nlErr(e); }
}
/* tocco sull'inquadratura: mette a fuoco li' (dove il telefono lo permette), poi torna alla messa a fuoco continua */
function snapFocusAt(e) {
  var v = $('#snapVideo');
  if (!snap.track || !v.videoWidth) return;
  var r = v.getBoundingClientRect(), sc = Math.max(r.width / v.videoWidth, r.height / v.videoHeight);   // inquadratura a tutto schermo (object-fit: cover)
  var w = v.videoWidth * sc, h = v.videoHeight * sc, ox = r.left + (r.width - w) / 2, oy = r.top + (r.height - h) / 2;
  var px = (e.clientX - ox) / w, py = (e.clientY - oy) / h;
  if (px < 0 || px > 1 || py < 0 || py > 1) return;
  var f = $('#snapFocus'); f.hidden = false; f.style.left = e.clientX + 'px'; f.style.top = e.clientY + 'px';
  f.style.animation = 'none'; void f.offsetWidth; f.style.animation = '';
  var caps = snap.caps || {}, fm = caps.focusMode || [], adv = {};
  if (caps.pointsOfInterest) adv.pointsOfInterest = [{ x: px, y: py }];
  if (fm.indexOf('single-shot') >= 0) adv.focusMode = 'single-shot';
  else if (fm.indexOf('continuous') >= 0) adv.focusMode = 'continuous';
  snap.taps = (snap.taps || 0) + 1;
  if (!Object.keys(adv).length) return;
  var tr = snap.track;
  tr.applyConstraints({ advanced: [adv] }).catch(function () {});
  clearTimeout(snap.ft);
  snap.ft = setTimeout(function () { if (snap.track === tr && fm.indexOf('continuous') >= 0) tr.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(function () {}); }, 3500);
}
$('#snapVideo').addEventListener('click', snapFocusAt);
function closeSnap(result, fromPop) {
  if ($('#snap').hidden) return;
  stopSnapStream();
  $('#snap').hidden = true; document.body.classList.remove('snapping'); $('#snapVideo').srcObject = null;
  var done = snap.done; snap.done = null;
  if (snap.pushed && !fromPop) { snap.pushed = false; try { history.back(); } catch (e) { nlErr(e); } }
  if (done) done(result || null);
}
async function snapShoot() {
  var v = $('#snapVideo'), btn = $('#snapShoot');
  if (!snap.track || !v.videoWidth) return;
  btn.disabled = true;
  var blob = null;
  try {
    if (window.ImageCapture) { var ic = new ImageCapture(snap.track); blob = await ic.takePhoto(snap.torch ? { fillLightMode: 'flash' } : {}); }   // piena risoluzione del sensore
  } catch (e) { blob = null; }
  if (!blob) {
    var c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    blob = await new Promise(function (r) { c.toBlob(r, 'image/jpeg', 0.92); });
  }
  btn.disabled = false;
  if (!blob) { $('#snapMsg').textContent = 'Scatto non riuscito: riprova.'; return; }
  try { vibrate(30); } catch (e) { nlErr(e); }
  closeSnap(new File([blob], 'foto.jpg', { type: blob.type || 'image/jpeg' }));
}
$('#snapShoot').addEventListener('click', snapShoot);
$('#snapClose').addEventListener('click', function () { closeSnap(null); });
$('#snapGal').addEventListener('click', function () { $('#fileSnapGal').click(); });
$('#snapNative').addEventListener('click', function () {      // dalla fotocamera dell'app a quella del telefono, per la stessa foto
  var done = snap.done; snap.done = null;
  closeSnap(null);
  if (done) nativePhoto(done);
});
$('#scanNative').addEventListener('click', function () {      // scansione: foto con la fotocamera del telefono; codice, ISBN o copertina li legge l'app dalla foto
  stopScan();
  $('#fileCam').click();
});
$('#fileSnapGal').addEventListener('change', function (e) { var f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) closeSnap(f); });
$('#snapTorch').addEventListener('click', async function () {
  if (!snap.track) return;
  var tr = snap.track, want = !snap.torch, ok = true;
  ok = await torchOnTrack(tr, want);
  if (ok && want) { try { var se = tr.getSettings ? tr.getSettings() : {}; if (se.torch === false) ok = false; } catch (e) { nlErr(e); } }
  if (!ok && want) {                                 // la luce non si accende da qui: tolgo il pulsante e lo ricordo
    snap.torch = false; snap.caps = Object.assign({}, snap.caps, { torch: false }); $('#snapTorch').hidden = true;
    settings.torchCam = 'none'; saveSettings();
    $('#snapMsg').textContent = 'Da qui la luce non si accende su questo telefono: per il flash usa «Usa la fotocamera del telefono».';
    return;
  }
  snap.torch = want;
  $('#snapTorch').setAttribute('aria-pressed', snap.torch ? 'true' : 'false');
  snap.dark = null; snapLight();                    // ridisegna subito l'avviso
});
window.addEventListener('popstate', function () { if (!$('#snap').hidden) { snap.pushed = false; closeSnap(null, true); } });
/* ---- editor della foto: evidenziatore, penna, gomma, emoticon e adesivi; tutto in coordinate dell'immagine.
   Un dito disegna (o mette/sposta un adesivo); due dita ingrandiscono e spostano.
   Composizione: foto, poi i segni (con la gomma che li cancella) in «moltiplica», poi gli adesivi sopra. ---- */
var ped = { sel: null, img: null, items: [], cur: null, tool: 'hl', color: '#FFE14D', stk: { s: '⭐' }, stkScale: 1, done: null, pushed: false, k: 1,
  view: { z: 1, x: 0, y: 0 }, fit: { w: 0, h: 0, l: 0, t: 0 }, ptr: {}, pinch: null, drawId: null, drag: null, raf: 0, mk: null, last: null };
function pedMax() { return ped.img ? Math.max(ped.img.width, ped.img.height) : 1000; }
function pedWidth(tool) { var w = pedMax(); return tool === 'hl' ? Math.max(16, w * 0.032) : tool === 'er' ? Math.max(20, w * 0.04) : Math.max(3, w * 0.005); }
function pedStrokePath(ctx, st, k) {
  ctx.lineCap = st.k === 'hl' ? 'butt' : 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = st.w * k;
  ctx.beginPath(); ctx.moveTo(st.pts[0][0] * k, st.pts[0][1] * k);
  if (st.pts.length === 1) ctx.lineTo(st.pts[0][0] * k + 0.1, st.pts[0][1] * k);
  for (var i = 1; i < st.pts.length; i++) ctx.lineTo(st.pts[i][0] * k, st.pts[i][1] * k);
}
/* adesivi vivi: tolti con la gomma o spostati (le mosse restano nell'elenco, cosi' «↶» le annulla una alla volta) */
function pedStickers() {
  var out = [];
  ped.items.forEach(function (it) {
    if (it.k === 'stk') out.push({ it: it, x: it.x, y: it.y, size: it.size, r: it.r != null ? it.r : (it.l ? -0.05 : 0) });
    else if (it.k === 'tf') out.forEach(function (o) { if (o.it === it.t) { o.x = it.x; o.y = it.y; o.size = it.size; o.r = it.r; } });   // spostato, ridimensionato o ruotato
    else if (it.k === 'rm') out = out.filter(function (o) { return o.it !== it.t; });
    else if (it.k === 'mv') out.forEach(function (o) { if (o.it === it.t) { o.x = it.x; o.y = it.y; } });
    else if (it.k === 'sz') out.forEach(function (o) { if (o.it === it.t) o.size = it.size; });
  });
  return out;
}
function pedStkFont(o) { return o.it.l ? '700 ' + Math.round(o.size * 0.36) + 'px "IBM Plex Sans",system-ui,sans-serif' : Math.round(o.size) + 'px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif'; }
function pedStkBox(ctx, o) {                                   // riquadro dell'adesivo, in coordinate dell'immagine
  if (!o.it.l) return { w: o.size * 1.1, h: o.size * 1.1 };
  ctx.save(); ctx.font = pedStkFont(o); var tw = ctx.measureText(o.it.l).width; ctx.restore();
  return { w: tw + o.size * 0.5, h: o.size * 0.62 };
}
function pedDrawSticker(ctx, o, k) {
  ctx.save();
  ctx.translate(o.x * k, o.y * k); ctx.scale(k, k);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = pedStkFont(o);
  if (o.it.l) {
    var b = pedStkBox(ctx, o), r = b.h * 0.28;
    ctx.rotate(o.r || 0);
    ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = o.size * 0.08; ctx.shadowOffsetY = o.size * 0.03;
    ctx.fillStyle = o.it.c;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-b.w / 2, -b.h / 2, b.w, b.h, r); else ctx.rect(-b.w / 2, -b.h / 2, b.w, b.h);
    ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.fillStyle = '#fff'; ctx.fillText(o.it.l, 0, o.size * 0.02);
  } else {
    ctx.rotate(o.r || 0);
    ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = o.size * 0.06; ctx.shadowOffsetY = o.size * 0.02;
    ctx.fillText(o.it.s, 0, o.size * 0.05);
  }
  ctx.restore();
}
/* disegna tutto su ctx (w x h pixel, k = pixel per pixel dell'immagine); cur = tratto in corso da includere (gomma) */
function pedCompose(ctx, w, h, k, cur) {
  ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, w, h); ctx.drawImage(ped.img, 0, 0, w, h);
  var strokes = ped.items.filter(function (it) { return it.k === 'hl' || it.k === 'pen' || it.k === 'er'; });
  if (cur && cur.k === 'er') strokes = strokes.concat([cur]);
  if (strokes.length) {
    if (!ped.mk || ped.mk.width !== w || ped.mk.height !== h) { ped.mk = document.createElement('canvas'); ped.mk.width = w; ped.mk.height = h; }
    var m = ped.mk.getContext('2d');
    m.globalCompositeOperation = 'source-over'; m.globalAlpha = 1; m.clearRect(0, 0, w, h);
    strokes.forEach(function (st) {
      m.save();
      if (st.k === 'er') { m.globalCompositeOperation = 'destination-out'; m.strokeStyle = '#000'; }
      else { m.globalCompositeOperation = 'source-over'; m.globalAlpha = st.k === 'hl' ? 0.6 : 1; m.strokeStyle = st.color; }
      pedStrokePath(m, st, k); m.stroke(); m.restore();
    });
    ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(ped.mk, 0, 0); ctx.globalCompositeOperation = 'source-over';
  }
  pedStickers().forEach(function (o) { pedDrawSticker(ctx, o, k); });
  ctx.restore();
}
function pedRenderBase(cur) {
  var c = $('#pedCanvas');
  pedCompose(c.getContext('2d'), c.width, c.height, ped.k, cur);
  $('#pedUndo').disabled = $('#pedClear').disabled = !ped.items.length;
}
function pedSelO() { return ped.sel && ped.tool === 'stk' ? pedStickers().find(function (o) { return o.it === ped.sel; }) || null : null; }
function pedUnit() { var r = $('#pedCanvas').getBoundingClientRect(); return ped.img && r.width ? ped.img.width / r.width : 1; }   // pixel dell'immagine per pixel di schermo
function pedRot(o, x, y) { var c = Math.cos(o.r || 0), s = Math.sin(o.r || 0); return [o.x + x * c - y * s, o.y + x * s + y * c]; }
function pedHandles(o) {
  var b = pedStkBox($('#pedCanvas').getContext('2d'), o), u = pedUnit(), pad = 8 * u;
  var hw = b.w / 2 + pad, hh = b.h / 2 + pad;
  return { hw: hw, hh: hh, rad: 15 * u, del: pedRot(o, -hw, -hh), size: pedRot(o, hw, hh), rot: pedRot(o, 0, -hh - 30 * u), top: pedRot(o, 0, -hh) };
}
function pedHandleAt(o, pt) {
  var h = pedHandles(o), hit = h.rad * 1.5;
  if (Math.hypot(pt[0] - h.size[0], pt[1] - h.size[1]) <= hit) return 'size';
  if (Math.hypot(pt[0] - h.rot[0], pt[1] - h.rot[1]) <= hit) return 'rot';
  if (Math.hypot(pt[0] - h.del[0], pt[1] - h.del[1]) <= hit) return 'del';
  return null;
}
function pedDrawHandles(ctx, o) {
  var h = pedHandles(o), k = ped.k, u = pedUnit();
  ctx.save();
  ctx.lineWidth = 2 * u * k; ctx.strokeStyle = '#ffffff'; ctx.setLineDash([7 * u * k, 5 * u * k]);
  ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 3 * u * k;
  ctx.beginPath();
  [pedRot(o, -h.hw, -h.hh), pedRot(o, h.hw, -h.hh), pedRot(o, h.hw, h.hh), pedRot(o, -h.hw, h.hh)].forEach(function (p, i) { if (i) ctx.lineTo(p[0] * k, p[1] * k); else ctx.moveTo(p[0] * k, p[1] * k); });
  ctx.closePath(); ctx.stroke();
  ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(h.top[0] * k, h.top[1] * k); ctx.lineTo(h.rot[0] * k, h.rot[1] * k); ctx.stroke();
  function dot(p, fill, draw) {
    ctx.beginPath(); ctx.arc(p[0] * k, p[1] * k, h.rad * k, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2.5 * u * k; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.save(); ctx.translate(p[0] * k, p[1] * k); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.2 * u * k; ctx.lineCap = 'round'; ctx.shadowColor = 'transparent'; draw(h.rad * k * 0.45); ctx.restore();
  }
  dot(h.del, '#D7263D', function (q) { ctx.beginPath(); ctx.moveTo(-q, -q); ctx.lineTo(q, q); ctx.moveTo(q, -q); ctx.lineTo(-q, q); ctx.stroke(); });
  dot(h.size, '#1B6A4F', function (q) { ctx.rotate(o.r || 0); ctx.beginPath(); ctx.moveTo(-q, -q); ctx.lineTo(q, q); ctx.moveTo(q * 0.1, q); ctx.lineTo(q, q); ctx.lineTo(q, q * 0.1); ctx.moveTo(-q * 0.1, -q); ctx.lineTo(-q, -q); ctx.lineTo(-q, -q * 0.1); ctx.stroke(); });
  dot(h.rot, '#2457D6', function (q) { ctx.beginPath(); ctx.arc(0, 0, q, -Math.PI * 0.9, Math.PI * 0.55); ctx.stroke(); ctx.beginPath(); ctx.moveTo(q * Math.cos(Math.PI * 0.55) - q * 0.5, q * Math.sin(Math.PI * 0.55)); ctx.lineTo(q * Math.cos(Math.PI * 0.55), q * Math.sin(Math.PI * 0.55)); ctx.lineTo(q * Math.cos(Math.PI * 0.55), q * Math.sin(Math.PI * 0.55) - q * 0.5); ctx.stroke(); });
  ctx.restore();
}
function pedRenderLive() {
  var c = $('#pedLive'), ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  if (!ped.cur || ped.cur.k === 'er') {
    var so = !ped.cur && pedSelO();
    c.classList.remove('hl');
    if (so) pedDrawHandles(ctx, so);
    return;
  }
  c.classList.toggle('hl', ped.cur.k === 'hl');
  ctx.save(); ctx.strokeStyle = ped.cur.color; pedStrokePath(ctx, ped.cur, ped.k); ctx.stroke(); ctx.restore();
}
function pedLater() { if (ped.raf) return; ped.raf = requestAnimationFrame(function () { ped.raf = 0; pedRenderBase(ped.cur); if (!ped.cur) pedRenderLive(); }); }
function pedRender() { pedRenderBase(); pedRenderLive(); }
function pedApplyView() {
  var v = ped.view;
  $('#pedStage').style.transform = 'translate(' + v.x + 'px,' + v.y + 'px) scale(' + v.z + ')';
  $('#pedFit').hidden = v.z <= 1.01;
}
function pedClampView() {
  var v = ped.view, f = ped.fit, a = $('#pedArea');
  v.z = Math.max(1, Math.min(6, v.z));
  if (v.z <= 1.001) { v.z = 1; v.x = 0; v.y = 0; return; }
  var w = f.w * v.z, hh = f.h * v.z, aw = a.clientWidth, ah = a.clientHeight;
  var minX = Math.min(0, aw - f.l - w), maxX = Math.max(0, -f.l), minY = Math.min(0, ah - f.t - hh), maxY = Math.max(0, -f.t);
  if (w <= aw) { minX = maxX = (aw - w) / 2 - f.l; }
  if (hh <= ah) { minY = maxY = (ah - hh) / 2 - f.t; }
  v.x = Math.max(minX, Math.min(maxX, v.x)); v.y = Math.max(minY, Math.min(maxY, v.y));
}
function pedFit() {
  if (!ped.img) return;
  var area = $('#pedArea'), aw = area.clientWidth - 12, ah = area.clientHeight - 12;
  var k = Math.min(aw / ped.img.width, ah / ped.img.height);
  var w = Math.round(ped.img.width * k), hh = Math.round(ped.img.height * k);
  ped.fit = { w: w, h: hh, l: Math.round((area.clientWidth - w) / 2), t: Math.round((area.clientHeight - hh) / 2) };
  var st = $('#pedStage'); st.style.width = w + 'px'; st.style.height = hh + 'px'; st.style.left = ped.fit.l + 'px'; st.style.top = ped.fit.t + 'px';
  var res = Math.min(1, 2400 / pedMax());
  ['#pedCanvas', '#pedLive'].forEach(function (sel) { var c = $(sel); c.width = Math.round(ped.img.width * res); c.height = Math.round(ped.img.height * res); });
  ped.k = res;
  ped.view = { z: 1, x: 0, y: 0 }; pedApplyView();
  pedRender();
}
function pedPoint(e) { var r = $('#pedCanvas').getBoundingClientRect(), k = ped.img.width / r.width; return [Math.max(0, Math.min(ped.img.width, (e.clientX - r.left) * k)), Math.max(0, Math.min(ped.img.height, (e.clientY - r.top) * k))]; }
function pedStickerAt(pt) {
  var ctx = $('#pedCanvas').getContext('2d'), list = pedStickers();
  for (var i = list.length - 1; i >= 0; i--) {
    var o = list[i], b = pedStkBox(ctx, o), pad = pedMax() * 0.01;
    var c = Math.cos(-(o.r || 0)), sn = Math.sin(-(o.r || 0)), dx = pt[0] - o.x, dy = pt[1] - o.y, lx = dx * c - dy * sn, ly = dx * sn + dy * c;
    if (Math.abs(lx) <= b.w / 2 + pad && Math.abs(ly) <= b.h / 2 + pad) return o;
  }
  return null;
}
function pedStkSize(lab) { return pedMax() * (lab ? 0.085 : 0.09) * ped.stkScale; }
/* apre l'editor sull'immagine (Blob o URL); resolve(Blob con i segni) oppure null se lasci com'e' */
function editPhoto(src) {
  return new Promise(async function (resolve) {
    try {
      var bl = src instanceof Blob ? src : await (await fetch(src)).blob();
      var bmp = await createImageBitmap(bl);
      var c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; c.getContext('2d').drawImage(bmp, 0, 0); if (bmp.close) bmp.close();
      ped.img = c;
    } catch (e) { resolve(null); return; }
    ped.items = []; ped.cur = null; ped.done = resolve; ped.ptr = {}; ped.pinch = null; ped.drawId = null; ped.drag = null; ped.sel = null;
    $('#ped').hidden = false; document.body.classList.add('snapping');
    try { history.pushState({ ped: 1 }, ''); ped.pushed = true; } catch (e) { nlErr(e); }
    requestAnimationFrame(pedFit);
  });
}
function closePed(result, fromPop) {
  if ($('#ped').hidden) return;
  $('#ped').hidden = true; if ($('#snap').hidden) document.body.classList.remove('snapping');
  var done = ped.done; ped.done = null; ped.img = null; ped.items = []; ped.cur = null; ped.ptr = {}; ped.pinch = null; ped.drag = null; ped.mk = null;
  if (ped.pushed && !fromPop) { ped.pushed = false; try { history.back(); } catch (e) { nlErr(e); } }
  if (done) done(result || null);
}
async function pedFinish() {
  if (!ped.items.length) { closePed(null); return; }
  var c = document.createElement('canvas'); c.width = ped.img.width; c.height = ped.img.height;
  ped.mk = null; pedCompose(c.getContext('2d'), c.width, c.height, 1, null);
  var blob = await new Promise(function (r) { c.toBlob(r, 'image/jpeg', 0.85); });
  closePed(blob);
}
(function () {
  var area = $('#pedArea');
  function two() { var ids = Object.keys(ped.ptr); return ids.length >= 2 ? [ped.ptr[ids[0]], ped.ptr[ids[1]]] : null; }
  function pinchStart() {
    var p = two(); if (!p) return;
    var r = area.getBoundingClientRect();
    ped.pinch = { d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1, mx: (p[0].x + p[1].x) / 2 - r.left, my: (p[0].y + p[1].y) / 2 - r.top, v: Object.assign({}, ped.view) };
  }
  area.addEventListener('pointerdown', function (e) {
    if (!ped.img) return;
    e.preventDefault(); try { area.setPointerCapture(e.pointerId); } catch (x) {}
    ped.ptr[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (Object.keys(ped.ptr).length >= 2) {                     // secondo dito: niente segno, si ingrandisce
      if (ped.cur) { ped.cur = null; pedRender(); }
      if (ped.drag) { var dd = ped.drag; dd.o.it.x = dd.o.it.x; ped.drag = null; pedRender(); }
      ped.drawId = null; pinchStart(); return;
    }
    if (!e.target.closest('#pedStage')) return;
    var pt = pedPoint(e);
    ped.drawId = e.pointerId;
    if (ped.tool === 'stk' || ped.tool === 'er') {
      var so = pedSelO(), hd = so && pedHandleAt(so, pt);
      if (hd === 'del') { ped.items.push({ k: 'rm', t: so.it }); ped.sel = null; ped.drawId = null; pedRender(); return; }
      if (hd) { ped.drag = { o: so, mode: hd, x0: so.x, y0: so.y, s0: so.size, r0: so.r || 0, a0: Math.atan2(pt[1] - so.y, pt[0] - so.x), d0: Math.hypot(pt[0] - so.x, pt[1] - so.y) || 1 }; return; }
      var hit = pedStickerAt(pt);
      if (hit && ped.tool === 'er') { ped.items.push({ k: 'rm', t: hit.it }); ped.drawId = null; pedRender(); return; }     // la gomma toglie l'adesivo
      if (hit) { ped.sel = hit.it; ped.drag = { o: hit, mode: 'move', dx: pt[0] - hit.x, dy: pt[1] - hit.y, x0: hit.x, y0: hit.y, s0: hit.size, r0: hit.r || 0 }; pedRenderLive(); return; }
      if (ped.tool === 'stk') {
        if (ped.sel) { ped.sel = null; ped.drawId = null; pedRenderLive(); return; }       // tocco fuori: deseleziono
        var lab = !!ped.stk.l, it = { k: 'stk', s: ped.stk.s || '', l: ped.stk.l || '', c: ped.stk.c || '', x: pt[0], y: pt[1], size: pedStkSize(lab), r: lab ? -0.05 : 0 };
        ped.items.push(it); ped.sel = it; ped.drawId = null; pedRender(); return;
      }
    }
    ped.cur = { k: ped.tool, color: ped.color, w: pedWidth(ped.tool), pts: [pt] };
    if (ped.tool === 'er') pedLater(); else pedRenderLive();
  });
  area.addEventListener('pointermove', function (e) {
    if (!ped.ptr[e.pointerId]) return;
    ped.ptr[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (ped.pinch) {
      var p = two(); if (!p) return;
      var r = area.getBoundingClientRect(), q = ped.pinch, v0 = q.v;
      var z = Math.max(1, Math.min(6, v0.z * (Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) / q.d)));
      var mx = (p[0].x + p[1].x) / 2 - r.left, my = (p[0].y + p[1].y) / 2 - r.top, f = ped.fit;
      var cx = (q.mx - f.l - v0.x) / v0.z, cy = (q.my - f.t - v0.y) / v0.z;
      ped.view = { z: z, x: mx - f.l - cx * z, y: my - f.t - cy * z };
      pedClampView(); pedApplyView(); return;
    }
    if (e.pointerId !== ped.drawId) return;
    var pt = pedPoint(e);
    if (ped.drag) {                                               // sposto, ridimensiono o ruoto l'adesivo: una sola voce per gesto (annullabile)
      var d = ped.drag, nx = d.x0, ny = d.y0, ns = d.s0, nr = d.r0;
      if (d.mode === 'move') { nx = pt[0] - d.dx; ny = pt[1] - d.dy; }
      else if (d.mode === 'size') ns = Math.max(pedMax() * 0.03, Math.min(pedMax() * 0.6, d.s0 * Math.hypot(pt[0] - d.x0, pt[1] - d.y0) / d.d0));
      else if (d.mode === 'rot') {
        nr = d.r0 + Math.atan2(pt[1] - d.y0, pt[0] - d.x0) - d.a0;
        var snap = Math.round(nr / (Math.PI / 2)) * (Math.PI / 2); if (Math.abs(nr - snap) < 0.06) nr = snap;     // dritto se ci sei vicino
      }
      if (!d.tmp) { d.tmp = { k: 'tf', t: d.o.it, x: nx, y: ny, size: ns, r: nr }; ped.items.push(d.tmp); } else { d.tmp.x = nx; d.tmp.y = ny; d.tmp.size = ns; d.tmp.r = nr; }
      pedLater(); return;
    }
    if (!ped.cur) return;
    var c0 = ped.cur.pts[0];
    if (ped.cur.k === 'hl' && ped.cur.pts.length > 1 && Math.abs(pt[0] - c0[0]) > Math.abs(pt[1] - c0[1]) * 2) pt[1] = c0[1] + (pt[1] - c0[1]) * 0.25;   // evidenziatore: righe dritte
    ped.cur.pts.push(pt);
    if (ped.cur.k === 'er') pedLater(); else pedRenderLive();
  });
  function up(e) {
    if (!ped.ptr[e.pointerId]) return;
    delete ped.ptr[e.pointerId];
    if (ped.pinch) { if (Object.keys(ped.ptr).length < 2) ped.pinch = null; return; }
    if (e.pointerId !== ped.drawId) return;
    ped.drawId = null;
    if (ped.drag) { ped.drag = null; pedRender(); return; }
    if (ped.cur) { ped.items.push(ped.cur); ped.cur = null; pedRender(); }
  }
  area.addEventListener('pointerup', up); area.addEventListener('pointercancel', up);
  area.addEventListener('wheel', function (e) {
    if (!ped.img) return; e.preventDefault();
    var r = area.getBoundingClientRect(), v0 = Object.assign({}, ped.view), f = ped.fit;
    var z = Math.max(1, Math.min(6, v0.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    var mx = e.clientX - r.left, my = e.clientY - r.top, cx = (mx - f.l - v0.x) / v0.z, cy = (my - f.t - v0.y) / v0.z;
    ped.view = { z: z, x: mx - f.l - cx * z, y: my - f.t - cy * z }; pedClampView(); pedApplyView();
  }, { passive: false });
})();
var PED_HINT = { hl: 'Evidenziatore: un dito passa sulle righe, due dita ingrandiscono', pen: 'Penna: un dito scrive, due dita ingrandiscono',
  er: 'Gomma: passa sui segni per cancellarli; tocca un adesivo per toglierlo', stk: 'Tocca la foto per mettere l\'adesivo. Toccandolo lo selezioni: trascinalo, maniglia verde per la grandezza, blu per ruotarlo, rossa per toglierlo' };
function pedSetTool(b) {
  ped.tool = b.dataset.tool; if (b.dataset.color) ped.color = b.dataset.color;
  Array.prototype.forEach.call($('#ped').querySelectorAll('.ped-tools [data-tool]'), function (x) { x.setAttribute('aria-checked', x === b ? 'true' : 'false'); });
  $('#pedStk').hidden = ped.tool !== 'stk';
  $('#pedHint').textContent = PED_HINT[ped.tool];
  $('#pedArea').classList.toggle('stk-mode', ped.tool === 'stk');
  pedRenderLive();
}
$('#ped').querySelector('.ped-tools').addEventListener('click', function (e) { var b = e.target.closest('[data-tool]'); if (b) pedSetTool(b); });
$('#pedStk').addEventListener('click', function (e) {
  var b = e.target.closest('[data-s], [data-l]'); if (!b) return;
  ped.stk = b.dataset.l ? { l: b.dataset.l, c: b.dataset.c } : { s: b.dataset.s };
  ped.sel = null; pedRenderLive();                              // scelto un adesivo: il prossimo tocco lo mette
  Array.prototype.forEach.call($('#pedStk').querySelectorAll('[data-s], [data-l]'), function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
});
function pedResize(f) {
  ped.stkScale = Math.max(0.5, Math.min(2.5, ped.stkScale * f));
  var o = ped.sel && pedStickers().find(function (x) { return x.it === ped.sel; });
  if (o) { ped.items.push({ k: 'tf', t: o.it, x: o.x, y: o.y, r: o.r, size: Math.max(pedMax() * 0.03, Math.min(pedMax() * 0.6, o.size * f)) }); pedRender(); }
}
$('#pedSmaller').addEventListener('click', function () { pedResize(1 / 1.25); });
$('#pedBigger').addEventListener('click', function () { pedResize(1.25); });
$('#pedFit').addEventListener('click', function () { ped.view = { z: 1, x: 0, y: 0 }; pedApplyView(); });
$('#pedUndo').addEventListener('click', function () { var x = ped.items.pop(); if (x && x === ped.sel) ped.sel = null; pedRender(); });
$('#pedClear').addEventListener('click', function () { ped.items = []; ped.sel = null; pedRender(); });
$('#pedDone').addEventListener('click', pedFinish);
$('#pedSkip').addEventListener('click', function () { closePed(null); });
window.addEventListener('resize', function () { if (!$('#ped').hidden) pedFit(); });
window.addEventListener('popstate', function () { if (!$('#ped').hidden) { ped.pushed = false; closePed(null, true); } });
