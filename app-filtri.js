/* Next Libris · app, parte 8 di 10 (app-filtri.js): Filtri, Aspetto, versione, suggerimenti, copie.
   Dal 17/11/2026 app.js è diviso in 10 file (prima era una sola funzione). Sono script classici, senza import:
   le funzioni e le variabili di primo livello sono globali e servono a tutte le parti; l'ordine in index.html
   e in SHELL di sw.js conta (app.js, app-aggiungi.js, …, app-avvio.js: l'ultima fa partire l'app). */
'use strict';
/* ---------- pannello Filtri (a sinistra): si apre dal pulsante o trascinando il pollice dal bordo sinistro verso destra ---------- */
var NONE = '\u0001';
var READ_TXT = { da: 'Da leggere', in: 'In lettura', ok: 'Letti', no: 'Non indicato' };
var FLT_TXT = { notmine: 'Che non hai', common: 'In comune', qs: 'Con citazioni', fav: 'Consigliati', loan: 'In prestito', gone: 'Venduti e regalati', guess: 'Da verificare', dup: 'Copie e doppioni' };
function facetKey(s) { var k = L.norm(String(s || '').trim().replace(/\s+/g, ' ')); return k || NONE; }
/* scaffali o generi del tab corrente: chiave normalizzata, nome piu' usato, quanti libri */
function facets(field) {
  var m = {};
  tabBooks().forEach(function (b) {
    var k = facetKey(b[field]);
    var e = m[k] || (m[k] = { k: k, n: 0, names: {} });
    e.n++;
    if (k !== NONE) e.names[b[field].trim()] = (e.names[b[field].trim()] || 0) + 1;
  });
  return Object.keys(m).map(function (k) {
    var e = m[k], best = '';
    Object.keys(e.names).forEach(function (s) { if (!best || e.names[s] > e.names[best]) best = s; });
    return { k: k, n: e.n, name: k === NONE ? '' : best };
  });
}
function facetName(field, k) { if (k === NONE) return field === 'sh' ? 'senza scaffale' : 'senza genere'; var f = facets(field).find(function (x) { return x.k === k; }); return f ? f.name : ''; }
var frFlt = '';                 // filtro «ricevuti da»
var drawerMore = {};            // scaffali / generi: elenco completo aperto con «Altri…»
function activeCount() { return (flt ? 1 : 0) + (frFlt ? 1 : 0) + (readFlt && tab === 'lib' ? 1 : 0) + (shFlt ? 1 : 0) + (genFlt ? 1 : 0) + (autFlt ? 1 : 0) + (edFlt ? 1 : 0) + (paFlt ? 1 : 0); }
function authorsOf(b) { return String(b.a || '').split(/\s*[,;]\s*/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 1; }); }
function clearFilters() {
  flt = ''; readFlt = ''; shFlt = ''; genFlt = ''; autFlt = ''; autName = ''; edFlt = ''; frFlt = ''; paFlt = '';
  q = ''; $('#q').value = ''; collapseCards();
  renderList(); updateSummary();
  if (drawerOpen) renderDrawer();
}
function updateActiveFilters() {
  var o = '';
  function chip(k, txt) { o += '<button class="chip on" data-clear="' + k + '" aria-label="Togli il filtro ' + esc(txt) + '">' + esc(txt) + '<span class="x" aria-hidden="true">×</span></button>'; }
  if (flt && FLT_TXT[flt]) chip('flt', FLT_TXT[flt]);   // anche «In prestito» e «Da verificare»: il filtro usato si vede sempre (16/11/2026)
  if (frFlt) chip('fr', 'Ricevuti da ' + frFlt);
  if (readFlt && tab === 'lib') chip('read', READ_TXT[readFlt]);
  if (shFlt) chip('sh', shFlt === NONE ? 'Senza scaffale' : 'Scaffale: ' + facetName('sh', shFlt));
  if (genFlt) chip('gen', genFlt === NONE ? 'Senza genere' : 'Genere: ' + facetName('gen', genFlt));
  if (autFlt) chip('aut', 'Autore: ' + auShow(autName));
  if (edFlt) chip('ed', 'Casa editrice: ' + facetName('e', edFlt));
  if (paFlt) chip('pa', paChipText());
  $('#activeFlt').innerHTML = o;
  var n = activeCount(), bd = $('#fltBadge');
  bd.hidden = !n; bd.textContent = n;
  $('#btnFilters').setAttribute('aria-pressed', n ? 'true' : 'false');
  $('#edgeTab').classList.toggle('on', !!n);
  $('#edgeTab').setAttribute('aria-label', 'Apri il menu' + (n ? ' (' + n + (n === 1 ? ' attivo)' : ' attivi)') : ''));
  $('#btnFilters').setAttribute('aria-label', 'Filtri' + (n ? ' (' + n + (n === 1 ? ' filtro attivo)' : ' filtri attivi)') : ''));
}
$('#activeFlt').addEventListener('click', function (e) {
  var x = e.target.closest('[data-clear]');
  if (!x) return;
  var k = x.dataset.clear;
  if (k === 'flt') flt = ''; else if (k === 'read') readFlt = ''; else if (k === 'sh') shFlt = ''; else if (k === 'gen') genFlt = '';
  else if (k === 'aut') { autFlt = ''; autName = ''; } else if (k === 'ed') edFlt = ''; else if (k === 'fr') frFlt = ''; else if (k === 'pa') paFlt = '';
  collapseCards(); renderList(); updateSummary();
});
function renderDrawer() {
  var books = tabBooks(), lib = tab === 'lib', o = '';
  /* filtri come «pillole» raggruppate per tema; il numero accanto dice quanti libri ci sono */
  function pill(group, val, label, n, cur, extra) {
    return '<button type="button" class="dpill' + (extra || '') + '" data-g="' + group + '" data-v="' + esc(val) + '" aria-pressed="' + (cur === val ? 'true' : 'false') + '">' + esc(label) + (n != null ? '<span class="n">' + n + '</span>' : '') + '</button>';
  }
  var cnt = { fav: 0, loan: 0, gone: 0, guess: 0, dup: 0, qs: 0 }, dm = L.analyzeDups(dupPool()), frs = {};
  books.forEach(function (b) { if (b.qs && b.qs.length) cnt.qs++; if (b.fav) cnt.fav++; if (b.fr) frs[b.fr] = (frs[b.fr] || 0) + 1; if (b.p) cnt.loan++; if (b.xs) cnt.gone++; if (b.g.length) cnt.guess++; if (dm[b.id]) cnt.dup++; });
  o += '<h3>' + (lib ? 'Libri' : 'Desideri') + '</h3><div class="dpills">' + pill('flt', '', lib ? 'Tutti' : 'Tutti', books.length, ['guess', 'dup'].indexOf(flt) >= 0 ? null : flt);
  (lib ? ['fav', 'loan', 'qs', 'gone'] : ['qs']).forEach(function (k) {
    if (cnt[k] || flt === k || k === 'loan' || k === 'fav') o += pill('flt', k, FLT_TXT[k], cnt[k], flt);
  });
  o += '</div>';
  if (lib) {
    var rc = { da: 0, in: 0, ok: 0, no: 0 };
    books.forEach(function (b) { rc[b.rs || 'no']++; });
    o += '<h3>Lettura</h3><div class="dpills">' + pill('read', '', 'Tutti', null, readFlt);
    ['da', 'in', 'ok', 'no'].forEach(function (k) { if (rc[k] || readFlt === k || k !== 'no') o += pill('read', k, READ_TXT[k], rc[k], readFlt); });
    o += '</div>';
  }
  [['sh', 'Scaffale', 'Senza scaffale', shFlt], ['gen', 'Genere', 'Senza genere', genFlt]].forEach(function (f) {
    var list = facets(f[0]), named = list.filter(function (x) { return x.k !== NONE; });
    if (!named.length && !f[3]) return;
    named.sort(f[0] === 'sh' ? function (x, y) { return coll.compare(x.name, y.name); } : function (x, y) { return y.n - x.n || coll.compare(x.name, y.name); });
    var none = list.find(function (x) { return x.k === NONE; });
    var all = named.concat(none ? [none] : []), MAXP = 8, open = drawerMore[f[0]] || all.length <= MAXP + 2;
    var shown = open ? all : all.slice(0, MAXP);
    if (!open && f[3] && !shown.some(function (x) { return x.k === f[3]; })) { var cur = all.find(function (x) { return x.k === f[3]; }); if (cur) shown = shown.concat([cur]); }   // quello scelto resta visibile
    o += '<h3>' + f[1] + '</h3><div class="dpills">' + shown.map(function (x) {
      return pill(f[0], x.k, x.k === NONE ? f[2] : x.name, x.n, f[3], x.k === NONE ? ' none-sh' : '');
    }).join('') + (open ? '' : '<button type="button" class="dpill more" data-g="more" data-v="' + f[0] + '">Altri ' + (all.length - shown.length) + '…</button>') + '</div>';
  });
  o += paDrawerHTML();                                 // paese dell'autore (giro 2, 18/11/2026)
  var frNames = Object.keys(frs).sort(coll.compare);
  if (frNames.length || frFlt) o += '<h3>Ricevuti da</h3><div class="dpills">' + frNames.map(function (n) {
    return '<button type="button" class="dpill" data-g="fr" data-v="' + esc(n) + '" aria-pressed="' + (frFlt === n ? 'true' : 'false') + '">' + esc(n) + '<span class="n">' + frs[n] + '</span></button>';
  }).join('') + '</div>';
  /* da sistemare: tenuti a parte, in fondo, perche' non servono a sfogliare ma a mettere ordine */
  var fix = ['guess', 'dup'].filter(function (k) { return cnt[k] || flt === k; });
  if (fix.length) o += '<h3>Da sistemare</h3><div class="dpills">' + fix.map(function (k) { return pill('flt', k, FLT_TXT[k], cnt[k], flt, ' fix'); }).join('') + '</div>';
  var pre = '';
  if (autFlt) pre += '<p class="dq"><span>Autore: ' + esc(auShow(autName)) + '</span><button type="button" class="ico" data-g="aut" data-v="" aria-label="Togli il filtro autore">×</button></p>';
  if (edFlt) pre += '<p class="dq"><span>Casa editrice: ' + esc(facetName('e', edFlt)) + '</span><button type="button" class="ico" data-g="ed" data-v="" aria-label="Togli il filtro casa editrice">×</button></p>';
  o = pre + o;
  var body = $('#drawerBody'), st = body.scrollTop;
  $('#drawerFlt').innerHTML = o;
  body.scrollTop = st;
  $('#sort').value = sortBy;
  $('#grp').value = settings.grp || '';
  pickSync(); pickClose();
  paintMenuHome();
  $('#drawerHint').hidden = !!settings.swiped;
  updateDrawerFoot();
}
function updateDrawerFoot() {
  var n = visible().length;
  $('#drawerShow').textContent = n === 1 ? 'Mostra 1 libro' : 'Mostra ' + n + ' libri';
  $('#drawerReset').disabled = !activeCount() && !q;
  $('#drawerQ').hidden = !q;
  $('#drawerQTxt').textContent = 'Ricerca: «' + q + '»';
}
$('#drawerFlt').addEventListener('click', function (e) {
  var x = e.target.closest('[data-g]');
  if (!x) return;
  var g = x.dataset.g, v = x.dataset.v;
  if (g === 'quotes') { closeDrawer(); openAllQuotes(); return; }
  if (g === 'more') { drawerMore[v] = true; renderDrawer(); return; }
  if (g === 'flt') flt = flt === v ? '' : v;
  else if (g === 'read') readFlt = readFlt === v ? '' : v;
  else if (g === 'sh') shFlt = shFlt === v ? '' : v;
  else if (g === 'gen') genFlt = genFlt === v ? '' : v;
  else if (g === 'fr') frFlt = frFlt === v ? '' : v;
  else if (g === 'pa') paFlt = paFlt === v ? '' : v;
  else if (g === 'aut') { autFlt = ''; autName = ''; }
  else if (g === 'ed') edFlt = '';
  collapseCards(); renderList(); updateSummary(); renderDrawer();
});

var drawerOpen = false, drawerPushed = false, drawerTimer = null, drawerReturn = null;
var drawerEl = $('#drawer'), scrimEl = $('#drawerScrim');
function drawerWidth() { return drawerEl.getBoundingClientRect().width || 320; }
function showDrawerEls() {
  clearTimeout(drawerTimer);
  drawerEl.hidden = false; scrimEl.hidden = false; drawerEl.removeAttribute('inert');
}
/* posizione durante il trascinamento: px = quanto pannello si vede */
function dragDrawer(px) {
  var w = drawerWidth();
  px = Math.max(0, Math.min(w, px));
  drawerEl.style.transition = 'none'; scrimEl.style.transition = 'none';
  drawerEl.style.transform = 'translateX(' + (px - w) + 'px)';
  scrimEl.style.opacity = String(px / w);
}
function releaseDrawerStyles() {
  drawerEl.style.transition = ''; scrimEl.style.transition = '';
  drawerEl.style.transform = ''; scrimEl.style.opacity = '';
}
var drawerTab = 'opt', drawerSub = false;      // 'opt' = pagina principale del menu, 'flt' = filtri e ordine
function setDrawerTab(t) {
  drawerTab = t === 'flt' ? 'flt' : 'opt';
  $('#drawerH').textContent = drawerTab === 'flt' ? 'Filtri' : 'Menu';
  $('#drawerBack').hidden = drawerTab !== 'flt';
  $('#drawerFilters').hidden = drawerTab !== 'flt';
  $('#drawerOpts').hidden = drawerTab !== 'opt';
  $('#drawerFoot').hidden = drawerTab !== 'flt';
  if (drawerTab === 'opt') { $('#optBackupHint').textContent = backupHint(); $('#optBackupHint').classList.toggle('dbk-no', !settings.lastBackup); renderVersion(); checkVersion(); paintMenuHome(); }
  $('#drawerBody').scrollTop = 0;
}
var SORT_TXT = { recent: 'dai più recenti', titolo: 'per titolo', autore: 'per autore', editore: 'per casa editrice', anno: 'per anno', scaffale: 'per scaffale', voto: 'per voto', letti: 'letti di recente' };
function paintMenuHome() {                        // la pagina principale riassume filtri e ordine, senza mostrarli
  var n = activeCount(), lib = tab === 'lib';
  var what = n ? (n === 1 ? '1 filtro attivo' : n + ' filtri attivi') : (lib ? 'Tutti i libri' : 'Tutti i desideri');
  $('#goFltTxt').textContent = what + (q ? ', con ricerca' : '');   // ordine e gruppi stanno nella riga sotto la ricerca (17/11/2026 notte)
  $('#goFltN').hidden = !n; $('#goFltN').textContent = n;
  $('#goFilters').classList.toggle('on', !!(n || q));
  var nq = allQuotes().length;
  $('#goQuotes').hidden = !nq; $('#goQTxt').textContent = nq === 1 ? '1 citazione salvata' : nq + ' citazioni salvate';
  emit('menu');
}
function goFilters() {
  setDrawerTab('flt'); renderDrawer();
  if (!drawerSub) { try { history.pushState({ drawer: 1, sub: 1 }, ''); drawerSub = true; } catch (e) { nlErr(e); } }   // Indietro torna al menu
}
function backupHint() {
  var last = settings.lastBackup;
  return last ? 'Ultimo backup: ' + new Date(last).toLocaleDateString('it-IT') : 'Nessun backup: fanne uno';   // una riga nel Menu (17/11/2026)
}
function openDrawer(t, reuse) {
  if (t === 'opt' || t === 'flt') setDrawerTab(t);
  else if (!drawerOpen) setDrawerTab('opt');          // dal bordo o dalla linguetta: il menu, non direttamente i filtri
  if (reuse) { try { history.replaceState({ drawer: 1 }, ''); drawerPushed = true; } catch (e) { nlErr(e); } }
  if (!drawerOpen && !reuse && typeof setsOpen === 'function') { setsOpen(false); if (typeof infoOpen === 'function') infoOpen(false); }   // il Menu si apre con le impostazioni chiuse (tornando da una di esse restano aperte)
  if (!drawerOpen) { renderDrawer(); drawerReturn = document.activeElement; }
  showDrawerEls();
  void drawerEl.offsetWidth;                         // parte dalla posizione attuale
  releaseDrawerStyles();
  drawerEl.classList.add('open'); scrimEl.classList.add('open');
  document.body.classList.add('drawer-open');
  $('#btnFilters').setAttribute('aria-expanded', 'true');
  if (!drawerOpen) {
    drawerOpen = true;
    if (!drawerPushed) { try { history.pushState({ drawer: 1 }, ''); drawerPushed = true; } catch (e) { nlErr(e); } }   // il gesto Indietro chiude il pannello
    setTimeout(function () { try { $('#drawerX').focus({ preventScroll: true }); } catch (e) { nlErr(e); } }, 30);
  }
}
function closeDrawer(fromPop) {
  var was = drawerOpen;
  drawerOpen = false;
  releaseDrawerStyles();
  drawerEl.classList.remove('open'); scrimEl.classList.remove('open');
  document.body.classList.remove('drawer-open');
  $('#btnFilters').setAttribute('aria-expanded', 'false');
  clearTimeout(drawerTimer);
  drawerTimer = setTimeout(function () { if (!drawerOpen) { drawerEl.hidden = true; scrimEl.hidden = true; drawerEl.setAttribute('inert', ''); } }, 280);
  if (drawerPushed && !fromPop) { drawerPushed = false; try { if (drawerSub) history.go(-2); else history.back(); } catch (e) { nlErr(e); } }
  drawerSub = false;
  if (was && drawerReturn && drawerReturn.focus && drawerEl.contains(document.activeElement)) { try { drawerReturn.focus({ preventScroll: true }); } catch (e) { nlErr(e); } }
}
$('#btnFilters').addEventListener('click', function () { drawerOpen ? closeDrawer() : openDrawer('flt'); });
$('#edgeTab').addEventListener('click', function () { openDrawer('opt'); });
$('#btnOpts').addEventListener('click', function () { openDrawer('opt'); setsOpen(true); });   // l'ingranaggio porta dritto alle impostazioni
/* menu: le impostazioni stanno tutte sotto «Impostazioni», chiuse finche' non le apri (Piero, 16/11/2026) */
var setsShown = false;
function setsOpen(on) {
  setsShown = !!on;
  $('#setList').hidden = !setsShown;
  $('#goSettings').setAttribute('aria-expanded', setsShown ? 'true' : 'false');
  $('#goSettings').classList.toggle('on', setsShown);
}
$('#goSettings').querySelector('.dset-i').innerHTML = icon('gear');
$('#goSettings').addEventListener('click', function () {
  setsOpen(!setsShown);
  if (setsShown) setTimeout(function () { var l = $('#setList'); if (l.scrollIntoView) l.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 30);
});
/* «Info e condivisione»: condividi l'app, installazione, privacy, contatti (Piero, 16/11/2026); chiusa come «Impostazioni» */
var infoShown = false;
function infoOpen(on) {
  infoShown = !!on;
  $('#infoList').hidden = !infoShown;
  $('#goInfo').setAttribute('aria-expanded', infoShown ? 'true' : 'false');
  $('#goInfo').classList.toggle('on', infoShown);
}
$('#goInfo').querySelector('.dset-i').innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.5h.01"/></svg>';
$('#goInfo').addEventListener('click', function () {
  infoOpen(!infoShown);
  if (infoShown) setTimeout(function () { var l = $('#infoList'); if (l.scrollIntoView) l.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 30);
});
/* Contatti: «Scrivici» con versione e telefono in fondo; «Copia l'indirizzo» */
var CONTACT = 'nextlibris.app@gmail.com';
function deviceInfo() {
  var ua = navigator.userAgent || '', m = /Android [\d.]+(?:; ([^;)]+))?/.exec(ua), ios = /iPhone|iPad/.exec(ua), ch = /Chrome\/(\d+)/.exec(ua), sf = /Version\/(\d+).*Safari/.exec(ua), fx = /Firefox\/(\d+)/.exec(ua);
  var dev = m ? m[0].replace(/;\s*/, ', ') : ios ? ios[0] : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'altro';
  var br = ch ? 'Chrome ' + ch[1] : fx ? 'Firefox ' + fx[1] : sf ? 'Safari ' + sf[1] : 'browser';
  var inst = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone ? 'installata' : 'nel browser';
  return dev + ' · ' + br + ' · ' + inst;
}
function contactURL() {
  var ver = ($('#verNum').textContent || 'Versione ' + APP_VERSION.v) + (PROVA ? ' (copia di prova)' : '');
  return 'mailto:' + CONTACT + '?subject=' + encodeURIComponent('Next Libris') + '&body=' + encodeURIComponent('\n\n\n---\n' + ver + '\n' + deviceInfo() + errText());
}
$('#ctWrite').addEventListener('click', function () { location.href = contactURL(); });
$('#ctCopy').addEventListener('click', async function () {
  try { await navigator.clipboard.writeText(CONTACT); toast('Indirizzo copiato.'); }
  catch (e) { toast('Non riesco a copiarlo: tienilo premuto per selezionarlo.'); }
});
/* ---- Indietro dalle finestre del Menu (Piero, 17/11/2026): il Menu si riapre nello stesso punto e con gli stessi gruppi aperti.
   Anche × e «Chiudi» (e il tocco fuori dalla finestra) fanno come Indietro (Piero, 17/11/2026 pomeriggio: prima chiudevano tutto).
   Una finestra che si chiude da sola per un'azione (vai al libro, apri la libreria di un amico…) chiude anche il Menu, come prima. ---- */
var WIN_SEL = '.sheet:not([hidden]), #wrap:not([hidden])';
var menuRet = null, menuChk = null;
function winOpen() { return !!document.querySelector(WIN_SEL); }
function fromMenu(fn) {
  menuRet = { top: $('#drawerBody').scrollTop, sets: setsShown, info: infoShown, back: false };
  drawerPushed = false; closeDrawer(true);             // la voce {drawer} resta nella cronologia, sotto la finestra
  fn();
  if (history.state && history.state.drawer) { try { history.pushState({ mwin: 1 }, ''); } catch (e) { nlErr(e); } }   // finestra senza cronologia sua: un posto sopra il Menu
  menuLater();
}
function menuLater() { clearTimeout(menuChk); menuChk = setTimeout(menuCheck, 400); }
function menuCheck() {                                  // finestra chiusa senza cronologia (o mai aperta)
  var h = history.state || {};
  if (menuRet && !menuRet.back && winOpen()) menuRet.x = false;   // × di una finestra sopra un'altra: conta solo per l'ultima
  if (!menuRet || menuRet.back || drawerOpen || winOpen() || !(h.drawer || h.mwin)) return;
  if (menuRet.x) {                                      // × o «Chiudi»: come Indietro, si torna al Menu
    menuRet.back = true;
    if (h.mwin) { try { history.back(); } catch (e) { nlErr(e); } }   // menuPop riapre il Menu
    else menuReopen();
    return;
  }
  menuRet = null;                                       // chiusa da un'azione: via anche la voce del Menu
  try { if (h.mwin) history.go(-2); else history.back(); } catch (e) { nlErr(e); }
}
function menuPop(e) {
  if (!menuRet || drawerOpen || !(e.state && e.state.drawer)) return;
  if (winOpen() || menuRet.x || menuRet.back) { menuRet.back = true; setTimeout(menuReopen, 0); }   // gesto Indietro, × o «Chiudi»
  else { menuRet = null; try { history.back(); } catch (x) {} }           // la finestra si e' chiusa per un'azione: chiude anche il Menu
}
/* × e «Chiudi»: un tocco su un pulsante di chiusura della finestra in primo piano, o fuori dalla finestra */
function isCloseTap(t) {
  if (!t || !t.closest) return false;
  if (t.matches && t.matches('.sheet:not([hidden])')) return true;                       // tocco fuori (sullo sfondo)
  var b = t.closest('button'), w = b && b.closest('.sheet, #wrap');
  if (!w) return false;
  var lb = (b.getAttribute('aria-label') || '') + ' ' + b.textContent;
  return /(Close|X)$/.test(b.id || '') || /^\s*(×\s*)?Chiudi\s*$/.test(b.textContent) || /^Chiudi$/.test(b.getAttribute('aria-label') || '') || /^×/.test(lb.trim());
}
document.addEventListener('click', function (e) { if (menuRet && !menuRet.back && !drawerOpen && isCloseTap(e.target)) menuRet.x = true; }, true);
function menuReopen() {
  var r = menuRet; menuRet = null;
  if (!r) return;
  for (var i = 0; i < 6 && winOpen(); i++) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));   // finestre senza cronologia
  Array.prototype.forEach.call(document.querySelectorAll(WIN_SEL), function (x) { x.hidden = true; });
  openDrawer('opt', true);
  setsOpen(r.sets); infoOpen(r.info);
  $('#drawerBody').scrollTop = r.top;
}
if (window.MutationObserver) new MutationObserver(function () { if (menuRet && !menuRet.back) menuLater(); })
  .observe(document.body, { attributes: true, attributeFilter: ['hidden'], subtree: true });
$('#goFilters').addEventListener('click', goFilters);
$('#drawerBack').addEventListener('click', function () { if (drawerSub) history.back(); else setDrawerTab('opt'); });
$('#goQuotes').addEventListener('click', function () { fromMenu(openAllQuotes); });
$('#goStats').addEventListener('click', function () { fromMenu(openStats); });
window.addEventListener('popstate', function (e) { if (drawerOpen && drawerSub && e.state && e.state.drawer && !e.state.sub) { drawerSub = false; setDrawerTab('opt'); } });
$('#drawerOpts').addEventListener('click', function (e) {
  var x = e.target.closest('[data-sec]');
  if (!x) return;
  var sec = x.dataset.sec;
  fromMenu(function () { if (sec === 'export') openExport(); else openOptions(sec); });
});

/* ---------- Aspetto: tema automatico / chiaro / scuro, colori e caratteri ---------- */
var darkMQ = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
function applyLook(rerender) {
  var root = document.documentElement;
  root.setAttribute('data-look', settings.look);
  if (settings.theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', settings.theme);
  root.setAttribute('data-pal', settings.pal); root.setAttribute('data-ft', settings.ft); root.setAttribute('data-fb', settings.fb);
  var dark = settings.theme === 'dark' || (settings.theme === 'auto' && darkMQ && darkMQ.matches);
  var m = document.querySelector('meta[name="theme-color"]');
  if (m && !root.hasAttribute('data-splash')) m.setAttribute('content', PALS[settings.pal][dark ? 1 : 0]);   // durante l'apertura la barra resta verde
  ['theme', 'pal', 'ft', 'fb', 'viewDef'].forEach(function (k) {
    Array.prototype.forEach.call(document.querySelectorAll('input[name="' + k + '"]'), function (r) { r.checked = r.value === settings[k]; });
  });
  Array.prototype.forEach.call(document.querySelectorAll('input[name="auInv"]'), function (r) { r.checked = Number(r.value) === settings.auInv; });
  $('#icoLoan').innerHTML = icon('loan');
  if (rerender) { renderList(); updateSummary(); }
}
if (darkMQ) { var onDark = function () { if (settings.theme === 'auto') applyLook(false); }; if (darkMQ.addEventListener) darkMQ.addEventListener('change', onDark); else if (darkMQ.addListener) darkMQ.addListener(onDark); }
document.addEventListener('change', function (e) {
  var t = e.target;
  if (t.name === 'theme') { settings.theme = t.value === 'light' || t.value === 'dark' ? t.value : 'auto'; saveSettings(); applyLook(true); }
  else if (t.name === 'pal' && PALS[t.value]) { settings.pal = t.value; saveSettings(); applyLook(false); }
  else if (t.name === 'ft' && FONTS_T.indexOf(t.value) >= 0) { settings.ft = t.value; saveSettings(); applyLook(false); }
  else if (t.name === 'fb' && FONTS_B.indexOf(t.value) >= 0) { settings.fb = t.value; saveSettings(); applyLook(false); }
  else if (t.name === 'auInv') { settings.auInv = t.value === '0' ? 0 : 1; saveSettings(); renderList(); updateActiveFilters(); }
  else if (t.name === 'viewDef') { settings.viewDef = t.value === 'list' ? 'list' : 'grid'; setView(settings.viewDef); collapseCards(); renderList(); toast(settings.viewDef === 'grid' ? 'All\'apertura: copertine.' : 'All\'apertura: elenco.'); }
});
$('#lookReset').addEventListener('click', function () {
  var before = { theme: settings.theme, pal: settings.pal, ft: settings.ft, fb: settings.fb };
  settings.theme = 'light'; settings.pal = 'bosco'; settings.ft = 'bricolage'; settings.fb = 'plex'; saveSettings(); applyLook(true);
  toast('Aspetto predefinito: tema chiaro, verde, Literata.', { label: 'Annulla', fn: function () { Object.assign(settings, before); saveSettings(); applyLook(true); } });
});

/* ---------- versione: quale stai usando e se ce n'e' una piu' nuova ---------- */
var latestVer = null, verChecking = null;
function checkVersion() {
  if (navigator.onLine === false) { renderVersion(); return Promise.resolve(null); }
  if (verChecking) return verChecking;
  verChecking = fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
    if (j && j.v) latestVer = { v: +j.v, date: String(j.date || ''), note: String(j.note || ''), build: String(j.build || ''), prova: String(j.prova || ''), copia: String(j.copia || '') };
    return latestVer;
  }).catch(function () { return null; }).then(function (x) { verChecking = null; renderVersion(); return x; });
  return verChecking;
}
/* Aggiorna: chiede di nuovo i file al sito saltando la memoria del telefono, poi ricarica */
async function updateNow() {
  var b = $('#verUpdate');
  b.disabled = true; b.textContent = 'Aggiorno…';
  try {
    var reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg) await reg.update().catch(function () {});
    var files = ['./', 'index.html', 'app.js', 'lib.js', 'style.css', 'sw.js', 'manifest.json', 'REGISTRO_MODIFICHE.md'];
    Array.prototype.forEach.call(document.querySelectorAll('script[src], link[rel="stylesheet"][href]'), function (el) {   // anche i moduli (wrap.js, layout.css…)
      var u = el.getAttribute('src') || el.getAttribute('href');
      if (u && !/^(https?:)?\/\//.test(u) && files.indexOf(u) < 0) files.push(u);
    });
    await Promise.all(files.map(function (u) { return fetch(u, { cache: 'reload' }).catch(function () {}); }));
  } catch (e) { nlErr(e); }
  location.reload();
}
$('#verUpdate').addEventListener('click', updateNow);

/* Pagina delle opzioni: una sezione alla volta, con «‹» per tornare al menu e il tasto Indietro del telefono per chiudere */
var optOpen = false, optPushed = false;
function openOptions(sec, reuse) {
  try { paintLensState(); } catch (e) { nlErr(e); }                 // stato dell'obiettivo con la luce, sempre aggiornato
  emit('options', sec);
  paintSumOpts();
  var found = false;
  Array.prototype.forEach.call(document.querySelectorAll('#optSheet .opt-sec'), function (s) {
    var on = s.dataset.sec === sec; s.hidden = !on;
    if (on) { found = true; $('#optH').textContent = s.dataset.title; }
  });
  if (!found) return;
  $('#optSheet').hidden = false; optOpen = true;
  $('#optSheet .sheet-in').scrollTop = 0;
  if (reuse) { try { history.replaceState({ opt: 1 }, ''); optPushed = true; } catch (e) { nlErr(e); } }
  else if (!optPushed) { try { history.pushState({ opt: 1 }, ''); optPushed = true; } catch (e) { nlErr(e); } }
  if (sec === 'search') { renderSvc(); renderSvcShare(); if (window.NLAmici && window.NLAmici.load) window.NLAmici.load().catch(function () {}); }   // «Con gli amici»: chiave e worker (da Condivisione, 17/11/2026)
  if (sec === 'app') { renderVersion(); checkVersion(); updateInstallUi(); }
  if (sec === 'privacy') loadPrivacy();
}
/* Privacy dentro l'app (Piero, 17/11/2026): dalla pagina privacy.html (che resta per Google) solo il testo, senza titolo né piede;
   × e Indietro tornano al Menu. Il testo è nostro (stesso sito): si legge e si mostra cosi' com'e'. */
var pvDone = false;
async function loadPrivacy() {
  var box = $('#pvBody');
  if (pvDone) return;
  box.innerHTML = '<p class="desc-wait"><span class="spin" aria-hidden="true"></span>Carico l\'informativa…</p>';
  try {
    var r = await fetch('privacy.html', { cache: 'no-cache' }).catch(function () { return null; });
    if (!r || !r.ok) r = await fetch('privacy.html');
    var d = new DOMParser().parseFromString(await r.text(), 'text/html'), m = d.querySelector('main');
    if (!m) throw new Error('privacy senza testo');
    ['h1', 'footer', 'script', 'style'].forEach(function (t) { Array.prototype.forEach.call(m.querySelectorAll(t), function (x) { x.remove(); }); });
    Array.prototype.forEach.call(m.querySelectorAll('a[href^="http"]'), function (a) { a.target = '_blank'; a.rel = 'noopener'; });
    box.innerHTML = m.innerHTML; pvDone = true;
  } catch (e) {
    nlErr(e);
    box.innerHTML = '<p class="desc-none">Non riesco a caricare l\'informativa' + (navigator.onLine === false ? ' senza connessione' : '') + '. Riprova più tardi.</p>';
  }
}
function closeOptions(fromPop) {
  if (!optOpen) return;
  $('#optSheet').hidden = true; optOpen = false; emit('optclose');   // i moduli si aggiornano (icona dell’API, giro 1)
  if (optPushed && !fromPop) { optPushed = false; try { history.back(); } catch (e) { nlErr(e); } }
  else optPushed = false;
}
$('#optClose').addEventListener('click', function () { closeOptions(); });
$('#optBack').addEventListener('click', function () {
  if (menuRet && optPushed) { try { history.back(); } catch (e) { nlErr(e); } return; }   // aperta dal Menu: come Indietro
  var had = optPushed; optPushed = false;
  $('#optSheet').hidden = true; optOpen = false;
  openDrawer('opt', had);
});
window.addEventListener('popstate', function (e) { if (optOpen && !(e.state && (e.state.opt || e.state.log))) { optPushed = false; closeOptions(true); } });
$('#drawerX').addEventListener('click', function () { closeDrawer(); });
$('#drawerShow').addEventListener('click', function () { closeDrawer(); window.scrollTo({ top: 0 }); });
$('#drawerReset').addEventListener('click', clearFilters);
$('#drawerQX').addEventListener('click', function () { q = ''; $('#q').value = ''; renderList(); updateSummary(); renderDrawer(); });
scrimEl.addEventListener('click', function () { closeDrawer(); });
window.addEventListener('popstate', function (e) { if (drawerOpen && !(e.state && e.state.drawer)) { drawerPushed = false; closeDrawer(true); } });

/* Il gesto: dal bordo sinistro (o da un punto qualsiasi della meta' sinistra, perche' con la navigazione a gesti
   di Android il bordo e' riservato a Indietro) si trascina verso destra; il pannello segue il pollice.
   Per chiudere: trascina verso sinistra, tocca fuori o usa Indietro. */
var swipe = null;
function swipeBlocked(target) {
  if (scanning || !$('#lightbox').hidden || document.querySelector('.sheet:not([hidden])')) return true;
  return !!(target.closest && target.closest('input, textarea, select, [contenteditable="true"], .chips, .cand, video, .lightbox, [data-noswipe]'));   // [data-noswipe]: elementi che scorrono da soli (avvisi della disposizione A)
}
document.addEventListener('touchstart', function (e) {
  swipe = null;
  if (e.touches.length !== 1) return;
  var t = e.touches[0];
  if (drawerOpen) {
    if (e.target.closest('#drawer, #drawerScrim') && !e.target.closest('select')) swipe = { mode: 'close', x0: t.clientX, y0: t.clientY, dir: 0, px: drawerWidth() };
    return;
  }
  if (t.clientX > window.innerWidth * 0.5 || swipeBlocked(e.target)) return;
  swipe = { mode: 'open', x0: t.clientX, y0: t.clientY, dir: 0, px: 0 };
}, { passive: true });
document.addEventListener('touchmove', function (e) {
  if (!swipe || e.touches.length !== 1) return;
  var t = e.touches[0], now = Date.now();
  var dx = swipe.mode === 'open' ? t.clientX - swipe.x0 : swipe.x0 - t.clientX, dy = t.clientY - swipe.y0;
  if (!swipe.dir) {
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
    if (dx > 0 && dx > Math.abs(dy) * 1.5) {
      swipe.dir = 1; swipe.base = dx; swipe.lt = now; swipe.lx = dx; swipe.v = 0;
      if (swipe.mode === 'open') { renderDrawer(); drawerReturn = document.activeElement; showDrawerEls(); }
    } else { swipe = null; return; }
  }
  var d = dx - swipe.base, w = drawerWidth();
  if (now > swipe.lt) { swipe.v = (dx - swipe.lx) / (now - swipe.lt); swipe.lt = now; swipe.lx = dx; }
  swipe.px = swipe.mode === 'open' ? Math.min(w, d) : Math.max(0, w - d);
  dragDrawer(swipe.px);
}, { passive: true });
function endSwipe(cancel) {
  var s = swipe; swipe = null;
  if (!s || !s.dir) return;
  var w = drawerWidth();
  if (s.mode === 'open') {
    if (!cancel && (s.px > w * 0.3 || s.v > 0.35)) {
      openDrawer();
      if (!settings.swiped) { settings.swiped = true; saveSettings(); $('#drawerHint').hidden = true; }
    } else { releaseDrawerStyles(); closeDrawer(true); }
  } else {
    if (!cancel && (s.px < w * 0.7 || s.v > 0.35)) closeDrawer();
    else openDrawer();
  }
}
document.addEventListener('touchend', function () { endSwipe(false); }, { passive: true });
document.addEventListener('touchcancel', function () { endSwipe(true); }, { passive: true });

/* ---------- suggerimenti per scaffale, genere e «a chi» (al posto dell'elenco a tendina del browser) ---------- */
var sugg = { el: null, input: null, k: '', idx: -1 };
function suggKey(input) {
  if (input.id === 'loanWho') return loanKind === 's' ? '' : 'p';
  var k = input.dataset && input.dataset.k;
  return (k === 'sh' || k === 'gen' || k === 'se') && input.closest('#list') && !input.closest('[data-ex]') ? k : '';
}
function suggValues(k, input) {
  var m = {};
  state.books.forEach(function (b) {
    var vals = k === 'p' ? [b.p, b.xa] : [b[k]];
    vals.forEach(function (v) { v = String(v || '').trim(); if (!v) return; var key = L.norm(v); (m[key] || (m[key] = { v: v, n: 0 })).n++; });
  });
  return Object.keys(m).map(function (key) { return m[key]; }).sort(function (x, y) { return y.n - x.n || coll.compare(x.v, y.v); });
}
function hideSugg() {
  if (sugg.el) sugg.el.remove();
  if (sugg.input) sugg.input.setAttribute('aria-expanded', 'false');
  sugg = { el: null, input: null, k: '', idx: -1 };
}
function showSugg(input) {
  var k = suggKey(input);
  if (!k) { hideSugg(); return; }
  var cur = L.norm(input.value.trim());
  var list = suggValues(k, input).filter(function (x) { var n = L.norm(x.v); return n !== cur && (!cur || n.indexOf(cur) >= 0); }).slice(0, 8);
  if (sugg.input !== input) hideSugg();
  if (!list.length) { if (sugg.el) sugg.el.remove(); sugg.el = null; input.setAttribute('aria-expanded', 'false'); return; }
  var box = sugg.el || document.createElement('div');
  box.className = 'sugg'; box.id = 'suggBox'; box.setAttribute('role', 'listbox');
  box.innerHTML = list.map(function (x) { return '<button type="button" role="option" tabindex="-1" data-v="' + esc(x.v) + '">' + esc(x.v) + '<span class="n">' + x.n + '</span></button>'; }).join('');
  if (!sugg.el) {
    (input.closest('.f, .field') || input.parentNode).appendChild(box);
    box.addEventListener('pointerdown', function (e) { e.preventDefault(); });        // il campo resta attivo
    box.addEventListener('mousedown', function (e) { e.preventDefault(); });
    box.addEventListener('click', function (e) { var o = e.target.closest('[data-v]'); if (o) { e.preventDefault(); pickSugg(o.dataset.v); } });
  }
  input.setAttribute('aria-expanded', 'true'); input.setAttribute('aria-controls', 'suggBox'); input.setAttribute('aria-autocomplete', 'list');
  sugg = { el: box, input: input, k: k, idx: -1 };
}
function pickSugg(v) {
  var input = sugg.input;
  hideSugg();
  if (!input) return;
  input.value = v;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
document.addEventListener('focusin', function (e) { var t = e.target; if (t && t.tagName === 'INPUT' && suggKey(t)) showSugg(t); });
/* mentre scrivi: niente barra in basso (la tastiera la spingerebbe sopra il campo) e il campo resta in vista */
var typingT = 0;
function isTyping(t) { return t && t.closest && !!t.closest('#list') && (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || (t.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|file|range|color)$/.test(t.type))); }
function showField(t) { if (t && document.activeElement === t && t.closest('#list')) { try { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (x) { t.scrollIntoView(); } } }
document.addEventListener('focusin', function (e) {
  if (!isTyping(e.target)) return;
  clearTimeout(typingT); document.body.classList.add('typing');
  var t = e.target; setTimeout(function () { showField(t); }, 350);     // dopo che la tastiera si e' aperta
});
document.addEventListener('focusout', function (e) {
  if (!isTyping(e.target)) return;
  clearTimeout(typingT); typingT = setTimeout(function () { if (!isTyping(document.activeElement)) document.body.classList.remove('typing'); }, 150);
});
function typingCheck() { if (!isTyping(document.activeElement)) document.body.classList.remove('typing'); }
if (window.visualViewport) window.visualViewport.addEventListener('resize', function () { var t = document.activeElement; if (isTyping(t)) showField(t); else typingCheck(); });
document.addEventListener('pointerdown', function () { setTimeout(typingCheck, 0); }, true);     // campo sparito senza perdere il fuoco: la barra torna
document.addEventListener('input', function (e) { var t = e.target; if (t && t.tagName === 'INPUT' && suggKey(t)) showSugg(t); });
document.addEventListener('focusout', function (e) { if (sugg.input && e.target === sugg.input) setTimeout(function () { if (sugg.input && document.activeElement !== sugg.input) hideSugg(); }, 120); });
document.addEventListener('keydown', function (e) {
  if (!sugg.el || e.target !== sugg.input) return;
  var opts = sugg.el.querySelectorAll('[data-v]');
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    sugg.idx = (sugg.idx + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length;
    Array.prototype.forEach.call(opts, function (o, i) { o.setAttribute('aria-selected', i === sugg.idx ? 'true' : 'false'); });
  } else if (e.key === 'Enter' && sugg.idx >= 0) { e.preventDefault(); e.stopPropagation(); pickSugg(opts[sugg.idx].dataset.v); }
  else if (e.key === 'Escape') { e.stopPropagation(); hideSugg(); }
}, true);

/* ---------- copie dello stesso libro ---------- */
/* Un'altra copia: stessi dati del libro, ma scaffale, note, prestito e lettura propri. Entrambe vengono segnate come copie. */
function addCopy(id, quiet) {
  var src = get(id);
  if (!src) return null;
  var wasCp = src.cp;
  var copy = cleanBook(Object.assign({}, src, { id: newId(), ts: Date.now(), cp: true, sh: '', n: '', p: '', pd: '', rs: 'da', rt: 0, rd: '', xs: '', xd: '', xa: '', qs: [], g: src.g.slice() }));
  src.cp = true;
  state.books.push(copy);
  if (coverURL[id]) fetch(coverURL[id]).then(function (r) { return r.blob(); }).then(function (bl) { return saveCover(copy.id, bl); }).catch(function () {});
  touch();
  if (!quiet && !scanning) {
    openState[copy.id] = true;
    renderList(); updateSummary();
    toast('Aggiunta un\'altra copia di «' + (src.t || src.i) + '».', { label: 'Annulla', fn: function () {
      state.books = state.books.filter(function (b) { return b.id !== copy.id; });
      var x = get(id); if (x) x.cp = wasCp;
      renderList(); touch(); updateSummary();
    } });
  }
  return copy;
}
var dupId = null;
function dupGroupOf(id) {
  return L.dupGroups(dupPool()).find(function (g) { return g.some(function (x) { return x.id === id; }); }) || [get(id)].filter(Boolean);
}
function openDup(id) {
  var b = get(id);
  if (!b) return;
  dupId = id;
  var g = dupGroupOf(id), cps = g.filter(function (x) { return x.cp; }), title = b.t || b.i, where = b.w ? 'nei Desideri' : 'in Libreria';
  var allCopies = cps.length === g.length && g.length > 1;
  $('#dupH').textContent = allCopies ? 'Hai ' + g.length + ' copie' : 'Stesso libro più volte';
  $('#dupMsg').textContent = allCopies
    ? '«' + title + '» è segnato come ' + g.length + ' copie ' + where + '. Ognuna può avere il suo scaffale, le sue note e il suo prestito.'
    : '«' + title + '» compare ' + g.length + ' volte ' + where + (cps.length ? ' (' + cps.length + ' già segnate come copie).' : '.') + ' Sono copie diverse che possiedi, o lo stesso libro inserito due volte?';
  $('#dupCopies').hidden = allCopies; $('#dupMerge').hidden = allCopies; $('#dupUnmark').hidden = !allCopies;
  $('#dupSheet').hidden = false;
}
function closeDup() { $('#dupSheet').hidden = true; dupId = null; }
function dupCopies() {
  var g = dupGroupOf(dupId), before = g.map(function (x) { return [x.id, x.cp]; });
  g.forEach(function (x) { x.cp = true; });
  closeDup(); renderList(); touch(); updateSummary();
  toast('Segnate come ' + g.length + ' copie.', { label: 'Annulla', fn: function () { before.forEach(function (p) { var x = get(p[0]); if (x) x.cp = p[1]; }); renderList(); touch(); updateSummary(); } });
}
function dupUnmark() {
  var g = dupGroupOf(dupId);
  g.forEach(function (x) { x.cp = false; });
  closeDup(); renderList(); touch(); updateSummary();
  toast('Non più copie: ora sono segnalati come doppione.');
}
function dupMerge() {
  var g = dupGroupOf(dupId), cps = g.filter(function (x) { return x.cp; }), plain = g.filter(function (x) { return !x.cp; });
  // con copie segnate: la registrazione in piu' confluisce nella prima copia, le altre copie restano
  var grp = cps.length ? [cps[0]].concat(plain) : g;
  if (grp.length < 2) { closeDup(); return; }
  var snapshot = JSON.stringify(state.books);
  var m = L.mergeBooks(grp), keep = cleanBook(m.keep);
  var i = state.books.findIndex(function (b) { return b.id === keep.id; });
  if (i >= 0) state.books[i] = keep;
  m.removed.forEach(function (rid) { if (!coverURL[keep.id] && coverURL[rid]) fetch(coverURL[rid]).then(function (r) { return r.blob(); }).then(function (bl) { return saveCover(keep.id, bl); }).catch(function () {}); });
  state.books = state.books.filter(function (b) { return m.removed.indexOf(b.id) < 0; });
  closeDup(); renderList(); touch(); updateSummary();
  toast('Unito in un solo libro.', { label: 'Annulla', fn: function () { state.books = JSON.parse(snapshot).map(cleanBook).filter(Boolean); renderList(); touch(); updateSummary(); } });
}
/* ---- dimensione delle copertine (giro 1, 18/11/2026; scelta di Piero: due dita sulle copertine + cursore in Aspetto, 2-5 per riga, ricordata).
   settings.cols 0 = come prima (le colonne vengono da sole, sul telefono di solito 3). Sul telefono N per riga; su schermi larghi
   la stessa proporzione (piu' copertine per riga, ma grandi uguali). ---- */
function colsNow() {
  if (settings.cols) return settings.cols;
  var g = document.querySelector('#list .grid'), n = g && g.offsetParent ? getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length : 0;
  return Math.max(2, Math.min(5, n || 3));
}
function applyCols() {
  var c = settings.cols;
  document.body.classList.toggle('cols', !!c); document.body.classList.toggle('cols-sm', c >= 4);
  if (c) document.body.style.setProperty('--cols', c); else document.body.style.removeProperty('--cols');
  var r = $('#optCols'); if (r) { r.value = colsNow(); $('#optColsTxt').textContent = r.value + ' copertine per riga sul telefono.'; }
}
function setCols(n) {
  n = Math.max(2, Math.min(5, Math.round(n))); if (n === settings.cols) return false;
  settings.cols = n; saveSettings(); applyCols();
  var l = $('#list'); if (l) gcPlace(l);
  return true;
}
$('#optCols').addEventListener('input', function (e) { setCols(Number(e.target.value)); });
if (window.MutationObserver) new MutationObserver(function () { if (!$('#optSheet').hidden) applyCols(); }).observe($('#optSheet'), { attributes: true, attributeFilter: ['hidden'] });   // Aspetto: il cursore mostra quante sono adesso
(function () {                                   // due dita sulle copertine: allarga = piu' grandi (meno per riga), stringi = piu' piccole
  var list = $('#list'), d0 = 0, c0 = 0, moved = false;
  function dist(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) || 1; }
  list.addEventListener('touchstart', function (e) {
    if (e.touches.length === 2 && settings.view === 'grid' && !selOn) { d0 = dist(e.touches); c0 = colsNow(); moved = false; }
  }, { passive: true });
  list.addEventListener('touchmove', function (e) {
    if (!d0 || e.touches.length !== 2) return;
    e.preventDefault();
    var r = dist(e.touches) / d0, n = c0 - Math.round(Math.log(r) / Math.log(1.4));
    if (setCols(n)) moved = true;
  }, { passive: false });
  list.addEventListener('touchend', function (e) {
    if (!d0 || e.touches.length >= 2) return;
    d0 = 0; if (moved) toast(settings.cols + ' copertine per riga.');
  }, { passive: true });
  list.addEventListener('touchcancel', function () { d0 = 0; }, { passive: true });
})();
