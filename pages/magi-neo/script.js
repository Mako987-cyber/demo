/**
 * MAGI SYSTEM // NEO TACTICAL ANALYSIS
 * Adaptation of NEO Tracker 3D for the MAGI Supercomputer interface
 * Theme: Neon Genesis Evangelion — NERV HQ Tokyo-3
 */

/* global THREE */

/* ── Constants ── */
const AU_TO_KM      = 149597870.7;
const LUNAR_DIST_KM = 384400;
const EARTH_R        = 1;
const MOON_ORBIT_VIS = 4.5;
const NEO_ORBIT_MIN  = 2.4;
const NEO_ORBIT_MAX  = 13;

/* ── Scene state ── */
let renderer, scene, camera, controls, raycaster;
let clock, earthMesh, moonMesh;
let moonTheta  = 0;
let neoObjects = [];
let selectedId = null;
let pointer    = { x: -9, y: -9 };
let pointerClientX = 0, pointerClientY = 0;
let lastHover  = null;
let allNeos    = [];
let tableSort  = { key: 'dist', dir: 1 };
let filterMode = 'all';
let searchTerm = '';

/* ── DOM refs (mapped to MAGI HTML ids) ── */
const glCanvas       = document.getElementById('gl-canvas');
const viewport       = document.getElementById('neo-viewport');
const refreshBtn     = document.getElementById('btn-refresh');
const dateStartInput = document.getElementById('date-start');
const dateEndInput   = document.getElementById('date-end');
const dateHint       = document.getElementById('date-hint');
const distSelect     = document.getElementById('dist-max');
const panelStats     = document.getElementById('panel-stats');
const statTotal      = document.getElementById('stat-total');
const statSafe       = document.getElementById('stat-safe');
const statHazard     = document.getElementById('stat-hazard');
const panelInfo      = document.getElementById('panel-info');
const infoContent    = document.getElementById('info-content');
const closeInfoBtn   = document.getElementById('panel-info-close');
const tooltip        = document.getElementById('neo-tooltip');
const panelLegend    = document.getElementById('panel-legend');
const panelLoading   = document.getElementById('panel-loading');
const loadingText    = document.getElementById('loading-text');
const loadingBarFill = document.getElementById('loading-bar-fill');
const panelError     = document.getElementById('panel-error');
const errorText      = document.getElementById('error-message');
const retryBtn       = document.getElementById('btn-retry');
const panelWelcome   = document.getElementById('panel-welcome');
const listSection    = document.getElementById('neo-list-section');
const neoTbody       = document.getElementById('neo-table-body');
const neoSearch      = document.getElementById('neo-search');
const panelControls  = document.getElementById('panel-controls');
const controlsHeader = document.getElementById('panel-controls-header');

/* ── MAGI loading messages ── */
const MAGI_MSGS = [
  'MAGI BOOT SEQUENCE INITIATED...',
  'ESTABLISHING SECURE LINK TO NERV DATABASE...',
  'RETRIEVING JPL TACTICAL ORBITAL DATA...',
  'PROCESSING NEAR-EARTH OBJECT SIGNATURES...',
  'CALCULATING THREAT ASSESSMENT PARAMETERS...',
  'RENDERING TACTICAL HOLOGRAPHIC DISPLAY...',
];

function setLoadingProgress(pct) {
  if (loadingBarFill) loadingBarFill.style.width = Math.min(100, pct) + '%';
}

/* ── Real-time clock ── */
function updateClock() {
  const el = document.getElementById('vp-clock');
  if (el) el.textContent = new Date().toTimeString().slice(0, 8);
}

/* ── Date helpers ── */
function fmt(d) { return d.toISOString().slice(0, 10); }

function initDateInputs() {
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 6);
  const todayStr = fmt(today);
  dateStartInput.max   = todayStr;
  dateEndInput.max     = todayStr;
  dateStartInput.value = fmt(sevenDaysAgo);
  dateEndInput.value   = todayStr;
}

function getDateRange() {
  const start = dateStartInput.value || fmt((() => { const d = new Date(); d.setDate(d.getDate() - 6); return d; })());
  const end   = dateEndInput.value   || fmt(new Date());
  return { start, end };
}

function updateDateHint() {
  const { start, end } = getDateRange();
  const days = Math.round((new Date(end) - new Date(start)) / 86400000) + 1;
  if (!dateHint) return;
  if (days < 1) {
    dateHint.textContent = '⚠ END DATE MUST BE AFTER START DATE';
    dateHint.style.color = 'var(--c-red)';
  } else {
    dateHint.textContent = `SCAN WINDOW: ${days} DAY${days === 1 ? '' : 'S'}`;
    dateHint.style.color = 'var(--c-text-dim)';
  }
}

/* ════════════════════════════════════════════════════════════
   THREE.JS SCENE — MAGI amber/orange palette
   ════════════════════════════════════════════════════════════ */
function initScene() {
  const w = glCanvas.offsetWidth  || window.innerWidth;
  const h = glCanvas.offsetHeight || Math.round(window.innerHeight * 0.7);

  renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x040201);

  camera = new THREE.PerspectiveCamera(50, w / h, 0.01, 2000);
  camera.position.set(0, 5, 20);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
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

function buildBackground() {
  /* Main star field — amber/orange tones for MAGI aesthetic */
  const count = 7000;
  const pos   = new Float32Array(count * 3);
  const col   = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    const r  = 600 + Math.random() * 200;
    pos[i*3]   = r * Math.sin(ph) * Math.cos(th);
    pos[i*3+1] = r * Math.sin(ph) * Math.sin(th);
    pos[i*3+2] = r * Math.cos(ph);
    /* warm white to amber */
    const t = Math.random();
    col[i*3]   = 1.0;
    col[i*3+1] = 0.75 + t * 0.25;
    col[i*3+2] = 0.4  + t * 0.4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
    vertexColors: true, size: 0.65, sizeAttenuation: false
  })));

  /* Milky Way band — warm orange-white */
  const mwCount = 2000;
  const mwPos   = new Float32Array(mwCount * 3);
  for (let i = 0; i < mwCount; i++) {
    const alpha  = Math.random() * Math.PI * 2;
    const spread = (Math.random() - 0.5) * 0.35;
    const r = 580 + Math.random() * 100;
    mwPos[i*3]   = r * Math.cos(alpha);
    mwPos[i*3+1] = r * (Math.sin(alpha) * 0.25 + spread);
    mwPos[i*3+2] = r * Math.sin(alpha) * 0.97;
  }
  const mwGeo = new THREE.BufferGeometry();
  mwGeo.setAttribute('position', new THREE.BufferAttribute(mwPos, 3));
  scene.add(new THREE.Points(mwGeo, new THREE.PointsMaterial({
    color: 0xffcc88, size: 0.45, sizeAttenuation: false, transparent: true, opacity: 0.45
  })));
}

function buildLights() {
  /* Warm ambient — MAGI display glow */
  scene.add(new THREE.AmbientLight(0x1a0d04, 8));

  const sunLight = new THREE.DirectionalLight(0xfff4d0, 3.2);
  sunLight.position.set(80, 25, 40);
  scene.add(sunLight);

  scene.add(new THREE.HemisphereLight(0x200a02, 0x0a0500, 0.6));

  const sunGeo  = new THREE.SphereGeometry(9, 16, 16);
  const sunMat  = new THREE.MeshBasicMaterial({ color: 0xfffde0 });
  const sun     = new THREE.Mesh(sunGeo, sunMat);
  sun.position.set(780, 250, 380);
  scene.add(sun);

  const glowGeo = new THREE.SphereGeometry(22, 16, 16);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xff9900, transparent: true, opacity: 0.08 });
  sun.add(new THREE.Mesh(glowGeo, glowMat));
}

function makeEarthTexture() {
  const W = 1024, H = 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');

  const og = g.createLinearGradient(0, 0, 0, H);
  og.addColorStop(0,   '#0b2e5c');
  og.addColorStop(0.4, '#1060a0');
  og.addColorStop(0.6, '#1060a0');
  og.addColorStop(1,   '#0b2e5c');
  g.fillStyle = og;
  g.fillRect(0, 0, W, H);

  const cc = '#3d7a43';
  const fill = (x, y, rx, ry, rot) => {
    g.fillStyle = cc;
    g.beginPath();
    g.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
    g.fill();
  };
  fill(W*0.18,  H*0.31, W*0.08,  H*0.17,  -0.25);
  fill(W*0.22,  H*0.21, W*0.04,  H*0.07,   0.1);
  fill(W*0.215, H*0.44, W*0.02,  H*0.05,   0.2);
  fill(W*0.245, H*0.63, W*0.048, H*0.17,   0.1);
  fill(W*0.504, H*0.265,W*0.036, H*0.09,  -0.1);
  fill(W*0.515, H*0.55, W*0.05,  H*0.19,   0.03);
  fill(W*0.565, H*0.35, W*0.022, H*0.065,  0.1);
  fill(W*0.66,  H*0.29, W*0.135, H*0.165,  0);
  fill(W*0.614, H*0.45, W*0.023, H*0.08,   0.04);
  fill(W*0.73,  H*0.46, W*0.04,  H*0.09,   0.12);
  fill(W*0.76,  H*0.68, W*0.052, H*0.078, -0.08);

  g.fillStyle = '#b0c8b0';
  fill(W*0.275, H*0.12, W*0.033, H*0.065, 0.12);

  g.fillStyle = '#cce4f5';
  g.fillRect(0, 0, W, H * 0.045);
  g.beginPath(); g.ellipse(W*0.5, 0, W*0.5, H*0.09, 0, 0, Math.PI); g.fill();
  g.fillRect(0, H * 0.91, W, H * 0.09);

  g.fillStyle = 'rgba(255,255,255,0.1)';
  [[0.08,0.32,90,19],[0.28,0.52,65,13],[0.43,0.39,55,11],
   [0.60,0.56,72,15],[0.76,0.31,58,12],[0.90,0.48,70,14],
   [0.15,0.68,80,16],[0.55,0.22,60,10],[0.70,0.72,75,17]
  ].forEach(([x,y,w,h2]) => { g.fillRect(W*x, H*y, w, h2); });

  return c;
}

function buildEarth() {
  const geo = new THREE.SphereGeometry(EARTH_R, 64, 64);
  const tex = new THREE.CanvasTexture(makeEarthTexture());
  const mat = new THREE.MeshPhongMaterial({
    map:       tex,
    shininess: 18,
    specular:  new THREE.Color(0x1a3a5c),
    emissive:  new THREE.Color(0x110500),
  });
  earthMesh = new THREE.Mesh(geo, mat);
  scene.add(earthMesh);

  /* Orange atmosphere glow — MAGI tactical display */
  const atmoGeo = new THREE.SphereGeometry(EARTH_R * 1.03, 32, 32);
  const atmoMat = new THREE.MeshPhongMaterial({
    color:      0xff6622,
    transparent: true,
    opacity:    0.07,
    side:       THREE.FrontSide,
    depthWrite: false,
  });
  earthMesh.add(new THREE.Mesh(atmoGeo, atmoMat));
}

function buildMoon() {
  const geo = new THREE.SphereGeometry(0.27, 32, 32);
  const mat = new THREE.MeshPhongMaterial({ color: 0x887766, shininess: 4 });
  moonMesh = new THREE.Mesh(geo, mat);
  scene.add(moonMesh);

  const ring = new THREE.RingGeometry(MOON_ORBIT_VIS - 0.01, MOON_ORBIT_VIS + 0.01, 128);
  const rmat = new THREE.MeshBasicMaterial({
    color: 0x331a00, side: THREE.DoubleSide, transparent: true, opacity: 0.4
  });
  scene.add(new THREE.Mesh(ring, rmat));
}

function buildLdRing() {
  const ring = new THREE.RingGeometry(MOON_ORBIT_VIS - 0.005, MOON_ORBIT_VIS + 0.005, 128);
  const mat  = new THREE.MeshBasicMaterial({
    color: 0xff8833, side: THREE.DoubleSide, transparent: true, opacity: 0.18
  });
  scene.add(new THREE.Mesh(ring, mat));
}

/* ════════════════════════════════════════════════════════════
   NEO scene objects — MAGI orange/amber/red palette
   ════════════════════════════════════════════════════════════ */
function neoColor(neo) {
  if (neo.hazard)      return new THREE.Color(0xff2200);
  if (neo.distLd < 5)  return new THREE.Color(0xffaa00);
  return new THREE.Color(0xff6600);
}

function clearNeos() {
  neoObjects.forEach(({ mesh, line }) => {
    scene.remove(mesh);
    if (line) scene.remove(line);
  });
  neoObjects = [];
  selectedId = null;
  lastHover  = null;
}

function populateScene(neos) {
  clearNeos();

  neos.forEach((neo, idx) => {
    const r     = NEO_ORBIT_MIN + (neo.distLd / 60) * (NEO_ORBIT_MAX - NEO_ORBIT_MIN);
    const inc   = neo.inc   || (Math.random() * Math.PI * 0.7);
    const raan  = neo.raan  || (Math.random() * Math.PI * 2);
    const theta = neo.phase || (idx * 2.399963);

    const dkm  = Math.max(0.05, Math.min(neo.diameter || 0.1, 10));
    const size = 0.06 + (Math.log10(dkm + 0.05) + 1.3) * 0.09;

    const color = neoColor(neo);
    const geo   = new THREE.SphereGeometry(size, 8, 8);
    const mat   = new THREE.MeshPhongMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.4,
      shininess: 60,
    });
    const mesh = new THREE.Mesh(geo, mat);

    const pts = [];
    for (let i = 0; i <= 128; i++) {
      const t = (i / 128) * Math.PI * 2;
      const x = r * Math.cos(t);
      const z = r * Math.sin(t);
      const y = x * Math.tan(inc) * Math.sin(raan) + z * Math.tan(inc) * Math.cos(raan);
      pts.push(new THREE.Vector3(x, y * 0.3, z));
    }
    const lineMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.14 });
    const line    = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      lineMat
    );

    scene.add(line);
    scene.add(mesh);

    neoObjects.push({ mesh, line, data: neo, r, inc, raan, theta, omega: 0.002 + Math.random() * 0.003 });
  });
}

/* ── Animation loop ── */
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  moonTheta += 0.005 * dt * 60;
  moonMesh.position.set(
    MOON_ORBIT_VIS * Math.cos(moonTheta), 0,
    MOON_ORBIT_VIS * Math.sin(moonTheta)
  );

  earthMesh.rotation.y += 0.002 * dt * 60;

  neoObjects.forEach(obj => {
    obj.theta += obj.omega * dt * 60;
    const x = obj.r * Math.cos(obj.theta);
    const z = obj.r * Math.sin(obj.theta);
    const y = x * Math.tan(obj.inc) * Math.sin(obj.raan) + z * Math.tan(obj.inc) * Math.cos(obj.raan);
    obj.mesh.position.set(x, y * 0.3, z);
  });

  raycaster.setFromCamera(pointer, camera);
  const hits   = raycaster.intersectObjects(neoObjects.map(o => o.mesh));
  const hitObj = hits.length ? neoObjects.find(o => o.mesh === hits[0].object) : null;

  if (hitObj !== lastHover) {
    if (lastHover && lastHover.data.id !== selectedId) {
      lastHover.mesh.material.emissiveIntensity = 0.4;
      lastHover.line.material.opacity = 0.14;
    }
    if (hitObj) {
      hitObj.mesh.material.emissiveIntensity = 1.0;
      hitObj.line.material.opacity = 0.65;
      showTooltip(hitObj.data);
    } else {
      hideTooltip();
    }
    lastHover = hitObj;
  }

  controls.update();
  renderer.render(scene, camera);
}

/* ════════════════════════════════════════════════════════════
   Events
   ════════════════════════════════════════════════════════════ */
function setupEvents() {
  window.addEventListener('resize', () => {
    const w = glCanvas.offsetWidth;
    const h = glCanvas.offsetHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  });

  glCanvas.addEventListener('mousemove', e => {
    const rect = glCanvas.getBoundingClientRect();
    pointer.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    pointer.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
    pointerClientX = e.clientX - rect.left;
    pointerClientY = e.clientY - rect.top;
    positionTooltip();
  });

  glCanvas.addEventListener('mouseleave', () => {
    pointer.x = -9; pointer.y = -9;
    hideTooltip();
  });

  glCanvas.addEventListener('click', () => {
    if (lastHover) selectNeo(lastHover.data.id);
  });

  /* CASPAR-3 panel close */
  closeInfoBtn?.addEventListener('click', () => {
    panelInfo.hidden = true;
    selectedId = null;
    neoObjects.forEach(o => {
      o.mesh.material.emissiveIntensity = 0.4;
      o.line.material.opacity = 0.14;
    });
  });

  retryBtn?.addEventListener('click', loadNeos);
  refreshBtn?.addEventListener('click', loadNeos);

  /* MELCHIOR-1 panel collapse */
  controlsHeader?.addEventListener('click', () => {
    panelControls.classList.toggle('collapsed');
  });

  /* Search */
  neoSearch?.addEventListener('input', e => {
    searchTerm = e.target.value.toLowerCase();
    renderTable(allNeos);
  });

  /* BALTHASAR-2 filter buttons */
  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      filterMode = btn.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach(b =>
        b.classList.remove('magi-filter-btn--active')
      );
      btn.classList.add('magi-filter-btn--active');
      renderTable(allNeos);
    });
  });

  /* Table sort — uses data-col attribute in MAGI HTML */
  document.querySelectorAll('[data-col]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.col;
      tableSort.dir = tableSort.key === key ? -tableSort.dir : 1;
      tableSort.key = key;
      renderTable(allNeos);
    });
  });

  /* Date inputs */
  dateStartInput?.addEventListener('change', updateDateHint);
  dateEndInput?.addEventListener('change',   updateDateHint);
}

/* ── Select NEO — CASPAR-3 analysis panel ── */
function selectNeo(id) {
  selectedId = id;
  const neo = allNeos.find(n => n.id === id);
  if (!neo) return;

  neoObjects.forEach(o => {
    o.mesh.material.emissiveIntensity = o.data.id === id ? 1.2 : 0.4;
    o.line.material.opacity           = o.data.id === id ? 0.7 : 0.14;
  });

  const diamStr = neo.diameter < 1
    ? (neo.diameter * 1000).toFixed(0) + ' m'
    : neo.diameter.toFixed(2) + ' km';

  const badge = neo.hazard
    ? '<span class="info-hazard-badge">⚠ POTENTIALLY HAZARDOUS</span>'
    : '<span class="info-safe-badge">✓ NOMINAL APPROACH</span>';

  infoContent.innerHTML = `
    <table class="info-table">
      <tr><td>DESIGNATION</td><td>${neo.name}</td></tr>
      <tr><td>APPROACH DATE</td><td>${neo.date}</td></tr>
      <tr><td>DIST [LD]</td><td>${neo.distLd.toFixed(3)}</td></tr>
      <tr><td>DIST [Mkm]</td><td>${(neo.distKm / 1e6).toFixed(3)}</td></tr>
      <tr><td>VELOCITY [km/s]</td><td>${neo.vel.toFixed(2)}</td></tr>
      <tr><td>DIAMETER</td><td>~${diamStr}</td></tr>
      <tr><td>SOURCE</td><td>${neo.source}</td></tr>
      <tr><td>STATUS</td><td>${badge}</td></tr>
      <tr><td>DATABASE</td><td><a class="info-jpl-link" href="${neo.jplUrl}" target="_blank" rel="noopener">JPL SSD ↗</a></td></tr>
    </table>
  `;
  panelInfo.hidden = false;
}

function showTooltip(neo) {
  if (!tooltip) return;
  tooltip.textContent = `${neo.name} — ${neo.distLd.toFixed(2)} LD`;
  tooltip.hidden = false;
  tooltip.classList.add('visible');
  positionTooltip();
}

function hideTooltip() {
  if (!tooltip) return;
  tooltip.hidden = true;
  tooltip.classList.remove('visible');
}

function positionTooltip() {
  if (!tooltip || tooltip.hidden) return;
  tooltip.style.left = (pointerClientX + 14) + 'px';
  tooltip.style.top  = (pointerClientY + 14) + 'px';
}

/* ════════════════════════════════════════════════════════════
   Data fetching
   ════════════════════════════════════════════════════════════ */
async function loadNeos() {
  const { start, end } = getDateRange();
  const distMax = distSelect ? distSelect.value : '0.05';

  if (start > end) {
    showError('START DATE MUST BE BEFORE END DATE // TEMPORAL PARAMETER ERROR');
    return;
  }

  updateDateHint();
  showLoading(MAGI_MSGS[0]);
  setLoadingProgress(5);
  if (refreshBtn) refreshBtn.disabled = true;

  try {
    setLoadingProgress(20);
    updateLoadingText(MAGI_MSGS[1]);

    const [jplResult, nasaResult] = await Promise.allSettled([
      fetchJpl(start, end, distMax),
      fetchNasaChunked(start, end)
    ]);

    setLoadingProgress(55);
    let neos = [];

    if (jplResult.status === 'fulfilled' && jplResult.value) {
      updateLoadingText(MAGI_MSGS[2]);
      neos = processJpl(jplResult.value);
    } else {
      console.warn('[MAGI] JPL CAD unavailable (CORS):', jplResult.reason);
    }

    setLoadingProgress(70);

    if (nasaResult.status === 'fulfilled' && nasaResult.value) {
      if (neos.length > 0) {
        updateLoadingText(MAGI_MSGS[3]);
        mergeNasa(neos, nasaResult.value);
      } else {
        updateLoadingText(MAGI_MSGS[3]);
        neos = processNasaDirect(nasaResult.value, distMax);
      }
    } else if (nasaResult.status === 'rejected') {
      console.warn('[MAGI] NASA NeoWs failed:', nasaResult.reason);
    }

    if (neos.length === 0) {
      const rawNasaData   = nasaResult.status === 'fulfilled' ? nasaResult.value : null;
      const totalObjects  = rawNasaData
        ? Object.values(rawNasaData.near_earth_objects || {}).reduce((a, d) => a + d.length, 0)
        : 0;

      if (totalObjects > 0) {
        showError(
          `${totalObjects} OBJECTS DETECTED IN PERIOD — NONE WITHIN ${distMax} AU THRESHOLD<br>` +
          'INCREASE MAX PROXIMITY PARAMETER OR EXTEND DATE RANGE'
        );
      } else {
        showError(
          'NO OBJECTS DETECTED IN SELECTED WINDOW<br>' +
          'INCREASE PROXIMITY THRESHOLD OR EXTEND DATE RANGE'
        );
      }
      return;
    }

    setLoadingProgress(90);
    updateLoadingText(MAGI_MSGS[5]);

    allNeos = neos;
    updateStats(neos);
    populateScene(neos);
    renderTable(neos);

    setLoadingProgress(100);

    panelWelcome.hidden = true;
    panelLoading.hidden = true;
    panelStats.hidden   = false;
    panelLegend.hidden  = false;
    listSection.hidden  = false;
    panelError.hidden   = true;

  } catch (err) {
    showError('MAGI SYSTEM ERROR: ' + (err.message || 'UNABLE TO REACH API ENDPOINTS'));
  } finally {
    if (refreshBtn) refreshBtn.disabled = false;
  }
}

/* ── JPL SSD ── */
async function fetchJpl(dateMin, dateMax, distMax) {
  return window.NasaApi.fetchJplCad(dateMin, dateMax, distMax);
}

function processJpl(raw) {
  if (!raw.data || raw.data.length === 0) return [];

  const fi = {};
  (raw.fields || []).forEach((f, i) => { fi[f] = i; });

  return raw.data.map((row, idx) => {
    const des      = row[fi['des']]      || '';
    const fullname = row[fi['fullname']] || des;
    const cd       = row[fi['cd']]       || '';
    const distAu   = parseFloat(row[fi['dist']]  || 0);
    const vel      = parseFloat(row[fi['v_rel']] || 0);
    const h        = row[fi['h']] !== undefined ? parseFloat(row[fi['h']]) : null;
    const diamRaw  = row[fi['diameter']];
    const diameter = diamRaw ? parseFloat(diamRaw) : estimateDiameter(h);
    const distKm   = distAu * AU_TO_KM;
    const distLd   = distKm / LUNAR_DIST_KM;
    const dateStr  = normalizeJplDate(cd);

    return {
      id:       'jpl-' + idx + '-' + des.replace(/\s+/g, ''),
      name:     cleanName(fullname),
      des,
      date:     dateStr,
      distKm,
      distLd,
      vel,
      h,
      diameter,
      hazard:   false,
      source:   'JPL CAD',
      jplUrl:   `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?des=${encodeURIComponent(des)}`,
      inc:   Math.random() * Math.PI * 0.7,
      raan:  Math.random() * Math.PI * 2,
      phase: Math.random() * Math.PI * 2,
    };
  });
}

function normalizeJplDate(cd) {
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

function estimateDiameter(h) {
  if (h === null || isNaN(h)) return 0.1;
  return 1329 * Math.pow(10, -h / 5) / Math.sqrt(0.14) / 1000;
}

/* ── NASA NeoWs ── */
function processNasaDirect(raw, distMaxAu) {
  const maxAu = parseFloat(distMaxAu) || 0.05;
  const neos  = [];

  Object.values(raw.near_earth_objects || {}).forEach(dayList => {
    dayList.forEach(obj => {
      const approach = obj.close_approach_data && obj.close_approach_data[0];
      if (!approach) return;

      const distKm = parseFloat(approach.miss_distance.kilometers);
      const distAu = distKm / AU_TO_KM;
      if (distAu > maxAu) return;

      const distLd = parseFloat(approach.miss_distance.lunar);
      const vel    = parseFloat(approach.relative_velocity.kilometers_per_second);
      const dMin   = obj.estimated_diameter.kilometers.estimated_diameter_min;
      const dMax   = obj.estimated_diameter.kilometers.estimated_diameter_max;
      const h      = typeof obj.absolute_magnitude_h === 'number' ? obj.absolute_magnitude_h : null;

      neos.push({
        id:       'nasa-' + obj.id,
        name:     obj.name.replace(/^\s*\(/, '').replace(/\)\s*$/, '').trim() || obj.name.trim(),
        des:      obj.name.trim(),
        date:     approach.close_approach_date,
        distKm,
        distLd,
        vel,
        h,
        diameter: (dMin + dMax) / 2,
        hazard:   obj.is_potentially_hazardous_asteroid,
        source:   'NASA NeoWs',
        jplUrl:   `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?des=${encodeURIComponent(obj.name.trim())}`,
        inc:   Math.random() * Math.PI * 0.7,
        raan:  Math.random() * Math.PI * 2,
        phase: Math.random() * Math.PI * 2,
      });
    });
  });

  return neos.sort((a, b) => a.distKm - b.distKm);
}

async function fetchNasaChunked(startDate, endDate) {
  const start  = new Date(startDate);
  const end    = new Date(endDate);
  const chunks = [];
  let cur      = new Date(start);

  while (cur <= end) {
    const chunkEnd = new Date(cur);
    chunkEnd.setDate(chunkEnd.getDate() + 6);
    if (chunkEnd > end) chunkEnd.setTime(end.getTime());
    chunks.push({ s: fmt(cur), e: fmt(chunkEnd) });
    cur.setDate(cur.getDate() + 7);
  }

  const results = await Promise.all(chunks.map(c => fetchNasa(c.s, c.e).catch(() => null)));
  const merged  = { near_earth_objects: {} };
  results.forEach(r => {
    if (r && r.near_earth_objects) Object.assign(merged.near_earth_objects, r.near_earth_objects);
  });
  return merged;
}

async function fetchNasa(startDate, endDate) {
  return window.NasaApi.fetchNeoFeed(startDate, endDate);
}

function buildNasaMap(raw) {
  const map = new Map();
  Object.values(raw.near_earth_objects || {}).forEach(dayList => {
    dayList.forEach(neo => {
      const key  = neo.name.replace(/[^a-z0-9]/gi, '').toLowerCase();
      const dMin = neo.estimated_diameter.kilometers.estimated_diameter_min;
      const dMax = neo.estimated_diameter.kilometers.estimated_diameter_max;
      map.set(key, { hazard: neo.is_potentially_hazardous_asteroid, diameter: (dMin + dMax) / 2 });
    });
  });
  return map;
}

function mergeNasa(neos, nasaRaw) {
  const nasaMap = buildNasaMap(nasaRaw);
  neos.forEach(neo => {
    const key   = neo.des.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const match = nasaMap.get(key);
    if (match) {
      neo.hazard   = match.hazard;
      neo.diameter = match.diameter;
      neo.source   = 'JPL CAD + NASA NeoWs';
    }
  });
}

/* ════════════════════════════════════════════════════════════
   BALTHASAR-2: Table rendering
   ════════════════════════════════════════════════════════════ */
function renderTable(neos) {
  updateSortHeaders();
  let filtered = neos;

  if (filterMode === 'hazard') filtered = neos.filter(n =>  n.hazard);
  if (filterMode === 'safe')   filtered = neos.filter(n => !n.hazard);
  if (searchTerm) {
    filtered = filtered.filter(n =>
      n.name.toLowerCase().includes(searchTerm) ||
      n.des.toLowerCase().includes(searchTerm)
    );
  }

  filtered.sort((a, b) => {
    let av, bv;
    switch (tableSort.key) {
      case 'name': av = a.name.toLowerCase(); bv = b.name.toLowerCase(); break;
      case 'dist': av = a.distLd;    bv = b.distLd;    break;
      case 'vel':  av = a.vel;       bv = b.vel;        break;
      case 'diam': av = a.diameter;  bv = b.diameter;   break;
      case 'date': av = a.date;      bv = b.date;       break;
      default:     av = a.distLd;    bv = b.distLd;
    }
    return tableSort.dir * (av < bv ? -1 : av > bv ? 1 : 0);
  });

  const tableCountEl = document.getElementById('table-count');
  if (tableCountEl) tableCountEl.textContent = filtered.length;

  neoTbody.innerHTML = filtered.map(neo => `
    <tr class="${neo.hazard ? 'hazard-row' : ''}" data-id="${neo.id}">
      <td class="td-name">${neo.name}</td>
      <td>${neo.date}</td>
      <td>${neo.distLd.toFixed(4)}</td>
      <td>${neo.vel.toFixed(2)}</td>
      <td>${neo.diameter < 1 ? (neo.diameter * 1000).toFixed(0) + ' m' : neo.diameter.toFixed(2) + ' km'}</td>
      <td>${neo.hazard
        ? '<span class="badge-hazard">⚠ HAZARDOUS</span>'
        : '<span class="badge-safe">✓ NOMINAL</span>'}</td>
    </tr>
  `).join('');

  neoTbody.querySelectorAll('tr[data-id]').forEach(row => {
    row.addEventListener('click', () => selectNeo(row.dataset.id));
  });
}

function updateSortHeaders() {
  document.querySelectorAll('[data-col]').forEach(th => {
    th.classList.remove('sorted-asc', 'sorted-desc');
    if (th.dataset.col === tableSort.key) {
      th.classList.add(tableSort.dir > 0 ? 'sorted-asc' : 'sorted-desc');
    }
  });
}

/* ── Stats ── */
function updateStats(neos) {
  statTotal.textContent  = neos.length;
  statSafe.textContent   = neos.filter(n => !n.hazard).length;
  statHazard.textContent = neos.filter(n =>  n.hazard).length;
}

/* ── UI helpers ── */
function showLoading(msg) {
  if (panelLoading) panelLoading.hidden = false;
  if (loadingText)  loadingText.textContent = msg || 'PROCESSING...';
  if (panelError)   panelError.hidden  = true;
  if (panelStats)   panelStats.hidden  = true;
  if (panelLegend)  panelLegend.hidden = true;
  if (listSection)  listSection.hidden = true;
  setLoadingProgress(0);
}

function updateLoadingText(msg) {
  if (loadingText) loadingText.textContent = msg;
}

function showError(msg) {
  if (errorText)    errorText.innerHTML    = msg;
  if (panelError)   panelError.hidden      = false;
  if (panelLoading) panelLoading.hidden    = true;
  if (panelStats)   panelStats.hidden      = true;
  if (panelLegend)  panelLegend.hidden     = true;
  if (listSection)  listSection.hidden     = true;
}

/* ════════════════════════════════════════════════════════════
   Boot
   ════════════════════════════════════════════════════════════ */
function boot() {
  try {
    initDateInputs();
    initScene();
    setupEvents();
    animate();
    updateDateHint();

    /* Real-time clock */
    updateClock();
    setInterval(updateClock, 1000);

    /* Show welcome overlay initially */
    if (panelStats)   panelStats.hidden   = true;
    if (panelLegend)  panelLegend.hidden  = true;
    if (panelLoading) panelLoading.hidden = true;
    if (panelWelcome) panelWelcome.hidden = false;

    loadNeos();
  } catch (err) {
    console.error('[MAGI SYSTEM] Boot error:', err);
    if (panelError) {
      panelError.hidden = false;
      if (errorText) errorText.textContent = 'SYSTEM BOOT ERROR: ' + (err.message || err);
    }
  }
}

document.addEventListener('DOMContentLoaded', boot);
