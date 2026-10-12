(() => {
  const root = document.documentElement;
  const header = document.querySelector('[data-header]');
  const themeToggle = document.querySelector('[data-theme-toggle]');
  const themeIcon = document.querySelector('[data-theme-icon]');
  const navToggle = document.querySelector('[data-nav-toggle]');
  const navMenu = document.querySelector('[data-nav-menu]');

  // La grafite fredda è l'identità del sito, non una variante: si apre così di
  // default invece di seguire il sistema. La scelta esplicita dell'utente vince
  // e viene ricordata — senza, su un sito multipagina il toggle si azzererebbe
  // a ogni navigazione.
  const STORE_KEY = 'am-theme';
  let stored = null;
  try { stored = localStorage.getItem(STORE_KEY); } catch { /* storage negato */ }

  let theme = stored === 'light' || stored === 'dark' ? stored : 'dark';
  root.setAttribute('data-theme', theme);

  const renderThemeIcon = () => {
    // L'etichetta dice dove porta il clic, non solo che il tema cambia.
    themeToggle?.setAttribute('aria-label', theme === 'dark' ? 'Passa al tema chiaro' : 'Passa al tema scuro');
    if (!themeIcon) return;
    themeIcon.innerHTML = theme === 'dark'
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path></svg>'
      : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
  };

  renderThemeIcon();

  themeToggle?.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem(STORE_KEY, theme); } catch { /* storage negato */ }
    renderThemeIcon();
  });

  const navLabel = navToggle?.querySelector('.sr-only');
  const setNav = (open) => {
    navMenu?.classList.toggle('is-open', open);
    navToggle?.setAttribute('aria-expanded', String(open));
    if (navLabel) navLabel.textContent = open ? 'Chiudi menu' : 'Apri menu';
  };
  const navOpen = () => Boolean(navMenu?.classList.contains('is-open'));

  navToggle?.addEventListener('click', () => setNav(!navOpen()));
  navMenu?.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setNav(false));
  });
  // Uscite d'emergenza: Esc riporta il focus sul pulsante, un tocco fuori
  // dalla testata chiude e basta.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && navOpen()) {
      setNav(false);
      navToggle?.focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (navOpen() && !header?.contains(event.target)) setNav(false);
  });

  const syncHeader = () => {
    if (!header) return;
    header.classList.toggle('is-scrolled', window.scrollY > 12);
  };

  document.addEventListener('scroll', syncHeader, { passive: true });
  syncHeader();

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add('is-visible');
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));

  // Copia dell'indirizzo email: il pulsante esiste solo con JS, quindi parte
  // nascosto e si mostra qui. Se gli appunti sono negati, seleziona il testo
  // così resta un Ctrl+C a portata.
  document.querySelectorAll('[data-copy]').forEach((button) => {
    const status = document.querySelector('[data-copy-status]');
    button.hidden = false;
    button.addEventListener('click', async () => {
      const value = button.dataset.copy;
      try {
        await navigator.clipboard.writeText(value);
        if (status) status.textContent = 'Indirizzo copiato.';
      } catch {
        const target = status?.previousElementSibling;
        if (target) window.getSelection()?.selectAllChildren(target);
        if (status) status.textContent = 'Selezionato: premi Ctrl+C per copiarlo.';
      }
    });
  });

  // Anno del copyright aggiornato a runtime. L'HTML contiene comunque l'anno
  // corrente come fallback: senza JS la riga resta valida, non vuota.
  const year = String(new Date().getFullYear());
  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = year; });
})();
