/* Costruisce il fondo animato della banda d'apertura.
   Sta in JS e non in HTML per due motivi: le parole vanno posizionate a caso
   (altrimenti a ogni visita si vede lo stesso disegno) e il layer è puramente
   decorativo — se lo script non gira, la banda resta leggibile con la sola
   griglia CSS. Nessuna dipendenza esterna, nessun canvas: solo nodi animati
   dal compositor. */
(() => {
  const host = document.querySelector('[data-hero-fx]');
  if (!host) return;

  const CONFIG = {
    // Sinistra: il ferro. Destra: il cloud. Al centro si incontrano.
    words: {
      onprem: ['Active Directory', 'Hypervisor', 'LAN / WLAN', 'Exchange Server', 'Storage', 'VPN'],
      cloud: ['Azure', 'Microsoft 365', 'Entra ID', 'Intune', 'Terraform', 'Graph API'],
    },
    particlesPerOrbit: 4,
    // Fasce verticali libere: sopra e sotto il blocco di testo centrale.
    zones: [[8, 26], [72, 90]],
    // Distanza dai bordi laterali, in percentuale.
    inset: [5, 22],
  };

  /* Su schermi stretti il testo centrale mangia quasi tutta la banda: le stesse
     fasce ci finirebbero sopra. Qui si stringono ai bordi e si dimezzano le
     parole — sei per lato su 390px sarebbero comunque illeggibili. */
  const narrow = window.matchMedia('(max-width: 760px)').matches;
  if (narrow) {
    CONFIG.zones = [[3, 12], [88, 96]];
    CONFIG.inset = [4, 16];
    CONFIG.words.onprem = CONFIG.words.onprem.slice(0, 3);
    CONFIG.words.cloud = CONFIG.words.cloud.slice(0, 3);
  }

  const el = (className, text) => {
    const node = document.createElement('div');
    node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  const rand = (min, max) => Math.random() * (max - min) + min;

  const layer = el('fx-layer');

  layer.append(
    el('fx-wave fx-wave--onprem'),
    el('fx-wave fx-wave--cloud'),
    el('fx-scanline'),
  );

  /* Parole: posizione casuale nelle fasce libere, con un tentativo di non
     accavallarle. 30 tentativi e poi si accetta comunque — su sei parole per
     lato il caso peggiore è due che si sfiorano, non vale un loop più lungo. */
  const placeWords = (words, side) => {
    const placed = [];
    const tooClose = (x, y) => placed.some((p) => Math.abs(p.x - x) < 8 && Math.abs(p.y - y) < 9);

    words.forEach((word) => {
      const node = el(`fx-word fx-word--${side}`, word);
      let x, y, attempts = 0;

      do {
        const zone = CONFIG.zones[Math.floor(Math.random() * CONFIG.zones.length)];
        y = rand(zone[0], zone[1]);
        x = rand(CONFIG.inset[0], CONFIG.inset[1]);
        attempts += 1;
      } while (tooClose(x, y) && attempts < 30);

      placed.push({ x, y });
      node.style.top = `${y}%`;
      node.style[side === 'onprem' ? 'left' : 'right'] = `${x}%`;
      node.style.rotate = `${rand(-5, 5)}deg`;
      // Cicli sfalsati: sincronizzate sembrerebbero una lista che lampeggia.
      node.style.animationDelay = `${rand(0, 9)}s`;
      node.style.animationDuration = `${rand(11, 16)}s`;
      layer.appendChild(node);
    });
  };

  placeWords(CONFIG.words.onprem, 'onprem');
  placeWords(CONFIG.words.cloud, 'cloud');

  // Il centro: i due flussi, le particelle che li percorrono, il nucleo e gli anelli.
  const core = el('fx-core');
  ['onprem', 'cloud'].forEach((side) => {
    ['', ' is-top', ' is-bottom'].forEach((position) => {
      core.appendChild(el(`fx-flow fx-flow--${side}${position}`));
      core.appendChild(el(`fx-pulse-particle fx-pulse-particle--${side}${position}`));
    });
  });
  core.append(
    el('fx-fusion'),
    el('fx-ring'),
    el('fx-ring fx-ring--2'),
    el('fx-ring fx-ring--3'),
  );
  layer.appendChild(core);

  ['onprem', 'cloud'].forEach((side) => {
    const orbit = el(`fx-orbit fx-orbit--${side}`);
    for (let i = 0; i < CONFIG.particlesPerOrbit; i += 1) orbit.appendChild(el('fx-particle'));
    layer.appendChild(orbit);
  });

  host.replaceChildren(layer);
})();
