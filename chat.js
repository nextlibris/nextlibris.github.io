/* Next Libris · modulo «Chat» (giro 9b e 9c, 18/11/2026, nella copia di prova). Scelte di Piero in claude/giro-9-chat-scelte.md.
   Fumetto in testata (tra campanella e Amici) con il numero delle chat con messaggi nuovi e delle richieste.
   Elenco delle chat con le «Richieste di messaggio» in una riga a parte; chat aperta con i miei messaggi a destra.
   Tenendo premuto un messaggio: Copia · Elimina per tutti (i miei, entro 1 ora) · Segnala (quelli degli altri).
   Menu ⋮: Silenzia · Profilo · Blocca · Elimina chat (solo per me). Niente segno «letto».
   Quasi in diretta senza Realtime: con la chat aperta l'app chiede i messaggi nuovi ogni 15 secondi; altrimenti il numero
   arriva con il giro degli amici (ogni ~3 minuti, chat_numeri). Tutto passa dalle funzioni del database (supabase/023_chat.sql).
   Gruppi (9c): «+ Nuova» › Nuovo gruppo (nome + amici da spuntare, una schermata); «Info gruppo» dal nome in cima o dal ⋮:
   membri (⋮: Profilo · Scrivi · Togli, solo per chi l'ha creato), + Aggiungi amici, ✎ nome (solo chi l'ha creato), Silenzia, Esci.
   Usa window.NL, window.NLSocial (social.js), window.NLAmici (amici.js) e, se c'è, window.NLProfilo (foto). */
(function () {
'use strict';
var NL = window.NL, S = window.NLSocial; if (!NL || !S || !S.call) return;
var esc = NL.esc, K = 'catalogo-libri-chat';
var POLL = 15000, MAX = 1000;
var chats = rd(K) || [], nums = { nuovi: 0, richieste: 0 }, lastList = 0, loadingList = null;
var gsel = {}, gname = '', glim = 29, gm = null, gmErr = '';                          // gruppi: scelti, nome, posti liberi, membri
var view = 'list', cur = null, msgs = [], info = null, more = false, draftTo = null, timer = 0, sending = false, depth = 0;
var CHAT = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z"/></svg>';
var SEND = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12l16-8-6 16-2.5-6.5z"/><path d="M11.5 13.5L20 4"/></svg>';

function rd(k) { try { return JSON.parse(NL.ls.get(k) || 'null'); } catch (e) { return null; } }
function wr(k, v) { try { NL.ls.set(k, v == null ? '' : JSON.stringify(v)); } catch (e) {} }
function rpc(name, body) { return S.call('/rest/v1/rpc/' + name, { method: 'POST', user: true, body: body || {} }); }
function uid() { var a = S.auth(); return a && a.uid; }
function $(id) { return document.getElementById(id); }
function av(id, name) { return window.NLProfilo && window.NLProfilo.avatar ? window.NLProfilo.avatar(id, name) : '<span class="pf-av" aria-hidden="true">' + esc((String(name || '?').trim()[0] || '?').toUpperCase()) + '</span>'; }
function ini(name) {                                  // iniziali del gruppo: le prime due parole che contano («Lettori di gialli» → LG)
  var w = String(name || '').split(/[^0-9A-Za-zÀ-ÿ]+/).filter(Boolean), big = w.filter(function (x) { return x.length > 2; });
  if (big.length) w = big;
  return ((w[0] || '?')[0] + (w[1] ? w[1][0] : '')).toUpperCase();
}
function grpAv(name) { return '<span class="pf-av ch-gav" style="--pf-h:' + (NL.hue ? NL.hue(name || '') : 150) + '" aria-hidden="true">' + esc(ini(name)) + '</span>'; }
function friends() {
  var A = window.NLAmici; return ((A && A.state && A.state().list) || []).filter(function (x) { return x.stato === 'amici'; })
    .sort(function (a, b) { return (a.utente || '').localeCompare(b.utente || '', 'it'); });
}
function nlTag(on) { return on ? ' <span class="ch-nl" title="Next Libris">Next Libris</span>' : ''; }
function isFriend(id) { var A = window.NLAmici, l = A && A.state && A.state().list; return !!(l && l.some(function (x) { return x.id === id && x.stato === 'amici'; })); }
function nice(e) {
  var m = String(e && e.message || e);
  if (e && e.code === 'net') return m;
  var T = {
    'in attesa': 'Hai già mandato una richiesta: aspetta che risponda.',
    'non disponibile': 'Non puoi scrivere a questa persona.',
    'sospeso': 'La tua chat è sospesa: non puoi scrivere messaggi.',
    'fermo': 'Per ora non puoi mandare richieste a chi non è tuo amico: l\'amministratore sta controllando.',
    'troppe richieste oggi': 'Oggi hai mandato tante richieste: riprova domani.',
    'messaggio vuoto': 'Il messaggio è vuoto.',
    'messaggio troppo lungo': 'Il messaggio è troppo lungo: al massimo 1.000 caratteri.',
    'troppi messaggi': 'Troppi messaggi: aspetta un momento.',
    'non si può più eliminare': 'È passata più di un\'ora: non si può più eliminare.',
    'non segnalabile': 'Questo messaggio non si può segnalare.',
    'troppe segnalazioni oggi': 'Oggi hai già fatto tante segnalazioni: riprova domani.',
    'troppe persone bloccate': 'Hai bloccato troppe persone: sbloccane qualcuna.',
    'richiesta non trovata': 'La richiesta non c\'è più.',
    'nome: da 1 a 40': 'Scrivi un nome per il gruppo (al massimo 40 caratteri).',
    'scegli almeno un amico': 'Scegli almeno un amico.',
    'al massimo 30 persone': 'Un gruppo può avere al massimo 30 persone.',
    'non amici': 'Nel gruppo puoi aggiungere solo i tuoi amici.',
    'troppi gruppi oggi': 'Oggi hai creato tanti gruppi: riprova domani.',
    'solo chi ha creato il gruppo': 'Può farlo solo chi ha creato il gruppo.' };
  for (var k in T) if (m.indexOf(k) >= 0) return T[k];
  return 'Non ci riesco: riprova tra poco.';
}

/* ---------- ore e giorni ---------- */
function hm(t) { var d = new Date(t); return isNaN(d) ? '' : d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }); }
function dayKey(t) { var d = new Date(t); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }
function dayLabel(t) {
  var d = new Date(t), now = new Date(), y = new Date(now); y.setDate(now.getDate() - 1);
  if (dayKey(d) === dayKey(now)) return 'Oggi';
  if (dayKey(d) === dayKey(y)) return 'Ieri';
  return d.toLocaleDateString('it-IT', d.getFullYear() === now.getFullYear() ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' });
}
function when(t) {                                   // nell'elenco: ora di oggi, «ieri», giorno
  var l = dayLabel(t); return l === 'Oggi' ? hm(t) : l === 'Ieri' ? 'ieri' : new Date(t).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

/* ---------- fumetto in testata, tra la campanella e Amici ---------- */
function paintTop() {
  var b = $('btnChat');
  if (!uid()) { if (b) b.hidden = true; document.documentElement.classList.remove('has-chat'); return; }
  if (!b) {
    var next = $('btnFri') || $('btnOpts'); if (!next) return;
    b = document.createElement('button'); b.type = 'button'; b.id = 'btnChat'; b.className = 'ico ch-top'; b.title = 'Chat';
    b.innerHTML = CHAT + '<span class="nt-badge" id="btnChatN" hidden></span>';
    next.parentNode.insertBefore(b, next);
    b.addEventListener('click', function () { open(); });
  }
  b.hidden = false; document.documentElement.classList.add('has-chat');
  var n = (Number(nums.nuovi) || 0) + (Number(nums.richieste) || 0), badge = $('btnChatN');
  badge.hidden = !n; badge.textContent = n > 9 ? '9+' : n || '';
  b.setAttribute('aria-label', n ? 'Chat: ' + n + ' con messaggi nuovi' : 'Chat');
}
async function loadNums() {
  if (!uid()) return;
  try { var r = await rpc('chat_numeri'); if (r) nums = { nuovi: r.nuovi || 0, richieste: r.richieste || 0 }; }
  catch (e) { if (window.console) console.warn('chat', e); }
  paintTop();
  var el = $('chSheet'); if (el && !el.hidden && view !== 'conv' && Date.now() - lastList > 20000) loadList();
}
function numsFromList() {
  nums = { nuovi: chats.filter(function (c) { return c.stato !== 'richiesta' && c.nuovi > 0; }).length,
           richieste: chats.filter(function (c) { return c.stato === 'richiesta' && c.nuovi > 0; }).length };
  paintTop();
}
async function loadList() {
  if (!uid()) return;
  if (loadingList) return loadingList;
  loadingList = (async function () {
    try { chats = (await rpc('chat_mie')) || []; lastList = Date.now(); wr(K, chats.slice(0, 100)); numsFromList(); }
    catch (e) { if (window.console) console.warn('chat', e); if (!chats.length) chats.err = nice(e); }
    loadingList = null; paint();
  })();
  return loadingList;
}

/* ---------- finestra ---------- */
function sheet() {
  var el = $('chSheet'); if (el) return el;
  el = document.createElement('div'); el.className = 'sheet ch'; el.id = 'chSheet'; el.hidden = true;
  el.innerHTML = '<div class="sheet-in" role="dialog" aria-modal="true" aria-labelledby="chH"><div class="ch-head" id="chHead"></div><div class="ch-body" id="chBody"></div><div class="ch-foot" id="chFoot"></div></div>';
  document.body.appendChild(el);
  el.addEventListener('click', onClick);
  el.addEventListener('input', function (e) {
    if (e.target.id === 'chTxt') grow(e.target);
    if (e.target.id === 'chGName') { gname = e.target.value; gBtn(); }
    if (e.target.id === 'chBQ') { pickQ = e.target.value; paintBookList(); }
    if (e.target.id === 'chBTxt') { var bc = $('chBCount'); if (bc) { var bn = e.target.value.length; bc.hidden = bn < MAX - 100; bc.textContent = bn + ' / ' + MAX; } }
    if (e.target.id === 'chNewQ') { var v = e.target.value.toLowerCase(); Array.prototype.forEach.call(document.querySelectorAll('#chNewL li'), function (li) { li.hidden = v && li.textContent.toLowerCase().indexOf(v) < 0; }); }
  });
  el.addEventListener('change', function (e) { var g = e.target.dataset && e.target.dataset.g; if (g) { if (e.target.checked) gsel[g] = 1; else delete gsel[g]; gBtn(); } });
  el.addEventListener('keydown', function (e) { if (e.target.id === 'chTxt' && e.key === 'Enter' && !e.shiftKey && window.matchMedia('(hover:hover) and (pointer:fine)').matches) { e.preventDefault(); send(); } });
  el.addEventListener('contextmenu', function (e) { var m = e.target.closest('.ch-msg[data-m]'); if (m) { e.preventDefault(); msgMenu(m.dataset.m); } });
  var pt = 0, px = 0, py = 0;
  el.addEventListener('pointerdown', function (e) {
    var m = e.target.closest('.ch-msg[data-m]'); if (!m) return;
    px = e.clientX; py = e.clientY; clearTimeout(pt);
    pt = setTimeout(function () { pt = 0; longAt = Date.now(); if (navigator.vibrate) try { navigator.vibrate(15); } catch (x) {} msgMenu(m.dataset.m); }, 500);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) { el.addEventListener(t, function () { clearTimeout(pt); }); });
  el.addEventListener('pointermove', function (e) { if (Math.abs(e.clientX - px) + Math.abs(e.clientY - py) > 10) clearTimeout(pt); });
  return el;
}
function grow(t) { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 140) + 'px'; var c = $('chCount'); if (c) { var n = t.value.length; c.hidden = n < MAX - 100; c.textContent = n + ' / ' + MAX; c.classList.toggle('bad', n > MAX); } }
function pushBack(state) { try { history.pushState(Object.assign({}, history.state || {}, { chat: state }), ''); depth++; } catch (e) {} }   // Indietro del telefono: chat › elenco › fuori
async function open() {
  if (!uid()) { if (S.open) S.open(); return; }
  var el = sheet(); view = 'list'; cur = null; draftTo = null; stop();
  if (!el.hidden) { paint(); return loadList(); }
  el.hidden = false; document.documentElement.classList.add('ch-open'); pushBack('list'); paint();
  await loadList();
}
function close(fromBack) {
  var el = $('chSheet'); if (!el || el.hidden) return;
  el.hidden = true; document.documentElement.classList.remove('ch-open'); stop(); cur = null; draftTo = null; view = 'list'; closeMenu(); closeBook();
  if (!fromBack && depth) { var d = depth; depth = 0; try { history.go(-d); } catch (e) {} }
  if (fromBack) depth = 0;
}
window.addEventListener('popstate', function (e) {
  var el = $('chSheet'); if (!el || el.hidden) return;
  var st = e.state && e.state.chat;
  depth = st === 'gadd' ? 4 : st === 'ginfo' || st === 'bpick' ? 3 : st === 'conv' ? 2 : st === 'list' ? 1 : 0;
  var want = { conv: 'conv', ginfo: 'ginfo', gadd: 'gadd', bpick: 'bpick' }[view];
  if ($('chBk')) { closeBook(); if (want && st !== want) pushBack(want); return; }                  // prima si chiude la schedina del libro
  if ($('chMenu')) { closeMenu(); if (want && st !== want) pushBack(want); else if (!st) pushBack('list'); return; }   // prima si chiude il menu
  if (view === 'gadd' && st === 'ginfo') { view = 'ginfo'; paint(); loadMembers(); return; }          // Aggiungi amici › Info gruppo
  if (view === 'bpick' && st === 'conv') { view = 'conv'; paintConv('end'); return; }                // Manda un libro › chat
  if ((view === 'ginfo' || view === 'gadd') && st === 'conv') { view = 'conv'; paintConv('end'); read(); return; }   // Info gruppo › chat
  if (view === 'conv' && st === 'list') { toList(true); return; }
  if (!st && (view === 'req' || view === 'new' || view === 'grp')) { view = 'list'; paint(); pushBack('list'); return; }   // dalle richieste si torna all'elenco
  if (!st) close(true);
});
function toList(fromBack) {
  stop(); cur = null; draftTo = null; msgs = []; info = null;
  view = view === 'conv' && fromBack !== 'req' && curWasReq ? 'req' : 'list'; curWasReq = false;
  if (!fromBack && depth > 1) { try { history.back(); } catch (e) {} return; }
  paint(); loadList();
}
var curWasReq = false, longAt = 0;

/* ---------- disegno ---------- */
function paint() {
  var el = $('chSheet'); if (!el || el.hidden) return;
  if (view === 'conv') return paintConv();
  if (view === 'grp' || view === 'gadd') return paintPick();
  if (view === 'ginfo') return paintInfo();
  if (view === 'bpick') return paintBookPick();
  var head = $('chHead'), body = $('chBody'), foot = $('chFoot'), h = '';
  if (view === 'req') {
    head.innerHTML = '<button class="ico ch-back" type="button" data-c="list" aria-label="Indietro">‹</button><h2 id="chH">Richieste di messaggio</h2><button class="ico ch-x" type="button" data-c="close" aria-label="Chiudi">×</button>';
    var rq = chats.filter(function (c) { return c.stato === 'richiesta'; });
    h = '<p class="fr-small ch-note">Messaggi di chi non è tuo amico. Chi te li ha mandati non sa se li hai letti; se rifiuti, non lo viene a sapere.</p>';
    h += rq.length ? '<ul class="ch-list">' + rq.map(rowHTML).join('') + '</ul>' : '<p class="ch-empty">Nessuna richiesta.</p>';
    body.innerHTML = h; foot.innerHTML = ''; return;
  }
  head.innerHTML = '<h2 id="chH">Chat</h2><button class="btn ch-new" type="button" data-c="new">+ Nuova</button><button class="ico ch-x" type="button" data-c="close" aria-label="Chiudi">×</button>';
  if (view === 'new') {
    head.innerHTML = '<button class="ico ch-back" type="button" data-c="list" aria-label="Indietro">‹</button><h2 id="chH">Scrivi a…</h2><button class="ico ch-x" type="button" data-c="close" aria-label="Chiudi">×</button>';
    var A = window.NLAmici, fr = ((A && A.state && A.state().list) || []).filter(function (x) { return x.stato === 'amici'; })
      .sort(function (a, b) { return (a.utente || '').localeCompare(b.utente || '', 'it'); });
    h = fr.length ? (fr.length > 8 ? searchBox() : '') +
      '<ul class="ch-list" id="chNewL">' + fr.map(function (x) { return '<li><button type="button" class="ch-row" data-c="to" data-id="' + esc(x.id) + '" data-n="' + esc(x.utente || x.nome || '') + '">' + av(x.id, x.utente) + '<span class="ch-t"><b>' + esc(x.utente || x.nome || '') + '</b></span></button></li>'; }).join('') + '</ul>'
      : '<p class="ch-empty">Non hai ancora amici. Puoi scrivere anche a chi non è tuo amico dal suo nome, in Amici › «Aggiungi un amico».</p>';
    body.innerHTML = h; foot.innerHTML = '';
    return;
  }
  var reqs = chats.filter(function (c) { return c.stato === 'richiesta'; }), rest = chats.filter(function (c) { return c.stato !== 'richiesta'; });
  if (reqs.length) {
    var rn = reqs.filter(function (c) { return c.nuovi > 0; }).length;
    h += '<button type="button" class="ch-reqs" data-c="reqs"><span>Richieste di messaggio <span class="fr-n">' + reqs.length + '</span></span>' + (rn ? '<span class="ch-dot" aria-label="nuove"></span>' : '') + '<span class="n" aria-hidden="true">›</span></button>';
  }
  if (rest.length) h += '<ul class="ch-list">' + rest.map(rowHTML).join('') + '</ul>';
  else if (chats.err) h += '<p class="msg bad">' + esc(chats.err) + '</p>';
  else if (!reqs.length) h += lastList ? '<p class="ch-empty">Nessuna chat per ora.<br>Tocca <b>+ Nuova</b> per scrivere a un amico, oppure «Scrivi» nel suo profilo.</p>' : '<p class="ch-empty">Un momento…</p>';
  body.innerHTML = h; foot.innerHTML = '';
}
function lastText(c) {
  var u = c.ultimo; if (!u) return '';
  if (u.el) return '<i>Messaggio eliminato</i>';
  var mine = u.da === uid(), pre = mine ? 'Tu: ' : c.tipo === 'gruppo' && u.nome ? esc(u.nome) + ': ' : '';
  if (u.tipo === 'libro' || u.tipo === 'consiglio') return pre + '📚 ' + esc(u.libro || 'un libro');
  if (u.tipo === 'sistema') return '<i>' + esc(sysText(u)) + '</i>';
  return pre + esc(u.testo || '');
}
function rowHTML(c) {
  var name = c.nome || (c.tipo === 'gruppo' ? 'Gruppo' : 'Senza nome'), sub = c.stato === 'attesa' ? '<i>In attesa di risposta</i>' : lastText(c);
  return '<li><button type="button" class="ch-row' + (c.nuovi > 0 ? ' ch-unread' : '') + '" data-c="chat" data-id="' + esc(c.id) + '">' + (c.tipo === 'gruppo' ? grpAv(name) : av(c.altro, name)) +
    '<span class="ch-t"><span class="ch-l1"><b>' + esc(name) + '</b>' + nlTag(c.nl) + (c.silenziata ? '<span class="ch-mute" title="Silenziata" aria-label="silenziata">🔕</span>' : '') + '<small>' + esc(c.ultimo ? when(c.ultimo.creato) : '') + '</small></span>' +
    '<span class="ch-l2"><span class="ch-last">' + sub + '</span>' + (c.nuovi > 0 ? '<span class="ch-dot" aria-label="' + c.nuovi + ' nuovi"></span>' : '') + '</span></span></button></li>';
}
function sysText(m) {
  var who = m.nome || 'Qualcuno', su = m.su_nome || '';
  switch (m.testo) {
    case 'creato': return who + ' ha creato il gruppo';
    case 'aggiunto': return who + ' ha aggiunto ' + (su || 'una persona');
    case 'tolto': return who + ' ha tolto ' + (su || 'una persona');
    case 'uscito': return who + ' ha lasciato il gruppo';
    case 'nome': return who + ' ha cambiato il nome del gruppo';
  }
  return '';
}

/* ---------- una chat aperta ---------- */
function curChat() { return cur ? chats.filter(function (c) { return c.id === cur; })[0] || null : null; }
async function openChat(id) {
  var el = sheet(); stop();
  var c = chats.filter(function (x) { return x.id === id; })[0];
  curWasReq = view === 'req'; view = 'conv'; cur = id; draftTo = null; msgs = []; info = null; more = false;
  if (el.hidden) { el.hidden = false; document.documentElement.classList.add('ch-open'); pushBack('list'); }
  pushBack('conv');
  paint();
  await read();
  if (c && c.nuovi) { c.nuovi = 0; wr(K, chats); numsFromList(); }
  start();
}
/* da fuori (profilo, amici, «chi ce l'ha»): apre la chat con questa persona, oppure una chat nuova da scrivere */
async function to(id, name) {
  if (!uid()) { if (S.open) S.open(); return; }
  if (!id || id === uid()) return;
  if (!lastList) await loadList();
  var c = chats.filter(function (x) { return x.tipo === 'due' && x.altro === id; })[0];
  if (c) return openChat(c.id);
  var p;
  try { p = await rpc('chat_posso', { altro: id }); } catch (e) { NL.toast(nice(e)); return; }
  var n = name || 'questa persona';
  if (p === 'attesa') { NL.toast('Hai già scritto a ' + n + ': aspetta che risponda.'); return; }
  if (p === 'no') { NL.toast(n + ' riceve messaggi solo da altre persone.'); return; }
  if (p === 'sospeso' || p === 'fermo') { NL.toast(nice({ message: p })); return; }
  var el = sheet(); stop();
  if (el.hidden) { el.hidden = false; document.documentElement.classList.add('ch-open'); pushBack('list'); }
  view = 'conv'; cur = null; draftTo = { id: id, nome: name || '', rich: p === 'richiesta' }; msgs = []; info = { scrivibile: true, stato: 'nuova' }; more = false; curWasReq = false;
  pushBack('conv'); paint();
  var t = $('chTxt'); if (t) t.focus();
}
async function read(older) {
  var id = cur; if (!id) return;
  try {
    var top = msgs.length ? msgs[msgs.length - 1].id : 0;
    var body = older ? { chat: id, prima: msgs.length ? msgs[0].id : null } : { chat: id, dopo: top };
    var r = await rpc('chat_leggi', body); if (cur !== id || !r) return;
    var got = (r.messaggi || []).filter(function (m) { return !m.nasc; });
    if (older) { msgs = got.concat(msgs); more = !!r.altri; }
    else {
      var seen = {}; msgs.forEach(function (m) { seen[m.id] = 1; });
      got.forEach(function (m) { if (!seen[m.id]) msgs.push(m); });
      if (!top) more = !!r.altri;
    }
    info = { scrivibile: !!r.scrivibile, stato: r.stato, tipo: r.tipo };
    var c = curChat(); if (c && r.stato) c.stato = r.stato;
    paintConv(older ? 'keep' : got.length ? 'end' : '');
  } catch (e) {
    if (cur !== id) return;
    if (/non disponibile/.test(String(e && e.message))) { NL.toast('Questa chat non c\'è più.'); toList(); return; }
    if (!msgs.length) { info = { err: nice(e) }; paintConv(); }
  }
}
/* aggiornamento su un messaggio già mostrato (eliminato da chi l'ha scritto): si rilegge l'ultima pagina ogni tanto */
var refreshN = 0;
async function refreshTail() {
  var id = cur; if (!id || !msgs.length) return;
  try {
    var r = await rpc('chat_leggi', { chat: id, dopo: 0 }); if (cur !== id || !r) return;
    var map = {}; (r.messaggi || []).forEach(function (m) { map[m.id] = m; });
    var ch = false; msgs.forEach(function (m, i) { var n = map[m.id]; if (n && n.el && !m.el) { msgs[i] = n; ch = true; } });
    var top = msgs[msgs.length - 1].id;
    (r.messaggi || []).forEach(function (m) { if (m.id > top && !m.nasc) { msgs.push(m); ch = true; } });
    if (info) { info.scrivibile = !!r.scrivibile; info.stato = r.stato; }
    if (ch) paintConv('end');
  } catch (e) {}
}
function start() {
  stop();
  timer = setInterval(function () {
    if (document.visibilityState !== 'visible' || view !== 'conv' || !cur) return;
    if (++refreshN % 8 === 0) refreshTail(); else read();      // ogni 2 minuti si guarda anche se qualcuno ha eliminato un messaggio
  }, POLL);
}
function stop() { clearInterval(timer); timer = 0; }
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && view === 'conv' && cur && $('chSheet') && !$('chSheet').hidden) read(); });

function convName() { var c = curChat(); return c ? c.nome : draftTo ? draftTo.nome : ''; }
function convOther() { var c = curChat(); return c ? c.altro : draftTo ? draftTo.id : null; }
function paintConv(scroll) {
  var el = $('chSheet'); if (!el || el.hidden || view !== 'conv') return;
  var head = $('chHead'), body = $('chBody'), foot = $('chFoot'), c = curChat(), name = convName(), other = convOther(), grp = c && c.tipo === 'gruppo';
  var sub = [grp && c.membri ? c.membri + ' persone' : '', c && c.silenziata ? 'Silenziata' : ''].filter(Boolean).join(' · ');
  head.innerHTML = '<button class="ico ch-back" type="button" data-c="back" aria-label="Indietro">‹</button>' +
    (grp ? '<button type="button" class="ch-who" data-c="ginfo" aria-label="Info gruppo">' + grpAv(name)
         : '<button type="button" class="ch-who" data-c="prof"' + (other && isFriend(other) ? '' : ' disabled') + '>' + av(other, name)) +
    '<span class="ch-wn"><b id="chH">' + esc(name || 'Chat') + '</b>' + nlTag(c && c.nl) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span></button>' +
    (c ? '<button class="ico ch-more" type="button" data-c="menu" aria-label="Altre azioni" aria-haspopup="true">⋮</button>' : '');
  var atEnd = body.scrollHeight - body.scrollTop - body.clientHeight < 60, oldH = body.scrollHeight, oldT = body.scrollTop;
  var h = '';
  if (info && info.err) h = '<p class="msg bad">' + esc(info.err) + '</p>';
  else if (!info) h = '<p class="ch-empty">Un momento…</p>';
  else {
    if (more) h += '<button class="link ch-older" type="button" data-c="older">Messaggi precedenti</button>';
    if (draftTo) h += '<p class="ch-empty">' + (draftTo.rich ? 'Non siete amici: il primo messaggio arriva a ' + esc(draftTo.nome || 'questa persona') + ' come <b>richiesta</b>. Finché non risponde non puoi mandarne altri.' : 'Scrivi il primo messaggio a ' + esc(draftTo.nome || 'questo amico') + '.') + '</p>';
    var lastDay = '';
    msgs.forEach(function (m) {
      var dk = dayKey(m.creato); if (dk !== lastDay) { lastDay = dk; h += '<p class="ch-day"><span>' + esc(dayLabel(m.creato)) + '</span></p>'; }
      h += msgHTML(m, c);
    });
  }
  body.innerHTML = h;
  if (scroll === 'keep') body.scrollTop = body.scrollHeight - oldH + oldT;
  else if (scroll === 'end' || atEnd || !scroll) body.scrollTop = body.scrollHeight;
  paintFoot(foot, c, name);
}
function msgHTML(m, c) {
  if (m.tipo === 'sistema') return '<p class="ch-sys">' + esc(sysText(m)) + '</p>';
  var mine = m.da === uid(), cls = 'ch-msg ' + (mine ? 'me' : 'it') + (m.el ? ' del' : '');
  var who = !mine && c && c.tipo === 'gruppo' ? '<b class="ch-from">' + esc(m.nome || '') + nlTag(m.nl) + '</b>' : '';
  var inner;
  if (m.el) inner = '<i>Messaggio eliminato</i>';
  else if ((m.tipo === 'libro' || m.tipo === 'consiglio') && m.libro) {
    var L = m.libro, img = /^https:\/\//.test(L.img || '') ? L.img : '';
    inner = (m.tipo === 'consiglio' ? '<small class="ch-k">' + (mine ? 'Consigliato da te' : 'Ti consiglia') + '</small>' : '') + '<button type="button" class="ch-book" data-c="bk" data-m="' + esc(String(m.id)) + '">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<span class="ch-bimg" aria-hidden="true">📚</span>') +
      '<span><b>' + esc(L.t || 'Un libro') + '</b>' + (L.a ? '<small>' + esc(L.a) + '</small>' : '') + '</span></button>' + (m.testo ? '<span class="ch-txt">' + esc(m.testo) + '</span>' : '');
  } else inner = '<span class="ch-txt">' + esc(m.testo || '') + '</span>';
  return '<div class="' + cls + '" data-m="' + esc(String(m.id)) + '" tabindex="0">' + who + inner + '<small class="ch-time">' + esc(hm(m.creato)) + '</small></div>';
}
function paintFoot(foot, c, name) {
  if (c && c.stato === 'richiesta') {
    foot.innerHTML = '<p class="ch-ask"><b>' + esc(name) + '</b> non è tra i tuoi amici e vuole scriverti. Se accetti potete scrivervi; se rifiuti non lo saprà.</p>' +
      '<div class="ch-askb"><button class="btn" type="button" data-c="no">Rifiuta</button><button class="btn primary" type="button" data-c="yes">Accetta</button></div>' +
      '<p class="ch-small"><button class="link" type="button" data-c="block">Blocca</button> · <button class="link" type="button" data-c="reportlast">Segnala</button></p>';
    return;
  }
  if (info && !info.err && !info.scrivibile) {
    var other = convOther(), t;
    if (c && c.bloccato) t = 'Hai bloccato ' + esc(name) + '. <button class="link" type="button" data-c="unblock">Sblocca</button>';
    else if (info.stato === 'attesa') t = 'Richiesta mandata: potrai scrivere ancora quando ' + esc(name) + ' risponde.';
    else if (info.stato === 'chiusa' || (other && !isFriend(other))) t = 'Non siete più amici: puoi leggere la chat, ma non scrivere.';
    else t = 'Non puoi scrivere in questa chat.';
    foot.innerHTML = '<p class="ch-ro">' + t + '</p>';
    return;
  }
  if (!info || info.err) { foot.innerHTML = ''; return; }
  var old = $('chTxt'), val = old ? old.value : '';
  if (old && foot.contains(old)) return;                    // non si ridisegna mentre si scrive
  foot.innerHTML = '<form class="ch-form" id="chForm"><button class="ch-bkbtn" type="button" data-c="bpick" aria-label="Manda un libro" title="Manda un libro">📚</button><textarea id="chTxt" rows="1" maxlength="' + (MAX + 200) + '" placeholder="Scrivi un messaggio…" aria-label="Messaggio" enterkeyhint="send"></textarea>' +
    '<button class="ch-send" type="submit" aria-label="Manda">' + SEND + '</button><small class="ch-count" id="chCount" hidden></small></form>';
  var t = $('chTxt'); t.value = val; grow(t);
  $('chForm').addEventListener('submit', function (e) { e.preventDefault(); send(); });
}
async function send() {
  var t = $('chTxt'); if (!t || sending) return;
  var v = t.value.trim(); if (!v) return;
  if (v.length > MAX) { NL.toast(nice({ message: 'messaggio troppo lungo' })); return; }
  sending = true; var btn = document.querySelector('#chForm .ch-send'); if (btn) btn.disabled = true;
  try {
    await write({ testo: v });
    t.value = ''; grow(t);
  } catch (e) { NL.toast(nice(e)); }
  sending = false; if (btn) btn.disabled = false;
  var t2 = $('chTxt'); if (t2) t2.focus();
}
/* scrive nella chat aperta (o nella chat nuova con draftTo): testo, oppure un libro con due righe facoltative */
async function write(body) {
    var r = cur ? await rpc('chat_scrivi', Object.assign({ chat: cur }, body)) : await rpc('chat_scrivi_a', Object.assign({ a: draftTo.id }, body));
    if (!cur && r && r.chat) {
      var d = draftTo; cur = r.chat; draftTo = null;
      chats.unshift({ id: r.chat, tipo: 'due', nome: d.nome, altro: d.id, stato: r.stato || 'attiva', nuovi: 0, ultimo: null });
      if (r.stato === 'attesa') NL.toast('Richiesta mandata a ' + (d.nome || 'questa persona') + '.');
      start();
    }
    await read();
    lastList = 0;
}

/* ---------- menu: un messaggio (tenuto premuto) o la chat (⋮) ---------- */
function closeMenu() { var m = $('chMenu'); if (m) m.remove(); }
function menu(items, title) {
  closeMenu();
  var m = document.createElement('div'); m.className = 'sheet ch-menu'; m.id = 'chMenu';
  m.innerHTML = '<div class="sheet-in" role="menu">' + (title ? '<p class="ch-mt">' + title + '</p>' : '') + items.map(function (x) {
    return '<button type="button" class="ch-mi' + (x.bad ? ' bad' : '') + '" role="menuitem" data-i="' + x.k + '">' + x.t + '</button>';
  }).join('') + '<button type="button" class="ch-mi ch-mc" data-i="x">Annulla</button></div>';
  document.body.appendChild(m); var at = Date.now();
  m.addEventListener('click', function (e) {
    if (e.target === m) { if (Date.now() - at > 700) closeMenu(); return; }   // il dito che si alza dopo «tenuto premuto» non lo richiude
    var b = e.target.closest('[data-i]'); if (!b) return;
    var it = items.filter(function (x) { return x.k === b.dataset.i; })[0]; closeMenu();
    if (it && it.go) it.go();
  });
  var f = m.querySelector('.ch-mi'); if (f) f.focus();
}
function msgMenu(id) {
  var m = msgs.filter(function (x) { return String(x.id) === String(id); })[0]; if (!m || m.tipo === 'sistema' || m.el) return;
  var mine = m.da === uid(), items = [];
  var txt = m.testo || (m.libro && m.libro.t) || '';
  if (txt) items.push({ k: 'copy', t: 'Copia', go: function () { copy(txt); } });
  if (mine && Date.now() - new Date(m.creato).getTime() < 3600000) items.push({ k: 'del', t: 'Elimina per tutti', bad: true, go: function () { delMsg(m); } });
  if (!mine && m.da && !m.nl) items.push({ k: 'rep', t: 'Segnala', bad: true, go: function () { report(m); } });
  if (!items.length) return;
  menu(items);
}
function copy(t) {
  var ok = function () { NL.toast('Copiato.'); };
  try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t).then(ok, function () { NL.toast('Non riesco a copiarlo.'); }); return; } } catch (e) {}
  NL.toast('Non riesco a copiarlo.');
}
async function delMsg(m) {
  try { await rpc('chat_elimina_messaggio', { id: m.id }); m.el = true; m.testo = ''; m.libro = null; paintConv('keep'); NL.toast('Messaggio eliminato.'); }
  catch (e) { NL.toast(nice(e)); }
}
function chatMenu() {
  var c = curChat(); if (!c) return;
  var name = c.nome || 'questa persona', items = [];
  if (c.tipo === 'gruppo') {
    items.push({ k: 'info', t: 'Info gruppo', go: openInfo });
    items.push({ k: 'mute', t: c.silenziata ? 'Riattiva gli avvisi' : 'Silenzia', go: function () { mute(c, !c.silenziata); } });
    items.push({ k: 'exit', t: 'Esci dal gruppo', bad: true, go: askExit });
    return menu(items);
  }
  items.push({ k: 'mute', t: c.silenziata ? 'Riattiva gli avvisi' : 'Silenzia', go: function () { mute(c, !c.silenziata); } });
  if (c.tipo === 'due' && c.altro && isFriend(c.altro) && window.NLProfilo) items.push({ k: 'prof', t: 'Profilo di ' + esc(name), go: function () { prof(c.altro); } });
  if (c.tipo === 'due' && c.altro) items.push(c.bloccato ? { k: 'unb', t: 'Sblocca ' + esc(name), go: function () { block(c.altro, name, false); } }
    : { k: 'blk', t: 'Blocca ' + esc(name), bad: true, go: function () { askBlock(c.altro, name); } });    // anche l'amministratore si può bloccare
  items.push({ k: 'del', t: 'Elimina chat', bad: true, go: function () { askDelChat(c); } });
  menu(items);
}
async function mute(c, on) {
  try { await rpc('chat_silenzia', { chat: c.id, si: on }); c.silenziata = on; wr(K, chats); paint(); NL.toast(on ? 'Chat silenziata: niente avvisi per questa chat.' : 'Avvisi riattivati.'); }
  catch (e) { NL.toast(nice(e)); }
}
function prof(id) { close(); setTimeout(function () { if (window.NLProfilo) window.NLProfilo.open(id); }, 60); }
function confirmBox(title, text, okT, go) {
  menu([{ k: 'ok', t: okT, bad: true, go: go }], '<b>' + title + '</b><br>' + text);
}
function askBlock(id, name) {
  confirmBox('Bloccare ' + esc(name) + '?', 'Non riceve nessun avviso. Non sarete più amici, non ti troverà con la ricerca e non potrà scriverti né chiederti l\'amicizia. Puoi togliere il blocco da Amici e privacy.', 'Blocca', function () { block(id, name, true); });
}
async function block(id, name, on) {
  try {
    await rpc('blocca', { altro: id, si: on });
    chats.forEach(function (c) { if (c.tipo === 'due' && c.altro === id) c.bloccato = on; });
    NL.toast(on ? 'Hai bloccato ' + name + '.' : 'Hai sbloccato ' + name + '.');
    var A = window.NLAmici; if (A && A.load) A.load(true);
    if (view === 'conv') await read(); else paint();
    lastList = 0;
  } catch (e) { NL.toast(nice(e)); }
}
function askDelChat(c) {
  confirmBox('Eliminare la chat?', 'Sparisce solo per te: per ' + esc(c.nome || 'gli altri') + ' resta. Se arriva un messaggio nuovo, la chat torna.', 'Elimina chat', async function () {
    try { await rpc('chat_elimina', { chat: c.id }); chats = chats.filter(function (x) { return x.id !== c.id; }); wr(K, chats); numsFromList(); NL.toast('Chat eliminata.'); toList(); }
    catch (e) { NL.toast(nice(e)); }
  });
}
async function answer(yes) {
  var c = curChat(); if (!c) return;
  try {
    await rpc('chat_rispondi', { chat: c.id, accetta: yes });
    if (yes) { c.stato = 'attiva'; curWasReq = false; NL.toast('Richiesta accettata: ora potete scrivervi.'); await read(); paintConv('end'); }
    else { chats = chats.filter(function (x) { return x.id !== c.id; }); wr(K, chats); numsFromList(); NL.toast('Richiesta rifiutata.'); toList(); }
  } catch (e) { NL.toast(nice(e)); }
}

/* ---------- gruppi (giro 9c) ---------- */
function searchBox() { return '<input type="search" class="fr-libq ch-q" id="chNewQ" placeholder="Cerca tra i tuoi amici" autocomplete="off">'; }
function newMenu() {
  menu([{ k: 'one', t: '✉ Scrivi a un amico', go: function () { view = 'new'; paint(); loadFriends(); } },
        { k: 'grp', t: '👥 Nuovo gruppo', go: function () { view = 'grp'; gsel = {}; gname = ''; glim = 29; paint(); loadFriends(); } }]);
}
function loadFriends() { var A = window.NLAmici; if (A && A.load && !(A.state().list)) A.load(true).then(paint); }
function nSel() { return Object.keys(gsel).length; }
/* una schermata con le caselle: «Nuovo gruppo» (nome + amici) oppure «Aggiungi amici» a un gruppo che c'è già */
function paintPick() {
  var head = $('chHead'), body = $('chBody'), foot = $('chFoot'), add = view === 'gadd', h = '';
  head.innerHTML = '<button class="ico ch-back" type="button" data-c="' + (add ? 'hist' : 'list') + '" aria-label="Indietro">‹</button><h2 id="chH">' + (add ? 'Aggiungi amici' : 'Nuovo gruppo') + '</h2><button class="ico ch-x" type="button" data-c="close" aria-label="Chiudi">×</button>';
  var inside = {}; (gm || []).forEach(function (m) { inside[m.id] = 1; });
  var fr = friends().filter(function (x) { return !add || !inside[x.id]; });
  if (!add) h += '<label class="ch-gl" for="chGName">Nome del gruppo</label><input type="text" id="chGName" class="ch-gname" maxlength="40" value="' + esc(gname) + '" placeholder="Per esempio: Lettori di gialli" autocomplete="off">';
  else h += '<p class="fr-small ch-note">Chi aggiungi vede i messaggi da quel momento in poi. Puoi aggiungere solo i tuoi amici.</p>';
  if (!fr.length) h += '<p class="ch-empty">' + (add ? 'Tutti i tuoi amici sono già nel gruppo.' : 'Per creare un gruppo servono degli amici: aggiungili da Amici › «Aggiungi un amico».') + '</p>';
  else {
    if (!add) h += '<p class="ch-gl">Scegli gli amici <small>(fino a 29)</small></p>';
    h += (fr.length > 8 ? searchBox() : '') + '<ul class="ch-list" id="chNewL">' + fr.map(function (x) {
      var n = x.utente || x.nome || '';
      return '<li><label class="ch-row ch-pick"><input type="checkbox" data-g="' + esc(x.id) + '"' + (gsel[x.id] ? ' checked' : '') + '>' + av(x.id, n) + '<span class="ch-t"><b>' + esc(n) + '</b></span></label></li>';
    }).join('') + '</ul>';
  }
  body.innerHTML = h;
  foot.innerHTML = fr.length ? '<button class="btn primary ch-gok" type="button" data-c="' + (add ? 'gaddok' : 'gmake') + '" id="chGOk"></button>' : '';
  gBtn();
}
function gBtn() {
  var b = $('chGOk'); if (!b) return;
  var n = nSel(), add = view === 'gadd';
  b.textContent = add ? (n ? 'Aggiungi (' + n + ')' : 'Aggiungi') : 'Crea il gruppo (' + (n + 1) + ')';
  b.disabled = !n || (!add && !gname.trim());
  var full = n >= glim;                                        // posti finiti: le altre caselle non si spuntano
  Array.prototype.forEach.call(document.querySelectorAll('#chNewL input[data-g]'), function (i) { i.disabled = full && !i.checked; });
  var q = document.querySelector('.ch-gfull'); if (full && !q && $('chNewL')) $('chNewL').insertAdjacentHTML('beforebegin', '<p class="fr-small ch-gfull">Il gruppo arriva a 30 persone: è pieno.</p>'); else if (!full && q) q.remove();
}
async function makeGroup(b) {
  var ids = Object.keys(gsel), nome = gname.trim();
  if (!nome) { NL.toast(nice({ message: 'nome: da 1 a 40' })); var i = $('chGName'); if (i) i.focus(); return; }
  b.disabled = true;
  try {
    var id = await rpc('gruppo_crea', { nome: nome, membri: ids });
    if (!id) throw new Error('');
    chats.unshift({ id: id, tipo: 'gruppo', nome: nome, membri: ids.length + 1, stato: 'attiva', nuovi: 0, ultimo: null });
    wr(K, chats.slice(0, 100)); gsel = {}; gname = ''; lastList = 0; view = 'list';
    NL.toast('Gruppo «' + nome + '» creato.');
    openChat(id);
  } catch (e) { b.disabled = false; NL.toast(nice(e)); }
}
/* Info gruppo: dal nome in cima alla chat o dal ⋮ */
function openInfo() {
  var c = curChat(); if (!c || c.tipo !== 'gruppo') return;
  view = 'ginfo'; gm = null; gmErr = ''; pushBack('ginfo'); paint(); loadMembers();
}
async function loadMembers() {
  var id = cur; if (!id) return;
  try { var r = await rpc('gruppo_membri', { chat: id }); if (cur !== id) return; gm = r || []; gmErr = ''; var c = curChat(); if (c) c.membri = gm.length; }
  catch (e) { if (cur !== id) return; if (/non disponibile/.test(String(e && e.message))) { NL.toast('Non fai più parte di questo gruppo.'); goList(); return; } gmErr = nice(e); }
  if (view === 'ginfo' || view === 'gadd') paint();
}
function amCapo() { var me = uid(); return !!(gm && gm.some(function (m) { return m.id === me && m.capo; })); }
function paintInfo() {
  var head = $('chHead'), body = $('chBody'), foot = $('chFoot'), c = curChat(), name = (c && c.nome) || 'Gruppo', me = uid(), capo = amCapo(), h = '';
  head.innerHTML = '<button class="ico ch-back" type="button" data-c="hist" aria-label="Indietro">‹</button><h2 id="chH">' + esc(name) + '</h2>' +
    (capo ? '<button class="ico ch-ren" type="button" data-c="gren" aria-label="Cambia il nome del gruppo" title="Cambia il nome">✎</button>' : '') +
    '<button class="ico ch-x" type="button" data-c="close" aria-label="Chiudi">×</button>';
  if (gmErr) h = '<p class="msg bad">' + esc(gmErr) + '</p>';
  else if (!gm) h = '<p class="ch-empty">Un momento…</p>';
  else {
    h += '<p class="ch-gn">' + gm.length + (gm.length === 1 ? ' persona' : ' persone') + '</p>';
    h += gm.length < 30 ? '<button class="btn ch-gadd" type="button" data-c="gadd">+ Aggiungi amici</button>' : '<p class="fr-small">Il gruppo è pieno: 30 persone.</p>';
    h += '<ul class="ch-list ch-mems">' + gm.map(function (m) {
      var n = m.utente || 'Senza nome', mine = m.id === me;
      return '<li class="ch-brow ch-mem">' + av(m.id, n) + '<span class="ch-mn"><b>' + esc(n) + (mine ? ' (tu)' : '') + nlTag(m.nl) + '</b>' +
        (m.capo ? '<small>ha creato il gruppo</small>' : '') + (m.bloccato ? '<small>Hai bloccato questa persona: i suoi messaggi sono nascosti</small>' : '') + '</span>' +
        (mine ? '' : '<button class="ico ch-more" type="button" data-c="gmem" data-id="' + esc(m.id) + '" aria-label="Altre azioni su ' + esc(n) + '">⋮</button>') + '</li>';
    }).join('') + '</ul>';
    h += '<div class="ch-gact"><button type="button" class="ch-mi" data-c="gmute">' + (c && c.silenziata ? '🔔 Riattiva gli avvisi' : '🔕 Silenzia gli avvisi') + '</button>' +
      '<button type="button" class="ch-mi bad" data-c="gexit">🚪 Esci dal gruppo</button></div>';
  }
  body.innerHTML = h; foot.innerHTML = '';
}
function memMenu(id) {
  var m = (gm || []).filter(function (x) { return x.id === id; })[0]; if (!m) return;
  var n = m.utente || 'questa persona', items = [];
  if (m.amico && window.NLProfilo) items.push({ k: 'prof', t: 'Profilo', go: function () { prof(id); } });
  if (!m.bloccato) items.push({ k: 'chat', t: 'Scrivi', go: function () { goList(function () { to(id, n); }); } });
  if (amCapo()) items.push({ k: 'out', t: 'Togli dal gruppo', bad: true, go: function () {
    confirmBox('Togliere ' + esc(n) + ' dal gruppo?', 'Non vedrà più i messaggi nuovi. Nel gruppo compare «… ha tolto ' + esc(n) + '».', 'Togli', async function () {
      try { await rpc('gruppo_togli', { chat: cur, utente: id }); NL.toast('Hai tolto ' + n + ' dal gruppo.'); loadMembers(); }
      catch (e) { NL.toast(nice(e)); }
    });
  } });
  if (items.length) menu(items, '<b>' + esc(n) + '</b>');
}
function rename() {
  var c = curChat(); if (!c) return;
  closeMenu();
  var el = document.createElement('div'); el.className = 'sheet ch-rep'; el.id = 'chMenu';
  el.innerHTML = '<div class="sheet-in" role="dialog" aria-modal="true" aria-labelledby="chRenH"><h2 id="chRenH">Nome del gruppo</h2>' +
    '<input type="text" id="chRen" class="ch-gname" maxlength="40" value="' + esc(c.nome || '') + '" autocomplete="off" aria-labelledby="chRenH">' +
    '<div class="row-btns"><button class="btn" type="button" data-r="x">Annulla</button><button class="btn primary" type="button" data-r="ok">Salva</button></div></div>';
  document.body.appendChild(el);
  var inp = $('chRen'); inp.focus(); inp.select();
  el.addEventListener('click', async function (e) {
    if (e.target === el) return closeMenu();
    var b = e.target.closest('[data-r]'); if (!b) return;
    if (b.dataset.r === 'x') return closeMenu();
    var v = inp.value.replace(/\s+/g, ' ').trim();
    if (!v) { NL.toast(nice({ message: 'nome: da 1 a 40' })); return; }
    if (v === c.nome) return closeMenu();
    b.disabled = true;
    try { await rpc('gruppo_nome', { chat: c.id, nome: v }); c.nome = v; wr(K, chats.slice(0, 100)); lastList = 0; closeMenu(); NL.toast('Nome cambiato.'); paint(); }
    catch (x) { b.disabled = false; NL.toast(nice(x)); }
  });
}
function askExit() {
  var c = curChat(); if (!c) return;
  var more = amCapo() && gm && gm.length > 1 ? ' Togliere persone e cambiare il nome passa a chi è nel gruppo da più tempo.' : '';
  confirmBox('Uscire da «' + esc(c.nome || 'questo gruppo') + '»?', 'Non riceverai più i messaggi del gruppo. Per tornare, qualcuno del gruppo dovrà aggiungerti di nuovo.' + more, 'Esci dal gruppo', async function () {
    try {
      await rpc('gruppo_esci', { chat: c.id });
      chats = chats.filter(function (x) { return x.id !== c.id; }); wr(K, chats.slice(0, 100)); numsFromList();
      NL.toast('Hai lasciato il gruppo.'); goList();
    } catch (e) { NL.toast(nice(e)); }
  });
}
async function addPicked(b) {
  var ids = Object.keys(gsel), id = cur, ok = 0, err = null; if (!ids.length || !id) return;
  b.disabled = true;
  for (var i = 0; i < ids.length; i++) {
    try { await rpc('gruppo_aggiungi', { chat: id, utente: ids[i] }); ok++; } catch (e) { err = e; break; }
  }
  if (err) NL.toast(nice(err));
  else NL.toast(ok === 1 ? 'Amico aggiunto al gruppo.' : 'Aggiunti ' + ok + ' amici al gruppo.');
  gsel = {}; lastList = 0;
  try { history.back(); } catch (e) { view = 'ginfo'; paint(); loadMembers(); }
}
/* da Info gruppo (o più dentro) all'elenco delle chat, poi eventualmente un'altra cosa (Scrivi) */
function goList(then) {
  stop(); var d = depth - 1;
  view = 'list'; cur = null; msgs = []; info = null; gm = null; curWasReq = false;
  var done = false, fin = function () { if (done) return; done = true; window.removeEventListener('popstate', fin); paint(); if (then) then(); else loadList(); };
  if (d > 0) { window.addEventListener('popstate', fin); setTimeout(fin, 600); try { history.go(-d); } catch (e) { fin(); } }
  else fin();
}

/* ---------- Segnala ---------- */
var MOTIVI = ['Offese o molestie', 'Spam o pubblicità', 'Contenuti non adatti', 'Altro'];
function report(m) {
  closeMenu();
  var name = m.nome || convName() || 'questa persona';
  var el = document.createElement('div'); el.className = 'sheet ch-rep'; el.id = 'chMenu';
  el.innerHTML = '<div class="sheet-in" role="dialog" aria-modal="true" aria-labelledby="chRepH"><h2 id="chRepH">Segnala il messaggio</h2>' +
    '<p class="fr-small">L\'amministratore di Next Libris vede questo messaggio e i 10 prima. ' + esc(name) + ' non saprà chi l\'ha segnalato.</p>' +
    '<fieldset class="choice ch-why"><legend>Perché?</legend>' + MOTIVI.map(function (t, i) { return '<label class="check"><input type="radio" name="chWhy" value="' + i + '"' + (i ? '' : ' checked') + '><span>' + esc(t) + '</span></label>'; }).join('') +
    '<input type="text" id="chWhyT" maxlength="250" placeholder="Scrivi qui (facoltativo)" autocomplete="off"></fieldset>' +
    '<label class="check"><input type="checkbox" id="chRepB" checked><span>Blocca anche ' + esc(name) + '</span></label>' +
    '<div class="row-btns"><button class="btn" type="button" data-r="x">Annulla</button><button class="btn primary" type="button" data-r="ok">Segnala</button></div></div>';
  document.body.appendChild(el);
  el.addEventListener('click', async function (e) {
    if (e.target === el) return closeMenu();
    var b = e.target.closest('[data-r]'); if (!b) return;
    if (b.dataset.r === 'x') return closeMenu();
    var i = Number((el.querySelector('input[name="chWhy"]:checked') || {}).value) || 0, t = ($('chWhyT').value || '').trim(), bl = $('chRepB').checked;
    var mot = MOTIVI[i] + (t ? ': ' + t : '');
    b.disabled = true;
    try {
      await rpc('segnala', { messaggio: m.id, motivo: mot, blocca: bl }); closeMenu();
      NL.toast(bl ? 'Grazie: segnalazione mandata. Hai bloccato ' + name + '.' : 'Grazie: segnalazione mandata.');
      if (bl) { chats.forEach(function (c) { if (c.tipo === 'due' && c.altro === m.da) c.bloccato = true; }); var A = window.NLAmici; if (A && A.load) A.load(true); if (view === 'conv') read(); }
    } catch (x) { b.disabled = false; NL.toast(nice(x)); }
  });
}
function reportLast() {                    // dalla richiesta di messaggio: si segnala l'ultimo messaggio dell'altra persona
  var mine = uid(), m = msgs.filter(function (x) { return x.da && x.da !== mine && x.tipo !== 'sistema' && !x.el; }).pop();
  if (m) report(m); else NL.toast('Non c\'è niente da segnalare.');
}

/* ---------- Persone bloccate (da Amici e privacy) ---------- */
async function blocked() {
  if (!uid()) return;
  closeMenu();
  var el = document.createElement('div'); el.className = 'sheet ch-blk'; el.id = 'chMenu';
  el.innerHTML = '<div class="sheet-in" role="dialog" aria-modal="true" aria-labelledby="chBlkH"><h2 id="chBlkH">Persone bloccate</h2><div id="chBlkB"><p class="ch-empty">Un momento…</p></div>' +
    '<div class="row-btns"><button class="btn" type="button" data-b="x">Chiudi</button></div></div>';
  document.body.appendChild(el);
  async function fill() {
    var box = $('chBlkB'); if (!box) return;
    try {
      var r = (await rpc('bloccati_miei')) || [];
      box.innerHTML = r.length ? '<p class="fr-small">Non ti trovano con la ricerca, non possono scriverti né chiederti l\'amicizia. Non sanno di essere bloccati.</p><ul class="ch-list">' + r.map(function (x) {
        return '<li class="ch-brow">' + av(x.id, x.utente) + '<b>' + esc(x.utente || 'Senza nome') + '</b><button class="btn" type="button" data-b="un" data-id="' + esc(x.id) + '" data-n="' + esc(x.utente || '') + '">Sblocca</button></li>';
      }).join('') + '</ul>' : '<p class="ch-empty">Non hai bloccato nessuno.</p>';
    } catch (e) { box.innerHTML = '<p class="msg bad">' + esc(nice(e)) + '</p>'; }
  }
  el.addEventListener('click', async function (e) {
    if (e.target === el) return closeMenu();
    var b = e.target.closest('[data-b]'); if (!b) return;
    if (b.dataset.b === 'x') return closeMenu();
    b.disabled = true;
    try { await rpc('blocca', { altro: b.dataset.id, si: false }); NL.toast('Hai sbloccato ' + b.dataset.n + '.'); chats.forEach(function (c) { if (c.altro === b.dataset.id) c.bloccato = false; }); lastList = 0; }
    catch (x) { NL.toast(nice(x)); }
    fill();
  });
  fill();
}

/* ---------- libri (giro 9d): 📚 nella chat, schedina del libro, consigli dalla finestra Condividi ---------- */
var BOOK_K = ['t', 'a', 'i', 'e', 'y', 'pg', 'img', 'gen', 'se', 'sn'];
var pickTab = 'lib', pickQ = '', pickSel = null;
function bookSnap(b) {                               // solo i campi che il server tiene (chat_libro); copertine solo da internet
  var o = {}; BOOK_K.forEach(function (k) { var v = b && b[k]; if (v != null && v !== '') o[k] = String(v); });
  if (o.img && !/^https:\/\//.test(o.img)) delete o.img;
  return o;
}
function myList() { return ((NL.myBooks && NL.myBooks()) || (NL.books && NL.books()) || []).filter(function (b) { return b && b.t && !b.xs && !!b.w === (pickTab === 'wish'); }); }
function fold(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function paintBookPick() {
  var head = $('chHead'), body = $('chBody');
  head.innerHTML = '<button class="ico ch-back" type="button" data-c="hist" aria-label="Indietro">‹</button><h2 id="chH">Manda un libro</h2><button class="ico ch-x" type="button" data-c="close" aria-label="Chiudi">×</button>';
  body.innerHTML = '<input type="search" class="fr-libq ch-q" id="chBQ" placeholder="Cerca titolo o autore" autocomplete="off" value="' + esc(pickQ) + '">' +
    '<div class="ch-btabs" role="tablist"><button type="button" class="ch-bt' + (pickTab === 'lib' ? ' on' : '') + '" data-c="btab" data-t="lib" role="tab" aria-selected="' + (pickTab === 'lib') + '">Libreria</button>' +
    '<button type="button" class="ch-bt' + (pickTab === 'wish' ? ' on' : '') + '" data-c="btab" data-t="wish" role="tab" aria-selected="' + (pickTab === 'wish') + '">Desideri</button></div>' +
    '<ul class="ch-list ch-blist" id="chBL"></ul>';
  paintBookList(); paintBookFoot();
}
function paintBookList() {
  var ul = $('chBL'); if (!ul) return;
  var q = fold(pickQ).trim(), all = myList().filter(function (b) { return !q || fold(b.t + ' ' + (b.a || '')).indexOf(q) >= 0; })
    .sort(function (x, y) { return (x.t || '').localeCompare(y.t || '', 'it'); }), list = all.slice(0, 80);
  if (!list.length) { ul.innerHTML = '<li class="ch-empty">' + (q ? 'Nessun libro trovato.' : pickTab === 'wish' ? 'Nei Desideri non hai ancora libri.' : 'In Libreria non hai ancora libri.') + '</li>'; return; }
  ul.innerHTML = list.map(function (b) {
    var img = /^https:\/\//.test(b.img || '') ? b.img : '', on = pickSel === b.id;
    return '<li><button type="button" class="ch-row ch-brow2' + (on ? ' on' : '') + '" data-c="bsel" data-id="' + esc(b.id) + '" aria-pressed="' + on + '">' +
      (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<span class="ch-bimg" aria-hidden="true">📚</span>') +
      '<span class="ch-t"><b>' + esc(b.t) + '</b>' + (b.a ? '<small>' + esc(b.a) + '</small>' : '') + '</span>' + (on ? '<span class="ch-ok" aria-hidden="true">✓</span>' : '') + '</button></li>';
  }).join('') + (all.length > list.length ? '<li class="fr-small ch-more-n">Altri ' + (all.length - list.length) + ': cerca per trovarli.</li>' : '');
}
function paintBookFoot() {
  var foot = $('chFoot'); if (!foot || view !== 'bpick') return;
  if (!pickSel) { foot.innerHTML = '<p class="fr-small ch-bhint">Tocca un libro per sceglierlo.</p>'; return; }
  if ($('chBTxt')) { var g = $('chBGo'); if (g) g.disabled = false; return; }
  foot.innerHTML = '<textarea id="chBTxt" class="ch-btxt" rows="2" maxlength="' + MAX + '" placeholder="Aggiungi due righe (facoltativo)" aria-label="Due righe sul libro"></textarea><small class="ch-count" id="chBCount" hidden></small>' +
    '<button class="btn primary ch-gok" type="button" data-c="bsend" id="chBGo">Manda</button>';
}
async function sendBook(btn) {
  var b = myList().filter(function (x) { return x.id === pickSel; })[0]; if (!b || sending) return;
  var t = $('chBTxt'), v = t ? t.value.trim() : '';
  sending = true; btn.disabled = true;
  try {
    await write({ testo: v, libro: bookSnap(b), tipo: 'libro' });
    pickSel = null; view = 'conv';
    try { history.back(); } catch (x) {}
    paintConv('end');
  } catch (e) { NL.toast(nice(e)); btn.disabled = false; }
  sending = false;
}
/* schedina: il tocco su un libro dentro la chat */
function closeBook() { var m = $('chBk'); if (m) m.remove(); }
function bookCard(id) {
  var m = msgs.filter(function (x) { return String(x.id) === String(id); })[0]; if (!m || !m.libro) return;
  var L = m.libro, img = /^https:\/\//.test(L.img || '') ? L.img : '', key = { t: L.t || '', a: L.a || '', i: L.i || '' };
  var have = !!(NL.isMine && NL.isMine(key)), mineW = ((NL.myBooks && NL.myBooks()) || []).filter(function (x) { return x.w; });
  var wish = !have && mineW.some(function (x) { return (L.i && x.i === L.i) || (fold(x.t) === fold(L.t) && fold(x.a) === fold(L.a)); });
  var sub = [L.e, L.y].filter(Boolean).join(', ') + (L.pg ? (L.e || L.y ? ' · ' : '') + L.pg + ' pagine' : '');
  closeBook();
  var el = document.createElement('div'); el.className = 'sheet ch-menu ch-bk'; el.id = 'chBk';
  el.innerHTML = '<div class="sheet-in" role="dialog" aria-modal="true" aria-label="' + esc(L.t || 'Libro') + '"><div class="ch-bkc">' +
    (img ? '<img src="' + esc(img) + '" alt="" referrerpolicy="no-referrer">' : '<span class="ch-bimg" aria-hidden="true">📚</span>') +
    '<div><b>' + esc(L.t || 'Un libro') + '</b>' + (L.a ? '<span>' + esc(L.a) + '</span>' : '') + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div></div>' +
    (have ? '<p class="ch-bks ok">✓ Ce l\'hai già nella Libreria</p>' : wish ? '<p class="ch-bks ok">★ È già nei tuoi Desideri</p>' : '') +
    '<div class="ch-bkb">' + (have || wish ? '' : '<button type="button" class="btn primary" data-i="wish">Aggiungi ai Desideri</button>') + '<button type="button" class="btn" data-i="x">Chiudi</button></div></div>';
  document.body.appendChild(el);
  el.addEventListener('click', function (e) {
    if (e.target === el) return closeBook();
    var b = e.target.closest('[data-i]'); if (!b) return;
    if (b.dataset.i === 'wish' && NL.addMine) {
      var from = m.da && m.da !== uid() ? (m.nome || convName() || '') : '';
      NL.addMine(Object.assign(bookSnap(L), { w: true, fr: from }));
      NL.toast('Aggiunto ai tuoi desideri.');
    }
    closeBook();
  });
  var f = el.querySelector('.btn'); if (f) f.focus();
}
/* dalla finestra Condividi (amici.js): consiglia un libro ad amici e gruppi, con due righe facoltative */
async function recommend(book, friendIds, groupIds, testo) {
  var l = bookSnap(book), ok = 0, err = null;
  for (var i = 0; i < friendIds.length; i++) { try { await rpc('chat_scrivi_a', { a: friendIds[i], testo: testo || '', libro: l, tipo: 'consiglio' }); ok++; } catch (e) { err = e; } }
  for (var j = 0; j < groupIds.length; j++) { try { await rpc('chat_scrivi', { chat: groupIds[j], testo: testo || '', libro: l, tipo: 'consiglio' }); ok++; } catch (e) { err = e; } }
  if (ok) lastList = 0;
  return { ok: ok, err: err ? nice(err) : '' };
}
async function groups() {
  if (!lastList) { try { await loadList(); } catch (e) {} }
  return chats.filter(function (c) { return c.tipo === 'gruppo' && c.stato !== 'chiusa'; });
}

/* ---------- tocchi ---------- */
function onClick(e) {
  var el = $('chSheet');
  if (e.target === el) return close();
  var b = e.target.closest('[data-c]'); if (!b) return;
  var a = b.dataset.c;
  if (a === 'close') return close();
  if (a === 'bk') { if (Date.now() - longAt > 700) bookCard(b.dataset.m); return; }
  if (a === 'bpick') { view = 'bpick'; pickSel = null; pickQ = ''; pickTab = 'lib'; pushBack('bpick'); paint(); return; }
  if (a === 'btab') { pickTab = b.dataset.t; pickSel = null; paint(); return; }
  if (a === 'bsel') { pickSel = b.dataset.id; paintBookList(); paintBookFoot(); return; }
  if (a === 'bsend') { sendBook(b); return; }
  if (a === 'new') { newMenu(); return; }
  if (a === 'gmake') { makeGroup(b); return; }
  if (a === 'ginfo') { openInfo(); return; }
  if (a === 'hist') { try { history.back(); } catch (x) {} return; }
  if (a === 'gadd') { view = 'gadd'; gsel = {}; glim = Math.max(0, 30 - (gm ? gm.length : 1)); pushBack('gadd'); paint(); loadFriends(); return; }
  if (a === 'gaddok') { addPicked(b); return; }
  if (a === 'gmem') { memMenu(b.dataset.id); return; }
  if (a === 'gren') { rename(); return; }
  if (a === 'gmute') { var cg = curChat(); if (cg) mute(cg, !cg.silenziata); return; }
  if (a === 'gexit') { askExit(); return; }
  if (a === 'list') { view = 'list'; paint(); return; }
  if (a === 'reqs') { view = 'req'; paint(); return; }
  if (a === 'chat') { openChat(b.dataset.id); return; }
  if (a === 'to') { view = 'list'; to(b.dataset.id, b.dataset.n); return; }
  if (a === 'back') { toList(); return; }
  if (a === 'older') { read(true); return; }
  if (a === 'menu') { chatMenu(); return; }
  if (a === 'prof') { var o = convOther(); if (o && isFriend(o)) prof(o); return; }
  if (a === 'yes' || a === 'no') { b.disabled = true; answer(a === 'yes'); return; }
  if (a === 'block') { var c = curChat(); if (c) askBlock(c.altro, c.nome || 'questa persona'); return; }
  if (a === 'unblock') { var c2 = curChat(); if (c2) block(c2.altro, c2.nome || 'questa persona', false); return; }
  if (a === 'reportlast') { reportLast(); return; }
}

/* ---------- l'avviso «messaggi» nella campanella apre la chat ---------- */
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if ($('chMenu')) closeMenu(); else if ($('chBk')) closeBook(); else if ($('chSheet') && !$('chSheet').hidden) close(); } });
var A0 = window.NLAmici;
if (A0 && A0.onLoad) A0.onLoad(loadNums);                                     // insieme agli amici (apertura, ritorno, ogni ~3 min)
else if (uid()) setTimeout(loadNums, 1500);
S.onAuth(function () { if (!uid()) { chats = []; nums = { nuovi: 0, richieste: 0 }; wr(K, null); close(); } else loadNums(); paintTop(); });
if (chats.length) numsFromList(); else paintTop();
/* ---------- amministrazione (giro 9e): admin.js e admin.css si caricano solo se il server dice che sei amministratore ---------- */
var adminFor = null;
async function adminCheck() {
  var u = uid(); if (!u || adminFor === u) return; adminFor = u;
  var si = false; try { si = (await rpc('admin_sono')) === true; } catch (e) { adminFor = null; return; }
  if (!si || window.NLAdmin || $('adminJs')) return;
  var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'admin.css'; document.head.appendChild(l);
  var sc = document.createElement('script'); sc.src = 'admin.js'; sc.id = 'adminJs'; sc.defer = true; document.head.appendChild(sc);
}
S.onAuth(function () { if (uid()) adminCheck(); else { adminFor = null; var g = $('goAdmin'); if (g) g.remove(); if (window.NLAdmin) window.NLAdmin.close(); } });
if (uid()) setTimeout(adminCheck, 1200);
window.NLChat = { menu: menu, open: open, to: to, recommend: recommend, groups: groups, grpAv: grpAv, blocked: blocked, load: loadNums, state: function () { return { chats: chats, nums: nums, view: view, cur: cur, msgs: msgs, info: info, draftTo: draftTo }; } };   // per amici.js, profilo.js, notifiche.js e le prove
})();
