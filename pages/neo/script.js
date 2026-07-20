/**
 * NEO Tracker 3D — script.js
 * WebGL 3D visualization of Near-Earth Objects
 * Sources: NASA NeoWs API + JPL SSD Close Approach API
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ============================================================
   Constants
   ============================================================ */
const AU_TO_KM      = 149597870.7;
const LUNAR_DIST_KM = 384400;
const NASA_KEY      = 'pi2UlqIi7tEEGb6NrRYhETFeRgKSY3pfMa0RzyZS';
const JPL_CAD_URL   = 'https://ssd-api.jpl.nasa.gov/cad.api';
const NASA_NEO_URL  = 'https://api.nasa.gov/neo/rest/v1/feed';

// Scene scale: Earth visual radius = 1 unit
const EARTH_R        = 1;
const MOON_ORBIT_VIS = 4.5;    // compressed (real ~60 Earth radii)
const NEO_ORBIT_MIN  = 2.4;
const NEO_ORBIT_MAX  = 13;

/* ============================================================
   State
   ============================================================ */
let renderer, scene, camera, controls, raycaster;
let clock, earthMesh, moonMesh;
let moonTheta  = 0;
let neoObjects = [];   // [{mesh, line, data, r, inc, raan, theta, omega}]
let selectedId = null;
let pointer    = new THREE.Vector2(-9, -9);
let lastHover  = null;
let allNeos    = [];   // raw processed list
let tableSort  = { key: 'dist', dir: 1 };
let filterMode = 'all';
let searchTerm = '';

/* ============================================================
   DOM refs
   ============================================================ */
const glCanvas        = document.getElementById('gl-canvas');
const viewport        = document.getElementById('neo-viewport');
const refreshBtn      = document.getElementById('refresh-btn');
const dateRangeLabel  = document.getElementById('date-range-display');
const distSelect      = document.getElementById('dist-max');
const panelStats   = document.getElementById('panel-stats');
const statTotal    = document.getElementById('stat-total');
const statSafe     = document.getElementById('stat-safe');
const statHazard   = document.getElementById('stat-hazard');
const panelInfo    = document.getElementById('panel-info');
const infoContent  = document.getElementById('info-content');
const closeInfoBtn = document.getElementById('close-info');
const tooltip      = document.getElementById('neo-tooltip');
const panelLegend  = document.getElementById('panel-legend');
const panelLoading = document.getElementById('panel-loading');
const loadingText  = document.getElementById('loading-text');
const panelError   = document.getElementById('panel-error');
const errorText    = document.getElementById('error-text');
const retryBtn     = document.getElementById('retry-btn');
const panelWelcome = document.getElementById('panel-welcome');
const listSection  = document.getElementById('neo-list-section');
const neoTbody     = document.getElementById('neo-tbody');
const neoSearch    = document.getElementById('neo-search');
const toggleCtrl   = document.getElementById('toggle-controls');
const controlsBody = document.getElementById('controls-body');

/* ============================================================
   Date range (always last 7 days, computed at call time)
   ============================================================ */
function getDateRange() {
  const end   = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 6); // 7 days inclusive
  return { start: fmt(start), end: fmt(end) };
}

function updateDateLabel() {
  const { start, end } = getDateRange();
  const s = start.split('-').reverse().join('/');
  const e = end.split('-').reverse().join('/');
  if (dateRangeLabel) dateRangeLabel.textContent = `${s} – ${e}`;
}

function fmt(d) { return d.toISOString().slice(0, 10); }

/* ============================================================
   Three.js scene init
   ============================================================ */
function initScene() {
  // glCanvas might not have rendered dimensions yet — force a layout read
  const w = glCanvas.offsetWidth  || window.innerWidth;
  const h = glCanvas.offsetHeight || Math.round(window.innerHeight * 0.7);

  renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020508);

  camera = new THREE.PerspectiveCamera(50, w / h, 0.01, 2000);
  camera.position.set(0, 5, 20);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping   = true;
  controls.dampingFactor   = 0.05;
  controls.minDistance     = 1.6;
  controls.maxDistance     = 80;
  controls.autoRotate      = true;
  controls.autoRotateSpeed = 0.35;
  controls.target.set(0, 0, 0);

  raycaster = new THREE.Raycaster();
  raycaster.params.Mesh = {};

  clock = new THREE.Clock();

  buildBackground();
  buildLights();
  buildEarth();
  buildMoon();
  buildLdRing();
}

/* ──────────────────────────────────────────────────────────── */
/*  Scene construction helpers                                  */
/* ──────────────────────────────────────────────────────────── */

function buildBackground() {
  /* Starfield */
  const count = 7000;
  const pos   = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    const r  = 600 + Math.random() * 200;
    pos[i*3]   = r * Math.sin(ph) * Math.cos(th);
    pos[i*3+1] = r * Math.sin(ph) * Math.sin(th);
    pos[i*3+2] = r * Math.cos(ph);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xffffff, size: 0.7, sizeAttenuation: false
  })));

  /* Milky Way band (extra clustered stars along a great circle) */
  const mwCount = 2000;
  const mwPos   = new Float32Array(mwCount * 3);
  for (let i = 0; i < mwCount; i++) {
    const alpha = Math.random() * Math.PI * 2;
    const spread = (Math.random() - 0.5) * 0.35;
    const r = 580 + Math.random() * 100;
    mwPos[i*3]   = r * Math.cos(alpha);
    mwPos[i*3+1] = r * (Math.sin(alpha) * 0.25 + spread);
    mwPos[i*3+2] = r * Math.sin(alpha) * 0.97;
  }
  const mwGeo = new THREE.BufferGeometry();
  mwGeo.setAttribute('position', new THREE.BufferAttribute(mwPos, 3));
  scene.add(new THREE.Points(mwGeo, new THREE.PointsMaterial({
    color: 0xaaccee, size: 0.5, sizeAttenuation: false, transparent: true, opacity: 0.5
  })));
}

function buildLights() {
  scene.add(new THREE.AmbientLight(0x0d1a2e, 8));

  /* Sun directional light */
  const sunLight = new THREE.DirectionalLight(0xfff8e8, 3.5);
  sunLight.position.set(80, 25, 40);
  scene.add(sunLight);

  /* Hemisphere fill */
  scene.add(new THREE.HemisphereLight(0x0a1428, 0x040a10, 0.6));

  /* Sun visual sphere */
  const sunGeo  = new THREE.SphereGeometry(9, 16, 16);
  const sunMat  = new THREE.MeshBasicMaterial({ color: 0xfffde8 });
  const sun     = new THREE.Mesh(sunGeo, sunMat);
  sun.position.set(780, 250, 380);
  scene.add(sun);

  const glowGeo = new THREE.SphereGeometry(22, 16, 16);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffe060, transparent: true, opacity: 0.1 });
  sun.add(new THREE.Mesh(glowGeo, glowMat));
}

function makeEarthTexture() {
  const W = 1024, H = 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');

  /* Ocean */
  const og = g.createLinearGradient(0, 0, 0, H);
  og.addColorStop(0,   '#0b2e5c');
  og.addColorStop(0.4, '#1060a0');
  og.addColorStop(0.6, '#1060a0');
  og.addColorStop(1,   '#0b2e5c');
  g.fillStyle = og;
  g.fillRect(0, 0, W, H);

  /* Continents */
  const cc = '#3d7a43';
  const fill = (x, y, rx, ry, rot) => {
    g.fillStyle = cc;
    g.beginPath();
    g.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
    g.fill();
  };
  // North America
  fill(W*0.18, H*0.31, W*0.08, H*0.17, -0.25);
  fill(W*0.22, H*0.21, W*0.04, H*0.07, 0.1);
  // Central America
  fill(W*0.215, H*0.44, W*0.02, H*0.05, 0.2);
  // South America
  fill(W*0.245, H*0.63, W*0.048, H*0.17, 0.1);
  // Europe
  fill(W*0.504, H*0.265, W*0.036, H*0.09, -0.1);
  // Africa
  fill(W*0.515, H*0.55, W*0.05, H*0.19, 0.03);
  // Arabia
  fill(W*0.565, H*0.35, W*0.022, H*0.065, 0.1);
  // Asia (main)
  fill(W*0.66, H*0.29, W*0.135, H*0.165, 0);
  // India
  fill(W*0.614, H*0.45, W*0.023, H*0.08, 0.04);
  // SE Asia
  fill(W*0.73, H*0.46, W*0.04, H*0.09, 0.12);
  // Australia
  fill(W*0.76, H*0.68, W*0.052, H*0.078, -0.08);
  // Greenland
  g.fillStyle = '#b0c8b0';
  fill(W*0.275, H*0.12, W*0.033, H*0.065, 0.12);

  /* Polar ice */
  g.fillStyle = '#cce4f5';
  g.fillRect(0, 0, W, H * 0.045);
  g.beginPath(); g.ellipse(W*0.5, 0, W*0.5, H*0.09, 0, 0, Math.PI); g.fill();
  g.fillRect(0, H * 0.91, W, H * 0.09);

  /* Cloud wisps */
  g.fillStyle = 'rgba(255,255,255,0.11)';
  [
    [0.08,0.32,90,19], [0.28,0.52,65,13], [0.43,0.39,55,11],
    [0.60,0.56,72,15], [0.76,0.31,58,12], [0.92,0.47,66,14],
    [0.18,0.66,48,11], [0.54,0.2,88,17], [0.82,0.72,52,10],
    [0.36,0.78,44,10], [0.68,0.14,70,14], [0.50,0.65,50,12],
  ].forEach(([rx, ry, rw, rh]) => {
    g.beginPath();
    g.ellipse(rx*W, ry*H, rw, rh, Math.random()*0.8, 0, Math.PI*2);
    g.fill();
  });

  return new THREE.CanvasTexture(c);
}

function buildEarth() {
  const tex = makeEarthTexture();
  const geo = new THREE.SphereGeometry(EARTH_R, 72, 72);
  const mat = new THREE.MeshPhongMaterial({
    map:       tex,
    specular:  new THREE.Color(0x336688),
    shininess: 55,
    emissive:  new THREE.Color(0x00050f),
    emissiveIntensity: 0.4,
  });
  earthMesh = new THREE.Mesh(geo, mat);
  earthMesh.userData.isEarth = true;
  scene.add(earthMesh);

  /* Atmosphere inner glow */
  const atmGeo = new THREE.SphereGeometry(EARTH_R * 1.028, 32, 32);
  const atmMat = new THREE.MeshPhongMaterial({
    color: 0x2277dd,
    transparent: true, opacity: 0.09,
    side: THREE.FrontSide, depthWrite: false,
  });
  scene.add(new THREE.Mesh(atmGeo, atmMat));

  /* Atmosphere rim glow (back face) */
  const rimGeo = new THREE.SphereGeometry(EARTH_R * 1.065, 32, 32);
  const rimMat = new THREE.MeshPhongMaterial({
    color: 0x44aaff,
    transparent: true, opacity: 0.065,
    side: THREE.BackSide, depthWrite: false,
  });
  scene.add(new THREE.Mesh(rimGeo, rimMat));
}

function buildMoon() {
  const geo = new THREE.SphereGeometry(0.27, 24, 24);
  const mat = new THREE.MeshPhongMaterial({
    color: 0x9aa3a8, emissive: 0x0d1017, shininess: 4,
  });
  moonMesh = new THREE.Mesh(geo, mat);
  scene.add(moonMesh);
}

function buildLdRing() {
  const pts = [];
  for (let i = 0; i <= 160; i++) {
    const t = (i / 160) * Math.PI * 2;
    pts.push(new THREE.Vector3(
      MOON_ORBIT_VIS * Math.cos(t), 0, MOON_ORBIT_VIS * Math.sin(t)
    ));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineDashedMaterial({
    color: 0x2a6070, dashSize: 0.4, gapSize: 0.35,
    transparent: true, opacity: 0.5,
  });
  const line = new THREE.Line(geo, mat);
  line.computeLineDistances();
  scene.add(line);

  /* 1 LD label sprite */
  const lc = document.createElement('canvas');
  lc.width = 200; lc.height = 48;
  const lg = lc.getContext('2d');
  lg.fillStyle = 'rgba(99,170,179,0.75)';
  lg.font = 'bold 22px sans-serif';
  lg.fillText('1 LD', 8, 32);
  const ltex = new THREE.CanvasTexture(lc);
  const lMat = new THREE.SpriteMaterial({ map: ltex, transparent: true, opacity: 0.7 });
  const sprite = new THREE.Sprite(lMat);
  sprite.scale.set(1.8, 0.45, 1);
  sprite.position.set(MOON_ORBIT_VIS + 0.6, 0.2, 0);
  scene.add(sprite);
}

/* ============================================================
   Orbit helpers
   ============================================================ */

function logScale(val, minVal, maxVal) {
  const lv = Math.log(val + 1);
  const lo = Math.log(minVal + 1);
  const lx = Math.log(maxVal + 1);
  return (lv - lo) / ((lx - lo) || 1);
}

/** Map miss distance → scene radius */
function orbitRadius(distKm, minKm, maxKm) {
  return NEO_ORBIT_MIN + logScale(distKm, minKm, maxKm) * (NEO_ORBIT_MAX - NEO_ORBIT_MIN);
}

/** Circular orbit position in 3D (Three.js Y-up) */
function orbitPos(r, inc, raan, theta) {
  // Circle in XZ plane → tilt by inclination (around X) → rotate by RAAN (around Y)
  const x0 = r * Math.cos(theta);
  const z0 = r * Math.sin(theta);
  const cosI = Math.cos(inc), sinI = Math.sin(inc);
  const y1 = -z0 * sinI;
  const z1 =  z0 * cosI;
  const cosO = Math.cos(raan), sinO = Math.sin(raan);
  return new THREE.Vector3(x0 * cosO + z1 * sinO, y1, -x0 * sinO + z1 * cosO);
}

/** Build orbit Line */
function buildOrbitLine(r, inc, raan, hazard) {
  const pts = [];
  for (let i = 0; i <= 128; i++) {
    pts.push(orbitPos(r, inc, raan, (i / 128) * Math.PI * 2));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({
    color:       hazard ? 0x5c1810 : 0x1e4d57,
    transparent: true,
    opacity:     hazard ? 0.55 : 0.45,
  });
  return new THREE.Line(geo, mat);
}

/** Build NEO sphere mesh */
function buildNeoMesh(diameter, hazard) {
  const dM  = (diameter || 0.005) * 1000;           // km → m
  const sr  = Math.max(0.018, Math.min(0.11, 0.018 + Math.log10(dM + 1) * 0.035));
  const geo = new THREE.SphereGeometry(sr, 8, 8);
  const mat = new THREE.MeshPhongMaterial({
    color:    hazard ? 0xe05e40 : 0x63aab3,
    emissive: hazard ? new THREE.Color(0x280800) : new THREE.Color(0x061520),
    shininess: 40,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.neoId = null;   // filled later
  return mesh;
}

/* ============================================================
   NEO scene management
   ============================================================ */

function clearNeoScene() {
  neoObjects.forEach(({ mesh, line }) => {
    scene.remove(mesh); scene.remove(line);
    mesh.geometry.dispose(); mesh.material.dispose();
    line.geometry.dispose(); line.material.dispose();
  });
  neoObjects = [];
}

function populateScene(neos) {
  clearNeoScene();

  const distKms = neos.map(n => n.distKm);
  const minKm   = Math.min(...distKms);
  const maxKm   = Math.max(...distKms);

  neos.forEach(neo => {
    const r    = orbitRadius(neo.distKm, minKm, maxKm);
    const inc  = neo.inc;
    const raan = neo.raan;

    /* Angular speed: 20–70 s period, scaled by visual radius */
    const T     = 18 + ((r - NEO_ORBIT_MIN) / (NEO_ORBIT_MAX - NEO_ORBIT_MIN)) * 52;
    const omega = (Math.PI * 2) / T;

    const line = buildOrbitLine(r, inc, raan, neo.hazard);
    const mesh = buildNeoMesh(neo.diameter, neo.hazard);
    mesh.userData.neoId = neo.id;

    scene.add(line);
    scene.add(mesh);

    neoObjects.push({ mesh, line, data: neo, r, inc, raan, theta: neo.phase, omega });
  });
}

function highlightNeo(id) {
  neoObjects.forEach(({ mesh, line, data }) => {
    const active = data.id === id;
    line.material.opacity = active ? 0.9 : (data.hazard ? 0.55 : 0.45);
    line.material.color.set(active
      ? (data.hazard ? 0xe05e40 : 0x63aab3)
      : (data.hazard ? 0x5c1810 : 0x1e4d57));
    mesh.material.emissive.set(active
      ? (data.hazard ? new THREE.Color(0x6a1000) : new THREE.Color(0x0a3040))
      : (data.hazard ? new THREE.Color(0x280800) : new THREE.Color(0x061520)));
    mesh.scale.setScalar(active ? 1.6 : 1.0);
  });
}

/* ============================================================
   Animation loop
   ============================================================ */

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  controls.update();

  // Rotate Earth
  if (earthMesh) earthMesh.rotation.y += dt * 0.04;

  // Moon orbit
  moonTheta += dt * 0.065;
  if (moonMesh) {
    moonMesh.position.set(
      MOON_ORBIT_VIS * Math.cos(moonTheta), 0,
      MOON_ORBIT_VIS * Math.sin(moonTheta)
    );
    moonMesh.rotation.y += dt * 0.03;
  }

  // NEO animation
  neoObjects.forEach(n => {
    n.theta += dt * n.omega;
    n.mesh.position.copy(orbitPos(n.r, n.inc, n.raan, n.theta));
  });

  // Hover raycasting
  doHoverRaycast();

  renderer.render(scene, camera);
}

/* ============================================================
   Interaction: hover & click
   ============================================================ */

function doHoverRaycast() {
  if (!renderer) return;
  raycaster.setFromCamera(pointer, camera);
  const meshes = neoObjects.map(n => n.mesh);
  const hits   = raycaster.intersectObjects(meshes);

  if (hits.length > 0) {
    const id  = hits[0].object.userData.neoId;
    const neo = neoObjects.find(n => n.data.id === id);
    if (neo && neo.data.id !== lastHover) {
      lastHover = neo.data.id;
      showTooltip(neo.data);
    }
    glCanvas.style.cursor = 'pointer';
  } else {
    if (lastHover !== null) { lastHover = null; hideTooltip(); }
    glCanvas.style.cursor = selectedId ? 'grab' : 'grab';
  }
}

glCanvas.addEventListener('pointermove', e => {
  const r = glCanvas.getBoundingClientRect();
  pointer.x =  ((e.clientX - r.left) / r.width)  * 2 - 1;
  pointer.y = -((e.clientY - r.top)  / r.height) * 2 + 1;
  // Move tooltip near cursor
  tooltip.style.left = (e.clientX - r.left + 14) + 'px';
  tooltip.style.top  = (e.clientY - r.top  - 14) + 'px';
});

glCanvas.addEventListener('pointerleave', () => {
  pointer.set(-9, -9);
  lastHover = null;
  hideTooltip();
});

glCanvas.addEventListener('click', e => {
  if (controls.autoRotate === false && e.movementX === 0 && e.movementY === 0) {
    // Could be orbit-drag end; ignore small moves
  }
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(neoObjects.map(n => n.mesh));
  if (hits.length > 0) {
    const id = hits[0].object.userData.neoId;
    selectNeo(id);
  } else {
    deselectNeo();
  }
});

function selectNeo(id) {
  selectedId = id;
  const neoEntry = neoObjects.find(n => n.data.id === id);
  if (!neoEntry) return;
  controls.autoRotate = false;
  highlightNeo(id);
  showInfoPanel(neoEntry.data);
  // Highlight table row
  document.querySelectorAll('#neo-tbody tr').forEach(tr => {
    tr.classList.toggle('active', tr.dataset.id === String(id));
  });
}

function deselectNeo() {
  selectedId = null;
  controls.autoRotate = true;
  highlightNeo(null);
  panelInfo.hidden = true;
  document.querySelectorAll('#neo-tbody tr').forEach(tr => tr.classList.remove('active'));
}

closeInfoBtn.addEventListener('click', deselectNeo);

/* ── Tooltip ─────────────────────────────────────────────── */

function showTooltip(neo) {
  tooltip.innerHTML = `<strong>${neo.name}</strong>${neo.distLd.toFixed(3)} LD &nbsp;·&nbsp; ${neo.vel.toFixed(2)} km/s`;
  tooltip.classList.add('visible');
}

function hideTooltip() {
  tooltip.classList.remove('visible');
}

/* ── Info panel ──────────────────────────────────────────── */

function showInfoPanel(neo) {
  const dStr = neo.diameter < 0.1
    ? (neo.diameter * 1000).toFixed(0) + ' m'
    : neo.diameter.toFixed(3) + ' km';

  infoContent.innerHTML = `
    <div class="info-name">${neo.name}</div>
    <table class="info-table">
      <tr><td>Data</td><td>${neo.date}</td></tr>
      <tr><td>Distanza</td><td>${neo.distLd.toFixed(4)} LD</td></tr>
      <tr><td>&nbsp;</td><td>${(neo.distKm / 1000).toFixed(0)}&thinsp;000 km</td></tr>
      <tr><td>Velocità rel.</td><td>${neo.vel.toFixed(3)} km/s</td></tr>
      <tr><td>Diametro est.</td><td>${dStr}</td></tr>
      ${neo.h !== null ? `<tr><td>Magnitudine H</td><td>${neo.h}</td></tr>` : ''}
      <tr><td>Fonte</td><td>${neo.source}</td></tr>
    </table>
    <span class="${neo.hazard ? 'info-hazard-badge' : 'info-safe-badge'}">
      ${neo.hazard ? '⚠ Potenzialmente pericoloso' : '✓ Non pericoloso'}
    </span>
    ${neo.jplUrl ? `<a class="info-jpl-link" href="${neo.jplUrl}" target="_blank" rel="noopener">Scheda JPL →</a>` : ''}
  `;
  panelInfo.hidden = false;
}

/* ============================================================
   Data fetching
   ============================================================ */

async function loadNeos() {
  const { start, end } = getDateRange();
  const distMax = distSelect ? distSelect.value : '0.05';

  updateDateLabel();
  showLoading('Contatto NASA & JPL…');
  if (refreshBtn) refreshBtn.disabled = true;

  try {
    const diffDays = (new Date(end) - new Date(start)) / 86400000;

    // Parallel fetch: JPL always, NASA only if ≤ 7 days
    const [jplResult, nasaResult] = await Promise.allSettled([
      fetchJpl(start, end, distMax),
      diffDays <= 7 ? fetchNasa(start, end) : Promise.resolve(null)
    ]);

    let neos = [];

    if (jplResult.status === 'fulfilled' && jplResult.value) {
      updateLoadingText('Elaborazione dati JPL…');
      neos = processJpl(jplResult.value);
    } else {
      console.warn('JPL CAD failed:', jplResult.reason);
    }

    if (nasaResult.status === 'fulfilled' && nasaResult.value) {
      updateLoadingText('Integrazione dati NASA…');
      mergeNasa(neos, nasaResult.value);
    }

    if (neos.length === 0) {
      showError('Nessun oggetto rilevato nell\'intervallo e distanza selezionati.<br>Prova ad aumentare la distanza massima o l\'intervallo di date.');
      return;
    }

    allNeos = neos;
    updateStats(neos);
    populateScene(neos);
    renderTable(neos);

    panelWelcome.hidden  = true;
    panelLoading.hidden  = true;
    panelStats.hidden    = false;
    panelLegend.hidden   = false;
    listSection.hidden   = false;
    panelError.hidden    = true;

  } catch (err) {
    showError('Errore: ' + (err.message || 'Impossibile raggiungere le API.'));
  } finally {
    if (refreshBtn) refreshBtn.disabled = false;
  }
}

/* ── JPL SSD Close Approach API ──────────────────────────── */

async function fetchJpl(dateMin, dateMax, distMax) {
  const url = JPL_CAD_URL + '?' + new URLSearchParams({
    'dist-max':  distMax,
    'date-min':  dateMin,
    'date-max':  dateMax,
    sort:        'dist',
    body:        'Earth',
    fullname:    'true',
    diameter:    'true'
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error('JPL CAD HTTP ' + res.status);
  return res.json();
}

function processJpl(raw) {
  if (!raw.data || raw.data.length === 0) return [];

  // Build field index map
  const fi = {};
  (raw.fields || []).forEach((f, i) => { fi[f] = i; });

  return raw.data.map((row, idx) => {
    const des      = row[fi['des']]      || '';
    const fullname = row[fi['fullname']] || des;
    const cd       = row[fi['cd']]       || '';
    const distAu   = parseFloat(row[fi['dist']]  || 0);
    const vel      = parseFloat(row[fi['v-rel']] || 0);
    const h        = row[fi['h']] !== undefined ? parseFloat(row[fi['h']]) : null;
    const diamRaw  = row[fi['diameter']];
    const diameter = diamRaw ? parseFloat(diamRaw) : estimateDiameter(h);
    const distKm   = distAu * AU_TO_KM;
    const distLd   = distKm / LUNAR_DIST_KM;

    // Date: JPL gives "2026-Jul-20 14:32" → normalize
    const dateStr = normalizeJplDate(cd);

    return {
      id:       'jpl-' + idx + '-' + des.replace(/\s+/g, ''),
      name:     cleanName(fullname),
      des:      des,
      date:     dateStr,
      distKm,
      distLd,
      vel,
      h,
      diameter,
      hazard:   false,       // default; overridden by NASA merge
      source:   'JPL CAD',
      jplUrl:   `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?des=${encodeURIComponent(des)}`,
      // random orbital elements for visualization
      inc:   Math.random() * Math.PI * 0.7,
      raan:  Math.random() * Math.PI * 2,
      phase: Math.random() * Math.PI * 2,
    };
  });
}

function normalizeJplDate(cd) {
  // "2026-Jul-20 14:32" → "2026-07-20"
  if (!cd) return '—';
  const months = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',
                  Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};
  const m = cd.match(/(\d{4})-([A-Za-z]{3})-(\d{2})/);
  if (m) return `${m[1]}-${months[m[2]] || '??'}-${m[3]}`;
  return cd.slice(0, 10);
}

function cleanName(fullname) {
  return fullname.replace(/^\s*\d+\s+/, '').replace(/\s*\(.*?\)\s*/g, '').trim() || fullname.trim();
}

/** Rough diameter estimate from absolute magnitude */
function estimateDiameter(h) {
  if (h === null || isNaN(h)) return 0.1;
  // Using albedo p=0.14 as typical
  return 1329 * Math.pow(10, -h / 5) / Math.sqrt(0.14) / 1000; // km
}

/* ── NASA NeoWs API ──────────────────────────────────────── */

async function fetchNasa(startDate, endDate) {
  const url = NASA_NEO_URL + '?' + new URLSearchParams({
    start_date: startDate,
    end_date:   endDate,
    api_key:    NASA_KEY
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error('NASA NeoWs HTTP ' + res.status);
  return res.json();
}

/** Build lookup map: designation (lowercase, no spaces) → {hazard, diameter} */
function buildNasaMap(raw) {
  const map = new Map();
  Object.values(raw.near_earth_objects || {}).forEach(dayList => {
    dayList.forEach(neo => {
      const key = neo.name.replace(/[^a-z0-9]/gi, '').toLowerCase();
      const dMin = neo.estimated_diameter.kilometers.estimated_diameter_min;
      const dMax = neo.estimated_diameter.kilometers.estimated_diameter_max;
      map.set(key, {
        hazard:   neo.is_potentially_hazardous_asteroid,
        diameter: (dMin + dMax) / 2,
        name:     neo.name,
      });
    });
  });
  return map;
}

function mergeNasa(neos, nasaRaw) {
  const nasaMap = buildNasaMap(nasaRaw);
  neos.forEach(neo => {
    const key = neo.des.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const match = nasaMap.get(key);
    if (match) {
      neo.hazard   = match.hazard;
      neo.diameter = match.diameter;
      neo.source   = 'JPL CAD + NASA NeoWs';
    }
  });
}

/* ============================================================
   Stats
   ============================================================ */

function updateStats(neos) {
  const hazardCount = neos.filter(n => n.hazard).length;
  statTotal.textContent  = neos.length + ' oggetti';
  statSafe.textContent   = (neos.length - hazardCount) + ' sicuri';
  statHazard.textContent = hazardCount + ' pericolosi';
}

/* ============================================================
   Table
   ============================================================ */

function renderTable(neos) {
  let filtered = neos.filter(n => {
    if (filterMode === 'hazard' && !n.hazard) return false;
    if (searchTerm && !n.name.toLowerCase().includes(searchTerm)) return false;
    return true;
  });

  // Sort
  const { key, dir } = tableSort;
  filtered.sort((a, b) => {
    let av, bv;
    switch (key) {
      case 'name': av = a.name; bv = b.name; return dir * av.localeCompare(bv);
      case 'date': av = a.date; bv = b.date; return dir * av.localeCompare(bv);
      case 'dist': av = a.distLd; bv = b.distLd; break;
      case 'vel':  av = a.vel;    bv = b.vel;    break;
      case 'diam': av = a.diameter; bv = b.diameter; break;
      default: av = a.distLd; bv = b.distLd;
    }
    return dir * (av - bv);
  });

  neoTbody.innerHTML = filtered.map(neo => {
    const dStr = neo.diameter < 0.1
      ? (neo.diameter * 1000).toFixed(0) + ' m'
      : neo.diameter.toFixed(3) + ' km';
    return `
      <tr data-id="${neo.id}" class="${neo.hazard ? 'hazard-row' : ''}">
        <td class="td-name">${escHtml(neo.name)}</td>
        <td class="td-date">${neo.date}</td>
        <td class="td-dist">${neo.distLd.toFixed(4)}</td>
        <td class="td-vel">${neo.vel.toFixed(3)}</td>
        <td class="td-diam">${dStr}</td>
        <td>${neo.hazard
          ? '<span class="badge-hazard">⚠ Sì</span>'
          : '<span class="badge-safe">—</span>'}</td>
      </tr>`;
  }).join('');

  // Row click → select in 3D
  neoTbody.querySelectorAll('tr').forEach(tr => {
    tr.addEventListener('click', () => {
      const id = tr.dataset.id;
      if (id === selectedId) { deselectNeo(); return; }
      selectNeo(id);
      // Fly camera toward NEO position
      const neo = neoObjects.find(n => n.data.id === id);
      if (neo) {
        const target = neo.mesh.position.clone().multiplyScalar(0.5);
        controls.target.lerp(target, 0.5);
      }
    });
  });
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ── Table sort headers ──────────────────────────────────── */
document.querySelectorAll('#neo-table th[data-sort]').forEach(th => {
  th.addEventListener('click', () => {
    const key = th.dataset.sort;
    if (tableSort.key === key) {
      tableSort.dir *= -1;
    } else {
      tableSort.key = key;
      tableSort.dir = 1;
    }
    document.querySelectorAll('#neo-table th').forEach(t => {
      t.classList.remove('sorted-asc', 'sorted-desc');
      const si = t.querySelector('.sort-icon');
      if (si) si.textContent = '';
    });
    th.classList.add(tableSort.dir === 1 ? 'sorted-asc' : 'sorted-desc');
    const si = th.querySelector('.sort-icon');
    if (si) si.textContent = tableSort.dir === 1 ? '↑' : '↓';
    if (allNeos.length) renderTable(allNeos);
  });
});

/* ── Filter buttons ──────────────────────────────────────── */
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    filterMode = btn.dataset.filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (allNeos.length) renderTable(allNeos);
  });
});

/* ── Search ──────────────────────────────────────────────── */
neoSearch.addEventListener('input', () => {
  searchTerm = neoSearch.value.toLowerCase().trim();
  if (allNeos.length) renderTable(allNeos);
});

/* ============================================================
   UI helpers
   ============================================================ */

function showLoading(msg) {
  loadingText.textContent = msg || 'Caricamento…';
  panelLoading.hidden = false;
  panelError.hidden   = true;
  panelWelcome.hidden = true;
}

function updateLoadingText(msg) { loadingText.textContent = msg; }

function showError(msg) {
  errorText.innerHTML = msg;
  panelError.hidden   = false;
  panelLoading.hidden = true;
  panelWelcome.hidden = true;
}

/* ── Panel toggle ────────────────────────────────────────── */
toggleCtrl.addEventListener('click', () => {
  const expanded = toggleCtrl.getAttribute('aria-expanded') === 'true';
  toggleCtrl.setAttribute('aria-expanded', String(!expanded));
  controlsBody.classList.toggle('collapsed', expanded);
});

toggleCtrl.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCtrl.click(); }
});

/* ── Retry button ────────────────────────────────────────── */
retryBtn.addEventListener('click', () => {
  panelError.hidden = true;
  panelWelcome.hidden = true;
  loadNeos();
});

/* ── Refresh button ──────────────────────────────────────── */
if (refreshBtn) refreshBtn.addEventListener('click', loadNeos);

/* ── Distance max change → reload ───────────────────────── */
if (distSelect) distSelect.addEventListener('change', loadNeos);

/* ============================================================
   Resize handler
   ============================================================ */

function onResize() {
  if (!renderer) return;
  const w = glCanvas.clientWidth;
  const h = glCanvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

const resizeObserver = new ResizeObserver(onResize);
resizeObserver.observe(viewport);

/* ============================================================
   Daily auto-refresh scheduler
   ============================================================ */
function scheduleDailyRefresh() {
  const now      = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 1, 0, 0); // 00:01 next day (1 min after midnight)
  const msUntilMidnight = midnight - now;
  setTimeout(() => {
    loadNeos();
    scheduleDailyRefresh(); // re-arm for the following day
  }, msUntilMidnight);
}

/* ============================================================
   Boot — ES modules are always deferred: DOM is ready here.
   DOMContentLoaded must NOT be used because Three.js is fetched
   from CDN asynchronously, so that event fires before this
   module finishes loading its imports.
   ============================================================ */
try {
  initScene();
  animate();
  loadNeos();
  scheduleDailyRefresh();
} catch (err) {
  console.error('[NEO Tracker] Boot error:', err);
  // Surface the error visibly if scene init fails
  const welcome = document.getElementById('panel-welcome');
  if (welcome) {
    welcome.hidden = false;
    const p = welcome.querySelector('p');
    if (p) p.textContent = 'Errore di avvio: ' + (err.message || err);
  }
}
