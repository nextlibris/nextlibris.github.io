/* Next Libris: primo script della pagina (prima stava dentro index.html; spostato il 17/11/2026 per la Content-Security-Policy,
   che non ammette script scritti nella pagina). Gira prima di disegnare: niente lampi di colore.
   1) l'app dentro la cornice di un altro sito (iframe): si ferma e mostra solo un link per aprirla nella sua pagina
      (frame-ancestors non funziona nel <meta>, e GitHub Pages non permette intestazioni);
   2) aspetto e tema; app aperta dall'icona: schermata d'apertura con il nome. */
(function () {
  var dentro = false;
  try { dentro = window.top !== window.self; } catch (e) { dentro = true; }
  if (dentro) {
    try {
      document.write('<p style="font:16px/1.5 system-ui,sans-serif;margin:24px">Next Libris si apre solo nella sua pagina: ' +
        '<a href="' + location.href.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') + '" target="_top" rel="noopener">apri Next Libris</a></p><plaintext hidden style="display:none">');
    } catch (e) {}
    return;
  }
  try{if((window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true){document.documentElement.setAttribute('data-splash','');var tc=document.querySelector('meta[name="theme-color"]');if(tc)tc.setAttribute('content','#24563F');}}catch(e){}try{var c0=(location.pathname.match(/\/next-libris-([a-z]+)(\/|$)/)||[])[1];var s0=JSON.parse(localStorage.getItem((c0?c0+':':'')+'catalogo-libri-set')||'{}');document.documentElement.setAttribute('data-look','nuovo');var th0=s0.themeV2?s0.theme:(s0.theme==='dark'?'dark':'light');if(th0==='light'||th0==='dark')document.documentElement.setAttribute('data-theme',th0);document.documentElement.setAttribute('data-pal',s0.palV2&&s0.pal?s0.pal:'bosco');if(s0.ft)document.documentElement.setAttribute('data-ft',s0.ft);if(s0.fb)document.documentElement.setAttribute('data-fb',s0.fb);}catch(e){document.documentElement.setAttribute('data-look','nuovo');document.documentElement.setAttribute('data-theme','light');}
})();
