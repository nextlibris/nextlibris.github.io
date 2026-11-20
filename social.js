/* Next Libris · modulo «Account e sincronizzazione» (16/11/2026; un progetto Supabase per copia: PROGETTI).
   Account facoltativo con «Accedi con Google» (l'accesso con l'email e' spento dal 16/11/2026: CFG.email, vedi sotto), niente password; i libri si copiano su Supabase (Francoforte) e si
   ritrovano su un altro telefono o tablet. Il telefono resta la copia principale: senza rete o senza account l'app va come sempre.
   - Solo REST (fetch), nessuna libreria: Auth (/auth/v1) e database (/rest/v1, tabella «libri», regole RLS: ognuno vede solo i suoi).
   - Sincronizzazione: per ogni libro si ricorda l'impronta dell'ultima versione sincronizzata (h). Prima si scaricano le righe
     cambiate online dall'ultima volta (con 2 minuti di margine), poi si caricano i libri cambiati qui. Se un libro e' cambiato in
     tutti e due i posti vince questo telefono, tranne alla prima sincronizzazione del telefono (vince la copia online).
   - I libri cancellati online non spariscono: restano con «cancellato» (si possono recuperare). Prima della prima sincronizzazione
     l'app salva da sola una copia dei libri sul telefono, ripristinabile da qui.
   Usa solo window.NL (attacco in fondo ad app.js). */
(function () {
'use strict';
var NL = window.NL; if (!NL) return;
var esc = NL.esc;
/* Un progetto Supabase per copia, cosi' i libri delle copie non si mescolano nello stesso account (16/11/2026).
   Il piano gratuito di Supabase permette 2 progetti:
   - versione vera: progetto «next-libris» (Francoforte, ref fttdbqotjocjfjfcoyfv);
   - copia di prova: progetto «next-libris-prova» (ref amkrkvkylprjasccxmzo; nato per la copia social, che non c'è più). */
var SB_PROVA = { url: 'https://amkrkvkylprjasccxmzo.supabase.co', key: 'sb_publishable_OQFiirkpjbx5WLKNtm2u3w_0M0TX2HC' };
var PROGETTI = {
  '': { url: 'https://fttdbqotjocjfjfcoyfv.supabase.co', key: 'sb_publishable_fkmJDyZX1Lq2YzaBWnWOLQ_x0VfnSXp' },
  prova: SB_PROVA, social: SB_PROVA
};
var P = PROGETTI[NL.COPIA];
if (!window.NL_SOCIAL && !P) return;                 // le prove automatiche mettono in NL_SOCIAL un server finto
var CFG = window.NL_SOCIAL || {
  url: P.url,
  key: P.key,   // chiave pubblica: fatta per stare nell'app, i dati li proteggono le regole RLS
  gClient: '393545993031-bu3r02vfe9ugup4vgo3f40idr52204ge.apps.googleusercontent.com',   // Client ID di Google (pubblico, progetto Google Cloud «Next Libris») per il pulsante ufficiale «Accedi con Google»
  email: false   // accesso con l'email nascosto (16/11/2026): il servizio gratuito di Supabase manda 2 email all'ora e solo ai membri del progetto. Il codice resta; si riaccende con un SMTP proprio
};
var EMAIL = !!CFG.email;
var K_AUTH = 'catalogo-libri-social-auth', K_SYNC = 'catalogo-libri-social-sync';   // NL.ls aggiunge da solo il prefisso della copia
var MARGIN = 120000, PAGE = 1000, CHUNK = 200;

/* ---------- memoria ---------- */
function rd(k) { try { return JSON.parse(NL.ls.get(k) || 'null'); } catch (e) { return null; } }
function wr(k, v) { NL.ls.set(k, v == null ? '' : JSON.stringify(v)); }
var auth = rd(K_AUTH);                                // { at, rt, exp, uid, email }
if (!auth || !auth.rt || !auth.uid) auth = null;
var sync = rd(K_SYNC) || {};                          // { uid, last, h: { id: impronta }, when, n }
function saveSync() { wr(K_SYNC, sync); }

/* ---------- impronta di un libro (stessi campi e stesso ordine su ogni telefono) ---------- */
function hash(b) {
  var s = JSON.stringify(NL.fields.map(function (k) { return b[k] === undefined ? null : b[k]; }));
  var h = 0x811c9dc5;
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(36) + '.' + s.length.toString(36);
}

/* ---------- rete ---------- */
function Err(msg, code) { var e = new Error(msg); e.code = code; return e; }
async function call(path, opt) {
  opt = opt || {};
  var h = { apikey: CFG.key, 'Content-Type': 'application/json' };
  if (opt.user) h.Authorization = 'Bearer ' + (await token());
  if (opt.prefer) h.Prefer = opt.prefer;
  var r;
  try { r = await fetch(CFG.url + path, { method: opt.method || 'GET', headers: h, body: opt.body ? JSON.stringify(opt.body) : undefined, cache: 'no-store' }); }
  catch (e) { throw Err('Senza rete: riprovo quando torna.', 'net'); }
  var txt = await r.text(), j = null;
  try { j = txt ? JSON.parse(txt) : null; } catch (e) { if (window.nlErr) nlErr(e); }
  if (!r.ok) {
    var m = (j && (j.msg || j.message || j.error_description || j.error)) || ('errore ' + r.status);
    if (r.status === 401 && opt.user) throw Err('Accesso scaduto: entra di nuovo da Menu › Account.', 'auth');
    throw Err(String(m), r.status);
  }
  return j;
}
async function token() {
  if (!auth) throw Err('Non sei entrato.', 'auth');
  if (auth.exp && Date.now() < auth.exp - 60000) return auth.at;
  var j;
  try { j = await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: auth.rt } }); }
  catch (e) { if (e.code !== 'net') { logoutLocal(); throw Err('Accesso scaduto: entra di nuovo da Menu › Account.', 'auth'); } throw e; }
  setAuth(j);
  return auth.at;
}
/* richiesta con l'accesso dell'utente che restituisce la risposta così com'è (stato e intestazioni): per la funzione «libri» (giro 8) */
async function raw(path) { return fetch(CFG.url + path, { headers: { apikey: CFG.key, Authorization: 'Bearer ' + (await token()) }, cache: 'no-store' }); }
/* come raw, ma va anche senza account (catalogo SBN della casa, 031): con l'account manda l'accesso, senza solo la chiave pubblica */
async function rawOpen(path) {
  var h = { apikey: CFG.key };
  if (auth) { try { h.Authorization = 'Bearer ' + (await token()); } catch (e) { if (auth) throw e; } }
  return fetch(CFG.url + path, { headers: h, cache: 'no-store' });
}
var authFns = [];                                    // moduli che vogliono sapere quando si entra o si esce (amici.js)
function authChanged() { authFns.forEach(function (f) { try { f(auth); } catch (e) { if (window.nlErr) nlErr(e); } }); }
function setAuth(j) {
  var was = auth && auth.uid;
  auth = { at: j.access_token, rt: j.refresh_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000,
    uid: (j.user && j.user.id) || (auth && auth.uid), email: (j.user && j.user.email) || (auth && auth.email) || '' };
  wr(K_AUTH, auth);
  if (was !== auth.uid) setTimeout(authChanged, 0);
}
function logoutLocal() { var was = !!auth; auth = null; wr(K_AUTH, null); paint(); if (was) authChanged(); }

/* ---------- copia di sicurezza sul telefono (IndexedDB, prima della prima sincronizzazione) ---------- */
function idb() {
  return new Promise(function (res, rej) {
    if (!window.indexedDB) { rej(new Error('IndexedDB')); return; }
    var r = indexedDB.open((NL.COPIA ? NL.COPIA + '-' : '') + 'catalogo-libri-social', 1);
    r.onupgradeneeded = function () { r.result.createObjectStore('copie'); };
    r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
  });
}
async function putCopy(books) {
  var db = await idb();
  await new Promise(function (res, rej) { var tx = db.transaction('copie', 'readwrite'); tx.objectStore('copie').put({ when: Date.now(), books: books }, 'prima'); tx.oncomplete = res; tx.onerror = function () { rej(tx.error); }; });
}
async function getCopy() {
  try {
    var db = await idb();
    return await new Promise(function (res) { var q = db.transaction('copie').objectStore('copie').get('prima'); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { res(null); }; });
  } catch (e) { return null; }
}

/* ---------- sincronizzazione ---------- */
var busy = null, again = false, lastErr = '', tAuto = null;
function schedule(ms) { if (!auth) return; clearTimeout(tAuto); tAuto = setTimeout(function () { run(false); }, ms); }
async function run(manual) {
  if (!auth) return false;
  if (NL.guest && NL.guest()) { schedule(5000); return false; }   // stai guardando la libreria di un amico: si sincronizza quando torni alla tua
  if (busy) { again = true; return busy; }
  busy = (async function () {
    try { await doSync(); lastErr = ''; if (manual) NL.toast('Libri sincronizzati.'); return true; }
    catch (e) { lastErr = e.message || 'errore'; if (manual || e.code !== 'net') NL.toast(lastErr); return false; }
    finally { busy = null; paint(); if (again) { again = false; schedule(1500); } }
  })();
  paint();
  return busy;
}
async function pullRows(since) {
  var out = [], off = 0;
  for (;;) {
    var q = '/rest/v1/libri?select=id,dati,cancellato,aggiornato&order=aggiornato.asc,id.asc&limit=' + PAGE + '&offset=' + off +
      (since ? '&aggiornato=gt.' + encodeURIComponent(since) : '');
    var rows = await call(q, { user: true }) || [];
    out = out.concat(rows);
    if (rows.length < PAGE) return out;
    off += PAGE;
  }
}
async function doSync() {
  await token();
  var uid = auth.uid, first = sync.uid !== uid;
  if (first) {
    try { await putCopy(NL.stored()); } catch (e) { throw Err('Non riesco a salvare la copia di sicurezza sul telefono: sincronizzazione ferma.', 'copy'); }
    sync = { uid: uid, last: '', h: {}, when: 0, n: 0 };
  }
  var books = NL.myBooks ? NL.myBooks() : NL.books(), byId = {};   // sempre i tuoi libri, anche se stai guardando quelli di un amico
  books.forEach(function (b) { byId[b.id] = b; });
  // 1) scarico quello che e' cambiato online
  var since = sync.last ? new Date(Date.parse(sync.last) - MARGIN).toISOString() : '';
  var rows = await pullRows(since), changed = 0, maxT = sync.last || '';
  rows.forEach(function (r) {
    if (r.aggiornato > maxT) maxT = r.aggiornato;
    var known = sync.h[r.id], lb = byId[r.id];
    var remote = r.cancellato ? null : NL.clean(Object.assign({}, r.dati, { id: r.id }));
    var rh = remote ? hash(remote) : 'X';
    if (rh === known) return;                                         // e' la versione che conosco gia'
    var lh = lb ? hash(lb) : (known !== undefined ? 'X' : undefined);
    if (lh === rh) { sync.h[r.id] = rh; return; }                      // uguali: basta ricordarlo
    var localChanged = known === undefined ? false : lh !== known;    // prima volta che vedo questo libro: vince la copia online
    if (localChanged) return;                                          // cambiato anche qui: vince questo telefono (lo carico dopo)
    if (!remote) { if (lb) { books.splice(books.indexOf(lb), 1); delete byId[r.id]; changed++; } }
    else if (lb) { books[books.indexOf(lb)] = remote; byId[r.id] = remote; changed++; }
    else { books.push(remote); byId[r.id] = remote; changed++; }
    sync.h[r.id] = rh;
  });
  sync.last = maxT;
  if (changed) { NL.save(); NL.refresh(); }
  // 2) carico quello che e' cambiato qui
  var up = [], hs = {};
  NL.stored().forEach(function (b) { var h = hash(b); if (sync.h[b.id] !== h) { up.push({ utente: uid, id: b.id, dati: b, cancellato: false }); hs[b.id] = h; } });
  var gone = Object.keys(sync.h).filter(function (id) { return sync.h[id] !== 'X' && !byId[id]; })
    .map(function (id) { return { utente: uid, id: id, cancellato: true }; });   // senza «dati»: online resta l'ultima versione, recuperabile
  for (var i = 0; i < up.length; i += CHUNK) {
    var part = up.slice(i, i + CHUNK);
    await call('/rest/v1/libri?on_conflict=utente,id', { method: 'POST', user: true, prefer: 'resolution=merge-duplicates,return=minimal', body: part });
    part.forEach(function (x) { sync.h[x.id] = hs[x.id]; });
    saveSync();
  }
  for (var j = 0; j < gone.length; j += CHUNK) {
    var g = gone.slice(j, j + CHUNK);
    await call('/rest/v1/libri?on_conflict=utente,id', { method: 'POST', user: true, prefer: 'resolution=merge-duplicates,return=minimal', body: g });
    g.forEach(function (x) { sync.h[x.id] = 'X'; });
    saveSync();
  }
  sync.when = Date.now();
  sync.n = Object.keys(sync.h).filter(function (id) { return sync.h[id] !== 'X'; }).length;
  saveSync();
}

/* ---------- accesso ---------- */
var prov = null, provFail = false, provLoading = null;                                       // provider attivi in Supabase (/auth/v1/settings): il pulsante Google compare solo se Google e' acceso
async function providers() {
  if (prov) return prov;
  if (provLoading) return provLoading;
  provLoading = (async function () {
    try { var j = await call('/auth/v1/settings'); prov = { google: !!(j && j.external && j.external.google) }; provFail = false; return prov; }
    catch (e) { provFail = true; return { google: false }; }
    finally { provLoading = null; }
  })();
  return provLoading;
}
function google() { location.href = CFG.url + '/auth/v1/authorize?provider=google&redirect_to=' + encodeURIComponent(home()); }   // riserva: passa da supabase.co
/* Pulsante ufficiale di Google (Google Identity Services, 16/11/2026): Google consegna il token direttamente a questa pagina,
   quindi nella sua finestra compare il nostro sito e non l'indirizzo del progetto Supabase. Il token si scambia con Supabase
   (grant_type=id_token) insieme al «nonce»: a Google va la sua impronta SHA-256, a Supabase il valore originale. */
var gisP = null;
function gisLoad() {
  var G = function () { return window.google && window.google.accounts && window.google.accounts.id; };   // (attenzione: «google» qui e' la funzione di riserva)
  if (G()) return Promise.resolve(G());
  if (gisP) return gisP;
  gisP = new Promise(function (res, rej) {
    var sc = document.createElement('script'); sc.src = 'https://accounts.google.com/gsi/client'; sc.async = true;
    var t = setTimeout(function () { rej(new Error('timeout')); }, 10000);
    sc.onload = function () { clearTimeout(t); G() ? res(G()) : rej(new Error('gsi')); };
    sc.onerror = function () { clearTimeout(t); rej(new Error('gsi')); };
    document.head.appendChild(sc);
  });
  gisP.catch(function () { gisP = null; });
  return gisP;
}
async function makeNonce() {
  var raw = btoa(String.fromCharCode.apply(null, crypto.getRandomValues(new Uint8Array(24))));
  var d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return { raw: raw, hashed: Array.from(new Uint8Array(d)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('') };
}
async function gisButton(slot) {
  slot = slot || document.getElementById('accG'); if (!slot) return;
  try {
    var id = await gisLoad(), n = await makeNonce();
    if (!document.body.contains(slot)) return;
    id.initialize({ client_id: CFG.gClient, nonce: n.hashed, ux_mode: 'popup', itp_support: true, use_fedcm_for_prompt: true, auto_select: false,
      callback: function (r) { gisDone(r, n.raw); } });
    slot.innerHTML = '';
    id.renderButton(slot, { type: 'standard', theme: 'outline', shape: 'pill', size: 'large', text: 'signin_with', locale: 'it', width: Math.min(400, slot.clientWidth || 300) });
  } catch (e) {                                      // senza rete o script bloccato: resta il metodo di riserva
    slot.innerHTML = '<button class="btn primary" type="button" data-acc="google">Entra con Google</button>';
  }
}
async function gisDone(r, raw) {
  if (!r || !r.credential) return;
  try {
    var j = await call('/auth/v1/token?grant_type=id_token', { method: 'POST', body: { provider: 'google', id_token: r.credential, nonce: raw } });
    if (!j || !j.access_token) throw Err('risposta vuota', 'gis');
    setAuth(j);
  } catch (e) { err(e.code === 'net' ? e.message : 'Accesso con Google non riuscito (' + e.message + '). Riprova.'); return; }
  var md = (j.user && j.user.user_metadata) || {}, nome = NL.name() || String(md.full_name || md.name || '').split(' ')[0].slice(0, 30);
  try { if (nome) await call('/rest/v1/profili?on_conflict=id', { method: 'POST', user: true, prefer: 'resolution=merge-duplicates,return=minimal', body: { id: auth.uid, nome: nome } }); } catch (e) { if (window.nlErr) nlErr(e); }
  NL.toast('Sei entrato. Sincronizzo i libri…'); paint();
  await run(false);
}
function home() { return location.origin + location.pathname.replace(/[^/]*$/, ''); }   // dove torna il link dell'email
async function sendCode(email) {
  await call('/auth/v1/otp?redirect_to=' + encodeURIComponent(home()), { method: 'POST', body: { email: email, create_user: true } });
}
/* Link dell'email («Sign in», o «Confirm your mail» la prima volta): Supabase riapre l'app con i token dopo il # dell'indirizzo.
   Con il servizio email gratuito di Supabase i modelli non si cambiano, quindi arriva il link e non il codice (16/11/2026).
   Su Android il link si apre in Chrome, che ha gli stessi dati dell'app installata: l'accesso vale anche li'. */
async function fromLink() {
  var h = location.hash.replace(/^#/, '');
  if (!/(^|&)(access_token|error_code|error)=/.test(h)) return;
  var q = {}; h.split('&').forEach(function (kv) { var i = kv.indexOf('='); if (i > 0) q[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' ')); });
  try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) { if (window.nlErr) nlErr(e); }   // i token non restano nell'indirizzo
  if (!q.access_token) {
    NL.toast(q.error_code === 'otp_expired' ? 'Il link dell\'email è scaduto o già usato: chiedine uno nuovo.' : q.error === 'access_denied' && !q.error_code ? 'Accesso annullato.' : 'Accesso non riuscito: riprova.');
    setTimeout(open, 400); return;
  }
  var j = { access_token: q.access_token, refresh_token: q.refresh_token, expires_in: q.expires_in };
  try {
    auth = { at: q.access_token, rt: q.refresh_token, exp: Date.now() + (Number(q.expires_in) || 3600) * 1000 };
    var u = await call('/auth/v1/user', { user: true });
    j.user = u; auth = null; setAuth(j);
  } catch (e) { auth = null; NL.toast('Accesso non riuscito: ' + e.message); return; }
  var md = (j.user && j.user.user_metadata) || {}, nome = NL.name() || String(md.full_name || md.name || '').split(' ')[0].slice(0, 30);
  try { if (nome) await call('/rest/v1/profili?on_conflict=id', { method: 'POST', user: true, prefer: 'resolution=merge-duplicates,return=minimal', body: { id: auth.uid, nome: nome } }); } catch (e) { if (window.nlErr) nlErr(e); }
  NL.toast('Sei entrato. Sincronizzo i libri…'); paint();
  await run(false); setTimeout(open, 300);
}
async function verify(email, code) {
  var j = await call('/auth/v1/verify', { method: 'POST', body: { type: 'email', email: email, token: code } });
  if (!j || !j.access_token) throw Err('Codice non valido.', 'code');
  setAuth(j);
  try { if (NL.name()) await call('/rest/v1/profili?on_conflict=id', { method: 'POST', user: true, prefer: 'resolution=merge-duplicates,return=minimal', body: { id: auth.uid, nome: NL.name() } }); } catch (e) { if (window.nlErr) nlErr(e); }
}
async function logout() {
  try { await call('/auth/v1/logout', { method: 'POST', user: true }); } catch (e) { if (window.nlErr) nlErr(e); }
  logoutLocal();
}

/* ---------- finestra «Account e sincronizzazione» ---------- */
var step = 'email', mail = '', confirmAct = '', copyInfo = null;
function when(t) {
  if (!t) return '';
  var d = new Date(t), now = new Date(), hm = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === now.toDateString() ? 'oggi alle ' + hm : 'il ' + d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' }) + ' alle ' + hm;
}
function sheet() {
  var el = document.getElementById('accSheet');
  if (el) return el;
  el = document.createElement('div'); el.className = 'sheet acc'; el.id = 'accSheet'; el.hidden = true;
  el.innerHTML = '<div class="sheet-in" role="dialog" aria-modal="true" aria-labelledby="accH"><h2 id="accH">Account e sincronizzazione</h2><div id="accBody"></div>' +
    '<div class="row-btns"><button class="btn" type="button" id="accClose">Chiudi</button></div></div>';
  document.body.appendChild(el);
  el.addEventListener('click', function (e) { if (e.target === el) close(); });
  el.querySelector('#accClose').addEventListener('click', close);
  el.addEventListener('submit', function (e) { e.preventDefault(); });
  el.addEventListener('click', onClick);
  return el;
}
window.addEventListener('online', function () { if (!auth && !prov) { provFail = false; paintSheet(); } });   // torna la rete: si riprova
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var el = document.getElementById('accSheet'); if (el && !el.hidden) close(); } });
async function open() {
  var el = sheet(); confirmAct = ''; el.hidden = false; provFail = false;   // a ogni apertura si riprova
  paintSheet(); copyInfo = await getCopy(); paintSheet();   // il disegno era finito dentro il commento: con l'account la finestra restava vuota (Piero, 18/11/2026)
  if (!auth && !prov) { await providers(); paintSheet(); }
  var f = el.querySelector('input'); if (f) setTimeout(function () { f.focus(); }, 60);
}
function close() { var el = document.getElementById('accSheet'); if (el) el.hidden = true; }
function paintSheet() {
  var body = document.getElementById('accBody'); if (!body || document.getElementById('accSheet').hidden) return;
  var h = '';
  if (!auth) {
    h += '<p class="msg">Con un account i tuoi libri si salvano anche online: li ritrovi su un altro telefono o tablet. ' +
      'Il telefono resta la copia principale; senza rete l\'app funziona come sempre.</p>';
    var gOn = prov && prov.google && CFG.gClient;    // senza Client ID niente Google (la riserva mostrerebbe supabase.co)
    if (!EMAIL) step = 'email';
    var iosApp = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);   // giro 11F: su iPhone la finestra di Google a volte non torna all'app
    if (step === 'email' && gOn) h += '<div class="acc-g" id="accG"></div>' +
      (iosApp ? '<p class="acc-links acc-ios"><button class="link" type="button" data-acc="google">La finestra di Google non si apre o non torna qui? Entra da questo link</button></p>' : '') +
      '<p class="msg bad" id="accErr" hidden></p>' + (EMAIL ? '<p class="acc-or">oppure con la tua email</p>' : '');
    if (!EMAIL) {
      /* dopo l'uscita dall'account i servizi di accesso non erano mai stati letti: prima si leggono, poi si decide il messaggio
         (prima compariva «serve la connessione» anche con la rete, Piero 17/11/2026) */
      if (!prov && !provFail) { h += '<p class="msg" id="accOff">Un attimo…</p>'; providers().then(function () { paintSheet(); }); }
      else if (!gOn) h += '<p class="msg' + (prov ? '' : ' bad') + '" id="accOff">' + (prov ? 'L\'accesso per ora non è attivo. Riprova più tardi.' : navigator.onLine === false ? 'Per entrare serve la connessione a internet.' : 'Non riesco a raggiungere il servizio di accesso. Riprova tra poco.') + '</p>';
    } else if (step === 'email') {
      h += '<form id="accFormE"><label class="field"><span>La tua email</span><input type="email" id="accMail" autocomplete="email" inputmode="email" enterkeyhint="send" required value="' + esc(mail) + '"></label>' +
        '<p class="msg bad" id="accErr" hidden></p><button class="btn' + (prov && prov.google ? '' : ' primary') + '" type="submit" id="accSend">Mandami l\'email</button></form>';
    } else {
      h += '<form id="accFormC"><p class="msg">Ti ho mandato un\'email a <b>' + esc(mail) + '</b> (guarda anche nella posta indesiderata). ' +
        '<b>Aprila su questo telefono e tocca il link</b> («Sign in», oppure «Confirm your mail» la prima volta): si riapre l\'app e sei dentro. ' +
        'Se invece nell\'email c\'è un codice di 6 cifre, scrivilo qui.</p>' +
        '<label class="field"><span>Codice</span><input type="text" id="accCode" inputmode="numeric" autocomplete="one-time-code" enterkeyhint="done" maxlength="6" pattern="[0-9]{6}" required></label>' +
        '<p class="msg bad" id="accErr" hidden></p><button class="btn primary" type="submit" id="accGo">Entra</button>' +
        '<p class="acc-links"><button class="link" type="button" data-acc="resend">Rimanda il codice</button> · <button class="link" type="button" data-acc="other">Usa un\'altra email</button></p></form>';
    }
    h += '<p class="acc-small">I dati stanno su Supabase, in Europa (Francoforte). Solo tu li vedi. Puoi cancellarli quando vuoi, da qui. <a href="privacy.html" target="_blank" rel="noopener">Informativa sulla privacy</a></p>';
  } else {
    var st = busy ? 'Sincronizzo…' : lastErr ? lastErr : sync.when && sync.uid === auth.uid ? 'Ultima sincronizzazione ' + when(sync.when) + ' · ' + sync.n + (sync.n === 1 ? ' libro' : ' libri') + ' online' : 'Non ancora sincronizzato';
    h += '<div class="acc-card"><p class="acc-who">Sei entrato come <b>' + esc(auth.email || '') + '</b></p><p class="acc-st' + (lastErr && !busy ? ' bad' : sync.when ? ' ok' : '') + '" id="accSt" aria-live="polite">' + esc(st) + '</p></div>' +
      '<button class="btn primary" type="button" data-acc="sync"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Sincronizzo…' : 'Sincronizza adesso') + '</button>' +
      '<p class="acc-small">Le copertine e le foto scattate da te restano su questo telefono (per ora non si sincronizzano).</p>' +
      '<details class="acc-more"><summary>Altre azioni</summary><div class="acc-acts">' +
      '<button class="btn" type="button" data-acc="logout">Esci da questo telefono</button>' +
      (copyInfo ? '<button class="btn" type="button" data-acc="restore">Ripristina la copia del ' + esc(new Date(copyInfo.when).toLocaleDateString('it-IT')) + ' (' + copyInfo.books.length + ' libri)</button>' : '') +
      '<button class="btn" type="button" data-acc="wipe">Cancella i miei libri online</button>' +
      '<button class="btn" type="button" data-acc="delete">Elimina l\'account</button></div></details>';
    if (confirmAct) {
      var q = { wipe: 'Cancello tutti i tuoi libri online? Su questo telefono restano. Gli altri telefoni non si sincronizzano più finché non risincronizzi.',
        delete: 'Elimino l\'account e tutti i libri online? Su questo telefono i libri restano. Non si può annullare.',
        restore: 'Rimetto i libri come erano nella copia? I libri aggiunti dopo spariscono da questo telefono (e, sincronizzando, anche online).',
        logout: 'Esco? I libri restano su questo telefono; online restano finché non li cancelli.' }[confirmAct];
      h += '<div class="acc-conf" role="alertdialog"><p>' + esc(q) + '</p><div class="row-btns"><button class="btn" type="button" data-acc="no">Annulla</button>' +
        '<button class="btn primary" type="button" data-acc="yes">Sì</button></div></div>';
    }
  }
  body.innerHTML = h;
  var errs = body.querySelectorAll('#accErr'); for (var i = 1; i < errs.length; i++) errs[i].remove();   // un solo riquadro d'errore
  if (document.getElementById('accG')) gisButton();
}
function err(m) { ['accErr', 'wcErr'].forEach(function (id) { var e = document.getElementById(id); if (e) { e.textContent = m; e.hidden = !m; } }); }   // wcErr: scheda «Entra con Google» (guida.js)
/* tasto ufficiale di Google in un altro posto (scheda «Entra con Google» delle schede di benvenuto, 19/11/2026) */
async function gButton(slot) {
  if (!slot) return;
  slot.innerHTML = '';
  try { if (!prov) await providers(); } catch (e) { if (window.nlErr) nlErr(e); }
  if (!(prov && prov.google && CFG.gClient)) { slot.innerHTML = '<button class="wc-btn" type="button" data-gd="acc">Accedi con Google</button>'; return; }
  gisButton(slot);
}
function niceAuthErr(e) {
  if (e.code === 'net') return e.message;
  if (/not authorized|not_authorized/i.test(e.message)) return 'Per ora i codici arrivano solo agli indirizzi autorizzati nel progetto (in prova). Usa l\'email del tuo account Supabase.';
  if (/email rate limit|over_email_send_rate_limit/i.test(e.message)) return 'Il servizio email gratuito di Supabase manda al massimo 2 email all\'ora per tutta l\'app: riprova più tardi.';
  if (e.code === 429 || /rate|seconds|after/i.test(e.message)) return 'Aspetta un minuto prima di chiedere un\'altra email.';
  if (e.code === 403 || e.code === 401 || /expired|invalid|token/i.test(e.message)) return 'Codice sbagliato o scaduto. Controlla o fatti mandare un codice nuovo.';
  return 'Non ci riesco (' + e.message + '). Riprova tra poco.';
}
document.addEventListener('submit', async function (e) {
  var f = e.target; if (!f || !f.closest || !f.closest('#accSheet')) return;
  e.preventDefault();
  if (f.id === 'accFormE') {
    mail = document.getElementById('accMail').value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) { err('Scrivi un indirizzo email valido.'); return; }
    var b = document.getElementById('accSend'); b.disabled = true; b.textContent = 'Mando l\'email…';
    try { await sendCode(mail); step = 'code'; paintSheet(); var c = document.getElementById('accCode'); if (c) c.focus(); }
    catch (x) { b.disabled = false; b.textContent = 'Mandami l\'email'; err(niceAuthErr(x)); }
  } else if (f.id === 'accFormC') {
    var code = document.getElementById('accCode').value.replace(/\D/g, '');
    if (code.length !== 6) { err('Il codice ha 6 cifre.'); return; }
    var g = document.getElementById('accGo'); g.disabled = true; g.textContent = 'Controllo…';
    try { await verify(mail, code); step = 'email'; NL.toast('Sei entrato. Sincronizzo i libri…'); paint(); run(false).then(function () { copyInfo = null; getCopy().then(function (c) { copyInfo = c; paintSheet(); }); }); }
    catch (x) { g.disabled = false; g.textContent = 'Entra'; err(niceAuthErr(x)); }
  }
}, true);
async function onClick(e) {
  var b = e.target.closest && e.target.closest('[data-acc]'); if (!b) return;
  var a = b.dataset.acc;
  if (a === 'google') { b.disabled = true; google(); return; }
  if (a === 'resend') { try { await sendCode(mail); NL.toast('Codice rimandato.'); } catch (x) { err(niceAuthErr(x)); } return; }
  if (a === 'other') { step = 'email'; paintSheet(); return; }
  if (a === 'sync') { run(true); return; }
  if (a === 'logout' || a === 'wipe' || a === 'delete' || a === 'restore') { confirmAct = a; paintSheet(); return; }
  if (a === 'no') { confirmAct = ''; paintSheet(); return; }
  if (a !== 'yes') return;
  var act = confirmAct; confirmAct = ''; paintSheet();
  try {
    if (act === 'logout') { await logout(); NL.toast('Sei uscito. I libri restano su questo telefono.'); }
    else if (act === 'wipe') {
      await call('/rest/v1/libri?utente=eq.' + encodeURIComponent(auth.uid), { method: 'DELETE', user: true, prefer: 'return=minimal' });
      sync = {}; saveSync(); NL.toast('Libri online cancellati. Su questo telefono restano.');
    } else if (act === 'delete') {
      await call('/rest/v1/rpc/elimina_account', { method: 'POST', user: true, body: {} });
      sync = {}; saveSync(); logoutLocal(); NL.toast('Account eliminato. I libri restano su questo telefono.');
    } else if (act === 'restore') {
      var c = await getCopy(); if (!c) return;
      var books = NL.myBooks ? NL.myBooks() : NL.books(); books.splice.apply(books, [0, books.length].concat(c.books.map(NL.clean).filter(Boolean)));
      NL.save(); NL.refresh(); NL.toast('Libri ripristinati dalla copia.'); schedule(1500);
    }
  } catch (x) { NL.toast(x.message); }
  paint();
}

/* ---------- voce nel Menu ---------- */
function paint() {
  var b = document.getElementById('goAcc');
  if (b) {
    var t = !auth ? 'Libri online, su ogni telefono' : busy ? 'Sincronizzo…' : lastErr ? lastErr :
      sync.when && sync.uid === auth.uid ? 'Sincronizzato ' + when(sync.when) : 'Entrato come ' + (auth.email || '');
    document.getElementById('goAccTxt').textContent = t;
    b.classList.toggle('acc-on', !!auth);
  }
  paintSheet();
}
function paintMenu() {
  var b = document.getElementById('goAcc');
  if (!b) {
    var set = document.getElementById('setList'); if (!set) return;   // sotto «Impostazioni» (Piero, 16/11/2026), per primo
    b = document.createElement('button'); b.type = 'button'; b.id = 'goAcc'; b.className = 'dopt dgo';
    b.innerHTML = '<span><b>Account e sincronizzazione</b><small id="goAccTxt"></small></span><span class="n" aria-hidden="true">›</span>';
    set.insertBefore(b, set.firstChild);
    b.addEventListener('click', function () { NL.fromMenu(open); });
  }
  paint();
}
NL.on('menu', paintMenu);
NL.on('saved', function () { schedule(4000); });
window.addEventListener('online', function () { schedule(1000); });
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && auth && Date.now() - (sync.when || 0) > 60000) schedule(800); });
if (/(access_token|error_code)=/.test(location.hash)) fromLink(); else if (auth) schedule(1500);
window.addEventListener('hashchange', function () { if (/(access_token|error_code)=/.test(location.hash)) fromLink(); });   // link aperto nella stessa scheda dell'app
window.NLSocial = { run: run, open: open, state: function () { return { auth: auth, sync: sync, busy: !!busy, err: lastErr }; }, hash: hash,   // per le prove
  call: call, raw: raw, rawOpen: rawOpen, auth: function () { return auth; }, onAuth: function (f) { authFns.push(f); }, home: home,
  gButton: gButton, google: google };   // per le schede di benvenuto (guida.js)   // per gli altri moduli (amici.js)
})();
