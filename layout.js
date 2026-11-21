/* Next Libris · modulo «layout»: finestra del «+», pagina «Per te», icone dell'Indice e avvisi in cima, uno alla volta.
   Usa solo window.NL. Le disposizioni dello schermo (Classico, A con la barra in basso, B, C, D) non ci sono più: l'aspetto è lo stile G
   (stile-g.js / stile-g.css), che chiama NLLayout.act(...) dalle linguette e da «+ Aggiungi» (20/11/2026). */
(function () {
'use strict';
var NL = window.NL;
if (!NL) return;
var $ = NL.$, esc = NL.esc;
NL.ls.del('catalogo-libri-layout');   // la scelta della disposizione, salvata dalle versioni vecchie
function svg(p, w) { return '<svg viewBox="0 0 24 24" width="' + (w || 22) + '" height="' + (w || 22) + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; }
var I = {
  quote: '<path d="M7 7h4v4c0 3-2 5-4 6M14 7h4v4c0 3-2 5-4 6"/>',
  stats: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
  out: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19h14"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  next: '<path d="M5 6h14M5 12h9M5 18h6"/><path d="M17 15l3 3-3 3"/>',
  film: '<rect x="3" y="9" width="18" height="11" rx="2"/><path d="M3 9l1-4 16.5-2.2.8 3.6L3 9zM8 4.4l2.6 3.5M13 3.7l2.6 3.5"/>',
  pen: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.6-3.6 3.4-5.5 7-5.5s6.4 1.9 7 5.5"/>'
};

/* ---------- finestra del «+» e pagina «Per te» ---------- */
var built = false;
function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
function build() {
  if (built) return; built = true;
  document.body.appendChild(el('<div class="sheet" id="layAdd" hidden><div class="sheet-in" role="dialog" aria-modal="true" aria-labelledby="layAddH">' +
    '<h2 id="layAddH">Aggiungi un libro</h2>' +
    '<div class="tabs lay-dest" role="tablist" aria-label="Dove aggiungerlo"><button type="button" role="tab" data-dest="lib">In Libreria</button><button type="button" role="tab" data-dest="wish">Nei Desideri</button></div>' +
    /* restyle pezzo 3 (Piero, 19/11/2026): tre tasti tondi in fila, poi un riquadro con Per autore e Ce l'ho già? */
    '<div class="lay-big3">' +
    '<button type="button" class="pri" data-l="scan"><span class="c">' + NL.icon('scan') + '</span>Scansiona</button>' +
    '<button type="button" data-l="photo"><span class="c">' + NL.icon('cam') + '</span>Fotografa</button>' +
    '<button type="button" data-l="type"><span class="c">' + NL.icon('key') + '</span>Digita</button></div>' +
    '<div class="dlist dmenu lay-rows">' +
    '<button type="button" class="dopt" data-l="author"><span class="dico">' + svg(I.pen, 20) + '</span><span><b>Per autore</b><small>Tutte le opere di uno scrittore</small></span><span class="n" aria-hidden="true">›</span></button>' +
    '<button type="button" class="dopt" data-l="check"><span class="dico">' + NL.icon('check') + '</span><span><b>Ce l\'ho già?</b><small>Controlla in negozio</small></span><span class="n" aria-hidden="true">›</span></button></div>' +
    '<div class="row-btns"><button type="button" class="btn" data-l="close">Chiudi</button></div></div></div>'));
  document.body.appendChild(el('<div class="sheet" id="layYou" hidden><div class="sheet-in" role="dialog" aria-modal="true" aria-labelledby="layYouH">' +
    '<h2 id="layYouH">Per te</h2><div class="dlist dmenu" id="layYouList"></div>' +   /* la scheda della stagione si mette sopra l'elenco (paintYou) */
    '<div class="row-btns"><button type="button" class="btn" data-l="close">Chiudi</button></div></div></div>'));
  document.addEventListener('click', onClick);
}
/* restyle pezzo 3: nel Menu ogni riga ha la sua icona in un quadratino (anche quelle aggiunte dai moduli) */
var MI = {
  filt: '<path d="M4 6h16M7 12h10M10 18h4"/>', spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  quote: '<path d="M7 7h4v4c0 3-1.5 5-4 6M14 7h4v4c0 3-1.5 5-4 6"/>', chart: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  tools: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>', down: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 2-2s-.8-1.6-.8-2.6 .8-1.9 2-1.9H18a3 3 0 0 0 3-3C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>', shield: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6l8.5 7 8.5-7"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.5 3.2-5.5 6.5-5.5s5.9 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2 .8 3.2 2.6 3.5 5.2"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>', user: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c.7-4 3.6-6.2 7.5-6.2s6.8 2.2 7.5 6.2"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>', books: '<path d="M4 4h4v16H4zM10 4h4v16h-4zM16 5l3.5-1 2.5 15.5-3.5 1z"/>',
  dot: '<circle cx="12" cy="12" r="3"/>'
};
function menuIco(b) {
  var id = b.id || '', sec = b.getAttribute('data-sec') || '', t = (b.querySelector('b') || b).textContent.toLowerCase();
  var k = { goFilters: 'filt', goSugg: 'spark', goQuotes: 'quote', goStats: 'chart' }[id] || { fix: 'tools', export: 'down', search: 'search', cards: 'plus', look: 'palette', share: 'share', app: 'phone', privacy: 'shield', contact: 'mail' }[sec];
  if (!k) k = /amici e privacy/.test(t) ? 'eye' : /amic/.test(t) ? 'users' : /chiave|api google/.test(t) ? 'key' : /account/.test(t) ? 'user' : /notific/.test(t) ? 'bell' : /come si usa|guida/.test(t) ? 'info' : /esempio/.test(t) ? 'books' : /amministra/.test(t) ? 'shield' : /citazion/.test(t) ? 'quote' : /statist/.test(t) ? 'chart' : /backup/.test(t) ? 'down' : 'dot';
  return '<span class="dico" aria-hidden="true">' + svg(MI[k], 20) + '</span>';
}
function menuIcons() {
  Array.prototype.forEach.call(document.querySelectorAll('#drawerOpts .dmenu .dopt'), function (b) {
    if (b.querySelector('.dico, .don-cup, .pf-av, img, .dset-i') || b.classList.contains('dset-t')) return;
    b.insertAdjacentHTML('afterbegin', menuIco(b));
  });
}
(function () {
  var dr = document.getElementById('drawer'); if (!dr || !window.MutationObserver) return;
  var t = 0; new MutationObserver(function () { if (t) return; t = setTimeout(function () { t = 0; if (dr.classList.contains('open') || !dr.hidden) menuIcons(); }, 30); }).observe(dr, { attributes: true, attributeFilter: ['class', 'hidden'], childList: true, subtree: true });
})();
function youItems() {
  var out = [{ l: 'sugg', i: I.next, t: 'Suggerimenti', s: 'Cosa leggere dopo, dagli amici e da scoprire' }];
  var W = window.NLWrap; if (W && W.cfg().on && W.quarters().length) out.push({ l: 'wrap', i: I.cal, t: 'La tua stagione in libri', s: 'Il riepilogo di ogni stagione' });
  var nq = NL.nQuotes();
  var nf = NL.films ? NL.films().length : 0;        // film e serie TV tratti dai tuoi libri (giro 2, 18/11/2026)
  if (nf) out.push({ l: 'films', i: I.film, t: 'Dai tuoi libri al cinema', s: nf === 1 ? '1 film o serie tratto dai tuoi libri' : nf + ' film e serie tratti dai tuoi libri' });
  if (nq) out.push({ l: 'quotes', i: I.quote, t: 'Tutte le citazioni', s: nq === 1 ? '1 citazione salvata' : nq + ' citazioni salvate' });
  out.push({ l: 'stats', i: I.stats, t: 'Statistiche', s: 'Libri, pagine e letture' });   // i prezzi non ci sono più (giro 7)
  out.push({ l: 'export', i: I.out, t: 'Backup ed esportazione', s: 'Backup, Excel, PDF' });
  return out;
}
function paintYou() {
  /* restyle pezzo 4 (Piero, 19/11/2026): «Per te» e' una pagina; in cima la scheda della stagione in libri, nei suoi colori */
  var W = window.NLWrap, card = $('#layYouSeason');
  if (!card) { card = document.createElement('button'); card.type = 'button'; card.id = 'layYouSeason'; card.className = 'lay-season'; card.dataset.l = 'wrap'; $('#layYouList').parentNode.insertBefore(card, $('#layYouList')); }
  var qs = []; try { qs = W && W.cfg().on ? W.quarters() : []; } catch (e) { if (window.nlErr) nlErr(e); }
  card.hidden = !qs.length;
  if (qs.length) {
    var d = qs[0], pal = W.palette(d.Q.q), n = d.n, pg = d.pages || 0;
    card.style.setProperty('--sz-bg', pal.t[0]); card.style.setProperty('--sz-ink', pal.ink[0]); card.style.setProperty('--sz-2', pal.t[1]); card.style.setProperty('--sz-3', pal.t[2]);
    card.innerHTML = '<span class="sz-t"><b>' + esc(d.Q.title) + '</b><small>' + esc(n === 1 ? '1 libro letto' : n + ' libri letti') + (pg ? ' · ' + esc(pg.toLocaleString('it-IT')) + ' pagine' : '') + '</small></span><span class="sz-go" aria-hidden="true">›</span>';
  }
  $('#layYouList').innerHTML = youItems().filter(function (x) { return x.l !== 'wrap' || !qs.length; }).map(function (x) {
    return '<button type="button" class="dopt dgo lay-you" data-l="' + x.l + '"><span class="lay-yi">' + svg(x.i) + '</span><span><b>' + esc(x.t) + '</b><small>' + esc(x.s) + '</small></span><span class="n" aria-hidden="true">›</span></button>';
  }).join('');
}
/* dove va il libro: parte dalla scheda in cui sei e si cambia con un tocco (Piero, 16/11/2026) */
function paintDest() { var t = NL.tab ? NL.tab() : 'lib'; Array.prototype.forEach.call(document.querySelectorAll('#layAdd [data-dest]'), function (b) { b.setAttribute('aria-selected', b.dataset.dest === t ? 'true' : 'false'); }); }
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('#layAdd [data-dest]'); if (!b) return;
  if (NL.tab && NL.tab() !== b.dataset.dest) { NL.setTab(b.dataset.dest); window.scrollTo({ top: 0 }); }
  paintDest();
});
function sheetOpen(id) { var s = $(id); s.hidden = false; if (id === '#layYou') paintYou(); if (id === '#layAdd') paintDest(); setTimeout(function () { try { (s.querySelector('.lay-big3 .pri') || s.querySelector('button')).focus({ preventScroll: true }); } catch (e) { if (window.nlErr) nlErr(e); } }, 30); }
function sheetsClose() { ['#layAdd', '#layYou'].forEach(function (k) { var s = $(k); if (s) s.hidden = true; }); }
function act(l) {
  sheetsClose();
  if (l !== 'prof' && window.NLProfilo && window.NLProfilo.close) { var ps = document.getElementById('profSheet'); if (ps && !ps.hidden && ['lib', 'wish', 'add', 'you'].indexOf(l) >= 0) window.NLProfilo.close(); }   // il profilo è una pagina: gli altri tasti della barra lo chiudono (stile C, 19/11/2026)
  // libreria di esempio (guida): la barra resta dentro l'esempio (Piero, 18/11/2026)
  if (NL.esempio && NL.esempio()) {
    if (l === 'lib' || l === 'wish') { NL.setTab(l); window.scrollTo({ top: 0 }); NL.emit('guest'); return; }
    if (l === 'prof') { if (window.NLProfilo) window.NLProfilo.open('esempio'); return; }
    if (l === 'add' || l === 'you') { NL.toast('È solo un esempio: prova con i tuoi libri.'); return; }
  }
  if (l === 'lib' || l === 'wish') { if (NL.guest && NL.guest()) NL.guestExit(); NL.setTab(l); window.scrollTo({ top: 0 }); }   // sempre i tuoi, anche dalla libreria di un amico (17/11/2026 sera)
  else if (l === 'add') sheetOpen('#layAdd');
  else if (l === 'you') sheetOpen('#layYou');
  else if (l === 'prof') { if (NL.guest && NL.guest()) NL.guestExit(); if (window.NLProfilo) window.NLProfilo.open(); }
  else if (l === 'scan') NL.scan();
  else if (l === 'photo') NL.photo();
  else if (l === 'type') NL.typeIsbn();
  else if (l === 'check') NL.scan('check');
  else if (l === 'author') NL.openWorks();
  else if (l === 'films') NL.openFilms();
  else if (l === 'sugg') NL.openSugg('you');   // dalla pagina Per te: ‹ ci torna
  else if (l === 'wrap') { if (window.NLWrap) window.NLWrap.open(); }
  else if (l === 'quotes') NL.openQuotes();
  else if (l === 'stats') NL.openStats();
  else if (l === 'export') NL.openExport();
}
function onClick(e) {
  var t = e.target;
  var sh = t.closest('#layAdd, #layYou');
  if (sh && t === sh) { sheetsClose(); return; }
  var b = t.closest('[data-l]');
  if (!b || !b.closest('#layAdd, #layYou')) return;
  if (b.dataset.l === 'close') { sheetsClose(); return; }
  act(b.dataset.l);
}
window.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  var open = ['#layAdd', '#layYou'].some(function (k) { var s = $(k); return s && !s.hidden; });
  if (open) { e.stopImmediatePropagation(); sheetsClose(); }
}, true);
/* ---------- avvisi in cima: uno alla volta ---------- */
var NOTES = ['#notice', '#nxBox', '#wrapAsk', '#donAsk', '#instCard', '#donRow'], noteIdx = 0, mo = null;
function notes() {
  var all = Array.prototype.slice.call(document.querySelectorAll('.lay-note.lay-first'))   // .lay-first: avvisi che vengono prima di tutti (richieste di amicizia, 16/11/2026)
    .concat(NOTES.map(function (k) { return document.querySelector(k); }).filter(Boolean))
    .concat(Array.prototype.slice.call(document.querySelectorAll('.lay-note:not(.lay-first)')));   // .lay-note: avvisi aggiunti da altri moduli
  all.forEach(function (x) { x.classList.remove('lay-later', 'lay-has-dots'); x.removeAttribute('data-noswipe'); x.removeAttribute('data-lay-swipe'); x.style.transform = ''; x.style.opacity = ''; x.style.transition = ''; });
  var more = $('#layMore');
  var vis = all.filter(function (x) { return !x.hidden; });
  if (!more) {
    more = el('<button type="button" class="lay-more" id="layMore" hidden></button>');
    more.addEventListener('click', function (e) { e.stopPropagation(); var x = document.querySelector('[data-lay-swipe]'); if (x) slide(1, x, -100); else { noteIdx++; notes(); } });
  }
  if (!mo && window.MutationObserver) mo = new MutationObserver(function () { notes(); });
  if (mo) all.forEach(function (x) { if (!x.__layObs) { x.__layObs = 1; mo.observe(x, { attributes: true, attributeFilter: ['hidden'] }); } });
  if (vis.length < 2) { more.hidden = true; return; }
  noteIdx = ((noteIdx % vis.length) + vis.length) % vis.length;
  vis.forEach(function (x, i) { if (i !== noteIdx) x.classList.add('lay-later'); });
  var shown = vis[noteIdx];
  shown.appendChild(more);                   // i pallini stanno dentro l'avviso, in basso al centro
  shown.classList.add('lay-has-dots');
  more.hidden = false;
  shown.setAttribute('data-lay-swipe', ''); shown.setAttribute('data-noswipe', '');     // si scorre col dito; il menu non si apre
  more.innerHTML = vis.map(function (x, i) { return '<i' + (i === noteIdx ? ' class="on"' : '') + '></i>'; }).join('');
  more.setAttribute('aria-label', 'Avviso ' + (noteIdx + 1) + ' di ' + vis.length + ': mostra il prossimo (si scorrono anche col dito)');
}

/* scorrere gli avvisi col dito: verso sinistra il prossimo, verso destra quello prima (in giro) */
var sw = null;
function slide(step, el, dx) {
  var w = el.offsetWidth || 300;
  el.style.transition = 'transform .16s ease-in, opacity .16s ease-in';
  el.style.transform = 'translateX(' + (step > 0 ? -w : w) + 'px)'; el.style.opacity = '0';
  setTimeout(function () {
    noteIdx += step; notes();
    var nx = document.querySelector('[data-lay-swipe]');
    if (!nx || reduce()) return;
    nx.style.transition = 'none'; nx.style.transform = 'translateX(' + (step > 0 ? w * 0.6 : -w * 0.6) + 'px)'; nx.style.opacity = '0';
    void nx.offsetWidth;
    nx.style.transition = 'transform .2s ease-out, opacity .2s ease-out'; nx.style.transform = ''; nx.style.opacity = '';
    setTimeout(function () { nx.style.transition = ''; }, 220);
  }, reduce() ? 0 : 160);
}
function reduce() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
document.addEventListener('touchstart', function (e) {
  sw = null;
  if (e.touches.length !== 1) return;
  var el = e.target.closest && e.target.closest('[data-lay-swipe]');
  if (!el || e.target.closest('input, textarea, select')) return;
  sw = { el: el, x0: e.touches[0].clientX, y0: e.touches[0].clientY, dir: 0, dx: 0, t0: Date.now() };
}, { passive: true });
document.addEventListener('touchmove', function (e) {
  if (!sw || e.touches.length !== 1) return;
  var dx = e.touches[0].clientX - sw.x0, dy = e.touches[0].clientY - sw.y0;
  if (!sw.dir) {
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
    if (Math.abs(dx) > Math.abs(dy) * 1.3) sw.dir = 1; else { sw = null; return; }
  }
  sw.dx = dx;
  sw.el.style.transition = 'none';
  sw.el.style.transform = 'translateX(' + dx + 'px)'; sw.el.style.opacity = String(Math.max(0.4, 1 - Math.abs(dx) / 500));
}, { passive: true });
function swEnd(cancel) {
  var s = sw; sw = null;
  if (!s || !s.dir) return;
  var fast = Math.abs(s.dx) / Math.max(1, Date.now() - s.t0) > 0.5;
  if (!cancel && (Math.abs(s.dx) > 70 || (fast && Math.abs(s.dx) > 30))) slide(s.dx < 0 ? 1 : -1, s.el, s.dx);
  else { s.el.style.transition = 'transform .18s ease-out, opacity .18s'; s.el.style.transform = ''; s.el.style.opacity = ''; }
}
document.addEventListener('touchend', function () { swEnd(false); }, { passive: true });
document.addEventListener('touchcancel', function () { swEnd(true); }, { passive: true });
window.NLLayoutSwipe = { next: function () { var el = document.querySelector('[data-lay-swipe]'); if (el) slide(1, el, -100); }, prev: function () { var el = document.querySelector('[data-lay-swipe]'); if (el) slide(-1, el, 100); } };

/* ---------- avvio ---------- */
/* gli avvisi che nella pagina stanno sotto la ricerca salgono sopra */
var MOVE = ['#wrapAsk', '#nxBox', '#donAsk', '#donRow'];
function place() {
  var ref = document.getElementById('stickSentinel');
  if (!ref) return;
  MOVE.forEach(function (k) { var e = document.querySelector(k); if (e) ref.parentNode.insertBefore(e, ref); });
}
NL.on('list', function () { notes(); });
build(); place(); notes();
setTimeout(function () { try { NL.updateStick(); } catch (e) { if (window.nlErr) nlErr(e); } }, 0);
window.NLLayout = { act: act };
})();
