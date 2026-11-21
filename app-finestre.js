/* Next Libris · app, parte 7 di 10 (app-finestre.js): azioni sulle righe, finestre, ricerca per titolo, backup, copertine.
   Dal 17/11/2026 app.js è diviso in 10 file (prima era una sola funzione). Sono script classici, senza import:
   le funzioni e le variabili di primo livello sono globali e servono a tutte le parti; l'ordine in index.html
   e in SHELL di sw.js conta (app.js, app-aggiungi.js, …, app-avvio.js: l'ultima fa partire l'app). */
'use strict';
/* ---------- azioni sulle righe ---------- */
function delBook(id) {
  var i = state.books.findIndex(function (b) { return b.id === id; });
  if (i < 0) return;
  var b = state.books[i], s = S[id];
  var active = s && (s.st === 'reading' || s.st === 'queued' || s.st === 'lookup' || s.st === 'search');
  state.books.splice(i, 1);
  delete S[id];
  var el = rowEl(id);
  if (el) el.remove();
  if (!tabBooks().length || settings.view === 'grid' || gridGone()) renderList();
  touch(); updateSummary();
  if (active || !hasData(b)) { toast('Libro eliminato'); return; }
  toast('Libro eliminato', { label: 'Annulla', fn: function () {
    state.books.push(b); if (s) S[id] = s;
    renderList(); touch(); updateSummary();
  } });
}
function retryRow(id) {
  var s = S[id], b = get(id);
  if (!s || !b) return;
  clearTimeout(s.timer);
  var what = s.retry;
  s.err = ''; s.retry = null;
  if (what === 'lookup') { s.st = 'queued'; refreshRow(id); lookupPool(function () { return doLookup(id); }); }
  else if (what === 'text') {
    s.st = 'search'; refreshRow(id);
    var qs = L.buildQueries(s.lines || []);
    Promise.allSettled(qs.map(function (qq) { return L.searchText(qq, lookupOpts()); })).then(function (out) {
      if (!get(id) || s.manual) return;
      var all = [], seen = {};
      out.forEach(function (r) { if (r.status === 'fulfilled') r.value.forEach(function (c) { if (!seen[c.id]) { seen[c.id] = 1; all.push(c); } }); });
      if (out.every(function (r) { return r.status === 'rejected'; })) { s.st = 'error'; s.err = 'Le banche dati non rispondono. Riprova tra poco.'; s.retry = 'text'; refreshRow(id); return; }
      var ranked = L.rankCandidates(all, s.lines || []);
      if (!ranked.length) { s.st = 'nf'; refreshRow(id); autoManual(id); return; }
      if (L.strongMatch(ranked)) { applyCandidate(id, ranked[0]); return; }
      s.st = 'choose'; s.cands = ranked.slice(0, 6); refreshRow(id);
    });
  }
}

/* ---------- finestre ---------- */
function openIsbnSheet() {
  $('#isbnText').value = '';
  $('#isbnErr').hidden = true;
  $('#isbnResBox').hidden = true; $('#isbnRes').innerHTML = ''; titleSeq++;
  $('#isbnH').textContent = tab === 'wish' ? 'Aggiungi ai Desideri' : 'Titolo o ISBN';
  $('#isbnSheet').hidden = false;
  setTimeout(function () { $('#isbnText').focus(); }, 50);
}
/* ---------- ricerca per titolo (per esempio un libro consigliato da un amico) ---------- */
var titleSeq = 0, titleCands = [], titleText = '';
/* perché i risultati vengono da Open Library (20/11/2026, Piero: senza API non è «Google non ha risposto») */
function olWhy(gErr) {   // 21/11/2026: i risultati senza Google vengono dal catalogo delle biblioteche (SBN) e da Open Library
  var W = 'il catalogo delle biblioteche (SBN) e Open Library';
  if (gErr === 'nokey') return 'L’API Google Libri che ti avevano prestato non è più disponibile: questi li trovano ' + W + '. ';
  if (!settings.gbKey) return 'Senza un’API Google Libri cerco solo nel catalogo delle biblioteche (SBN) e in Open Library: ecco cosa trovano. ';
  if (gErr) return 'Google Libri non ha risposto: questi li trovano ' + W + '. ';
  return '';
}
/* ordine dei risultati per titolo (20/11/2026, Piero): prima i titoli più vicini a quello scritto; poi chi corrisponde all'anno
   o all'editore scritti accanto («l'isola del tesoro bur», «l'isola del tesoro 1996»); poi le edizioni italiane, quelle con ISBN e
   copertina, e le più recenti */
var STOPW = { l: 1, il: 1, lo: 1, la: 1, i: 1, gli: 1, le: 1, un: 1, una: 1, uno: 1, di: 1, del: 1, della: 1, dello: 1, dei: 1, degli: 1, delle: 1, e: 1, ed: 1, a: 1, al: 1, the: 1, of: 1, and: 1, d: 1 };
function qParts(text) {
  var m = String(text).match(/\b(1[4-9]\d\d|20\d\d)\b/), y = m ? m[1] : '';
  var q = y ? String(text).replace(m[0], ' ').replace(/\s+/g, ' ').trim() : String(text).trim();
  return { y: y, q: q || String(text).trim() };
}
function toks(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(function (w) { return w && !STOPW[w]; });
}
function rankCands(qp, list) {
  var qt = toks(qp.q);
  return list.map(function (c, i) {
    var tt = toks(c.t), inT = tt.filter(function (w) { return qt.indexOf(w) >= 0; }).length;
    var fit = tt.length ? inT / tt.length : 0;                       // 1 = il titolo è fatto solo di parole scritte
    var extra = qt.filter(function (w) { return tt.indexOf(w) < 0; });
    var more = toks(c.e + ' ' + c.a), hit = extra.filter(function (w) { return more.indexOf(w) >= 0; }).length;   // editore o autore scritti
    return { c: c, i: i, tier: fit >= 0.999 ? 2 : fit >= 0.6 ? 1 : 0, bonus: hit + (qp.y && c.y === qp.y ? 2 : 0),
      it: c.lang === 'it' ? 1 : 0, full: (c.i && c.img) ? 1 : 0, y: Number(c.y) || 0 };
  }).sort(function (a, b) {
    return (b.tier - a.tier) || (b.bonus - a.bonus) || (b.it - a.it) || (b.full - a.full) || (b.y - a.y) || (a.i - b.i);
  }).map(function (x) { return x.c; });
}
function looksLikeTitle(s) { return (String(s).replace(/isbn/ig, '').match(/[a-zàèéìòùç]/ig) || []).length >= 3; }
function whereTxt() { return tab === 'wish' ? 'ai Desideri' : 'alla Libreria'; }
async function searchTitle(text) {
  var my = ++titleSeq;
  titleText = text; titleCands = [];
  $('#isbnErr').hidden = true; $('#isbnKey').hidden = true;
  $('#isbnResBox').hidden = false;
  $('#isbnResMsg').textContent = 'Cerco «' + text + '»…';
  $('#isbnRes').innerHTML = '';
  var asIs = $('#isbnAsIs');
  asIs.textContent = 'Aggiungi solo «' + (text.length > 40 ? text.slice(0, 38) + '…' : text) + '», senza cercare'; asIs.hidden = true;
  var res;
  var qp = qParts(text);
  try { res = await L.searchText(qp.q, lookupOpts()); }
  catch (e) {
    if (my !== titleSeq) return;
    /* 20/11/2026 (Piero): senza API, o con l'API prestata tolta, non è «Google al limite»: si spiega come averne una */
    var noKey = !settings.gbKey || /^prestata/i.test(settings.gbKey) && e && e.code === 'nokey';
    $('#isbnResMsg').textContent = e && e.code === 'nokey' ? 'L’API Google Libri che ti avevano prestato non è più disponibile. Puoi crearne una tua: è gratis e bastano pochi minuti. Intanto aggiungi solo il titolo e completalo dopo.'
      : e && e.code === 'rate' && !settings.gbKey ? 'Senza un’API Google Libri, Google limita la ricerca per titolo. Puoi crearne una tua (è gratis) o chiederla in prestito a un amico. Intanto aggiungi solo il titolo e completalo dopo.'
      : e && e.code === 'rate' ? 'Google Libri è al limite di richieste: riprova tra poco, oppure aggiungi solo il titolo e completalo dopo.'
      : 'Non riesco a cercare: controlla la connessione. Puoi aggiungere solo il titolo e completarlo dopo.';
    $('#isbnKey').hidden = !(e && (e.code === 'nokey' || (e.code === 'rate' && noKey)));
    asIs.hidden = false; return;
  }
  if (my !== titleSeq || $('#isbnSheet').hidden) return;
  // prima le edizioni italiane, poi quelle con l'ISBN; per il resto l'ordine di Google
  titleCands = rankCands(qp, res);
  titleCands = titleCands.filter(function (c) { return c.i; }).concat(titleCands.filter(function (c) { return !c.i; })).slice(0, 10);   // le edizioni senza ISBN dopo le altre (Piero, 21/11/2026)
  $('#isbnRes').innerHTML = titleCands.map(function (c, i) {
    var have = (c.isbns || []).map(findByIsbn).filter(Boolean)[0];
    var badge = have ? '<span class="tag ' + (have.w ? 'loan' : 'warn') + '">' + (have.w ? 'Già nei Desideri' : 'Ce l\'hai già') + '</span>' : '';
    return '<li><button class="cand" data-i="' + i + '"><span class="cimg">' + (c.img ? '<img src="' + esc(c.img) + '" alt="" referrerpolicy="no-referrer" data-rm>' : '') + '</span><span><b>' + esc(c.t) + '</b>' +
      '<span>' + esc(c.a || 'Autore non indicato') + '</span><span>' + esc([c.e, c.y].filter(Boolean).join(', ') || 'Editore e anno non indicati') + '</span>' + badge + '</span></button></li>';
  }).join('');
  var viaOl = res.via === 'free' && !res.gSkip;   // Google serviva (mancavano edizioni italiane) ma non ha dato risultati
  $('#isbnKey').hidden = !(viaOl && (!settings.gbKey || res.gErr === 'nokey'));
  $('#isbnResMsg').textContent = titleCands.length ? (viaOl ? olWhy(res.gErr) : '') + 'Tocca il libro giusto per aggiungerlo ' + whereTxt() + ':' : 'Non ho trovato libri per «' + text + '». Prova con meno parole, o aggiungi l\'autore.';
  asIs.hidden = false;
}
function addedToast(b) {
  var id = b.id;
  if (settings.price && !scanning) return;            // c'e' il riquadro «Libro aggiunto» (con «Togli il libro»)
  toast('Aggiunto ' + (b.w ? 'ai Desideri' : 'alla Libreria') + ': ' + (b.t || b.i), { label: 'Annulla', fn: function () {
    state.books = state.books.filter(function (x) { return x.id !== id; }); delete S[id]; renderList(); touch(); updateSummary();
  } });
}
function pickTitle(i) {
  var c = titleCands[i];
  if (!c) return;
  var code = L.toIsbn13(c.i);
  q = ''; $('#q').value = '';
  if (code) {
    var res = addIsbn(code);
    if (res.dup) { toast((res.dup.w ? 'È già nei Desideri: ' : 'Ce l\'hai già in Libreria: ') + (res.dup.t || code)); return; }
    $('#isbnSheet').hidden = true;
    if (res.moved) { openState[res.moved.id] = false; renderList(); updateSummary(); toast('Era nei Desideri: spostato in Libreria. ' + (res.moved.t || code)); return; }
    var b = res.book;
    b.t = c.t; b.a = c.a; if (c.img) b.img = c.img;           // si vede subito; il resto arriva dalle banche dati
    if (c.img && S[b.id]) S[b.id].keepImg = true;              // la copertina toccata nei risultati resta: la ricerca per ISBN non la cambia (Piero, 17/11/2026)
    openState[b.id] = false;
    renderList(); updateSummary(); addedToast(b); askPrice(b.id);
    return;
  }
  var nb = blankBook({ t: c.t, a: c.a, e: c.e, y: c.y, img: c.img || '', gen: c.gen || '', pg: c.pg || '' });
  takeDesc(nb, c.ds, ''); state.books.push(nb); openState[nb.id] = false; queueDesc(nb.id);
  $('#isbnSheet').hidden = true;
  touch(); renderList(); updateSummary(); addedToast(nb); askPrice(nb.id);
}
function addTitleAsIs() {
  var t = titleText.replace(/\s+/g, ' ').trim();
  if (!t) return;
  var nb = blankBook(woAsIs(titleText) || { t: t.slice(0, 300) });   // dalle opere di un autore: titolo e autore separati (giro 2)
  state.books.push(nb); openState[nb.id] = false;
  $('#isbnSheet').hidden = true; q = ''; $('#q').value = '';
  touch(); renderList(); updateSummary(); addedToast(nb); askPrice(nb.id);
}
$('#isbnRes').addEventListener('click', function (e) { var b = e.target.closest('[data-i]'); if (b) pickTitle(+b.dataset.i); });
$('#isbnAsIs').addEventListener('click', addTitleAsIs);
$('#isbnKey').addEventListener('click', function () { $('#isbnSheet').hidden = true; if (window.NLRicerche && window.NLRicerche.guide) window.NLRicerche.guide(); else if (NL.openOptions) NL.openOptions('search'); });
$('#isbnText').addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && !e.shiftKey && looksLikeTitle(e.target.value)) { e.preventDefault(); submitIsbn(); }
});
$('#isbnText').addEventListener('input', function () { $('#isbnErr').hidden = true; });

function submitIsbn() {
  var raw = $('#isbnText').value.trim();
  if (looksLikeTitle(raw) && !L.parseIsbnList(raw).valid.length) { searchTitle(raw); return; }
  var r = L.parseIsbnList($('#isbnText').value);
  var err = $('#isbnErr');
  if (!r.valid.length) {
    err.textContent = r.invalid.length ? 'Codice non valido: ' + r.invalid.slice(0, 3).join(', ') + '. Controlla le cifre.' : 'Scrivi un titolo o un codice ISBN.';
    err.hidden = false;
    return;
  }
  var added = 0, dupes = 0, moved = 0, dupIds = [], newBook = null;
  q = ''; flt = ''; $('#q').value = ''; setView('list');
  r.valid.forEach(function (code) {
    var res = addIsbn(code);
    if (res.dup) { dupes++; if (!res.dup.w && tab === 'lib') dupIds.push(res.dup.id); } else if (res.moved) moved++; else { added++; newBook = res.book; }
  });
  if (r.valid.length === 1 && newBook) (S[newBook.id] || (S[newBook.id] = {})).heard = true;   // un ISBN scritto a mano: se non si trova, suona
  $('#isbnSheet').hidden = true;
  renderList(); updateSummary();
  if (added === 1 && r.valid.length === 1 && newBook && settings.price) { askPrice(newBook.id); return; }
  var parts = [];
  if (added) parts.push(added + (added === 1 ? ' libro aggiunto' : ' libri aggiunti') + (tab === 'wish' ? ' ai Desideri' : ''));
  if (moved) parts.push(moved + (moved === 1 ? ' spostato dai Desideri alla Libreria' : ' spostati dai Desideri alla Libreria'));
  if (dupes) parts.push(dupes + (dupes === 1 ? ' già in elenco' : ' già in elenco'));
  if (r.invalid.length) parts.push(r.invalid.length + (r.invalid.length === 1 ? ' codice non valido' : ' codici non validi'));
  toast(parts.join(', ') + '.', dupIds.length ? { label: dupIds.length === 1 ? 'Aggiungi un\'altra copia' : 'Aggiungi come altre copie', fn: function () {
    dupIds.forEach(function (id) { addCopy(id, true); });
    renderList(); updateSummary(); toast(dupIds.length === 1 ? 'Aggiunta un\'altra copia.' : 'Aggiunte ' + dupIds.length + ' copie.');
  } } : null);
}
var pickId = null;
function openPick(id) {
  var s = S[id];
  if (!s || !s.cands) return;
  pickId = id;
  $('#pickList').innerHTML = s.cands.map(function (c, i) {
    return '<li><button class="cand" data-i="' + i + '"><span class="cimg">' + (c.img ? '<img src="' + esc(c.img) + '" alt="" referrerpolicy="no-referrer" data-rm>' : '') + '</span><span><b>' + esc(c.t) + '</b>' +
      '<span>' + esc(c.a || 'Autore non indicato') + '</span><span>' + esc([c.e, c.y].filter(Boolean).join(' · ') || 'Editore e anno non indicati') + '</span></span></button></li>';
  }).join('');
  $('#pickSheet').hidden = false;
}
function closePick() { $('#pickSheet').hidden = true; pickId = null; }

/* ---- Titolo e autore a mano: quando la foto della copertina non trova il libro (o mentre cerca ancora) ---- */
var manId = null;
var manPrice = false;
function openManual(id, withPrice) {
  var b = get(id), s = S[id] || {};
  if (!b) return;
  manId = id;
  if (flow.id === id) { flow.id = null; hideFlow(); withPrice = true; }      // aperta dalla riga mentre c'era la finestra dell'avanzamento
  manPrice = !!(withPrice && settings.price && b.c == null);
  $('#manP').value = s.price != null ? L.fmtNum(s.price) : '';
  document.querySelectorAll('#manForm .man-p').forEach(function (x) { x.hidden = !manPrice; });
  $('#manA').setAttribute('enterkeyhint', manPrice ? 'next' : 'done');
  var ta = (s.lines || []).length ? L.splitTitleAuthor(s.lines) : {};    // il testo letto dalla foto come punto di partenza
  $('#manT').value = b.t || (ta.t ? niceCase(ta.t, false) : '');
  $('#manA').value = b.a || (ta.a ? niceCase(ta.a, true) : '');
  var src = s.thumb || smallImg(b);
  $('#manImg').style.backgroundImage = src ? 'url("' + src.replace(/"/g, '%22') + '")' : '';
  $('#manImg').hidden = !src;
  var st = s.st;
  $('#manMsg').textContent = st === 'nf' ? 'Non ho trovato questo libro online. Scrivilo tu' + (src ? ': la foto diventa la copertina.' : '.')
    : st === 'choose' ? 'Nessuna delle edizioni trovate va bene? Scrivilo tu' + (src ? ': la foto diventa la copertina.' : '.')
    : st === 'error' || st === 'wait' ? 'Scrivilo tu' + (src ? ': la foto diventa la copertina.' : '.')
    : 'Lo scrivi tu: smetto di cercarlo.';
  $('#manErr').hidden = true; $('#manErr').textContent = 'Scrivi almeno il titolo.';
  $('#manSheet').hidden = false;
  setTimeout(function () { try { var i = $('#manT').value ? $('#manA') : $('#manT'); i.focus(); } catch (e) { nlErr(e); } }, 60);
}
function closeManual() { $('#manSheet').hidden = true; manId = null; try { document.activeElement.blur(); } catch (e) { nlErr(e); } }
function autoManual(id) {                          // si apre da sola se e' l'unica foto in lavorazione e non c'e' altro aperto
  var b = get(id);
  if (!b || b.t || b.i || (S[id] && S[id].later) || flow.id === id || scanning || !$('#manSheet').hidden || document.querySelector('.sheet:not([hidden]), .lightbox:not([hidden])')) return;
  var others = state.books.some(function (x) { var t = S[x.id] && S[x.id].st; return x.id !== id && (t === 'queued' || t === 'reading' || t === 'search' || t === 'nf'); });
  if (!others) openManual(id);
}
$('#manForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var id = manId, b = get(id), s = S[id] || {};
  var t = $('#manT').value.trim().replace(/\s+/g, ' '), a = $('#manA').value.trim().replace(/\s+/g, ' ');
  if (!t) { $('#manErr').textContent = 'Scrivi almeno il titolo.'; $('#manErr').hidden = false; $('#manT').focus(); return; }
  var price = null, pv = manPrice ? $('#manP').value.trim() : '';
  if (pv) {
    price = L.parseNum(pv);
    if (!(price > 0 && price < 1000)) { $('#manErr').textContent = 'Scrivi un prezzo, per esempio 14,50, oppure lascialo vuoto.'; $('#manErr').hidden = false; $('#manP').focus(); return; }
    price = Math.round(price * 100) / 100;
  }
  closeManual();
  if (!b) return;
  b.t = t; b.a = a;
  b.g = b.g.filter(function (k) { return k !== 't' && k !== 'a'; });
  if (s.big && !b.img && !coverURL[id]) saveCoverData(id, s.big);          // la foto scattata diventa la copertina
  if (price != null) b.c = price;
  else if (s.price != null && b.c == null) b.c = s.price;
  b.nf = false;
  if (S[id]) { S[id].manual = true; ['st', 'cands', 'lines', 'price', 'err', 'retry', 'msg'].forEach(function (k) { delete S[id][k]; }); }
  touch(); refreshRow(id); updateSummary();
  queueDesc(id);                                                            // la descrizione si cerca da titolo e autore
  chime();
  toast('Salvato: ' + t + (a ? ', ' + a : '') + '.');
});
$('#manCancel').addEventListener('click', closeManual);
$('#manSheet').addEventListener('click', function (e) { if (e.target === e.currentTarget) closeManual(); });
$('#manT').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('#manA').focus(); } });
$('#manA').addEventListener('keydown', function (e) { if (e.key === 'Enter' && manPrice) { e.preventDefault(); $('#manP').focus(); } });

/* ---------- export e backup ---------- */
function exportBooks() {
  var a = tabBooks().filter(hasData);
  return a.sort(sortBy === 'recent' ? function (x, y) { return x.ts - y.ts; } : cmpFor(sortBy));
}
function today() {
  var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
function downloadBlob(name, data, type) {
  var blob = new Blob([data], { type: type });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
}
async function copyTSV() {
  var books = exportBooks();
  if (!books.length) { toast('L\'elenco è vuoto.'); return; }
  var text = L.buildTSV(books);
  try {
    await navigator.clipboard.writeText(text);
    toast('Copiato. Incollalo in Excel o Fogli Google.');
  } catch (e) {
    $('#copyBox').value = text;
    $('#copySheet').hidden = false;
    $('#copyBox').focus(); $('#copyBox').select();
  }
}
function fileBase() { return (tab === 'wish' ? 'desideri-' : 'libreria-') + today(); }
function saveCSV() {
  var books = exportBooks();
  if (!books.length) { toast('L\'elenco è vuoto.'); return; }
  downloadBlob(fileBase() + '.csv', L.buildCSV(books), 'text/csv;charset=utf-8');
  toast('File CSV scaricato.');
}
function saveXLSX() {
  var books = exportBooks();
  if (!books.length) { toast('L\'elenco è vuoto.'); return; }
  downloadBlob(fileBase() + '.xlsx', L.buildXLSX(books, tab === 'wish' ? 'Desideri' : 'Libreria'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  toast('File Excel scaricato: lo trovi nei Download.');
}
/* ---------- backup ---------- */
var backupReady = null;
/* «Libreria di Piero - Next Libris - 2026-11-14 22.58»: si riconosce a colpo d'occhio tra i file, anche con piu' backup nello stesso giorno */
function backupName() {
  var who = String(settings.name || '').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 30);
  var d = new Date(), hm = String(d.getHours()).padStart(2, '0') + '.' + String(d.getMinutes()).padStart(2, '0');   // ora con il punto: i due punti non vanno nei nomi dei file
  return (who ? 'Libreria di ' + who : 'La mia libreria') + ' - Next Libris - ' + today() + ' ' + hm;
}
function coverIds() { return Object.keys(coverURL).filter(function (id) { return !!get(id); }).concat(quotePhKeys().filter(function (k) { return !!qphURL[k]; })); }
/* Senza foto tue il backup e' pronto subito; con le foto va preparato prima (si leggono dal telefono), cosi' la condivisione parte al tocco. */
/* nel backup va anche l'API Google (in uso e salvate): ripristinando su un altro telefono torna anche lei. I worker SBN no (031) */
function backupCfg() { return { gbKey: mine('key'), saved: { key: saved.key.slice() } }; }
function backupData() { return coverIds().length ? backupReady : JSON.stringify({ app: 'catalogo-libri', v: 4, books: storable(), cfg: backupCfg() }); }
async function buildBackup() {
  var o = { app: 'catalogo-libri', v: 4, books: storable(), cfg: backupCfg() }, ids = coverIds();
  if (ids.length) {
    o.covers = {};
    var all = await idbAll();
    for (var i = 0; i < all.length; i++) if (ids.indexOf(all[i][0]) >= 0) o.covers[all[i][0]] = await blobToDataURL(all[i][1]);
  }
  return JSON.stringify(o);
}
function prepBackup() {
  var btns = [$('#btnShareBackup'), $('#btnBackup')], n = coverIds().length;
  if (!n) { btns.forEach(function (x) { x.disabled = false; }); return; }
  btns.forEach(function (x) { x.disabled = true; });
  $('#backupNote').textContent = 'Preparo il backup con ' + n + (n === 1 ? ' tua foto' : ' tue foto') + '…';
  buildBackup().then(function (data) {
    backupReady = data;
    btns.forEach(function (x) { x.disabled = false; });
    $('#backupNote').textContent = 'Il backup comprende ' + n + (n === 1 ? ' tua foto' : ' tue foto') + ' (copertine e citazioni, ' + (data.length / 1048576).toFixed(1).replace('.', ',') + ' MB).';
  }, function () { btns.forEach(function (x) { x.disabled = false; }); $('#backupNote').textContent = 'Non riesco a leggere le tue foto: il backup comprenderà solo i dati dei libri.'; backupReady = JSON.stringify({ app: 'catalogo-libri', v: 4, books: storable(), cfg: backupCfg() }); });
}
function markBackup() { settings.lastBackup = Date.now(); saveSettings(); updateBackupInfo(); if (noticeKind === 'backup') $('#notice').hidden = true; }
function backup() {
  if (!storable().length) { toast('L\'elenco è vuoto: non c\'è niente da salvare.'); return; }
  if (!backupData()) { openExport(); toast('Preparo il backup con le tue foto: riprova tra un attimo.'); return; }
  downloadBlob(backupName() + '.json', backupData(), 'application/json');
  markBackup();
  toast('Backup scaricato. Tienine una copia anche fuori dal telefono (Drive, email).');
}
/* Condivide il file di backup (Drive, Gmail, WhatsApp…). Chrome condivide solo alcuni tipi di file: se il .json non e' ammesso
   lo mando come .txt (il contenuto e' identico e «Ripristina» lo accetta). Se la condivisione non parte, non scarico in silenzio:
   lo dico, con «Riprova» (un tocco nuovo spesso basta) e «Salvalo nei Download». */
var BK_MAX = 45 * 1048576;   // Chrome su Android manda file fino a circa 50 MB: oltre rifiuta con NotAllowedError (Piero, 18/11/2026)
function bkMB(n) { return (n / 1048576).toFixed(1).replace('.', ',') + ' MB'; }
async function shareBackup(lite) {
  if (!storable().length) { toast('L\'elenco è vuoto: non c\'è niente da salvare.'); return; }
  var data = lite ? JSON.stringify({ app: 'catalogo-libri', v: 4, books: storable(), cfg: backupCfg() }) : backupData(), base = backupName() + (lite ? ' (senza foto)' : ''), file = null;
  if (!data) { openExport(); toast('Preparo il backup con le tue foto: riprova tra un attimo.'); return; }
  if (data.length > BK_MAX) {          // troppo grande per la condivisione: lo dico subito, senza far fallire il telefono
    bkFail('Con le tue foto il backup è di ' + bkMB(data.length) + ': troppo grande per mandarlo da qui (il telefono ne accetta circa 50). Mandalo senza le foto, oppure salvalo intero nei Download e caricalo su Drive dall\'app Drive.', false, true);
    return;
  }
  try {
    // prima il .txt (19/11/2026): Chrome 157 su Android dice sì al .json in canShare, ma poi la condivisione lo rifiuta (NotAllowedError: Permission denied)
    var cands = [new File([data], base + '.txt', { type: 'text/plain' })];
    for (var i = 0; i < cands.length && !file; i++) if (navigator.canShare && navigator.canShare({ files: [cands[i]] })) file = cands[i];
  } catch (e) { file = null; }
  if (!file || !navigator.share) { bkFail('Questo telefono non permette di inviare il file da qui.', false, false); return; }
  var diag = '';                       // per capire perché non parte (Piero, 19/11/2026): si vede nel messaggio
  try {
    var ua = navigator.userActivation, cv = (navigator.userAgent.match(/Chrome\/(\d+)/) || [])[1];
    diag = ' [tocco ' + (ua ? (ua.isActive ? 'sì' : 'no') : '?') + ' · ' + file.name.split('.').pop() + ' ' + (file.type || '-') + ' · ' + bkMB(file.size) +
      ' · ' + (matchMedia('(display-mode: standalone)').matches ? 'app installata' : 'browser') + (cv ? ' · Chrome ' + cv : '') + ']';
  } catch (e2) { diag = ''; }
  try {
    await navigator.share({ files: [file] });
    if (!lite) markBackup(); $('#bkFailSheet').hidden = true;
    toast(lite ? 'Backup senza foto inviato. Le foto restano solo su questo telefono: salva anche il backup intero nei Download.' : 'Backup inviato.');
  } catch (e) {
    if (e && e.name === 'AbortError') { toast('Invio annullato: il backup non è stato salvato.'); return; }
    var big = !lite && coverIds().length && data.length > 8 * 1048576;
    bkFail('Il telefono non ha aperto la condivisione' + (e && e.name ? ' (' + e.name + (e.message ? ': ' + String(e.message).slice(0, 80) : '') + ')' : '') + diag + '.' + (big ? ' Il backup con le foto è di ' + bkMB(data.length) + ': forse è troppo grande, prova senza le foto.' : ' Di solito riprovando parte.'), true, !lite && coverIds().length > 0);
  }
}
function bkFail(msg, retry, lite) {
  $('#bkFailMsg').textContent = msg;
  $('#bkFailRetry').hidden = !retry;
  $('#bkFailLite').hidden = !lite;
  $('#bkFailSheet').hidden = false;
}
$('#bkFailLite').addEventListener('click', function () { shareBackup(true); });
$('#bkFailRetry').addEventListener('click', function () { shareBackup(false); });
$('#bkFailDl').addEventListener('click', function () { $('#bkFailSheet').hidden = true; backup(); });
$('#bkFailClose').addEventListener('click', function () { $('#bkFailSheet').hidden = true; });
$('#bkFailSheet').addEventListener('click', function (e) { if (e.target === e.currentTarget) $('#bkFailSheet').hidden = true; });
function updateBackupInfo() {
  var n = storable().length;
  $('#backupInfo').textContent = 'Ultimo backup: ' + L.agoText(settings.lastBackup) + ' · ' + n + (n === 1 ? ' libro' : ' libri') + ' salvati solo su questo telefono.';
}
/* Promemoria (giro 7, scelta di Piero): con almeno 10 libri e modifiche non salvate, ogni 45 giorni dall'ultimo backup
   (o da quando l'avviso è stato chiuso), oppure dopo 40 libri nuovi (chiuso: si ripresenta dopo 7 giorni). */
var BK_DAYS = 45, BK_NEW = 40;
function backupDue(ignoreSnooze) {
  var n = storable().length, now = Date.now(), DAY = 86400000, last = settings.lastBackup || 0, sn = ignoreSnooze ? 0 : settings.snooze || 0;
  if (n < 10 || !(state.updated > last)) return false;
  var fresh = state.books.filter(function (b) { return hasData(b) && (b.ts || 0) > last; }).length;
  return now - Math.max(last, sn) > BK_DAYS * DAY || (fresh >= BK_NEW && now - sn > 7 * DAY);
}
/* con le tue foto il backup va preparato prima: lo preparo mentre l'avviso è in vista, cosi' «Fai il backup» lo manda con un tocco */
var bkWarm = 0;
function warmBackup() {
  if (!coverIds().length || bkWarm === state.updated) return;
  var at = state.updated; bkWarm = at;
  buildBackup().then(function (d) { if (bkWarm === at) backupReady = d; }, function () { bkWarm = 0; });
}
function backupTap() {
  if (!coverIds().length || (backupReady && bkWarm === state.updated)) shareBackup();
  else openExport();
}
function checkBackupNag() {
  if (scanning) return;
  var n = storable().length;
  if (!backupDue()) { if (noticeKind === 'backup') { $('#notice').hidden = true; noticeKind = ''; } return; }
  if (noticeKind === 'backup' || !$('#notice').hidden) return;
  warmBackup();
  notice('Ultimo backup: ' + L.agoText(settings.lastBackup) + '. I ' + n + ' libri sono salvati solo su questo telefono: se cambi telefono o cancelli i dati del browser li perdi. Mandalo su Drive, WhatsApp o email con un tocco.',
    'Fai il backup', backupTap, function () { settings.snooze = Date.now(); saveSettings(); }, 'backup');
}
/* dal backup: l'API torna tra le salvate; se qui manca, la rimette in uso. Restituisce cosa ha rimesso. I worker dei backup vecchi si ignorano (031). */
function restoreCfg(c) {
  if (!c || typeof c !== 'object') return '';
  var okK = function (v) { return typeof v === 'string' ? v.replace(/\s+/g, '') : ''; };
  var sv = c.saved || {}, put = [];
  (Array.isArray(sv.key) ? sv.key : []).concat([c.gbKey]).map(okK).filter(Boolean).forEach(function (v) { if (saved.key.indexOf(v) < 0 && saved.key.length < 4) saved.key.push(v); });
  ls.set(LS_SAVED, JSON.stringify(saved));
  var k2 = okK(c.gbKey);
  if (k2 && !settings.gbKey) { setSvc('key', k2); put.push('l’API Google'); }
  renderSvc();
  return put.join(' e ');
}
function restore(file) {
  var rd = new FileReader();
  rd.onload = function () {
    try {
      var d = JSON.parse(String(rd.result));
      if (d && d.share) {                                  // non e' un backup: e' una lista ricevuta da un amico
        var sh = L.parseShare(d.share);
        if (!sh) throw new Error('lista');
        $('#exportSheet').hidden = true; openImport(sh); return;
      }
      var incoming = (d.books || []).map(cleanBook).filter(Boolean);
      var have = {};
      state.books.forEach(function (b) { have[b.id] = 1; });
      var n = 0;
      incoming.forEach(function (b) { if (!have[b.id]) { state.books.push(b); n++; } });
      if (!incoming.length && !Array.isArray(d.books)) throw new Error('formato');
      var nc = 0;
      if (d.covers && typeof d.covers === 'object') Object.keys(d.covers).forEach(function (id) {
        if (/^q:/.test(id)) { if (!qphURL[id] && quotePhKeys().indexOf(id) >= 0 && /^data:image\//.test(d.covers[id])) { nc++; fetch(d.covers[id]).then(function (r) { return r.blob(); }).then(function (bl) { return saveQuotePh(id, bl); }).then(function () { paintQuotesAll(); }).catch(function () {}); } return; }
        if (get(id) && !coverURL[id] && /^data:image\//.test(d.covers[id])) { nc++; saveCoverData(id, d.covers[id]); }
      });
      var cfg = restoreCfg(d.cfg);
      touch(); renderList(); updateSummary();
      toast(n + (n === 1 ? ' libro ripristinato' : ' libri ripristinati') + (nc ? ', ' + nc + ' foto' : '') + '.' +
        (cfg ? ' Torn' + (/ e /.test(cfg) ? 'ano' : 'a') + ' in uso anche ' + cfg + '.' : ''));
    } catch (e) { toast('Il file non è un backup né una lista di Next Libris.'); }
  };
  rd.readAsText(file);
}

/* ---------- copertine: le tue foto (salvate sul telefono) e versioni grandi ---------- */
var coverURL = {};          // id libro -> immagine della tua foto (dal database del telefono)
var coverPhotoId = null, noBig = {}, probing = {};
var idbP = null;
function idb() {
  if (idbP) return idbP;
  idbP = new Promise(function (res, rej) {
    if (!window.indexedDB) { rej(new Error('IndexedDB non disponibile')); return; }
    var r = indexedDB.open((COPIA ? COPIA + '-' : '') + 'catalogo-libri', 1);   // copertine e foto: anche queste separate in ogni copia
    r.onupgradeneeded = function () { r.result.createObjectStore('covers'); };
    r.onsuccess = function () { res(r.result); };
    r.onerror = function () { rej(r.error); };
  });
  idbP.catch(function () { idbP = null; });
  return idbP;
}
function idbDo(mode, fn) {
  return idb().then(function (db) {
    return new Promise(function (res, rej) {
      var tx = db.transaction('covers', mode);
      fn(tx.objectStore('covers'));
      tx.oncomplete = function () { res(); };
      tx.onerror = tx.onabort = function () { rej(tx.error || new Error('db')); };
    });
  });
}
function idbAll() {
  return idb().then(function (db) {
    return new Promise(function (res, rej) {
      var out = [], tx = db.transaction('covers', 'readonly'), rq = tx.objectStore('covers').openCursor();
      rq.onsuccess = function () { var c = rq.result; if (c) { out.push([String(c.key), c.value]); c.continue(); } };
      tx.oncomplete = function () { res(out); };
      tx.onerror = function () { rej(tx.error); };
    });
  });
}
function blobToDataURL(blob) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result)); }; r.onerror = rej; r.readAsDataURL(blob); }); }
function askPersist() { try { if (navigator.storage && navigator.storage.persist) navigator.storage.persisted().then(function (p) { if (!p) navigator.storage.persist(); }); } catch (e) { nlErr(e); } }
async function loadCovers() {
  try {
    var all = await idbAll(), keep = 0, gone = [];
    var qk = quotePhKeys();
    all.forEach(function (kv) {
      if (/^q:/.test(kv[0])) { if (qk.indexOf(kv[0]) >= 0) { qphURL[kv[0]] = URL.createObjectURL(kv[1]); keep++; } else gone.push(kv[0]); return; }   // foto delle citazioni
      if (get(kv[0])) { coverURL[kv[0]] = URL.createObjectURL(kv[1]); keep++; }
      else gone.push(kv[0]);                                   // libro eliminato: tolgo anche la foto
    });
    if (gone.length) idbDo('readwrite', function (st) { gone.forEach(function (k) { st.delete(k); }); }).catch(function () {});
    if (keep) { syncThumbs(); renderList(); }
    if (!$('#allqSheet').hidden) renderAllQuotes();
  } catch (e) { /* senza database le tue foto non si possono salvare: restano le copertine scaricate */ }
}
async function saveCover(id, blob) {
  await idbDo('readwrite', function (st) { st.put(blob, id); });
  if (coverURL[id]) URL.revokeObjectURL(coverURL[id]);
  coverURL[id] = URL.createObjectURL(blob);
  askPersist();
  touch(); syncThumbs(); refreshRow(id);
}
/* foto -> JPEG di al massimo 900 px, salvato sul telefono */
async function saveCoverCanvas(id, canvas) {
  var c = scaled(canvas, 900);
  var blob = await new Promise(function (res) { c.toBlob(res, 'image/jpeg', 0.82); });
  if (!blob) throw new Error('jpeg');
  await saveCover(id, blob);
}
function saveCoverData(id, du) {
  var img = new Image();
  img.onload = function () {
    var c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    saveCoverCanvas(id, c).catch(function () {});
  };
  img.src = du;
}
async function removeCover(id) {
  await idbDo('readwrite', function (st) { st.delete(id); });
  if (coverURL[id]) URL.revokeObjectURL(coverURL[id]);
  delete coverURL[id];
  touch(); syncThumbs(); refreshRow(id);
}
/* Prova un'immagine: vale come copertina grande se arriva, e' larga almeno 250 px e ha le proporzioni di un libro. */
function testImage(u) {
  return new Promise(function (res) {
    var im = new Image(), t = setTimeout(function () { res(false); }, 12000);
    im.referrerPolicy = 'no-referrer';
    im.onload = function () { clearTimeout(t); var w = im.naturalWidth, h = im.naturalHeight, r = h / Math.max(1, w); res(w >= 250 && r > 1.05 && r < 2.1 && !(w === 575 && h === 750 && /books\.google/.test(u))); };   // 575x750: «immagine non disponibile» di Google
    im.onerror = function () { clearTimeout(t); res(false); };
    im.src = u;
  });
}
/* Cerca la copertina grande: prima Google (la stessa immagine, piu' grande: zoom=0 o 3, senza richieste alle API), poi Open Library. La ricorda nel libro. */
function googleBig(img) {
  if (!L.googleVolumeId(img)) return [];
  var u = String(img).replace(/^http:\/\//i, 'https://').replace(/&edge=curl/g, '');
  /* solo zoom=3 (medium): zoom=0 spesso da' la prima pagina del libro, non la copertina (17/11/2026) */
  return ['3'].map(function (z) { return /[?&]zoom=\d/.test(u) ? u.replace(/([?&]zoom=)\d/, '$1' + z) : u + '&zoom=' + z; }).filter(function (x) { return x !== img; });
}
function probeCover(id) {
  var b = get(id);
  if (!b || b.imgL || coverURL[id] || b.nb || !(b.img || L.toIsbn13(b.i))) return Promise.resolve(!!(b && (b.imgL || coverURL[id])));
  if (probing[id]) return probing[id];
  probing[id] = (async function () {
    var cands = googleBig(b.img), sure = navigator.onLine !== false;           // niente richieste a Google: si prova l'immagine grande dallo stesso indirizzo (16/11/2026)
    cands = cands.concat(L.coverCandidates(b.img, b.i));
    for (var i = 0; i < cands.length; i++) {
      if (await testImage(cands[i])) {
        var x = get(id);
        if (x && !x.imgL) { x.imgL = cands[i]; x.nb = false; touch(); refreshRow(id); emit('bigCover', { i: L.toIsbn13(x.i), t: x.t, imgL: cands[i] }); }
        return true;
      }
    }
    var y = get(id);
    if (y && sure && navigator.onLine !== false) { y.nb = true; touch(); }       // non esiste: non lo richiedo piu'
    return false;
  })();
  return probing[id].then(function (ok) { delete probing[id]; if (!ok) noBig[id] = true; return ok; });
}
/* ---------- libro senza copertina: prima di aprire la fotocamera la cerco online ----------
   1) stessa edizione (stesso ISBN): Open Library e Google Libri;
   2) altrimenti la copertina di un'altra edizione: Open Library (opera dell'ISBN) e Google Libri per titolo e autore.
   Tutto entro pochi secondi: Chrome lascia aprire la fotocamera solo poco dopo il tocco. */
var covSearching = {}, covNone = {};
function testImg(u, minW, ms) {
  return new Promise(function (res) {
    var im = new Image(), t = setTimeout(function () { im.onload = im.onerror = null; res(0); }, ms || 3000);
    im.referrerPolicy = 'no-referrer';
    im.onload = function () { clearTimeout(t); var w = im.naturalWidth, r = im.naturalHeight / Math.max(1, w); res(w >= (minW || 80) && r > 1.05 && r < 2.1 ? w : 0); };
    im.onerror = function () { clearTimeout(t); res(0); };
    im.src = u;
  });
}
function tkey(s) { return L.norm(s).replace(/[^a-z0-9]+/g, ' ').trim(); }
function gThumb(v) { var l = v && v.imageLinks; var u = l && (l.thumbnail || l.smallThumbnail); return u ? String(u).replace(/^http:\/\//i, 'https://').replace(/&edge=curl/g, '') : ''; }
async function findCover(b, budget, sameOnly) {
  var deadline = Date.now() + (budget || 3500);
  function left() { return Math.max(300, deadline - Date.now()); }
  var isbn = L.toIsbn13(b.i), i10 = isbn ? L.isbn13to10(isbn) : '', useG = googleLeft(false);
  function gq(q, n) {
    return L.getJson(apiFetch, 'https://www.googleapis.com/books/v1/volumes?q=' + encodeURIComponent(q) + '&maxResults=' + n +
      '&fields=items(volumeInfo(title,authors,language,publisher,industryIdentifiers,imageLinks))' + (settings.gbKey ? '&key=' + encodeURIComponent(settings.gbKey) : ''), { waits: [], timeout: left() });
  }
  async function img(u, rank, alt, minW) { var w = u ? await testImg(u, minW || 80, left()) : 0; return w ? { url: u, big: w >= 250, alt: alt, rank: rank } : null; }
  function safe(p) { return p.then(function (x) { return x; }, function () { return null; }); }
  var jobs = [];
  if (isbn) {
    [isbn, i10].filter(Boolean).forEach(function (x) { jobs.push(safe(img('https://covers.openlibrary.org/b/isbn/' + x + '-L.jpg?default=false', 1, false))); });
    if (useG) jobs.push(safe(gq('isbn:' + isbn, 3).then(function (j) {
      var v = ((j && j.items) || []).map(function (it) { return it.volumeInfo; }).filter(function (v) { return gThumb(v); })[0];
      return v ? img(gThumb(v), 2, false, 60) : null;
    })));
    jobs.push(safe(L.getJson(fetch, 'https://openlibrary.org/search.json?q=' + encodeURIComponent('isbn:' + isbn) + '&fields=cover_i&limit=1', { waits: [], timeout: left() }).then(function (j) {
      var c = j && j.docs && j.docs[0] && j.docs[0].cover_i;
      return c ? img('https://covers.openlibrary.org/b/id/' + c + '-L.jpg', 3, true) : null;
    })));
  }
  var tk = tkey(b.t), sur = tkey(String(b.a || '').split(/[,;]| e /)[0]).split(' ').pop() || '';
  if (!sameOnly && useG && tk.length >= 3) jobs.push(safe(gq('intitle:"' + b.t + '"' + (sur ? ' inauthor:' + sur : ''), 10).then(function (j) {
    var ok = ((j && j.items) || []).map(function (it) { return it.volumeInfo || {}; }).filter(function (v) {
      var vt = tkey(v.title);
      if (!gThumb(v) || !vt || !(vt.indexOf(tk) === 0 || tk.indexOf(vt) === 0)) return false;
      return !sur || (v.authors || []).some(function (a) { return tkey(a).indexOf(sur) >= 0; });
    });
    var same = ok.filter(function (v) { return isbn && (v.industryIdentifiers || []).some(function (x) { return L.toIsbn13(x.identifier) === isbn; }); })[0];
    if (same) return img(gThumb(same), 2, false, 60);
    var pub = tkey(b.e);
    ok.sort(function (x, y) {
      function sc(v) { return (v.language === 'it' ? 2 : 0) + (pub && tkey(v.publisher).indexOf(pub) >= 0 ? 1 : 0); }
      return sc(y) - sc(x);
    });
    return ok[0] ? img(gThumb(ok[0]), 4, true, 60) : null;
  })));
  // la migliore: stessa edizione prima di un'altra, grande prima di piccola; una grande della stessa edizione chiude subito la ricerca
  return new Promise(function (res) {
    var best = null, pending = jobs.length;
    if (!pending) { res(null); return; }
    jobs.forEach(function (p) {
      p.then(function (x) {
        if (x && (!best || x.rank < best.rank || (x.rank === best.rank && x.big && !best.big))) best = x;
        if (--pending === 0 || (best && !best.alt && best.big)) res(best);
      });
    });
  });
}
function openCoverCamera(id) { coverPhotoId = id; snapPhoto('Foto della copertina', '#fileCover').then(function (f) { if (f) coverFromFile(f); else coverPhotoId = null; }); }
var covAskId = null;
function askCoverPhoto(id, msg) { covAskId = id; $('#covMsg').textContent = msg; $('#toast').hidden = true; $('#covSheet').hidden = false; }
function closeCovAsk() { $('#covSheet').hidden = true; covAskId = null; }
$('#covShot').addEventListener('click', function () { var id = covAskId; closeCovAsk(); if (id) openCoverCamera(id); });
$('#covLater').addEventListener('click', closeCovAsk);
$('#covSheet').addEventListener('click', function (e) { if (e.target === e.currentTarget) closeCovAsk(); });
async function coverTap(id) {
  var b = get(id);
  if (!b || covSearching[id]) return;
  if (navigator.onLine === false) { askCoverPhoto(id, 'Sei senza rete: non posso cercarla online. Puoi fotografarla tu.'); return; }
  covSearching[id] = true; refreshRow(id);
  var r = null;
  try { r = await findCover(b, 3500); } catch (e) { nlErr(e); }
  delete covSearching[id];
  var x = get(id);
  if (!x) return;
  if (r && !smallImg(x)) {
    var before = { img: x.img, imgL: x.imgL, nb: x.nb };
    x.img = r.url; if (r.big) x.imgL = r.url; x.nb = false;
    touch(); syncThumbs(); refreshRow(id);
    if (r.alt) toast('Ho trovato la copertina di un\'altra edizione: controlla che vada bene.', { label: 'Non è questa', fn: function () {
      var y = get(id); if (y) { Object.assign(y, before); touch(); syncThumbs(); refreshRow(id); } covNone[id] = true; openCoverCamera(id); } });
    else toast('Copertina trovata.', { label: 'Usa una mia foto', fn: function () { openCoverCamera(id); } });
    return;
  }
  refreshRow(id);
  askCoverPhoto(id, 'Non ho trovato online la copertina di «' + (x.t || 'ISBN ' + x.i) + '». Puoi fotografarla tu.');
}
async function improveCovers() {
  var todo = state.books.filter(function (b) { return !b.imgL && !coverURL[b.id] && !b.nb && (b.img || L.toIsbn13(b.i)); });
  if (!todo.length) { toast('Non ci sono copertine da migliorare: per gli altri libri ho già controllato che non ne esista una più grande.'); return; }
  if (!googleLeft(true)) { toast('Le ricerche di Google per oggi le tengo per i libri nuovi: riprova domani.'); return; }
  if (navigator.onLine === false) { toast('Sei offline. Riprova quando c\'è connessione.'); return; }
  var btn = $('#btnCovers'), done = 0, found = 0;
  btn.disabled = true;
  await Promise.all(todo.map(function (b) {
    return coverPool(async function () {
      delete noBig[b.id];
      if (await probeCover(b.id)) found++;
      btn.textContent = 'Cerco le copertine… ' + (++done) + '/' + todo.length;
    });
  }));
  btn.disabled = false; btn.textContent = 'Cerca copertine più grandi';
  renderList();
  toast('Trovate ' + found + ' copertine grandi su ' + todo.length + '.' + (found < todo.length ? ' Per le altre puoi usare una tua foto: tocca la copertina e poi «Usa una mia foto».' : ''));
}

/* ---------- copertina in grande ---------- */
var lbToken = 0, lbPushed = false, lbId = null;
function lbButtons(b) {
  var local = !!coverURL[b.id];
  $('#lbPhoto').textContent = local ? 'Rifai la foto' : 'Usa una mia foto';
  $('#lbReset').hidden = !local;
  $('#lbReset').textContent = (b.imgL || b.img) ? 'Torna alla copertina scaricata' : 'Togli la mia foto';
}
function openCover(id) {
  var b = get(id);
  if (!b) return;
  var src = bigImg(b);
  if (!src) return;
  lbId = id;
  var tok = ++lbToken, img = $('#lbImg');
  img.src = src;
  $('#lbCap').textContent = [b.t || 'Senza titolo', b.a].filter(Boolean).join(' — ');
  lbButtons(b);
  var tryBig = !coverURL[id] && !b.imgL && !noBig[id] && !b.nb && !!(b.img || L.toIsbn13(b.i));
  $('#lbNote').textContent = tryBig ? 'Cerco un\'immagine più grande…'
    : (!coverURL[id] && !b.imgL && (b.img || b.nb) ? 'Non esiste una versione più grande: per una copertina migliore usa una tua foto.' : '');
  $('#lightbox').hidden = false;
  if (!lbPushed) { try { history.pushState({ lb: 1 }, ''); lbPushed = true; } catch (e) { nlErr(e); } }
  $('#lbClose').focus({ preventScroll: true });
  if (tryBig) probeCover(id).then(function (ok) {
    if (tok !== lbToken) return;
    var x = get(id);
    if (ok && x && x.imgL && !coverURL[id]) { img.src = x.imgL; $('#lbNote').textContent = ''; }
    else if (!coverURL[id]) $('#lbNote').textContent = 'Non esiste una versione più grande: per una copertina migliore usa una tua foto.';
  });
}
function closeCover(fromPop) {
  if ($('#lightbox').hidden) return;
  lbToken++;
  $('#lightbox').hidden = true;
  $('#lbImg').removeAttribute('src');
  if (lbPushed && !fromPop) { lbPushed = false; try { history.back(); } catch (e) { nlErr(e); } }
  lbPushed = false;
}
$('#lbClose').addEventListener('click', function () { closeCover(false); });
$('#lbPhoto').addEventListener('click', function (e) { e.stopPropagation(); openCoverCamera(lbId); });
$('#lbReset').addEventListener('click', async function (e) {
  e.stopPropagation();
  var id = lbId, b = get(id);
  if (!b) return;
  try { await removeCover(id); } catch (err) { toast('Non riesco a togliere la foto.'); return; }
  var src = bigImg(b);
  if (!src) { closeCover(false); toast('Foto tolta.'); return; }
  $('#lbImg').src = src; $('#lbNote').textContent = ''; lbButtons(b);
});
bindFile('#fileCover', function (f) { coverFromFile(f[0]); });
async function coverFromFile(file) {
  var f = [file];
  var id = coverPhotoId; coverPhotoId = null;
  if (!id || !get(id)) return;
  try {
    var canvas = await loadCanvas(f[0], 1400);
    await saveCoverCanvas(id, canvas);
    if (!$('#lightbox').hidden && lbId === id) { $('#lbImg').src = coverURL[id]; $('#lbNote').textContent = '✓ Copertina salvata sul telefono (e nel backup).'; lbButtons(get(id)); }
    else toast('Copertina salvata sul telefono (e nel backup).');
  } catch (e) { toast('Non riesco a salvare la foto sul telefono.'); }
}
$('#btnCovers').addEventListener('click', improveCovers);
$('#lightbox').addEventListener('click', function (e) { if (e.target === e.currentTarget || e.target.id === 'lbCap' || e.target.id === 'lbNote') closeCover(false); });
window.addEventListener('popstate', function () { if (!$('#lightbox').hidden) { lbPushed = false; closeCover(true); } });

function setRead(id, what, v) {
  var b = get(id);
  if (!b) return;
  if (what === 'rs') {
    b.rs = b.rs === v ? '' : v;
    if (b.rs === 'ok' && !b.rd) b.rd = today();
  } else {
    var n = parseInt(v, 10) || 0;
    b.rt = b.rt === n ? 0 : n;
  }
  touch(); refreshRow(id); updateSummary();
  var el = rowEl(id), f = el && el.querySelector('[data-act="' + what + '"][data-v="' + v + '"]');
  if (f) f.focus({ preventScroll: true });
}
