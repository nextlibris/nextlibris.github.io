/* Next Libris · modulo «Profilo» (giro 3, rifatto nel giro 6 del 18/11/2026, nella copia di prova).
   Pagina del profilo: foto piccola a sinistra, nome, «Su Next Libris da …», la riga dei numeri; poi «In lettura», «Preferiti»
   e «Consigliati» (copertine in fila, scorrevoli), le citazioni in evidenza (fino a 3, scelte con la puntina) e i numeri.
   Il tuo si apre toccando il nome in testata e da Menu › Amici › Il tuo profilo; quello di un amico toccando il suo nome
   (elenco degli amici, testata della sua libreria): da lì i tasti Libreria e Desideri, ⇄, chiave e «togli dagli amici».
   Foto: scattata o scelta (ritagliata al centro, 128 px, tonda) oppure quella dell'account Google; la vedono solo gli amici.
   Agli amici, a scelta in «Amici e privacy»: in lettura, preferiti, consigliati e numeri (solo con la libreria visibile),
   citazioni in evidenza e tutte le citazioni (spente di partenza); mai gli appunti.
   I numeri li calcola il telefono e li manda al profilo quando cambiano; le file di libri e le citazioni le legge il database dai libri.
   «Segui i suoi Desideri»: un riassunto al giorno (campanella e push); l'amico non lo sa.
   Database: supabase/018_profilo_seguiti.sql e 019_profilo_amico_trovati.sql (ramo prove). Usa window.NL, window.NLSocial e window.NLAmici. */
(function () {
'use strict';
var NL = window.NL; if (!NL) return;
var esc = NL.esc, K = 'catalogo-libri-profilo', K_FOTO = 'catalogo-libri-amici-foto';
var FOTO_RE = /^(data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+\/]+=*|https:\/\/lh[0-9]\.googleusercontent\.com\/[A-Za-z0-9_=.\/-]+)$/;
function rd(k) { try { return JSON.parse(NL.ls.get(k) || 'null'); } catch (e) { return null; } }
function wr(k, v) { NL.ls.set(k, v == null ? '' : JSON.stringify(v)); }
var my = rd(K) || {};            // foto, cit {x, t, a, pg, b, d}, t (ultima modifica qui), up (impronta dell'ultimo invio)
var pics = rd(K_FOTO) || {};     // foto degli amici: id -> { il, f }
var cur = null, data = null, mode = '', busy = false, photoOpen = false;
function A() { return window.NLAmici; }
function S() { return window.NLSocial; }
function uid() { var a = S() && S().auth && S().auth(); return (a && a.uid) || null; }
function meRow() { var a = A(); return (a && a.state && a.state().me) || null; }
function has018() { var m = meRow(); return !!(m && 'p_cit' in m); }
function okFoto(f) { f = String(f || ''); return f.length <= 20000 && FOTO_RE.test(f) ? f : ''; }
function mine() { return (cur === 'esempio' ? NL.books() : NL.myBooks ? NL.myBooks() : NL.books()) || []; }   // 'esempio': il profilo della libreria di esempio (18/11/2026)
var EX_NAME = 'Lettore di esempio';
function save() { wr(K, my); }
function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return s.length + ':' + h; }
function nf(n) { return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }   // 6.100 (toLocaleString in italiano lascia «6100»)
function since(t) { var d = new Date(t); return isNaN(d) ? '' : d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }); }

/* ---------- foto o iniziale ---------- */
function avatar(id, name, big) {
  var f = okFoto(id ? (pics[id] || {}).f : my.foto), ch = (String(name || '?').trim()[0] || '?').toUpperCase();
  return '<span class="pf-av' + (big ? ' big' : '') + (f ? ' has' : '') + '" data-pf="' + esc(id || 'me') + '" data-ch="' + esc(ch) + '" style="--pf-h:' + NL.hue(name || '') + '" aria-hidden="true">' +
    (f ? '<img src="' + esc(f) + '" alt="" referrerpolicy="no-referrer" decoding="async">' : esc(ch)) + '</span>';
}

/* ---------- i numeri (li calcola il telefono, anche per gli amici) ---------- */
function top(map) { var k = '', n = 0; Object.keys(map).forEach(function (x) { if (map[x] > n || (map[x] === n && x.localeCompare(k, 'it') < 0)) { k = x; n = map[x]; } }); return [k, n]; }
function inLib(b) { return !b.w && !b.xs && b.sk !== 'p' && b.sk !== 'q'; }    // come il database: non desiderio, non uscito, non preso in prestito
function stats() {
  var y = String(new Date().getFullYear()), bs = mine().filter(function (b) { return !b.w; });
  var read = bs.filter(function (b) { return b.rs === 'ok'; }), au = {}, auy = {}, ge = {}, pa = {}, pay = {}, ul = null, lu = null;
  var st = { n: bs.filter(function (b) { return !b.xs; }).length, l: read.length, ly: 0, y: Number(y), pg: 0, pgy: 0, pr: bs.filter(function (b) { return b.p && !b.xs; }).length };
  read.forEach(function (b) {
    var pg = Number(b.pg) || 0, thisY = String(b.rd || '').slice(0, 4) === y;
    st.pg += pg; if (thisY) { st.ly++; st.pgy += pg; }
    var a0 = (NL.authorsOf(b) || [])[0]; if (a0) { au[a0] = (au[a0] || 0) + 1; if (thisY) auy[a0] = (auy[a0] || 0) + 1; }
    if (b.gen) ge[b.gen] = (ge[b.gen] || 0) + 1;
    var c = NL.wdBookCountry ? NL.wdBookCountry(b) : ''; if (c) { pa[c] = (pa[c] || 0) + 1; if (thisY) pay[c] = (pay[c] || 0) + 1; }
    if (b.t && b.rd && (!ul || b.rd > ul.rd || (b.rd === ul.rd && (Number(b.ts) || 0) > (Number(ul.ts) || 0)))) ul = b;   // ultimo libro letto
    if (b.t && pg && (!lu || pg > (Number(lu.pg) || 0))) lu = b;                                                        // il più lungo
  });
  var ta = top(au), tg = top(ge), ty = top(auy);
  st.pay = Object.keys(pay).sort(function (a, b) { return pay[b] - pay[a] || a.localeCompare(b); }).slice(0, 40);   // paesi dell'anno (scheda dell'anno)
  if (cur !== 'esempio' && my.ob && my.ob.y === st.y && my.ob.n > 0) st.ob = my.ob.n;                              // obiettivo dell'anno (facoltativo)
  if (ta[1]) { st.au = ta[0].slice(0, 60); st.aun = ta[1]; }
  if (ty[1]) { st.auy = ty[0].slice(0, 60); st.auyn = ty[1]; }
  if (tg[1]) { st.ge = tg[0].slice(0, 40); st.gen = tg[1]; }
  if (ul) st.ul = { t: String(ul.t).slice(0, 80), a: String(ul.a || '').slice(0, 60) };
  if (lu) st.lu = { t: String(lu.t).slice(0, 80), a: String(lu.a || '').slice(0, 60), pg: Number(lu.pg) || 0 };
  st.pa = Object.keys(pa).sort(function (a, b) { return pa[b] - pa[a] || a.localeCompare(b); }).slice(0, 60);
  return st;
}
function myQuotes() {
  var out = [];
  mine().forEach(function (b) { (b.qs || []).forEach(function (c, i) { if (c && (c.x || (c.phs && c.phs.length))) out.push({ x: c.x || '', pg: c.pg || '', d: c.d || 0, t: b.t || '', a: b.a || '', b: b.id, i: i, pin: !!c.pin, phs: c.phs || [] }); }); });
  return out.sort(function (a, b) { return b.d - a.d; });
}
function myPins() { return myQuotes().filter(function (q) { return q.pin; }).slice(0, PINS); }   // le citazioni in evidenza (puntina)
var PINS = NL.PIN_MAX || 3;
function myCit() {                 // la vecchia «citazione preferita» (giro 3): vale finché non diventa una puntina
  var c = my.cit; if (!c || !c.x) return null;
  var q = myQuotes().filter(function (x) { return x.b === c.b && x.d === c.d; })[0];
  return q ? { x: q.x.slice(0, 600), t: q.t.slice(0, 120), a: q.a.slice(0, 120), pg: q.pg, b: q.b, d: q.d } : c;
}
function migrate() {               // giro 6: la preferita di prima diventa la prima citazione in evidenza
  var c = my.cit; if (!c || !c.x || !NL.togglePin) return;
  var q = myQuotes().filter(function (x) { return x.b === c.b && x.d === c.d; })[0]; if (!q) return;   // il libro non è su questo telefono: resta com'è
  if (!q.pin && myPins().length < PINS) { var bk = NL.get(q.b), cc = bk && bk.qs && bk.qs[q.i]; if (cc) { cc.pin = 1; NL.save(); } }
  my.cit = null; my.t = Date.now(); save();
}
function firstTs() { var t = 0; mine().forEach(function (b) { var x = Number(b.ts) || 0; if (x && (!t || x < t)) t = x; }); return t; }
function lists() {                 // le stesse tre file che il database dà agli amici (al massimo 30, le più recenti)
  var bs = mine().filter(inLib).sort(function (a, b) { return (Number(b.ts) || 0) - (Number(a.ts) || 0); });
  return { let: bs.filter(function (b) { return b.rs === 'in'; }).slice(0, 30), pref: bs.filter(function (b) { return b.fav; }).slice(0, 30), cons: bs.filter(function (b) { return b.lc; }).slice(0, 30) };
}

/* ---------- server: mando foto, citazione e numeri quando cambiano; su un telefono nuovo riprendo foto e citazione ---------- */
async function push() {
  if (!uid() || !has018() || busy) return;
  var m = meRow();
  if (!my.t && !my.got) { my.got = 1; var f0 = okFoto(m.foto); if (f0) my.foto = f0; if (m.cit && m.cit.x) my.cit = m.cit; save(); paintPics(); }
  migrate();
  var body = { foto: okFoto(my.foto), cit: myCit(), stat: stats() }, sig = hash(JSON.stringify(body));   // cit: solo la vecchia preferita non ancora diventata puntina, altrimenti null
  if (sig === my.up) return;
  busy = true;
  try {
    await S().call('/rest/v1/profili?on_conflict=id', { method: 'POST', user: true, prefer: 'resolution=merge-duplicates,return=minimal', body: Object.assign({ id: uid() }, body) });
    my.up = sig; save();
  } catch (e) { if (window.nlErr && !(e && e.code === 'net')) nlErr(e); }
  busy = false;
}
async function loadPics() {
  var a = A(); if (!a || !uid()) return;
  var fr = ((a.state().list) || []).filter(function (x) { return x.stato === 'amici'; }), ids = {}, need = [], ch = false;
  fr.forEach(function (x) {
    ids[x.id] = 1;
    if (!x.foto_il) { if (pics[x.id]) { delete pics[x.id]; ch = true; } }
    else if (!pics[x.id] || pics[x.id].il !== x.foto_il) need.push(x);
  });
  Object.keys(pics).forEach(function (id) { if (!ids[id]) { delete pics[id]; ch = true; } });
  if (need.length) {
    try {
      var r = (await a.rpc('foto_amici', { ids: need.slice(0, 60).map(function (x) { return x.id; }) })) || [], got = {};
      r.forEach(function (x) { got[x.id] = okFoto(x.foto); });
      need.slice(0, 60).forEach(function (x) { if (got[x.id]) pics[x.id] = { il: x.foto_il, f: got[x.id] }; else delete pics[x.id]; });
      ch = true;
    } catch (e) { if (window.nlErr && !(e && e.code === 'net')) nlErr(e); }
  }
  if (ch) { try { wr(K_FOTO, pics); } catch (e) { if (window.nlErr) nlErr(e); } paintPics(); }
}
function paintPics() {             // le foto arrivate dopo: si aggiornano dove sono già disegnate
  Array.prototype.forEach.call(document.querySelectorAll('.pf-av[data-pf]'), function (el) {
    var id = el.dataset.pf, f = okFoto(id === 'me' ? my.foto : (pics[id] || {}).f), img = el.querySelector('img');
    if (f && (!img || img.getAttribute('src') !== f)) { el.innerHTML = '<img src="' + esc(f) + '" alt="" referrerpolicy="no-referrer" decoding="async">'; el.classList.add('has'); }
    else if (!f && img) { el.classList.remove('has'); el.textContent = el.dataset.ch || '?'; }
  });
}

/* ---------- foto: scatta o scegli (ritaglio al centro, 128 px), quella di Google, togli ---------- */
function setFoto(f) { my.foto = okFoto(f); my.t = Date.now(); save(); photoOpen = false; paint(); paintPics(); push(); }
function fromFile(file) {
  if (!file) return;
  var url = URL.createObjectURL(file), img = new Image();
  img.onload = function () {
    var s = Math.min(img.naturalWidth, img.naturalHeight), c = document.createElement('canvas'), q = 0.84, out = '';
    c.width = c.height = 128;
    try {
      c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, 128, 128);
      do { out = c.toDataURL('image/jpeg', q); q -= 0.12; } while (out.length > 19000 && q > 0.3);
    } catch (e) { out = ''; }
    URL.revokeObjectURL(url);
    if (okFoto(out)) { setFoto(out); NL.toast(uid() ? 'Foto salvata: la vedono solo i tuoi amici.' : 'Foto salvata su questo telefono.'); }
    else NL.toast('Non riesco a usare questa foto: provane un\'altra.');
  };
  img.onerror = function () { URL.revokeObjectURL(url); NL.toast('Non riesco a leggere questa foto.'); };
  img.src = url;
}
async function fromGoogle() {
  try {
    var j = await S().call('/auth/v1/user', { user: true }), md = (j && j.user_metadata) || {}, f = okFoto(String(md.picture || md.avatar_url || ''));
    if (f) { setFoto(f); NL.toast('Uso la foto del tuo account Google.'); } else NL.toast('Il tuo account Google non ha una foto.');
  } catch (e) { NL.toast(e && e.code === 'net' ? e.message : 'Non riesco a leggere la foto di Google. Riprova tra poco.'); }
}

/* ---------- finestra ---------- */
function sheet() {
  var el = document.getElementById('profSheet'); if (el) return el;
  el = document.createElement('div'); el.className = 'sheet fri prof'; el.id = 'profSheet'; el.hidden = true;
  el.innerHTML = '<div class="sheet-in" role="dialog" aria-modal="true" aria-labelledby="profH"><h2 id="profH" class="sr">Profilo</h2><div id="profBody"></div>' +
    '<input type="file" id="profFile" accept="image/*" hidden><input type="file" id="profCam" accept="image/*" capture="user" hidden><div class="row-btns"><button class="btn" type="button" id="profClose">Chiudi</button></div></div>';
  document.body.appendChild(el);
  el.addEventListener('click', function (e) { if (e.target === el) close(); else onClick(e); });
  el.querySelector('#profClose').addEventListener('click', function () { if (mode) { mode = ''; paint(); } else close(); });   // da «Scegli le citazioni» si torna al profilo (Piero, 18/11/2026)
  ['#profFile', '#profCam'].forEach(function (s) { el.querySelector(s).addEventListener('change', function (e) { fromFile(e.target.files && e.target.files[0]); e.target.value = ''; }); });
  return el;
}
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var el = document.getElementById('profSheet'); if (el && !el.hidden) { if (mode) { mode = ''; paint(); } else close(); } } });
function close() { var el = document.getElementById('profSheet'); if (el) el.hidden = true; cur = null; data = null; mode = ''; photoOpen = false; goalOpen = false; }
async function open(id) {
  var el = sheet(); cur = id || null; data = null; mode = ''; photoOpen = false; el.hidden = false; paint();
  var si = el.querySelector('.sheet-in'); if (si) si.scrollTop = 0;
  if (!cur) { push(); return; }
  if (cur === 'esempio') return;
  try {
    var r = await A().rpc('profilo_di', { amico: id }); if (cur !== id) return;
    data = r || {};
    var f = okFoto(data.foto), x = ((A().state().list) || []).filter(function (y) { return y.id === id; })[0];
    if (f) pics[id] = { il: (x && x.foto_il) || (pics[id] || {}).il || '', f: f }; else delete pics[id];
  } catch (e) { if (cur !== id) return; data = { err: e && e.code === 'net' ? e.message : (/does not exist|PGRST202|404/.test(String(e && e.message)) ? 'Il profilo degli amici arriva con il prossimo aggiornamento.' : 'Non riesco ad aprire il profilo. Riprova tra poco.') }; }
  paint();
}
function quoteHTML(c) {
  var src = [c.a, c.t].filter(Boolean).join(', ');
  var ph = c.phs && c.phs.length && NL.qThumb ? NL.qThumb(c) : '';     // le tue foto della pagina (restano sul telefono: agli amici solo il testo)
  return '<blockquote class="pf-q' + (ph ? ' has-ph' : '') + '">' + ph + (c.x ? '<p>«' + esc(c.x) + '»</p>' : '<p class="pf-qph">Foto della pagina</p>') + (src || c.pg ? '<footer>' + (src ? '— ' + esc(src) : '') + (c.pg ? (src ? ' · ' : '') + 'pagina ' + esc(c.pg) : '') + '</footer>' : '') + '</blockquote>';
}
function numsLine(st) {
  var y = new Date().getFullYear(), p = ['<b>' + nf(st.n) + '</b> ' + (st.n === 1 ? 'libro' : 'libri')];
  if (st.y === y) p.push('<b>' + nf(st.ly) + '</b> ' + (st.ly === 1 ? 'letto' : 'letti') + ' nel ' + y);
  var np = (st.pa || []).length; if (np) p.push('<b>' + np + '</b> ' + (np === 1 ? 'paese' : 'paesi'));
  return '<p class="pf-nums">' + p.join(' · ') + '</p>';
}
/* ---------- i numeri (18/11/2026, scelta di Piero: «misto»): in cima la scheda colorata dell'anno (con l'obiettivo, facoltativo),
   sotto le tessere con le icone. st = numeri scelti da mostrare (o null); rel = quelli tra te e l'amico ---------- */
var goalOpen = false;
function plur(n, a, b) { return nf(n) + ' ' + (n === 1 ? a : b); }
function flags(list, max) {
  list = (list || []).filter(function (c) { return /^[A-Z]{2}$/.test(c); });
  return '<span class="pf-flags">' + list.slice(0, max).map(function (c) { return '<span title="' + esc(NL.wdCName ? NL.wdCName(c) : c) + '">' + (NL.wdFlagImg ? NL.wdFlagImg(c) : NL.wdFlag ? NL.wdFlag(c) : c) + '</span>'; }).join(' ') + (list.length > max ? ' …' : '') + '</span>';
}
function pileTxt(pages, books) {   // carta ~0,05 mm a pagina, copertina ~4 mm
  var cm = Math.round(pages * 0.005 + books * 0.4); if (cm < 5) return '';
  var cmp = cm >= 170 ? 'più di una persona' : cm >= 75 ? 'come un tavolo' : cm >= 45 ? 'come una sedia' : cm >= 30 ? 'come un righello' : cm >= 10 ? 'come una tazza' : '';
  return ': impilati sono alti circa <b>' + (cm >= 100 ? (cm / 100).toFixed(1).replace('.', ',') + ' m' : cm + ' cm') + '</b>' + (cmp ? ', ' + cmp : '');
}
function yearCard(st, own, name) {
  var y = new Date().getFullYear(), ly = st.y === y ? st.ly || 0 : 0, pgy = st.y === y ? st.pgy || 0 : 0, h = '';
  var ed = own && cur !== 'esempio';   // l'obiettivo si cambia solo nel tuo profilo
  h += '<p class="pf-yl">Nel ' + y + (own ? ' hai letto' : ' ' + esc(name || '') + ' ha letto') + '</p><b class="pf-yn">' + plur(ly, 'libro', 'libri') + '</b>';
  var ob = Number(st.ob) || 0;
  if (ob) h += '<div class="pf-goal"' + (ed ? ' role="button" tabindex="0" data-p="goal"' : '') + '><span>Obiettivo ' + nf(ob) + (ly >= ob ? ' · raggiunto! 🎉' : ' · ' + Math.round(ly / ob * 100) + '%') + '</span><span class="pf-gbar"><i style="width:' + Math.min(100, Math.round(ly / ob * 100)) + '%"></i></span></div>';
  if (ed && goalOpen) h += '<div class="pf-gedit"><label class="sr" for="pfGoal">Obiettivo di libri per il ' + y + '</label><input type="number" id="pfGoal" min="1" max="365" inputmode="numeric" value="' + (ob || '') + '" placeholder="es. 24">' +
    '<button class="btn sm" type="button" data-p="goalok">Salva</button>' + (ob ? '<button class="link" type="button" data-p="goaloff">Togli</button>' : '') + '</div>';
  else if (ed && !ob) h += '<button class="link pf-gadd" type="button" data-p="goal">Metti un obiettivo per il ' + y + '</button>';
  if (pgy) h += '<p class="pf-yt">cioè <b>' + nf(pgy) + ' pagine</b>' + pileTxt(pgy, ly) + '.</p>';
  if (ly) {
    var sp = '', n = Math.min(ly, 40), seed = (name || 'me').length;
    for (var i = 0; i < n; i++) { var hh = (seed * 47 + i * 67) % 360, ht = 55 + ((i * 37 + seed * 13) % 45); sp += '<i style="height:' + ht + '%;background:hsl(' + hh + ' 55% ' + (62 + (i % 3) * 8) + '%)"></i>'; }
    h += '<div class="pf-shelf" aria-hidden="true">' + sp + '</div>';
  } else h += '<p class="pf-yt">' + (own ? 'Quando finisci un libro, segnalo «Letto»: lo trovi qui.' : 'Ancora nessun libro finito quest\'anno.') + '</p>';
  var bits = [];
  if (st.auy && st.y === y) bits.push((own ? 'Il tuo autore dell\'anno' : 'Il suo autore dell\'anno') + ' è <b>' + esc(st.auy) + '</b> (' + plur(st.auyn, 'libro', 'libri') + ')');
  var py = (st.pay || []).filter(function (c) { return /^[A-Z]{2}$/.test(c); });
  if (py.length) bits.push((own ? 'hai viaggiato in ' : 'ha viaggiato in ') + '<b>' + plur(py.length, 'paese', 'paesi') + '</b> ' + flags(py, 6));
  if (bits.length) h += '<p class="pf-yt">' + bits.join(' e ') + '.</p>';
  return '<div class="pf-year">' + h + '</div>';
}
function tile(ico, big, txt, wide, val) {
  return '<div class="pf-tile' + (wide ? ' wide' : '') + '"><span class="pf-ti" aria-hidden="true">' + ico + '</span>' + (val ? '<span class="pf-tv">' + big + '</span>' : '<span class="pf-tn">' + big + '</span>') + '<span class="pf-tt">' + txt + '</span></div>';
}
function statsHTML(st, own, rel) {
  var t = [], card = '';
  if (st) {
    card = yearCard(st, own, own ? '' : (cur && A() && A().friendName ? A().friendName(cur) : ''));
    t.push(tile('📚', nf(st.n), st.n === 1 ? 'libro in libreria' : 'libri in libreria'));
    t.push(tile('📖', nf(st.pg), 'pagine lette' + (st.l ? ' · ' + plur(st.l, 'libro', 'libri') : '')));
    if (st.au) t.push(tile('✍️', esc(st.au), 'autore più letto · ' + plur(st.aun, 'libro', 'libri'), false, true));
    if (st.ge) t.push(tile('🏷️', esc(st.ge), 'genere più letto · ' + plur(st.gen, 'libro', 'libri'), false, true));
    if (st.ul && st.ul.t) t.push(tile('🏁', '«' + esc(st.ul.t) + '»', 'ultimo libro letto' + (st.ul.a ? ' · ' + esc(st.ul.a) : ''), false, true));
    if (st.lu && st.lu.t) t.push(tile('🐘', '«' + esc(st.lu.t) + '»', 'il più lungo' + (st.lu.pg ? ' · ' + nf(st.lu.pg) + ' pagine' : ''), false, true));
    var pa = (st.pa || []).filter(function (c) { return /^[A-Z]{2}$/.test(c); });
    if (pa.length) t.push(tile('🌍', plur(pa.length, 'paese', 'paesi'), flags(pa, 60), true, true));
    t.push(tile('🤝', nf(st.pr), st.pr === 1 ? 'libro prestato adesso' : 'libri prestati adesso'));
  }
  if (rel) {
    if (rel.comuni != null) {
      var pc = st && st.n ? Math.min(100, Math.round(rel.comuni / st.n * 100)) : 0;
      t.push(tile('🔗', nf(rel.comuni), (rel.comuni === 1 ? 'libro' : 'libri') + ' in comune con te' + (rel.comuni && pc ? ' · il ' + pc + '% dei suoi' : '')));
    }
    var d = Number(rel.tra && rel.tra.dati) || 0, v = Number(rel.tra && rel.tra.avuti) || 0;
    if (d + v) t.push(tile('⇄', nf(d + v), (d + v === 1 ? 'prestito' : 'prestiti') + ' tra voi · ' + nf(d) + ' da te, ' + nf(v) + ' a te'));
  }
  if (!t.length && !card) return '';
  if (t.length % 2) { var k = t.length - 1; t[k] = t[k].replace('class="pf-tile"', 'class="pf-tile wide"'); }   // niente buco in fondo
  return '<section class="fr-sec pf-num"><h3 class="fr-h">' + (own ? 'I tuoi numeri' : 'I suoi numeri') + '</h3>' + card + '<div class="pf-tiles">' + t.join('') + '</div></section>';
}
function head(id, name, when) {
  var av = avatar(id, name, true);
  if (!id) av = '<button type="button" class="pf-avbtn" data-p="photo" aria-expanded="' + photoOpen + '" aria-label="' + (my.foto ? 'Cambia la foto' : 'Metti una foto') + '">' + av +
    '<span class="pf-cam" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg></span></button>';   // il tocco sulla foto apre la scelta (Piero, 18/11/2026)
  else if (okFoto((pics[id] || {}).f) && NL.openPh) av = '<button type="button" class="pf-avbtn" data-p="bigfoto" aria-label="Guarda la foto">' + av + '</button>';   // foto dell'amico: un tocco la mostra grande (giro 10)
  return '<div class="pf-top">' + av + '<div class="pf-id"><b class="pf-name">' + esc(name || 'Senza nome') + '</b>' + (when ? '<small>Su Next Libris da ' + esc(when) + '</small>' : '') + '</div></div>';
}
/* una fila di copertine scorrevole (In lettura, Preferiti, Consigliati): il tocco apre il libro */
function strip(title, books, hint) {
  books = books || [];
  if (!books.length) return hint ? '<section class="fr-sec"><h3 class="fr-h">' + title + '</h3><p class="fr-small">' + hint + '</p></section>' : '';
  return '<section class="fr-sec pf-row"><h3 class="fr-h">' + title + ' <span class="fr-n">' + books.length + '</span></h3><div class="pf-strip">' + books.map(function (b) {
    var t = b.t || 'Senza titolo', img = /^https:\/\//.test(b.img || '') ? b.img : '';
    return '<button type="button" class="pf-bk' + (img ? '' : ' noimg') + '" data-p="book" data-id="' + esc(b.id) + '" title="' + esc(t + (b.a ? ' — ' + b.a : '')) + '"><span class="pf-cv" style="--pf-h:' + NL.hue(t) + '"><span class="pf-cvt" aria-hidden="true">' + esc(t) + '</span>' +
      (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-rm>' : '') + '</span><span class="pf-cap">' + esc(t) + '</span></button>';
  }).join('') + '</div></section>';
}
var I_SWAP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h15M15 4l4 4-4 4M20 16H5M9 12l-4 4 4 4"/></svg>',
  I_KEY = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l3 3M14 9l2 2"/></svg>',
  I_DROP = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M16 11h6"/></svg>';
function icoBtn(act, cls, label, inner) { return '<button type="button" class="ico gb-key' + cls + '" data-p="' + act + '" title="' + esc(label) + '" aria-label="' + esc(label) + '">' + inner + '</button>'; }
function aNome(n) { return (/^[aA]/.test(n || '') ? 'ad ' : 'a ') + n; }
function paint() {
  var el = document.getElementById('profSheet'), body = document.getElementById('profBody'); if (!el || el.hidden || !body) return;
  var h = '';
  if (cur === 'esempio') {                             /* ----- profilo della libreria di esempio: solo da guardare ----- */
    document.getElementById('profH').textContent = 'Profilo di esempio';
    var est = stats(), els = lists(), eq = myPins();
    h = head('esempio', EX_NAME, 'novembre 2026') + numsLine(est) +
      '<div class="pf-go"><button class="btn" type="button" data-p="lib">Libreria</button><button class="btn" type="button" data-p="wish">Desideri</button></div>' +
      strip('In lettura', els.let) + strip('Consigliati', els.cons);   // via i Preferiti (Piero, 18/11/2026)
    if (eq.length) h += '<section class="fr-sec"><h3 class="fr-h">Citazioni in evidenza</h3><div class="pf-qlist">' + eq.map(quoteHTML).join('') + '</div></section>';
    h += statsHTML(est, true) + '<p class="fr-small">È un profilo inventato: il tuo lo trovi nel Menu, con la tua foto e i tuoi numeri.</p>';
  } else if (cur) {                                     /* ----- il profilo di un amico ----- */
    var name = A().friendName(cur);
    document.getElementById('profH').textContent = 'Profilo di ' + name;
    var acts = (A().acts && A().acts(cur)) || {};
    var go = '<div class="pf-go"><button class="btn" type="button" data-p="lib">Libreria</button><button class="btn" type="button" data-p="wish">Desideri</button>' +
      (window.NLChat ? '<button class="btn pf-chat" type="button" data-p="chat">Scrivi</button>' : '') + '<span class="pf-icos">' +   // chat (giro 9b)
      (acts.swap ? icoBtn('swap', ' gb-swap', 'Prestiti e regali tra te e ' + name, I_SWAP) : '') +
      (acts.key ? icoBtn('key', acts.lent ? ' on' : '', acts.lent ? acts.lent + ' ' + aNome(name) : 'Presta la tua chiave Google o il worker ' + aNome(name), I_KEY + (acts.lent ? '<span class="gk-ok" aria-hidden="true">✓</span>' : '')) : '') +
      icoBtn('drop', ' gb-drop', 'Togli ' + name + ' dagli amici', I_DROP) + '</span></div>';                       // Libreria e Desideri ci sono sempre, anche se il profilo non si carica
    if (!data) h = head(cur, name, '') + go + '<p class="msg">Un momento…</p>';
    else if (data.err) h = head(cur, name, '') + go + '<p class="msg">' + esc(data.err) + '</p>';
    else if (mode === 'cits') {
      h = '<button class="link fr-back" type="button" data-p="back">‹ Profilo</button><div class="pf-qlist">' + (data.cits || []).map(quoteHTML).join('') + '</div>';
    } else {
      var nn = (A().nums && A().nums(cur)) || {};
      var ev = data.evid || (data.cit && data.cit.x ? [data.cit] : []);          // database senza la 019: la vecchia preferita
      h = head(cur, data.utente || name, since(data.creato));
      if (data.stat) h += numsLine(data.stat);
      h += go;
      if (data.desideri) h += '<section class="fr-sec pf-fol"><button class="btn' + (data.segue ? '' : ' primary') + '" type="button" data-p="segui" aria-pressed="' + !!data.segue + '">' + (data.segue ? 'Stai seguendo i suoi Desideri ✓' : 'Segui i suoi Desideri') + '</button>' +
        '<p class="fr-small">' + (data.segue ? 'Ti scriviamo al massimo una volta al giorno, solo quando c\'è qualcosa di nuovo. ' + esc(name) + ' non lo sa. Tocca per smettere.'
          : esc(name) + ' ti mostra già i suoi Desideri: seguili e scopri cosa sogna di leggere. Magari ci trovi il regalo giusto, o il tuo prossimo libro. Ti scriviamo al massimo una volta al giorno, solo quando c\'è qualcosa di nuovo, e ' + esc(name) + ' non lo saprà.') + '</p></section>';
      var rows = strip('In lettura', data.let) + strip('Consigliati', data.cons);
      h += rows;
      if (ev.length) h += '<section class="fr-sec"><h3 class="fr-h">Citazioni in evidenza</h3><div class="pf-qlist">' + ev.slice(0, PINS).map(quoteHTML).join('') + '</div></section>';
      if (data.cits && data.cits.length) h += '<ul class="fr-list fr-box"><li class="fr-row fr-go"><button class="fr-who fr-open" type="button" data-p="cits">Tutte le citazioni<small>' + data.cits.length + (data.cits.length === 1 ? ' citazione' : ' citazioni') + '</small></button><span class="n" aria-hidden="true">›</span></li></ul>';
      h += statsHTML(data.stat || null, false, { comuni: nn.libri, tra: data.tra });
      if (!data.stat && !ev.length && !rows && !(data.cits && data.cits.length)) h += '<p class="fr-small">' + esc(name) + ' non mostra altro nel suo profilo.</p>';
    }
  } else {                                              /* ----- il tuo profilo ----- */
    document.getElementById('profH').textContent = 'Il tuo profilo';
    var me = meRow(), nm = NL.name(), qs = myQuotes(), pins = myPins(), st = stats(), ls = lists();
    if (mode === 'pick') {
      h = '<button class="link fr-back" type="button" data-p="back">‹ Profilo</button><p class="fr-small">Tocca una citazione per metterla in evidenza o toglierla: al massimo ' + PINS + '. In evidenza: <b>' + pins.length + ' di ' + PINS + '</b>.</p><div class="pf-qlist">' +
        qs.slice(0, 300).map(function (q) { return '<button type="button" class="pf-qpick" data-p="pin" data-b="' + esc(q.b) + '" data-i="' + q.i + '" aria-pressed="' + q.pin + '">' + quoteHTML(q) + '</button>'; }).join('') + '</div>';
    } else {
      h = head(null, nm, since((me && me.creato) || firstTs()));
      if (photoOpen) h += '<div class="pf-photo"><button class="btn" type="button" data-p="file">Dalla galleria</button><button class="btn" type="button" data-p="cam">Fotocamera</button>' + (uid() ? '<button class="btn" type="button" data-p="google">Usa quella di Google</button>' : '') +
        (my.foto ? '<button class="link" type="button" data-p="nofoto">Togli la foto</button>' : '') + '<p class="fr-small">' + (uid() ? 'La vedono solo i tuoi amici.' : 'Resta su questo telefono: con l\'account la vedono i tuoi amici.') + '</p></div>';
      h += numsLine(st);
      h += strip('In lettura', ls.let) + strip('Consigliati', ls.cons, 'Nella pagina di un libro tocca la stella: «Lo consiglio».');
      h += '<section class="fr-sec"><h3 class="fr-h">Citazioni in evidenza' + (pins.length ? ' <span class="fr-n">' + pins.length + '</span>' : '') + '</h3>' +
        (pins.length ? '<div class="pf-qlist">' + pins.map(quoteHTML).join('') + '</div>' : '<p class="fr-small">' + (qs.length ? 'Scegli fino a ' + PINS + ' citazioni da mettere in evidenza con la puntina.' : 'Quando salvi una citazione da un libro, con la puntina puoi metterla in evidenza qui (fino a ' + PINS + ').') + '</p>') +
        (qs.length ? '<p class="pf-acts"><button class="link" type="button" data-p="pick">' + (pins.length ? 'Cambia' : 'Scegli le citazioni') + '</button></p>' : '') + '</section>';
      if (qs.length) h += '<ul class="fr-list fr-box"><li class="fr-row fr-go"><button class="fr-who fr-open" type="button" data-p="allq">Tutte le citazioni<small>' + qs.length + (qs.length === 1 ? ' citazione' : ' citazioni') + '</small></button><span class="n" aria-hidden="true">›</span></li></ul>';
      h += statsHTML(st, true);
      h += setRows(me);   // scorciatoie alle impostazioni personali (Piero, 18/11/2026)
    }
  }
  body.innerHTML = h;
}
/* ---------- scorciatoie alle impostazioni personali (Piero, 18/11/2026): Account, Amici e privacy, Notifiche, Chiave Google e worker.
   La finestra si apre sopra e, quando si chiude, torna il profilo. ---------- */
function setRow(k, t, sub) { return '<li class="fr-row fr-go"><button class="fr-who fr-open" type="button" data-p="' + k + '">' + t + '<small>' + esc(sub) + '</small></button><span class="n" aria-hidden="true">›</span></li>'; }
function setRows(me) {
  var r = '', S = window.NLSocial, au = S && S.auth && S.auth();
  if (S && S.open) r += setRow('acc', 'Account e sincronizzazione', au ? (au.email || 'Entrato con Google') : 'Entra per salvare i libri online');
  if (A()) {
    var vis = [];
    if (uid() && has018() && me) {
      var lib = !!me.libreria;
      if ('p_let' in me) { if (lib && me.p_let !== false) vis.push('cosa leggi'); if (lib && me.p_cons !== false) vis.push('i consigliati'); }
      if (me.p_cit) vis.push('le citazioni in evidenza'); if (me.p_stat && lib) vis.push('i numeri'); if (me.p_cits) vis.push('tutte le citazioni');
    }
    r += setRow('privacy', 'Amici e privacy', uid() ? 'Gli amici vedono la foto' + (vis.length ? ', ' + vis.join(', ') : ' e nient\'altro') : 'Con l\'account scegli cosa vedono gli amici');
  }
  if (window.NLPush && document.getElementById('goPush')) r += setRow('push', 'Notifiche', (document.getElementById('goPushTxt') || {}).textContent || 'Avvisi anche ad app chiusa');
  if (A() && A().keys) r += setRow('keys', 'Chiave Google e worker', 'Per trovare più libri, anche agli amici');
  r += setRow('menu', 'Menu', 'Le altre impostazioni e le info');
  return '<section class="fr-sec pf-set"><h3 class="fr-h">Impostazioni</h3><ul class="fr-list fr-box">' + r + '</ul></section>';
}
var RET_WIN = { acc: '#accSheet', privacy: '#friSheet', push: '#optSheet', keys: '#kwSheet' };
function via(k, fn) {          // chiude il profilo, apre la finestra e, quando quella si chiude, riapre il profilo
  close(); fn();
  setTimeout(function () {
    var w = document.querySelector(RET_WIN[k]); if (!w || w.hidden) return;
    var mo = new MutationObserver(function () { if (!w.hidden) return; mo.disconnect(); setTimeout(function () { if (!document.querySelector('.sheet:not([hidden])') && !(NL.guest && NL.guest())) open(); }, 60); });
    mo.observe(w, { attributes: true, attributeFilter: ['hidden'] });
  }, 80);
}
/* dal profilo dell'amico alla sua libreria (o ai desideri, o a un libro) */
function goGuest(id, tab, book) {
  var a = A(); if (!a || !a.guest) return;
  var p = a.guestId && a.guestId() === id ? Promise.resolve() : Promise.resolve(a.guest(id));
  p.then(function () {
    if (!(NL.guest && NL.guest())) return;
    NL.setTab(tab);
    if (book && NL.get(book)) NL.openCard(book);
  });
}
async function onClick(e) {
  var b = e.target.closest && e.target.closest('[data-p]'); if (!b) return;
  var a = b.dataset.p, id = cur;
  if (a === 'back') { mode = ''; paint(); }
  else if (a === 'photo') { photoOpen = !photoOpen; paint(); }
  else if (a === 'bigfoto') { var bf = okFoto((pics[id] || {}).f); if (bf) { NL.openPh(bf, (data && data.utente) || ''); var pv = document.getElementById('phView'); if (pv) pv.classList.add('au'); } }
  else if (a === 'goal') { goalOpen = !goalOpen; paint(); if (goalOpen) setTimeout(function () { var g = document.getElementById('pfGoal'); if (g) g.focus(); }, 30); }
  else if (a === 'goalok' || a === 'goaloff') {
    var gv = a === 'goaloff' ? 0 : Math.round(Number((document.getElementById('pfGoal') || {}).value) || 0);
    if (a === 'goalok' && !(gv >= 1 && gv <= 365)) { NL.toast('Scrivi un numero di libri da 1 a 365.'); return; }
    my.ob = gv ? { y: new Date().getFullYear(), n: gv } : null; my.t = Date.now(); save(); goalOpen = false; paint(); push();
    NL.toast(gv ? 'Obiettivo: ' + plur(gv, 'libro', 'libri') + ' nel ' + new Date().getFullYear() + '.' : 'Obiettivo tolto.');
  }
  else if (a === 'file') document.getElementById('profFile').click();
  else if (a === 'cam') document.getElementById('profCam').click();
  else if (a === 'google') { b.disabled = true; await fromGoogle(); }
  else if (a === 'nofoto') { setFoto(''); NL.toast('Foto tolta.'); }
  else if (a === 'pick' || a === 'cits') { mode = a; paint(); var si = document.querySelector('#profSheet .sheet-in'); if (si) si.scrollTop = 0; }
  else if (a === 'pin') { if (NL.togglePin) NL.togglePin(b.dataset.b, Number(b.dataset.i)); paint(); }
  else if (a === 'allq') { close(); NL.openQuotes(); }
  else if (a === 'privacy') via('privacy', function () { A().open(true); });
  else if (a === 'keys') via('keys', function () { A().keys(); });
  else if (a === 'acc') via('acc', function () { window.NLSocial.open(); });
  else if (a === 'push') via('push', function () { NL.openOptions('push'); });
  else if (a === 'menu') { close(); NL.openMenu(); }
  else if (a === 'segui' && cur && data) { b.disabled = true; var on = !data.segue; if (await A().follow(cur, on)) data.segue = on; paint(); }
  else if (id === 'esempio' && (a === 'lib' || a === 'wish')) { close(); NL.setTab(a); window.scrollTo({ top: 0 }); NL.emit('guest'); }
  else if (id === 'esempio' && a === 'book') { var eb = b.dataset.id; close(); NL.openCard(eb); }
  else if ((a === 'lib' || a === 'wish') && id) { close(); goGuest(id, a); }
  else if (a === 'book') { var bid = b.dataset.id; close(); if (id) goGuest(id, 'lib', bid); else if (NL.showBook) NL.showBook(bid); }
  else if (a === 'chat' && id && window.NLChat) { var cn = (data && data.utente) || A().friendName(id); close(); setTimeout(function () { window.NLChat.to(id, cn); }, 60); }   // Scrivi (giro 9b)
  else if (a === 'swap' && id && A().swapSheet) A().swapSheet(id);
  else if (a === 'key' && id && A().keySheet) A().keySheet(id);
  else if (a === 'drop' && id && A().dropSheet) A().dropSheet(id);
}

/* ---------- quando si aggiorna ---------- */
function onFriends() {
  push(); loadPics();
  if (!cur) { paint(); return; }
  var x = ((A().state().list) || []).filter(function (y) { return y.id === cur; })[0];
  if (!x || x.stato !== 'amici') close();                                             // tolto dagli amici: il profilo si chiude
}
if (A() && A().onLoad) A().onLoad(onFriends);
else document.addEventListener('DOMContentLoaded', function () { if (A() && A().onLoad) A().onLoad(onFriends); });
NL.on('privacy', function () { if (!cur) paint(); });
NL.on('pins', function () { if (my.cit) { my.cit = null; my.t = Date.now(); save(); push(); } if (!cur) paint(); });   // scelte le puntine, la vecchia preferita non serve più
NL.on('lc', function () { if (!cur) paint(); });
NL.on('keys', function () { if (cur && data && !data.err && !mode) paint(); });
window.NLProfilo = { open: open, avatar: avatar, stats: stats, lists: lists, pins: myPins, state: function () { return { my: my, pics: pics, cur: cur, data: data, mode: mode }; }, push: push };   // per amici.js e le prove
if (NL.renderOwner) NL.renderOwner();      // il nome in testata diventa il tasto del profilo
/* giro 7 (in prova): «Il mio profilo» in cima al Menu, con la tua foto */
(function menu() {
  var top = document.querySelector('#drawerOpts .dmain'); if (!top || document.getElementById('goProf')) return;
  var gp = document.createElement('button'); gp.type = 'button'; gp.className = 'dopt dgo pf-menu'; gp.id = 'goProf';
  gp.innerHTML = '<span class="pf-menu-av"></span><span><b>Il mio profilo</b><small>Foto, citazioni, numeri</small></span><span class="n" aria-hidden="true">›</span>';
  top.insertBefore(gp, top.firstChild);
  gp.addEventListener('click', function () { NL.fromMenu(function () { open(); }); });
})();
function menuAv() { var s = document.querySelector('#goProf .pf-menu-av'); if (s) s.innerHTML = avatar(null, (NL.name && NL.name()) || ''); }
menuAv();
NL.on('name', function () { menuAv(); });
})();
