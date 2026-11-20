/* Next Libris · modulo «Pagina del libro»: la scheda aperta di un libro si legge come una pagina (copertina, dati in una riga,
   descrizione, lettura; la matita apre i campi). Usa solo window.NL (NL.on('rows') dopo ogni disegno delle schede).
   La scheda «Classica» (tutti i campi uno sotto l'altro) e la scelta tra le due non ci sono più (20/11/2026): prima restava
   per le prove automatiche, che su localhost partivano da quella. */
(function () {
'use strict';
var NL = window.NL;
if (!NL) return;
var $ = NL.$, esc = NL.esc;
NL.ls.del('catalogo-libri-card');   // la scelta della scheda, salvata dalle versioni vecchie
var cur = 'd';
var root = document.documentElement;
var editing = {}, descExp = {}, hinted = false;                 // per libro: campi aperti, descrizione aperta

function q(el, sel) { return el.querySelector(sel); }
function qa(el, sel) { return Array.prototype.slice.call(el.querySelectorAll(sel)); }

/* D · pagina del libro: si legge; «Modifica» mostra i campi.
   In alto solo icone (preferito, desideri, condividi, elimina), tutte su una riga; Presta e Cerca sul web in fondo, con la scritta. */
function doD(card, id) {
  var b = NL.get(id), head = q(card, '.head');
  if (!b || !head) return;
  dActs(card);
  /* senza titolo: la stessa pagina di tutti i libri (Piero, 19/11/2026: niente piu' i campi da riempire, nemmeno negli amici); si completa con la matita.
     Modifica (matita): la stessa pagina, con i dati da scrivere nel loro posto (Piero, 19/11/2026: la vecchia scheda a campi non c'e' piu') */
  var ed = !!editing[id], mine = !card.dataset.ex && !(NL.guest && NL.guest()), g = mine ? (b.g || []) : [];
  function gm(k) { return g.indexOf(k) >= 0 ? '<button type="button" class="cv-guess" data-gk="' + k + '" title="Dato dedotto: tocca quando hai controllato">da verificare</button>' : ''; }
  var tit = b.t || 'Senza titolo', img = NL.bigImg(b);
  var dati = [['e', b.e], ['y', b.y], ['pg', b.pg ? b.pg + ' pagine' : '']].filter(function (x) { return x[1]; }).map(function (x) { return esc(x[1]) + gm(x[0]); });
  var names = NL.authorsOf(b);
  var v = document.createElement('div'); v.className = 'cv-page';
  /* copertina: toccandola si ingrandisce (come nella scheda classica); senza copertina, la cerca online o la fotografi */
  v.innerHTML = '<div class="cv-hero">' + (img ? '<button type="button" class="cv-cov" data-act="zoom" aria-label="Ingrandisci la copertina" title="Ingrandisci la copertina"><img src="' + esc(img) + '" alt="" referrerpolicy="no-referrer"></button>' :
      '<button type="button" class="cv-cov cv-ph" data-act="coverphoto" style="--h:' + NL.hue(b.t + b.a + b.i) + '" title="Cerca la copertina online; se non c\'è, la fotografi" aria-label="Aggiungi la copertina"><span>' + esc(b.t.slice(0, 1)) + '</span><small>' + NL.icon('cam') + 'Copertina</small></button>') +
    '<div class="cv-ht"><h3' + (b.t ? '' : ' class="cv-not"') + '>' + esc(tit) + gm('t') + '</h3>' +
    (names.length ? '<p class="cv-au">' + names.map(function (n) { return '<button type="button" class="au-name" data-act="auinfo" data-n="' + esc(n) + '" title="Info Autore: ' + esc(n) + '">' + esc(n) + '</button>' + nat(n); }).join('<span class="au-sep">, </span>') + gm('a') + '</p>' : '') +
    (dati.length || b.gen ? '<p class="cv-meta">' + dati.concat(b.gen ? [esc(b.gen)] : []).map(function (x) { return '<span class="cv-pill">' + x + '</span>'; }).join('<span class="cv-dot"> · </span>') + '</p>' : '') + (b.i ? '<p class="cv-meta cv-isbn">ISBN ' + esc(b.i) + '</p>' : '') + '</div></div>' +   /* ISBN sempre visibile, su una riga sua (Piero, 19/11/2026) */
    '<div class="cv-chips"></div>' +
    (b.n ? '<p class="cv-note">' + esc(b.n) + '</p>' : '');
  /* etichette = filtri, come nella scheda classica: gli stessi pulsanti di «Vedi tutti i libri di» (autore, editore, genere, scaffale) e la serie */
  var chips = q(v, '.cv-chips');
  function fkey(x) { return NL.L.norm(String(x || '').trim().replace(/\s+/g, ' ')); }
  [['gen', b.gen, NL.icon('tag')], ['sh', b.sh, NL.icon('shelf')]].forEach(function (p) {     // genere e scaffale: sempre, anche se e' l'unico libro
    var val = String(p[1] || '').trim(); if (!val) return;
    var ex = q(card, '.facets .fchip[data-f="' + p[0] + '"]');
    if (ex) { chips.appendChild(ex); return; }
    var c = document.createElement('button'); c.type = 'button'; c.className = 'fchip'; c.dataset.act = 'facet'; c.dataset.f = p[0]; c.dataset.v = fkey(val); c.dataset.name = val;
    c.title = 'Mostra i libri: ' + (p[0] === 'gen' ? 'genere ' : 'scaffale ') + val; c.innerHTML = p[2] + '<span class="fl">' + esc(val) + '</span>';
    chips.appendChild(c);
  });
  qa(card, '.facets .fchip').forEach(function (c) { chips.appendChild(c); });   // autore ed editore, quando hai altri loro libri
  if (b.se) { var sc = document.createElement('button'); sc.type = 'button'; sc.className = 'fchip cv-serchip'; sc.dataset.act = 'serall'; sc.title = 'Vedi i libri della serie'; sc.innerHTML = '<span class="fl">' + esc(b.se + (b.sn ? ', vol. ' + b.sn : '')) + '</span>'; chips.appendChild(sc); }
  if (!chips.children.length) chips.remove();
  /* lettura: gli stessi pulsanti della scheda (Da leggere / In lettura / Letto, stelle, data) */
  var rd = q(card, '.read');
  if (rd) rd.classList.add('cv-readbox');
  head.parentNode.insertBefore(v, head);
  card.classList.add('cv-view');
  /* descrizione: sobria, subito sotto la riga «editore · anno · pagine», senza riquadro; se non c'e' ancora, un link per cercarla */
  var ds = q(card, 'details.desc:not(.quotes)');
  if (ds) {
    if (b.dsn && !b.ds) ds.remove();
    else {
      ds.classList.add('cv-desc');
      v.insertBefore(ds, q(v, '.cv-hero').nextSibling);
      if (b.ds && !ds.open) ds.open = true;      // l'app la segna aperta (e la tiene cosi')
      if (b.ds) {                                 // anteprima di poche righe; la freccetta la apre tutta (con fonte e «rimuovila»)
        if (descExp[id]) ds.classList.add('cv-open');
        var more = document.createElement('button'); more.type = 'button'; more.className = 'cv-dmore';
        more.setAttribute('aria-label', descExp[id] ? 'Mostra meno' : 'Leggi tutta la descrizione'); more.setAttribute('aria-expanded', descExp[id] ? 'true' : 'false');
        more.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
        more.addEventListener('click', function (e) {
          e.stopPropagation();
          descExp[id] = !descExp[id];
          ds.classList.toggle('cv-open', !!descExp[id]);
          more.setAttribute('aria-expanded', descExp[id] ? 'true' : 'false'); more.setAttribute('aria-label', descExp[id] ? 'Mostra meno' : 'Leggi tutta la descrizione');
          var full = ds.querySelector('[data-act="descmore"]'); if (descExp[id] && full) full.click();   // testo lungo: l'app lo mostra intero
        });
        ds.appendChild(more);
      }
    }
  }
  /* stato, voto e data: una striscia a tutta larghezza subito sotto copertina e titolo, tra due righe sottili;
     stelle e «Letto il» sulla stessa riga quando c'e' posto (Piero ha scelto la C tra cinque proposte, 16/11/2026) */
  if (rd) {
    rd.classList.add('cv-strip');                  // stato, poi i libricini con la parola
    var rdf = q(rd, '.f-rd');                      // «Letto il …» in piccolo sotto casa editrice e anno, nello stesso stile (Piero, 16/11/2026)
    if (rdf) { rdf.classList.add('cv-rdmeta'); var ht = q(v, '.cv-ht'), mt = q(ht, '.cv-meta'); ht.insertBefore(rdf, mt ? mt.nextSibling : null); }
    var hero = q(v, '.cv-hero'); hero.parentNode.insertBefore(rd, hero.nextSibling);
  }
  /* avviso del libro («Senza connessione… Riprova ora», «Non ho trovato questo libro online», ricerca in corso): nella pagina sta subito
     sotto titolo e ISBN, nel riquadro degli avvisi (proposta del 20/11/2026: prima nella pagina aperta era nascosto) */
  var stt = q(card, '.status');
  if (stt) { stt.classList.add('cv-status'); var hr = q(v, '.cv-hero'); hr.parentNode.insertBefore(stt, hr.nextSibling); }
  qa(v, '.cv-guess').forEach(function (x) { x.addEventListener('click', function (e) { e.stopPropagation(); verifyK(id, x.dataset.gk); }); });
  if (ed) editPage(card, v, b, id, gm);
  /* etichette-filtro: in fondo, prima di Presta e Cerca sul web */
  else if (chips.parentNode) {
    var tags = document.createElement('div'); tags.className = 'cv-tags';
    tags.innerHTML = '<span class="cv-tags-h">' + NL.icon('filt') + 'Vedi tutti i libri di</span>';
    tags.appendChild(chips);
    card.insertBefore(tags, q(card, '.cv-acts2'));
  }
  try { cPage(card, v, b, id); } catch (e) { if (window.nlErr) nlErr(e); }
}
/* restyle «C · Schede», pezzo 2 (Piero, 19/11/2026): la scheda e' una pagina intera, come il profilo.
   In alto ‹ (chiude, come la freccetta) e ⋯ (Cerca sul web, Cerca di nuovo); copertina al centro, titolo, autore, pillole dei dati,
   tasti tondi; poi riquadri: lettura, Descrizione, Dal libro, Citazioni (la prima in vista, «Tutte ›»), Prestito, Nota, «Vedi tutti i libri di». */
var qAll = {}, pgTop = {}, lastOpen = null;
function cPage(card, v, b, id) {
  if (!card.classList.contains('has-top')) return;          // schede sempre aperte (openAll): restano nell'elenco
  card.classList.add('cv-full');
  var top = q(card, '.card-top'), main = q(card, '.acts-main'), chev = q(card, '.chev-btn'), low = q(card, '.cv-acts2');
  /* barra in alto */
  var bar = document.createElement('div'); bar.className = 'cv-bar';
  bar.innerHTML = '<button type="button" class="cv-rb cv-back" aria-label="Torna indietro" title="Torna indietro">' + NL.icon('left') + '</button><span class="cv-bt"></span>';
  q(bar, '.cv-back').addEventListener('click', function (e) { e.stopPropagation(); if (chev) chev.click(); });
  var extra = low ? qa(low, '[data-act="websearch"], [data-act="lookup"]') : [];
  if (extra.length) {
    var mb = document.createElement('button'); mb.type = 'button'; mb.className = 'cv-rb cv-morebtn'; mb.setAttribute('aria-label', 'Altro'); mb.title = 'Altro'; mb.setAttribute('aria-expanded', 'false');
    mb.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';
    var pop = document.createElement('div'); pop.className = 'cv-pop'; pop.hidden = true;
    extra.forEach(function (x) { x.classList.add('cv-popi'); pop.appendChild(x); x.addEventListener('click', function () { pop.hidden = true; mb.setAttribute('aria-expanded', 'false'); }); });
    mb.addEventListener('click', function (e) { e.stopPropagation(); pop.hidden = !pop.hidden; mb.setAttribute('aria-expanded', pop.hidden ? 'false' : 'true'); });
    bar.appendChild(mb); bar.appendChild(pop);
  }
  card.insertBefore(bar, card.firstChild);
  /* tasti tondi sotto il titolo; stato (prestito escluso) in pillole sopra la copertina */
  var hero = q(v, '.cv-hero');
  if (main) v.insertBefore(main, hero.nextSibling);
  var kdp = q(card, '.kdp-hint'); if (kdp) v.insertBefore(kdp, (main || hero).nextSibling);
  /* lettura: «Letto il» dentro il suo riquadro */
  var rd = q(v, '.cv-readbox'), rdm = q(v, '.cv-rdmeta');
  if (rd && rdm) rd.appendChild(rdm);
  /* Dal libro e Citazioni dentro la pagina, dopo la descrizione */
  var after = q(v, '.cv-ex') ? (q(v, '.cv-adds') || q(v, '.cv-ex')) : (q(v, '.cv-desc') || rd || main || hero);
  function put(el) { if (!el) return; v.insertBefore(el, after.nextSibling); after = el; }
  if (q(v, '.cv-ex')) put(q(v, '.cv-desc'));
  put(q(card, '.filmbox'));
  var qd = q(card, 'details.quotes');
  if (qd) {
    put(qd); qd.open = true; qd.classList.add('cv-q');
    var n = (b.qs || []).length, sm = q(qd, 'summary'), h = q(qd, '.desc-h'); if (h) h.textContent = 'Citazioni';
    qd.classList.toggle('cv-qall', n < 2 || !!qAll[id]);
    if (sm && n > 1) {
      var tb = document.createElement('span'); tb.className = 'cv-qmore'; tb.textContent = qAll[id] ? 'Mostra meno' : 'Tutte ›'; sm.appendChild(tb);
    }
    if (sm) sm.addEventListener('click', function (e) {
      e.preventDefault();
      if ((b.qs || []).length < 2) return;
      qAll[id] = !qAll[id]; qd.classList.toggle('cv-qall', !!qAll[id]);
      var t = q(qd, '.cv-qmore'); if (t) t.textContent = qAll[id] ? 'Mostra meno' : 'Tutte ›';
    });
  }
  /* Prestito: stato del prestito e «Presta, vendi o regala ›» */
  var loan = low && q(low, '[data-act="loan"]'), st = top ? qa(top, '.flags .tag.loan, .flags .tag.gone, .flags .ret-btn') : [];
  if (loan || st.length) {
    var lb = document.createElement('div'); lb.className = 'cv-loan';
    lb.innerHTML = '<h4 class="cv-h">Prestito</h4>';
    if (st.length) { var sw = document.createElement('div'); sw.className = 'cv-lst'; st.forEach(function (x) { sw.appendChild(x); }); lb.appendChild(sw); }
    if (loan) {
      loan.classList.add('cv-lrow');
      var al = q(loan, '.al'); if (al) al.insertAdjacentHTML('afterend', '<small class="cv-lsub">' + (loan.classList.contains('on') ? 'Tocca per cambiare' : 'Tieni il conto di a chi l\'hai dato') + '</small>');
      loan.insertAdjacentHTML('beforeend', '<span class="cv-chev" aria-hidden="true">›</span>');
      lb.appendChild(loan);
    }
    put(lb);
  }
  if (low && !low.children.length) low.remove();
  var note = q(v, '.cv-note'); if (note) put(note);
  var tags = q(card, '.cv-tags'); if (tags) put(tags);
  if (top && !q(top, '.flags *')) top.classList.add('cv-empty');
  /* lo scorrimento della pagina resta dov'era quando la scheda si ridisegna (voto, stato, preferito…) */
  if (lastOpen !== id) { lastOpen = id; pgTop[id] = 0; }
  var y = pgTop[id] || 0;
  card.scrollTop = y; requestAnimationFrame(function () { card.scrollTop = y; });
  card.addEventListener('scroll', function () { pgTop[id] = card.scrollTop; bar.classList.toggle('cv-sc', card.scrollTop > 8); }, { passive: true });
  if (document.activeElement && card.contains(document.activeElement) && document.activeElement.classList.contains('chev-btn')) { try { q(bar, '.cv-back').focus({ preventScroll: true }); } catch (e) {} }
}
function dActs(card) {                            // in alto, solo icone: preferito, desideri, condividi, elimina; in fondo, con la scritta: presta, cerca sul web
  var main = q(card, '.acts-main'); if (!main) return;
  var share = q(card, '.foot .tail [data-act="share"]'), del = q(main, '[data-act="del"]'), move = q(main, '[data-act="towish"], [data-act="tolib"]'), fav = q(main, '[data-act="lc"]') || q(main, '[data-act="fav"]');   // stella, coccarda, desideri (giro 6)
  if (move) main.insertBefore(move, fav ? fav.nextSibling : main.firstChild);
  if (share) main.insertBefore(share, del || null);
  var id = card.dataset.id, b = NL.get(id);
  if (b) {                                        // Modifica (anche per i libri senza titolo): icona della matita in alto, accanto alle altre
    var ed = document.createElement('button'); ed.type = 'button'; ed.className = 'ico act cv-editb' + (editing[id] ? ' on' : '');
    ed.title = editing[id] ? 'Fatto: ho finito di modificare' : 'Modifica i dati del libro'; ed.setAttribute('aria-label', ed.title); ed.setAttribute('aria-pressed', editing[id] ? 'true' : 'false');
    ed.innerHTML = NL.icon('pen') + '<span class="al" aria-hidden="true">Modifica</span>';
    ed.addEventListener('click', function (e) {
      e.stopPropagation();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();   // salva l'ultimo campo prima di ridisegnare
      if (editing[id]) delete editing[id]; else { editing[id] = true; if (!hinted) { hinted = true; NL.toast('Tocca i dati per cambiarli. Hai finito? Tocca di nuovo la matita.'); } }
      NL.refreshRow(id);
    });
    main.insertBefore(ed, del || null);
  }
  var low = ['loan', 'websearch'].map(function (a) { return q(main, '[data-act="' + a + '"]'); }).filter(Boolean);
  var redo = q(card, '.foot .tail [data-act="lookup"]'); if (redo) low.unshift(redo);   // senza titolo: «Cerca di nuovo» resta raggiungibile
  if (!low.length) return;
  var row = document.createElement('div'); row.className = 'cv-acts2';
  low.forEach(function (x) { row.appendChild(x); });
  card.appendChild(row);                          // in fondo alla scheda
}
/* «da verificare» accanto a un dato: un tocco lo segna come controllato (solo quel dato) */
/* nazionalita' accanto a ogni autore: bandiera e nome del paese, da Wikidata come «Raggruppa per paese»; se non si conosce, niente (Piero, 19/11/2026) */
function nat(n) {
  var c = NL.wdCountry ? NL.wdCountry(n) : ''; if (!c) return '';
  var nm = NL.wdCName(c); return nm ? '<span class="cv-nat">' + NL.wdFlagImg(c, 'cv-flag') + esc(nm) + '</span>' : '';
}
function verifyK(id, k) {
  var b = NL.get(id); if (!b || !b.g) return;
  var snap = b.g.slice();
  b.g = b.g.filter(function (x) { return x !== k; }); NL.save(); NL.summary(); NL.refreshRow(id);
  NL.toast('Segnato come verificato.', { label: 'Annulla', fn: function () { var x = NL.get(id); if (x) { x.g = snap; NL.save(); NL.summary(); NL.refreshRow(id); } } });
}
/* modifica nella pagina: i campi dell'app (stessi data-k, quindi salvataggio e controlli di sempre) messi al posto dei dati,
   con la stessa grandezza; quelli vuoti in fondo come «+ Genere», «+ Nota»… */
function editPage(card, v, b, id, gm) {
  var ht = q(v, '.cv-ht'), hero = q(v, '.cv-hero');
  card.classList.add('cv-ed');
  var chp = q(v, '.cv-chips'); if (chp) chp.remove();   // genere, scaffale e serie diventano campi qui sotto
  function fld(k) { return q(card, '.head [data-k="' + k + '"], .meta [data-k="' + k + '"], .more [data-k="' + k + '"], .ser [data-k="' + k + '"], .foot [data-k="' + k + '"]'); }
  function box(k, cls, el, after) {               // contenitore del campo con il suo «da verificare»; scrivendo, il segno sparisce
    var w = document.createElement('span'); w.className = 'cv-in ' + cls; w.appendChild(el);
    if (after) w.insertAdjacentHTML('beforeend', after);
    var gb = gm(k); if (gb) { w.insertAdjacentHTML('beforeend', gb); var bt = w.lastChild; bt.addEventListener('click', function (e) { e.stopPropagation(); verifyK(id, k); }); el.addEventListener('input', function () { if (bt.parentNode) bt.remove(); }, { once: true }); }
    return w;
  }
  var t = fld('t'), e = fld('e'), y = fld('y'), pg = fld('pg'), i = fld('i');
  var a = fld('a');
  if (!a || a.tagName !== 'TEXTAREA') {          // autore gia' scritto: nella scheda ci sono i nomi da toccare; qui serve il campo
    a = document.createElement('textarea'); a.dataset.k = 'a'; a.rows = 1; a.spellcheck = false; a.setAttribute('enterkeyhint', 'done'); a.placeholder = 'Autore'; a.value = b.a || '';
  }
  [t, a, e].forEach(function (x) { if (x) { x.placeholder = { t: 'Titolo', a: 'Autore', e: 'Casa editrice' }[x.dataset.k]; x.setAttribute('aria-label', x.placeholder); } });
  if (y) y.setAttribute('aria-label', 'Anno'); if (pg) pg.setAttribute('aria-label', 'Pagine'); if (i) i.setAttribute('aria-label', 'ISBN');
  var nh = document.createElement('div'); nh.className = 'cv-ht cv-ht-ed';
  if (t) nh.appendChild(box('t', 'cv-in-t', t));
  nh.appendChild(box('a', 'cv-in-a', a));
  if (e) nh.appendChild(box('e', 'cv-in-e', e));
  var line = document.createElement('div'); line.className = 'cv-in-line';
  if (y) line.appendChild(box('y', 'cv-in-y', y));
  if (pg) line.appendChild(box('pg', 'cv-in-pg', pg, '<span class="cv-suf">pagine</span>'));
  if (line.children.length) nh.appendChild(line);
  if (i) { var il = box('i', 'cv-in-i', i); il.insertAdjacentHTML('afterbegin', '<span class="cv-pre">ISBN</span>'); nh.appendChild(il); }
  var rdm = q(ht, '.cv-rdmeta'); if (rdm) nh.appendChild(rdm);   // «Letto il» resta dov'era
  hero.replaceChild(nh, ht);
  /* gli altri dati: pieni come righe da scrivere, vuoti come «+ …» */
  var X = [['gen', 'Genere'], ['sh', 'Scaffale'], ['se', 'Serie o collana'], ['n', 'Nota'], ['c', 'Costo €']];
  var ex = document.createElement('div'); ex.className = 'cv-ex';
  var adds = document.createElement('div'); adds.className = 'cv-adds';
  function row(k, lab) {
    var el = fld(k); if (!el) return null;
    var r = document.createElement('div'); r.className = 'cv-exr cv-exr-' + k;
    r.innerHTML = '<span class="cv-exl">' + esc(lab) + '</span>';
    el.placeholder = lab; el.setAttribute('aria-label', lab);
    r.appendChild(box(k, 'cv-in-x', el));
    if (k === 'se') {
      var sn = fld('sn'), sq = fld('sq'), vw = document.createElement('span'); vw.className = 'cv-vol';   // volume «3 di 5» sotto il nome della serie
      if (sn) { sn.placeholder = 'N.'; sn.setAttribute('aria-label', 'Volume'); vw.appendChild(box('sn', 'cv-in-n', sn)); vw.lastChild.insertAdjacentHTML('afterbegin', '<span class="cv-pre">vol.</span>'); }
      if (sq) { sq.placeholder = '—'; sq.setAttribute('aria-label', 'Volumi in tutto'); vw.appendChild(box('sq', 'cv-in-n', sq)); vw.lastChild.insertAdjacentHTML('afterbegin', '<span class="cv-pre">di</span>'); }
      if (vw.children.length) r.appendChild(vw);
    }
    return r;
  }
  X.forEach(function (p) {
    var k = p[0], el = fld(k); if (!el) return;
    var full = String(el.value || '').trim() || (k === 'se' && (b.sn || b.sq));
    if (full) { ex.appendChild(row(k, p[1])); return; }
    var add = document.createElement('button'); add.type = 'button'; add.className = 'cv-add'; add.textContent = '+ ' + p[1].replace(' €', '');
    add.addEventListener('click', function (ev) {
      ev.stopPropagation();
      var r = row(k, p[1]); ex.appendChild(r);
      if (!ex.parentNode && adds.parentNode) adds.parentNode.insertBefore(ex, adds);   // libro senza genere, scaffale, serie, nota e costo: il riquadro dei dati non era nella pagina e il campo appena aperto spariva (20/11/2026)
      add.remove(); if (!adds.children.length) adds.remove();
      NL.autosize(r); var f = q(r, '[data-k="' + k + '"]'); if (f) f.focus();
    });
    adds.appendChild(add);
  });
  var after = q(v, '.cv-desc') || hero;              // dove nella pagina ci sono genere, scaffale e nota: subito sotto i dati
  var note = q(v, '.cv-note'); if (note) note.remove();
  var rd = q(v, '.cv-strip');
  v.insertBefore(ex, (rd || after).nextSibling);
  if (adds.children.length) v.insertBefore(adds, ex.nextSibling);
  if (!ex.children.length) ex.remove();
  NL.autosize(v);
}
function decorate(el) {
  if (!document.querySelector('.row.cv-full')) lastOpen = null;   // nessuna pagina aperta: la prossima riparte dall'alto
  if (!el) return;
  var cards = el.matches && el.matches('.row.open.has-top') ? [el] : qa(el, '.row.open.has-top');
  cards.forEach(function (card) {
    if (card.dataset.cv) return;
    card.dataset.cv = cur;
    var id = card.dataset.id;
    try { doD(card, id); } catch (e) { if (window.console) console.warn('schede', e); }
  });
}
/* «Letto il»: la data scritta per esteso si aggiorna appena la scegli */
function rdShow(e) {
  var t = e.target; if (!t || t.getAttribute('data-k') !== 'rd') return;
  var sh = t.parentNode && t.parentNode.querySelector('.rd-show'); if (!sh || !NL.rdLong) return;
  sh.firstChild.nodeValue = NL.rdLong(t.value); sh.classList.toggle('none', !t.value);
}
document.addEventListener('input', rdShow, true); document.addEventListener('change', rdShow, true);
NL.on('rows', decorate);
root.setAttribute('data-card', cur);
NL.refresh();
})();
