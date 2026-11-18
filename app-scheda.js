/* Next Libris · app, parte 4 di 10 (app-scheda.js): scheda del libro: autore, novità delle versioni, descrizione, serie, citazioni.
   Dal 17/11/2026 app.js è diviso in 10 file (prima era una sola funzione). Sono script classici, senza import:
   le funzioni e le variabili di primo livello sono globali e servono a tutte le parti; l'ordine in index.html
   e in SHELL di sw.js conta (app.js, app-aggiungi.js, …, app-avvio.js: l'ultima fa partire l'app). */
'use strict';
/* ---- autore: profilo da Wikipedia, ricerca sul web, modifica con la matita ---- */
var auEditing = {}, auCache = {}, auNow = null;
function editAuthor(id) {
  auEditing[id] = true; refreshRow(id);
  var ta = document.getElementById('a-' + id);
  if (ta) { try { ta.focus({ preventScroll: true }); var n = ta.value.length; ta.setSelectionRange(n, n); } catch (e) { ta.focus(); } }
}
document.addEventListener('focusout', function (e) {               // finito di scrivere: torna il nome da toccare
  var t = e.target;
  if (!t || t.dataset.k !== 'a' || !t.closest('#list')) return;
  var row = t.closest('.row'), id = row && row.dataset.id;
  if (!id || !auEditing[id]) return;
  setTimeout(function () { if (document.activeElement === t) return; delete auEditing[id]; var b = get(id); if (b && b.a.trim()) refreshRow(id); }, 120);
});
/* indirizzo di una foto di Wikimedia, senza il pezzo dopo «?»: dal 17/11/2026 le miniature arrivano da thumb.wikimedia.org
   (prima upload.wikimedia.org), con «?utm_…» in fondo; le altre si scartano (Flaiano senza foto, 17/11/2026) */
function auImgOk(u) { u = typeof u === 'string' ? u.split(/[?#]/)[0] : ''; return /^https:\/\/(upload|thumb)\.wikimedia\.org\/[^\s"'<>]+$/.test(u) ? u : ''; }
function auWikiUrl(t) { return 'https://it.wikipedia.org/wiki/' + encodeURIComponent(String(t).replace(/ /g, '_')); }
/* chi ha scritto un libro puo' fare qualsiasi mestiere: fotografi, cuochi, musicisti… (Sebastiao Salgado non veniva trovato: «fotografo», 16/11/2026) */
var AU_WRITE = /scritt|autor|romanz|poet|saggist|giornalist|drammaturg|filosof|storic|letterat|narrat|fumett|sceneggiat|critic|traduttor|accademic|docent|scienziat|teolog|biograf|novellier/i;
var AU_WORDS = /scritt|autor|romanz|poet|saggist|giornalist|drammaturg|filosof|storic|letterat|narrat|fumett|sceneggiat|critic|traduttor|accademic|docent|scienziat|teolog|biograf|novellier|fotograf|illustrat|disegnat|pittor|artist|scultor|architett|design|music|compositor|cantaut|cantant|regist|attor|attric|cuoc|chef|gastronom|politic|economist|psicolog|psicoanal|psichiatr|medic|biolog|chimic|fisic|matematic|astronom|astrofisic|geolog|naturalist|etolog|sociolog|antropolog|archeolog|linguist|filolog|pedagog|educat|divulgat|alpinist|esplorat|viaggiat|sportiv|calciator|allenator|ciclist|imprenditor|avvocat|magistrat|giurist|militar|diplomat|religios|monac|sacerdot|vescov|papa|santo|attivist|conduttor|comic|umorist|blogger|youtuber|influencer|editor|curator|insegnant|professor|ricercat|ingegner|informatic|inventor|stilist|fumettist/i;
async function auLookup(name) {
  if (esempio()) return { none: true, retry: true };   // libreria di esempio: nessuna chiamata a Wikipedia (giro 4)
  if (auCache[name]) return auCache[name];
  async function summary(title) {
    var j = await L.getJson(fetch, 'https://it.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title.replace(/ /g, '_')) + '?redirect=true', { waits: [], timeout: 8000 });
    return j && j.type !== 'disambiguation' && j.extract ? { title: j.title, desc: L.str(j.description), text: L.str(j.extract), url: (j.content_urls && j.content_urls.mobile && j.content_urls.mobile.page) || auWikiUrl(j.title),
      img: auImgOk(j.thumbnail && j.thumbnail.source),   // foto dell'autore, se Wikipedia ce l'ha
      qid: /^Q\d{1,12}$/.test(j.wikibase_item || '') ? j.wikibase_item : '' } : null;
  }
  var r = null;
  try { r = await summary(name); } catch (e) { if (!(e && e.status === 404)) throw e; }
  var direct = r && AU_WORDS.test(r.desc + ' ' + r.text.slice(0, 300)) ? r : null;   // la voce col suo nome, se e' una persona con un mestiere
  if (!r || !AU_WRITE.test(r.desc + ' ' + r.text.slice(0, 300))) {          // non e' (solo) uno scrittore: cerco «nome scrittore», magari e' un omonimo
    r = null;
    var j = null;
    try { j = await L.getJson(fetch, 'https://it.wikipedia.org/w/api.php?action=query&list=search&srlimit=3&format=json&origin=*&srsearch=' + encodeURIComponent(name + ' scrittore'), { waits: [], timeout: 8000 }); if (!(j && j.query && j.query.search && j.query.search.length)) j = await L.getJson(fetch, 'https://it.wikipedia.org/w/api.php?action=query&list=search&srlimit=3&format=json&origin=*&srsearch=' + encodeURIComponent(name), { waits: [], timeout: 8000 }); }
    catch (e3) { if (!(e3 && e3.status)) throw e3; }              // risposta d'errore: come «nessun risultato»; senza rete: avviso
    var hits = (j && j.query && j.query.search) || [], want = L.norm(name).split(/\s+/).filter(function (w) { return w.length > 2; });
    var other = null;                                   // con nomi ambigui vince chi scrive; un fotografo o un cuoco solo se non c'e' uno scrittore
    for (var i = 0; i < hits.length; i++) {
      var tn = L.norm(hits[i].title);
      if (!want.every(function (w) { return tn.indexOf(w) >= 0; })) continue;
      try {
        var r2 = await summary(hits[i].title), t2 = r2 ? r2.desc + ' ' + r2.text.slice(0, 300) : '';
        if (r2 && AU_WRITE.test(t2)) { r = r2; break; }
        if (r2 && !other && AU_WORDS.test(t2)) other = r2;
      } catch (e2) {}
    }
    if (!r) r = direct || other;                        // nessuno scrittore: la voce col suo nome (fotografo, cuoco…) o il primo trovato
  }
  if (r && !r.img) {                                    // il riassunto da' solo le foto libere: quella caricata solo su it.wikipedia (Ennio Flaiano, 17/11/2026)
    try { r.img = await auPageImg(r.title); } catch (e) { if (!(e && e.status)) r.retry = true; }   // senza rete: non si salva «senza foto», si riprova
  }
  if (r && !r.img && !r.retry && r.qid) {               // la voce italiana senza foto (Antonio Tabucchi, 17/11/2026): la foto di Wikidata
    try { r.img = await auWdImg(r.qid); } catch (e) { r.retry = true; }
  }
  if (r && r.retry) return r;
  auCache[name] = r || { none: true };
  return auCache[name];
}
/* foto della voce di it.wikipedia di qualunque licenza (le foto «di pubblico dominio in Italia» stanno solo li', non su Commons) */
async function auPageImg(title) {
  if (!title) return '';
  var j = await L.getJson(fetch, 'https://it.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=pageimages&piprop=thumbnail&pithumbsize=330&pilicense=any&titles=' + encodeURIComponent(title), { waits: [], timeout: 8000 });
  var pg = (j && j.query && j.query.pages) || {}, u = '';
  Object.keys(pg).forEach(function (k) { var t = pg[k] && pg[k].thumbnail && pg[k].thumbnail.source; if (!u) u = auImgOk(t); });
  return u;
}
/* foto della persona su Wikidata (proprieta' P18) e la sua miniatura su Commons: 2 richieste, solo per chi non ha la foto su it.wikipedia */
async function auWdImg(qid) {
  var o = { waits: [], timeout: 8000 }, file = '';
  var j = await L.getJson(fetch, 'https://www.wikidata.org/w/api.php?action=wbgetclaims&format=json&origin=*&property=P18&entity=' + encodeURIComponent(qid), o);
  var cl = (j && j.claims && j.claims.P18) || [];
  cl = cl.filter(function (c) { return c && c.rank !== 'deprecated'; }).sort(function (a, b) { return (b.rank === 'preferred') - (a.rank === 'preferred'); });
  for (var i = 0; i < cl.length && !file; i++) { var v = cl[i].mainsnak && cl[i].mainsnak.datavalue && cl[i].mainsnak.datavalue.value; if (typeof v === 'string' && v.length < 250) file = v; }
  if (!file) return '';
  var c = await L.getJson(fetch, 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=url&iiurlwidth=330&titles=' + encodeURIComponent('File:' + file), o);
  var pg = c && c.query && c.query.pages, u = '';
  if (pg) Object.keys(pg).forEach(function (k) { var ii = pg[k] && pg[k].imageinfo && pg[k].imageinfo[0]; if (!u && ii && typeof ii.thumburl === 'string') u = ii.thumburl; });
  return auImgOk(u);
}
async function openAuthor(id, name) {
  if (esempio()) { toast('Info Autore cerca su Wikipedia: provalo con i tuoi libri.'); return; }   // libreria di esempio: nessuna chiamata (giro 4)
  auNow = { id: id, name: name };
  var mine = state.books.filter(function (x) { return !x.w && authorsOf(x).some(function (n) { return L.norm(n) === L.norm(name); }); }).length;
  $('#auH').textContent = name; $('#auDesc').textContent = ''; $('#auSrc').hidden = true; $('#auWiki').hidden = true; auPic('');
  $('#auMine').textContent = mine > 1 ? 'I suoi libri nella tua libreria (' + mine + ')' : 'Il suo libro nella tua libreria';
  $('#auMine').hidden = mine < 2;
  auCutPaint(name);
  $('#auPa').hidden = true; $('#auWorks').hidden = true;   // paese e «Le sue opere» arrivano con la voce (giro 2)
  $('#auTxt').innerHTML = '<p class="desc-wait"><span class="spin" aria-hidden="true"></span>Cerco le informazioni…</p>';
  $('#auSheet').hidden = false;
  if (navigator.onLine === false) { $('#auTxt').innerHTML = '<p class="desc-none">Senza connessione: le informazioni sull\'autore si cercano online.</p>'; return; }
  try {
    var r = await auLookup(name);
    if (!auNow || auNow.name !== name) return;
    auWikiMore(name, r);
    if (r.none) { $('#auTxt').innerHTML = '<p class="desc-none">Non ho trovato una voce di Wikipedia su questo autore. Prova «Cerca sul web».</p>'; return; }
    $('#auDesc').textContent = r.desc ? r.desc.charAt(0).toUpperCase() + r.desc.slice(1) : '';
    auPic(r.img || '', name);
    if (r.img && aufGet(name) !== r.img) { aufSave(name, r.img); aufPaint(name, r.img); }   // la stessa foto anche sulla copertina dell'autore
    $('#auTxt').innerHTML = r.text.split(/\n+/).map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('');
    $('#auSrc').hidden = false;
    var w = $('#auWiki'); w.href = r.url; w.hidden = false;
  } catch (e) {
    if (auNow && auNow.name === name) $('#auTxt').innerHTML = '<p class="desc-none">Connessione debole: non sono riuscito a cercare. Prova «Cerca sul web».</p>';
  }
}
function auPic(src, name) {                        // foto dell'autore da Wikipedia (Commons); se non c'e' o non si carica, niente riquadro
  var f = $('#auPic'), im = f.querySelector('img');
  f.hidden = true; im.removeAttribute('src');
  if (!src) return;
  im.onload = function () { if (auNow && auNow.name === name) f.hidden = false; };
  im.onerror = function () { f.hidden = true; };
  im.alt = 'Foto di ' + name; im.src = src;
}
/* cognome dell'autore, corretto a mano (Piero, 17/11/2026 notte): «In ordine come: Márquez, Gabriel García · Correggi» */
function auCutPaint(name, open) {
  var box = $('#auCut'), k = L.norm(name), w = String(name || '').trim().split(/\s+/);
  if (!box) return;
  box.hidden = w.length < 2;
  if (w.length < 2) return;
  var cur = settings.auCut[k];
  var h = '<p class="auc-now">In ordine come <b>' + esc(L.authorInv(name, settings.auCut)) + '</b>' + (cur != null ? ' <small>(corretto)</small>' : '') +
    ' <button type="button" class="link" data-auc="open" aria-expanded="' + !!open + '">' + (open ? 'Chiudi' : 'Correggi') + '</button></p>';
  if (open) {
    var opts = [];
    for (var n = 1; n < w.length; n++) opts.push([n, w.slice(w.length - n).join(' ') + ', ' + w.slice(0, w.length - n).join(' ')]);
    opts.push([0, name + ' (com\'è scritto)']);
    var sel = cur != null ? cur : -1, auto = L.authorInv(name);
    h += '<div class="auc-opts" role="radiogroup" aria-label="Cognome">' + opts.map(function (o) {
      var on = sel === -1 ? o[0] !== 0 && o[1] === auto : sel === o[0];   // senza correzione: acceso quello della regola, se c'è tra i tagli
      return '<button type="button" class="pk-o" role="radio" data-auc="' + o[0] + '" aria-checked="' + on + '" aria-selected="' + on + '"><span class="pk-dot" aria-hidden="true"></span><span>' + esc(o[1]) + '</span></button>';
    }).join('') + (cur != null ? '<button type="button" class="link auc-auto" data-auc="auto">Torna alla regola automatica (' + esc(L.authorInv(name)) + ')</button>' : '') + '</div>';
  }
  box.innerHTML = h;
}
document.addEventListener('click', function (e) {
  var b = e.target.closest('#auCut [data-auc]'); if (!b || !auNow) return;
  var v = b.dataset.auc, k = L.norm(auNow.name);
  if (v === 'open') { auCutPaint(auNow.name, b.getAttribute('aria-expanded') !== 'true'); return; }
  if (v === 'auto') delete settings.auCut[k]; else settings.auCut[k] = Number(v) || 0;
  saveSettings(); auCutPaint(auNow.name, false);
  if (grpMode() || sortBy === 'autore') renderList();
  toast('Ora in ordine come ' + L.authorInv(auNow.name, settings.auCut) + '.');
});
function closeAuthor() { $('#auSheet').hidden = true; auNow = null; }
$('#auClose').addEventListener('click', closeAuthor);
/* tocco sulla foto dell'autore: a tutto schermo nel visore delle foto, piu' nitida (Piero, 17/11/2026); se la grande non c'e', la piccola */
function auBig(src) { return /^https:\/\/(upload|thumb)\.wikimedia\.org\/.+\/thumb\//.test(src) ? src.replace(/\/\d+px-([^\/]+)$/, '/960px-$1') : src; }
$('#auPic').addEventListener('click', function () {
  var im = $('#auPic img'), src = im.getAttribute('src'); if (!src || !auNow) return;
  var big = auBig(src), ph = $('#phImg');
  openPh(big, auNow.name); $('#phView').classList.add('au');
  if (big !== src) ph.onerror = function () { ph.onerror = null; ph.src = src; };
});
$('#auSheet').addEventListener('click', function (e) { if (e.target === e.currentTarget) closeAuthor(); });
$('#auWeb').addEventListener('click', function () { if (auNow) window.open('https://www.google.com/search?q=' + encodeURIComponent(auNow.name + ' scrittore'), '_blank', 'noopener'); });
$('#auMine').addEventListener('click', function () { if (!auNow) return; var n = auNow.name; closeAuthor(); applyFacet('a', L.norm(n), n); });
$('#auEdit').addEventListener('click', function () { if (!auNow) return; var id = auNow.id; closeAuthor(); editAuthor(id); });
/* ---- novità delle versioni: il registro (REGISTRO_MODIFICHE.md) mostrato nell'app, anche senza rete ---- */
function logInline(t) {
  return esc(t)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|[\s(])(https:\/\/[^\s<)]+)/g, function (m, pre, u) { return pre + '<a href="' + u + '" target="_blank" rel="noopener">' + u.replace(/^https:\/\//, '').replace(/\/$/, '') + '</a>'; });
}
function logHTML(md) {
  var out = [], list = false, started = false;
  md.replace(/\r/g, '').split('\n').forEach(function (line) {
    var m;
    if (/^#\s/.test(line)) return;                                         // titolo del file: c'e' gia' quello della finestra
    if (!started && !/^##\s/.test(line)) return;                           // l'introduzione del file serve solo a chi lo legge sul sito
    if ((m = line.match(/^##\s+(.*)$/))) {
      started = true;
      if (list) { out.push('</ul>'); list = false; }
      var vm = m[1].match(/^Versione\s+(\d+)\s*·?\s*(.*)$/), pm = m[1].match(/^Prova\s+([\d.]+)\s*·?\s*(.*)$/);
      var cur = vm ? +vm[1] === APP_VERSION.v && !(PROVA && BUILD.n) : pm ? pm[1] === BUILD.n : false;
      out.push('</section><section class="log-v' + (cur ? ' cur' : '') + '"><h3>' + (vm ? 'Versione ' + vm[1] + (vm[2] ? ' <small>' + esc(vm[2]) + '</small>' : '') : pm ? 'Prova ' + pm[1] + (pm[2] ? ' <small>' + esc(pm[2]) + '</small>' : '') : logInline(m[1])) + (cur ? ' <span class="log-now">questa</span>' : '') + '</h3>');
      return;
    }
    if (/^>/.test(line)) return;                                              // «In breve» per la pagina delle novita': qui ci sono i dettagli
    if ((m = line.match(/^\s*[-*]\s+(.*)$/))) { if (!list) { out.push('<ul>'); list = true; } out.push('<li>' + logInline(m[1]) + '</li>'); return; }
    if (!line.trim()) { if (list) { out.push('</ul>'); list = false; } return; }
    if (list) { out.push('</ul>'); list = false; }
    out.push('<p>' + logInline(line) + '</p>');
  });
  if (list) out.push('</ul>');
  return ('<section class="log-intro">' + out.join('') + '</section>').replace(/<section class="log-intro"><\/section>/, '');
}
var logPushed = false;
async function openLog() {
  $('#logBody').innerHTML = '<p class="desc-wait"><span class="spin" aria-hidden="true"></span>Carico le novità…</p>';
  $('#logSheet').hidden = false;
  if (!logPushed) { try { history.pushState({ log: 1 }, ''); logPushed = true; } catch (e) { nlErr(e); } }   // Indietro chiude il registro e lascia aperte le Opzioni
  try {
    // prima la versione aggiornata; senza rete (o se il sito risponde con un errore) la copia salvata sul telefono
    var r = await fetch('REGISTRO_MODIFICHE.md', { cache: 'no-cache' }).catch(function () { return null; });
    if (!r || !r.ok) r = await fetch('REGISTRO_MODIFICHE.md');
    if (!r || !r.ok) throw new Error('registro');
    var md = await r.text();
    if (/^\s*</.test(md)) throw new Error('html');                       // non e' il registro (pagina d'errore)
    var prova = '';
    if (PROVA) {                                                          // la copia di prova ha anche il suo registro, che avanza a ogni pubblicazione
      var rp = await fetch('REGISTRO_PROVA.md', { cache: 'no-cache' }).catch(function () { return null; });
      var pm = rp && rp.ok ? await rp.text() : '';
      if (pm && !/^\s*</.test(pm)) prova = '<h3 class="log-part">Copia di prova</h3>' + logHTML(pm) + '<h3 class="log-part">Versione vera</h3>';
    }
    $('#logBody').innerHTML = prova + logHTML(md);
    var cur = $('#logBody').querySelector('.log-v.cur'); if (cur) cur.scrollIntoView({ block: 'start' }); $('#logBody').scrollTop = 0;
  } catch (e) {
    $('#logBody').innerHTML = '<p class="desc-none">Non riesco a caricare il registro delle novità' + (navigator.onLine === false ? ' senza connessione (la prima volta serve la rete)' : '') + '. Riprova più tardi.</p>';
  }
}
function closeLog(fromPop) {
  if ($('#logSheet').hidden) return;
  $('#logSheet').hidden = true;
  if (logPushed && !fromPop) { logPushed = false; try { history.back(); } catch (e) { nlErr(e); } }
  else logPushed = false;
}
/* ---- Dopo un aggiornamento: «Aggiornato in questa versione», con le novita' dalla piu' importante (quelle in grassetto) alle altre ---- */
function provaNum(t) { var m = /^(\d+)\.(\d+)$/.exec(t || ''); return m ? +m[1] * 10000 + +m[2] : 0; }
function newsSince(md, test) {                    // le righe puntate delle sezioni «## …» che passano il test
  var on = false, out = [];
  md.replace(/\r/g, '').split('\n').forEach(function (line) {
    var m = line.match(/^##\s+(.*)$/);
    if (m) { on = test(m[1]); return; }
    if (on && (m = line.match(/^\s*[-*]\s+(.*)$/))) out.push(m[1].trim());
  });
  return out;
}
function newsBrief(md, test) {                     // per chi usa l'app: per ogni versione le righe «> …» (In breve) o, se mancano, i soli titoli in grassetto
  var secs = [], cur = null;
  md.replace(/\r/g, '').split('\n').forEach(function (line) {
    var m = line.match(/^##\s+(.*)$/);
    if (m) { cur = test(m[1]) ? { brief: [], items: [] } : null; if (cur) secs.push(cur); return; }
    if (!cur) return;
    if ((m = line.match(/^>\s?(.+)$/))) cur.brief.push(m[1].trim());
    else if ((m = line.match(/^\s*[-*]\s+(.*)$/))) cur.items.push(m[1].trim());
  });
  return secs.reduce(function (out, x) { return out.concat(x.brief.length ? x.brief : briefOf(x.items)); }, []);
}
function briefOf(items) {                           // i titoli in grassetto, senza la spiegazione lunga
  return items.filter(function (x) { return /^\*\*/.test(x); }).map(function (x) { var m = /^\*\*([^*]+?)[:.]?\*\*/.exec(x); return m ? '**' + m[1].replace(/[:.]\s*$/, '') + '**' : x; });
}
function rankNews(items) {                        // prima le novita' (cominciano in grassetto), poi le correzioni e i ritocchi
  var big = items.filter(function (x) { return /^\*\*/.test(x); }), small = items.filter(function (x) { return !/^\*\*/.test(x); });
  return big.concat(small);
}
async function checkWhatsNew() {
  var curB = PROVA ? BUILD.n : '', used = state.books.length > 0 && oldApp;   // ha i suoi libri e impostazioni di una versione di prima
  /* prima apertura vera (nessun libro): niente da raccontare. Ma chi aggiorna da una versione senza questa pagina ha gia' i suoi libri:
     a lui le novita' si mostrano (nella 95 la pagina non era comparsa a chi aggiornava dalla 94, 16/11/2026) */
  if (!settings.seenV && !used) { settings.seenV = APP_VERSION.v; settings.seenB = curB; settings.wn2 = 1; saveSettings(); return; }
  var fromV = settings.seenV || APP_VERSION.v - 1, fromB = settings.seenB || '';
  var missed = !settings.wn2 && used;                  // aggiornati alla 95 senza vedere la pagina: la vedono una volta
  if (missed) fromV = Math.min(fromV, 94);
  settings.wn2 = 1;
  var newV = APP_VERSION.v > fromV, newB = PROVA && curB && provaNum(curB) > provaNum(fromB);
  if (!newV && !newB) { saveSettings(); return; }
  /* la versione si segna come vista solo quando la finestra compare: se il registro non arriva (rete, ricarica dell'aggiornamento)
     la finestra si riprova alla prossima apertura (101.2 non era comparsa, Piero 17/11/2026) */
  var seen = function () { settings.seenV = APP_VERSION.v; settings.seenB = curB; saveSettings(); };
  var items = [], title = '', brief = false, got = false;
  try {
    if (PROVA && curB && !missed) {
      var rp = await fetch('REGISTRO_PROVA.md', { cache: 'no-cache' }).catch(function () { return null; });
      var pm = rp && rp.ok ? await rp.text() : '';
      if (pm && /^#/.test(pm)) got = true;
      var inB = function (h) { var m = /^Prova\s+([\d.]+)/.exec(h); return !!m && provaNum(m[1]) > provaNum(fromB) && provaNum(m[1]) <= provaNum(curB); };
      items = newsBrief(pm, inB); brief = items.length > 0;      // anche nella prova, lo stesso stile semplice
      if (!items.length) items = newsSince(pm, inB);
      title = 'Prova ' + curB;
    }
    if (!items.length) {
      var r = await fetch('REGISTRO_MODIFICHE.md', { cache: 'no-cache' }).catch(function () { return null; });
      if (!r || !r.ok) r = await fetch('REGISTRO_MODIFICHE.md').catch(function () { return null; });
      var md = r && r.ok ? await r.text() : '';
      if (md && /^#/.test(md)) got = true;
      var inV = function (h) { var m = /^Versione\s+(\d+)/.exec(h); return !!m && +m[1] > fromV && +m[1] <= APP_VERSION.v; };
      items = newsBrief(md, inV);                     // per tutti: poche novita' in parole semplici (Piero, 16/11/2026)
      brief = true;
      title = 'Versione ' + APP_VERSION.v;
    }
  } catch (e) { nlErr(e); }
  if (!items.length) { if (got) seen(); return; }      // registro letto ma niente da dire: vista; non letto: si riprova
  seen();
  $('#wnSub').textContent = brief ? title + ': ecco cosa cambia per te.' : title + ' · ' + (items.length === 1 ? '1 novità' : items.length + ' novità');
  $('#wnList').classList.toggle('wn-brief', brief);
  $('#wnList').innerHTML = (brief ? items : rankNews(items)).map(function (x) { return '<li>' + logInline(x) + '</li>'; }).join('');
  $('#wnSheet').hidden = false;
}
function closeWhatsNew() { $('#wnSheet').hidden = true; }
$('#wnClose').addEventListener('click', closeWhatsNew);
$('#wnAll').addEventListener('click', function () { closeWhatsNew(); openLog(); });
$('#wnSheet').addEventListener('click', function (e) { if (e.target === e.currentTarget) closeWhatsNew(); });
$('#verLog').addEventListener('click', openLog);
$('#logClose').addEventListener('click', function () { closeLog(); });
$('#logSheet').addEventListener('click', function (e) { if (e.target === e.currentTarget) closeLog(); });
window.addEventListener('popstate', function (e) { if (!$('#logSheet').hidden && !(e.state && e.state.log)) { logPushed = false; closeLog(true); } });
/* ---- Donazioni: l'app e' gratis. Riga in cima all'elenco (la X la nasconde per 10 giorni), promemoria ogni 50 libri,
   finestra «Sostieni» che apre PayPal. Al ritorno: se si e' rimasti su PayPal almeno 20 secondi le richieste tacciono 3 mesi,
   altrimenti 10 giorni (l'app non puo' sapere se il pagamento c'e' stato: senza server non c'e' una conferma vera). ---- */
var DON_URL = 'https://www.paypal.me/PieroRagusa907';
var DON_DAY = 864e5, DON_SNOOZE = 10 * DON_DAY, DON_THANKS = 90 * DON_DAY, DON_MIN_MS = 20000, DON_STEP = 50;
var DON_OPENS = 5, DON_AWAY = 30 * 60000, donHiddenAt = 0;   // la riga compare dopo 5 accessi; tornare dopo 30 minuti conta come un accesso
var donAmt = '3', donPushed = false;
function donCount() { return state.books.filter(function (b) { return !b.w && hasData(b); }).length; }
function donPaint() {
  var row = $('#donRow'), ask = $('#donAsk');
  if (!row || !ask) return;
  var n = donCount(), ms = Math.floor(n / DON_STEP) * DON_STEP;
  if (settings.donMs == null) { settings.donMs = ms; saveSettings(); }      // chi ha gia' dei libri non lo vede subito: al prossimo multiplo di 50
  var on = tab !== 'wish' && Date.now() >= settings.donUntil;
  ask.hidden = !(on && !settings.donNever && ms >= DON_STEP && ms > settings.donMs);
  if (!ask.hidden) $('#donAskT').textContent = ms + ' libri catalogati: grazie!';
  row.hidden = !(on && n > 0 && ask.hidden && settings.donOpens > DON_OPENS);
}
function donSnooze(ms) { settings.donUntil = Math.max(settings.donUntil, Date.now() + ms); saveSettings(); donPaint(); }
function paintDonAmt() {
  Array.prototype.forEach.call(document.querySelectorAll('.don-amt'), function (x) { x.setAttribute('aria-checked', x.dataset.amt === donAmt ? 'true' : 'false'); });
  var SIZE = { 2: 'una piccola', 3: 'una media', 5: 'una grande' };   // importi come birre (Piero, 17/11/2026 sera)
  $('#donGo').textContent = SIZE[donAmt] ? 'Offri ' + SIZE[donAmt] + ' con PayPal' : donAmt ? 'Offri ' + donAmt + ' € con PayPal' : 'Offri una birra con PayPal';
}
function openDon(reuse) {
  paintDonAmt();
  $('#donSheet').hidden = false;
  if (reuse) { try { history.replaceState({ don: 1 }, ''); donPushed = true; } catch (e) { nlErr(e); } }
  else if (!donPushed) { try { history.pushState({ don: 1 }, ''); donPushed = true; } catch (e) { nlErr(e); } }
}
function closeDon(fromPop) {
  if ($('#donSheet').hidden) return;
  $('#donSheet').hidden = true;
  if (donPushed && !fromPop) { donPushed = false; try { history.back(); } catch (e) { nlErr(e); } }
  else donPushed = false;
}
function donGo() {
  var url = DON_URL + (donAmt ? '/' + donAmt + 'EUR' : '');
  settings.donGo = Date.now(); settings.donHid = false; saveSettings();
  closeDon();
  var a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
}
function donBack() {
  if (!settings.donGo) return;
  var spent = Date.now() - settings.donGo;
  settings.donGo = 0; settings.donHid = false;
  if (spent >= DON_MIN_MS) { settings.donUntil = Math.max(settings.donUntil, Date.now() + DON_THANKS); settings.donMs = Math.max(settings.donMs || 0, Math.floor(donCount() / DON_STEP) * DON_STEP); }
  else settings.donUntil = Math.max(settings.donUntil, Date.now() + DON_SNOOZE);
  saveSettings(); donPaint();
  toast('Grazie se mi hai offerto la birra! ♥', null, 3500);
}
function donAccess() { settings.donOpens = Math.min(9999, (settings.donOpens || 0) + 1); saveSettings(); donPaint(); }
document.addEventListener('visibilitychange', function () {      // l'app installata spesso resta in memoria: un ritorno dopo una lunga pausa e' un nuovo accesso
  if (document.visibilityState === 'hidden') donHiddenAt = Date.now();
  else if (donHiddenAt && Date.now() - donHiddenAt >= DON_AWAY) { donHiddenAt = 0; donAccess(); }
});
document.addEventListener('visibilitychange', function () {
  if (!settings.donGo) return;
  if (document.visibilityState === 'hidden') { if (!settings.donHid) { settings.donHid = true; saveSettings(); } }
  else if (settings.donHid) donBack();
});
$('#donRowOpen').addEventListener('click', function () { openDon(); });
$('#donRowX').addEventListener('click', function () { donSnooze(DON_SNOOZE); });
$('#donAskGo').addEventListener('click', function () { openDon(); });
$('#donAskLater').addEventListener('click', function () { donSnooze(DON_SNOOZE); });
$('#donAskNever').addEventListener('click', function () {
  settings.donNever = true; settings.donMs = Math.floor(donCount() / DON_STEP) * DON_STEP; saveSettings(); donPaint();
  toast('Non te lo chiederò più a ogni traguardo. Resta «Sostieni Next Libris» nel menu.');
});
$('#donMenu').addEventListener('click', function () { fromMenu(function () { openDon(); }); });
$('#donOpt').addEventListener('click', function () { openDon(); });
$('#btnBeer').addEventListener('click', function () { openDon(); });   // boccale nella testata (Piero, 17/11/2026)
$('#donSheet').addEventListener('click', function (e) {
  if (e.target === e.currentTarget) { closeDon(); return; }
  var x = e.target.closest('.don-amt'); if (x) { donAmt = x.dataset.amt; paintDonAmt(); }
});
$('#donGo').addEventListener('click', donGo);
$('#donClose').addEventListener('click', function () { closeDon(); });
window.addEventListener('popstate', function (e) { if (!$('#donSheet').hidden && !(e.state && e.state.don)) { donPushed = false; closeDon(true); } });
/* ---- «Descrizione»: riquadro richiudibile nella scheda aperta; la prima apertura la cerca online, poi resta nel libro ---- */
var descOpen = {}, descBusy = {}, descFull = {}, descErr = {};
var DESC_SRC = { g: 'Google Libri', o: 'Open Library' };
var DESC_CLIP = 420;
function descHTML(b, off) {
  if (off || !hasData(b) || !(b.t || L.toIsbn13(b.i))) return '';
  return '<details class="desc" data-id="' + b.id + '"' + (descOpen[b.id] ? ' open' : '') + '><summary><span class="desc-h">Descrizione</span>' +
    (b.ds ? '' : '<span class="desc-hint">tocca per cercarla</span>') + '</summary><div class="desc-b" aria-live="polite">' + descBody(b) + '</div></details>';
}
function descBody(b) {
  if (descBusy[b.id]) return '<p class="desc-wait"><span class="spin" aria-hidden="true"></span>Cerco la descrizione…</p>';
  if (b.ds) {
    var long = b.ds.length > DESC_CLIP && !descFull[b.id];
    var foreign = b.dsl && b.dsl !== 'it';
    return '<div class="desc-t' + (long ? ' clip' : '') + '">' + b.ds.split(/\n+/).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</div>' +
      (long ? '<button type="button" class="link" data-act="descmore">Leggi tutto</button>' : '') +
      '<p class="desc-src">Fonte: ' + esc(DESC_SRC[b.dsf] || 'web') + (foreign ? (b.dsl === 'en' ? ' · in inglese' : ' · in un\'altra lingua') : '') + '</p>' +
      '<div class="desc-acts">' + (foreign ? '<a class="link" target="_blank" rel="noopener" href="https://translate.google.com/?sl=auto&tl=it&op=translate&text=' + encodeURIComponent(b.ds) + '">Traduci in italiano</a>' : '') +
      '<button type="button" class="link quiet" data-act="descdel">Non è questo libro: rimuovila</button></div>';
  }
  if (b.dsn) return '<p class="desc-none">Descrizione non disponibile.</p>';
  if (navigator.onLine === false) return '<p class="desc-none">Senza connessione: la cerco appena riapri il riquadro con la rete.</p>';
  return '';
}
function paintDesc(id) {
  var b = get(id);
  Array.prototype.forEach.call(document.querySelectorAll('details.desc:not(.quotes)[data-id="' + id + '"]'), function (d) {
    var body = d.querySelector('.desc-b'), hint = d.querySelector('.desc-hint');
    if (b && body) body.innerHTML = descBody(b);
    if (b && b.ds && hint) hint.remove();
  });
}
/* Descrizione (scelta di Piero, 16/11/2026): arriva solo con la prima ricerca del libro (o dall'archivio comune).
   Se non c'e': «Descrizione non disponibile» e nessun'altra richiesta, per risparmiare le ricerche di Google. */
function noDesc(id) { var b = get(id); if (!b || b.ds || b.dsn) return; b.dsn = Date.now(); b.dsq = 0; touch(); paintDesc(id); }
function queueDesc(id) { noDesc(id); }
function loadDesc(id) { noDesc(id); }
function runDescQueue() { state.books.forEach(function (b) { if (b.dsq && !b.ds) { b.dsq = 0; b.dsn = Date.now(); touch(); } }); }   // in sospeso dalle versioni vecchie
/* ---- serie e collane: quali volumi hai, quali mancano ---- */
function serNums(a) { return a.join(', '); }
function seriesBody(b) {
  var s = L.seriesInfo(state.books)[L.serKey(b.se)];
  if (!s) return '';
  var out = '<p><b>' + esc(s.name) + '</b>: ' + (s.n === 1 ? 'hai 1 volume' : 'hai ' + s.n + ' volumi') +
    (s.have.length ? ' (' + (s.have.length === 1 ? 'il ' : 'i numeri ') + serNums(s.have) + ')' : '') + (s.total ? ' su ' + s.total : '') + '.' +
    (s.missing.length ? ' ' + (s.missing.length === 1 ? 'Manca il ' : 'Mancano: ') + serNums(s.missing.slice(0, 40)) + (s.missing.length > 40 ? '…' : '') + '.' : (s.total && s.have.length >= s.total ? ' Serie completa.' : '')) +
    (s.wish.length ? ' Nei Desideri: ' + serNums(s.wish) + '.' : '') + '</p>';
  if (!parseInt(b.sn, 10)) out += '<p class="ser-hint">Scrivi il numero di questo volume per sapere quali mancano.</p>';
  else if (!s.total) out += '<p class="ser-hint">Se sai di quanti volumi è la serie, scrivilo in «di»: conto anche quelli dopo l\'ultimo che hai.</p>';
  var btns = (s.n + s.nw > 1 ? '<button type="button" class="link" data-act="serall">Vedi la serie</button>' : '') +
    (s.toAdd.length ? '<button type="button" class="link" data-act="sermiss">Metti ' + (s.toAdd.length === 1 ? 'il mancante' : 'i ' + Math.min(s.toAdd.length, 40) + ' mancanti') + ' nei Desideri</button>' : '');
  return out + (btns ? '<div class="desc-acts">' + btns + '</div>' : '');
}
function seriesHTML(b, off) { return off || !hasData(b) ? '' : '<div class="serbox">' + seriesBody(b) + '</div>'; }
function seriesChanged(b, row, k) {
  if (k === 'se' && b.se && !b.sq) {            // serie gia' nota: il totale lo prendo dagli altri volumi
    var s = L.seriesInfo(state.books)[L.serKey(b.se)];
    if (s && s.total) { b.sq = String(s.total); var f = row.querySelector('[data-k="sq"]'); if (f) f.value = b.sq; touch(); }
  }
  if (k === 'sq' && b.se && b.sq) state.books.forEach(function (x) { if (x !== b && L.serKey(x.se) === L.serKey(b.se)) x.sq = b.sq; });
  var box = row.querySelector('.serbox');
  if (box) box.innerHTML = seriesBody(b);
}
function seriesAll(id) {
  var b = get(id); if (!b || !b.se) return;
  flt = ''; readFlt = ''; shFlt = ''; genFlt = ''; autFlt = ''; autName = ''; edFlt = ''; frFlt = ''; paFlt = '';
  q = b.se.trim(); $('#q').value = q; collapseCards(); renderList(); updateSummary(); window.scrollTo({ top: 0 });
  toast('Libri della serie «' + q + '». Svuota la ricerca per vederli tutti.');
}
function seriesMissing(id) {
  var b = get(id); if (!b || !b.se) return;
  var s = L.seriesInfo(state.books)[L.serKey(b.se)];
  if (!s || !s.toAdd.length) return;
  var ids = [];
  s.toAdd.slice(0, 40).forEach(function (n, i) {
    var w = blankBook({ t: s.name + ', vol. ' + n, a: s.author || b.a || '', se: s.name, sn: String(n), sq: s.total ? String(s.total) : '', w: true, rs: '', ts: Date.now() + i });
    state.books.push(w); ids.push(w.id);
  });
  touch(); refreshRow(id); updateSummary();
  toast((ids.length === 1 ? 'Aggiunto 1 volume' : 'Aggiunti ' + ids.length + ' volumi') + ' ai Desideri.', { label: 'Annulla', fn: function () {
    state.books = state.books.filter(function (x) { return ids.indexOf(x.id) < 0; }); touch(); refreshRow(id); updateSummary(); } });
}
function seriesStatsHTML() {
  var m = L.seriesInfo(state.books), keys = Object.keys(m).filter(function (k) { return m[k].n; }).sort(function (x, y) { return coll.compare(m[x].name, m[y].name); });
  if (!keys.length) return '';
  return '<section class="st-sec"><h3>Serie e collane</h3><ul class="loans">' + keys.map(function (k) {
    var s = m[k];
    return '<li><button type="button" class="link" data-q="' + esc(s.name) + '">' + esc(s.name) + '</button> · ' + s.n + (s.total ? ' su ' + s.total : '') +
      (s.missing.length ? ' <small>' + (s.missing.length === 1 ? 'manca il ' : 'mancano: ') + serNums(s.missing.slice(0, 20)) + (s.missing.length > 20 ? '…' : '') + '</small>' : (s.total && s.have.length >= s.total ? ' <small>completa</small>' : '')) + '</li>';
  }).join('') + '</ul></section>';
}

/* ---- foto delle citazioni: salvate sul telefono (come le tue copertine), chiave «q:…» ---- */
var qphURL = {};
function qPhs(c) { return (c && c.phs) || []; }
function quotePhKeys() { var out = []; state.books.forEach(function (b) { (b.qs || []).forEach(function (c) { qPhs(c).forEach(function (k) { out.push(k); }); }); }); return out; }
function qThumb(c) { var k = qPhs(c)[0], n = qPhs(c).length; return k ? '<span class="qimg-w">' + (qphURL[k] ? '<img class="qimg" src="' + qphURL[k] + '" alt="">' : '<span class="qimg none" aria-hidden="true"></span>') + (n > 1 ? '<span class="qimg-n" aria-label="' + n + ' foto">' + n + '</span>' : '') + '</span>' : ''; }
async function saveQuotePh(key, blob) {
  await idbDo('readwrite', function (st) { st.put(blob, key); });
  if (qphURL[key]) URL.revokeObjectURL(qphURL[key]);
  qphURL[key] = URL.createObjectURL(blob);
  askPersist();
}
function paintQuotesAll() {
  Array.prototype.forEach.call(document.querySelectorAll('details.quotes'), function (d) { paintQuotes(d.dataset.id); });
  if (!$('#allqSheet').hidden) renderAllQuotes();
}
var phPushed = false;
var phList = [], phAt = 0;
function phShow() {
  $('#phImg').src = phList[phAt]; $('#phView').classList.remove('zoom');
  $('#phNav').hidden = phList.length < 2; $('#phPos').textContent = (phAt + 1) + ' di ' + phList.length;
  $('#phPrev').disabled = phAt === 0; $('#phNext').disabled = phAt === phList.length - 1;
}
function openPhs(list, at, cap) { if (!list || !list.length) return; phList = list; phAt = Math.max(0, Math.min(list.length - 1, at || 0)); openPh(list[phAt], cap, true); }
$('#phPrev').addEventListener('click', function (e) { e.stopPropagation(); if (phAt > 0) { phAt--; phShow(); } });
$('#phNext').addEventListener('click', function (e) { e.stopPropagation(); if (phAt < phList.length - 1) { phAt++; phShow(); } });
function openPh(src, cap, many) {
  if (!src) return;
  if (!many) phList = [src], phAt = 0;
  phShow(); $('#phCap').textContent = cap || '';
  $('#phView').classList.remove('zoom'); $('#phView').hidden = false;
  if (!phPushed) { try { history.pushState({ ph: 1 }, ''); phPushed = true; } catch (e) { nlErr(e); } }
}
function closePh(fromPop) {
  if ($('#phView').hidden) return;
  $('#phView').hidden = true; $('#phView').classList.remove('au'); $('#phImg').onerror = null; $('#phImg').removeAttribute('src');
  if (phPushed && !fromPop) { phPushed = false; try { history.back(); } catch (e) { nlErr(e); } }
}
$('#phClose').addEventListener('click', function () { closePh(false); });
$('#phView').addEventListener('click', function (e) {
  if (e.target.id === 'phImg') { $('#phView').classList.toggle('zoom'); return; }      // tocco sulla foto: ingrandisce per leggere
  if (e.target === e.currentTarget || e.target.id === 'phCap') closePh(false);
});
window.addEventListener('popstate', function () { if (!$('#phView').hidden) { phPushed = false; closePh(true); } });
/* ---- citazioni e appunti: riquadro nella scheda aperta, testo scritto o letto da una foto della pagina ---- */
var quoteOpen = {}, quoteEdit = null;
function quotesBody(b) {
  var qs = b.qs || [];
  return (qs.length ? '<ul class="qlist">' + qs.map(function (c, i) {
    return '<li class="qcard"><button type="button" class="qitem' + (qPhs(c).length ? ' has-ph' + (c.x ? '' : ' only-ph') : '') + '" data-act="quoteedit" data-i="' + i + '" title="Tocca per modificare">' + qThumb(c) +
      (c.x ? '<span class="qt">' + esc(c.x) + '</span>' : '<span class="qt q-only">Foto della pagina</span>') + (c.pg ? '<span class="qp">p. ' + esc(c.pg) + '</span>' : '') + '</button>' +
      '<span class="qbtns">' + (c.x ? '<button type="button" class="qpin' + (c.pin ? ' on' : '') + '" data-act="quotepin" data-i="' + i + '" aria-pressed="' + !!c.pin + '" aria-label="' + (c.pin ? 'In evidenza nel profilo: tocca per togliere la puntina' : 'Metti in evidenza nel profilo') + '" title="' + (c.pin ? 'In evidenza nel profilo: tocca per togliere la puntina' : 'Metti in evidenza nel profilo') + '">' + icon('pin') + '</button>' : '') + '<button type="button" class="qshare" data-act="quoteshare" data-i="' + i + '" aria-label="Condividi questa citazione">' + icon('share') + 'Condividi</button>' +
      '<button type="button" class="qdel" data-act="quotedel" data-i="' + i + '" aria-label="Elimina questa citazione" title="Elimina">' + icon('x') + '</button></span></li>';
  }).join('') + '</ul>' : '<p class="desc-none">Passaggi da ricordare, frasi sottolineate, appunti di lettura.</p>') +
    '<div class="desc-acts"><button type="button" class="link" data-act="quoteadd">+ Aggiungi una citazione o un appunto</button>' +
    (qs.length ? '<button type="button" class="link" data-act="quoteshareall">' + (qs.length === 1 ? 'Condividi' : 'Condividi tutte (' + qs.length + ')') + '</button>' : '') + '</div>';
}
/* citazioni in evidenza (giro 6): la puntina, al massimo PIN_MAX tra tutti i libri; gli amici le vedono nel profilo solo se lo scegli */
var PIN_MAX = 3;
function pinned() { var out = []; myBooks().forEach(function (b) { (b.qs || []).forEach(function (c, i) { if (c && c.pin && c.x) out.push({ b: b, c: c, i: i }); }); }); return out; }
function togglePin(id, i) {
  var b = get(id), c = b && b.qs && b.qs[i]; if (!c || !c.x) return false;
  if (!c.pin && pinned().length >= PIN_MAX) { toast('In evidenza ne stanno ' + PIN_MAX + ': prima togli la puntina a un\'altra.'); return false; }
  c.pin = c.pin ? 0 : 1; touch(); paintQuotes(id); emit('pins');
  toast(c.pin ? 'In evidenza nel tuo profilo (' + pinned().length + ' di ' + PIN_MAX + ').' : 'Puntina tolta.');
  return true;
}
function quotesHTML(b, off) {
  if (off || !hasData(b)) return '';
  var n = (b.qs || []).length;
  return '<details class="desc quotes" data-id="' + b.id + '"' + (quoteOpen[b.id] ? ' open' : '') + '><summary><span class="desc-h">Citazioni e appunti</span><span class="desc-hint qn">' + (n || '') + '</span></summary><div class="desc-b">' + quotesBody(b) + '</div></details>';
}
function paintQuotes(id) {
  var b = get(id), d = b && document.querySelector('details.quotes[data-id="' + id + '"]');
  if (!d) return;
  d.querySelector('.desc-b').innerHTML = quotesBody(b);
  d.querySelector('.qn').textContent = (b.qs || []).length || '';
}
var QPH_MAX = 10;
function openQuote(id, i) {
  var b = get(id); if (!b) return;
  var c = i == null ? null : (b.qs || [])[i];
  quoteEdit = { id: id, i: c ? i : null, phs: qPhs(c).map(function (k) { return { key: k, blob: null, url: qphURL[k] || '', canvas: null, read: false }; }) };
  $('#quoteH').textContent = c ? 'Modifica' : 'Citazione o appunto';
  $('#quoteBook').textContent = [b.t || 'Senza titolo', b.a].filter(Boolean).join(' — ');
  $('#quoteText').value = c ? c.x : ''; $('#quotePage').value = c ? c.pg : '';
  $('#quoteMsg').textContent = ''; $('#quoteDel').hidden = !c;
  ocrIdle();
  paintQuotePh();
  $('#quoteSheet').hidden = false;
  if (!c) setTimeout(function () { try { $('#quoteText').focus(); } catch (e) { nlErr(e); } }, 60);
}
function closeQuote() { if (quoteEdit) quoteEdit.phs.forEach(function (p) { if (p.blob && p.url) URL.revokeObjectURL(p.url); }); $('#quoteSheet').hidden = true; quoteEdit = null; }
function paintQuotePh() {
  var phs = quoteEdit ? quoteEdit.phs : [], n = phs.length;
  $('#quotePh').hidden = !n;
  $('#quoteThumbs').innerHTML = phs.map(function (p, k) {
    return '<li><button type="button" class="q-th" data-k="' + k + '" aria-label="Ingrandisci la foto ' + (k + 1) + '">' + (p.url ? '<img src="' + p.url + '" alt="">' : '') + (n > 1 ? '<span class="q-th-n">' + (k + 1) + '</span>' : '') + '</button>' +
      '<button type="button" class="q-th-x" data-del="' + k + '" aria-label="Togli la foto ' + (k + 1) + '">' + icon('x') + '</button>' +
      '<button type="button" class="q-th-ed" data-ed="' + k + '" aria-label="Evidenzia o scrivi sulla foto ' + (k + 1) + '">' + icon('pen') + '</button></li>';
  }).join('');
  if (!$('#quoteOcr').classList.contains('busy')) $('#quoteOcr').textContent = n > 1 ? 'Leggi il testo dalle foto' : 'Leggi il testo dalla foto';
  $('#quotePhoto').textContent = n ? 'Aggiungi un\'altra foto' : 'Aggiungi una foto della pagina';
  $('#quotePhoto').hidden = n >= QPH_MAX;
}
async function saveQuote() {
  if (!quoteEdit) return;
  var b = get(quoteEdit.id), x = $('#quoteText').value.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim().slice(0, 1500);
  if (!b) { closeQuote(); return; }
  if (!x && !quoteEdit.phs.length) { $('#quoteMsg').textContent = 'Scrivi il testo oppure aggiungi una foto della pagina.'; $('#quoteText').focus(); return; }
  var keys = [], lost = 0;
  for (var k = 0; k < quoteEdit.phs.length; k++) {
    var p = quoteEdit.phs[k];
    if (p.key && !p.blob) { keys.push(p.key); continue; }
    var key = 'q:' + newId();
    try { await saveQuotePh(key, p.blob); keys.push(key); } catch (e) { lost++; }
  }
  if (lost && !x && !keys.length) { $('#quoteMsg').textContent = 'Non riesco a salvare le foto su questo telefono.'; return; }
  var c = { x: x, pg: $('#quotePage').value.replace(/\D/g, '').slice(0, 5), d: Date.now(), phs: keys };
  if (!Array.isArray(b.qs)) b.qs = [];
  if (quoteEdit.i != null) { c.d = b.qs[quoteEdit.i].d || c.d; b.qs[quoteEdit.i] = c; }
  else if (b.qs.length >= 200) { $('#quoteMsg').textContent = 'Per questo libro ci sono già 200 citazioni.'; return; }
  else b.qs.push(c);
  var id = b.id; quoteOpen[id] = true;
  touch(); closeQuote(); paintQuotes(id); toast(lost ? 'Salvata, ma ' + lost + ' foto non si sono potute salvare.' : 'Salvata.');
}
function delQuote() {
  if (!quoteEdit || quoteEdit.i == null) return;
  var id = quoteEdit.id, i = quoteEdit.i, b = get(id);
  if (!b) { closeQuote(); return; }
  var old = b.qs.splice(i, 1)[0];
  touch(); closeQuote(); paintQuotes(id);
  toast('Citazione eliminata.', { label: 'Annulla', fn: function () { var x = get(id); if (x) { x.qs.splice(Math.min(i, x.qs.length), 0, old); touch(); paintQuotes(id); } } });
}
/* foto aggiunta: la tengo (JPEG di al massimo 1600 px); il testo si legge solo su richiesta, o subito se l'opzione e' accesa */
async function quotePickPhoto(file, edit) {
  if (!quoteEdit) return;
  var msg = $('#quoteMsg');
  if (quoteEdit.phs.length >= QPH_MAX) { msg.textContent = 'Al massimo ' + QPH_MAX + ' foto per citazione.'; return; }
  var ph;
  try {
    var canvas = await loadCanvas(file, 2200), small = scaled(canvas, 1600);
    var blob = await new Promise(function (res) { small.toBlob(res, 'image/jpeg', 0.8); });
    if (!blob || !quoteEdit) throw new Error('jpeg');
    ph = { key: '', blob: blob, url: URL.createObjectURL(blob), canvas: canvas, read: false };
    var ed0 = quoteEdit;
    if (edit) {                                                   // subito l'editor: evidenzia o scrivi (la lettura del testo usa la foto senza segni)
      var marked = await editPhoto(blob);
      if (quoteEdit !== ed0) return;
      if (marked) { URL.revokeObjectURL(ph.url); ph.blob = marked; ph.url = URL.createObjectURL(marked); }
    }
    quoteEdit.phs.push(ph);
    paintQuotePh();
  } catch (e) { msg.textContent = 'Non riesco ad aprire questa foto: riprova.'; return; }
  if (settings.quoteOcrAuto) quoteOcr([ph]);
  else msg.textContent = (quoteEdit.phs.length > 1 ? 'Foto aggiunta (' + quoteEdit.phs.length + ').' : 'Foto aggiunta.') + ' Se vuoi il testo scritto, tocca «Leggi il testo».';
}
function ocrIdle() { var ob = $('#quoteOcr'); ob.disabled = false; ob.classList.remove('busy'); $('#quotePh').classList.remove('reading'); }
/* legge le foto indicate (o quelle non ancora lette, o tutte) e aggiunge il testo in fondo */
async function quoteOcr(list) {
  if (!quoteEdit || $('#quoteOcr').classList.contains('busy')) return;
  var ed = quoteEdit, msg = $('#quoteMsg'), btn = $('#quoteOcr');
  var todo = list || ed.phs.filter(function (p) { return !p.read; });
  if (!todo.length) todo = ed.phs.slice();
  if (!todo.length) return;
  btn.disabled = true; btn.classList.add('busy'); $('#quotePh').classList.add('reading');
  btn.innerHTML = '<span class="spin" aria-hidden="true"></span>' + (todo.length > 1 ? 'Leggo la foto 1 di ' + todo.length + '…' : 'Leggo il testo…');
  var found = 0;
  try {
    msg.textContent = 'Preparo il riconoscimento del testo (la prima volta ci vuole un po\')…';
    var w = await getOcr();
    for (var k = 0; k < todo.length; k++) {
      if (quoteEdit !== ed) return;
      var p = todo[k];
      btn.innerHTML = '<span class="spin" aria-hidden="true"></span>' + (todo.length > 1 ? 'Leggo la foto ' + (k + 1) + ' di ' + todo.length + '…' : 'Leggo il testo…');
      msg.textContent = 'Leggo la pagina…';
      var canvas = p.canvas;
      if (!canvas) { var bl = p.blob || await (await fetch(p.url)).blob(); canvas = await loadCanvas(bl, 2200); }
      var res;
      await w.setParameters({ tessedit_pageseg_mode: String(window.Tesseract.PSM.AUTO) });
      try { res = await w.recognize(canvas); }
      finally { await w.setParameters({ tessedit_pageseg_mode: String(window.Tesseract.PSM.SPARSE_TEXT) }); }
      var text = L.ocrParagraph((res.data || {}).text || '');
      p.read = true;
      if (quoteEdit !== ed) return;
      if (!text) continue;
      found++;
      var ta = $('#quoteText');
      ta.value = ((ta.value.trim() ? ta.value.trim() + '\n' : '') + text).slice(0, 1500);
    }
    if (quoteEdit !== ed) return;
    msg.textContent = found ? 'Ho letto ' + (todo.length > 1 ? 'le pagine' : 'la pagina') + ': tieni solo il passaggio che ti interessa e correggi gli errori. Le foto restano salvate con il testo.'
      : 'Non ho trovato del testo da leggere: puoi salvare solo le foto, oppure scrivere tu il passaggio.';
    if (found) $('#quoteText').focus();
  } catch (e) {
    if (quoteEdit === ed) msg.textContent = 'Lettura non riuscita' + (navigator.onLine === false ? ' (la prima volta serve la connessione)' : '') + ': le foto restano, e puoi scrivere tu il testo.';
  } finally { ocrIdle(); if (quoteEdit === ed) paintQuotePh(); }
}
$('#quoteForm').addEventListener('submit', function (e) { e.preventDefault(); saveQuote(); });
$('#quoteCancel').addEventListener('click', closeQuote);
$('#quoteDel').addEventListener('click', delQuote);
$('#quotePhoto').addEventListener('click', function () { snapPhoto('Foto della pagina', '#fileQuote').then(function (f) { if (f) quotePickPhoto(f, true); }); });
$('#fileQuote').addEventListener('change', function (e) { var f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) quotePickPhoto(f); });
$('#quoteOcr').addEventListener('click', function () { quoteOcr(null); });
/* dalla finestra della citazione: quello che c'e' scritto ora, anche se non ancora salvato */
async function shareQuoteForm() {
  if (!quoteEdit) return;
  var b = get(quoteEdit.id), x = $('#quoteText').value.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
  if (!b) return;
  if (!x && !quoteEdit.phs.length) { $('#quoteMsg').textContent = 'Scrivi il testo o aggiungi una foto, poi condividi.'; return; }
  var blobs = [];
  for (var k = 0; k < quoteEdit.phs.length; k++) { var p = quoteEdit.phs[k], bl = p.blob || await phBlob(p.key); if (bl) blobs.push(bl); }
  await shareQuoteObj(b, { x: x, pg: $('#quotePage').value.replace(/\D/g, '') }, blobs);
}
$('#quoteShare').addEventListener('click', shareQuoteForm);
$('#quoteThumbs').addEventListener('click', function (e) {
  if (!quoteEdit) return;
  var del = e.target.closest('[data-del]');
  if (del) {
    var k = +del.dataset.del, p = quoteEdit.phs[k];
    if (!p || $('#quoteOcr').classList.contains('busy')) return;
    quoteEdit.phs.splice(k, 1); if (p.blob && p.url) URL.revokeObjectURL(p.url);
    paintQuotePh(); $('#quoteMsg').textContent = 'Foto tolta (salva per confermare).'; return;
  }
  var ed = e.target.closest('[data-ed]');
  if (ed) {
    var q = quoteEdit, pk = quoteEdit.phs[+ed.dataset.ed];
    if (!pk || $('#quoteOcr').classList.contains('busy')) return;
    if (!pk.canvas && pk.url) { fetch(pk.url).then(function (r) { return r.blob(); }).then(function (b) { return loadCanvas(b, 2200); }).then(function (c) { if (!pk.canvas) pk.canvas = c; }).catch(function () {}); }   // per leggere il testo resta la foto di prima
    editPhoto(pk.blob || pk.url).then(function (marked) {
      if (!marked || quoteEdit !== q) return;
      if (pk.blob && pk.url) URL.revokeObjectURL(pk.url);
      pk.blob = marked; pk.url = URL.createObjectURL(marked); pk.key = '';
      paintQuotePh(); $('#quoteMsg').textContent = 'Segni aggiunti (salva per confermare).';
    });
    return;
  }
  var th = e.target.closest('[data-k]');
  if (th) openPhs(quoteEdit.phs.map(function (p) { return p.url; }).filter(Boolean), +th.dataset.k, $('#quoteBook').textContent);
});
$('#quoteSheet').addEventListener('click', function (e) { if (e.target === e.currentTarget) closeQuote(); });
