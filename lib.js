/* Logica pura del catalogo: ISBN, ricerca nelle banche dati, lettura della copertina, export.
   Nessun accesso al DOM, così si può provare da riga di comando. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Lib = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- testo e numeri ---------- */
  function str(v) { return typeof v === 'string' ? v : (typeof v === 'number' && isFinite(v) ? String(v) : ''); }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function parseNum(s) {
    s = String(s == null ? '' : s).replace(/[^\d,.\-]/g, '');
    if (!s) return null;
    if (s.indexOf(',') >= 0 && s.indexOf('.') >= 0) {
      s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    } else {
      s = s.replace(',', '.');
    }
    var n = parseFloat(s);
    return isFinite(n) ? n : null;
  }
  function fmtNum(n) { return n.toFixed(2).replace('.', ','); }
  function sortKeyTitle(t) { return norm(t).replace(/^(?:(?:il|lo|la|i|gli|le|un|uno|una|the|a|an)\s+|l['’]\s*)/, '').trim(); }
  /* Autore «Nome Cognome» diviso in cognome e nome (Piero, 17/11/2026 notte). cut = parole del cognome scelte a mano
     (0 = lasciarlo com'è, senza cognome). Particelle: maiuscole (De Amicis, Da Ponte) fanno parte del cognome e dell'ordine;
     minuscole (van, von, de, du, di) restano col nome nell'ordine: «Beethoven, Ludwig van». Jr., II… non contano. */
  var AU_PART = /^(de|di|da|del|dei|della|delle|dello|degli|dal|dalla|van|von|der|den|ter|ten|du|des|dos|das|do|le|la|lo|y|e|al|el|bin|ibn|mac)$/i;
  var AU_SUFF = /^(jr\.?|sr\.?|junior|senior|i{2,3}|iv)$/i;
  function authorParts(a, cut) {
    var name = String(a || '').trim().replace(/\s+/g, ' '), w = name ? name.split(' ') : [];
    var suff = [];
    while (w.length > 1 && AU_SUFF.test(w[w.length - 1].replace(/,$/, ''))) suff.unshift(w.pop());
    w = w.map(function (x, i) { return i === w.length - 1 ? x.replace(/,$/, '') : x; });
    if (w.length < 2 || cut === 0) return { sur: '', given: name, key: norm(name), name: name, auto: w.length - 1 };
    var n;
    if (cut > 0 && cut < w.length) n = cut;
    else {
      n = 1;
      while (n < w.length - 1 && AU_PART.test(w[w.length - n - 1])) n++;
    }
    var sw = w.slice(w.length - n), gw = w.slice(0, w.length - n);
    var lead = [];                                                   // particelle minuscole in testa al cognome: con il nome
    if (!(cut > 0)) while (sw.length > 1 && AU_PART.test(sw[0]) && sw[0] === sw[0].toLowerCase()) lead.push(sw.shift());
    var given = gw.concat(lead).concat(suff).join(' ');
    return { sur: sw.join(' '), given: given, key: norm(sw.join(' ')) + ' ' + norm(given), name: name, n: n };
  }
  function sortKeyAuthor(a, cuts) {
    var first = String(a || '').split(/\s*[,;]\s*/)[0].trim();
    var c = cuts && cuts[norm(first)];
    return authorParts(first, c == null ? -1 : c).key;
  }
  function authorInv(a, cuts) {                                      // «Neruda, Pablo»
    var c = cuts && cuts[norm(a)], p = authorParts(a, c == null ? -1 : c);
    return p.sur ? p.sur + (p.given ? ', ' + p.given : '') : p.name;
  }
  function yearOf(s) { var m = String(s || '').match(/\b(1[4-9]\d\d|20\d\d)\b/); return m ? m[1] : ''; }

  /* ---------- ISBN ---------- */
  function isbnClean(s) { return String(s || '').replace(/[^0-9Xx]/g, '').toUpperCase(); }
  function isbn13Valid(s) {
    if (!/^97[89]\d{10}$/.test(s)) return false;
    var sum = 0;
    for (var i = 0; i < 12; i++) sum += (+s[i]) * (i % 2 ? 3 : 1);
    return (10 - sum % 10) % 10 === +s[12];
  }
  function isbn10Valid(s) {
    if (!/^\d{9}[\dX]$/.test(s)) return false;
    var t = 0;
    for (var j = 0; j < 9; j++) t += (+s[j]) * (10 - j);
    t += s[9] === 'X' ? 10 : +s[9];
    return t % 11 === 0;
  }
  function isbn10to13(s) {
    var core = '978' + s.slice(0, 9), sum = 0;
    for (var i = 0; i < 12; i++) sum += (+core[i]) * (i % 2 ? 3 : 1);
    return core + ((10 - sum % 10) % 10);
  }
  function isbn13to10(s) {
    if (!/^978\d{10}$/.test(s)) return '';
    var core = s.slice(3, 12), sum = 0;
    for (var i = 0; i < 9; i++) sum += (+core[i]) * (10 - i);
    var c = (11 - sum % 11) % 11;
    return core + (c === 10 ? 'X' : String(c));
  }
  /* Restituisce l'ISBN-13 canonico, oppure '' se il codice non è valido. */
  function toIsbn13(s) {
    s = isbnClean(s);
    if (s.length === 13 && isbn13Valid(s)) return s;
    if (s.length === 10 && isbn10Valid(s)) return isbn10to13(s);
    return '';
  }
  function fmtIsbn(s) { return s; }
  /* Cerca ISBN validi dentro un testo libero (per esempio il risultato dell'OCR). */
  function extractIsbns(text) {
    var out = [], seen = {};
    var re = /[\dXx][\dXx\s\-–‐]{8,22}[\dXx]/g, m;
    var t = String(text || '');
    while ((m = re.exec(t))) {
      var v = toIsbn13(m[0]);
      if (v && !seen[v]) { seen[v] = 1; out.push(v); }
    }
    return out;
  }
  /* ISBN letti dalla fotocamera (testo stampato, non codice a barre). L'OCR scambia spesso lettere e cifre
     (O/0, I/1, S/5, B/8...): provo le sostituzioni, ma accetto solo codici con la cifra di controllo giusta,
     al massimo 2 sostituzioni su 13 cifre (1 su 10), e un ISBN-13 deve iniziare con 978 o 979.
     strict: un ISBN a 10 cifre vale solo se poco prima c'e' la parola «ISBN» (evita numeri di telefono). */
  var OCR_DIGIT = { O: '0', o: '0', D: '0', Q: '0', I: '1', l: '1', '|': '1', i: '1', Z: '2', z: '2', S: '5', s: '5', B: '8', G: '6' };
  function ocrIsbns(text, strict) {
    var t = String(text || ''), out = [], seen = {}, m;
    var re = /[0-9OoDQIl|iZzSsBGXx][0-9OoDQIl|iZzSsBGXx \t\-–‐.]{8,44}/g;
    function push(v, rank) { if (v && !seen[v]) { seen[v] = 1; out.push({ v: v, r: rank }); } }
    while ((m = re.exec(t))) {
      var run = m[0], ch = [];
      for (var k = 0; k < run.length; k++) {
        var c = run.charAt(k);
        if (c >= '0' && c <= '9') ch.push({ d: c, real: 1 });
        else if (c === 'X' || c === 'x') ch.push({ d: 'X', real: 1 });
        else if (OCR_DIGIT[c]) ch.push({ d: OCR_DIGIT[c], real: 0 });
      }
      var kw = /[il1|]\s?[s5]\s?[b8]\s?[nm]/i.test(t.slice(Math.max(0, m.index - 14), m.index + 4));
      var found13 = false, s, w, fake, digits;
      for (s = 0; s + 13 <= ch.length; s++) {
        w = ch.slice(s, s + 13); fake = 0; digits = '';
        for (k = 0; k < 13; k++) { fake += w[k].real ? 0 : 1; digits += w[k].d; }
        if (fake > 2 || digits.indexOf('X') >= 0 || !/^97[89]/.test(digits) || !isbn13Valid(digits)) continue;
        push(digits, fake); found13 = true;
      }
      if (found13 || (strict && !kw)) continue;
      for (s = 0; s + 10 <= ch.length; s++) {
        w = ch.slice(s, s + 10); fake = 0; digits = '';
        for (k = 0; k < 10; k++) { fake += w[k].real ? 0 : 1; digits += w[k].d; }
        if (fake > 1 || digits.slice(0, 9).indexOf('X') >= 0 || !isbn10Valid(digits)) continue;
        push(isbn10to13(digits), 3 + fake);
      }
    }
    return out.sort(function (x, y) { return x.r - y.r; }).map(function (x) { return x.v; });
  }
  /* Da un testo incollato (uno o più codici) ricava ISBN validi e frammenti da segnalare. */
  function parseIsbnList(text) {
    var valid = [], invalid = [], seen = {};
    String(text || '').split(/[\r\n,;]+/).forEach(function (line) {
      line = line.trim();
      if (!line) return;
      var whole = toIsbn13(line);
      if (whole) { if (!seen[whole]) { seen[whole] = 1; valid.push(whole); } return; }
      line.split(/\s+/).forEach(function (tok) {
        var digits = isbnClean(tok);
        if (digits.length < 9) return;
        var v = toIsbn13(tok);
        if (v) { if (!seen[v]) { seen[v] = 1; valid.push(v); } }
        else invalid.push(tok);
      });
      if (!whole && !valid.length && !invalid.length) invalid.push(line);
    });
    return { valid: valid, invalid: invalid };
  }

  /* ---------- banche dati ---------- */
  function httpsUrl(u) { return String(u || '').replace(/^http:\/\//i, 'https://'); }
  /* Le categorie di Google Libri sono in inglese ("Fiction / Thrillers"): tengo la prima parte e la traduco se la conosco. */
  var GENRE_IT = { 'fiction': 'Narrativa', 'history': 'Storia', 'biography & autobiography': 'Biografia', 'juvenile fiction': 'Ragazzi',
    'juvenile nonfiction': 'Ragazzi (saggistica)', 'young adult fiction': 'Ragazzi', 'poetry': 'Poesia', 'philosophy': 'Filosofia',
    'science': 'Scienza', 'travel': 'Viaggi', 'cooking': 'Cucina', 'religion': 'Religione', 'art': 'Arte', 'psychology': 'Psicologia',
    'literary criticism': 'Critica letteraria', 'social science': 'Scienze sociali', 'political science': 'Politica',
    'business & economics': 'Economia', 'comics & graphic novels': 'Fumetti', 'drama': 'Teatro', 'medical': 'Medicina',
    'nature': 'Natura', 'sports & recreation': 'Sport', 'music': 'Musica', 'education': 'Educazione', 'language arts & disciplines': 'Lingua',
    'law': 'Diritto', 'mathematics': 'Matematica', 'self-help': 'Crescita personale', 'health & fitness': 'Salute', 'true crime': 'Cronaca',
    'humor': 'Umorismo', 'literary collections': 'Antologie', 'foreign language study': 'Lingue straniere', 'architecture': 'Architettura',
    'photography': 'Fotografia', 'computers': 'Informatica', 'technology & engineering': 'Tecnologia', 'family & relationships': 'Famiglia',
    'body, mind & spirit': 'Spiritualità', 'games & activities': 'Giochi', 'games': 'Giochi', 'house & home': 'Casa', 'gardening': 'Giardinaggio',
    'pets': 'Animali', 'crafts & hobbies': 'Hobby', 'transportation': 'Trasporti', 'reference': 'Consultazione', 'study aids': 'Studio',
    'performing arts': 'Spettacolo', 'design': 'Design', 'antiques & collectibles': 'Collezionismo', 'bibles': 'Religione' };
  function genreIt(cat) {
    var c = str(Array.isArray(cat) ? cat[0] : cat).split(' / ')[0].trim();
    if (!c) return '';
    return GENRE_IT[c.toLowerCase()] || c;
  }
  function pagesOf(n) { var v = parseInt(n, 10); return v > 0 && v < 20000 ? String(v) : ''; }
  function parseGoogle(json) {
    var items = (json && Array.isArray(json.items)) ? json.items : [];
    return items.map(function (it) {
      var v = it.volumeInfo || {};
      var ids = (v.industryIdentifiers || []).map(function (x) { return toIsbn13(x.identifier); }).filter(Boolean);
      var title = str(v.title);
      if (title && v.subtitle) title += ': ' + str(v.subtitle);
      return {
        id: 'g:' + str(it.id),
        t: title,
        a: Array.isArray(v.authors) ? v.authors.map(str).filter(Boolean).join(', ') : '',
        e: str(v.publisher),
        y: yearOf(v.publishedDate),
        i: ids[0] || '',
        isbns: ids,
        img: httpsUrl(v.imageLinks && (v.imageLinks.thumbnail || v.imageLinks.smallThumbnail)),
        lang: str(v.language),
        gen: genreIt(v.categories),
        pg: pagesOf(v.pageCount),
        ds: cleanDesc(v.description),                   // la descrizione arriva nella stessa risposta: niente richieste in piu'
        src: 'Google Libri'
      };
    }).filter(function (c) { return c.t; });
  }
  /* ricerca per titolo in Open Library (20/11/2026, Piero): gratis e senza chiave, di riserva quando Google non risponde o non trova.
     Con lang=it Open Library sceglie per ogni opera l'edizione italiana, se c'e' (editions.*). */
  var OL_SEARCH = 'https://openlibrary.org/search.json?limit=10&lang=it&fields=key,title,subtitle,author_name,first_publish_year,language,cover_i,' +
    'editions,editions.key,editions.title,editions.subtitle,editions.isbn,editions.language,editions.publisher,editions.publish_date,editions.cover_i&q=';
  function parseOlSearch(json) {
    var docs = (json && Array.isArray(json.docs)) ? json.docs : [];
    return docs.map(function (d) {
      var e = (d.editions && Array.isArray(d.editions.docs) && d.editions.docs[0]) || {};
      var langs = Array.isArray(e.language) && e.language.length ? e.language : (Array.isArray(d.language) ? d.language : []);
      var it = langs.indexOf('ita') >= 0;
      var ids = (Array.isArray(e.isbn) ? e.isbn : []).map(toIsbn13).filter(Boolean);
      if (it) ids.sort(function (x, y) { return (/^97(888|912)/.test(y) ? 1 : 0) - (/^97(888|912)/.test(x) ? 1 : 0); });   // prima gli ISBN italiani
      var t = str(e.title || d.title), sub = str(e.subtitle || d.subtitle);
      if (t && sub) t += ': ' + sub;
      var pd = Array.isArray(e.publish_date) ? e.publish_date[0] : e.publish_date;
      var cov = e.cover_i || d.cover_i;
      return {
        id: 'o:' + str(e.key || d.key), t: t,
        a: Array.isArray(d.author_name) ? d.author_name.map(str).filter(Boolean).slice(0, 3).join(', ') : '',
        e: str(Array.isArray(e.publisher) ? e.publisher[0] : e.publisher), y: yearOf(pd || d.first_publish_year),
        i: ids[0] || '', isbns: ids,
        img: cov ? 'https://covers.openlibrary.org/b/id/' + encodeURIComponent(String(cov)) + '-M.jpg' : '',
        lang: it ? 'it' : str(langs[0] || ''), gen: '', pg: '', ds: '', src: 'Open Library'
      };
    }).filter(function (c) { return c.t; });
  }
  function parseOpenLibrary(json, isbn) {
    var d = json && (json['ISBN:' + isbn] || json[Object.keys(json || {})[0]]);
    if (!d || typeof d !== 'object') return [];
    var title = str(d.title);
    if (title && d.subtitle) title += ': ' + str(d.subtitle);
    if (!title) return [];
    return [{
      id: 'o:' + isbn,
      t: title,
      a: Array.isArray(d.authors) ? d.authors.map(function (x) { return str(x && x.name); }).filter(Boolean).join(', ') : '',
      e: Array.isArray(d.publishers) ? d.publishers.map(function (x) { return str(x && x.name); }).filter(Boolean).join(', ') : '',
      y: yearOf(d.publish_date),
      i: isbn,
      isbns: [isbn],
      img: httpsUrl(d.cover && (d.cover.medium || d.cover.small || d.cover.large)),
      lang: '',
      gen: '',
      pg: pagesOf(d.number_of_pages),
      src: 'Open Library'
    }];
  }
  function mergeInto(base, extra) {
    if (!extra) return base;
    ['t', 'a', 'e', 'y', 'img', 'gen', 'pg'].forEach(function (k) { if (!base[k] && extra[k]) base[k] = extra[k]; });
    return base;
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  /* GET JSON con timeout e nuovi tentativi quando il server risponde 429 o 5xx. Rifiuta con {status} o {net:true}. */
  async function getJson(f, url, opts) {
    var waits = (opts && opts.waits) || [800, 2200];
    var timeout = (opts && opts.timeout) || 12000;
    for (var n = 0; ; n++) {
      var r, ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var timer = ctl ? setTimeout(function () { ctl.abort(); }, timeout) : null;
      try { r = await f(url, ctl ? { signal: ctl.signal } : undefined); }
      catch (e) { clearTimeout(timer); if (n < waits.length) { await sleep(waits[n]); continue; } throw { net: true }; }
      if (r && r.local) { clearTimeout(timer); throw { status: r.status, local: true }; }   // bloccata dall'app (limite giornaliero)
      if (r.ok) {
        try { var j = await r.json(); clearTimeout(timer); return j; }
        catch (e2) { clearTimeout(timer); throw { status: 0, bad: true }; }
      }
      clearTimeout(timer);
      if ((r.status === 429 || r.status >= 500) && n < waits.length) { await sleep(waits[n]); continue; }
      throw { status: r.status };
    }
  }
  function openLibrarySearch(json, isbn) {
    var docs = (json && Array.isArray(json.docs)) ? json.docs : [];
    return docs.map(function (d) {
      return {
        id: 'o:' + str(d.key),
        t: str(d.title),
        a: Array.isArray(d.author_name) ? d.author_name.map(str).filter(Boolean).join(', ') : '',
        e: '',   // nella ricerca l'elenco editori riguarda tutte le edizioni dell'opera: meglio vuoto che sbagliato
        y: '',
        i: isbn, isbns: [isbn], img: '', lang: '', src: 'Open Library'
      };
    }).filter(function (c) { return c.t; });
  }
  /* Crossref: libri registrati con DOI (soprattutto editoria accademica). */
  var CROSSREF_URL = 'https://api.crossref.org/works?select=title,subtitle,author,editor,publisher,issued,type&rows=5&filter=isbn:';
  function parseCrossref(json, isbn) {
    var items = (json && json.message && Array.isArray(json.message.items)) ? json.message.items : [];
    var BOOK = /^(book|monograph|edited-book|reference-book|proceedings|book-set|book-series)$/;
    return items.filter(function (it) { return BOOK.test(str(it.type)); }).map(function (it) {
      var title = str(Array.isArray(it.title) ? it.title[0] : it.title);
      var sub = str(Array.isArray(it.subtitle) ? it.subtitle[0] : it.subtitle);
      if (title && sub) title += ': ' + sub;
      var people = (Array.isArray(it.author) && it.author.length ? it.author : (it.editor || []));
      var names = people.map(function (p) { return [str(p.given), str(p.family)].filter(Boolean).join(' ') || str(p.name); }).filter(Boolean);
      var dp = it.issued && it.issued['date-parts'] && it.issued['date-parts'][0];
      return { id: 'c:' + title, t: title, a: names.join(', '), e: str(it.publisher), y: yearOf(dp ? dp[0] : ''), i: isbn, isbns: [isbn], img: '', lang: '', src: 'Crossref' };
    }).filter(function (c) { return c.t; });
  }
  /* ---------- catalogo SBN (biblioteche italiane), tramite il tuo intermediario Cloudflare ---------- */
  function sbnClean(t) { return str(t).replace(/\*/g, '').replace(/\s*\[[^\]]*\]\s*/g, ' ').replace(/\s+/g, ' ').trim(); }
  function sentenceCase(t) { t = str(t).toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); }
  /* classificazione Dewey: "823.7 NARRATIVA INGLESE" (testo, elenco o oggetti) -> "Narrativa inglese" */
  function deweyGenre(x) {
    var v = Array.isArray(x) ? x[0] : x;
    if (v && typeof v === 'object') v = v.descrizione || v.valore || v.label || v.testo || v.dewey || Object.keys(v).map(function (k) { return typeof v[k] === 'string' ? v[k] : ''; }).join(' ');
    v = str(v).replace(/^[\d.\s]+/, '').replace(/\(\d+\.?\)/g, '').replace(/\s+/g, ' ').trim();
    if (!v || v.length > 50) return '';
    return v === v.toUpperCase() ? sentenceCase(v) : v;
  }
  /* json = risposta di search.json?isbn= (briefRecords) con, se c'e', la scheda completa in json.full */
  function parseSbn(json, isbn) {
    var r = json && Array.isArray(json.briefRecords) ? json.briefRecords[0] : null;
    if (!r) return null;
    var full = (json.full && typeof json.full === 'object') ? json.full : {};
    var raw = str(r.titolo || full.titolo), parts = raw.split(' / ');
    var title = sbnClean(parts[0]).replace(/^\d+\s*:\s*/, '').replace(/\s+:\s+/g, ': ').replace(/\s*[.;,]\s*$/, '');
    var au = str(r.autorePrincipale || full.autorePrincipale).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    var m = au.match(/^([^,]+),\s*(.+)$/);
    if (m) au = m[2].trim() + ' ' + m[1].trim();
    if (!au && parts[1]) au = sbnClean(parts[1].split(' ; ')[0]).replace(/^(a cura di|di)\s+/i, '');
    var pub = str(r.pubblicazione || full.pubblicazione), first = pub.split(/\s;\s/)[0];
    var e = sbnClean((first.split(/\s:\s/)[1] || '').replace(/,[^,]*\d{4}[^,]*$/, '').replace(/[\[\]]/g, ''));
    if (/^s\.?\s?n\.?$/i.test(e)) e = '';
    var years = (pub.match(/\d{4}/g) || []).map(Number).filter(function (y) { return y >= 1450 && y <= 2100; });
    var pm = str(full.descrizioneFisica).match(/(\d+)\s*p\./);
    if (!title) return null;
    return { id: 's:' + isbn, t: title, a: au, e: e, y: years.length ? String(years[years.length - 1]) : '', i: isbn, isbns: [isbn], img: '', lang: '',
      gen: deweyGenre(full.classificazioneDewey), pg: pm ? pagesOf(pm[1]) : '', src: 'SBN' };
  }
  function sbnUrl(base, isbn) {
    try { var u = new URL(str(base)); if (u.protocol !== 'https:') return ''; u.searchParams.set('isbn', isbn); return u.href; } catch (e) { return ''; }
  }
  var SRC_ORDER = ['g', 'o', 's', 'c'];   // per i campi contesi vince la prima fonte; quelli vuoti si riempiono con le altre
  /* Cerca un ISBN-13 prima su Open Library e SBN, poi su Google Libri solo se manca il libro o la copertina (giro 11B),
     e somma i dati: per i campi contesi Google ha la precedenza, i campi che mancano vengono presi dalle altre fonti. Crossref si aggiunge solo se ancora
     manca qualcosa. Ritorna il libro, oppure null SOLO se le banche dati principali hanno risposto e non lo conoscono.
     Se non lo trova e Google o Open Library hanno dato errore, rifiuta con {code:'rate'|'network', detail:[...]}:
     cosi' l'app propone "Riprova" invece di scrivere "Non trovato". */
  async function lookupIsbn(isbn, opts) {
    opts = opts || {};
    var f = opts.fetch || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
    if (!f) throw { code: 'network', detail: ['nessun accesso a internet'] };
    var key = opts.gbKey ? '&key=' + encodeURIComponent(opts.gbKey) : '';
    var errors = [], rate = false, nokey = false;
    function note(src, e) {
      if (e && e.status === 429) rate = true;
      if (e && e.status === 403) nokey = true;   // API prestata tolta (20/11/2026)
      errors.push(src + ': ' + (e && e.local ? 'limite giornaliero raggiunto (richieste sospese fino a domani)' : e && e.status ? 'errore ' + e.status : (e && e.bad ? 'risposta non valida' : 'nessuna risposta')));
    }
    var got = { g: null, o: null, s: null, c: null };
    // fonti di contorno: meno tentativi e tempi piu' brevi di Google
    var side = { waits: opts.waits ? opts.waits.slice(0, 1) : [800], timeout: 8000 };
    var italian = isbn.indexOf('97888') === 0 || isbn.indexOf('97912') === 0;
    var gFailed = false, oFailed = false;
    function best() {
      var base = null;
      SRC_ORDER.forEach(function (k) { if (got[k]) { if (!base) base = Object.assign({}, got[k]); else mergeInto(base, got[k]); } });
      return base;
    }
    function complete() { var b = best(); return !!(b && b.t && b.a && b.e && b.y); }

    async function tryOl() {
      try {
        var j1 = await getJson(f, 'https://openlibrary.org/api/books?bibkeys=ISBN:' + isbn + '&format=json&jscmd=data', side);
        var r1 = parseOpenLibrary(j1, isbn)[0] || null;
        if (r1) return r1;
      } catch (e) { /* si prova la ricerca */ }
      try {
        var j2 = await getJson(f, 'https://openlibrary.org/search.json?q=isbn:' + isbn + '&fields=key,title,author_name&limit=3', side);
        return openLibrarySearch(j2, isbn)[0] || null;
      } catch (e2) { note('Open Library', e2); oFailed = true; return null; }
    }
    async function trySbn() {
      var u = opts.sbnUrl ? sbnUrl(opts.sbnUrl, isbn) : '';
      if (!u) return null;
      try { return parseSbn(await getJson(f, u, { waits: [], timeout: 8000 }), isbn); }
      catch (e) { return null; }            // fonte accessoria: se non risponde si va avanti
    }
    async function tryCrossref() {
      try { return parseCrossref(await getJson(f, CROSSREF_URL + isbn, { waits: [], timeout: 8000 }), isbn)[0] || null; }
      catch (e) { return null; }            // fonte accessoria: se non risponde si va avanti
    }
    async function google(q, strict) {
      var j = await getJson(f, 'https://www.googleapis.com/books/v1/volumes?q=' + encodeURIComponent(q) + '&maxResults=5&printType=books' + key, opts);
      var list = parseGoogle(j);
      var exact = list.filter(function (c) { return c.isbns.indexOf(isbn) >= 0; });
      // la ricerca "isbn:" e' precisa; le altre possono dare risultati simili ma sbagliati: servono ISBN identico
      return exact[0] || (strict ? null : list[0]) || null;
    }

    // 1) giro 11B (Piero, 19/11/2026): prima Open Library e le biblioteche (SBN), insieme; Google solo se manca il libro
    //    o la copertina. La descrizione non conta: si cerca a richiesta dalla scheda. Open Library ha 2,5 secondi,
    //    poi Google parte comunque (le biblioteche intanto continuano).
    var pO = tryOl().then(function (v) { got.o = v; }), pS = trySbn().then(function (v) { got.s = v; });
    await Promise.race([pO, sleep(opts.olWait != null ? opts.olWait : 2500)]);
    if (!(got.o && got.o.img)) got.g = await google('isbn:' + isbn, false).catch(function (e) { note('Google Libri', e); gFailed = true; return null; });
    var grace = complete() ? ((italian && opts.sbnUrl) ? (opts.graceSbn != null ? opts.graceSbn : 3000) : (opts.grace != null ? opts.grace : 1500)) : 0;
    if (grace) await Promise.race([Promise.all([pO, pS]), new Promise(function (r) { setTimeout(r, grace); })]);
    else await Promise.all([pO, pS]);
    // 2) Crossref solo se ancora manca qualcosa
    if (!complete()) got.c = await tryCrossref();
    // 3) ultima spiaggia per Google: codice semplice e ISBN-10 (solo se l'ISBN coincide)
    if (!got.g && !gFailed && !got.o && !got.s && !got.c && !opts.lean) {
      var alt = isbn13to10(isbn), more = [isbn].concat(alt ? ['isbn:' + alt] : []);
      for (var qi = 0; qi < more.length && !got.g; qi++) {
        try { got.g = await google(more[qi], true); } catch (e2) { note('Google Libri', e2); gFailed = true; break; }
      }
    }
    var book = best();
    if (!book) {
      if (gFailed || oFailed) throw { code: rate || nokey ? 'rate' : 'network', nokey: nokey, detail: errors };
      return null;
    }
    book.i = isbn;
    // per i libri italiani il catalogo delle biblioteche e' il piu' affidabile su editore e anno di quella edizione
    // libri italiani: editore, anno e pagine dal catalogo delle biblioteche (scheda di quella precisa edizione)
    if (got.s && italian) { if (got.s.e) book.e = got.s.e; if (got.s.y) book.y = got.s.y; if (got.s.pg) book.pg = got.s.pg; }
    if (got.g && got.g.ds) { book.ds = got.g.ds; book.dsl = guessLang(got.g.ds) || str(got.g.lang).slice(0, 2).toLowerCase(); }
    book.src = [got.g && 'Google Libri', got.o && 'Open Library', got.s && 'SBN', got.c && 'Crossref'].filter(Boolean).join(' + ');
    return book;
  }

  /* ---------- casa editrice dedotta dall'ISBN ---------- */
  /* L'ISBN contiene il codice dell'editore. Per l'Italia (gruppo 88) la lunghezza del codice dipende dal numero.
     Si impara dai libri gia' in elenco (che hanno ISBN e editore) e, in mancanza, da pochi editori molto noti. */
  var PUB_SEED = { '88-04': 'Mondadori', '88-06': 'Einaudi', '88-07': 'Feltrinelli', '88-11': 'Garzanti', '88-15': 'Il Mulino',
    '88-17': 'Rizzoli', '88-452': 'Bompiani', '88-459': 'Adelphi', '88-502': 'TEA' };
  function isbnPrefix(isbn) {
    var c = toIsbn13(isbn);
    if (!c || c.indexOf('97888') !== 0) return '';
    var reg = c.slice(5);                       // dopo 978-88
    var n = parseInt(reg.slice(0, 7), 10), len;
    if (n < 2000000) len = 2; else if (n < 6000000) len = 3; else if (n < 8500000) len = 4;
    else if (n < 9000000) len = 5; else if (n < 9500000) len = 6; else len = 7;
    return '88-' + reg.slice(0, len);
  }
  /* books: [{i, e, g}] gia' in elenco. Ritorna {name, learned} oppure null. Le deduzioni gia' segnate "da verificare" non fanno scuola. */
  function guessPublisher(isbn, books) {
    var p = isbnPrefix(isbn);
    if (!p) return null;
    var count = {}, best = '', bn = 0, names = {};
    (books || []).forEach(function (b) {
      if (!b || !b.e || (b.g || []).indexOf('e') >= 0 || isbnPrefix(b.i) !== p) return;
      var k = b.e.trim(); count[k] = (count[k] || 0) + 1;
      names[norm(k)] = 1;
      if (count[k] > bn) { bn = count[k]; best = k; }
    });
    // sure: tutti i tuoi libri gia' verificati con questo codice editore hanno lo stesso editore -> non serve verificarlo
    if (best) return { name: best, learned: true, sure: Object.keys(names).length === 1 };
    return PUB_SEED[p] ? { name: PUB_SEED[p], learned: false, sure: false } : null;
  }

  /* Prova le banche dati con un ISBN noto e dice cosa risponde ciascuna (per la diagnosi nelle Opzioni). */
  async function diagnose(opts) {
    opts = opts || {};
    var f = opts.fetch || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
    var key = opts.gbKey ? '&key=' + encodeURIComponent(opts.gbKey) : '';
    var out = [];
    async function probe(name, url, check, noReply) {
      var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var timer = ctl ? setTimeout(function () { ctl.abort(); }, 12000) : null;
      try {
        var r = await f(url, ctl ? { signal: ctl.signal } : undefined);
        clearTimeout(timer);
        if (!r.ok) { out.push({ name: name, ok: false, msg: r.status === 429 ? 'limite di richieste raggiunto (429)' : 'errore ' + r.status }); return; }
        var j = await r.json();
        out.push({ name: name, ok: true, msg: check(j) });
      } catch (e) { clearTimeout(timer); out.push({ name: name, ok: false, msg: noReply || 'nessuna risposta (rete assente, bloccata o sito non raggiungibile)' }); }
    }
    await probe('Google Libri', 'https://www.googleapis.com/books/v1/volumes?q=isbn:9788806219352&maxResults=1' + key,
      function (j) { var l = parseGoogle(j); return l.length ? 'risponde: ' + l[0].t : 'risponde ma non trova il libro di prova'; });
    await probe('Open Library', 'https://openlibrary.org/api/books?bibkeys=ISBN:9780140328721&format=json&jscmd=data',
      function (j) { var l = parseOpenLibrary(j, '9780140328721'); return l.length ? 'risponde: ' + l[0].t : 'risponde ma non trova il libro di prova'; });
    await probe('Crossref', CROSSREF_URL.replace('rows=5', 'rows=1') + '9780262033848',
      function (j) { return (j && j.message) ? 'risponde' : 'risposta non valida'; });
    if (opts.sbnUrl) {
      var su = sbnUrl(opts.sbnUrl, '9788806219352');
      if (!su) out.push({ name: 'Catalogo SBN', ok: false, msg: 'indirizzo dell\'intermediario non valido (deve iniziare con https://)' });
      else await probe('Catalogo SBN', su, function (j) { var l = parseSbn(j, '9788806219352'); return l ? 'risponde: ' + l.t + (l.e ? ' (' + l.e + ', ' + l.y + ')' : '') : (j && j.error ? 'l\'intermediario risponde ma dice: ' + j.error : 'risponde ma non trova il libro di prova'); },
        'nessuna risposta: controlla l\'indirizzo dell\'intermediario Cloudflare');
    }
    return out;
  }
  async function searchText(query, opts) {
    opts = opts || {};
    var f = opts.fetch || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
    if (!f) throw { code: 'network' };
    var key = opts.gbKey ? '&key=' + encodeURIComponent(opts.gbKey) : '';
    var base = 'https://www.googleapis.com/books/v1/volumes?q=' + encodeURIComponent(query) + '&maxResults=10&printType=books' + key;
    var gErr = '', res = [];
    try {
      /* giro 10 (Piero, 18/11/2026): prima le edizioni italiane. Una sola ricerca se ne trova almeno 3; altrimenti una seconda
         senza limiti di lingua, e le italiane restano in cima */
      var it = parseGoogle(await getJson(f, base + '&langRestrict=it', opts));
      if (it.length >= 3) return it;
      var seen = {};
      it.forEach(function (c) { seen[c.id] = 1; });
      res = it.concat(parseGoogle(await getJson(f, base, opts)).filter(function (c) { return !seen[c.id]; }));
    } catch (e) { gErr = e && e.status === 429 ? 'rate' : e && e.status === 403 ? 'nokey' : 'network'; }   // 403 = API prestata tolta (20/11/2026)
    if (res.length) return res;
    /* 20/11/2026 (Piero): se Google non risponde o non trova, si cerca in Open Library */
    try {
      var ol = parseOlSearch(await getJson(f, OL_SEARCH + encodeURIComponent(query), opts));
      /* Open Library vuole tutte le parole: con l'editore aggiunto («l'isola del tesoro bur») puo' non trovare niente, si riprova senza l'ultima */
      var words = String(query).trim().split(/\s+/);
      if (!ol.length && words.length > 2) ol = parseOlSearch(await getJson(f, OL_SEARCH + encodeURIComponent(words.slice(0, -1).join(' ')), opts));
      if (ol.length) { ol.via = 'ol'; ol.gErr = gErr; return ol; }
    } catch (e2) { /* anche Open Library non risponde: vale l'errore di Google */ }
    if (gErr) throw { code: gErr };
    return [];
  }

  /* ---------- lettura della copertina (OCR) ---------- */
  var STOP = { il: 1, lo: 1, la: 1, le: 1, gli: 1, un: 1, uno: 1, una: 1, di: 1, del: 1, della: 1, dei: 1, delle: 1, dello: 1, degli: 1, da: 1, per: 1, con: 1, che: 1, the: 1, and: 1, of: 1, for: 1, ed: 1, nel: 1, nella: 1, sul: 1, sulla: 1, edizione: 1, romanzo: 1, nuova: 1 };
  function tokens(s) {
    var seen = {}, out = [];
    norm(s).split(/[^a-z0-9]+/).forEach(function (w) {
      if (w.length < 3 || STOP[w] || /^\d+$/.test(w) || seen[w]) return;
      seen[w] = 1; out.push(w);
    });
    return out;
  }
  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      var best = i;
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < best) best = cur[j];
      }
      if (best > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }
  function fuzzyHas(list, tok) {
    var max = tok.length >= 8 ? 2 : (tok.length >= 5 ? 1 : 0);
    for (var i = 0; i < list.length; i++) {
      if (list[i] === tok) return true;
      if (max && lev(list[i], tok, max) <= max) return true;
    }
    return false;
  }
  /* Da data.lines di tesseract.js a righe semplici {text, h, conf}. */
  function ocrLines(data) {
    var raw = (data && Array.isArray(data.lines)) ? data.lines : [];
    return raw.map(function (l) {
      var b = l.bbox || {};
      return { text: str(l.text).replace(/\s+/g, ' ').trim(), h: Math.max(0, (b.y1 || 0) - (b.y0 || 0)), y: b.y0 || 0, conf: Number(l.confidence) || 0 };
    }).filter(function (l) { return l.text; });
  }
  function goodLines(lines) {
    return lines.filter(function (l) {
      var letters = (l.text.match(/[A-Za-zÀ-ÿ]/g) || []).length;
      return l.conf >= 35 && letters >= 3 && letters / l.text.length >= 0.55;
    });
  }
  function topLines(lines) {
    var g = goodLines(lines).slice().sort(function (a, b) { return b.h - a.h; });
    if (!g.length) return [];
    var maxH = g[0].h;
    return g.filter(function (l) { return l.h >= maxH * 0.55; }).slice(0, 4);
  }
  /* Dal solo testo letto: le righe più grandi sono il titolo, le successive l'autore. */
  function splitTitleAuthor(lines) {
    var good = goodLines(lines).slice().sort(function (a, b) { return b.h - a.h; });
    if (!good.length) return { t: '', a: '' };
    function cluster(arr) {
      var m = arr[0].h;
      return arr.filter(function (l) { return l.h >= m * 0.78; }).sort(function (a, b) { return (a.y || 0) - (b.y || 0); });
    }
    function join(c) { return c.map(function (l) { return l.text; }).join(' ').replace(/\s+/g, ' ').trim(); }
    var c1 = cluster(good);
    var rest = good.filter(function (l) { return c1.indexOf(l) < 0; });
    var a = rest.length ? join(cluster(rest)) : '';
    if (a && (a.split(' ').length > 5 || /\d/.test(a))) a = '';
    return { t: join(c1), a: a };
  }
  function buildQueries(lines) {
    var top = topLines(lines), all = goodLines(lines).slice().sort(function (a, b) { return b.h - a.h; });
    var qs = [];
    function add(arr, n) {
      var q = arr.slice(0, n).join(' ').trim();
      if (q && qs.indexOf(q) < 0) qs.push(q);
    }
    var topTok = tokens(top.map(function (l) { return l.text; }).join(' '));
    var allTok = tokens(all.map(function (l) { return l.text; }).join(' '));
    add(topTok, 7);
    if (top[0]) add(tokens(top[0].text), 6);
    add(allTok, 9);
    return qs.slice(0, 3);
  }
  function scoreCandidate(c, lines) {
    var all = tokens(goodLines(lines).map(function (l) { return l.text; }).join(' '));
    var top = tokens(topLines(lines).map(function (l) { return l.text; }).join(' '));
    var ct = tokens(c.t + ' ' + c.a);
    if (!ct.length || !all.length) return 0;
    var hits = ct.filter(function (w) { return fuzzyHas(all, w); }).length;
    var cov = hits / ct.length;
    var topHit = top.length ? top.filter(function (w) { return fuzzyHas(ct, w); }).length / top.length : 0;
    return 0.6 * cov + 0.4 * topHit;
  }
  /* Raggruppa le edizioni dello stesso libro, assegna un punteggio e ordina. */
  function rankCandidates(cands, lines) {
    var groups = {};
    var allText = norm(lines.map(function (l) { return l.text; }).join(' '));
    cands.forEach(function (c) {
      var key = norm(c.t).replace(/[^a-z0-9]+/g, ' ').trim() + '|' + norm(c.a).replace(/[^a-z0-9]+/g, ' ').trim();
      var rep = groups[key];
      var pubHit = c.e && allText.indexOf(norm(c.e)) >= 0;
      var rank = (pubHit ? 4 : 0) + (c.lang === 'it' ? 2 : 0) + (c.e ? 1 : 0) + (c.y ? 0.5 : 0) + (c.img ? 0.25 : 0);
      if (!rep || rank > rep._rank) groups[key] = Object.assign({}, c, { _rank: rank });
    });
    var out = Object.keys(groups).map(function (k) {
      var c = groups[k];
      c.score = scoreCandidate(c, lines);
      return c;
    });
    out.sort(function (a, b) { return b.score - a.score || b._rank - a._rank; });
    return out;
  }
  function strongMatch(ranked) {
    if (!ranked.length) return false;
    var best = ranked[0], second = ranked[1];
    return best.score >= 0.7 && (!second || best.score - second.score >= 0.15);
  }


  /* id del volume Google dentro l'indirizzo della miniatura (books.google.com/books/content?id=...) */
  function googleVolumeId(img) {
    var u = str(img);
    if (!/books\.google(?:usercontent)?\.[a-z.]+\//i.test(u)) return '';
    var m = u.match(/[?&]id=([\w-]+)/);
    return m ? m[1] : '';
  }
  /* Dalla scheda completa del volume Google: la copertina grande ufficiale, se Google ce l'ha (large > medium > extraLarge > small). */
  function bestGoogleImage(json) {
    var l = json && json.volumeInfo && json.volumeInfo.imageLinks;
    if (!l) return '';
    var u = l.large || l.medium || l.extraLarge || l.small || '';
    return u ? httpsUrl(u).replace(/&edge=curl/g, '') : '';
  }
  /* Versioni piu' grandi di una copertina su Open Library (grande dello stesso id, oppure per ISBN).
     Nessuna e' garantita: l'app le prova e tiene solo quelle che arrivano davvero e hanno le proporzioni di una copertina. */
  /* Google Libri con zoom=0 non da' la copertina grande ma spesso la prima pagina del libro (o un'immagine grigia):
     copertina sbagliata di «Latinoamericana», Piero 17/11/2026. Queste non si usano mai come copertina grande. */
  function badBigCover(u) { return /^https?:\/\/books\.google(?:usercontent)?\.[a-z.]+\/books\/(?:publisher\/)?content\?/i.test(str(u)) && /[?&]zoom=0(?:&|$)/.test(str(u)); }
  function coverCandidates(img, isbn) {
    var out = [], u = str(img);
    var ol = u.match(/^(https:\/\/covers\.openlibrary\.org\/b\/(?:id|isbn|olid)\/[^\/?]+?)-[SM]\.jpg/i);
    if (ol) out.push(ol[1] + '-L.jpg');
    var c = toIsbn13(isbn);
    if (c) out.push('https://covers.openlibrary.org/b/isbn/' + c + '-L.jpg?default=false');
    return out.filter(function (x, i) { return x !== u && out.indexOf(x) === i; });
  }

  /* ---------- export ---------- */
  /* Colonne: le prime 6 sempre; le altre solo se almeno un libro ha quel dato. type: s testo, n numero, c euro, x testo forzato (ISBN). */
  var COLS = [
    { k: 't', h: 'Titolo', w: 42 }, { k: 'a', h: 'Autore', w: 28 }, { k: 'e', h: 'Casa editrice', w: 22 },
    { k: 'y', h: 'Anno', w: 7, type: 'n' }, { k: 'c', h: 'Costo', w: 11, type: 'c' }, { k: 'i', h: 'ISBN', w: 16, type: 'x' },
    { k: 'sh', h: 'Scaffale', w: 16, opt: true }, { k: 'gen', h: 'Genere', w: 16, opt: true }, { k: 'pg', h: 'Pagine', w: 8, type: 'n', opt: true },
    { k: 'se', h: 'Serie', w: 22, opt: true }, { k: 'sn', h: 'Volume', w: 8, type: 'n', opt: true },
    { k: 'n', h: 'Note', w: 36, opt: true }, { k: 'p', h: 'Prestato a', w: 16, opt: true }, { k: 'pd', h: 'Data prestito', w: 13, opt: true },
    { k: 'rs', h: 'Lettura', w: 12, opt: true }, { k: 'rt', h: 'Voto', w: 7, type: 'n', opt: true }, { k: 'rd', h: 'Data lettura', w: 13, opt: true },
    { k: 'xs', h: 'Non più in libreria', w: 18, opt: true }, { k: 'xa', h: 'Dato a', w: 16, opt: true }, { k: 'xd', h: 'In data', w: 13, opt: true },
    { k: 'fav', h: 'Lo consiglio', w: 10, opt: true }, { k: 'fr', h: 'Ricevuto da', w: 16, opt: true }
  ];
  var READ_LABEL = { da: 'Da leggere', in: 'In lettura', ok: 'Letto' };
  var GONE_LABEL = { v: 'Venduto', r: 'Regalato', s: 'Smarrito' };
  function colsFor(books) {
    return COLS.filter(function (c) { return !c.opt || books.some(function (b) { return b[c.k] != null && String(b[c.k]) !== '' && b[c.k] !== 0; }); });
  }
  function itDate(iso) { var m = String(iso || '').match(/^(\d{4})-(\d\d)-(\d\d)$/); return m ? m[3] + '/' + m[2] + '/' + m[1] : str(iso); }
  function cellText(b, c) {
    var v = b[c.k];
    if (c.k === 'c') return v == null ? '' : fmtNum(v);
    if (c.k === 'pd' || c.k === 'rd' || c.k === 'xd') return itDate(v);
    if (c.k === 'rs') return READ_LABEL[v] || '';
    if (c.k === 'xs') return GONE_LABEL[v] || '';
    if (c.k === 'rt') return v ? String(v) : '';
    if (c.k === 'fav') return v ? 'Sì' : '';
    return v == null ? '' : String(v);
  }
  function rowsFor(books) {
    var cols = colsFor(books);
    return [cols.map(function (c) { return c.h; })].concat(books.map(function (b) { return cols.map(function (c) { return cellText(b, c); }); }));
  }
  function csvCell(v, delim) {
    var s = String(v == null ? '' : v);
    if (/^[=+@]/.test(s)) s = "'" + s;
    return /["\n\r]/.test(s) || s.indexOf(delim) >= 0 ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function buildCSV(books) {
    return '﻿' + rowsFor(books).map(function (r) { return r.map(function (v) { return csvCell(v, ';'); }).join(';'); }).join('\r\n');
  }
  function buildTSV(books) {
    var clean = function (v) { return String(v == null ? '' : v).replace(/[\t\r\n]+/g, ' '); };
    return rowsFor(books).map(function (r) { return r.map(clean).join('\t'); }).join('\n');
  }

  /* --- file Excel (.xlsx) costruito a mano: un archivio zip (senza compressione) con pochi file XML --- */
  var CRC = (function () { var t = [], c, n, k; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function utf8(s) { return new TextEncoder().encode(s); }
  function zipStore(files, date) {
    var d = date || new Date();
    var dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    var dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    var parts = [], central = [], offset = 0;
    files.forEach(function (f) {
      var name = utf8(f.name), data = typeof f.data === 'string' ? utf8(f.data) : f.data, crc = crc32(data);
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, dosTime, true); h.setUint16(12, dosDate, true); h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, dosTime, true); c.setUint16(14, dosDate, true); c.setUint32(16, crc, true);
      c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true);
      c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + data.length;
    });
    var cdSize = central.reduce(function (n, p) { return n + p.length; }, 0);
    var e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, cdSize, true); e.setUint32(16, offset, true);
    var all = parts.concat(central, [new Uint8Array(e.buffer)]);
    var out = new Uint8Array(all.reduce(function (n, p) { return n + p.length; }, 0)), pos = 0;
    all.forEach(function (p) { out.set(p, pos); pos += p.length; });
    return out;
  }
  function xmlEsc(s) {
    return String(s == null ? '' : s).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function colLetter(i) { var s = ''; i++; while (i) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function buildXLSX(books, sheetName, date) {
    var cols = colsFor(books), name = xmlEsc(String(sheetName || 'Libreria').replace(/[\\\/?*\[\]:]/g, ' ').slice(0, 31));
    var last = colLetter(cols.length - 1) + (books.length + 1);
    function txt(ref, v, st) { return '<c r="' + ref + '" t="inlineStr"' + (st ? ' s="' + st + '"' : '') + '><is><t xml:space="preserve">' + xmlEsc(v) + '</t></is></c>'; }
    var rows = ['<row r="1">' + cols.map(function (c, i) { return txt(colLetter(i) + '1', c.h, 1); }).join('') + '</row>'];
    books.forEach(function (b, r) {
      var rn = r + 2;
      rows.push('<row r="' + rn + '">' + cols.map(function (c, i) {
        var ref = colLetter(i) + rn, v = b[c.k];
        if (v == null || v === '' || v === 0) return '';
        if (c.k === 'rs') v = READ_LABEL[v] || '';
        if (c.type === 'c') return typeof v === 'number' && isFinite(v) ? '<c r="' + ref + '" s="2"><v>' + v + '</v></c>' : '';
        if (c.type === 'n') { var n = parseInt(v, 10); return isFinite(n) && String(n) === String(v).trim() ? '<c r="' + ref + '"><v>' + n + '</v></c>' : txt(ref, v); }
        if (c.type === 'x') return txt(ref, v, 3);
        return txt(ref, (c.k === 'pd' || c.k === 'rd') ? itDate(v) : v);
      }).join('') + '</row>');
    });
    var NS = 'http://schemas.openxmlformats.org/', M = NS + 'spreadsheetml/2006/main', R = NS + 'officeDocument/2006/relationships';
    var head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    var sheet = head + '<worksheet xmlns="' + M + '" xmlns:r="' + R + '"><dimension ref="A1:' + last + '"/>' +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="15"/><cols>' + cols.map(function (c, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + c.w + '" customWidth="1"/>'; }).join('') + '</cols>' +
      '<sheetData>' + rows.join('') + '</sheetData><autoFilter ref="A1:' + last + '"/></worksheet>';
    var styles = head + '<styleSheet xmlns="' + M + '"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;€&quot;"/></numFmts>' +
      '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
      '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDCEEE6"/><bgColor indexed="64"/></patternFill></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
      '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
      '<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
    var workbook = head + '<workbook xmlns="' + M + '" xmlns:r="' + R + '"><sheets><sheet name="' + name + '" sheetId="1" r:id="rId1"/></sheets>' +
      '<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">\'' + name.replace(/'/g, "''") + '\'!$A$1:$' + last.replace(/(\d+)$/, '$$$1') + '</definedName></definedNames></workbook>';
    var PR = NS + 'package/2006/relationships';
    return zipStore([
      { name: '[Content_Types].xml', data: head + '<Types xmlns="' + NS + 'package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
      { name: '_rels/.rels', data: head + '<Relationships xmlns="' + PR + '"><Relationship Id="rId1" Type="' + R + '/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', data: workbook },
      { name: 'xl/_rels/workbook.xml.rels', data: head + '<Relationships xmlns="' + PR + '"><Relationship Id="rId1" Type="' + R + '/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="' + R + '/styles" Target="styles.xml"/></Relationships>' },
      { name: 'xl/styles.xml', data: styles },
      { name: 'xl/worksheets/sheet1.xml', data: sheet }
    ], date);
  }

  /* ---------- case editrici scritte in modi diversi ---------- */
  var PUB_STOP = { casa: 1, editrice: 1, editore: 1, editori: 1, edizioni: 1, edizione: 1, ed: 1, edit: 1, spa: 1, srl: 1, sas: 1, snc: 1,
    publishing: 1, publishers: 1, publisher: 1, press: 1, books: 1, libri: 1, gruppo: 1, editoriale: 1, group: 1, italia: 1, the: 1,
    inc: 1, ltd: 1, co: 1, di: 1, de: 1, del: 1, della: 1, dei: 1, e: 1, s: 1, p: 1, a: 1, r: 1, l: 1 };
  function pubTokens(name) { return norm(name).replace(/&/g, ' e ').split(/[^a-z0-9]+/).filter(function (t) { return t && !PUB_STOP[t]; }); }
  /* Gruppi di nomi che sembrano la stessa casa editrice: stesso nome a parte maiuscole/"Editore"/"Edizioni", un nome contenuto
     nell'altro ("Mondadori" e "Arnoldo Mondadori Editore"), oppure libri con lo stesso codice editore nell'ISBN. Solo proposte. */
  function publisherGroups(books) {
    var count = {}, names = [];
    (books || []).forEach(function (b) { var e = str(b && b.e).trim(); if (!e) return; if (!count[e]) { count[e] = 0; names.push(e); } count[e]++; });
    var parent = {};
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    function join(a, b) { var ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; }
    names.forEach(function (n) { parent[n] = n; });
    var toks = {}, key = {}, byKey = {};
    names.forEach(function (n) { toks[n] = pubTokens(n); key[n] = toks[n].join(''); if (key[n]) { if (byKey[key[n]]) join(n, byKey[key[n]]); else byKey[key[n]] = n; } });
    for (var i = 0; i < names.length; i++) for (var j = i + 1; j < names.length; j++) {
      var A = toks[names[i]], B = toks[names[j]];
      if (!A.length || !B.length) continue;
      var small = A.length <= B.length ? A : B, big = small === A ? B : A;
      if (small.some(function (t) { return t.length >= 3; }) && small.every(function (t) { return big.indexOf(t) >= 0; })) join(names[i], names[j]);
    }
    var byPrefix = {};
    (books || []).forEach(function (b) {
      var e = str(b && b.e).trim(), p = isbnPrefix(b && b.i);
      if (!e || !p) return;
      if (byPrefix[p]) join(e, byPrefix[p]); else byPrefix[p] = e;
    });
    var groups = {};
    names.forEach(function (n) { var r = find(n); (groups[r] = groups[r] || []).push(n); });
    return Object.keys(groups).map(function (r) { return groups[r]; }).filter(function (g) { return g.length > 1; }).map(function (g) {
      var list = g.map(function (n) { return { name: n, count: count[n] }; }).sort(function (x, y) { return y.count - x.count || x.name.length - y.name.length || (x.name < y.name ? -1 : 1); });
      return { names: list, suggested: list[0].name, total: list.reduce(function (a, x) { return a + x.count; }, 0) };
    }).sort(function (x, y) { return y.total - x.total; });
  }

  /* ---------- doppioni: stesso ISBN, oppure stesso titolo e autore, nella stessa lista ---------- */
  function dupGroups(books) {
    var parent = {}, list = (books || []).filter(Boolean);
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    list.forEach(function (b) { parent[b.id] = b.id; });
    var seen = {};
    list.forEach(function (b) {
      var w = b.w ? 'w' : 'l', keys = [], iso = toIsbn13(b.i);
      if (iso) keys.push(w + 'i:' + iso);
      if (b.t) keys.push(w + 't:' + norm(b.t) + '|' + norm(b.a));
      keys.forEach(function (k) { if (seen[k]) parent[find(b.id)] = find(seen[k]); else seen[k] = b.id; });
    });
    var g = {};
    list.forEach(function (b) { var r = find(b.id); (g[r] = g[r] || []).push(b); });
    return Object.keys(g).map(function (k) { return g[k]; }).filter(function (x) { return x.length > 1; });
  }
  /* Per ogni libro: 'dup' se ha un doppione non voluto, oppure il numero di copie se e' una copia segnata (cp).
     Un gruppo di sole copie segnate non e' un doppione; un libro non segnato accanto a copie segnate si'. */
  function analyzeDups(books) {
    var out = {};
    dupGroups(books).forEach(function (g) {
      var cps = g.filter(function (b) { return b.cp; });
      g.forEach(function (b) {
        if (!b.cp) out[b.id] = 'dup';
        else if (cps.length > 1) out[b.id] = cps.length;
      });
    });
    return out;
  }
  /* ---------- condivisione di un libro o di una lista ----------
     Pacchetto compatto: { v:1, n: nome di chi invia, k: tipo (book, fav, wish, list), h: nome della lista,
     b: [[titolo, autore, isbn, editore, anno, { im: copertina, L: 1 se grande, g: genere, p: pagine }], ...] }.
     Viaggia dentro un link (#l=...) o in un file. Niente note, voti, prestiti, scaffali; le foto fatte da te restano sul telefono. */
  var COVER_HOST = /^https:\/\/(books\.google\.[a-z.]{2,8}|[a-z0-9-]+\.googleusercontent\.com|covers\.openlibrary\.org|([a-z0-9-]+\.)?archive\.org)\//i;
  function shareCover(u) { u = str(u); return u.length <= 400 && COVER_HOST.test(u) && !/[\s"'<>\\]/.test(u) ? u : ''; }
  var SHARE_MAX = 300;
  function shareClean(x, max) { return str(x).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
  function buildShare(books, meta) {
    meta = meta || {};
    var rows = (books || []).filter(function (b) { return b && (b.t || toIsbn13(b.i)); }).slice(0, SHARE_MAX).map(function (b) {
      var r = [shareClean(b.t, 200), shareClean(b.a, 120), toIsbn13(b.i) || '', shareClean(b.e, 80), shareClean(b.y, 4)];
      var x = {}, big = shareCover(b.imgL), cov = big || shareCover(b.img);
      if (cov) { x.im = cov; if (big) x.L = 1; }
      if (shareClean(b.gen, 80)) x.g = shareClean(b.gen, 80);
      if (/^\d{1,5}$/.test(str(b.pg)) && +b.pg > 0) x.p = +b.pg;
      if (Object.keys(x).length) r[5] = x;
      for (var k = 0; k < r.length; k++) if (r[k] == null) r[k] = '';
      while (r.length > 1 && !r[r.length - 1]) r.pop();
      return r;
    });
    var kind = ['book', 'fav', 'wish', 'list'].indexOf(meta.kind) >= 0 ? meta.kind : 'list';
    var o = { v: 1, k: kind, b: rows };
    if (shareClean(meta.name, 30)) o.n = shareClean(meta.name, 30);
    if (kind === 'list' && shareClean(meta.title, 40)) o.h = shareClean(meta.title, 40);
    return o;
  }
  /* Controlla e ripulisce un pacchetto ricevuto (dati non fidati). Restituisce { name, kind, title, books:[{t,a,i,e,y}] } o null. */
  function parseShare(o) {
    if (!o || typeof o !== 'object' || o.v !== 1 || !Array.isArray(o.b)) return null;
    var books = o.b.slice(0, SHARE_MAX).map(function (r) {
      if (!Array.isArray(r)) return null;
      var b = { t: shareClean(r[0], 200), a: shareClean(r[1], 120), i: toIsbn13(shareClean(r[2], 20)) || '', e: shareClean(r[3], 80), y: shareClean(r[4], 12).replace(/\D/g, '').slice(0, 4),
        c: null, img: '', imgL: '', gen: '', pg: '' };
      var x = r[5] && typeof r[5] === 'object' && !Array.isArray(r[5]) ? r[5] : null;
      if (x) {
        b.img = shareCover(x.im); if (b.img && x.L === 1) b.imgL = b.img;
        b.gen = shareClean(x.g, 80);
        if (typeof x.p === 'number' && x.p > 0 && x.p < 100000) b.pg = String(Math.round(x.p));
      }
      return b.t || b.i ? b : null;
    }).filter(Boolean);
    if (!books.length) return null;
    var kind = ['book', 'fav', 'wish', 'list'].indexOf(o.k) >= 0 ? o.k : 'list';
    if (kind === 'book' && books.length > 1) kind = 'list';
    return { name: shareClean(o.n, 30), kind: kind, title: kind === 'list' ? shareClean(o.h, 40) : '', books: books };
  }
  function diChi(n) { return 'di ' + n; }
  /* Titolo che vede chi riceve: «I preferiti di Piero», «Piero ti consiglia un libro», «Gialli · lista di Piero»... */
  function shareHeading(sh) {
    var n = sh.name, k = sh.kind, c = sh.books.length;
    if (k === 'book') return n ? n + ' ti consiglia un libro' : 'Un libro consigliato';
    if (k === 'fav') return n ? 'I consigli ' + diChi(n) : 'Una lista di libri consigliati';
    if (k === 'wish') return n ? 'I desideri ' + diChi(n) : 'Una lista dei desideri';
    if (sh.title) return '«' + sh.title + '»' + (n ? ' · lista ' + diChi(n) : '');
    return n ? (c === 1 ? 'Un libro da ' + n : 'Una lista ' + diChi(n)) : (c === 1 ? 'Un libro per te' : 'Una lista di libri');
  }
  /* Etichetta breve salvata sul libro importato: da quale lista arriva */
  function shareLabel(sh) {
    if (sh.kind === 'fav') return 'Consigliati';
    if (sh.kind === 'wish') return 'Desideri';
    return sh.kind === 'list' ? sh.title : '';
  }
  /* Testo leggibile del messaggio (anche per chi non ha l'app); il link si aggiunge dopo */
  function shareText(sh, maxLines) {
    maxLines = maxLines || 25;
    function line(b) { var ed = [b.e, b.y].filter(Boolean).join(', '); return (b.t ? '«' + b.t + '»' : 'ISBN ' + b.i) + (b.a ? ' di ' + b.a : '') + (ed ? ' (' + ed + ')' : ''); }
    var bs = sh.books, head = shareHeading(sh);
    if (sh.kind === 'book' || bs.length === 1) {
      var b0 = bs[0], more = [b0.gen, b0.pg ? b0.pg + ' pagine' : ''].filter(Boolean).join(' · ');
      return head + ':\n' + line(b0) + (more ? '\n' + more : '') + (b0.i && b0.t ? '\nISBN ' + b0.i : '');
    }
    var shown = bs.slice(0, maxLines).map(function (b) { return '• ' + line(b); });
    return head + ' (' + bs.length + ' libri):\n' + shown.join('\n') + (bs.length > maxLines ? '\n… e altri ' + (bs.length - maxLines) : '');   // giro 7: niente prezzi nelle condivisioni
  }

  var MERGE_KEYS = ['t', 'a', 'e', 'y', 'c', 'i', 'img', 'imgL', 'sh', 'gen', 'pg', 'p', 'pd', 'rs', 'rt', 'rd', 'pp', 'ppd', 'ds', 'se', 'sn', 'sq'];
  /* Tiene il libro piu' completo (a parita', il piu' vecchio) e lo riempie con i dati degli altri; le note si sommano. */
  function mergeBooks(group) {
    function filled(b) { return MERGE_KEYS.filter(function (k) { return b[k] != null && b[k] !== '' && b[k] !== 0; }).length + (b.n ? 1 : 0); }
    var sorted = group.slice().sort(function (x, y) { return filled(y) - filled(x) || (x.ts || 0) - (y.ts || 0); });
    var keep = JSON.parse(JSON.stringify(sorted[0]));
    sorted.slice(1).forEach(function (o) {
      MERGE_KEYS.forEach(function (k) { if ((keep[k] == null || keep[k] === '' || keep[k] === 0) && o[k] != null && o[k] !== '' && o[k] !== 0) keep[k] = o[k]; });
      if (o.n && (keep.n || '').indexOf(o.n) < 0) keep.n = keep.n ? keep.n + ' · ' + o.n : o.n;
      if (Array.isArray(o.qs) && o.qs.length) keep.qs = (keep.qs || []).concat(o.qs.filter(function (x) { return !(keep.qs || []).some(function (y) { return y.x === x.x; }); }));
    });
    keep.g = (keep.g || []).filter(function (k) { return keep[k]; });
    keep.cp = group.some(function (b) { return b.cp; });
    return { keep: keep, removed: sorted.slice(1).map(function (b) { return b.id; }) };
  }

  /* ---------- statistiche ---------- */
  function top(map, n) {
    return Object.keys(map).map(function (k) { return { k: k, n: map[k] }; })
      .sort(function (a, b) { return b.n - a.n || (a.k < b.k ? -1 : a.k > b.k ? 1 : 0); }).slice(0, n || 8);
  }
  function computeStats(books) {
    var st = { n: 0, total: 0, priced: 0, pages: 0, paged: 0, guess: 0, noPrice: 0, loans: [], authors: {}, publishers: {}, genres: {}, shelves: {}, decades: {},
      read: 0, reading: 0, toRead: 0, rated: 0, ratingSum: 0, readYears: {}, pagesRead: 0, gone: 0, goneBy: { v: 0, r: 0, s: 0 } };
    (books || []).forEach(function (b) {
      var pg0 = parseInt(b.pg, 10);
      if (b.rs === 'ok') { st.read++; if (pg0 > 0) st.pagesRead += pg0; var ry = str(b.rd).slice(0, 4); if (/^\d{4}$/.test(ry)) st.readYears[ry] = (st.readYears[ry] || 0) + 1; }
      if (b.rt > 0) { st.rated++; st.ratingSum += b.rt; }
      // venduti, regalati, smarriti: contano per le letture, non per la libreria di oggi
      if (b.xs && GONE_LABEL[b.xs]) { st.gone++; st.goneBy[b.xs]++; return; }
      st.n++;
      if (typeof b.c === 'number' && isFinite(b.c)) { st.total += b.c; st.priced++; } else st.noPrice++;
      var pg = parseInt(b.pg, 10); if (pg > 0) { st.pages += pg; st.paged++; }
      if (b.g && b.g.length) st.guess++;
      if (b.p) st.loans.push({ id: b.id, t: b.t || b.i || 'Senza titolo', p: b.p, pd: b.pd || '' });
      str(b.a).split(/\s*,\s*/).filter(Boolean).forEach(function (a) { st.authors[a] = (st.authors[a] || 0) + 1; });
      if (b.e) st.publishers[b.e] = (st.publishers[b.e] || 0) + 1;
      if (b.gen) st.genres[b.gen] = (st.genres[b.gen] || 0) + 1;
      if (b.sh) st.shelves[b.sh] = (st.shelves[b.sh] || 0) + 1;
      var y = parseInt(b.y, 10); if (y > 1000) { var d = Math.floor(y / 10) * 10; st.decades[d] = (st.decades[d] || 0) + 1; }
      if (b.rs === 'in') st.reading++;
      else if (b.rs === 'da') st.toRead++;
    });
    st.avg = st.priced ? st.total / st.priced : 0;
    st.avgRating = st.rated ? st.ratingSum / st.rated : 0;
    st.byReadYear = Object.keys(st.readYears).sort().map(function (k) { return { k: k, n: st.readYears[k] }; });
    st.loans.sort(function (a, b) { return a.pd < b.pd ? -1 : a.pd > b.pd ? 1 : 0; });
    st.topAuthors = top(st.authors, 8); st.topPublishers = top(st.publishers, 8); st.topGenres = top(st.genres, 8); st.topShelves = top(st.shelves, 10);
    st.byDecade = Object.keys(st.decades).map(Number).sort(function (a, b) { return a - b; }).map(function (d) { return { k: d + '–' + (d + 9), n: st.decades[d] }; });
    return st;
  }
  /* "oggi", "ieri", "3 giorni fa", "2 settimane fa", "4 mesi fa" */
  function agoText(ts, now) {
    if (!ts) return 'mai';
    var days = Math.floor(((now || Date.now()) - ts) / 86400000);
    if (days <= 0) return 'oggi';
    if (days === 1) return 'ieri';
    if (days < 14) return days + ' giorni fa';
    if (days < 60) return Math.floor(days / 7) + ' settimane fa';
    if (days < 730) return Math.floor(days / 30) + ' mesi fa';
    return Math.floor(days / 365) + ' anni fa';
  }

  /* ---------- descrizione del libro ---------- */
  var ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…', ndash: '–', mdash: '—',
    egrave: 'è', eacute: 'é', agrave: 'à', igrave: 'ì', ograve: 'ò', ugrave: 'ù', Egrave: 'È', Eacute: 'É', Agrave: 'À' };
  function cp(n) { n = +n; try { return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; } catch (e) { return ''; } }
  /* testo semplice da HTML di Google o markdown di Open Library; lungo al massimo DESC_MAX */
  var DESC_MAX = 2000;
  function cleanDesc(v) {
    var s = str(v);
    if (!s) return '';
    s = s.replace(/\r/g, '')
      .replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\/\s*(p|div|li|h\d|blockquote)\s*>/gi, '\n').replace(/<\s*li[^>]*>/gi, '• ').replace(/<[^>]*>/g, '')
      .replace(/&#(\d+);/g, function (m, n) { return cp(n); }).replace(/&#x([0-9a-f]+);/gi, function (m, n) { return cp(parseInt(n, 16)); })
      .replace(/&([a-z]+);/gi, function (m, n) { return ENT.hasOwnProperty(n) ? ENT[n] : m; })
      .replace(/\n\s*-{3,}[\s\S]*$/, '')                                  // Open Library: note e fonti in fondo
      .replace(/\(\s*\[[^\]]*\]\s*\[\d+\]\s*\)/g, '').replace(/^\s*\[\d+\]:.*$/gm, '')
      .replace(/\[([^\]]+)\]\((?:https?:)?[^)]*\)/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1');
    s = s.split(/\n+/).map(function (p) { return p.replace(/[ \t ]+/g, ' ').trim(); }).filter(Boolean).join('\n');
    if (s.length > DESC_MAX) {
      var cut = s.slice(0, DESC_MAX), k = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.\n'), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
      s = k > DESC_MAX * 0.6 ? cut.slice(0, k + 1) : cut.replace(/\s+\S*$/, '') + '…';
    }
    return s.replace(/\s+$/, '').length >= 30 ? s : '';
  }
  /* lingua del testo: italiano, inglese o '' se non si capisce */
  var IT_W = /^(il|lo|la|gli|le|di|del|della|che|un|una|per|con|non|nel|nella|sono|e|ma|come|suo|sua|dei|delle|questo|questa|anche|piu|tra|dalla|alla)$/;
  var EN_W = /^(the|of|and|to|in|is|that|with|for|his|her|this|was|are|by|from|an|as|on|be|it|which|their|who|has|have)$/;
  function guessLang(text) {
    var it = 0, en = 0;
    norm(text).split(/[^a-zà-ù']+/).forEach(function (w) { if (IT_W.test(w)) it++; else if (EN_W.test(w)) en++; });
    if (it + en < 4) return '';
    return it >= en * 1.5 ? 'it' : en >= it * 1.5 ? 'en' : '';
  }
  function words(s) { return norm(s).replace(/[^a-z0-9à-ù]+/g, ' ').split(' ').filter(function (w) { return w.length > 2; }); }
  /* sceglie fra i risultati di Google la descrizione migliore: titolo (e autore) coerenti, italiano preferito */
  function pickDesc(json, title, author) {
    var items = (json && Array.isArray(json.items)) ? json.items : [];
    var tw = words(title), aw = words(str(author).split(/[,;]/)[0]);
    var best = null;
    items.forEach(function (it, i) {
      var v = (it && it.volumeInfo) || {};
      var text = cleanDesc(v.description);
      if (!text) return;
      if (tw.length) {
        var have = words(str(v.title) + ' ' + str(v.subtitle)), hit = tw.filter(function (w) { return have.indexOf(w) >= 0; }).length;
        if (hit < Math.ceil(tw.length * 0.6)) return;
        if (aw.length && Array.isArray(v.authors)) {
          var va = words(v.authors.map(str).join(' '));
          if (!aw.some(function (w) { return va.indexOf(w) >= 0; })) return;
        }
      }
      var lang = guessLang(text) || str(v.language).slice(0, 2).toLowerCase();
      var score = (lang === 'it' ? 100 : 0) + Math.min(text.length, 600) / 10 - i;
      if (!best || score > best.score) best = { text: text, lang: lang, score: score };
    });
    return best ? { text: best.text, lang: best.lang } : null;
  }
  /* Open Library: description e' una stringa oppure { type, value } */
  function olDesc(json) {
    var d = json && json.description;
    return cleanDesc(d && typeof d === 'object' ? d.value : d);
  }

  /* ---------- serie e collane ---------- */
  function serKey(v) { return norm(str(v).trim().replace(/\s+/g, ' ')); }
  /* per ogni serie: volumi che hai, quelli nei Desideri, quelli che mancano (fino al totale, o fino al numero piu' alto che hai) */
  function seriesInfo(books) {
    var m = {};
    (books || []).forEach(function (b) {
      var k = serKey(b.se);
      if (!k) return;
      var s = m[k] || (m[k] = { key: k, name: str(b.se).trim().replace(/\s+/g, ' '), total: 0, have: [], wish: [], n: 0, nw: 0, author: '' });
      var n = parseInt(b.sn, 10) || 0, t = parseInt(b.sq, 10) || 0;
      if (t > s.total) s.total = t;
      if (!s.author && b.a) s.author = str(b.a);
      if (b.w) { s.nw++; if (n && s.wish.indexOf(n) < 0) s.wish.push(n); }
      else if (!b.xs) { s.n++; if (n && s.have.indexOf(n) < 0) s.have.push(n); }
    });
    Object.keys(m).forEach(function (k) {
      var s = m[k], num = function (a, b) { return a - b; };
      s.have.sort(num); s.wish.sort(num);
      var top = Math.min(300, Math.max(s.total, s.have.length ? s.have[s.have.length - 1] : 0));
      s.missing = [];
      for (var i = 1; i <= top; i++) if (s.have.indexOf(i) < 0) s.missing.push(i);
      s.toAdd = s.missing.filter(function (i) { return s.wish.indexOf(i) < 0; });
    });
    return m;
  }
  /* ---------- novita' di un autore ---------- */
  function titleKey(t) { return norm(str(t).split(/\s*[:.(\[]\s*/)[0]).replace(/[^a-z0-9]+/g, ' ').trim(); }
  /* dai risultati di Google (i piu' recenti di un autore) tiene i libri usciti da minYear che non hai gia' */
  function pickNews(json, author, own, minYear, maxYear, lang) {
    var aw = words(author), seen = {}, out = [];
    if (lang == null) lang = 'it';                     // '' = tutte le lingue
    var titles = (own && own.titles) || {}, isbns = (own && own.isbns) || {}, hide = (own && own.hide) || {};
    parseGoogle(json).forEach(function (c) {
      var y = parseInt(c.y, 10) || 0, k = titleKey(c.t);
      if (!k || y < minYear || (maxYear && y > maxYear)) return;
      var ca = words(c.a);
      if (author !== '' && (!aw.length || !aw.every(function (w) { return ca.indexOf(w) >= 0; }))) return;
      if (lang && c.lang && c.lang !== lang) return;
      if (titles[k] || hide[k] || c.isbns.some(function (i) { return isbns[i]; })) return;
      if (seen[k]) { if (!seen[k].img && c.img) seen[k].img = c.img; return; }
      out.push(seen[k] = { k: k, t: c.t, a: c.a, e: c.e, y: c.y, i: c.i, img: c.img, by: author });
    });
    return out.sort(function (x, y) { return y.y - x.y; });
  }
  /* ---------- cosa leggere dopo: i libri «da leggere», in ordine, ognuno col suo perché ----------
     Serie (il seguito di quello letto), autori e generi letti spesso o votati bene, attesa in libreria,
     un libro breve dopo uno lungo. Esclusi i prestati e quelli non più in libreria. */
  function authorList(a) { return str(a).split(/\s*[,;]\s*/).map(function (x) { return x.trim(); }).filter(function (x) { return x.length > 1; }); }
  function pagesNum(b) { var n = parseInt(b && b.pg, 10); return n > 0 && n < 20000 ? n : 0; }
  /* il voto: da 1 a 5 libricini, ognuno con la sua parola (prova del 16/11/2026: prima erano stelle) */
  var RATE_WORDS = ['Non mi è piaciuto', 'Così così', 'Bello', 'Bellissimo', 'Capolavoro'];
  function rateWord(n) { n = Math.round(Number(n) || 0); return n >= 1 && n <= 5 ? RATE_WORDS[n - 1] : ''; }
  function stars(n) { return '«' + rateWord(Math.max(1, Math.min(5, Math.round(n)))) + '»'; }
  function nextReads(books, now) {
    now = now || Date.now();
    var all = (books || []).filter(function (b) { return b && !b.w; });
    var read = all.filter(function (b) { return b.rs === 'ok'; });
    var last = read.filter(function (b) { return b.rd; }).sort(function (x, y) { return x.rd < y.rd ? 1 : x.rd > y.rd ? -1 : (y.ts || 0) - (x.ts || 0); })[0] || null;
    var au = {}, ge = {}, ser = {};
    function add(m, k, name, rt) { var s = m[k] || (m[k] = { name: name, n: 0, r: 0, rn: 0 }); s.n++; if (rt) { s.r += rt; s.rn++; } }
    read.forEach(function (b) {
      authorList(b.a).forEach(function (n) { add(au, norm(n), n, b.rt); });
      var g = norm(str(b.gen).trim()); if (g) add(ge, g, str(b.gen).trim(), b.rt);
    });
    all.forEach(function (b) {
      var k = serKey(b.se); if (!k) return;
      var s = ser[k] || (ser[k] = { name: str(b.se).trim(), read: 0, todo: [] }), n = parseInt(b.sn, 10) || 0;
      if ((b.rs === 'ok' || b.rs === 'in') && n > s.read) { s.read = n; s.readT = b.t; }
      if (b.rs === 'da' && n && !b.p && !b.xs) s.todo.push(n);
    });
    var cands = all.filter(function (b) { return b.rs === 'da' && !b.p && !b.xs && (b.t || b.a); });
    var lastPg = last ? pagesNum(last) : 0;
    return cands.map(function (c) {
      var sc = 0, why = [];
      function say(w, txt) { why.push({ w: w, txt: txt }); }
      var sk = serKey(c.se), s = sk && ser[sk], cn = parseInt(c.sn, 10) || 0;
      if (s && cn) {
        var lowest = Math.min.apply(null, s.todo.length ? s.todo : [cn]);
        if (s.read && cn === s.read + 1) { sc += 100; say(100, 'È il seguito: vol. ' + cn + ' di «' + s.name + '», hai letto il ' + s.read + '.'); }
        else if (s.read && cn > s.read && cn === lowest) { sc += 60; say(60, 'Il prossimo che hai della serie «' + s.name + '».'); }
        else if (!s.read && cn === lowest) { sc += 12; say(12, 'Il primo che hai della serie «' + s.name + '».'); }
        if (cn > lowest) sc -= 45;                       // prima i volumi precedenti
      }
      var bestA = null;
      authorList(c.a).forEach(function (n) { var x = au[norm(n)]; if (x && (!bestA || x.n + (x.rn ? x.r / x.rn : 0) > bestA.n + (bestA.rn ? bestA.r / bestA.rn : 0))) bestA = x; });
      if (bestA) {
        var avg = bestA.rn ? bestA.r / bestA.rn : 0;
        if (avg >= 4) { var pa = 25 + 5 * Math.min(bestA.n, 3); sc += pa; say(pa, 'Di ' + bestA.name + ': ai suoi libri hai dato ' + (bestA.rn > 1 ? 'in media ' : '') + stars(avg) + '.'); }
        else if (bestA.n >= 2) { var pb = 8 * Math.min(bestA.n, 4); sc += pb; say(pb, 'Di ' + bestA.name + ': ne hai già letti ' + bestA.n + '.'); }
        else if (!bestA.rn || avg >= 3) { sc += 5; say(5, 'Di ' + bestA.name + ', che hai già letto.'); }
        else sc -= 5;
      }
      var g = ge[norm(str(c.gen).trim())];
      if (g && g.n >= 2) {
        var ga = g.rn ? g.r / g.rn : 0, pg = 5 * Math.min(g.n, 5) + (ga >= 4 ? 10 : 0);
        sc += pg; say(pg, 'Genere che leggi spesso: ' + g.name + '.');
      }
      if (c.ts > 946684800000) {                         // aggiunto dopo il 2000: una data vera
        var days = (now - c.ts) / 864e5, pw = Math.min(25, Math.max(0, days / 30));
        sc += pw;
        var yrs = Math.floor(days / 365);
        if (yrs >= 1) say(pw, yrs === 1 ? 'Aspetta in libreria da più di un anno.' : 'Aspetta in libreria da ' + yrs + ' anni.');
      }
      var cp = pagesNum(c);
      if (lastPg >= 450 && cp && cp <= 250) { sc += 20; say(20, 'È breve (' + cp + ' pagine): una pausa dopo le ' + lastPg + ' di «' + str(last.t) + '».'); }
      if (!why.length) say(0, 'È tra i tuoi libri da leggere.');
      return { id: c.id, score: Math.round(sc * 10) / 10, why: why.sort(function (x, y) { return y.w - x.w; }).map(function (x) { return x.txt; }) };
    }).sort(function (x, y) { return y.score - x.score; });
  }
  /* il genere com'e' nell'app («Gialli», «Storia»...) -> la parola che usa Google Libri per cercarlo */
  function genreSubject(gen) {
    var g = str(gen).trim(), lg = g.toLowerCase();
    if (!g) return '';
    var more = { 'gialli': 'mystery', 'giallo': 'mystery', 'thriller': 'thrillers', 'noir': 'noir', 'fantascienza': 'science fiction', 'fantasy': 'fantasy',
      'romanzi': 'fiction', 'romanzo': 'fiction', 'horror': 'horror', 'rosa': 'romance', 'romanzi rosa': 'romance', 'classici': 'classics', 'storici': 'historical fiction', 'romanzi storici': 'historical fiction' };
    if (more[lg]) return more[lg];
    for (var k in GENRE_IT) if (GENRE_IT[k].toLowerCase() === lg) return k;
    return g;
  }
  /* ---------- testo di una pagina letta da foto: righe riunite in paragrafi ---------- */
  function ocrParagraph(text, max) {
    var out = '', gap = false;
    str(text).replace(/\r/g, '').split('\n').forEach(function (line) {
      line = line.replace(/[|_~^`]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (!line) { gap = true; return; }
      if ((line.match(/[A-Za-zÀ-ÿ]/g) || []).length < 2) return;
      if (!out) out = line;
      else if (/[A-Za-zÀ-ÿ]-$/.test(out) && /^[a-zà-ÿ]/.test(line)) out = out.slice(0, -1) + line;
      else if (gap && /[.!?»”"]$/.test(out)) out += '\n' + line;
      else out += ' ' + line;
      gap = false;
    });
    return out.slice(0, max || 1500).trim();
  }

  return {
    str: str, norm: norm, parseNum: parseNum, fmtNum: fmtNum, yearOf: yearOf,
    sortKeyTitle: sortKeyTitle, sortKeyAuthor: sortKeyAuthor, authorParts: authorParts, authorInv: authorInv,
    isbnClean: isbnClean, isbn13Valid: isbn13Valid, isbn10Valid: isbn10Valid, isbn10to13: isbn10to13, isbn13to10: isbn13to10,
    toIsbn13: toIsbn13, fmtIsbn: fmtIsbn, extractIsbns: extractIsbns, ocrIsbns: ocrIsbns, parseIsbnList: parseIsbnList,
    parseGoogle: parseGoogle, parseOlSearch: parseOlSearch, parseOpenLibrary: parseOpenLibrary, lookupIsbn: lookupIsbn, parseCrossref: parseCrossref, isbnPrefix: isbnPrefix, guessPublisher: guessPublisher, diagnose: diagnose, openLibrarySearch: openLibrarySearch, searchText: searchText,
    tokens: tokens, fuzzyHas: fuzzyHas, splitTitleAuthor: splitTitleAuthor, ocrLines: ocrLines, goodLines: goodLines, topLines: topLines, buildQueries: buildQueries,
    scoreCandidate: scoreCandidate, rankCandidates: rankCandidates, strongMatch: strongMatch, buildShare: buildShare, parseShare: parseShare, shareHeading: shareHeading, shareLabel: shareLabel, shareText: shareText, SHARE_MAX: SHARE_MAX,
    csvCell: csvCell, buildCSV: buildCSV, buildTSV: buildTSV, rowsFor: rowsFor, colsFor: colsFor, itDate: itDate,
    genreIt: genreIt, crc32: crc32, zipStore: zipStore, buildXLSX: buildXLSX, publisherGroups: publisherGroups, pubTokens: pubTokens,
    computeStats: computeStats, agoText: agoText, coverCandidates: coverCandidates, badBigCover: badBigCover, googleVolumeId: googleVolumeId, bestGoogleImage: bestGoogleImage, getJson: getJson,
    parseSbn: parseSbn, sbnUrl: sbnUrl, deweyGenre: deweyGenre, dupGroups: dupGroups, analyzeDups: analyzeDups, mergeBooks: mergeBooks, serKey: serKey, seriesInfo: seriesInfo, titleKey: titleKey, pickNews: pickNews, nextReads: nextReads, genreSubject: genreSubject, authorList: authorList, ocrParagraph: ocrParagraph, cleanDesc: cleanDesc, guessLang: guessLang, pickDesc: pickDesc, olDesc: olDesc, DESC_MAX: DESC_MAX, READ_LABEL: READ_LABEL, GONE_LABEL: GONE_LABEL, RATE_WORDS: RATE_WORDS, rateWord: rateWord
  };
});
