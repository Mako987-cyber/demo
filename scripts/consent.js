/* Consenso cookie — banner, pannello preferenze e caricamento condizionato.

   Il sito non usa cookie di profilazione né statistiche. Gli unici strumenti
   di prima parte sono tecnici (tema e questa scelta, in localStorage) e non
   richiedono consenso. L'unica risorsa di terza parte è Google Fonts: il
   browser che scarica i caratteri invia a Google IP e user agent, quindi parte
   solo dopo un consenso esplicito. Senza consenso resta il font di sistema.

   Va caricato SINCRONO in <head> (niente defer): per chi ha già accettato il
   foglio dei font deve partire prima del primo paint, non dopo il DOM.

   Nell'HTML i font sono dichiarati così, senza href:
     <link rel="stylesheet" data-consent="fonts" data-consent-href="https://…">
   Un <link> senza href non genera richieste; qui gli si copia l'URL solo se
   la categoria "fonts" è stata accettata. */
(() => {
  const STORE_KEY = 'am-consent';
  // Da incrementare quando cambia l'elenco delle categorie: le scelte salvate
  // con una versione precedente vengono ignorate e il banner ricompare.
  const VERSION = 1;
  // Sei mesi, come indicato dalle Linee guida del Garante (10 giugno 2021):
  // dopo un rifiuto il banner non va riproposto prima di questo intervallo.
  const MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;
  const POLICY_URL = '/pages/cookie-policy.html';

  const root = document.documentElement;
  const skin = document.currentScript?.dataset.skin || 'site';

  const read = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY));
      if (!raw || raw.v !== VERSION || typeof raw.t !== 'number') return null;
      if (Date.now() - raw.t > MAX_AGE_MS) return null;
      return { fonts: raw.fonts === true };
    } catch { return null; /* storage negato o valore corrotto */ }
  };

  const write = (choice) => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ v: VERSION, t: Date.now(), fonts: choice.fonts }));
    } catch { /* storage negato: la scelta vale solo per questa pagina */ }
  };

  let consent = read();

  const applyFonts = (allowed) => {
    document.querySelectorAll('link[data-consent="fonts"]').forEach((link) => {
      if (allowed) {
        if (!link.getAttribute('href')) link.setAttribute('href', link.dataset.consentHref);
      } else {
        // Revoca: togliere href scarica il foglio e ferma nuove richieste.
        link.removeAttribute('href');
      }
    });
  };

  applyFonts(Boolean(consent?.fonts));

  // ── Interfaccia ─────────────────────────────────────────────────────
  const ICON_CLOSE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  let panel = null;
  let lastFocus = null;

  const build = () => {
    const el = document.createElement('section');
    el.className = `cc cc--${skin}`;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'false');
    el.setAttribute('aria-labelledby', 'cc-title');
    el.setAttribute('aria-describedby', 'cc-desc');
    el.setAttribute('lang', 'it');
    el.dataset.mode = 'banner';
    el.hidden = true;
    el.innerHTML = `
      <button class="cc__close" type="button" data-cc-action="reject"
              aria-label="Chiudi: continua senza accettare" title="Chiudi: continua senza accettare">${ICON_CLOSE}</button>
      <div class="cc__body">
        <p class="cc__eyebrow">Cookie e privacy</p>
        <h2 class="cc__title" id="cc-title" tabindex="-1">Nessuna profilazione. Solo un font, se vuoi.</h2>
        <p class="cc__text" id="cc-desc">
          Questo sito usa solo strumenti tecnici per ricordare il tema e le tue scelte.
          Con il tuo consenso carico i caratteri tipografici da Google Fonts: in quel caso
          il browser invia a Google il tuo indirizzo IP. Se rifiuti, il sito funziona
          allo stesso modo con i font di sistema. Puoi cambiare idea in qualsiasi momento
          da <em>Preferenze cookie</em> a piè di pagina.
          <a class="cc__policy" href="${POLICY_URL}">Leggi la cookie policy</a>
        </p>
      </div>

      <div class="cc__prefs" data-cc-prefs>
        <div class="cc__cat">
          <div class="cc__cat-head">
            <h3 class="cc__cat-title" id="cc-cat-tech">Tecnici · necessari</h3>
            <span class="cc__always">Sempre attivi</span>
          </div>
          <p class="cc__cat-text">
            Ricordano il tema chiaro o scuro (<code>am-theme</code>) e questa scelta
            (<code>am-consent</code>). Restano nel tuo browser e non vengono inviati a nessuno.
          </p>
        </div>
        <div class="cc__cat">
          <div class="cc__cat-head">
            <h3 class="cc__cat-title"><label for="cc-fonts">Terze parti · Google Fonts</label></h3>
            <input class="cc__switch" type="checkbox" role="switch" id="cc-fonts" data-cc-fonts
                   aria-describedby="cc-fonts-desc" />
          </div>
          <p class="cc__cat-text" id="cc-fonts-desc">
            Caratteri tipografici forniti da Google Ireland Ltd. Al caricamento Google riceve
            indirizzo IP e dati tecnici del browser. Google dichiara di non impostare cookie
            con questo servizio.
          </p>
        </div>
        <p class="cc__note">Nessun cookie di profilazione, statistico o pubblicitario.</p>
      </div>

      <div class="cc__actions">
        <button class="cc__link" type="button" data-cc-action="customize">Personalizza</button>
        <button class="cc__btn" type="button" data-cc-action="reject">Rifiuta</button>
        <button class="cc__btn cc__btn--save" type="button" data-cc-action="save">Salva scelte</button>
        <button class="cc__btn" type="button" data-cc-action="accept">Accetta</button>
      </div>`;

    el.addEventListener('click', (event) => {
      const action = event.target.closest('[data-cc-action]')?.dataset.ccAction;
      if (action === 'accept') decide({ fonts: true });
      else if (action === 'reject') decide({ fonts: false });
      else if (action === 'save') decide({ fonts: el.querySelector('[data-cc-fonts]').checked });
      else if (action === 'customize') setMode('prefs', true);
    });

    // Esc chiude solo se una scelta esiste già: al primo accesso chiudere
    // senza decidere non è un'opzione, lo è la X (che vale come rifiuto).
    el.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && consent) close();
    });

    // Prima del contenuto nell'ordine di tabulazione, subito dopo lo skip link.
    const skip = document.querySelector('.skip-link');
    if (skip) skip.after(el); else document.body.prepend(el);
    return el;
  };

  const setMode = (mode, focus) => {
    panel.dataset.mode = mode;
    panel.querySelector('[data-cc-fonts]').checked = Boolean(consent?.fonts);
    if (focus) panel.querySelector(mode === 'prefs' ? '[data-cc-fonts]' : '#cc-title').focus();
  };

  const open = (mode = 'banner') => {
    if (!panel) panel = build();
    lastFocus = document.activeElement;
    panel.hidden = false;
    setMode(mode, mode === 'prefs');
  };

  const close = () => {
    if (!panel) return;
    panel.hidden = true;
    if (lastFocus && document.contains(lastFocus) && lastFocus !== document.body) lastFocus.focus();
  };

  const decide = (choice) => {
    consent = { fonts: choice.fonts };
    write(consent);
    applyFonts(consent.fonts);
    close();
  };

  const init = () => {
    // I comandi "Preferenze cookie" sono nascosti nell'HTML: senza JS non
    // farebbero nulla, e un bottone morto è peggio di nessun bottone.
    document.querySelectorAll('[data-consent-open]').forEach((trigger) => {
      trigger.hidden = false;
      trigger.addEventListener('click', () => open('prefs'));
    });
    if (!consent) open('banner');
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.SiteConsent = {
    get: () => (consent ? { ...consent } : null),
    open: () => open('prefs'),
  };
})();
