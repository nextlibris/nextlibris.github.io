/* Next Libris · app, parte 1 di 10 (app.js): utilità, stato, avvisi, versione (APP_VERSION, BUILD).
   Dal 17/11/2026 app.js è diviso in 10 file (prima era una sola funzione). Sono script classici, senza import:
   le funzioni e le variabili di primo livello sono globali e servono a tutte le parti; l'ordine in index.html
   e in SHELL di sw.js conta (app.js, app-aggiungi.js, …, app-avvio.js: l'ultima fa partire l'app). */
'use strict';
var L = window.Lib;

/* ---------- utilità ---------- */
var $ = function (s) { return document.querySelector(s); };
function bindFile(sel, fn) {
  $(sel).addEventListener('change', function (e) {
    var files = Array.prototype.slice.call(e.target.files || []);
    e.target.value = '';
    if (files.length) fn(files);
  });
}
/* Indietro da una finestra aperta dal Menu: la voce del Menu resta nella cronologia sotto la finestra; qui si guarda se la finestra
   era ancora aperta (gesto Indietro: si torna al Menu) o se l'ha gia' chiusa il suo «Chiudi» (si chiude tutto). Deve essere il primo «popstate». */
window.addEventListener('popstate', function (e) { menuPop(e); });
/* Registro degli errori (17/11/2026, dalla verifica): prima ~100 «catch (e) { nlErr(e); }» facevano sparire gli errori senza traccia.
   Ora nlErr() tiene in memoria gli ultimi 20 (con file e riga; mai salvati, mai mandati da soli) e la mail di Menu › Info e aiuto ›
   Contatti li aggiunge in fondo, così chi scrive ci dice anche cosa è andato storto. Lo usano anche i moduli. */
var ERRS = [];
function nlErr(e) {
  try {
    var m = String((e && (e.message || e.name)) || e || '?').replace(/\s+/g, ' ').slice(0, 140);
    var w = ((e && e.stack) || '').match(/\/([\w.-]+\.js):(\d+)/);
    var k = (w ? w[1] + ':' + w[2] + ' ' : '') + m, last = ERRS[ERRS.length - 1];
    if (last && last.k === k) { last.n++; return; }
    ERRS.push({ k: k, n: 1, t: new Date().toTimeString().slice(0, 5) });
    if (ERRS.length > 20) ERRS.shift();
  } catch (x) {}
}
window.nlErr = nlErr;
window.addEventListener('error', function (e) { nlErr(e.error || e.message); });
window.addEventListener('unhandledrejection', function (e) { nlErr(e.reason); });
function errText() {
  return ERRS.length ? '\nUltimi errori:\n' + ERRS.slice(-5).map(function (x) { return x.t + ' ' + x.k + (x.n > 1 ? ' (×' + x.n + ')' : ''); }).join('\n') : '';
}
/* immagini con data-rm: se non si caricano spariscono (prima era onerror="this.remove()" scritto nell'HTML, che la
   Content-Security-Policy non ammette: 17/11/2026) */
document.addEventListener('error', function (e) { var t = e.target; if (t && t.tagName === 'IMG' && t.hasAttribute('data-rm')) t.remove(); }, true);
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
/* Copie parallele (piero907.github.io/next-libris-prova/, in generale …/next-libris-NOME/): stesso codice, ma dati tutti loro.
   Stanno allo stesso indirizzo di base, quindi sul telefono condividerebbero lo stesso spazio: ogni nome di dato ha il prefisso
   della copia («prova:»). COPIA e' il nome della copia ('' per la versione vera, oggi su nextlibris.github.io); PROVA vale solo per la prova. */
var COPIA = (location.pathname.match(/\/next-libris-([a-z]+)(\/|$)/) || [])[1] || '';
var PROVA = COPIA === 'prova';
function lsKey(k) { return COPIA ? COPIA + ':' + k : k; }
var ls = {
  get: function (k) { try { return localStorage.getItem(lsKey(k)); } catch (e) { return null; } },
  set: function (k, v) { try { localStorage.setItem(lsKey(k), v); return true; } catch (e) { return false; } },
  del: function (k) { try { localStorage.removeItem(lsKey(k)); } catch (e) { /* niente da togliere */ } }
};
var ICON = {
  apikey: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>',   // la chiave vera (API Google), non la tastiera di «Digita»
  pen: '<path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20z"/><path d="M13.5 7.5l3 3"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  scan: '<path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2"/><path d="M8 8v8M11 8v8M14 8v8M17 8v8"/>',
  cam: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  euro: '<path d="M17.5 6.8A6.5 6.5 0 0 0 7 12a6.5 6.5 0 0 0 10.5 5.2M5 10.5h9M5 13.5h9"/>',
  key: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  redo: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  award: '<circle cx="12" cy="9" r="5.5"/><path d="M8.7 13.5L7.2 21l4.8-2.7 4.8 2.7-1.5-7.5"/>',   // coccarda: «Lo consiglio» (scelta di Piero, giro 6)
  pin: '<path d="M9 3.5h6l-.9 6.2 3.4 3.3H6.5l3.4-3.3z"/><path d="M12 13v7.5"/>',   // puntina: citazione in evidenza (giro 6)
  fav: '<path d="M12 3.3l2.7 5.5 6 .9-4.35 4.25 1.03 6-5.38-2.83-5.38 2.83 1.03-6L3.3 9.7l6-.9z"/>',   // stella (prima segnalibro: si confondeva, Piero 16/11/2026)
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="17.5" cy="5.5" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/><path d="M8.2 10.8l7.1-4.1M8.2 13.2l7.1 4.1"/>',
  pricetag: '<path d="M3.5 12V5a1.5 1.5 0 0 1 1.5-1.5h7l8.5 8.5a1.5 1.5 0 0 1 0 2.1l-6.4 6.4a1.5 1.5 0 0 1-2.1 0z"/><circle cx="8.2" cy="8.2" r="1.5"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  filt: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  chart: '<path d="M4 20h16M7 16v-5M12 16V7M17 16v-8"/>',
  check: '<path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
  down: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  loan: '<path d="M5 4h9a2 2 0 0 1 2 2v3M5 4v14a2 2 0 0 0 2 2h7"/><path d="M13 15h8M18 12l3 3-3 3"/>',
  bag: '<path d="M6 8h12l-1 12H7z"/><path d="M9 8a3 3 0 0 1 6 0"/><path d="M9.5 14l2 2 3.5-3.5"/>',
  chev: '<path d="M6 9l6 6 6-6"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  swap: '<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>',
  tolib: '<path d="M2.5 20.5h14"/><path d="M4 20.5V10h3v10.5M4 12.5h3M4 18h3"/><path d="M8.2 20.5V7.5h3.4v13M8.2 10h3.4M8.2 18h3.4"/><path d="M12.8 20.5l2-8.4 2.7.6-1.9 7.8"/><path d="M19.5 2.5v8.5M16.5 8l3 3 3-3"/>',
  towish: '<path d="M8.8 20.5S2.5 16.9 2.5 12.6A3.2 3.2 0 0 1 8.8 11a3.2 3.2 0 0 1 6.3 1.6c0 4.3-6.3 7.9-6.3 7.9z"/><path d="M19.5 2.5v8.5M16.5 8l3 3 3-3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  pub: '<path d="M4 20V8l8-4 8 4v12"/><path d="M9 20v-6h6v6M4 20h16"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
  shelf: '<path d="M4 4v16M20 4v16M4 9h16M4 15h16"/><path d="M8 9V5M11 9V6M15 15v-4"/>',
  img: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  left: '<path d="M15 5l-7 7 7 7"/>'
};
/* qualche icona disegnata apposta per l'aspetto «Nuovo» */
var ICON_NEW = {
  loan: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M7 8h1.5"/><path d="M14 12h7M18 8.5l3.5 3.5-3.5 3.5"/>',
  bag: '<path d="M5 8h14l-1.2 11.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>'
};
function icon(n) { var p = (document.documentElement.getAttribute('data-look') === 'nuovo' && ICON_NEW[n]) || ICON[n]; return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; }
$('#icoFilt').innerHTML = icon('filt');
$('#optBack').innerHTML = icon('left');
$('#photoCam').innerHTML = icon('cam') + 'Scatta una foto';
$('#photoGal').innerHTML = icon('img') + 'Scegli dalla galleria';
$('#scanPriceIco').innerHTML = icon('key');

function pool(n) {
  var active = 0, q = [];
  function next() {
    while (active < n && q.length) {
      var f = q.shift(); active++;
      f().then(function () { active--; next(); }, function () { active--; next(); });
    }
  }
  return function (fn) { return new Promise(function (res, rej) { q.push(function () { return fn().then(res, rej); }); next(); }); };
}
var lookupPool = pool(2), photoPool = pool(1), coverPool = pool(2);
var eurFmt = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
var coll = new Intl.Collator('it', { sensitivity: 'base', numeric: true });

/* ---------- stato ---------- */
var LS_KEY = 'catalogo-libri-v2', LS_SET = 'catalogo-libri-set', oldApp = false;
var nlFirstRun = !ls.get(LS_KEY) && !ls.get(LS_SET);   // prima apertura in assoluto (né libri né impostazioni salvate): la guida di primo avvio si apre da sola (giro 4); chi aggiorna non la vede
/* versione dell'app: la stessa di version.json e del nome della cache in sw.js (si aggiornano insieme) */
var APP_VERSION = { v: 118, date: '2026-11-21', note: 'Suggerimenti tutti nuovi: pagina intera con gli scaffali e i consigli degli amici' };
var BUILD = { t: '', n: '', note: '' };   // la copia di prova lo riempie a ogni pubblicazione (pubblica_prova.py): ora, numero («94.9») e nota
function verNewer(j) { return !!(j && (j.v > APP_VERSION.v || (COPIA && BUILD.t && j.build && j.build !== BUILD.t))); }   // copie parallele (prova, social): anche a parita' di versione, con il timbro della pubblicazione
function copiaDi() { return PROVA ? 'della prova' : 'della copia ' + COPIA; }
function buildText(b) { var m = /^(\d{4})-(\d\d)-(\d\d) (\d\d:\d\d)$/.exec(b || ''); return m ? m[3] + '/' + m[2] + ' alle ' + m[4] : b; }
function itLongDate(d) { try { return new Date(d + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return d; } }
function renderVersion() {
  $('#verNum').textContent = 'Versione ' + APP_VERSION.v;
  $('#verDate').textContent = 'del ' + itLongDate(APP_VERSION.date) + (COPIA && BUILD.t ? ' · ' + COPIA + ' ' + (BUILD.n ? BUILD.n + ' ' : '') + 'del ' + buildText(BUILD.t) : '');
  $('#verNote').textContent = COPIA && BUILD.note ? 'Ultime novità ' + copiaDi() + ': ' + BUILD.note : 'Ultime novità: ' + APP_VERSION.note;
  var st = $('#verState'), up = $('#verUpdate');
  if (verNewer(latestVer)) {
    st.textContent = latestVer.v > APP_VERSION.v ? 'È disponibile la versione ' + latestVer.v + ' del ' + itLongDate(latestVer.date) + '.' : 'C\'è un aggiornamento ' + copiaDi() + ((latestVer.copia || latestVer.prova) ? ' (' + (latestVer.copia || latestVer.prova) + ', del ' : ' (del ') + buildText(latestVer.build) + ').';
    st.className = 'ver-state new'; up.hidden = false;
  } else if (latestVer) { st.textContent = '✓ È l\'ultima versione.'; st.className = 'ver-state ok'; up.hidden = true; }
  else if (navigator.onLine === false) { st.textContent = 'Senza rete: non posso controllare se ce n\'è una più nuova.'; st.className = 'ver-state'; up.hidden = true; }
  else { st.textContent = 'Controllo se ce n\'è una più nuova…'; st.className = 'ver-state'; up.hidden = true; }
  $('#verApp').textContent = 'Versione ' + APP_VERSION.v + ' del ' + itLongDate(APP_VERSION.date) + (latestVer && latestVer.v > APP_VERSION.v ? ' (c\'è la ' + latestVer.v + ': aggiorna dall\'Indice)' : '') + '.';
}
var state = { books: [], updated: 0 };
var hooks = {};                              // moduli aggiuntivi (vedi window.NL in fondo): si agganciano dopo l'avvio
function emit(name, arg) { (hooks[name] || []).forEach(function (fn) { try { fn(arg); } catch (e) { if (window.console) console.warn('modulo', name, e); } }); }
var S = {};                                  // stato di sessione per riga: st, msg, thumb, err, cands, lines, price, retry
var settings = { gbKey: '', price: true, extra: true, lastBackup: 0, snooze: 0, view: 'grid', viewDef: 'grid', openAll: false, sbnUrl: '', loanSnooze: 0, look: 'nuovo', theme: 'light', pal: 'bosco', ft: 'literata', fb: 'plex' };
var GRP_TXT = { aut: 'per autore', gen: 'per genere', genaut: 'per genere e autore', read: 'per lettura', pae: 'per paese' };   // «Raggruppa per» (17/11/2026)
var PALS = { inchiostro: ['#EDF0F5', '#10141D'], bordeaux: ['#F2EFEE', '#161112'], bosco: ['#EEF1EE', '#0F1513'] };
var FONTS_T = ['bricolage', 'literata', 'lora', 'roboto'], FONTS_B = ['plex', 'atkinson', 'roboto'];   // restyle «C · Schede» (19/11/2026): Bricolage + Plex di partenza, poche alternative
var openState = {}, autoOpened = {};
function collapseCards() { if (!settings.openAll) openState = {}; if (cardPushed) { cardPushed = null; try { history.back(); } catch (e) { nlErr(e); } } }   // quando si filtra l'elenco torna compatto   // schede aperte/chiuse in questa sessione (true/false); se manca vale la regola di isOpen
var SORTS = ['recent', 'titolo', 'autore', 'editore', 'anno', 'scaffale', 'voto', 'letti'];
var q = '', sortBy = 'recent', flt = '', tab = 'lib', readFlt = '', shFlt = '', genFlt = '', autFlt = '', autName = '', edFlt = '', paFlt = '';   // shFlt, genFlt: chiave normalizzata, NONE = senza   // flt: '' | 'guess' | 'loan'; tab: 'lib' (Libreria) | 'wish' (Desideri)
var tSave = null, toastTimer = null, scanning = false, offlineNoted = false;

function newId() { return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function get(id) { for (var i = 0; i < state.books.length; i++) if (state.books[i].id === id) return state.books[i]; return null; }
function smallImg(b) { var s = S[b.id] || {}; return coverURL[b.id] || b.img || b.imgL || s.thumb || ''; }
function bigImg(b) { var s = S[b.id] || {}; return coverURL[b.id] || b.imgL || b.img || s.big || s.thumb || ''; }
/* Richieste di oggi a Google Libri e al catalogo SBN. Il giorno di Google finisce a mezzanotte ora del Pacifico (le 9 da noi),
   quello del catalogo SBN a mezzanotte UTC (l'1 o le 2 di notte da noi). */
var G_LIMIT = 1000, G_STOP = 950, G_EXTRA = 700;          // con l’API: 1.000 al giorno; le copertine grandi si fermano prima
var quota = { d: '', g: 0, ds: '', s: 0 };
var SBN_CASA = 'https://sbn-casa.invalid/', SBN_MAX = 500, SBN_FREE = 50, LS_SBN = 'catalogo-libri-sbn-casa';
var sbnDay = { d: '', mio: 0, stop: '', said: '' };
try { var sbn0 = JSON.parse(ls.get(LS_SBN) || 'null'); if (sbn0 && sbn0.d) sbnDay = { d: String(sbn0.d), mio: sbn0.mio | 0, stop: String(sbn0.stop || ''), said: String(sbn0.said || '') }; } catch (e) { nlErr(e); }
var shared = { g: 0, d: '' };   // totale di oggi di chi usa la stessa API (modulo ricerche.js, Supabase)
function pacificDay() { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date()); } catch (e) { return new Date().toISOString().slice(0, 10); } }
function utcDay() { return new Date().toISOString().slice(0, 10); }
function loadQuota() { try { var q = JSON.parse(ls.get('catalogo-libri-quota') || '{}'); if (q && q.d) quota = { d: q.d, g: q.g | 0, ds: q.ds || q.d, s: q.s | 0 }; } catch (e) { nlErr(e); } }
function rollQuota() {
  var d = pacificDay(), ds = utcDay();
  if (quota.d !== d) { quota.d = d; quota.g = 0; }
  if (quota.ds !== ds) { quota.ds = ds; quota.s = 0; }
}
function countCall(k) { rollQuota(); quota[k]++; ls.set('catalogo-libri-quota', JSON.stringify(quota)); emit('apiCall', k); if ($('#optSheet').hidden) return; updateQuotaInfo(); }
function gUsed() { rollQuota(); return Math.max(quota.g, shared.d === quota.d ? shared.g : 0); }
/* API Google prestata da un amico (giro 8, Piero 18/11/2026): sul telefono c'è solo il segno «prestata:<id di chi presta>»,
   l’API vera resta sul server. Le ricerche passano dalla funzione «libri» di Supabase, che conta: 300 al giorno per amico
   (x-nl-stop: mio), 950 in tutto per l’API (pieno), prestito tolto (no). */
var LENT_STOP = 'catalogo-libri-prestata-stop', lentStopD = '';
try { lentStopD = ls.get(LENT_STOP) || ''; } catch (e) { nlErr(e); }
function lentOut() { rollQuota(); return !!lentStopD && lentStopD === quota.d && /^prestata:/.test(settings.gbKey || ''); }   // finite le tue ricerche di oggi con l’API dell'amico
function googleLeft(extra) { return !settings.gbKey || (!lentOut() && gUsed() < (extra ? G_EXTRA : G_STOP)); }
function lentFetch(u, da) {
  var S = window.NLSocial, no = { ok: false, status: 429, local: true, json: function () { return Promise.resolve({}); } };
  if (!S || !S.raw || !S.auth()) return Promise.resolve(no);
  var q = u.replace(/^https:\/\/www\.googleapis\.com/, '').replace(/([?&])key=[^&]*(&|$)/, '$1').replace(/[?&]$/, '');
  return S.raw('/functions/v1/libri?da=' + da + '&u=' + encodeURIComponent(q)).then(function (r) {
    var tot = Number(r.headers.get('x-nl-tot')) || 0, stop = r.headers.get('x-nl-stop') || '';
    rollQuota();
    if (tot > 0) { shared.g = tot; shared.d = quota.d; }
    if (stop === 'mio' && lentStopD !== quota.d) {
      lentStopD = quota.d; ls.set(LENT_STOP, lentStopD);
      toast('Per oggi hai finito le ricerche con l’API di ' + (lent().nome || 'un amico') + ': fino a domattina cerco in Open Library e nelle biblioteche.');
    } else if (stop === 'no') emit('lentGone');          // prestito tolto: amici.js rilegge e torna alle tue impostazioni
    if (!$('#optSheet').hidden) updateQuotaInfo();
    return r;
  });
}
function updateQuotaInfo() {
  var nf = new Intl.NumberFormat('it-IT'), g = gUsed();
  var withG = g > quota.g ? ' (con chi usa la stessa API)' : '';
  $('#gbCount').innerHTML = 'Richieste oggi: <b>' + nf.format(g) + '</b>' + (settings.gbKey
    ? withG + ' su 1.000 · si azzera verso le 9' + (g >= G_STOP ? '. Limite quasi raggiunto: le ricerche riprendono domattina' : g >= G_EXTRA ? '. Le copertine grandi aspettano domani' : '')
    : ' · senza API il limite lo decide Google');
  sbnRoll();
  var acc = sbnAuth(), max = acc ? SBN_MAX : SBN_FREE, n = Math.min(max, acc ? sbnDay.mio : quota.s);
  $('#sbnCount').innerHTML = 'Non devi fare niente. Ricerche di oggi: <b>' + nf.format(n) + '</b> su ' + nf.format(max) + '.';   // testo approvato (20/11/2026)
}
/* API Google: quelle usate restano tra le «salvate» (anche dopo «Cancella») per rimetterle con un tocco.
   I worker SBN propri non esistono più (031, 20/11/2026: worker della casa): quelli salvati si tolgono dal telefono, senza avvisi. */
var LS_SAVED = 'catalogo-libri-saved', saved = { sbn: [], key: [] };
function loadSaved() {
  try {
    var o = JSON.parse(ls.get(LS_SAVED) || '{}');
    saved.key = Array.isArray(o.key) ? o.key.filter(function (x) { return typeof x === 'string' && x; }).slice(0, 4) : [];
    if (Array.isArray(o.sbn) && o.sbn.length) ls.set(LS_SAVED, JSON.stringify(saved));   // via i worker salvati
  } catch (e) { nlErr(e); }
  if (settings.gbKey && saved.key.indexOf(settings.gbKey) < 0) remember('key', settings.gbKey);
  var b = lent(), dirty = false;   // tolte dai salvati quelle di un amico finite lì prima del 16/11/2026
  if (b.gb && saved.key.indexOf(b.gb) >= 0) { saved.key = saved.key.filter(function (x) { return x !== b.gb; }); dirty = true; }
  if (dirty) ls.set(LS_SAVED, JSON.stringify(saved));
}
/* API prestata da un amico (amici.js la mette nelle impostazioni per usarla): mai mostrata, salvata, esportata o prestata (Piero, 16/11/2026) */
function lent() { try { return JSON.parse(ls.get('catalogo-libri-amici-chiave-in-uso') || 'null') || {}; } catch (e) { return {}; } }
function isLent(k, v) { return k !== 'sbn' && !!v && lent().gb === v; }
function mine(k) {   // il tuo, anche mentre usi quello di un amico (amici.js tiene da parte il tuo)
  if (k === 'sbn') return '';
  var v = svcVal(k); if (!isLent(k, v)) return v || '';
  try { var m = JSON.parse(ls.get('catalogo-libri-amici-chiavi-mie') || 'null') || {}; return m.gb || ''; } catch (e) { return ''; }
}
function remember(k, v) { if (k === 'sbn' || !v || isLent(k, v)) return; saved[k] = [v].concat(saved[k].filter(function (x) { return x !== v; })).slice(0, 4); ls.set(LS_SAVED, JSON.stringify(saved)); }
function svcVal(k) { return k === 'sbn' ? '' : settings.gbKey; }
function svcShort(k, v) { return v.length > 14 ? v.slice(0, 6) + '…' + v.slice(-4) : v; }
function setSvc(k, v) {
  if (k === 'sbn') return;                               // niente worker propri (031)
  settings.gbKey = v;
  backupReady = null;
  saveSettings(); remember(k, v); renderSvc();
  if (v && !isLent('key', v)) emit('ownkey', v);   // giro 8: chi la presta la aggiorna per tutti gli amici
}
$('#optSheet').addEventListener('click', function (e) {
  var b = e.target.closest('.svc-own'); if (!b || !window.NLAmici || !window.NLAmici.ownPart) return;
  var had = window.NLAmici.ownPart('gb');
  if (!had) { svcFold('key', true); gbShown = true; }
  renderSvc();
  if (!had) setTimeout(function () { try { $('#gbKey').focus(); } catch (x) {} }, 50);
});
/* sezione «Google Libri» richiudibile (giro 5): chiusa si vedono stato, due righe e la guida. Il catalogo SBN è una riga fissa («Incluso», 031) */
var svcOpenK = {}, gbShown = false;
function svcFold(k, open) {
  var box = k === 'key' ? $('#svcKey') : null; if (!box) return;
  var o = open == null ? !svcOpenK[k] : !!open; svcOpenK[k] = o;
  box.querySelector('.svc-tog').setAttribute('aria-expanded', o ? 'true' : 'false'); box.querySelector('.svc-b').hidden = !o; box.classList.toggle('open', o);
}
function gbMask(v) { return v.length > 10 ? v.slice(0, 4) + '…' + v.slice(-3) : '…'; }   // «AIza…7Gt»: l’API non resta in vista (giro 5)
$('#optSheet').addEventListener('click', function (e) {
  if (e.target.closest('#gbLeak')) { window.NLRicerche.leak(); return; }
  var t = e.target.closest('.svc-tog'); if (t) { svcFold('key'); return; }
  var g = e.target.closest('.svc-guide'); if (!g) return;
  var k = g.dataset.guide, R = window.NLRicerche;
  if (k === 'key' && R && R.guide) { R.guide(true); return; }
  svcFold(k, true);
  var d = $('#svcKey .svc-how'); if (d) { d.open = true; try { d.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (x) {} }
});
function renderSvc() {
  var gk = settings.gbKey, lk = isLent('key', gk), who = lent().nome || 'un amico';
  var gi = $('#gbKey'), masked = !!gk && !lk && !gbShown;
  if (document.activeElement !== gi) { gi.value = lk ? '' : masked ? gbMask(gk) : gk; gi.readOnly = masked; gi.dataset.mask = masked ? '1' : ''; }
  $('#gbShow').hidden = !gk || lk; $('#gbShow').textContent = gbShown ? 'Nascondi' : 'Mostra'; $('#gbShow').setAttribute('aria-pressed', gbShown ? 'true' : 'false');
  $('#gbSt').textContent = lk ? 'Prestata da ' + who : gk ? 'In uso' : 'Nessuna API'; $('#gbSt').className = 'svc-st' + (gk ? ' on' : '');
  $('#gbGuide').hidden = !!mine('key');
  $('#gbClear').hidden = !gk || lk;
  $('#gbLeak').hidden = !mine('key') || !(window.NLRicerche && window.NLRicerche.leak);
  [['key', lk, 'l’API Google di ']].forEach(function (x) {
    var box = $('#svcKey'), row = box.querySelector('.svc-row'), note = box.querySelector('.svc-lent');
    row.hidden = x[1];
    if (x[1] && !note) { note = document.createElement('p'); note.className = 'hint svc-lent'; row.parentNode.insertBefore(note, row); }
    if (note) { note.hidden = !x[1]; if (x[1]) { var my = mine(x[0]);   // «Usa la tua»: ognuno deve poter usare i suoi (Piero, 17/11/2026)
      note.innerHTML = 'Usi ' + esc(x[2] + who) + ': non si vede e non si può prestare ad altri. <button type="button" class="link svc-own" data-own="gb">' +
        (my ? 'Usa la tua API (' + esc(svcShort(x[0], my)) + ')' : 'Inserisci la tua API') + '</button>'; } }
  });
  ['key'].forEach(function (k) {
    var cur = svcVal(k), box = $('#gbSaved'), html = '';
    saved[k].forEach(function (x, i) {
      if (x === cur || isLent(k, x)) return;
      html += '<span class="schip"><button type="button" class="schip-use" data-k="' + k + '" data-i="' + i + '" title="Usa ' + esc(svcShort(k, x)) + '">' + esc(svcShort(k, x)) + '</button>' +
        '<button type="button" class="schip-x" data-k="' + k + '" data-forget="' + i + '" aria-label="Togli ' + esc(svcShort(k, x)) + ' dai salvati">×</button></span>';
    });
    box.innerHTML = html ? '<span class="svc-saved-l">API salvate:</span>' + html : '';
    box.hidden = !html;
  });
  $('#svcRestore').hidden = !(!gk && saved.key.length);   // (con quella di un amico in uso gk c'è: niente «Rimetti»)
  updateQuotaInfo();
}
/* fetch che conta le richieste e, con l’API, non supera il limite giornaliero di Google (ne lascia un margine) */
function apiFetch(url, init) {
  var u = String(url);
  if (/googleapis\.com\/books\//.test(u)) {
    var extra = /\/volumes\/[^?]/.test(u);                  // scheda del volume = solo per la copertina grande
    if (!googleLeft(extra)) return Promise.resolve({ ok: false, status: 429, local: true, json: function () { return Promise.resolve({}); } });
    countCall('g');
    var lm = /[?&]key=prestata(?:%3A|:)([0-9a-f-]{36})/i.exec(u);
    if (lm) return lentFetch(u, lm[1]);
  } else if (u.indexOf(SBN_CASA) === 0) {                   // catalogo SBN: passa dal server (031)
    var cm = /[?&]isbn=([0-9Xx]+)/.exec(u), tm = /[?&]t=([^&#]+)/.exec(u);   // per ISBN, o per titolo (21/11/2026)
    return cm ? casaFetch('isbn=' + encodeURIComponent(cm[1])) : tm ? casaFetch('t=' + tm[1]) : Promise.resolve({ ok: false, status: 400, local: true, json: function () { return Promise.resolve({}); } });
  }
  return fetch(url, init);
}
/* Catalogo SBN «della casa» (031, scelte di Piero del 20/11/2026): un solo worker per tutti, dietro la funzione «libri» del
   server; il suo indirizzo non arriva mai al telefono. Con l'account 500 ricerche al giorno (le conta il server: x-nl-stop
   «mio»); senza account 50 al giorno per telefono (contate qui, in quota.s) e 3.000 in tutto (x-nl-stop «tetto»). Giorno UTC.
   Al limite la ricerca va avanti con le altre fonti; ogni avviso si dice una volta al giorno. */
function sbnRoll() { rollQuota(); if (sbnDay.d !== quota.ds) sbnDay = { d: quota.ds, mio: 0, stop: '', said: '' }; }
function sbnAuth() { var S = window.NLSocial; return !!(S && S.auth && S.auth()); }
function sbnSay(k, msg, enter) {
  if (sbnDay.said === k) return;
  sbnDay.said = k; ls.set(LS_SBN, JSON.stringify(sbnDay));
  toast(msg, enter ? { label: 'Entra', fn: function () { if (window.NLSocial) window.NLSocial.open(); } } : undefined);
}
function sbnOut() {                                       // per oggi il catalogo SBN è finito
  sbnRoll();
  return sbnAuth() ? sbnDay.stop === 'mio' : (sbnDay.stop === 'tetto' || quota.s >= SBN_FREE);
}
function sbnNow(tell) {                                   // l'indirizzo finto da dare alla ricerca, oppure '' se per oggi è finito
  if (!sbnOut()) return SBN_CASA;
  if (tell && !sbnAuth() && sbnDay.stop !== 'tetto') sbnSay('qui', 'Senza account il catalogo delle biblioteche (SBN) fa 50 ricerche al giorno. Entra con Google per averne 500.', true);
  return '';
}
function casaFetch(q) {                                   // q: «isbn=…» oppure «t=…» (titolo, stesso conto)
  var S = window.NLSocial, no = { ok: false, status: 503, local: true, json: function () { return Promise.resolve({}); } };
  if (!S || !S.rawOpen || sbnOut()) return Promise.resolve(no);
  countCall('s');
  return S.rawOpen('/functions/v1/libri?' + q).then(function (r) {
    var stop = r.headers.get('x-nl-stop') || '', mio = Number(r.headers.get('x-nl-mio')) || 0;
    sbnRoll();
    if (mio > sbnDay.mio) sbnDay.mio = mio;
    if (stop === 'mio') {
      sbnDay.stop = 'mio'; sbnDay.mio = Math.max(sbnDay.mio, SBN_MAX);
      sbnSay('mio', 'Per oggi hai finito le ricerche nel catalogo delle biblioteche (SBN). Fino a domattina l\'app cerca in Open Library e con Google.');
    } else if (stop === 'tetto') {
      sbnDay.stop = 'tetto';
      sbnSay('tetto', 'Oggi il catalogo delle biblioteche (SBN) è al completo per chi non ha l\'account. Entra con Google per usarlo subito.', true);
    }
    ls.set(LS_SBN, JSON.stringify(sbnDay));
    if (!$('#optSheet').hidden) updateQuotaInfo();
    return r;
  });
}
/* API di un altro rimaste sul telefono (copiate prima del giro 8): si tolgono da impostazioni e salvate (026) */
function svcAll() {
  var out = [settings.gbKey].concat(saved.key);
  try { var m = JSON.parse(ls.get('catalogo-libri-amici-chiavi-mie') || 'null') || {}; out.push(m.gb); } catch (e) { nlErr(e); }
  return out.filter(function (v, i, a) { return v && !/^prestata:/.test(v) && !/worker-prestato\.invalid/.test(v) && a.indexOf(v) === i; }).slice(0, 20);
}
function svcPurge(vals) {
  if (!vals || !vals.length) return;
  saved.key = saved.key.filter(function (x) { return vals.indexOf(x) < 0; });
  ls.set(LS_SAVED, JSON.stringify(saved));
  if (vals.indexOf(settings.gbKey) >= 0) settings.gbKey = '';
  backupReady = null; saveSettings();
  if (!$('#optSheet').hidden) renderSvc();
}
function lookupOpts(tell) { return { gbKey: settings.gbKey, sbnUrl: sbnNow(tell), fetch: apiFetch, lean: !googleLeft(true) }; }   // tell: ricerca per ISBN (se il catalogo SBN è finito lo dice)
/* ricerca per ISBN: prima l'archivio comune (modulo ricerche.js: libri gia' cercati da altri, senza Google), poi le banche dati; il risultato va nell'archivio */
async function findIsbn(code) {
  var A = window.NL && window.NL.archive;
  var hit = null;
  if (A && A.get) { try { hit = await A.get(code); if (hit && !hit.part) return hit; } catch (e) { nlErr(e); } }
  var res = await L.lookupIsbn(code, lookupOpts(true));
  if (res && A && A.put) { try { A.put(code, res); } catch (e) { nlErr(e); } }
  if (!res && hit) { delete hit.part; return hit; }   // solo l'archivio lo conosce (es. libro scritto a mano e approvato, 029)
  return res;
}
function hasData(b) { return !!(b.t || b.a || b.e || b.y || b.i || b.c != null || b.n); }
function inTab(b) { return !!b.w === (tab === 'wish'); }
function tabBooks() { return state.books.filter(inTab); }
function blankBook(o) {
  var b = Object.assign({ id: newId(), t: '', a: '', e: '', y: '', c: null, i: '', g: [], img: '', nf: false, ts: Date.now(),
    sh: '', n: '', gen: '', pg: '', p: '', pd: '', w: tab === 'wish', rs: '', rt: 0, rd: '', pp: '', ppd: '', cp: false, ck: '', nb: false, xs: '', xd: '', xa: '', sx: '', sk: '', sda: '', fav: false, lc: false, fr: '', fl: '', ds: '', dsf: '', dsl: '', dsn: 0, dsq: 0, se: '', sn: '', sq: '', qs: [] }, o || {});
  if (!b.w && !(o && o.rs != null)) b.rs = 'da';        // un libro appena entrato in libreria e' da leggere
  return b;
}
var FIELDS = ['id', 't', 'a', 'e', 'y', 'c', 'i', 'g', 'img', 'imgL', 'nf', 'ts', 'sh', 'n', 'gen', 'pg', 'p', 'pd', 'w', 'rs', 'rt', 'rd', 'pp', 'ppd', 'cp', 'ck', 'nb', 'xs', 'xd', 'xa', 'fav', 'lc', 'fr', 'fl', 'ds', 'dsf', 'dsl', 'dsn', 'dsq', 'se', 'sn', 'sq', 'qs', 'sx', 'sk', 'sda'];
function isBusy(b) { var st = (S[b.id] || {}).st; return st === 'queued' || st === 'reading' || st === 'lookup' || st === 'search'; }
function cleanBook(x) {
  if (!x || typeof x !== 'object') return null;
  var img = L.str(x.img);
  return {
    id: String(x.id || '').replace(/[^\w-]/g, '') || newId(),
    t: L.str(x.t), a: L.str(x.a), e: L.str(x.e),
    y: L.str(x.y).replace(/\D/g, '').slice(0, 4),
    c: (typeof x.c === 'number' && isFinite(x.c)) ? x.c : null,
    i: L.str(x.i).replace(/[^\dXx]/g, '').toUpperCase(),
    g: Array.isArray(x.g) ? x.g.filter(function (k) { return ['t', 'a', 'e', 'y', 'i'].indexOf(k) >= 0; }) : [],
    img: /^https:\/\//.test(img) ? img : '',
    imgL: /^https:\/\//.test(L.str(x.imgL)) && !L.badBigCover(x.imgL) ? L.str(x.imgL) : '',   // via le «grandi» di Google con zoom=0 (17/11/2026): si ricerca con zoom=3
    nf: !!x.nf,
    ts: Number(x.ts) || 0,
    sh: L.str(x.sh).slice(0, 80), n: L.str(x.n).slice(0, 2000), gen: L.str(x.gen).slice(0, 80),
    pg: L.str(x.pg).replace(/\D/g, '').slice(0, 5), p: L.str(x.p).slice(0, 80),
    pd: /^\d{4}-\d\d-\d\d$/.test(L.str(x.pd)) ? x.pd : '',
    w: !!x.w,
    rs: ['da', 'in', 'ok'].indexOf(x.rs) >= 0 ? x.rs : '',
    rt: Math.max(0, Math.min(5, parseInt(x.rt, 10) || 0)),
    rd: /^\d{4}-\d\d-\d\d$/.test(L.str(x.rd)) ? x.rd : '',
    pp: String(L.str(x.pp)).replace(/\D/g, '').slice(0, 5), ppd: /^\d{4}-\d\d-\d\d$/.test(L.str(x.ppd)) ? x.ppd : '',   // segnalibro (16/11/2026)
    cp: !!x.cp,
    ck: /^\d{4}-\d\d-\d\d$/.test(L.str(x.ck)) ? x.ck : '',
    nb: !!x.nb,
    xs: ['v', 'r', 's', 'b'].indexOf(x.xs) >= 0 ? x.xs : '',   // b: libro ricevuto in prestito da un amico e restituito
    xd: /^\d{4}-\d\d-\d\d$/.test(L.str(x.xd)) ? x.xd : '',
    xa: L.str(x.xa).slice(0, 80),
    sx: /^[0-9a-f-]{36}$/.test(L.str(x.sx)) ? x.sx : '',                 // prestito o regalo tra amici dell'app (modulo amici, 16/11/2026)
    sk: ['p', 'q', 'r'].indexOf(x.sk) >= 0 ? x.sk : '', sda: L.str(x.sda).slice(0, 30),   // q: prestito ricevuto che hai restituito, da confermare da chi l'ha prestato;   // ricevuto: in prestito (p) o in regalo (r), da chi
    fav: (!!x.lc || !!x.fav) && !x.w,              // giro 10 (Piero, 18/11/2026): via i preferiti, la stella vuol dire «Lo consiglio»; fav resta uguale a lc
    lc: (!!x.lc || !!x.fav) && !x.w,               // «Lo consiglio»: gli amici lo vedono nel profilo; solo libri della Libreria (i vecchi preferiti diventano consigliati)
    fr: L.str(x.fr).slice(0, 30), fl: L.str(x.fl).slice(0, 40),     // ricevuto da (nome) e da quale lista
    ds: L.str(x.ds).slice(0, L.DESC_MAX + 1), dsf: x.dsf === 'g' || x.dsf === 'o' ? x.dsf : '',   // descrizione e fonte (Google, Open Library)
    dsl: /^[a-z]{2}$/.test(L.str(x.dsl)) ? x.dsl : '', dsn: Number(x.dsn) || 0, dsq: x.dsq ? 1 : 0,                     // lingua; quando non e' stata trovata
    se: L.str(x.se).slice(0, 80), sn: L.str(x.sn).replace(/\D/g, '').slice(0, 3), sq: L.str(x.sq).replace(/\D/g, '').slice(0, 3),   // serie, volume, di quanti
    qs: (Array.isArray(x.qs) ? x.qs : []).map(function (c) { return c && typeof c === 'object' ? { x: L.str(c.x).slice(0, 1500).trim(), pg: L.str(c.pg).replace(/\D/g, '').slice(0, 5), d: Number(c.d) || 0, pin: c.pin ? 1 : 0, phs: (Array.isArray(c.phs) ? c.phs : c.ph ? [c.ph] : []).map(L.str).filter(function (k) { return /^q:[\w-]{4,40}$/.test(k); }).slice(0, 10) } : null; })
      .filter(function (c) { return c && (c.x || c.phs.length); }).slice(0, 200)                                      // citazioni e appunti
  };
}
function storable() {
  return myBooks().filter(hasData).map(function (b) {
    var o = {}; FIELDS.forEach(function (k) { o[k] = k === 'g' ? b.g.slice() : k === 'qs' ? (b.qs || []).slice() : b[k]; }); return o;
  });
}
function persist() {
  var ok = ls.set(LS_KEY, JSON.stringify({ books: storable(), updated: guest ? guest.upd : state.updated }));
  /* salvataggio non riuscito: avviso in cima alla libreria, solo quando serve (Piero, 20/11/2026; prima c'era la riga «Salvato su questo
     telefono» della vecchia testata, che nello stile G non si vedeva più, e con lei spariva anche l'errore) */
  if (!ok) notice('Non riesco a salvare le ultime modifiche: lo spazio dell\'app su questo telefono è pieno. Fai subito il backup per non perderle.', 'Fai il backup', function () { backupTap(); }, null, 'save');
  else if (noticeKind === 'save') { $('#notice').hidden = true; noticeKind = ''; }
  checkBackupNag();
  if (ok) emit('saved');                                // i moduli (es. la sincronizzazione dell'account) sanno che i libri sono cambiati
}
function touch() {
  if (guest) { clearTimeout(tSave); tSave = setTimeout(persist, 350); return; }   // nella libreria di un amico: si salvano solo i tuoi (storable usa myBooks), i suoi mai
  state.updated = Date.now();
  backupReady = null;
  clearTimeout(tSave);
  tSave = setTimeout(persist, 350);
}
/* ---------- la libreria di un amico, in sola lettura (modulo amici, 16/11/2026) ----------
   I suoi libri prendono il posto dei tuoi solo sullo schermo, con gli stessi filtri, ricerca e viste. I tuoi restano in guest.mine:
   sono gli unici che si salvano (storable usa myBooks) e la sincronizzazione aspetta (NL.guest). Le modifiche sono spente (html.guest).
   Indietro o «‹ La tua libreria» tornano ai tuoi, con filtri, ricerca, scheda aperta e vista com'erano. */
var guest = null;
function myBooks() { return guest ? guest.mine : state.books; }
function esempio() { return !!(guest && guest.info && guest.info.esempio); }   // libreria di esempio della guida (giro 4): come un ospite, ma con i tasti visibili e nessuna chiamata
function bookKeys(b) { var k = []; var i = b.i && (L.toIsbn13(b.i) || b.i); if (i) k.push('i:' + i); var t = L.titleKey(b.t); if (t) k.push('t:' + t + '|' + L.norm(authorsOf(b)[0] || '')); return k; }
function guestEnter(name, books, info) {
  if (scanning) return false;
  if (guest) guestExit(true);
  if (selOn) endSel(false);
  clearTimeout(tSave); persist();                  // quello che c'era da salvare dei tuoi libri, prima
  var mineKeys = {};
  state.books.forEach(function (b) { if (!b.w && !b.xs) bookKeys(b).forEach(function (k) { mineKeys[k] = 1; }); });
  guest = { name: name, info: info || {}, mine: state.books, upd: state.updated, mineKeys: mineKeys, y: window.scrollY,
    keep: { q: q, sortBy: sortBy, flt: flt, tab: tab, readFlt: readFlt, shFlt: shFlt, genFlt: genFlt, autFlt: autFlt, autName: autName, edFlt: edFlt, frFlt: frFlt, paFlt: paFlt, view: settings.view, open: openState, gridRet: gridRet } };
  state.books = (books || []).map(cleanBook).filter(Boolean);
  openState = {}; gridRet = null;
  q = ''; $('#q').value = ''; sortBy = 'recent'; readFlt = '';
  document.documentElement.classList.add(info && info.esempio ? 'esempio' : 'guest');   // esempio della guida: tasti visibili, i tocchi li ferma guida.js (giro 4)
  setTab('lib');                                   // azzera i filtri e ridisegna
  renderOwner(); updateActiveFilters && updateActiveFilters();
  window.scrollTo(0, 0);
  emit('guest', name);
  return true;
}
function guestExit(quiet) {
  if (!guest) return;
  var k = guest.keep, y = guest.y;
  state.books = guest.mine; state.updated = guest.upd;
  guest = null;
  document.documentElement.classList.remove('guest', 'esempio');
  q = k.q; $('#q').value = q; sortBy = k.sortBy; readFlt = k.readFlt; openState = k.open; gridRet = k.gridRet;
  tab = k.tab === 'wish' ? 'wish' : 'lib'; document.body.classList.toggle('wishtab', tab === 'wish');
  flt = k.flt; shFlt = k.shFlt; genFlt = k.genFlt; autFlt = k.autFlt; autName = k.autName; edFlt = k.edFlt; frFlt = k.frFlt; paFlt = k.paFlt || '';
  if (settings.view !== k.view) setView(k.view);
  renderOwner(); renderList(); updateSummary(); updateActiveFilters && updateActiveFilters();
  if (!quiet) window.scrollTo(0, y || 0);
  emit('guest', null);
}
/* un libro dalla libreria dell'amico nei TUOI desideri (anche mentre guardi la sua) */
function showBook(id) {
  if (guest) guestExit(true);
  var b = get(id); if (!b) return false;
  if (b.w !== (tab === 'wish')) setTab(b.w ? 'wish' : 'lib');
  if (!visible().some(function (x) { return x.id === id; })) clearFilters();
  if (settings.view === 'grid') { openFromGrid(id); return true; }
  if (!settings.openAll) state.books.forEach(function (x) { if (x.id !== id) openState[x.id] = false; });   // una scheda alla volta: dal restyle e' una pagina intera (19/11/2026)
  openState[id] = true; renderList();
  if (!settings.openAll) { try { if (cardPushed) history.replaceState({ card: id }, ''); else history.pushState({ card: id }, ''); cardPushed = id; } catch (e) { nlErr(e); } }   // Indietro la chiude
  var el = rowEl(id); if (el) el.scrollIntoView({ block: 'start' });
  return true;
}
function addMine(o) {
  var b = cleanBook(Object.assign({}, o, { id: newId(), ts: Date.now() })); if (!b) return null;
  myBooks().unshift(b);
  if (guest) { bookKeys(b).forEach(function (k) { if (!b.w) guest.mineKeys[k] = 1; }); clearTimeout(tSave); tSave = setTimeout(persist, 350); emit('mine', b); }
  else { touch(); renderList(); updateSummary(); }
  return b.id;
}
/* toglie uno dei TUOI libri (anche mentre guardi la libreria di un amico: «Nei desideri» acceso → spento); restoreMine lo rimette */
function removeMine(id) {
  var arr = myBooks(), i = arr.findIndex(function (x) { return x.id === id; }); if (i < 0) return null;
  var b = arr.splice(i, 1)[0];
  if (guest) { clearTimeout(tSave); tSave = setTimeout(persist, 350); emit('mine', b); }
  else { delete S[id]; touch(); renderList(); updateSummary(); }
  return b;
}
function restoreMine(b) {
  if (!b || myBooks().some(function (x) { return x.id === b.id; })) return;
  myBooks().unshift(b);
  if (guest) { clearTimeout(tSave); tSave = setTimeout(persist, 350); emit('mine', b); }
  else { touch(); renderList(); updateSummary(); }
}
function isMine(b) { var keys = guest ? guest.mineKeys : null; if (!keys) { keys = {}; state.books.forEach(function (x) { if (!x.w && !x.xs) bookKeys(x).forEach(function (k) { keys[k] = 1; }); }); } return bookKeys(b).some(function (k) { return keys[k]; }); }
function loadAll() {
  try {
    var d = JSON.parse(ls.get(LS_KEY) || '{}');
    state.books = (d.books || []).map(cleanBook).filter(Boolean);
    state.updated = Number(d.updated) || 0;
  } catch (e) { nlErr(e); }
  try {
    var s = JSON.parse(ls.get(LS_SET) || '{}');
    settings.gbKey = L.str(s.gbKey); settings.price = s.price !== false; settings.extra = true;   // scaffale, genere, pagine e note sempre visibili (opzione tolta il 16/11/2026)
    settings.lastBackup = Number(s.lastBackup) || 0; settings.snooze = Number(s.snooze) || 0;
    settings.viewDef = s.viewDef === 'list' ? 'list' : 'grid';                       // vista all'apertura: l'ultima scelta con il pulsante (giro 1, 18/11/2026: l'app ricorda l'ultima vista)
    settings.view = settings.viewDef;
    settings.sortBy = SORTS.indexOf(s.sortBy) >= 0 ? s.sortBy : 'recent'; sortBy = settings.sortBy;   // ultimo ordine usato (giro 1)
    settings.cols = s.cols >= 2 && s.cols <= 5 ? Math.round(s.cols) : 3;             // copertine per riga sul telefono, 2-5 (giro 1)
    if (!s.cols3) settings.cols = 3;               // 3 per riga di partenza, per tutti, anche per chi le aveva cambiate (una volta sola; Piero, 18/11/2026)
    settings.cols3 = true;
    settings.openAll = s.openAll === true && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);   // «schede sempre aperte» tolta il 16/11/2026: resta solo per le prove automatiche
    settings.sbnUrl = '';                               // niente worker propri (031): quello salvato si toglie, senza avvisi
    settings.loanSnooze = Number(s.loanSnooze) || 0;
    settings.swiped = s.swiped === true;
    settings.pubFix = s.pubFix === true;
    settings.look = 'nuovo';                       // lo stile «Classico» non c'e' piu': resta solo il nuovo, con palette e caratteri
    // da questa versione il tema chiaro e' il predefinito: chi non aveva scelto «Scuro» passa al chiaro (una volta sola)
    settings.theme = s.themeV2 ? (s.theme === 'dark' || s.theme === 'auto' ? s.theme : 'light') : (s.theme === 'dark' ? 'dark' : 'light');
    settings.themeV2 = true;
    settings.pal = s.palV2 && PALS[s.pal] ? s.pal : 'bosco';   // da questa versione il verde (Bosco) e' la palette principale
    settings.palV2 = true;
    // restyle (19/11/2026, Piero): tutti a Bricolage + Plex, una volta sola; chi aveva scelto Lora o Roboto li tiene (Literata era la partenza di prima)
    settings.ft = s.ftV3 ? (FONTS_T.indexOf(s.ft) >= 0 ? s.ft : 'bricolage') : (s.ft === 'lora' || s.ft === 'roboto' ? s.ft : 'bricolage');
    settings.fb = FONTS_B.indexOf(s.fb) >= 0 ? s.fb : 'plex';
    settings.ftV3 = true;
    settings.installed = s.installed === true && s.instScope === location.pathname.replace(/[^/]*$/, '');   // installata a questo indirizzo (non a uno vecchio)
    settings.instScope = settings.installed ? s.instScope : '';
    settings.name = L.str(s.name).replace(/\s+/g, ' ').trim().slice(0, 30);
    settings.instSnooze = Number(s.instSnooze) || 0;
    settings.iosWeb = s.iosWeb === true;                                           // iPhone: ha scelto «Continua nel browser» (giro 11F)
    settings.goal = Math.max(0, Math.min(999, parseInt(s.goal, 10) || 0));          // obiettivo di lettura
    settings.newsAuto = s.newsAuto !== false;                                       // novita' degli autori: controllo automatico
    settings.seenV = Number(s.seenV) || 0;                                         // ultima versione di cui si sono viste le novita'
    settings.wn2 = s.wn2 ? 1 : 0;
    settings.shelfShut = s.shelfShut && typeof s.shelfShut === 'object' ? { now: s.shelfShut.now ? 1 : 0, all: s.shelfShut.all ? 1 : 0 } : {};   // sezioni dell'elenco chiuse
    settings.grp = GRP_TXT[s.grp] ? s.grp : '';                                        // raggruppa per (copertine ed elenco, 17/11/2026)
    settings.grpOpen = {};                                                            // gruppi aperti (chiusi di partenza)
    if (s.grpOpen && typeof s.grpOpen === 'object') Object.keys(s.grpOpen).slice(0, 400).forEach(function (k) { if (typeof k === 'string' && k.length < 200) settings.grpOpen[k] = 1; });
    settings.grpExp = s.grpExp ? 1 : 0; 
    settings.auInv = s.auInv === 0 ? 0 : 1;                                          // autori nei gruppi «Neruda, Pablo» (1, predefinito) o come sono scritti (0) (17/11/2026 notte)
    settings.auPa = {};                                                              // paese dell'autore corretto a mano: codice di due lettere (giro 2, 18/11/2026)
    if (s.auPa && typeof s.auPa === 'object') Object.keys(s.auPa).slice(0, 500).forEach(function (k) { var v = String(s.auPa[k]); if (k.length < 200 && /^[A-Z]{2}$/.test(v)) settings.auPa[k] = v; });
    settings.auCut = {};                                                             // cognome corretto a mano: parole del cognome (0 = com'è scritto)
    if (s.auCut && typeof s.auCut === 'object') Object.keys(s.auCut).slice(0, 500).forEach(function (k) { var v = Number(s.auCut[k]); if (k.length < 200 && v >= 0 && v < 10) settings.auCut[k] = Math.floor(v); });
                                             // «Espandi tutto» dei gruppi (17/11/2026 sera)
    oldApp = typeof s.look === 'string';                                             // impostazioni salvate da una versione precedente dell'app (non una prima installazione)                                                   // la pagina delle novita' funziona anche per chi aggiorna (dalla 96)
    settings.seenB = L.str(s.seenB).slice(0, 12);                                   // nella copia di prova: ultima prova vista («94.17»)
    settings.suggAuto = s.suggAuto !== false;                                       // «Da scoprire»: cerca da solo una volta a settimana
    settings.suggLang = s.suggLang === 'all' ? 'all' : 'it';                        // «Da scoprire»: solo italiano o tutte le lingue
    settings.nxSeen = L.str(s.nxSeen).slice(0, 40);                                 // riquadro «Cosa leggere dopo» chiuso per questo libro finito
    settings.selTip = s.selTip ? 1 : 0;
    settings.sound = s.sound !== false;                                             // suoni: bip della scansione e «fatto» (accesi di predefinito)
    settings.camNative = s.camNative === true;                                      // foto con la fotocamera del telefono (flash del telefono)
    settings.torchCam = typeof s.torchCam === 'string' ? s.torchCam : '';            // obiettivo con la luce ('none' = nessuno, o non si accende davvero)
    settings.lightOk = s.lightOk === true;                                          // «Prova la luce»: vista accendersi
    settings.quoteOcrAuto = false;                                                  // citazioni: il testo delle foto si legge quando tocchi «Leggi il testo» (opzione tolta il 16/11/2026)
    settings.donUntil = Number(s.donUntil) || 0;                                    // donazioni: richieste in pausa fino a
    settings.donNever = s.donNever === true;                                        // promemoria ogni 50 libri spento
    settings.donMs = typeof s.donMs === 'number' ? s.donMs : null;                  // ultimo traguardo gia' visto (multiplo di 50)
    settings.donGo = Number(s.donGo) || 0;                                          // quando e' stato aperto PayPal (0 = no)
    settings.donHid = s.donHid === true;                                            // l'app e' passata in secondo piano dopo
    settings.donOpens = Math.max(0, parseInt(s.donOpens, 10) || 0);                  // aperture dell'app (la riga compare dalla sesta)
  } catch (e) { nlErr(e); }
}
function saveSettings() { ls.set(LS_SET, JSON.stringify(settings)); }

/* ---------- avvisi ---------- */
function toast(msg, action, ms) {
  var t = $('#toast');
  $('#toastTxt').textContent = msg;
  var btn = $('#toastBtn');
  btn.hidden = !action;
  btn.onclick = null;
  if (action) { btn.textContent = action.label; btn.onclick = function () { t.hidden = true; action.fn(); }; }
  t.hidden = false;
  clearTimeout(toastTimer);
  // quanto resta: con un tasto (Annulla...) 4 secondi; senza, secondo la lunghezza del testo, da 2,5 a 5 secondi
  if (!ms) ms = action ? 4000 : Math.min(5000, Math.max(2500, 1800 + String(msg).length * 45));
  toastTimer = setTimeout(function () { t.hidden = true; }, ms);
}
var noticeKind = '';
function notice(msg, label, fn, onClose, kind) {
  $('#noticeTxt').textContent = msg;
  var b = $('#noticeBtn');
  b.hidden = !label;
  b.textContent = label || '';
  b.onclick = function () { $('#notice').hidden = true; noticeKind = ''; if (fn) fn(); };
  $('#noticeX').onclick = function () { $('#notice').hidden = true; noticeKind = ''; if (onClose) onClose(); updateSummary(); };
  noticeKind = kind || '';
  $('#notice').classList.toggle('nt-save', kind === 'save');   // l'errore di salvataggio si legge tutto (gli altri avvisi stanno su due righe)
  $('#notice').hidden = false;
}
function beep(ok) {
  if (settings.sound === false) return;
  try {
    beep.ctx = beep.ctx || new (window.AudioContext || window.webkitAudioContext)();
    var o = beep.ctx.createOscillator(), g = beep.ctx.createGain();
    o.frequency.value = ok ? 880 : 320; g.gain.value = 0.08;
    o.connect(g); g.connect(beep.ctx.destination);
    o.start(); o.stop(beep.ctx.currentTime + 0.09);
    beep.n = (beep.n || 0) + 1;
  } catch (e) { nlErr(e); }
}
// suono di «fatto» (prezzo salvato): due note che salgono, piu' morbide del bip della scansione
function chime() {
  if (settings.sound === false) return;
  try {
    beep.ctx = beep.ctx || new (window.AudioContext || window.webkitAudioContext)();
    var ctx = beep.ctx, t0 = ctx.currentTime + 0.01;
    [[784, 0], [1175, 0.11]].forEach(function (n) {
      var o = ctx.createOscillator(), g = ctx.createGain(), t = t0 + n[1];
      o.type = 'sine'; o.frequency.value = n[0];
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.34);
    });
    chime.n = (chime.n || 0) + 1;
  } catch (e) { nlErr(e); }
}
// suono di «non trovato»: due note basse che scendono, un po' ruvide. Si sente quando il codice e' stato letto ma
// le banche dati non danno titolo e autore (o la foto non porta a nessun libro), solo per i libri appena aggiunti a mano.
function failSound() {
  if (settings.sound === false) return;
  try {
    beep.ctx = beep.ctx || new (window.AudioContext || window.webkitAudioContext)();
    var ctx = beep.ctx, t0 = ctx.currentTime + 0.01, f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 1400; f.connect(ctx.destination);
    [[392, 0], [262, 0.17]].forEach(function (n) {
      var o = ctx.createOscillator(), g = ctx.createGain(), t = t0 + n[1];
      o.type = 'square'; o.frequency.value = n[0];
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.01); g.gain.setValueAtTime(0.05, t + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(g); g.connect(f); o.start(t); o.stop(t + 0.22);
    });
    failSound.n = (failSound.n || 0) + 1;
  } catch (e) { nlErr(e); }
}
function heardFail(id) {                           // il libro appena aggiunto (scansione, ISBN scritto, foto) non e' stato trovato
  var s = S[id];
  if (!s || !s.heard) return;
  delete s.heard;
  failSound(); vibrate([90, 70, 90]);
}
function paintSound() {
  var on = settings.sound !== false, b = $('#scanSound');
  if (b) { b.textContent = on ? '🔊' : '🔇'; b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.setAttribute('aria-label', on ? 'Suoni accesi: tocca per spegnerli' : 'Suoni spenti: tocca per accenderli'); }
  var o = $('#optSound'); if (o) o.checked = on;
}
function setSound(on, say) {
  settings.sound = !!on; saveSettings(); paintSound();
  if (say) { if (scanning) scanMsg(on ? 'Suoni accesi.' : 'Suoni spenti.'); else toast(on ? 'Suoni accesi.' : 'Suoni spenti.'); }
  if (on) beep(true);                              // si sente subito che sono tornati
}
function vibrate(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { nlErr(e); } }
