/* Next Libris · app, parte 9 di 10 (app-strumenti.js): condividi i Desideri, libri ricevuti, doppioni, prestiti, desideri, statistiche.
   Dal 17/11/2026 app.js è diviso in 10 file (prima era una sola funzione). Sono script classici, senza import:
   le funzioni e le variabili di primo livello sono globali e servono a tutte le parti; l'ordine in index.html
   e in SHELL di sw.js conta (app.js, app-aggiungi.js, …, app-avvio.js: l'ultima fa partire l'app). */
'use strict';
/* ---------- condividi la lista dei Desideri ---------- */
function wishText() {
  var books = state.books.filter(function (b) { return b.w && hasData(b); }).sort(cmpFor('titolo'));
  var lines = books.map(function (b) {
    var ed = [b.e, b.y].filter(Boolean).join(', ');
    return '• ' + (b.t || 'ISBN ' + b.i) + (b.a ? ' — ' + b.a : '') + (ed ? ' (' + ed + ')' : '') + (L.toIsbn13(b.i) ? '\n   ISBN ' + L.toIsbn13(b.i) : '');
  });
  return { n: books.length, text: 'Libri che vorrei (' + books.length + '):\n\n' + lines.join('\n') };   // giro 7: niente prezzi nelle condivisioni
}
/* ---------- condividere un libro o una lista, e aprire quelli ricevuti ----------
   Il pacchetto (L.buildShare) viaggia nel link dell'app dopo «#l=»: compresso quando il browser lo permette («z…»), altrimenti
   in chiaro («j…»). Le liste troppo lunghe per un link partono come file, che si apre da Esporta › Ripristina. */
var SHARE_URL_MAX = 3600;
function b64url(bytes) { var bin = ''; for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unb64url(t) { var bin = atob(t.replace(/-/g, '+').replace(/_/g, '/')), out = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
async function pipeBytes(bytes, stream) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer()); }
async function encodeShare(o) {
  var raw = new TextEncoder().encode(JSON.stringify(o));
  if (window.CompressionStream) { try { return 'z' + b64url(await pipeBytes(raw, new CompressionStream('deflate-raw'))); } catch (e) { nlErr(e); } }
  return 'j' + b64url(raw);
}
async function decodeShare(t) {
  var sh = L.parseShare(await decodeRaw(t));
  if (!sh) throw new Error('formato');
  return sh;
}
async function decodeRaw(t) {
  t = String(t || '');
  if (!/^[zj][\w-]+$/.test(t) || t.length > 60000) throw new Error('formato');
  var bytes = unb64url(t.slice(1));
  if (t[0] === 'z') {
    if (!window.DecompressionStream) throw new Error('vecchio');
    bytes = await pipeBytes(bytes, new DecompressionStream('deflate-raw'));
    if (bytes.length > 400000) throw new Error('formato');
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
/* i libri che vedi ora, adatti a essere mandati */
function shareable() { return visible().filter(function (b) { return hasData(b) && (b.t || L.toIsbn13(b.i)); }); }
function toggleFav(id) {
  var b = get(id);
  if (!b) return;
  toggleLc(id);                                  // giro 10: la stella è «Lo consiglio»
}
/* «Lo consiglio» (giro 6, scelta di Piero: coccarda accanto alla stella): gli amici lo vedono tra i Consigliati del profilo */
function toggleLc(id) {
  var b = get(id);
  if (!b || b.w) return;
  b.lc = !b.lc; b.fav = b.lc; touch(); refreshRow(id); emit('lc');
  if (flt === 'fav' && !b.lc) { renderList(); updateSummary(); }
  toast(b.lc ? 'Lo consigli: gli amici lo vedono nel tuo profilo.' : 'Non lo consigli più.');
}
var shareCtx = null;
/* books: cosa mando; ctx.kind: book / fav / wish / list; ctx.title: nome proposto per la lista */
function openShare(books, ctx) {
  books = (books || []).filter(function (b) { return b.t || L.toIsbn13(b.i); });
  if (!books.length) { toast('Non c\'è niente da condividere.'); return; }
  var cut = books.length > L.SHARE_MAX;
  shareCtx = { books: books.slice(0, L.SHARE_MAX), kind: ctx.kind };
  var one = ctx.kind === 'book', n = shareCtx.books.length;
  $('#shareH').textContent = one ? 'Condividi il libro' : 'Condividi la lista';
  $('#shareWhat').textContent = one ? '«' + (books[0].t || 'ISBN ' + books[0].i) + '»' + (books[0].a ? ' di ' + books[0].a : '')
    : (ctx.kind === 'fav' ? 'I libri che consigli: ' : ctx.kind === 'wish' ? 'I tuoi desideri: ' : '') + n + (n === 1 ? ' libro' : ' libri') + (cut ? ' (i primi ' + L.SHARE_MAX + ' su ' + books.length + ')' : '') + '.';
  $('#shareTitleBox').hidden = ctx.kind !== 'list';
  $('#shareTitle').value = ctx.kind === 'list' ? (ctx.title || '') : '';
  $('#shareName').value = settings.name || '';
  $('#exportSheet').hidden = true; $('#toast').hidden = true;
  $('#shareSheet').hidden = false;
  sharePreview();
  emit('share', { books: books, kind: ctx && ctx.kind });   // il modulo amici: «Consiglialo a un amico»
}
function sharePack() {
  var name = $('#shareName').value.replace(/\s+/g, ' ').trim().slice(0, 30);
  return L.buildShare(shareCtx.books, { kind: shareCtx.kind, name: name, title: $('#shareTitle').value });
}
function sharePreview() { if (shareCtx) $('#sharePrev').textContent = 'Chi riceve vedrà: ' + L.shareHeading(L.parseShare(sharePack())); }
function closeShare() { $('#shareSheet').hidden = true; shareCtx = null; }
function saveName(v) {
  v = String(v || '').replace(/\s+/g, ' ').trim().slice(0, 30);
  if (v === (settings.name || '')) return;
  settings.name = v; saveSettings();
  $('#optName').value = v;
  var wn = $('#welcomeName'); if (wn && document.activeElement !== wn) wn.value = v;   // anche nel benvenuto, se e' aperto
  renderOwner();
  emit('name', v);                           // il modulo «amici» lo usa come nome per gli amici (16/11/2026)
}
/* la scritta nella ricerca segue la scheda (il nome e i numeri della vecchia testata non ci sono più: titolo e frase li disegna stile-g.js) */
function renderOwner() {
  var qi = $('#q'); if (!qi) return;
  var ph = guest || esempio() ? 'Cerca nell\'elenco' : tab === 'wish' ? 'Cerca nei Desideri' : 'Cerca nei tuoi libri';
  qi.placeholder = ph; qi.setAttribute('aria-label', ph);
}
(function () { var h = document.querySelector('header.top h1'); if (h) h.addEventListener('click', function () { if (guest && window.NLProfilo && window.NLAmici && window.NLAmici.guestId) window.NLProfilo.open(window.NLAmici.guestId()); }); })();   // nella libreria di un amico il suo nome apre il suo profilo
async function sendShare(copyOnly) {
  if (!shareCtx) return;
  var pack = sharePack(), sh = L.parseShare(pack);
  if (pack.n) saveName(pack.n);
  var head = L.shareHeading(sh), text = L.shareText(sh), code = await encodeShare(pack);
  var url = APP_URL + '#l=' + code, one = sh.books.length === 1;
  var invite = one ? 'Aprilo in Next Libris per aggiungerlo ai tuoi libri:' : 'Aprila in Next Libris per aggiungerli ai tuoi:';
  closeShare();
  if (url.length > SHARE_URL_MAX) return shareListFile(pack, sh, head);
  if (!copyOnly && navigator.share) {
    try { await navigator.share({ title: head, text: text + '\n\n' + invite, url: url }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  var all = text + '\n\n' + invite + '\n' + url;
  if (await copyText(all)) toast('Copiato: incollalo in WhatsApp, in un messaggio o in una mail.');
  else { $('#copyBox').value = all; $('#copySheet').hidden = false; $('#copyBox').focus(); $('#copyBox').select(); }
}
/* lista troppo lunga per un link: parte come file (.json, o .txt se il telefono non condivide i .json) */
async function shareListFile(pack, sh, head) {
  var data = JSON.stringify({ app: 'next-libris', share: pack });
  var base = 'next-libris-lista' + (sh.name ? '-' + L.norm(sh.name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : '');
  var how = 'Per aggiungerli: salva il file allegato, poi in Next Libris apri Esporta › «Ripristina da backup o apri una lista ricevuta».';
  var cands = [new File([data], base + '.txt', { type: 'text/plain' })], file = null;   // solo .txt: Chrome su Android rifiuta il .json anche se canShare dice sì (19/11/2026)
  for (var i = 0; i < cands.length && !file; i++) if (navigator.canShare && navigator.canShare({ files: [cands[i]] })) file = cands[i];
  if (file && navigator.share) {
    try { await navigator.share({ files: [file], title: head, text: L.shareText(sh, 10) + '\n\n' + how }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  downloadBlob(base + '.json', data, 'application/json');
  toast('La lista è lunga: l\'ho scaricata come file. Mandalo come allegato; chi lo riceve lo apre da Esporta › Ripristina.');
}
function shareList() {
  var books = shareable().filter(function (b) { return !b.xs; });
  var onlyFlt = !q && activeCount() === (flt ? 1 : 0);
  var kind = tab === 'wish' && !q && !activeCount() ? 'wish' : (flt === 'fav' && onlyFlt ? 'fav' : 'list');
  var title = genFlt && genFlt !== NONE ? facetName('gen', genFlt) : autFlt ? autName : shFlt && shFlt !== NONE ? facetName('sh', shFlt) : edFlt ? facetName('e', edFlt) : q ? q : '';
  openShare(books, { kind: kind, title: String(title || '').slice(0, 40) });
}
$('#shareForm').addEventListener('submit', function (e) { e.preventDefault(); sendShare(false); });
$('#shareCopy').addEventListener('click', function () { sendShare(true); });
$('#shareClose').addEventListener('click', closeShare);
$('#shareSheet').addEventListener('click', function (e) { if (e.target === e.currentTarget) closeShare(); });
$('#shareName').addEventListener('input', sharePreview);
$('#shareTitle').addEventListener('input', sharePreview);
$('#btnShareList2').addEventListener('click', shareList);
$('#optName').addEventListener('change', function (e) { saveName(e.target.value); e.target.value = settings.name; toast(settings.name ? 'Nome salvato: ' + settings.name + '.' : 'Nome tolto.'); });
document.addEventListener('change', function (e) { if (e.target.id === 'welcomeName') { saveName(e.target.value); e.target.value = settings.name; } });

/* --- libri ricevuti: anteprima, scelta, e dove metterli --- */
var incoming = null;
function ownedLike(x) {
  var k = L.norm(x.t) + '|' + L.norm(x.a);
  return state.books.find(function (b) {
    var bi = L.toIsbn13(b.i);
    if (x.i && bi) return bi === x.i;                      // due ISBN: decide l'ISBN (edizioni diverse = libri diversi)
    return !!x.t && L.norm(b.t) + '|' + L.norm(b.a) === k;
  }) || null;
}
function openImport(sh) {
  incoming = sh;
  var n = sh.books.length, have = 0;
  $('#importH').textContent = L.shareHeading(sh);
  $('#importList').innerHTML = sh.books.map(function (x, i) {
    var o = ownedLike(x), where = o ? (o.w ? 'Già nei Desideri' : 'Ce l\'hai già') : '';
    if (o) have++;
    var ed = [x.e, x.y, x.gen, x.pg ? x.pg + ' pagine' : ''].filter(Boolean).join(' · ');
    return '<li><label class="imp-row' + (o ? ' have' : '') + '"><input type="checkbox" data-i="' + i + '"' + (o ? ' disabled' : ' checked') + '>' +
      '<span class="imp-c">' + (x.img ? '<img src="' + esc(x.img) + '" alt="" loading="lazy" referrerpolicy="no-referrer" data-rm>' : '') + '</span>' +
      '<span class="imp-t"><b>' + esc(x.t || 'ISBN ' + x.i) + '</b>' + (x.a ? '<span>' + esc(x.a) + '</span>' : '') + (ed ? '<small>' + esc(ed) + '</small>' : '') + '</span>' +
      (where ? '<span class="tag">' + where + '</span>' : '') + '</label></li>';
  }).join('');
  $('#importList').classList.toggle('single', n === 1);
  $('#importMsg').textContent = (n === 1 ? '' : n + ' libri. ') + (have === n ? (n === 1 ? 'Questo libro è già nel tuo elenco.' : 'Sono già tutti nel tuo elenco.')
    : (n === 1 ? 'Dove lo metto?' : 'Togli la spunta a quelli che non ti interessano, poi scegli dove metterli.') + (have ? ' ' + have + (have === 1 ? ' ce l\'hai già.' : ' li hai già.') : ''));
  $('#importHint').textContent = 'Desideri: libri da comprare o da leggere. Libreria: libri che hai già in casa.' + (sh.name ? ' Resteranno segnati «Da ' + sh.name + '».' : '');
  $('#importWish').hidden = $('#importLib').hidden = have === n;
  $('#importClose').textContent = have === n ? 'Chiudi' : 'Non ora';
  $('#importSheet').hidden = false;
}
function closeImport() { $('#importSheet').hidden = true; incoming = null; }
function doImport(wish) {
  var sh = incoming;
  if (!sh) return;
  var picked = Array.prototype.map.call($('#importList').querySelectorAll('input:checked:not(:disabled)'), function (c) { return sh.books[+c.dataset.i]; }).filter(Boolean);
  if (!picked.length) { toast('Metti la spunta ad almeno un libro.'); return; }
  var from = sh.name || 'un amico', label = L.shareLabel(sh), ids = [], now = Date.now();
  picked.forEach(function (x, k) {
    var b = blankBook({ t: x.t, a: x.a, e: x.e, y: x.y, i: x.i, img: x.img, imgL: x.imgL, gen: x.gen, pg: x.pg, w: wish, fr: from, fl: label, ts: now + k, ck: today() });
    state.books.push(b); ids.push(b.id);
  });
  closeImport();
  q = ''; $('#q').value = ''; setView('list'); setTab(wish ? 'wish' : 'lib');
  frFlt = from; renderList(); updateSummary(); touch();
  toast(ids.length + (ids.length === 1 ? ' libro aggiunto' : ' libri aggiunti') + (wish ? ' ai Desideri.' : ' alla Libreria.'), { label: 'Annulla', fn: function () {
    state.books = state.books.filter(function (b) { return ids.indexOf(b.id) < 0; }); frFlt = ''; renderList(); updateSummary(); touch(); } });
  // le copertine: le cerco con calma, solo della stessa edizione
  if (navigator.onLine !== false) ids.slice(0, 40).forEach(function (id) {
    coverPool(async function () {
      var b = get(id);
      if (!b || smallImg(b) || !L.toIsbn13(b.i)) return;
      try { var r = await findCover(b, 6000, true); b = get(id); if (r && !r.alt && b && !smallImg(b)) { b.img = r.url; if (r.big) b.imgL = r.url; touch(); syncThumbs(); refreshRow(id); } } catch (e) { nlErr(e); }
    });
  });
}
$('#importWish').addEventListener('click', function () { doImport(true); });
$('#importLib').addEventListener('click', function () { doImport(false); });
$('#importClose').addEventListener('click', closeImport);
/* link ricevuto: l'app si apre con «#l=...» nell'indirizzo */
var hashBusy = false;
async function checkIncoming() {
  var m = /^#([lk])=([\w-]+)$/.exec(location.hash || '');
  if (!m || hashBusy) return;
  hashBusy = true;
  try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) { nlErr(e); }
  try {
    if (m[1] === 'k') { toast('I link con l’API non si usano più: chiedi all\'amico di prestartela da Next Libris (Indice › API Google Libri).'); hashBusy = false; return; }   // giro 8: si presta solo dentro l'app
    else openImport(await decodeShare(m[2]));
  }
  catch (e) { toast(e && e.message === 'vecchio' ? 'Questo browser è troppo vecchio per aprire il link: aggiorna Chrome e riprova.' : (m[1] === 'k' ? 'Il link non contiene un’API valida' : 'Il link non contiene una lista valida') + ': forse è stato tagliato. Fattelo rimandare.'); }
  hashBusy = false;
}
window.addEventListener('hashchange', checkIncoming);
async function shareWish() { shareList(); }
/* ---------- API Google Libri: si presta solo dentro l'app (amici.js); il link «#k=...» è stato tolto (giro 8, Piero 18/11/2026).
   Il worker SBN non si presta più: è uno solo, della casa (031, 20/11/2026). ---------- */
function cleanKey(v) { v = String(v || '').replace(/\s+/g, ''); return /^[A-Za-z0-9_-]{20,80}$/.test(v) ? v : ''; }
/* Condivisione › «API Google Libri», su misura (Piero, 16/11/2026): chi ha la sua la presta; chi usa quella di un amico
   lo vede scritto e può smettere; chi non ha la sua trova la guida per crearla (è gratis). Il resto sta nella finestra dell’API (amici.js). */
function svcRow(k, t, sub) { return '<button type="button" class="dopt dgo svc-go" data-svc="' + k + '"><span><b>' + esc(t) + '</b><small>' + esc(sub) + '</small></span><span class="n" aria-hidden="true">›</span></button>'; }
function renderSvcShare() {
  var nm = ($('#optName').value || settings.name || 'Piero').trim();
  $('#optNameHint').textContent = 'Compare quando condividi un libro o una lista: «I consigli di ' + nm + '», «' + nm + ' ti consiglia un libro». Per un libro apri la sua scheda e tocca «Condividi»; per una lista usa «Condividi la lista» sopra l\'elenco, oppure Esporta.';
  var mgk = mine('key'), b = lent(), bg = !!(b.gb && b.gb === settings.gbKey), h = '';
  var A = window.NLAmici, nUse = A && A.lentCount ? A.lentCount() : -1;   // contatore: solo gli amici (giro 5)
  if (mgk) h += svcRow('lend', 'Presta a un amico', 'La tua API Google: la usate tutti e due e smetti quando vuoi.' + (nUse >= 0 ? ' ' + A.lentText(nUse) + '.' : ''));
  var off = !bg && A && A.offers ? A.offers() : [];
  if (off.length) h += svcRow('offer', off[0].nome + (off.length > 1 ? ' e altri ' + (off.length - 1) : '') + ' ti ' + (off.length > 1 ? 'prestano' : 'presta') + ' l’API Google', 'Tocca per usarla: la ricerca trova più libri.');
  if (bg) h += svcRow('used', 'Usi l’API Google di ' + (b.nome || 'un amico'), 'Prestata da un amico: tocca per vedere o per smettere di usarla.');
  if (!mgk) {
    if (!bg && !off.length) h += '<p class="hint">Con un’API Google tua la ricerca trova più libri, con copertina e descrizione. Se un amico ti presta la sua, la vedi qui.</p>';
    h += svcRow('guide', 'Crea la tua API Google', 'È gratis: 1.000 ricerche al giorno solo per te, in circa 5 minuti.');
  }
  $('#svcBox').innerHTML = h;
}
$('#svcBox').addEventListener('click', function (e) {
  var r = e.target.closest('[data-svc]'); if (!r) return;
  var k = r.dataset.svc, A = window.NLAmici, R = window.NLRicerche;
  if (k === 'guide') { if (R && R.guide) R.guide(true); else openOptions('search', true); return; }
  if (A && A.keys) A.keys();
});
(hooks.keys || (hooks.keys = [])).push(function () { if (optOpen && !$('#optSheet .opt-sec[data-sec="search"]').hidden) { renderSvc(); renderSvcShare(); } });   // «Con gli amici» sta in Ricerca dei libri (17/11/2026)
/* ---------- 7) unisci i doppioni ---------- */
function mergeDups() {
  var all = L.dupGroups(dupPool());
  var groups = all.filter(function (g) { return !g.some(function (b) { return b.cp; }); });
  var held = all.length - groups.length;
  if (!groups.length) { toast(held ? 'Non ci sono doppioni da unire: i libri ripetuti sono segnati come copie diverse.' : 'Non ci sono doppioni.'); return; }
  var snapshot = JSON.stringify(state.books), removed = 0;
  groups.forEach(function (g) {
    var m = L.mergeBooks(g), keep = cleanBook(m.keep);
    var i = state.books.findIndex(function (b) { return b.id === keep.id; });
    if (i >= 0) state.books[i] = keep;
    m.removed.forEach(function (rid) {
      if (!coverURL[keep.id] && coverURL[rid]) fetch(coverURL[rid]).then(function (r) { return r.blob(); }).then(function (bl) { return saveCover(keep.id, bl); }).catch(function () {});
    });
    state.books = state.books.filter(function (b) { return m.removed.indexOf(b.id) < 0; });
    removed += m.removed.length;
  });
  renderList(); touch(); updateSummary();
  toast('Uniti ' + removed + (removed === 1 ? ' doppione' : ' doppioni') + ' in ' + groups.length + (groups.length === 1 ? ' libro' : ' libri') + (held ? '; non toccati ' + held + ' con copie segnate.' : '.'), { label: 'Annulla', fn: function () { state.books = JSON.parse(snapshot).map(cleanBook).filter(Boolean); renderList(); touch(); updateSummary(); } });
}

/* ---------- 7) promemoria dei prestiti lunghi ---------- */
function checkLoanNag() {
  var DAY = 86400000, now = Date.now();
  if (now - settings.loanSnooze < 7 * DAY || !$('#notice').hidden) return;
  var old = state.books.filter(function (b) { return !b.w && b.p && b.pd && now - Date.parse(b.pd) > 30 * DAY; })
    .sort(function (x, y) { return x.pd < y.pd ? -1 : 1; });
  if (!old.length) return;
  var b = old[0], ago = L.agoText(Date.parse(b.pd)).replace(/ fa$/, '');
  var msg = b.p + ' ha «' + (b.t || b.i) + '» da ' + ago + '.' + (old.length > 1 ? ' Altri ' + (old.length - 1) + (old.length === 2 ? ' libro è' : ' libri sono') + ' in prestito da più di un mese.' : '');
  function later() { settings.loanSnooze = Date.now(); saveSettings(); }
  notice(msg, 'Vedi i prestiti', function () { later(); if (tab !== 'lib') setTab('lib'); flt = 'loan'; renderList(); updateSummary(); window.scrollTo({ top: 0 }); }, later, 'loan');
}

/* ---------- 7) catalogo stampabile / PDF ---------- */
async function printCatalog() {
  var books = visible().filter(hasData);
  if (!books.length) { toast('Non ci sono libri da stampare con la ricerca e i filtri attuali.'); return; }
  var covers = $('#printCovers').checked && books.some(function (b) { return !!smallImg(b); });
  var has = function (k) { return books.some(function (b) { return b[k]; }); };
  var cols = [['t', 'Titolo'], ['a', 'Autore'], ['e', 'Casa editrice'], ['y', 'Anno']];   // giro 7: niente colonna Prezzo
  if (has('sh')) cols.push(['sh', 'Scaffale']);
  if (has('rs')) cols.push(['rs', 'Lettura']);
  if (has('p')) cols.push(['p', 'Prestato a']);
  if (has('xs')) cols.push(['xs', 'Non più in libreria']);
  var filt = [q ? 'ricerca «' + q + '»' : '', flt === 'loan' ? 'solo libri in prestito' : '', flt === 'gone' ? 'solo venduti e regalati' : '', flt === 'guess' ? 'solo da verificare' : '', flt === 'dup' ? 'solo copie e doppioni' : '', readFlt ? 'lettura: ' + READ_TXT[readFlt].toLowerCase() : '', shFlt ? 'scaffale: ' + facetName('sh', shFlt) : '', genFlt ? 'genere: ' + facetName('gen', genFlt) : '', autFlt ? 'autore: ' + autName : '', edFlt ? 'casa editrice: ' + facetName('e', edFlt) : ''].filter(Boolean).join(', ');
  function cell(b, k) {
    if (k === 'rs') return readLabel(b);
    if (k === 'xs') return esc(goneText(b));
    return esc(b[k] || '');
  }
  $('#printView').innerHTML = '<h1>Next Libris · ' + (tab === 'wish' ? 'Desideri' : 'Libreria') + '</h1>' +
    '<p class="pv-sub">' + esc(L.itDate(today())) + ' · ' + books.length + (books.length === 1 ? ' libro' : ' libri') + (filt ? ' · ' + esc(filt) : '') + '</p>' +
    '<table><thead><tr>' + (covers ? '<th></th>' : '') + cols.map(function (c) { return '<th>' + c[1] + '</th>'; }).join('') + '</tr></thead><tbody>' +
    books.map(function (b) {
      var img = covers ? smallImg(b) : '';
      return '<tr>' + (covers ? '<td class="pv-img">' + (img ? '<img src="' + esc(img) + '" alt="" referrerpolicy="no-referrer">' : '') + '</td>' : '') +
        cols.map(function (c) { return '<td class="pv-' + c[0] + '">' + cell(b, c[0]) + '</td>'; }).join('') + '</tr>';
    }).join('') + '</tbody></table>';
  $('#exportSheet').hidden = true;
  if (covers) {
    var imgs = Array.prototype.slice.call(document.querySelectorAll('#printView img'));
    await Promise.race([Promise.all(imgs.map(function (i) { return i.complete ? 1 : new Promise(function (r) { i.onload = i.onerror = r; }); })), new Promise(function (r) { setTimeout(r, 5000); })]);
  }
  window.print();
}
window.addEventListener('afterprint', function () { $('#printView').innerHTML = ''; });

/* ---------- prestiti ---------- */
var loanId = null;
/* Una sola finestra per dire dov'e' il libro: prestato (a chi, dal giorno), venduto (il giorno, a chi se vuoi),
   regalato (a chi, il giorno) o smarrito (dal giorno). Venduti, regalati e smarriti restano nell'elenco, in grigio,
   ma non contano piu' nel numero dei libri ne' nel valore della libreria. */
var loanKind = 'p';
var KIND_TXT = {
  p: { h: 'Presta, vendi o regala', who: 'A chi', date: 'Dal giorno', need: 'Scrivi a chi lo presti.', hint: 'Prestato: resta tuo, e quando torna tocchi «Restituito».' },
  v: { h: 'Presta, vendi o regala', who: 'A chi (facoltativo)', date: 'Venduto il', hint: 'Venduto: non è più tuo; resta nell\'elenco, in grigio, come storico della libreria.' },
  r: { h: 'Presta, vendi o regala', who: 'A chi', date: 'Regalato il', need: 'Scrivi a chi l\'hai regalato.', hint: 'Regalato: non è più tuo; resta nell\'elenco, in grigio, come storico della libreria.' },
  s: { h: 'Libro smarrito', who: '', date: 'Smarrito dal' }
};
function setLoanKind(k) {
  var b = get(loanId);
  loanKind = KIND_TXT[k] ? k : 'p';
  var t = KIND_TXT[loanKind];
  Array.prototype.forEach.call($('#loanKind').querySelectorAll('button'), function (x) {
    x.setAttribute('aria-pressed', x.dataset.k === loanKind ? 'true' : 'false');
    if (x.dataset.k === 's') x.hidden = !(b && b.xs === 's');      // smarrito: solo per i libri segnati cosi' in passato
  });
  $('#loanHint').textContent = t.hint || '';
  $('#loanH').textContent = b && loanKind === 'p' && b.p ? 'In prestito' : t.h;
  $('#loanWhoF').hidden = !t.who;
  $('#loanWhoL').textContent = t.who || 'A chi';
  $('#loanDateL').textContent = t.date;
  $('#loanErr').hidden = true;
  var cur = b && (b.xs || (b.p ? 'p' : ''));
  $('#loanBack').hidden = !b || !cur;
  $('#loanBack').textContent = !b ? '' : b.xs === 's' ? 'Ritrovato' : b.xs ? 'È tornato in libreria' : 'Restituito';
}
function openLoan(id, kind) {
  var b = get(id);
  if (!b) return;
  loanId = id;
  var k = kind || b.xs || 'p';
  $('#loanBook').textContent = b.t || b.i || 'Libro senza titolo';
  $('#loanWho').value = (b.xs ? b.xa : b.p) || '';
  $('#loanDate').value = (b.xs ? b.xd : b.pd) || today();
  setLoanKind(k);
  $('#loanSheet').hidden = false;
  setTimeout(function () { var f = $('#loanSheet button'); if (f) f.focus({ preventScroll: true }); }, 50);   // niente tastiera all'apertura: si tocca «A chi» quando serve
}
function closeLoan() { $('#loanSheet').hidden = true; loanId = null; }
function saveLoan() {
  var b = get(loanId), who = $('#loanWho').value.replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!b) { closeLoan(); return; }
  var t = KIND_TXT[loanKind];
  if (t.need && !who) { $('#loanErr').textContent = t.need; $('#loanErr').hidden = false; $('#loanWho').focus(); return; }
  var date = /^\d{4}-\d\d-\d\d$/.test($('#loanDate').value) ? $('#loanDate').value : today();
  var id = loanId, old = { p: b.p, pd: b.pd, xs: b.xs, xd: b.xd, xa: b.xa };
  if (loanKind === 'p') { b.p = who; b.pd = date; b.xs = ''; b.xd = ''; b.xa = ''; }
  else { b.xs = loanKind; b.xd = date; b.xa = loanKind === 's' ? '' : who; b.p = ''; b.pd = ''; }
  closeLoan();
  touch();
  if (flt === 'loan' || flt === 'gone') renderList(); else refreshRow(id);
  updateSummary();
  var msg = loanKind === 'p' ? prestatoA(b.p) + '.' : goneText(b) + '.';
  toast(msg, { label: 'Annulla', fn: function () { var x = get(id); if (x) { Object.assign(x, old); renderList(); touch(); updateSummary(); } } });
  emit('loan', { id: id, kind: loanKind, who: who, old: old });   // il modulo amici: se e' un amico dell'app, lo vede anche lui
}
function returnLoan() {
  var b = get(loanId);
  if (!b) { closeLoan(); return; }
  if (b.xs) {
    var gid = loanId, gold = { xs: b.xs, xd: b.xd, xa: b.xa }, was = b.xs;
    b.xs = ''; b.xd = ''; b.xa = '';
    closeLoan();
    if (flt === 'gone') renderList(); else refreshRow(gid);
    touch(); updateSummary();
    toast(was === 's' ? 'Ritrovato: di nuovo in libreria.' : 'Di nuovo in libreria.', { label: 'Annulla', fn: function () { var x = get(gid); if (x) { Object.assign(x, gold); renderList(); touch(); updateSummary(); } } });
    emit('loanBack', { id: gid, old: gold });
    return;
  }
  var id = loanId, old = { p: b.p, pd: b.pd };
  b.p = ''; b.pd = '';
  closeLoan();
  if (flt === 'loan') renderList(); else refreshRow(id);
  touch(); updateSummary();
  toast('Segnato come restituito.', { label: 'Annulla', fn: function () { var x = get(id); if (x) { x.p = old.p; x.pd = old.pd; renderList(); touch(); updateSummary(); } } });
  emit('loanBack', { id: id, old: old });
}
/* ---------- desideri ---------- */
function moveToLib(id, quiet) {
  var b = get(id);
  if (!b || !b.w) return;
  var oldTs = b.ts;
  var oldRs = b.rs, oldOpen = openState[id];
  b.w = false; b.ts = Date.now();
  if (!b.rs) b.rs = 'da';
  openState[id] = false;                         // nell'altro elenco arriva chiuso, in vista compatta
  touch();
  if (!scanning) { renderList(); updateSummary(); }
  if (!quiet) toast('Spostato in Libreria: ' + (b.t || b.i), { label: 'Annulla', fn: function () { var x = get(id); if (x) { x.w = true; x.ts = oldTs; x.rs = oldRs; openState[id] = oldOpen; touch(); renderList(); updateSummary(); } } });
}
/* Dalla Libreria ai Desideri: il libro torna «da comprare»; prestito, stato e lettura non hanno piu' senso e si tolgono
   (con «Annulla» torna tutto com'era). */
function moveToWish(id) {
  var b = get(id);
  if (!b || b.w) return;
  var keep = ['w', 'ts', 'p', 'pd', 'xs', 'xd', 'xa', 'rs', 'rt', 'rd', 'cp'], before = {};
  keep.forEach(function (k) { before[k] = b[k]; });
  var oldOpen = openState[id];
  openState[id] = false;                         // nell'altro elenco arriva chiuso, in vista compatta
  b.w = true; b.ts = Date.now();
  b.p = ''; b.pd = ''; b.xs = ''; b.xd = ''; b.xa = ''; b.rs = ''; b.rt = 0; b.rd = ''; b.cp = false;
  touch(); renderList(); updateSummary();
  toast('Spostato nei Desideri: ' + (b.t || b.i), { label: 'Annulla', fn: function () { var x = get(id); if (x) { Object.assign(x, before); openState[id] = oldOpen; touch(); renderList(); updateSummary(); } } });
}
function setTab(t) {
  if (gridRet && settings.view !== 'grid') setView('grid');   // aperta dalle copertine: nell'altra scheda si resta in copertine
  gridRet = null;
  if (selOn) endSel(false);
  tab = t === 'wish' ? 'wish' : 'lib';
  flt = ''; shFlt = ''; genFlt = ''; autFlt = ''; autName = ''; edFlt = ''; frFlt = ''; paFlt = '';
  document.body.classList.toggle('wishtab', tab === 'wish');
  renderList(); updateSummary();
}
function setView(v) {
  settings.view = v === 'grid' ? 'grid' : 'list';
  saveSettings();
  var b = $('#btnView');
  b.innerHTML = settings.view === 'grid' ? icon('list') + 'Elenco' : icon('grid') + 'Copertine';
  b.setAttribute('aria-label', settings.view === 'grid' ? 'Mostra come elenco' : 'Mostra le copertine');
}
/* Dalle copertine: la scheda si apre nell'elenco; chiudendola (freccetta o Indietro) si torna alle copertine, allo stesso punto */
var gridRet = null;
function openFromGrid(id) {
  if (!settings.openAll) state.books.forEach(function (x) { if (x.id !== id) openState[x.id] = false; });   // solo la sua scheda aperta (anche i libri senza titolo restano chiusi)
  gridRet = { id: id, y: window.scrollY };
  openState[id] = true;
  setView('list');
  renderList();
  try { if (cardPushed) history.replaceState({ card: id }, ''); else history.pushState({ card: id }, ''); cardPushed = id; } catch (e) { nlErr(e); }   // Indietro chiude la scheda
  var el = rowEl(id);
  if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); setTimeout(function () { el.classList.remove('flash'); }, 1600); }
}
function backToGrid() {                          // chiamata quando l'ultima scheda aperta si chiude
  var r = gridRet; gridRet = null;
  if (!r || settings.view === 'grid') return false;
  setView('grid'); renderList();
  window.scrollTo(0, r.y);
  requestAnimationFrame(function () {
    window.scrollTo(0, r.y);
    var c = document.querySelector('#list .cover[data-id="' + r.id + '"]');
    if (c) { c.classList.add('flash'); setTimeout(function () { c.classList.remove('flash'); }, 1200); try { c.focus({ preventScroll: true }); } catch (e) { nlErr(e); } }
  });
  return true;
}
function gridGone() {                            // aperta dalle copertine, ma il libro non e' piu' in questa scheda
  if (!gridRet || settings.view === 'grid' || guest) return false;
  var b = get(gridRet.id);
  return !b || !!b.w !== (tab === 'wish');
}
function dropCard() { if (cardPushed) { cardPushed = null; try { history.back(); } catch (e) { nlErr(e); } } }   // la voce «scheda aperta» nella cronologia
function anyOpen() { return !settings.openAll && Object.keys(openState).some(function (k) { var x = get(k); return openState[k] && x && x.t; }); }
/* ---------- statistiche ---------- */
function barsHTML(title, items, filterable) {
  if (!items.length) return '';
  var max = items.reduce(function (m, x) { return Math.max(m, x.n); }, 1);
  return '<section class="st-sec"><h3>' + esc(title) + '</h3><div class="bars">' + items.map(function (x) {
    var inner = '<span class="bl">' + esc(x.k) + '</span><span class="bt"><span class="bf" style="width:' + Math.max(2, Math.round(x.n / max * 100)) + '%"></span></span><span class="bv">' + x.n + '</span>';
    return filterable ? '<button class="bar-row" data-sf="' + filterable + '" data-sv="' + esc(x.k) + '" title="Mostra questi libri">' + inner + '</button>' : '<div class="bar-row">' + inner + '</div>';   // filterable: il campo (a, e, gen, sh)
  }).join('') + '</div></section>';
}
/* obiettivo di lettura dell'anno: libri segnati «Letto» con la data in quest'anno */
function goalHTML() {
  var y = String(new Date().getFullYear()), g = Math.max(0, parseInt(settings.goal, 10) || 0);
  var n = state.books.filter(function (b) { return !b.w && b.rs === 'ok' && L.str(b.rd).slice(0, 4) === y; }).length;
  var head = '<section class="st-sec goal"><h3>Obiettivo di lettura ' + y + '</h3>';
  var form = '<label class="goal-set"><span>' + (g ? 'Cambia obiettivo' : 'Quanti libri vuoi leggere quest\'anno?') + '</span><input id="goalIn" type="text" inputmode="numeric" enterkeyhint="done" maxlength="3" autocomplete="off" placeholder="es. 20" value="' + (g || '') + '"><button type="button" class="btn" id="goalSave">Salva</button></label>';
  if (!g) return head + '<p class="msg">Finora ne hai ' + (n === 1 ? 'letto 1' : 'letti ' + n) + '.</p>' + form + '</section>';
  var now = new Date(), start = new Date(now.getFullYear(), 0, 1), end = new Date(now.getFullYear() + 1, 0, 1);
  var part = (now - start) / (end - start), due = Math.round(g * part), left = g - n;
  var pace = n >= g ? 'Obiettivo raggiunto' + (n > g ? ': ' + (n - g) + ' in più' : '') + '.' :
    n >= due ? 'Sei in linea: ne ' + (left === 1 ? 'manca 1' : 'mancano ' + left) + '.' :
    'Sei indietro di ' + (due - n) + (due - n === 1 ? ' libro' : ' libri') + ' rispetto al ritmo: ne ' + (left === 1 ? 'manca 1' : 'mancano ' + left) + '.';
  return head + '<p class="goal-n"><b>' + n + '</b> di ' + g + (g === 1 ? ' libro' : ' libri') + '</p>' +
    '<div class="goal-bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + g + '" aria-valuenow="' + Math.min(n, g) + '" aria-label="Libri letti quest\'anno"><span style="width:' + Math.min(100, Math.round(n / g * 100)) + '%"></span><i style="left:' + Math.round(part * 100) + '%" title="Oggi"></i></div>' +
    '<p class="msg">' + pace + ' Contano i libri segnati «Letto» con la data in quest\'anno.</p>' +
    '<details class="goal-more"><summary>Cambia obiettivo</summary>' + form.replace('<span>Cambia obiettivo</span>', '<span>Libri da leggere nel ' + y + ' (0 per toglierlo)</span>') + '</details></section>';
}
function saveGoal() {
  var v = Math.min(999, parseInt($('#goalIn').value.replace(/\D/g, ''), 10) || 0);
  settings.goal = v; saveSettings();
  var box = $('#statsBody .goal'); if (box) box.outerHTML = goalHTML();
  toast(v ? 'Obiettivo: ' + v + (v === 1 ? ' libro' : ' libri') + ' quest\'anno.' : 'Obiettivo tolto.');
}
function openStats() {
  if (guest) guestExit(true);                      // «Per te» e il Menu parlano sempre della tua libreria (Piero, 17/11/2026 sera)
  var books = tabBooks().filter(hasData);
  if (!books.length) { toast('Aggiungi qualche libro per vedere le statistiche.'); return; }
  var st = L.computeStats(books);
  if (!st.n && !st.gone) { toast('Aggiungi qualche libro per vedere le statistiche.'); return; }
  function tile(v, l, note) { return '<div class="tile"><b>' + esc(v) + '</b><span>' + esc(l) + '</span>' + (note ? '<small>' + esc(note) + '</small>' : '') + '</div>'; }
  var nf = new Intl.NumberFormat('it-IT');
  var tiles = tile(nf.format(st.n), tab === 'wish' ? 'da comprare' : 'libri') +
    (st.paged ? tile(nf.format(st.pages), 'pagine', st.paged < st.n ? 'su ' + st.paged + (st.paged === 1 ? ' libro' : ' libri') + ' · senza pagine: ' + (st.n - st.paged) : '') : '') +
    (tab === 'lib' ? tile(String(st.loans.length), 'in prestito') : '') +
    (st.gone ? tile(String(st.gone), 'non più in libreria', [st.goneBy.v ? st.goneBy.v + (st.goneBy.v === 1 ? ' venduto' : ' venduti') : '', st.goneBy.r ? st.goneBy.r + (st.goneBy.r === 1 ? ' regalato' : ' regalati') : '', st.goneBy.s ? st.goneBy.s + (st.goneBy.s === 1 ? ' smarrito' : ' smarriti') : ''].filter(Boolean).join(' · ')) : '') +
    (tab === 'lib' && (st.read || st.reading || st.toRead) ? tile(String(st.read), 'letti', [st.reading ? st.reading + ' in lettura' : '', st.toRead ? st.toRead + ' da leggere' : ''].filter(Boolean).join(' · ')) : '') +
    (st.pagesRead ? tile(nf.format(st.pagesRead), 'pagine lette') : '') +
    (st.rated ? tile(st.avgRating.toFixed(1).replace('.', ',') + ' su 5', 'voto medio: ' + L.rateWord(st.avgRating).toLowerCase(), 'su ' + st.rated + (st.rated === 1 ? ' libro' : ' libri')) : '') +
    (st.guess ? tile(String(st.guess), 'da verificare') : '');
  var loans = st.loans.length ? '<section class="st-sec"><h3>In prestito</h3><ul class="loans">' + st.loans.map(function (x) {
    return '<li><b>' + esc(x.p) + '</b> · ' + esc(x.t) + (x.pd ? ' <small>dal ' + esc(L.itDate(x.pd)) + ', ' + esc(L.agoText(Date.parse(x.pd))) + '</small>' : '') + '</li>';
  }).join('') + '</ul></section>' : '';
  $('#statsH').textContent = 'Statistiche · ' + (tab === 'wish' ? 'Desideri' : 'Libreria');
  $('#statsBody').innerHTML = '<div class="tiles">' + tiles + '</div>' + (tab === 'lib' ? goalHTML() : '') + loans + (tab === 'lib' ? seriesStatsHTML() : '') +
    barsHTML('Autori più presenti', st.topAuthors, 'a') + wdStatsHTML() + barsHTML('Case editrici', st.topPublishers, 'e') +
    barsHTML('Generi', st.topGenres, 'gen') + barsHTML('Scaffali', st.topShelves, 'sh') + barsHTML('Anno di pubblicazione, per decennio', st.byDecade, false) +
    barsHTML('Libri letti, per anno', st.byReadYear, false) +
    '<p class="msg">Tocca un nome per vedere quei libri.</p>';
  $('#statsSheet').hidden = false;
  wdKick(0);                                           // i paesi che mancano si cercano adesso (giro 2)
}
/* ---------- case editrici: uniforma i nomi ---------- */
var pubGroups = [];
function openPubs() {
  pubGroups = L.publisherGroups(state.books);
  if (!pubGroups.length) { toast('Non ho trovato case editrici scritte in modi diversi.'); return; }
  $('#pubList').innerHTML = pubGroups.map(function (g, gi) {
    return '<fieldset class="pgrp"><legend>' + g.total + ' libri</legend>' + g.names.map(function (x, ni) {
      var sel = x.name === g.suggested;
      return '<div class="pname"><label class="pr"><input type="radio" name="pg' + gi + '" value="' + ni + '"' + (sel ? ' checked' : '') + '><span><b>' + esc(x.name) + '</b> <small>' + x.count + (x.count === 1 ? ' libro' : ' libri') + '</small></span></label>' +
        '<label class="pc"><input type="checkbox" data-g="' + gi + '" data-n="' + ni + '" checked' + (sel ? ' disabled' : '') + '>cambia</label></div>';
    }).join('') + '</fieldset>';
  }).join('');
  $('#pubSheet').hidden = false;
}
function applyPubs() {
  var map = {};
  pubGroups.forEach(function (g, gi) {
    var r = document.querySelector('input[name="pg' + gi + '"]:checked');
    if (!r) return;
    var target = g.names[+r.value].name;
    g.names.forEach(function (x, ni) {
      var cb = document.querySelector('#pubList input[data-g="' + gi + '"][data-n="' + ni + '"]');
      if (x.name !== target && cb && cb.checked) map[x.name] = target;
    });
  });
  var snapshot = JSON.stringify(state.books), n = 0;
  state.books.forEach(function (b) { var t = map[(b.e || '').trim()]; if (t && b.e !== t) { b.e = t; n++; } });
  $('#pubSheet').hidden = true;
  if (!n) { toast('Nessun nome cambiato.'); return; }
  renderList(); touch(); updateSummary();
  toast('Uniformata la casa editrice di ' + n + (n === 1 ? ' libro.' : ' libri.'), { label: 'Annulla', fn: function () { state.books = JSON.parse(snapshot); renderList(); touch(); updateSummary(); } });
}
/* ---------- completa i dati mancanti (genere, pagine, copertina…) dei libri gia' inseriti ---------- */
var filling = false;
async function fillMissing() {
  if (filling) return;
  if (navigator.onLine === false) { toast('Sei offline. Riprova quando c\'è connessione.'); return; }
  var recent = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), skipped = 0;
  var todo = state.books.filter(function (b) {
    if (!(L.toIsbn13(b.i) && !b.nf && !isBusy(b) && (!b.gen || !b.pg || !b.img || !b.e || !b.y || !b.a || !b.t))) return false;
    if (b.ck && b.ck >= recent) { skipped++; return false; }     // gia' cercato di recente: le banche dati non hanno di piu'
    return true;
  });
  if (!todo.length) { toast(skipped ? 'Questi libri sono già stati cercati negli ultimi 30 giorni: le banche dati non hanno altri dati.' : 'Non c\'è niente da completare.'); return; }
  filling = true;
  var btn = $('#btnFill'), done = 0, changed = 0, failed = 0;
  btn.disabled = true;
  toast('Cerco i dati mancanti di ' + todo.length + (todo.length === 1 ? ' libro…' : ' libri…'));
  await Promise.all(todo.map(function (b0) {
    return lookupPool(async function () {
      try {
        var r = await findIsbn(L.toIsbn13(b0.i));
        var b = get(b0.id);
        if (b) b.ck = today();
        if (r && b) {
          var before = JSON.stringify(b);
          ['t', 'a', 'e', 'y', 'gen', 'pg'].forEach(function (k) { if (!b[k] && r[k]) b[k] = r[k]; });
          if (!b.img && r.img) b.img = r.img;
          if (JSON.stringify(b) !== before) changed++;
        }
      } catch (e) { failed++; }
      done++;
      btn.textContent = 'Completo… ' + done + '/' + todo.length;
    });
  }));
  filling = false;
  btn.disabled = false; btn.textContent = 'Completa genere, pagine e copertine';
  touch(); renderList(); updateSummary();
  toast('Completati ' + changed + ' libri' + (failed ? '; ' + failed + ' non riusciti (rete o limite di Google): riprova più tardi.' : '.'));
}
