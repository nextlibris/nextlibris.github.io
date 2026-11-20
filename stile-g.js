/* Next Libris · stile G «Pagina con l'Indice» (Piero, 20/11/2026; tela https://claude.ai/artifact/Tqa6XajvQCK2CVZdSSSimq, documento
   claude/nuovo-stile-proposte.md). L'app come un libro aperto: testatina in alto, nastro segnalibro con il numero dei libri, una frase
   in prosa, linguette laterali al posto della barra in basso (Libri · Desideri · Per te · Amici · Tu), «+ Aggiungi»
   che galleggia, il Menu diventa l'«Indice» a capitoli. Testatina, titolo, nastro e frase stanno in index.html; qui si disegnano le
   linguette e «+ Aggiungi» e si collega tutto alle funzioni dell'app (NL, NLLayout). Le regole d'aspetto stanno in stile-g.css.
   20/11/2026: tolti i tasti delle vecchie disposizioni, che questo modulo «premeva» di nascosto. */
(function () {
'use strict';
var NL = window.NL;
if (!NL) return;
var $ = function (s) { return document.querySelector(s); };
var esc = NL.esc || function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
var SV = function (p, s) { return '<svg viewBox="0 0 24 24" width="' + (s || 20) + '" height="' + (s || 20) + '" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; };
var IC = {
  libri: '<path d="M4 4h4v16H4zM10 4h4v16h-4z"/><path d="M16.5 5l3.5-.8 2.6 15.4-3.5.8z"/>',
  desideri: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  perte: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  amici: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.6a5 5 0 0 1 5.5 5.4"/>',
  tu: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  chat: '<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.1A8 8 0 1 1 20 12z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  indice: '<path d="M4 7h16M4 12h16M4 17h10"/>'
};
function act(l) { if (window.NLLayout) window.NLLayout.act(l); }
function vis(sel) { var e = $(sel); return !!(e && !e.hidden); }
/* hidden cambiato solo se serve: ogni scrittura sveglia gli osservatori (questo modulo e il ritorno all'Indice di app-filtri.js);
   prima si ridipingeva di continuo, ogni 40 ms, e «Chiudi» delle finestre dell'Indice non tornava all'Indice (20/11/2026) */
function setHidden(e, v) { if (e && e.hidden !== !!v) e.hidden = !!v; }

/* ---------- linguette laterali ---------- */
var TABS = [['idx', 'Indice', 'indice'], ['lib', 'Libri', 'libri'], ['wish', 'Desideri', 'desideri'], ['you', 'Per te', 'perte'], ['fri', 'Amici', 'amici'], ['chat', 'Chat', 'chat'], ['prof', 'Tu', 'tu']]; /* Chat aggiunta da Piero il 20/11/2026; Indice in cima al posto del tasto ≡ della testatina (Piero, 20/11/2026) */
function tabs() {
  if ($('#gTabs')) return;
  var n = document.createElement('nav'); n.id = 'gTabs'; n.className = 'g-tabs'; n.setAttribute('aria-label', 'Sezioni');
  n.innerHTML = '<span class="g-edge" aria-hidden="true"></span>' + TABS.map(function (t) {
    return '<button type="button" data-g="' + t[0] + '">' + SV(IC[t[2]], 17) + '<span>' + t[1] + '</span></button>';
  }).join('');
  document.body.appendChild(n);
  n.addEventListener('click', function (e) {
    var b = e.target.closest('[data-g]'); if (!b) return;
    var g = b.dataset.g, wasIdx = current() === 'idx';
    closeAll();
    if (g === 'idx') { if (!wasIdx) NL.openMenu(true); }   // un altro tocco sul segnalibro Indice lo richiude
    else if (g === 'fri') { if (window.NLAmici && window.NLAmici.open) window.NLAmici.open(); }
    else if (g === 'chat') { if (window.NLChat && window.NLChat.open) window.NLChat.open(); }
    else act(g);
    setTimeout(paintTabs, 60);
  });
}
/* chiude le pagine intere aperte prima di passare a un'altra linguetta (profilo, amici, chat, Per te, Indice) */
function closeAll() {
  if (window.NLProfilo && window.NLProfilo.close && vis('#profSheet')) window.NLProfilo.close();
  ['#friSheet', '#chSheet', '#layYou', '#layAdd'].forEach(function (s) { var e = $(s); if (e && !e.hidden) { var x = e.querySelector('.sh-x, #friClose, #chClose, [data-close]'); if (x) x.click(); else e.hidden = true; } });
  if ((document.documentElement.classList.contains('drawer-open') || vis('#drawer')) && window.__app && window.__app.closeDrawer) window.__app.closeDrawer();
  var open = document.querySelector('.row.open.cv-full .chev-btn'); if (open) open.click();
  var wr = $('#wrap'); if (wr && !wr.hidden && window.NLWrap && window.NLWrap.close) window.NLWrap.close();
  ['#lbClose', '#phClose'].forEach(function (q) { var b = $(q); if (b && b.closest('[hidden]') === null && b.offsetParent) b.click(); });   // copertina o foto ingrandite
  /* le finestre dal basso aperte sopra la pagina (Statistiche, Suggerimenti, Aspetto…): si chiudono passando a un'altra linguetta */
  Array.prototype.forEach.call(document.querySelectorAll('.sheet:not([hidden])'), function (e) {
    if (/^(profSheet|friSheet|chSheet|layYou|layAdd)$/.test(e.id)) return;
    var x = e.querySelector('[data-close], .sh-x, .x, button[aria-label^="Chiudi"]'); if (x) x.click(); if (!e.hidden) e.hidden = true;
  });
}
function current() {
  if (vis('#chSheet')) return 'chat';
  if (vis('#friSheet')) return 'fri';
  if (vis('#profSheet')) return (window.NLProfilo && window.NLProfilo.state && window.NLProfilo.state().cur) ? 'fri' : 'prof';
  if (document.documentElement.classList.contains('drawer-open') || document.body.classList.contains('drawer-open') || vis('#drawer')) return 'idx';
  if (vis('#layYou') || vis('#wrap')) return 'you';
  if (NL.guest && NL.guest()) return 'fri';
  return NL.tab && NL.tab() === 'wish' ? 'wish' : 'lib';
}
var lastTab = 'lib';
function paintTabs() {
  var c = current();
  /* con una finestra dal basso aperta (Statistiche, Suggerimenti…) resta accesa la linguetta da cui si è partiti */
  if (c === 'lib' && lastTab !== 'lib' && document.querySelector('.sheet:not([hidden]):not(#layAdd):not(.gd-infosheet)')) c = lastTab;
  lastTab = c;
  Array.prototype.forEach.call(document.querySelectorAll('#gTabs [data-g]'), function (b) { var on = b.dataset.g === c; b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  /* numero dei messaggi non letti sul segnalibro Chat (la chat in alto non c'è più) */
  var nb = $('#btnChatN'), tb = document.querySelector('#gTabs [data-g="chat"]');
  if (tb) { var tn = tb.querySelector('.g-tn'); if (!tn) { tn = document.createElement('b'); tn.className = 'g-tn'; tb.appendChild(tn); }
    var tx = nb && !nb.hidden ? (nb.textContent || '').trim() : ''; if (tn.textContent !== tx) tn.textContent = tx; setHidden(tn, !tx); tb.setAttribute('aria-label', 'Chat' + (tx ? ', ' + tx + ' da leggere' : '')); }
  document.documentElement.classList.toggle('g-conv', vis('#chSheet') && ($('#chSheet').dataset.v === 'conv'));
  document.documentElement.classList.toggle('g-page', c === 'you' || c === 'prof' || c === 'idx' || c === 'chat' || (c === 'fri' && !(NL.guest && NL.guest())));
}

/* ---------- testatina, nastro, frase in prosa, «+ Aggiungi» ---------- */
function head() {
  if (head.done || !$('#gHead')) return; head.done = true;
  $('#gBack').addEventListener('click', function () { act('lib'); });
  $('#gProse').addEventListener('click', function (e) { if (e.target.closest('[data-gl="loan"]')) NL.loanFilter(); });
  var a = document.createElement('button'); a.type = 'button'; a.id = 'gAdd'; a.className = 'g-add'; a.innerHTML = SV(IC.plus, 20) + '<span>Aggiungi</span>';
  a.addEventListener('click', function () { act('add'); });
  document.body.appendChild(a);
}
function plural(n, one, many) { return n === 1 ? one : many; }
function paintHead() {
  var guest = NL.guest && NL.guest(), wish = NL.tab && NL.tab() === 'wish';
  var all = []; try { all = NL.books(); } catch (e) { all = []; }
  var lib = all.filter(function (b) { return !b.w; }), ws = all.filter(function (b) { return b.w; });
  var n = wish ? ws.length : lib.length, rib = $('#gRib'), pr = $('#gProse'), run = $('#gRun'), bk = $('#gBack');
  if (!rib) return;
  var who = guest ? String(NL.guest() || '') : '';
  rib.innerHTML = '<b>' + n + '</b>' + (wish ? SV(IC.desideri, 13) : '<small>libri</small>');
  run.textContent = guest ? (who || 'Libreria di un amico') : 'Next Libris';
  setHidden(bk, !guest);
  document.documentElement.classList.toggle('g-guest', !!guest);
  var gt = $('header.top h1 .g-t'), tt = guest ? (who ? 'Libreria di ' + who.split(' ')[0] : 'Libreria') : (wish ? 'Desideri' : 'Libreria');
  if (gt && gt.textContent !== tt) gt.textContent = tt;
  if (guest) { setHidden(pr, true); return; }
  var s = '';
  if (wish) {
    s = ws.length ? 'Hai <b>' + ws.length + ' ' + plural(ws.length, 'libro', 'libri') + '</b> nei Desideri.' : 'Nei Desideri metti i libri che vorresti: tocca <b>Aggiungi</b>.';
  } else if (!lib.length) {
    s = 'La tua libreria è vuota: tocca <b>Aggiungi</b> e inquadra il codice a barre di un libro.';
  } else {
    var rd = lib.filter(function (b) { return b.rs === 'in'; });
    var lo = NL.loans ? NL.loans() : 0;   // prestati e ricevuti, come il filtro
    s = rd.length === 1 ? 'Stai leggendo <b>' + esc(rd[0].t || 'un libro') + '</b>' : rd.length ? 'Stai leggendo <b>' + rd.length + ' libri</b>' : 'Hai <b>' + lib.length + ' ' + plural(lib.length, 'libro', 'libri') + '</b>';
    s += lo ? '; <button type="button" class="g-lk" data-gl="loan">' + lo + ' ' + plural(lo, 'è in prestito', 'sono in prestito') + '</button>.' : '.';
  }
  if (pr.innerHTML !== s) pr.innerHTML = s; /* niente capolettera (Piero, 20/11/2026) */ setHidden(pr, false);
}

/* ---------- Indice al posto del Menu ---------- */
function indice() {
  var h = $('#drawerH'); if (h && h.textContent === 'Menu') h.textContent = 'Indice';   // solo il titolo del Menu: la pagina Filtri resta «Filtri» (20/11/2026)
}

/* ---------- ordine e gruppi: testi brevi («Autore» invece di «Raggruppa: Autore») ---------- */
function shortGrp() {
  var g = $('#grpPick'); if (!g) return;
  var t = g.textContent, s = t.replace(/^Raggruppa:\s*/, '');
  if (s === 'Raggruppa') s = 'Gruppi';
  if (s !== t) g.textContent = s;
}

/* ---------- Aspetto › «Nastro e linguette a sinistra» (Piero, 20/11/2026): per chi tiene il telefono con la sinistra ---------- */
function side() {
  var st = NL.settings || {};
  document.documentElement.classList.toggle('g-left', !!st.gLeft);
  var cols = document.querySelector('fieldset.cols-opt'), x = $('#optGLeft');
  if (!x && cols) {
    var f = document.createElement('fieldset'); f.className = 'choice g-side-opt';
    f.innerHTML = '<legend>Linguette</legend><label class="check"><input type="checkbox" id="optGLeft"><span>Nastro e linguette a sinistra<small>Per chi tiene il telefono con la sinistra.</small></span></label>';
    cols.parentNode.insertBefore(f, cols.nextSibling);
    x = $('#optGLeft');
    x.addEventListener('change', function () { st.gLeft = x.checked; if (NL.saveSettings) NL.saveSettings(); side(); if (NL.toast) NL.toast(x.checked ? 'Linguette a sinistra.' : 'Linguette a destra.'); });
  }
  if (x) x.checked = !!st.gLeft;
}

/* barra di stato del telefono del colore della pagina (carta Avorio in chiaro, --surface in scuro), non più quello delle
   vecchie disposizioni; durante l'apertura (data-splash) resta verde come prima (20/11/2026) */
function barColor() {
  var root = document.documentElement, m = document.querySelector('meta[name="theme-color"]');
  if (!m || root.hasAttribute('data-splash')) return;
  var c = (getComputedStyle(root).getPropertyValue('--surface') || '').trim();
  if (c && m.getAttribute('content') !== c) m.setAttribute('content', c);
}

/* ---------- avvio e aggiornamenti ---------- */
var pend = 0;
function soon() { if (pend) return; pend = setTimeout(function () { pend = 0; try { paintHead(); paintTabs(); shortGrp(); indice(); barColor(); } catch (e) { if (window.nlErr) nlErr(e); } }, 40); }
function start() {
  tabs(); head(); side(); soon();
  var mo = new MutationObserver(soon);
  ['#list', '#grpPick'].forEach(function (s) { var e = $(s); if (e) mo.observe(e, { childList: true, characterData: true, subtree: true }); });
  var mo2 = new MutationObserver(soon);
  mo2.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['hidden', 'data-v'] });
  new MutationObserver(soon).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'data-pal', 'data-splash'] });
  if (NL.on) { NL.on('guest', soon); NL.on('list', soon); }
  window.addEventListener('popstate', function () { setTimeout(soon, 80); });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
window.NLStileG = { paint: soon };
})();
