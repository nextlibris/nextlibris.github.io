/* Next Libris · modulo «Amministrazione» (giro 9e, 18/11/2026, nella copia di prova). Scelte di Piero in claude/giro-9-chat-scelte.md.
   Caricato SOLO per gli amministratori: chat.js chiede al server admin_sono() e, se risponde sì, aggiunge questo file e admin.css.
   REGOLA DI SICUREZZA: qui c'è solo l'interfaccia. Niente segreti, chiavi o ID. Ogni azione passa dalle funzioni admin_* del
   database (supabase/023_chat.sql), che controllano per prime la tabella «amministratori»: chi non c'è riceve un errore.
   Menu › «Amministrazione»: una finestra con 5 schede in alto (Segnalazioni · Sospesi · Avviso · Numeri · Archivio).
   - Segnalazioni: aperte (e «Chiuse» in fondo). Aperta: il messaggio segnalato con i 10 prima; «Va tutto bene» e «Tieni fermo»
     subito, «Sospendi» con conferma.
   - Sospesi: elenco con «Riattiva».
   - Avviso: titolo (80) e testo (300), anteprima come nella campanella, «Manda a N persone» con conferma.
   - Numeri: utenti, libri, spazio sui 500 MB, ricerche Google di oggi, chat, segnalazioni (una sola chiamata, admin_numeri).
   - Archivio comune: cerca per titolo, autore o ISBN; correggi titolo, autore, editore, anno, copertina, descrizione; «Togli».
   Usa window.NL, window.NLSocial (social.js) e window.NLChat (per il menu delle conferme). */
(function () {
'use strict';
var NL = window.NL, S = window.NLSocial; if (!NL || !S || !S.call || window.NLAdmin) return;
var esc = NL.esc;
var tab = 'seg', closed = false, segs = null, segErr = '', det = null, sosp = null, nums = null, arQ = '', arRes = null, arEd = null, busy = false, depth = 0;
var av = { t: '', x: '', mode: 'tutti', sel: [], q: '', res: [] };   // giro 10: a tutti o a persone scelte (al massimo 50)
var avTimer = 0, avSeq = 0;

function rpc(name, body) { return S.call('/rest/v1/rpc/' + name, { method: 'POST', user: true, body: body || {} }); }
function $(id) { return document.getElementById(id); }
function n(x) { return String(Math.round(Number(x) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }   // 1.240 (toLocaleString scrive 1240)
function mb(b) { var m = Number(b || 0) / 1048576; return (m < 100 ? m.toFixed(1) : Math.round(m)).toString().replace('.', ',') + ' MB'; }
function ago(t) {
  var d = new Date(t), s = (Date.now() - d.getTime()) / 1000; if (isNaN(s)) return '';
  if (s < 60) return 'adesso'; if (s < 3600) return Math.floor(s / 60) + ' min fa'; if (s < 86400) { var h = Math.floor(s / 3600); return h + (h === 1 ? ' ora fa' : ' ore fa'); }
  if (s < 172800) return 'ieri';
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}
function nice(e) {
  var m = String(e && e.message || e);
  if (e && e.code === 'net') return m;
  var T = { 'non autorizzato': 'Non sei amministratore.', 'segnalazione non trovata': 'La segnalazione non c\'è più.',
    'un amministratore non si può fermare': 'Un amministratore non si può fermare.', 'titolo: da 1 a 80': 'Scrivi un titolo (al massimo 80 caratteri).',
    'testo: da 1 a 300': 'Scrivi il testo (al massimo 300 caratteri).', 'dati non validi': 'Serve almeno il titolo.', 'libro non trovato': 'Il libro non è più nell\'archivio.' };
  for (var k in T) if (m.indexOf(k) >= 0) return T[k];
  return 'Non ci riesco: riprova tra poco.';
}
function denied(e) { if (String(e && e.message || e).indexOf('non autorizzato') >= 0) { NL.toast('Non sei amministratore.'); close(); return true; } return false; }
function confirm(title, text, okT, go) {
  var C = window.NLChat;
  if (C && C.menu) { C.menu([{ k: 'ok', t: okT, bad: true, go: go }], '<b>' + title + '</b><br>' + text); return; }
  if (window.confirm(title.replace(/<[^>]+>/g, '') + '\n' + text.replace(/<[^>]+>/g, ''))) go();
}

/* ---------- voce del Menu (solo per gli amministratori) ---------- */
function menuItem() {
  var top = document.querySelector('#drawerOpts .dmain'); if (!top || $('goAdmin')) return;
  var b = document.createElement('button'); b.type = 'button'; b.className = 'dopt dgo ad-menu'; b.id = 'goAdmin';
  b.innerHTML = '<span><b>Amministrazione</b><small id="goAdminTxt">Segnalazioni, avvisi, numeri</small></span><span class="dbadge" id="goAdminN" hidden></span><span class="n" aria-hidden="true">›</span>';
  top.appendChild(b);
  b.addEventListener('click', function () { if (NL.fromMenu) NL.fromMenu(function () { open(); }); else open(); });
}
function badge() {
  var b = $('goAdminN'); if (!b) return;
  var k = nums ? nums.segnalazioni : segs && !closed ? segs.length : 0;
  b.hidden = !k; b.textContent = k || '';
}

/* ---------- finestra ---------- */
function sheet() {
  var el = $('adSheet'); if (el) return el;
  el = document.createElement('div'); el.className = 'sheet ch ad'; el.id = 'adSheet'; el.hidden = true;
  el.innerHTML = '<div class="sheet-in" role="dialog" aria-modal="true" aria-labelledby="adH"><div class="ch-head" id="adHead"></div><div class="ad-tabs" id="adTabs" role="tablist"></div><div class="ch-body" id="adBody"></div><div class="ch-foot" id="adFoot"></div></div>';
  document.body.appendChild(el);
  el.addEventListener('click', onClick);
  el.addEventListener('input', onInput);
  el.addEventListener('submit', function (e) { e.preventDefault(); if (e.target.id === 'adArF') search(); });
  return el;
}
function pushBack(st) { try { history.pushState({ admin: st }, ''); depth++; } catch (e) {} }
async function open(rif) {
  var el = sheet();
  if (el.hidden) { el.hidden = false; document.documentElement.classList.add('ch-open'); depth = 0; pushBack('main'); }
  det = null; arEd = null;
  if (rif) { tab = 'seg'; closed = false; }
  paint();
  if (tab === 'seg' || rif) { await loadSegs(); if (rif) openDet(rif); }
  else load();
  if (!nums) loadNums();
}
function close(fromBack) {
  var el = $('adSheet'); if (!el || el.hidden) return;
  el.hidden = true; document.documentElement.classList.remove('ch-open'); det = null; arEd = null;
  if (!fromBack && depth) { var d = depth; depth = 0; try { history.go(-d); } catch (e) {} }
  if (fromBack) depth = 0;
}
window.addEventListener('popstate', function (e) {
  var el = $('adSheet'); if (!el || el.hidden) return;
  var st = e.state && e.state.admin;
  depth = st === 'det' ? 2 : st === 'main' ? 1 : 0;
  if ($('chMenu')) { $('chMenu').remove(); var want = det || arEd ? 'det' : 'main'; if (st !== want) pushBack(want); return; }   // prima si chiude la conferma
  if ((det || arEd) && st === 'main') { det = null; arEd = null; paint(); return; }   // dalla segnalazione (o dal libro) all'elenco
  if (!st) close(true);
});
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('adSheet') && !$('adSheet').hidden && !$('chMenu')) { if (det || arEd) back(); else close(); } });
function back() { if (depth > 1) { try { history.back(); } catch (e) {} return; } det = null; arEd = null; paint(); }
function setTab(t) { tab = t; det = null; arEd = null; if (depth > 1) { try { history.back(); } catch (e) {} } paint(); load(); }
function load() {
  if (tab === 'seg') return loadSegs();
  if (tab === 'sosp') return loadSosp();
  if (tab === 'num' || tab === 'av') return loadNums();
}

/* ---------- dati ---------- */
async function loadSegs() {
  segErr = '';
  try { var r = await rpc('admin_segnalazioni', { stato: closed ? 'chiuse' : 'aperta' }); segs = Array.isArray(r) ? r : []; }
  catch (e) { if (denied(e)) return; segErr = nice(e); segs = segs || []; }
  if (!closed && nums) nums.segnalazioni = segs.length;
  badge(); paint();
}
async function loadSosp() {
  try { var r = await rpc('admin_sospesi'); sosp = Array.isArray(r) ? r : []; } catch (e) { if (denied(e)) return; NL.toast(nice(e)); sosp = sosp || []; }
  paint();
}
async function loadNums() {
  try { var r = await rpc('admin_numeri'); if (r && typeof r === 'object') nums = r; } catch (e) { if (denied(e)) return; if (tab === 'num') NL.toast(nice(e)); }
  badge(); paint();
}
async function search() {
  var q = ($('adArQ') || {}).value || arQ; arQ = q.trim();
  if (arQ.length < 3) { NL.toast('Scrivi almeno 3 lettere o l\'ISBN.'); return; }
  arRes = 'load'; paint();
  try { var r = await rpc('admin_archivio_cerca', { q: arQ }); arRes = Array.isArray(r) ? r : []; } catch (e) { if (denied(e)) return; arRes = []; NL.toast(nice(e)); }
  paint();
}

/* ---------- disegno ---------- */
var TABS = [['seg', 'Segnalazioni'], ['sosp', 'Sospesi'], ['av', 'Avviso'], ['num', 'Numeri'], ['ar', 'Archivio']];
function paint() {
  var el = $('adSheet'); if (!el || el.hidden) return;
  var sub = det || arEd;
  $('adHead').innerHTML = (sub ? '<button type="button" class="ico ch-back" data-a="back" aria-label="Indietro">‹</button>' : '') +
    '<h2 id="adH">' + (det ? 'Segnalazione' : arEd ? 'Libro dell\'archivio' : 'Amministrazione') + '</h2>' +
    '<button type="button" class="ico ch-x" data-a="close" aria-label="Chiudi">×</button>';
  var tb = $('adTabs'); tb.hidden = !!sub;
  var open = nums ? nums.segnalazioni : (segs && !closed ? segs.length : 0);
  tb.innerHTML = TABS.map(function (t) {
    var k = t[0] === 'seg' && open ? ' <span class="fr-n">' + n(open) + '</span>' : '';
    return '<button type="button" role="tab" class="ad-tab' + (tab === t[0] ? ' on' : '') + '" aria-selected="' + (tab === t[0]) + '" data-t="' + t[0] + '">' + t[1] + k + '</button>';
  }).join('');
  var body = $('adBody'), foot = $('adFoot'); foot.innerHTML = '';
  if (det) { body.innerHTML = detHTML(); foot.innerHTML = detFoot(); return; }
  if (arEd) { body.innerHTML = edHTML(); foot.innerHTML = '<div class="ad-btns"><button type="button" class="btn bad-t" data-a="artogli">Togli</button><button type="button" class="btn primary" data-a="arsalva">Salva</button></div>'; return; }
  body.innerHTML = tab === 'seg' ? segHTML() : tab === 'sosp' ? sospHTML() : tab === 'av' ? avHTML() : tab === 'num' ? numHTML() : arHTML();
  if (tab === 'av') foot.innerHTML = '<button type="button" class="btn primary ad-wide" data-a="avmanda" id="adAvGo"' + (avOk() ? '' : ' disabled') + '>' + avBtn() + '</button>';
  var tabBtn = tb.querySelector('.on'); if (tabBtn && tabBtn.scrollIntoView) try { tabBtn.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {}
}

/* Segnalazioni */
var ESITO = { bene: 'Va tutto bene', ferma: 'Tenuta ferma', sospesa: 'Sospesa' };
function fermo(f) { return f === 'sospeso' ? 'Sospeso' : f === 'fermo' ? 'Fermo' : ''; }
function segHTML() {
  if (!segs) return '<p class="ch-empty">Un momento…</p>';
  var h = segErr ? '<p class="ch-empty">' + esc(segErr) + '</p>' : '';
  if (closed) h += '<p class="ad-sub">Segnalazioni chiuse (le ultime 100)</p>';
  if (!segs.length && !segErr) h += '<p class="ch-empty">' + (closed ? 'Nessuna segnalazione chiusa.' : 'Nessuna segnalazione aperta. Tutto tranquillo.') + '</p>';
  if (segs.length) h += '<ul class="ch-list">' + segs.map(function (g) {
    var mot = String(g.motivo || 'Senza motivo'), st = closed ? (ESITO[g.stato] || g.stato) : fermo(g.fermo);
    return '<li><button type="button" class="ch-row ad-row" data-a="seg" data-id="' + esc(g.id) + '"><span class="ch-t">' +
      '<span class="ch-l1"><b>' + esc(g.da_nome || 'Account eliminato') + ' su ' + esc(g.su_nome || 'account eliminato') + '</b><small>' + esc(ago(g.creata)) + '</small></span>' +
      '<span class="ch-l2"><span class="ch-last">' + esc(mot.split(':')[0]) + ' · ' + n(g.persone) + (Number(g.persone) === 1 ? ' persona' : ' persone') + '</span>' +
      (st ? '<span class="ad-pill' + (st === 'Sospeso' || st === 'Sospesa' ? ' bad' : '') + '">' + esc(st) + '</span>' : '') + '</span></span><span class="n" aria-hidden="true">›</span></button></li>';
  }).join('') + '</ul>';
  h += '<p class="ad-more"><button type="button" class="link" data-a="closed">' + (closed ? '‹ Torna alle aperte' : 'Chiuse') + '</button></p>';
  return h;
}
function openDet(id) {
  var g = (segs || []).filter(function (x) { return String(x.id) === String(id); })[0];
  if (!g) { NL.toast(closed ? 'La segnalazione non c\'è più.' : 'Questa segnalazione è già chiusa.'); return; }
  det = g; tab = 'seg'; pushBack('det'); paint();
  var b = $('adBody'), on = b && b.querySelector('.ad-hit'); if (on && on.scrollIntoView) try { on.scrollIntoView({ block: 'center' }); } catch (e) {}
}
function detHTML() {
  var g = det, mot = String(g.motivo || 'Senza motivo'), i = mot.indexOf(': '), cosa = i > 0 ? mot.slice(0, i) : mot, nota = i > 0 ? mot.slice(i + 2) : '';
  var st = g.stato !== 'aperta' ? (ESITO[g.stato] || g.stato) + (g.chiusa_il ? ' · ' + ago(g.chiusa_il) : '') : g.fermo === 'sospeso' ? 'sospeso' : g.fermo === 'fermo' ? 'fermo automatico (non può mandare richieste a chi non è amico)' : 'nessuno stop';
  var h = '<p class="ad-mot">🚩 <b>' + esc(cosa) + '</b></p>' + (nota ? '<p class="ad-nota">«' + esc(nota) + '»</p>' : '') +
    '<p class="ad-meta">Da <b>' + esc(g.da_nome || 'account eliminato') + '</b> su <b>' + esc(g.su_nome || 'account eliminato') + '</b> · ' + n(g.persone) + (Number(g.persone) === 1 ? ' persona' : ' persone') + ' in 30 giorni<br>' +
    esc(ago(g.creata)) + ' · Stato: ' + esc(st) + '</p>';
  var cp = Array.isArray(g.copia) ? g.copia : [];
  if (!cp.length) return h + '<p class="ch-empty">Il messaggio non c\'è più.</p>';
  if (cp.length > 1) h += '<p class="ch-day"><span>i ' + (cp.length - 1) + ' messaggi prima</span></p>';
  h += cp.map(function (m) {
    var hit = String(m.id) === String(g.messaggio), txt = m.el ? '<i>Messaggio eliminato</i>' : m.libro ? '📚 ' + esc(m.libro) + (m.testo ? ' — ' + esc(m.testo) : '') : esc(m.testo || '');
    return '<div class="ad-msg' + (hit ? ' ad-hit' : '') + (m.da === g.su_id ? ' ad-su' : '') + '">' + (hit ? '<small class="ad-k">Messaggio segnalato</small>' : '') +
      '<b>' + esc(m.nome || 'account eliminato') + '</b> <small>' + esc(new Date(m.creato).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) + '</small><span>' + txt + '</span></div>';
  }).join('');
  return h;
}
function detFoot() {
  if (det.stato !== 'aperta') return '<p class="ch-ro">Chiusa: ' + esc(ESITO[det.stato] || det.stato) + '.</p>';
  return '<div class="ad-btns ad-3"><button type="button" class="btn" data-a="bene">Va tutto bene</button><button type="button" class="btn" data-a="ferma">Tieni fermo</button><button type="button" class="btn bad-t" data-a="sospendi">Sospendi</button></div>';
}
async function decide(esito) {
  if (busy || !det) return; busy = true;
  var g = det, name = g.su_nome || 'questa persona';
  try {
    await rpc('admin_decidi', { id: g.id, esito: esito });
    NL.toast(esito === 'bene' ? 'Fatto: caso chiuso, nessuno stop per ' + name + '.' : esito === 'ferma' ? 'Fatto: ' + name + ' resta ferma finché non decidi diversamente.' : 'Fatto: ' + name + ' è sospesa e non può più scrivere.');
    segs = (segs || []).filter(function (x) { return x.id !== g.id; }); if (nums) nums.segnalazioni = Math.max(0, (nums.segnalazioni || 1) - 1);
    sosp = null; badge(); back(); loadSegs(); loadNums();
  } catch (e) { if (!denied(e)) NL.toast(nice(e)); }
  busy = false;
}

/* Sospesi */
function sospHTML() {
  if (!sosp) return '<p class="ch-empty">Un momento…</p>';
  if (!sosp.length) return '<p class="ch-empty">Nessuna persona ferma o sospesa.</p>';
  return '<p class="ad-sub"><b>Fermo</b>: non può mandare richieste a chi non è amico. <b>Sospeso</b>: non può scrivere a nessuno.</p><ul class="ch-list">' + sosp.map(function (x) {
    return '<li class="ad-li"><span class="ch-t"><span class="ch-l1"><b>' + esc(x.nome || 'account eliminato') + '</b></span>' +
      '<span class="ch-l2"><span class="ch-last">' + (x.tipo === 'sospeso' ? 'Sospeso' : 'Fermo') + (x.automatico ? ' (automatico)' : '') + ' · dal ' + esc(new Date(x.dal).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })) + '</span></span></span>' +
      '<button type="button" class="btn ad-sm" data-a="riattiva" data-id="' + esc(x.id) + '" data-n="' + esc(x.nome || '') + '">Riattiva</button></li>';
  }).join('') + '</ul>';
}
async function riattiva(id, name) {
  try { await rpc('admin_riattiva', { utente: id }); NL.toast((name || 'La persona') + ' può di nuovo scrivere.'); sosp = (sosp || []).filter(function (x) { return x.id !== id; }); paint(); loadNums(); }
  catch (e) { if (!denied(e)) NL.toast(nice(e)); }
}

/* Avviso */
function avOk() { var t = av.t.trim(), x = av.x.trim(); return t && x && t.length <= 80 && x.length <= 300 && !busy && (av.mode === 'tutti' || av.sel.length > 0); }
function avBtn() { if (av.mode === 'scelte') return 'Manda a ' + av.sel.length + (av.sel.length === 1 ? ' persona' : ' persone'); return nums && nums.utenti ? 'Manda a ' + n(nums.utenti) + (Number(nums.utenti) === 1 ? ' persona' : ' persone') : 'Manda a tutti'; }
function avHTML() {
  return '<p class="ad-sub">Arriva nella campanella e con una notifica push (anche a chi ha spento gli altri avvisi; rispetta le ore di silenzio).</p>' +
    '<p class="ad-lab">A chi</p><div class="ad-who"><button type="button" class="ad-opt" data-a="avmode" data-m="tutti" aria-pressed="' + (av.mode === 'tutti') + '">Tutti</button>' +
    '<button type="button" class="ad-opt" data-a="avmode" data-m="scelte" aria-pressed="' + (av.mode === 'scelte') + '">Persone scelte</button></div>' +
    (av.mode === 'scelte' ? '<input id="adAvQ" type="search" maxlength="40" value="' + esc(av.q) + '" placeholder="Cerca per nome…" autocomplete="off">' +
      '<div class="ad-sel ad-res" id="adAvR">' + avResHTML() + '</div><div class="ad-sel" id="adAvS">' + avSelHTML() + '</div>' : '') +
    '<label class="ad-lab" for="adAvT">Titolo <small id="adAvTn">' + av.t.length + ' / 80</small></label><input id="adAvT" type="text" maxlength="80" value="' + esc(av.t) + '" placeholder="Es. Novità: la chat!" autocomplete="off">' +
    '<label class="ad-lab" for="adAvX">Testo <small id="adAvXn">' + av.x.length + ' / 300</small></label><textarea id="adAvX" rows="4" maxlength="300" placeholder="Es. Da oggi puoi scrivere ai tuoi amici…">' + esc(av.x) + '</textarea>' +
    '<p class="ad-sub">Così lo vedranno:</p><div class="ad-prev" id="adAvP">' + prevHTML() + '</div>';
}
function avResHTML() {
  return av.res.filter(function (r) { return !av.sel.some(function (s) { return s.id === r.id; }); }).map(function (r) {
    return '<button type="button" class="ad-chip ad-add" data-a="avadd" data-id="' + esc(r.id) + '" data-n="' + esc(r.utente || '') + '">+ ' + esc(r.utente || 'Senza nome') + '</button>';
  }).join('') || (av.q.trim().length >= 2 ? '<p class="ad-sub">Nessuno con questo nome.</p>' : '');
}
function avSelHTML() {
  if (!av.sel.length) return '<p class="ad-sub">Nessuna persona scelta (al massimo 50).</p>';
  return av.sel.map(function (s) { return '<button type="button" class="ad-chip" data-a="avdel" data-id="' + esc(s.id) + '" aria-label="Togli ' + esc(s.n) + '">✓ ' + esc(s.n) + '</button>'; }).join('');
}
function avRefresh() { var r = $('adAvR'), s = $('adAvS'), g = $('adAvGo'); if (r) r.innerHTML = avResHTML(); if (s) s.innerHTML = avSelHTML(); if (g) { g.disabled = !avOk(); g.textContent = avBtn(); } }
function avSearch() {
  clearTimeout(avTimer); var my = ++avSeq, q = av.q.trim();
  if (q.length < 2) { av.res = []; avRefresh(); return; }
  avTimer = setTimeout(async function () {
    try { var r = await rpc('admin_cerca', { q: q }); if (my !== avSeq) return; av.res = Array.isArray(r) ? r : []; avRefresh(); }
    catch (e) { if (!denied(e)) NL.toast(nice(e)); }
  }, 350);
}
function prevHTML() {
  return '<span class="nt-ico nt-av" aria-hidden="true">NL</span><span class="ad-pt"><b>' + (av.t.trim() ? esc(av.t.trim()) : '<i>Titolo</i>') + '</b><span>' + (av.x.trim() ? esc(av.x.trim()) : '<i>Testo dell\'avviso</i>') + '</span></span>';
}
function avSend() {
  if (!avOk()) return;
  var who = av.mode === 'scelte' ? (av.sel.length === 1 ? av.sel[0].n : av.sel.length + ' persone') : nums && nums.utenti ? n(nums.utenti) + (Number(nums.utenti) === 1 ? ' persona' : ' persone') : 'tutti';
  confirm('Lo mando a ' + esc(who) + '?', 'Non si può ritirare.', 'Manda l\'avviso', async function () {
    busy = true; var bt = $('adAvGo'); if (bt) bt.disabled = true;
    try { var k = await rpc('admin_avviso', { titolo: av.t.trim(), testo: av.x.trim(), persone: av.mode === 'scelte' ? av.sel.map(function (s) { return s.id; }) : null }); NL.toast('Avviso mandato a ' + n(k) + (Number(k) === 1 ? ' persona.' : ' persone.')); av = { t: '', x: '', mode: 'tutti', sel: [], q: '', res: [] }; }
    catch (e) { if (!denied(e)) NL.toast(nice(e)); }
    busy = false; paint();
  });
}

/* Numeri */
function numHTML() {
  if (!nums) return '<p class="ch-empty">Un momento…</p>';
  var sp = Number(nums.spazio || 0), max = Number(nums.spazio_max || 524288000), pc = Math.min(100, Math.round(sp / max * 100));
  var rq = Number(nums.ricerche_oggi || 0), rmax = Number(nums.ricerche_chiave_max || 0);
  function t(ico, v, l, s) { return '<div class="ad-tile"><span class="ad-ico" aria-hidden="true">' + ico + '</span><b>' + v + '</b><span>' + l + '</span>' + (s ? '<small>' + s + '</small>' : '') + '</div>'; }
  return '<div class="ad-grid">' +
    t('👥', n(nums.utenti), 'utenti', n(nums.attivi_mese) + ' attivi nel mese') +
    t('📚', n(nums.libri), 'libri online', n(nums.archivio) + ' nell\'archivio comune') +
    '<div class="ad-tile ad-full"><span class="ad-ico" aria-hidden="true">💾</span><b>' + mb(sp) + ' su ' + mb(max) + '</b><span>spazio del database</span>' +
      '<span class="ad-bar' + (pc >= 80 ? ' bad' : '') + '"><i style="width:' + Math.max(1, pc) + '%"></i></span><small>' + pc + '% usato · messaggi della chat ' + mb(nums.messaggi_spazio) + '</small></div>' +
    t('🔎', n(rq), 'ricerche Google oggi', rmax ? 'la chiave più usata: ' + n(rmax) + ' su 1.000' : '') +
    t('💬', n(nums.chat), 'chat', n(nums.messaggi) + ' messaggi') +
    t('🚩', n(nums.segnalazioni), 'segnalazioni aperte', '') +
    t('⛔', n(nums.sospesi), 'fermi o sospesi', '') +
    '</div><p class="ad-more"><button type="button" class="link" data-a="numagg">Aggiorna</button></p>';
}

/* Archivio comune */
function arHTML() {
  var h = '<p class="ad-sub">I libri salvati per ISBN da chi li ha cercati per primo. Correggi quelli sbagliati o toglili: chi li cerca dopo li ritrova giusti.</p>' +
    '<form class="ad-arf" id="adArF"><input id="adArQ" type="search" enterkeyhint="search" value="' + esc(arQ) + '" placeholder="Titolo, autore o ISBN" aria-label="Cerca nell\'archivio" autocomplete="off"><button class="btn primary" type="submit">Cerca</button></form>';
  if (arRes === 'load') return h + '<p class="ch-empty">Un momento…</p>';
  if (!arRes) return h;
  if (!arRes.length) return h + '<p class="ch-empty">Nessun libro trovato.</p>';
  return h + '<ul class="ch-list">' + arRes.map(function (r, i) {
    var d = r.dati || {}, img = d.img || d.imgL;
    return '<li><button type="button" class="ch-row ad-row" data-a="ared" data-i="' + i + '">' + (img ? '<img class="ad-cov" src="' + esc(img) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<span class="ad-cov" aria-hidden="true">📚</span>') +
      '<span class="ch-t"><span class="ch-l1"><b>' + esc(d.t || '(senza titolo)') + '</b></span><span class="ch-l2"><span class="ch-last">' + esc([d.a, d.y, r.isbn].filter(Boolean).join(' · ')) + '</span></span></span><span class="n" aria-hidden="true">›</span></button></li>';
  }).join('') + '</ul>' + (arRes.length >= 20 ? '<p class="ad-sub">Ne mostro 20: scrivi qualcosa di più preciso.</p>' : '');
}
var FIELDS = [['t', 'Titolo', 'text'], ['a', 'Autore', 'text'], ['e', 'Editore', 'text'], ['y', 'Anno', 'text'], ['img', 'Copertina (indirizzo)', 'url'], ['ds', 'Descrizione', 'area']];
function edHTML() {
  var d = arEd.dati, img = d.img || d.imgL;
  return '<p class="ad-meta">ISBN <b>' + esc(arEd.isbn) + '</b> · aggiornato ' + esc(ago(arEd.aggiornato)) + '</p>' +
    (img ? '<img class="ad-big" id="adArImg" src="' + esc(img) + '" alt="Copertina" referrerpolicy="no-referrer">' : '') +
    FIELDS.map(function (f) {
      var v = esc(d[f[0]] || ''), id = 'adAr_' + f[0];
      return '<label class="ad-lab" for="' + id + '">' + f[1] + '</label>' + (f[2] === 'area' ? '<textarea id="' + id + '" rows="6" maxlength="5000">' + v + '</textarea>' : '<input id="' + id + '" type="' + (f[2] === 'url' ? 'url' : 'text') + '"' + (f[0] === 'y' ? ' inputmode="numeric" maxlength="4"' : ' maxlength="300"') + ' value="' + v + '" autocomplete="off">');
    }).join('') + '<p class="ad-sub">Copertine solo da Google Libri, Open Library o archive.org: le altre il server le scarta.</p>';
}
function edGet() {
  var d = Object.assign({}, arEd.dati);
  FIELDS.forEach(function (f) { var el = $('adAr_' + f[0]); if (!el) return; var v = el.value.trim(); if (v) d[f[0]] = v; else delete d[f[0]]; });
  if (d.img !== arEd.dati.img) delete d.imgL;                 // copertina cambiata: la «grande» vecchia non vale più
  if (d.ds !== arEd.dati.ds) delete d.dsl;
  return d;
}
async function arSave() {
  var d = edGet(); if (!d.t) { NL.toast('Serve almeno il titolo.'); return; }
  if (d.y && !/^\d{3,4}$/.test(d.y)) { NL.toast('L\'anno va scritto in cifre, per esempio 1963.'); return; }
  try {
    await rpc('admin_archivio_salva', { isbn: arEd.isbn, dati: d });
    NL.toast('Libro corretto nell\'archivio.'); arEd.dati = d; arEd.aggiornato = new Date().toISOString();
    if (Array.isArray(arRes)) arRes.forEach(function (r) { if (r.isbn === arEd.isbn) { r.dati = d; r.aggiornato = arEd.aggiornato; } });
    back();
  } catch (e) { if (!denied(e)) NL.toast(nice(e)); }
}
function arDel() {
  confirm('Togliere «' + esc(arEd.dati.t || arEd.isbn) + '» dall\'archivio?', 'Chi lo cerca dopo lo ritrova con la ricerca solita (e l\'archivio si riempie di nuovo). Le librerie di chi ce l\'ha non cambiano.', 'Togli', async function () {
    try { var isbn = arEd.isbn; await rpc('admin_archivio_togli', { isbn: isbn }); NL.toast('Tolto dall\'archivio.'); if (Array.isArray(arRes)) arRes = arRes.filter(function (r) { return r.isbn !== isbn; }); back(); }
    catch (e) { if (!denied(e)) NL.toast(nice(e)); }
  });
}

/* ---------- tocchi e scrittura ---------- */
function onInput(e) {
  var id = e.target.id;
  if (id === 'adAvT' || id === 'adAvX') {
    if (id === 'adAvT') av.t = e.target.value; else av.x = e.target.value;
    var a = $('adAvTn'), b = $('adAvXn'), p = $('adAvP'), g = $('adAvGo');
    if (a) a.textContent = av.t.length + ' / 80'; if (b) b.textContent = av.x.length + ' / 300';
    if (p) p.innerHTML = prevHTML(); if (g) g.disabled = !avOk();
  }
  if (id === 'adAvQ') { av.q = e.target.value; avSearch(); }
  if (id === 'adArQ') arQ = e.target.value;
  if (id === 'adAr_img') { var im = $('adArImg'), v = e.target.value.trim(); if (im && /^https:\/\//.test(v)) im.src = v; }
}
function onClick(e) {
  var el = $('adSheet');
  if (e.target === el) { close(); return; }
  var t = e.target.closest('[data-t]'); if (t) { setTab(t.dataset.t); return; }
  var b = e.target.closest('[data-a]'); if (!b) return;
  var a = b.dataset.a;
  if (a === 'close') { close(); return; }
  if (a === 'back') { back(); return; }
  if (a === 'closed') { closed = !closed; segs = null; paint(); loadSegs(); return; }
  if (a === 'seg') { openDet(b.dataset.id); return; }
  if (a === 'bene' || a === 'ferma') { decide(a); return; }
  if (a === 'sospendi') { var nm = esc(det && det.su_nome || 'Questa persona'); confirm('Sospendere ' + nm + '?', nm + ' non potrà più scrivere a nessuno. Puoi riattivarla da Sospesi.', 'Sospendi', function () { decide('sospendi'); }); return; }
  if (a === 'riattiva') { riattiva(b.dataset.id, b.dataset.n); return; }
  if (a === 'avmanda') { avSend(); return; }
  if (a === 'avmode') { av.mode = b.dataset.m; paint(); if (av.mode === 'scelte') { var qi = $('adAvQ'); if (qi) qi.focus(); } return; }
  if (a === 'avadd') { if (av.sel.length >= 50) { NL.toast('Al massimo 50 persone per volta.'); return; } av.sel.push({ id: b.dataset.id, n: b.dataset.n || 'Senza nome' }); avRefresh(); return; }
  if (a === 'avdel') { av.sel = av.sel.filter(function (s) { return s.id !== b.dataset.id; }); avRefresh(); return; }
  if (a === 'numagg') { nums = null; paint(); loadNums(); return; }
  if (a === 'ared') { var r = Array.isArray(arRes) && arRes[+b.dataset.i]; if (r) { arEd = { isbn: r.isbn, dati: Object.assign({}, r.dati || {}), aggiornato: r.aggiornato }; pushBack('det'); paint(); } return; }
  if (a === 'arsalva') { arSave(); return; }
  if (a === 'artogli') { arDel(); return; }
}

menuItem();
loadNums();
window.NLAdmin = { open: open, close: close, state: function () { return { tab: tab, closed: closed, segs: segs, det: det, sosp: sosp, nums: nums, arRes: arRes, arEd: arEd, av: av }; } };   // per notifiche.js e le prove
})();
