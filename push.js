/* Next Libris · modulo «Notifiche push» (16/11/2026; nella vera dalla versione 102). Scelte di Piero del 16/11/2026.
   Gli avvisi della campanella (tranne «limite» delle ricerche) arrivano anche con l'app chiusa, con lo stesso testo.
   - Impostazioni › Notifiche: interruttore «Notifiche sul telefono» (acceso di partenza: manca solo il permesso del
     telefono, che si chiede con un tocco), scelta dei tipi, orari di silenzio (di partenza 22-8).
   - Dopo l'accesso, una volta sola: riga «Ricevi notifiche dagli amici» con la scelta dei tipi, «Attiva» / «Non ora».
   - Il server (supabase/014_push.sql e la funzione «push» nel ramo prove) tiene le notifiche delle ore di silenzio e le
     manda dopo; da 3 in su un solo riepilogo. Le preferenze valgono su tutti i telefoni dell'account; l'iscrizione è
     di ogni telefono. Uscendo dall'account il telefono smette di riceverle.
   - iPhone: solo con l'app aggiunta alla schermata Home (iOS 16.4 o più recente).
   Usa window.NL e window.NLSocial (social.js); sw.js mostra i push e apre la campanella (NLNotifiche, notifiche.js). */
(function () {
'use strict';
var NL = window.NL, S = window.NLSocial; if (!NL || !S || !S.call) return;
var esc = NL.esc, K = 'catalogo-libri-push';
// chiave VAPID pubblica di ogni progetto Supabase (quella privata sta nel Vault del progetto)
var VAPID = {
  prova: 'BGUN17qpp1ShPDv2fuxEsHWp5sD4nzeesR_YJSSqbAjF_cWus-SlIoaWzaSXVTMNzRPyn6CcXnL_mDFBFTWSu6M',
  '': 'BAtSWsab23ITzZilyPsJn86L63qSIYK54WgnNbNusBUoY_j4i27xWLUbTDynwB7lUJMW9yadEbiQLrbANS45CHc'   // vera (102)
};
var KEY = VAPID[NL.COPIA] || '';
var TIPI = [
  ['amicizie', 'Amicizie', 'Richieste di amicizia e amicizie accettate'],
  ['prestiti', 'Libri in prestito', 'Prestiti, regali, restituzioni e «Me lo presti?»'],
  ['consigli', 'Consigli e desideri', 'Libri consigliati, desideri degli amici che segui, tuoi desideri che un amico ha in libreria'],
  ['chiavi', 'API condivise', 'API Google Libri prestata o chiesta da un amico'],
  ['chat', 'Chat', 'Messaggi nuovi e richieste di messaggio: subito, una sola finché non leggi']];   // giro 9b: senza questa riga la scelta «chat» del server andrebbe persa al primo salvataggio
var ALL = TIPI.map(function (t) { return t[0]; });
var st = rd() || {};                    // on (interruttore, acceso di partenza), asked (riga dopo l'accesso già vista), prefs
if (st.on === undefined) st.on = true;
var prefs = st.prefs || { tipi: ALL.slice(), silenzio_da: 22, silenzio_a: 8 };
prefs.tipi = (prefs.tipi || ALL).filter(function (t) { return ALL.indexOf(t) >= 0; });   // «richieste» ora sta in «prestiti»
var subOk = false, busy = false, prefsLoaded = false;

function rd() { try { return JSON.parse(NL.ls.get(K) || 'null'); } catch (e) { return null; } }
function wr() { st.prefs = prefs; NL.ls.set(K, JSON.stringify(st)); }
function rpc(name, body) { return S.call('/rest/v1/rpc/' + name, { method: 'POST', user: true, body: body || {} }); }
function uid() { var a = S.auth(); return a && a.uid; }
function $(id) { return document.getElementById(id); }
function apple() { return /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1); }
function standalone() { return navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches); }
function supported() { return !!KEY && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
function perm() { return 'Notification' in window ? Notification.permission : 'default'; }
function b64(s) {
  var p = (s + '===='.slice((s.length + 3) % 4 + 1)).replace(/-/g, '+').replace(/_/g, '/'), r = atob(p), a = new Uint8Array(r.length);
  for (var i = 0; i < r.length; i++) a[i] = r.charCodeAt(i);
  return a;
}
function tz() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome'; } catch (e) { return 'Europe/Rome'; } }
async function reg() { return navigator.serviceWorker.getRegistration ? (await navigator.serviceWorker.getRegistration()) || navigator.serviceWorker.ready : navigator.serviceWorker.ready; }
async function currentSub() { try { var r = await reg(); return r && r.pushManager ? await r.pushManager.getSubscription() : null; } catch (e) { return null; } }

/* ---------- iscrizione di questo telefono ---------- */
// da chiamare dentro il tocco: la prima cosa è la richiesta del permesso (iPhone la vuole subito, senza attese prima)
async function enable(tipi) {
  if (!supported() || !uid() || busy) return false;
  busy = true;
  try {
    var p = perm() === 'granted' ? 'granted' : await Notification.requestPermission();
    if (p !== 'granted') { st.on = false; wr(); return false; }
    var r = await reg(), sub = await r.pushManager.getSubscription();
    if (!sub) sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(KEY) });
    var j = sub.toJSON();
    await rpc('push_iscrivi', { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth });
    if (tipi) prefs.tipi = tipi;
    st.on = true; st.asked = true; subOk = true; wr();
    await savePrefs();
    return true;
  } catch (e) {
    NL.toast(e && e.code === 'net' ? 'Senza rete: riprova quando torna.' : 'Le notifiche non si sono attivate. Riprova tra poco.');
    return false;
  } finally { busy = false; paintAll(); }
}
async function disable() {
  st.on = false; subOk = false; wr();
  var sub = await currentSub();
  if (sub) {
    try { if (uid()) await rpc('push_cancella', { endpoint: sub.endpoint }); } catch (e) { if (window.nlErr) nlErr(e); }
    try { await sub.unsubscribe(); } catch (e) { if (window.nlErr) nlErr(e); }
  }
  paintAll();
}
// all'apertura: se l'interruttore è acceso e il permesso c'è già, l'iscrizione si rinnova da sola (senza chiedere nulla)
async function check() {
  if (!supported() || !uid()) { subOk = false; return; }
  var sub = await currentSub();
  subOk = !!sub && perm() === 'granted';
  if (st.on && perm() === 'granted' && Date.now() - (st.renewed || 0) > 864e5) {
    st.renewed = Date.now(); wr();
    enable();                                             // rinnova (iscrizione nuova o passata a questo account)
  }
}

/* ---------- preferenze (sul server, uguali su tutti i telefoni) ---------- */
async function loadPrefs() {
  if (!uid()) return;
  try { var j = await rpc('push_mie_preferenze'); if (j && j.tipi) { prefs = { tipi: j.tipi.filter(function (t) { return ALL.indexOf(t) >= 0; }), silenzio_da: j.silenzio_da, silenzio_a: j.silenzio_a }; prefsLoaded = true; wr(); } } catch (e) { if (window.nlErr) nlErr(e); }
}
var saveT = 0;
function savePrefs() {
  clearTimeout(saveT); wr();
  return new Promise(function (ok) {
    saveT = setTimeout(async function () {
      try { await rpc('push_salva_preferenze', { tipi: prefs.tipi, silenzio_da: prefs.silenzio_da, silenzio_a: prefs.silenzio_a, fuso: tz() }); }
      catch (e) { NL.toast('Scelta non salvata: ' + (e && e.message || 'riprova')); }
      ok();
    }, 400);
  });
}

/* ---------- Impostazioni › Notifiche ---------- */
function hours(id, v) {
  var h = '<select id="' + id + '">';
  for (var i = 0; i < 24; i++) h += '<option value="' + i + '"' + (i === v ? ' selected' : '') + '>' + (i < 10 ? '0' : '') + i + ':00</option>';
  return h + '</select>';
}
function checks(cls, on) {
  return TIPI.map(function (t) {
    return '<label class="check"><input type="checkbox" class="' + cls + '" value="' + t[0] + '"' + (on.indexOf(t[0]) >= 0 ? ' checked' : '') + '><span>' + esc(t[1]) + '<small>' + esc(t[2]) + '</small></span></label>';
  }).join('');
}
function section() {
  var s = document.querySelector('#optSheet .opt-sec[data-sec="push"]');
  if (s) return s;
  var last = document.querySelector('#optSheet .opt-sec:last-of-type'); if (!last) return null;
  s = document.createElement('section'); s.className = 'opt-sec pu'; s.dataset.sec = 'push'; s.dataset.title = 'Notifiche';
  last.parentNode.insertBefore(s, last.nextSibling);
  s.addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'puOn') { if (t.checked) { if (supported()) enable(); else { st.on = true; wr(); paintAll(); } } else disable(); return; }
    if (t.classList.contains('pu-t')) { prefs.tipi = Array.prototype.filter.call(s.querySelectorAll('.pu-t'), function (x) { return x.checked; }).map(function (x) { return x.value; }); savePrefs(); return; }
    if (t.id === 'puQuiet') { if (t.checked) { prefs.silenzio_da = 22; prefs.silenzio_a = 8; } else { prefs.silenzio_da = 0; prefs.silenzio_a = 0; } paintSec(); savePrefs(); return; }
    if (t.id === 'puDa' || t.id === 'puA') { prefs[t.id === 'puDa' ? 'silenzio_da' : 'silenzio_a'] = parseInt(t.value, 10) || 0; if (prefs.silenzio_da === prefs.silenzio_a) { $('puQuiet').checked = false; } paintSec(); savePrefs(); }
  });
  s.addEventListener('click', function (e) { if (e.target.closest('#puAllow')) enable(); if (e.target.closest('#puLogin')) { if (window.__app && window.__app.closeOptions) window.__app.closeOptions(); if (S.open) setTimeout(S.open, 60); } });
  return s;
}
function stateText() {
  if (!uid()) return ['off', 'Per ricevere gli avvisi degli amici entra con Google.', '<button type="button" class="link" id="puLogin">Account e sincronizzazione ›</button>'];
  if (!KEY) return ['off', 'In questa copia dell\'app le notifiche non ci sono ancora.'];
  if (!supported()) {
    if (apple() && !standalone()) return ['warn', 'Su iPhone le notifiche arrivano solo se Next Libris è nella schermata Home: in Safari tocca Condividi › «Aggiungi alla schermata Home», poi apri l\'app da lì (serve iOS 16.4 o più recente).'];
    return ['warn', 'Questo browser non riceve notifiche. Su Android usa Chrome.'];
  }
  if (perm() === 'denied') return ['warn', 'Le notifiche di Next Libris sono bloccate dal telefono o dal browser: sbloccale dalle loro impostazioni (Notifiche › Next Libris), poi torna qui.'];
  if (!st.on) return ['off', 'Spente su questo telefono: gli avvisi li trovi nella campanella quando apri l\'app.'];
  if (subOk) return ['ok', 'Attive su questo telefono, anche con l\'app chiusa.'];
  return ['wait', 'Manca solo il permesso del telefono.', '<button type="button" class="btn primary pu-allow" id="puAllow">Permetti le notifiche</button>'];
}
function paintSec() {
  var s = section(); if (!s) return;
  var t = stateText(), q = prefs.silenzio_da !== prefs.silenzio_a, can = !!uid() && !!KEY;
  if (!s.firstChild) {
    s.innerHTML = '<label class="check"><input type="checkbox" id="puOn"><span>Notifiche sul telefono<small>Gli avvisi della campanella arrivano anche con l\'app chiusa, con il nome dell\'amico e il titolo del libro.</small></span></label>' +
      '<div class="pu-state" id="puState" role="status"></div>' +
      '<fieldset class="choice" id="puTipiBox"><legend>Quali avvisi</legend>' + checks('pu-t', prefs.tipi) + '</fieldset>' +
      '<fieldset class="choice"><legend>Orari di silenzio</legend>' +
      '<label class="check"><input type="checkbox" id="puQuiet"><span>Niente notifiche in certe ore</span></label>' +
      '<div class="pu-hours" id="puHours"><label>Dalle ' + hours('puDa', prefs.silenzio_da) + '</label><label>alle ' + hours('puA', prefs.silenzio_a) + '</label></div>' +
      '<p class="hint">Gli avvisi di quelle ore arrivano alla fine del silenzio; se sono 3 o più, in un solo messaggio. Nella campanella ci sono sempre tutti.</p></fieldset>';
  }
  $('puOn').checked = !!st.on && perm() !== 'denied'; $('puOn').disabled = !can || perm() === 'denied';
  var box = $('puState'); box.className = 'pu-state pu-' + t[0]; box.innerHTML = '<span>' + esc(t[1]) + '</span>' + (t[2] || '');
  Array.prototype.forEach.call(s.querySelectorAll('.pu-t'), function (x) { x.checked = prefs.tipi.indexOf(x.value) >= 0; x.disabled = !can; });
  $('puQuiet').checked = q; $('puQuiet').disabled = !can;
  $('puDa').value = String(q ? prefs.silenzio_da : 22); $('puA').value = String(q ? prefs.silenzio_a : 8);
  $('puDa').disabled = $('puA').disabled = !can || !q;
  $('puHours').classList.toggle('pu-off', !q);
}
function paintMenu() {
  var set = $('setList'); if (!set) return;
  var b = $('goPush');
  if (!b) {
    b = document.createElement('button'); b.type = 'button'; b.id = 'goPush'; b.className = 'dopt'; b.dataset.sec = 'push';
    b.innerHTML = '<span><b>Notifiche</b><small id="goPushTxt"></small></span><span class="n" aria-hidden="true">›</span>';
  }
  var fo = $('goFriOpt'), nx = fo ? fo.nextSibling : set.querySelector('.dopt[data-sec="search"]');
  if (b !== nx) set.insertBefore(b, nx);                 // dopo «Amici e privacy», prima di Ricerca (17/11/2026)
  $('goPushTxt').textContent = subOk && st.on && uid() ? 'Attive · ' + quietTxt() : 'Avvisi anche ad app chiusa';
}
function quietTxt() { return prefs.silenzio_da === prefs.silenzio_a ? 'sempre' : 'silenzio ' + prefs.silenzio_da + '-' + prefs.silenzio_a; }

/* ---------- riga dopo l'accesso (una volta sola) ---------- */
function paintAsk() {
  var box = $('puAsk');
  var show = uid() && supported() && !st.asked && perm() !== 'denied' && !subOk;
  if (!box) {
    if (!show) return;
    var anchor = $('donAsk') || $('list'); if (!anchor) return;   // con gli avvisi dei moduli, dopo quelli degli amici («Me lo presti?», resi)
    box = document.createElement('section'); box.id = 'puAsk'; box.className = 'pu-ask lay-note'; box.hidden = true; box.setAttribute('aria-labelledby', 'puAskH');
    box.innerHTML = '<h2 id="puAskH">Ricevi notifiche dagli amici</h2><p>Anche con l\'app chiusa. Scegli quali:</p>' +
      '<div class="pu-ask-t">' + checks('pu-a', prefs.tipi) + '</div>' +
      '<p class="pu-ask-q">Di notte (22-8) restano in attesa: puoi cambiare gli orari in Impostazioni › Notifiche.</p>' +
      '<div class="pu-acts"><button type="button" class="btn primary" id="puAskGo">Attiva</button><button type="button" class="btn quiet" id="puAskNo">Non ora</button></div>';
    anchor.parentNode.insertBefore(box, anchor);
    box.addEventListener('click', function (e) {
      if (e.target.closest('#puAskGo')) {
        var tipi = Array.prototype.filter.call(box.querySelectorAll('.pu-a'), function (x) { return x.checked; }).map(function (x) { return x.value; });
        st.asked = true; wr(); box.hidden = true;
        enable(tipi).then(function (ok) { if (ok) NL.toast('Notifiche attive su questo telefono'); });
      }
      if (e.target.closest('#puAskNo')) { st.asked = true; st.on = false; wr(); box.hidden = true; paintAll(); NL.toast('Puoi attivarle quando vuoi da Impostazioni › Notifiche'); }
    });
  }
  box.hidden = !show;
}

/* ---------- numero sull'icona e messaggi dal service worker ---------- */
function badge(n) {
  try { if (navigator.setAppBadge) { if (n) navigator.setAppBadge(n); else navigator.clearAppBadge(); } } catch (e) { if (window.nlErr) nlErr(e); }
  if (!n && 'serviceWorker' in navigator) {                // campanella letta: tolgo anche le notifiche rimaste sul telefono
    reg().then(function (r) { return r && r.getNotifications ? r.getNotifications() : []; }).then(function (l) { (l || []).forEach(function (x) { if (/^nl-/.test(x.tag || '')) x.close(); }); }).catch(function () {});
  }
}
function openBell() { var N = window.NLNotifiche; if (N) { N.load().then(function () { N.open(); }); } }
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', function (e) {
  var d = e.data || {};
  if (d.nl === 'push' && window.NLNotifiche) window.NLNotifiche.load();
  if (d.nl === 'apri-notifiche') openBell();
});
(function () {                                            // aperta toccando una notifica: …/?nt=1
  var q = new URLSearchParams(location.search); if (q.get('nt') !== '1') return;
  q.delete('nt');
  try { history.replaceState(history.state, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); } catch (e) { if (window.nlErr) nlErr(e); }
  setTimeout(function () { if (uid()) openBell(); }, 1800);
})();

function paintAll() { paintMenu(); paintSec(); paintAsk(); }
NL.on('menu', function () { setTimeout(paintMenu, 0); });
NL.on('options', function (sec) {
  if (sec !== 'push') return;
  section(); paintSec();
  Promise.all([check(), prefsLoaded ? null : loadPrefs()]).then(paintSec);
});
S.onAuth(function () {
  if (!uid()) {                                           // uscita: questo telefono non riceve più gli avvisi di quell'account
    subOk = false; st.asked = false; st.renewed = 0; wr();
    currentSub().then(function (s) { if (s) s.unsubscribe().catch(function () {}); });
    badge(0); paintAll(); return;
  }
  prefsLoaded = false;
  Promise.all([check(), loadPrefs()]).then(paintAll);
});
if (uid()) setTimeout(function () { Promise.all([check(), prefsLoaded ? null : loadPrefs()]).then(paintAll); }, 1200);
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') check().then(paintAll); });
window.NLPush = { badge: badge, enable: enable, disable: disable, state: function () { return { on: st.on, asked: !!st.asked, sub: subOk, prefs: prefs }; } };   // badge: notifiche.js; il resto per le prove
})();
