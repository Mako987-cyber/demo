/* ─────────────────────────────────────────────────────────────────────────
   Orbite in tempo reale

   Il pianeta è renderizzato da cobe (WebGL, assets/vendor/cobe.esm.js); tutto
   ciò che gli sta intorno — satelliti, orbite, livelli di infrastruttura — vive
   su un canvas 2D sovrapposto. I due strati restano allineati perché l'overlay
   replica la proiezione di cobe: sfera di raggio 0.8, proiezione ortografica,
   stessa matrice di rotazione (phi, theta) e stesso fattore `scale`.

   Due sistemi di riferimento, un solo angolo di vista:
   - i satelliti sono inerziali (ECI) → proiettati con phi = vista;
   - la geografia ruota con la Terra → proiettata con phi = vista + GMST, ed è
     lo stesso phi che passiamo a cobe. Così la mappa e i livelli a terra girano
     insieme sotto le orbite, che restano ferme nello spazio inerziale.
   ───────────────────────────────────────────────────────────────────────── */

import createGlobe from '/assets/vendor/cobe.esm.js';

// ── Costanti ──────────────────────────────────────────────────────────────
const EARTH_R_KM = 6371;         // raggio terrestre medio, km
const MU         = 398600.4418;  // parametro gravitazionale, km³/s²
const TWO_PI     = Math.PI * 2;
const DEG2RAD    = Math.PI / 180;
const GLOBE_R    = 0.8;          // raggio della sfera nello spazio di cobe
const SURFACE_R  = 1.004;        // livelli a terra, appena sopra la superficie
const R_MIN      = 1.15;         // raggio inquadrato minimo (raggi terrestri)
const R_MAX      = 20;

// Colori: [tema scuro, tema chiaro]. Tinte a luminosità media, le uniche che
// reggono sia sul globo scuro sia su quello chiaro.
const GROUPS = {
  stations:       { label: 'Stazioni spaziali',   c: ['#fb923c', '#c2410c'], r: 3.2, autoLoad: true },
  'gps-ops':      { label: 'Costellazione GPS',   c: ['#34d399', '#047857'], r: 2.1, autoLoad: true },
  visual:         { label: 'I 100 più luminosi',  c: ['#fbbf24', '#a16207'], r: 2.0, autoLoad: true },
  starlink:       { label: 'Rete Starlink',       c: ['#38bdf8', '#0369a1'], r: 1.1, dense: true },
  'glo-ops':      { label: 'GLONASS',             c: ['#c4b5fd', '#6d28d9'], r: 2.1 },
  galileo:        { label: 'Galileo',             c: ['#60a5fa', '#1d4ed8'], r: 2.1 },
  military:       { label: 'Uso militare',        c: ['#f87171', '#b91c1c'], r: 2.0 },
  weather:        { label: 'Satelliti meteo',     c: ['#22d3ee', '#0e7490'], r: 2.0 },
  'last-30-days': { label: 'Lanci ultimi 30 gg',  c: ['#f472b6', '#be185d'], r: 1.8 },
};

const LAYERS = {
  submarine_cables: { label: 'Cavi sottomarini',    c: ['#60a5fa', '#1d4ed8'], kind: 'line' },
  landing_points:   { label: 'Approdi dei cavi',    c: ['#38bdf8', '#0369a1'], kind: 'point', r: 1.7 },
  chokepoints:      { label: 'Colli di bottiglia',  c: ['#fb7185', '#be123c'], kind: 'point', r: 2.6 },
  airports:         { label: 'Aeroporti',           c: ['#fbbf24', '#a16207'], kind: 'point', r: 1.3 },
  power_plants:     { label: 'Centrali elettriche', c: ['#34d399', '#047857'], kind: 'point', r: 1.4, byFuel: true },
};

// Le centrali si colorano per fonte: una sola serie, tinte medie che tengono
// su entrambi i temi.
const FUEL_COLORS = {
  Solar: '#facc15', Wind: '#5eead4', Hydro: '#38bdf8', Nuclear: '#f87171',
  Gas: '#fb923c', Coal: '#94a3b8', Oil: '#a16207', Biomass: '#4ade80',
  Geothermal: '#fb7185', Waste: '#a8a29e',
};

const BOOT_STEPS = [
  'Avvio del motore di rendering…',
  'Collegamento a CelesTrak…',
  'Scarico degli elementi orbitali…',
  'Calcolo delle posizioni…',
  'Tracciamento attivo',
];

// ── Stato ─────────────────────────────────────────────────────────────────
const view = { phi: -0.55, theta: 0.3, scale: 0, autoRotate: true, showOrbits: true };
const sim  = { mult: 1, startReal: Date.now(), startSim: Date.now() };

const groupState = {};   // chiave → { def, sats, pos, proj, vis, loaded, loading, visible, error }
const layerState = {};   // chiave → { def, features, lines, pos, proj, vis, loaded, … }

let selection = null;    // { kind: 'sat' | 'feature', … }
let orbitPathCache = null;
let issPathCache = null;
let hoverTarget = null;
let lightTheme = false;
let globe = null;
let dpr = 1;
let W = 0, H = 0;        // dimensioni della scena in px CSS
let lastPropagation = 0;
let lastFrame = 0;

// ── DOM ───────────────────────────────────────────────────────────────────
const stage        = document.getElementById('stage');
const globeCanvas  = document.getElementById('globe-canvas');
const overlay      = document.getElementById('overlay-canvas');
const ctx          = overlay.getContext('2d');
const tooltip      = document.getElementById('tooltip');
const loadingEl    = document.getElementById('loading');
const loadingBar   = document.getElementById('loading-bar');
const loadingMsg   = document.getElementById('loading-msg');
const legendEl     = document.getElementById('stage-legend');
const detailEl     = document.getElementById('detail');
const tableBody    = document.getElementById('table-body');

const nf0 = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf5 = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 5, maximumFractionDigits: 5 });
// Composta a mano: Intl infila una virgola fra data e ora che, in una cella
// stretta, sembra un refuso.
const utcStamp = (d) => {
  const p2 = (v) => String(v).padStart(2, '0');
  return `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
};

// ── Utilità ───────────────────────────────────────────────────────────────
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const colorOf = (def) => def.c[lightTheme ? 1 : 0];

// ── Meccanica orbitale ────────────────────────────────────────────────────
function solveKepler(M, e) {
  let E = M, dE;
  for (let i = 0; i < 40; i++) {
    dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-10) break;
  }
  return E;
}

function normalizeSat(raw, groupKey) {
  const n = (raw.MEAN_MOTION || 0) * TWO_PI / 86400;      // rad/s
  const a = n > 0 ? Math.cbrt(MU / (n * n)) : 0;           // km
  return {
    name:          raw.OBJECT_NAME || 'SCONOSCIUTO',
    objectId:      raw.OBJECT_ID || '',
    noradId:       raw.NORAD_CAT_ID || 0,
    epochMs:       new Date(raw.EPOCH).getTime(),
    meanMotion:    raw.MEAN_MOTION || 0,
    eccentricity:  raw.ECCENTRICITY || 0,
    inclination:   raw.INCLINATION || 0,
    raan:          raw.RA_OF_ASC_NODE || 0,
    argPericenter: raw.ARG_OF_PERICENTER || 0,
    meanAnomaly:   raw.MEAN_ANOMALY || 0,
    semiMajor_km:  a,
    period_min:    n > 0 ? (TWO_PI / n) / 60 : 0,
    meanAlt_km:    a > 0 ? a - EARTH_R_KM : 0,
    groupKey,
    groupLabel:    GROUPS[groupKey].label,
  };
}

/* Posizione ECI in raggi terrestri, già ruotata negli assi di cobe
   (y = polo nord, x = equinozio di primavera, z = -Y ECI). */
function satPosition(sat, timeMs, out, i) {
  const n = sat.meanMotion * TWO_PI / 86400;
  if (n <= 0) { out[i] = 0; out[i + 1] = 0; out[i + 2] = 0; return; }
  const a = sat.semiMajor_km || Math.cbrt(MU / (n * n));
  const e = sat.eccentricity;

  const dt = (timeMs - sat.epochMs) / 1000;
  const M  = ((sat.meanAnomaly * DEG2RAD + n * dt) % TWO_PI + TWO_PI) % TWO_PI;
  const E  = solveKepler(M, e);

  const nu = 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(E * 0.5),
    Math.sqrt(1 - e) * Math.cos(E * 0.5)
  );
  const r  = a * (1 - e * Math.cos(E));
  const rp = r * Math.cos(nu);
  const rq = r * Math.sin(nu);

  const cO = Math.cos(sat.raan * DEG2RAD),          sO = Math.sin(sat.raan * DEG2RAD);
  const cI = Math.cos(sat.inclination * DEG2RAD),   sI = Math.sin(sat.inclination * DEG2RAD);
  const cW = Math.cos(sat.argPericenter * DEG2RAD), sW = Math.sin(sat.argPericenter * DEG2RAD);

  const xE = (cO * cW - sO * sW * cI) * rp + (-cO * sW - sO * cW * cI) * rq;
  const yE = (sO * cW + cO * sW * cI) * rp + (-sO * sW + cO * cW * cI) * rq;
  const zE = (sW * sI) * rp + (cW * sI) * rq;

  const s = 1 / EARTH_R_KM;
  out[i]     =  xE * s;
  out[i + 1] =  zE * s;
  out[i + 2] = -yE * s;
}

// Ellisse completa dell'orbita, in raggi terrestri e assi di cobe.
function orbitPath(sat, steps = 220) {
  const n = sat.meanMotion * TWO_PI / 86400;
  if (n <= 0) return null;
  const a = sat.semiMajor_km || Math.cbrt(MU / (n * n));
  const e = sat.eccentricity;
  const p = a * (1 - e * e);

  const cO = Math.cos(sat.raan * DEG2RAD),          sO = Math.sin(sat.raan * DEG2RAD);
  const cI = Math.cos(sat.inclination * DEG2RAD),   sI = Math.sin(sat.inclination * DEG2RAD);
  const cW = Math.cos(sat.argPericenter * DEG2RAD), sW = Math.sin(sat.argPericenter * DEG2RAD);

  const Px = cO * cW - sO * sW * cI,  Py = sO * cW + cO * sW * cI,  Pz = sW * sI;
  const Qx = -cO * sW - sO * cW * cI, Qy = -sO * sW + cO * cW * cI, Qz = cW * sI;

  const out = new Float32Array((steps + 1) * 3);
  const s = 1 / EARTH_R_KM;
  for (let k = 0; k <= steps; k++) {
    const nu = (k / steps) * TWO_PI;
    const r  = p / (1 + e * Math.cos(nu));
    const rp = r * Math.cos(nu);
    const rq = r * Math.sin(nu);
    out[k * 3]     =  (Px * rp + Qx * rq) * s;
    out[k * 3 + 1] =  (Pz * rp + Qz * rq) * s;
    out[k * 3 + 2] = -(Py * rp + Qy * rq) * s;
  }
  return out;
}

/* Tempo siderale medio di Greenwich, in radianti: è l'angolo di cui la Terra
   è ruotata rispetto al riferimento inerziale dei satelliti. */
function gmst(ms) {
  const jd = ms / 86400000 + 2440587.5;
  const d  = jd - 2451545.0;
  const T  = d / 36525;
  let deg = 280.46061837 + 360.98564736629 * d + 0.000387933 * T * T - (T * T * T) / 38710000;
  deg = ((deg % 360) + 360) % 360;
  return deg * DEG2RAD;
}

// Coordinate geografiche → assi di cobe (stessa convenzione della libreria).
function latLonVec(lat, lon, r, out, i) {
  const la = lat * DEG2RAD, lo = lon * DEG2RAD;
  const c = Math.cos(la) * r;
  out[i]     =  c * Math.cos(lo);
  out[i + 1] =  Math.sin(la) * r;
  out[i + 2] = -c * Math.sin(lo);
}

// ── Proiezione (replica quella di cobe) ───────────────────────────────────
function projector(phi) {
  const cp = Math.cos(phi), sp = Math.sin(phi);
  const ct = Math.cos(view.theta), st = Math.sin(view.theta);
  const k = view.scale, aspect = W / H, hw = W / 2, hh = H / 2;
  const out = { x: 0, y: 0, hidden: false };
  return function project(x, y, z) {
    const gx = x * GLOBE_R, gy = y * GLOBE_R, gz = z * GLOBE_R;
    const c = cp * gx + sp * gz;
    const s = sp * st * gx + ct * gy - cp * st * gz;
    const d = -sp * ct * gx + st * gy + cp * ct * gz;
    out.x = hw * (1 + (c / aspect) * k);
    out.y = hh * (1 - s * k);
    out.hidden = d < 0 && (c * c + s * s) < GLOBE_R * GLOBE_R;
    return out;
  };
}

// ── Zoom e inquadratura ───────────────────────────────────────────────────
const viewRadius = () => 1 / (GLOBE_R * view.scale);

function setViewRadius(r) {
  view.scale = 1 / (GLOBE_R * clamp(r, R_MIN, R_MAX));
  const slider = document.getElementById('zoom-range');
  const v = 100 * (1 - Math.log(clamp(r, R_MIN, R_MAX) / R_MIN) / Math.log(R_MAX / R_MIN));
  if (slider && document.activeElement !== slider) slider.value = String(Math.round(v));
}

function zoneLabel() {
  const r = viewRadius();
  if (r < 2.2) return 'LEO';
  if (r < 5.5) return 'MEO';
  if (r < 9)   return 'GEO';
  return 'Spazio profondo';
}

// ── Globo ─────────────────────────────────────────────────────────────────
function globeTheme() {
  return lightTheme
    ? { dark: 0, diffuse: 1.4, mapBrightness: 5, mapBaseBrightness: 0,
        baseColor: [0.60, 0.71, 0.66], glowColor: [0.86, 0.92, 0.89], markerColor: [0.02, 0.44, 0.29] }
    : { dark: 1, diffuse: 1.3, mapBrightness: 7, mapBaseBrightness: 0.05,
        baseColor: [0.19, 0.32, 0.28], glowColor: [0.06, 0.16, 0.13], markerColor: [0.18, 0.8, 0.56] };
}

function initGlobe() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  measure();
  globe = createGlobe(globeCanvas, Object.assign({
    devicePixelRatio: dpr,
    width: W,
    height: H,
    phi: view.phi,
    theta: view.theta,
    scale: view.scale,
    mapSamples: 20000,
    opacity: 1,
    markers: [],
  }, globeTheme()));
}

function measure() {
  const rect = stage.getBoundingClientRect();
  W = Math.max(1, Math.round(rect.width));
  H = Math.max(1, Math.round(rect.height));
}

function resize() {
  measure();
  overlay.width  = Math.round(W * dpr);
  overlay.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (globe) globe.update({ width: W, height: H });
}

// ── Sfondo stellato (solo tema scuro) ─────────────────────────────────────
const stars = Array.from({ length: 150 }, () => ({
  u: Math.random(), v: Math.random(), a: 0.12 + Math.random() * 0.3, s: Math.random() < 0.12 ? 1.5 : 1,
}));

function drawStars() {
  if (lightTheme) return;
  ctx.fillStyle = '#dbe6f0';
  for (const st of stars) {
    // Deriva orizzontale legata alla rotazione: parallasse appena percettibile.
    const u = ((st.u - view.phi * 0.012) % 1 + 1) % 1;
    ctx.globalAlpha = st.a;
    ctx.fillRect(u * W, st.v * H, st.s, st.s);
  }
  ctx.globalAlpha = 1;
}

// ── Disegno dell'overlay ──────────────────────────────────────────────────
function drawOverlay(simMs, earthAngle) {
  ctx.clearRect(0, 0, W, H);
  drawStars();

  const projGeo = projector(view.phi + earthAngle);
  const projSat = projector(view.phi);

  drawCables(projGeo);
  drawLayerPoints(projGeo);
  drawOrbits(projSat);
  drawSatellites(projSat);
  drawSelection(projSat, projGeo);
}

function drawCables(project) {
  const st = layerState.submarine_cables;
  if (!st || !st.visible || !st.lines) return;
  ctx.strokeStyle = colorOf(st.def);
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  for (const line of st.lines) {
    let drawing = false;
    for (let i = 0; i < line.length; i += 3) {
      const p = project(line[i], line[i + 1], line[i + 2]);
      if (p.hidden) { drawing = false; continue; }
      if (drawing) ctx.lineTo(p.x, p.y);
      else { ctx.moveTo(p.x, p.y); drawing = true; }
    }
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawLayerPoints(project) {
  for (const key of Object.keys(LAYERS)) {
    const st = layerState[key];
    if (!st || !st.visible || st.def.kind !== 'point' || !st.pos) continue;
    const n = st.features.length;
    const r = st.def.r;

    if (st.def.byFuel) {
      // Una passata per fonte: si evita di cambiare fillStyle a ogni punto.
      const buckets = st.buckets;
      for (const fuel of Object.keys(buckets)) {
        ctx.fillStyle = FUEL_COLORS[fuel] || colorOf(st.def);
        ctx.beginPath();
        for (const idx of buckets[fuel]) {
          const p = project(st.pos[idx * 3], st.pos[idx * 3 + 1], st.pos[idx * 3 + 2]);
          st.proj[idx * 2] = p.x; st.proj[idx * 2 + 1] = p.y; st.vis[idx] = p.hidden ? 0 : 1;
          if (p.hidden) continue;
          ctx.moveTo(p.x + r, p.y);
          ctx.arc(p.x, p.y, r, 0, TWO_PI);
        }
        ctx.fill();
      }
      continue;
    }

    ctx.fillStyle = colorOf(st.def);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const p = project(st.pos[i * 3], st.pos[i * 3 + 1], st.pos[i * 3 + 2]);
      st.proj[i * 2] = p.x; st.proj[i * 2 + 1] = p.y; st.vis[i] = p.hidden ? 0 : 1;
      if (p.hidden) continue;
      ctx.moveTo(p.x + r, p.y);
      ctx.arc(p.x, p.y, r, 0, TWO_PI);
    }
    ctx.fill();
  }
}

// Traccia dell'orbita: il tratto dietro al globo resta visibile ma smorzato —
// è quello che fa leggere l'inclinazione del piano orbitale.
function strokePath(path, project, color, alphaFront, alphaBack) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;

  ctx.globalAlpha = alphaBack;
  ctx.beginPath();
  for (let i = 0; i < path.length; i += 3) {
    const p = project(path[i], path[i + 1], path[i + 2]);
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();

  ctx.globalAlpha = alphaFront;
  ctx.beginPath();
  let drawing = false;
  for (let i = 0; i < path.length; i += 3) {
    const p = project(path[i], path[i + 1], path[i + 2]);
    if (p.hidden) { drawing = false; continue; }
    if (drawing) ctx.lineTo(p.x, p.y);
    else { ctx.moveTo(p.x, p.y); drawing = true; }
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawOrbits(project) {
  if (!view.showOrbits) return;
  if (issPathCache) {
    strokePath(issPathCache, project, colorOf(GROUPS.stations), 0.35, 0.12);
  }
  if (orbitPathCache && selection && selection.kind === 'sat') {
    strokePath(orbitPathCache, project, colorOf(GROUPS[selection.sat.groupKey]), 0.9, 0.22);
  }
}

function drawSatellites(project) {
  for (const key of Object.keys(GROUPS)) {
    const st = groupState[key];
    if (!st || !st.visible || !st.pos) continue;
    const n = st.sats.length;
    const color = colorOf(st.def);
    const r = st.def.r;

    if (st.def.dense) {
      // Migliaia di oggetti: quadratini pieni, nessun path da accumulare.
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.85;
      const side = r * 1.7;
      for (let i = 0; i < n; i++) {
        const p = project(st.pos[i * 3], st.pos[i * 3 + 1], st.pos[i * 3 + 2]);
        st.proj[i * 2] = p.x; st.proj[i * 2 + 1] = p.y; st.vis[i] = p.hidden ? 0 : 1;
        if (p.hidden) continue;
        ctx.fillRect(p.x - side / 2, p.y - side / 2, side, side);
      }
      ctx.globalAlpha = 1;
      continue;
    }

    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const p = project(st.pos[i * 3], st.pos[i * 3 + 1], st.pos[i * 3 + 2]);
      st.proj[i * 2] = p.x; st.proj[i * 2 + 1] = p.y; st.vis[i] = p.hidden ? 0 : 1;
      if (p.hidden) continue;
      ctx.moveTo(p.x + r, p.y);
      ctx.arc(p.x, p.y, r, 0, TWO_PI);
    }
    ctx.fill();

    // Le stazioni abitate meritano un alone: sono l'oggetto che si cerca.
    if (key === 'stations') {
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        if (!st.vis[i]) continue;
        const x = st.proj[i * 2], y = st.proj[i * 2 + 1];
        ctx.moveTo(x + r + 3, y);
        ctx.arc(x, y, r + 3, 0, TWO_PI);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

function drawSelection(projSat, projGeo) {
  if (!selection) return;
  let p, color, label;

  if (selection.kind === 'sat') {
    const st = groupState[selection.sat.groupKey];
    const i = selection.index;
    if (!st || !st.pos) return;
    p = projSat(st.pos[i * 3], st.pos[i * 3 + 1], st.pos[i * 3 + 2]);
    color = colorOf(st.def);
    label = selection.sat.name;
  } else {
    const st = layerState[selection.layerKey];
    const i = selection.index;
    if (!st || !st.pos) return;
    p = projGeo(st.pos[i * 3], st.pos[i * 3 + 1], st.pos[i * 3 + 2]);
    color = colorOf(st.def);
    label = featureName(st.features[i], st.def);
  }
  if (p.hidden) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 9, 0, TWO_PI);
  ctx.stroke();
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(p.x + 13, p.y); ctx.lineTo(p.x + 22, p.y);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.font = '600 11px "General Sans", system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = lightTheme ? 'rgba(255,255,255,0.9)' : 'rgba(7,10,15,0.85)';
  ctx.strokeText(label, p.x + 26, p.y);
  ctx.fillStyle = color;
  ctx.fillText(label, p.x + 26, p.y);
}

// ── Loop ──────────────────────────────────────────────────────────────────
const simNow = () => sim.startSim + (Date.now() - sim.startReal) * sim.mult;

function propagateAll(simMs) {
  for (const key of Object.keys(groupState)) {
    const st = groupState[key];
    if (!st.visible || !st.pos) continue;
    for (let i = 0; i < st.sats.length; i++) satPosition(st.sats[i], simMs, st.pos, i * 3);
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = lastFrame ? Math.min((now - lastFrame) / 1000, 0.1) : 0;
  lastFrame = now;

  if (view.autoRotate) view.phi += 0.12 * dt;

  const simMs = simNow();
  // La propagazione è il costo dominante (migliaia di soluzioni di Keplero):
  // gira più lenta del rendering, mentre la proiezione resta a ogni frame.
  const interval = Math.max(45, 160 / Math.max(1, Math.sqrt(sim.mult)));
  if (now - lastPropagation > interval) {
    propagateAll(simMs);
    lastPropagation = now;
  }

  const earthAngle = gmst(simMs);
  if (globe) {
    globe.update(Object.assign({
      phi: view.phi + earthAngle,
      theta: view.theta,
      scale: view.scale,
    }, globeTheme()));
  }
  drawOverlay(simMs, earthAngle);
  updateHud(simMs);
}

function updateHud(simMs) {
  const d = new Date(simMs);
  const pad = (v) => String(v).padStart(2, '0');
  setText('hud-clock', `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`);
  setText('hud-zone', zoneLabel());
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// ── Interazione con la scena ──────────────────────────────────────────────
const pointers = new Map();
let dragMoved = 0;
let pinchStart = null;

stage.addEventListener('pointerdown', (e) => {
  stage.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  dragMoved = 0;
  stage.classList.add('is-dragging');
  if (pointers.size === 2) pinchStart = { dist: pointerDistance(), radius: viewRadius() };
});

stage.addEventListener('pointermove', (e) => {
  const prev = pointers.get(e.pointerId);
  if (!prev) { onHover(e); return; }

  const dx = e.clientX - prev.x;
  const dy = e.clientY - prev.y;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  dragMoved += Math.abs(dx) + Math.abs(dy);

  if (pointers.size === 2 && pinchStart) {
    const d = pointerDistance();
    if (d > 0) setViewRadius(pinchStart.radius * (pinchStart.dist / d));
    return;
  }
  view.phi += dx * 0.006;
  view.theta = clamp(view.theta + dy * 0.006, -1.25, 1.25);
});

function endPointer(e) {
  const had = pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchStart = null;
  if (!pointers.size) stage.classList.remove('is-dragging');
  if (had && dragMoved < 6 && e.type === 'pointerup') onPick(e);
}
stage.addEventListener('pointerup', endPointer);
stage.addEventListener('pointercancel', endPointer);
stage.addEventListener('pointerleave', () => { hideTooltip(); });

function pointerDistance() {
  const [a, b] = [...pointers.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
}

stage.addEventListener('wheel', (e) => {
  e.preventDefault();
  setViewRadius(viewRadius() * Math.exp(e.deltaY * 0.0012));
}, { passive: false });

function stagePoint(e) {
  const rect = stage.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

/* Ricerca del bersaglio: scansione lineare sulle posizioni già proiettate nel
   frame corrente. Prima i satelliti, poi i punti a terra. */
function pickAt(x, y, radius = 9) {
  let best = null, bestD = radius * radius;

  for (const key of Object.keys(GROUPS)) {
    const st = groupState[key];
    if (!st || !st.visible || !st.proj) continue;
    for (let i = 0; i < st.sats.length; i++) {
      if (!st.vis[i]) continue;
      const dx = st.proj[i * 2] - x, dy = st.proj[i * 2 + 1] - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = { kind: 'sat', groupKey: key, index: i, sat: st.sats[i] }; }
    }
  }
  if (best) return best;

  for (const key of Object.keys(LAYERS)) {
    const st = layerState[key];
    if (!st || !st.visible || st.def.kind !== 'point' || !st.proj) continue;
    for (let i = 0; i < st.features.length; i++) {
      if (!st.vis[i]) continue;
      const dx = st.proj[i * 2] - x, dy = st.proj[i * 2 + 1] - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = { kind: 'feature', layerKey: key, index: i }; }
    }
  }
  return best;
}

function onHover(e) {
  const { x, y } = stagePoint(e);
  const hit = pickAt(x, y);
  hoverTarget = hit;
  if (!hit) { hideTooltip(); return; }

  const label = hit.kind === 'sat'
    ? `${hit.sat.name} · NORAD ${hit.sat.noradId}`
    : featureName(layerState[hit.layerKey].features[hit.index], LAYERS[hit.layerKey]);

  tooltip.textContent = label;
  tooltip.hidden = false;
  const flipX = x > W - 200;
  const flipY = y > H - 60;
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
  tooltip.style.transform =
    `translate(${flipX ? 'calc(-100% - 0.75rem)' : '0.75rem'}, ${flipY ? 'calc(-100% - 0.75rem)' : '0.75rem'})`;
}

function hideTooltip() { tooltip.hidden = true; }

function onPick(e) {
  const { x, y } = stagePoint(e);
  const hit = pickAt(x, y, 11);
  if (!hit) { select(null); return; }
  select(hit);
}

// ── Selezione e dettaglio ─────────────────────────────────────────────────
function select(hit) {
  selection = hit;
  orbitPathCache = (hit && hit.kind === 'sat') ? orbitPath(hit.sat) : null;
  renderDetail();
  highlightRow(hit && hit.kind === 'sat' ? hit.sat.noradId : -1);
}

function featureName(f, def) {
  return f.name || f.cable_name || f.airport_name || f.plant_name || f.station_name || f.title || def.label;
}

function detailRow(term, value) {
  return `<div><dt>${esc(term)}</dt><dd>${esc(value)}</dd></div>`;
}

function renderDetail() {
  if (!selection) { detailEl.hidden = true; return; }
  const grid = document.getElementById('detail-grid');
  const link = document.getElementById('detail-link');
  let rows = '';

  if (selection.kind === 'sat') {
    const s = selection.sat;
    setText('detail-kicker', s.groupLabel);
    setText('detail-name', s.name);
    rows += detailRow('NORAD ID', s.noradId);
    rows += detailRow('Quota media', s.meanAlt_km > 0 ? `${nf0.format(Math.round(s.meanAlt_km))} km` : '—');
    rows += detailRow('Periodo', s.period_min > 0 ? `${nf1.format(s.period_min)} min` : '—');
    rows += detailRow('Inclinazione', `${nf1.format(s.inclination)}°`);
    rows += detailRow('Eccentricità', nf5.format(s.eccentricity));
    rows += detailRow('RAAN', `${nf1.format(s.raan)}°`);
    rows += detailRow('ID internazionale', s.objectId || '—');
    rows += detailRow('Epoca elementi', utcStamp(new Date(s.epochMs)) + ' UTC');
    link.href = `https://www.n2yo.com/satellite/?s=${s.noradId}`;
    link.hidden = false;
  } else {
    const st = layerState[selection.layerKey];
    const f = st.features[selection.index];
    setText('detail-kicker', st.def.label);
    setText('detail-name', featureName(f, st.def));
    if (f.lat != null) rows += detailRow('Coordinate', `${nf1.format(f.lat)}° / ${nf1.format(f.lon)}°`);
    const fuel = f.primary_fuel || f.fuel_type || f.fuel;
    if (fuel) rows += detailRow('Fonte', fuel);
    if (f.capacity_mw) rows += detailRow('Potenza', `${nf1.format(f.capacity_mw)} MW`);
    if (f.iata_code) rows += detailRow('IATA', f.iata_code);
    if (f.country) rows += detailRow('Paese', f.country);
    if (f.description && String(f.description).length < 140) rows += detailRow('Note', f.description);
    link.hidden = true;
  }

  grid.innerHTML = rows;
  detailEl.hidden = false;
}

document.getElementById('detail-close').addEventListener('click', () => select(null));

// ── Dati: gruppi orbitali ─────────────────────────────────────────────────
function ensureGroupState(key) {
  if (!groupState[key]) {
    groupState[key] = {
      def: GROUPS[key], sats: [], pos: null, proj: null, vis: null,
      loaded: false, loading: false, visible: false, error: false,
    };
  }
  return groupState[key];
}

async function loadGroup(key) {
  const st = ensureGroupState(key);
  if (st.loading || st.loaded) return;
  st.loading = true;
  st.error = false;
  refreshChip(key);
  try {
    const raw = await window.CelestrakApi.fetchGroup(key);
    st.sats = (Array.isArray(raw) ? raw : []).map((r) => normalizeSat(r, key));
    st.pos  = new Float32Array(st.sats.length * 3);
    st.proj = new Float32Array(st.sats.length * 2);
    st.vis  = new Uint8Array(st.sats.length);
    st.loaded = true;
    st.visible = true;
    propagateGroup(st, simNow());
    if (key === 'stations') cacheIssOrbit(st.sats);
    rebuildTable();
  } catch (err) {
    st.error = true;
    console.error('[orbit] gruppo non caricato:', key, err);
  } finally {
    st.loading = false;
    refreshChip(key);
    updateStats();
    renderLegend();
  }
}

function propagateGroup(st, simMs) {
  for (let i = 0; i < st.sats.length; i++) satPosition(st.sats[i], simMs, st.pos, i * 3);
}

function cacheIssOrbit(stations) {
  const iss = stations.find((s) => s.noradId === 25544)
    || stations.find((s) => s.name.includes('ISS'))
    || stations[0];
  issPathCache = iss ? orbitPath(iss) : null;
}

function toggleGroup(key) {
  const st = ensureGroupState(key);
  if (st.loading) return;
  if (st.loaded) {
    st.visible = !st.visible;
    if (st.visible) propagateGroup(st, simNow());
    refreshChip(key);
    updateStats();
    renderLegend();
    return;
  }
  loadGroup(key);
}

// ── Dati: livelli di infrastruttura ───────────────────────────────────────
function ensureLayerState(key) {
  if (!layerState[key]) {
    layerState[key] = {
      def: LAYERS[key], features: [], lines: null, pos: null, proj: null, vis: null,
      buckets: null, loaded: false, loading: false, visible: false, error: false,
    };
  }
  return layerState[key];
}

async function loadLayer(key) {
  const st = ensureLayerState(key);
  if (st.loading || st.loaded) return;
  st.loading = true;
  st.error = false;
  refreshChip(key, true);
  try {
    const data = await window.MonitoringApi.fetchLayer(key);
    const rows = Array.isArray(data) ? data : [];

    if (st.def.kind === 'line') {
      st.lines = [];
      for (const f of rows) {
        const segments = f.segments || (f.coords ? [f.coords] : []);
        for (const seg of segments) {
          if (!seg || seg.length < 2) continue;
          const buf = new Float32Array(seg.length * 3);
          seg.forEach((c, i) => latLonVec(c[1], c[0], SURFACE_R, buf, i * 3));
          st.lines.push(buf);
        }
      }
      st.features = rows;
    } else {
      st.features = rows.filter((f) => f.lat != null && f.lon != null && isFinite(f.lat) && isFinite(f.lon));
      st.pos  = new Float32Array(st.features.length * 3);
      st.proj = new Float32Array(st.features.length * 2);
      st.vis  = new Uint8Array(st.features.length);
      st.features.forEach((f, i) => latLonVec(f.lat, f.lon, SURFACE_R, st.pos, i * 3));
      if (st.def.byFuel) {
        st.buckets = {};
        st.features.forEach((f, i) => {
          const fuel = f.primary_fuel || f.fuel_type || f.fuel || 'Altro';
          (st.buckets[fuel] || (st.buckets[fuel] = [])).push(i);
        });
      }
    }

    st.loaded = true;
    st.visible = true;
  } catch (err) {
    st.error = true;
    console.error('[orbit] livello non caricato:', key, err);
  } finally {
    st.loading = false;
    refreshChip(key, true);
    updateStats();
    renderLegend();
  }
}

function toggleLayer(key) {
  const st = ensureLayerState(key);
  if (st.loading) return;
  if (st.loaded) {
    st.visible = !st.visible;
    if (!st.visible && selection && selection.kind === 'feature' && selection.layerKey === key) select(null);
    refreshChip(key, true);
    updateStats();
    renderLegend();
    return;
  }
  loadLayer(key);
}

// ── Controlli ─────────────────────────────────────────────────────────────
function buildChips() {
  const groupBox = document.getElementById('group-toggles');
  const layerBox = document.getElementById('layer-toggles');

  for (const [key, def] of Object.entries(GROUPS)) {
    ensureGroupState(key);
    groupBox.insertAdjacentHTML('beforeend',
      `<button class="chip" type="button" data-group="${key}" aria-pressed="false">
         <span class="chip__dot" style="color:${def.c[0]}"></span>${esc(def.label)}
         <span class="chip__count"></span>
       </button>`);
  }
  for (const [key, def] of Object.entries(LAYERS)) {
    ensureLayerState(key);
    layerBox.insertAdjacentHTML('beforeend',
      `<button class="chip" type="button" data-layer="${key}" aria-pressed="false">
         <span class="chip__dot" style="color:${def.c[0]}"></span>${esc(def.label)}
         <span class="chip__count"></span>
       </button>`);
  }

  groupBox.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-group]');
    if (btn) toggleGroup(btn.dataset.group);
  });
  layerBox.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-layer]');
    if (btn) toggleLayer(btn.dataset.layer);
  });
}

function refreshChip(key, isLayer = false) {
  const btn = document.querySelector(isLayer
    ? `#layer-toggles [data-layer="${key}"]`
    : `#group-toggles [data-group="${key}"]`);
  if (!btn) return;
  const st = isLayer ? layerState[key] : groupState[key];
  btn.setAttribute('aria-pressed', String(!!st.visible));
  btn.classList.toggle('is-loading', st.loading);
  btn.classList.toggle('is-error', st.error);
  const count = btn.querySelector('.chip__count');
  const n = isLayer
    ? (st.def.kind === 'line' ? (st.lines ? st.lines.length : 0) : st.features.length)
    : st.sats.length;
  count.textContent = st.loading ? '' : (st.error ? 'errore' : (st.loaded ? nf0.format(n) : ''));
  if (st.error) btn.title = 'Feed non disponibile in questo momento';
}

function paintColors() {
  document.querySelectorAll('#group-toggles [data-group]').forEach((btn) => {
    btn.querySelector('.chip__dot').style.color = colorOf(GROUPS[btn.dataset.group]);
  });
  document.querySelectorAll('#layer-toggles [data-layer]').forEach((btn) => {
    btn.querySelector('.chip__dot').style.color = colorOf(LAYERS[btn.dataset.layer]);
  });
  renderLegend();
  renderTable();
}

function renderLegend() {
  const items = [];
  for (const [key, def] of Object.entries(GROUPS)) {
    const st = groupState[key];
    if (st && st.visible && st.sats.length) {
      items.push(`<span class="legend-item" style="color:${colorOf(def)}"><i></i>${esc(def.label)}</span>`);
    }
  }
  for (const [key, def] of Object.entries(LAYERS)) {
    const st = layerState[key];
    if (st && st.visible) {
      items.push(`<span class="legend-item" style="color:${colorOf(def)}"><i></i>${esc(def.label)}</span>`);
    }
  }
  legendEl.innerHTML = items.join('');
}

function updateStats() {
  let total = 0, loadedGroups = 0, activeLayers = 0;
  for (const key of Object.keys(GROUPS)) {
    const st = groupState[key];
    if (!st) continue;
    if (st.loaded) loadedGroups++;
    if (st.visible) total += st.sats.length;
  }
  for (const key of Object.keys(LAYERS)) {
    if (layerState[key] && layerState[key].visible) activeLayers++;
  }
  setText('stat-total', nf0.format(total));
  setText('stat-groups', `${loadedGroups}/${Object.keys(GROUPS).length}`);
  setText('stat-layers', `${activeLayers}/${Object.keys(LAYERS).length}`);
}

function setupControls() {
  document.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setViewRadius({ leo: 1.6, meo: 5.2, geo: 7.6 }[btn.dataset.view]);
    });
  });

  const zoom = document.getElementById('zoom-range');
  zoom.addEventListener('input', () => {
    const v = Number(zoom.value);
    setViewRadius(R_MIN * Math.pow(R_MAX / R_MIN, 1 - v / 100));
  });

  const rotate = document.getElementById('btn-rotate');
  rotate.addEventListener('click', () => {
    view.autoRotate = !view.autoRotate;
    rotate.classList.toggle('is-on', view.autoRotate);
    rotate.setAttribute('aria-pressed', String(view.autoRotate));
  });

  const orbits = document.getElementById('btn-orbits');
  orbits.addEventListener('click', () => {
    view.showOrbits = !view.showOrbits;
    orbits.classList.toggle('is-on', view.showOrbits);
    orbits.setAttribute('aria-pressed', String(view.showOrbits));
  });

  document.querySelectorAll('[data-mult]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-mult]').forEach((b) => {
        b.classList.remove('is-on');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('is-on');
      btn.setAttribute('aria-pressed', 'true');
      // Si riparte dal tempo simulato corrente: cambiare scala non fa saltare
      // le posizioni già mostrate.
      sim.startSim = simNow();
      sim.startReal = Date.now();
      sim.mult = Number(btn.dataset.mult) || 1;
      setText('hud-rate', `${nf0.format(sim.mult)}×`);
    });
  });
}

// ── Tabella ───────────────────────────────────────────────────────────────
let tableRows = [];
let sortKey = 'meanAlt_km';
let sortAsc = true;
let filterText = '';

function rebuildTable() {
  tableRows = [];
  for (const key of Object.keys(GROUPS)) {
    const st = groupState[key];
    if (st && st.loaded) tableRows.push(...st.sats);
  }
  renderTable();
}

function renderTable() {
  const q = filterText;
  const filtered = q
    ? tableRows.filter((s) => s.name.toLowerCase().includes(q) || String(s.noradId).includes(q))
    : tableRows.slice();

  filtered.sort((a, b) => {
    let va = a[sortKey], vb = b[sortKey];
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return sortAsc ? -1 : 1;
    if (va > vb) return sortAsc ? 1 : -1;
    return 0;
  });

  const limit = Math.min(filtered.length, 300);
  let html = '';
  for (let i = 0; i < limit; i++) {
    const s = filtered[i];
    html += `<tr data-norad="${s.noradId}" data-group="${esc(s.groupKey)}">
      <td><span class="row-dot" style="background:${colorOf(GROUPS[s.groupKey])}"></span>${esc(s.name)}</td>
      <td>${s.noradId}</td>
      <td>${esc(s.groupLabel)}</td>
      <td class="num">${s.meanAlt_km > 0 ? nf0.format(Math.round(s.meanAlt_km)) : '—'}</td>
      <td class="num">${nf1.format(s.inclination)}</td>
      <td class="num">${s.period_min > 0 ? nf1.format(s.period_min) : '—'}</td>
    </tr>`;
  }

  tableBody.innerHTML = html || '<tr><td colspan="6" class="empty-row">Nessun oggetto corrisponde alla ricerca.</td></tr>';
  setText('table-count', nf0.format(filtered.length));
  const foot = document.getElementById('table-foot');
  foot.textContent = filtered.length > limit
    ? `Mostrate le prime ${nf0.format(limit)} righe su ${nf0.format(filtered.length)}: restringi la ricerca per vedere le altre.`
    : 'Clicca una riga per inquadrare l’oggetto e vederne i parametri.';
  if (selection && selection.kind === 'sat') highlightRow(selection.sat.noradId);
}

function highlightRow(noradId) {
  tableBody.querySelectorAll('tr[data-norad]').forEach((tr) => {
    tr.classList.toggle('is-selected', Number(tr.dataset.norad) === noradId);
  });
}

function setupTable() {
  tableBody.addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-norad]');
    if (!tr) return;
    const st = groupState[tr.dataset.group];
    if (!st) return;
    const norad = Number(tr.dataset.norad);
    const index = st.sats.findIndex((s) => s.noradId === norad);
    if (index < 0) return;
    if (!st.visible) { st.visible = true; propagateGroup(st, simNow()); refreshChip(tr.dataset.group); updateStats(); renderLegend(); }
    select({ kind: 'sat', groupKey: tr.dataset.group, index, sat: st.sats[index] });
    stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  document.getElementById('table-search').addEventListener('input', (e) => {
    filterText = e.target.value.trim().toLowerCase();
    renderTable();
  });

  document.querySelectorAll('th button[data-sort]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.sort;
      if (sortKey === key) sortAsc = !sortAsc;
      else { sortKey = key; sortAsc = true; }
      document.querySelectorAll('th').forEach((th) => th.removeAttribute('aria-sort'));
      btn.closest('th').setAttribute('aria-sort', sortAsc ? 'ascending' : 'descending');
      renderTable();
    });
  });
}

// ── Tema ──────────────────────────────────────────────────────────────────
function syncTheme() {
  lightTheme = document.documentElement.getAttribute('data-theme') === 'light';
  paintColors();
}

// ── Avvio ─────────────────────────────────────────────────────────────────
function setProgress(pct, step) {
  loadingBar.style.width = `${pct}%`;
  if (step != null) loadingMsg.textContent = BOOT_STEPS[step];
}

async function boot() {
  lightTheme = document.documentElement.getAttribute('data-theme') === 'light';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    view.autoRotate = false;
    const btn = document.getElementById('btn-rotate');
    btn.classList.remove('is-on');
    btn.setAttribute('aria-pressed', 'false');
  }

  setViewRadius(1.55);
  buildChips();
  setupControls();
  setupTable();
  updateStats();

  setProgress(8, 0);
  initGlobe();
  resize();
  requestAnimationFrame(frame);

  new ResizeObserver(resize).observe(stage);
  new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  setProgress(20, 1);

  const auto = Object.keys(GROUPS).filter((k) => GROUPS[k].autoLoad);
  for (let i = 0; i < auto.length; i++) {
    setProgress(30 + Math.round((i / auto.length) * 60), i === 0 ? 2 : 3);
    await loadGroup(auto[i]);
  }

  setProgress(100, 4);
  setTimeout(() => loadingEl.classList.add('is-done'), 500);
}

boot();
