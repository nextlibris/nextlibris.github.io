/* Next Libris · modulo «Notifiche» (16/11/2026, nella copia di prova). Scelte di Piero del 16/11/2026.
   Campanella in alto, accanto all'icona Amici, con il numero delle notifiche non lette. Dentro: richieste e amicizie accettate,
   prestiti e regali ricevuti, restituzioni (segnalate, confermate, non ancora ricevute), «Me lo presti?» e le risposte,
   libri consigliati, chiave e worker condivisi, API Google arrivata al limite (guida per crearne una gratis, ricerche.js). Aprendo la campanella si segnano tutte lette (le nuove restano evidenziate).
   Toccandone una si apre il libro o la finestra Amici.
   Le notifiche le scrive il database (trigger, supabase/011_notifiche.sql nel ramo prove): «letto» vale su tutti i dispositivi,
   si tengono 30 giorni. Si leggono insieme agli amici (apertura, ritorno all'app, ogni ~3 minuti) e quando arriva un push (push.js).
   Usa window.NL, window.NLSocial (social.js) e window.NLAmici (amici.js). */
(function () {
'use strict';
var NL = window.NL, S = window.NLSocial; if (!NL || !S || !S.call) return;
var esc = NL.esc, K = 'catalogo-libri-notifiche', K_READ = 'catalogo-libri-notifiche-da-segnare';
var items = rd(K) || [], loading = null, lastLoad = 0, fresh = {};
var BELL = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';

function rd(k) { try { return JSON.parse(NL.ls.get(k) || 'null'); } catch (e) { return null; } }
function wr(k, v) { NL.ls.set(k, v == null ? '' : JSON.stringify(v)); }
function rpc(name, body) { return S.call('/rest/v1/rpc/' + name, { method: 'POST', user: true, body: body || {} }); }
function uid() { var a = S.auth(); return a && a.uid; }
function amici() { return window.NLAmici || null; }
function unread() { return items.filter(function (x) { return !x.letta; }).length; }

/* ---------- dati ---------- */
async function load() {
  if (!uid()) { items = []; paint(); return; }
  if (loading) return loading;
  loading = (async function () {
    try {
      if (rd(K_READ)) { await rpc('notifiche_lette', {}); wr(K_READ, null); }        // lette senza rete: si segnano adesso
      items = (await rpc('mie_notifiche')) || [];
      wr(K, items.slice(0, 100)); lastLoad = Date.now();
    } catch (e) { if (window.console) console.warn('notifiche', e); }
    loading = null; paint();
  })();
  return loading;
}
async function markAll() {
  if (!unread()) return;
  items.forEach(function (x) { x.letta = true; }); wr(K, items); paintTop();
  try { await rpc('notifiche_lette', {}); }
  catch (e) { wr(K_READ, 1); }                                                       // riprova al prossimo caricamento
}

/* ---------- testi ---------- */
function who(x) { return '<b>' + esc(x.nome || 'Un amico') + '</b>'; }
function book(x) { return '<b>«' + esc(x.titolo || 'un libro') + '»</b>'; }
function text(x) {
  switch (x.tipo) {
    case 'amicizia': return who(x) + ' vuole essere tuo amico';
    case 'amico': return who(x) + ' ha accettato la tua amicizia';
    case 'prestito': return who(x) + ' ti ha prestato ' + book(x);
    case 'regalo': return who(x) + ' ti ha regalato ' + book(x);
    case 'reso': return who(x) + ' dice di averti restituito ' + book(x);
    case 'reso_ok': return who(x) + ' conferma di aver riavuto ' + book(x);
    case 'reso_no': return who(x) + ' dice di non avere ancora ricevuto ' + book(x);
    case 'chiuso': return who(x) + ' ha segnato come restituito ' + book(x);
    case 'richiesta': return who(x) + ' ti chiede in prestito ' + book(x);
    case 'richiesta_si': return who(x) + ' ti presta ' + book(x);
    case 'richiesta_no': return who(x) + ' ora non può prestarti ' + book(x);
    case 'consiglio': return who(x) + ' ti consiglia ' + book(x);
    case 'chiavi': return who(x) + ' condivide con te la sua API per cercare i libri';
    case 'chiedi_chiavi': return who(x) + ' ti chiede in prestito l’API Google Libri';   // «Chiedimela» (giro 12)
    case 'desideri': var nd = Number(x.rif) || 1; return who(x) + (nd === 1 ? ' ha un nuovo desiderio: ' : ' ha ' + nd + ' nuovi desideri: ') + '<b>' + esc(x.titolo || '') + '</b>' + (nd > 3 ? ' e altri' : '');   // riassunto del giorno di un amico che segui (giro 3)
    case 'trovato': var nt = trovN(x); return '📚 ' + who(x) + ' ha aggiunto <b>' + esc(x.titolo || 'un libro') + '</b>' + (nt > 3 ? ' e altri' : '') + (nt === 1 ? ', che è nei tuoi Desideri' : ', che sono nei tuoi Desideri');   // un tuo desiderio è entrato nella libreria di un amico (giro 6)
    case 'avviso': return '<b>' + esc(x.rif || 'Avviso di Next Libris') + '</b><br>' + esc(x.titolo || '');   // avviso importante di Next Libris (giro 8): rif = titolo, titolo = testo, tutto in vista
    case 'messaggi': var mp = String(x.rif || '').split(':'), mn = Number(mp[0]) || 1, mc = Number(mp[1]) || 1, mr = Number(mp[2]) || 0;   // riassunto della chat (giro 9b): rif = messaggi:chat:richieste
      if (mr && mr === mc) return mr === 1 ? (x.da ? who(x) : '<b>' + esc(x.titolo || 'Qualcuno') + '</b>') + ' vuole scriverti: hai una richiesta di messaggio'
        : '<b>' + esc(x.titolo || 'Alcune persone') + '</b> vogliono scriverti: hai ' + mr + ' richieste di messaggio';
      return (mn === 1 ? 'Un messaggio nuovo' : mn + ' messaggi nuovi') + ' da <b>' + esc(x.titolo || x.nome || 'un amico') + '</b>' + (mr ? (mr === 1 ? ' e una richiesta di messaggio' : ' e ' + mr + ' richieste di messaggio') : '');
    case 'segnalazione': return 'Nuova segnalazione nella chat' + (x.titolo ? ' su <b>' + esc(x.titolo) + '</b>' : '') + ': controlla nel pannello Amministrazione';
    case 'limite': return x.titolo ? 'L’API Google di <b>' + esc(x.titolo) + '</b> ha finito le ricerche di oggi: <b>creane una tua, è gratis</b>'
      : 'La tua API Google ha finito le ricerche di oggi: torna domattina';
  }
  return who(x);
}
var KIND = { amicizia: 'fr', amico: 'fr', prestito: 'bk', regalo: 'gift', reso: 'bk', reso_ok: 'bk', reso_no: 'bk', chiuso: 'bk',
  richiesta: 'ask', richiesta_si: 'ask', richiesta_no: 'ask', consiglio: 'tip', chiavi: 'key', chiedi_chiavi: 'key', limite: 'lim', desideri: 'gift', trovato: 'bk', avviso: 'av', messaggi: 'msg', segnalazione: 'lim' };
/* «trovato»: rif = quanti:id del libro dell'amico (il primo) */
function trovN(x) { return Number(String(x.rif || '').split(':')[0]) || 1; }
function trovId(x) { var r = String(x.rif || ''), i = r.indexOf(':'); return i < 0 ? '' : r.slice(i + 1); }
function asked(x) { var A = amici(), q = (A && A.state && A.state().asks) || []; return q.some(function (r) { return r.da === uid() && r.a === x.da && r.libro_id === trovId(x) && r.stato === 'attesa'; }); }
var sent = {};
async function ask(id, btn) {
  var x = items.filter(function (y) { return y.id === id; })[0], A = amici(); if (!x || !A || !A.rpc) return;
  btn.disabled = true;
  try { await A.rpc('chiedi_prestito', { amico: x.da, libro_id: trovId(x) }); sent[id] = 1; NL.toast('Richiesta mandata a ' + (x.nome || 'un amico') + '.'); if (A.load) A.load(true); }
  catch (e) { NL.toast(/libro non trovato/.test(String(e && e.message)) ? 'Il libro non è più nella sua libreria.' : (e && e.code === 'net' ? e.message : 'Non riesco a mandare la richiesta. Riprova tra poco.')); }
  paint();
}
function ago(t) {
  var d = new Date(t), s = (Date.now() - d.getTime()) / 1000;
  if (!(s >= 0)) s = 0;
  if (s < 60) return 'adesso';
  if (s < 3600) return Math.floor(s / 60) + ' min fa';
  if (s < 86400) { var h = Math.floor(s / 3600); return h === 1 ? '1 ora fa' : h + ' ore fa'; }
  var g = Math.floor(s / 86400);
  if (g === 1) return 'ieri';
  if (g < 7) return g + ' giorni fa';
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

/* ---------- campanella in alto, prima dell'icona Amici ---------- */
function paintTop() {
  var b = document.getElementById('btnBell');
  if (!uid()) { if (b) b.hidden = true; document.documentElement.classList.remove('has-bell'); return; }
  if (!b) {
    var next = document.getElementById('btnFri') || document.getElementById('btnOpts'); if (!next) return;
    b = document.createElement('button'); b.type = 'button'; b.id = 'btnBell'; b.className = 'ico nt-top'; b.title = 'Notifiche';
    b.innerHTML = BELL + '<span class="nt-badge" id="btnBellN" hidden></span>';
    next.parentNode.insertBefore(b, next);
    b.addEventListener('click', open);
  }
  b.hidden = false; document.documentElement.classList.add('has-bell');
  var n = unread(), badge = document.getElementById('btnBellN');
  badge.hidden = !n; badge.textContent = n > 9 ? '9+' : n || '';
  b.setAttribute('aria-label', n ? 'Notifiche: ' + n + (n === 1 ? ' nuova' : ' nuove') : 'Notifiche');
  if (window.NLPush) window.NLPush.badge(n);                                         // numero sull'icona dell'app (push.js)
}

/* ---------- finestra ---------- */
function sheet() {
  var el = document.getElementById('ntSheet'); if (el) return el;
  el = document.createElement('div'); el.className = 'sheet nt'; el.id = 'ntSheet'; el.hidden = true;
  el.innerHTML = '<div class="sheet-in" role="dialog" aria-modal="true" aria-labelledby="ntH"><h2 id="ntH">Notifiche</h2><div id="ntBody"></div>' +
    '<div class="row-btns"><button class="btn" type="button" id="ntClose">Chiudi</button></div></div>';
  document.body.appendChild(el);
  el.addEventListener('click', function (e) {
    if (e.target === el) return close();
    var ak = e.target.closest('[data-ask]'); if (ak) { ask(ak.dataset.ask, ak); return; }
    var lk = e.target.closest('[data-lendkey]'); if (lk) { lendKeyGo(lk.dataset.lendkey); return; }
    var it = e.target.closest('[data-n]'); if (it) go(it.dataset.n);
  });
  el.querySelector('#ntClose').addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !el.hidden) close(); });
  return el;
}
function open() {
  var el = sheet(); fresh = {};
  items.forEach(function (x) { if (!x.letta) fresh[x.id] = 1; });
  el.hidden = false; paint(); markAll();
  if (Date.now() - lastLoad > 30000) load().then(function () { items.forEach(function (x) { if (!x.letta) { fresh[x.id] = 1; } }); markAll(); paint(); });
}
function close() { var el = document.getElementById('ntSheet'); if (el) el.hidden = true; fresh = {}; }
function paint() {
  paintTop();
  var body = document.getElementById('ntBody'); if (!body || document.getElementById('ntSheet').hidden) return;
  if (!items.length) {
    body.innerHTML = '<p class="nt-empty">Nessuna notifica per ora.<br>Qui arrivano le richieste d\'amicizia, i prestiti, i regali e i consigli dei tuoi amici.</p>';
    return;
  }
  body.innerHTML = '<ul class="nt-list">' + items.map(function (x) {
    return '<li><button type="button" class="nt-item' + (fresh[x.id] ? ' nt-new' : '') + '" data-n="' + esc(x.id) + '">' +
      '<span class="nt-ico nt-' + (KIND[x.tipo] || 'fr') + '" aria-hidden="true">' + (x.tipo === 'limite' || x.tipo === 'segnalazione' ? '!' : x.tipo === 'avviso' ? 'NL' : x.tipo === 'messaggi' && !x.da ? '…' : esc(((x.nome || '?').trim()[0] || '?').toUpperCase())) + '</span>' +
      '<span class="nt-t"><span class="nt-txt">' + text(x) + '</span><small>' + esc(ago(x.creata)) + (fresh[x.id] ? ' · <span class="nt-dot">nuova</span>' : '') + '</small></span>' +
      '</button>' + (x.tipo === 'trovato' && trovN(x) === 1 && trovId(x) && x.da ? (sent[x.id] || asked(x) ? '<span class="nt-asked">Richiesta mandata</span>' : '<button type="button" class="btn nt-lend" data-ask="' + esc(x.id) + '">Me lo presti?</button>') : '') + lendKey(x) + '</li>';
  }).join('') + '</ul>';
}

/* «Chiedimela» (giro 12): sotto l'avviso il tasto «Prestala»; se gliela presti già, «Gliela presti ✓» */
function lendKey(x) {
  if (x.tipo !== 'chiedi_chiavi' || !x.da) return '';
  var A = amici();
  if (A && A.lends && A.lends(x.da)) return '<span class="nt-asked">Gliela presti ✓</span>';
  return '<button type="button" class="btn nt-lend" data-lendkey="' + esc(x.da) + '">Prestala</button>';
}
function lendKeyGo(da) {
  close();
  var A = amici(); if (!A) return;
  setTimeout(function () {
    if (A.hasOwn && !A.hasOwn()) {   // niente di suo da prestare: la guida per creare l’API (gratis)
      NL.toast('Non hai ancora un’API tua: creala, è gratis, e poi potrai prestarla.');
      if (window.NLRicerche && window.NLRicerche.guide) window.NLRicerche.guide(); else if (A.keys) A.keys();
    } else if (A.keySheet) A.keySheet(da);
  }, 60);
}
/* ---------- tocco: il libro o la finestra Amici ---------- */
function go(id) {
  var x = items.filter(function (y) { return y.id === id; })[0]; if (!x) return;
  if (x.tipo === 'avviso') return;
  if (x.tipo === 'messaggi') { close(); if (window.NLChat) setTimeout(function () { window.NLChat.open(); }, 60); return; }   // la chat (giro 9b)
  if (x.tipo === 'segnalazione') { close(); if (window.NLAdmin) setTimeout(function () { window.NLAdmin.open(x.rif); }, 60); return; }   // pannello: giro 9e                       // l'avviso si legge tutto qui: il tocco non porta altrove
  if (x.tipo === 'chiedi_chiavi' && x.da) { lendKeyGo(x.da); return; }   // «Chiedimela»: apre «Presta a …»
  close();
  var A = amici();
  if (x.tipo === 'limite') { if (window.NLRicerche) setTimeout(function () { window.NLRicerche.guide(x.titolo); }, 60); return; }   // guida: crea la tua API, è gratis
  if (/^(prestito|regalo|reso|reso_ok|reso_no|chiuso)$/.test(x.tipo) && x.rif) {
    var mine = NL.myBooks ? NL.myBooks() : NL.books();
    var b = mine.filter(function (y) { return y.sx === x.rif; })[0];
    if (b && NL.showBook && NL.showBook(b.id)) return;
  }
  if (x.tipo === 'desideri' && A && A.guest && x.da) { setTimeout(function () { Promise.resolve(A.guest(x.da)).then(function () { if (NL.guest && NL.guest()) NL.setTab('wish'); }); }, 60); return; }   // i suoi desideri
  if (x.tipo === 'trovato' && A && A.guest && x.da) {     // la sua libreria, aperta su quel libro (lì c'è anche «Me lo presti?»)
    setTimeout(function () { Promise.resolve(A.guest(x.da)).then(function () { if (!(NL.guest && NL.guest())) return; NL.setTab('lib'); var bid = trovId(x); if (bid && NL.get(bid)) NL.openCard(bid); }); }, 60);
    return;
  }
  if (A) setTimeout(function () { A.open(x.tipo === 'chiavi'); }, 60);
}

/* ---------- quando si aggiorna ---------- */
if (amici() && amici().onLoad) amici().onLoad(load);                                  // insieme agli amici (apertura, ritorno, ogni ~3 min)
else {
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && uid() && Date.now() - lastLoad > 60000) load(); });
  setInterval(function () { if (document.visibilityState === 'visible' && uid() && !loading && Date.now() - lastLoad > 170000) load(); }, 60000);
  if (uid()) setTimeout(load, 1500);
}
S.onAuth(function () { if (!uid()) { items = []; wr(K, null); wr(K_READ, null); close(); } paint(); });
paintTop();
window.NLNotifiche = { open: open, load: load, state: function () { return items; } };   // per le prove
})();
