/* Next Libris · modulo «Amici» (16/11/2026, nella copia di prova).
   Amicizia reciproca: chiedi, l'altro accetta o rifiuta. Il nome dell'app («Libreria di Piero») e' anche il nome per gli amici:
   unico (senza badare alle maiuscole), 3-20 caratteri (lettere anche accentate, numeri, spazi, punto, trattino, apostrofo).
   Ci si trova cercando il nome (da 3 lettere: uguale o che comincia cosi') o con il link d'invito (…/?amico=Nome).
   Dove si vede: segnalibro Amici e parte «Amici» dell'Indice; le novità (richieste, prestiti, consigli…) nella campanella (notifiche.js).
   In cima restano solo gli avvisi che chiedono una risposta: «Me lo presti?» e il reso da confermare.
   Le richieste si leggono all'apertura e tornando all'app (niente email, niente Realtime: limiti del piano gratuito di Supabase).
   Desideri: «Gli amici vedono i miei desideri» (spento di partenza); la pagina di un amico mostra i suoi desideri e «Te lo regalo io»
   (lui non lo vede, gli altri amici si'). Prestiti e regali: in «Presta, vendi o regala» si sceglie un amico; il libro compare subito
   nella sua Libreria con «Prestato da …» / «Regalato da …» (un regalo che era tra i suoi desideri ci passa); la restituzione la segna
   chiunque dei due e vale per entrambi. Scelte di Piero del 16/11/2026.
   Database: supabase/002_amicizie.sql, 003_nome_unico.sql, 004_desideri_scambi.sql (ramo prove). Usa window.NL e window.NLSocial (social.js). */
(function () {
'use strict';
var NL = window.NL, S = window.NLSocial; if (!NL || !S || !S.call) return;
var esc = NL.esc, K_INV = 'catalogo-libri-amici-invito';
var NAME_RE = /^[0-9A-Za-zÀ-ÖØ-öø-ÿ ._'-]{3,20}$/;
var K_PEND = 'catalogo-libri-amici-scambi-da-mandare';
var opts = false, nums = {};
var ffOf = null, ff = null;   // amici dell'amico: di chi, e cosa è arrivato (17/11/2026)
var swaps = [], view = null, wishes = null, libs = null, libsShow = 30, libsQ = '', recvId = '', asks = [], who = {}, gMeta = {}, gId = null;
var K_KEY = 'catalogo-libri-amici-chiave-in-uso';
var keys = [];
var me = null, list = null, loading = null, lastLoad = 0, found = null, foundQ = '', invite = null, confirmId = '', busy = '', err = '', editName = false, syncing = false;
var ICON = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/></svg>';

function mine() { return NL.myBooks ? NL.myBooks() : NL.books(); }
function myGet(id) { return mine().filter(function (b) { return b.id === id; })[0] || null; }
function rd(k) { try { return JSON.parse(NL.ls.get(k) || 'null'); } catch (e) { return null; } }
function wr(k, v) { NL.ls.set(k, v == null ? '' : JSON.stringify(v)); }
function rpc(name, body) { return S.call('/rest/v1/rpc/' + name, { method: 'POST', user: true, body: body || {} }); }
function uid() { var a = S.auth(); return a && a.uid; }
function tidy(v) { return String(v || '').replace(/^\s*@/, '').replace(/\s+/g, ' ').trim(); }
function validName(v) { return NAME_RE.test(v) && v === v.trim(); }
function aChi(n) { return (/^[aA]/.test(n) ? 'ad ' : 'a ') + n; }   // «ad Anna», «a Marco»
function nameOf(x) { return esc(x.utente || x.nome || '?'); }
var RULES = 'Da 3 a 20 caratteri: lettere, numeri, spazi, punto, trattino o apostrofo.';
function nice(e) {
  var m = String(e && e.message || e);
  if (e && e.code === 'net') return m;
  if (/utente non trovato/.test(m)) return 'Non trovo nessuno con questo nome.';
  if (/duplicate|unique|23505/.test(m) || (e && e.code === 409)) return 'Questo nome è già usato da un altro: aggiungi un\'iniziale o un numero (es. «Piero R.»).';
  if (/check|23514/.test(m)) return RULES;
  if (/troppe richieste/.test(m)) return 'Hai già tante richieste in attesa: aspetta che qualcuno risponda.';
  if (/non amici/.test(m)) return 'Non siete più amici su Next Libris.';
  if (/non tua/.test(m)) return 'Questa API te l’ha prestata un amico: puoi prestare solo la tua.';
  if (/worker non valido|chiave non valida|niente da prestare/.test(m)) return 'Puoi prestare solo un’API tua.';
  return 'Non ci riesco (' + m + '). Riprova tra poco.';
}

/* ---------- dati ---------- */
async function load(force) {
  if (!uid()) { me = null; list = null; paintAll(); return; }
  if (loading) return loading;
  if (!force && list && Date.now() - lastLoad < 60000) return;
  loading = (async function () {
    try {
      var p;
      var cols = ['utente,nome,desideri,libreria,amici,regali,creato,foto,cit,p_cit,p_stat,p_cits,p_let,p_pref,p_cons,scrivermi', 'utente,nome,desideri,libreria,amici,regali,creato,foto,cit,p_cit,p_stat,p_cits,p_let,p_pref,p_cons', 'utente,nome,desideri,libreria,amici,regali,creato,foto,cit,p_cit,p_stat,p_cits', 'utente,nome,desideri,libreria,amici,regali', 'utente,nome,desideri,libreria,amici', 'utente,nome,desideri,libreria'];   // database senza 016 o 015
      for (var ci = 0; ci < cols.length; ci++) {
        try { p = await S.call('/rest/v1/profili?select=' + cols[ci] + '&id=eq.' + encodeURIComponent(uid()), { user: true }); break; }
        catch (e0) { if ((e0 && e0.code === 'net') || ci === cols.length - 1) throw e0; }
      }
      me = (p && p[0]) || { utente: null, nome: '', desideri: true, libreria: true };   // accese di partenza (022, 18/11/2026)
      list = abc(await rpc('miei_amici'));
      try { nums = {}; ((await rpc('amici_numeri')) || []).forEach(function (x) { nums[x.id] = x; }); } catch (e) { if (window.nlErr) nlErr(e); }
      try { swaps = (await rpc('miei_scambi')) || []; await applySwaps(); } catch (e) { if (window.console) console.warn('scambi', e); }
      try { asks = (await rpc('mie_richieste')) || []; await loadWho(); seenAnswers(); } catch (e) { if (window.console) console.warn('richieste', e); }
      try { keys = (await rpc('chiavi_mie')) || []; checkKeys(); await ownCheck(); } catch (e) { if (window.console) console.warn('chiavi', e); }
      try { var fk = {}; ((await rpc('amici_chiavi')) || []).forEach(function (x) { fk[x.id] = x; }); fkeys = fk; } catch (e) { if (window.console) console.warn('chiavi degli amici', e); }   // giro 12: chi ha un’API sua
      declareKeys();
      lastLoad = Date.now(); err = '';
      if (me.utente && NL.name() !== me.utente) { syncing = true; NL.setName(me.utente); syncing = false; }   // il nome per gli amici vale anche nell'app
    } catch (e) { err = nice(e); }
    loading = null; paintAll(); askName();
    loaded.forEach(function (fn) { try { fn(); } catch (e) { if (window.nlErr) nlErr(e); } });   // la campanella si aggiorna insieme
  })();
  return loading;
}
var loaded = [];
var fkeys = {};                          // giro 12 (030): per ogni amico { gb, sbn, chiesta }: ha un’API o un worker suoi, e quando gliel'ho chiesta
/* amici sempre in ordine alfabetico, in tutte le finestre (Piero, 17/11/2026 sera) */
function abc(a) { return (a || []).slice().sort(function (x, y) { return String(x.utente || x.nome || '').localeCompare(String(y.utente || y.nome || ''), 'it', { sensitivity: 'base' }); }); }
function friends() { return (list || []).filter(function (x) { return x.stato === 'amici'; }); }
function received() { return (list || []).filter(function (x) { return x.stato === 'attesa' && x.verso === 'ricevuta'; }); }
function sent() { return (list || []).filter(function (x) { return x.stato === 'attesa' && x.verso === 'inviata'; }); }
async function saveMine(v) {                        // il nome per gli amici (e nell'app)
  await S.call('/rest/v1/profili?on_conflict=id', { method: 'POST', user: true, prefer: 'resolution=merge-duplicates,return=minimal', body: { id: uid(), utente: v, nome: v } });
  me.utente = v; me.nome = v;
  syncing = true; NL.setName(v); syncing = false;
}
/* nome cambiato nell'app (Impostazioni › Condivisione, benvenuto, condivisione): se sei entrato vale anche per gli amici */
NL.on('name', async function (v) {
  if (syncing || !uid() || !me) return;
  v = tidy(v);
  if (v === (me.utente || '')) return;
  var back = function (msg) { if (me.utente) { syncing = true; NL.setName(me.utente); syncing = false; } NL.toast(msg); };
  if (!v) { if (me.utente) back('Il nome serve agli amici per trovarti: resta «' + me.utente + '».'); return; }
  if (!validName(v)) { back(RULES + (me.utente ? ' Resta «' + me.utente + '».' : '')); return; }
  try { await saveMine(v); NL.toast('Nome salvato: lo vedono anche i tuoi amici.'); paintAll(); }
  catch (e) { back(nice(e) + (me.utente ? ' Resta «' + me.utente + '».' : '')); }
});

/* ---------- nome utente obbligatorio (Piero, 19/11/2026) ----------
   Chi ha l'account ma non ha ancora il nome utente non è trovabile dagli amici:
   a ogni apertura (e subito dopo l'accesso con Google) una finestra lo chiede, senza «Più tardi».
   Proposta già scritta: nome e iniziale del cognome da Google («Victoria I.»). */
var askOpen = false;
function proposal(full) {
  var w = tidy(full).split(' ').filter(Boolean), v = '';
  if (w.length > 1) v = w[0] + ' ' + w[w.length - 1].charAt(0).toUpperCase() + '.';
  else if (w.length) v = w[0];
  v = v.slice(0, 20).trim();
  return validName(v) ? v : (validName(w[0] || '') ? w[0].slice(0, 20) : '');
}
async function askName() {
  if (askOpen || !uid() || !me || err || me.utente) return;
  askOpen = true;
  var full = '';
  try { var u = await S.call('/auth/v1/user', { user: true }), md = (u && u.user_metadata) || {}; full = String(md.full_name || md.name || ''); } catch (e) { if (window.nlErr) nlErr(e); }
  if (!uid() || me.utente) { askOpen = false; return; }
  var v = proposal(full) || proposal(me.nome || '') || proposal(NL.name() || '');
  var d = document.createElement('div'); d.className = 'nm-ask'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'nmAskH');
  /* grafica delle schede di benvenuto (Piero, 19/11/2026): fondo verde, iniziale e «Ciao, …», «Come ti chiami?» */
  d.innerHTML = '<form class="nm-box" id="nmAskF" novalidate><div class="nm-art" aria-hidden="true"><span class="nm-ini" id="nmAskI">' + esc((v.trim().charAt(0) || '?').toUpperCase()) + '</span>' +
    '<span class="nm-hi" id="nmAskC"' + (v ? '' : ' hidden') + '>Ciao, ' + esc(v) + '</span></div>' +
    '<h2 id="nmAskH">Come ti chiami?</h2><p class="nm-sub">È il nome con cui gli amici ti troveranno.</p>' +
    '<label class="nm-lab" for="nmAskU">Il tuo nome</label><input type="text" id="nmAskU" autocomplete="nickname" spellcheck="false" enterkeyhint="done" maxlength="20" required value="' + esc(v) + '">' +
    '<p class="nm-err" id="nmAskE" hidden></p>' +
    '<button class="nm-btn" type="submit" id="nmAskB">Continua</button></form>';
  document.body.appendChild(d);
  var inp = d.querySelector('#nmAskU'), eb = d.querySelector('#nmAskE'), btn = d.querySelector('#nmAskB');
  function bad(m) { eb.textContent = m; eb.hidden = false; btn.disabled = false; btn.textContent = 'Continua'; inp.focus(); }
  inp.addEventListener('input', function () { var t = tidy(inp.value), c = d.querySelector('#nmAskC'); d.querySelector('#nmAskI').textContent = (t.charAt(0) || '?').toUpperCase(); c.textContent = 'Ciao, ' + t; c.hidden = !t; });
  d.querySelector('#nmAskF').addEventListener('submit', async function (e) {
    e.preventDefault();
    var n = tidy(inp.value);
    if (!validName(n)) { bad(RULES); return; }
    btn.disabled = true; btn.textContent = 'Salvo…'; eb.hidden = true;
    try { await saveMine(n); d.remove(); askOpen = false; NL.toast('Nome salvato: ' + n + '.'); if (invite) await findInvite(); else paintAll(); }
    catch (x) { bad(nice(x)); }
  });
  setTimeout(function () { try { inp.focus(); inp.select(); } catch (e) { /* niente */ } }, 80);
}
S.onAuth && S.onAuth(function () { if (!uid()) { var o = document.querySelector('.nm-ask'); if (o) o.remove(); askOpen = false; } });

/* ---------- finestra «Amici» ---------- */
function sheet() {
  var el = document.getElementById('friSheet'); if (el) return el;
  el = document.createElement('div'); el.className = 'sheet fri'; el.id = 'friSheet'; el.hidden = true;
  el.innerHTML = '<div class="sheet-in" role="dialog" aria-modal="true" aria-labelledby="friH"><h2 id="friH">Amici</h2><div id="friBody"></div>' +
    '<div class="row-btns"><button class="btn" type="button" id="friClose">Chiudi</button></div></div>';
  document.body.appendChild(el);
  el.addEventListener('click', function (e) { if (e.target === el) close(); });
  el.querySelector('#friClose').addEventListener('click', close);
  el.addEventListener('click', onClick);
  el.addEventListener('submit', onSubmit);
  el.addEventListener('input', function (e) { if (e.target.id === 'friLibQ') { libsQ = e.target.value; libsShow = 30; var l = document.getElementById('friLibList'); if (l) l.innerHTML = libList(); } });
  el.addEventListener('change', async function (e) {
    if (e.target.name === 'friScr') {                        // Possono scrivermi (giro 9b): si scrive direttamente nel profilo
      var v = e.target.value, prev = me.scrivermi || 'amici_amici', boxes = el.querySelectorAll('input[name="friScr"]');
      Array.prototype.forEach.call(boxes, function (r) { r.disabled = true; });
      try { await S.call('/rest/v1/profili?on_conflict=id', { method: 'POST', user: true, prefer: 'resolution=merge-duplicates,return=minimal', body: { id: uid(), scrivermi: v } });
        me.scrivermi = v; NL.toast(v === 'tutti' ? 'Ora possono scriverti tutti (chi non è tuo amico con una richiesta).' : v === 'amici' ? 'Ora possono scriverti solo i tuoi amici.' : 'Ora possono scriverti i tuoi amici e gli amici dei tuoi amici.'); }
      catch (x) { Array.prototype.forEach.call(boxes, function (r) { r.checked = r.value === prev; }); NL.toast(nice(x)); }
      Array.prototype.forEach.call(boxes, function (r) { r.disabled = false; });
      return;
    }
    var k = { friWish: 'desideri', friLib: 'libreria', friAmici: 'amici', friRegali: 'regali', friPCit: 'p_cit', friPStat: 'p_stat', friPCits: 'p_cits', friPLet: 'p_let', friPPref: 'p_pref', friPCons: 'p_cons' }[e.target.id] || ''; if (!k) return;
    var on = e.target.checked, body = { id: uid() }; body[k] = on; e.target.disabled = true;
    try { await S.call('/rest/v1/profili?on_conflict=id', { method: 'POST', user: true, prefer: 'resolution=merge-duplicates,return=minimal', body: body });
      me[k] = on;
      NL.toast(k === 'p_let' ? (on ? 'Gli amici ora vedono cosa stai leggendo.' : 'Cosa stai leggendo ora è solo tuo.') : k === 'p_pref' ? (on ? 'Gli amici ora vedono i tuoi preferiti.' : 'I tuoi preferiti ora sono solo tuoi.') : k === 'p_cons' ? (on ? 'Gli amici ora vedono i libri che consigli.' : 'I libri che consigli ora non si vedono nel profilo.') : k === 'p_cit' ? (on ? 'Gli amici ora vedono le tue citazioni in evidenza.' : 'Le citazioni in evidenza ora sono solo tue.') : k === 'p_stat' ? (on ? 'Gli amici ora vedono i tuoi numeri.' : 'I tuoi numeri ora sono solo tuoi.') : k === 'p_cits' ? (on ? 'Gli amici ora vedono le tue citazioni.' : 'Le tue citazioni ora sono solo tue.') : k === 'regali' ? (on ? 'Gli amici ora vedono i regali che prenoti.' : 'Gli amici ora vedono solo «Regalo prenotato».') : k === 'desideri' ? (on ? 'I tuoi amici ora vedono i tuoi desideri.' : 'I tuoi desideri ora sono solo tuoi.') : k === 'amici' ? (on ? 'I tuoi amici ora vedono chi sono i tuoi amici.' : 'I tuoi amici ora vedono solo gli amici in comune.') : (on ? 'I tuoi amici ora vedono la tua libreria.' : 'La tua libreria ora è solo tua.'));
      if (on) S.run && S.run(false); NL.emit && NL.emit('privacy', k); }
    catch (x) { e.target.checked = !on; NL.toast(nice(x)); }
    e.target.disabled = false;
  });
  return el;
}
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var el = document.getElementById('friSheet'); if (el && !el.hidden) close(); } });
async function open(asOpts) {
  var el = sheet(); confirmId = ''; err = ''; editName = false; view = null; friQv = ''; wishes = null; opts = asOpts === true; ffOf = null; ff = null; el.hidden = false; paint();
  await load(true);
  if (invite && me && me.utente) await findInvite();
}
function close() { var el = document.getElementById('friSheet'); if (el) el.hidden = true; found = null; foundQ = ''; editName = false; view = null; wishes = null; opts = false; ffOf = null; ff = null; }
async function findInvite() {
  try { var r = await rpc('cerca_utenti', { q: invite }); found = (r || []).filter(function (x) { return (x.utente || '').toLowerCase() === invite.toLowerCase(); }); foundQ = invite; }
  catch (e) { err = nice(e); }
  if (found && !found.length) { err = 'Il link d\'invito è di «' + invite + '», ma non trovo nessuno con questo nome.'; invite = null; wr(K_INV, null); found = null; foundQ = ''; }
  paint();
}
function relBtn(x) {
  if (x.rel === 'amici') return '<span class="fr-tag">Amici</span>';
  if (x.rel === 'inviata') return '<span class="fr-tag">Richiesta inviata</span>';
  if (x.rel === 'ricevuta') return '<button class="btn primary" type="button" data-f="yes" data-id="' + esc(x.id) + '">Accetta</button>';
  return '<button class="btn primary" type="button" data-f="ask" data-u="' + esc(x.utente) + '"' + (busy === x.utente ? ' disabled' : '') + '>Chiedi l\'amicizia</button>';
}
/* «Scrivi» (giro 9b): apre la chat con questa persona; il database decide se si può (amico, richiesta, «Possono scrivermi») */
var I_CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z"/></svg>';
function chatBtn(x) { var n = x.utente || x.nome || ''; return window.NLChat && x.id && x.id !== uid() ? '<button class="ico ch-to" type="button" data-f="chat" data-id="' + esc(x.id) + '" data-u="' + esc(n) + '" title="Scrivi a ' + esc(n) + '" aria-label="Scrivi a ' + esc(n) + '">' + I_CHAT + '</button>' : ''; }
function row(x, btns) { return '<li class="fr-row"><span class="fr-who">' + nameOf(x) + '</span><span class="fr-act">' + btns + '</span></li>'; }
function nameForm(first) {
  var v = first ? tidy(NL.name()).slice(0, 20) : me.utente;
  return '<form id="friFormU" class="fr-form"><label class="field"><span>Il tuo nome</span><input type="text" id="friU" autocomplete="nickname" spellcheck="false" enterkeyhint="done" maxlength="20" required value="' + esc(v || '') + '"></label>' +
    '<p class="fr-small">Lo vedono i tuoi amici e chi riceve i libri che condividi; è lo stesso nome di «Libreria di …». ' + RULES + ' Deve essere diverso da quello degli altri.</p>' +
    (err ? '<p class="msg bad" id="friErr">' + esc(err) + '</p>' : '') +
    '<div class="row-btns">' + (first ? '' : '<button class="btn" type="button" data-f="name-no">Annulla</button>') + '<button class="btn primary" type="submit" id="friSaveU">Salva</button></div></form>';
}
function paint() {
  paintKw(); NL.emit && NL.emit('keys');
  var body = document.getElementById('friBody'); if (!body || document.getElementById('friSheet').hidden) return;
  document.getElementById('friH').textContent = ffOf ? 'Amici di ' + friendName(ffOf) : opts && !view ? 'Amici e privacy' : 'Amici';
  var h = '';
  if (!uid()) {
    h = '<p class="msg">' + (invite ? 'Ti ha invitato <b>' + esc(invite) + '</b>. ' : '') + 'Per avere amici serve l\'account: entra con Google, poi torna qui.</p>' +
      '<button class="btn primary" type="button" data-f="login">Entra con il tuo account</button>';
  } else if (!me) {
    h = '<p class="msg">' + (err ? esc(err) : 'Un momento…') + '</p>';
  } else if (!me.utente) {
    h = '<p class="msg">' + (invite ? 'Ti ha invitato <b>' + esc(invite) + '</b>. ' : '') + 'Prima scegli il nome con cui ti trovano gli amici.</p>' + nameForm(true);
  } else if (editName) {
    h = nameForm(false);
  } else if (ffOf) {
    h = ffView();
  } else if (opts) {
    h = optsView();
  } else if (view) {
    h = friendView();
  } else {
    var rec = received(), fr = friends(), se = sent();
    if (found && foundQ === invite && found.length) h += '<div class="fr-inv"><p class="fr-small">Ti ha invitato</p><ul class="fr-list">' + found.map(function (x) { return row(x, relBtn(x)); }).join('') + '</ul></div>';
    if (rec.length) h += '<section class="fr-sec"><h3 class="fr-h">Vogliono essere tuoi amici <span class="fr-n">' + rec.length + '</span></h3><ul class="fr-list">' + rec.map(function (x) {
      return row(x, '<button class="btn" type="button" data-f="no" data-id="' + esc(x.id) + '">Rifiuta</button><button class="btn primary" type="button" data-f="yes" data-id="' + esc(x.id) + '">Accetta</button>');
    }).join('') + '</ul></section>';
    var askIn = asks.filter(function (r) { return r.a === uid() && r.stato === 'attesa'; });
    if (askIn.length) h += '<section class="fr-sec"><h3 class="fr-h">Ti chiedono in prestito <span class="fr-n">' + askIn.length + '</span></h3><ul class="fr-list">' + askIn.map(function (r) {
      return '<li class="fr-row fr-book">' + cover(r.libro || {}) + '<span class="fr-bk"><b>' + esc((r.libro && r.libro.t) || 'un libro') + '</b><small>Lo chiede ' + esc(r.nome_da || 'un amico') + '</small></span><span class="fr-act"><button class="btn" type="button" data-f="askno" data-id="' + esc(r.id) + '">No</button><button class="btn primary" type="button" data-f="askyes" data-id="' + esc(r.id) + '">Presta</button></span></li>';
    }).join('') + '</ul></section>';
    h += '<section class="fr-sec"><h3 class="fr-h">I tuoi amici' + (fr.length ? ' <span class="fr-n">' + fr.length + '</span>' : '') + '</h3>';
    if (fr.length) h += '<input type="search" class="fr-libq" id="friFQ" data-pick-q placeholder="Cerca tra i tuoi amici" aria-label="Cerca tra i tuoi amici" autocomplete="off" enterkeyhint="search" value="' + esc(friQv) + '"><p class="fr-small" data-pick-none hidden>Nessun amico con questo nome.</p>';   // sempre, anche con pochi amici (Piero, 18/11/2026)
    h += fr.length ? '<ul class="fr-list fr-pick-list">' + fr.slice().sort(function (a, b) { return (a.utente || '').localeCompare(b.utente || '', 'it'); }).map(function (x) {
      var nn = nums[x.id] || {}, info = [];
      if (nn.comuni) info.push(nn.comuni + (nn.comuni === 1 ? ' amico' : ' amici'));   // niente zeri e «in comune» una volta sola: la riga sta su un telefono stretto (18/11/2026)
      if (nn.libri) info.push(nn.libri + (nn.libri === 1 ? ' libro' : ' libri'));
      if (info.length) info[info.length - 1] += ' in comune';
      return '<li class="fr-row fr-go fr-av">' + (window.NLProfilo ? window.NLProfilo.avatar(x.id, x.utente || x.nome) : '') + '<button class="fr-who fr-open" type="button" data-f="friend" data-id="' + esc(x.id) + '">' + nameOf(x) + '<small>' + esc(info.join(' · ') || 'Guarda il suo profilo') + '</small></button>' +
        chatBtn(x) + ('segue' in x ? '<button class="fr-fol" type="button" data-f="segui" data-id="' + esc(x.id) + '" aria-pressed="' + !!x.segue + '" title="' + (x.segue ? 'Segui i suoi desideri: tocca per smettere' : 'Segui i suoi desideri: un riassunto al giorno') + '">' + (x.segue ? 'Segui ✓' : 'Segui') + '</button>' : '') + '<span class="n" aria-hidden="true">›</span></li>';
    }).join('') + '</ul>' + (fr.some(function (x) { return 'segue' in x; }) ? '<p class="fr-small">«Segui»: un avviso al giorno quando aggiunge dei desideri, se li mostra agli amici. Non viene a saperlo.</p>' : '') : '<p class="fr-small">Ancora nessuno: cercalo per nome qui sotto, oppure mandagli il tuo invito.</p>';
    h += '</section>';
    h += '<section class="fr-sec"><h3 class="fr-h">Aggiungi un amico</h3><form id="friFormQ" class="fr-q"><input type="search" id="friQ" placeholder="Il suo nome" autocomplete="off" spellcheck="false" enterkeyhint="search" value="' + esc(foundQ && foundQ !== invite ? foundQ : '') + '"><button class="btn" type="submit">Cerca</button></form>';
    if (found && foundQ && foundQ !== invite) h += found.length ? '<ul class="fr-list">' + found.map(function (x) { return row(x, chatBtn(x) + relBtn(x)); }).join('') + '</ul>' : '<p class="fr-small">Nessuno con un nome così.</p>';
    if (found && found.some(function (x) { return !x.rel; })) h += '<label class="check fr-wish fr-segui"><input type="checkbox" id="friSegui"' + (askFollow ? ' checked' : '') + '><span>Segui i suoi desideri<small>Quando sarete amici: un avviso al giorno se ne aggiunge e li mostra. Non viene a saperlo.</small></span></label>';
    if (err) h += '<p class="msg bad" id="friErr">' + esc(err) + '</p>';
    h += '<button class="btn fr-invite" type="button" data-f="invite">Invita un amico</button></section>';
    if (se.length) h += '<section class="fr-sec"><h3 class="fr-h">Richieste che hai mandato</h3><ul class="fr-list">' + se.map(function (x) {
      return row(x, '<span class="fr-tag">In attesa</span><button class="link" type="button" data-f="drop" data-id="' + esc(x.id) + '">Annulla</button>');
    }).join('') + '</ul></section>';
    h += '<ul class="fr-list fr-box"><li class="fr-row fr-go"><button class="fr-who fr-open" type="button" data-f="opts">Impostazioni degli amici<small>Il tuo nome, chi vede cosa, API Google Libri</small></button><span class="n" aria-hidden="true">›</span></li></ul>';
  }
  body.innerHTML = h;
  var fq = document.getElementById('friFQ'); if (fq && friQv) pickFilter(fq);   // il giro di controllo ridisegna: la ricerca resta
}
async function onSubmit(e) {
  var f = e.target; e.preventDefault();
  if (f.id === 'friFormU') {
    var u = tidy(document.getElementById('friU').value);
    if (!validName(u)) { err = RULES; paint(); return; }
    var b = document.getElementById('friSaveU'); b.disabled = true; b.textContent = 'Salvo…';
    try { await saveMine(u); err = ''; editName = false; NL.toast('Nome salvato: ' + u + '.'); if (invite) await findInvite(); else paintAll(); }
    catch (x) { err = nice(x); paint(); var i = document.getElementById('friU'); if (i) { i.value = u; i.focus(); } }
  } else if (f.id === 'friFormQ') {
    var q = tidy(document.getElementById('friQ').value);
    if (q.length < 3) { found = null; foundQ = ''; err = 'Scrivi almeno 3 lettere del nome.'; paint(); return; }
    err = '';
    try { found = abc(await rpc('cerca_utenti', { q: q })); foundQ = q; } catch (x) { err = nice(x); }
    paint();
  }
}
async function onClick(e) {
  var b = e.target.closest && e.target.closest('[data-f]'); if (!b) return;
  var a = b.dataset.f, id = b.dataset.id;
  if (a === 'login') { close(); S.open(); return; }
  if (a === 'invite') { shareInvite(); return; }
  if (a === 'name') { editName = true; err = ''; paint(); var i = document.getElementById('friU'); if (i) i.focus(); return; }
  if (a === 'name-no') { editName = false; err = ''; paint(); return; }
  if (a === 'ask-drop') { confirmId = id; paint(); return; }
  if (a === 'opts') { opts = true; view = null; paint(); var si0 = document.querySelector('#friSheet .sheet-in'); if (si0) si0.scrollTop = 0; return; }
  if (a === 'optsback') { opts = false; paint(); return; }
  if (a === 'friend') { close(); if (window.NLProfilo && window.NLProfilo.open) window.NLProfilo.open(id); else openGuest(id); return; }   // il nome apre il profilo; da lì Libreria e Desideri (giro 6)
  if (a === 'chat') { close(); if (window.NLChat) { var cu = b.dataset.u; setTimeout(function () { window.NLChat.to(id, cu); }, 60); } return; }   // Scrivi (giro 9b)
  if (a === 'blocked') { if (window.NLChat) window.NLChat.blocked(); return; }
  if (a === 'keyshare') { keySheet(id); return; }
  if (a === 'keyask') { askKey(id, b); return; }   // «Chiedimela» (giro 12)
  if (a === 'keyuse' || a === 'keyoff') { keyAct(a, id); return; }
  if (a === 'askyes' || a === 'askno') { askAnswer(id, a === 'askyes'); return; }
  if (a === 'back') { view = null; wishes = null; libs = null; confirmId = ''; paint(); return; }
  if (a === 'more') { libsShow += 30; var l = document.getElementById('friLibList'); if (l) l.innerHTML = libList(); return; }
  if (a === 'cancel') { confirmId = ''; paint(); return; }
  if (a === 'segui') { follow(id, b.getAttribute('aria-pressed') !== 'true'); return; }
  b.disabled = true; err = '';
  try {
    if (a === 'ask') {
      busy = b.dataset.u;
      var fs = document.getElementById('friSegui'), st; askFollow = !!(fs && fs.checked);
      try { st = await rpc('chiedi_amicizia', askFollow ? { utente: b.dataset.u, segui: true } : { utente: b.dataset.u }); }
      catch (x0) { if (!askFollow || (x0 && x0.code === 'net')) throw x0; st = await rpc('chiedi_amicizia', { utente: b.dataset.u }); }   // database senza la 018
      NL.toast(st === 'amici' ? 'Ora siete amici.' : 'Richiesta mandata a ' + b.dataset.u + '.');
      if (invite && b.dataset.u.toLowerCase() === invite.toLowerCase()) { invite = null; wr(K_INV, null); }
      (found || []).forEach(function (x) { if (x.utente === b.dataset.u) x.rel = st === 'amici' ? 'amici' : 'inviata'; });
      ((ff && ff.amici) || []).forEach(function (x) { if (x.utente === b.dataset.u) x.rel = st === 'amici' ? 'amici' : 'inviata'; });
    } else if (a === 'yes' || a === 'no') {
      await rpc('rispondi_amicizia', { da: id, accetta: a === 'yes' });
      NL.toast(a === 'yes' ? 'Ora siete amici.' : 'Richiesta rifiutata.');
      (found || []).forEach(function (x) { if (x.id === id) x.rel = a === 'yes' ? 'amici' : ''; });
      ((ff && ff.amici) || []).forEach(function (x) { if (x.id === id) x.rel = a === 'yes' ? 'amici' : ''; });
    } else if (a === 'gift' || a === 'ungift') {
      try { await rpc('prenota_regalo', { amico: view, libro: id, si: a === 'gift' }); NL.toast(a === 'gift' ? 'Segnato: lo regali tu. ' + friendName(view) + ' non lo vede.' : 'Non lo regali più.'); }
      catch (x3) { NL.toast(/già prenotato/.test(x3.message) ? 'L\'ha già prenotato un altro amico.' : nice(x3)); }
      await loadWishes(); return;
    } else if (a === 'drop') {
      var x = (list || []).filter(function (y) { return y.id === id; })[0];
      await rpc('togli_amicizia', { altro: id }); confirmId = ''; if (view === id) { view = null; wishes = null; }
      NL.toast(x && x.stato === 'amici' ? 'Tolto dagli amici.' : 'Richiesta annullata.');
      (found || []).forEach(function (y) { if (y.id === id) y.rel = ''; });
    }
  } catch (x2) { err = nice(x2); }
  busy = '';
  await load(true);
}
/* seguire i desideri di un amico (giro 3): un riassunto al giorno, campanella e push; lui non lo sa */
var askFollow = false;
async function follow(id, on) {
  var x = (list || []).filter(function (y) { return y.id === id; })[0];
  try { await rpc('segui', { amico: id, si: !!on }); }
  catch (e) { NL.toast(nice(e)); return false; }
  if (x) x.segue = !!on;
  NL.toast(on ? 'Segui i desideri di ' + friendName(id) + ': un avviso al giorno, se ne aggiunge.' : 'Non segui più i desideri di ' + friendName(id) + '.');
  paint(); NL.emit && NL.emit('segui', id);
  return true;
}
async function shareInvite() {
  if (!uid() || !me || !me.utente) { open(); return; }
  var link = S.home() + '?amico=' + encodeURIComponent(me.utente);
  var text = 'Sono ' + me.utente + ' su Next Libris: aggiungimi tra gli amici. ' + link;
  if (navigator.share) { try { await navigator.share({ text: text }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(text); NL.toast('Link d\'invito copiato: incollalo in un messaggio.'); }
  catch (e) { NL.toast(link); }
}

/* ---------- parte «Amici» nel Menu, subito sotto Filtri, Suggerimenti, Statistiche ---------- */
function paintMenu() {
  var m = document.getElementById('friMenu');
  if (!m) {
    var top = document.querySelector('#drawerOpts .dmain'); if (!top) return;
    var h = document.createElement('h3'); h.id = 'friMenuH'; h.textContent = 'Amici';
    m = document.createElement('div'); m.className = 'dlist dmenu'; m.id = 'friMenu';
    m.innerHTML = '<button type="button" class="dopt dgo" id="goFri"><span><b>I tuoi amici</b><small id="goFriTxt"></small></span><span class="n" aria-hidden="true">›</span></button>';   // «Invita» sta nella finestra Amici (17/11/2026)
    var at = document.querySelector('#drawerOpts .ddon') || top;   // Sostieni sempre al centro, sopra Amici (Piero, 18/11/2026)
    at.parentNode.insertBefore(h, at.nextSibling); h.parentNode.insertBefore(m, h.nextSibling);
    m.querySelector('#goFri').addEventListener('click', function () { NL.fromMenu(open); });
    /* «Il mio profilo» sta in cima al Menu (giro 7, profilo.js) */
  }
  ownKeyIco();   // «API Google Libri» sotto «I tuoi amici» (18/11/2026)
  var t, rec = received().length, fr = friends().length;
  if (!uid()) t = 'Entra per trovare gli amici';
  else if (!me || !list) t = 'Richieste e amici';
  else if (!me.utente) t = 'Scegli il tuo nome';
  else t = (rec ? rec + (rec === 1 ? ' richiesta per te' : ' richieste per te') + ' · ' : '') + (fr ? fr + (fr === 1 ? ' amico' : ' amici') : 'Ancora nessun amico');
  document.getElementById('goFriTxt').textContent = t;
}
function paintAll() { paint(); paintMenu(); paintSet(); }
function paintSet() {
  var set = document.getElementById('setList'); if (!set) return;
  var b = document.getElementById('goFriOpt');
  if (!b) {
    var before = document.getElementById('goPush') || set.querySelector('.dopt[data-sec="search"]');   // dopo Account, prima di Notifiche (17/11/2026)
    b = document.createElement('button'); b.type = 'button'; b.id = 'goFriOpt'; b.className = 'dopt dgo';
    b.innerHTML = '<span><b>Amici e privacy</b><small>Nome, chi vede i tuoi libri</small></span><span class="n" aria-hidden="true">›</span>';
    set.insertBefore(b, before);
    b.addEventListener('click', function () { NL.fromMenu(function () { open(true); }); });
  }
}

/* ---------- link d'invito: …/?amico=Nome ---------- */
(function () {
  var q = new URLSearchParams(location.search), u = tidy(q.get('amico'));
  if (q.has('amico')) {
    q.delete('amico');
    try { history.replaceState(history.state, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); } catch (e) { if (window.nlErr) nlErr(e); }
    if (validName(u)) { wr(K_INV, u); setTimeout(open, 700); }
  }
  invite = rd(K_INV);
})();

/* ---------- pagina di un amico: i suoi desideri (se li mostra) e cosa c'è tra voi ---------- */
function friendName(id) { var x = (list || []).filter(function (y) { return y.id === id; })[0]; return x ? (x.utente || x.nome || 'Il tuo amico') : 'Il tuo amico'; }
async function openFriend(id) { var el = sheet(); el.hidden = false; view = id; confirmId = ''; err = ''; paint(); var si = document.querySelector('#friSheet .sheet-in'); if (si) si.scrollTop = 0; if (!list) await load(true); }
async function loadLibs() {
  var id = view; if (!id) return;
  try { var r = await rpc('libreria_di', { amico: id }); if (view === id) libs = r || { visibili: false, libri: [] }; }
  catch (e) { if (view === id) libs = { err: nice(e) }; }
  paint();
}
function libList() {
  var mine = {}; NL.books().forEach(function (b) { if (b.i && !b.w && !b.xs) mine[b.i] = 1; });
  var q = String(libsQ || '').trim().toLowerCase();
  var all = (libs && libs.libri || []).filter(function (x) { return !q || ((x.t || '') + ' ' + (x.a || '')).toLowerCase().indexOf(q) >= 0; });
  if (!all.length) return '<li class="fr-small">' + (q ? 'Nessun libro così.' : 'La sua libreria è vuota.') + '</li>';
  return all.slice(0, libsShow).map(function (x) {
    var w = NL.L && NL.L.rateWord ? NL.L.rateWord(x.rt) : '', st = x.rs === 'ok' ? 'Letto' + (w ? ' · ' + w : '') : x.rs === 'in' ? 'In lettura' : '';
    var both = x.i && mine[x.i] ? '<span class="fr-both">Ce l\'hai anche tu</span>' : '';
    return '<li class="fr-row fr-book">' + cover(x) + '<span class="fr-bk"><b>' + esc(x.t || (x.i ? 'ISBN ' + x.i : 'Senza titolo')) + '</b>' + (x.a ? '<small>' + esc(x.a) + '</small>' : '') +
      (st || both ? '<small class="fr-st">' + esc(st) + (st && both ? ' · ' : '') + both + '</small>' : '') + '</span></li>';
  }).join('') + (all.length > libsShow ? '<li class="fr-more"><button class="btn" type="button" data-f="more">Mostra altri ' + Math.min(30, all.length - libsShow) + ' (di ' + all.length + ')</button></li>' : '');
}
async function loadWishes() {
  var id = view; if (!id) return;
  try { var r = await rpc('desideri_di', { amico: id }); if (view === id) wishes = r || { visibili: false, libri: [] }; }
  catch (e) { if (view === id) wishes = { err: nice(e) }; }
  paint();
}
function cover(x) {
  return x.img && /^https:\/\//.test(x.img) ? '<img class="fr-cov" src="' + esc(x.img) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<span class="fr-cov ph" aria-hidden="true">' + esc((x.t || '?').charAt(0).toUpperCase()) + '</span>';
}
function friendView() {
  var x = (list || []).filter(function (y) { return y.id === view; })[0] || { id: view, utente: '?' }, n = nameOf(x), h = '';
  h += '<button class="link fr-back" type="button" data-f="back">‹ Amici</button><p class="fr-fname">' + n + '</p>';
  var tra = swaps.filter(function (s) { return (s.da === view || s.a === view) && (s.stato !== 'chiuso' || s.tipo === 'regalo'); });
  h += '<section class="fr-sec"><h3 class="fr-h">Tra voi</h3>';
  h += tra.length ? '<ul class="fr-list">' + tra.map(function (s) {
    var t = '«' + esc((s.libro && s.libro.t) || 'un libro') + '»', mio = s.da === uid();
    var txt = s.tipo === 'prestito' ? (mio ? 'Gli hai prestato ' + t : 'Ti ha prestato ' + t) + (s.stato === 'reso' ? ' · restituzione da confermare' : '') : (mio ? 'Gli hai regalato ' + t : 'Ti ha regalato ' + t);
    return '<li class="fr-row"><span class="fr-who fr-swap">' + txt + '<small>' + esc(L_date(s.creato)) + '</small></span></li>';
  }).join('') + '</ul>' : '<p class="fr-small">Nessun prestito o regalo in corso.</p>';
  h += '<p class="fr-small">Per prestargli o regalargli un libro: apri il libro › «Presta, vendi o regala» › scegli ' + n + '. Lo vedrà subito nella sua Libreria.</p></section>';
  /* API Google Libri: si presta da qui (l'icona nella sua libreria compare solo quando è prestata; Piero, 17/11/2026 notte) */
  var own = ownKeys(), ok = outKey(view);
  if (own.gb) h += '<section class="fr-sec"><h3 class="fr-h">API Google Libri</h3><div class="fr-row"><span class="fr-who">' + (ok ? esc(lentLabel(ok)) : 'Non la presti') + '</span>' +
    '<span class="fr-act"><button class="btn" type="button" data-f="keyshare" data-id="' + esc(view) + '">' + (ok ? 'Cambia' : 'Presta') + '</button></span></div></section>';
  h += '<button class="btn" type="button" data-f="friend" data-id="' + esc(view) + '">Guarda la sua libreria</button>';
  h += confirmId === view ? '<div class="fr-conf"><p>Togli <b>' + n + '</b> dagli amici?</p><div class="row-btns"><button class="btn" type="button" data-f="cancel">Annulla</button><button class="btn primary" type="button" data-f="drop" data-id="' + esc(view) + '">Togli</button></div></div>'
    : '<button class="link fr-drop" type="button" data-f="ask-drop" data-id="' + esc(view) + '">Togli dagli amici</button>';
  return h;
}
function L_date(t) { var d = new Date(t); return isNaN(d) ? '' : d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }); }

/* ---------- la libreria di un amico nella schermata principale (sola lettura: app.js, guestEnter) ---------- */
function snapG(x) { var o = {}; ['t', 'a', 'e', 'y', 'i', 'img', 'pg', 'gen', 'se', 'sn'].forEach(function (k) { if (x[k]) o[k] = x[k]; }); return o; }
async function openGuest(id) {
  if (!NL.guestEnter) return;
  var name = friendName(id);
  NL.toast('Apro la libreria di ' + name + '…');
  var lb, ws;
  try { var r = await Promise.all([rpc('libreria_di', { amico: id }), rpc('desideri_di', { amico: id })]); lb = r[0] || {}; ws = r[1] || {}; }
  catch (e) { NL.toast(nice(e)); return; }
  gMeta = {}; gId = id;
  var books = [];
  (lb.libri || []).forEach(function (x) { gMeta[x.id] = { fuori: !!x.fuori, w: false, mio: !!x.mio }; books.push(Object.assign(snapG(x), { id: x.id, rs: x.rs || '', rt: x.rt || 0, rd: x.rd || '', pp: x.pp || '', ts: Number(x.ts) || 0, w: false }, x.mio ? { sk: 'p', sda: 'te' } : {})); });   // mio: glielo hai prestato tu, si vede anche con la libreria nascosta (giro 3)
  (ws.libri || []).forEach(function (x) { gMeta[x.id] = { w: true, prenotato: x.prenotato || '', preso: !!(x.preso || x.prenotato) }; books.push(Object.assign(snapG(x), { id: x.id, ts: Number(x.ts) || 0, w: true })); });
  var info = { id: id, comuni: lb.comuni, libVis: !!lb.visibili, wishVis: !!ws.visibili, totale: lb.totale || 0,
    nMiei: (lb.libri || []).filter(function (x) { return x.mio; }).length,
    empty: { lib: lb.visibili ? name + ' non ha ancora libri nella sua libreria.' : name + ' non mostra la sua libreria agli amici.', wish: ws.visibili ? 'La sua lista dei desideri è vuota.' : name + ' non mostra i suoi desideri agli amici.' } };
  entering = true;   // passando da un amico all'altro l'uscita dal primo non deve azzerare gId e gMeta del secondo (17/11/2026)
  try { NL.guestEnter(name, books, info); } finally { entering = false; }
}
var entering = false;
function guestBar() {
  var g = NL.guest && NL.guest(), bar = document.getElementById('guestBar');
  if (g && NL.esempio && NL.esempio()) { if (bar) bar.hidden = true; return; }   // libreria di esempio della guida: la sua striscia la mette guida.js (giro 4)
  if (!g) { if (bar) bar.hidden = true; ownKeyIco(); return; }
  if (!bar) {
    var top = document.querySelector('header.top'); if (!top) return;
    bar = document.createElement('section'); bar.id = 'guestBar'; bar.className = 'guest-bar';
    top.parentNode.insertBefore(bar, top.nextSibling);
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('[data-g]'); if (!b) return;
      if (b.dataset.g === 'back') NL.guestExit();
      else if (b.dataset.g === 'notmine' || b.dataset.g === 'common') NL.setFlt(NL.flt() === b.dataset.g ? '' : b.dataset.g), guestBar();   // una esclude l'altra
      else if (b.dataset.g === 'more') openFriend(gId);
      else if (b.dataset.g === 'ff') openFF(gId);
      else if (b.dataset.g === 'key') keySheet(gId);
      else if (b.dataset.g === 'usekey') keyAct('keyuse', gId).then(guestBar);
      else if (b.dataset.g === 'tab') { if (NL.tab() !== b.dataset.t) { NL.setTab(b.dataset.t); window.scrollTo({ top: 0 }); } guestBar(); }
    });
  }
  bar.hidden = false;
  var all = NL.books(), lib = all.filter(function (b) { return !b.w; }), inComune = lib.filter(function (b) { return NL.isMine(b); }).length;
  var now = lib.filter(function (b) { return b.rs === 'in'; }).slice(0, 3);
  var last = lib.filter(function (b) { return b.rs === 'ok'; }).sort(function (a, b) { return (b.rd || '') > (a.rd || '') ? 1 : (b.rd || '') < (a.rd || '') ? -1 : (b.ts || 0) - (a.ts || 0); }).slice(0, 5);   // prima chi ha la data di lettura
  var info = (window.__guestInfo || {}), comuni = info.comuni != null ? info.comuni : ((nums[gId] || {}).comuni || 0);
  /* ordine (Piero, 17/11/2026 notte): amici e libri in comune, Sta leggendo, Letti di recente, poi i due tasti.
     Via «‹ La tua libreria»: si esce con Libreria/Desideri in basso o con Indietro. Via anche «Prestiti, regali e altro» (17/11/2026):
     prestiti e regali tra voi con l'icona ⇄ in alto a destra */
  var t = NL.tab(), nW = all.length - lib.length, gn = esc(NL.guest());
  var h = '<p class="gb-num"><button type="button" class="link gb-ff" data-g="ff">' + comuni + (comuni === 1 ? ' amico' : ' amici') + ' in comune</button> · ' + inComune + (inComune === 1 ? ' libro' : ' libri') + ' in comune</p>';
  if (now.length) h += '<p class="gb-line"><b>Sta leggendo</b> ' + now.map(function (b) {
    var tot = Number(b.pg) || 0, pp = Number(b.pp) || 0;
    return '«' + esc(b.t || 'senza titolo') + '»' + (pp ? ' <small>pagina ' + pp + (tot ? ' di ' + tot : '') + '</small>' : '');
  }).join(', ') + '</p>';
  if (last.length) h += '<p class="gb-line"><b>Letti di recente</b> ' + last.map(function (b) {
    var w = NL.L.rateWord ? NL.L.rateWord(b.rt) : ''; return '«' + esc(b.t || 'senza titolo') + '»' + (w ? ' <small>' + esc(w) + '</small>' : '');
  }).join(', ') + '</p>';
  if (info.libVis === false && info.nMiei && t !== 'wish') h += '<p class="gb-line gb-note">' + gn + ' non mostra la sua libreria: qui vedi solo ' + (info.nMiei === 1 ? 'il libro che ha' : 'i libri che ha') + ' in prestito da te.</p>';
  h += '<div class="tabs gb-tabs" role="tablist" aria-label="Libri di ' + gn + '"><button type="button" role="tab" data-g="tab" data-t="lib" aria-selected="' + (t !== 'wish') + '">Libreria <span class="cnt">' + lib.length + '</span></button>' +
    '<button type="button" role="tab" data-g="tab" data-t="wish" aria-selected="' + (t === 'wish') + '">Desideri <span class="cnt">' + nW + '</span></button></div>';
  var own = ownKeys(), out = outKey(gId), fromHim = keys.filter(function (k) { return k.a === uid() && k.da === gId; })[0], b0 = borrowed();
  h += '<div class="chips gb-chips">' + (lib.length && t !== 'wish' ? '<button type="button" class="chip todo" data-g="notmine" aria-pressed="' + (NL.flt() === 'notmine') + '">Solo quelli che non hai</button>' +
      (inComune ? '<button type="button" class="chip todo" data-g="common" aria-pressed="' + (NL.flt() === 'common') + '">In comune</button>' : '') : '') +
    (fromHim && !(b0 && b0.da === gId) ? '<button type="button" class="chip todo" data-g="usekey">Usa la sua API</button>' : '') + '</div>';
  bar.innerHTML = h;
}
/* «API Google Libri» nell'Indice, sotto «I tuoi amici» (18/11/2026); le icone nella vecchia testata non ci sono più (20/11/2026) */
function ownKeyIco() {
  var g = document.getElementById('goKeys');
  if (!g) {
    var fm = document.getElementById('friMenu'); if (!fm) return;
    g = document.createElement('button'); g.type = 'button'; g.className = 'dopt dgo'; g.id = 'goKeys';
    g.innerHTML = '<span><b>API Google Libri</b><small id="goKeysTxt"></small></span><span class="n" aria-hidden="true">›</span>';
    fm.appendChild(g); g.addEventListener('click', function () { NL.fromMenu(keyWin); });
  }
  var own = ownKeys(), b = borrowed(), on = !!(own.gb || (b && b.gb));
  document.getElementById('goKeysTxt').textContent = on ? (own.gb ? 'La tua, da prestare agli amici' : 'Prestata da un amico') : 'Crea la tua API, è gratis';
}
function okRefresh() { ownKeyIco(); }
NL.on('keys', okRefresh); NL.on('optclose', okRefresh);
NL.on('keys', declareKeys); NL.on('optclose', declareKeys);   // chiave messa o tolta: il sì/no arriva al server (giro 12)
NL.on('guest', function (name) { if (!name && entering) return; if (!name) { window.__guestInfo = null; } guestBar(); if (!name) { gId = null; gMeta = {}; load(true); } });
/* le info della libreria aperta (amici in comune): le passa openGuest prima di entrare */
var _enter = NL.guestEnter;
if (_enter) NL.guestEnter = function (name, books, info) { window.__guestInfo = info; var r = _enter(name, books, info); guestBar(); return r; };
/* sulla scheda di un suo libro: Aggiungi ai miei desideri / Ce l'hai anche tu / Me lo presti? / Te lo regalo io */
function guestActs(el) {
  if (!(NL.guest && NL.guest()) || (NL.esempio && NL.esempio())) return;
  var cards = el.matches && el.matches('.row.open') ? [el] : Array.prototype.slice.call(el.querySelectorAll ? el.querySelectorAll('.row.open') : []);
  cards.forEach(function (card) {
    var id = card.dataset.id, b = NL.get(id), m = gMeta[id] || {}; if (!b) return;
    var old = card.querySelector('.cv-guest'); if (old) old.remove();
    var oldW = card.querySelector('.g-wish'); if (oldW) oldW.remove();
    card.classList.toggle('g-noread', !b.rs && !b.rt);   // non l'ha segnato: la striscia della lettura non serve
    var have = NL.isMine(b), inWish = mine().some(function (x) { return x.w && ((x.i && x.i === b.i) || (x.t && x.t === b.t)); });
    var ask = asks.filter(function (r) { return r.da === uid() && r.a === gId && r.libro_id === id && r.stato === 'attesa'; })[0];
    /* «Aggiungi ai miei desideri»: icona in alto, dove nei tuoi Desideri c'è «Libreria» (Piero, 17/11/2026); accesa se ce l'hai già, tocco = la togli */
    var top = card.querySelector('.acts-main');
    if (top && !have) {
      var wb = document.createElement('button'); wb.type = 'button'; wb.className = 'ico act move g-wish' + (inWish ? ' on' : ''); wb.dataset.g = inWish ? 'unwish' : 'addwish';
      wb.title = inWish ? 'È nei tuoi desideri: tocca per toglierlo' : 'Aggiungi ai miei desideri'; wb.setAttribute('aria-label', wb.title); wb.setAttribute('aria-pressed', inWish ? 'true' : 'false');
      wb.innerHTML = NL.icon('towish') + '<span class="al" aria-hidden="true">' + (inWish ? 'Nei desideri' : 'Desideri') + '</span>';
      wb.addEventListener('click', function (e) { e.stopPropagation(); guestAct(wb, id); });
      top.insertBefore(wb, top.firstChild);
    }
    var h = '<p class="cvg-h">' + (m.w ? 'Desiderio di ' : 'Di ') + esc(NL.guest()) + '</p><div class="cvg-row">';
    if (have && !m.mio) h += '<span class="fr-tag fr-mine">Ce l\'hai anche tu</span>';
    if (m.mio) h += '<span class="fr-tag fr-mine">Glielo hai prestato tu</span>';
    else if (!m.w) h += m.fuori ? '<span class="fr-tag">Adesso è in prestito</span>' : ask ? '<span class="fr-tag">Richiesta mandata</span><button type="button" class="link" data-g="unask" data-r="' + esc(ask.id) + '">Annulla</button>' : '<button type="button" class="btn primary" data-g="ask">Me lo presti?</button>';
    if (m.w) h += m.prenotato === 'io' ? '<span class="fr-tag fr-mine">Lo regali tu</span><button type="button" class="link" data-g="ungift">Annulla</button>' : m.prenotato ? '<span class="fr-tag">Lo regala ' + esc(m.prenotato) + '</span>' : m.preso ? '<span class="fr-tag">Regalo prenotato</span>' : '<button type="button" class="btn primary" data-g="gift">Te lo regalo io</button>';
    h += '</div>' + (m.w && (m.prenotato === 'io' || !m.preso) ? '<p class="fr-small">' + esc(NL.guest()) + ' non vede chi gli farà un regalo; ' + (me && me.regali === false ? 'gli altri amici vedono solo «Regalo prenotato».' : 'gli altri amici vedono il tuo nome.') + '</p>' : '');
    var box = document.createElement('div'); box.className = 'cv-guest'; box.innerHTML = h;
    box.addEventListener('click', function (e) { e.stopPropagation(); var x = e.target.closest('[data-g]'); if (x) guestAct(x, id); });
    card.appendChild(box);
  });
}
async function guestAct(x, id) {
  var b = NL.get(id), m = gMeta[id] || {}, a = x.dataset.g, name = NL.guest(); if (!b) return;
  x.disabled = true;
  try {
    if (a === 'addwish') { NL.addMine(Object.assign(snapG(b), { w: true, fr: name })); NL.toast('Aggiunto ai tuoi desideri.'); }
    else if (a === 'unwish') {
      var gone = mine().filter(function (y) { return y.w && ((y.i && y.i === b.i) || (y.t && y.t === b.t)); });
      gone.forEach(function (y) { NL.removeMine(y.id); });
      NL.toast('Tolto dai tuoi desideri.', { label: 'Annulla', fn: function () { gone.forEach(function (y) { NL.restoreMine(y); }); NL.refreshRow(id); } });
    }
    else if (a === 'ask') { await rpc('chiedi_prestito', { amico: gId, libro_id: id }); asks = (await rpc('mie_richieste')) || []; NL.toast('Richiesta mandata a ' + name + '.'); }
    else if (a === 'unask') { await rpc('annulla_richiesta', { id: x.dataset.r }); asks = (await rpc('mie_richieste')) || []; NL.toast('Richiesta annullata.'); }
    else if (a === 'gift' || a === 'ungift') { await rpc('prenota_regalo', { amico: gId, libro: id, si: a === 'gift' }); m.prenotato = a === 'gift' ? 'io' : ''; m.preso = a === 'gift'; NL.toast(a === 'gift' ? 'Segnato: lo regali tu. ' + name + ' non lo vede.' : 'Non lo regali più.'); }
  } catch (e) { NL.toast(/già prenotato/.test(e.message) ? 'L\'ha già prenotato un altro amico.' : nice(e)); }
  NL.refreshRow(id); guestBar();
}
NL.on('rows', function (el) { guestActs(el); whoActs(el); });

/* ---------- «Me lo presti?»: chi ha il libro risponde ---------- */
async function askAnswer(rid, yes) {
  var r = asks.filter(function (x) { return x.id === rid; })[0]; if (!r) return;
  try {
    if (yes) {
      var b = myGet(r.libro_id);
      if (!b) { NL.toast('Non trovo più questo libro nella tua libreria.'); return; }
      if (b.p) { NL.toast('È già in prestito ' + aChi(b.p) + '.'); return; }
      var f = (list || []).filter(function (x) { return x.id === r.da; })[0];
      b.p = (f && f.utente) || r.nome_da || 'un amico'; b.pd = NL.today(); NL.save(); NL.refresh();
      await rpc('rispondi_richiesta', { id: rid, si: true });
      await sendSwap(b.id, 'p', b.p, { p: '' });
    } else { await rpc('rispondi_richiesta', { id: rid, si: false }); NL.toast('Va bene: ' + (r.nome_da || 'il tuo amico') + ' saprà che ora non puoi.'); }
  } catch (e) { NL.toast(nice(e)); }
  await load(true);
}
function seenAnswers() { paintAsk(); }   // le risposte a «Me lo presti?» arrivano nella campanella
function paintAsk() {
  var r = asks.filter(function (x) { return x.a === uid() && x.stato === 'attesa'; }), box = document.getElementById('friAsk');
  if (!box) {
    if (!r.length) return;
    var anchor = document.getElementById('nxBox') || document.getElementById('donAsk') || document.getElementById('list'); if (!anchor) return;
    box = document.createElement('section'); box.id = 'friAsk'; box.className = 'fri-note fri-ret lay-note lay-first'; box.hidden = true;
    box.innerHTML = '<div class="fn-open"><span class="fn-ico" aria-hidden="true">' + ICON + '</span><span class="fn-t"><b id="friAskT"></b><small>Te lo chiede in prestito</small></span></div>' +
      '<div class="fn-acts"><button type="button" class="fn-go" id="friAskNo">No</button><button type="button" class="fn-go fn-yes" id="friAskYes">Presta</button></div>';
    anchor.parentNode.insertBefore(box, anchor);
    box.addEventListener('click', function (e) { var y = e.target.closest('#friAskYes'), n = e.target.closest('#friAskNo'); if (y || n) { e.target.disabled = true; askAnswer(box.dataset.id, !!y); } });
  }
  box.hidden = !r.length; if (!r.length) return;
  box.dataset.id = r[0].id;
  document.getElementById('friAskT').textContent = (r[0].nome_da || 'Un amico') + ': «' + ((r[0].libro && r[0].libro.t) || 'un libro') + '»';
}

/* ---------- consigli (giro 9d): dalla finestra Condividi, ad amici e gruppi; arrivano solo in chat ---------- */
var shareSel = {}, shareGrp = {};
function chatGroups() { var C = window.NLChat; return C && C.state ? (C.state().chats || []).filter(function (c) { return c.tipo === 'gruppo' && c.stato !== 'chiusa'; }) : []; }
function paintShareFriends(books, again) {
  var sh = document.getElementById('shareSheet'), form = document.getElementById('shareForm'); if (!sh || !form) return;
  var fr = uid() ? friends() : [], grs = uid() ? chatGroups() : [], one = books && books.length === 1 ? books[0] : null, app = !!(one && (fr.length || grs.length));
  if (!again && one && uid() && window.NLChat && window.NLChat.groups) window.NLChat.groups().then(function (g) { if (g.length !== grs.length && !sh.hidden) paintShareFriends(books, true); });
  var box = document.getElementById('shareFriBox'), ext = document.getElementById('shareExt');
  if (!box) {
    if (!app) return;
    box = document.createElement('section'); box.id = 'shareFriBox'; box.className = 'share-app';
    var at = document.getElementById('shareWhat'); at.parentNode.insertBefore(box, at.nextSibling);
    ext = document.createElement('details'); ext.id = 'shareExt'; ext.className = 'share-ext';
    ext.innerHTML = '<summary>Oppure manda un link (WhatsApp, email…)</summary>';
    var nodes = [document.getElementById('shareTitleBox'), document.getElementById('shareName').closest('label'), document.getElementById('sharePrev'), form.querySelector('.row-btns'), form.querySelector('.hint')].filter(Boolean);
    box.parentNode.insertBefore(ext, box.nextSibling);
    nodes.forEach(function (n) { ext.appendChild(n); });
    var cl = document.createElement('button'); cl.type = 'button'; cl.className = 'btn share-close'; cl.id = 'shareAppClose'; cl.textContent = 'Chiudi';
    cl.addEventListener('click', function () { document.getElementById('shareClose').click(); });
    form.appendChild(cl);
    box.addEventListener('click', async function (e) {
      var r = e.target.closest('[data-share]'), g = e.target.closest('[data-shareg]');
      if (r) { var id = r.dataset.share; shareSel[id] = !shareSel[id]; r.setAttribute('aria-pressed', shareSel[id] ? 'true' : 'false'); goBtn(); return; }
      if (g) { var gid = g.dataset.shareg; shareGrp[gid] = !shareGrp[gid]; g.setAttribute('aria-pressed', shareGrp[gid] ? 'true' : 'false'); goBtn(); return; }
      if (!e.target.closest('#shareAppGo') || !box.__b || !window.NLChat) return;
      var ids = picked(shareSel), gids = picked(shareGrp); if (!ids.length && !gids.length) return;
      var go = document.getElementById('shareAppGo'), t = document.getElementById('shareTipTxt'); go.disabled = true; go.textContent = 'Mando…';
      var res = await window.NLChat.recommend(box.__b, ids, gids, t ? t.value.trim() : '');
      if (res.err) NL.toast(res.err);
      if (res.ok) {
        var n = ids.length + gids.length;
        NL.toast(n === 1 ? 'Consigliato ' + (ids.length ? aChi(friendName(ids[0])) : 'nel gruppo') + ': lo trova nella chat.' : 'Consigliato in ' + res.ok + ' chat: lo trovano lì.');
        document.getElementById('shareClose').click();
      } else goBtn();
    });
  }
  function picked(o) { return Object.keys(o).filter(function (k) { return o[k]; }); }
  function goBtn() { var n = picked(shareSel).length + picked(shareGrp).length, g = document.getElementById('shareAppGo'); if (!g) return; g.disabled = !n; g.textContent = n > 1 ? 'Consiglia (' + n + ')' : 'Consiglia'; }
  box.hidden = !app; document.getElementById('shareAppClose').hidden = !app;
  ext.open = !app; ext.classList.toggle('only', !app);
  if (!app) return;
  var txt = again && document.getElementById('shareTipTxt') ? document.getElementById('shareTipTxt').value : '';
  if (!again) { shareSel = {}; shareGrp = {}; }
  box.__b = one;
  var gAv = window.NLChat && window.NLChat.grpAv;
  box.innerHTML = '<h3 class="fr-h">Consiglialo</h3><p class="fr-small">Arriva nella chat con l\'amico o nel gruppo che scegli: niente link da mandare.</p>' +
    (fr.length ? (grs.length ? '<p class="share-sub">Amici</p>' : '') + pickerHTML(fr, 'data-share', function (x) { return !!shareSel[x.id]; }, null) : '') +
    (grs.length ? '<p class="share-sub">Gruppi</p><div class="fr-pick"><div class="fr-pick-list" role="list">' + grs.slice().sort(function (a, b) { return (a.nome || '').localeCompare(b.nome || '', 'it'); }).map(function (c) {
      return '<button type="button" class="fr-pick-row" data-shareg="' + esc(c.id) + '" aria-pressed="' + (shareGrp[c.id] ? 'true' : 'false') + '">' + (gAv ? gAv(c.nome) : '') + '<span class="fr-pick-n">' + esc(c.nome || 'Gruppo') + (c.membri ? '<small>' + c.membri + ' persone</small>' : '') + '</span><span class="fr-pick-c" aria-hidden="true"></span></button>';
    }).join('') + '</div></div>' : '') +
    '<textarea id="shareTipTxt" class="share-tip" rows="2" maxlength="1000" placeholder="Due righe sul perché (facoltativo)" aria-label="Due righe sul perché"></textarea>' +
    '<button class="btn primary" type="button" id="shareAppGo" disabled>Consiglia</button>';
  document.getElementById('shareTipTxt').value = txt;
  goBtn();
}
NL.on('share', function (ev) { paintShareFriends(ev && ev.books); });

/* ---------- chi ce l'ha tra i tuoi amici: nella scheda di un tuo desiderio ---------- */
async function loadWho() {
  var isbns = mine().filter(function (b) { return b.w && b.i; }).map(function (b) { return b.i; }).slice(0, 300);
  who = {};
  if (!isbns.length) return;
  var r = (await rpc('chi_ce_lha', { isbn: isbns })) || [];
  r.forEach(function (x) { (who[x.isbn] = who[x.isbn] || []).push(x); });
}
function whoActs(el) {
  if (NL.guest && NL.guest()) return;
  var cards = el.matches && el.matches('.row.open') ? [el] : Array.prototype.slice.call(el.querySelectorAll ? el.querySelectorAll('.row.open') : []);
  cards.forEach(function (card) {
    var b = NL.get(card.dataset.id); if (!b || !b.w || !b.i || !who[b.i]) return;
    var old = card.querySelector('.cv-who'); if (old) old.remove();
    var box = document.createElement('div'); box.className = 'cv-guest cv-who';
    box.innerHTML = '<p class="cvg-h">Ce l\'hanno i tuoi amici</p>' + who[b.i].map(function (x) {
      var ask = asks.filter(function (r) { return r.da === uid() && r.a === x.amico && r.libro_id === x.libro_id && r.stato === 'attesa'; })[0];
      return '<div class="cvg-row"><b>' + esc(x.utente) + '</b>' + chatBtn({ id: x.amico, utente: x.utente }) + (x.fuori ? '<span class="fr-tag">Adesso è in prestito</span>' : ask ? '<span class="fr-tag">Richiesta mandata</span>' : '<button type="button" class="btn primary" data-w="' + esc(x.amico) + '" data-l="' + esc(x.libro_id) + '">Me lo presti?</button>') + '</div>';
    }).join('');
    box.addEventListener('click', async function (e) {
      e.stopPropagation();
      var c = e.target.closest('[data-f="chat"]'); if (c) { if (window.NLChat) window.NLChat.to(c.dataset.id, c.dataset.u); return; }   // Scrivi (giro 9b)
      var x = e.target.closest('[data-w]'); if (!x) return; x.disabled = true;
      try { await rpc('chiedi_prestito', { amico: x.dataset.w, libro_id: x.dataset.l }); asks = (await rpc('mie_richieste')) || []; NL.toast('Richiesta mandata.'); }
      catch (y) { NL.toast(nice(y)); }
      NL.refreshRow(card.dataset.id);
    });
    card.appendChild(box);
  });
}

/* ---------- «Ce l'ha già Marta» (giro 6): aggiungi un desiderio e un amico che mostra la libreria ha già quel libro.
   Avvisa soltanto: il libro resta nei Desideri. Stesso libro = stesso ISBN, oppure stesso titolo e autore (lo decide il database, chi_ha). ---------- */
var wishSeen = null, wishWait = {}, wishT = 0;
function wishList() { return mine().filter(function (b) { return b.w; }); }
function wishBase() { wishSeen = {}; wishList().forEach(function (b) { wishSeen[b.id] = 1; }); }
try { wishBase(); } catch (e) { wishSeen = null; }
function wishCheck() {
  if (!wishSeen) { wishBase(); return; }
  var now = Date.now(), ospite = !!(NL.guest && NL.guest());
  wishList().forEach(function (b) {
    if (wishSeen[b.id]) return;
    wishSeen[b.id] = 1;
    if (!ospite && now - (Number(b.ts) || 0) < 600000) wishWait[b.id] = now;      // solo i desideri appena aggiunti, non quelli presi dalla libreria di un amico
  });
  if (!uid() || !list || !list.some(function (x) { return x.stato === 'amici'; })) { wishWait = {}; return; }
  var ids = Object.keys(wishWait); if (!ids.length) return;
  if (ids.length > 3) { wishWait = {}; return; }                                   // tanti insieme: arrivano da un altro telefono o da un file
  var again = false;
  ids.forEach(function (id) {
    var b = NL.get(id);
    if (!b || !b.w) { delete wishWait[id]; return; }
    if (!b.t && now - wishWait[id] < 20000) { again = true; return; }             // sta ancora cercando il titolo: aspetto un po'
    delete wishWait[id];
    if (b.t || b.i) wishAsk(b);
  });
  if (again) { clearTimeout(wishT); wishT = setTimeout(wishCheck, 5000); }
}
async function wishAsk(b) {
  var r;
  try { r = (await rpc('chi_ha', { titolo: b.t || '', autore: b.a || '', isbn: b.i || '' })) || []; } catch (e) { return; }   // senza rete o database senza la 019: niente avviso
  var by = {}, nomi = [];
  r.forEach(function (x) { if (!by[x.amico]) { by[x.amico] = x; nomi.push(x.utente || 'un amico'); } });
  if (!nomi.length || !NL.get(b.id) || !NL.get(b.id).w) return;
  if (nomi.length === 1) {
    var x = r[0], gia = asks.some(function (q) { return q.da === uid() && q.a === x.amico && q.libro_id === x.libro_id && q.stato === 'attesa'; });
    NL.toast('Ce l\'ha già ' + nomi[0] + (x.fuori ? ' (adesso è in prestito)' : '') + '. Resta nei tuoi Desideri.', x.fuori || gia ? undefined : { label: 'Me lo presti?', fn: async function () {
      try { await rpc('chiedi_prestito', { amico: x.amico, libro_id: x.libro_id }); asks = (await rpc('mie_richieste')) || []; NL.toast('Richiesta mandata a ' + nomi[0] + '.'); } catch (e) { NL.toast(nice(e)); }
    }  }, 6000);
  } else NL.toast('Ce l\'hanno già ' + nomi[0] + ' e ' + (nomi.length === 2 ? nomi[1] : 'altri ' + (nomi.length - 1) + ' amici') + '. Resta nei tuoi Desideri.');
}
NL.on('saved', function () { clearTimeout(wishT); wishT = setTimeout(wishCheck, 1500); });

/* ---------- Impostazioni degli amici: nome, chi vede cosa, API ---------- */
function optsView() {
  var h = '<button class="link fr-back" type="button" data-f="optsback">‹ Amici</button>';
  h += '<div class="fr-me"><span class="fr-me-n"><small>Il tuo nome</small><b>' + esc(me.utente) + '</b></span><button class="link" type="button" data-f="name">Cambia</button></div>';
  h += '<section class="fr-sec"><h3 class="fr-h">Chi vede cosa</h3><div class="fr-share"><label class="check fr-wish"><input type="checkbox" id="friLib"' + (me.libreria ? ' checked' : '') + '><span>Gli amici vedono la mia libreria<small>Titolo, autore, copertina, genere, editore, anno, pagine, serie, lettura e voto. Note, citazioni, appunti, prezzi, scaffali e prestiti restano tuoi.</small></span></label>' +
    '<label class="check fr-wish"><input type="checkbox" id="friWish"' + (me.desideri ? ' checked' : '') + '><span>Gli amici vedono i miei desideri<small>Così sanno cosa regalarti; chi ti farà un regalo resta una sorpresa.</small></span></label>' +
    '<label class="check fr-wish"><input type="checkbox" id="friRegali"' + (me.regali !== false ? ' checked' : '') + '><span>Gli amici vedono i regali che prenoto<small>Quando dici «Te lo regalo io», gli altri amici vedono il tuo nome. Se la togli vedono solo «Regalo prenotato». Il festeggiato non lo vede mai.</small></span></label>' +
    '<label class="check fr-wish"><input type="checkbox" id="friAmici"' + (me.amici !== false ? ' checked' : '') + '><span>Gli amici vedono i miei amici<small>Solo i nomi, così trovate altri amici e possono chiedervi l\'amicizia. Se la togli, vedono solo gli amici che avete in comune.</small></span></label></div></section>';
  if ('p_cit' in me) h += '<section class="fr-sec"><h3 class="fr-h">Nel tuo profilo</h3><div class="fr-share"><p class="fr-small">La tua foto la vedono solo gli amici. Il resto è acceso di partenza, tranne tutte le citazioni: togli quello che non vuoi mostrare.</p>' +
    ('p_let' in me ? '<label class="check fr-wish"><input type="checkbox" id="friPLet"' + (me.p_let !== false ? ' checked' : '') + '><span>Gli amici vedono cosa sto leggendo<small>I libri «In lettura». Solo se vedono anche la libreria.</small></span></label>' +
    '<label class="check fr-wish"><input type="checkbox" id="friPCons"' + (me.p_cons !== false ? ' checked' : '') + '><span>Gli amici vedono i libri che consiglio<small>Quelli con la stella «Lo consiglio». Solo se vedono anche la libreria.</small></span></label>' : '') +
    '<label class="check fr-wish"><input type="checkbox" id="friPCit"' + (me.p_cit ? ' checked' : '') + '><span>Gli amici vedono le mie citazioni in evidenza<small>Quelle con la puntina (fino a 3), con titolo e autore del libro.</small></span></label>' +
    '<label class="check fr-wish"><input type="checkbox" id="friPStat"' + (me.p_stat ? ' checked' : '') + '><span>Gli amici vedono i miei numeri<small>Libri e pagine lette, autore e genere più letti, paesi, libri prestati. Solo se vedono anche la libreria.</small></span></label>' +
    '<label class="check fr-wish"><input type="checkbox" id="friPCits"' + (me.p_cits ? ' checked' : '') + '><span>Gli amici vedono tutte le mie citazioni<small>Il testo, la pagina e il libro. Mai gli appunti né le foto delle pagine.</small></span></label></div></section>';
  if ('scrivermi' in me && window.NLChat) {                 // chat (giro 9b): chi può scrivermi; di partenza gli amici degli amici
    var sc = me.scrivermi || 'amici_amici';
    h += '<section class="fr-sec"><h3 class="fr-h">Chat</h3><fieldset class="choice fr-scr"><legend>Possono scrivermi</legend>' +
      [['tutti', 'Tutti', 'Chi non è tuo amico ti manda prima una richiesta: decidi tu se accettarla.'], ['amici_amici', 'Gli amici dei miei amici', 'Anche loro con una richiesta. È la scelta di partenza.'], ['amici', 'Solo i miei amici', '']].map(function (o) {
        return '<label class="check"><input type="radio" name="friScr" value="' + o[0] + '"' + (sc === o[0] ? ' checked' : '') + '><span>' + o[1] + (o[2] ? '<small>' + o[2] + '</small>' : '') + '</span></label>';
      }).join('') + '</fieldset>' +
      '<ul class="fr-list fr-box"><li class="fr-row fr-go"><button class="fr-who fr-open" type="button" data-f="blocked">Persone bloccate<small>Non ti trovano e non possono scriverti</small></button><span class="n" aria-hidden="true">›</span></li></ul></section>';
  }
  h += keysHTML(true);
  h += '<p class="fr-small">Gli altri vedono solo il tuo nome. Il resto, solo se lo scegli qui.</p>';
  return h;
}
/* ---------- gli amici dell'amico (Piero, 17/11/2026): dai suoi «amici in comune»; quelli in comune in cima, gli altri se lui lo permette ---------- */
async function openFF(id) {
  var el = sheet(); confirmId = ''; err = ''; editName = false; view = null; opts = false; ffOf = id; ff = null; found = null; foundQ = '';
  el.hidden = false; paint(); var si = document.querySelector('#friSheet .sheet-in'); if (si) si.scrollTop = 0;
  if (!list) await load(true);
  await loadFF();
}
async function loadFF() {
  var id = ffOf; if (!id) return;
  try {
    var r = await rpc('amici_di', { amico: id }); if (ffOf === id) ff = r ? Object.assign({}, r, { amici: abc(r.amici) }) : { visibili: false, amici: [] };
    var nc = ((r && r.amici) || []).filter(function (x) { return x.comune; }).length, gi = window.__guestInfo;   // stesso numero nella striscia e nell'elenco
    if (gi && gi.id === id && gi.comuni !== nc) { gi.comuni = nc; guestBar(); }
  }
  catch (e) { if (ffOf === id) ff = { err: /amici_di|PGRST202|404/.test(String(e && e.message) + (e && e.code)) ? 'Non disponibile in questa versione.' : nice(e) }; }
  paint();
}
function ffView() {
  var n = friendName(ffOf), h = '';
  if (!ff) return '<p class="fr-small">Un momento…</p>';
  if (ff.err) return '<p class="msg bad">' + esc(ff.err) + '</p>';
  var all = (ff.amici || []).map(function (x) { var y = (found || []).filter(function (f) { return f.id === x.id; })[0]; return y ? Object.assign({}, x, { rel: y.rel }) : x; });
  var com = all.filter(function (x) { return x.comune; }), oth = all.filter(function (x) { return !x.comune; });
  h += '<section class="fr-sec"><h3 class="fr-h">In comune' + (com.length ? ' <span class="fr-n">' + com.length + '</span>' : '') + '</h3>';
  h += com.length ? '<ul class="fr-list fr-box">' + com.map(function (x) {
    return '<li class="fr-row fr-go"><button class="fr-who fr-open" type="button" data-f="friend" data-id="' + esc(x.id) + '">' + nameOf(x) + '<small>' + (window.NLProfilo ? 'Guarda il suo profilo' : 'Guarda la sua libreria') + '</small></button><span class="n" aria-hidden="true">›</span></li>';
  }).join('') + '</ul>' : '<p class="fr-small">Nessun amico in comune.</p>';
  h += '</section>';
  if (ff.visibili) {
    h += '<section class="fr-sec"><h3 class="fr-h">Altri amici di ' + esc(n) + (oth.length ? ' <span class="fr-n">' + oth.length + '</span>' : '') + '</h3>';
    if (oth.length > 8) h += '<input type="search" class="fr-libq" data-pick-q placeholder="Cerca tra i suoi amici" autocomplete="off" enterkeyhint="search">';
    h += oth.length ? '<ul class="fr-list">' + oth.map(function (x) { return row(x, chatBtn(x) + relBtn(x)); }).join('') + '</ul>' : '<p class="fr-small">Nessun altro.</p>';
    h += '</section>';
  } else h += '<p class="fr-small">' + esc(n) + ' mostra solo gli amici che avete in comune.</p>';
  if (err) h += '<p class="msg bad" id="friErr">' + esc(err) + '</p>';
  return h;
}
/* elenco di amici da scegliere, con la ricerca quando sono tanti (al posto delle pillole: regge anche 20-30 amici) */
function pickerHTML(items, attr, pressed, info) {
  return '<div class="fr-pick">' + (items.length > 8 ? '<input type="search" class="fr-libq" data-pick-q placeholder="Cerca tra i tuoi amici" autocomplete="off" enterkeyhint="search">' : '') +
    '<div class="fr-pick-list" role="list">' + items.slice().sort(function (a, b) { return (a.utente || '').localeCompare(b.utente || '', 'it'); }).map(function (x) {
      var i = info ? info(x) : '';
      return '<button type="button" class="fr-pick-row" ' + attr + '="' + esc(x.id) + '" aria-pressed="' + (pressed(x) ? 'true' : 'false') + '"><span class="fr-pick-n">' + esc(x.utente) + (i ? '<small>' + esc(i) + '</small>' : '') + '</span><span class="fr-pick-c" aria-hidden="true"></span></button>';
    }).join('') + '</div></div>';
}
var friQv = '';                                   // ricerca tra i tuoi amici (finestra Amici)
function pickNorm(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function pickFilter(inp) {                       // senza accenti e maiuscole; le righe «Impostazioni…» (fr-box) restano
  var q = pickNorm(inp.value.trim()), box = inp.parentNode, n = 0;
  Array.prototype.forEach.call(box.querySelectorAll('.fr-pick-row, .fr-go, .fr-row'), function (r) {
    if (r.closest('.fr-box')) return;
    r.hidden = !!q && pickNorm(r.textContent).indexOf(q) < 0; if (!r.hidden) n++;
  });
  var none = box.querySelector('[data-pick-none]'); if (none) none.hidden = !q || n > 0;
}
document.addEventListener('input', function (e) {
  if (!e.target.hasAttribute || !e.target.hasAttribute('data-pick-q')) return;
  if (e.target.id === 'friFQ') friQv = e.target.value;
  pickFilter(e.target);
});

/* ---------- API Google Libri condivisa con un amico: la usano tutti e due (Piero, 16/11/2026).
   Il worker SBN non si presta più (031, 20/11/2026: è uno solo, della casa): i campi «sbn» restano sempre vuoti. ---------- */
function borrowed() { return rd(K_KEY); }                      // { da, nome, gb } se stai usando l'API di un amico
function ownKeys() {   // le tue, anche mentre usi quelle di un amico (tenute da parte in «chiavi-mie»)
  var st = NL.settings || {}, b = borrowed() || {}, m = rd('catalogo-libri-amici-chiavi-mie') || {};
  var o = { gb: st.gbKey && st.gbKey !== b.gb ? st.gbKey : (b.gb && m.gb) || '', sbn: '' };
  if (/^prestata:/.test(o.gb)) o.gb = '';                       // i segni di quelle prestate non sono mai tue (026)
  return o;
}
/* 026 (Piero, 18/11/2026): le API di un amico copiate sul telefono prima del giro 8 sembravano tuoi (e si potevano prestare).
   Il server dice quali dei valori che hai sono di un altro: si tolgono dal telefono; se quell'amico te li presta, li usi dal server. */
var ownChecked = '';
async function ownCheck() {
  if (!NL.svcAll || !NL.svcPurge) return;
  var vals = NL.svcAll(), sig = vals.join('|'); if (!vals.length || sig === ownChecked) return;
  var rows = (await rpc('chiavi_controlla', { valori: vals })) || [];
  ownChecked = sig;
  if (!rows.length) return;
  var bad = rows.map(function (r) { return r.v; }), st = NL.settings || {}, wasGb = bad.indexOf(st.gbKey) >= 0;
  var m = rd('catalogo-libri-amici-chiavi-mie'); if (m) { if (bad.indexOf(m.gb) >= 0) m.gb = ''; m.sbn = ''; wr('catalogo-libri-amici-chiavi-mie', m); }
  NL.svcPurge(bad); ownChecked = NL.svcAll().join('|');
  var lender = rows.filter(function (r) { return r.da; })[0], k = lender && keys.filter(function (x) { return x.a === uid() && x.da === lender.da; })[0];
  if (k && k.gb_key && !borrowed() && wasGb) {
    wr('catalogo-libri-amici-chiavi-mie', ownKeys());
    setKeys(k.gb_key);
    wr(K_KEY, { da: k.da, nome: k.nome, gb: k.gb_key, sbn: '' });
    NL.toast('L’API di ' + k.nome + ' ora passa dal server: sul telefono non c’è più.');
  } else NL.toast('Tolta dal telefono un’API che non era tua.');
  NL.emit && NL.emit('keys');
}
function keysInner(full) {
  var own = ownKeys(), fr = friends(), out = keys.filter(function (k) { return k.da === uid(); }), inn = keys.filter(function (k) { return k.a === uid(); }), b = borrowed(), h = '';
  if (own.gb && fr.length) {
    h += '<p class="fr-small">Prestarla non ti costa niente e puoi smettere quando vuoi. Tocca un amico per prestargliela.</p>' +   // testo approvato (20/11/2026)
      pickerHTML(fr, 'data-f="keyshare" data-id', function (x) { return !!outKey(x.id); }, function (x) { var k = outKey(x.id); return k ? lentLabel(k) : ''; }) +
      '<p class="fr-small kw-n">' + lentText(lentCount()) + '.</p>' +
      '<p class="fr-small kw-uff">Incolla l’API solo in Next Libris, su nextlibris.app. Non te la chiederemo mai per email o messaggio.</p>';   // indirizzo ufficiale (Piero, 18/11/2026)
  }
  inn.forEach(function (k) {
    if (!k.gb_key) return;
    var using = b && b.da === k.da;
    h += '<div class="fr-row fr-key"><span class="fr-who">' + esc(k.nome) + ' condivide con te la sua API Google' + (using ? '<small>La stai usando</small>' : own.gb ? '<small>Hai già la tua: usandola prende il suo posto</small>' : '') + '</span><span class="fr-act">' +
      (using ? '<button class="link" type="button" data-f="keyoff" data-id="' + esc(k.da) + '">Non usarla più</button>' : '<button class="btn primary" type="button" data-f="keyuse" data-id="' + esc(k.da) + '">Usala</button>') + '</span></div>';
  });
  if (!h && full) h = '<p class="fr-small">Non hai ancora un’API Google da condividere: si imposta in Indice › Impostazioni › Ricerca dei libri. Se un amico condivide la sua con te, la trovi qui.</p>';
  return h;
}
function lentCount() { var m = {}; keys.forEach(function (k) { if (k.da === uid()) m[k.a] = 1; }); return Object.keys(m).length; }   // amici a cui presti (chi la riceve con il link non si conta; giro 5)
function lentText(n) { return n === 0 ? 'Non la usa ancora nessun amico' : n === 1 ? 'La usa 1 amico' : 'La usano ' + n + ' amici'; }
function keysHTML(full) { var h = keysInner(full); return h ? '<section class="fr-sec" id="friKeys"><h3 class="fr-h">API Google Libri</h3>' + h + '</section>' : ''; }

/* ---------- finestra «API Google Libri» (da Condivisione; Piero, 16/11/2026): solo l’API, e chiudendo torni dove eri ---------- */
function kwSheet() {
  var el = document.getElementById('kwSheet'); if (el) return el;
  el = document.createElement('div'); el.className = 'sheet fri'; el.id = 'kwSheet'; el.hidden = true;
  el.innerHTML = '<div class="sheet-in" role="dialog" aria-modal="true" aria-labelledby="kwH"><h2 id="kwH">API Google Libri</h2><div id="kwBody" class="fr-sec"></div>' +
    '<div class="row-btns"><button class="btn" type="button" id="kwClose">Chiudi</button></div></div>';
  document.body.appendChild(el);
  var shut = function () { el.hidden = true; };
  el.addEventListener('click', function (e) { if (e.target === el) shut(); });
  el.querySelector('#kwClose').addEventListener('click', shut);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !el.hidden && (document.getElementById('keySheet') || {}).hidden !== false) shut(); });
  el.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-kw]'); if (!b) return;
    var k = b.dataset.kw;
    if (k === 'login') { shut(); S.open(); }
    else if (k === 'guide') { var R = window.NLRicerche; if (R && R.guide) R.guide(true); }
    else if (k === 'friends') { shut(); NL.closeDrawer && NL.closeDrawer(); open(); }
  });
  el.addEventListener('click', onClick);
  return el;
}
function kwRow(k, t, sub) { return '<ul class="fr-list fr-box"><li class="fr-row fr-go"><button class="fr-who fr-open" type="button" data-kw="' + k + '">' + esc(t) + '<small>' + esc(sub) + '</small></button><span class="n" aria-hidden="true">›</span></li></ul>'; }
function paintKw() {
  var el = document.getElementById('kwSheet'), body = document.getElementById('kwBody'); if (!el || el.hidden || !body) return;
  var own = ownKeys(), b = borrowed(), h = '', intro = '<p class="fr-small kw-intro">Un’API Google Libri fa 1.000 ricerche al giorno. Con un uso normale bastano per te e per decine di amici. Il primo giorno, quando un amico carica la sua libreria, ne consuma di più: puoi aiutare fino a <b>6 amici nuovi al giorno</b> (50 libri ciascuno).</p>';   // testo approvato (20/11/2026)
  if (!uid()) {
    h = '<p class="fr-small">Per prestarla agli amici, o per usare quella che un amico ti presta, serve l\'account.</p><button class="btn primary" type="button" data-kw="login">Entra con il tuo account</button>';
  } else if (!list) {
    h = '<p class="fr-small">' + (err ? esc(err) : 'Un momento…') + '</p>';
  } else {
    h = keysInner(false);
    if (own.gb && !friends().length) h += '<p class="fr-small">Per prestarla serve almeno un amico su Next Libris.</p>' + kwRow('friends', 'Aggiungi un amico', 'Cercalo per nome o mandagli il tuo invito.');
    if (!h) h = '<p class="fr-small">Non hai ancora un’API Google tua. Se un amico ti presta la sua, la trovi qui.</p>';
  }
  if (!own.gb) h += kwRow('guide', 'Crea la tua API Google', 'È gratis: 1.000 ricerche al giorno solo per te.');
  h += askHTML(own);
  body.innerHTML = intro + h;
}
/* ---------- «Chiedila a un amico» (giro 12, 19/11/2026; database 030) ----------
   Ogni telefono dice al server solo un sì/no: «ho un’API mia» (declareKeys; l’API resta sul telefono).
   Chi non ha un’API vede gli amici che ne hanno una, con «Chiedimela»: all'amico arriva un avviso con «Prestala».
   Una richiesta allo stesso amico ogni 7 giorni (lo decide il server); chi la riceve può anche ignorarla. */
var K_SAID = 'catalogo-libri-amici-chiavi-dette', saying = false;
function declareKeys() {
  if (!uid() || saying) return;
  var o = ownKeys(), sig = uid() + ':' + (o.gb ? 1 : 0) + '0';
  if (rd(K_SAID) === sig) return;
  saying = true;
  rpc('chiavi_dichiara', { gb: !!o.gb, sbn: false }).then(function () { wr(K_SAID, sig); }).catch(function (e) { if (window.console) console.warn('chiavi_dichiara', e); }).then(function () { saying = false; });
}
var WEEK = 7 * 864e5;
function askedLately(id) { var f = fkeys[id]; return !!(f && f.chiesta && Date.now() - Date.parse(f.chiesta) < WEEK); }
function askable() {   // amici con un’API Google loro, che non te la prestano già
  return friends().filter(function (x) { var f = fkeys[x.id]; return f && f.gb && !keys.some(function (k) { return k.da === x.id && k.a === uid(); }); });
}
function askHTML(own) {
  if (!uid() || !list || own.gb || keys.some(function (k) { return k.a === uid() && k.gb_key; })) return '';
  var h = '<h3 class="fr-h kw-askh">Chiedila a un amico</h3>', can = askable();
  if (!friends().length) return h + '<p class="fr-small">Quando avrai un amico su Next Libris con un’API sua, potrai chiedergliela da qui.</p>' + kwRow('friends', 'Aggiungi un amico', 'Cercalo per nome o mandagli il tuo invito.');
  if (!can.length) return h + '<p class="fr-small">Nessuno dei tuoi amici ha ancora un’API sua. Quando un amico la crea, lo trovi qui.</p>';
  return h + '<p class="fr-small">Questi amici hanno un’API loro. Prestartela non costa niente: l’API resta sul server e tu cerchi e basta.</p><ul class="fr-list fr-box kw-ask">' +
    can.map(function (x) {
      return '<li class="fr-row"><span class="fr-who">' + nameOf(x) + '</span><span class="fr-act">' +
        (askedLately(x.id) ? '<span class="kw-asked">Richiesta mandata</span>' : '<button class="btn" type="button" data-f="keyask" data-id="' + esc(x.id) + '">Chiedimela</button>') + '</span></li>';
    }).join('') + '</ul>';
}
/* «Chiedimela» anche nel profilo dell'amico (Piero, 19/11/2026): null se non serve (hai già un’API, o l'amico non ne ha una sua) */
function askState(id) {
  if (!uid() || !list || ownKeys().gb || keys.some(function (k) { return k.a === uid() && k.gb_key; })) return null;
  if (!askable().some(function (x) { return x.id === id; })) return null;
  return { asked: askedLately(id) };
}
async function askKey(id, btn) {
  if (btn) btn.disabled = true;
  try {
    var r = await rpc('chiedi_chiavi', { a: id }), n = friendName(id);
    if (r === 'ok' || r === 'presto') { fkeys[id] = Object.assign({}, fkeys[id], { chiesta: (r === 'ok' || !(fkeys[id] || {}).chiesta) ? new Date().toISOString() : fkeys[id].chiesta }); NL.toast(r === 'ok' ? 'Richiesta mandata a ' + n + '.' : 'L\'hai già chiesta a ' + n + ' da poco: puoi riprovare tra qualche giorno.'); }
    else if (r === 'gia') { NL.toast(n + ' te la presta già.'); load(true); }
    else if (r === 'troppe') NL.toast('Per oggi hai mandato tante richieste: riprova domani.');
    else { if (fkeys[id]) fkeys[id].gb = false; NL.toast(n + ' non ha più un’API sua.'); }
  } catch (e) { NL.toast(nice(e)); }
  paintKw();
}
function keyWin() {
  var el = kwSheet(); document.body.appendChild(el); el.hidden = false; paintKw();
  var si = el.querySelector('.sheet-in'); if (si) si.scrollTop = 0;
  if (uid() && !list) load(true).then(paintKw);
}
/* cosa presto a un amico: dal server arrivano solo i segni ('si'), mai le API; senza segni (database vecchio) valgono tutte e due */
function outKey(id) {
  var k = keys.filter(function (x) { return x.da === uid() && x.a === id; })[0]; if (!k) return null;
  var own = ownKeys(), known = k.gb_key || k.sbn;
  return { gb: known ? !!k.gb_key : !!own.gb, sbn: false };
}
function whatOf() { return 'l’API Google'; }
function lentLabel() { return 'Prestata: API Google'; }
/* finestra «Presta a …»: si presta l'API Google (il worker non si presta più: 031, 20/11/2026) */
var keyTo = '';
/* prestiti e regali tra te e un amico (icona ⇄ nella sua libreria): «In corso» sopra, poi «Già restituiti e regali» (Piero, 17/11/2026) */
function aNome(n) { return (/^[aA]/.test(n || '') ? 'ad ' : 'a ') + n; }   // «ad Anna», «a Bruno»
function swapsWith(id) { return id ? swaps.filter(function (s) { return s.da === id || s.a === id; }) : []; }
function swapSheet(id) {
  var el = document.getElementById('swapSheet');
  if (!el) {
    el = document.createElement('div'); el.className = 'sheet fri'; el.id = 'swapSheet'; el.hidden = true;
    el.innerHTML = '<div class="sheet-in" role="dialog" aria-modal="true" aria-labelledby="swapH"><h2 id="swapH"></h2><div id="swapBody"></div>' +
      '<button class="btn primary" type="button" id="swapClose">Chiudi</button></div>';
    document.body.appendChild(el);
    var shut = function () { el.hidden = true; };
    el.addEventListener('click', function (e) { if (e.target === el) shut(); });
    el.querySelector('#swapClose').addEventListener('click', shut);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !el.hidden) shut(); });
  }
  var n = esc(friendName(id)), all = swapsWith(id);
  var now = all.filter(function (s) { return s.tipo === 'prestito' && s.stato !== 'chiuso'; }), past = all.filter(function (s) { return now.indexOf(s) < 0; });
  var when = function (s) { return s.tipo === 'prestito' && s.stato === 'chiuso' && s.chiuso ? s.chiuso : s.creato; };
  past.sort(function (a, b) { return String(when(b)) > String(when(a)) ? 1 : String(when(b)) < String(when(a)) ? -1 : 0; });
  var row = function (s) {
    var t = '«' + esc((s.libro && s.libro.t) || 'un libro') + '»', mio = s.da === uid(), txt, d;
    if (s.tipo === 'regalo') { txt = mio ? 'Gli hai regalato ' + t : 'Ti ha regalato ' + t; d = L_date(s.creato); }
    else if (s.stato === 'chiuso') { txt = mio ? 'Gli avevi prestato ' + t : 'Ti aveva prestato ' + t; d = 'dal ' + L_date(s.creato) + (s.chiuso ? ' al ' + L_date(s.chiuso) : ''); }
    else { txt = (mio ? 'Gli hai prestato ' : 'Ti ha prestato ') + t + (s.stato === 'reso' ? ' · restituzione da confermare' : ''); d = 'dal ' + L_date(s.creato); }
    return '<li class="fr-row"><span class="fr-who fr-swap">' + txt + '<small>' + esc(d) + '</small></span></li>';
  };
  document.getElementById('swapH').textContent = 'Tra te e ' + friendName(id);
  document.getElementById('swapBody').innerHTML =
    '<section class="fr-sec"><h3 class="fr-h">In corso</h3>' + (now.length ? '<ul class="fr-list">' + now.map(row).join('') + '</ul>' : '<p class="fr-small">Nessun prestito in corso.</p>') + '</section>' +
    '<section class="fr-sec"><h3 class="fr-h">Già restituiti e regali</h3>' + (past.length ? '<ul class="fr-list">' + past.map(row).join('') + '</ul>' : '<p class="fr-small">Ancora niente.</p>') +
    '<p class="fr-small">Si vedono i prestiti restituiti e i regali degli ultimi 60 giorni.</p></section>';
  document.body.appendChild(el);
  el.hidden = false;
}
/* conferma prima di togliere un amico dalla sua libreria (icona in alto a destra) */
function dropSheet(id) {
  if (!id) return;
  var el = document.getElementById('dropSheet');
  if (!el) {
    el = document.createElement('div'); el.className = 'sheet fri'; el.id = 'dropSheet'; el.hidden = true;
    el.innerHTML = '<div class="sheet-in" role="dialog" aria-modal="true" aria-labelledby="dropH"><h2 id="dropH"></h2>' +
      '<p class="fr-small">Non vedrete più la libreria e i desideri l\'uno dell\'altro. Prestiti e regali già fatti restano. Per tornare amici serve una nuova richiesta.</p>' +
      '<div class="row-btns"><button class="btn" type="button" id="dropNo">Annulla</button><button class="btn primary" type="button" id="dropGo">Togli</button></div></div>';
    document.body.appendChild(el);
    var shut = function () { el.hidden = true; };
    el.addEventListener('click', function (e) { if (e.target === el) shut(); });
    el.querySelector('#dropNo').addEventListener('click', shut);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !el.hidden) shut(); });
    el.querySelector('#dropGo').addEventListener('click', async function () {
      var who = el.dataset.id, name = friendName(who); if (!who) return;
      this.disabled = true;
      try {
        await rpc('togli_amicizia', { altro: who }); shut();
        NL.toast(name + ' non è più tra i tuoi amici.');
        if (gId === who && NL.guestExit) NL.guestExit();
        await load(true);
      } catch (e) { NL.toast(nice(e)); }
      this.disabled = false;
    });
  }
  el.dataset.id = id;
  document.getElementById('dropH').textContent = 'Togli ' + friendName(id) + ' dagli amici?';
  document.body.appendChild(el);
  el.hidden = false;
}
function keySheet(id) {
  var own = ownKeys(); if (!own.gb) return;
  keyTo = id;
  var el = document.getElementById('keySheet');
  if (!el) {
    el = document.createElement('div'); el.className = 'sheet fri'; el.id = 'keySheet'; el.hidden = true;
    el.innerHTML = '<div class="sheet-in" role="dialog" aria-modal="true" aria-labelledby="keyH"><h2 id="keyH"></h2>' +
      '<p class="fr-small">La usate tutti e due e puoi smettere quando vuoi. L’API non si vede: passa dal server.</p>' +
      '<div class="fr-share" id="keyOpts"></div>' +
      '<div class="row-btns"><button class="btn" type="button" id="keyNo">Annulla</button><button class="btn primary" type="button" id="keyGo">Presta</button></div></div>';
    document.body.appendChild(el);
    var shut = function () { el.hidden = true; keyTo = ''; };
    el.addEventListener('click', function (e) { if (e.target === el) shut(); });
    el.querySelector('#keyNo').addEventListener('click', shut);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !el.hidden) shut(); });
    el.addEventListener('change', keyBtn);
    el.querySelector('#keyGo').addEventListener('click', async function () {
      var id = keyTo, o = ownKeys(), gb = document.getElementById('keyGb');
      var pg = !!(gb && gb.checked && o.gb), was = outKey(id), name = friendName(id);
      if (!pg && !was) return;
      this.disabled = true;
      try {
        if (!pg) { await rpc('riprendi_chiavi', { a: id }); NL.toast('Non presti più l’API a ' + name + '.'); }
        else { await rpc('presta_chiavi', { a: id, gb_key: o.gb, sbn: '' }); NL.toast('API prestata a ' + name + '.'); }
        shut();
      } catch (e) { NL.toast(nice(e)); }
      this.disabled = false;
      try { keys = (await rpc('chiavi_mie')) || []; } catch (e) { if (window.nlErr) nlErr(e); }
      paint(); guestBar();
    });
  }
  var cur = outKey(id), opt = function (iid, on, has, t, sub) {
    return '<label class="check fr-wish"><input type="checkbox" id="' + iid + '"' + (has && on ? ' checked' : '') + (has ? '' : ' disabled') + '><span>' + t + '<small>' + (has ? sub : 'Non ce l\'hai: si imposta in Indice › Impostazioni › Ricerca dei libri.') + '</small></span></label>';
  };
  document.body.appendChild(el);   // sopra la finestra da cui si apre
  document.getElementById('keyH').textContent = 'Presta a ' + friendName(id);
  document.getElementById('keyOpts').innerHTML =
    opt('keyGb', cur ? cur.gb : true, !!own.gb, 'API Google Libri', 'Più libri trovati, con copertina e descrizione. Resta al sicuro: l\'amico non la vede e può fare 300 ricerche al giorno.');
  keyBtn();
  el.hidden = false;
}
function keyBtn() {
  var b = document.getElementById('keyGo'); if (!b) return;
  var gb = document.getElementById('keyGb'), any = !!(gb && gb.checked), was = !!outKey(keyTo);
  b.textContent = !any && was ? 'Smetti di prestare' : was ? 'Salva' : 'Presta';
  b.disabled = !any && !was;
}
function setKeys(gb) { var st = NL.settings; if (!st) return; st.gbKey = gb || ''; st.sbnUrl = ''; NL.saveSettings && NL.saveSettings(); }
async function keyAct(a, id) {
  try {
    if (a === 'keyshare') {
      var on = keys.some(function (k) { return k.da === uid() && k.a === id; }), own = ownKeys();
      if (on) { await rpc('riprendi_chiavi', { a: id }); NL.toast('Non la condividi più con ' + friendName(id) + '.'); }
      else { await rpc('presta_chiavi', { a: id, gb_key: own.gb, sbn: '' }); NL.toast('Condivisa con ' + friendName(id) + ': la usate tutti e due.'); }
    } else if (a === 'keyuse') {
      var k = keys.filter(function (x) { return x.a === uid() && x.da === id; })[0]; if (!k || !k.gb_key) return;
      wr('catalogo-libri-amici-chiavi-mie', ownKeys());   // la tua, da rimettere quando smetti
      setKeys(k.gb_key);
      wr(K_KEY, { da: k.da, nome: k.nome, gb: k.gb_key, sbn: '' });
      NL.toast('Ora usi l’API di ' + k.nome + '.');
    } else if (a === 'keyoff') { stopBorrow(''); }
  } catch (e) { NL.toast(nice(e)); }
  try { keys = (await rpc('chiavi_mie')) || []; } catch (e) { if (window.nlErr) nlErr(e); }
  paint();
}
function stopBorrow(msg) {
  var b = borrowed(); if (!b) return;
  var st = NL.settings || {}, back = rd('catalogo-libri-amici-chiavi-mie') || {};
  setKeys(st.gbKey === b.gb ? back.gb : st.gbKey);
  wr(K_KEY, null); wr('catalogo-libri-amici-chiavi-mie', null);
  if (msg !== false) NL.toast(msg || 'Non usi più l’API di ' + b.nome + '.');
  paintKw(); NL.emit && NL.emit('keys');
}
/* «Usa la tua» in Ricerca dei libri (Piero, 17/11/2026): smetti di usare l’API dell'amico e rimetti la tua; se non ne avevi
   una, il campo torna vuoto per incollarla. Ognuno deve poter usare la sua. */
function ownPart() {
  var b = borrowed(); if (!b) return '';
  var m = rd('catalogo-libri-amici-chiavi-mie') || {}, mine = m.gb || '';
  setKeys(mine);
  wr(K_KEY, null); wr('catalogo-libri-amici-chiavi-mie', null);
  NL.toast(mine ? 'Ora usi la tua API Google.' : 'Incolla la tua API Google.');
  paintKw(); NL.emit && NL.emit('keys');
  return mine;
}
/* giro 8: l’API prestata resta sul server. Se cambi la tua API (anche dopo «La mia API è finita in giro»), il server la
   aggiorna per tutti gli amici a cui la presti; se chi te la prestava ha smesso, il server lo dice (lentGone) e si rileggono le API. */
NL.on('ownkey', function (v) {
  if (!uid() || !keys.some(function (k) { return k.da === uid() && k.gb_key; })) return;
  rpc('chiavi_aggiorna', { gb_key: v }).then(function (n) { if (n) NL.toast('Chiave aggiornata anche per gli amici a cui la presti.'); })
    .catch(function (e) { NL.toast('Non riesco ad aggiornare l’API per gli amici: ' + nice(e)); });
});
var goneAt = 0;
NL.on('lentGone', function () { if (Date.now() - goneAt < 60000) return; goneAt = Date.now(); load(true); });
function checkKeys() {
  var b = borrowed(), inn = keys.filter(function (k) { return k.a === uid(); });
  if (b) {
    var k = inn.filter(function (x) { return x.da === b.da; })[0];
    if (!b.gb) stopBorrow(false);                              // usavi solo il worker di un amico: non esiste più (031), senza avvisi
    else if (!k) stopBorrow(b.nome + ' non condivide più la sua API: torni alle tue impostazioni.');
    else {
      var gb = k.gb_key || '';
      if (gb !== b.gb || b.sbn) { var st = NL.settings || {}; setKeys(gb || st.gbKey); wr(K_KEY, { da: k.da, nome: k.nome, gb: gb, sbn: '' }); }
    }
  }
}

/* ---------- prestiti e regali tra amici ---------- */
var COPY = ['t', 'a', 'e', 'y', 'i', 'img', 'imgL', 'pg', 'gen', 'ds', 'dsf', 'dsl', 'se', 'sn', 'sq'];   // il prezzo e le note no
function snap(b) { var o = {}; COPY.forEach(function (k) { if (b[k]) o[k] = b[k]; }); return o; }
function friendByName(n) { n = tidy(n).toLowerCase(); return friends().filter(function (x) { return (x.utente || '').toLowerCase() === n; })[0]; }
function pend() { return rd(K_PEND) || []; }
function setPend(a) { wr(K_PEND, a.length ? a : null); }
/* dopo «Salva» in «Presta, vendi o regala» (4,5 s: il tempo di «Annulla»): se il nome è di un amico, lo vede anche lui */
NL.on('loan', function (ev) { setTimeout(function () { sendSwap(ev.id, ev.kind, ev.who, ev.old); }, 4500); });
async function sendSwap(id, kind, who, old) {
  var b = myGet(id); if (!b || !uid()) return;
  var still = kind === 'p' ? b.p === who && !b.xs : kind === 'r' ? b.xs === 'r' && b.xa === who : false;
  var same = old && ((kind === 'p' && old.p === who && !old.xs) || (kind === 'r' && old.xs === 'r' && old.xa === who));
  if (!still && kind !== 'v' && kind !== 's') return;                      // annullato
  if (b.sx && !same) { var oldSx = b.sx; b.sx = ''; NL.save(); try { await rpc('chiudi_scambio', { id: oldSx }); } catch (e) { if (window.nlErr) nlErr(e); } }
  if (!still || b.sx) return;
  var f = friendByName(who); if (!f) return;
  try {
    var nid = await rpc('crea_scambio', { a: f.id, tipo: kind === 'p' ? 'prestito' : 'regalo', libro: snap(b), libro_id: b.id });
    b = myGet(id); if (b) { b.sx = nid; NL.save(); }
    NL.toast((kind === 'p' ? 'Prestito' : 'Regalo') + ' visibile anche a ' + f.utente + ', nella sua app.');
    setPend(pend().filter(function (x) { return x.id !== id; }));
  } catch (e) {
    if (e.code === 'net') { setPend(pend().filter(function (x) { return x.id !== id; }).concat([{ id: id, kind: kind, who: who }])); NL.toast('Senza rete: avviso ' + f.utente + ' appena torna la connessione.'); }
    else NL.toast('Non sono riuscito ad avvisare ' + f.utente + ' (' + e.message + ').');
  }
}
/* «Restituito» (o «È tornato in libreria») da chi presta: finito anche per l'amico */
NL.on('loanBack', function (ev) { setTimeout(async function () {
  var b = myGet(ev.id); if (!b || !b.sx || b.p || b.xs) return;
  var x = b.sx; b.sx = ''; NL.save();
  try { await rpc('chiudi_scambio', { id: x }); } catch (e) { if (window.nlErr) nlErr(e); }
}, 4500); });
/* «Prestato da Anna» toccato da chi l'ha ricevuto: l'hai restituito? */
NL.on('recv', function (id) {
  if (NL.guest && NL.guest()) return;
  var b = myGet(id); if (!b || b.sk !== 'p') return;
  recvId = id;
  var el = document.getElementById('recvSheet');
  if (!el) {
    el = document.createElement('div'); el.className = 'sheet fri'; el.id = 'recvSheet'; el.hidden = true;
    el.innerHTML = '<div class="sheet-in" role="dialog" aria-modal="true" aria-labelledby="recvH"><h2 id="recvH">Prestato da un amico</h2><p class="msg" id="recvTxt"></p><p class="fr-small" id="recvSub"></p>' +
      '<div class="row-btns"><button class="btn" type="button" id="recvNo">Non ancora</button><button class="btn primary" type="button" id="recvYes">Restituito</button></div></div>';
    document.body.appendChild(el);
    var shut = function () { el.hidden = true; recvId = ''; };
    el.addEventListener('click', function (e) { if (e.target === el) shut(); });
    el.querySelector('#recvNo').addEventListener('click', shut);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !el.hidden) shut(); });
    el.querySelector('#recvYes').addEventListener('click', async function () {
      var x = myGet(recvId); shut(); if (!x) return;
      var sx = x.sx, who = x.sda;
      if (!sx) { x.xs = 'b'; x.xa = who; x.xd = NL.today(); NL.save(); NL.refresh(); return; }
      try { await rpc('segnala_reso', { id: sx }); }                 // il prestito lo chiude chi ha prestato, quando conferma
      catch (e) { NL.toast(e.code === 'net' ? 'Senza rete: riprova quando c\'è la connessione.' : nice(e)); return; }
      x = myGet(x.id); if (x) { x.sk = 'q'; NL.save(); NL.refresh(); }
      NL.toast(who + ' deve confermare di averlo ricevuto.');
    });
  }
  document.getElementById('recvTxt').innerHTML = 'Hai restituito <b>«' + esc(b.t || 'questo libro') + '»</b> ' + esc(aChi(b.sda)) + '?';
  document.getElementById('recvSub').textContent = b.sda + ' dovrà confermare di averlo ricevuto. Poi il libro resta nel tuo elenco come storico, in grigio.';
  el.hidden = false;
});
/* applica quello che è arrivato: libri nuovi per chi riceve, restituzioni per tutti e due */
async function applySwaps() {
  var me_ = uid(), books = mine(), changed = false;
  for (var i = 0; i < swaps.length; i++) {
    var s = swaps[i], ofSwap = function (b) { return b.sx === s.id; };
    var local = books.filter(ofSwap)[0];
    if (s.a === me_ && s.stato === 'aperto' && !s.visto) {
      if (!local) {
        var L0 = s.libro || {}, wish = s.tipo === 'regalo' && L0.i ? books.filter(function (b) { return b.w && b.i && b.i === L0.i; })[0] : null;
        if (wish) { wish.w = false; wish.ts = Date.now(); wish.rs = wish.rs || 'da'; wish.sx = s.id; wish.sk = 'r'; wish.sda = s.nome_da || ''; s._lid = wish.id; }
        else {
          var nb = NL.clean(Object.assign({}, L0, { id: NL.newId(), ts: Date.now(), w: false, rs: 'da', sx: s.id, sk: s.tipo === 'prestito' ? 'p' : 'r', sda: s.nome_da || '' }));
          if (nb) { books.unshift(nb); s._lid = nb.id; }
        }
        changed = true;
      }
      try { await rpc('segna_visto', { id: s.id }); } catch (e) { if (window.nlErr) nlErr(e); }
    }
    if (s.tipo === 'prestito' && local && s.a === me_ && !local.xs) {           // restituzione: «da confermare» o rifiutata
      if (s.stato === 'reso' && local.sk === 'p') { local.sk = 'q'; changed = true; }
      if (s.stato === 'aperto' && local.sk === 'q') { local.sk = 'p'; changed = true; }   // «non ancora ricevuto»: nella campanella
    }
    if (s.stato === 'chiuso' && s.tipo === 'prestito' && local) {
      if (s.a === me_ && (local.sk === 'p' || local.sk === 'q') && !local.xs) { local.xs = 'b'; local.xa = local.sda || s.nome_da || ''; local.xd = String(s.chiuso || '').slice(0, 10) || NL.today(); changed = true;
        NL.toast((s.nome_da || 'Il tuo amico') + ' ha segnato «' + (local.t || 'il libro') + '» come restituito.'); }
      if (s.da === me_ && local.p) { local.p = ''; local.pd = ''; local.sx = ''; changed = true;
        NL.toast((s.nome_a || 'Il tuo amico') + ' ti ha restituito «' + (local.t || 'il libro') + '».'); }
    }
  }
  if (changed) { NL.save(); NL.refresh(); }
  var p = pend(); if (p.length) { setPend([]); p.forEach(function (x) { sendSwap(x.id, x.kind, x.who, null); }); }
  paintRet();
}
/* avviso in cima per chi ha prestato: «Bruno dice di averti restituito «X»»: Confermo / Non ancora */
function paintRet() {
  var r = swaps.filter(function (s) { return s.da === uid() && s.tipo === 'prestito' && s.stato === 'reso'; }), box = document.getElementById('friRet');
  if (!box) {
    if (!r.length) return;
    var anchor = document.getElementById('nxBox') || document.getElementById('donAsk') || document.getElementById('list'); if (!anchor) return;
    box = document.createElement('section'); box.id = 'friRet'; box.className = 'fri-note fri-ret lay-note lay-first'; box.hidden = true;
    box.innerHTML = '<div class="fn-open"><span class="fn-ico" aria-hidden="true">' + ICON + '</span><span class="fn-t"><b id="friRetT"></b><small>L\'hai ricevuto?</small></span></div>' +
      '<div class="fn-acts"><button type="button" class="fn-go" id="friRetNo">Non ancora</button><button type="button" class="fn-go fn-yes" id="friRetYes">Confermo</button></div>';
    anchor.parentNode.insertBefore(box, anchor);
    box.addEventListener('click', async function (e) {
      var yes = e.target.closest('#friRetYes'), no = e.target.closest('#friRetNo'); if (!yes && !no) return;
      var s = swaps.filter(function (x) { return x.id === box.dataset.id; })[0]; if (!s) return;
      e.target.disabled = true;
      try {
        if (yes) {
          await rpc('chiudi_scambio', { id: s.id }); s.stato = 'chiuso';
          var b = mine().filter(function (x) { return x.sx === s.id; })[0];
          if (b) { b.p = ''; b.pd = ''; b.sx = ''; NL.save(); NL.refresh(); }
          NL.toast('Prestito chiuso: «' + ((s.libro && s.libro.t) || 'il libro') + '» è di nuovo tuo.');
        } else { await rpc('rifiuta_reso', { id: s.id }); s.stato = 'aperto'; NL.toast((s.nome_a || 'Il tuo amico') + ' vedrà che non l\'hai ancora ricevuto.'); }
      } catch (x2) { NL.toast(nice(x2)); }
      e.target.disabled = false; paintRet(); NL.summary && NL.summary();
    });
  }
  box.hidden = !r.length;
  if (!r.length) return;
  box.dataset.id = r[0].id;
  document.getElementById('friRetT').textContent = (r[0].nome_a || 'Il tuo amico') + ' dice di averti restituito «' + ((r[0].libro && r[0].libro.t) || 'un libro') + '»';
}
/* ---------- in «Presta, vendi o regala»: gli amici da scegliere con un tocco ---------- */
function paintLoanFriends() {
  var sh = document.getElementById('loanSheet'), who = document.getElementById('loanWhoF'); if (!sh || !who) return;
  var box = document.getElementById('loanFri');
  var kind = (sh.querySelector('#loanKind [aria-pressed="true"]') || {}).dataset; kind = kind && kind.k;
  var fr = uid() ? friends() : [];
  var show = !sh.hidden && (kind === 'p' || kind === 'r') && fr.length && !who.hidden;
  if (!box) {
    if (!show) return;
    box = document.createElement('div'); box.id = 'loanFri'; box.className = 'loan-fri';
    who.parentNode.insertBefore(box, who.nextSibling);
    box.addEventListener('click', function (e) {
      var c = e.target.closest('[data-u]'); if (!c) return;
      var f = friends().filter(function (x) { return x.id === c.dataset.u; })[0]; if (!f) return;
      var inp = document.getElementById('loanWho'); inp.value = f.utente; inp.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
  box.hidden = !show; if (!show) return;
  var cur = friendByName(document.getElementById('loanWho').value), q = box.querySelector('[data-pick-q]'), qv = q ? q.value : '';
  box.innerHTML = '<p class="fr-small">Oppure scegli un amico su Next Libris: lo vedrà nella sua app</p>' + pickerHTML(fr, 'data-u', function (x) { return cur && cur.id === x.id; }, null) +
    (cur ? '<p class="fr-small fr-ok">' + esc(cur.utente) + ' lo vedrà nella sua app: ' + (kind === 'p' ? '«Prestato da ' + esc(NL.name() || 'te') + '»' : '«Regalato da ' + esc(NL.name() || 'te') + '»') + '.</p>' : '');
  var q2 = box.querySelector('[data-pick-q]'); if (q2 && qv) { q2.value = qv; q2.dispatchEvent(new Event('input', { bubbles: true })); }
}
(function () {
  var sh = document.getElementById('loanSheet'); if (!sh) return;
  if (window.MutationObserver) new MutationObserver(function () { paintLoanFriends(); }).observe(sh, { attributes: true, attributeFilter: ['hidden'] });
  sh.addEventListener('click', function (e) { if (e.target.closest('#loanKind')) setTimeout(paintLoanFriends, 0); });
  sh.addEventListener('input', function (e) { if (e.target.id === 'loanWho') paintLoanFriends(); });
})();

NL.on('menu', paintMenu);
S.onAuth(function () {
  me = null; list = null; found = null; foundQ = '';
  if (uid() && invite) { var acc = document.getElementById('accSheet'); if (acc) acc.hidden = true; open(); }   // entrato dopo un invito: si riprende da li'
  else if (uid()) load(true);
  else paintAll();
});
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && uid() && Date.now() - lastLoad > 60000) load(true); });
setInterval(function () { if (document.visibilityState === 'visible' && uid() && !loading && Date.now() - lastLoad > 170000) load(true); }, 60000);   // richieste e avvisi senza chiudere l'app
okRefresh();
if (uid()) setTimeout(function () { load(true); }, 1500);
window.NLAmici = { lenders: function () { return uid() && list ? friends().filter(function (x) { var f = fkeys[x.id]; return f && f.gb; }).length : 0; }, ownPart: ownPart, open: open, ff: openFF, keys: keyWin, askState: askState, ask: askKey, lends: function (id) { return !!outKey(id); }, hasOwn: function () { var o = ownKeys(); return !!(o.gb || o.sbn); }, hasAny: function () { var o = ownKeys(), b = borrowed(); return !!(o.gb || (b && b.gb)); }, lentCount: function () { return uid() && list ? lentCount() : -1; }, lentText: lentText, offers: function () { var b = borrowed(); return keys.filter(function (k) { return k.a === uid() && !(b && b.da === k.da); }).map(function (k) { return { nome: k.nome, gb: !!k.gb_key, sbn: !!k.sbn }; }); }, load: load, onLoad: function (fn) { loaded.push(fn); }, friend: openFriend, guest: openGuest, swapSheet: swapSheet, keySheet: keySheet, dropSheet: dropSheet, nums: function (id) { return nums[id] || null; },
  acts: function (id) { var own = ownKeys(); return { swap: swapsWith(id).length > 0, key: !!(own.gb || own.sbn), lent: outKey(id) ? lentLabel(outKey(id)) : '' }; },   // icone del profilo dell'amico (giro 6)
  guestId: function () { return NL.guest && NL.guest() ? gId : null; }, follow: follow, friendName: friendName, rpc: rpc, uid: uid, state: function () { return { me: me, list: list, invite: invite, swaps: swaps, asks: asks, keys: keys, who: who }; } };   // per le prove
})();
