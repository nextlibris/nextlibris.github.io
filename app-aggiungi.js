/* Next Libris · app, parte 2 di 10 (app-aggiungi.js): aggiunta dei libri: codici a barre, ISBN, foto, scansione dal vivo, «Ce l'ho già?».
   Dal 17/11/2026 app.js è diviso in 10 file (prima era una sola funzione). Sono script classici, senza import:
   le funzioni e le variabili di primo livello sono globali e servono a tutte le parti; l'ordine in index.html
   e in SHELL di sw.js conta (app.js, app-aggiungi.js, …, app-avvio.js: l'ultima fa partire l'app). */
'use strict';
/* ---------- lettura di codici a barre ---------- */
var detector = null;
(async function () {
  try {
    if ('BarcodeDetector' in window) {
      var f = await window.BarcodeDetector.getSupportedFormats();
      if (f.indexOf('ean_13') >= 0) detector = new window.BarcodeDetector({ formats: ['ean_13'] });
    }
  } catch (e) { nlErr(e); }
})();
var zx = null;
function zxReader() {
  if (zx) return zx;
  var hints = new Map();
  hints.set(window.ZXing.DecodeHintType.POSSIBLE_FORMATS, [window.ZXing.BarcodeFormat.EAN_13]);
  hints.set(window.ZXing.DecodeHintType.TRY_HARDER, true);
  zx = new window.ZXing.MultiFormatReader();
  zx.setHints(hints);
  return zx;
}
function zxDecode(canvas) {
  try {
    var src = new window.ZXing.HTMLCanvasElementLuminanceSource(canvas);
    var bmp = new window.ZXing.BinaryBitmap(new window.ZXing.HybridBinarizer(src));
    return L.toIsbn13(zxReader().decode(bmp).getText());
  } catch (e) { return ''; }
}
function scaled(canvas, max) {
  var k = Math.min(1, max / Math.max(canvas.width, canvas.height));
  if (k >= 1) return canvas;
  var c = document.createElement('canvas');
  c.width = Math.round(canvas.width * k); c.height = Math.round(canvas.height * k);
  c.getContext('2d', { willReadFrequently: true }).drawImage(canvas, 0, 0, c.width, c.height);
  return c;
}
async function decodeCanvasBarcode(canvas) {
  if (detector) {
    try {
      var r = await detector.detect(canvas);
      for (var i = 0; i < r.length; i++) { var v = L.toIsbn13(r[i].rawValue); if (v) return v; }
    } catch (e) { nlErr(e); }
  }
  var sizes = [2000, 1400, 900];
  for (var j = 0; j < sizes.length; j++) {
    var code = zxDecode(scaled(canvas, sizes[j]));
    if (code) return code;
    await new Promise(function (r2) { setTimeout(r2, 0); });
  }
  // codice piccolo in una foto grande (il retro di un libro): provo a leggere solo una parte della foto, soprattutto la metà bassa
  var tiles = [[0, .5, 1, .5], [0, .66, 1, .34], [0, .5, .6, .5], [.4, .5, .6, .5], [0, 0, 1, .5], [0, .25, 1, .5]];
  for (var ti = 0; ti < tiles.length; ti++) {
    var T = tiles[ti], t = document.createElement('canvas');
    t.width = Math.max(1, Math.round(canvas.width * T[2])); t.height = Math.max(1, Math.round(canvas.height * T[3]));
    t.getContext('2d', { willReadFrequently: true }).drawImage(canvas, canvas.width * T[0], canvas.height * T[1], canvas.width * T[2], canvas.height * T[3], 0, 0, t.width, t.height);
    var c2 = zxDecode(t);
    if (c2) return c2;
    await new Promise(function (r3) { setTimeout(r3, 0); });
  }
  return '';
}

/* ---------- ISBN: aggiunta e ricerca ---------- */
function findByIsbn(code) { return state.books.find(function (b) { return L.toIsbn13(b.i) === code; }); }
/* opts.wish: aggiunge ai Desideri (di default: la scheda aperta). opts.pre: risultato della ricerca gia' pronto.
   Se il libro e' nei Desideri e lo aggiungo alla Libreria, lo sposto (vuol dire che l'ho comprato). */
function addIsbn(code, opts) {
  opts = opts || {};
  var wish = opts.wish != null ? !!opts.wish : tab === 'wish';
  var ex = findByIsbn(code);
  if (ex) {
    if (ex.w && !wish) { ex.w = false; ex.ts = Date.now(); if (!ex.rs) ex.rs = 'da'; touch(); return { moved: ex }; }
    return { dup: ex };
  }
  var b = blankBook({ i: code, w: wish });
  state.books.push(b);
  if (opts.pre) { applyResult(b, opts.pre, code); touch(); return { book: b, done: Promise.resolve() }; }
  S[b.id] = { st: 'queued' };
  touch();
  return { book: b, done: lookupPool(function () { return doLookup(b.id); }) };
}
function takeDesc(b, ds, lang) { if (ds && !b.ds) { b.ds = ds; b.dsf = 'g'; b.dsl = lang || L.guessLang(ds) || ''; b.dsn = 0; b.dsq = 0; } }
function applyResult(b, r, code) {
  takeDesc(b, r.ds, r.dsl);
  if (!b.t) b.t = r.t;
  if (!b.a) b.a = r.a;
  if (!b.e) b.e = r.e;
  if (!b.y) b.y = r.y;
  if (!b.gen && r.gen) b.gen = r.gen;
  if (!b.pg && r.pg) b.pg = r.pg;
  if (r.img && !(S[b.id] && S[b.id].keepImg && b.img)) b.img = r.img;
  b.i = code; b.nf = false;
  b.g = b.g.filter(function (k) { return ['t', 'a', 'e', 'y', 'i'].indexOf(k) < 0; });
  guessEditor(b);
}
/* Se manca la casa editrice, la deduce dall'ISBN (codice dell'editore). Se la copia dai tuoi libri gia' verificati con lo
   stesso codice, e quei libri hanno tutti lo stesso editore, e' affidabile: niente "da verificare". Se viene dalla
   tabellina generica, o i tuoi libri con quel codice hanno editori diversi, resta "da verificare". */
/* ISBN 979-8: quasi sempre l'ISBN gratuito che Amazon (KDP) da' a chi si pubblica da solo; le banche dati di solito non lo conoscono */
var KDP_E = 'Amazon (pubblicazione in proprio)';
function isKdp(b) { return /^9798/.test(L.toIsbn13(b && b.i) || ''); }
function markKdp(b) { if (b && b.nf && !b.t && !b.e && isKdp(b)) { b.e = KDP_E; b.g = b.g.filter(function (k) { return k !== 'e'; }); return true; } return false; }
/* 029 (Piero, 19/11/2026): libro che nessuna banca dati conosce, completato a mano (titolo e autore) o riconosciuto dalla foto:
   si propone all'archivio comune dopo una pausa; entra solo quando l'amministratore lo approva */
var propT = {}, proposed = {};
function proposeLater(b) {
  var code = L.toIsbn13(b && b.i);
  if (guest || !code || !b.t || !b.a || !b.nf || !window.NL || !NL.archive || !NL.archive.propose) return;
  clearTimeout(propT[b.id]);
  propT[b.id] = setTimeout(async function () {
    delete propT[b.id];
    var x = get(b.id); if (!x || !x.t || !x.a || L.toIsbn13(x.i) !== code) return;
    var r = await NL.archive.propose(code, x);
    if (r === 'ok' && !proposed[code]) { proposed[code] = 1; toast('Grazie! Controlliamo i dati: poi chi cerca questo libro lo troverà già pronto.'); }
  }, 4000);
}
function guessEditor(b) {
  if (b.e) return false;
  var g = L.guessPublisher(b.i, state.books);
  if (!g) return false;
  b.e = g.name;
  if (g.sure) b.g = b.g.filter(function (k) { return k !== 'e'; });
  else if (b.g.indexOf('e') < 0) b.g.push('e');
  return g.sure ? 'sure' : 'guess';
}
/* Una volta sola: toglie «Da verificare» dalle case editrici gia' dedotte che coincidono con quella dei tuoi libri verificati. */
function confirmLearnedPublishers() {
  if (settings.pubFix) return;
  settings.pubFix = true; saveSettings();
  var done = [];
  state.books.forEach(function (b) {
    if (b.g.length !== 1 || b.g[0] !== 'e' || !b.e || !L.toIsbn13(b.i)) return;
    var g = L.guessPublisher(b.i, state.books);
    if (g && g.sure && L.norm(g.name) === L.norm(b.e)) { b.g = []; done.push(b.id); }
  });
  if (!done.length) return;
  touch();
  setTimeout(function () {
    notice('Ho tolto «Da verificare» da ' + done.length + (done.length === 1 ? ' casa editrice: coincide' : ' case editrici: coincidono') + ' con quella dei tuoi libri già verificati con lo stesso codice editore.',
      'Annulla', function () { done.forEach(function (id) { var x = get(id); if (x && x.g.indexOf('e') < 0) x.g.push('e'); }); renderList(); touch(); updateSummary(); });
  }, 800);
}
async function doLookup(id) {
  var b = get(id);
  if (!b) return;
  var s = S[id] || (S[id] = {});
  var code = L.toIsbn13(b.i);
  if (!code) { delete s.st; refreshRow(id); return; }
  if (navigator.onLine === false) {
    s.st = 'wait'; s.err = 'Senza connessione: lo cerco da solo appena torna la rete.'; s.retry = 'lookup';
    refreshRow(id); updateSummary();
    if (!offlineNoted) { offlineNoted = true; toast('Sei offline: i libri restano salvati con l\'ISBN e li cerco da soli appena torna la rete.'); }
    return;
  }
  s.st = 'lookup';
  refreshRow(id);
  try {
    var r = await findIsbn(code);
    b = get(id);
    if (!b) return;
    clearTimeout(s.timer); delete s.tries;
    b.ck = today();
    if (r) {
      applyResult(b, r, code);
      delete s.st;
      coverPool(function () { return probeCover(id); });
      queueDesc(id);
      delete s.heard;
    } else {
      b.nf = true;
      if (!markKdp(b)) guessEditor(b);           // 979-8 non trovato: e' una pubblicazione Amazon
      delete s.st;
      heardFail(id);
    }
    touch();
  } catch (e) {
    b = get(id);
    if (!b) return;
    if (e && (e.code === 'network' || e.code === 'rate')) {
      // rete debole o limite di Google: riprovo da solo, sempre piu' di rado
      s.tries = (s.tries || 0) + 1;
      var rate = e.code === 'rate', waits = rate ? [90, 180, 300, 600] : [20, 60, 180, 600];
      var sec = waits[Math.min(s.tries - 1, waits.length - 1)];
      var when = sec < 60 ? sec + ' secondi' : sec === 90 ? 'un minuto e mezzo' : Math.round(sec / 60) + (sec === 60 ? ' minuto' : ' minuti');
      s.retry = 'lookup';
      if (rate && s.tries > waits.length) {
        s.st = 'error'; heardFail(id);
        s.err = e.nokey ? 'Open Library e le biblioteche non conoscono questo libro e l’API Google Libri che ti avevano prestato non c’è più. Con una tua API (è gratis) lo trovi: Indice › Ricerca dei libri. Intanto puoi premere Riprova o fotografare la copertina.'
          : settings.gbKey ? 'Google Libri ha raggiunto il limite di richieste della tua API. Riprova più tardi.'
          : 'Open Library e le biblioteche non conoscono questo libro e senza un’API Google Libri Google non risponde. Con la tua API (è gratis) lo trovi: Indice › Ricerca dei libri. Intanto puoi premere Riprova o fotografare la copertina.';
      } else {
        s.st = 'wait';
        s.err = (rate ? (settings.gbKey && !googleLeft(false) ? 'Ricerche di oggi su Google quasi finite (' + quota.g + ' su 1.000): riprovo con le altre banche dati tra ' + when + ' (Google riparte verso le 9 del mattino)' : (e.nokey ? 'Non lo trovo nelle banche dati libere e l’API Google Libri che ti avevano prestato non c’è più' : settings.gbKey ? 'Google Libri è al limite di richieste' : 'Non lo trovo nelle banche dati libere e senza un’API Google Libri Google non risponde')) : (navigator.onLine === false ? 'Senza connessione' : 'Connessione debole')) + (rate && settings.gbKey && !googleLeft(false) ? '.' : ': riprovo da solo tra ' + when + '.');
        clearTimeout(s.timer);
        s.timer = setTimeout(function () { var x = S[id]; if (x && x.st === 'wait' && get(id)) { x.st = 'queued'; refreshRow(id); lookupPool(function () { return doLookup(id); }); } }, sec * 1000);
      }
    }
    else { delete s.st; }
  }
  refreshRow(id);
  updateSummary();
}
function todoRows() {
  return state.books.filter(function (b) { return !b.t && !b.nf && L.toIsbn13(b.i) && !isBusy(b); });
}
function runTodo() {
  if (guest) return;                               // i libri di un amico non si toccano
  if (navigator.onLine === false) { toast('Sei offline. Riprova quando c\'è connessione.'); return; }
  todoRows().forEach(function (b) {
    autoOpened[b.id] = 1;                          // ricerca di libri gia' in elenco: la scheda non si apre da sola se non trova (Piero, 16/11/2026)
    S[b.id] = Object.assign(S[b.id] || {}, { st: 'queued' });
    lookupPool(function () { return doLookup(b.id); });
    refreshRow(b.id);
  });
  updateSummary();
}

/* ---------- foto: codice a barre oppure copertina ---------- */
async function loadCanvas(file, max) {
  var bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch (e) { bmp = await createImageBitmap(file); }
  var k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  var c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
  c.getContext('2d', { willReadFrequently: true }).drawImage(bmp, 0, 0, c.width, c.height);
  if (bmp.close) bmp.close();
  return c;
}
function thumbOf(canvas) {
  var k = Math.min(1, 140 / Math.max(canvas.width, canvas.height));
  var t = document.createElement('canvas');
  t.width = Math.max(1, Math.round(canvas.width * k)); t.height = Math.max(1, Math.round(canvas.height * k));
  t.getContext('2d').drawImage(canvas, 0, 0, t.width, t.height);
  return t.toDataURL('image/jpeg', 0.7);
}
var ocrP = null;
var ocrMsg = null;                                // chi sta leggendo riceve l'avanzamento (caricamento e lettura)
function getOcr() {
  if (ocrP) return ocrP;
  ocrP = (async function () {
    if (!window.Tesseract) throw { code: 'ocr' };
    var abs = function (p) { return new URL(p, location.href).href; };
    var w = await window.Tesseract.createWorker(['ita', 'eng'], 1, {
      workerPath: abs('vendor/worker.min.js'),
      corePath: abs('vendor/core'),
      langPath: abs('vendor/lang'),
      logger: function (m) { if (ocrMsg && m) { try { ocrMsg(m); } catch (e) { nlErr(e); } } }
    });
    await w.setParameters({ tessedit_pageseg_mode: String(window.Tesseract.PSM.SPARSE_TEXT), preserve_interword_spaces: '1' });
    return w;
  })();
  ocrP.catch(function () { ocrP = null; });
  return ocrP;
}
function setStatusText(id, txt) {
  var el = rowEl(id);
  var span = el && el.querySelector('.status .txt');
  if (span) span.textContent = txt;
}
function capFirst(s) { s = s.toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); }
function niceCase(s, words) {
  if (s !== s.toUpperCase()) return s;
  return words ? s.toLowerCase().replace(/(^|[\s'’-])(\S)/g, function (m, a, c) { return a + c.toUpperCase(); }) : capFirst(s);
}
var sameAs = {};                                  // foto di un libro gia' in elenco -> id del libro esistente
function fromIsbn(id, code, price) {
  var b = get(id), s = S[id];
  if (!b) return;
  var ex = findByIsbn(code);
  if (ex && ex.id !== id) {
    sameAs[id] = ex.id;
    state.books = state.books.filter(function (x) { return x.id !== id; });
    delete S[id];
    refreshRow(id); touch(); updateSummary();
    toast('Già in elenco: ' + (ex.t || code));
    return;
  }
  b.i = code;
  if (price != null && b.c == null) b.c = price;
  s.st = 'lookup';
  touch();
  refreshRow(id);
  return lookupPool(function () { return doLookup(id); });
}
function applyCandidate(id, c) {
  var b = get(id), s = S[id];
  if (!b) return;
  var keep = s && s.keep;                          // libro col suo ISBN (es. pubblicazione Amazon) riconosciuto dalla foto: il codice resta il suo
  b.t = c.t; b.a = c.a; if (c.e || !keep) b.e = c.e; b.y = c.y;
  if (c.gen && !b.gen) b.gen = c.gen;
  if (c.pg && !b.pg) b.pg = c.pg;
  takeDesc(b, c.ds, '');
  if (c.i && !findByIsbn(c.i) && !keep) b.i = c.i;
  if (c.img) b.img = c.img;
  if (!b.img && s.big && !coverURL[id]) saveCoverData(id, s.big);
  b.g = (keep ? ['y'] : ['e', 'y', 'i']).filter(function (k) { return b[k] && !(k === 'e' && b.e === KDP_E); });
  if (s.price != null && b.c == null) b.c = s.price;
  if (keep) proposeLater(b);                       // riconosciuto dalla foto ma il suo ISBN non lo conosce nessuno (029)
  b.nf = false;
  ['st', 'cands', 'lines', 'price', 'err', 'retry', 'keep'].forEach(function (k) { delete s[k]; });
  touch(); refreshRow(id); updateSummary();
  queueDesc(id);
}
function applyOcrText(id) {
  var b = get(id), s = S[id];
  if (!b) return;
  var ta = L.splitTitleAuthor(s.lines || []);
  if (ta.t) { b.t = niceCase(ta.t, false); b.g.push('t'); }
  if (s.big && !b.img && !coverURL[id]) saveCoverData(id, s.big);
  if (ta.a) { b.a = niceCase(ta.a, true); b.g.push('a'); }
  if (s.price != null && b.c == null) b.c = s.price;
  ['st', 'cands', 'lines', 'price', 'err', 'retry'].forEach(function (k) { delete s[k]; });
  if (!hasData(b)) { s.st = 'error'; s.err = 'Non ho letto nulla di utile. Scrivi i dati a mano o prova con il codice a barre.'; }
  touch(); refreshRow(id); updateSummary();
}
/* Lettori leggeri (nati per il prezzo, dal giro 7 solo per l'ISBN scritto): lingua inglese e pochi caratteri, si avviano
   in fretta e si preparano in anticipo. Due in parallelo sui telefoni con piu' processori. */
var priceOcrP = null, PRICE_CHARS = '0123456789.,€EeUuRrOo ';
function getPriceOcr() {
  if (priceOcrP) return priceOcrP;
  priceOcrP = (async function () {
    if (!window.Tesseract) throw { code: 'ocr' };
    var abs = function (p) { return new URL(p, location.href).href; };
    var n = (navigator.hardwareConcurrency || 2) >= 4 ? 2 : 1;
    return Promise.all(Array.apply(null, Array(n)).map(async function () {
      var w = await window.Tesseract.createWorker('eng', 1, { workerPath: abs('vendor/worker.min.js'), corePath: abs('vendor/core'), langPath: abs('vendor/lang') });
      await w.setParameters({ tessedit_pageseg_mode: String(window.Tesseract.PSM.SPARSE_TEXT) });
      w._chars = ''; w._chain = Promise.resolve();
      return w;
    }));
  })();
  priceOcrP.catch(function () { priceOcrP = null; });
  return priceOcrP;
}
/* Una lettura su un lettore, con i suoi caratteri ammessi ('' = tutti): i lavori sullo stesso lettore vanno in fila,
   cosi' prezzo e ISBN scritto non si scambiano le impostazioni. Restituisce solo il testo (piu' veloce). */
function ocrText(w, chars, img) {
  var job = w._chain.then(async function () {
    if (w._chars !== chars) { await w.setParameters({ tessedit_char_whitelist: chars }); w._chars = chars; }
    var o = await w.recognize(img, {}, { text: true, blocks: false, hocr: false, tsv: false });
    return (o.data || {}).text || '';
  });
  w._chain = job.catch(function () {});
  return job;
}
function warmPriceOcr() { setTimeout(function () { getPriceOcr().catch(function () {}); }, 300); }
/* giro 7 (18/11/2026): tolta la lettura del prezzo dalle foto (scelta di Piero); i lettori leggeri restano per l'ISBN scritto */
async function processPhoto(id, file) {
  var b = get(id);
  if (!b) return;
  var s = S[id];
  function stop() { return !get(id) || !S[id] || S[id].manual; }    // eliminato, o scritto a mano nel frattempo
  if (s.manual) return;
  s.st = 'reading'; s.msg = 'Leggo la foto…'; s.pct = 5;
  refreshRow(id);
  try {
    var canvas = await loadCanvas(file, 2000);
    s.pct = 15;
    if (stop()) return;
    s.thumb = thumbOf(canvas);
    try { s.big = scaled(canvas, 1200).toDataURL('image/jpeg', 0.85); } catch (e) { s.big = ''; }
    s.file = null;
    syncThumbs(); refreshRow(id);
    s.msg = 'Cerco il codice a barre…'; setStatusText(id, s.msg);
    var code = await decodeCanvasBarcode(canvas);
    if (stop()) return;
    if (code && !(s.keep && code === L.toIsbn13(b.i))) { s.pct = 100; await fromIsbn(id, code); return; }   // per un libro che ha gia' il suo codice si legge il testo
    s.pct = 25;
    s.msg = ocrP ? 'Leggo il testo della copertina…' : 'Preparo la lettura del testo (solo la prima volta)…'; setStatusText(id, s.msg);
    ocrMsg = function (m) {
      var p = typeof m.progress === 'number' ? m.progress : 0;
      if (m.status === 'recognizing text') { s.pct = 40 + Math.round(40 * p); s.msg = 'Leggo il testo della copertina… ' + Math.round(p * 100) + '%'; setStatusText(id, s.msg); }
      else s.pct = Math.max(s.pct, 25 + Math.round(15 * p));                 // caricamento del lettore (solo la prima volta)
    };
    var worker, res;
    try { worker = await getOcr(); s.pct = Math.max(s.pct, 40); res = await worker.recognize(canvas); } finally { ocrMsg = null; }
    var data = res.data || {};
    if (stop()) return;
    s.pct = 82;
    var lines = L.ocrLines(data);
    var price = null;                                // giro 7: niente prezzo letto dalla copertina
    var written = L.extractIsbns(data.text || '');
    if (!written.length) written = L.ocrIsbns(data.text || '', true);
    if (s.keep) written = written.filter(function (x) { return x !== L.toIsbn13(b.i); });
    if (written.length) { await fromIsbn(id, written[0], price); return; }
    var qs = L.buildQueries(lines);
    s.lines = lines; s.price = price;
    s.msg = 'Cerco il libro nelle banche dati…'; s.pct = 88;
    if (!qs.length) { s.st = 'error'; s.err = 'Non riesco a leggere il testo della copertina.'; s.retry = null; if (flow.id === id) { failSound(); vibrate([90, 70, 90]); } refreshRow(id); autoManual(id); return; }
    s.st = 'search'; refreshRow(id);
    var out = await Promise.allSettled(qs.map(function (qq) { return L.searchText(qq, lookupOpts()); }));
    if (stop()) return;
    var all = [], seen = {};
    out.forEach(function (r) {
      if (r.status === 'fulfilled') r.value.forEach(function (c) { if (!seen[c.id]) { seen[c.id] = 1; all.push(c); } });
    });
    if (out.every(function (r) { return r.status === 'rejected'; })) {
      s.st = 'error'; s.err = 'Ho letto il testo, ma le banche dati non rispondono. Controlla la connessione.'; s.retry = 'text';
      refreshRow(id); return;
    }
    var ranked = L.rankCandidates(all, lines);
    if (!ranked.length) { s.st = 'nf'; if (flow.id === id) { failSound(); vibrate([90, 70, 90]); } refreshRow(id); updateSummary(); autoManual(id); return; }   // nessun libro trovato: suona e subito titolo e autore a mano
    if (L.strongMatch(ranked)) { applyCandidate(id, ranked[0]); return; }
    s.st = 'choose'; s.cands = ranked.slice(0, 6);
    refreshRow(id); updateSummary();
  } catch (e) {
    if (stop()) return;
    s.st = 'error';
    s.err = (e && e.code === 'ocr') ? 'Il riconoscimento del testo non è disponibile. Usa il codice a barre o scrivi i dati.' : 'Lettura non riuscita. Riprova con un\'altra foto.';
    s.retry = null;
    refreshRow(id);
  }
}
function addPhotos(files, ask) {
  var list = Array.prototype.slice.call(files || []).filter(function (f) { return !f.type || f.type.indexOf('image/') === 0; }).slice(0, 60);
  if (!list.length) return;
  q = ''; flt = ''; $('#q').value = ''; setView('list');
  var last = null;
  list.forEach(function (f) {
    var id = newId();
    state.books.push(blankBook({ id: id }));
    S[id] = { st: 'queued', file: f };
    photoPool(function () { return processPhoto(id, f); });
    last = id;
  });
  renderList(); updateSummary();
  if (ask && list.length === 1) startFlow(last);
}
/* ---- Foto di un libro: una sola finestra con l'avanzamento, poi da sola il passo giusto:
   trovato -> prezzo; piu' edizioni -> scelta (poi prezzo); non trovato o illeggibile -> titolo, autore e prezzo a mano ---- */
var flow = { id: null, t: 0 };
function startFlow(id) {
  flow.id = id;
  $('#recImg').style.backgroundImage = ''; $('#recImg').hidden = true;
  $('#recSheet').hidden = false;
  clearInterval(flow.t); flow.t = setInterval(flowTick, 200);
  flowTick();
}
function hideFlow() { clearInterval(flow.t); flow.t = 0; $('#recSheet').hidden = true; }
function flowPaint(s) {
  var pct = Math.max(0, Math.min(100, Math.round(s.pct || 0)));
  var msg = s.st === 'queued' ? 'Preparo la foto…' : s.st === 'search' ? 'Cerco il libro nelle banche dati…' : (s.msg || 'Leggo la foto…');
  msg = msg.replace(/ \d+%$/, '');
  if ($('#recMsg').textContent !== msg) $('#recMsg').textContent = msg;
  $('#recFill').style.width = pct + '%'; $('#recPct').textContent = pct + '%'; $('#recBar').setAttribute('aria-valuenow', pct);
  if (s.thumb && $('#recImg').hidden) { $('#recImg').style.backgroundImage = 'url("' + s.thumb + '")'; $('#recImg').hidden = false; }
}
function flowTick() {
  var id = flow.id, b = id && get(id), s = id && S[id];
  if (!id || $('#recSheet').hidden) { hideFlow(); return; }
  if (!b) { hideFlow(); flow.id = null; return; }                 // eliminato, o era gia' in elenco (lo dice il messaggio)
  var st = s && s.st;
  if (st === 'queued' || st === 'reading' || st === 'search') { flowPaint(s); return; }
  hideFlow();
  if (st === 'choose') { openPick(id); return; }                   // flow.id resta: dopo la scelta chiede il prezzo
  flow.id = null;
  if (st === 'nf' || st === 'error' || st === 'wait') { openManual(id, true); return; }
  if (settings.price && b.c == null) askPrice(id);                 // trovato (o codice a barre letto): il prezzo, facoltativo
  else if (b.t) toast('Aggiunto: ' + b.t + '.');
}
function flowAfterPick(id) { if (flow.id !== id) return; flow.id = null; if (settings.price && get(id) && get(id).c == null) askPrice(id); }
function flowLater() { var id = flow.id; flow.id = null; hideFlow(); if (id && S[id]) S[id].later = true; }
$('#recMan').addEventListener('click', function () { var id = flow.id; flow.id = null; hideFlow(); if (id) openManual(id, true); });
$('#recBg').addEventListener('click', flowLater);
$('#recSheet').addEventListener('click', function (e) { if (e.target === e.currentTarget) flowLater(); });
/* Seconda foto, facoltativa: il prezzo. La chiedo subito, senza aspettare che il libro sia riconosciuto. */
var askId = null;
var askTick = null;
function askBookTxt() {
  var b = askId && bookFor(askId), s = askId && S[askId];
  var busy = s && (s.st === 'queued' || s.st === 'reading' || s.st === 'lookup' || s.st === 'search');
  $('#priceAskT').textContent = b && b.t ? b.t : busy || !b ? 'Cerco titolo e autore…' : (b.i ? 'ISBN ' + b.i : 'Titolo da completare');
  $('#priceAskA').textContent = b && b.t ? (b.a || '') : '';
}
function askPrice(id) {
  if (!settings.price || scanning) return;
  askId = id;
  $('#priceAskIn').value = ''; $('#priceAskErr').hidden = true;
  askBookTxt();
  $('#priceAsk').hidden = false;
  clearInterval(askTick); askTick = setInterval(function () { if ($('#priceAsk').hidden) { clearInterval(askTick); return; } askBookTxt(); }, 600);
  setTimeout(function () { try { $('#priceAskIn').focus(); } catch (e) { nlErr(e); } }, 60);
}
function closePriceAsk() {
  var id = askId;
  $('#priceAsk').hidden = true; askId = null; clearInterval(askTick); try { $('#priceAskIn').blur(); } catch (e) { nlErr(e); }
  // la foto non ha trovato il libro mentre si scriveva il prezzo: subito titolo e autore a mano
  setTimeout(function () { var t = id && S[id] && S[id].st; if (t === 'nf' || t === 'error') autoManual(id); }, 80);
}
$('#priceAskForm').addEventListener('submit', function (e) {
  e.preventDefault();
  if (!$('#priceAskIn').value.trim()) { closePriceAsk(); return; }       // vuoto: come «Salta»
  var v = L.parseNum($('#priceAskIn').value);
  if (!(v > 0 && v < 1000)) { $('#priceAskErr').hidden = false; $('#priceAskIn').focus(); return; }
  var id = askId, b = bookFor(id);
  closePriceAsk();
  v = Math.round(v * 100) / 100;
  if (b) { b.c = v; touch(); refreshRow(b.id); updateSummary(); }
  else if (S[id]) S[id].price = v;
  chime();
  toast('Prezzo: ' + eur(v) + '.');
});
function bookFor(id) { return get(id) || (sameAs[id] && get(sameAs[id])) || null; }

/* ---------- scansione dal vivo ---------- */
var stream = null, scanTimer = null, scanCtx = { count: 0, added: 0, last: '', lastAt: 0 }, torchOn = false, liveCanvas = null, pushed = false;
var scanMode = 'add';                         // 'add': aggiunge; 'check': «Ce l'ho già?», controlla soltanto
var priceTarget = null, scanPaused = false;   // libro appena scansionato a cui dare il prezzo
var spTick = null;
function priceBookTxt() {
  var b = priceTarget && get(priceTarget), s = priceTarget && S[priceTarget];
  var busy = s && (s.st === 'queued' || s.st === 'reading' || s.st === 'lookup' || s.st === 'search');
  $('#scanPriceT').textContent = b && b.t ? b.t : busy || !b ? 'Cerco titolo e autore…' : (b.i ? 'ISBN ' + b.i : 'Titolo da completare');
  $('#scanPriceA').textContent = b && b.t ? (b.a || '') : '';
}
function priceBar(txt) {
  if (typingPrice) closePriceType();
  $('#scanPriceTxt').textContent = txt || '';
  priceBookTxt();
  $('#scanPrice').hidden = false;
  clearInterval(spTick); spTick = setInterval(function () { if ($('#scanPrice').hidden || !scanning) { clearInterval(spTick); return; } priceBookTxt(); }, 600);
}
var PRICE_HINT = 'Prezzo facoltativo: scrivilo, oppure inquadra il prossimo codice.';
/* Ritaglia dal video la zona del riquadro (un po' allargata), tenendo conto di come il video riempie lo schermo. */
function guideCanvas(full) {
  var v = $('#scanVideo'), vw = v.videoWidth, vh = v.videoHeight;
  if (!vw || !vh) return null;
  var x = 0, y = 0, w = vw, h = vh;
  if (!full) {
    try {
      var r = v.getBoundingClientRect(), g = $('#scanGuide').getBoundingClientRect();
      var sc = Math.max(r.width / vw, r.height / vh), ox = (r.width - vw * sc) / 2, oy = (r.height - vh * sc) / 2;
      var gw = g.width / sc, gh = g.height / sc;
      x = (g.left - r.left - ox) / sc - gw * 0.15; y = (g.top - r.top - oy) / sc - gh * 0.25; w = gw * 1.3; h = gh * 1.5;
      x = Math.max(0, x); y = Math.max(0, y); w = Math.min(vw - x, w); h = Math.min(vh - y, h);
      if (!(w > 40 && h > 20)) throw 0;
    } catch (e) { x = vw * 0.08; y = vh * 0.3; w = vw * 0.84; h = vh * 0.4; }
  }
  var k = Math.min(2.5, Math.max(1, 900 / w));
  if (w * k > 1280) k = 1280 / w;
  if (h * k > 1280) k = Math.min(k, 1280 / h);
  var c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  c.getContext('2d').drawImage(v, x, y, w, h, 0, 0, c.width, c.height);
  return c;
}
/* Prezzo scritto a mano: piu' veloce quando la fotocamera fatica. Intanto la scansione si ferma, cosi' il libro
   successivo non arriva mentre scrivi. */
var typingPrice = false, priceTxtBefore = '';
function openPriceType() {
  var b = priceTarget && get(priceTarget), inp = $('#scanPriceIn');
  if (!b || !scanning) { inp.blur(); return; }
  if (typingPrice) return;
  typingPrice = true; scanPaused = true;
  priceTxtBefore = $('#scanPriceTxt').textContent;
  $('#scanPriceTxt').textContent = 'Scrivi il prezzo e tocca Salva. La scansione aspetta.';
  $('#scanPrice').classList.add('typing');
  inp.placeholder = 'es. 14,50'; inp.classList.remove('bad');
  if (!inp.value && b.c != null) inp.value = String(b.c.toFixed(2)).replace('.', ',');
  if (document.activeElement !== inp) { try { inp.focus({ preventScroll: true }); } catch (e) { inp.focus(); } }
}
function closePriceType() {
  if (!typingPrice) return;
  typingPrice = false; scanPaused = false;
  if (priceTxtBefore) $('#scanPriceTxt').textContent = priceTxtBefore;
  $('#scanPrice').classList.remove('typing');
  var inp = $('#scanPriceIn'); inp.value = ''; inp.placeholder = 'Prezzo (facoltativo)'; inp.classList.remove('bad');
  try { inp.blur(); } catch (e) { nlErr(e); }
}
function savePriceType(e) {
  if (e) e.preventDefault();
  var inp = $('#scanPriceIn'), v = L.parseNum(inp.value), b = priceTarget && get(priceTarget);
  if (!inp.value.trim()) { closePriceType(); return; }
  if (!(v > 0 && v < 1000)) { inp.classList.add('bad'); inp.focus(); return; }
  closePriceType();
  if (!b) return;
  b.c = Math.round(v * 100) / 100; touch();
  chime(); vibrate([30, 40, 30]);
  priceBar('✓ Prezzo salvato: ' + eur(b.c) + '. Inquadra il prossimo codice.');
}
$('#scanPriceIn').addEventListener('focus', openPriceType);              // il tocco sul campo apre la tastiera e ferma la scansione
$('#scanPriceForm').addEventListener('submit', savePriceType);
$('#scanPriceCancel').addEventListener('click', closePriceType);
$('#scanPriceIn').addEventListener('input', function (e) { e.target.classList.remove('bad'); });
/* contatore in alto e pulsante di uscita in basso, che dice cosa succede uscendo */
function setScanCount(t) {
  $('#scanCount').textContent = t;
  var n = scanCtx.count;
  $('#scanDone').textContent = scanMode === 'check' ? 'Chiudi la fotocamera' : n ? 'Ho finito · vedi ' + (n === 1 ? 'il libro aggiunto' : 'i ' + n + ' libri aggiunti') : 'Chiudi la fotocamera';
  $('#scanDone').classList.toggle('has', scanMode !== 'check' && n > 0);
}
function scanMsg(t) { $('#scanMsg').textContent = t; }

/* Tre modi di inquadrare: codice a barre (sempre attivo), numero ISBN stampato (letto di continuo con l'OCR leggero),
   copertina (si scatta; poi la riconosce come una Foto, mentre continui). In «Ce l'ho già?» niente copertina. */
var scanKind = 'bar', textTimer = null, textBusy = false, textSince = 0, textHinted = false, shootBusy = false;
function kindMsg() {
  var check = scanMode === 'check', wish = tab === 'wish';
  if (scanKind === 'text') return check ? 'Inquadra il numero ISBN stampato (sul retro o nella pagina del copyright) dentro la striscia: ti dico se ce l\'hai.'
    : 'Inquadra il numero ISBN stampato dentro la striscia: di solito è sul retro o nella pagina del copyright, dopo la parola «ISBN». Lo leggo da solo.';
  if (scanKind === 'cover') return 'Inquadra tutta la copertina nel riquadro e tocca il pulsante bianco. La riconosco mentre passi alla prossima' + (wish ? ' (va nei Desideri).' : '.');
  if (check) return 'Inquadra il codice a barre: ti dico se il libro è già in libreria. Non aggiungo niente da solo.';
  return wish ? 'Inquadra il codice a barre: ogni libro finisce nella lista dei Desideri.' : 'Inquadra il codice a barre, di solito sul retro. Ogni libro viene aggiunto da solo.';
}
function setScanKind(k) {
  if (k !== 'text' && k !== 'cover') k = 'bar';
  if (scanMode === 'check' && k === 'cover') k = 'bar';
  scanKind = k;
  var sc = $('#scan');
  sc.classList.toggle('k-text', k === 'text'); sc.classList.toggle('k-cover', k === 'cover');
  Array.prototype.forEach.call($('#scanKinds').querySelectorAll('[data-k]'), function (b) { b.setAttribute('aria-checked', b.dataset.k === k ? 'true' : 'false'); });
  $('#scanShootBox').hidden = k !== 'cover';
  paintScanLight();
  clearTimeout(textTimer);
  $('#scanGuide').classList.remove('reading');
  scanMsg(kindMsg());
  if (k === 'text') {
    textSince = Date.now(); textHinted = false;
    var ready = false;
    getPriceOcr().then(function () { ready = true; }, function () { if (scanning && scanKind === 'text') scanMsg('La lettura del testo non è disponibile: usa il codice a barre o Digita.'); });
    setTimeout(function () { if (!ready && scanning && scanKind === 'text') scanMsg('Preparo la lettura del testo (solo la prima volta)…'); }, 400);
    textTimer = setTimeout(textTick, 300);
  }
}
async function readLiveIsbn() {
  var c = guideCanvas(false);
  if (!c) return '';
  var ws = await getPriceOcr();
  return L.ocrIsbns(await ocrText(ws[0], '', c), true)[0] || '';
}
function textTick() {
  clearTimeout(textTimer);
  if (!scanning || scanKind !== 'text') return;
  if (textBusy || scanPaused || !$('#scanVideo').videoWidth) { textTimer = setTimeout(textTick, 250); return; }
  textBusy = true;
  $('#scanGuide').classList.add('reading');
  readLiveIsbn().catch(function () { return ''; }).then(function (code) {
    textBusy = false;
    $('#scanGuide').classList.remove('reading');
    if (!scanning || scanKind !== 'text') return;
    if (code) { textSince = Date.now(); textHinted = false; onScanned(code); }
    else if (!textHinted && Date.now() - textSince > 12000) {
      textHinted = true;
      scanMsg('Non leggo ancora un ISBN valido: avvicinati finché il numero riempie la striscia, tieni fermo il telefono' + ($('#scanTorch').hidden ? '' : ' e, se c\'è poca luce, accendi la torcia') + '.');
    }
    textTimer = setTimeout(textTick, 350);
  });
}
/* Ritaglio della copertina: il riquadro con un piccolo margine, lato lungo fino a 2000 punti. */
function coverCanvas() {
  var v = $('#scanVideo'), vw = v.videoWidth, vh = v.videoHeight;
  if (!vw || !vh) return null;
  var x = 0, y = 0, w = vw, h = vh;
  try {
    var r = v.getBoundingClientRect(), g = $('#scanGuide').getBoundingClientRect();
    var sc = Math.max(r.width / vw, r.height / vh), ox = (r.width - vw * sc) / 2, oy = (r.height - vh * sc) / 2;
    var gw = g.width / sc, gh = g.height / sc;
    x = (g.left - r.left - ox) / sc - gw * 0.06; y = (g.top - r.top - oy) / sc - gh * 0.06; w = gw * 1.12; h = gh * 1.12;
    x = Math.max(0, x); y = Math.max(0, y); w = Math.min(vw - x, w); h = Math.min(vh - y, h);
    if (!(w > 80 && h > 80)) throw 0;
  } catch (e) { x = 0; y = 0; w = vw; h = vh; }
  var k = Math.min(1, 2000 / Math.max(w, h));
  var c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  c.getContext('2d').drawImage(v, x, y, w, h, 0, 0, c.width, c.height);
  return c;
}
async function shootCover() {
  if (!scanning || shootBusy || scanMode === 'check') return;
  var flashed = false;
  if (scanLight.flash && !torchOn) {                // flash: luce accesa, attesa che l'immagine si schiarisca, scatto, luce spenta
    shootBusy = true; $('#scanShoot').disabled = true;
    flashed = await setTorch(true);
    if (flashed) await new Promise(function (r) { setTimeout(r, 650); });
    else noLight();
    shootBusy = false; $('#scanShoot').disabled = false;
  }
  var c = coverCanvas();
  if (flashed) setTorch(false);
  if (!c) return;
  shootBusy = true; $('#scanShoot').disabled = true;
  var sc = $('#scan');
  sc.classList.add('flash'); setTimeout(function () { sc.classList.remove('flash'); }, 140);
  beep(true); vibrate(40);
  var blob = null;
  try { blob = await new Promise(function (res) { c.toBlob(res, 'image/jpeg', 0.9); }); } catch (e) { nlErr(e); }
  shootBusy = false; $('#scanShoot').disabled = false;
  if (!blob || !scanning) return;
  var id = newId();
  state.books.push(blankBook({ id: id }));
  S[id] = { st: 'queued', file: blob };
  photoPool(function () { return processPhoto(id, blob); });
  touch();
  scanCtx.count++; scanCtx.added++;
  setScanCount(scanCtx.count + (scanCtx.count === 1 ? ' aggiunto' : ' aggiunti'));
  $('#scanRes').hidden = true; resCode = '';
  scanMsg('Copertina presa: la riconosco mentre continui. Se ci sono più libri possibili, alla fine scegli tu dall\'elenco.');
  if (settings.price) { priceTarget = id; priceBar(PRICE_HINT); }
  else { $('#scanPrice').hidden = true; priceTarget = null; }
}
$('#scanKinds').addEventListener('click', function (e) { var b = e.target.closest('[data-k]'); if (b && scanning) setScanKind(b.dataset.k); });
$('#scanShoot').addEventListener('click', shootCover);
async function startScan(mode) {
  scanMode = mode === 'check' ? 'check' : 'add';
  try { beep.ctx = beep.ctx || new (window.AudioContext || window.webkitAudioContext)(); if (beep.ctx.resume) beep.ctx.resume(); } catch (e) { nlErr(e); }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    notice('La fotocamera non è disponibile in questo browser. Usa Foto o Digita.');
    return;
  }
  try {
    try { stream = await rearStream({ width: { ideal: 1920 }, height: { ideal: 1080 } }); }      // la posteriore vera: e' quella che ha la luce
    catch (x) { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false }); }
  } catch (e) {
    notice('Non posso usare la fotocamera. Consenti l\'accesso nelle impostazioni del sito, oppure usa Foto o Digita.');
    return;
  }
  var v = $('#scanVideo');
  v.srcObject = stream;
  try { await v.play(); } catch (e) { nlErr(e); }
  var track = stream.getVideoTracks()[0];
  try {
    var caps = track.getCapabilities ? track.getCapabilities() : {};
    if (caps.focusMode && caps.focusMode.indexOf('continuous') >= 0) track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(function () {});
  } catch (e) { nlErr(e); }
  scanLight.can = false; torchOn = false; paintScanLight();
  scanLightCaps(track); setTimeout(function () { if (scanning && stream) scanLightCaps(stream.getVideoTracks()[0]); }, 700);   // su alcuni telefoni la luce risulta solo dopo un attimo
  scanCtx = { count: 0, added: 0, last: '', lastAt: 0 };
  setScanCount(scanMode === 'check' ? 'Ce l\'ho già?' : '0 aggiunti');
  $('#scanRes').hidden = true; $('#scanRes').innerHTML = ''; resCode = ''; resKind = '';
  $('#scanPrice').hidden = true; priceTarget = null; scanPaused = false;
  $('#scan').classList.toggle('checking', scanMode === 'check');
  $('#scan').hidden = false;
  scanning = true;
  setScanKind(scanKind);
  try { history.pushState({ scan: 1 }, ''); pushed = true; } catch (e) { nlErr(e); }
  scanTick();
}
function stopScan(fromPop) {
  if (!scanning) return;
  closePriceType();
  scanning = false;
  clearTimeout(scanTimer); clearTimeout(textTimer);
  if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
  $('#scanVideo').srcObject = null;
  $('#scan').hidden = true;
  torchOn = false;
  if (pushed && !fromPop) { try { history.back(); } catch (e) { nlErr(e); } }
  pushed = false;
  renderList(); updateSummary();
  if (scanCtx.added) toast(scanCtx.added === 1 ? 'Aggiunto 1 libro.' : 'Aggiunti ' + scanCtx.added + ' libri.');
  else if (scanMode === 'check' && scanCtx.count) toast('Controllati ' + scanCtx.count + (scanCtx.count === 1 ? ' libro.' : ' libri.'));
}
async function scanTick() {
  if (!scanning) return;
  if (scanPaused) { scanTimer = setTimeout(scanTick, 200); return; }
  var v = $('#scanVideo');
  try {
    if (v.videoWidth) {
      var code = '';
      if (detector) {
        var r = await detector.detect(v);
        for (var i = 0; i < r.length; i++) { code = L.toIsbn13(r[i].rawValue); if (code) break; }
      }
      if (!code) {
        liveCanvas = liveCanvas || document.createElement('canvas');
        var k = Math.min(1, 1280 / v.videoWidth);
        liveCanvas.width = Math.round(v.videoWidth * k); liveCanvas.height = Math.round(v.videoHeight * k);
        liveCanvas.getContext('2d', { willReadFrequently: true }).drawImage(v, 0, 0, liveCanvas.width, liveCanvas.height);
        code = zxDecode(liveCanvas);
      }
      if (code && scanning) onScanned(code);
    }
  } catch (e) { nlErr(e); }
  if (scanning) scanTimer = setTimeout(scanTick, 130);
}
function onScanned(code) {
  /* Mentre si legge il prezzo il codice a barre (o l'ISBN scritto) dello stesso libro e' spesso li' accanto:
     lo ignoro in silenzio, niente «Già in elenco». Un codice diverso invece e' il libro successivo. */
  if (scanMode === 'add' && priceTarget) {
    var pt = get(priceTarget);
    if (pt && L.toIsbn13(pt.i) === code) {
      if (pt.c == null && !scanPaused) scanMsg('È lo stesso libro: se vuoi scrivi il prezzo, altrimenti inquadra il prossimo codice.');
      return;
    }
  }
  var now = Date.now();
  if (code === scanCtx.last && now - scanCtx.lastAt < 5000) { scanCtx.lastAt = now; return; }
  scanCtx.last = code; scanCtx.lastAt = now;
  var g = $('#scanGuide');
  g.classList.add('hit'); setTimeout(function () { g.classList.remove('hit'); }, 350);
  if (scanMode === 'check') { onCheck(code); return; }
  var res = addIsbn(code);
  if (!res.dup) { $('#scanRes').hidden = true; resCode = ''; }
  if (res.moved) {
    if (settings.price && res.moved.c == null) { priceTarget = res.moved.id; priceBar(PRICE_HINT); }
    beep(true); vibrate(50);
    scanCtx.count++; scanCtx.added++;
    setScanCount(scanCtx.count + (scanCtx.count === 1 ? ' aggiunto' : ' aggiunti'));
    scanMsg('Era nei Desideri: spostato in Libreria. ' + (res.moved.t || code));
    return;
  }
  if (res.dup) {
    if (res.dup.id !== priceTarget) { $('#scanPrice').hidden = true; priceTarget = null; }
    beep(false); vibrate(120);
    scanMsg((res.dup.w ? 'Già nei Desideri: ' : (tab === 'wish' ? 'Ce l\'hai già in Libreria: ' : 'Già in elenco: ')) + (res.dup.t || code) + (res.dup.xs ? ' (' + goneText(res.dup).toLowerCase() + ')' : ''));
    if (!res.dup.w && tab === 'lib' && res.dup.xs && !state.books.some(function (x) { return !x.w && !x.xs && L.toIsbn13(x.i) === code; })) {
      resCode = code; resKind = 'gone';
      $('#scanRes').innerHTML = '<p class="res-h no">' + esc(goneText(res.dup)) + '</p><p class="res-t">' + esc(res.dup.t || code) + '</p>' +
        '<div class="res-b"><button class="btn primary" data-act="back">È tornato in libreria</button><button class="btn" data-act="addcopy">Aggiungi un\'altra copia</button></div>';
      $('#scanRes').hidden = false;
    } else if (!res.dup.w && tab === 'lib') {
      var nc = state.books.filter(function (x) { return !x.w && !x.xs && L.toIsbn13(x.i) === code; }).length;
      resCode = code; resKind = 'dupadd';
      $('#scanRes').innerHTML = '<p class="res-h ok">Già in elenco' + (nc > 1 ? ' (' + nc + ' copie)' : '') + '</p><p class="res-t">' + esc(res.dup.t || code) + '</p>' +
        '<div class="res-b"><button class="btn" data-act="addcopy">Aggiungi un\'altra copia</button></div>';
      $('#scanRes').hidden = false;
    }
    return;
  }
  beep(true); vibrate(50);
  if (res.book) (S[res.book.id] || (S[res.book.id] = {})).heard = true;   // se poi non si trova, suona «non trovato»
  scanCtx.count++; scanCtx.added++;
  setScanCount(scanCtx.count + (scanCtx.count === 1 ? ' aggiunto' : ' aggiunti'));
  scanMsg('Aggiunto ' + code + '. Cerco il titolo…');
  var book = res.book;
  if (settings.price) { priceTarget = book.id; priceBar(PRICE_HINT); }
  res.done.then(function () {
    if (!scanning) return;
    scanMsg(book.t ? '✓ ' + book.t : (book.nf ? (isKdp(book) ? 'Pubblicato in proprio su Amazon: non è nelle banche dati. Aprilo e fotografa la copertina.' : 'Non trovato nelle banche dati: lo completi dopo.') : 'Titolo da completare più tardi.'));
  });
}
/* ---------- «Ce l'ho già?»: controlla senza aggiungere ---------- */
var checkCache = {}, resCode = '', resKind = '';
function readLabel(b) {
  if (b.rs === 'ok') return 'Letto' + (b.rt ? ' · ' + L.rateWord(b.rt) : '');
  if (b.rs === 'in') { var q = ppInfo(b); return 'In lettura' + (q.pct != null ? ' · ' + q.pct + '%' : q.p ? ' · pagina ' + q.p : ''); }
  return b.rs === 'da' ? 'Da leggere' : '';
}
/* segnalibro: la pagina a cui sei arrivato (b.pp, con la data in b.ppd) e l'avanzamento sulle pagine del libro (Piero, 16/11/2026) */
function ppInfo(b) {
  var p = parseInt(b && b.pp, 10) || 0, tot = parseInt(b && b.pg, 10) || 0;
  return { p: p, tot: tot, pct: p && tot ? Math.min(100, Math.round(p * 100 / tot)) : null };
}
function shelfLine(b) {
  return [b.a, b.sh ? 'Scaffale: ' + b.sh : '', readLabel(b)].filter(Boolean).join(' · ');
}
/* stesso libro in un'altra edizione: stesso titolo (senza sottotitolo) e un cognome dell'autore in comune (Piero, 19/11/2026) */
function edKey(t) { return L.norm(String(t || '').split(/\s[:\-–—]\s|[:.(]/)[0]).replace(/[^a-z0-9]+/g, ' ').trim(); }
function edAut(a) { return L.norm(a).split(/[^a-z]+/).filter(function (w) { return w.length > 2; }); }
function otherEdition(info, code) {
  if (!info || !info.t) return null;
  var k = edKey(info.t), au = edAut(info.a);
  if (!k) return null;
  return state.books.find(function (x) {
    if (x.w || x.xs || L.toIsbn13(x.i) === code || edKey(x.t) !== k) return false;
    if (!au.length) return true;
    var xa = edAut(x.a); return !xa.length || au.some(function (w) { return xa.indexOf(w) >= 0; });
  }) || null;
}
function showRes(code, kind, book, info) {
  resCode = code; resKind = kind;
  var o = '';
  if (kind === 'have') {
    var ncp = state.books.filter(function (x) { return !x.w && !x.xs && L.toIsbn13(x.i) === code; }).length;
    o = '<p class="res-h ok">✓ Ce l\'hai già' + (ncp > 1 ? ' (' + ncp + ' copie)' : '') + '</p><p class="res-t">' + esc(book.t || code) + '</p>' +
      (shelfLine(book) ? '<p class="res-s">' + esc(shelfLine(book)) + '</p>' : '') +
      (book.p ? '<p class="res-s loan">' + esc(prestatoA(book.p)) + (book.pd ? ' dal ' + esc(L.itDate(book.pd)) : '') + '</p>' : '');
  } else if (kind === 'gone') {
    o = '<p class="res-h no">✗ Non ce l\'hai più</p><p class="res-t">' + esc(book.t || code) + '</p><p class="res-s">' + esc(goneText(book)) + '</p>' +
      '<div class="res-b"><button class="btn" data-act="back">È tornato in libreria</button></div>';
  } else if (kind === 'wish') {
    o = '<p class="res-h wish">★ È nella tua lista dei Desideri</p><p class="res-t">' + esc(book.t || code) + '</p>' +
      '<div class="res-b"><button class="btn primary" data-act="bought">L\'ho comprato: spostalo in Libreria</button></div>';
  } else if (kind === 'no') {
    var t = info === undefined ? 'Cerco il titolo…' : info ? info.t : (info === null ? 'Titolo sconosciuto alle banche dati' : 'Titolo non disponibile (connessione)');
    var oe = otherEdition(info, code);
    o = (oe ? '<p class="res-h ed">≈ Ce l\'hai in un\'altra edizione</p><p class="res-s">' + esc([oe.e, oe.y].filter(Boolean).join(', ') || ('ISBN ' + (oe.i || '—'))) + (shelfLine(oe) ? ' · ' + esc(shelfLine(oe)) : '') + '</p><p class="res-s">Questa edizione:</p>'
      : '<p class="res-h no">✗ Non ce l\'hai</p>') + '<p class="res-t">' + esc(t) + '</p>' +
      (info && info.a ? '<p class="res-s">' + esc(info.a) + '</p>' : '') + '<p class="res-s">ISBN ' + esc(code) + '</p>' +
      '<div class="res-b"><button class="btn primary" data-act="addlib">Aggiungi alla Libreria</button><button class="btn" data-act="addwish">Aggiungi ai Desideri</button></div>';
  } else {
    o = '<p class="res-h ok">✓ ' + esc(info) + '</p><p class="res-t">' + esc((book && book.t) || code) + '</p>';
  }
  $('#scanRes').innerHTML = o;
  $('#scanRes').hidden = false;
}
function onCheck(code) {
  scanCtx.count++;
  var ex = findByIsbn(code);
  var mine = state.books.filter(function (x) { return !x.w && L.toIsbn13(x.i) === code; }), here = mine.filter(function (x) { return !x.xs; });
  if (mine.length && !here.length) { beep(false); vibrate(160); showRes(code, 'gone', mine[0]); return; }
  if (here.length) ex = here[0];
  if (ex && !ex.w) { beep(true); setTimeout(function () { beep(true); }, 150); vibrate([60, 60, 60]); showRes(code, 'have', ex); }
  else if (ex) { beep(true); vibrate(60); showRes(code, 'wish', ex); }
  else {
    beep(false); vibrate(160);
    if (checkCache.hasOwnProperty(code)) { showRes(code, 'no', null, checkCache[code]); return; }
    showRes(code, 'no', null, undefined);
    if (navigator.onLine === false) { showRes(code, 'no', null, false); return; }
    findIsbn(code).then(function (r) {
      checkCache[code] = r || null;
      if (scanning && resCode === code && resKind === 'no') showRes(code, 'no', null, r || null);
    }, function () { if (scanning && resCode === code && resKind === 'no') showRes(code, 'no', null, false); });
  }
}
$('#scanRes').addEventListener('click', function (e) {
  var btn = e.target.closest('[data-act]');
  if (!btn || !resCode) return;
  var code = resCode, act = btn.dataset.act, pre = checkCache[code] || undefined;
  if (act === 'addlib' || act === 'addwish') {
    var res = addIsbn(code, { wish: act === 'addwish', pre: pre });
    var b = res.book || res.moved || res.dup;
    if (res.book) scanCtx.added++;
    showRes(code, 'done', b, act === 'addwish' ? 'Aggiunto ai Desideri' : 'Aggiunto alla Libreria');
    if (res.done) res.done.then(function () { if (scanning && resCode === code && resKind === 'done') showRes(code, 'done', b, act === 'addwish' ? 'Aggiunto ai Desideri' : 'Aggiunto alla Libreria'); });
  } else if (act === 'addcopy') {
    var src = state.books.find(function (x) { return !x.w && L.toIsbn13(x.i) === code; });
    var cpy = src && addCopy(src.id, true);
    if (cpy) { scanCtx.count++; scanCtx.added++; setScanCount(scanCtx.count + (scanCtx.count === 1 ? ' aggiunto' : ' aggiunti')); showRes(code, 'done', cpy, 'Aggiunta un\'altra copia'); }
  } else if (act === 'back') {
    var gb = state.books.find(function (x) { return !x.w && x.xs && L.toIsbn13(x.i) === code; });
    if (gb) { gb.xs = ''; gb.xd = ''; gb.xa = ''; touch(); showRes(code, 'done', gb, 'Di nuovo in libreria'); }
  } else if (act === 'bought') {
    var wb = findByIsbn(code);
    if (wb) { moveToLib(wb.id, true); scanCtx.added++; showRes(code, 'done', wb, 'Spostato in Libreria'); }
  }
});
/* luce nella fotocamera della scansione: «Torcia» resta accesa; «Flash» (solo per la foto della copertina) si accende
   un attimo quando scatti, come «Luce» nella fotocamera delle foto. */
var scanLight = { can: false, flash: false };
async function scanLightCaps(track) {
  var can = false;
  try { var c = track && track.getCapabilities ? track.getCapabilities() : {}; can = !!c.torch && settings.torchCam !== 'none'; } catch (e) { nlErr(e); }
  if (can) scanLight.can = true;                    // solo se l'obiettivo dichiara la torcia: altrimenti niente pulsanti della luce
  paintScanLight();
}
function paintScanLight() {
  var t = $('#scanTorch'), f = $('#scanFlash');
  t.hidden = !scanLight.can; f.hidden = !scanLight.can || scanKind !== 'cover';
  t.setAttribute('aria-pressed', torchOn ? 'true' : 'false'); t.setAttribute('aria-label', torchOn ? 'Torcia: accesa' : 'Torcia: spenta');
  f.setAttribute('aria-pressed', scanLight.flash ? 'true' : 'false'); f.setAttribute('aria-label', scanLight.flash ? 'Flash per la foto della copertina: acceso' : 'Flash per la foto della copertina: spento');
}
async function setTorch(on) {
  var tr = stream && stream.getVideoTracks()[0];
  if (!tr) return false;
  if (!(await torchOnTrack(tr, on))) return false;
  if (on) { try { var se = tr.getSettings ? tr.getSettings() : {}; if (se.torch === false) return false; } catch (e) { nlErr(e); } }   // accettato ma rimasto spento
  return true;
}
function noLight() {                                 // la luce non si accende: tolgo i pulsanti e me lo ricordo
  scanLight.can = false; scanLight.flash = false; torchOn = false;
  if (!settings.torchCam || settings.torchCam !== 'none') { settings.torchCam = 'none'; saveSettings(); }
  paintScanLight();
}
async function toggleTorch() {
  var want = !torchOn, ok = await setTorch(want);
  torchOn = ok ? want : false;
  paintScanLight();
  if (!ok && want) { noLight(); scanMsg('Da qui la luce non si accende su questo telefono: per il flash usa «Usa la fotocamera del telefono», qui sotto.'); }
}
function toggleScanFlash() {
  scanLight.flash = !scanLight.flash; paintScanLight();
  scanMsg(scanLight.flash ? 'Flash acceso: la luce si accende un attimo quando scatti la copertina.' : 'Flash spento.');
}
