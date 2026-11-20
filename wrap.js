/* Next Libris · modulo «La tua stagione in libri» (wrap di ogni stagione, stile storie; fino al 16/11/2026 era ogni trimestre).
   Modulo a parte: usa solo window.NL (l'attacco dei moduli in app.js). Per toglierlo dall'app bastano:
   cancellare wrap.js e wrap.css, togliere le loro due righe da index.html e i due nomi da SHELL in sw.js
   (lo fa togli_modulo.py, nel ramo prove). I dati suoi stanno in 'catalogo-libri-wrap'. */
(function () {
'use strict';
var NL = window.NL;
if (!NL) return;
var L = NL.L, esc = NL.esc, $ = NL.$;
var LS = 'catalogo-libri-wrap', DAY = 864e5, ASK_DAYS = 30;
var MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
var TITOLO = ['Il tuo inverno in libri', 'La tua primavera in libri', 'La tua estate in libri', 'Il tuo autunno in libri'];
var cfg = { on: true, seen: '' };
try { var c0 = JSON.parse(NL.ls.get(LS) || '{}'); cfg.on = c0.on !== false; cfg.seen = L.str(c0.seen).slice(0, 10); } catch (e) { if (window.nlErr) nlErr(e); }
function save() { NL.ls.set(LS, JSON.stringify(cfg)); }

/* ---------- stagioni ---------- */
function pad(n) { return (n < 10 ? '0' : '') + n; }
function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
/* le quattro stagioni (meteorologiche, a mesi interi): inverno dicembre-febbraio, primavera marzo-maggio, estate giugno-agosto,
   autunno settembre-novembre (Piero, 16/11/2026: «in concomitanza con le quattro stagioni»). L'inverno 2026 va da dicembre 2025 a febbraio 2026. */
function quarter(y, q) {                      // q = 1..4: inverno, primavera, estate, autunno
  while (q < 1) { q += 4; y--; } while (q > 4) { q -= 4; y++; }
  var s = new Date(y, (q - 1) * 3 - 1, 1), e = new Date(y, q * 3 - 1, 1), last = new Date(y, q * 3 - 2, 1);
  return { y: y, q: q, key: y + '-S' + q, s: s.getTime(), e: e.getTime(), sd: ymd(s), ed: ymd(e),
    label: MESI[s.getMonth()] + (s.getFullYear() !== last.getFullYear() ? ' ' + s.getFullYear() : '') + ' – ' + MESI[last.getMonth()] + ' ' + last.getFullYear(), title: TITOLO[q - 1] };
}
function quarterOf(t) { var d = new Date(t), m = d.getMonth(); return quarter(d.getFullYear() + (m === 11 ? 1 : 0), Math.floor((m + 1) / 3) % 4 + 1); }
function prevQ(Q) { return quarter(Q.y, Q.q - 1); }

/* ---------- i numeri di una stagione ---------- */
function pages(b) { var n = parseInt(b.pg, 10); return n > 0 && n < 20000 ? n : 0; }
function inQ(Q, b) { return b.rd && b.rd >= Q.sd && b.rd < Q.ed; }
function top(m, n) { return Object.keys(m).map(function (k) { return m[k]; }).sort(function (x, y) { return y.n - x.n || (y.r || 0) - (x.r || 0); }).slice(0, n); }
function wrapData(books, quotes, Q, now) {
  now = now || Date.now();
  var mine = books.filter(function (b) { return !b.w; });
  var read = mine.filter(function (b) { return b.rs === 'ok' && inQ(Q, b); });
  var pq = prevQ(Q), prevRead = mine.filter(function (b) { return b.rs === 'ok' && inQ(pq, b); }).length;
  var added = mine.filter(function (b) { return b.ts >= Q.s && b.ts < Q.e && (b.t || b.a || b.i); });
  var wish = books.filter(function (b) { return b.w && b.ts >= Q.s && b.ts < Q.e && (b.t || b.a || b.i); }).length;
  var qs = (quotes || []).filter(function (x) { return x.c && x.c.d >= Q.s && x.c.d < Q.e && x.c.x; });
  var loans = mine.filter(function (b) { return b.p && b.pd && b.pd >= Q.sd && b.pd < Q.ed; });
  var d = { Q: Q, n: read.length, prev: prevRead, read: read, added: added.length, wish: wish, quotes: qs.length, loans: loans.length };
  if (!d.n && !d.added && !d.quotes) { d.empty = true; return d; }
  d.ongoing = now < Q.e;
  var days = Math.max(1, Math.round((Math.min(now, Q.e) - Q.s) / DAY));
  d.pages = read.reduce(function (a, b) { return a + pages(b); }, 0);
  d.noPages = read.filter(function (b) { return !pages(b); }).length;
  d.perDay = d.pages ? Math.round(d.pages / days) : 0;
  var mm = {};
  read.forEach(function (b) { var m = +b.rd.slice(5, 7) - 1; (mm[m] || (mm[m] = { k: m, n: 0 })).n++; });
  var bm = top(mm, 2); d.month = d.n >= 2 && bm[0] && (!bm[1] || bm[0].n > bm[1].n) ? { name: MESI[bm[0].k], n: bm[0].n } : null;
  var src = read.length >= 2 ? read : added, gm = {}, gn = 0;
  src.forEach(function (b) { var g = L.str(b.gen).trim(); if (!g) return; gn++; var k = L.norm(g); (gm[k] || (gm[k] = { name: g, n: 0 })).n++; });
  d.genres = gn ? top(gm, 3).map(function (g) { return { name: g.name, pc: Math.round(g.n * 100 / gn) }; }) : [];
  d.genFrom = src === read ? 'letti' : 'entrati';
  var am = {};
  read.forEach(function (b) { NL.authorsOf(b).forEach(function (a) { var k = L.norm(a); var x = am[k] || (am[k] = { name: a, n: 0, r: 0 }); x.n++; x.r += b.rt || 0; }); });
  var ta = top(am, 1)[0]; d.author = ta && ta.n >= 2 ? ta : null;
  if (NL.wdBookCountry) {                    // paesi degli autori letti (giro 2, 18/11/2026)
    var pm = {}; read.forEach(function (b) { var c = NL.wdBookCountry(b); if (c) (pm[c] || (pm[c] = { c: c, n: 0 })).n++; });
    d.countries = top(pm, 12);
  }
  var lg = read.filter(pages).sort(function (x, y) { return pages(y) - pages(x); })[0];
  d.longest = lg ? { t: lg.t, a: lg.a, pg: pages(lg) } : null;
  var bs = read.filter(function (b) { return b.rt > 0; }).sort(function (x, y) { return y.rt - x.rt || (y.rd > x.rd ? 1 : -1); })[0];
  d.best = bs ? { t: bs.t, a: bs.a, rt: bs.rt } : null;
  var q1 = qs.slice().sort(function (x, y) { return y.c.d - x.c.d; })[0];
  d.quote = q1 ? { x: q1.c.x.length > 200 ? q1.c.x.slice(0, 197).replace(/\s+\S*$/, '') + '…' : q1.c.x, t: q1.b.t } : null;
  var who = {}; loans.forEach(function (b) { var k = L.norm(b.p); (who[k] || (who[k] = { name: b.p, n: 0 })).n++; });
  var tw = top(who, 1)[0]; d.lender = tw && tw.n >= 2 ? tw : null;
  var goal = NL.goal();
  if (goal) {
    var yr = String(Q.y);
    d.goal = { n: goal, done: mine.filter(function (b) { return b.rs === 'ok' && b.rd && b.rd.slice(0, 4) === yr && b.rd < Q.ed; }).length };
  }
  return d;
}
function quarters(now) {                      // le stagioni con qualcosa da raccontare, dal piu' recente
  now = now || Date.now();
  var books = NL.books(), quotes = NL.quotes(), first = now;
  books.forEach(function (b) { if (b.ts > 946684800000 && b.ts < first) first = b.ts; if (b.rd) { var t = Date.parse(b.rd + 'T12:00:00'); if (t < first) first = t; } });
  var out = [], Q = quarterOf(now), stop = quarterOf(first).s, guard = 0;
  while (Q.s >= stop && guard++ < 200) { var d = wrapData(books, quotes, Q, now); if (!d.empty) out.push(d); Q = prevQ(Q); }
  return out;
}

/* ---------- le schermate ---------- */
var nf = new Intl.NumberFormat('it-IT');
function stars(n) { return esc(NL.L.rateWord ? NL.L.rateWord(n) : String(n)); }   // il voto a parole (i libricini, 16/11/2026)
function slides(d) {
  var Q = d.Q, out = [];
  var name = NL.name();
  out.push({ cls: 'w-c1', cover: true, html: '<p class="w-kick">' + esc(Q.label) + (d.ongoing ? ' · finora' : '') + '</p><h2 class="w-big-t">' + esc(Q.title) + '</h2>' +
    (name ? '<p class="w-sub">di ' + esc(name) + '</p>' : '') + '<p class="w-hint">Tocca a destra per andare avanti, a sinistra per tornare indietro.</p>' });
  if (d.n) {
    var delta = d.n - d.prev;
    out.push({ cls: 'w-c2', html: '<p class="w-kick">In questa stagione hai letto</p><p class="w-num">' + d.n + '</p><p class="w-unit">' + (d.n === 1 ? 'libro' : 'libri') + '</p>' +
      '<ul class="w-facts">' + (d.pages ? '<li><b>' + nf.format(d.pages) + '</b> pagine' + (d.perDay ? ', circa <b>' + d.perDay + '</b> al giorno' : '') + (d.noPages ? ' <small>(' + d.noPages + ' senza pagine)</small>' : '') + '</li>' : '') +
      (d.month ? '<li>Il mese più letto: <b>' + esc(d.month.name) + '</b>, con ' + d.month.n + ' libri</li>' : '') +
      (d.prev && !d.ongoing ? '<li>' + (delta > 0 ? '<b>' + delta + ' in più</b> della stagione prima' : delta < 0 ? (-delta) + ' in meno della stagione prima' : 'Quanti la stagione prima') + '</li>' : '') +
      (d.goal ? '<li>Obiettivo ' + Q.y + ': <b>' + d.goal.done + ' su ' + d.goal.n + '</b>' + (d.goal.done >= d.goal.n ? ' — raggiunto!' : '') + '</li>' : '') + '</ul>' });
  } else {
    out.push({ cls: 'w-c2', html: '<p class="w-kick">Letture</p><p class="w-mid">Nessun libro segnato «Letto» con la data in questa stagione.</p><p class="w-sub">Quando finisci un libro, segnalo «Letto»: la data si mette da sola e il prossimo riepilogo lo conta.</p>' });
  }
  if (d.genres.length || d.author) {
    out.push({ cls: 'w-c3', html: (d.genres.length ? '<p class="w-kick">I tuoi generi (' + esc(d.genFrom === 'letti' ? 'tra i libri letti' : 'tra i libri entrati') + ')</p><ol class="w-bars">' +
      d.genres.map(function (g) { return '<li><span class="w-bn">' + esc(g.name) + '</span><span class="w-bar"><i style="width:' + Math.max(6, g.pc) + '%"></i></span><b>' + g.pc + '%</b></li>'; }).join('') + '</ol>' : '') +
      (d.author ? '<p class="w-kick w-gap">Autore della stagione</p><p class="w-mid">' + esc(d.author.name) + '</p><p class="w-sub">' + d.author.n + ' libri letti</p>' : '') });
  }
  if (d.countries && d.countries.length) {
    var pn = d.countries.length;
    out.push({ cls: 'w-c4', html: '<p class="w-kick">Con i libri letti</p><p class="w-mid">Hai viaggiato in ' + (pn === 1 ? '1 paese' : pn + ' paesi') + '</p>' +
      '<p class="w-flags" aria-hidden="true">' + d.countries.map(function (x) { return '<span>' + (NL.wdFlagImg ? NL.wdFlagImg(x.c) : NL.wdFlag(x.c)) + '</span>'; }).join('') + '</p>' +
      '<p class="w-sub">' + esc(d.countries.map(function (x) { return NL.wdCName(x.c) + (x.n > 1 ? ' (' + x.n + ')' : ''); }).join(', ')) + '</p>' });
  }
  if (d.longest || d.best) {
    out.push({ cls: 'w-c4', html: (d.longest ? '<p class="w-kick">Il più lungo</p><p class="w-mid">«' + esc(d.longest.t) + '»</p><p class="w-sub">' + esc(d.longest.a) + ' · ' + nf.format(d.longest.pg) + ' pagine</p>' : '') +
      (d.best ? '<p class="w-kick w-gap">Quello che ti è piaciuto di più</p><p class="w-mid">«' + esc(d.best.t) + '»</p><p class="w-sub">' + esc(d.best.a) + '</p><p class="w-stars" aria-label="' + d.best.rt + ' stelle su 5">' + stars(d.best.rt) + '</p>' : '') });
  }
  if (d.added || d.quotes || d.loans) {
    out.push({ cls: 'w-c5', html: '<p class="w-kick">In libreria</p>' + (d.added ? '<p class="w-num w-num-s">' + d.added + '</p><p class="w-unit">' + (d.added === 1 ? 'libro nuovo' : 'libri nuovi') + '</p>' : '') +
      '<ul class="w-facts">' + (d.wish ? '<li><b>' + d.wish + '</b> nei Desideri</li>' : '') + (d.loans ? '<li><b>' + d.loans + '</b> ' + (d.loans === 1 ? 'libro prestato' : 'libri prestati') + (d.lender ? ', soprattutto a ' + esc(d.lender.name) : '') + '</li>' : '') +
      (d.quotes ? '<li><b>' + d.quotes + '</b> ' + (d.quotes === 1 ? 'citazione salvata' : 'citazioni salvate') + '</li>' : '') + '</ul>' +
      (d.quote ? '<blockquote class="w-q">' + esc(d.quote.x) + '<cite>' + esc(d.quote.t) + '</cite></blockquote>' : '') });
  }
  out.push({ cls: 'w-c6', last: true, html: '<p class="w-kick">' + esc(Q.label) + (d.ongoing ? ' · finora' : '') + '</p><h2 class="w-big-t w-s">' + esc(Q.title) + '</h2>' +
    '<dl class="w-sum">' + (d.n ? '<div><dt>letti</dt><dd>' + d.n + '</dd></div>' : '') + (d.pages ? '<div><dt>pagine</dt><dd>' + nf.format(d.pages) + '</dd></div>' : '') +
    (d.added ? '<div><dt>nuovi</dt><dd>' + d.added + '</dd></div>' : '') + (d.quotes ? '<div><dt>citazioni</dt><dd>' + d.quotes + '</dd></div>' : '') + '</dl>' +
    (d.genres[0] ? '<p class="w-sub">Genere: <b>' + esc(d.genres[0].name) + '</b>' + (d.author ? ' · Autore: <b>' + esc(d.author.name) + '</b>' : '') + '</p>' : '') +
    '<p class="w-shh">Condividi l\'immagine</p><div class="w-acts w-two"><button type="button" class="w-btn w-pri" data-w="share" data-f="story">Storia</button><button type="button" class="w-btn w-pri" data-w="share" data-f="square">Quadrata</button></div><div class="w-acts"><button type="button" class="w-btn" data-w="again">Rivedi</button><button type="button" class="w-btn" data-w="close">Chiudi</button></div>' });
  return out;
}

/* ---------- la finestra a tutto schermo ---------- */
var W = { el: null, list: [], qi: 0, data: null, sl: [], i: 0, pushed: false, back: null };
function build() {
  if (W.el) return;
  var el = document.createElement('div');
  el.id = 'wrap'; el.className = 'wrap'; el.hidden = true;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'La tua stagione in libri');
  el.innerHTML = '<div class="w-prog" id="wProg"></div><button type="button" class="w-x" data-w="close" aria-label="Chiudi">×</button>' +
    '<div class="w-stage" id="wStage" aria-live="polite"></div>';
  document.body.appendChild(el);
  W.el = el;
  el.addEventListener('click', function (e) {
    var b = e.target.closest('[data-w]');
    if (b) {
      var a = b.dataset.w;
      if (a === 'close') close();
      else if (a === 'again') go(0);
      else if (a === 'share') share(b.dataset.f);
      else if (a === 'older') pickQ(W.qi + 1);
      else if (a === 'newer') pickQ(W.qi - 1);
      return;
    }
    var r = el.getBoundingClientRect();
    if (e.clientX - r.left < r.width * 0.3) go(W.i - 1); else go(W.i + 1);
  });
}
function paint() {
  var s = W.sl[W.i], Q = W.data.Q;
  W.el.className = 'wrap ' + s.cls;
  $('#wProg').innerHTML = W.sl.map(function (x, k) { return '<span class="' + (k < W.i ? 'done' : k === W.i ? 'now' : '') + '"></span>'; }).join('');
  var nav = s.cover && W.list.length > 1 ? '<div class="w-nav"><button type="button" class="w-btn" data-w="older"' + (W.qi >= W.list.length - 1 ? ' disabled' : '') + ' aria-label="Stagione prima">‹ Prima</button>' +
    '<button type="button" class="w-btn" data-w="newer"' + (W.qi <= 0 ? ' disabled' : '') + ' aria-label="Stagione dopo">Dopo ›</button></div>' : '';
  $('#wStage').innerHTML = '<div class="w-slide" data-q="' + Q.key + '">' + s.html + nav + '</div>';
}
function go(i) { if (i < 0 || i >= W.sl.length) return; W.i = i; paint(); }
function pickQ(i) { if (i < 0 || i >= W.list.length) return; W.qi = i; W.data = W.list[i]; W.sl = slides(W.data); W.i = 0; paint(); }
function open(key) {
  if (NL.guest && NL.guest()) NL.guestExit();   // la stagione e' sempre la tua, anche dalla libreria di un amico
  W.list = quarters();
  if (!W.list.length) { NL.toast('Per il riepilogo servono libri letti (con la data) o libri aggiunti.'); return; }
  var now = Date.now(), last = prevQ(quarterOf(now)).key, i = -1;
  W.list.forEach(function (d, k) { if (i < 0 && d.Q.key === (key || last)) i = k; });
  if (i < 0) i = 0;
  build();
  W.back = document.activeElement;
  W.el.style.setProperty('--w-base', baseColor());
  pickQ(i);
  W.el.hidden = false; document.body.classList.add('wrap-open');
  if (W.data.Q.key === last && cfg.seen !== last) { cfg.seen = last; save(); paintAsk(); }
  if (!W.pushed) { try { history.pushState({ wrap: 1 }, ''); W.pushed = true; } catch (e) { if (window.nlErr) nlErr(e); } }
  setTimeout(function () { try { W.el.querySelector('.w-x').focus({ preventScroll: true }); } catch (e) { if (window.nlErr) nlErr(e); } }, 30);
}
function close(fromPop) {
  if (!W.el || W.el.hidden) return;
  W.el.hidden = true; document.body.classList.remove('wrap-open');
  if (W.pushed) { W.pushed = false; if (!fromPop) { try { history.back(); } catch (e) { if (window.nlErr) nlErr(e); } } }
  try { if (W.back) W.back.focus({ preventScroll: true }); } catch (e) { if (window.nlErr) nlErr(e); }
}
window.addEventListener('popstate', function () { if (PV) return; if (W.el && !W.el.hidden) { W.pushed = false; close(true); } });
window.addEventListener('keydown', function (e) {
  if (!W.el || W.el.hidden) return;
  if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); close(); }
  else if (e.key === 'ArrowRight') { e.stopImmediatePropagation(); go(W.i + 1); }
  else if (e.key === 'ArrowLeft') { e.stopImmediatePropagation(); go(W.i - 1); }
}, true);

/* ---------- immagine da condividere ---------- */
function baseColor() {                     // il colore della palette; se e' chiaro (tema scuro) lo scurisco, perche' il testo e' bianco
  var v = cssVar('--accent', '#1B6A4F'), m = v.match(/^#([0-9a-f]{6})$/i), r, g, b;
  if (m) { r = parseInt(m[1].slice(0, 2), 16); g = parseInt(m[1].slice(2, 4), 16); b = parseInt(m[1].slice(4, 6), 16); }
  else { m = v.match(/(\d+)\D+(\d+)\D+(\d+)/); if (!m) return '#1B6A4F'; r = +m[1]; g = +m[2]; b = +m[3]; }
  var lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255, k = lum > 0.42 ? 0.42 : 1;
  function h(x) { x = Math.round(x * k); return (x < 16 ? '0' : '') + x.toString(16); }
  return '#' + h(r) + h(g) + h(b);
}
function cssVar(n, def) { try { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || def; } catch (e) { return def; } }
/* ---------- colori delle stagioni e immagine da condividere (giro 11C, 19/11/2026, scelte di Piero) ----------
   Stile «Tessere»: schede colorate di misure diverse su fondo scuro, numeri grandi in Bricolage Grotesque.
   Colori «più tenui», uno schema per stagione (q = 1 inverno, 2 primavera, 3 estate, 4 autunno). Servono anche al profilo.
   Una sola immagine, in due formati: storia (1080×1920) e quadrata (1080×1080). La usano la stagione in libri (la stagione
   mostrata) e il profilo (l'anno fino a oggi). Copertine: prima i libri «Lo consiglio», poi quelli col voto più alto (al massimo 4).
   Il link non è nell'immagine come QR: c'è scritto l'indirizzo, e il link con l'invito va nel testo che accompagna l'immagine. */
var PAL = {
  1: { n: 'inverno', bg: '#0E1626', t: ['#3A4F73', '#9DBCCB', '#A797BF'] },
  2: { n: 'primavera', bg: '#16241A', t: ['#6B9A68', '#D597AA', '#D9CC7A'] },
  3: { n: 'estate', bg: '#0F2230', t: ['#3F86A3', '#DDB46A', '#CF7584'] },
  4: { n: 'autunno', bg: '#2A1A12', t: ['#A8664A', '#C99A62', '#8A9160'] }
};
function lum(hex) {
  var m = /^#([0-9a-f]{6})$/i.exec(hex); if (!m) return 0;
  return [0, 2, 4].map(function (i) { var c = parseInt(m[1].slice(i, i + 2), 16) / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); })
    .reduce(function (a, c, i) { return a + c * [0.2126, 0.7152, 0.0722][i]; }, 0);
}
function ink(hex) { return lum(hex) < 0.22 ? '#FFFFFF' : '#1B1B1B'; }        // testo bianco sui colori scuri, quasi nero su quelli chiari
function palette(q) {
  var p = PAL[q] || PAL[quarterOf(Date.now()).q];
  return { q: p === PAL[q] ? q : quarterOf(Date.now()).q, name: p.n, bg: p.bg, t: p.t.slice(), ink: p.t.map(ink) };
}
/* i libri «più amati» di un elenco di letti: prima «Lo consiglio», poi il voto più alto; a parità i più recenti */
function loved(read, max) {
  return read.filter(function (b) { return b.lc || b.rt > 0; }).slice().sort(function (x, y) {
    return (y.lc ? 1 : 0) - (x.lc ? 1 : 0) || (y.rt || 0) - (x.rt || 0) || String(y.rd || '').localeCompare(String(x.rd || ''));
  }).slice(0, max || 4);
}
/* il link all'app con l'invito (?amico=Nome), se c'è l'account */
function invite() {
  var S = window.NLSocial, base = (S && S.home && S.home()) || 'https://nextlibris.github.io/';
  var A = window.NLAmici, me = A && A.state && A.state().me;
  return me && me.utente ? base + '?amico=' + encodeURIComponent(me.utente) : base;
}
function cardFromWrap(d) {
  return { q: d.Q.q, title: d.Q.title.replace(/^Il tuo/, 'Il mio').replace(/^La tua/, 'La mia'), label: d.Q.label + (d.ongoing ? ' · finora' : ''),
    name: NL.name(), alab: 'Autore della stagione', n: d.n, added: d.added, pages: d.pages, author: d.author ? { name: d.author.name, n: d.author.n } : null,
    countries: (d.countries || []).map(function (x) { return x.c; }), books: loved(d.read, 4), goal: d.goal || null };
}

/* ---------- disegno ---------- */
var FD = '"Bricolage Grotesque", "Avenir Next", system-ui, sans-serif', FB = '"IBM Plex Sans", system-ui, sans-serif';
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
/* righe di testo che stanno in larghezza: se non bastano maxL righe rimpicciolisce; con cut=false non taglia mai (si va giù fino a min) */
function lines(g, text, maxW, size, min, maxL, font, cut) {
  text = String(text || '').trim();
  for (var s = size; s >= min; s -= 2) {
    g.font = font.replace('%', s + 'px');
    var out = [], line = '';
    text.split(/\s+/).forEach(function (w) {
      while (g.measureText(w).width > maxW && w.length > 1) {          // parola più larga della riga: va a capo dentro la parola
        var k = w.length - 1; while (k > 1 && g.measureText(w.slice(0, k)).width > maxW) k--;
        if (line) { out.push(line); line = ''; } out.push(w.slice(0, k)); w = w.slice(k);
      }
      var t = line ? line + ' ' + w : w;
      if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    });
    if (line) out.push(line);
    if (out.length <= maxL || (s - 2 < min && !cut)) return { l: out, s: s };
  }
  g.font = font.replace('%', min + 'px');
  var o2 = lines(g, text, maxW, min, min, 99, font, false).l, last = o2.slice(0, maxL);
  if (o2.length > maxL) { var z = last[maxL - 1]; while (z && g.measureText(z + '…').width > maxW) z = z.slice(0, -1); last[maxL - 1] = z + '…'; }
  return { l: last, s: min };
}
function txt(g, L, x, y, lh, col, font) { g.fillStyle = col; g.font = font.replace('%', L.s + 'px'); L.l.forEach(function (t, i) { g.fillText(t, x, y + i * L.s * lh); }); return y + L.l.length * L.s * lh; }
function loadImg(src, cors) {
  return new Promise(function (res) {
    if (!src) { res(null); return; }
    var im = new Image(), done = false, end = function (v) { if (!done) { done = true; res(v); } };
    if (cors) im.crossOrigin = 'anonymous';
    im.referrerPolicy = 'no-referrer'; im.decoding = 'async';
    im.onload = function () { end(im.naturalWidth ? im : null); }; im.onerror = function () { end(null); };
    setTimeout(function () { end(null); }, 6000);
    im.src = src;
  });
}
/* copertina: la foto (sul telefono o in rete, se il sito la lascia usare), altrimenti disegnata col titolo che va a capo, mai tagliato */
function coverSrc(b) { var u = (NL.bigImg && NL.bigImg(b)) || b.img || ''; return /^(https:|blob:|data:)/.test(u) ? u : ''; }
function drawCover(g, b, im, x, y, w, h) {
  g.save(); rr(g, x, y, w, h, Math.round(w * 0.06)); g.clip();
  if (im) {
    var r = Math.max(w / im.naturalWidth, h / im.naturalHeight), iw = im.naturalWidth * r, ih = im.naturalHeight * r;
    g.drawImage(im, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  } else {
    var hh = NL.hue ? NL.hue(b.t || '') : 150;
    g.fillStyle = 'hsl(' + hh + ' 28% 38%)'; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + w * 0.06, y, Math.max(2, w * 0.025), h);
    var pad = w * 0.1, T = lines(g, b.t || 'Senza titolo', w - pad * 2, Math.round(w * 0.15), 6, 7, '600 % ' + FD, false);
    var th = T.l.length * T.s * 1.18, A = b.a ? lines(g, b.a, w - pad * 2, Math.round(w * 0.085), 6, 2, '400 % ' + FB, false) : null;
    var ah = A ? A.l.length * A.s * 1.25 + w * 0.06 : 0, ty = y + Math.max(pad, (h - th - ah) / 2);
    g.textAlign = 'center';
    ty = txt(g, T, x + w / 2, ty, 1.18, '#FFFFFF', '600 % ' + FD);
    if (A) txt(g, A, x + w / 2, ty + w * 0.06, 1.25, 'rgba(255,255,255,.82)', '400 % ' + FB);
    g.textAlign = 'left';
  }
  g.restore();
}
function plural(n, a, b) { return fmtN(n) + ' ' + (n === 1 ? a : b); }
function pile(pages, books) { var cm = Math.round(pages * 0.005 + books * 0.4); return cm < 5 ? '' : 'una pila alta ' + (cm >= 100 ? (cm / 100).toFixed(1).replace('.', ',') + ' m' : cm + ' cm'); }
function fmtN(n) { return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }   // 1.150 (Intl in italiano lascia «1150»)
/* le tessere: ognuna sa quanta altezza le serve (need, con la larghezza) e come disegnarsi nell'altezza che riceve */
function tiles(c, P) {
  var T = [], k = 0;
  function col() { var i = k++ % 3; return { bg: P.t[i], ink: P.ink[i] }; }
  var nN = c.n || !c.added ? c.n : c.added, nL = c.n || !c.added ? (c.n === 1 ? 'libro letto' : 'libri letti') : (c.added === 1 ? 'libro nuovo' : 'libri nuovi');
  T.push({ id: 'n', c: col(), need: function (w) { return (c.goal && c.goal.n ? 120 : 0) + Math.min(300, w * 0.42) + 120; }, draw: function (g, x, y, w, h, C) {
    var go = c.goal && c.goal.n, small = h < 330, gh = go ? (small ? 56 : 110) : 0, big = Math.max(60, Math.min(h - 34 - 50 - gh - 16, w * 0.42, 300));
    g.fillStyle = C.ink; g.font = '600 34px ' + FD; g.fillText(nL, x + 36, y + 34);
    g.font = '700 ' + Math.round(big) + 'px ' + FD; g.fillText(fmtN(nN), x + 30, y + 34 + 46 - big * 0.06);
    var st = y + 34 + 46 + big * 0.82 + 34, sb = y + h - gh - (gh ? 40 : 30);
    if (!small && nN && sb - st > 70) {                                // lo scaffale: un dorso per libro (al massimo 30)
      var m = Math.min(nN, 30), sw = Math.min(30, (w - 72 - (m - 1) * 8) / m), sx = x + 36, sh = Math.min(200, sb - st);
      g.globalAlpha = 0.5; g.fillRect(x + 36, sb, w - 72, 5); 
      for (var i = 0; i < m; i++) { g.globalAlpha = 0.55 + (i % 3) * 0.15; var ht = sh * (0.6 + ((i * 37 + 11) % 40) / 100); g.fillRect(sx, sb - ht, sw, ht); sx += sw + 8; }
      g.globalAlpha = 1;
    }
    if (go && small) { var p0 = Math.min(1, c.goal.done / c.goal.n); g.font = '600 26px ' + FB; g.fillText('Obiettivo ' + fmtN(c.goal.n) + (c.goal.done >= c.goal.n ? ' · raggiunto!' : ' · ' + Math.round(p0 * 100) + '%'), x + 36, y + h - 50); }
    else if (gh) {
      var by = y + h - 50, pc = Math.min(1, c.goal.done / c.goal.n);
      g.font = '600 30px ' + FB; g.fillText('Obiettivo ' + fmtN(c.goal.n) + (c.goal.done >= c.goal.n ? ' · raggiunto!' : ' · ' + Math.round(pc * 100) + '%'), x + 36, by - 46);
      g.globalAlpha = 0.25; rr(g, x + 36, by, w - 72, 16, 8); g.fill(); g.globalAlpha = 1; if (pc > 0) { rr(g, x + 36, by, Math.max(16, (w - 72) * pc), 16, 8); g.fill(); }
    }
  } });
  if (c.pages) T.push({ id: 'p', c: col(), need: function () { return 290; }, draw: function (g, x, y, w, h, C) {
    var pl = h >= 280 ? pile(c.pages, c.n) : '', room = h - 36 - 50 - (pl ? 80 : 0) - 30, s = Math.max(40, Math.min(110, room));
    var L = lines(g, fmtN(c.pages), w - 72, s, 40, 1, '700 % ' + FD, true);
    var yy = txt(g, L, x + 36, y + 32, 1.0, C.ink, '700 % ' + FD);
    g.font = '600 36px ' + FD; g.fillText('pagine', x + 36, yy + 6);
    if (pl) txt(g, lines(g, pl, w - 72, 28, 20, 2, '400 % ' + FB, true), x + 36, yy + 58, 1.3, C.ink, '400 % ' + FB);
  } });
  if (c.author) T.push({ id: 'a', c: col(), need: function () { return 290; }, draw: function (g, x, y, w, h, C) {
    g.fillStyle = C.ink; g.font = '600 30px ' + FB; g.fillText(c.alab || 'Autore preferito', x + 36, y + 36);
    var maxL = Math.max(1, Math.min(3, Math.floor((h - 84 - 70) / 60))), L = lines(g, c.author.name, w - 72, 56, 30, maxL, '700 % ' + FD, true);
    var yy = txt(g, L, x + 36, y + 84, 1.1, C.ink, '700 % ' + FD);
    g.font = '400 30px ' + FB; g.fillText(plural(c.author.n, 'libro letto', 'libri letti'), x + 36, yy + 10);
  } });
  if (c.countries.length) T.push({ id: 'c', c: col(), flags: c.countries.slice(0, 12), need: function (w) { var per = Math.max(1, Math.floor((w - 72 + 14) / 78)); return 170 + Math.ceil(Math.min(12, c.countries.length) / per) * 62; },
    draw: function (g, x, y, w, h, C, imgs) {
      g.fillStyle = C.ink; g.font = '600 30px ' + FB; g.fillText('Ho viaggiato in', x + 36, y + 34);
      g.font = '700 56px ' + FD; g.fillText(plural(c.countries.length, 'paese', 'paesi'), x + 36, y + 74);
      var fw = 64, fh = 48, gap = 14, fx = x + 36, fy = y + 152;
      (imgs || []).forEach(function (im) {
        if (!im) return;
        if (fx + fw > x + w - 36) { fx = x + 36; fy += fh + gap; }
        if (fy + fh > y + h - 16) return;
        g.save(); rr(g, fx, fy, fw, fh, 6); g.clip(); g.drawImage(im, fx, fy, fw, fh); g.restore(); fx += fw + gap;
      });
    } });
  if (c.books.length) T.push({ id: 'b', c: col(), need: function (w, sq) { return sq ? 260 : 104 + 1.5 * (w - 72 - 72) / 4; }, draw: function (g, x, y, w, h, C, imgs) {
    g.fillStyle = C.ink; g.font = '600 30px ' + FB; g.fillText(c.books.length === 1 ? 'Il più amato' : 'I più amati', x + 36, y + 32);
    var gap = 24, n = c.books.length, bw = Math.min((h - 104) / 1.5, (w - 72 - gap * 3) / 4), bx = x + Math.max(36, (w - n * bw - (n - 1) * gap) / 2);
    c.books.forEach(function (b, i) { drawCover(g, b, (imgs || [])[i], bx, y + 80, bw, bw * 1.5); bx += bw + gap; });
  } });
  return T;
}
/* fmt: 'story' (1080×1920) o 'square' (1080×1080). Restituisce una promessa con il canvas. */
async function card(c, fmt) {
  var W = 1080, H = fmt === 'square' ? 1080 : 1920, P = palette(c.q), M = 64;
  try { if (document.fonts && document.fonts.load) await Promise.all(['700 80px "Bricolage Grotesque"', '600 30px "Bricolage Grotesque"', '400 30px "IBM Plex Sans"', '600 30px "IBM Plex Sans"'].map(function (f) { return document.fonts.load(f); })); } catch (e) { if (window.nlErr) nlErr(e); }
  var T = tiles(c, P), bt = T.filter(function (t) { return t.id === 'b'; })[0], ft = T.filter(function (t) { return t.id === 'c'; })[0];
  var covers = bt ? await Promise.all(c.books.map(function (b) { var s = coverSrc(b); return loadImg(s, /^https:/.test(s)); })) : [];
  var flags = ft ? await Promise.all(ft.flags.map(function (cc) { return loadImg('vendor/flags/' + String(cc).toLowerCase() + '.webp', false); })) : [];
  var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  var g = cv.getContext('2d'); g.textBaseline = 'top';
  g.fillStyle = P.bg; g.fillRect(0, 0, W, H);
  g.globalAlpha = 0.10; g.fillStyle = P.t[1]; g.beginPath(); g.arc(W - 90, 120, 260, 0, 7); g.fill(); g.fillStyle = P.t[2]; g.beginPath(); g.arc(80, H - 140, 200, 0, 7); g.fill(); g.globalAlpha = 1;
  /* testata */
  var y = M, sq = fmt === 'square';
  g.fillStyle = 'rgba(255,255,255,.72)'; g.font = '500 ' + (sq ? 28 : 34) + 'px ' + FB; g.fillText(c.label, M, y); y += sq ? 44 : 56;
  y = txt(g, lines(g, c.title, W - M * 2, sq ? 72 : 96, 44, sq ? 1 : 2, '700 % ' + FD, true), M, y, 1.05, '#FFFFFF', '700 % ' + FD);
  if (c.name) { g.fillStyle = 'rgba(255,255,255,.85)'; g.font = '500 ' + (sq ? 28 : 36) + 'px ' + FB; g.fillText('di ' + c.name, M, y + 8); y += sq ? 44 : 60; }
  y += sq ? 18 : 30;
  /* righe di tessere: in storia la prima a tutta larghezza, poi pagine e autore in coppia, paesi e copertine larghe; in quadrata a coppie */
  var foot = sq ? 70 : 110, avail = H - foot - y, gap = 20, cw = W - M * 2, half = (cw - gap) / 2, rows = [];
  var small = T.filter(function (t) { return t.id !== 'b'; });
  if (!sq) {
    var first = small.shift(); if (first) rows.push([first]);
    var pair = small.filter(function (t) { return t.id === 'p' || t.id === 'a'; }); if (pair.length) rows.push(pair);
    small.filter(function (t) { return t.id === 'c'; }).forEach(function (t) { rows.push([t]); });
  } else {
    for (var i = 0; i < small.length; i += 2) rows.push(small.slice(i, i + 2));
  }
  if (bt) rows.push([bt]);
  rows = rows.map(function (r) { var w = r.length === 1 ? cw : half; return { items: r, w: w, h: Math.max.apply(null, r.map(function (t) { return t.need(w, sq); })) }; });
  if (sq) rows.forEach(function (r) { if (r.items[0].id !== 'b') r.h = Math.min(r.h, r.items.length === 1 ? 200 : 230); });
  var need = rows.reduce(function (a, r) { return a + r.h; }, 0) + gap * Math.max(0, rows.length - 1), k = need ? Math.min(1.12, avail / need) : 1;
  y += Math.max(0, Math.floor((avail - need * k) / 2));                // se avanza spazio, le tessere stanno al centro
  rows.forEach(function (r) {
    var h = Math.floor(r.h * k), x = M;
    r.items.forEach(function (t) {
      g.fillStyle = t.c.bg; rr(g, x, y, r.w, h, 34); g.fill();
      g.save(); rr(g, x, y, r.w, h, 34); g.clip(); t.draw(g, x, y, r.w, h, t.c, t.id === 'b' ? covers : t.id === 'c' ? flags : null); g.restore();
      x += r.w + gap;
    });
    y += h + gap;
  });
  /* piede: nome e indirizzo dell'app (il link con l'invito va nel testo del messaggio) */
  g.fillStyle = '#FFFFFF'; g.font = '700 ' + (sq ? 32 : 40) + 'px ' + FD; g.fillText('Next Libris', M, H - foot + (sq ? 16 : 34));
  g.fillStyle = 'rgba(255,255,255,.75)'; g.font = '500 ' + (sq ? 26 : 32) + 'px ' + FB; g.textAlign = 'right'; g.fillText('nextlibris.github.io', W - M, H - foot + (sq ? 20 : 40)); g.textAlign = 'left';
  return cv;
}
function cardName(c, fmt) { return 'Next Libris - ' + c.title.replace(/[^\wÀ-ÿ ]+/g, '').trim() + (fmt === 'square' ? ' (quadrata)' : '') + '.png'; }
function saveBlob(blob, name) {
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  NL.toast('Immagine salvata nei Download.');
}
function sendBlob(c, fmt, blob) {
  var link = invite(), text = c.title + ' su Next Libris 📚 ' + (/amico=/.test(link) ? 'Aggiungimi tra gli amici: ' : 'È gratis: ') + link;
  var name = cardName(c, fmt), f = null;
  try { f = new File([blob], name, { type: 'image/png' }); } catch (e) { if (window.nlErr) nlErr(e); }
  if (f && navigator.canShare && navigator.canShare({ files: [f] })) return navigator.share({ files: [f], title: c.title, text: text }).catch(function () {});
  saveBlob(blob, name);
  return Promise.resolve();
}
function makeBlob(c, fmt) {
  return card(c, fmt).then(function (cv) { return new Promise(function (res) { try { cv.toBlob(res, 'image/png'); } catch (e) { if (window.nlErr) nlErr(e); res(null); } }); });
}
/* anteprima prima di condividere (Piero, 19/11/2026): finestra con l'immagine, Storia/Quadrata in alto, Condividi e Salva sotto */
var PV = null;
function pvClose(fromPop) {
  if (!PV) return;
  var el = PV.el; if (PV.url) URL.revokeObjectURL(PV.url);
  var pushed = PV.pushed; PV = null; el.remove();
  document.removeEventListener('keydown', pvKey, true);
  if (pushed && !fromPop) { try { history.back(); } catch (e) {} }
}
function pvKey(e) { if (e.key === 'Escape' && PV) { e.stopPropagation(); e.preventDefault(); pvClose(); } }
function pvPop() { if (PV) pvClose(true); }
window.addEventListener('popstate', pvPop);
function pvShow(fmt) {
  if (!PV) return;
  PV.fmt = fmt; PV.blob = null;
  var el = PV.el, box = el.querySelector('.wp-img');
  el.querySelectorAll('[data-pv="fmt"]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.f === fmt ? 'true' : 'false'); });
  el.querySelectorAll('[data-pv="send"],[data-pv="save"]').forEach(function (b) { b.disabled = true; });
  box.className = 'wp-img ' + fmt; box.innerHTML = '<span class="wp-wait">Preparo l\'immagine…</span>';
  var my = PV;
  makeBlob(PV.c, fmt).then(function (blob) {
    if (PV !== my || PV.fmt !== fmt) return;
    if (!blob) { box.innerHTML = '<span class="wp-wait">Non riesco a preparare l\'immagine.</span>'; return; }
    if (PV.url) URL.revokeObjectURL(PV.url);
    PV.blob = blob; PV.url = URL.createObjectURL(blob);
    box.innerHTML = '<img src="' + PV.url + '" alt="Anteprima dell\'immagine da condividere">';
    el.querySelectorAll('[data-pv="send"],[data-pv="save"]').forEach(function (b) { b.disabled = false; });
  });
}
function shareCard(c, fmt) {
  if (PV) pvClose();
  var el = document.createElement('div'); el.className = 'wp-ov'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Anteprima: ' + c.title);
  el.innerHTML = '<div class="wp-top"><button type="button" class="wp-x" data-pv="close" aria-label="Indietro">‹</button><b>' + NL.esc(c.title) + '</b><button type="button" class="wp-x" data-pv="close" aria-label="Chiudi">×</button></div>' +
    '<div class="wp-fmt"><button type="button" class="btn sm" data-pv="fmt" data-f="story">Storia</button><button type="button" class="btn sm" data-pv="fmt" data-f="square">Quadrata</button></div>' +
    '<div class="wp-img"></div>' +
    '<div class="wp-acts"><button type="button" class="btn primary" data-pv="send">Condividi</button><button type="button" class="btn" data-pv="save">Salva</button></div>';
  document.body.appendChild(el);
  PV = { el: el, c: c, fmt: fmt, pushed: false };
  try { history.pushState({ opt: 'wp' }, ''); PV.pushed = true; } catch (e) {}
  document.addEventListener('keydown', pvKey, true);
  el.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pv]'); if (!b || !PV) return;
    var a = b.dataset.pv;
    if (a === 'close') pvClose();
    else if (a === 'fmt' && b.dataset.f !== PV.fmt) pvShow(b.dataset.f);
    else if (a === 'send' && PV.blob) sendBlob(PV.c, PV.fmt, PV.blob);
    else if (a === 'save' && PV.blob) saveBlob(PV.blob, cardName(PV.c, PV.fmt));
  });
  pvShow(fmt);
  var f0 = el.querySelector('[data-pv="close"]'); if (f0) f0.focus({ preventScroll: true });
}
function share(fmt) { return shareCard(cardFromWrap(W.data), fmt); }

/* ---------- invito in cima all'elenco, voce nel menu, opzione ---------- */
function askData(evenSeen) {
  if (!cfg.on || NL.tab() !== 'lib') return null;
  var now = Date.now(), cur = quarterOf(now), last = prevQ(cur);
  if (now - cur.s > ASK_DAYS * DAY || (!evenSeen && cfg.seen === last.key)) return null;
  var d = wrapData(NL.books(), NL.quotes(), last, now);
  return d.empty || (!d.n && d.added < 3) ? null : d;
}
function paintAsk() {
  var box = document.getElementById('wrapAsk');
  if (!box) {
    var anchor = document.getElementById('nxBox') || document.getElementById('donAsk') || document.getElementById('list');
    if (!anchor) return;
    box = document.createElement('section'); box.id = 'wrapAsk'; box.className = 'wrap-ask'; box.hidden = true;
    box.innerHTML = '<button type="button" class="wa-open" id="wrapAskGo"><span class="wa-ico" aria-hidden="true">✦</span><span><b id="wrapAskT"></b><small id="wrapAskS"></small></span><span class="wa-go">Guarda</span></button>' +
      '<button type="button" class="ico" id="wrapAskX" aria-label="Non ora">×</button>';
    anchor.parentNode.insertBefore(box, anchor);
    box.querySelector('#wrapAskGo').addEventListener('click', function () { open(); });
    box.querySelector('#wrapAskX').addEventListener('click', function () { cfg.seen = prevQ(quarterOf(Date.now())).key; save(); paintAsk(); NL.summary && NL.summary(); });
  }
  var d = askData();
  box.hidden = !d;
  if (!d) return;
  $('#wrapAskT').textContent = d.Q.title + ': è pronto';
  $('#wrapAskS').textContent = d.Q.label + (d.n ? ' · ' + d.n + (d.n === 1 ? ' libro letto' : ' libri letti') : ' · ' + d.added + ' libri nuovi');
}
function paintMenu() {
  var b = document.getElementById('goWrap');
  if (!b) {
    var st = document.getElementById('goStats'); if (!st) return;
    b = document.createElement('button'); b.type = 'button'; b.id = 'goWrap'; b.className = 'dopt dgo';
    b.innerHTML = '<span><b>La tua stagione in libri</b><small id="goWrapTxt"></small></span><span class="n" aria-hidden="true">›</span>';
    st.parentNode.insertBefore(b, st.nextSibling);
    b.addEventListener('click', function () { NL.fromMenu ? NL.fromMenu(function () { open(); }) : (NL.closeDrawer(), setTimeout(function () { open(); }, 60)); });
  }
  var list = cfg.on ? quarters() : [];
  b.hidden = !list.length;
  if (list.length) {
    var last = prevQ(quarterOf(Date.now())).key, d = list.filter(function (x) { return x.Q.key === last; })[0] || list[0];
    $('#goWrapTxt').textContent = 'Riepilogo · ' + d.Q.label + (d.ongoing ? ' (finora)' : '');
  }
}
function paintOption(sec) {
  if (sec !== 'look') return;
  var box = document.getElementById('optWrap');
  if (!box) {
    var lab = document.querySelector('#optSheet .opt-sec[data-sec="look"]'); if (!lab) return;   // in fondo ad Aspetto
    var l = document.createElement('label'); l.className = 'check';
    l.innerHTML = '<input type="checkbox" id="optWrap"><span>Riepilogo di ogni stagione<small>«La tua estate in libri», «Il tuo autunno in libri»…: cosa hai letto, i generi, gli autori, i libri nuovi. All\'inizio di ogni stagione compare l\'invito in cima all\'elenco; si apre anche dal menu.</small></span>';
    lab.appendChild(l);
    box = l.querySelector('input');
    box.addEventListener('change', function () { cfg.on = box.checked; save(); paintAsk(); paintMenu(); });
  }
  box.checked = cfg.on;
}
NL.on('list', paintAsk);
NL.on('menu', paintMenu);
NL.on('options', paintOption);
paintAsk();
window.NLWrap = { open: open, close: close, quarters: quarters, wrapData: wrapData, quarter: quarter, cfg: function () { return cfg; }, slides: slides, palette: palette, card: card, shareCard: shareCard, closePreview: function () { pvClose(); }, loved: loved, cardFromWrap: cardFromWrap };
})();
