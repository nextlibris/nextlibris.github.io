/* Next Libris · app, parte 10 di 11 (app-wiki.js): dati da Wikidata (giro 2, 18/11/2026).
   Paese degli autori (statistiche, filtro, Raggruppa per, Stagione in libri), film e serie TV tratti dai libri
   (riga nella scheda, «Dai tuoi libri al cinema» in «Per te»), opere di un autore («Le sue opere» in Info Autore, «Per autore» nel +).
   Script classico come le altre parti: usa le loro funzioni globali e viene prima di app-avvio.js.
   Tutto gratis e senza chiave: it.wikipedia.org (auLookup, per trovare la voce) e query.wikidata.org (una domanda per autore, salvata sul telefono). */
'use strict';
var WD_LS = 'catalogo-libri-auwd', WD_RETRY = 30 * 864e5, WD_V = 3, WD_API = 'https://query.wikidata.org/sparql?format=json&query=';
var wdo = null, wdBusy = false, wdFails = 0, wdTimer = 0, wdPaintT = 0, wdNames = {}, wdCodes = {}, wdDN = null;
var WD_ISO = ('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ ' +
  'DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP ' +
  'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM ' +
  'PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ ' +
  'UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW').split(' ');
var WD_OK = {}; WD_ISO.forEach(function (c) { WD_OK[c] = 1; });

/* ---------- paesi: codice ISO di due lettere, nome in italiano, bandiera ---------- */
function wdCode(c) { c = String(c || '').toUpperCase(); return WD_OK[c] ? c : ''; }
function wdFlag(c) {                                     // la bandiera e' un'emoji fatta con le due lettere del codice: nessuna immagine da scaricare
  c = wdCode(c); if (!c) return '';
  return String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65, 0x1F1E6 + c.charCodeAt(1) - 65);
}
function wdCName(c) {
  c = wdCode(c); if (!c) return '';
  if (wdNames[c]) return wdNames[c];
  var n = '';
  try { if (!wdDN) wdDN = new Intl.DisplayNames(['it'], { type: 'region' }); n = wdDN.of(c) || ''; } catch (e) { n = ''; }
  if (!n || n === c) n = c === 'XK' ? 'Kosovo' : c;
  wdNames[c] = n; wdCodes[L.norm(n)] = c;
  return n;
}
function wdCodeOf(name) { var k = L.norm(name); if (!wdCodes[k]) WD_ISO.forEach(wdCName); return wdCodes[k] || ''; }   // dal nome al codice (gruppi, correzione a mano)

/* ---------- dati salvati per autore: { q: voce di Wikidata, c: paese, b: paese di nascita se diverso, f: film, t: quando } ---------- */
function wdMap() {
  if (esempio() && guest.info.wd) return guest.info.wd;   // libreria di esempio: paesi e film già scritti nei dati (giro 4)
  if (!wdo) {
    try { wdo = JSON.parse(ls.get(WD_LS) || '{}'); } catch (e) { nlErr(e); }
    if (!wdo || typeof wdo !== 'object' || wdo['~v'] !== WD_V) wdo = { '~v': WD_V };
  }
  return wdo;
}
function wdStore() {
  if (esempio()) return;
  var m = wdMap(), ks = Object.keys(m).filter(function (k) { return k.charAt(0) !== '~'; });
  if (ks.length >= 2000) ks.sort(function (a, b) { return (m[a].t || 0) - (m[b].t || 0); }).slice(0, 200).forEach(function (k) { delete m[k]; });
  try { ls.set(WD_LS, JSON.stringify(m)); } catch (e) { nlErr(e); }
}
function wdKey(name) { return L.norm(auCanon(name)); }   // «U. Eco» usa i dati di «Umberto Eco» (autori simili, giro 1)
function wdEntry(name) {                                 // null = da cercare
  var x = wdMap()[wdKey(name)];
  if (!x || typeof x !== 'object') return null;
  if (!x.q && Date.now() - (Number(x.t) || 0) > WD_RETRY) return null;   // «non trovato»: si riprova dopo 30 giorni
  return x;
}
function wdCountry(name) {                               // il paese dell'autore: quello corretto a mano, altrimenti quello di Wikidata
  if (!name) return '';
  var man = settings.auPa[wdKey(name)];
  if (man) return wdCode(man);
  var x = wdEntry(name);
  return x ? wdCode(x.c) : '';
}
function wdBirth(name) { var x = wdEntry(name), b = x ? wdCode(x.b) : ''; return b && b !== wdCountry(name) ? b : ''; }
function wdBookCountry(b) { var a0 = authorsOf(b)[0]; return a0 ? wdCountry(a0) : ''; }   // come nei gruppi: conta il primo autore
function wdCLabel(c) { return wdCName(c); }               // solo testo (avvisi, pillola del filtro): l'emoji su Windows diventa due lettere
function wdFlagImg(c, cls) {                             // bandiera come piccola immagine dell'app (vendor/flags, da flag-icons, MIT): si scarica solo quella che serve (giro 5)
  c = wdCode(c); if (!c) return '';
  return '<img class="flag' + (cls ? ' ' + cls : '') + '" src="vendor/flags/' + c.toLowerCase() + '.webp" alt="" width="20" height="15" loading="lazy" decoding="async">';
}
function wdCLabelH(c) { var n = wdCName(c); return n ? wdFlagImg(c) + esc(n) : ''; }   // bandiera + nome, per l'HTML

/* ---------- le domande a Wikidata ---------- */
/* il servizio ogni tanto risponde 502 o 503 per un attimo (visto il 18/11/2026): si riprova una volta dopo due secondi */
async function wdAsk(sparql) {
  var u = WD_API + encodeURIComponent(sparql), o = { waits: [], timeout: 20000 };
  try { return await L.getJson(fetch, u, o); }
  catch (e) {
    if (!(e && e.status >= 500)) throw e;
    await new Promise(function (ok) { setTimeout(ok, 2000); });
    return L.getJson(fetch, u, o);
  }
}
function wdRows(j) {
  var b = j && j.results && j.results.bindings;
  return Array.isArray(b) ? b.map(function (r) { var o = {}; Object.keys(r).forEach(function (k) { o[k] = r[k] && typeof r[k].value === 'string' ? r[k].value : ''; }); return o; }) : [];
}
function wdQ(u) { var m = /(Q\d{1,12})$/.exec(String(u || '')); return m ? m[1] : ''; }
/* una domanda per autore: cittadinanze (solo stati di oggi), paese del luogo di nascita, opere derivate dalle sue (con il loro tipo) e titoli di quelle opere.
   Provata sul servizio vero il 18/11/2026: niente «wdt:P31/wdt:P279*» (da solo portava la risposta a 40-80 secondi) e l'opera ripetuta in ogni ramo
   dei titoli (senza, il servizio scorre tutte le etichette); l'ordine scritto e' quello giusto, quindi il servizio non lo cambia (optimizer None). Cosi': 0,5-4 secondi. */
function wdInfoQuery(qid) {
  var base = '?w wdt:P50 wd:' + qid + '. { ?f wdt:P144 ?w. } UNION { ?w wdt:P4969 ?f. } ', lang = ' FILTER(LANG(?wl) IN ("it", "en", "fr", "es", "de", "mul"))';   // «tratto da» sul film oppure «opera derivata» sul libro (19/11/2026)
  return 'SELECT ?k ?iso ?end ?pref ?f ?fLabel ?t ?d ?dirLabel ?w ?wl ?art WHERE { hint:Query hint:optimizer "None". ' +
    '{ BIND("c" AS ?k) wd:' + qid + ' p:P27 ?s. ?s ps:P27 ?c. ?c wdt:P297 ?iso. FILTER NOT EXISTS { ?c wdt:P576 ?x. } FILTER NOT EXISTS { ?s wikibase:rank wikibase:DeprecatedRank. }' +
    ' OPTIONAL { ?s pq:P582 ?end. } OPTIONAL { ?s wikibase:rank wikibase:PreferredRank. BIND(1 AS ?pref) } }' +
    ' UNION { BIND("b" AS ?k) wd:' + qid + ' wdt:P19 ?pl. ?pl wdt:P17 ?bc. ?bc wdt:P297 ?iso. FILTER NOT EXISTS { ?bc wdt:P576 ?x. } }' +
    ' UNION { BIND("f" AS ?k) ' + base + '?f wdt:P31 ?t. OPTIONAL { ?f wdt:P577 ?d. } OPTIONAL { ?f wdt:P580 ?d. } OPTIONAL { ?f wdt:P57 ?dir. } OPTIONAL { ?art schema:about ?f; schema:isPartOf <https://it.wikipedia.org/>. } }' +
    ' UNION { BIND("w" AS ?k) ' + base + '?w rdfs:label ?wl.' + lang + ' }' +
    ' UNION { BIND("w" AS ?k) ' + base + '?w skos:altLabel ?wl.' + lang + ' }' +
    ' UNION { BIND("w" AS ?k) ' + base + '?w wdt:P1476 ?wl. }' +
    ' SERVICE wikibase:label { bd:serviceParam wikibase:language "it,mul,en". } } LIMIT 5000';
}
/* film omonimi (19/11/2026): su Wikidata molti film non hanno «tratto da» (Io speriamo che me la cavo, 1992). Si cercano i film e le serie
   con lo stesso titolo (italiano o inglese) di un'opera dell'autore e con una voce su it.wikipedia; valgono solo se quella voce ha un
   collegamento alla voce dell'autore (wdSameOk). Provato il 19/11: D'Orta sì; per King scartati «Christine» 2016 ed «Es» 1966, per Dante gli «Inferno».
   Solo le opere con almeno una voce su Wikipedia: senza, per King la domanda durava 26-60 secondi; così 0,5-6 secondi (Shakespeare il più lento). */
function wdSameQuery(qid) {
  return 'SELECT DISTINCT ?f ?fLabel ?t ?d ?dirLabel ?w ?wl ?art WHERE { hint:Query hint:optimizer "None". ' +
    '?w wdt:P50 wd:' + qid + '. ?w wikibase:sitelinks ?n. FILTER(?n > 0) ?w rdfs:label ?wl. FILTER(LANG(?wl) IN ("it", "en")) ?f rdfs:label ?wl. ?f wdt:P31 ?t. ' +
    'VALUES ?t { ' + Object.keys(WD_TY).map(function (t) { return 'wd:' + t; }).join(' ') + ' } ' +
    '?art schema:about ?f; schema:isPartOf <https://it.wikipedia.org/>. FILTER NOT EXISTS { ?f wdt:P144 ?w. } ' +
    'OPTIONAL { ?f wdt:P577 ?d. } OPTIONAL { ?f wdt:P580 ?d. } OPTIONAL { ?f wdt:P57 ?dir. } ' +
    'SERVICE wikibase:label { bd:serviceParam wikibase:language "it,mul,en". } } LIMIT 400';
}
function wdArtTitle(u) { try { return decodeURIComponent(String(u).split('/wiki/')[1] || '').replace(/_/g, ' '); } catch (e) { return ''; } }
async function wdSameOk(arts, auTitle) {                 // quali voci di film hanno un collegamento alla voce dell'autore (al massimo 2 domande da 50)
  var ok = {}, ts = arts.map(wdArtTitle).filter(Boolean).slice(0, 100);
  for (var i = 0; i < ts.length; i += 50) {
    var j = await L.getJson(fetch, 'https://it.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&prop=links&pllimit=max&plnamespace=0&pltitles=' +
      encodeURIComponent(auTitle) + '&titles=' + encodeURIComponent(ts.slice(i, i + 50).join('|')), { waits: [], timeout: 10000 });
    var back = {}; ((j && j.query && j.query.normalized) || []).forEach(function (n) { back[n.to] = n.from; });
    ((j && j.query && j.query.pages) || []).forEach(function (p) { if (p && Array.isArray(p.links) && p.links.length) ok[back[p.title] || p.title] = 1; });
  }
  return ok;
}
async function wdSameRows(qid, auTitle) {                // le righe dei film omonimi confermati, nello stesso formato della domanda principale
  if (!auTitle) return [];
  try {
    var rows = wdRows(await wdAsk(wdSameQuery(qid))).filter(function (r) { return /^https:\/\/it\.wikipedia\.org\/wiki\//.test(r.art); });
    if (!rows.length) return [];
    var arts = []; rows.forEach(function (r) { if (arts.indexOf(r.art) < 0) arts.push(r.art); });
    var ok = await wdSameOk(arts, auTitle), out = [];
    rows.forEach(function (r) {
      if (!ok[wdArtTitle(r.art)]) return;
      r.k = 'f'; out.push(r); out.push({ k: 'w', w: r.w, wl: r.wl });
    });
    return out;
  } catch (e) { if (!e || !e.status || e.status === 429 || e.status >= 500) throw e; return []; }   // rete, lentezza o «troppe domande» (rilettura di tanti autori): l'autore si riprova dopo 5 minuti, mai salvato senza i film
}
/* film o serie TV? Dipende dal tipo dell'opera derivata (film, film d'animazione, miniserie… ma anche videogiochi, opere liriche, altri libri).
   I tipi piu' comuni sono gia' scritti qui (letti da Wikidata il 18/11/2026); per quelli nuovi una domanda piccola, e la risposta resta salvata. */
var WD_TY = { Q11424: 'f', Q202866: 'f', Q506240: 'f', Q653916: 'f', Q18011172: 'f', Q24862: 'f', Q98701476: 'f', Q5398426: 's', Q1259759: 's' };
function wdTy() { var m = wdMap(); if (!m['~ty'] || typeof m['~ty'] !== 'object' || Object.keys(m['~ty']).length > 600) m['~ty'] = {}; return m['~ty']; }
function wdTyGet(t) { return WD_TY[t] != null ? WD_TY[t] : wdTy()[t]; }   // 'f' film, 's' serie TV, '' altro; undefined = da chiedere
function wdTypesQuery(ts) { return 'SELECT ?t ?cls WHERE { VALUES ?t { ' + ts.map(function (t) { return 'wd:' + t; }).join(' ') + ' } VALUES ?cls { wd:Q11424 wd:Q5398426 } ?t wdt:P279* ?cls. }'; }
async function wdClassify(types) {
  var ask = types.filter(function (t) { return wdTyGet(t) === undefined; }).slice(0, 60);
  if (!ask.length) return;
  var got = {};
  wdRows(await wdAsk(wdTypesQuery(ask))).forEach(function (r) { var t = wdQ(r.t), c = wdQ(r.cls); if (t) got[t] = c === 'Q5398426' || got[t] === 's' ? 's' : 'f'; });
  var m = wdTy(); ask.forEach(function (t) { m[t] = got[t] || ''; });
}
function wdYear(d) { var m = /^(\d{4})-/.exec(d || ''); return m ? +m[1] : 0; }
function wdParseInfo(rows) {
  var cs = [], birth = '', films = {}, labels = {}, types = {};
  rows.forEach(function (r) {
    if (r.k === 'c') { var c = wdCode(r.iso); if (c) cs.push({ c: c, end: !!r.end, pref: !!r.pref }); }
    else if (r.k === 'b') { if (!birth) birth = wdCode(r.iso); }
    else if (r.k === 'w') { var w = wdQ(r.w), k = L.titleKey(r.wl); if (w && k) { (labels[w] = labels[w] || {})[k] = 1; } }
    else if (r.k === 'f') {
      var f = wdQ(r.f), t = L.str(r.fLabel).trim();
      if (!f || !t || /^Q\d+$/.test(t)) return;          // senza titolo in italiano o in inglese: non si mostra
      var x = films[f] || (films[f] = { q: f, t: t.slice(0, 160), y: 0, d: [], u: '', w: {}, ty: {} });
      var y = wdYear(r.d); if (y && (!x.y || y < x.y)) x.y = y;
      var dn = L.str(r.dirLabel).trim(); if (dn && !/^Q\d+$/.test(dn) && x.d.indexOf(dn) < 0 && x.d.length < 2) x.d.push(dn.slice(0, 80));
      var ty = wdQ(r.t); if (ty) { x.ty[ty] = 1; types[ty] = 1; }
      if (/^https:\/\/it\.wikipedia\.org\/wiki\/[^\s"'<>]+$/.test(r.art)) x.u = r.art;
      var wq = wdQ(r.w); if (wq) x.w[wq] = 1;
    }
  });
  /* un solo paese (scelta di Piero, 18/11/2026): tra gli stati di oggi quello ancora valido e preferito; a parita' quello di nascita;
     se restano solo stati scomparsi (Impero russo, Regno d'Italia) il paese dove si trova oggi il luogo di nascita */
  var live = cs.filter(function (x) { return !x.end; }); if (!live.length) live = cs;
  var pref = live.filter(function (x) { return x.pref; }); if (pref.length) live = pref;
  var c = live.some(function (x) { return x.c === birth; }) ? birth : live.length ? live[0].c : birth;
  var raw = Object.keys(films).map(function (f) {
    var x = films[f], ks = {};
    Object.keys(x.w).forEach(function (w) { Object.keys(labels[w] || {}).forEach(function (k) { ks[k] = 1; }); });
    return { q: x.q, t: x.t, y: x.y, d: x.d.join(', '), u: x.u, k: Object.keys(ks).slice(0, 12), ty: Object.keys(x.ty) };
  }).filter(function (x) { return x.k.length; });
  return { c: c || '', b: birth && birth !== c ? birth : '', raw: raw, types: Object.keys(types) };
}
function wdFilmList(raw) {                                // dopo wdClassify: restano solo film e serie TV
  return raw.map(function (x) {
    var kinds = x.ty.map(wdTyGet);
    if (kinds.indexOf('f') < 0 && kinds.indexOf('s') < 0) return null;
    return { q: x.q, t: x.t, y: x.y, d: x.d, s: kinds.indexOf('s') >= 0 ? 1 : 0, u: x.u, k: x.k };
  }).filter(Boolean).sort(function (a, b) { return (a.y || 9999) - (b.y || 9999); }).slice(0, 60);
}
/* cerca e salva i dati di un autore; chi e' gia' salvato torna subito. Senza rete lancia l'errore e non salva niente */
var wdRun1 = {}, wdLater = {};                           // wdLater: autori la cui ricerca e' fallita poco fa (rete o servizio): si saltano per 5 minuti, cosi' gli altri vanno avanti
function wdFetch(name) {
  var k = wdKey(name), have = wdEntry(name);
  if (have) return Promise.resolve(have);
  if (esempio()) return Promise.reject(new Error('esempio'));   // nessuna chiamata a Wikidata nella libreria di esempio
  if (!wdRun1[k]) wdRun1[k] = wdFetchNow(name, k).then(function (x) { delete wdRun1[k]; return x; }, function (e) { delete wdRun1[k]; throw e; });
  return wdRun1[k];
}
async function wdFetchNow(name, k) {
  var r = await auLookup(auCanon(name)), x = { t: Date.now() };
  if (r && !r.none && r.qid) {
    var info = wdParseInfo(wdRows(await wdAsk(wdInfoQuery(r.qid))).concat(await wdSameRows(r.qid, r.title)));
    await wdClassify(info.types);
    var fl = wdFilmList(info.raw);
    x.q = r.qid; x.c = info.c; if (info.b) x.b = info.b; if (fl.length) x.f = fl;
    if (r.img && aufGet(name) === null) aufSave(auCanon(name), r.img);   // gia' che c'e': la foto per le copertine degli autori
  }
  wdMap()[k] = x; wdStore();
  wdChanged();
  return x;
}
/* in sottofondo, uno alla volta: gli autori dei libri che non hanno ancora i dati (anche quelli della libreria di un amico che stai guardando) */
function wdTodo() {
  var seen = {}, out = [];
  var add = function (b) { authorsOf(b).slice(0, 2).forEach(function (n) { var k = wdKey(n); if (!seen[k]) { seen[k] = 1; if (!wdEntry(n) && !(wdLater[k] > Date.now())) out.push(n); } }); };
  try { state.books.forEach(add); if (guest) myBooks().forEach(add); } catch (e) { nlErr(e); }
  return out;
}
function wdKick(ms) {
  if (wdBusy || wdTimer) return;
  wdTimer = setTimeout(function () { wdTimer = 0; wdLoop(); }, ms == null ? 3000 : ms);
}
async function wdLoop() {
  if (wdBusy || navigator.onLine === false || esempio()) return;
  wdBusy = true;
  try {
    for (var guard = 0; guard < 400; guard++) {
      var todo = wdTodo();
      if (!todo.length) break;
      try { await wdFetch(todo[0]); wdFails = 0; }
      catch (e) {
        if (e && e.status && e.status !== 429 && e.status < 500) { wdMap()[wdKey(todo[0])] = { t: Date.now() }; wdStore(); }   // risposta d'errore per questo autore: come «non trovato»
        else {                                                                                                                 // rete debole o servizio occupato: questo autore dopo, intanto gli altri
          wdLater[wdKey(todo[0])] = Date.now() + 5 * 60000;
          if (++wdFails >= 3) { wdFails = 0; setTimeout(function () { wdKick(0); }, 60000); break; }                          // tre di fila: pausa di un minuto
        }
      }
      await new Promise(function (ok) { setTimeout(ok, 1200); });
    }
  } finally { wdBusy = false; }
  wdChanged();
}
function wdLeft() { return wdTodo().length; }
/* sono arrivati dati nuovi: si aggiornano con calma le parti che li mostrano (mai la scheda in cui si sta scrivendo: solo la riga dei film) */
function wdChanged() {
  clearTimeout(wdPaintT);
  wdPaintT = setTimeout(function () {
    try {
      filmPaintAll();
      if (!$('#statsSheet').hidden) wdStatsPaint();
      if (!$('#auSheet').hidden && auNow) auPaPaint(auNow.name);
      if ((grpMode() === 'pae' || paFlt) && !Object.keys(openState).some(function (k) { return openState[k]; }) && !document.querySelector('.sheet:not([hidden])')) renderList();
      if (drawerOpen) renderDrawer();
    } catch (e) { nlErr(e); }
  }, 700);
}
window.addEventListener('online', function () { wdLater = {}; wdKick(2000); });

/* ---------- paese nella finestra dell'autore: «Paese: 🇮🇹 Italia (nascita: 🇨🇺 Cuba) · Correggi» ---------- */
var auPaOpen = false;
function auPaPaint(name, open) {
  var box = $('#auPa'); if (!box) return;
  auPaOpen = !!open;
  var k = wdKey(name), man = wdCode(settings.auPa[k]), x = wdEntry(name), c = wdCountry(name), b = wdBirth(name);
  var txt = c ? '<b>' + wdCLabelH(c) + '</b>' + (b ? ' <span class="aup-b">(nascita: ' + wdCLabelH(b) + ')</span>' : '') + (man ? ' <small>(corretto)</small>' : '')
    : x || navigator.onLine === false ? 'non trovato' : '<span class="aup-wait">lo sto cercando…</span>';
  var h = '<p class="auc-now">Paese: ' + txt + ' <button type="button" class="link" data-aup="open" aria-expanded="' + !!open + '">' + (open ? 'Chiudi' : c ? 'Correggi' : 'Scegli') + '</button></p>';
  if (open) {
    h += '<div class="auc-opts aup-opts"><label class="field aup-f"><span>Scrivi il paese</span><input id="auPaQ" type="text" autocomplete="off" enterkeyhint="done" maxlength="40" placeholder="es. Francia"></label>' +
      '<div class="aup-list" id="auPaList" role="listbox" aria-label="Paesi"></div>' +
      (man ? '<button type="button" class="link auc-auto" data-aup="auto">Torna a quello di Wikipedia' + (x && wdCode(x.c) ? ' (' + esc(wdCName(x.c)) + ')' : '') + '</button>' : '') + '</div>';
  }
  box.innerHTML = h; box.hidden = false;
  if (open) { auPaList(''); setTimeout(function () { try { $('#auPaQ').focus({ preventScroll: true }); } catch (e) { nlErr(e); } }, 30); }
}
function auPaList(text) {
  var el = $('#auPaList'); if (!el) return;
  var nq = L.norm(text).trim(), all = WD_ISO.map(function (c) { return [c, wdCName(c)]; });
  var hit = nq ? all.filter(function (x) { return L.norm(x[1]).indexOf(nq) === 0; }).concat(all.filter(function (x) { return L.norm(x[1]).indexOf(nq) > 0; }))
    : ['IT', 'FR', 'GB', 'US', 'DE', 'ES', 'RU', 'JP'].map(function (c) { return [c, wdCName(c)]; });
  el.innerHTML = hit.slice(0, 8).map(function (x) {
    return '<button type="button" class="pk-o" role="option" data-aup="' + x[0] + '"><span aria-hidden="true">' + wdFlagImg(x[0]) + '</span><span>' + esc(x[1]) + '</span></button>';
  }).join('') || '<p class="msg">Nessun paese con questo nome.</p>';
}
function auPaSet(code) {
  if (!auNow) return;
  var k = wdKey(auNow.name), name = auNow.name;
  if (code) settings.auPa[k] = code; else delete settings.auPa[k];
  saveSettings(); auPaPaint(name, false);
  if (grpMode() === 'pae' || paFlt) renderList();
  toast(code ? auCanon(name) + ': ' + wdCLabel(code) + '.' : 'Tolta la correzione del paese.');
}
$('#auPa').addEventListener('click', function (e) {
  var b = e.target.closest('[data-aup]'); if (!b || !auNow) return;
  var v = b.dataset.aup;
  if (v === 'open') auPaPaint(auNow.name, !auPaOpen);
  else if (v === 'auto') auPaSet('');
  else if (wdCode(v)) auPaSet(v);
});
$('#auPa').addEventListener('input', function (e) { if (e.target.id === 'auPaQ') auPaList(e.target.value); });
$('#auPa').addEventListener('keydown', function (e) {
  if (e.key !== 'Enter' || e.target.id !== 'auPaQ') return;
  e.preventDefault();
  var first = $('#auPaList [data-aup]'); if (first) auPaSet(first.dataset.aup);
});
/* chiamata da openAuthor (app-scheda.js) quando la voce di Wikipedia e' arrivata: paese e tasto «Le sue opere» */
function auWikiMore(name, r) {
  var wb = $('#auWorks');
  wb.hidden = !(r && !r.none && r.qid);
  auPaPaint(name);
  if (!wdEntry(name) && navigator.onLine !== false) wdFetch(name).then(function () { if (auNow && auNow.name === name) auPaPaint(name, auPaOpen); }, function () { if (auNow && auNow.name === name) auPaPaint(name, auPaOpen); });
}

/* ---------- paese: statistiche, filtro, gruppi ---------- */
function wdCountryStats(books) {
  var m = {}, none = 0, it = 0, ext = 0;
  books.forEach(function (b) { var c = wdBookCountry(b); if (!c) { none++; return; } m[c] = (m[c] || 0) + 1; if (c === 'IT') it++; else ext++; });
  var items = Object.keys(m).map(function (c) { return { c: c, k: wdCLabel(c), n: m[c] }; }).sort(function (x, y) { return y.n - x.n || coll.compare(wdCName(x.c), wdCName(y.c)); });
  return { items: items, none: none, it: it, ext: ext };
}
function wdStatsHTML() {
  var books = tabBooks().filter(hasData), st = wdCountryStats(books), left = wdLeft(), max = st.items.reduce(function (a, x) { return Math.max(a, x.n); }, 1);
  if (!st.items.length && !left) return '<section class="st-sec" id="stPaesi" hidden></section>';
  var libri = function (n) { return n + (n === 1 ? ' libro' : ' libri'); };
  var note = [st.it || st.ext ? 'Autori italiani: <b>' + libri(st.it) + '</b> · stranieri: <b>' + libri(st.ext) + '</b>' : '', st.none && !left ? 'paese non trovato: ' + libri(st.none) : ''].filter(Boolean).join(' · ');
  return '<section class="st-sec" id="stPaesi"><h3>Paesi degli autori</h3>' +
    (st.items.length ? '<div class="bars">' + st.items.slice(0, 12).map(function (x) {
      return '<button class="bar-row" data-sf="pa" data-sv="' + x.c + '" title="Mostra questi libri"><span class="bl">' + wdCLabelH(x.c) + '</span><span class="bt"><span class="bf" style="width:' + Math.max(2, Math.round(x.n / max * 100)) + '%"></span></span><span class="bv">' + x.n + '</span></button>';
    }).join('') + '</div>' + (st.items.length > 12 ? '<p class="msg">E altri ' + (st.items.length - 12) + ' paesi: li trovi tutti nei Filtri.</p>' : '') : '') +
    (note ? '<p class="msg st-pa-note">' + note + '</p>' : '') +
    (left ? '<p class="msg st-pa-wait"><span class="spin" aria-hidden="true"></span>Sto cercando su Wikipedia il paese di ' + (left === 1 ? 'un autore' : left + ' autori') + '…</p>' : '') + '</section>';
}
function wdStatsPaint() { var el = $('#stPaesi'); if (el) el.outerHTML = wdStatsHTML(); }
function wdFacets() {                                    // per i Filtri: paesi dei libri di questa scheda, dal piu' presente
  var st = wdCountryStats(tabBooks());
  return { items: st.items, none: st.none };
}
function paChipText() { return paFlt === NONE ? 'Paese non trovato' : 'Paese: ' + wdCLabel(paFlt); }
function paDrawerHTML() {
  var f = wdFacets();
  if (!f.items.length && !paFlt) return '';
  var MAXP = 8, open = drawerMore.pa || f.items.length <= MAXP + 2, shown = open ? f.items : f.items.slice(0, MAXP);
  if (!open && paFlt && paFlt !== NONE && !shown.some(function (x) { return x.c === paFlt; })) { var cur = f.items.find(function (x) { return x.c === paFlt; }); if (cur) shown = shown.concat([cur]); }
  var pill = function (v, html, n, cls) { return '<button type="button" class="dpill' + (cls || '') + '" data-g="pa" data-v="' + esc(v) + '" aria-pressed="' + (paFlt === v ? 'true' : 'false') + '">' + html + '<span class="n">' + n + '</span></button>'; };
  return '<h3>Paese dell\'autore</h3><div class="dpills">' + shown.map(function (x) { return pill(x.c, wdCLabelH(x.c), x.n); }).join('') +
    (f.none ? pill(NONE, 'Non trovato', f.none, ' none-sh') : '') +
    (open ? '' : '<button type="button" class="dpill more" data-g="more" data-v="pa">Altri ' + (f.items.length - shown.length) + '…</button>') + '</div>';
}

/* ---------- film e serie TV tratti dai libri ---------- */
function wdFilms(b) {
  var out = [], seen = {}, tk = L.titleKey(b.t), full = L.norm(b.t).replace(/[^a-z0-9]+/g, ' ').trim();
  if (!tk) return out;
  authorsOf(b).slice(0, 2).forEach(function (n) {
    var x = wdMap()[wdKey(n)];
    if (!x || !Array.isArray(x.f)) return;
    x.f.forEach(function (f) {
      if (!f || seen[f.q] || !Array.isArray(f.k)) return;
      if (f.k.indexOf(tk) >= 0 || f.k.indexOf(full) >= 0) { seen[f.q] = 1; out.push(f); }
    });
  });
  return out;
}
var FILM_ICO = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="18" height="11" rx="2"/><path d="M3 9l1-4 16.5-2.2.8 3.6L3 9zM8 4.4l2.6 3.5M13 3.7l2.6 3.5"/></svg>';
function filmOne(f) {
  var extra = [f.y || '', f.d || ''].filter(Boolean).join(', ');
  return (f.u ? '<a href="' + esc(f.u) + '" target="_blank" rel="noopener">' + esc(f.t) + '</a>' : '<span class="fm-t">' + esc(f.t) + '</span>') + (extra ? ' <span class="fm-x">(' + esc(extra) + ')</span>' : '');
}
function filmDir(d) {                                     // «Luchino Visconti» -> «L. Visconti»
  var w = String(d || '').trim().split(/\s+/).filter(Boolean);
  if (w.length < 2) return w.join(' ');
  var last = w.pop();
  while (w.length && /^(de|di|da|del|della|van|von|der|le|la)$/i.test(w[w.length - 1])) last = w.pop() + ' ' + last;
  return w.map(function (x) { return x.split('-').map(function (y) { return y.charAt(0).toUpperCase() + '.'; }).join('-'); }).join(' ') + ' ' + last;   // «Jean-Jacques» -> «J.-J.»
}
function filmLine(f) {                                    // «🎬 Il Gattopardo — film, 1963 · regia di L. Visconti ›»: il tocco apre Wikipedia (giro 5)
  var what = (f.s ? 'serie TV' : 'film') + (f.y ? ', ' + f.y : '') + (f.d ? ' · regia di ' + filmDir(f.d) : '');
  var inner = '<span class="fl-e" aria-hidden="true">' + (f.s ? '📺' : '🎬') + '</span><span class="fl-m"><b>' + esc(f.t) + '</b> <span class="fm-x">— ' + esc(what) + '</span></span>';
  return f.u ? '<a class="fl-row" href="' + esc(f.u) + '" target="_blank" rel="noopener" title="Apri su Wikipedia">' + inner + '<span class="fl-go" aria-hidden="true">›</span></a>'
    : '<div class="fl-row">' + inner + '</div>';
}
function filmInner(b) {                                   // sezione «Dal libro»: prima i film, poi le serie, in ordine di anno
  var fs = wdFilms(b);
  if (!fs.length) return '';
  var by = function (x, y) { return (x.y || 9999) - (y.y || 9999); };
  var all = fs.filter(function (f) { return !f.s; }).sort(by).concat(fs.filter(function (f) { return f.s; }).sort(by)), MAX = 6;
  return '<p class="fl-h">Dal libro</p>' + all.slice(0, MAX).map(filmLine).join('') + (all.length > MAX ? '<p class="fl-more fm-x">e altri ' + (all.length - MAX) + '</p>' : '');
}
function filmHTML(b, off) {                               // riga nella scheda del libro; vuota finche' non si trova un film
  if (off || !b.t) return '';
  var h = filmInner(b);
  return '<div class="filmbox" data-film="' + esc(b.id) + '"' + (h ? '' : ' hidden') + '>' + h + '</div>';
}
function filmPaintAll() {
  Array.prototype.forEach.call(document.querySelectorAll('#list .filmbox[data-film]'), function (el) {
    var b = get(el.dataset.film); if (!b) return;
    var h = filmInner(b);
    if (!h === el.hidden && el.dataset.n === String(h.length)) return;
    el.innerHTML = h; el.hidden = !h; el.dataset.n = String(h.length);
  });
}
/* «Dai tuoi libri al cinema» (Per te): i film e le serie tratti dai tuoi libri, Libreria e Desideri */
function filmsMine() {
  var out = [];
  myBooks().forEach(function (b) { if (b.xs) return; wdFilms(b).forEach(function (f) { out.push({ f: f, b: b }); }); });
  return out.sort(function (x, y) { return coll.compare(L.sortKeyTitle(x.b.t) || '~', L.sortKeyTitle(y.b.t) || '~') || (x.f.y || 9999) - (y.f.y || 9999); });
}
var FM_BOOKS = 6, FM_FILMS = 2;                          // riquadri regolari (Piero, 18/11/2026): 6 libri e 2 film per libro, poi «Mostra tutti»
function openFilms(all0) {
  if (guest) guestExit(true);                            // «Per te» parla sempre della tua libreria
  var all = filmsMine(), left = wdLeft(), by = {}, order = [], showAll = all0 === true;
  all.forEach(function (x) { if (!by[x.b.id]) { by[x.b.id] = { b: x.b, fs: [] }; order.push(x.b.id); } by[x.b.id].fs.push(x.f); });
  var vis = showAll ? order : order.slice(0, FM_BOOKS);
  $('#filmBody').innerHTML = (order.length ? '<ul class="fm-list">' + vis.map(function (id) {
    var g = by[id], b = g.b, img = smallImg(b), more = g.fs.length - FM_FILMS;
    return '<li class="fm-row"><button type="button" class="fm-book" data-fb="' + esc(b.id) + '" aria-label="Apri il libro ' + esc(b.t) + '">' +
      (img ? '<span class="sum-img"><img src="' + esc(img) + '" alt="" loading="lazy" referrerpolicy="no-referrer" data-rm></span>' : '<span class="sum-img ph" style="--h:' + hue(b.t + b.a) + '" aria-hidden="true">' + esc(L.str(b.t).charAt(0).toUpperCase()) + '</span>') + '</button>' +
      '<div class="fm-in"><button type="button" class="fm-bt" data-fb="' + esc(b.id) + '"><b>' + esc(b.t) + '</b><small>' + esc([b.a, b.w ? 'nei Desideri' : ''].filter(Boolean).join(' · ')) + '</small></button>' +
      '<ul class="fm-films">' + g.fs.map(function (f, i) { return '<li' + (i >= FM_FILMS ? ' class="fm-hid" hidden' : '') + '><span class="tag">' + (f.s ? 'Serie TV' : 'Film') + '</span> ' + filmOne(f) + '</li>'; }).join('') + '</ul>' +
      (more > 0 ? '<button type="button" class="link fm-more" data-fmore>' + (more === 1 ? 'Un altro' : 'Altri ' + more) + ' ›</button>' : '') + '</div></li>';
  }).join('') + '</ul>' + (order.length > vis.length ? '<button type="button" class="btn fm-all" data-fall>Mostra tutti (' + order.length + ')</button>' : '') :
    '<p class="msg">' + (left ? 'Non ho ancora trovato film tratti dai tuoi libri.' : 'Non ho trovato film o serie TV tratti dai tuoi libri.') + ' Wikidata conosce bene i classici e i libri famosi, meno le edizioni minori.</p>') +
    (left ? '<p class="msg st-pa-wait"><span class="spin" aria-hidden="true"></span>Sto ancora cercando per ' + (left === 1 ? 'un autore' : left + ' autori') + ': riapri tra poco.</p>' : '');
  $('#filmSheet').hidden = false;
  wdKick(0);
}
function closeFilms() { $('#filmSheet').hidden = true; }
$('#filmClose').addEventListener('click', closeFilms);
$('#filmBody').addEventListener('click', function (e) {
  var m = e.target.closest('[data-fmore]');
  if (m) { Array.prototype.forEach.call(m.parentNode.querySelectorAll('.fm-hid'), function (x) { x.hidden = false; }); m.remove(); return; }
  if (e.target.closest('[data-fall]')) { var si = $('#filmSheet .sheet-in'), y = si ? si.scrollTop : 0; openFilms(true); if (si) si.scrollTop = y; return; }
  var b = e.target.closest('[data-fb]'); if (!b) return;
  closeFilms(); showBook(b.dataset.fb);
});

/* ---------- le opere di un autore: da Info Autore («Le sue opere») e dal + («Per autore») ---------- */
var WD_WORK_T = 'wd:Q7725634, wd:Q571, wd:Q8261, wd:Q47461344, wd:Q1279564, wd:Q12106333, wd:Q25379, wd:Q149537, wd:Q725377, wd:Q35760, wd:Q277759, wd:Q1667921, wd:Q8274, wd:Q1760610, wd:Q14406742, wd:Q37484, wd:Q20540385, wd:Q116476516';
var WD_SER_T = { Q277759: 1, Q1667921: 1, Q14406742: 1 };
/* provata sul servizio vero il 18/11/2026 (1-5 secondi): i tipi con FILTER e l'ordine scritto (con VALUES il servizio partiva da tutti i libri del mondo: 27 secondi) */
function wdWorksQuery(qid) {
  return 'SELECT ?w ?wLabel ?it ?d ?t WHERE { hint:Query hint:optimizer "None". ?w wdt:P50 wd:' + qid + '. ?w wdt:P31 ?t. FILTER(?t IN (' + WD_WORK_T + '))' +
    ' OPTIONAL { ?w rdfs:label ?it. FILTER(LANG(?it) = "it") } OPTIONAL { ?w wdt:P577 ?d. }' +
    ' SERVICE wikibase:label { bd:serviceParam wikibase:language "it,mul,en,fr,es,de". } } LIMIT 2000';
}
function wdParseWorks(rows) {
  var m = {};
  rows.forEach(function (r) {
    var w = wdQ(r.w), t = L.str(r.it || r.wLabel).trim().replace(/\s+\([^()]*\)$/, '');   // «Guns. Contro le armi (saggio)» → senza la parentesi
    if (!w || !t || /^Q\d+$/.test(t)) return;
    var x = m[w] || (m[w] = { q: w, t: t.slice(0, 200), y: 0, it: !!r.it, ser: 0 });
    var y = wdYear(r.d); if (y && (!x.y || y < x.y)) x.y = y;
    if (WD_SER_T[wdQ(r.t)]) x.ser = 1;
  });
  var seen = {}, out = [];
  Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return (b.it - a.it) || (a.y || 9999) - (b.y || 9999); }).forEach(function (x) {
    var k = L.titleKey(x.t); if (!k || seen[k]) return;   // la stessa opera scritta due volte: resta quella con il titolo italiano
    seen[k] = 1; x.k = k; out.push(x);
  });
  /* prima le opere con il titolo in italiano, in ordine di anno; poi quelle che Wikidata ha solo con il titolo originale (spesso racconti o saggi non tradotti) */
  return out.sort(function (a, b) { return (b.it - a.it) || (a.y || 9999) - (b.y || 9999) || coll.compare(a.t, b.t); }).slice(0, 300);
}
var wo = { name: '', qid: '', dest: 'wish', items: null, seq: 0, plus: false, back: false, cache: {}, pend: null, added: {} };
function woPaintDest() {
  Array.prototype.forEach.call(document.querySelectorAll('#woDest [data-dest]'), function (b) { b.setAttribute('aria-selected', b.dataset.dest === wo.dest ? 'true' : 'false'); });
}
function woHave(x) {                                      // ce l'hai gia'? stesso titolo tra i tuoi libri di quell'autore
  var ak = wo.name ? auKey(wo.name) : '', hit = null;
  myBooks().forEach(function (b) {
    if (hit && !hit.w) return;
    if (L.titleKey(b.t) !== x.k || b.xs) return;
    if (ak && authorsOf(b).length && !authorsOf(b).some(function (n) { return auKey(n) === ak; })) return;
    hit = b;
  });
  if (!hit && wo.added[x.q]) hit = myBooks().find(function (b) { return b.id === wo.added[x.q]; }) || null;   // aggiunta poco fa con un altro titolo (l'edizione italiana)
  return hit;
}
function woPaint() {
  var list = $('#woList'), items = wo.items || [];
  $('#woDest').hidden = !items.length; $('#woSrc').hidden = !items.length;
  woPaintDest();
  list.innerHTML = items.map(function (x, i) {
    var have = woHave(x), sub = [x.y || '', x.ser ? 'serie' : '', x.it ? '' : 'titolo originale'].filter(Boolean).join(' · ');
    return '<li><button type="button" class="wo-row' + (have ? ' have' : '') + '" data-wo="' + i + '"><span class="wo-t"><b>' + esc(x.t) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>' +
      (have ? '<span class="tag ' + (have.w ? 'loan' : 'warn') + '">' + (have.w ? 'Nei Desideri' : 'Ce l\'hai') + '</span>' : '<span class="wo-go" aria-hidden="true">+</span>') + '</button></li>';
  }).join('');
}
async function woLoad(name, qid) {
  var my = ++wo.seq;
  wo.name = name; wo.qid = qid; wo.items = null;
  $('#woH').textContent = 'Opere di ' + name;
  $('#woList').innerHTML = ''; $('#woDest').hidden = true; $('#woSrc').hidden = true;
  $('#woMsg').innerHTML = '<span class="spin" aria-hidden="true"></span>Cerco le opere…'; $('#woMsg').hidden = false;
  if (navigator.onLine === false) { $('#woMsg').textContent = 'Senza connessione: le opere si cercano online.'; return; }
  try {
    var items = wo.cache[qid] || wdParseWorks(wdRows(await wdAsk(wdWorksQuery(qid))));
    if (my !== wo.seq) return;
    wo.cache[qid] = items; wo.items = items;
    $('#woMsg').textContent = items.length ? 'Tocca un\'opera: cerco le edizioni e scegli quella giusta.' : 'Wikidata non ha un elenco delle opere di questo autore. Prova con «Digita» e il titolo.';
    woPaint();
  } catch (e) {
    if (my === wo.seq) $('#woMsg').textContent = 'Connessione debole: non sono riuscito a cercare le opere. Riprova tra poco.';
  }
}
/* dal + : si scrive il nome, la voce si trova come in Info Autore */
async function woFind(text) {
  var name = String(text || '').replace(/\s+/g, ' ').trim(), my = ++wo.seq;
  if (name.length < 3) { $('#woMsg').textContent = 'Scrivi il nome dell\'autore.'; $('#woMsg').hidden = false; return; }
  $('#woList').innerHTML = ''; $('#woDest').hidden = true; $('#woSrc').hidden = true; wo.items = null;
  $('#woMsg').innerHTML = '<span class="spin" aria-hidden="true"></span>Cerco «' + esc(name) + '»…'; $('#woMsg').hidden = false;
  if (navigator.onLine === false) { $('#woMsg').textContent = 'Senza connessione: gli autori si cercano online.'; return; }
  try {
    var r = await auLookup(name);
    if (my !== wo.seq) return;
    if (!r || r.none || !r.qid) { $('#woMsg').textContent = 'Non ho trovato «' + name + '» su Wikipedia. Controlla il nome, o usa «Digita» con il titolo.'; return; }
    woLoad(r.title.replace(/\s*\([^)]*\)\s*$/, '') || name, r.qid);
  } catch (e) {
    if (my === wo.seq) $('#woMsg').textContent = 'Connessione debole: non sono riuscito a cercare. Riprova tra poco.';
  }
}
function openWorks(name, qid, fromPlus) {
  wo.plus = !!fromPlus; wo.back = false; wo.seq++;
  wo.dest = fromPlus ? (tab === 'wish' ? 'wish' : 'lib') : 'wish';   // da Info Autore si parte dai Desideri (scelta di Piero, 18/11/2026)
  $('#woFind').hidden = !fromPlus;
  $('#woSheet').hidden = false;
  if (fromPlus) {
    wo.name = ''; wo.qid = ''; wo.items = null;
    $('#woH').textContent = 'Cerca per autore'; $('#woQ').value = '';
    $('#woList').innerHTML = ''; $('#woDest').hidden = true; $('#woSrc').hidden = true;
    $('#woMsg').textContent = 'Scrivi il nome di un autore: ti mostro le sue opere, con segnate quelle che hai già.'; $('#woMsg').hidden = false;
    setTimeout(function () { try { $('#woQ').focus(); } catch (e) { nlErr(e); } }, 50);
  } else woLoad(name, qid);
}
function closeWorks() { $('#woSheet').hidden = true; wo.back = false; wo.seq++; }
function woPick(i) {
  var x = wo.items && wo.items[i]; if (!x) return;
  var have = woHave(x);
  if (have) { closeWorks(); if (!$('#auSheet').hidden) closeAuthor(); showBook(have.id); return; }
  if (guest) guestExit(true);                            // si aggiunge sempre alla tua libreria
  if (!$('#auSheet').hidden) closeAuthor();
  if (tab !== wo.dest) setTab(wo.dest);
  var text = x.t + (wo.name ? ' ' + wo.name : '');
  wo.pend = { q: x.q, t: x.t, a: wo.name, text: text, ids: myBooks().map(function (b) { return b.id; }) };
  wo.back = true; $('#woSheet').hidden = true;            // la ricerca delle edizioni e' la solita «Titolo o ISBN»; chiusa quella si torna alle opere
  openIsbnSheet(); $('#isbnText').value = text; searchTitle(text);
}
/* «Aggiungi solo…, senza cercare» dalle opere: titolo e autore nei loro campi */
function woAsIs(text) { var pd = wo.back && wo.pend; return pd && pd.text === text ? { t: pd.t.slice(0, 300), a: L.str(pd.a).slice(0, 200) } : null; }
$('#woClose').addEventListener('click', closeWorks);
$('#woFind').addEventListener('submit', function (e) { e.preventDefault(); woFind($('#woQ').value); });
$('#woDest').addEventListener('click', function (e) { var b = e.target.closest('[data-dest]'); if (!b) return; wo.dest = b.dataset.dest === 'lib' ? 'lib' : 'wish'; woPaintDest(); });
$('#woList').addEventListener('click', function (e) { var b = e.target.closest('[data-wo]'); if (b) woPick(+b.dataset.wo); });
$('#auWorks').addEventListener('click', function () {
  if (!auNow) return;
  var r = auCache[auNow.name];
  if (r && r.qid) openWorks(auCanon(auNow.name), r.qid, false);
});
if (window.MutationObserver) new MutationObserver(function () {     // chiusa «Titolo o ISBN» (libro scelto o Annulla): tornano le opere, con i segni aggiornati
  if (!$('#isbnSheet').hidden || !wo.back) return;
  var pd = wo.pend; wo.pend = null; wo.back = false;
  if (pd) { var nb = myBooks().filter(function (b) { return pd.ids.indexOf(b.id) < 0; })[0]; if (nb) wo.added[pd.q] = nb.id; }   // il libro entrato adesso e' quell'opera
  $('#woSheet').hidden = false; woPaint();
}).observe($('#isbnSheet'), { attributes: true, attributeFilter: ['hidden'] });

/* le altre parti e i moduli (layout.js, wrap.js) */
(hooks.list || (hooks.list = [])).push(function () { wdKick(); });
