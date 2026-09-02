/* Le parole tecniche che affiorano ai bordi della banda d'apertura.
   Lo schema di rete (cavi, server, nuvola) è markup statico in index.html:
   senza JS resta tutto, si perdono solo le parole. Qui sta solo ciò che ha
   bisogno del caso — la posizione — perché a parità di disegno a ogni visita
   si vedrebbe sempre la stessa griglia di etichette. */
(() => {
  const layer = document.querySelector('[data-hero-fx]');
  if (!layer) return;

  const CONFIG = {
    // Sinistra: il ferro che arriva dai cavi. Destra: quello che sta nella nuvola.
    words: {
      onprem: ['Active Directory', 'Hypervisor', 'LAN / WLAN', 'Exchange Server', 'Storage', 'VPN'],
      cloud: ['Azure', 'Microsoft 365', 'Entra ID', 'Intune', 'Terraform', 'Graph API'],
    },
    // Fasce verticali libere: sopra e sotto il blocco di testo centrale.
    zones: [[8, 26], [72, 90]],
    // Distanza dai bordi laterali, in percentuale.
    inset: [4, 18],
  };

  /* Su schermi stretti il testo centrale mangia quasi tutta la banda: le stesse
     fasce ci finirebbero sopra. Qui si stringono ai bordi e si dimezzano le
     parole — sei per lato su 390px sarebbero comunque illeggibili. */
  const narrow = window.matchMedia('(max-width: 760px)').matches;
  if (narrow) {
    CONFIG.zones = [[3, 12], [88, 96]];
    CONFIG.inset = [3, 12];
    CONFIG.words.onprem = CONFIG.words.onprem.slice(0, 3);
    CONFIG.words.cloud = CONFIG.words.cloud.slice(0, 3);
  }

  const rand = (min, max) => Math.random() * (max - min) + min;

  /* Posizione casuale nelle fasce libere, con un tentativo di non accavallare.
     30 tentativi e poi si accetta comunque: su sei parole per lato il caso
     peggiore è due che si sfiorano, non vale un loop più lungo. */
  const placeWords = (words, side) => {
    const placed = [];
    const tooClose = (x, y) => placed.some((p) => Math.abs(p.x - x) < 8 && Math.abs(p.y - y) < 9);

    words.forEach((word) => {
      const node = document.createElement('div');
      node.className = `fx-word fx-word--${side}`;
      node.textContent = word;

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
})();
