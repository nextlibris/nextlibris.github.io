/* Next Libris · modulo «Amici» (16/11/2026, nella copia di prova).
   Amicizia reciproca: chiedi, l'altro accetta o rifiuta. Il nome dell'app («Libreria di Piero») e' anche il nome per gli amici:
   unico (senza badare alle maiuscole), 3-20 caratteri (lettere anche accentate, numeri, spazi, punto, trattino, apostrofo).
   Ci si trova cercando il nome (da 3 lettere: uguale o che comincia cosi') o con il link d'invito (…/?amico=Nome).
   Dove si vede: parte «Amici» nel Menu, icona accanto all'ingranaggio con il numero delle richieste, avviso in cima (prima degli altri).
   Le richieste si leggono all'apertura e tornando all'app (niente email, niente Realtime: limiti del piano gratuito di Supabase).
   Desideri: «Gli amici vedono i miei desideri» (spento di partenza); la pagina di un amico mostra i suoi desideri e «Te lo regalo io»
   (lui non lo vede, gli altri amici si'). Prestiti e regali: in «Presta, vendi o regala» si sceglie un amico; il libro compare subito
   nella sua Libreria con «Prestato da …» / «Regalato da …» (un regalo che era tra i suoi desideri ci passa); la restituzione la segna
   chiunque dei due e vale per entrambi. Scelte di Piero del 16/11/2026.
   Database: supabase/002_amicizie.sql, 003_nome_unico.sql, 004_desideri_scambi.sql (ramo prove). Usa window.NL e window.NLSocial (social.js). */
(function () {
'use strict';
var NL = window.NL, S = window.NLSocial; if (!NL || !S || !S.call) return;
var esc = NL.esc, K_INV = 'catalogo-libri-amici-invito', K_SEEN = 'catalogo-libri-amici-visti';
var NAME_RE = /^[0-9A-Za-zÀ-ÖØ-öø-ÿ ._'-]{3,20}$/;
var K_PEND = 'catalogo-libri-amici-scambi-da-mandare', K_GOT = 'catalogo-libri-amici-ricevuti';
var opts = false, nums = {};
var swaps = [], view = null, wishes = null, libs = null, libsShow = 30, libsQ = '', recvId = '', asks = [], tips = [], who = {}, gMeta = {}, gId = null;
var K_ANS = 'catalogo-libri-amici-risposte-viste', K_TIPS = 'catalogo-libri-amici-consigli-visti', K_KEY = 'catalogo-libri-amici-chiave-in-uso', K_KEYSEEN = 'catalogo-libri-amici-chiavi-viste';
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
  return 'Non ci riesco (' + m + '). Riprova tra poco.';
}

/* ---------- dati ---------- */
async function load(force) {
  if (!uid()) { me = null; list = null; paintAll(); return; }
  if (loading) return loading;
  if (!force && list && Date.now() - lastLoad < 60000) return;
  loading = (async function () {
    try {
      var p = await S.call('/rest/v1/profili?select=utente,nome,desideri,libreria&id=eq.' + encodeURIComponent(uid()), { user: true });
      me = (p && p[0]) || { utente: null, nome: '', desideri: false };
      list = (await rpc('miei_amici')) || [];
      try { nums = {}; ((await rpc('amici_numeri')) || []).forEach(function (x) { nums[x.id] = x; }); } catch (e) {}
      try { swaps = (await rpc('miei_scambi')) || []; await applySwaps(); } catch (e) { if (window.console) console.warn('scambi', e); }
      try { asks = (await rpc('mie_richieste')) || []; tips = (await rpc('miei_consigli')) || []; await loadWho(); seenAnswers(); } catch (e) { if (window.console) console.warn('richieste', e); }
      try { keys = (await rpc('chiavi_mie')) || []; checkKeys(); } catch (e) { if (window.console) console.warn('chiavi', e); }
      lastLoad = Date.now(); err = '';
      if (me.utente && NL.name() !== me.utente) { syncing = true; NL.setName(me.utente); syncing = false; }   // il nome per gli amici vale anche nell'app
    } catch (e) { err = nice(e); }
    loading = null; paintAll();
  })();
  return loading;
}
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
    var k = e.target.id === 'friWish' ? 'desideri' : e.target.id === 'friLib' ? 'libreria' : ''; if (!k) return;
    var on = e.target.checked, body = { id: uid() }; body[k] = on; e.target.disabled = true;
    try { await S.call('/rest/v1/profili?on_conflict=id', { method: 'POST', user: true, prefer: 'resolution=merge-duplicates,return=minimal', body: body });
      me[k] = on;
      NL.toast(k === 'desideri' ? (on ? 'I tuoi amici ora vedono i tuoi desideri.' : 'I tuoi desideri ora sono solo tuoi.') : (on ? 'I tuoi amici ora vedono la tua libreria.' : 'La tua libreria ora è solo tua.'));
      if (on) S.run && S.run(false); }
    catch (x) { e.target.checked = !on; NL.toast(nice(x)); }
    e.target.disabled = false;
  });
  return el;
}
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var el = document.getElementById('friSheet'); if (el && !el.hidden) close(); } });
async function open(asOpts) {
  var el = sheet(); confirmId = ''; err = ''; editName = false; view = null; wishes = null; opts = asOpts === true; el.hidden = false; seenAll(); paint();
  await load(true);
  if (invite && me && me.utente) await findInvite();
}
function close() { var el = document.getElementById('friSheet'); if (el) el.hidden = true; found = null; foundQ = ''; editName = false; view = null; wishes = null; opts = false; }
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
function row(x, btns) { return '<li class="fr-row"><span class="fr-who">' + nameOf(x) + '</span><span class="fr-act">' + btns + '</span></li>'; }
function nameForm(first) {
  var v = first ? tidy(NL.name()).slice(0, 20) : me.utente;
  return '<form id="friFormU" class="fr-form"><label class="field"><span>Il tuo nome</span><input type="text" id="friU" autocomplete="nickname" spellcheck="false" enterkeyhint="done" maxlength="20" required value="' + esc(v || '') + '"></label>' +
    '<p class="fr-small">Lo vedono i tuoi amici e chi riceve i libri che condividi; è lo stesso nome di «Libreria di …». ' + RULES + ' Deve essere diverso da quello degli altri.</p>' +
    (err ? '<p class="msg bad" id="friErr">' + esc(err) + '</p>' : '') +
    '<div class="row-btns">' + (first ? '' : '<button class="btn" type="button" data-f="name-no">Annulla</button>') + '<button class="btn primary" type="submit" id="friSaveU">Salva</button></div></form>';
}
function paint() {
  var body = document.getElementById('friBody'); if (!body || document.getElementById('friSheet').hidden) return;
  document.getElementById('friH').textContent = opts && !view ? 'Amici e privacy' : 'Amici';
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
    if (tips.length) h += '<section class="fr-sec"><h3 class="fr-h">Consigliati dagli amici <span class="fr-n">' + tips.length + '</span></h3><ul class="fr-list">' + tips.map(function (c) {
      var L0 = c.libro || {}, have = NL.isMine && NL.isMine({ t: L0.t || '', a: L0.a || '', i: L0.i || '' });
      return '<li class="fr-row fr-book">' + cover(L0) + '<span class="fr-bk"><b>' + esc(L0.t || 'un libro') + '</b><small>' + esc(L0.a || '') + (L0.a ? ' · ' : '') + 'da ' + esc(c.nome_da || 'un amico') + '</small></span><span class="fr-act">' +
        (have ? '<span class="fr-tag">Ce l\'hai già</span>' : '<button class="btn primary" type="button" data-f="tipwish" data-id="' + esc(c.id) + '">Ai desideri</button>') +
        '<button class="link" type="button" data-f="tipdrop" data-id="' + esc(c.id) + '">Togli</button></span></li>';
    }).join('') + '</ul></section>';
    h += '<section class="fr-sec"><h3 class="fr-h">I tuoi amici' + (fr.length ? ' <span class="fr-n">' + fr.length + '</span>' : '') + '</h3>';
    if (fr.length > 8) h += '<input type="search" class="fr-libq" data-pick-q placeholder="Cerca tra i tuoi amici" autocomplete="off" enterkeyhint="search">';
    h += fr.length ? '<ul class="fr-list fr-pick-list">' + fr.slice().sort(function (a, b) { return (a.utente || '').localeCompare(b.utente || '', 'it'); }).map(function (x) {
      var nn = nums[x.id] || {}, info = [];
      if (nn.comuni != null) info.push(nn.comuni + (nn.comuni === 1 ? ' amico' : ' amici') + ' in comune');
      if (nn.libri != null) info.push(nn.libri + (nn.libri === 1 ? ' libro' : ' libri') + ' in comune');
      return '<li class="fr-row fr-go"><button class="fr-who fr-open" type="button" data-f="friend" data-id="' + esc(x.id) + '">' + nameOf(x) + '<small>' + esc(info.join(' · ') || 'Guarda la sua libreria') + '</small></button><span class="n" aria-hidden="true">›</span></li>';
    }).join('') + '</ul>' : '<p class="fr-small">Ancora nessuno: cercalo per nome qui sotto, oppure mandagli il tuo invito.</p>';
    h += '</section>';
    h += '<section class="fr-sec"><h3 class="fr-h">Aggiungi un amico</h3><form id="friFormQ" class="fr-q"><input type="search" id="friQ" placeholder="Il suo nome (almeno 3 lettere)" autocomplete="off" spellcheck="false" enterkeyhint="search" value="' + esc(foundQ && foundQ !== invite ? foundQ : '') + '"><button class="btn" type="submit">Cerca</button></form>';
    if (found && foundQ && foundQ !== invite) h += found.length ? '<ul class="fr-list">' + found.map(function (x) { return row(x, relBtn(x)); }).join('') + '</ul>' : '<p class="fr-small">Nessuno con un nome così.</p>';
    if (err) h += '<p class="msg bad" id="friErr">' + esc(err) + '</p>';
    h += '<button class="btn fr-invite" type="button" data-f="invite">Invita un amico</button></section>';
    if (se.length) h += '<section class="fr-sec"><h3 class="fr-h">Richieste che hai mandato</h3><ul class="fr-list">' + se.map(function (x) {
      return row(x, '<span class="fr-tag">In attesa</span><button class="link" type="button" data-f="drop" data-id="' + esc(x.id) + '">Annulla</button>');
    }).join('') + '</ul></section>';
    h += '<button class="link fr-optlink" type="button" data-f="opts">Il tuo nome, chi vede cosa, chiave e worker › Impostazioni degli amici</button>';
  }
  body.innerHTML = h;
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
    try { found = (await rpc('cerca_utenti', { q: q })) || []; foundQ = q; } catch (x) { err = nice(x); }
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
  if (a === 'friend') { close(); openGuest(id); return; }
  if (a === 'tipwish' || a === 'tipdrop') { tipAct(a, id); return; }
  if (a === 'keyshare' || a === 'keyuse' || a === 'keyoff') { keyAct(a, id); return; }
  if (a === 'askyes' || a === 'askno') { askAnswer(id, a === 'askyes'); return; }
  if (a === 'back') { view = null; wishes = null; libs = null; confirmId = ''; paint(); return; }
  if (a === 'more') { libsShow += 30; var l = document.getElementById('friLibList'); if (l) l.innerHTML = libList(); return; }
  if (a === 'cancel') { confirmId = ''; paint(); return; }
  b.disabled = true; err = '';
  try {
    if (a === 'ask') {
      busy = b.dataset.u;
      var st = await rpc('chiedi_amicizia', { utente: b.dataset.u });
      NL.toast(st === 'amici' ? 'Ora siete amici.' : 'Richiesta mandata a ' + b.dataset.u + '.');
      if (invite && b.dataset.u.toLowerCase() === invite.toLowerCase()) { invite = null; wr(K_INV, null); }
      (found || []).forEach(function (x) { if (x.utente === b.dataset.u) x.rel = st === 'amici' ? 'amici' : 'inviata'; });
    } else if (a === 'yes' || a === 'no') {
      await rpc('rispondi_amicizia', { da: id, accetta: a === 'yes' });
      NL.toast(a === 'yes' ? 'Ora siete amici.' : 'Richiesta rifiutata.');
      (found || []).forEach(function (x) { if (x.id === id) x.rel = a === 'yes' ? 'amici' : ''; });
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
async function shareInvite() {
  if (!uid() || !me || !me.utente) { open(); return; }
  var link = S.home() + '?amico=' + encodeURIComponent(me.utente);
  var text = 'Sono ' + me.utente + ' su Next Libris: aggiungimi tra gli amici. ' + link;
  if (navigator.share) { try { await navigator.share({ text: text }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(text); NL.toast('Link d\'invito copiato: incollalo in un messaggio.'); }
  catch (e) { NL.toast(link); }
}

/* ---------- avviso in cima (prima degli altri avvisi: .lay-first) ---------- */
function fresh() { var seen = rd(K_SEEN) || []; return received().filter(function (x) { return seen.indexOf(x.id) < 0; }); }
function paintNote() {
  var nuove = fresh(), box = document.getElementById('friNote');
  if (!box) {
    if (!nuove.length) return;
    var anchor = document.getElementById('nxBox') || document.getElementById('donAsk') || document.getElementById('list'); if (!anchor) return;
    box = document.createElement('section'); box.id = 'friNote'; box.className = 'fri-note lay-note lay-first'; box.hidden = true;
    box.innerHTML = '<button type="button" class="fn-open" id="friNoteGo"><span class="fn-ico" aria-hidden="true">' + ICON + '</span><span class="fn-t"><b id="friNoteT"></b><small>Tocca per rispondere</small></span><span class="fn-go">Vedi</span></button>' +
      '<button type="button" class="ico" id="friNoteX" aria-label="Più tardi">×</button>';
    anchor.parentNode.insertBefore(box, anchor);
    box.querySelector('#friNoteGo').addEventListener('click', function () { open(); });
    box.querySelector('#friNoteX').addEventListener('click', function () { seenAll(); NL.summary && NL.summary(); });
  }
  box.hidden = !nuove.length;
  if (!nuove.length) return;
  var x = nuove[0];
  document.getElementById('friNoteT').textContent = nuove.length === 1 ? (x.utente || x.nome || '?') + ' vuole essere tuo amico' : nuove.length + ' richieste di amicizia';
}
function seenAll() { wr(K_SEEN, received().map(function (x) { return x.id; })); paintNote(); }

/* ---------- icona in alto, accanto all'ingranaggio, con il numero delle richieste ---------- */
function paintTop() {
  var b = document.getElementById('btnFri');
  if (!b) {
    var gear = document.getElementById('btnOpts'); if (!gear) return;
    b = document.createElement('button'); b.type = 'button'; b.id = 'btnFri'; b.className = 'ico fri-top';
    b.innerHTML = ICON + '<span class="fri-badge" id="btnFriN" hidden></span>';
    gear.parentNode.insertBefore(b, gear);
    document.documentElement.classList.add('has-fri');
    b.addEventListener('click', function () { open(); });
  }
  var n = received().length;
  var badge = document.getElementById('btnFriN'); badge.hidden = !n; badge.textContent = n > 9 ? '9+' : n || '';
  b.setAttribute('aria-label', n ? 'Amici: ' + n + (n === 1 ? ' richiesta' : ' richieste') : 'Amici');
  b.title = 'Amici';
}

/* ---------- parte «Amici» nel Menu, subito sotto Filtri, Suggerimenti, Statistiche ---------- */
function paintMenu() {
  var m = document.getElementById('friMenu');
  if (!m) {
    var top = document.querySelector('#drawerOpts .dmain'); if (!top) return;
    var h = document.createElement('h3'); h.id = 'friMenuH'; h.textContent = 'Amici';
    m = document.createElement('div'); m.className = 'dlist dmenu'; m.id = 'friMenu';
    m.innerHTML = '<button type="button" class="dopt dgo" id="goFri"><span><b>I tuoi amici</b><small id="goFriTxt"></small></span><span class="dbadge" id="goFriN" hidden></span><span class="n" aria-hidden="true">›</span></button>' +
      '<button type="button" class="dopt dgo" id="goInv"><span><b>Invita un amico</b><small>Manda il tuo link: con un tocco ti chiede l\'amicizia</small></span><span class="n" aria-hidden="true">›</span></button>';
    top.parentNode.insertBefore(h, top.nextSibling); h.parentNode.insertBefore(m, h.nextSibling);
    m.querySelector('#goFri').addEventListener('click', function () { NL.closeDrawer(); setTimeout(open, 60); });
    m.querySelector('#goInv').addEventListener('click', function () { NL.closeDrawer(); setTimeout(shareInvite, 60); });
  }
  var t, rec = received().length, fr = friends().length;
  if (!uid()) t = 'Entra con il tuo account per trovare gli amici';
  else if (!me || !list) t = 'Richieste e amici';
  else if (!me.utente) t = 'Scegli il nome con cui ti trovano';
  else t = (rec ? rec + (rec === 1 ? ' richiesta per te' : ' richieste per te') + ' · ' : '') + (fr ? fr + (fr === 1 ? ' amico' : ' amici') : 'Ancora nessun amico');
  document.getElementById('goFriTxt').textContent = t;
  var n = document.getElementById('goFriN'); n.hidden = !rec; n.textContent = rec || '';
}
function paintAll() { paint(); paintMenu(); paintNote(); paintTop(); paintSet(); }
function paintSet() {
  var set = document.getElementById('setList'); if (!set) return;
  var b = document.getElementById('goFriOpt');
  if (!b) {
    var after = set.querySelector('.dopt[data-sec="share"]');
    b = document.createElement('button'); b.type = 'button'; b.id = 'goFriOpt'; b.className = 'dopt dgo';
    b.innerHTML = '<span><b>Amici e privacy</b><small>Il tuo nome, chi vede libreria e desideri, chiave e worker con gli amici</small></span><span class="n" aria-hidden="true">›</span>';
    set.insertBefore(b, after ? after.nextSibling : null);
    b.addEventListener('click', function () { NL.closeDrawer(); setTimeout(function () { open(true); }, 60); });
  }
}
NL.on('options', function (sec) {
  if (sec !== 'share') return;
  var btn = document.getElementById('svcShareBtn'); if (!btn || document.getElementById('optFriKeys')) return;
  var d = document.createElement('div'); d.id = 'optFriKeys'; d.className = 'opt-fri';
  d.innerHTML = '<button class="btn primary" type="button">Con un amico su Next Libris</button><p class="hint">Li usate tutti e due; smetti quando vuoi. Oppure manda un link:</p>';
  btn.parentNode.insertBefore(d, btn);
  d.querySelector('button').addEventListener('click', function () { var o = document.querySelector('.opts:not([hidden]), #optSheet:not([hidden])'); open(true).then(function () { var k = document.getElementById('friKeys'); if (k) k.scrollIntoView(); }); });
});

/* ---------- link d'invito: …/?amico=Nome ---------- */
(function () {
  var q = new URLSearchParams(location.search), u = tidy(q.get('amico'));
  if (q.has('amico')) {
    q.delete('amico');
    try { history.replaceState(history.state, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); } catch (e) {}
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
  (lb.libri || []).forEach(function (x) { gMeta[x.id] = { fuori: !!x.fuori, w: false }; books.push(Object.assign(snapG(x), { id: x.id, rs: x.rs || '', rt: x.rt || 0, rd: x.rd || '', pp: x.pp || '', ts: Number(x.ts) || 0, w: false })); });
  (ws.libri || []).forEach(function (x) { gMeta[x.id] = { w: true, prenotato: x.prenotato || '' }; books.push(Object.assign(snapG(x), { id: x.id, ts: Number(x.ts) || 0, w: true })); });
  var info = { id: id, comuni: lb.comuni || 0, libVis: !!lb.visibili, wishVis: !!ws.visibili, totale: lb.totale || 0,
    empty: { lib: lb.visibili ? name + ' non ha ancora libri nella sua libreria.' : name + ' non mostra la sua libreria agli amici.', wish: ws.visibili ? 'La sua lista dei desideri è vuota.' : name + ' non mostra i suoi desideri agli amici.' } };
  NL.guestEnter(name, books, info);
}
function guestBar() {
  var g = NL.guest && NL.guest(), bar = document.getElementById('guestBar');
  if (!g) { if (bar) bar.hidden = true; return; }
  if (!bar) {
    var top = document.querySelector('header.top'); if (!top) return;
    bar = document.createElement('section'); bar.id = 'guestBar'; bar.className = 'guest-bar';
    top.parentNode.insertBefore(bar, top.nextSibling);
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('[data-g]'); if (!b) return;
      if (b.dataset.g === 'back') NL.guestExit();
      else if (b.dataset.g === 'notmine') NL.setFlt(NL.flt() === 'notmine' ? '' : 'notmine'), guestBar();
      else if (b.dataset.g === 'more') openFriend(gId);
      else if (b.dataset.g === 'key') keyAct('keyshare', gId).then(guestBar);
      else if (b.dataset.g === 'usekey') keyAct('keyuse', gId).then(guestBar);
    });
  }
  bar.hidden = false;
  var all = NL.books(), lib = all.filter(function (b) { return !b.w; }), inComune = lib.filter(function (b) { return NL.isMine(b); }).length;
  var now = lib.filter(function (b) { return b.rs === 'in'; }).slice(0, 3);
  var last = lib.filter(function (b) { return b.rs === 'ok'; }).sort(function (a, b) { return (b.rd || '') > (a.rd || '') ? 1 : (b.rd || '') < (a.rd || '') ? -1 : (b.ts || 0) - (a.ts || 0); }).slice(0, 5);   // prima chi ha la data di lettura
  var info = (window.__guestInfo || {}), comuni = info.comuni || 0;
  var h = '<div class="gb-top"><button type="button" class="link gb-back" data-g="back">‹ La tua libreria</button><button type="button" class="link gb-more" data-g="more">Prestiti, regali e altro</button></div>';
  h += '<p class="gb-num">' + comuni + (comuni === 1 ? ' amico' : ' amici') + ' in comune · ' + inComune + (inComune === 1 ? ' libro' : ' libri') + ' in comune</p>';
  if (now.length) h += '<p class="gb-line"><b>Sta leggendo</b> ' + now.map(function (b) {
    var tot = Number(b.pg) || 0, pp = Number(b.pp) || 0;
    return '«' + esc(b.t || 'senza titolo') + '»' + (pp ? ' <small>pagina ' + pp + (tot ? ' di ' + tot : '') + '</small>' : '');
  }).join(', ') + '</p>';
  if (last.length) h += '<p class="gb-line"><b>Letti di recente</b> ' + last.map(function (b) {
    var w = NL.L.rateWord ? NL.L.rateWord(b.rt) : ''; return '«' + esc(b.t || 'senza titolo') + '»' + (w ? ' <small>' + esc(w) + '</small>' : '');
  }).join(', ') + '</p>';
  var own = ownKeys(), sharing = keys.some(function (k) { return k.da === uid() && k.a === gId; }), fromHim = keys.filter(function (k) { return k.a === uid() && k.da === gId; })[0], b0 = borrowed();
  h += '<div class="chips gb-chips">' + (lib.length ? '<button type="button" class="chip todo" data-g="notmine" aria-pressed="' + (NL.flt() === 'notmine') + '">Solo quelli che non hai</button>' : '') +
    (own.gb || own.sbn ? '<button type="button" class="chip todo" data-g="key" aria-pressed="' + sharing + '">' + (sharing ? 'Condividi la tua chiave con lui ✓' : 'Condividi la tua chiave con lui') + '</button>' : '') +
    (fromHim && !(b0 && b0.da === gId) ? '<button type="button" class="chip todo" data-g="usekey">Usa la sua chiave</button>' : '') + '</div>';
  bar.innerHTML = h;
}
NL.on('guest', function (name) { if (name) { window.__guestInfo = null; } guestBar(); if (!name) { gId = null; gMeta = {}; load(true); } });
/* le info della libreria aperta (amici in comune): le passa openGuest prima di entrare */
var _enter = NL.guestEnter;
if (_enter) NL.guestEnter = function (name, books, info) { window.__guestInfo = info; var r = _enter(name, books, info); guestBar(); return r; };
/* sulla scheda di un suo libro: Aggiungi ai miei desideri / Ce l'hai anche tu / Me lo presti? / Te lo regalo io */
function guestActs(el) {
  if (!(NL.guest && NL.guest())) return;
  var cards = el.matches && el.matches('.row.open') ? [el] : Array.prototype.slice.call(el.querySelectorAll ? el.querySelectorAll('.row.open') : []);
  cards.forEach(function (card) {
    var id = card.dataset.id, b = NL.get(id), m = gMeta[id] || {}; if (!b) return;
    var old = card.querySelector('.cv-guest'); if (old) old.remove();
    card.classList.toggle('g-noread', !b.rs && !b.rt);   // non l'ha segnato: la striscia della lettura non serve
    var have = NL.isMine(b), inWish = mine().some(function (x) { return x.w && ((x.i && x.i === b.i) || (x.t && x.t === b.t)); });
    var ask = asks.filter(function (r) { return r.da === uid() && r.a === gId && r.libro_id === id && r.stato === 'attesa'; })[0];
    var h = '<p class="cvg-h">Di ' + esc(NL.guest()) + '</p><div class="cvg-row">';
    h += have ? '<span class="fr-tag fr-mine">Ce l\'hai anche tu</span>' : inWish ? '<span class="fr-tag">È nei tuoi desideri</span>' : '<button type="button" class="btn" data-g="addwish">Aggiungi ai miei desideri</button>';
    if (!m.w) h += m.fuori ? '<span class="fr-tag">Adesso è in prestito</span>' : ask ? '<span class="fr-tag">Richiesta mandata</span><button type="button" class="link" data-g="unask" data-r="' + esc(ask.id) + '">Annulla</button>' : '<button type="button" class="btn primary" data-g="ask">Me lo presti?</button>';
    if (m.w) h += m.prenotato === 'io' ? '<span class="fr-tag fr-mine">Lo regali tu</span><button type="button" class="link" data-g="ungift">Annulla</button>' : m.prenotato ? '<span class="fr-tag">Lo regala ' + esc(m.prenotato) + '</span>' : '<button type="button" class="btn primary" data-g="gift">Te lo regalo io</button>';
    h += '</div>' + (m.w ? '<p class="fr-small">' + esc(NL.guest()) + ' non vede chi gli farà un regalo; gli altri amici sì.</p>' : '');
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
    else if (a === 'ask') { await rpc('chiedi_prestito', { amico: gId, libro_id: id }); asks = (await rpc('mie_richieste')) || []; NL.toast('Richiesta mandata a ' + name + '.'); }
    else if (a === 'unask') { await rpc('annulla_richiesta', { id: x.dataset.r }); asks = (await rpc('mie_richieste')) || []; NL.toast('Richiesta annullata.'); }
    else if (a === 'gift' || a === 'ungift') { await rpc('prenota_regalo', { amico: gId, libro: id, si: a === 'gift' }); m.prenotato = a === 'gift' ? 'io' : ''; NL.toast(a === 'gift' ? 'Segnato: lo regali tu. ' + name + ' non lo vede.' : 'Non lo regali più.'); }
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
/* chi chiede vede la risposta (una volta) */
function seenAnswers() {
  var seen = rd(K_ANS) || [], nuove = asks.filter(function (r) { return r.da === uid() && r.stato !== 'attesa' && seen.indexOf(r.id) < 0; });
  nuove.forEach(function (r) { NL.toast(r.stato === 'accettata' ? (r.nome_a || 'Il tuo amico') + ' ti presta «' + ((r.libro && r.libro.t) || 'il libro') + '»: è nella tua Libreria.' : (r.nome_a || 'Il tuo amico') + ' ora non può prestarti «' + ((r.libro && r.libro.t) || 'il libro') + '».'); });
  if (nuove.length) wr(K_ANS, seen.concat(nuove.map(function (r) { return r.id; })).slice(-200));
  paintAsk(); paintTip();
}
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

/* ---------- consigli: dalla condivisione di un libro, a un amico dell'app ---------- */
function paintTip() {
  var seen = rd(K_TIPS) || [], n = tips.filter(function (c) { return seen.indexOf(c.id) < 0; }), box = document.getElementById('friTip');
  if (!box) {
    if (!n.length) return;
    var anchor = document.getElementById('nxBox') || document.getElementById('donAsk') || document.getElementById('list'); if (!anchor) return;
    box = document.createElement('section'); box.id = 'friTip'; box.className = 'fri-note lay-note lay-first'; box.hidden = true;
    box.innerHTML = '<button type="button" class="fn-open" id="friTipGo"><span class="fn-ico" aria-hidden="true">' + ICON + '</span><span class="fn-t"><b id="friTipT"></b><small>Tocca per vederlo</small></span><span class="fn-go">Vedi</span></button>' +
      '<button type="button" class="ico" id="friTipX" aria-label="Ho visto">×</button>';
    anchor.parentNode.insertBefore(box, anchor);
    var seenAll2 = function () { wr(K_TIPS, tips.map(function (c) { return c.id; })); paintTip(); };
    box.querySelector('#friTipGo').addEventListener('click', function () { seenAll2(); open(); });
    box.querySelector('#friTipX').addEventListener('click', function () { seenAll2(); NL.summary && NL.summary(); });
  }
  box.hidden = !n.length; if (!n.length) return;
  document.getElementById('friTipT').textContent = n.length === 1 ? (n[0].nome_da || 'Un amico') + ' ti consiglia «' + ((n[0].libro && n[0].libro.t) || 'un libro') + '»' : n.length + ' libri consigliati dagli amici';
}
async function tipAct(a, id) {
  var c = tips.filter(function (x) { return x.id === id; })[0]; if (!c) return;
  if (a === 'tipwish') { NL.addMine(Object.assign(snapG(c.libro || {}), { w: true, fr: c.nome_da || '' })); NL.toast('Aggiunto ai tuoi desideri.'); }
  try { await rpc('togli_consiglio', { id: id }); } catch (e) {}
  tips = tips.filter(function (x) { return x.id !== id; }); paint(); paintTip();
}
var shareSel = {};
function paintShareFriends(books) {
  var sh = document.getElementById('shareSheet'), form = document.getElementById('shareForm'); if (!sh || !form) return;
  var fr = uid() ? friends() : [], one = books && books.length === 1 ? books[0] : null, app = !!(one && fr.length);
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
      var r = e.target.closest('[data-share]');
      if (r) { var id = r.dataset.share; shareSel[id] = !shareSel[id]; r.setAttribute('aria-pressed', shareSel[id] ? 'true' : 'false'); goBtn(); return; }
      if (!e.target.closest('#shareAppGo') || !box.__b) return;
      var ids = Object.keys(shareSel).filter(function (k) { return shareSel[k]; }); if (!ids.length) return;
      var go = document.getElementById('shareAppGo'); go.disabled = true; go.textContent = 'Mando…';
      var ok = 0;
      for (var i = 0; i < ids.length; i++) { try { await rpc('consiglia', { a: ids[i], libro: snap(box.__b) }); ok++; } catch (x) { NL.toast(nice(x)); } }
      if (ok) { NL.toast(ok === 1 ? 'Consigliato ' + aChi(friendName(ids[0])) + ': lo trova nella sua app.' : 'Consigliato a ' + ok + ' amici: lo trovano nella loro app.'); document.getElementById('shareClose').click(); }
      else { go.disabled = false; goBtn(); }
    });
  }
  function goBtn() { var n = Object.keys(shareSel).filter(function (k) { return shareSel[k]; }).length, g = document.getElementById('shareAppGo'); if (!g) return; g.disabled = !n; g.textContent = n > 1 ? 'Consiglia a ' + n + ' amici' : 'Consiglia'; }
  box.hidden = !app; document.getElementById('shareAppClose').hidden = !app;
  ext.open = !app; ext.classList.toggle('only', !app);
  if (!app) return;
  shareSel = {}; box.__b = one;
  box.innerHTML = '<h3 class="fr-h">Consiglialo a un amico</h3><p class="fr-small">Lo trova nella sua app di Next Libris, tra i consigliati: niente link da mandare.</p>' +
    pickerHTML(fr, 'data-share', function () { return false; }, null) + '<button class="btn primary" type="button" id="shareAppGo" disabled>Consiglia</button>';
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
      return '<div class="cvg-row"><b>' + esc(x.utente) + '</b>' + (x.fuori ? '<span class="fr-tag">Adesso è in prestito</span>' : ask ? '<span class="fr-tag">Richiesta mandata</span>' : '<button type="button" class="btn primary" data-w="' + esc(x.amico) + '" data-l="' + esc(x.libro_id) + '">Me lo presti?</button>') + '</div>';
    }).join('');
    box.addEventListener('click', async function (e) {
      e.stopPropagation(); var x = e.target.closest('[data-w]'); if (!x) return; x.disabled = true;
      try { await rpc('chiedi_prestito', { amico: x.dataset.w, libro_id: x.dataset.l }); asks = (await rpc('mie_richieste')) || []; NL.toast('Richiesta mandata.'); }
      catch (y) { NL.toast(nice(y)); }
      NL.refreshRow(card.dataset.id);
    });
    card.appendChild(box);
  });
}

/* ---------- Impostazioni degli amici: nome, chi vede cosa, chiave e worker ---------- */
function optsView() {
  var h = '<button class="link fr-back" type="button" data-f="optsback">‹ Amici</button>';
  h += '<div class="fr-me"><span class="fr-me-n"><small>Il tuo nome</small><b>' + esc(me.utente) + '</b></span><button class="link" type="button" data-f="name">Cambia</button></div>';
  h += '<section class="fr-sec"><h3 class="fr-h">Chi vede cosa</h3><div class="fr-share"><label class="check fr-wish"><input type="checkbox" id="friLib"' + (me.libreria ? ' checked' : '') + '><span>Gli amici vedono la mia libreria<small>Titolo, autore, copertina, genere, editore, anno, pagine, serie, lettura e voto. Note, citazioni, appunti, prezzi, scaffali e prestiti restano tuoi.</small></span></label>' +
    '<label class="check fr-wish"><input type="checkbox" id="friWish"' + (me.desideri ? ' checked' : '') + '><span>Gli amici vedono i miei desideri<small>Così sanno cosa regalarti; chi ti farà un regalo resta una sorpresa.</small></span></label></div></section>';
  h += keysHTML(true);
  h += '<p class="fr-small">Gli altri vedono solo il tuo nome. Il resto, solo se lo scegli qui.</p>';
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
document.addEventListener('input', function (e) {
  if (!e.target.hasAttribute || !e.target.hasAttribute('data-pick-q')) return;
  var q = e.target.value.trim().toLowerCase(), box = e.target.parentNode;
  Array.prototype.forEach.call(box.querySelectorAll('.fr-pick-row, .fr-go'), function (r) { r.hidden = q && r.textContent.toLowerCase().indexOf(q) < 0; });
});

/* ---------- chiave Google e worker SBN condivisi con un amico: li usano tutti e due (Piero, 16/11/2026) ---------- */
function borrowed() { return rd(K_KEY); }                      // { da, nome, gb, sbn } se stai usando quelli di un amico
function ownKeys() { var st = NL.settings || {}, b = borrowed() || {}; return { gb: st.gbKey && st.gbKey !== b.gb ? st.gbKey : '', sbn: st.sbnUrl && st.sbnUrl !== b.sbn ? st.sbnUrl : '' }; }
function keysHTML(full) {
  var own = ownKeys(), fr = friends(), out = keys.filter(function (k) { return k.da === uid(); }), inn = keys.filter(function (k) { return k.a === uid(); }), b = borrowed(), h = '';
  if ((own.gb || own.sbn) && fr.length) {
    h += '<p class="fr-small">Condividi ' + (own.gb && own.sbn ? 'la tua chiave Google e il tuo worker SBN' : own.gb ? 'la tua chiave Google' : 'il tuo worker SBN') + ' con un amico: li usate tutti e due e lui troverà più libri. Tocca un amico per condividere o smettere.</p>' +
      pickerHTML(fr, 'data-f="keyshare" data-id', function (x) { return out.some(function (k) { return k.a === x.id; }); }, function (x) { return out.some(function (k) { return k.a === x.id; }) ? 'La usa anche lui' : ''; });
  }
  inn.forEach(function (k) {
    var using = b && b.da === k.da, what = k.gb_key && k.sbn ? 'la sua chiave Google e il worker SBN' : k.gb_key ? 'la sua chiave Google' : 'il suo worker SBN';
    h += '<div class="fr-row fr-key"><span class="fr-who">' + esc(k.nome) + ' condivide con te ' + what + (using ? '<small>La stai usando</small>' : (own.gb && k.gb_key) || (own.sbn && k.sbn) ? '<small>Hai già i tuoi: usandoli prendono il loro posto</small>' : '') + '</span><span class="fr-act">' +
      (using ? '<button class="link" type="button" data-f="keyoff" data-id="' + esc(k.da) + '">Non usarla più</button>' : '<button class="btn primary" type="button" data-f="keyuse" data-id="' + esc(k.da) + '">Usala</button>') + '</span></div>';
  });
  if (!h && full) h = '<p class="fr-small">Non hai ancora una chiave Google o un worker SBN da condividere: si impostano in Menu › Impostazioni › Ricerca dei libri. Se un amico condivide i suoi con te, li trovi qui.</p>';
  return h ? '<section class="fr-sec" id="friKeys"><h3 class="fr-h">Chiave Google e worker SBN</h3>' + h + '</section>' : '';
}
function setKeys(gb, sbn) { var st = NL.settings; if (!st) return; st.gbKey = gb || ''; st.sbnUrl = sbn || ''; NL.saveSettings && NL.saveSettings(); }
async function keyAct(a, id) {
  try {
    if (a === 'keyshare') {
      var on = keys.some(function (k) { return k.da === uid() && k.a === id; }), own = ownKeys();
      if (on) { await rpc('riprendi_chiavi', { a: id }); NL.toast('Non la condividi più con ' + friendName(id) + '.'); }
      else { await rpc('presta_chiavi', { a: id, gb_key: own.gb, sbn: own.sbn }); NL.toast('Condivisa con ' + friendName(id) + ': la usate tutti e due.'); }
    } else if (a === 'keyuse') {
      var k = keys.filter(function (x) { return x.a === uid() && x.da === id; })[0]; if (!k) return;
      var b = borrowed(), st = NL.settings || {};
      if (!b) wr('catalogo-libri-amici-chiavi-mie', { gb: st.gbKey || '', sbn: st.sbnUrl || '' });   // le tue, da rimettere quando smetti
      setKeys(k.gb_key || st.gbKey, k.sbn || st.sbnUrl);
      wr(K_KEY, { da: k.da, nome: k.nome, gb: k.gb_key || '', sbn: k.sbn || '' });
      NL.toast('Ora usi ' + (k.gb_key ? 'la chiave' : 'il worker') + ' di ' + k.nome + '.');
    } else if (a === 'keyoff') { stopBorrow(''); }
  } catch (e) { NL.toast(nice(e)); }
  try { keys = (await rpc('chiavi_mie')) || []; } catch (e) {}
  paint();
}
function stopBorrow(msg) {
  var b = borrowed(); if (!b) return;
  var st = NL.settings || {}, back = rd('catalogo-libri-amici-chiavi-mie') || {};
  setKeys(st.gbKey === b.gb ? back.gb : st.gbKey, st.sbnUrl === b.sbn ? back.sbn : st.sbnUrl);
  wr(K_KEY, null); wr('catalogo-libri-amici-chiavi-mie', null);
  NL.toast(msg || 'Non usi più quelli di ' + b.nome + '.');
}
function checkKeys() {
  var b = borrowed(), inn = keys.filter(function (k) { return k.a === uid(); });
  if (b) {
    var k = inn.filter(function (x) { return x.da === b.da; })[0];
    if (!k) stopBorrow(b.nome + ' non condivide più la sua chiave: torni alle tue impostazioni.');
    else if ((k.gb_key || '') !== b.gb || (k.sbn || '') !== b.sbn) { var st = NL.settings || {}; setKeys(k.gb_key || st.gbKey, k.sbn || st.sbnUrl); wr(K_KEY, { da: k.da, nome: k.nome, gb: k.gb_key || '', sbn: k.sbn || '' }); }
  }
  var seen = rd(K_KEYSEEN) || [], nuove = inn.filter(function (k) { return seen.indexOf(k.da) < 0; });
  if (nuove.length) { NL.toast(nuove[0].nome + ' condivide con te la sua chiave per cercare i libri: la trovi in Amici.'); wr(K_KEYSEEN, seen.concat(nuove.map(function (k) { return k.da; }))); }
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
  if (b.sx && !same) { var oldSx = b.sx; b.sx = ''; NL.save(); try { await rpc('chiudi_scambio', { id: oldSx }); } catch (e) {} }
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
  try { await rpc('chiudi_scambio', { id: x }); } catch (e) {}
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
  var me_ = uid(), books = mine(), changed = false, got = [];
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
        changed = true; got.push(s);
      }
      try { await rpc('segna_visto', { id: s.id }); } catch (e) {}
    }
    if (s.tipo === 'prestito' && local && s.a === me_ && !local.xs) {           // restituzione: «da confermare» o rifiutata
      if (s.stato === 'reso' && local.sk === 'p') { local.sk = 'q'; changed = true; }
      if (s.stato === 'aperto' && local.sk === 'q') { local.sk = 'p'; changed = true; NL.toast((s.nome_da || 'Il tuo amico') + ' dice di non avere ancora ricevuto «' + (local.t || 'il libro') + '».'); }
    }
    if (s.stato === 'chiuso' && s.tipo === 'prestito' && local) {
      if (s.a === me_ && (local.sk === 'p' || local.sk === 'q') && !local.xs) { local.xs = 'b'; local.xa = local.sda || s.nome_da || ''; local.xd = String(s.chiuso || '').slice(0, 10) || NL.today(); changed = true;
        NL.toast((s.nome_da || 'Il tuo amico') + ' ha segnato «' + (local.t || 'il libro') + '» come restituito.'); }
      if (s.da === me_ && local.p) { local.p = ''; local.pd = ''; local.sx = ''; changed = true;
        NL.toast((s.nome_a || 'Il tuo amico') + ' ti ha restituito «' + (local.t || 'il libro') + '».'); }
    }
  }
  if (changed) { NL.save(); NL.refresh(); }
  if (got.length) { var g = (rd(K_GOT) || []).concat(got.map(function (s) { return { id: s.id, t: (s.libro && s.libro.t) || '', da: s.nome_da || '', k: s.tipo, lid: s._lid || '' }; })).slice(-20); wr(K_GOT, g); }
  var p = pend(); if (p.length) { setPend([]); p.forEach(function (x) { sendSwap(x.id, x.kind, x.who, null); }); }
  paintGot(); paintRet();
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
/* avviso in cima: «Anna ti ha prestato «X»: è nella tua Libreria» */
function paintGot() {
  var g = rd(K_GOT) || [], box = document.getElementById('friGot');
  if (!box) {
    if (!g.length) return;
    var anchor = document.getElementById('nxBox') || document.getElementById('donAsk') || document.getElementById('list'); if (!anchor) return;
    box = document.createElement('section'); box.id = 'friGot'; box.className = 'fri-note lay-note lay-first'; box.hidden = true;
    box.innerHTML = '<button type="button" class="fn-open" id="friGotGo"><span class="fn-ico" aria-hidden="true">' + ICON + '</span><span class="fn-t"><b id="friGotT"></b><small id="friGotS"></small></span><span class="fn-go">Apri</span></button>' +
      '<button type="button" class="ico" id="friGotX" aria-label="Ho visto">×</button>';
    box.querySelector('#friGotGo').addEventListener('click', function () {      // apre la scheda del libro arrivato (Piero, 16/11/2026)
      var g2 = rd(K_GOT) || [], x = g2.pop(); wr(K_GOT, g2.length ? g2 : null); paintGot();
      if (x && x.lid && NL.showBook && NL.showBook(x.lid)) return;
      var b = x && mine().filter(function (y) { return y.sx === x.id; })[0]; if (b && NL.showBook) NL.showBook(b.id);
    });
    anchor.parentNode.insertBefore(box, anchor);
    box.querySelector('#friGotX').addEventListener('click', function () { wr(K_GOT, null); paintGot(); NL.summary && NL.summary(); });
  }
  box.hidden = !g.length;
  if (!g.length) return;
  var x = g[g.length - 1];
  document.getElementById('friGotT').textContent = g.length === 1 ? x.da + (x.k === 'prestito' ? ' ti ha prestato «' : ' ti ha regalato «') + x.t + '»' : g.length + ' libri da amici: prestiti e regali';
  document.getElementById('friGotS').textContent = g.length === 1 ? 'Tocca per aprire la sua scheda: è nella tua Libreria' : 'Tocca per aprire l\'ultimo; sono tutti nella tua Libreria';
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
paintTop();
if (uid()) setTimeout(function () { load(true); }, 1500);
window.NLAmici = { open: open, load: load, friend: openFriend, guest: openGuest, state: function () { return { me: me, list: list, invite: invite, swaps: swaps, asks: asks, tips: tips, keys: keys, who: who }; } };   // per le prove
})();
