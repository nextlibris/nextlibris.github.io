/* Next Libris · modulo «Leggilo gratis» (prova, 20/11/2026; scelte di Piero in claude/idee-dati-pubblici.md).
   I libri di pubblico dominio (autore morto da più di 70 anni) che si leggono gratis e senza registrarsi:
   - pagina del libro: riga «Leggilo gratis» (solo se il testo c'è davvero) che apre la finestra con le fonti;
   - Desideri: segno «Gratis» sulla copertina;
   - Per te: riga «Classici da leggere gratis» (i tuoi libri e Desideri, poi altre opere gratuite dei tuoi autori);
   - libri degli amici: la stessa riga nella pagina del libro.
   Fonti controllate: Wikidata (morte dell'autore, opere, Gutenberg, LibriVox), Wikisource (in italiano e nella lingua dell'autore),
   Open Library (solo testi liberi, niente prestito); «Altre fonti» precise (Piero, 21/11/2026): Liber Liber (l'opera dalla sua ricerca,
   altrimenti la pagina dell'autore da Wikidata P7208), MLOL (risorse ad accesso libero dell'autore, Wikidata P3762).
   Rai Radio3 «Ad alta voce»: l'elenco degli audiolibri di RaiPlay Sound (una volta ogni 30 giorni) e l'autore dalla scheda
   dell'audiolibro; vale anche per i libri moderni («Ascoltalo gratis»). Niente Google. Dati SOLO SUL TELEFONO (catalogo-libri-gratis).
   PER TOGLIERLO: cancellare gratis.js e gratis.css, le due righe in index.html, le due in SHELL di sw.js e la voce in MODULES
   di pubblica_prova.py. Non tocca il database né gli altri file. */
(function () {
'use strict';
var NL = window.NL;
if (!NL) return;
var esc = NL.esc, L = NL.L;
var LS = 'catalogo-libri-gratis', V = 2, DAY = 864e5, RETRY = 30 * DAY;
var PD_Y = new Date().getFullYear() - 71;   // morto entro quell'anno: pubblico dominio in Italia (70 anni dal 1° gennaio dopo la morte)
var WD = 'https://query.wikidata.org/sparql?format=json&query=';
var LANG = { it: 'italiano', en: 'inglese', fr: 'francese', de: 'tedesco', es: 'spagnolo', pt: 'portoghese', ru: 'russo', la: 'latino', el: 'greco', grc: 'greco antico', pl: 'polacco', nl: 'olandese', sv: 'svedese', da: 'danese', no: 'norvegese', cs: 'ceco', hu: 'ungherese' };
var I = {
  book: '<path d="M12 6.5C10.3 5.2 7.8 4.5 4 4.5v13c3.8 0 6.3.7 8 2 1.7-1.3 4.2-2 8-2v-13c-3.8 0-6.3.7-8 2z"/><path d="M12 6.5v13"/>',
  ear: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3.5" y="14" width="4" height="6" rx="1.5"/><rect x="16.5" y="14" width="4" height="6" rx="1.5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  heart: '<path d="M12 20s-7-4-7-9.2A3.8 3.8 0 0 1 12 8.6a3.8 3.8 0 0 1 7 2.2C19 16 12 20 12 20z"/>'
};
function svg(p, s) { return '<svg viewBox="0 0 24 24" width="' + (s || 20) + '" height="' + (s || 20) + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; }

/* ---------- dati sul telefono ---------- */
var db = null;
function load() {
  if (db) return db;
  try { db = JSON.parse(NL.ls.get(LS) || 'null'); } catch (e) { db = null; }
  if (!db || db.v !== V || typeof db.a !== 'object') db = { v: V, a: {} };
  if (!db.ll || typeof db.ll !== 'object') db.ll = {};   // Liber Liber: opera trovata per libro { u, t }
  if (!db.ra || typeof db.ra !== 'object') db.ra = {};   // «Ad alta voce»: autore di ogni audiolibro trovato
  return db;
}
function save() { try { NL.ls.set(LS, JSON.stringify(load())); } catch (e) { /* telefono pieno: si ricerca alla prossima */ } }
function akey(n) { return typeof window.wdKey === 'function' ? window.wdKey(n) : L.norm(n); }
function aget(n) { return load().a[akey(n)] || null; }
function aqid(n) { try { var e = typeof window.wdEntry === 'function' ? window.wdEntry(n) : null; return e && e.q ? e.q : ''; } catch (e) { return ''; } }
function authors(b) { return (NL.authorsOf(b) || []).slice(0, 2); }

/* ---------- titoli: «I Malavoglia» = «I Malavoglia (Verga)» = «Opera:I Malavoglia» ---------- */
var ART = /^(il|lo|la|i|gli|le|l|un|uno|una|the|a|an|der|die|das|les|el|los|las) (?=\S)/;   // articolo iniziale: «Malavoglia» = «I Malavoglia» (Piero, 21/11/2026)
function tk(s) { var t = L.norm(String(s || '').replace(/^opera:/i, '').replace(/\([^)]*\)/g, ' ')).replace(/[^a-z0-9]+/g, ' ').trim(); return t.replace(ART, '') || t; }
function same(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  var s = a.length < b.length ? a : b, l = a.length < b.length ? b : a;
  return s.length >= 6 && l.indexOf(s + ' ') === 0;   // un sottotitolo in più: «Il ritratto di Dorian Gray romanzo»
}
function findT(list, keys) { for (var i = 0; i < (list || []).length; i++) { var k = tk(list[i]); if (keys.some(function (x) { return same(x, k); })) return list[i]; } return ''; }

/* ---------- le ricerche (una volta per autore) ---------- */
async function getJson(u) {
  var c = new AbortController(), t = setTimeout(function () { c.abort(); }, 25000);
  try { var r = await fetch(u, { signal: c.signal }); if (!r.ok) { var e = new Error('http ' + r.status); e.status = r.status; throw e; } return await r.json(); }
  finally { clearTimeout(t); }
}
function rows(j) { return ((j && j.results && j.results.bindings) || []).map(function (r) { var o = {}; Object.keys(r).forEach(function (k) { o[k] = r[k].value; }); return o; }); }
/* 1) quando è morto: fino a 40 autori in una domanda sola */
async function deaths(list) {
  var j = await getJson(WD + encodeURIComponent('SELECT ?a ?d WHERE { VALUES ?a { ' + list.map(function (x) { return 'wd:' + x.q; }).join(' ') + ' } OPTIONAL { ?a wdt:P570 ?d. } }'));
  var by = {}; rows(j).forEach(function (r) { var q = r.a.split('/').pop(), y = parseInt(r.d || '', 10); if (!isNaN(y)) by[q] = by[q] == null ? y : Math.max(by[q], y); });   // anno, anche avanti Cristo (-399)
  var a = load().a, now = Date.now();
  list.forEach(function (x) { var d = by[x.q]; a[x.k] = { t: now, q: x.q, d: d == null ? null : d, pd: d != null && d <= PD_Y ? 1 : 0 }; });
  save();
}
/* 2) per gli autori di pubblico dominio: opere, Wikisource, Gutenberg, LibriVox, lingua; poi le pagine di Wikisource e Open Library */
function detailQuery(q) {
  return 'SELECT ?k ?v ?x WHERE { hint:Query hint:optimizer "None". ' +
    '{ BIND("l" AS ?k) wd:' + q + ' wdt:P1899 ?v. } UNION { BIND("g" AS ?k) wd:' + q + ' wdt:P1938 ?v. } ' +
    'UNION { BIND("b" AS ?k) wd:' + q + ' wdt:P7208 ?v. } UNION { BIND("m" AS ?k) wd:' + q + ' wdt:P3762 ?v. } ' +
    'UNION { BIND("c" AS ?k) wd:' + q + ' wdt:P103 ?lg. ?lg wdt:P424 ?v. } UNION { BIND("c" AS ?k) wd:' + q + ' wdt:P1412 ?lg. ?lg wdt:P424 ?v. } ' +
    'UNION { BIND("s" AS ?k) ?p schema:about wd:' + q + '; schema:isPartOf ?site. FILTER(CONTAINS(STR(?site), "wikisource")) BIND(STR(?p) AS ?v) } ' +
    'UNION { BIND("w" AS ?k) ?w wdt:P50 wd:' + q + '. ?w wikibase:sitelinks ?n. FILTER(?n > 2) ?w rdfs:label ?v. FILTER(LANG(?v) = "it") OPTIONAL { ?w wdt:P1476 ?x. } } ' +
    'UNION { BIND("e" AS ?k) ?w wdt:P50 wd:' + q + '. ?w wikibase:sitelinks ?n. FILTER(?n > 2) ?w rdfs:label ?v. FILTER(LANG(?v) = "it") ?w wdt:P2034 ?x. } } LIMIT 3000';
}
function wsTitle(u) { try { return decodeURIComponent(String(u).split('/wiki/')[1] || ''); } catch (e) { return ''; } }
async function wsLinks(code, page) {
  var j = await getJson('https://' + code + '.wikisource.org/w/api.php?action=query&format=json&origin=*&prop=links&pllimit=500&plnamespace=0|112&titles=' + encodeURIComponent(page));
  var out = []; Object.keys((j.query && j.query.pages) || {}).forEach(function (k) { (j.query.pages[k].links || []).forEach(function (x) { out.push(x.title); }); });
  return out.slice(0, 500);
}
async function details(n, x) {
  var r = rows(await getJson(WD + encodeURIComponent(detailQuery(x.q)))), ws = {}, langs = [], works = {}, gut = {};
  r.forEach(function (o) {
    if (o.k === 'l') x.lv = o.v;
    else if (o.k === 'g') x.gu = o.v;
    else if (o.k === 'b') x.lb = o.v;   // Liber Liber: «p/luigi-pirandello»
    else if (o.k === 'm') { var m0 = parseInt(o.v, 10); if (m0 > 0 && (!x.ml || m0 < x.ml)) x.ml = m0; }   // MLOL: il codice più vecchio
    else if (o.k === 'c' && langs.indexOf(o.v) < 0) langs.push(o.v);
    else if (o.k === 's') { var m = /^https:\/\/([a-z-]+)\.wikisource\.org\//.exec(o.v); if (m) ws[m[1]] = wsTitle(o.v); }
    else if (o.k === 'w') { var w = works[o.v] || (works[o.v] = { t: o.v, o: '' }); if (o.x && !w.o) w.o = o.x; }
    else if (o.k === 'e') gut[o.v] = o.x;
  });
  x.lg = langs.indexOf('it') >= 0 || !langs.length ? 'it' : langs[0];   // la lingua in cui scriveva (madrelingua, poi lingue scritte)
  x.w = Object.keys(works).slice(0, 200).map(function (k) { var w = works[k]; return [w.t, w.o && tk(w.o) !== tk(w.t) ? w.o : '', gut[k] || '']; });
  if (ws.it) { x.si = ws.it; x.ti = await wsLinks('it', ws.it); }
  if (x.lg !== 'it' && ws[x.lg]) { x.so = ws[x.lg]; x.to = await wsLinks(x.lg, ws[x.lg]); }
  try {   // Open Library: solo i testi liberi (ebook_access=public), niente prestito
    var ol = await getJson('https://openlibrary.org/search.json?ebook_access=public&fields=key,title,language&limit=100&author=' + encodeURIComponent(n));
    x.ol = (ol.docs || []).slice(0, 100).map(function (d) { return [d.title, d.key, (d.language || []).indexOf('ita') >= 0 ? 1 : 0]; });
  } catch (e) { x.ol = []; }
  x.ok = 1; x.t = Date.now();
}

/* ---------- Rai Radio3 «Ad alta voce» (RaiPlay Sound) ---------- */
var RAI = 'https://www.raiplaysound.it';
async function raiList() {
  var d = load(); if (d.r && Date.now() - d.r.t < RETRY) return;
  var j = await getJson(RAI + '/programmi/adaltavoce/audiolibri.json');
  var bl = Array.isArray(j.block) ? j.block : [j.block], l = [];
  bl.forEach(function (b) { ((b && b.cards) || []).forEach(function (c) { var p = c.path_id || c.weblink || ''; if (c.title && /^\/audiolibri\//.test(p)) l.push([c.title, p.replace(/\.json$/, '')]); }); });
  d.r = { t: Date.now(), l: l.slice(0, 1000) }; save();
}
function raiFind(b) { var k = tk(b.t), r = load().r; return r ? (r.l || []).filter(function (x) { return same(tk(x[0]), k); })[0] || null : null; }
function sur(n) { var w = tk(n).split(' '); return w[w.length - 1] || ''; }
function lev1(a, b) {   // una lettera diversa, in più, in meno o due scambiate: «Dostoevskij» = «Dostoevskiy» = «Dostoevskji»
  if (a === b) return true; if (Math.abs(a.length - b.length) > 1) return false;
  var i = 0; while (i < a.length && a[i] === b[i]) i++;
  return a.slice(i + 1) === b.slice(i + 1) || a.slice(i) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i) || (a.slice(i + 2) === b.slice(i + 2) && a[i] === b[i + 1] && a[i + 1] === b[i]);   // anche due lettere scambiate
}
function raiOk(b, x) {   // l'autore della scheda contiene il cognome, anche scritto un po' diverso (traslitterazioni)
  var a = load().ra[x[1]]; if (typeof a !== 'string') return false; var ws = tk(a).split(' ');
  return authors(b).some(function (n) { var s = sur(n); return s.length > 2 && ws.some(function (w) { return w === s || (s.length >= 5 && lev1(w, s)); }); });
}
async function raiAuthors(all) {   // per i titoli che combaciano: l'autore dalla scheda dell'audiolibro (una volta)
  var d = load(), n = 0;
  for (var i = 0; i < all.length && n < 10; i++) {
    var x = raiFind(all[i]); if (!x || typeof d.ra[x[1]] === 'string') continue;
    n++;
    var j = await getJson(RAI + x[1] + '.json'); d.ra[x[1]] = String((j.podcast_info && j.podcast_info.author) || '').replace(/^di\s+/i, ''); save();
  }
  return n;
}
/* ---------- Liber Liber: l'opera precisa, cercata quando si apre la finestra ---------- */
function slug(s) { return tk(s).replace(/ /g, '-'); }
function llAuthor(n, x) { return x && x.lb ? 'https://liberliber.it/autori/autori-' + x.lb.replace(/^\/+|\/+$/g, '') + '/' : ''; }
function llKey(b) { return tk(b.t) + '|' + tk(b.a); }
async function llFind(b) {
  var d = load(), k = llKey(b), c = d.ll[k]; if (c && Date.now() - c.t < RETRY) return false;
  var j = await getJson('https://liberliber.it/wp-json/wp/v2/search?subtype=page&per_page=20&search=' + encodeURIComponent(b.t));
  var ns = authors(b).map(function (n) { var x = aget(n); return x && x.lb ? '/autori-' + x.lb.replace(/^\/+|\/+$/g, '') + '/' : '/' + slug(n) + '/'; });
  var hit = (Array.isArray(j) ? j : []).filter(function (r) { var u = String(r.url || ''); return same(tk(String(r.title || '').replace(/&#\d+;/g, ' ')), tk(b.t)) && ns.some(function (s) { return u.indexOf(s) >= 0; }); })[0];
  d.ll[k] = { u: hit ? String(hit.url) : '', t: Date.now() }; save();
  return true;
}

var busy = false, timer = 0, later = {};
function want() {
  var seen = {}, out = [];
  var all = [].concat(NL.books() || [], (NL.myBooks && NL.myBooks()) || []);
  all.forEach(function (b) { authors(b).forEach(function (n) { var k = akey(n); if (seen[k]) return; seen[k] = 1; out.push({ n: n, k: k }); }); });
  return out;
}
function kick(ms) { if (busy || timer) return; timer = setTimeout(function () { timer = 0; loop(); }, ms == null ? 4000 : ms); }
async function loop() {
  if (busy || navigator.onLine === false || (NL.esempio && NL.esempio())) return;
  busy = true;
  var changed = false;
  try {
    var a = load().a, now = Date.now(), list = want();
    var todo = list.filter(function (x) { var e = a[x.k]; return (!e || now - e.t > RETRY) && !(later[x.k] > now); })
      .map(function (x) { x.q = aqid(x.n); return x; }).filter(function (x) { return x.q; });
    for (var i = 0; i < todo.length; i += 40) {
      try { await deaths(todo.slice(i, i + 40)); changed = true; }
      catch (e) { todo.slice(i, i + 40).forEach(function (x) { later[x.k] = Date.now() + 5 * 60000; }); break; }
    }
    try { var all = [].concat(NL.books() || [], (NL.myBooks && NL.myBooks()) || []); if (all.length && !(later.rai > Date.now())) { await raiList(); if (await raiAuthors(all)) changed = true; } }
    catch (e) { later.rai = Date.now() + 5 * 60000; }
    for (var g = 0; g < 60; g++) {
      a = load().a;
      var next = list.filter(function (x) { var e = a[x.k]; return e && e.pd && !e.ok && !(later[x.k] > Date.now()); })[0];
      if (!next) break;
      try { await details(next.n, a[next.k]); save(); changed = true; paint(); }
      catch (e) { later[next.k] = Date.now() + 5 * 60000; }
      await new Promise(function (ok) { setTimeout(ok, 1500); });
    }
  } finally { busy = false; }
  if (changed) paint();
}

/* ---------- cosa si legge gratis di un libro ---------- */
function avail(b) {
  if (!b || !b.t) return null;
  var keys = [tk(b.t)], it = [], or = [], au = [], lg = 'it', any = false;
  authors(b).forEach(function (n) {
    var x = aget(n); if (!x || !x.pd || !x.ok) return;
    any = true;
    var w = (x.w || []).filter(function (w) { return same(tk(w[0]), keys[0]) || (w[1] && same(tk(w[1]), keys[0])); })[0];
    var ks = keys.concat(w && w[1] ? [tk(w[1])] : []);
    if (x.lg && x.lg !== 'it') lg = x.lg;
    var t = findT(x.ti, ks); if (t) it.push({ s: 'Wikisource', u: 'https://it.wikisource.org/wiki/' + encodeURIComponent(t.replace(/ /g, '_')), d: 'Leggi online; si scarica anche in ePub' });
    var o = x.so ? findT(x.to, ks) : ''; if (o) or.push({ s: 'Wikisource', u: 'https://' + x.lg + '.wikisource.org/wiki/' + encodeURIComponent(o.replace(/ /g, '_')), d: 'Leggi online; si scarica anche in ePub' });
    var ol = (x.ol || []).filter(function (r) { return ks.some(function (k) { return same(tk(r[0]), k); }); })[0];
    if (ol) (ol[2] ? it : or).push({ s: 'Open Library', u: 'https://openlibrary.org' + ol[1], d: ol[2] ? 'Copie digitalizzate da leggere online, anche in italiano' : 'Copie digitalizzate da leggere online' });
    if (w && w[2]) (x.lg === 'it' ? it : or).push({ s: 'Project Gutenberg', u: 'https://www.gutenberg.org/ebooks/' + encodeURIComponent(w[2]), d: 'Leggi online o scarica in ePub' });
    if (x.lv) au.push({ s: 'LibriVox', u: 'https://librivox.org/author/' + encodeURIComponent(x.lv), d: 'Audiolibri di ' + n + ', letti da volontari' });
  });
  var rx = raiFind(b), ra = rx && raiOk(b, rx) ? { s: 'Rai Radio3 «Ad alta voce»', u: RAI + rx[1], d: 'Letto da attori, su RaiPlay Sound' } : null;
  if (any && (it.length || or.length)) return { it: it, or: lg === 'it' ? [] : or, au: (ra ? [ra] : []).concat(au), lg: lg, pd: 1 };
  return ra ? { it: [], or: [], au: [ra], lg: lg, pd: 0 } : null;   // anche i libri moderni: si ascoltano gratis (Piero, 21/11/2026)
}
function srcNames(v) { var s = []; (v.pd ? v.it.concat(v.or) : v.au).forEach(function (x) { if (s.indexOf(x.s) < 0) s.push(x.s); }); return s.join(', '); }

/* ---------- la finestra «Leggilo gratis» ---------- */
var sheet = null, pushed = false;
function build() {
  if (sheet) return sheet;
  sheet = document.createElement('div'); sheet.className = 'sheet gr-sheet'; sheet.id = 'grSheet'; sheet.hidden = true;
  sheet.innerHTML = '<div class="sheet-in" role="dialog" aria-modal="true" aria-labelledby="grH"><h2 id="grH">Leggilo gratis</h2><div id="grBody"></div>' +
    '<div class="row-btns"><button type="button" class="btn" data-close data-gr-x>Chiudi</button></div></div>';
  document.body.appendChild(sheet);
  sheet.addEventListener('click', function (e) {
    if (e.target === sheet || e.target.closest('[data-gr-x]')) { close(); return; }
    var bk = e.target.closest('[data-gr-b]'); if (bk) { openBook(bk.dataset.grB); return; }
    var wi = e.target.closest('[data-gr-w]'); if (wi) { addWish(wi); return; }
  });
  return sheet;
}
function row(x, ico) {
  return '<a class="dopt gr-a" href="' + esc(x.u) + '" target="_blank" rel="noopener"><span class="dico">' + svg(ico) + '</span><span><b>' + esc(x.s) + '</b><small>' + esc(x.d) + '</small></span><span class="n" aria-hidden="true">›</span></a>';
}
function sec(t, html) { return html ? '<p class="gr-lab">' + esc(t) + '</p><div class="dlist dmenu gr-list">' + html + '</div>' : ''; }
function also(b) {   // solo link precisi: l'opera, altrimenti la pagina dell'autore; niente pagine iniziali generiche
  var out = [], c = load().ll[llKey(b)];
  authors(b).forEach(function (n, i) {
    var x = aget(n); if (!x || !x.pd || !x.ok) return;
    if (i === 0 && c && c.u) out.push({ s: 'Liber Liber', u: c.u, d: 'Quest\'opera in ePub, PDF e a volte audiolibro' });
    else if (x.lb) out.push({ s: 'Liber Liber', u: llAuthor(n, x), d: 'Altre opere di ' + n + ' in ePub' });
    if (x.ml) out.push({ s: 'MLOL', u: 'https://biblioteche.medialibrary.it/search?idcrea=' + x.ml + '&c=open', d: 'Libri e audiolibri gratuiti di ' + n });
  });
  var seen = {}; return out.filter(function (x) { if (seen[x.u]) return false; seen[x.u] = 1; return true; }).map(function (x) { return row(x, I.book); }).join('');
}
var cur = null;   // libro della finestra aperta
function openFor(id) {
  var b = NL.get(id) || (NL.books() || []).filter(function (x) { return x.id === id; })[0], v = avail(b); if (!v) return;
  build();
  var ln = LANG[v.lg] || v.lg;
  cur = b;
  $('#grH').textContent = v.pd ? 'Leggilo gratis' : 'Ascoltalo gratis';
  $('#grBody').innerHTML = (v.pd ? '<p class="gr-lead">«' + esc(b.t) + '» è di pubblico dominio: si legge gratis, senza registrarti.</p>' : '<p class="gr-lead">«' + esc(b.t) + '» si ascolta gratis: letto da attori per Rai Radio3.</p>') +
    sec('In italiano', v.it.map(function (x) { return row(x, I.book); }).join('')) +
    sec('In ' + ln + ', la lingua originale', v.or.map(function (x) { return row(x, I.book); }).join('')) +
    sec('Da ascoltare', v.au.map(function (x) { return row(x, I.ear); }).join('')) +
    (v.pd ? sec('Altre fonti', also(b)) : '') +
    '<p class="au-src">' + (v.pd ? 'Da Wikidata, Wikisource, Open Library, Liber Liber e MLOL.' : 'Da RaiPlay Sound.') + '</p>';
  show();
  if (v.pd && !(later.ll > Date.now())) llFind(b).then(function (ch) { if (ch && cur === b && sheet && !sheet.hidden) openFor(b.id); }).catch(function () { later.ll = Date.now() + 5 * 60000; });
}
function show() {
  sheet.hidden = false;
  var si = sheet.querySelector('.sheet-in'); if (si) si.scrollTop = 0;
  if (!pushed) { try { history.pushState({ gr: 1 }, ''); pushed = true; } catch (e) { /* niente Indietro */ } }
}
function close(fromBack) {
  if (!sheet || sheet.hidden) return;
  cur = null;
  sheet.hidden = true;
  if (pushed && !fromBack) { pushed = false; try { history.back(); } catch (e) { /* già tornato */ } }
  pushed = false;
}
window.addEventListener('popstate', function () { if (sheet && !sheet.hidden) { pushed = false; close(true); } });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheet && !sheet.hidden) { e.stopImmediatePropagation(); close(); } }, true);
function $(s) { return document.querySelector(s); }

/* ---------- «Classici da leggere gratis» (Per te) ---------- */
function mineFree() { return (NL.myBooks ? NL.myBooks() : NL.books()).filter(function (b) { var v = !b.xs && avail(b); return v && v.pd; }); }
function otherWorks() {
  var mine = (NL.myBooks ? NL.myBooks() : NL.books()), have = mine.map(function (b) { return tk(b.t); }), out = [], seen = {};
  mine.forEach(function (b) {
    authors(b).forEach(function (n) {
      var x = aget(n), k = akey(n); if (!x || !x.pd || !x.ok || seen[k]) return; seen[k] = 1;
      var c = 0;
      (x.w || []).forEach(function (w) {
        if (c >= 6) return;
        var t = findT(x.ti, [tk(w[0])]); if (!t || have.some(function (h) { return same(h, tk(w[0])); })) return;
        c++; out.push({ t: w[0], a: n, u: 'https://it.wikisource.org/wiki/' + encodeURIComponent(t.replace(/ /g, '_')) });
      });
    });
  });
  return out.slice(0, 40);
}
function openAll() {
  build();
  var my = mineFree(), ot = otherWorks();
  var cov = function (b) { var img = NL.bigImg(b); return img ? '<span class="gr-cov"><img src="' + esc(img) + '" alt="" loading="lazy" referrerpolicy="no-referrer"></span>' : '<span class="gr-cov gr-ph" style="--h:' + NL.hue(b.t + b.a) + '" aria-hidden="true">' + esc(L.str(b.t).charAt(0).toUpperCase()) + '</span>'; };
  $('#grBody').innerHTML = (my.length || ot.length ? '<p class="gr-lead">Classici di pubblico dominio: si leggono gratis, senza registrarti.</p>' : '<p class="gr-lead">Per ora nessun libro gratis tra i tuoi. Arrivano quando nella tua libreria ci sono autori di più di 70 anni fa.</p>') +
    sec('Dai tuoi libri e Desideri', my.map(function (b) { var v = avail(b); return '<button type="button" class="dopt gr-bk" data-gr-b="' + esc(b.id) + '">' + cov(b) + '<span><b>' + esc(b.t) + '</b><small>' + esc((b.a ? b.a + ' · ' : '') + srcNames(v)) + '</small></span><span class="n" aria-hidden="true">›</span></button>'; }).join('')) +
    sec('Altre opere dei tuoi autori', ot.map(function (o) {
      return '<div class="dopt gr-ot"><a class="gr-otl" href="' + esc(o.u) + '" target="_blank" rel="noopener"><span class="dico">' + svg(I.book) + '</span><span><b>' + esc(o.t) + '</b><small>' + esc(o.a) + ' · Wikisource</small></span></a>' +
        '<button type="button" class="gr-wish" data-gr-w data-t="' + esc(o.t) + '" data-a="' + esc(o.a) + '" aria-label="Aggiungi «' + esc(o.t) + '» ai Desideri">' + svg(I.heart, 18) + '</button></div>';
    }).join('')) +
    '<p class="au-src">Da Wikidata, Wikisource e Open Library, banche dati libere.</p>';
  $('#grH').textContent = 'Classici da leggere gratis';
  show();
}
function openBook(id) { build(); openFor(id); }
function addWish(btn) {
  if (btn.disabled) return;
  if (NL.addMine) NL.addMine({ t: btn.dataset.t, a: btn.dataset.a, w: true });
  btn.disabled = true; btn.classList.add('on'); btn.setAttribute('aria-label', 'Nei Desideri');
  if (NL.toast) NL.toast('«' + btn.dataset.t + '» è nei Desideri');
}

/* ---------- dove si vede ---------- */
function pageRow(card) {
  var id = card.dataset.id, b = NL.get(id) || (NL.books() || []).filter(function (x) { return x.id === id; })[0], page = card.querySelector('.cv-page');
  if (!page) return;
  var old = page.querySelector('.gr-row'), v = avail(b);
  if (!v) { if (old) old.remove(); return; }
  var h = '<span class="dico">' + svg(v.pd ? I.book : I.ear) + '</span><span><b>' + (v.pd ? 'Leggilo gratis' : 'Ascoltalo gratis') + '</b><small>' + (v.pd ? 'È di pubblico dominio · ' + esc(srcNames(v)) : 'Rai Radio3 «Ad alta voce»') + '</small></span><span class="n" aria-hidden="true">›</span>';
  if (old) { if (old.dataset.h !== h) { old.innerHTML = h; old.dataset.h = h; } return; }
  var r = document.createElement('button'); r.type = 'button'; r.className = 'gr-row'; r.dataset.grB = id; r.innerHTML = h; r.dataset.h = h;
  r.addEventListener('click', function (e) { e.stopPropagation(); openBook(id); });
  var at = page.querySelector('.cv-status') || page.querySelector('.acts-main') || page.querySelector('.cv-hero');
  page.insertBefore(r, at ? at.nextSibling : page.firstChild);
}
function pages() { Array.prototype.forEach.call(document.querySelectorAll('.row.open .cv-page'), function (p) { var c = p.closest('.row'); if (c) pageRow(c); }); }
function tags() {
  var wish = NL.tab && NL.tab() === 'wish' && !(NL.guest && NL.guest());
  Array.prototype.forEach.call(document.querySelectorAll('#list .cover[data-id] .art'), function (art) {
    var id = art.parentNode.dataset.id, v0 = wish && avail(NL.get(id)), on = v0 && v0.pd, t = art.querySelector('.gr-tag');
    if (on && !t) { t = document.createElement('span'); t.className = 'gr-tag'; t.innerHTML = svg(I.book, 12) + 'Gratis'; art.appendChild(t); }
    else if (!on && t) t.remove();
    art.classList.toggle('gr-on', !!on);
  });
}
function youRow() {
  var list = $('#layYouList'); if (!list || (NL.esempio && NL.esempio())) return;
  var n = mineFree().length, o = otherWorks().length, r = list.querySelector('.gr-you');
  if (!n && !o) { if (r) r.remove(); return; }
  if (!r) { r = document.createElement('button'); r.type = 'button'; r.className = 'dopt dgo lay-you gr-you'; list.appendChild(r); r.addEventListener('click', function (e) { e.stopPropagation(); openAll(); }); }
  r.innerHTML = '<span class="lay-yi">' + svg(I.book) + '</span><span><b>Classici da leggere gratis</b><small>' + esc([n ? (n === 1 ? '1 dei tuoi libri' : n + ' dei tuoi libri') : '', o ? (o === 1 ? '1 altra opera' : o + ' altre opere') : ''].filter(Boolean).join(' · ')) + '</small></span><span class="n" aria-hidden="true">›</span>';
}
var pt = 0;
function paint() { clearTimeout(pt); pt = setTimeout(function () { try { pages(); tags(); youRow(); } catch (e) { if (window.console) console.warn('gratis', e); } }, 120); }

NL.on('rows', function () { paint(); });
NL.on('list', function () { paint(); kick(); });
var list = document.getElementById('list');
if (list && window.MutationObserver) new MutationObserver(function () { paint(); }).observe(list, { childList: true, subtree: true });
var you = document.getElementById('layYou');
function watchYou() {
  you = document.getElementById('layYou'); if (!you) { setTimeout(watchYou, 1000); return; }
  new MutationObserver(function () { if (!you.hidden) youRow(); }).observe(you, { attributes: true, attributeFilter: ['hidden'] });
}
watchYou();
window.addEventListener('online', function () { later = {}; kick(2000); });
kick(6000);
window.NLGratis = { avail: avail, openFor: openFor, openAll: openAll, run: loop, data: load, PD_Y: PD_Y, free: function () { return { mine: mineFree(), other: otherWorks() }; } };   // free: per lo scaffale «Leggilo gratis» dei Suggerimenti   // per le prove
})();
