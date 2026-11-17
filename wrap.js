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
try { var c0 = JSON.parse(NL.ls.get(LS) || '{}'); cfg.on = c0.on !== false; cfg.seen = L.str(c0.seen).slice(0, 10); } catch (e) {}
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
  var lg = read.filter(pages).sort(function (x, y) { return pages(y) - pages(x); })[0];
  d.longest = lg ? { t: lg.t, a: lg.a, pg: pages(lg) } : null;
  var bs = read.filter(function (b) { return b.rt > 0; }).sort(function (x, y) { return y.rt - x.rt || (y.rd > x.rd ? 1 : -1); })[0];
  d.best = bs ? { t: bs.t, a: bs.a, rt: bs.rt } : null;
  d.value = added.reduce(function (a, b) { return a + (b.c || 0); }, 0);
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
  if (d.longest || d.best) {
    out.push({ cls: 'w-c4', html: (d.longest ? '<p class="w-kick">Il più lungo</p><p class="w-mid">«' + esc(d.longest.t) + '»</p><p class="w-sub">' + esc(d.longest.a) + ' · ' + nf.format(d.longest.pg) + ' pagine</p>' : '') +
      (d.best ? '<p class="w-kick w-gap">Quello che ti è piaciuto di più</p><p class="w-mid">«' + esc(d.best.t) + '»</p><p class="w-sub">' + esc(d.best.a) + '</p><p class="w-stars" aria-label="' + d.best.rt + ' stelle su 5">' + stars(d.best.rt) + '</p>' : '') });
  }
  if (d.added || d.quotes || d.loans) {
    out.push({ cls: 'w-c5', html: '<p class="w-kick">In libreria</p>' + (d.added ? '<p class="w-num w-num-s">' + d.added + '</p><p class="w-unit">' + (d.added === 1 ? 'libro nuovo' : 'libri nuovi') + (d.value ? ', ' + esc(NL.eur(d.value)) : '') + '</p>' : '') +
      '<ul class="w-facts">' + (d.wish ? '<li><b>' + d.wish + '</b> nei Desideri</li>' : '') + (d.loans ? '<li><b>' + d.loans + '</b> ' + (d.loans === 1 ? 'libro prestato' : 'libri prestati') + (d.lender ? ', soprattutto a ' + esc(d.lender.name) : '') + '</li>' : '') +
      (d.quotes ? '<li><b>' + d.quotes + '</b> ' + (d.quotes === 1 ? 'citazione salvata' : 'citazioni salvate') + '</li>' : '') + '</ul>' +
      (d.quote ? '<blockquote class="w-q">' + esc(d.quote.x) + '<cite>' + esc(d.quote.t) + '</cite></blockquote>' : '') });
  }
  out.push({ cls: 'w-c6', last: true, html: '<p class="w-kick">' + esc(Q.label) + (d.ongoing ? ' · finora' : '') + '</p><h2 class="w-big-t w-s">' + esc(Q.title) + '</h2>' +
    '<dl class="w-sum">' + (d.n ? '<div><dt>letti</dt><dd>' + d.n + '</dd></div>' : '') + (d.pages ? '<div><dt>pagine</dt><dd>' + nf.format(d.pages) + '</dd></div>' : '') +
    (d.added ? '<div><dt>nuovi</dt><dd>' + d.added + '</dd></div>' : '') + (d.quotes ? '<div><dt>citazioni</dt><dd>' + d.quotes + '</dd></div>' : '') + '</dl>' +
    (d.genres[0] ? '<p class="w-sub">Genere: <b>' + esc(d.genres[0].name) + '</b>' + (d.author ? ' · Autore: <b>' + esc(d.author.name) + '</b>' : '') + '</p>' : '') +
    '<div class="w-acts"><button type="button" class="w-btn w-pri" data-w="share">Condividi l\'immagine</button><button type="button" class="w-btn" data-w="again">Rivedi</button><button type="button" class="w-btn" data-w="close">Chiudi</button></div>' });
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
      else if (a === 'share') share();
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
  if (!W.pushed) { try { history.pushState({ wrap: 1 }, ''); W.pushed = true; } catch (e) {} }
  setTimeout(function () { try { W.el.querySelector('.w-x').focus({ preventScroll: true }); } catch (e) {} }, 30);
}
function close(fromPop) {
  if (!W.el || W.el.hidden) return;
  W.el.hidden = true; document.body.classList.remove('wrap-open');
  if (W.pushed) { W.pushed = false; if (!fromPop) { try { history.back(); } catch (e) {} } }
  try { if (W.back) W.back.focus({ preventScroll: true }); } catch (e) {}
}
window.addEventListener('popstate', function () { if (W.el && !W.el.hidden) { W.pushed = false; close(true); } });
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
function image(d) {
  var c = document.createElement('canvas'); c.width = 1080; c.height = 1350;
  var g = c.getContext('2d'), acc = baseColor(), font = cssVar('--font-display', 'sans-serif');
  g.fillStyle = acc; g.fillRect(0, 0, 1080, 1350);
  g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.arc(960, 160, 340, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.textBaseline = 'top';
  g.font = '500 40px ' + font; g.fillText(d.Q.label + (d.ongoing ? ' · finora' : ''), 90, 110);
  g.font = '700 92px ' + font;
  var words = d.Q.title.split(' '), line = '', y = 180;
  words.forEach(function (w) { var t = line ? line + ' ' + w : w; if (g.measureText(t).width > 900) { g.fillText(line, 90, y); y += 104; line = w; } else line = t; });
  g.fillText(line, 90, y); y += 170;
  [[d.n, d.n === 1 ? 'libro letto' : 'libri letti'], [d.pages, 'pagine'], [d.added, d.added === 1 ? 'libro nuovo' : 'libri nuovi'], [d.quotes, d.quotes === 1 ? 'citazione' : 'citazioni']]
    .filter(function (x) { return x[0]; }).slice(0, 4).forEach(function (x) {
      g.font = '700 120px ' + font; g.fillText(nf.format(x[0]), 90, y);
      var w = g.measureText(nf.format(x[0])).width; g.font = '500 44px ' + font; g.fillText(x[1], 90 + w + 28, y + 62); y += 160;
    });
  g.font = '500 40px ' + font;
  if (d.genres[0]) { g.fillText('Genere: ' + d.genres[0].name, 90, y + 10); y += 60; }
  if (d.author) g.fillText('Autore: ' + d.author.name, 90, y + 10);
  g.globalAlpha = .85; g.font = '600 38px ' + font; g.fillText('Next Libris', 90, 1240); g.globalAlpha = 1;
  return c;
}
function share() {
  var d = W.data, c = image(d), name = 'Next Libris - ' + d.Q.label.replace(/\s+–\s+/, '-') + '.png';
  c.toBlob(function (blob) {
    if (!blob) { NL.toast('Non riesco a preparare l\'immagine.'); return; }
    var f = null; try { f = new File([blob], name, { type: 'image/png' }); } catch (e) {}
    if (f && navigator.canShare && navigator.canShare({ files: [f] })) {
      navigator.share({ files: [f], title: d.Q.title }).catch(function () {});
    } else {
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      NL.toast('Immagine salvata nei Download.');
    }
  }, 'image/png');
}

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
    b.addEventListener('click', function () { NL.closeDrawer(); setTimeout(function () { open(); }, 60); });
  }
  var list = cfg.on ? quarters() : [];
  b.hidden = !list.length;
  if (list.length) {
    var last = prevQ(quarterOf(Date.now())).key, d = list.filter(function (x) { return x.Q.key === last; })[0] || list[0];
    $('#goWrapTxt').textContent = 'Riepilogo di ogni stagione · ' + d.Q.label + (d.ongoing ? ' (finora)' : '');
  }
}
function paintOption(sec) {
  if (sec !== 'look') return;
  var box = document.getElementById('optWrap');
  if (!box) {
    var lab = document.querySelector('#optSheet .sum-opts'); if (!lab) return;   // in Aspetto, subito dopo «Riepilogo in alto» (16/11/2026)
    var l = document.createElement('label'); l.className = 'check';
    l.innerHTML = '<input type="checkbox" id="optWrap"><span>Riepilogo di ogni stagione<small>«La tua estate in libri», «Il tuo autunno in libri»…: cosa hai letto, i generi, gli autori, i libri nuovi. All\'inizio di ogni stagione compare l\'invito in cima all\'elenco; si apre anche dal menu.</small></span>';
    lab.parentNode.insertBefore(l, lab.nextSibling);
    box = l.querySelector('input');
    box.addEventListener('change', function () { cfg.on = box.checked; save(); paintAsk(); paintMenu(); });
  }
  box.checked = cfg.on;
}
NL.on('list', paintAsk);
NL.on('closed', function (list) {            // invito chiuso con la × ma ancora nel suo mese: il triangolino del riepilogo lo riapre
  var d = askData(true);
  if (d && cfg.seen === d.Q.key) list.push({ k: 'wrap', reopen: function () { cfg.seen = ''; save(); paintAsk(); } });
});
NL.on('menu', paintMenu);
NL.on('options', paintOption);
paintAsk();
window.NLWrap = { open: open, close: close, quarters: quarters, wrapData: wrapData, quarter: quarter, cfg: function () { return cfg; }, image: image, slides: slides };
})();
