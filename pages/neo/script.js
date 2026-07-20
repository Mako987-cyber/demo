/* ============================================================
   NEO Tracker – script.js
   Visualizzazione Near Earth Objects con Canvas 2D + NASA API
   ============================================================ */

(function () {
  'use strict';

  /* ── DOM refs ─────────────────────────────────────────── */
  const startInput   = document.getElementById('start-date');
  const endInput     = document.getElementById('end-date');
  const loadBtn      = document.getElementById('load-neo');
  const messageBox   = document.getElementById('neo-message');
  const neoScene     = document.getElementById('neo-scene');
  const canvas       = document.getElementById('neo-canvas');
  const tooltip      = document.getElementById('neo-tooltip');
  const statsBar     = document.getElementById('neo-stats');
  const statTotal    = document.getElementById('stat-total');
  const statSafe     = document.getElementById('stat-safe');
  const statHazard   = document.getElementById('stat-hazard');
  const legendEl     = document.getElementById('neo-legend');
  const listSection  = document.getElementById('neo-list-section');
  const listEl       = document.getElementById('neo-list');
  const ctx          = canvas.getContext('2d');

  /* ── State ────────────────────────────────────────────── */
  let neoObjects     = [];       // processed NEO list
  let animFrame      = null;
  let highlightId    = null;     // hovered / selected NEO id
  let startTime      = null;     // performance.now() at animation start

  /* ── Constants ────────────────────────────────────────── */
  const LUNAR_DIST_KM = 384400;   // 1 Lunar Distance in km
  const COLOR_SAFE    = '#63aab3';
  const COLOR_HAZARD  = '#e05e40';
  const COLOR_EARTH   = '#2563b8';
  const COLOR_MOON    = '#9ca3af';
  const STAR_COUNT    = 200;
  const stars         = [];

  /* ── Default date range: today → today+7 ─────────────── */
  (function setDefaultDates() {
    const today = new Date();
    const end   = new Date(today);
    end.setDate(end.getDate() + 6);
    startInput.value = fmtDate(today);
    endInput.value   = fmtDate(end);
  })();

  function fmtDate(d) {
    return d.toISOString().slice(0, 10);
  }

  /* ── Stars (generated once, redrawn each frame) ──────── */
  function generateStars(w, h) {
    stars.length = 0;
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x:    Math.random() * w,
        y:    Math.random() * h,
        r:    Math.random() * 1.2 + 0.2,
        a:    Math.random() * 0.7 + 0.3
      });
    }
  }

  /* ── Canvas resize ────────────────────────────────────── */
  function resizeCanvas() {
    const parent = canvas.parentElement;
    const w = parent.clientWidth;
    const h = Math.max(420, Math.min(600, w * 0.6));
    canvas.width  = w;
    canvas.height = h;
    generateStars(w, h);
  }

  /* ── Load button ──────────────────────────────────────── */
  loadBtn.addEventListener('click', async () => {
    const start = startInput.value;
    const end   = endInput.value;

    if (!start || !end) {
      showMessage('Seleziona entrambe le date.', true);
      return;
    }

    const startMs = new Date(start).getTime();
    const endMs   = new Date(end).getTime();

    if (endMs < startMs) {
      showMessage('La data fine deve essere uguale o successiva alla data inizio.', true);
      return;
    }

    const diffDays = (endMs - startMs) / 86400000;
    if (diffDays > 7) {
      showMessage('L\'intervallo massimo consentito dall\'API NASA è di 7 giorni.', true);
      return;
    }

    await loadNeo(start, end);
  });

  /* ── Fetch & process ──────────────────────────────────── */
  async function loadNeo(startDate, endDate) {
    stopAnimation();
    showLoading();
    loadBtn.disabled = true;

    try {
      const data = await window.NasaApi.fetchNeoFeed(startDate, endDate);
      neoObjects = processNeoData(data);

      if (neoObjects.length === 0) {
        showMessage('Nessun oggetto rilevato nell\'intervallo selezionato.', false);
        return;
      }

      updateStats(neoObjects);
      renderList(neoObjects);
      showScene();
      resizeCanvas();
      startAnimation();

    } catch (err) {
      showMessage('Errore: ' + (err.message || 'Impossibile caricare i dati NASA.'), true);
    } finally {
      loadBtn.disabled = false;
    }
  }

  /* ── Process raw NASA response ────────────────────────── */
  function processNeoData(raw) {
    const all = [];
    const dateGroups = raw.near_earth_objects || {};

    Object.values(dateGroups).forEach(dayList => {
      dayList.forEach(neo => {
        const approach  = neo.close_approach_data && neo.close_approach_data[0];
        if (!approach) return;

        const missKm    = parseFloat(approach.miss_distance.kilometers);
        const velKmS    = parseFloat(approach.relative_velocity.kilometers_per_second);
        const dMin      = neo.estimated_diameter.kilometers.estimated_diameter_min;
        const dMax      = neo.estimated_diameter.kilometers.estimated_diameter_max;
        const diameter  = (dMin + dMax) / 2;
        const hazard    = neo.is_potentially_hazardous_asteroid;
        const date      = approach.close_approach_date;
        const lunarDist = parseFloat(approach.miss_distance.lunar);

        all.push({
          id:         neo.id,
          name:       neo.name,
          date,
          missKm,
          lunarDist,
          velKmS,
          diameter,
          hazard,
          url:        neo.nasa_jpl_url,
          /* animation state */
          angle:      Math.random() * Math.PI * 2,
          inclination: (Math.random() - 0.5) * 0.6,   // slight 3-D tilt feel
          orbitPhase: Math.random() * Math.PI * 2
        });
      });
    });

    /* Sort by miss distance ascending */
    all.sort((a, b) => a.missKm - b.missKm);
    return all;
  }

  /* ── Compute orbital radii with log scale ─────────────── */
  function computeOrbits(canvasW, canvasH) {
    const cx = canvasW / 2;
    const cy = canvasH / 2;
    const earthR  = Math.min(cx, cy) * 0.09;
    const minOrbit = earthR + Math.min(cx, cy) * 0.12;
    const maxOrbit = Math.min(cx, cy) - 30;

    const missValues = neoObjects.map(n => n.missKm);
    const logMin = Math.log(Math.min(...missValues) + 1);
    const logMax = Math.log(Math.max(...missValues) + 1);
    const range  = logMax - logMin || 1;

    /* Moon reference orbit radius */
    const moonOrbitR = minOrbit + ((Math.log(LUNAR_DIST_KM + 1) - logMin) / range) * (maxOrbit - minOrbit);

    neoObjects.forEach(neo => {
      const t = (Math.log(neo.missKm + 1) - logMin) / range;
      neo.orbitR = minOrbit + t * (maxOrbit - minOrbit);
    });

    return { cx, cy, earthR, moonOrbitR, minOrbit, maxOrbit };
  }

  /* ── Animation ────────────────────────────────────────── */
  function startAnimation() {
    startTime = performance.now();
    animFrame = requestAnimationFrame(draw);
  }

  function stopAnimation() {
    if (animFrame) {
      cancelAnimationFrame(animFrame);
      animFrame = null;
    }
  }

  function draw(now) {
    const elapsed = (now - startTime) / 1000;   // seconds
    const w = canvas.width;
    const h = canvas.height;
    const { cx, cy, earthR, moonOrbitR } = computeOrbits(w, h);

    /* Clear */
    ctx.clearRect(0, 0, w, h);

    /* Space background */
    const bg = ctx.createRadialGradient(cx, cy, earthR * 2, cx, cy, Math.max(w, h));
    bg.addColorStop(0, '#0d1520');
    bg.addColorStop(1, '#060a10');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    /* Stars */
    stars.forEach(s => {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${s.a})`;
      ctx.fill();
    });

    /* Moon reference ring (1 LD) */
    ctx.beginPath();
    ctx.arc(cx, cy, moonOrbitR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(99,170,179,0.18)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    /* Orbit trails for each NEO */
    neoObjects.forEach(neo => {
      const alpha = neo.id === highlightId ? 0.25 : 0.08;
      ctx.beginPath();
      ctx.ellipse(cx, cy, neo.orbitR, neo.orbitR * (1 - 0.12 * Math.abs(Math.sin(neo.inclination))), neo.inclination, 0, Math.PI * 2);
      ctx.strokeStyle = neo.hazard
        ? `rgba(224,94,64,${alpha})`
        : `rgba(99,170,179,${alpha})`;
      ctx.lineWidth = neo.id === highlightId ? 1.5 : 0.8;
      ctx.stroke();
    });

    /* NEO dots */
    neoObjects.forEach(neo => {
      /* Speed: faster if closer (higher velocity) – normalized 0.2–1.0 */
      const velValues = neoObjects.map(n => n.velKmS);
      const velMin = Math.min(...velValues);
      const velMax = Math.max(...velValues) || 1;
      const velT   = (neo.velKmS - velMin) / (velMax - velMin + 0.001);
      const speed  = 0.15 + velT * 0.45;           // rad/s

      const angle   = neo.angle + elapsed * speed;
      const tiltFactor = 1 - 0.18 * Math.abs(Math.sin(neo.inclination));
      const x = cx + Math.cos(angle) * neo.orbitR;
      const y = cy + Math.sin(angle) * neo.orbitR * tiltFactor;

      /* Dot radius: proportional to log(diameter) */
      const dotR = Math.max(2, Math.min(8, 2 + Math.log(neo.diameter * 1000 + 1) * 0.9));

      const isHighlit = neo.id === highlightId;

      /* Glow for highlighted */
      if (isHighlit) {
        const glow = ctx.createRadialGradient(x, y, 0, x, y, dotR * 4);
        glow.addColorStop(0, neo.hazard ? 'rgba(224,94,64,0.45)' : 'rgba(99,170,179,0.45)');
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(x, y, dotR * 4, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
      }

      /* Dot */
      ctx.beginPath();
      ctx.arc(x, y, isHighlit ? dotR * 1.4 : dotR, 0, Math.PI * 2);
      ctx.fillStyle = neo.hazard ? COLOR_HAZARD : COLOR_SAFE;
      ctx.fill();

      /* Store screen position for hit detection */
      neo._sx = x;
      neo._sy = y;
      neo._sr = isHighlit ? dotR * 1.4 : dotR;
    });

    /* Earth */
    const earthGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, earthR * 2.5);
    earthGlow.addColorStop(0, 'rgba(37,99,184,0.35)');
    earthGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(cx, cy, earthR * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = earthGlow;
    ctx.fill();

    /* Earth body */
    const earthGrad = ctx.createRadialGradient(cx - earthR * 0.3, cy - earthR * 0.3, earthR * 0.1, cx, cy, earthR);
    earthGrad.addColorStop(0, '#5ba3e0');
    earthGrad.addColorStop(0.4, '#2563b8');
    earthGrad.addColorStop(1, '#1a3a6e');
    ctx.beginPath();
    ctx.arc(cx, cy, earthR, 0, Math.PI * 2);
    ctx.fillStyle = earthGrad;
    ctx.fill();

    /* Continent highlight */
    ctx.beginPath();
    ctx.arc(cx - earthR * 0.2, cy - earthR * 0.1, earthR * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(86,168,64,0.55)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx + earthR * 0.25, cy + earthR * 0.2, earthR * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(86,168,64,0.45)';
    ctx.fill();

    /* Atmosphere rim */
    ctx.beginPath();
    ctx.arc(cx, cy, earthR + 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(100,180,255,0.4)';
    ctx.lineWidth = 3;
    ctx.stroke();

    /* 1 LD label */
    ctx.font = `${Math.max(9, w * 0.011)}px var(--font-body, sans-serif)`;
    ctx.fillStyle = 'rgba(99,170,179,0.55)';
    ctx.fillText('1 LD', cx + moonOrbitR + 4, cy - 4);

    animFrame = requestAnimationFrame(draw);
  }

  /* ── Mouse / touch interaction ────────────────────────── */
  canvas.addEventListener('mousemove', onPointerMove);
  canvas.addEventListener('mouseleave', () => {
    highlightId = null;
    tooltip.classList.remove('visible');
  });
  canvas.addEventListener('click', onCanvasClick);

  function getPointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY
    };
  }

  function hitTest(px, py) {
    let hit = null;
    let minDist = Infinity;
    neoObjects.forEach(neo => {
      if (neo._sx === undefined) return;
      const dx   = px - neo._sx;
      const dy   = py - neo._sy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const hitR = Math.max(neo._sr + 6, 14);
      if (dist < hitR && dist < minDist) {
        minDist = dist;
        hit = neo;
      }
    });
    return hit;
  }

  function onPointerMove(e) {
    const { x, y } = getPointerPos(e);
    const hit = hitTest(x, y);

    if (hit) {
      highlightId = hit.id;
      showTooltip(hit, e);
    } else {
      highlightId = null;
      tooltip.classList.remove('visible');
    }
  }

  function onCanvasClick(e) {
    const { x, y } = getPointerPos(e);
    const hit = hitTest(x, y);
    if (hit) {
      /* Highlight matching list item */
      document.querySelectorAll('.neo-item').forEach(el => el.classList.remove('active'));
      const listItem = document.getElementById('neo-item-' + hit.id);
      if (listItem) {
        listItem.classList.add('active');
        listItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  function showTooltip(neo, e) {
    const rect = neoScene.getBoundingClientRect();
    const lunarStr = neo.lunarDist.toFixed(2) + ' LD';
    const kmStr    = (neo.missKm / 1000).toFixed(0) + ' 000 km';
    const velStr   = neo.velKmS.toFixed(2) + ' km/s';
    const dStr     = neo.diameter < 0.1
      ? (neo.diameter * 1000).toFixed(0) + ' m'
      : neo.diameter.toFixed(3) + ' km';

    tooltip.innerHTML = `
      <strong>${neo.name}</strong>
      <span>Data: ${neo.date}</span><br>
      <span>Distanza: ${lunarStr} (~${kmStr})</span><br>
      <span>Velocit&agrave;: ${velStr}</span><br>
      <span>Diametro est.: ${dStr}</span>
      ${neo.hazard ? '<span class="hazard-badge">&#9888; Potenzialmente pericoloso</span>' : ''}
    `;

    let tx = e.clientX - rect.left + 14;
    let ty = e.clientY - rect.top  - 10;
    if (tx + 230 > rect.width) tx = e.clientX - rect.left - 240;
    tooltip.style.left = tx + 'px';
    tooltip.style.top  = ty + 'px';
    tooltip.classList.add('visible');
  }

  /* ── Stats bar ────────────────────────────────────────── */
  function updateStats(neos) {
    const hazards = neos.filter(n => n.hazard).length;
    statTotal.textContent  = neos.length + ' oggetti';
    statSafe.textContent   = (neos.length - hazards) + ' non pericolosi';
    statHazard.textContent = hazards + ' potenzialmente pericolosi';
    statsBar.style.display = 'flex';
  }

  /* ── Object list ──────────────────────────────────────── */
  function renderList(neos) {
    listEl.innerHTML = '';
    neos.forEach(neo => {
      const dStr = neo.diameter < 0.1
        ? (neo.diameter * 1000).toFixed(0) + ' m'
        : neo.diameter.toFixed(3) + ' km';

      const card = document.createElement('div');
      card.className = 'neo-item' + (neo.hazard ? ' hazard' : '');
      card.id = 'neo-item-' + neo.id;
      card.innerHTML = `
        <div class="neo-item-name" title="${neo.name}">${neo.name}</div>
        <div class="neo-item-meta">
          <span class="neo-meta-chip">${neo.date}</span>
          <span class="neo-meta-chip">${neo.lunarDist.toFixed(2)} LD</span>
          <span class="neo-meta-chip">${neo.velKmS.toFixed(2)} km/s</span>
          <span class="neo-meta-chip">&#8960; ${dStr}</span>
          ${neo.hazard ? '<span class="neo-meta-chip danger">&#9888; Pericoloso</span>' : ''}
        </div>
      `;
      card.addEventListener('click', () => {
        highlightId = neo.id;
        document.querySelectorAll('.neo-item').forEach(el => el.classList.remove('active'));
        card.classList.add('active');
      });
      listEl.appendChild(card);
    });
    listSection.style.display = 'block';
  }

  /* ── UI helpers ───────────────────────────────────────── */
  function showLoading() {
    messageBox.innerHTML = '<div class="neo-spinner"></div><p>Caricamento dati NASA in corso&hellip;</p>';
    messageBox.style.display = 'block';
    neoScene.style.display  = 'none';
    statsBar.style.display  = 'none';
    legendEl.style.display  = 'none';
    listSection.style.display = 'none';
  }

  function showMessage(msg, isError) {
    messageBox.innerHTML = isError
      ? `<p class="neo-error">&#9888; ${msg}</p>`
      : `<p>${msg}</p>`;
    messageBox.style.display = 'block';
    neoScene.style.display   = 'none';
  }

  function showScene() {
    messageBox.style.display = 'none';
    neoScene.style.display   = 'block';
    legendEl.style.display   = 'flex';
  }

  /* ── Responsive resize ────────────────────────────────── */
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (neoScene.style.display !== 'none') resizeCanvas();
    }, 150);
  });

})();
