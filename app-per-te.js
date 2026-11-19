/* Next Libris · app, parte 5 di 10 (app-per-te.js): «Per te»: novità dei tuoi autori, Da scoprire, tutte le citazioni.
   Dal 17/11/2026 app.js è diviso in 10 file (prima era una sola funzione). Sono script classici, senza import:
   le funzioni e le variabili di primo livello sono globali e servono a tutte le parti; l'ordine in index.html
   e in SHELL di sw.js conta (app.js, app-aggiungi.js, …, app-avvio.js: l'ultima fa partire l'app). */
'use strict';
/* ---- novità dei tuoi autori: libri recenti che non hai, da mettere nei Desideri ---- */
var LS_NEWS = 'catalogo-libri-news', NEWS_EVERY = 14 * 86400000;
var news = { at: 0, items: [], hide: [], busy: false };
function loadNews() { try { var n = JSON.parse(ls.get(LS_NEWS) || '{}'); news.at = Number(n.at) || 0; news.items = Array.isArray(n.items) ? n.items.filter(function (x) { return x && x.t && x.k; }).slice(0, 80) : []; news.hide = Array.isArray(n.hide) ? n.hide.map(L.str).slice(-400) : []; } catch (e) { nlErr(e); } }
function saveNews() { ls.set(LS_NEWS, JSON.stringify({ at: news.at, items: news.items, hide: news.hide })); }
function newsAuthors() {
  var m = {};
  state.books.forEach(function (b) { if (b.w || b.g.indexOf('a') >= 0) return; authorsOf(b).forEach(function (n) { var k = L.norm(n); (m[k] || (m[k] = { name: n, n: 0 })).n++; }); });
  var all = Object.keys(m).map(function (k) { return m[k]; }).filter(function (x) { return !/^(aa\.? ?vv\.?|autori vari|anonimo)$/i.test(x.name); }).sort(function (x, y) { return y.n - x.n || coll.compare(x.name, y.name); });
  var many = all.filter(function (x) { return x.n >= 2; });
  return (many.length ? many.slice(0, 8) : all.slice(0, 5)).map(function (x) { return x.name; });
}
function newsOwn() {
  var own = { titles: {}, isbns: {}, hide: {} };
  state.books.forEach(function (b) { var k = L.titleKey(b.t); if (k) own.titles[k] = 1; var i = L.toIsbn13(b.i); if (i) own.isbns[i] = 1; });
  news.hide.forEach(function (k) { own.hide[k] = 1; });
  return own;
}
function newsFresh() { var own = newsOwn(); return news.items.filter(function (x) { return !own.titles[x.k] && !own.hide[x.k] && !(x.i && own.isbns[x.i]); }); }
async function findNews() {
  if (news.busy) return null;
  var authors = newsAuthors(), y = new Date().getFullYear(), own = newsOwn(), found = [], seen = {}, errs = 0, done = 0;
  if (!authors.length) return [];
  news.busy = true;
  try {
    /* giro 11B (Piero, 19/11/2026): gli autori a gruppi di 4 in una sola ricerca (inauthor:"A" OR inauthor:"B"…):
       al massimo 2 ricerche invece di 8. Ogni risultato torna al suo autore con pickNews. */
    var GRP = 4;
    for (var i = 0; i < authors.length; i += GRP) {
      if (!googleLeft(true)) break;
      var grp = authors.slice(i, i + GRP);
      try {
        var qq = grp.map(function (a) { return 'inauthor:"' + a.replace(/"/g, '') + '"'; }).join(' OR ');
        var j = await L.getJson(apiFetch, 'https://www.googleapis.com/books/v1/volumes?q=' + encodeURIComponent(qq) +
          '&orderBy=newest&langRestrict=it&printType=books&maxResults=40&fields=items(id,volumeInfo(title,subtitle,authors,publisher,publishedDate,language,industryIdentifiers,imageLinks))' +
          (settings.gbKey ? '&key=' + encodeURIComponent(settings.gbKey) : ''), { waits: [900], timeout: 9000 });
        grp.forEach(function (au) { L.pickNews(j, au, own, y - 1, y + 1).slice(0, 6).forEach(function (x) { if (!seen[x.k]) { seen[x.k] = 1; found.push(x); } }); });
        done++;
      } catch (e) { errs++; if (errs >= 2 && !done) break; }
      if (!$('#newsSheet').hidden) $('#newsMsg').textContent = 'Cerco… ' + Math.min(i + GRP, authors.length) + ' di ' + authors.length + ' autori';
    }
  } finally { news.busy = false; }
  if (!done) throw { net: true };
  news.items = found.slice(0, 80); news.at = Date.now(); saveNews();
  return found;
}
function renderNews(note) {
  var items = newsFresh(), authors = newsAuthors();
  $('#newsMsg').textContent = note || (!authors.length ? 'Aggiungi qualche libro con l\'autore: cerco le novità di quelli che hai di più.' :
    !news.at ? '' : items.length ? 'Usciti dal ' + (new Date().getFullYear() - 1) + ' in poi, di ' + authors.slice(0, 3).join(', ') + (authors.length > 3 ? ' e altri ' + (authors.length - 3) : '') + '. Ultimo controllo: ' + L.agoText(news.at) + '.' :
    'Nessuna novità che non hai già, tra gli autori che hai di più (' + authors.slice(0, 3).join(', ') + (authors.length > 3 ? '…' : '') + '). Ultimo controllo: ' + L.agoText(news.at) + '.');
  $('#newsList').innerHTML = items.map(function (x) {
    return '<li data-k="' + esc(x.k) + '">' + (x.img ? '<img src="' + esc(x.img) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<span class="nimg" aria-hidden="true"></span>') +
      '<div class="nt"><b>' + esc(x.t) + '</b><span>' + esc([x.a, x.e, x.y].filter(Boolean).join(' · ')) + '</span>' +
      '<div class="desc-acts"><button type="button" class="link" data-act="newswish">Metti nei Desideri</button><button type="button" class="link quiet" data-act="newshide">Non mi interessa</button></div></div></li>';
  }).join('');
  $('#newsAgain').disabled = news.busy || !authors.length;
}
async function runNews() {
  if (navigator.onLine === false) { renderNews('Sei offline. Riprova quando c\'è connessione.'); return; }
  if (!googleLeft(true)) { renderNews('Le ricerche di Google per oggi le tengo per i libri nuovi: riprova domani.'); return; }
  $('#newsAgain').disabled = true; $('#newsMsg').textContent = 'Cerco le novità…';
  try { await findNews(); renderNews(); }
  catch (e) { renderNews('Non sono riuscito a cercare (connessione o limite di Google' + (settings.gbKey ? '' : ': senza chiave capita spesso') + '). Riprova più tardi.'); }
}
function openNews() {
  $('#newsAuto').checked = settings.newsAuto !== false;
  $('#newsSheet').hidden = false;
  renderNews();
  if (!news.at && newsAuthors().length) runNews();
}
function newsPick(k, wish) {
  var x = news.items.find(function (n) { return n.k === k; });
  if (!x) return;
  if (wish) {
    var w = blankBook({ t: x.t, a: x.a, e: x.e, y: x.y, i: x.i || '', img: /^https:\/\//.test(x.img || '') ? x.img : '', w: true, rs: '' });
    state.books.push(w); touch(); renderList(); updateSummary();
    toast('Nei Desideri: ' + x.t, { label: 'Annulla', fn: function () { state.books = state.books.filter(function (b) { return b.id !== w.id; }); touch(); renderList(); updateSummary(); if (!$('#newsSheet').hidden) renderNews(); } });
  } else { news.hide.push(k); saveNews(); }
  renderNews();
}
function autoNews() {
  if (settings.newsAuto === false || !settings.gbKey || navigator.onLine === false || Date.now() - news.at < NEWS_EVERY || !newsAuthors().length || !googleLeft(true)) return;
  var before = {}; newsFresh().forEach(function (x) { before[x.k] = 1; });
  findNews().then(function () {
    var fresh = newsFresh().filter(function (x) { return !before[x.k]; });
    if (fresh.length && $('#newsSheet').hidden) toast(fresh.length === 1 ? 'È uscito un libro di ' + fresh[0].by + ' che non hai.' : fresh.length + ' novità dei tuoi autori.', { label: 'Vedi', fn: openNews });
  }, function () {});
}
/* ---- Suggerimenti: «Cosa leggere dopo» (dai tuoi «da leggere», senza rete) e «Da scoprire» (libri che non hai:
   altri dei tuoi autori, novità dei tuoi generi, volumi che mancano alle tue serie). Da scoprire cerca da solo una volta a settimana. ---- */
var LS_SUGG = 'catalogo-libri-sugg', SUGG_EVERY = 7 * 864e5, SUGG_RETRY = 864e5;
var sugg = { at: 0, tried: 0, items: [], hide: [], busy: false }, sgTab = 'next', nxIdx = 0, nxBoxIdx = 0;
function loadSugg() { try { var n = JSON.parse(ls.get(LS_SUGG) || '{}'); sugg.at = Number(n.at) || 0; sugg.tried = Number(n.tried) || 0; sugg.items = Array.isArray(n.items) ? n.items.filter(function (x) { return x && x.t && x.k; }).slice(0, 60) : []; sugg.hide = Array.isArray(n.hide) ? n.hide.map(L.str).slice(-400) : []; } catch (e) { nlErr(e); } }
function saveSugg() { ls.set(LS_SUGG, JSON.stringify({ at: sugg.at, tried: sugg.tried, items: sugg.items, hide: sugg.hide })); }
function nextList() { return L.nextReads(state.books, Date.now()); }
function nxCardHTML(r, small) {
  var b = get(r.id); if (!b) return '';
  var img = bigImg(b), why = small ? r.why.slice(0, 1) : r.why.slice(0, 3);
  return '<div class="nx-card" data-id="' + b.id + '">' + (img ? '<img src="' + esc(img) + '" alt="" referrerpolicy="no-referrer">' :
      '<span class="nimg ph" style="--h:' + hue(b.t + b.a + b.i) + '" aria-hidden="true"></span>') +
    '<div class="nt"><b>' + esc(b.t || 'Senza titolo') + '</b><span>' + esc([b.a, b.pg ? b.pg + ' pagine' : ''].filter(Boolean).join(' · ')) + '</span>' +
    '<ul class="nx-why">' + why.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul></div></div>';
}
function renderNext() {
  var list = nextList(), card = $('#sgNextCard');
  if (!list.length) {
    var inRead = state.books.filter(function (b) { return !b.w && b.rs === 'in'; }).length;
    $('#sgNextMsg').textContent = 'Non hai libri segnati «da leggere»' + (inRead ? ' (ne stai leggendo ' + (inRead === 1 ? 'uno' : inRead) + ')' : '') + '. Guarda in «Da scoprire» qualcosa di nuovo.';
    card.innerHTML = ''; return;
  }
  nxIdx = ((nxIdx % list.length) + list.length) % list.length;
  $('#sgNextMsg').textContent = list.length === 1 ? 'Hai un solo libro da leggere:' : 'Tra i tuoi ' + list.length + ' libri da leggere ti propongo questo (' + (nxIdx + 1) + ' di ' + list.length + '):';
  card.innerHTML = nxCardHTML(list[nxIdx]) + '<div class="row-btns nx-btns"><button class="btn primary" type="button" data-act="nxstart" data-id="' + list[nxIdx].id + '">Inizio questo</button>' +
    (list.length > 1 ? '<button class="btn" type="button" data-act="nxother">Un altro</button>' : '') + '</div>';
}
function startReading(id, after) {
  var b = get(id); if (!b) return;
  var was = b.rs;
  b.rs = 'in'; touch(); renderList(); updateSummary();
  toast('Buona lettura! «' + (b.t || 'Senza titolo') + '» è in lettura.', { label: 'Annulla', fn: function () { b.rs = was; touch(); renderList(); updateSummary(); if (!$('#suggSheet').hidden) renderSugg(); } });
  if (after) after();
}
/* --- Da scoprire --- */
function suggUnit(b) { var k = L.serKey(b.se); return k ? 'se:' + k : 'b:' + b.id; }   // una serie o collana conta come un libro solo
function suggAuthors() {
  var m = {};
  state.books.forEach(function (b) {
    if (b.w || b.g.indexOf('a') >= 0) return;
    var u = suggUnit(b);
    authorsOf(b).forEach(function (n) {
      var k = L.norm(n), x = m[k] || (m[k] = { name: n, n: 0, r: 0, books: 0, seen: {}, liked: {} });
      x.books++;                                                     // i libri veri (per il testo); n = unita' (per la classifica)
      if (!x.seen[u]) { x.seen[u] = 1; x.n++; }
      if (b.rt >= 4 && !x.liked[u]) { x.liked[u] = 1; x.r++; }
    });
  });
  return Object.keys(m).map(function (k) { return m[k]; }).filter(function (x) { return x.n >= 2 && !/^(aa\.? ?vv\.?|autori vari|anonimo)$/i.test(x.name); })
    .sort(function (x, y) { return (y.n + 2 * y.r) - (x.n + 2 * x.r) || coll.compare(x.name, y.name); }).slice(0, 4);
}
function suggGenres() {
  var m = {};
  state.books.forEach(function (b) {
    if (b.w) return; var g = L.str(b.gen).trim(); if (!g) return;
    var k = L.norm(g), x = m[k] || (m[k] = { name: g, n: 0, books: 0, seen: {} }), u = suggUnit(b);
    x.books++;
    if (!x.seen[u]) { x.seen[u] = 1; x.n++; }                // una collana di 30 volumi conta come un libro
  });
  return Object.keys(m).map(function (k) { return m[k]; }).filter(function (x) { return x.n >= 3; }).sort(function (x, y) { return y.n - x.n; }).slice(0, 2);
}
function suggSeries() {                       // volumi che mancano alle tue serie: si sa gia' quali sono, senza cercare
  var m = L.seriesInfo(state.books), out = [];
  Object.keys(m).forEach(function (k) {
    var s = m[k]; if (!s.n || !s.toAdd.length) return;
    s.toAdd.slice(0, 2).forEach(function (n) {
      out.push({ k: 'se:' + k + ':' + n, t: s.name + ', vol. ' + n, a: s.author, se: s.name, sn: String(n), sq: s.total ? String(s.total) : '',
        why: 'Manca alla serie «' + s.name + '»: ne hai ' + s.n + (s.total ? ' su ' + s.total : '') + '.' });
    });
  });
  return out.slice(0, 8);
}
function suggFresh() {
  var own = newsOwn(), hide = {};
  sugg.hide.forEach(function (k) { hide[k] = 1; });
  var net = sugg.items.filter(function (x) { return !own.titles[x.k] && !own.hide[x.k] && !hide[x.k] && !(x.i && own.isbns[x.i]); });
  return suggSeries().filter(function (x) { return !hide[x.k]; }).concat(net);
}
function suggUrl(q, newest) {
  var lang = settings.suggLang === 'all' ? '' : '&langRestrict=it';
  return 'https://www.googleapis.com/books/v1/volumes?q=' + encodeURIComponent(q) + (newest ? '&orderBy=newest' : '') + lang +
    '&printType=books&maxResults=20&fields=items(id,volumeInfo(title,subtitle,authors,publisher,publishedDate,language,industryIdentifiers,imageLinks))' +
    (settings.gbKey ? '&key=' + encodeURIComponent(settings.gbKey) : '');
}
async function findSugg() {
  if (sugg.busy) return null;
  var authors = suggAuthors(), genres = suggGenres(), y = new Date().getFullYear(), own = newsOwn(), found = [], seen = {}, errs = 0, done = 0;
  var lang = settings.suggLang === 'all' ? '' : 'it', jobs = [];
  authors.forEach(function (a) { jobs.push({ q: 'inauthor:"' + a.name.replace(/"/g, '') + '"', by: a.name, min: 0, max: 0, n: 4,
    why: 'Di ' + a.name + (a.r ? ', che ti piace: ' + (a.r === 1 ? 'un suo libro' : a.r + ' suoi libri') + ' con 4 stelle o più.' : ': ne hai ' + a.books + '.') }); });
  genres.forEach(function (g) { jobs.push({ q: 'subject:"' + L.genreSubject(g.name).replace(/"/g, '') + '"', by: '', min: y - 2, max: y + 1, n: 4, newest: true,
    why: 'Uscito da poco, nel genere che hai di più: ' + g.name + ' (' + g.books + ' libri).' }); });
  if (!jobs.length) return [];
  sugg.busy = true; sugg.tried = Date.now(); saveSugg();
  try {
    for (var i = 0; i < jobs.length; i++) {
      var j = jobs[i];
      if (!googleLeft(true)) break;
      try {
        var json = await L.getJson(apiFetch, suggUrl(j.q, j.newest), { waits: [900], timeout: 9000 });
        var picked = L.pickNews(json, j.by, own, j.min, j.max, lang);
        picked.filter(function (x) { return !seen[x.k]; }).slice(0, j.n).forEach(function (x) { seen[x.k] = 1; x.why = j.why; delete x.by; found.push(x); });
        done++;
      } catch (e) { errs++; if (errs >= 2 && !done) break; }
      if (!$('#suggSheet').hidden && sgTab === 'disc') $('#sgDiscMsg').textContent = 'Cerco… ' + (i + 1) + ' di ' + jobs.length;
    }
  } finally { sugg.busy = false; }
  if (!done) { saveSugg(); throw { net: true }; }
  sugg.items = found.slice(0, 60); sugg.at = Date.now(); saveSugg();
  return found;
}
function renderDisc(note) {
  var items = suggFresh(), can = suggAuthors().length || suggGenres().length;
  $('#sgDiscMsg').textContent = note || (sugg.busy ? 'Cerco…' : items.length ? 'Libri che non hai, ognuno col suo perché.' + (sugg.at ? ' Ultima ricerca: ' + L.agoText(sugg.at) + '.' : '') :
    !can ? 'Aggiungi qualche libro con autore e genere: cerco altri libri dei tuoi autori e novità dei tuoi generi.' :
    sugg.at ? 'Per ora niente di nuovo che non hai già. Ultima ricerca: ' + L.agoText(sugg.at) + '.' : '');
  $('#sgList').innerHTML = items.map(function (x) {
    return '<li data-k="' + esc(x.k) + '">' + (x.img ? '<img src="' + esc(x.img) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<span class="nimg" aria-hidden="true"></span>') +
      '<div class="nt"><b>' + esc(x.t) + '</b><span>' + esc([x.a, x.e, x.y].filter(Boolean).join(' · ')) + '</span><p class="sg-why">' + esc(x.why || '') + '</p>' +
      '<div class="desc-acts"><button type="button" class="link" data-act="sgwish">+ Desideri</button><button type="button" class="link quiet" data-act="sghide">No, grazie</button></div></div></li>';
  }).join('');
  $('#sgAgain').disabled = sugg.busy || !can;
}
async function runSugg() {
  if (navigator.onLine === false) { renderDisc('Sei offline. Riprova quando c\'è connessione.'); return; }
  if (!googleLeft(true)) { renderDisc('Le ricerche di Google per oggi le tengo per i libri nuovi: riprova domani.'); return; }
  $('#sgAgain').disabled = true; $('#sgDiscMsg').textContent = 'Cerco…';
  try { await findSugg(); renderDisc(); }
  catch (e) { renderDisc('Non sono riuscito a cercare (connessione o limite di Google' + (settings.gbKey ? '' : ': senza chiave capita spesso') + '). Riprova più tardi.'); }
}
function suggPick(k, wish) {
  var x = suggFresh().find(function (n) { return n.k === k; });
  if (!x) return;
  if (wish) {
    var w = blankBook({ t: x.t, a: x.a || '', e: x.e || '', y: x.y || '', i: x.i || '', img: /^https:\/\//.test(x.img || '') ? x.img : '', se: x.se || '', sn: x.sn || '', sq: x.sq || '', w: true, rs: '' });
    state.books.push(w); touch(); renderList(); updateSummary();
    toast('Nei Desideri: ' + x.t, { label: 'Annulla', fn: function () { state.books = state.books.filter(function (b) { return b.id !== w.id; }); touch(); renderList(); updateSummary(); if (!$('#suggSheet').hidden) renderDisc(); } });
  } else { sugg.hide.push(k); saveSugg(); }
  renderDisc();
}
function autoSugg() {
  var now = Date.now();
  if (settings.suggAuto === false || navigator.onLine === false || now - sugg.at < SUGG_EVERY || now - sugg.tried < SUGG_RETRY || !(suggAuthors().length || suggGenres().length) || !googleLeft(true)) return;
  var before = {}; suggFresh().forEach(function (x) { before[x.k] = 1; });
  findSugg().then(function () {
    var fresh = suggFresh().filter(function (x) { return !before[x.k] && !/^se:/.test(x.k); });
    if (fresh.length && $('#suggSheet').hidden) toast(fresh.length === 1 ? 'Un libro nuovo da scoprire.' : fresh.length + ' libri nuovi da scoprire.', { label: 'Vedi', fn: function () { openSugg('disc'); } });
  }, function () {});
}
/* --- finestra --- */
function setSgTab(t) {
  sgTab = t === 'disc' ? 'disc' : 'next';
  $('#sgTabNext').setAttribute('aria-pressed', sgTab === 'next' ? 'true' : 'false'); $('#sgTabNext').setAttribute('aria-selected', sgTab === 'next' ? 'true' : 'false');
  $('#sgTabDisc').setAttribute('aria-pressed', sgTab === 'disc' ? 'true' : 'false'); $('#sgTabDisc').setAttribute('aria-selected', sgTab === 'disc' ? 'true' : 'false');
  $('#sgNext').hidden = sgTab !== 'next'; $('#sgDisc').hidden = sgTab !== 'disc'; $('#sgAgain').hidden = sgTab !== 'disc';
  renderSugg();
  if (sgTab === 'disc' && !sugg.at && !sugg.busy && (suggAuthors().length || suggGenres().length)) runSugg();
}
function renderSugg() { if (sgTab === 'disc') renderDisc(); else renderNext(); }
function openSugg(t) {
  if (guest) guestExit(true);                      // «Per te» e il Menu parlano sempre della tua libreria (Piero, 17/11/2026 sera)
  $('#sgAuto').checked = settings.suggAuto !== false;
  $('#sgLang').checked = settings.suggLang === 'all';
  $('#suggSheet').hidden = false;
  setSgTab(t || 'next');
}
function closeSugg() { $('#suggSheet').hidden = true; }
$('#goSugg').addEventListener('click', function () { fromMenu(function () { openSugg('next'); }); });
$('#sgTabNext').addEventListener('click', function () { setSgTab('next'); });
$('#sgTabDisc').addEventListener('click', function () { setSgTab('disc'); });
$('#sgClose').addEventListener('click', closeSugg);
$('#sgAgain').addEventListener('click', runSugg);
$('#sgAuto').addEventListener('change', function (e) { settings.suggAuto = e.target.checked; saveSettings(); });
$('#sgLang').addEventListener('change', function (e) { settings.suggLang = e.target.checked ? 'all' : 'it'; saveSettings(); sugg.items = []; sugg.at = 0; saveSugg(); renderDisc(); runSugg(); });
$('#suggSheet').addEventListener('click', function (e) {
  if (e.target === e.currentTarget) { closeSugg(); return; }
  var b = e.target.closest('[data-act]'); if (!b) return;
  var act = b.dataset.act;
  if (act === 'nxother') { nxIdx++; renderNext(); }
  else if (act === 'nxstart') startReading(b.dataset.id, function () { nxIdx = 0; renderNext(); });
  else if (act === 'sgwish' || act === 'sghide') { var li = b.closest('li[data-k]'); if (li) suggPick(li.dataset.k, act === 'sgwish'); }
});
/* --- riquadro in cima all'elenco: hai appena finito un libro e non ne stai leggendo un altro --- */
function nxJustRead() {
  var lim = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
  var last = state.books.filter(function (b) { return !b.w && b.rs === 'ok' && b.rd && b.rd >= lim; }).sort(function (x, y) { return x.rd < y.rd ? 1 : x.rd > y.rd ? -1 : 0; })[0];
  return last || null;
}
function nxBoxPaint() {
  var box = $('#nxBox'); if (!box) return;
  var last = tab === 'lib' && !q && !activeCount() ? nxJustRead() : null;
  var list = last && last.id !== settings.nxSeen && !state.books.some(function (b) { return !b.w && b.rs === 'in'; }) ? nextList() : [];
  box.hidden = !list.length;
  if (!list.length) return;
  nxBoxIdx = ((nxBoxIdx % list.length) + list.length) % list.length;
  $('#nxBoxH').textContent = 'Hai finito «' + (last.t || 'un libro') + '». E adesso?';
  $('#nxBoxCard').innerHTML = nxCardHTML(list[nxBoxIdx], true);
  $('#nxBoxGo').dataset.id = list[nxBoxIdx].id;
  $('#nxBoxNext').hidden = list.length < 2;
}
$('#nxBoxGo').addEventListener('click', function (e) { startReading(e.currentTarget.dataset.id); });
$('#nxBoxNext').addEventListener('click', function () { nxBoxIdx++; nxBoxPaint(); });
$('#nxBoxAll').addEventListener('click', function () { nxIdx = nxBoxIdx; openSugg('next'); });
$('#nxBoxX').addEventListener('click', function () { var l = nxJustRead(); settings.nxSeen = l ? l.id : ''; saveSettings(); nxBoxPaint(); updateSummary(); });
$('#btnNews').addEventListener('click', openNews);
$('#newsClose').addEventListener('click', function () { $('#newsSheet').hidden = true; });
$('#newsAgain').addEventListener('click', runNews);
$('#newsAuto').addEventListener('change', function (e) { settings.newsAuto = e.target.checked; saveSettings(); });
$('#newsSheet').addEventListener('click', function (e) {
  if (e.target === e.currentTarget) { $('#newsSheet').hidden = true; return; }
  var b = e.target.closest('[data-act]'), li = b && b.closest('li[data-k]');
  if (li) newsPick(li.dataset.k, b.dataset.act === 'newswish');
});
/* ---- tutte le citazioni: elenco per libro, dal menu laterale ---- */
function allQuotes() {
  var out = [];
  state.books.forEach(function (b) { (b.qs || []).forEach(function (c, i) { out.push({ b: b, c: c, i: i }); }); });
  return out;
}
function renderAllQuotes() {
  var nq = L.norm($('#allqQ').value.trim()), groups = {}, order = [], n = 0;
  allQuotes().forEach(function (x) {
    if (nq && L.norm([x.c.x, x.b.t, x.b.a].join(' ')).indexOf(nq) < 0) return;
    if (!groups[x.b.id]) { groups[x.b.id] = []; order.push(x.b); }
    groups[x.b.id].push(x); n++;
  });
  order.sort(function (x, y) { return coll.compare(L.sortKeyTitle(x.t) || '~', L.sortKeyTitle(y.t) || '~'); });
  var tot = allQuotes().length;
  $('#allqMsg').textContent = !tot ? 'Non hai ancora salvato citazioni: aprile da «Citazioni e appunti» nella scheda di un libro.' :
    nq ? (n ? (n === 1 ? '1 citazione trovata' : n + ' citazioni trovate') : 'Nessuna citazione con queste parole.') :
    (tot === 1 ? '1 citazione' : tot + ' citazioni') + ' da ' + (order.length === 1 ? '1 libro' : order.length + ' libri') + '. Tocca il titolo per aprire il libro.';
  $('#allqList').innerHTML = order.map(function (b) {
    return '<li class="aq-book"><button type="button" class="aq-h" data-open="' + b.id + '"><b>' + esc(b.t || 'Senza titolo') + '</b>' + (b.a ? '<span>' + esc(b.a) + '</span>' : '') + (b.w ? '<span class="tag">Desideri</span>' : '') + '</button>' + (groups[b.id].length > 1 && !nq ? '<button type="button" class="link aq-all" data-all="' + b.id + '">Condividi tutte (' + groups[b.id].length + ')</button>' : '') +
      '<ul class="qlist">' + groups[b.id].map(function (x) {
        return '<li><div class="qitem aq-q' + (qPhs(x.c).length ? ' has-ph' + (x.c.x ? '' : ' only-ph') : '') + '">' + (qPhs(x.c).length ? '<button type="button" class="qimg-btn" data-ph="' + esc(qPhs(x.c).join(' ')) + '" data-cap="' + esc(b.t || '') + '" aria-label="Ingrandisci le foto">' + qThumb(x.c) + '</button>' : '') +
          (x.c.x ? '<span class="qt">' + esc(x.c.x) + '</span>' : '<span class="qt q-only">Foto della pagina</span>') + '<span class="qp">' + (x.c.pg ? 'p. ' + esc(x.c.pg) : '') +
          (x.c.x ? '<button type="button" class="qpin' + (x.c.pin ? ' on' : '') + '" data-pin="' + b.id + '" data-i="' + x.i + '" aria-pressed="' + !!x.c.pin + '" aria-label="' + (x.c.pin ? 'In evidenza nel profilo: tocca per togliere la puntina' : 'Metti in evidenza nel profilo') + '" title="' + (x.c.pin ? 'In evidenza nel profilo: tocca per togliere la puntina' : 'Metti in evidenza nel profilo') + '">' + icon('pin') + '</button>' : '') +
          '<button type="button" class="link" data-copy="' + b.id + '" data-i="' + x.i + '">Condividi</button></span></div></li>';
      }).join('') + '</ul></li>';
  }).join('');
}
function openAllQuotes() {
  if (guest) guestExit(true);                      // «Per te» e il Menu parlano sempre della tua libreria (Piero, 17/11/2026 sera)
  $('#allqQ').value = '';
  renderAllQuotes();
  $('#allqSheet').hidden = false;
}
function closeAllQuotes() { $('#allqSheet').hidden = true; }
function goToQuotes(id) {
  var b = get(id); if (!b) return;
  closeAllQuotes();
  if (!!b.w !== (tab === 'wish')) setTab(b.w ? 'wish' : 'lib');
  flt = ''; readFlt = ''; shFlt = ''; genFlt = ''; autFlt = ''; autName = ''; edFlt = ''; frFlt = ''; paFlt = '';
  q = ''; $('#q').value = '';
  collapseCards(); openState = {}; openState[id] = true; quoteOpen[id] = true;
  if (settings.view === 'grid') { gridRet = { id: id, y: 0 }; setView('list'); }   // le citazioni si vedono nella scheda: chiudendola si torna alle copertine
  renderList(); updateSummary();
  var el = rowEl(id), d = el && el.querySelector('details.quotes');
  if (el) { (d || el).scrollIntoView({ block: 'start' }); window.scrollBy(0, -80); el.classList.add('flash'); setTimeout(function () { el.classList.remove('flash'); }, 1600); }
}
/* condivisione delle citazioni: testo (e foto, se il telefono le accetta); senza condivisione, copia */
function quoteLine(c, withPg) { return (c.x ? '«' + c.x + '»' : '[' + (qPhs(c).length > 1 ? 'foto delle pagine' : 'foto della pagina') + ']') + (withPg && c.pg ? ' (p. ' + c.pg + ')' : ''); }
async function sendQuotes(text, blobs, what) {
  text += '\n\nInviato con Next Libris, l\'app per catalogare la propria libreria: ' + APP_URL;
  if (blobs.length && navigator.share && navigator.canShare) {
    try {
      var files = blobs.slice(0, 10).map(function (bl, k) { return new File([bl], 'citazione' + (blobs.length > 1 ? '-' + (k + 1) : '') + '.jpg', { type: 'image/jpeg' }); });
      if (navigator.canShare({ files: files })) { await navigator.share({ text: text, files: files }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  if (navigator.share) { try { await navigator.share({ text: text }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  toast(await copyText(text) ? what + ' copiat' + (what === 'Citazione' ? 'a' : 'e') + ': incolla' + (what === 'Citazione' ? 'la' : 'le') + ' dove vuoi.' : 'Non sono riuscito a copiarle.');
}
async function phBlob(key) { try { return qphURL[key] ? await (await fetch(qphURL[key])).blob() : null; } catch (e) { return null; } }
async function shareQuoteObj(b, c, blobs) {
  var src = [b.t, b.a].filter(Boolean).join(', ') + (c.pg ? ', p. ' + c.pg : '');
  var text = c.x ? '«' + c.x + '»\n— ' + src : src;
  if (!blobs) { blobs = []; var ks = qPhs(c); for (var k = 0; k < ks.length; k++) { var bl = await phBlob(ks[k]); if (bl) blobs.push(bl); } }
  await sendQuotes(text, blobs, 'Citazione');
}
async function shareQuote(id, i) {
  var b = get(id), c = b && (b.qs || [])[i];
  if (c) await shareQuoteObj(b, c);
}
async function shareAllQuotes(id) {
  var b = get(id), qs = b && (b.qs || []);
  if (!qs || !qs.length) return;
  if (qs.length === 1) { await shareQuoteObj(b, qs[0]); return; }
  var head = (b.t ? '«' + b.t + '»' : 'Senza titolo') + (b.a ? ' di ' + b.a : '');
  var text = 'Citazioni da ' + head + '\n\n' + qs.map(function (c) { return quoteLine(c, true); }).join('\n\n') + (settings.name ? '\n\n— scelte da ' + settings.name : '');
  var blobs = [];
  for (var k = 0; k < qs.length; k++) { var ks = qPhs(qs[k]); for (var j = 0; j < ks.length; j++) { var bl = await phBlob(ks[j]); if (bl) blobs.push(bl); } }
  await sendQuotes(text, blobs, 'Citazioni');
}
$('#allqQ').addEventListener('input', renderAllQuotes);
$('#allqClose').addEventListener('click', closeAllQuotes);
$('#allqSheet').addEventListener('click', function (e) {
  if (e.target === e.currentTarget) { closeAllQuotes(); return; }
  var o = e.target.closest('[data-open]'); if (o) { goToQuotes(o.dataset.open); return; }
  var ph = e.target.closest('[data-ph]'); if (ph) { openPhs(ph.dataset.ph.split(' ').map(function (k) { return qphURL[k]; }).filter(Boolean), 0, ph.dataset.cap); return; }
  var al = e.target.closest('[data-all]'); if (al) { shareAllQuotes(al.dataset.all); return; }
  var pn = e.target.closest('[data-pin]'); if (pn) { togglePin(pn.dataset.pin, +pn.dataset.i); renderAllQuotes(); return; }
  var c = e.target.closest('[data-copy]'); if (c) shareQuote(c.dataset.copy, +c.dataset.i);
});
