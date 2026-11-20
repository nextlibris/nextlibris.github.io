/* Next Libris · app, parte 6 di 10 (app-elenco.js): elenco e copertine: righe, prestiti, Raggruppa per, foto degli autori.
   Dal 17/11/2026 app.js è diviso in 10 file (prima era una sola funzione). Sono script classici, senza import:
   le funzioni e le variabili di primo livello sono globali e servono a tutte le parti; l'ordine in index.html
   e in SHELL di sw.js conta (app.js, app-aggiungi.js, …, app-avvio.js: l'ultima fa partire l'app). */
'use strict';
/* stato di lettura, voto e data (solo Libreria) */
var MESI_IT = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
function rdLong(v) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ''); return m ? (+m[3]) + ' ' + MESI_IT[+m[2] - 1] + ' ' + m[1] : 'aggiungi la data'; }   // «10 febbraio 2026»
function ppHTML(b, d) {                            // «Sono a pagina [212] di 624 · 34%», con la barra
  var q = ppInfo(b);
  return '<div class="pp"><svg class="pp-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5h10a1 1 0 0 1 1 1v16l-6-4-6 4v-16a1 1 0 0 1 1-1z"/></svg>' +
    (guest ? '<span class="pp-l">' + (q.p ? 'È a pagina ' + q.p : 'Lo sta leggendo') + '</span>' :   // libro di un amico: solo da leggere
    '<label class="pp-l">Sono a pagina <input type="text" inputmode="numeric" pattern="[0-9]*" data-k="pp" value="' + (q.p || '') + '" placeholder="…" maxlength="5" aria-label="Pagina a cui sei arrivato"' + d + '></label>') +
    (q.tot ? '<span class="pp-of">di ' + q.tot + '</span><span class="pp-pct">' + (q.pct != null ? q.pct + '%' : '') + '</span>' : '') +
    (q.tot ? '<span class="pp-bar" aria-hidden="true"><i style="width:' + (q.pct || 0) + '%"></i></span>' : '') + '</div>';
}
var RD_CAL = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M16 3v4M8 3v4M4 11h16"/></svg>';
var RATE_BOOK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="pg" d="M3 6a9 9 0 0 1 9 0v13a9 9 0 0 0-9 0z"/><path class="pg" d="M12 6a9 9 0 0 1 9 0v13a9 9 0 0 0-9 0z"/></svg>';   // libro aperto (Piero: «era più bella l'icona con il libro aperto»)
function readHTML(b, off) {
  if (b.w) return '';
  if (guest && !esempio()) {                       // libro di un amico: una frase al posto dei tasti; niente se non l'ha segnato (Piero, 17/11/2026 sera)
    if (b.rs !== 'in' && b.rs !== 'ok') return '';
    var who = esc(guest.name), bits = [];
    if (b.rs === 'ok' && b.rd) bits.push('il ' + esc(rdLong(b.rd)));
    if (b.rt) bits.push('«' + esc(L.rateWord(b.rt)) + '»');
    return '<div class="read g-read"><p class="g-rs"><b>' + who + (b.rs === 'in' ? ' lo sta leggendo' : ' l\'ha letto') + '</b>' + (bits.length ? ' · ' + bits.join(' · ') : '') + '</p>' +
      (b.rs === 'in' ? ppHTML(b, ' disabled') : '') + '</div>';
  }
  var d = off ? ' disabled' : '';
  var seg = [['da', 'Da leggere'], ['in', 'In lettura'], ['ok', 'Letto']].map(function (x) {
    return '<button type="button" data-act="rs" data-v="' + x[0] + '" aria-pressed="' + (b.rs === x[0]) + '"' + d + '>' + x[1] + '</button>';
  }).join('');
  /* il voto: cinque libricini, con la parola sotto o accanto (Piero, 16/11/2026: le stelle si confondevano con il preferito) */
  var stars = [1, 2, 3, 4, 5].map(function (n) {
    return '<button type="button" class="star bk' + (b.rt >= n ? ' on' : '') + '" data-act="rt" data-v="' + n + '" role="radio" aria-checked="' + (b.rt === n) + '" aria-label="' + n + (n === 1 ? ' libricino' : ' libricini') + ': ' + L.rateWord(n) + '"' + d + '>' + RATE_BOOK + '</button>';
  }).join('');
  return '<div class="read"><span class="lbl">Lettura</span><div class="seg" role="group" aria-label="Stato di lettura">' + seg + '</div>' +
    (b.rs === 'in' ? ppHTML(b, d) : '') +
    '<div class="rate"><div class="stars" role="radiogroup" aria-label="Voto">' + stars + '</div><span class="rt-word' + (b.rt ? '' : ' none') + '">' + (b.rt ? L.rateWord(b.rt) : guest ? 'Senza voto' : 'Dai un voto') + '</span></div>' +
    (b.rs === 'ok' ? '<label class="f f-rd"><span class="lbl">Letto il</span><span class="rd-show' + (b.rd ? '' : ' none') + '">' + esc(rdLong(b.rd)) + RD_CAL + '</span><input type="date" data-k="rd" id="rd-' + b.id + '" value="' + esc(b.rd || '') + '"' + d + '></label>' : '') + '</div>';
}
/* «Tutti i libri di …» se dello stesso autore ce ne sono altri */
function authorLinkHTML(b, ex) {
  if (ex || !hasData(b)) return '';
  var out = '';
  if (!b.w && (b.t || L.toIsbn13(b.i))) out += '<button type="button" class="link" data-act="addcopy">+ Aggiungi un\'altra copia</button>';
  return out ? '<div class="links">' + out + '</div>' : '';
}
var FACET_ICON = { a: 'user', e: 'pub', gen: 'tag', sh: 'shelf' };
var FACET_WORD = { a: 'Autore', e: 'Casa editrice', gen: 'Genere', sh: 'Scaffale', pa: 'Paese' };
function facetsHTML(b, ex) {
  if (ex || !hasData(b)) return '';
  var books = tabBooks(), out = [];
  function chip(f, key, label, n) {
    out.push('<button type="button" class="fchip" data-act="facet" data-f="' + f + '" data-v="' + esc(key) + '" data-name="' + esc(label) + '" title="Mostra tutti i ' + n + ' libri: ' + esc(FACET_WORD[f].toLowerCase() + ' ' + label) + '">' +
      icon(FACET_ICON[f]) + '<span class="fl">' + esc(label) + '</span><span class="n">' + n + '</span></button>');
  }
  if (b.g.indexOf('a') < 0) authorsOf(b).slice(0, 3).forEach(function (name) {
    var k = auKey(name);                                  // autori con nomi simili contano insieme (giro 1)
    var n = books.filter(function (x) { return authorsOf(x).some(function (y) { return auKey(y) === k; }); }).length;
    if (n > 1) chip('a', k, name, n);
  });
  [['e', b.g.indexOf('e') < 0], ['gen', true], ['sh', true]].forEach(function (p) {
    var f = p[0], v = String(b[f] || '').trim();
    if (!p[1] || !v) return;
    var k = facetKey(v), n = books.filter(function (x) { return facetKey(x[f]) === k; }).length;
    if (n > 1) chip(f, k, v, n);
  });
  return out.length ? '<div class="facets"><span class="facets-h">' + icon('filt') + 'Vedi tutti i libri di</span><div class="fchips">' + out.join('') + '</div></div>' : '';
}
function applyFacet(f, key, name) {
  flt = ''; readFlt = ''; shFlt = ''; genFlt = ''; autFlt = ''; autName = ''; edFlt = ''; frFlt = ''; paFlt = '';
  q = ''; $('#q').value = '';
  collapseCards();
  if (f === 'a') { autFlt = key; autName = auCanon(name); }
  else if (f === 'e') edFlt = key;
  else if (f === 'gen') genFlt = key;
  else if (f === 'sh') shFlt = key;
  else if (f === 'pa') paFlt = key;                    // paese dell'autore, dalle statistiche (giro 2)
  renderList(); updateSummary();
  window.scrollTo(0, 0); setTimeout(function () { window.scrollTo(0, 0); }, 60); setTimeout(function () { window.scrollTo(0, 0); }, 300);   // anche dopo l'Indietro che chiude la scheda
  var n = visible().length;
  toast((f === 'a' ? 'Libri di ' : FACET_WORD[f] + ' «') + (f === 'a' ? auShow(autName) : name) + (f === 'a' ? '' : '»') + ': ' + n + '. Per tornare a tutti, tocca la × del filtro sotto la ricerca.');
}
function dupTag(v) {
  if (v === 'dup') return '<span class="tag tap" data-act="dup" role="button" tabindex="0" title="Un altro libro nell\'elenco ha lo stesso ISBN o lo stesso titolo e autore: tocca per decidere">Doppione?</span>';
  if (v > 1) return '<span class="tag copies tap" data-act="dup" role="button" tabindex="0" title="Hai più copie di questo libro">' + v + ' copie</span>';
  return '';
}
function bar(txt, extra) { return '<div class="status"><span class="bar"></span><span class="txt">' + esc(txt) + '</span>' + (extra || '') + '</div>'; }
function rowHTML(b, dups, ex) {
  var s = S[b.id] || {}, st = s.st;
  var busy = st === 'queued' || st === 'reading' || st === 'lookup' || st === 'search';
  var fresh = st && !hasData(b);
  var dis = (busy || ex) ? ' disabled' : '';
  var imgSrc = smallImg(b);
  var canShoot = !ex && !busy && !imgSrc && hasData(b);
  var hasThumb = !!imgSrc || (!!st && !ex) || canShoot;
  var cls = 'row' + (busy ? ' busy' : '') + (st === 'error' ? ' bad' : '') + (hasThumb ? ' has-thumb' : '') + (ex ? ' ex' : '') + (b.xs ? ' gone' : '');
  function fieldTitle(k) { return b.g.indexOf(k) >= 0 ? ' title="Da verificare"' : ''; }
  function ta(k, label, val, ph) {
    if (k === 'a' && !dis && String(val || '').trim() && !auEditing[b.id]) {     // autore compilato: nomi da toccare (profilo) e matita per modificare
      var names = authorsOf(b);
      return '<div class="f f-a au-view' + (b.g.indexOf('a') >= 0 ? ' is-guess' : '') + '"' + fieldTitle('a') + '><span class="lbl">Autore</span><span class="au-names">' +
        names.map(function (n) { return '<button type="button" class="au-name" data-act="auinfo" data-n="' + esc(n) + '" title="Info Autore: ' + esc(n) + '">' + esc(n) + '</button>'; }).join('<span class="au-sep">, </span>') +
        '</span><button type="button" class="ico au-edit" data-act="auedit" aria-label="Modifica l\'autore" title="Modifica l\'autore">' + icon('pen') + '</button></div>';
    }
    return '<label class="f f-' + k + (b.g.indexOf(k) >= 0 ? ' is-guess' : '') + '"' + fieldTitle(k) + '><span class="lbl">' + label + '</span>' +
      '<textarea id="' + k + '-' + b.id + '" data-k="' + k + '" rows="1" spellcheck="false" enterkeyhint="done" placeholder="' + ph + '"' + dis + '>' + esc(val) + '</textarea></label>';
  }
  function inp(k, label, val, mode, ph, max, listId) {
    return '<label class="f f-' + k + (b.g.indexOf(k) >= 0 ? ' is-guess' : '') + '"' + fieldTitle(k) + '><span class="lbl">' + label + '</span>' +
      '<input id="' + k + '-' + b.id + '" data-k="' + k + '" inputmode="' + mode + '" enterkeyhint="done" autocomplete="off" placeholder="' + ph + '"' + (max ? ' maxlength="' + max + '"' : '') + (listId ? ' list="' + listId + '"' : '') + ' value="' + esc(val) + '"' + dis + '></label>';
  }
  var status = '';
  /* libro senza dati (foto della copertina, ISBN non trovato…): titolo e autore si possono scrivere a mano subito, anche mentre cerca */
  var man = st && !ex && !b.t && !b.i ? '<button class="btn man" data-act="manual">Scrivi a mano</button>' : '';
  if (st === 'queued') status = bar('In coda…', man);
  else if (st === 'reading') status = bar(s.msg || 'Leggo la foto…', man);
  else if (st === 'lookup') status = bar('Cerco nelle banche dati…', man);
  else if (st === 'search') status = bar('Cerco il libro…', man);
  else if (st === 'choose') status = '<div class="status"><span class="txt">Trovate ' + ((s.cands || []).length) + ' possibili edizioni.</span><button class="btn primary" data-act="choose">Scegli</button>' + man + '</div>';
  else if (st === 'nf') status = '<div class="status nf" role="alert"><span class="txt">Non ho trovato questo libro online.</span><button class="btn primary man" data-act="manual">Scrivi titolo e autore</button>' +
    ((s.lines || []).length ? '<button class="btn" data-act="ocrtext">Usa il testo letto</button>' : '') + '</div>';
  else if (st === 'wait') status = '<div class="status wait"><span class="txt">' + esc(s.err || 'In attesa della rete.') + '</span><button class="btn" data-act="retry">Riprova ora</button>' + man + '</div>';
  else if (st === 'error') status = '<div class="status err" role="alert"><span class="txt">' + esc(s.err || 'Operazione non riuscita.') + '</span>' + (s.retry ? '<button class="btn" data-act="retry">Riprova</button>' : '') + man.replace('class="btn man"', 'class="btn primary man"') + '</div>';

  var thumb = canShoot
    ? (covSearching[b.id]
      ? '<span class="thumb add busy" role="status" title="Cerco la copertina…"><span class="spin" aria-hidden="true"></span><span class="tl">Cerco…</span></span>'
      : '<button class="thumb add" data-act="coverphoto" title="Cerca la copertina online; se non c\'è, la fotografi">' + icon('cam') + '<span class="tl">Copertina</span></button>')
    : '<div class="thumb' + (hasThumb ? '' : ' empty') + (imgSrc && !ex ? ' zoom" data-act="zoom" role="button" tabindex="0" title="Ingrandisci la copertina' : '') + '">' + (imgSrc ? '<img src="' + esc(imgSrc) + '" alt="" referrerpolicy="no-referrer">' : '') + '</div>';
  var body;
  if (fresh) {
    cls += ' fresh';
    var acts = (st === 'error' || st === 'choose' || st === 'nf') ? '<div class="tail"><button class="ico act danger" data-act="del" title="Elimina il libro" aria-label="Elimina il libro">' + icon('x') + '<span class="al" aria-hidden="true">Elimina</span></button></div>' : '';
    return '<article class="' + cls + '" data-id="' + b.id + '">' + (hasThumb ? thumb : '') + status + acts + '</article>';
  } else {
    if (!ex && !isOpen(b)) return summaryHTML(b, dups, status);
    var canLookup = !busy && !ex && !b.t && L.toIsbn13(b.i);
    var openCard = !ex && !settings.openAll;
    if (openCard) cls += ' open has-top';
    /* azioni principali: in alto accanto alla freccetta (scheda aperta), in fondo nelle schede sempre aperte */
    var stateOn = !!(b.p || b.xs);
    /* azioni con icona e scritta, tutte nello stesso stile; la × (elimina) e la freccetta (chiudi) restano solo icona */
    function act(a, ic, label, title, cls) { return '<button class="ico act' + (cls || '') + '" data-act="' + a + '" title="' + esc(title) + '" aria-label="' + esc(title) + '">' + icon(ic) + '<span class="al" aria-hidden="true">' + esc(label) + '</span></button>'; }
    var stateLabel = b.xs ? (L.GONE_LABEL[b.xs] || 'Non più qui') : b.p ? 'Prestato' : 'Presta, vendi o regala';
    var loanBtn = (!busy && hasData(b) && (openCard || !stateOn))           // anche nei Desideri (Piero, 16/11/2026)
      ? act('loan', 'loan', stateLabel, stateOn ? (b.xs ? goneText(b) : loanText(b)) + ': tocca per cambiare' : 'Presta, vendi o regala il libro', stateOn ? ' on' : '') : '';
    var delBtn = act('del', 'x', 'Elimina', 'Elimina il libro', ' danger');
    var moveBtn = !busy && hasData(b) ? (b.w
      ? act('tolib', 'tolib', 'Libreria', 'Sposta in Libreria (l\'ho comprato)', ' move')
      : act('towish', 'towish', 'Desideri', 'Sposta nei Desideri', ' move')) : '';
    var favBtn = !busy && hasData(b) && !b.w ? act('lc', 'fav', 'Lo consiglio', b.lc ? 'Lo consigli: tocca per toglierlo' : 'Lo consiglio: gli amici lo vedono nel tuo profilo', b.lc ? ' fav on' : ' fav') : '';   // giro 10: la stella è «Lo consiglio», via la coccarda
    var lcBtn = '';
    var kdp = kdpHint(b, busy);                  // pubblicazione Amazon non trovata: «Cerca sul web» sta nel suo riquadro
    var webBtn = !kdp && !busy && (b.t || b.i) ? act('websearch', 'search', 'Cerca sul web', 'Cerca questo libro su Google: prezzo, recensioni, dove comprarlo') : '';
    var shareBtn = !busy && (b.t || L.toIsbn13(b.i)) ? act('share', 'share', 'Condividi', 'Manda questo libro a un amico') : '';
    var moreActs = shareBtn + (canLookup ? act('lookup', 'redo', 'Cerca di nuovo', 'Cerca di nuovo nelle banche dati') : '') +



        '';
    body = (openCard ? '<div class="card-top"><span class="top-acts"><span class="acts-main">' + loanBtn + moveBtn + favBtn + lcBtn + webBtn + delBtn + '</span><span class="acts-win">' +
        '<button class="chev-btn" data-act="toggle" aria-expanded="true" aria-label="Chiudi la scheda" title="Chiudi la scheda">' + icon('chev') + '</button></span></span>' +
        '<span class="flags">' + flagsHTML(b, dups) + '</span></div>' + kdp : '') +
      '<div class="head">' + thumb + ta('t', 'Titolo', b.t, 'Titolo') + ta('a', 'Autore', b.a, 'Autore') + '</div>' +
      '<div class="meta">' + ta('e', 'Casa editrice', b.e, 'Casa editrice') + inp('y', 'Anno', b.y, 'numeric', 'Anno', 4) + inp('c', 'Costo €', b.c == null ? '' : L.fmtNum(b.c), 'decimal', '—') + '</div>' +
      (settings.extra ? '<div class="more">' + inp('sh', 'Scaffale', b.sh || '', 'text', 'Scaffale', 80) + inp('gen', 'Genere', b.gen || '', 'text', 'Genere', 80) +
        inp('pg', 'Pagine', b.pg || '', 'numeric', 'Pagine', 5) + ta('n', 'Note', b.n || '', 'Note') + '</div>' +
        '<div class="ser">' + inp('se', 'Serie o collana', b.se || '', 'text', 'Serie o collana', 80) + inp('sn', 'Volume', b.sn || '', 'numeric', 'N.', 3) + inp('sq', 'di', b.sq || '', 'numeric', 'Totale', 3) + '</div>' : '') +
      seriesHTML(b, ex || busy) + facetsHTML(b, ex || busy) + descHTML(b, ex || busy) + filmHTML(b, ex || busy) + quotesHTML(b, ex || busy) + readHTML(b, ex || busy) + authorLinkHTML(b, ex) +
      '<div class="foot">' + inp('i', 'ISBN', b.i, 'numeric', 'ISBN', 13) +
      (openCard ? (moreActs ? '<div class="tail">' + moreActs + '</div>' : '') :
        '<div class="tail"><span class="flags">' + flagsHTML(b, dups) + '</span>' +
        (ex ? '<span class="tag">Esempio</span>' : moreActs + favBtn + lcBtn + moveBtn + loanBtn + delBtn) + '</div>') +
      '</div>';
  }
  return '<article class="' + cls + '" data-id="' + b.id + '"' + (ex ? ' data-ex="1"' : '') + '>' + status + body + '</article>';
}
/* benvenuto della Libreria vuota: i tre modi di aggiungere (toccabili come i tasti in basso) e il ripristino da backup */
function emptyHTML() {
  function way(act, ic, html) { return '<li><button type="button" class="way" data-act="' + act + '"><span class="way-i" aria-hidden="true">' + icon(ic) + '</span><span class="way-t">' + html + '</span></button></li>'; }
  return '<section class="empty welcome"><h2>Aggiungi il primo libro</h2>' +
    '<p class="lead">Di solito basta il codice a barre sul retro: titolo, autore, editore e anno si compilano da soli.</p>' +
    '<ul class="ways">' +
    way('way-scan', 'scan', '<b>Scansiona</b><small>Inquadra il codice a barre. Se il libro non ce l\'ha, nella fotocamera scegli «ISBN scritto» o «Copertina».</small>') +
    way('way-photo', 'cam', '<b>Foto</b><small>Scatta la copertina o prendila dalla galleria, anche più foto insieme: l\'app le legge e cerca i libri.</small>') +
    way('way-type', 'key', '<b>Digita</b><small>Scrivi l\'ISBN o il titolo e scegli tra i risultati.</small>') +
    '</ul>' +
    '<p class="then">Dopo ogni libro puoi inquadrare il prezzo, scriverlo o saltarlo. Poi tocca un libro per aprire la sua scheda: scaffale, genere, lettura, prestiti e note.</p>' +
    '<label class="who"><span>Come ti chiami? <small>(facoltativo)</small></span><input type="text" id="welcomeName" maxlength="30" autocomplete="given-name" autocapitalize="words" placeholder="es. Piero" value="' + esc(settings.name || '') + '">' +
    '<small>Serve quando mandi un libro o una lista a un amico: vedrà «Piero ti consiglia un libro».</small></label>' +
    '<p class="restore-l">Hai già un backup, da un altro telefono o da prima? <button type="button" class="link" data-act="restore">Ripristinalo</button></p>' +
    '</section>';
}
function wishEmptyHTML() {
  return '<section class="empty"><h2>La lista dei Desideri è vuota</h2>' +
    '<p>Qui metti i libri che vuoi comprare. Mentre sei in questa scheda, <b>Scansiona</b>, <b>Foto</b> e <b>Digita</b> aggiungono i libri ai Desideri invece che alla Libreria.</p>' +
    '<p>Un amico ti consiglia un libro? Cercalo per titolo e aggiungilo qui:</p><p><button class="btn primary" data-act="typeadd">' + icon('search') + 'Cerca per titolo</button></p>' +
    '<p>Quando ne compri uno, nella sua scheda tocca il tasto con i libri e la freccia: passa in Libreria. In negozio usa <b>Ce l\'ho già?</b> per non ricomprare un libro che hai.</p></section>';
}
/* vista copertine */
function hue(s) { var h = 0; s = String(s || ''); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h % 360; }
function ppCov(b) {                               // sotto l'autore: barra sottile e la percentuale in piccolo (la copertina resta libera, Piero 16/11/2026)
  var q = !b.w && b.rs === 'in' ? ppInfo(b) : {};
  return q.pct != null ? '<span class="pp-cov" title="Sei al ' + q.pct + '%"><span class="pp-ln"><i style="width:' + q.pct + '%"></i></span><span class="pp-n">' + q.pct + '%</span></span>' : '';
}
function coverHTML(b) {
  var s = S[b.id] || {}, img = bigImg(b);
  var badge = isBusy(b) ? '<span class="badge">…</span>' : b.p ? '<span class="badge loan">Prestato</span>' : (b.sk === 'p' || b.sk === 'q') && b.sda && !b.xs ? '<span class="badge loan">In prestito</span>' : b.g.length ? '<span class="badge warn">Da verificare</span>' : '';
  var fav = b.fav && !b.w ? '<span class="ribbon fav-star" title="Lo consigli"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.3l2.7 5.5 6 .9-4.35 4.25 1.03 6-5.38-2.83-5.38 2.83 1.03-6L3.3 9.7l6-.9z"/></svg></span>' : '';   // stellina sulla copertina
  return '<button class="cover' + (fav ? ' is-fav' : '') + '" data-id="' + b.id + '" aria-label="' + esc([b.t || 'Senza titolo', b.a, fav ? 'lo consigli' : ''].filter(Boolean).join(', ')) + '">' +
    '<span class="art">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' :
      '<span class="ph" style="--h:' + hue(b.t + b.a + b.i) + '"><b>' + esc(b.t || b.i || 'Senza titolo') + '</b><small>' + esc(b.a) + '</small></span>') + badge + fav + '</span>' +
    '<span class="cap">' + esc(b.t || b.i || '…') + '</span><span class="cap2">' + esc(b.a) + '</span>' + ppCov(b) + '</button>';
}
function autosize(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
function autosizeAll(root) {
  var els = Array.prototype.slice.call(root.querySelectorAll('textarea'));
  els.forEach(function (e) { e.style.height = 'auto'; });
  var hs = els.map(function (e) { return e.scrollHeight; });
  els.forEach(function (e, i) { if (hs[i]) e.style.height = hs[i] + 'px'; });
}
function syncThumbs() {
  var any = state.books.some(function (b) { return !!smallImg(b); });
  document.body.classList.toggle('thumbs', any);
}
function fillDatalists() {
  function opts(k) {
    var seen = {}, out = [];
    state.books.forEach(function (b) { var v = (b[k] || '').trim(); if (v && !seen[v.toLowerCase()]) { seen[v.toLowerCase()] = 1; out.push(v); } });
    return out.sort(coll.compare).map(function (v) { return '<option value="' + esc(v) + '">'; }).join('');
  }
  $('#shelfList').innerHTML = opts('sh');
  $('#genreList').innerHTML = opts('gen');
  $('#loanNames').innerHTML = opts('p');
  $('#seriesList').innerHTML = opts('se');
}
var tGrid = null;
/* Barra in alto (schede, ricerca, filtri, Copertine...) ferma mentre scorri l'elenco compatto;
   se c'e' una scheda aperta torna a scorrere via con la pagina, per lasciare spazio ai campi. */
function updateStick() {
  var open = settings.openAll || !!document.querySelector('#list .row.open');
  document.body.classList.toggle('card-open', open);
  var st = $('#stick');
  if (st) document.documentElement.style.setProperty('--stick-h', (open ? 0 : st.offsetHeight) + 'px');
}
if ('IntersectionObserver' in window) {
  new IntersectionObserver(function (en) {
    var stuck = !en[0].isIntersecting && en[0].boundingClientRect.top < 0;
    $('#stick').classList.toggle('stuck', stuck);
    document.body.classList.toggle('stuck', stuck);
    setTimeout(updateStick, 0);
  }).observe($('#stickSentinel'));
}
window.addEventListener('resize', function () { updateStick(); });
function qxSync() { var x = document.getElementById('qX'); if (x) x.hidden = !$('#q').value; }   // X nella ricerca: visibile solo con del testo (giro 5)
function renderList() {
  clearTimeout(tGrid);
  setTimeout(updateStick, 0);
  qxSync();
  if (scanning) return;
  if (gridGone()) { dropCard(); backToGrid(); return; }   // la vista resta quella scelta dopo ogni azione sul libro (Piero, 17/11/2026)
  donPaint(); nxBoxPaint();
  var list = $('#list');
  syncThumbs();
  fillDatalists();
  var vis = visible(), n = tabBooks().length;
  packN = 0; list.classList.remove('grp-exp');
  document.body.classList.toggle('gridview', settings.view === 'grid');
  document.body.classList.toggle('openall', settings.openAll);
  $('#thead').hidden = n === 0 || settings.view === 'grid' || !settings.openAll;
  document.body.classList.toggle('welcome-on', !n && tab !== 'wish');   // col benvenuto il suggerimento sotto i tasti ripeterebbe le stesse cose
  if (!n && guest) { list.innerHTML = '<p class="none">' + esc((guest.info.empty || {})[tab] || (tab === 'wish' ? 'Nessun desiderio da mostrare.' : 'Nessun libro da mostrare.')) + '</p>'; return; }
  if (!n) { list.innerHTML = tab === 'wish' ? wishEmptyHTML() : emptyHTML(); autosizeAll(list); return; }
  if (!vis.length) {
    var only = !q && activeCount() === 1;
    list.innerHTML = only && flt === 'loan'
      ? '<p class="none">Nessun libro in prestito. Per prestarne uno apri la sua scheda con la freccetta e tocca il tasto con la freccia verso destra.</p>'
      : only && flt === 'gone' ? '<p class="none">Nessun libro venduto o regalato.</p>'
      : '<p class="none">Nessun libro corrisponde ' + (activeCount() ? (q ? 'alla ricerca e ai filtri.' : 'ai filtri.') : 'alla ricerca.') + '</p><p><button class="btn" data-act="clearflt">' + (activeCount() ? (q ? 'Azzera ricerca e filtri' : 'Azzera i filtri') : 'Cancella la ricerca') + '</button></p>';
    return;
  }
  if (flt === 'loan' && tab === 'lib') { renderLoans(list, vis); return; }
  var g = grpMode();
  if (g) { renderGroups(list, vis, g); return; }
  /* i libri «In lettura» in cima, in una sezione che si apre e chiude; sotto gli altri (solo Libreria, ordine «Più recenti», senza ricerca ne' filtri) */
  var now = tab === 'lib' && !q && !activeCount() && sortBy === 'recent' ? vis.filter(function (b) { return b.rs === 'in'; }) : [];   // con un altro ordine (voto, titolo…) vale l'ordine scelto
  var parts = now.length ? [['now', 'In lettura', now], ['all', now.length < vis.length ? 'Gli altri libri' : '', vis.filter(function (b) { return b.rs !== 'in'; })]] : null;
  var shelfOpen = function (k) { return !(settings.shelfShut || {})[k]; };
  var shelf = function (k, title, books, inner) {
    if (!books.length) return '';
    var open = shelfOpen(k);
    return '<section class="shelf shelf-' + k + '"><button type="button" class="shelf-h" data-shelf="' + k + '" aria-expanded="' + open + '" aria-controls="shelf-' + k + '">' +
      (k === 'now' ? '<svg class="sh-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5h10a1 1 0 0 1 1 1v16l-6-4-6 4v-16a1 1 0 0 1 1-1z"/></svg>' : '') +
      '<span>' + esc(title) + '</span><span class="sh-n">' + books.length + '</span><svg class="sh-c" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>' +
      '<div class="shelf-b" id="shelf-' + k + '"' + (open ? '' : ' hidden') + '>' + inner(books) + '</div></section>';
  };
  if (settings.view === 'grid') {
    var gridOf = function (a) { return '<div class="grid">' + a.map(coverHTML).join('') + '</div>'; };
    list.innerHTML = parts ? parts.map(function (x) { return shelf(x[0], x[1], x[2], x[0] === 'now' ? gridOf : packGrid); }).join('') : packGrid(vis);   // serie e copie accorpate, mai in «In lettura» (giro 1)
    gcPlace(list); paintSel(); return;
  }
  var dups = computeDups();
  var rowsOf = function (a) { return a.map(function (b) { return rowHTML(b, dups); }).join(''); };
  var packOf = function (a) { return packRows(a, dups); };
  list.innerHTML = parts ? parts.map(function (x) { return shelf(x[0], x[1], x[2], x[0] === 'now' ? rowsOf : packOf); }).join('') : packOf(vis);
  emit('rows', list);                              // i moduli possono sistemare le schede appena disegnate
  autosizeAll(list);
  paintSel();
}
/* «N in prestito» toccato (Piero, 17/11/2026): «Prestati a» (i tuoi) e «Prestati da» (ricevuti dagli amici), dentro un gruppo per persona;
   sezioni che si aprono e chiudono come «In lettura» (aperte di partenza, se lo ricorda); dentro, dai prestiti piu' vecchi */
function loanKey(n) { return L.norm(n).replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'x'; }
function renderLoans(list, vis) {
  var grid = settings.view === 'grid', dups = grid ? null : computeDups();
  var inner = function (a) { return grid ? '<div class="grid">' + a.map(coverHTML).join('') + '</div>' : a.map(function (b) { return rowHTML(b, dups); }).join(''); };
  var sec = function (k, cls, title, n, body) {
    var open = !(settings.shelfShut || {})[k];
    return '<section class="shelf grp' + cls + ' shelf-' + k + '"><button type="button" class="shelf-h" data-shelf="' + k + '" aria-expanded="' + open + '" aria-controls="shelf-' + k + '">' +
      '<span class="sh-t">' + esc(title) + '</span><span class="sh-n">' + n + '</span><svg class="sh-c" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>' +
      '<div class="shelf-b" id="shelf-' + k + '"' + (open ? '' : ' hidden') + '>' + body + '</div></section>';
  };
  var parts = [['lo-a', 'Prestati a', vis.filter(function (b) { return b.p; }), function (b) { return b.p; }],
    ['lo-da', 'Prestati da', vis.filter(function (b) { return !b.p && b.sda; }), function (b) { return b.sda; }]];
  list.innerHTML = '<div class="loan-groups">' + parts.filter(function (x) { return x[2].length; }).map(function (x) {
    return sec(x[0], '', x[1], x[2].length, groupBy(x[2], x[3], '?').map(function (pp) { return sec(x[0] + '-' + loanKey(pp[1]), ' grp-sub', pp[1], pp[2].length, inner(pp[2])); }).join(''));
  }).join('') + '</div>';
  if (!grid) { emit('rows', list); autosizeAll(list); }
  paintSel();
}
/* ---- Raggruppa per (Piero, 17/11/2026; nuovo modo 17/11 sera): autore, genere, genere e poi autore, lettura; nelle copertine e nell'elenco.
   «In lettura» non si raggruppa mai: resta in cima; si raggruppano solo «Gli altri libri».
   Autore e genere: ogni gruppo e' una copertina (foto dell'autore da Wikipedia, salvata sul telefono; iniziale del genere) con il numero
   di libri; un tocco apre i suoi libri in un riquadro sotto la riga. Genere › Autore: i generi sono sezioni, gli autori copertine.
   In cima «Espandi tutto» (ogni gruppo come sezione aperta) e «Comprimi tutto». Con una ricerca o dei filtri: tutto espanso.
   Dentro un gruppo vale l'ordine scelto. Un libro con piu' autori sta nel gruppo del primo. ---- */
var READ_GRP = [['da', 'Da leggere'], ['ok', 'Letti']];   // «In lettura» sta sempre a parte, in cima
var grpFltShut = '';                                     // «Comprimi tutto» con filtri o ricerca: vale finché non cambiano (17/11/2026 notte)
function fltSig() { return [tab, q, flt, frFlt, readFlt, shFlt, genFlt, autFlt, edFlt, paFlt].join('|'); }
var grpShutX = {};                                       // sezioni chiuse a mano quando e' tutto espanso (solo finche' l'app e' aperta)
function grpMode() {
  var g = settings.grp || '';
  if (g === 'read' && tab === 'wish') return '';           // nei Desideri la lettura non c'e'
  return g;
}
function auShow(name) { return settings.auInv && name ? L.authorInv(name, settings.auCut) : name; }   // «Neruda, Pablo» nei gruppi e nei filtri
function groupBy(books, keyOf, none, sk) {                 // [[chiave, nome, libri]] in ordine alfabetico (sk: chiave d'ordine), «senza» in fondo
  var m = {}, order = [];
  books.forEach(function (b) {
    var name = keyOf(b), k = name ? L.norm(name) : '';
    if (!m[k]) { m[k] = { name: name || none, books: [] }; order.push(k); }
    m[k].books.push(b);
  });
  order.sort(function (a, b) { return !a ? 1 : !b ? -1 : sk ? coll.compare(sk(m[a].name), sk(m[b].name)) : coll.compare(m[a].name, m[b].name); });
  return order.map(function (k) { return [k || '~', m[k].name, m[k].books]; });
}
/* ---- autori con nomi molto simili (giro 1, 18/11/2026; scelta di Piero): uniti SOLO nei gruppi, nei filtri e nelle copertine degli autori,
   con il nome che ha la foto (se nessuno: il piu' usato, poi il piu' lungo); i libri restano come sono scritti.
   Stesso cognome e: nome uguale a meno di accenti, maiuscole e punti («Umberto  Eco», «umberto eco»), oppure iniziali
   che corrispondono a un solo nome intero («U. Eco» con «Umberto Eco»; se ci sono «Umberto Eco» e «Ugo Eco», «U. Eco» resta da solo). ---- */
var auAl = { st: '', m: {} };
function auSig(name) {
  var p = L.authorParts(name, settings.auCut[L.norm(name)]), clean = function (x) { return L.norm(x).replace(/[^a-z0-9]+/g, ' ').trim(); };
  var giv = clean(p.sur ? p.given : '');
  return { sur: clean(p.sur || p.name), giv: giv ? giv.split(' ') : [] };
}
function auIni(g) { return g.length && g.some(function (w) { return w.length === 1; }); }
function auFits(ini, full) {                             // «u» con «umberto», «j r r» con «john ronald reuel»
  return ini.length === full.length && ini.every(function (w, i) { return w === full[i] || (w.length === 1 && full[i].charAt(0) === w); });
}
function auAlias() {
  var st = state.books.length + ':' + state.updated + ':' + (guest ? guest.name : '');
  if (auAl.st === st) return auAl.m;
  var cnt = {}, names = {}, bySur = {}, m = {};
  state.books.forEach(function (b) { authorsOf(b).forEach(function (n) { var k = L.norm(n); cnt[k] = (cnt[k] || 0) + 1; if (!names[k]) names[k] = n; }); });
  Object.keys(names).forEach(function (k) { var sg = auSig(names[k]); if (sg.sur) (bySur[sg.sur] = bySur[sg.sur] || []).push({ k: k, g: sg.giv }); });
  Object.keys(bySur).forEach(function (sur) {
    var arr = bySur[sur]; if (arr.length < 2) return;
    var cl = {};                                         // gruppi per nome intero uguale (senza accenti, punti, maiuscole)
    arr.forEach(function (x) { if (!auIni(x.g)) (cl[x.g.join(' ')] = cl[x.g.join(' ')] || []).push(x.k); });
    arr.forEach(function (x) {                           // le iniziali vanno con l'unico nome intero che corrisponde
      if (!auIni(x.g)) return;
      var ok = Object.keys(cl).filter(function (g) { return g && auFits(x.g, g.split(' ')); });
      if (ok.length === 1) cl[ok[0]].push(x.k);
    });
    Object.keys(cl).forEach(function (g) {
      var ks = cl[g]; if (ks.length < 2) return;
      var best = ks.slice().sort(function (a, b) { return (aufGet(names[b]) ? 1 : 0) - (aufGet(names[a]) ? 1 : 0) || cnt[b] - cnt[a] || names[b].length - names[a].length; })[0];
      ks.forEach(function (k) { m[k] = names[best]; });
    });
  });
  auAl = { st: st, m: m };
  return m;
}
function auCanon(n) { return auAlias()[L.norm(n)] || n; }
function auKey(n) { return L.norm(auCanon(n)); }
/* ---- serie e copie accorpate (giro 1, 18/11/2026; scelte di Piero) ----
   Serie (almeno 2 volumi): sempre raggruppate, nelle copertine e nell'elenco: la copertina del primo volume con il bollino del numero;
   un tocco apre i volumi in ordine di numero. Nell'elenco una riga «Serie: … · N volumi» che si apre.
   Copie dello stesso libro (stesso titolo e autore, anche edizioni diverse): una copertina sola con il bollino e «N copie».
   Mai in «In lettura»; con una ricerca o dei filtri i libri si vedono uno per uno. Si aprono e chiudono come i gruppi (settings.grpOpen). ---- */
var packN = 0;
function packOn() { return !q && !activeCount(); }   // anche durante la selezione: niente salti sotto il dito; la pila si apre per scegliere i libri
function volNum(b) { var n = parseFloat(String(b.sn || '').replace(',', '.')); return isNaN(n) ? 1e9 : n; }
function packItems(a) {
  if (!packOn() || a.length < 2) return a;
  var ser = {}, cop = {}, done = {}, out = [];
  var sk = function (b) { var k = L.serKey(b.se); return k && ser[k] && ser[k].length > 1 ? k : ''; };
  var ck = function (b) { var t = L.titleKey(b.t); return t ? t + '|' + auKey(authorsOf(b)[0] || '') : ''; };
  a.forEach(function (b) { var k = L.serKey(b.se); if (k) (ser[k] = ser[k] || []).push(b); });
  a.forEach(function (b) { if (sk(b)) return; var k = ck(b); if (k) (cop[k] = cop[k] || []).push(b); });
  a.forEach(function (b) {
    var k = sk(b);
    if (k) {
      if (!done['s' + k]) { done['s' + k] = 1; var vs = ser[k].slice().sort(function (x, y) { return volNum(x) - volNum(y) || coll.compare(L.sortKeyTitle(x.t) || '~', L.sortKeyTitle(y.t) || '~'); }); out.push({ pk: 'ser', key: k, name: L.str(vs[0].se).trim().replace(/\s+/g, ' '), books: vs }); }
      return;
    }
    k = ck(b);
    if (k && cop[k].length > 1) { if (!done['c' + k]) { done['c' + k] = 1; out.push({ pk: 'cop', key: k, name: b.t, books: cop[k] }); } return; }
    out.push(b);
  });
  return out;
}
function packGk(x) { return 'p:' + tab + ':' + x.pk + ':' + x.key; }
function packCount(x) { var n = x.books.length; return x.pk === 'ser' ? n + ' volumi' : n + ' copie'; }
function packLab(x) { return x.pk === 'ser' ? 'Serie: ' + x.name : x.name; }
function packOpen(x) { return !!settings.grpOpen[packGk(x)] || x.books.some(function (b) { return openState[b.id] && b.t; }); }
function packHead(x, id, open) {
  return '<div class="gpanel pk-panel" id="' + id + '"' + (open ? '' : ' hidden') + '><div class="gp-h"><b>' + esc(packLab(x)) + '</b><small>' + packCount(x) + '</small><span class="gp-sp"></span>' +
    '<button type="button" class="ico gp-x" data-gk="' + esc(packGk(x)) + '" aria-label="Chiudi">×</button></div>';
}
function packAria(x, id, open) { return ' data-gk="' + esc(packGk(x)) + '" data-pk="' + x.pk + '" aria-expanded="' + open + '" aria-controls="' + id + '" aria-label="' + esc(packLab(x) + ', ' + packCount(x)) + '"'; }
function packGrid(a) {                                   // copertine: libri, serie e copie
  var items = packItems(a);
  if (!items.some(function (x) { return x.pk; })) return '<div class="grid">' + a.map(coverHTML).join('') + '</div>';
  return '<div class="grid gcards">' + items.map(function (x, i) {
    if (!x.pk) return coverHTML(x).replace('<button class="cover', '<button style="order:' + (2 * i) + '" class="cover');
    var id = 'pk-' + (packN++), open = packOpen(x), b0 = x.books[0], img = bigImg(b0);
    return '<button type="button" class="cover gcard pcard' + (open ? ' on' : '') + '" style="order:' + (2 * i) + '"' + packAria(x, id, open) + '><span class="art">' +
      (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<span class="ph" style="--h:' + hue(x.name + b0.a) + '"><b>' + esc(x.name) + '</b><small>' + esc(b0.a) + '</small></span>') +
      '<span class="gc-n">' + x.books.length + '</span></span><span class="cap">' + esc(packLab(x)) + '</span><span class="cap2">' + packCount(x) + '</span></button>' +
      packHead(x, id, open).replace('class="gpanel pk-panel"', 'class="gpanel pk-panel" data-gi="' + i + '"') + '<div class="grid">' + x.books.map(coverHTML).join('') + '</div></div>';
  }).join('') + '</div>';
}
function packRows(a, dups) {                             // elenco: riga «Serie: … · N volumi» o «N copie» che si apre
  return packItems(a).map(function (x) {
    if (!x.pk) return rowHTML(x, dups);
    var id = 'pk-' + (packN++), open = packOpen(x), b0 = x.books[0], img = smallImg(b0);
    return '<button type="button" class="grow prow' + (open ? ' on' : '') + '"' + packAria(x, id, open) + '>' +
      (img ? '<span class="sum-img pk-img"><img src="' + esc(img) + '" alt="" loading="lazy" referrerpolicy="no-referrer"></span>' : '<span class="sum-img ph pk-img" style="--h:' + hue(x.name + b0.a) + '" aria-hidden="true">' + esc(x.name.replace(/^(il|lo|la|i|gli|le|un|uno|una|l')\s*/i, '').charAt(0).toUpperCase() || '?') + '</span>') +
      '<span class="gr-t"><b>' + esc(packLab(x)) + '</b><small>' + esc(packCount(x) + (b0.a ? ' · ' + b0.a : '')) + '</small></span><span class="sh-n">' + x.books.length + '</span>' +
      '<svg class="sh-c" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>' +
      packHead(x, id, open) + x.books.map(function (b) { return rowHTML(b, dups); }).join('') + '</div>';
  }).join('');
}
function grpParts(vis, g) {
  if (g === 'read') return READ_GRP.map(function (r) { return [r[0], r[1], vis.filter(function (b) { return (b.rs === 'ok' ? 'ok' : 'da') === r[0]; })]; }).filter(function (x) { return x[2].length; });
  var aut = function (b) { var a0 = authorsOf(b)[0]; return a0 ? auCanon(a0) : ''; }, gen = function (b) { return L.str(b.gen).trim(); };   // autori simili uniti (giro 1)
  var ak = function (n) { return L.sortKeyAuthor(n, settings.auCut); };   // autori per cognome anche nei gruppi (prima per nome intero)
  if (g === 'aut') return groupBy(vis, aut, 'Senza autore', ak);
  if (g === 'pae') return groupBy(vis, function (b) { var c = wdBookCountry(b); return c ? wdCName(c) : ''; }, 'Paese non trovato');   // paese del primo autore (giro 2, 18/11/2026)
  var gs = groupBy(vis, gen, 'Senza genere');
  if (g === 'genaut') gs.forEach(function (x) { x[3] = groupBy(x[2], aut, 'Senza autore', ak); });
  return gs;
}
/* foto degli autori: Wikipedia (auLookup), cercate una alla volta e solo per i gruppi che si vedono; salvate sul telefono */
var AUF_LS = 'catalogo-libri-aufoto', AUF_RETRY = 30 * 864e5, aufo = null, aufQ = [], aufBusy = false, aufIO = null;
function aufMap() {
  if (!aufo) {
    try { aufo = JSON.parse(ls.get(AUF_LS) || '{}'); } catch (e) { nlErr(e); }
    if (!aufo || typeof aufo !== 'object') aufo = {};
    if (aufo['~v'] !== 4) {                              // 17/11/2026: i vecchi «senza foto» si ricercano (v2: anche Wikidata; v3: anche le foto non libere di it.wikipedia; v4: miniature da thumb.wikimedia.org, Flaiano)
      Object.keys(aufo).forEach(function (k) { if (!Array.isArray(aufo[k]) || !aufo[k][0]) delete aufo[k]; });
      aufo['~v'] = 4;
      try { ls.set(AUF_LS, JSON.stringify(aufo)); } catch (e) { nlErr(e); }
    }
  }
  return aufo;
}
function aufGet(name) {                                  // indirizzo della foto; '' = cercata, non c'e'; null = da cercare
  var x = aufMap()[L.norm(name)];
  if (!Array.isArray(x)) return null;
  if (!x[0] && Date.now() - (Number(x[1]) || 0) > AUF_RETRY) return null;
  return auImgOk(x[0]);
}
function aufSave(name, url) {
  var m = aufMap(), ks = Object.keys(m).filter(function (k) { return k.charAt(0) !== '~'; });
  if (ks.length >= 2000) ks.sort(function (a, b) { return (m[a][1] || 0) - (m[b][1] || 0); }).slice(0, 200).forEach(function (k) { delete m[k]; });
  m[L.norm(name)] = [url || '', Date.now()];
  try { ls.set(AUF_LS, JSON.stringify(m)); } catch (e) { nlErr(e); }
}
function aufImg(url) { return '<img class="gc-img" src="' + esc(url) + '" alt="" loading="lazy" referrerpolicy="no-referrer" data-rm>'; }
function aufPaint(name, url) {
  var k = L.norm(name);
  Array.prototype.forEach.call(document.querySelectorAll('.gc-face[data-aun]'), function (el) {
    if (L.norm(el.dataset.aun) !== k) return;
    el.removeAttribute('data-auf');
    var im = el.querySelector('.gc-img');
    if (im && url && im.getAttribute('src') !== url) { im.remove(); im = null; }
    if (url && !im) el.insertAdjacentHTML('beforeend', aufImg(url));
  });
}
var aufFails = 0, aufLater = 0;
async function aufRun() {
  if (aufBusy) return; aufBusy = true;
  try {
    while (aufQ.length) {
      if (navigator.onLine === false) { aufQ = []; aufAgain(); break; }
      var name = aufQ.shift();
      if (aufGet(name) !== null) { aufPaint(name, aufGet(name)); continue; }
      try {
        var r = await auLookup(name);
        if (r && r.retry) throw r;
        aufFails = 0; aufSave(name, (r && r.img) || ''); aufPaint(name, (r && r.img) || '');
      } catch (e) {                                     // errore: si salta solo questo autore (17/11/2026; prima si buttava via tutta la coda)
        if (++aufFails >= 3) { aufQ = []; aufFails = 0; aufAgain(); break; }   // tre di fila: rete assente o lenta, si riprova tra un minuto
      }
    }
  } finally { aufBusy = false; }
}
function aufAgain() {                                    // si riguardano le copertine ancora senza foto che si vedono
  clearTimeout(aufLater);
  aufLater = setTimeout(function () { if (aufIO) Array.prototype.forEach.call(document.querySelectorAll('#list [data-auf]'), function (el) { aufIO.unobserve(el); aufIO.observe(el); }); }, 60000);
}
window.addEventListener('online', function () { if (aufIO) Array.prototype.forEach.call(document.querySelectorAll('#list [data-auf]'), function (el) { aufIO.unobserve(el); aufIO.observe(el); }); });
function aufWant(name) { if (esempio()) return; if (aufQ.indexOf(name) < 0) aufQ.push(name); aufRun(); }
function aufWatch(root) {                                // si cercano solo le foto dei gruppi che si vedono
  var els = root.querySelectorAll('[data-auf]'); if (!els.length) return;
  if (!window.IntersectionObserver) { Array.prototype.forEach.call(els, function (el) { aufWant(el.dataset.aun); }); return; }
  if (!aufIO) aufIO = new IntersectionObserver(function (es) {
    es.forEach(function (x) { if (x.isIntersecting) { aufIO.unobserve(x.target); if (x.target.dataset.auf) aufWant(x.target.dataset.aun); } });
  }, { rootMargin: '200px' });
  Array.prototype.forEach.call(els, function (el) { aufIO.observe(el); });
}
function grpInitials(name) { return name.split(/\s+/).filter(function (w) { return /^[\p{L}\d]/u.test(w); }).map(function (w) { return w.charAt(0); }).slice(-2).join('').toUpperCase() || '?'; }
/* icone a linee dei generi (24×24, tratto) e regole per riconoscerle dal nome del genere (Piero, 17/11/2026: al posto dell'iniziale);
   generi non riconosciuti: un libro chiuso */
var GEN_ICO = {
  lente: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5"/>',
  fantasma: '<path d="M6 20.5V10a6 6 0 0 1 12 0v10.5l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5z"/><circle cx="10" cy="10.5" r=".6"/><circle cx="14" cy="10.5" r=".6"/>',
  razzo: '<path d="M12 2.5c3 2.5 4.5 6 4.5 10l-1.5 3.5h-6L7.5 12.5c0-4 1.5-7.5 4.5-10z"/><circle cx="12" cy="9.5" r="1.8"/><path d="M7.6 12.8L5 16.5h3.6M16.4 12.8L19 16.5h-3.6M10.5 19l1.5 2.5 1.5-2.5"/>',
  bacchetta: '<path d="M4 20L15 9"/><path d="M17 3v4M15 5h4M20 10v2M19 11h2M10.5 3v2M9.5 4h2"/>',
  cuore: '<path d="M12 20s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7.5 3c0 5.4-7.5 10-7.5 10z"/>',
  bussola: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  globo: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z"/>',
  colonna: '<path d="M4 9h16L12 4zM6 9v8M10 9v8M14 9v8M18 9v8M5 17h14M4 20h16"/>',
  persona: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6"/>',
  piuma: '<path d="M20 4C12 4 7 9 6 17l-2 3"/><path d="M20 4c0 7-4 12-12.5 13"/><path d="M9 13h5"/>',
  maschera: '<path d="M5 4h14v7a7 7 0 0 1-14 0z"/><path d="M8.5 9h2M13.5 9h2M9 14c1.8 1.5 4.2 1.5 6 0"/>',
  palloncino: '<path d="M12 3c3.3 0 5.5 2.6 5.5 5.8 0 3.6-2.8 6.7-5.5 6.7S6.5 12.4 6.5 8.8C6.5 5.6 8.7 3 12 3z"/><path d="M12 15.5l-1 1.5h2zM12 17c0 2-2 2.5-1 4.5"/>',
  fumetto: '<path d="M4 5h16v11H10l-4 4v-4H4z"/><path d="M8 9.5h8M8 12.5h5"/>',
  atomo: '<circle cx="12" cy="12" r="1.4"/><ellipse cx="12" cy="12" rx="9" ry="3.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(-60 12 12)"/>',
  bilancia: '<path d="M12 4v16M8 20h8M5 7h14M5 7l-2.5 6a2.5 2.5 0 0 0 5 0zM19 7l-2.5 6a2.5 2.5 0 0 0 5 0z"/>',
  grafico: '<path d="M4 4v16h16"/><path d="M7.5 15l3.5-4 3 3 5-6.5"/>',
  lampadina: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.3 1 2.1v.5h5V16c0-.8.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  candela: '<path d="M9 21h6V10.5H9zM12 10.5V8.5"/><path d="M12 3c1.2 1.5 1.5 2.6 0 4.2-1.5-1.6-1.2-2.7 0-4.2z"/>',
  fotocamera: '<path d="M4 7.5h3l2-2.5h6l2 2.5h3V19H4z"/><circle cx="12" cy="13" r="3.5"/>',
  tavolozza: '<path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a4 4 0 0 0 4-4c0-4.4-4-8-9-8z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="14.5" cy="7" r="1"/>',
  nota: '<path d="M9 18V5.5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16.5" r="2.5"/>',
  forchetta: '<path d="M7 3v6a2 2 0 0 0 4 0V3M9 11v10M17 21V3c-2 1-3 4-3 8h3"/>',
  foglia: '<path d="M5 19C5 10 10 5 20 4c-1 10-6 15-15 15z"/><path d="M5 19l8-8"/>',
  pallone: '<circle cx="12" cy="12" r="9"/><path d="M12 8l3.8 2.8-1.5 4.4H9.7l-1.5-4.4zM12 3v5M15.8 10.8l4.6-1.6M14.3 15.2l2.7 4M9.7 15.2L7 19.2M8.2 10.8L3.6 9.2"/>',
  battito: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  faccina: '<circle cx="12" cy="12" r="9"/><path d="M8 14c2 2.5 6 2.5 8 0"/><circle cx="9" cy="9.5" r=".6"/><circle cx="15" cy="9.5" r=".6"/>',
  computer: '<path d="M4 5h16v10H4zM2 19h20"/>',
  casa: '<path d="M3 11l9-7 9 7M5 9.5V20h14V9.5"/><path d="M10 20v-5h4v5"/>',
  dialogo: '<path d="M3 4h11v7H7.5L4.5 14v-3H3z"/><path d="M10 14h6.5l3 3v-3H21V8h-4"/>',
  libroAperto: '<path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5c-3.5-.5-6.5 0-8.5 1.5zM12 6.5v13"/>',
  libro: '<path d="M5 19.5V4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5 1.5 1.5 0 0 0 6.5 21H19v-3"/><path d="M9 7h6"/>'
};
var GEN_RULES = [
  ['fumetto', /fumett|graphic|manga|comics/], ['lente', /giall|thriller|noir|polizi|mystery|investig|spionag|crime/],
  ['fantasma', /horror|orror|paura|gotic/], ['razzo', /fantascien|science fiction|sci-fi|distop|cyberpunk/],
  ['bacchetta', /fantasy|fantastic|magia|fiab|favol|mitolog/], ['cuore', /\brosa\b|romance|amor|sentimental|erotic/],
  ['bussola', /avventur|western|pirat/], ['globo', /viagg|geograf|turism/], ['persona', /biograf|memori|diari|autobiograf/],
  ['colonna', /storia|storic|archeolog|classic/], ['piuma', /poesi|poet|versi/], ['maschera', /teatr|dramm|spettacol|cinema/],
  ['palloncino', /ragazz|bambin|infanzia|young|junior|scolast/], ['bilancia', /politic|diritto|giurid|social|sociolog|attualit|cronaca/],
  ['grafico', /econom|finanz|business|management|marketing/], ['atomo', /scienz|fisic|chimic|biolog|matemat|astronom/],
  ['candela', /religi|spiritual|teolog|bibbi/], ['lampadina', /saggi|filosof|psicolog|crescita|self|manual|divulgaz|pensiero/],
  ['fotocamera', /fotograf/], ['tavolozza', /\barte\b|\barti\b|pittur|design|architett/], ['nota', /music|canzon|lirica/],
  ['forchetta', /cucin|ricett|gastronom|enolog|\bvin/], ['foglia', /natur|animal|giardin|ambient|ecolog|botanic/],
  ['pallone', /sport|calcio|montagn|alpinism/], ['battito', /medicin|salute|benessere|fitness/],
  ['faccina', /umoris|comic|satir|ironi/], ['computer', /informat|tecnolog|computer|programmaz|ingegner/],
  ['casa', /famigl|\bcasa\b|genitor|hobby|bricol/], ['dialogo', /lingu|dizionar|consultaz|studio|grammatic/],
  ['libroAperto', /romanz|narrativ|raccont|fiction|letteratur|novell|antolog/]
];
function genIco(name) {
  var k = String(name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''), ico = 'libro';
  for (var i = 0; i < GEN_RULES.length; i++) if (GEN_RULES[i][1].test(k)) { ico = GEN_RULES[i][0]; break; }
  return '<svg class="gc-ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + GEN_ICO[ico] + '</svg>';
}
/* figura del gruppo (17/11/2026): genere = icona e nome al centro; autore = foto, senza foto nome piccolo e COGNOME grande al centro;
   nel tondo piccolo (elenco, sezioni aperte) icona del genere e iniziali dell'autore */
function grpFace(kind, name, none, small) {
  var url = kind === 'aut' && !none ? aufGet(name) : '';
  var wait = kind === 'aut' && !none && url === null, inner;
  if (none) inner = '<b>?</b>';
  else if (kind === 'pae') inner = '<span class="gc-flag" aria-hidden="true">' + wdFlagImg(wdCodeOf(name)) + '</span>' + (small ? '' : '<b class="gc-gn">' + esc(name) + '</b>');   // bandiera del paese (giro 2)
  else if (kind === 'gen') inner = small ? genIco(name) : genIco(name) + '<b class="gc-gn">' + esc(name) + '</b>';
  else if (small) inner = '<b>' + esc(grpInitials(name)) + '</b>';
  else {
    var pp = L.authorParts(name, settings.auCut[L.norm(name)]), sur = pp.sur || pp.name, giv = pp.sur ? pp.given : '';
    var lw = Math.max.apply(null, sur.split(/\s+/).map(function (w) { return w.length; }));   // la parola piu' lunga del cognome deve stare in una riga
    inner = (giv ? '<small class="gc-nm">' + esc(giv) + '</small>' : '') + '<b class="gc-sur" style="--fs:' + Math.max(12, Math.min(20, Math.floor(94 / (0.8 * Math.max(lw, 4))))) + 'px;--lw:' + Math.max(lw, 4) + '">' + esc(sur) + '</b>';
  }
  return '<span class="gc-face' + (small ? ' sm' : '') + (kind === 'gen' || kind === 'pae' ? ' gc-gen' : '') + (kind === 'pae' ? ' gc-pae' : '') + '"' + (kind === 'aut' && !none ? ' data-aun="' + esc(name) + '"' : '') + (wait ? ' data-auf="' + esc(L.norm(name)) + '"' : '') + '>' +
    '<span class="ph gc-ph' + (kind === 'aut' ? ' gc-au' : '') + (!small && !none ? ' gc-big' : '') + '" style="--h:' + (none ? 200 : hue(name)) + '">' + inner + '</span>' + (url ? aufImg(url) : '') + '</span>';
}
function grpLibri(n) { return n + (n === 1 ? ' libro' : ' libri'); }
function renderGroups(list, vis, g) {
  var isGrid = settings.view === 'grid', dups = isGrid ? null : computeDups(), n = 0, forced = !!(q || activeCount());
  var exp = forced ? grpFltShut !== fltSig() : !!settings.grpExp;   // con filtri o ricerca si parte tutto aperto, ma si può comprimere
  var inner = function (a) { return isGrid ? packGrid(a) : packRows(a, dups); };   // dentro i gruppi anche serie e copie accorpate (giro 1)
  var innerNow = function (a) { return isGrid ? '<div class="grid">' + a.map(coverHTML).join('') + '</div>' : a.map(function (b) { return rowHTML(b, dups); }).join(''); };
  var hasOpen = function (a) { return a.some(function (b) { return openState[b.id] && b.t; }); };
  var isOpen = function (key, books) { return exp ? !grpShutX[key] : (!!settings.grpOpen[key] || hasOpen(books)); };
  var kindOf = function (lvl) { return g === 'pae' ? 'pae' : g === 'aut' || (g === 'genaut' && lvl === 2) ? 'aut' : 'gen'; };
  var lab = function (x, kind) { return kind === 'aut' && x[0] !== '~' ? auShow(x[1]) : x[1]; };   // nome mostrato; x[1] resta il nome vero (foto, «Chi è»)
  /* sezione apribile (gruppi espansi, lettura, generi di Genere › Autore) */
  var sec = function (key, x, body, sub, kind) {
    var id = 'grp-' + (n++), open = isOpen(key, x[2]);
    return '<section class="shelf grp' + (sub ? ' grp-sub' : '') + '"><button type="button" class="shelf-h" data-gk="' + esc(key) + '" aria-expanded="' + open + '" aria-controls="' + id + '">' +
      (kind ? grpFace(kind, x[1], x[0] === '~', true) : '') +
      '<span class="sh-t">' + esc(lab(x, kind)) + '</span><span class="sh-n">' + x[2].length + '</span><svg class="sh-c" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>' +
      '<div class="shelf-b" id="' + id + '"' + (open ? '' : ' hidden') + '>' + body + '</div></section>';
  };
  /* gruppi come copertine (o righe nell'elenco); il riquadro con i libri si apre sotto */
  var panel = function (key, x, kind, i, open, id, inside) {
    return '<div class="gpanel" id="' + id + '" data-gi="' + i + '"' + (open ? '' : ' hidden') + '><div class="gp-h"><b>' + esc(lab(x, kind)) + '</b><small>' + grpLibri(x[2].length) + '</small><span class="gp-sp"></span>' +
      (kind === 'aut' && x[0] !== '~' ? '<button type="button" class="link gp-who" data-gau="' + esc(x[1]) + '" data-gid="' + esc(x[2][0].id) + '">Info Autore ›</button>' : '') +
      '<button type="button" class="ico gp-x" data-gk="' + esc(key) + '" aria-label="Chiudi">×</button></div>' + (inside != null ? inside : inner(x[2])) + '</div>';
  };
  var cards = function (groups, kind, base, sub) {     // sub: Genere › Autore, nel riquadro del genere le copertine degli autori (17/11/2026)
    var h = groups.map(function (x, i) {
      var key = base + '/' + x[0], open = isOpen(key, x[2]), id = 'grp-' + (n++), none = x[0] === '~';
      var aria = ' data-gk="' + esc(key) + '" aria-expanded="' + open + '" aria-controls="' + id + '" aria-label="' + esc(lab(x, kind) + ', ' + grpLibri(x[2].length)) + '"';
      var card = isGrid
        ? '<button type="button" class="cover gcard' + (open ? ' on' : '') + '" style="order:' + (2 * i) + '"' + aria + '><span class="art">' + grpFace(kind, x[1], none) + '<span class="gc-n">' + x[2].length + '</span></span>' +
            '<span class="cap">' + esc(lab(x, kind)) + '</span><span class="cap2">' + grpLibri(x[2].length) + '</span></button>'
        : '<button type="button" class="grow' + (open ? ' on' : '') + '"' + aria + '>' + grpFace(kind, x[1], none, true) + '<span class="gr-t"><b>' + esc(lab(x, kind)) + '</b><small>' +
            esc(x[2].slice(0, 2).map(function (b) { return '«' + (b.t || 'senza titolo') + '»'; }).join(', ') + (x[2].length > 2 ? '…' : '')) + '</small></span><span class="sh-n">' + x[2].length + '</span><svg class="sh-c" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>';
      return card + panel(key, x, kind, i, open, id, sub && x[3] ? cards(x[3], 'aut', key) : null);
    }).join('');
    return isGrid ? '<div class="grid gcards">' + h + '</div>' : '<div class="glist">' + h + '</div>';
  };
  var body = function (parts) {
    var base = g + ':' + tab;
    if (g === 'read') return parts.map(function (x) { return sec(base + ':' + x[0], x, inner(x[2]), false); }).join('');
    if (exp) return parts.map(function (x) {
      var key = base + ':' + x[0];
      if (x[3]) return sec(key, x, x[3].map(function (y) { return sec(key + '/' + y[0], y, inner(y[2]), true, 'aut'); }).join(''), false);
      return sec(key, x, inner(x[2]), false, kindOf(1));
    }).join('');
    if (g === 'genaut') return cards(parts, 'gen', base, true);   // generi a copertine, dentro gli autori a copertine (Piero, 17/11/2026)
    return cards(parts, kindOf(1), base);
  };
  var tools = '<div class="grp-tools"><button type="button" class="gx" data-gx="1"' + (exp ? ' disabled' : '') + '>Espandi tutto</button><button type="button" class="gx" data-gx="0">Comprimi tutto</button></div>';
  var now = tab === 'lib' ? vis.filter(function (b) { return b.rs === 'in'; }) : [], rest = now.length ? vis.filter(function (b) { return b.rs !== 'in'; }) : vis;
  var html = body(grpParts(rest, g));
  if (now.length) {
    var sh = function (k, title, inside, cnt) {
      var open = !(settings.shelfShut || {})[k];
      return '<section class="shelf shelf-' + k + '"><button type="button" class="shelf-h" data-shelf="' + k + '" aria-expanded="' + open + '" aria-controls="shelf-' + k + '">' +
        (k === 'now' ? '<svg class="sh-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5h10a1 1 0 0 1 1 1v16l-6-4-6 4v-16a1 1 0 0 1 1-1z"/></svg>' : '') +
        '<span>' + esc(title) + '</span><span class="sh-n">' + cnt + '</span><svg class="sh-c" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>' +
        '<div class="shelf-b" id="shelf-' + k + '"' + (open ? '' : ' hidden') + '>' + inside + '</div></section>';
    };
    list.innerHTML = sh('now', 'In lettura', innerNow(now), now.length) + (rest.length ? sh('all', 'Gli altri libri', tools + html, rest.length) : '');
  } else list.innerHTML = tools + html;
  list.classList.toggle('grp-exp', exp);
  gcPlace(list); aufWatch(list);
  if (!isGrid) { emit('rows', list); autosizeAll(list); }
  paintSel();
}
/* riquadro dei libri subito dopo la riga di copertine del suo gruppo (con «order»: le colonne cambiano con la larghezza) */
function gcPlace(root) {
  Array.prototype.forEach.call(root.querySelectorAll('.gcards'), function (gr) {
    if (!gr.offsetParent) return;
    var cols = getComputedStyle(gr).gridTemplateColumns.split(' ').filter(Boolean).length || 1, cnt = gr.querySelectorAll(':scope > .cover').length;   // anche i libri accanto a serie e copie (giro 1)
    Array.prototype.forEach.call(gr.querySelectorAll(':scope > .gpanel'), function (p) {
      var i = Number(p.dataset.gi) || 0, end = Math.min(cnt - 1, Math.floor(i / cols) * cols + cols - 1);
      p.style.order = 2 * end + 1;
      p.style.setProperty('--x', (((i % cols) + 0.5) / cols * 100).toFixed(1) + '%');
    });
  });
}
window.addEventListener('resize', function () { var l = $('#list'); if (l) gcPlace(l); });
function rowEl(id) { return $('#list').querySelector('[data-id="' + id + '"]'); }
function refreshRow(id) {
  if (scanning) return;
  if (settings.view === 'grid') { clearTimeout(tGrid); tGrid = setTimeout(renderList, 120); return; }
  var b = get(id), el = rowEl(id);
  if (!b || !inTab(b)) { if (el) el.remove(); if (!tabBooks().length) renderList(); return; }
  if (!el) { renderList(); return; }
  syncThumbs();
  var t = document.createElement('template');
  t.innerHTML = rowHTML(b, computeDups());
  var fresh = t.content.firstElementChild;
  el.replaceWith(fresh);
  emit('rows', fresh);
  if (selOn) paintSel();
  autosizeAll(fresh);
}
function eur(n) { return eurFmt.format(n); }
/* aggiorna i contorni dell'elenco (pillole, filtri, ordine): il vecchio riepilogo in testata non c'è più (20/11/2026);
   titolo, nastro e frase li disegna stile-g.js all'evento «list» */
function updateSummary() {
  renderOwner();                                   // la scritta nella ricerca segue la scheda
  var g = tabBooks().filter(hasData).filter(function (b) { return b.g.length; }).length;
  $('#sort').value = sortBy; $('#grp').value = settings.grp || ''; pickSync();   // riga «Ordina · Raggruppa» sempre in vista
  nxBoxPaint(); emit('list');
  $('#btnNews').hidden = tab !== 'wish' || !state.books.some(function (b) { return !b.w && b.a; });
  $('#btnShareWish').hidden = !shareable().length || !(tab === 'wish' || activeCount() || q);     // Desideri, oppure una selezione (preferiti, genere, ricerca...)
  updateActiveFilters();
  var fg = $('#fltGuess');
  fg.textContent = 'Da verificare · ' + g;
  fg.hidden = g === 0 && flt !== 'guess';
  fg.setAttribute('aria-pressed', flt === 'guess' ? 'true' : 'false');
  var td = todoRows().length;
  var bt = $('#btnTodo');
  bt.hidden = td === 0;
  bt.textContent = 'Completa ' + td + (td === 1 ? ' libro' : ' libri') + ' con l\'ISBN';
}
