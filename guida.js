/* Next Libris · modulo «Come si usa»: guida di primo avvio e libreria di esempio (giro 4, 18/11/2026).
   Modulo a parte: usa solo window.NL. Per toglierlo: cancellare guida.js e guida.css e le loro righe in index.html e in SHELL di sw.js
   (togli_modulo.py, nel ramo prove). Dati suoi: 'catalogo-libri-guida' ({ seen: 1 } quando la guida è stata vista).
   - Otto schermate da sfogliare col dito, con un tocco ai lati dello schermo o con i tasti; «Salta» sempre in vista. Si apre da sola una volta,
     ai nuovi e a chi usa già l'app (al primo avvio dopo l'aggiornamento: cfg.v < GV). Si riapre da Menu › Info e aiuto › Come si usa.
   - «Prova adesso» apre la parte vera dell'app; nelle schermate 4, 5 e 6 apre la libreria di esempio.
   - Libreria di esempio: la modalità ospite dell'app (NL.guestEnter con info.esempio): solo da guardare, niente salvataggi né sincronizzazione,
     mai mescolata con i libri veri, fuori dalle statistiche. Zero chiamate: nessuna ricerca, niente Wikipedia/Wikidata (paesi e film sono
     scritti qui sotto), copertine disegnate dall'app, descrizioni brevi scritte da noi.
   REGOLA (Piero, 18/11/2026): a ogni versione vera la guida si aggiorna con le funzioni nuove (testi, «Prova adesso», prova e2e123). */
(function () {
'use strict';
var NL = window.NL;
if (!NL || !NL.guestEnter) return;
var L = NL.L, esc = NL.esc, $ = NL.$;
var LS = 'catalogo-libri-guida';
var GV = 3;                                               // versione della guida: 2 = otto schermate (giro 5); chi ha visto una versione più vecchia la rivede una volta
var cfg = {};
try { cfg = JSON.parse(NL.ls.get(LS) || '{}') || {}; } catch (e) { cfg = {}; }
function save() { NL.ls.set(LS, JSON.stringify(cfg)); }

/* ---------- le nove schermate (testi approvati da Piero il 18/11/2026; giro 5: «Aggiungi i libri» riscritta e «Trova più libri» nuova; giro 7: Prestiti e Desideri separati) ---------- */
var S = [
  { ico: 'tolib', h: 'Benvenuto',
    p: ['Next Libris è la tua libreria in tasca: i libri che hai, quelli che leggi e quelli che desideri.', 'È gratuita; se ti piace, puoi sostenerla.'] },
  { ico: 'scan', h: 'Aggiungi i libri', go: 'add', sel: '#layNav [data-l="add"], #btnScan',   // testo riscritto (giro 5)
    p: ['Tocca il <b>+</b> in basso e scegli come: <b>Scansiona</b> il codice a barre sul retro, <b>Fotografa</b> la copertina o <b>Digita</b> il titolo.',
      'Con <b>Per autore</b> trovi tutti i libri di uno scrittore. In negozio, <b>Ce l\'ho già?</b> ti dice se un libro ce l\'hai già.'] },
  { ico: 'gear', h: 'Trova più libri (facoltativo)', go: 'key', btn: 'Crea la chiave',   // schermata nuova: chiave e worker (giro 5)
    p: ['Next Libris cerca i libri in archivi gratuiti. Se vuoi trovarne di più, con copertine e descrizioni, puoi creare gratis una <b>chiave Google Libri</b>: ci vogliono 5 minuti e ti guidiamo passo passo.',
      'Se un amico ti presta la sua, non devi crearla.'] },   // giro 10: niente parole tecniche (via il worker)
  { ico: 'fav', h: 'La pagina del libro', go: 'book',
    p: ['Tocca un libro per aprirlo. Segna se lo stai leggendo o l\'hai già letto, dagli un voto con i <b>libricini</b> e tieni il segno con il <b>segnalibro</b>. Con la <b>stella</b> dici che lo consigli: gli amici lo vedono nel tuo profilo.',
      'La <b>matita</b> serve a correggere i dati. Se dal libro hanno tratto un film o una serie, lo trovi qui.'] },
  { ico: 'search', h: 'Trova e ordina', go: 'sort', sel: '#q, #sortBar',
    p: ['Cerca per titolo o autore, usa i <b>Filtri</b> e <b>Ordina · Raggruppa</b> (per autore, genere, paese…). Scegli tra copertine ed elenco; sulle copertine <b>due dita</b> le ingrandiscono o le rimpiccioliscono.',
      'Serie e copie dello stesso libro stanno insieme. Tocca il nome di un autore per <b>Info Autore</b>.'] },
  { ico: 'loan', h: 'Prestiti', go: 'loan',   // giro 7: Prestiti e Desideri in due schermate (testi approvati da Piero il 18/11/2026)
    p: ['Tieni il conto dei libri che presti e di quelli che ti prestano. Quando ridai un libro a un amico, tocca <b>Restituiscilo</b>; quando un tuo libro torna a casa, tocca <b>È tornato</b>.'] },
  { ico: 'towish', h: 'Desideri', go: 'wish',
    p: ['Metti nei <b>Desideri</b> i libri che vorresti leggere. Gli amici possono vederli e trovare l\'idea giusta per un regalo. Se un amico ce l\'ha già, te lo diciamo: magari ve lo prestate.'] },
  { ico: 'user', h: 'Amici e profilo', go: 'friends', mod: 'NLAmici',
    p: ['Con <b>Accedi con Google</b> i tuoi libri si salvano anche online e puoi trovare gli amici per nome. Guarda le loro librerie, chiedi <b>Me lo presti?</b> e segui i loro desideri.',
      'La <b>campanella</b> ti avvisa delle novità; con il <b>fumetto</b> 💬 scrivi agli amici, anche in gruppo, e vi mandate i libri. Tocca il tuo nome in alto per vedere il tuo <b>profilo</b>.'] },
  { ico: 'tolib', h: 'Installala sul telefono', go: 'inst', btn: 'Installa', inst: true,   // giro 10: solo nel browser, se non è installata
    p: ['Metti Next Libris tra le app del telefono: si apre con un tocco, come le altre, e funziona anche senza internet.'],
    ios: ['Metti Next Libris tra le app del telefono: si apre con un tocco, come le altre, e funziona anche senza internet.', 'Tocca <b>Condividi</b> in basso, poi <b>Aggiungi alla schermata Home</b>.'] },
  { ico: 'chart', h: 'Per te', go: 'don', btn: 'Sostieni Next Libris',   // Sostieni (Piero, 18/11/2026)
   
    p: ['Suggerimenti sui tuoi autori, novità, film tratti dai tuoi libri, statistiche e <b>La tua stagione in libri</b>.', 'Ogni tanto ti ricordiamo di fare una <b>copia di sicurezza</b> dei tuoi libri: con un tocco la mandi su Drive, WhatsApp o email, foto comprese.', 'Next Libris è gratis per tutti: se ti piace, puoi sostenerla.'],
    end: 'Rivedi questa guida quando vuoi: Menu › Info e aiuto › <b>Come si usa</b>.' }
];
/* per la prova e2e123: ogni schermata dice quale parte dell'app deve esistere */
function screens() { return S.filter(function (s) { return (!s.mod || window[s.mod]) && (!s.inst || (NL.inst && !NL.inst.standalone())); }); }
function ios(s) { return s.inst && NL.inst && NL.inst.kind() === 'ios'; }

/* ---------- la guida ---------- */
var G = { el: null, i: 0, pushed: false, back: null };
function build() {
  if (G.el) return;
  var el = document.createElement('div');
  el.id = 'guida'; el.className = 'guida'; el.hidden = true;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Come si usa Next Libris');
  el.innerHTML = '<div class="gd-top"><div class="gd-prog" id="gdProg" aria-hidden="true"></div><button type="button" class="gd-skip" data-gd="skip">Salta</button></div>' +
    '<div class="gd-stage" id="gdStage" aria-live="polite"></div>' +
    '<div class="gd-nav"><button type="button" class="gd-btn" data-gd="prev">‹ Indietro</button><span class="gd-n" id="gdN"></span><button type="button" class="gd-btn gd-next" data-gd="next">Avanti ›</button></div>';
  document.body.appendChild(el);
  G.el = el;
  el.addEventListener('click', function (e) {
    var b = e.target.closest('[data-gd]'); if (!b) return;
    var a = b.dataset.gd;
    if (a === 'skip') close();
    else if (a === 'prev') go(G.i - 1);
    else if (a === 'next') { if (G.i >= screens().length - 1) close(); else go(G.i + 1); }
    else if (a === 'try') tryIt(b.dataset.go);
  });
  /* sfogliare col dito, come «La tua stagione in libri» */
  var x0 = null, y0 = 0;
  el.addEventListener('pointerdown', function (e) { if (e.pointerType === 'mouse' && e.button !== 0) return; x0 = e.clientX; y0 = e.clientY; });
  el.addEventListener('pointerup', function (e) {
    if (x0 == null) return;
    var dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) { go(G.i + (dx < 0 ? 1 : -1)); return; }
    /* tocco ai lati dello schermo (un quarto a sinistra / a destra), non su tasti o link: indietro / avanti (giro 5) */
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && !(e.target.closest && e.target.closest('button, a, input, label'))) {
      var w = window.innerWidth || 360;
      if (e.clientX < w * 0.25) go(G.i - 1);
      else if (e.clientX > w * 0.75) { if (G.i >= screens().length - 1) close(); else go(G.i + 1); }
    }
  });
  el.addEventListener('pointercancel', function () { x0 = null; });
}
function paint() {
  var list = screens(), s = list[G.i], n = list.length;
  $('#gdProg').innerHTML = list.map(function (x, k) { return '<span class="' + (k <= G.i ? 'on' : '') + '"></span>'; }).join('');
  var tries = s.go && !ios(s) ? '<button type="button" class="btn primary gd-try" data-gd="try" data-go="' + s.go + '">' + esc(s.btn || 'Prova adesso') + '</button>' : '';
  var more = s.more ? '<p class="gd-more">' + esc(s.more.t) + ' <button type="button" class="gd-link" data-gd="try" data-go="' + s.more.go + '">Prova adesso ›</button></p>' : '';
  var ex = /^(book|sort|wish|loan)$/.test(s.go || '') ? '<p class="gd-ex">Si apre una libreria di esempio: solo da guardare.</p>' : '';
  $('#gdStage').innerHTML = '<div class="gd-slide" data-gs="' + G.i + '"><span class="gd-ico" aria-hidden="true">' + NL.icon(s.ico) + '</span>' +
    '<h2 class="gd-h">' + esc(s.h) + '</h2>' + (ios(s) ? s.ios : s.p).map(function (t) { return '<p class="gd-p">' + t + '</p>'; }).join('') +
    more + (tries ? '<div class="gd-acts">' + tries + '</div>' + ex : '') + (s.end ? '<p class="gd-end">' + s.end + '</p>' : '') + '</div>';
  $('#gdN').textContent = (G.i + 1) + ' di ' + n;
  G.el.querySelector('[data-gd="prev"]').disabled = G.i === 0;
  var nx = G.el.querySelector('[data-gd="next"]'); nx.textContent = G.i >= n - 1 ? 'Inizia' : 'Avanti ›';
}
function go(i) { if (i < 0 || i >= screens().length) return; G.i = i; paint(); }
function open(i) {
  if (NL.guest && NL.guest()) NL.guestExit();
  if (pillShown() && !P.want) pillOff();
  build();
  G.back = document.activeElement;
  G.i = Math.max(0, Math.min(i || 0, screens().length - 1));
  paint();
  G.el.hidden = false; document.body.classList.add('guida-open');
  if (!cfg.seen || (cfg.v || 1) < GV) { cfg.seen = 1; cfg.v = GV; save(); }
  if (!G.pushed) { try { history.pushState({ guida: 1 }, ''); G.pushed = true; } catch (e) { if (window.nlErr) nlErr(e); } }
  setTimeout(function () { try { G.el.querySelector('.gd-next').focus({ preventScroll: true }); } catch (e) { if (window.nlErr) nlErr(e); } }, 30);
}
function close(fromPop, keepFocus) {
  if (!G.el || G.el.hidden) return;
  G.el.hidden = true; document.body.classList.remove('guida-open');
  if (G.pushed) { G.pushed = false; if (!fromPop) { try { history.back(); } catch (e) { if (window.nlErr) nlErr(e); } } }
  if (!keepFocus) { try { if (G.back) G.back.focus({ preventScroll: true }); } catch (e) { if (window.nlErr) nlErr(e); } }
}
window.addEventListener('popstate', function () { if (G.el && !G.el.hidden) { G.pushed = false; close(true); } });
window.addEventListener('keydown', function (e) {
  if (!G.el || G.el.hidden) return;
  if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); close(); }
  else if (e.key === 'ArrowRight') { e.stopImmediatePropagation(); go(G.i + 1); }
  else if (e.key === 'ArrowLeft') { e.stopImmediatePropagation(); go(G.i - 1); }
}, true);

/* «Prova adesso»: chiude la guida e apre la parte vera (dopo che Indietro ha tolto la guida dalla cronologia) */
var fromGuide = -1;
function tryIt(what) {
  if (what === 'inst') { close(); if (NL.inst) NL.inst.go(); return; }   // giro 10: installa e chiude la guida
  var at = G.i;
  close(false, true);
  var real = what === 'add' || what === 'key' || what === 'friends' || what === 'don';
  setTimeout(function () {
    if (what === 'key' || what === 'don' || what === 'friends') enter(at, '');   // dietro c'è l'esempio, non la tua libreria (Piero, 18/11/2026)
    if (real) pillOn(at); else pillOn(at, true);      // anche nell'esempio Indietro riporta alla guida (posto {gdp} senza pillola: c'è «‹ Guida»)
    if (real) setTimeout(function () { watch({ add: '#layAdd', key: '#kgSheet', don: '#donSheet', friends: '#friSheet' }[what]); }, 120);
    if (what === 'add') {
      var plus = document.querySelector('#layNav [data-l="add"]');
      if (plus && plus.getClientRects().length) plus.click();
      else { var d = document.getElementById('btnScan'); if (d) { d.scrollIntoView({ block: 'center' }); try { d.focus({ preventScroll: true }); } catch (e) { if (window.nlErr) nlErr(e); } } }   // disposizione «Classico»: Scansiona, Foto e Digita in basso
    } else if (what === 'key') {
      if (window.NLRicerche && window.NLRicerche.guide) window.NLRicerche.guide();
      else if (NL.openOptions) NL.openOptions('search');
    } else if (what === 'don') {
      if (NL.openDon) NL.openDon();
    } else if (what === 'friends') {
      if (window.NLAmici && window.NLAmici.open) window.NLAmici.open();
    } else if (what === 'book' || what === 'sort' || what === 'wish' || what === 'loan') {
      enter(at, what);
    }
  }, 60);
}
/* chiusa la finestra aperta da «Prova adesso» (Più tardi, Chiudi, ×), si torna da soli alla guida: se nel frattempo se ne
   è aperta un'altra (la fotocamera, «Presta a …»), si aspetta quella */
function watch(sel) {
  var w = sel && document.querySelector(sel); if (!w || w.hidden) return;
  var mo = new MutationObserver(function () {
    if (!w.hidden) return;
    mo.disconnect();
    setTimeout(function wait() {
      if (!pillShown() || P.want) return;
      if (document.querySelector('.sheet:not([hidden]), .lightbox:not([hidden])') || document.body.classList.contains('scanning')) { setTimeout(wait, 500); return; }
      back(true);
    }, 350);
  });
  mo.observe(w, { attributes: true, attributeFilter: ['hidden'] });
}


/* ---------- pillola «‹ Torna alla guida · 3/9» (giro 7) ----------
   Dopo «Prova adesso» sulle parti vere (+, chiave, amici) resta in basso a destra. Si torna alla guida con la pillola o con
   Indietro del telefono: sotto la parte aperta c'è un posto nella cronologia ({gdp}); quando Indietro lo toglie, la guida si riapre
   dalla schermata di prima. Se la parte aperta ha una cronologia sua (fotocamera), il primo Indietro chiude quella. */
var P = { el: null, at: -1, want: false, quiet: false, on: false, silent: false };
function pillOn(at, silent) {
  P.at = at; P.on = true; P.silent = !!silent;
  if (!P.el) {
    P.el = document.createElement('div'); P.el.id = 'gdPill'; P.el.className = 'gd-pill';
    P.el.innerHTML = '<button type="button" class="gd-pill-go" data-gp="go"></button><button type="button" class="gd-pill-x" data-gp="x" aria-label="Chiudi: resta qui">' + NL.icon('x') + '</button>';
    document.body.appendChild(P.el);
    P.el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-gp]'); if (!b) return;
      if (b.dataset.gp === 'go') back(true); else back(false);
    });
  }
  P.el.querySelector('.gd-pill-go').innerHTML = '‹ Torna alla guida <span>· ' + (at + 1) + '/' + screens().length + '</span>';
  P.el.hidden = !!silent; document.body.classList.toggle('gd-pill-on', !silent);
  try { history.pushState({ gdp: 1 }, ''); } catch (e) { if (window.nlErr) nlErr(e); }
}
function pillOff() { if (P.el) P.el.hidden = true; document.body.classList.remove('gd-pill-on'); P.at = -1; P.want = false; P.quiet = false; P.on = false; P.silent = false; }
function pillShown() { return P.on; }   // attiva anche senza pillola in vista (nella libreria di esempio)
/* toglie i posti della cronologia fino a sotto {gdp}; poi riapre la guida (go) o resta dove si è (✕) */
function back(go) { if (!pillShown()) return; P.want = true; P.quiet = !go; try { history.back(); } catch (e) { if (window.nlErr) nlErr(e); reopen(); } }
function reopen() {
  var at = P.at, quiet = P.quiet; pillOff();
  if (quiet) return;
  if (document.querySelector('.sheet:not([hidden]), .lightbox:not([hidden])')) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));   // finestre senza cronologia (+, amici, chiave)
  setTimeout(function () { if (document.querySelector('.sheet:not([hidden])')) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); open(at < 0 ? 0 : at); }, 30);
}
window.addEventListener('popstate', function (e) {
  if (!pillShown()) return;
  setTimeout(function () {                         // dopo le altre finestre, che si chiudono con il loro «popstate»
    if (!pillShown()) return;
    var st = history.state;
    if (st && st.gdp) { if (P.want) { try { history.back(); } catch (x) { reopen(); } } return; }   // una finestra sopra si è chiusa: la pillola resta
    reopen();
  }, 0);
});
NL.on('guest', function () {
  if (!pillShown() || P.want) return;
  var ex = NL.esempio && NL.esempio();
  if (P.el) { P.el.hidden = P.silent || !!ex; document.body.classList.toggle('gd-pill-on', !P.el.hidden); }   // nell'esempio basta «‹ Guida» nella striscia
  if (NL.guest && NL.guest() && !ex) pillOff();      // la libreria di un amico vero: niente più ritorno alla guida
  else if (!ex && P.silent) pillOff();               // «Esci» dall'esempio
});

/* ---------- la libreria di esempio ---------- */
var D = '2026-';
function bk(k, o) { return Object.assign({ id: 'ex' + k, ts: Date.parse(D + '01-01') - k * 864e5, g: [], c: null }, o); }
/* libri: classici, più García Márquez e Asimov (scelta di Piero); solo titolo, autore e dati; descrizioni nostre */
var BOOKS = [
  bk(1, { t: 'I promessi sposi', a: 'Alessandro Manzoni', e: 'Mondadori', y: '2002', pg: '720', gen: 'Romanzo storico', rs: 'ok', rt: 5, rd: D + '03-10', fav: true, lc: true,
    qs: [{ x: 'Quel ramo del lago di Como, che volge a mezzogiorno, tra due catene non interrotte di monti…', pg: '1', d: 3, pin: true }],
    ds: 'Renzo e Lucia vogliono sposarsi, ma un signorotto prepotente lo impedisce. Tra fughe, peste e carestia, la loro storia attraversa la Lombardia del Seicento.' }),
  bk(2, { t: 'I promessi sposi', a: 'Alessandro Manzoni', e: 'Einaudi', y: '2014', pg: '880', gen: 'Romanzo storico',
    ds: 'La stessa storia in un\'altra edizione, con note e commento: le due copie stanno insieme sotto un solo libro.' }),
  bk(3, { t: 'Il fu Mattia Pascal', a: 'Luigi Pirandello', e: 'Feltrinelli', y: '2015', pg: '280', gen: 'Romanzo', rs: 'in', pp: '112',
    ds: 'Un uomo legge sul giornale della propria morte e decide di approfittarne per ricominciare da capo con un altro nome.' }),
  bk(4, { t: 'Le avventure di Pinocchio', a: 'Carlo Collodi', e: 'Giunti', y: '2019', pg: '240', gen: 'Per ragazzi', rs: 'ok', rt: 4, rd: D + '01-22', lc: true,
    qs: [{ x: 'C\'era una volta… un pezzo di legno.', pg: '7', d: 2, pin: true }], p: 'Marta', pd: D + '10-02',
    ds: 'Il burattino di legno che vorrebbe diventare un bambino vero, tra bugie, cattive compagnie e un padre che non smette di cercarlo.' }),
  bk(5, { t: 'Anna Karenina', a: 'Lev Tolstoj', e: 'Garzanti', y: '2008', pg: '960', gen: 'Romanzo', rs: 'ok', rt: 4, rd: D + '07-15',
    ds: 'Nella Russia dell\'Ottocento, una donna sceglie l\'amore contro le regole della sua società, mentre accanto a lei altre vite cercano la loro strada.' }),
  bk(6, { t: 'Orgoglio e pregiudizio', a: 'Jane Austen', e: 'Rizzoli', y: '2011', pg: '400', gen: 'Romanzo', rs: 'da',
    ds: 'Elizabeth Bennet e il signor Darcy partono col piede sbagliato: una commedia di prime impressioni, famiglie e matrimoni nell\'Inghilterra di campagna.' }),
  bk(7, { t: 'Cent\'anni di solitudine', a: 'Gabriel García Márquez', e: 'Mondadori', y: '2017', pg: '380', gen: 'Realismo magico', rs: 'ok', rt: 5, rd: D + '05-04', fav: true,
    ds: 'Sette generazioni della famiglia Buendía nel paese immaginario di Macondo, dove il prodigioso e il quotidiano convivono senza stupore.' }),
  bk(8, { t: 'Cronaca di una morte annunciata', a: 'Gabriel García Márquez', e: 'Mondadori', y: '2014', pg: '120', gen: 'Romanzo',
    ds: 'Tutto il paese sa che un uomo sta per essere ucciso, eppure nessuno riesce a fermare quello che accade: una ricostruzione all\'indietro.' }),
  bk(9, { t: 'Fondazione', a: 'Isaac Asimov', e: 'Mondadori', y: '2016', pg: '260', gen: 'Fantascienza', se: 'Ciclo della Fondazione', sn: '1', rs: 'ok', rt: 4, rd: D + '08-30',
    ds: 'Un matematico prevede la caduta dell\'Impero galattico e mette in piedi un piano per accorciare i secoli bui che verranno.' }),
  bk(10, { t: 'Fondazione e Impero', a: 'Isaac Asimov', e: 'Mondadori', y: '2016', pg: '280', gen: 'Fantascienza', se: 'Ciclo della Fondazione', sn: '2',
    ds: 'Il piano deve fare i conti con un nemico che nessuno aveva previsto.' }),
  bk(11, { t: 'Seconda Fondazione', a: 'Isaac Asimov', e: 'Mondadori', y: '2017', pg: '270', gen: 'Fantascienza', se: 'Ciclo della Fondazione', sn: '3',
    ds: 'La ricerca di una seconda Fondazione nascosta chiude la prima trilogia del ciclo.' }),
  bk(12, { t: 'Il Gattopardo', a: 'Giuseppe Tomasi di Lampedusa', e: 'Feltrinelli', y: '2018', pg: '330', gen: 'Romanzo storico', w: true,
    ds: 'In Sicilia, mentre arrivano i garibaldini, un principe osserva la fine del suo mondo e capisce che tutto deve cambiare perché nulla cambi.' })
];
/* paesi e film già scritti: nessuna domanda a Wikidata (formato di app-wiki.js: c paese, b paese di nascita, f film; k = titolo del libro) */
function wdData() {
  function f(t, y, d, s, book) { var tk = L.titleKey(book), full = L.norm(book).replace(/[^a-z0-9]+/g, ' ').trim(); return { q: 'ex-' + L.norm(t + y).replace(/[^a-z0-9]+/g, ''), t: t, y: y, d: d, s: s ? 1 : 0, u: '', k: [tk, full] }; }
  var now = Date.now();
  return { '~v': 1,
    'alessandro manzoni': { q: 'ex1', c: 'IT', t: now, f: [f('I promessi sposi', 1941, 'Mario Camerini', 0, 'I promessi sposi'), f('I promessi sposi', 1989, 'Salvatore Nocita', 1, 'I promessi sposi')] },
    'luigi pirandello': { q: 'ex2', c: 'IT', t: now, f: [f('Le due vite di Mattia Pascal', 1985, 'Mario Monicelli', 0, 'Il fu Mattia Pascal')] },
    'carlo collodi': { q: 'ex3', c: 'IT', t: now, f: [f('Le avventure di Pinocchio', 1972, 'Luigi Comencini', 1, 'Le avventure di Pinocchio'), f('Pinocchio', 2019, 'Matteo Garrone', 0, 'Le avventure di Pinocchio')] },
    'lev tolstoj': { q: 'ex4', c: 'RU', t: now, f: [f('Anna Karenina', 2012, 'Joe Wright', 0, 'Anna Karenina')] },
    'jane austen': { q: 'ex5', c: 'GB', t: now, f: [f('Orgoglio e pregiudizio', 2005, 'Joe Wright', 0, 'Orgoglio e pregiudizio'), f('Orgoglio e pregiudizio', 1995, 'Simon Langton', 1, 'Orgoglio e pregiudizio')] },
    'gabriel garcia marquez': { q: 'ex6', c: 'CO', t: now, f: [f('Cent\'anni di solitudine', 2024, '', 1, 'Cent\'anni di solitudine'), f('Cronaca di una morte annunciata', 1987, 'Francesco Rosi', 0, 'Cronaca di una morte annunciata')] },
    'isaac asimov': { q: 'ex7', c: 'US', b: 'RU', t: now, f: [f('Foundation', 2021, '', 1, 'Fondazione')] },
    'giuseppe tomasi di lampedusa': { q: 'ex8', c: 'IT', t: now, f: [f('Il Gattopardo', 1963, 'Luchino Visconti', 0, 'Il Gattopardo')] }
  };
}
function wdFix(m) {                       // le chiavi come le calcola l'app (wdKey: nome normalizzato)
  var out = { '~v': m['~v'] };
  Object.keys(m).forEach(function (k) { if (k.charAt(0) !== '~') out[L.norm(k)] = m[k]; });
  return out;
}
function enter(at, what) {
  fromGuide = at == null ? -1 : at;
  var books = BOOKS.map(function (b) { return Object.assign({}, b); });
  var ok = NL.guestEnter('esempio', books, { esempio: true, wd: wdFix(wdData()), empty: { lib: 'Nessun libro da mostrare.', wish: 'Nessun desiderio da mostrare.' } });
  if (ok === false) return;
  bar();
  if (what === 'book') NL.openCard('ex7');
  else if (what === 'loan') NL.openCard('ex4');   // Pinocchio, prestato a Marta
  else if (what === 'wish') { NL.setTab('wish'); bar(); window.scrollTo({ top: 0 }); }
  else if (what === 'sort') {
    var sb = $('#sortBar'); if (sb) { sb.scrollIntoView({ block: 'center' }); sb.classList.add('gd-flash'); setTimeout(function () { sb.classList.remove('gd-flash'); }, 2200); }
  }
}
/* striscia «Libreria di esempio · Esci» */
function bar() {
  var on = NL.esempio && NL.esempio(), el = document.getElementById('exBar');
  if (!on) { if (el) el.hidden = true; return; }
  if (!el) {
    var top = document.querySelector('header.top'); if (!top) return;
    el = document.createElement('section'); el.id = 'exBar'; el.className = 'ex-bar';
    top.parentNode.insertBefore(el, top.nextSibling);
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ex]'); if (!b) return;
      if (b.dataset.ex === 'out') NL.guestExit();
      else if (b.dataset.ex === 'guide') { if (pillShown()) back(true); else { var i = fromGuide; NL.guestExit(); open(i < 0 ? 0 : i); } }
      else if (b.dataset.ex === 'tab') { if (NL.tab() !== b.dataset.t) { NL.setTab(b.dataset.t); window.scrollTo({ top: 0 }); } bar(); }
    });
  }
  el.hidden = false;
  var all = NL.books(), nl = all.filter(function (b) { return !b.w; }).length, nw = all.length - nl, t = NL.tab();
  el.innerHTML = '<p class="ex-h">Solo da guardare: <b>i tuoi libri non cambiano</b>.</p>' +
    '<div class="ex-row"><div class="chips ex-tabs">' +
      '<button type="button" class="chip" data-ex="tab" data-t="lib" aria-pressed="' + (t !== 'wish') + '">Libreria · ' + nl + '</button>' +
      '<button type="button" class="chip" data-ex="tab" data-t="wish" aria-pressed="' + (t === 'wish') + '">Desideri · ' + nw + '</button></div>' +
    '<span class="ex-go">' + (fromGuide >= 0 ? '<button type="button" class="link" data-ex="guide">‹ Guida</button>' : '') +
    '<button type="button" class="btn sm" data-ex="out">Esci</button></span></div>';
}
NL.on('guest', function () { bar(); });
/* nell'esempio si guarda soltanto: stella, libricini, matita e gli altri tasti rispondono con un avviso */
var FREE = { toggle: 1, zoom: 1, facet: 1, serall: 1, descmore: 1, websearch: 1, clearflt: 1, auinfo: 1 };   // auinfo: lo ferma openAuthor con il suo avviso
var tWarn = 0;
function warn() { var t = Date.now(); if (t - tWarn < 1200) return; tWarn = t; NL.toast('È solo un esempio: prova con i tuoi libri.'); }
function stopped(e) {
  if (!(NL.esempio && NL.esempio())) return null;
  var t = e.target; if (!t.closest || !t.closest('#list')) return null;
  var x = t.closest('input, textarea, select, [contenteditable], .cv-editb, [data-act]');
  if (!x) return null;
  if (x.dataset && x.dataset.act && FREE[x.dataset.act]) return null;
  return x;
}
document.addEventListener('mousedown', function (e) { if (stopped(e)) e.preventDefault(); }, true);   // niente tastiera
document.addEventListener('click', function (e) { if (!stopped(e)) return; e.preventDefault(); e.stopImmediatePropagation(); warn(); }, true);
document.addEventListener('focusin', function (e) { if (!stopped(e)) return; try { e.target.blur(); } catch (x) { /* niente */ } warn(); }, true);
document.addEventListener('change', function (e) { if (stopped(e)) { e.stopImmediatePropagation(); } }, true);

/* ---------- Menu › Info e aiuto: «Come si usa» e «Guarda una libreria di esempio» ---------- */
function menu() {
  var list = document.getElementById('infoList'); if (!list || document.getElementById('goGuida')) return;
  var a = document.createElement('button'); a.type = 'button'; a.className = 'dopt'; a.id = 'goGuida';
  a.innerHTML = '<span><b>Come si usa</b><small>La guida passo passo</small></span><span class="n" aria-hidden="true">›</span>';
  var b = document.createElement('button'); b.type = 'button'; b.className = 'dopt'; b.id = 'goEsempio';
  b.innerHTML = '<span><b>Guarda una libreria di esempio</b><small>Prova l\'app senza i tuoi libri</small></span><span class="n" aria-hidden="true">›</span>';
  // indirizzo ufficiale (Piero, 18/11/2026): contro le copie dell'app ad altri indirizzi
  var u = document.createElement('p'); u.className = 'gd-uff'; u.id = 'nlUfficiale';
  u.innerHTML = 'Next Libris è solo su <b>nextlibris.github.io</b>. Una copia a un altro indirizzo non è nostra: non darle la tua chiave né i tuoi dati.';
  list.insertBefore(b, list.firstChild); list.insertBefore(a, b); list.appendChild(u);   // giro 10: la frase sull'indirizzo in fondo a Info e aiuto
  a.addEventListener('click', function () { NL.fromMenu(function () { open(0); }); });
  b.addEventListener('click', function () { NL.fromMenu(function () { enter(-1, ''); }); });
  var sm = document.querySelector('#goInfo small'); if (sm) sm.textContent = 'Guida, condividi, installa, contatti';
}
menu();

/* prima apertura in assoluto: la guida si apre da sola (dopo la schermata d'apertura) */
/* si apre da sola una volta: ai nuovi e, dal giro 5, anche a chi usa già l'app, al primo avvio dopo l'aggiornamento (GV = versione della guida) */
function due() { return !cfg.seen || (cfg.v || 1) < GV; }
if (due() && !/[?&]amico=|#k=/.test(location.search + location.hash)) setTimeout(function () { if (due() && !(NL.guest && NL.guest())) open(0); }, 900);

window.NLGuida = { open: open, close: close, esempio: function (what) { enter(-1, what || ''); }, screens: function () { return screens().map(function (s) { return { h: s.h, go: s.go || '', sel: s.sel || '', mod: s.mod || '' }; }); } };
})();
