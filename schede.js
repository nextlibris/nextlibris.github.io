/* Next Libris · modulo «Scheda aperta del libro»: Classica oppure D, «Pagina del libro» (A, B e C provate e tolte il 15/11/2026).
   Modulo a parte: usa solo window.NL (NL.on('rows') dopo ogni disegno delle schede). Si toglie con togli_modulo.py schede:
   resta la scheda di sempre. La scelta sta in 'catalogo-libri-card'. */
(function () {
'use strict';
var NL = window.NL;
if (!NL) return;
var $ = NL.$, esc = NL.esc;
var LS = 'catalogo-libri-card';
var STYLES = [
  { k: 'attuale', t: 'Classica', d: 'Tutti i campi uno sotto l\'altro, da modificare subito.' },
  { k: 'd', t: 'Pagina del libro', d: 'Si legge come una pagina: copertina, dati in una riga, descrizione, lettura. La matita in alto apre i campi.' }
];
/* la pagina del libro e' la scheda dell'app (Piero, 16/11/2026); la classica resta solo per le prove automatiche (localhost) */
var DEF = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'attuale' : 'd';
var cur = DEF;
try { var c0 = JSON.parse(NL.ls.get(LS) || '{}'); if (DEF === 'attuale' && STYLES.some(function (x) { return x.k === c0.v; })) cur = c0.v; } catch (e) { if (window.nlErr) nlErr(e); }   // fuori dalle prove: sempre la pagina del libro
function save() { NL.ls.set(LS, JSON.stringify({ v: cur })); }
var root = document.documentElement;
var editing = {}, descExp = {};                 // per libro: campi aperti, descrizione aperta

function q(el, sel) { return el.querySelector(sel); }
function qa(el, sel) { return Array.prototype.slice.call(el.querySelectorAll(sel)); }

/* D · pagina del libro: si legge; «Modifica» mostra i campi.
   In alto solo icone (preferito, desideri, condividi, elimina), tutte su una riga; Presta e Cerca sul web in fondo, con la scritta. */
function doD(card, id) {
  var b = NL.get(id), head = q(card, '.head');
  if (!b || !head) return;
  dActs(card);
  /* senza titolo: la stessa pagina di tutti i libri (Piero, 19/11/2026: niente piu' i campi da riempire, nemmeno negli amici); si completa con la matita */
  if (editing[id]) { card.classList.add('cv-edit'); addDone(card, id); return; }
  var tit = b.t || 'Senza titolo', img = NL.bigImg(b), dati = [b.e, b.y, b.pg ? b.pg + ' pagine' : '', b.t ? '' : (b.i ? 'ISBN ' + b.i : '')].filter(Boolean);
  var names = NL.authorsOf(b);
  var v = document.createElement('div'); v.className = 'cv-page';
  /* copertina: toccandola si ingrandisce (come nella scheda classica); senza copertina, la cerca online o la fotografi */
  v.innerHTML = '<div class="cv-hero">' + (img ? '<button type="button" class="cv-cov" data-act="zoom" aria-label="Ingrandisci la copertina" title="Ingrandisci la copertina"><img src="' + esc(img) + '" alt="" referrerpolicy="no-referrer"></button>' :
      '<button type="button" class="cv-cov cv-ph" data-act="coverphoto" style="--h:' + NL.hue(b.t + b.a + b.i) + '" title="Cerca la copertina online; se non c\'è, la fotografi" aria-label="Aggiungi la copertina"><span>' + esc(b.t.slice(0, 1)) + '</span><small>' + NL.icon('cam') + 'Copertina</small></button>') +
    '<div class="cv-ht"><h3' + (b.t ? '' : ' class="cv-not"') + '>' + esc(tit) + '</h3>' +
    (names.length ? '<p class="cv-au">' + names.map(function (n) { return '<button type="button" class="au-name" data-act="auinfo" data-n="' + esc(n) + '" title="Info Autore: ' + esc(n) + '">' + esc(n) + '</button>'; }).join('<span class="au-sep">, </span>') + '</p>' : '') +
    (dati.length ? '<p class="cv-meta">' + esc(dati.join(' · ')) + '</p>' : '') + '</div></div>' +
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
  /* etichette-filtro: in fondo, prima di Presta e Cerca sul web */
  if (chips.parentNode) {
    var tags = document.createElement('div'); tags.className = 'cv-tags';
    tags.innerHTML = '<span class="cv-tags-h">' + NL.icon('filt') + 'Vedi tutti i libri di</span>';
    tags.appendChild(chips);
    card.insertBefore(tags, q(card, '.cv-acts2'));
  }
}
function dActs(card) {                            // in alto, solo icone: preferito, desideri, condividi, elimina; in fondo, con la scritta: presta, cerca sul web
  var main = q(card, '.acts-main'); if (!main) return;
  var share = q(card, '.foot .tail [data-act="share"]'), del = q(main, '[data-act="del"]'), move = q(main, '[data-act="towish"], [data-act="tolib"]'), fav = q(main, '[data-act="lc"]') || q(main, '[data-act="fav"]');   // stella, coccarda, desideri (giro 6)
  if (move) main.insertBefore(move, fav ? fav.nextSibling : main.firstChild);
  if (share) main.insertBefore(share, del || null);
  var id = card.dataset.id, b = NL.get(id);
  if (b) {                                        // Modifica (anche per i libri senza titolo): icona della matita in alto, accanto alle altre
    var ed = document.createElement('button'); ed.type = 'button'; ed.className = 'ico act cv-editb' + (editing[id] ? ' on' : '');
    ed.title = editing[id] ? 'Fatto: torna alla pagina del libro' : 'Modifica i dati del libro'; ed.setAttribute('aria-label', ed.title); ed.setAttribute('aria-pressed', editing[id] ? 'true' : 'false');
    ed.innerHTML = NL.icon('pen') + '<span class="al" aria-hidden="true">Modifica</span>';
    ed.addEventListener('click', function (e) { e.stopPropagation(); if (editing[id]) delete editing[id]; else editing[id] = true; NL.refreshRow(id); });
    main.insertBefore(ed, del || null);
  }
  var low = ['loan', 'websearch'].map(function (a) { return q(main, '[data-act="' + a + '"]'); }).filter(Boolean);
  var redo = q(card, '.foot .tail [data-act="lookup"]'); if (redo) low.unshift(redo);   // senza titolo: «Cerca di nuovo» resta raggiungibile
  if (!low.length) return;
  var row = document.createElement('div'); row.className = 'cv-acts2';
  low.forEach(function (x) { row.appendChild(x); });
  card.appendChild(row);                          // in fondo alla scheda
}
function addDone(card, id) {
  var top = q(card, '.head'); if (!top) return;
  var d = document.createElement('button'); d.type = 'button'; d.className = 'btn primary cv-done'; d.textContent = 'Fatto';
  d.addEventListener('click', function (e) { e.stopPropagation(); delete editing[id]; NL.refreshRow(id); });
  top.parentNode.insertBefore(d, top);
}

function decorate(el) {
  if (cur === 'attuale' || !el) return;
  var cards = el.matches && el.matches('.row.open.has-top') ? [el] : qa(el, '.row.open.has-top');
  cards.forEach(function (card) {
    if (card.dataset.cv) return;
    card.dataset.cv = cur;
    var id = card.dataset.id;
    try { if (cur === 'd') doD(card, id); } catch (e) { if (window.console) console.warn('schede', e); }
  });
}
function apply() { root.setAttribute('data-card', cur); NL.refresh(); }
/* «Letto il»: la data scritta per esteso si aggiorna appena la scegli */
function rdShow(e) {
  var t = e.target; if (!t || t.getAttribute('data-k') !== 'rd') return;
  var sh = t.parentNode && t.parentNode.querySelector('.rd-show'); if (!sh || !NL.rdLong) return;
  sh.firstChild.nodeValue = NL.rdLong(t.value); sh.classList.toggle('none', !t.value);
}
document.addEventListener('input', rdShow, true); document.addEventListener('change', rdShow, true);
NL.on('rows', decorate);
root.setAttribute('data-card', cur);
if (cur !== 'attuale') NL.refresh();
window.NLCard = { get: function () { return cur; }, set: function (v) { cur = v; save(); apply(); }, list: STYLES };
})();
