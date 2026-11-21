/* Next Libris · modulo «Come si usa»: guida di primo avvio e libreria di esempio (giro 4, 18/11/2026).
   Modulo a parte: usa solo window.NL. Per toglierlo: cancellare guida.js e guida.css e le loro righe in index.html e in SHELL di sw.js
   (togli_modulo.py, nel ramo prove). Dati suoi: 'catalogo-libri-guida' ({ seen: 1 } quando la guida è stata vista).
   - Undici schermate (giro 12; «Installala» solo nel browser) da sfogliare col dito, con un tocco ai lati dello schermo o con i tasti; «Salta» sempre in vista. Si apre da sola una volta,
     ai nuovi e a chi usa già l'app (al primo avvio dopo l'aggiornamento: cfg.v < GV). Si riapre da Menu › Info e aiuto › Come si usa.
   - «Prova adesso» apre la parte vera dell'app; nelle schermate 4, 5 e 6 apre la libreria di esempio.
   - Libreria di esempio: la modalità ospite dell'app (NL.guestEnter con info.esempio): solo da guardare, niente salvataggi né sincronizzazione,
     mai mescolata con i libri veri, fuori dalle statistiche. Zero chiamate: nessuna ricerca, niente Wikipedia/Wikidata (paesi e film sono
     scritti qui sotto), copertine disegnate dall'app, descrizioni brevi scritte da noi.
   REGOLA (Piero, 18/11/2026): a ogni versione vera la guida si aggiorna con le funzioni nuove (testi, «Prova adesso», prova e2e123). */
(function () {
'use strict';
var NL = window.NL;
if (!NL || !NL.guestEnter) return;
var L = NL.L, esc = NL.esc, $ = NL.$;
var LS = 'catalogo-libri-guida';
var GV = 6;   // 6 = schede di benvenuto (19/11/2026), 5 = guida asciutta                                               // versione della guida: 2 = otto schermate (giro 5), 4 = ordine nuovo e «API in prestito» (giro 12); chi ha visto una versione più vecchia la rivede una volta
var cfg = {};
try { cfg = JSON.parse(NL.ls.get(LS) || '{}') || {}; } catch (e) { cfg = {}; }
function save() { NL.ls.set(LS, JSON.stringify(cfg)); }

/* icone dell'app che NL.icon non ha (le stesse di barra in basso, Menu e chat) */
var GI = {
  books: '<path d="M4 4h4v16H4zM10 4h4v16h-4z"/><path d="M16.5 5l3.5-.8 2.6 15.4-3.5.8z"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.5 3.2-5.5 6.5-5.5s5.9 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2 .8 3.2 2.6 3.5 5.2"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  shield: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z"/>',
  ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>'
};
function gi(n) { return GI[n] ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + GI[n] + '</svg>' : NL.icon(n); }
/* ---------- schede di benvenuto (Piero, 19/11/2026; claude/funzionalita-principali.md del progetto) ----------
   Progettate da zero al posto della guida a 8 schermate, anche in Menu › Info e aiuto › Come si usa. Al massimo 4 schede:
   1 Questo è Next Libris · 2 I tuoi libri · 3 l'API Google Libri · 4 Installa l'app (solo nel browser).
   Grafica «A · Fondo Bosco»: sfumatura verde fissa, disegno grande in alto, righe con l'icona nel quadratino, tasto largo in basso.
   Aperte da sole (chi installa da zero e, una volta, chi usa già l'app; anche con un link d'invito), finite le schede:
   «Entra con Google» se non sei dentro → il nome (amici.js, stessa grafica) → il percorso del giro 12. */
var WI = {
  book: '<path d="M3 6a9 9 0 0 1 9 0v13a9 9 0 0 0-9 0z"/><path d="M21 6a9 9 0 0 0-9 0v13a9 9 0 0 1 9 0z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.6a5 5 0 0 1 5.5 5.4"/>',
  swap: '<path d="M4 8h14l-3-3"/><path d="M20 16H6l3 3"/>',
  beer: '<path d="M5 8h10v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M15 11h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2"/><path d="M6 5h8"/>',
  code: '<path d="M4 6v12"/><path d="M7 6v12"/><path d="M10.5 6v12"/><path d="M14 6v12"/><path d="M16.5 6v12"/><path d="M20 6v12"/>',
  star: '<path d="M12 3l2.8 6 6.2.6-4.7 4.2 1.4 6.2-5.7-3.4-5.7 3.4 1.4-6.2L3 9.6 9.2 9z"/>',
  mark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  cam: '<rect x="3" y="7" width="18" height="13" rx="3"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8.5 7l1.5-3h4l1.5 3"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9"/><path d="M17 6l3 3"/><path d="M14.5 8.5l2 2"/>',
  down: '<path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/>',
  get: '<path d="M12 4v12"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/>',
  give: '<path d="M12 20V8"/><path d="M7 13l5-5 5 5"/><path d="M5 4h14"/>',
  share: '<path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M6 11v9h12v-9"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  next: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>'
};
function wi(n, s, w) { return '<svg width="' + (s || 20) + '" height="' + (s || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 1.9) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + WI[n] + '</svg>'; }
function circ(st, inner) { return '<span class="wc-c" style="' + st + '">' + inner + '</span>'; }
/* i disegni grandi in alto, come nella proposta A */
var ART = {
  hello: function () {
    return '<div class="wc-a" style="width:260px;height:250px">' +
      circ('left:45px;top:35px;width:170px;height:170px;background:rgba(143,209,174,.14)', '<span class="wc-sq" style="width:108px;height:108px;border-radius:32px">' + wi('book', 58, 1.6) + '</span>') +
      circ('right:6px;top:8px;width:66px;height:66px;background:#8FD1AE;color:#0E241A', wi('users', 30)) +
      circ('left:4px;bottom:14px;width:58px;height:58px;background:rgba(255,255,255,.14);color:#CFE6D8', wi('swap', 26)) +
      circ('left:14px;top:20px;width:40px;height:40px;background:rgba(168,123,44,.9);color:#FFF6E3', wi('star', 20, 2)) + '</div>';
  },
  books: function () {
    return '<div class="wc-a wc-row3">' +
      '<span class="wc-sq" style="width:86px;height:86px;border-radius:24px">' + wi('code', 40, 1.8) + '</span>' +
      '<span class="wc-col"><span class="wc-cover"></span><span class="wc-sq wc-hi" style="width:100px;height:100px;border-radius:28px">' + wi('cam', 46, 1.7) + '</span></span>' +
      '<span class="wc-sq" style="width:86px;height:86px;border-radius:24px">' + wi('pen', 40, 1.8) + '</span></div>';
  },
  api: function () {
    var lines = '<g stroke-width="0.9" opacity=".75"><path d="M4.5 8.6h3.6"/><path d="M4.5 10.8h5.2"/><path d="M4.5 13h5.2"/><path d="M4.5 15.2h5.2"/><path d="M14.3 8.6h3.6"/><path d="M14.3 10.8h5.2"/><path d="M14.3 13h5.2"/><path d="M14.3 15.2h5.2"/></g>';
    return '<div class="wc-a" style="width:300px;height:200px">' +
      '<svg style="position:absolute;left:0;top:0" width="300" height="200" viewBox="0 0 300 200" fill="none" aria-hidden="true"><path d="M70 70 C110 20 190 20 230 70" stroke="#8FD1AE" stroke-width="2.5" stroke-dasharray="6 7" stroke-linecap="round"/><path d="M222 58 l8 12 -14 2" stroke="#8FD1AE" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M230 130 C190 180 110 180 70 130" stroke="#CFE6D8" stroke-width="2.5" stroke-dasharray="6 7" stroke-linecap="round" opacity=".7"/><path d="M78 142 l-8 -12 14 -2" stroke="#CFE6D8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/></svg>' +
      circ('left:10px;top:62px;width:76px;height:76px;background:#CFE6D8;color:#24563F;font:800 28px/1 var(--font-display)', 'Tu') +
      circ('right:10px;top:62px;width:76px;height:76px;background:rgba(255,255,255,.14);color:#fff', '<svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 6a9.5 9.5 0 0 1 9.5 0v13a9.5 9.5 0 0 0-9.5 0z" stroke-width="1.4"/><path d="M21.5 6a9.5 9.5 0 0 0-9.5 0v13a9.5 9.5 0 0 1 9.5 0z" stroke-width="1.4"/>' + lines + '</svg>') +
      circ('left:114px;top:64px;width:72px;height:72px;background:#8FD1AE;color:#0E241A', wi('key', 34)) + '</div>';
  },
  inst: function () {
    return '<div class="wc-a" style="width:200px;height:250px"><span class="wc-phone"><span class="wc-sq wc-hi" style="width:56px;height:56px;border-radius:16px">' + wi('book', 30) + '</span></span>' +
      circ('right:4px;bottom:6px;width:62px;height:62px;background:#CFE6D8;color:#24563F', wi('down', 28, 2)) + '</div>';
  },
  login: function () {
    return '<div class="wc-a" style="width:220px;height:220px">' +
      circ('left:25px;top:25px;width:170px;height:170px;background:rgba(143,209,174,.14)', '<span class="wc-sq" style="width:104px;height:104px;border-radius:999px">' + wi('user', 52, 1.7) + '</span>') +
      circ('right:4px;bottom:22px;width:58px;height:58px;background:#8FD1AE;color:#0E241A', wi('users', 26)) + '</div>';
  }
};
/* testi approvati da Piero il 19/11/2026 (senza maschile per le persone) */
var S = [
  { art: 'hello', h: 'Questo è Next Libris', sub: 'Il social dei libri.',
    p: [['book', 'Metti in ordine i tuoi libri.'], ['users', 'Scopri cosa leggono gli amici.'], ['swap', 'Prestatevi i libri e la voglia di leggere.']],
    note: ['beer', 'È gratis. Se ti piace, puoi sostenerla.'] },
  { art: 'books', h: 'I tuoi libri in un tocco',
    p: [['code', 'Inquadra il codice, fotografa la copertina o scrivi il titolo.'], ['star', 'Segna cosa leggi e cosa ti è piaciuto.'], ['mark', 'Tieni i Desideri e i libri prestati.']] },
  { art: 'api', h: 'L’API Google Libri è gratis', pills: ['Gratis', 'Tua', 'Si presta'], sub: 'Con l’API trovi molti più libri, con copertine e descrizioni.',
    p: [['key', 'Crearla non costa nulla: la fai in autonomia, in 5 minuti.'], ['swap', 'Quando avrai degli amici su Next Libris, potrete prestarvela.']],
    pInv: [['key', 'Crearla non costa nulla: la fai in autonomia, in 5 minuti.'], ['users', '<b>{inv}</b> è su Next Libris: se ha un’API, può prestartela.']] }   // pInv: arrivato con il link d'invito (20/11/2026)
];
function screens() { return S; }   // la scheda «Installa l’app» non c’è più: sui telefoni si installa prima (app-avvio.js, 20/11/2026)
function inviter() { try { var A = window.NLAmici, st = A && A.state && A.state(); return st && st.invite ? String(st.invite) : ''; } catch (e) { return ''; } }
function canInst() { return !!(NL.inst && NL.inst.can && NL.inst.can() && !NL.inst.ios()); }
function needLogin() { return !!window.NLSocial && !ptLogged(); }

/* ---------- le schede ---------- */
var G = { el: null, i: 0, pushed: false, back: null, flow: false, login: false };
function build() {
  if (G.el) return;
  var el = document.createElement('div');
  el.id = 'guida'; el.className = 'wc'; el.hidden = true;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Benvenuto in Next Libris');
  el.innerHTML = '<div class="wc-top"><div class="wc-dots" id="gdProg" aria-hidden="true"></div><button type="button" class="gd-skip" data-gd="skip">Salta</button></div>' +
    '<div class="wc-stage" id="gdStage" aria-live="polite"></div><div class="wc-foot" id="gdFoot"></div>';
  document.body.appendChild(el);
  G.el = el;
  el.addEventListener('click', function (e) {
    var b = e.target.closest('[data-gd], [data-acc]'); if (!b) return;
    if (b.dataset.acc === 'google') { b.disabled = true; if (window.NLSocial && window.NLSocial.google) window.NLSocial.google(); return; }
    var a = b.dataset.gd;
    if (a === 'skip') finish();
    else if (a === 'next') next();
    else if (a === 'inst') { if (NL.inst) NL.inst.go(); next(); }
    else if (a === 'acc') { close(); if (window.NLSocial) window.NLSocial.open(); }   // senza il tasto di Google: la finestra dell'account spiega perché
    else if (a === 'later') { if (cfg.path === 1) { cfg.path = 2; save(); } close(); }
  });
  /* sfogliare col dito */
  var x0 = null, y0 = 0;
  el.addEventListener('pointerdown', function (e) { if (e.pointerType === 'mouse' && e.button !== 0) return; x0 = e.clientX; y0 = e.clientY; });
  el.addEventListener('pointerup', function (e) {
    if (x0 == null || G.login) { x0 = null; return; }
    var dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) { if (dx < 0) next(); else go(G.i - 1); }
  });
  el.addEventListener('pointercancel', function () { x0 = null; });
}
function next() { if (G.login) return; if (G.i >= screens().length - 1) finish(); else go(G.i + 1); }
/* finite le schede (o «Salta»): chi non è dentro passa da «Entra con Google» (solo quando si aprono da sole) */
function finish() { if (G.flow && !G.login && needLogin()) { G.login = true; paint(); } else close(); }
function wrow(r) { return '<p class="wc-r"><span class="wc-ic">' + wi(r[0]) + '</span><span>' + r[1] + '</span></p>'; }
function paint() {
  var list = screens(), n = list.length, st = $('#gdStage'), ft = $('#gdFoot'), top = G.el.querySelector('.wc-top');
  if (G.login) {
    top.classList.add('wc-none');
    var iosApp = NL.inst && NL.inst.ios && NL.inst.ios();
    st.innerHTML = '<div class="wc-slide" data-gs="login"><div class="wc-art" aria-hidden="true">' + ART.login() + '</div>' +
      '<h2 class="wc-h">Entra con Google</h2><p class="wc-sub">Con l’account i tuoi libri si salvano anche online e trovi gli amici.</p></div>';
    ft.innerHTML = '<div class="wc-g" id="wcG"></div><p class="wc-err" id="wcErr" hidden></p>' +
      (iosApp ? '<button type="button" class="wc-link" data-acc="google">La finestra di Google non si apre o non torna qui? Entra da questo link</button>' : '') +
      '<button type="button" class="wc-ghost" data-gd="later">Più tardi</button>';
    if (window.NLSocial && window.NLSocial.gButton) window.NLSocial.gButton(document.getElementById('wcG'));
    else $('#wcG').innerHTML = '<button type="button" class="wc-btn" data-gd="acc">Accedi con Google</button>';
    return;
  }
  top.classList.remove('wc-none');
  var s = list[G.i], inst = s.inst && canInst();
  $('#gdProg').innerHTML = list.map(function (x, k) { return '<span class="' + (k === G.i ? 'cur' : '') + '"></span>'; }).join('');
  st.innerHTML = '<div class="wc-slide" data-gs="' + G.i + '"><div class="wc-art" aria-hidden="true">' + ART[s.art]() + '</div>' +
    (s.pills ? '<p class="wc-pills">' + s.pills.map(function (p) { return '<span>' + esc(p) + '</span>'; }).join('') + '</p>' : '') +
    '<h2 class="wc-h">' + esc(s.h) + '</h2>' + (s.sub ? '<p class="wc-sub">' + esc(s.sub) + '</p>' : '') +
    '<div class="wc-rows">' + ((s.inst && !inst ? s.p2 : s.pInv && inviter() ? s.pInv.map(function (r) { return [r[0], r[1].replace('{inv}', esc(inviter()))]; }) : s.p) || []).map(wrow).join('') + '</div>' +
    (s.note ? '<p class="wc-note">' + wi(s.note[0], 22, 1.8) + '<span>' + s.note[1] + '</span></p>' : '') + '</div>';
  ft.innerHTML = inst ? '<button type="button" class="wc-btn gd-next" data-gd="inst">' + wi('down', 20, 2.2) + 'Installa</button>'
    : '<button type="button" class="wc-btn gd-next" data-gd="next">Avanti' + wi('next', 20, 2.2) + '</button>';
}
function go(i) { if (G.login || i < 0 || i >= screens().length) return; G.i = i; paint(); }
function open(i, flow) {
  trying = false; pathHide();
  if (NL.guest && NL.guest()) NL.guestExit();
  if (pillShown() && !P.want) pillOff();
  build();
  G.back = document.activeElement;
  G.flow = !!flow; G.login = false;
  G.i = Math.max(0, Math.min(i || 0, screens().length - 1));
  paint();
  G.el.hidden = false; document.body.classList.add('guida-open');
  if (!cfg.seen || (cfg.v || 1) < GV) { cfg.seen = 1; cfg.v = GV; save(); }
  if (!G.pushed) { try { history.pushState({ guida: 1 }, ''); G.pushed = true; } catch (e) { if (window.nlErr) nlErr(e); } }
  if (!(window.matchMedia && matchMedia('(hover: none)').matches)) setTimeout(function () { try { G.el.querySelector('.gd-next').focus({ preventScroll: true }); } catch (e) { if (window.nlErr) nlErr(e); } }, 30);   // sul telefono niente anello attorno ad «Avanti»
}
function close(fromPop, keepFocus) {
  if (!G.el || G.el.hidden) return;
  G.el.hidden = true; G.login = false; document.body.classList.remove('guida-open');
  if (G.pushed) { G.pushed = false; if (!fromPop) { try { history.back(); } catch (e) { if (window.nlErr) nlErr(e); } } }
  if (!keepFocus) { try { if (G.back) G.back.focus({ preventScroll: true }); } catch (e) { if (window.nlErr) nlErr(e); } }
  if (!trying) pathSoon(500);   // chi installa da zero: finite le schede, il percorso (giro 12)
}
/* entrata con Google dalla scheda: si chiude, poi arrivano il nome (amici.js) e il percorso */
if (window.NLSocial && window.NLSocial.onAuth) window.NLSocial.onAuth(function () { if (G.login && G.el && !G.el.hidden && ptLogged()) close(false, true); });
/* il tasto «Installa» del browser può arrivare dopo: la scheda si ridisegna */
window.addEventListener('beforeinstallprompt', function () { setTimeout(function () { if (G.el && !G.el.hidden && !G.login) paint(); }, 0); });
/* «Scopri di più» sull'API (Piero, 19/11/2026): finestra breve sopra la guida */
function info() {
  var el = document.getElementById('gdInfo');
  if (!el) {
    el = document.createElement('div'); el.className = 'sheet gd-infosheet'; el.id = 'gdInfo'; el.hidden = true;
    el.innerHTML = '<div class="sheet-in" role="dialog" aria-modal="true" aria-labelledby="gdInfoH"><h2 id="gdInfoH">Cos’è l’API Google Libri</h2><ul class="gd-ilist">' +
      '<li>È un permesso di Google per cercare libri: <b>1.000 ricerche al giorno</b>.</li>' +
      '<li><b>È gratis</b>: crearla non costa nulla, né oggi né dopo.</li>' +
      '<li>Si crea in 5 minuti; ti guidiamo passo passo.</li>' +
      '<li>Resta tua: puoi toglierla quando vuoi.</li>' +
      '<li>Prestandola agli amici aiuti <b>Next Libris a crescere</b>.</li></ul>' +
      '<div class="row-btns"><button type="button" class="btn primary" data-gi="make">Crea la tua API</button><button type="button" class="btn" data-gi="close">Chiudi</button></div></div>';
    document.body.appendChild(el);
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-gi]'); if (e.target === el || (b && b.dataset.gi === 'close') || e.target.closest('.sh-x')) { el.hidden = true; return; }
      if (b && b.dataset.gi === 'make') { el.hidden = true; tryIt('key'); }
    });
  }
  el.hidden = false;
  setTimeout(function () { try { el.querySelector('[data-gi="make"]').focus({ preventScroll: true }); } catch (x) {} }, 30);
}
function row(r, k) {   // una riga: icona nel quadratino, numero (passi e strade), testo; «~» = riga secondaria
  if (typeof r === 'string') r = ['dot', r];
  var t = r[1], m = t.charAt(0) === '~'; if (m) t = t.slice(1);
  return '<p class="gd-r' + (m ? ' gd-m' : '') + '"><span class="gd-sq" aria-hidden="true">' + gi(r[0]) + '</span>' + (k ? '<span class="gd-k" aria-hidden="true">' + k + '</span>' : '') + '<span class="gd-t">' + t + '</span></p>';
}
function lines(a) { return a && a.length ? '<div class="gd-card gd-lines">' + a.map(function (r) { return row(r); }).join('') + '</div>' : ''; }
window.addEventListener('popstate', function () { if (G.el && !G.el.hidden) { G.pushed = false; close(true); } });
window.addEventListener('keydown', function (e) {
  if (!G.el || G.el.hidden) return;
  var gi = document.getElementById('gdInfo'); if (gi && !gi.hidden && e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); gi.hidden = true; return; }
  if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); close(); }
  else if (e.key === 'ArrowRight') { e.stopImmediatePropagation(); go(G.i + 1); }
  else if (e.key === 'ArrowLeft') { e.stopImmediatePropagation(); go(G.i - 1); }
}, true);

/* «Prova adesso»: chiude la guida e apre la parte vera (dopo che Indietro ha tolto la guida dalla cronologia) */
var fromGuide = -1;
function tryIt(what) {
  if (what === 'inst') { close(); if (NL.inst) NL.inst.go(); return; }   // giro 10: installa e chiude la guida
  var at = G.i;
  trying = true;
  close(false, true);
  var real = what === 'add' || what === 'key' || what === 'keys' || what === 'friends' || what === 'don';
  setTimeout(function () {
    if (what === 'key' || what === 'keys' || what === 'don' || what === 'friends') enter(at, '');   // dietro c'è l'esempio, non la tua libreria (Piero, 18/11/2026)
    if (real) pillOn(at); else pillOn(at, true);      // anche nell'esempio Indietro riporta alla guida (posto {gdp} senza pillola: c'è «‹ Guida»)
    if (real) setTimeout(function () { watch({ add: '#layAdd', key: '#kgSheet', keys: '#kwSheet', don: '#donSheet', friends: '#friSheet' }[what]); }, 120);
    if (what === 'add') {
      var plus = document.getElementById('gAdd');   // stile G: «+ Aggiungi» (20/11/2026: prima cercava la barra in basso, nascosta, e non si apriva niente)
      if (plus && plus.getClientRects().length) plus.click();
    } else if (what === 'key') {
      if (window.NLRicerche && window.NLRicerche.guide) window.NLRicerche.guide();
      else if (NL.openOptions) NL.openOptions('search');
    } else if (what === 'keys') {
      if (window.NLAmici && window.NLAmici.keys) window.NLAmici.keys();
    } else if (what === 'don') {
      if (NL.openDon) NL.openDon();
    } else if (what === 'friends') {
      if (window.NLAmici && window.NLAmici.open) window.NLAmici.open();
    } else if (what === 'book' || what === 'sort' || what === 'wish' || what === 'loan') {
      enter(at, what);
    }
  }, 60);
}
/* chiusa la finestra aperta da «Prova adesso» (Più tardi, Chiudi, ×), si torna da soli alla guida: se nel frattempo se ne
   è aperta un'altra (la fotocamera, «Presta a …»), si aspetta quella */
function watch(sel) {
  var w = sel && document.querySelector(sel); if (!w || w.hidden) return;
  var mo = new MutationObserver(function () {
    if (!w.hidden) return;
    mo.disconnect();
    setTimeout(function wait() {
      if (!pillShown() || P.want) return;
      if (document.querySelector('.sheet:not([hidden]), .lightbox:not([hidden])') || document.body.classList.contains('scanning')) { setTimeout(wait, 500); return; }
      back(true);
    }, 350);
  });
  mo.observe(w, { attributes: true, attributeFilter: ['hidden'] });
}


/* ---------- pillola «‹ Torna alla guida · 3/9» (giro 7) ----------
   Dopo «Prova adesso» sulle parti vere (+, chiave, amici) resta in basso a destra. Si torna alla guida con la pillola o con
   Indietro del telefono: sotto la parte aperta c'è un posto nella cronologia ({gdp}); quando Indietro lo toglie, la guida si riapre
   dalla schermata di prima. Se la parte aperta ha una cronologia sua (fotocamera), il primo Indietro chiude quella. */
var P = { el: null, at: -1, want: false, quiet: false, on: false, silent: false };
function pillOn(at, silent) {
  P.at = at; P.on = true; P.silent = !!silent;
  if (!P.el) {
    P.el = document.createElement('div'); P.el.id = 'gdPill'; P.el.className = 'gd-pill';
    P.el.innerHTML = '<button type="button" class="gd-pill-go" data-gp="go"></button><button type="button" class="gd-pill-x" data-gp="x" aria-label="Chiudi: resta qui">' + NL.icon('x') + '</button>';
    document.body.appendChild(P.el);
    P.el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-gp]'); if (!b) return;
      if (b.dataset.gp === 'go') back(true); else back(false);
    });
  }
  P.el.querySelector('.gd-pill-go').innerHTML = '‹ Torna alla guida <span>· ' + (at + 1) + '/' + screens().length + '</span>';
  P.el.hidden = !!silent; document.body.classList.toggle('gd-pill-on', !silent);
  try { history.pushState({ gdp: 1 }, ''); } catch (e) { if (window.nlErr) nlErr(e); }
}
function pillOff() { if (P.el) P.el.hidden = true; document.body.classList.remove('gd-pill-on'); P.at = -1; P.want = false; P.quiet = false; P.on = false; P.silent = false; }
function pillShown() { return P.on; }   // attiva anche senza pillola in vista (nella libreria di esempio)
/* toglie i posti della cronologia fino a sotto {gdp}; poi riapre la guida (go) o resta dove si è (✕) */
function back(go) { if (!pillShown()) return; P.want = true; P.quiet = !go; try { history.back(); } catch (e) { if (window.nlErr) nlErr(e); reopen(); } }
function reopen() {
  var at = P.at, quiet = P.quiet; pillOff();
  if (quiet) { trying = false; pathSoon(800); return; }
  if (document.querySelector('.sheet:not([hidden]), .lightbox:not([hidden])')) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));   // finestre senza cronologia (+, amici, chiave)
  setTimeout(function () { if (document.querySelector('.sheet:not([hidden])')) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); open(at < 0 ? 0 : at); }, 30);
}
window.addEventListener('popstate', function (e) {
  if (!pillShown()) return;
  setTimeout(function () {                         // dopo le altre finestre, che si chiudono con il loro «popstate»
    if (!pillShown()) return;
    var st = history.state;
    if (st && st.gdp) { if (P.want) { try { history.back(); } catch (x) { reopen(); } } return; }   // una finestra sopra si è chiusa: la pillola resta
    reopen();
  }, 0);
});
NL.on('guest', function () {
  if (!pillShown() || P.want) return;
  var ex = NL.esempio && NL.esempio();
  if (P.el) { P.el.hidden = P.silent || !!ex; document.body.classList.toggle('gd-pill-on', !P.el.hidden); }   // nell'esempio basta «‹ Guida» nella striscia
  if (NL.guest && NL.guest() && !ex) pillOff();      // la libreria di un amico vero: niente più ritorno alla guida
  else if (!ex && P.silent) { pillOff(); trying = false; pathSoon(800); }   // «Esci» dall'esempio
});


/* ---------- percorso del primo avvio (giro 12, 19/11/2026) ----------
   Solo per chi installa da zero (NL.firstRun), dopo la guida: tre passi a schermo intero, con la grafica della guida.
   1 Accedi con Google (poi il nome, che chiede amici.js) · 2 l’API (crea la tua o chiedila a un amico) · 3 il primo libro.
   Accesso e chiave si saltano con «Più tardi». cfg.path = passo da mostrare (0 o assente = finito): resta salvato, così il
   percorso riprende alla prossima apertura (anche dopo il giro di Google). Un passo già fatto si salta da solo. */
var trying = false;
var PT = { el: null, t: 0 };
if (cfg.path == null && !cfg.seen && NL.firstRun && NL.firstRun()) { cfg.path = 1; save(); }
function ptLogged() { var so = window.NLSocial; return !!(so && so.auth && so.auth()); }
function ptKey() { var A = window.NLAmici, st = NL.settings || {}; return !!st.gbKey || !!(A && A.hasAny && A.hasAny()); }
function ptLender() { var A = window.NLAmici; return !!(A && A.lenders && A.lenders() > 0); }   // amici con un’API loro (20/11/2026)
function ptBooks() { try { return (NL.myBooks ? NL.myBooks() : NL.books()).length; } catch (e) { return 0; } }
function pathStep() {
  var n = cfg.path || 0; if (!n) return 0;
  if (n === 1 && (ptLogged() || !window.NLSocial)) n = 2;
  if (n === 2 && ptKey()) n = 3;
  if (n >= 3 && ptBooks()) n = 0;
  if (n > 3) n = 0;
  if (n !== cfg.path) { cfg.path = n; save(); }
  return n;
}
function pathHide() { if (PT.el) PT.el.hidden = true; document.body.classList.remove('guida-open'); }
function pathBusy() {
  return (G.el && !G.el.hidden) || pillShown() || (NL.guest && NL.guest()) || document.getElementById('iosGate') || document.querySelector('.nm-ask') ||
    document.querySelector('.sheet:not([hidden]), .lightbox:not([hidden])') || document.body.classList.contains('scanning');
}
function pathSoon(ms) { if (!cfg.path) return; clearTimeout(PT.t); PT.t = setTimeout(pathShow, ms || 600); }
function pathShow() {
  if (!cfg.path) return;
  if (pathBusy()) { pathSoon(700); return; }
  var n = pathStep(); if (!n) { pathHide(); return; }
  if (!PT.el) {
    var el = document.createElement('div');
    el.id = 'percorso'; el.className = 'wc gd-path'; el.hidden = true;   // stessa grafica delle schede di benvenuto (20/11/2026)
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Primi passi con Next Libris');
    el.innerHTML = '<div class="wc-top"><div class="wc-dots" id="ptProg" aria-hidden="true"></div><span class="gd-n wc-pn" id="ptN"></span></div><div class="wc-stage" id="ptStage" aria-live="polite"></div><div class="wc-foot" id="ptFoot"></div>';
    document.body.appendChild(el); PT.el = el;
    el.addEventListener('click', function (e) { var b = e.target.closest('[data-pt]'); if (b) pathDo(b.dataset.pt); });
  }
  var T = {   // testi brevi (Piero, 19/11/2026)
    1: { ico: 'user', h: 'Accedi con Google', p: [['books', 'I tuoi libri si salvano online.'], ['users', 'Trovi gli amici e ti fai prestare un’API.'], ['user', '~Ti chiediamo solo un nome.']],
      b: [['login', 'Accedi con Google']] },
    2: { ico: 'apikey', h: 'Trova più libri', p: [['search', 'Con un’API Google Libri l\'app trova più libri, con copertine e descrizioni.'], ['spark', '<b>È gratis</b>: crearla non costa nulla.'], ptLogged() && ptLender() ? ['users', '~Creala tu o chiedila a un amico.'] : ['apikey', '~La crei in 5 minuti, con la guida.']],
      b: [['make', 'Crea la tua (gratis)']].concat(ptLogged() && ptLender() ? [['askf', 'Chiedila a un amico']] : []) },
    3: { ico: 'scan', h: 'Aggiungi il primo libro', p: [['scan', 'Inquadra il codice a barre sul retro.'], ['cam', '~Oppure fotografa la copertina o scrivi il titolo.']],
      b: [['add', 'Aggiungi un libro']] }
  }[n];
  $('#ptProg').innerHTML = [1, 2, 3].map(function (k) { return '<span class="' + (k === n ? 'cur' : '') + '"></span>'; }).join('');
  $('#ptN').textContent = 'Passo ' + n + ' di 3';
  $('#ptStage').innerHTML = '<div class="wc-slide" data-ps="' + n + '"><div class="wc-art" aria-hidden="true"><div class="wc-a" style="width:220px;height:220px">' +
    circ('left:25px;top:25px;width:170px;height:170px;background:rgba(143,209,174,.14)', '<span class="wc-sq wc-big" style="width:104px;height:104px;border-radius:32px">' + gi(T.ico) + '</span>') + '</div></div>' +
    '<h2 class="wc-h gd-h">' + esc(T.h) + '</h2><div class="wc-rows">' +
    T.p.map(function (r) { var lo = r[1].charAt(0) === '~'; return '<p class="wc-r' + (lo ? ' wc-lo' : '') + '"><span class="wc-ic">' + gi(r[0]) + '</span><span>' + (lo ? r[1].slice(1) : r[1]) + '</span></p>'; }).join('') + '</div></div>';
  $('#ptFoot').innerHTML = T.b.map(function (b, k) { return '<button type="button" class="wc-btn gd-try' + (k ? ' gd-try2 wc-btn2' : '') + '" data-pt="' + b[0] + '">' + esc(b[1]) + '</button>'; }).join('') +
    '<button type="button" class="wc-ghost gd-later" data-pt="later">Più tardi</button>';
  PT.el.hidden = false; document.body.classList.add('guida-open');
}
function pathDo(a) {
  var n = cfg.path || 0;
  if (a === 'later') {
    cfg.path = n >= 3 ? 0 : n + 1; save(); pathHide();
    if (cfg.path) pathShow(); else NL.toast('La guida la rivedi quando vuoi: Indice › Info e aiuto › Come si usa.');
    return;
  }
  pathHide();
  if (a === 'login') { if (window.NLSocial) window.NLSocial.open(); pathWatch('#accSheet'); }
  else if (a === 'make') { if (window.NLRicerche && window.NLRicerche.guide) window.NLRicerche.guide(); else if (NL.openOptions) NL.openOptions('search'); pathWatch('#kgSheet'); }
  else if (a === 'askf') { window.NLAmici.keys(); pathWatch('#kwSheet'); }
  else if (a === 'add') {
    cfg.path = 0; save();
    var plus = document.getElementById('gAdd');   // stile G: «+ Aggiungi» (20/11/2026: prima cercava la barra in basso, nascosta, e non si apriva niente)
    if (plus && plus.getClientRects().length) plus.click();
  }
}
/* chiusa la finestra aperta dal passo, il percorso riprende da dove serve (pathShow aspetta se c'è un'altra finestra o la domanda del nome) */
function pathWatch(sel) {
  setTimeout(function () {
    var w = document.querySelector(sel); if (!w || w.hidden) { pathSoon(600); return; }
    var mo = new MutationObserver(function () { if (!w.hidden) return; mo.disconnect(); pathSoon(500); });
    mo.observe(w, { attributes: true, attributeFilter: ['hidden'] });
  }, 200);
}

/* ---------- la libreria di esempio ---------- */
var D = '2026-';
function bk(k, o) { return Object.assign({ id: 'ex' + k, ts: Date.parse(D + '01-01') - k * 864e5, g: [], c: null }, o); }
/* libri: classici, più García Márquez e Asimov (scelta di Piero); solo titolo, autore e dati; descrizioni nostre */
var BOOKS = [
  bk(1, { t: 'I promessi sposi', a: 'Alessandro Manzoni', e: 'Mondadori', y: '2002', pg: '720', gen: 'Romanzo storico', rs: 'ok', rt: 5, rd: D + '03-10', fav: true, lc: true,
    qs: [{ x: 'Quel ramo del lago di Como, che volge a mezzogiorno, tra due catene non interrotte di monti…', pg: '1', d: 3, pin: true }],
    ds: 'Renzo e Lucia vogliono sposarsi, ma un signorotto prepotente lo impedisce. Tra fughe, peste e carestia, la loro storia attraversa la Lombardia del Seicento.' }),
  bk(2, { t: 'I promessi sposi', a: 'Alessandro Manzoni', e: 'Einaudi', y: '2014', pg: '880', gen: 'Romanzo storico',
    ds: 'La stessa storia in un\'altra edizione, con note e commento: le due copie stanno insieme sotto un solo libro.' }),
  bk(3, { t: 'Il fu Mattia Pascal', a: 'Luigi Pirandello', e: 'Feltrinelli', y: '2015', pg: '280', gen: 'Romanzo', rs: 'in', pp: '112',
    ds: 'Un uomo legge sul giornale della propria morte e decide di approfittarne per ricominciare da capo con un altro nome.' }),
  bk(4, { t: 'Le avventure di Pinocchio', a: 'Carlo Collodi', e: 'Giunti', y: '2019', pg: '240', gen: 'Per ragazzi', rs: 'ok', rt: 4, rd: D + '01-22', lc: true,
    qs: [{ x: 'C\'era una volta… un pezzo di legno.', pg: '7', d: 2, pin: true }], p: 'Marta', pd: D + '10-02',
    ds: 'Il burattino di legno che vorrebbe diventare un bambino vero, tra bugie, cattive compagnie e un padre che non smette di cercarlo.' }),
  bk(5, { t: 'Anna Karenina', a: 'Lev Tolstoj', e: 'Garzanti', y: '2008', pg: '960', gen: 'Romanzo', rs: 'ok', rt: 4, rd: D + '07-15',
    ds: 'Nella Russia dell\'Ottocento, una donna sceglie l\'amore contro le regole della sua società, mentre accanto a lei altre vite cercano la loro strada.' }),
  bk(6, { t: 'Orgoglio e pregiudizio', a: 'Jane Austen', e: 'Rizzoli', y: '2011', pg: '400', gen: 'Romanzo', rs: 'da',
    ds: 'Elizabeth Bennet e il signor Darcy partono col piede sbagliato: una commedia di prime impressioni, famiglie e matrimoni nell\'Inghilterra di campagna.' }),
  bk(7, { t: 'Cent\'anni di solitudine', a: 'Gabriel García Márquez', e: 'Mondadori', y: '2017', pg: '380', gen: 'Realismo magico', rs: 'ok', rt: 5, rd: D + '05-04', fav: true,
    ds: 'Sette generazioni della famiglia Buendía nel paese immaginario di Macondo, dove il prodigioso e il quotidiano convivono senza stupore.' }),
  bk(8, { t: 'Cronaca di una morte annunciata', a: 'Gabriel García Márquez', e: 'Mondadori', y: '2014', pg: '120', gen: 'Romanzo',
    ds: 'Tutto il paese sa che un uomo sta per essere ucciso, eppure nessuno riesce a fermare quello che accade: una ricostruzione all\'indietro.' }),
  bk(9, { t: 'Fondazione', a: 'Isaac Asimov', e: 'Mondadori', y: '2016', pg: '260', gen: 'Fantascienza', se: 'Ciclo della Fondazione', sn: '1', rs: 'ok', rt: 4, rd: D + '08-30',
    ds: 'Un matematico prevede la caduta dell\'Impero galattico e mette in piedi un piano per accorciare i secoli bui che verranno.' }),
  bk(10, { t: 'Fondazione e Impero', a: 'Isaac Asimov', e: 'Mondadori', y: '2016', pg: '280', gen: 'Fantascienza', se: 'Ciclo della Fondazione', sn: '2',
    ds: 'Il piano deve fare i conti con un nemico che nessuno aveva previsto.' }),
  bk(11, { t: 'Seconda Fondazione', a: 'Isaac Asimov', e: 'Mondadori', y: '2017', pg: '270', gen: 'Fantascienza', se: 'Ciclo della Fondazione', sn: '3',
    ds: 'La ricerca di una seconda Fondazione nascosta chiude la prima trilogia del ciclo.' }),
  bk(12, { t: 'Il Gattopardo', a: 'Giuseppe Tomasi di Lampedusa', e: 'Feltrinelli', y: '2018', pg: '330', gen: 'Romanzo storico', w: true,
    ds: 'In Sicilia, mentre arrivano i garibaldini, un principe osserva la fine del suo mondo e capisce che tutto deve cambiare perché nulla cambi.' })
];
/* paesi e film già scritti: nessuna domanda a Wikidata (formato di app-wiki.js: c paese, b paese di nascita, f film; k = titolo del libro) */
function wdData() {
  function f(t, y, d, s, book) { var tk = L.titleKey(book), full = L.norm(book).replace(/[^a-z0-9]+/g, ' ').trim(); return { q: 'ex-' + L.norm(t + y).replace(/[^a-z0-9]+/g, ''), t: t, y: y, d: d, s: s ? 1 : 0, u: '', k: [tk, full] }; }
  var now = Date.now();
  return { '~v': 1,
    'alessandro manzoni': { q: 'ex1', c: 'IT', t: now, f: [f('I promessi sposi', 1941, 'Mario Camerini', 0, 'I promessi sposi'), f('I promessi sposi', 1989, 'Salvatore Nocita', 1, 'I promessi sposi')] },
    'luigi pirandello': { q: 'ex2', c: 'IT', t: now, f: [f('Le due vite di Mattia Pascal', 1985, 'Mario Monicelli', 0, 'Il fu Mattia Pascal')] },
    'carlo collodi': { q: 'ex3', c: 'IT', t: now, f: [f('Le avventure di Pinocchio', 1972, 'Luigi Comencini', 1, 'Le avventure di Pinocchio'), f('Pinocchio', 2019, 'Matteo Garrone', 0, 'Le avventure di Pinocchio')] },
    'lev tolstoj': { q: 'ex4', c: 'RU', t: now, f: [f('Anna Karenina', 2012, 'Joe Wright', 0, 'Anna Karenina')] },
    'jane austen': { q: 'ex5', c: 'GB', t: now, f: [f('Orgoglio e pregiudizio', 2005, 'Joe Wright', 0, 'Orgoglio e pregiudizio'), f('Orgoglio e pregiudizio', 1995, 'Simon Langton', 1, 'Orgoglio e pregiudizio')] },
    'gabriel garcia marquez': { q: 'ex6', c: 'CO', t: now, f: [f('Cent\'anni di solitudine', 2024, '', 1, 'Cent\'anni di solitudine'), f('Cronaca di una morte annunciata', 1987, 'Francesco Rosi', 0, 'Cronaca di una morte annunciata')] },
    'isaac asimov': { q: 'ex7', c: 'US', b: 'RU', t: now, f: [f('Foundation', 2021, '', 1, 'Fondazione')] },
    'giuseppe tomasi di lampedusa': { q: 'ex8', c: 'IT', t: now, f: [f('Il Gattopardo', 1963, 'Luchino Visconti', 0, 'Il Gattopardo')] }
  };
}
function wdFix(m) {                       // le chiavi come le calcola l'app (wdKey: nome normalizzato)
  var out = { '~v': m['~v'] };
  Object.keys(m).forEach(function (k) { if (k.charAt(0) !== '~') out[L.norm(k)] = m[k]; });
  return out;
}
function enter(at, what) {
  fromGuide = at == null ? -1 : at;
  var books = BOOKS.map(function (b) { return Object.assign({}, b); });
  var ok = NL.guestEnter('esempio', books, { esempio: true, wd: wdFix(wdData()), empty: { lib: 'Nessun libro da mostrare.', wish: 'Nessun desiderio da mostrare.' } });
  if (ok === false) return;
  bar();
  if (what === 'book') NL.openCard('ex7');
  else if (what === 'loan') NL.openCard('ex4');   // Pinocchio, prestato a Marta
  else if (what === 'wish') { NL.setTab('wish'); bar(); window.scrollTo({ top: 0 }); }
  else if (what === 'sort') {
    var sb = $('#sortBar'); if (sb) { sb.scrollIntoView({ block: 'center' }); sb.classList.add('gd-flash'); setTimeout(function () { sb.classList.remove('gd-flash'); }, 2200); }
  }
}
/* striscia «Libreria di esempio · Esci» */
function bar() {
  var on = NL.esempio && NL.esempio(), el = document.getElementById('exBar');
  if (!on) { if (el) el.hidden = true; return; }
  if (!el) {
    var top = document.querySelector('header.top'); if (!top) return;
    el = document.createElement('section'); el.id = 'exBar'; el.className = 'ex-bar';
    top.parentNode.insertBefore(el, top.nextSibling);
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ex]'); if (!b) return;
      if (b.dataset.ex === 'out') NL.guestExit();
      else if (b.dataset.ex === 'guide') { if (pillShown()) back(true); else { var i = fromGuide; NL.guestExit(); open(i < 0 ? 0 : i); } }
      else if (b.dataset.ex === 'tab') { if (NL.tab() !== b.dataset.t) { NL.setTab(b.dataset.t); window.scrollTo({ top: 0 }); } bar(); }
    });
  }
  el.hidden = false;
  var all = NL.books(), nl = all.filter(function (b) { return !b.w; }).length, nw = all.length - nl, t = NL.tab();
  el.innerHTML = '<p class="ex-h">Solo da guardare: <b>i tuoi libri non cambiano</b>.</p>' +
    '<div class="ex-row"><div class="chips ex-tabs">' +
      '<button type="button" class="chip" data-ex="tab" data-t="lib" aria-pressed="' + (t !== 'wish') + '">Libreria · ' + nl + '</button>' +
      '<button type="button" class="chip" data-ex="tab" data-t="wish" aria-pressed="' + (t === 'wish') + '">Desideri · ' + nw + '</button></div>' +
    '<span class="ex-go">' + (fromGuide >= 0 ? '<button type="button" class="link" data-ex="guide">‹ Guida</button>' : '') +
    '<button type="button" class="btn sm" data-ex="out">Esci</button></span></div>';
}
NL.on('guest', function () { bar(); });
/* nell'esempio si guarda soltanto: stella, libricini, matita e gli altri tasti rispondono con un avviso */
var FREE = { toggle: 1, zoom: 1, facet: 1, serall: 1, descmore: 1, websearch: 1, clearflt: 1, auinfo: 1 };   // auinfo: lo ferma openAuthor con il suo avviso
var tWarn = 0;
function warn() { var t = Date.now(); if (t - tWarn < 1200) return; tWarn = t; NL.toast('È solo un esempio: prova con i tuoi libri.'); }
function stopped(e) {
  if (!(NL.esempio && NL.esempio())) return null;
  var t = e.target; if (!t.closest || !t.closest('#list')) return null;
  var x = t.closest('input, textarea, select, [contenteditable], .cv-editb, [data-act]');
  if (!x) return null;
  if (x.dataset && x.dataset.act && FREE[x.dataset.act]) return null;
  return x;
}
document.addEventListener('mousedown', function (e) { if (stopped(e)) e.preventDefault(); }, true);   // niente tastiera
document.addEventListener('click', function (e) { if (!stopped(e)) return; e.preventDefault(); e.stopImmediatePropagation(); warn(); }, true);
document.addEventListener('focusin', function (e) { if (!stopped(e)) return; try { e.target.blur(); } catch (x) { /* niente */ } warn(); }, true);
document.addEventListener('change', function (e) { if (stopped(e)) { e.stopImmediatePropagation(); } }, true);

/* ---------- Menu › Info e aiuto: «Come si usa» e «Guarda una libreria di esempio» ---------- */
function menu() {
  var list = document.getElementById('infoList'); if (!list || document.getElementById('goGuida')) return;
  var a = document.createElement('button'); a.type = 'button'; a.className = 'dopt'; a.id = 'goGuida';
  a.innerHTML = '<span><b>Come si usa</b><small>Le schede di benvenuto</small></span><span class="n" aria-hidden="true">›</span>';
  var b = document.createElement('button'); b.type = 'button'; b.className = 'dopt'; b.id = 'goEsempio';
  b.innerHTML = '<span><b>Guarda una libreria di esempio</b><small>Prova l\'app senza i tuoi libri</small></span><span class="n" aria-hidden="true">›</span>';
  // indirizzo ufficiale (Piero, 18/11/2026): contro le copie dell'app ad altri indirizzi
  var u = document.createElement('p'); u.className = 'gd-uff'; u.id = 'nlUfficiale';
  u.innerHTML = 'Next Libris è solo su <b>nextlibris.app</b>. Una copia a un altro indirizzo non è nostra: non darle la tua API né i tuoi dati.';
  list.insertBefore(b, list.firstChild); list.insertBefore(a, b); list.appendChild(u);   // giro 10: la frase sull'indirizzo in fondo a Info e aiuto
  a.addEventListener('click', function () { NL.fromMenu(function () { open(0); }); });
  b.addEventListener('click', function () { NL.fromMenu(function () { enter(-1, ''); }); });
  var sm = document.querySelector('#goInfo small'); if (sm) sm.textContent = 'Guida, condividi, installa, contatti';
}
menu();

/* prima apertura in assoluto: la guida si apre da sola (dopo la schermata d'apertura) */
/* si apre da sola una volta: ai nuovi e, dal giro 5, anche a chi usa già l'app, al primo avvio dopo l'aggiornamento (GV = versione della guida) */
function due() { return !cfg.seen || (cfg.v || 1) < GV; }
/* anche con il link d'invito (Piero, 19/11/2026); su iPhone nel browser prima «Prima mettila sul tuo iPhone» (giro 11F) */
function auto() {
  if (!due()) return;
  if (document.getElementById('iosGate')) { setTimeout(auto, 800); return; }
  if (!(NL.guest && NL.guest())) open(0, true);
}
if (due()) setTimeout(auto, 900);
else pathSoon(1200);   // percorso rimasto a metà (giro 12)

window.NLGuida = { open: open, close: close, path: function () { return cfg.path || 0; }, pathShow: pathShow, esempio: function (what) { enter(-1, what || ''); }, screens: function () { return screens().map(function (s) { return { h: s.h, go: s.go || '', sel: s.sel || '', mod: s.mod || '' }; }); } };
})();
