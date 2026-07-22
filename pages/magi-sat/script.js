'use strict';

// ═══════════════════════════════════════════════════════════════
// MAGI-SAT — Orbital Surveillance System
// NERV HQ / Geohasard Analysis Division
// Orbital mechanics: simplified two-body Keplerian propagation
// ═══════════════════════════════════════════════════════════════

// ── Constants ────────────────────────────────────────────────
var EARTH_R_KM   = 6371;        // Earth radius km
var MU           = 398600.4418; // Gravitational parameter km³/s²
var TWO_PI       = Math.PI * 2;
var DEG2RAD      = Math.PI / 180;
// Earth sidereal rotation rate (rad/s)
var EARTH_ROT    = 7.2921150e-5;
// Camera zone thresholds (scene units, Earth = radius 1)
var ZONE_LEO = 3.5;
var ZONE_MEO = 9.5;
var ZONE_GEO = 17.0;

// ── Satellite group definitions ──────────────────────────────
var GROUP_DEFS = {
  stations:       { label: 'SPACE STATIONS',    color: 0xffffff, sphereR: 0.025, autoLoad: true,  usePoints: false },
  'gps-ops':      { label: 'GPS CONSTELLATION', color: 0x44ff88, sphereR: 0.008, autoLoad: true,  usePoints: false },
  visual:         { label: 'BRIGHTEST (100)',   color: 0xff8800, sphereR: 0.008, autoLoad: true,  usePoints: false },
  starlink:       { label: 'STARLINK',          color: 0xffaa00, sphereR: null,  autoLoad: false, usePoints: true  },
  'glo-ops':      { label: 'GLONASS',           color: 0x88ffcc, sphereR: 0.008, autoLoad: false, usePoints: false },
  galileo:        { label: 'GALILEO',           color: 0x44ccff, sphereR: 0.008, autoLoad: false, usePoints: false },
  military:       { label: 'MILITARY OPS',      color: 0xff2200, sphereR: 0.009, autoLoad: false, usePoints: false },
  weather:        { label: 'WEATHER SAT',       color: 0xaaddff, sphereR: 0.007, autoLoad: false, usePoints: false },
  'last-30-days': { label: 'RECENT LAUNCHES',   color: 0xff44aa, sphereR: 0.006, autoLoad: false, usePoints: false },
};

// Runtime state per group
Object.keys(GROUP_DEFS).forEach(function (k) {
  GROUP_DEFS[k].loaded  = false;
  GROUP_DEFS[k].loading = false;
  GROUP_DEFS[k].visible = GROUP_DEFS[k].autoLoad;
});

// ── Infrastructure layer definitions ─────────────────────────
var SURFACE_R = 1.003; // slightly above Earth surface

var LAYER_DEFS = {
  'chokepoints':      { label: 'CHOKEPOINTS',    color: 0xff3300, r: 0.012, type: 'point' },
  'landing_points':   { label: 'CABLE LANDINGS', color: 0x44ccff, r: 0.007, type: 'point' },
  'airports':         { label: 'AIRPORTS',       color: 0xffaa00, r: 0.005, type: 'point' },
  'power_plants':     { label: 'POWER PLANTS',   color: 0x88ff88, r: 0.004, type: 'point' },
  'submarine_cables': { label: 'SUB CABLES',     color: 0x0088ff, r: null,  type: 'line'  },
};

var FUEL_COLORS = {
  'Solar':       0xffee00,
  'Wind':        0x88ffcc,
  'Hydro':       0x0088ff,
  'Nuclear':     0xff2200,
  'Gas':         0xff8800,
  'Coal':        0x887766,
  'Oil':         0x553322,
  'Biomass':     0x44aa22,
  'Geothermal':  0xff6600,
  'Waste':       0x997755,
};

Object.keys(LAYER_DEFS).forEach(function (k) {
  LAYER_DEFS[k].loaded   = false;
  LAYER_DEFS[k].loading  = false;
  LAYER_DEFS[k].visible  = false;
  LAYER_DEFS[k].features = [];
  LAYER_DEFS[k].renderObjs = [];
});

// ── Scene state ───────────────────────────────────────────────
var renderer, scene, camera, controls, clock;
var earthGroup;              // THREE.Group — Earth + atmosphere + ground resources
var earthMesh, atmosphereMesh;
var layerGroups = {};        // layerName → THREE.Group (child of earthGroup)
var issOrbitLine = null;
var selectedOrbitLine = null;
var selectedSat = null;
var selectedFeature = null;  // { layerName, idx } for ground resources
var satGroups = {};      // groupName → { satellites[], renderObj }
var timeMultiplier = 1;
var simStartReal = 0;
var simStartSim  = 0;
var showOrbits   = true;
var autoRotate   = true;
var lastPosUpdate = 0;
var totalCount   = 0;
var stationCount = 0;
var _dummy;              // reusable Object3D for InstancedMesh matrix updates

// Table state
var tableData      = [];
var tableSortKey   = 'meanAlt_km';
var tableSortAsc   = true;
var tableFilter    = '';

// Raycaster
var raycaster, mouse;

// ── Orbital mechanics ─────────────────────────────────────────

function parseEpochMs(epochStr) {
  return new Date(epochStr).getTime();
}

function solveKepler(M, e) {
  var E = M, dE;
  for (var i = 0; i < 50; i++) {
    dE = (M - E + e * Math.sin(E)) / (1.0 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-10) break;
  }
  return E;
}

function normalizeSat(raw, groupName) {
  var n_radps = (raw.MEAN_MOTION || 0) * TWO_PI / 86400; // rad/s
  var a_km    = n_radps > 0 ? Math.cbrt(MU / (n_radps * n_radps)) : 0;
  var T_min   = n_radps > 0 ? (TWO_PI / n_radps) / 60 : 0;
  return {
    name:          raw.OBJECT_NAME   || 'UNKNOWN',
    objectId:      raw.OBJECT_ID     || '',
    noradId:       raw.NORAD_CAT_ID  || 0,
    epochMs:       parseEpochMs(raw.EPOCH),
    meanMotion:    raw.MEAN_MOTION   || 0,   // rev/day
    eccentricity:  raw.ECCENTRICITY  || 0,
    inclination:   raw.INCLINATION   || 0,   // deg
    raan:          raw.RA_OF_ASC_NODE    || 0, // deg
    argPericenter: raw.ARG_OF_PERICENTER || 0, // deg
    meanAnomaly:   raw.MEAN_ANOMALY  || 0,   // deg
    revAtEpoch:    raw.REV_AT_EPOCH  || 0,
    semiMajor_km:  a_km,
    period_min:    T_min,
    meanAlt_km:    a_km > 0 ? a_km - EARTH_R_KM : 0,
    groupName:     groupName,
    groupLabel:    GROUP_DEFS[groupName] ? GROUP_DEFS[groupName].label : groupName,
  };
}

// Compute ECI position in Three.js coords (Y = north pole = up)
// ECI → Three: x=ECI.x, y=ECI.z, z=−ECI.y
function satToThree(sat, timeMs) {
  var n = sat.meanMotion * TWO_PI / 86400; // rad/s
  if (n <= 0) return { x: 0, y: 1.1, z: 0 };
  var a = sat.semiMajor_km || Math.cbrt(MU / (n * n));
  var e = sat.eccentricity;

  var dt = (timeMs - sat.epochMs) / 1000.0; // seconds
  var M  = ((sat.meanAnomaly * DEG2RAD + n * dt) % TWO_PI + TWO_PI) % TWO_PI;
  var E  = solveKepler(M, e);

  var nu = 2.0 * Math.atan2(
    Math.sqrt(1.0 + e) * Math.sin(E * 0.5),
    Math.sqrt(1.0 - e) * Math.cos(E * 0.5)
  );

  var r  = a * (1.0 - e * Math.cos(E));
  var rp = r * Math.cos(nu);
  var rq = r * Math.sin(nu);

  var cO = Math.cos(sat.raan          * DEG2RAD);
  var sO = Math.sin(sat.raan          * DEG2RAD);
  var cI = Math.cos(sat.inclination   * DEG2RAD);
  var sI = Math.sin(sat.inclination   * DEG2RAD);
  var cW = Math.cos(sat.argPericenter * DEG2RAD);
  var sW = Math.sin(sat.argPericenter * DEG2RAD);

  var xECI = (cO*cW - sO*sW*cI)*rp + (-cO*sW - sO*cW*cI)*rq;
  var yECI = (sO*cW + cO*sW*cI)*rp + (-sO*sW + cO*cW*cI)*rq;
  var zECI = (sW*sI)*rp + (cW*sI)*rq;

  var s = 1.0 / EARTH_R_KM;
  return { x: xECI * s, y: zECI * s, z: -yECI * s };
}

// Orbit path as array of THREE.Vector3 (full ellipse, nu 0…2π)
function orbitPoints(sat, steps) {
  steps = steps || 256;
  var n = sat.meanMotion * TWO_PI / 86400;
  if (n <= 0) return [];
  var a = sat.semiMajor_km || Math.cbrt(MU / (n * n));
  var e = sat.eccentricity;
  var p = a * (1.0 - e * e); // semi-latus rectum

  var cO = Math.cos(sat.raan          * DEG2RAD), sO = Math.sin(sat.raan          * DEG2RAD);
  var cI = Math.cos(sat.inclination   * DEG2RAD), sI = Math.sin(sat.inclination   * DEG2RAD);
  var cW = Math.cos(sat.argPericenter * DEG2RAD), sW = Math.sin(sat.argPericenter * DEG2RAD);

  // Perifocal unit vectors in ECI
  var Px = cO*cW - sO*sW*cI,  Py = sO*cW + cO*sW*cI,  Pz = sW*sI;
  var Qx = -cO*sW - sO*cW*cI, Qy = -sO*sW + cO*cW*cI, Qz = cW*sI;

  var pts = [];
  var s = 1.0 / EARTH_R_KM;
  for (var i = 0; i <= steps; i++) {
    var nu = (i / steps) * TWO_PI;
    var r  = p / (1.0 + e * Math.cos(nu));
    var rp = r * Math.cos(nu);
    var rq = r * Math.sin(nu);
    pts.push(new THREE.Vector3(
      (Px*rp + Qx*rq) * s,
       (Pz*rp + Qz*rq) * s,
      -(Py*rp + Qy*rq) * s
    ));
  }
  return pts;
}

// ── Three.js scene ────────────────────────────────────────────

// Convert geographic coordinates to a Three.js sphere position.
// Matches Three.js SphereGeometry UV mapping: lon=0,lat=0 → +X axis.
function latLonTo3D(lat, lon, r) {
  var u = (lon + 180) / 360;
  var v = (90 - lat) / 180;
  return new THREE.Vector3(
    -r * Math.cos(u * TWO_PI) * Math.sin(v * Math.PI),
     r * Math.cos(v * Math.PI),
     r * Math.sin(u * TWO_PI) * Math.sin(v * Math.PI)
  );
}

function initScene() {
  var canvas = document.getElementById('gl-canvas');
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x040201);

  camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.01, 500);
  camera.position.set(0, 1.2, 3.8);

  controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping   = true;
  controls.dampingFactor   = 0.05;
  controls.autoRotate      = true;
  controls.autoRotateSpeed = 0.3;
  controls.minDistance     = 1.15;
  controls.maxDistance     = 80;

  clock  = new THREE.Clock();
  _dummy = new THREE.Object3D();

  raycaster = new THREE.Raycaster();
  raycaster.params.Points.threshold = 0.015;
  mouse = new THREE.Vector2();

  buildStars();
  buildLights();
  buildEarth();
}

function buildStars() {
  var N = 7000;
  var pos = new Float32Array(N * 3);
  var col = new Float32Array(N * 3);
  for (var i = 0; i < N; i++) {
    var phi   = Math.acos(2 * Math.random() - 1);
    var theta = Math.random() * TWO_PI;
    var r     = 200 + Math.random() * 60;
    pos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
    pos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
    pos[i*3+2] = r * Math.cos(phi);
    var t = Math.random();
    col[i*3]   = 0.88 + t * 0.12;
    col[i*3+1] = 0.68 + t * 0.16;
    col[i*3+2] = 0.38 + t * 0.22;
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.55, vertexColors: true, sizeAttenuation: false })));
}

function buildLights() {
  scene.add(new THREE.AmbientLight(0x1a0d04, 1.0));
  var sun = new THREE.DirectionalLight(0xfff4d0, 3.0);
  sun.position.set(50, 20, 30);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x0a0505, 0x040201, 0.5));
}

function makeEarthTex() {
  var W = 1024, H = 512;
  var cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  var ctx = cv.getContext('2d');

  // lon/lat → canvas px
  function px(lon, lat) {
    return [(lon + 180) / 360 * W, (90 - lat) / 180 * H];
  }

  function drawContour(coords) {
    ctx.beginPath();
    var p = px(coords[0][0], coords[0][1]);
    ctx.moveTo(p[0], p[1]);
    for (var i = 1; i < coords.length; i++) {
      p = px(coords[i][0], coords[i][1]);
      ctx.lineTo(p[0], p[1]);
    }
    ctx.closePath();
    ctx.stroke();
  }

  // ── Pure black base ──────────────────────────────────────
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);

  // Subtle scattered data-noise pixels
  for (var i = 0; i < 3500; i++) {
    var t = Math.random();
    ctx.fillStyle = t > 0.6
      ? 'rgba(0,210,140,' + (0.04 + Math.random() * 0.06) + ')'
      : 'rgba(255,100,0,' + (0.02 + Math.random() * 0.03) + ')';
    ctx.fillRect(Math.floor(Math.random() * W), Math.floor(Math.random() * H), 1, 1);
  }

  // ── Lat/lon grid ─────────────────────────────────────────
  ctx.lineWidth = 0.5;
  for (var lat = -80; lat <= 80; lat += 20) {
    var y = ((90 - lat) / 180) * H;
    ctx.strokeStyle = lat === 0 ? 'rgba(255,120,0,0.28)' : 'rgba(255,90,0,0.12)';
    ctx.lineWidth   = lat === 0 ? 0.8 : 0.5;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  for (var lon = -180; lon < 180; lon += 30) {
    var x = ((lon + 180) / 360) * W;
    ctx.strokeStyle = 'rgba(255,90,0,0.10)';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }

  // ── Continent outlines (stroke only, orange glow) ────────
  ctx.strokeStyle = '#ff7700';
  ctx.lineWidth   = 1.8;
  ctx.lineJoin    = 'round';
  ctx.lineCap     = 'round';
  ctx.shadowColor = '#ff5500';
  ctx.shadowBlur  = 5;

  // North America
  drawContour([
    [-168,72],[-152,60],[-130,55],[-124,49],[-120,37],
    [-117,33],[-110,24],[-90,16],[-77,8],
    [-75,10],[-65,44],[-60,47],[-55,47],
    [-65,60],[-80,63],[-90,70],[-130,72],[-168,72]
  ]);

  // South America
  drawContour([
    [-75,12],[-50,5],[-35,-5],[-35,-15],
    [-40,-20],[-43,-23],[-48,-28],[-52,-33],
    [-58,-40],[-65,-55],[-68,-55],[-73,-50],
    [-73,-42],[-78,-8],[-75,12]
  ]);

  // Europe
  drawContour([
    [-10,36],[2,36],[15,38],[20,37],[28,41],
    [30,45],[28,62],[25,70],[15,71],
    [5,62],[-5,58],[-8,52],[-10,44],[-10,36]
  ]);

  // Africa
  drawContour([
    [-5,37],[10,38],[25,37],[32,31],[38,12],
    [44,12],[42,15],[44,20],[36,-5],
    [36,-18],[33,-30],[26,-34],[18,-35],
    [12,-22],[8,-5],[2,4],[-5,5],
    [-15,5],[-17,14],[-13,25],[-8,35],[-5,37]
  ]);

  // Asia (simplified)
  drawContour([
    [28,42],[40,38],[52,28],[60,22],
    [72,20],[80,8],[100,5],[105,10],
    [120,22],[135,35],[140,40],[140,48],
    [135,55],[120,58],[100,72],[70,73],
    [50,70],[30,68],[28,42]
  ]);

  // Australia
  drawContour([
    [114,-22],[120,-18],[130,-12],[138,-14],
    [145,-15],[150,-25],[155,-28],[152,-38],
    [145,-40],[138,-36],[130,-32],[118,-28],[114,-22]
  ]);

  // Greenland
  drawContour([
    [-30,84],[-10,83],[-18,77],[-24,73],
    [-44,70],[-55,73],[-58,77],[-44,83],[-30,84]
  ]);

  ctx.shadowBlur = 0;

  // ── "EARTH" label ────────────────────────────────────────
  ctx.font          = 'bold 20px "Share Tech Mono", Courier New, monospace';
  ctx.textAlign     = 'center';
  ctx.textBaseline  = 'middle';
  ctx.shadowColor   = 'rgba(0,220,160,0.9)';
  ctx.shadowBlur    = 10;
  ctx.fillStyle     = 'rgba(0,220,160,0.65)';
  ctx.fillText('EARTH', W / 2, H / 2);
  ctx.shadowBlur    = 0;

  return new THREE.CanvasTexture(cv);
}

function buildEarth() {
  earthGroup = new THREE.Group();
  scene.add(earthGroup);

  var mat = new THREE.MeshPhongMaterial({
    specular:   new THREE.Color(0x112244),
    shininess:  25,
  });
  earthMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), mat);
  earthGroup.add(earthMesh);

  // Load realistic NASA Blue Marble texture; fall back to procedural
  new THREE.TextureLoader().load(
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/textures/land_ocean_ice_cloud_2048.jpg',
    function (tex) { mat.map = tex; mat.needsUpdate = true; },
    undefined,
    function () { mat.map = makeEarthTex(); mat.needsUpdate = true; }
  );

  // Cyan atmosphere layers (BackSide trick)
  var atmoLayers = [[1.03, 0x00eebb, 0.07], [1.07, 0x00ccaa, 0.03], [1.18, 0x005533, 0.015]];
  atmoLayers.forEach(function (cfg) {
    var m = new THREE.Mesh(
      new THREE.SphereGeometry(cfg[0], 32, 16),
      new THREE.MeshBasicMaterial({ color: cfg[1], transparent: true, opacity: cfg[2], side: THREE.BackSide })
    );
    earthGroup.add(m);
    if (cfg[0] === 1.03) atmosphereMesh = m;
  });
}

// ── Group rendering ───────────────────────────────────────────

function buildRenderObj(groupName, count) {
  var def = GROUP_DEFS[groupName];

  if (def.usePoints || count > 2000) {
    var posArr = new Float32Array(count * 3);
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    geo.setDrawRange(0, 0);
    var mat = new THREE.PointsMaterial({
      color: def.color, size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0.85,
    });
    var pts = new THREE.Points(geo, mat);
    pts.visible = def.visible;
    scene.add(pts);
    return { type: 'points', mesh: pts, posAttr: geo.getAttribute('position'), count: count };
  }

  var isStation = (groupName === 'stations');
  var sg = new THREE.SphereGeometry(def.sphereR || 0.008, isStation ? 8 : 5, isStation ? 6 : 4);
  var sm = new THREE.MeshBasicMaterial({ color: def.color });
  var im = new THREE.InstancedMesh(sg, sm, count);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.visible = def.visible;
  scene.add(im);
  return { type: 'instanced', mesh: im, count: count };
}

function updateGroupPos(groupName, simMs) {
  var g = satGroups[groupName];
  if (!g || !g.renderObj) return;
  var sats = g.satellites;
  var ro   = g.renderObj;

  if (ro.type === 'instanced') {
    for (var i = 0; i < sats.length; i++) {
      var p = satToThree(sats[i], simMs);
      _dummy.position.set(p.x, p.y, p.z);
      _dummy.updateMatrix();
      ro.mesh.setMatrixAt(i, _dummy.matrix);
    }
    ro.mesh.instanceMatrix.needsUpdate = true;
  } else {
    var pa = ro.posAttr;
    for (var j = 0; j < sats.length; j++) {
      var q = satToThree(sats[j], simMs);
      pa.setXYZ(j, q.x, q.y, q.z);
    }
    pa.needsUpdate = true;
    ro.mesh.geometry.setDrawRange(0, sats.length);
  }
}

// ── Orbit line helpers ────────────────────────────────────────

function makeOrbitLine(sat, color, opacity) {
  var pts = orbitPoints(sat, 256);
  if (!pts.length) return null;
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: opacity })
  );
}

function setSelectedSat(sat) {
  if (selectedOrbitLine) { scene.remove(selectedOrbitLine); selectedOrbitLine = null; }
  selectedSat = sat;
  if (!sat) {
    document.getElementById('panel-info').classList.add('hidden');
    highlightRow(-1);
    return;
  }
  if (showOrbits) {
    selectedOrbitLine = makeOrbitLine(sat, GROUP_DEFS[sat.groupName].color, 0.6);
    if (selectedOrbitLine) scene.add(selectedOrbitLine);
  }
  updateInfoPanel(sat);
  highlightRow(sat.noradId);
}

// ── Data fetching & population ────────────────────────────────

function populateGroup(groupName, rawArr) {
  var sats = rawArr.map(function (r) { return normalizeSat(r, groupName); });
  var ro   = buildRenderObj(groupName, sats.length);
  satGroups[groupName] = { satellites: sats, renderObj: ro };
  totalCount += sats.length;
  if (groupName === 'stations') {
    stationCount += sats.length;
    buildISSOrbit(sats);
  }
  rebuildTable();
  updateStats();
}

function buildISSOrbit(stations) {
  var iss = null;
  for (var i = 0; i < stations.length; i++) {
    if (stations[i].noradId === 25544 || stations[i].name.indexOf('ISS') !== -1) { iss = stations[i]; break; }
  }
  if (!iss && stations.length) iss = stations[0];
  if (!iss) return;
  if (issOrbitLine) scene.remove(issOrbitLine);
  issOrbitLine = makeOrbitLine(iss, 0xffffff, 0.12);
  if (issOrbitLine) scene.add(issOrbitLine);
}

function toggleGroup(groupName) {
  var def = GROUP_DEFS[groupName];
  if (def.loading) return;

  if (def.loaded) {
    def.visible = !def.visible;
    var g = satGroups[groupName];
    if (g && g.renderObj) g.renderObj.mesh.visible = def.visible;
    refreshGroupBtn(groupName);
    return;
  }

  def.loading = true;
  refreshGroupBtn(groupName);

  window.CelestrakApi.fetchGroup(groupName)
    .then(function (data) {
      def.loading = false;
      def.loaded  = true;
      def.visible = true;
      populateGroup(groupName, data);
      refreshGroupBtn(groupName);
    })
    .catch(function (err) {
      def.loading = false;
      console.error('[magi-sat] failed to load', groupName, err);
      refreshGroupBtn(groupName);
    });
}

// ── Animation loop ────────────────────────────────────────────

function getSimMs() {
  return simStartSim + (Date.now() - simStartReal) * timeMultiplier;
}

function getCameraZone() {
  var d = camera.position.length();
  if (d < ZONE_LEO) return 'LEO VIEW';
  if (d < ZONE_MEO) return 'MEO VIEW';
  if (d < ZONE_GEO) return 'GEO VIEW';
  return 'DEEP SPACE';
}

function animate() {
  requestAnimationFrame(animate);
  var dt  = clock.getDelta();
  controls.update();

  var now = Date.now();
  var interval = Math.max(50, 200 / Math.max(1, Math.sqrt(timeMultiplier)));
  if (now - lastPosUpdate > interval) {
    var simMs = getSimMs();
    Object.keys(satGroups).forEach(function (k) {
      if (GROUP_DEFS[k].visible) updateGroupPos(k, simMs);
    });
    lastPosUpdate = now;
  }

  if (earthGroup) {
    earthGroup.rotation.y += EARTH_ROT * dt * timeMultiplier;
  }

  updateHUD();
  renderer.render(scene, camera);
}

function updateHUD() {
  var el = document.getElementById('vp-clock');
  if (el) el.textContent = new Date().toUTCString().slice(17, 25) + ' UTC';
  var ze = document.getElementById('vp-zone');
  if (ze) ze.textContent = getCameraZone();
}

// ── UI updates ────────────────────────────────────────────────

function updateStats() {
  setTxt('stat-total',    totalCount);
  setTxt('stat-stations', stationCount);
  var loaded = Object.values(GROUP_DEFS).filter(function (d) { return d.loaded; }).length;
  setTxt('stat-groups', loaded + '/' + Object.keys(GROUP_DEFS).length);
}

function refreshGroupBtn(groupName) {
  var btn = document.querySelector('[data-group="' + groupName + '"]');
  if (!btn) return;
  var def = GROUP_DEFS[groupName];
  btn.classList.toggle('active',   def.loaded && def.visible);
  btn.classList.toggle('loading',  !!def.loading);
}

function updateInfoPanel(sat) {
  document.getElementById('panel-info').classList.remove('hidden');
  setTxt('info-name', sat.name);
  var rows = [
    ['NORAD ID',     sat.noradId],
    ['GROUP',        GROUP_DEFS[sat.groupName] ? GROUP_DEFS[sat.groupName].label : sat.groupName],
    ['EPOCH',        new Date(sat.epochMs).toUTCString().slice(0, 25)],
    ['MEAN ALT',     sat.meanAlt_km > 0 ? Math.round(sat.meanAlt_km) + ' km' : '—'],
    ['PERIOD',       sat.period_min > 0 ? sat.period_min.toFixed(1) + ' min' : '—'],
    ['INCLINATION',  sat.inclination.toFixed(2) + '°'],
    ['ECCENTRICITY', sat.eccentricity.toFixed(6)],
    ['RAAN',         sat.raan.toFixed(2) + '°'],
  ];
  var tbody = document.getElementById('info-tbody');
  if (tbody) tbody.innerHTML = rows.map(function (r) {
    return '<tr><th>' + esc(r[0]) + '</th><td>' + esc(String(r[1])) + '</td></tr>';
  }).join('');
  var link = document.getElementById('info-link');
  if (link) {
    link.href = 'https://www.n2yo.com/satellite/?s=' + sat.noradId;
    link.classList.remove('hidden');
  }
}

function setSelectedFeature(layerName, idx) {
  selectedFeature = (layerName && idx >= 0) ? { layerName: layerName, idx: idx } : null;
  if (!selectedFeature) {
    document.getElementById('panel-info').classList.add('hidden');
    return;
  }
  var f = LAYER_DEFS[layerName].features[idx];
  updateFeaturePanel(layerName, f);
}

function updateFeaturePanel(layerName, f) {
  document.getElementById('panel-info').classList.remove('hidden');
  var def = LAYER_DEFS[layerName];
  var displayName = f.name || f.cable_name || f.airport_name || f.plant_name ||
                    f.station_name || f.title || '—';
  setTxt('info-name', displayName);
  var rows = [['LAYER', def.label]];
  if (f.lat != null) rows.push(['LAT / LON', f.lat.toFixed(3) + '°  ' + f.lon.toFixed(3) + '°']);
  if (layerName === 'power_plants') {
    var fuel = f.primary_fuel || f.fuel_type || f.fuel;
    if (fuel) rows.push(['FUEL', fuel]);
    if (f.capacity_mw) rows.push(['CAPACITY', f.capacity_mw + ' MW']);
  }
  if (f.iata_code) rows.push(['IATA', f.iata_code]);
  if (f.country)   rows.push(['COUNTRY', f.country]);
  if (f.description && String(f.description).length < 120) rows.push(['INFO', f.description]);
  var tbody = document.getElementById('info-tbody');
  if (tbody) tbody.innerHTML = rows.map(function (r) {
    return '<tr><th>' + esc(r[0]) + '</th><td>' + esc(String(r[1])) + '</td></tr>';
  }).join('');
  var link = document.getElementById('info-link');
  if (link) link.classList.add('hidden');
}

function setTxt(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── Table ─────────────────────────────────────────────────────

function rebuildTable() {
  tableData = [];
  Object.keys(satGroups).forEach(function (k) {
    var g = satGroups[k];
    if (g && g.satellites) Array.prototype.push.apply(tableData, g.satellites);
  });
  renderTable();
}

function renderTable() {
  var tbody = document.getElementById('sat-tbody');
  if (!tbody) return;

  var q = tableFilter;
  var filtered = tableData.filter(function (s) {
    if (!q) return true;
    return s.name.toLowerCase().indexOf(q) !== -1 || String(s.noradId).indexOf(q) !== -1;
  });

  var sk = tableSortKey;
  filtered.sort(function (a, b) {
    var va = a[sk], vb = b[sk];
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return tableSortAsc ? -1 : 1;
    if (va > vb) return tableSortAsc ?  1 : -1;
    return 0;
  });

  var limit = Math.min(filtered.length, 300);
  var html = '';
  for (var i = 0; i < limit; i++) {
    var s   = filtered[i];
    var def = GROUP_DEFS[s.groupName] || {};
    var hex = def.color != null ? '#' + def.color.toString(16).padStart(6, '0') : '#ff6600';
    html +=
      '<tr data-norad="' + s.noradId + '" data-grp="' + esc(s.groupName) + '">' +
      '<td><span class="sat-dot" style="background:' + hex + '"></span>' + esc(s.name) + '</td>' +
      '<td>' + s.noradId + '</td>' +
      '<td>' + esc(s.groupLabel || s.groupName) + '</td>' +
      '<td>' + (s.meanAlt_km > 0 ? Math.round(s.meanAlt_km) : '—') + '</td>' +
      '<td>' + s.inclination.toFixed(1) + '</td>' +
      '<td>' + (s.period_min > 0 ? s.period_min.toFixed(1) : '—') + '</td>' +
      '</tr>';
  }

  tbody.innerHTML = html || '<tr><td colspan="6" class="empty-row">NO DATA</td></tr>';

  setTxt('table-count', filtered.length + ' / ' + tableData.length);

  // Row click events
  var rows = tbody.querySelectorAll('tr[data-norad]');
  for (var j = 0; j < rows.length; j++) {
    rows[j].addEventListener('click', onRowClick);
  }
}

function onRowClick(e) {
  var row   = e.currentTarget;
  var norad = parseInt(row.getAttribute('data-norad'), 10);
  var grp   = row.getAttribute('data-grp');
  var g     = satGroups[grp];
  if (!g) return;
  for (var i = 0; i < g.satellites.length; i++) {
    if (g.satellites[i].noradId === norad) { setSelectedSat(g.satellites[i]); return; }
  }
}

function highlightRow(noradId) {
  var rows = document.querySelectorAll('#sat-tbody tr[data-norad]');
  for (var i = 0; i < rows.length; i++) {
    rows[i].classList.toggle('selected', parseInt(rows[i].getAttribute('data-norad'), 10) === noradId);
  }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// ── Mouse / Raycasting ────────────────────────────────────────

function onCanvasClick(e) {
  var canvas = document.getElementById('gl-canvas');
  var rect   = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width)  *  2 - 1;
  mouse.y = ((e.clientY - rect.top)  / rect.height) * -2 + 1;
  raycaster.setFromCamera(mouse, camera);

  // Check satellite groups first
  var keys = Object.keys(satGroups);
  for (var i = 0; i < keys.length; i++) {
    var gn = keys[i];
    var g  = satGroups[gn];
    if (!g || !g.renderObj || !GROUP_DEFS[gn].visible) continue;
    var hits = raycaster.intersectObject(g.renderObj.mesh);
    if (hits.length) {
      var idx = hits[0].instanceId !== undefined ? hits[0].instanceId : hits[0].index;
      if (idx != null && g.satellites[idx]) {
        selectedFeature = null;
        setSelectedSat(g.satellites[idx]);
        return;
      }
    }
  }

  // Check infrastructure point layers
  var lkeys = Object.keys(layerGroups);
  for (var li = 0; li < lkeys.length; li++) {
    var ln  = lkeys[li];
    var def = LAYER_DEFS[ln];
    if (!def.visible || def.type !== 'point' || !def.renderObjs[0]) continue;
    var hits2 = raycaster.intersectObject(def.renderObjs[0]);
    if (hits2.length) {
      var ridx = hits2[0].instanceId;
      if (ridx != null) {
        selectedSat = null;
        if (selectedOrbitLine) { scene.remove(selectedOrbitLine); selectedOrbitLine = null; }
        setSelectedFeature(ln, ridx);
        return;
      }
    }
  }

  // Nothing hit
  setSelectedSat(null);
  setSelectedFeature(null, -1);
}

function onCanvasMouseMove(e) {
  var tooltip = document.getElementById('sat-tooltip');
  if (!tooltip) return;
  var canvas  = document.getElementById('gl-canvas');
  var rect    = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width)  *  2 - 1;
  mouse.y = ((e.clientY - rect.top)  / rect.height) * -2 + 1;
  raycaster.setFromCamera(mouse, camera);

  // Satellites
  var keys = Object.keys(satGroups);
  for (var i = 0; i < keys.length; i++) {
    var gn = keys[i];
    var g  = satGroups[gn];
    if (!g || !g.renderObj || !GROUP_DEFS[gn].visible) continue;
    var hits = raycaster.intersectObject(g.renderObj.mesh);
    if (hits.length) {
      var idx = hits[0].instanceId !== undefined ? hits[0].instanceId : hits[0].index;
      if (idx != null && g.satellites[idx]) {
        var s = g.satellites[idx];
        tooltip.textContent = s.name + ' (' + s.noradId + ')';
        tooltip.style.left = (e.clientX - rect.left + 12) + 'px';
        tooltip.style.top  = (e.clientY - rect.top  + 12) + 'px';
        tooltip.classList.remove('hidden');
        return;
      }
    }
  }

  // Infrastructure layers
  var lkeys = Object.keys(layerGroups);
  for (var li = 0; li < lkeys.length; li++) {
    var ln  = lkeys[li];
    var def = LAYER_DEFS[ln];
    if (!def.visible || def.type !== 'point' || !def.renderObjs[0]) continue;
    var hits2 = raycaster.intersectObject(def.renderObjs[0]);
    if (hits2.length) {
      var ridx = hits2[0].instanceId;
      if (ridx != null) {
        var f = def.features[ridx];
        var label = f.name || f.cable_name || f.airport_name || f.plant_name || def.label;
        tooltip.textContent = label;
        tooltip.style.left = (e.clientX - rect.left + 12) + 'px';
        tooltip.style.top  = (e.clientY - rect.top  + 12) + 'px';
        tooltip.classList.remove('hidden');
        return;
      }
    }
  }

  tooltip.classList.add('hidden');
}

// ── Events ────────────────────────────────────────────────────

function setupEvents() {
  var canvas = document.getElementById('gl-canvas');
  canvas.addEventListener('click',     onCanvasClick);
  canvas.addEventListener('mousemove', onCanvasMouseMove);
  canvas.addEventListener('mouseleave', function () {
    var t = document.getElementById('sat-tooltip');
    if (t) t.classList.add('hidden');
  });

  // Layer toggle buttons (infrastructure)
  document.querySelectorAll('[data-layer]').forEach(function (btn) {
    btn.addEventListener('click', function () { toggleLayer(this.getAttribute('data-layer')); });
  });

  // Group toggle buttons
  document.querySelectorAll('[data-group]').forEach(function (btn) {
    btn.addEventListener('click', function () { toggleGroup(this.getAttribute('data-group')); });
  });

  // Orbits toggle
  var btnO = document.getElementById('btn-orbits');
  if (btnO) btnO.addEventListener('click', function () {
    showOrbits = !showOrbits;
    this.textContent = 'SHOW ORBITS: ' + (showOrbits ? 'ON' : 'OFF');
    this.classList.toggle('active', showOrbits);
    if (issOrbitLine) issOrbitLine.visible = showOrbits;
    if (!showOrbits && selectedOrbitLine) { scene.remove(selectedOrbitLine); selectedOrbitLine = null; }
    else if (showOrbits && selectedSat) {
      selectedOrbitLine = makeOrbitLine(selectedSat, GROUP_DEFS[selectedSat.groupName].color, 0.6);
      if (selectedOrbitLine) scene.add(selectedOrbitLine);
    }
  });

  // Auto-rotate toggle
  var btnR = document.getElementById('btn-rotate');
  if (btnR) btnR.addEventListener('click', function () {
    autoRotate = !autoRotate;
    controls.autoRotate = autoRotate;
    this.textContent = 'AUTO-ROTATE: ' + (autoRotate ? 'ON' : 'OFF');
    this.classList.toggle('active', autoRotate);
  });

  // Time scale
  document.querySelectorAll('.ts-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.ts-btn').forEach(function (b) { b.classList.remove('active'); });
      this.classList.add('active');
      var curSim    = getSimMs();
      timeMultiplier = parseInt(this.getAttribute('data-mult'), 10) || 1;
      simStartReal  = Date.now();
      simStartSim   = curSim;
    });
  });

  // Table search
  var search = document.getElementById('sat-search');
  if (search) search.addEventListener('input', function () {
    tableFilter = this.value.toLowerCase();
    renderTable();
  });

  // Table sort
  document.querySelectorAll('th[data-sort]').forEach(function (th) {
    th.addEventListener('click', function () {
      var k = this.getAttribute('data-sort');
      if (tableSortKey === k) tableSortAsc = !tableSortAsc;
      else { tableSortKey = k; tableSortAsc = true; }
      renderTable();
    });
  });

  // Panel collapse
  document.querySelectorAll('.panel-header[data-toggle]').forEach(function (h) {
    h.addEventListener('click', function () {
      var p = this.closest('.magi-panel');
      if (p) p.classList.toggle('collapsed');
    });
  });

  // Resize
  window.addEventListener('resize', function () {
    var cv = document.getElementById('gl-canvas');
    renderer.setSize(cv.clientWidth, cv.clientHeight, false);
    camera.aspect = cv.clientWidth / cv.clientHeight;
    camera.updateProjectionMatrix();
  });
}

// ── Infrastructure layer rendering ────────────────────────────

function buildLayerRenderObjs(layerName, features) {
  var def = LAYER_DEFS[layerName];
  var grp = new THREE.Group();
  grp.visible = def.visible;
  earthGroup.add(grp);
  layerGroups[layerName] = grp;
  def.renderObjs = [];

  if (def.type === 'point') {
    var validFeatures = features.filter(function (f) {
      return f.lat != null && f.lon != null && isFinite(f.lat) && isFinite(f.lon);
    });
    if (!validFeatures.length) return;
    var sg = new THREE.SphereGeometry(def.r, 5, 4);
    var sm = new THREE.MeshBasicMaterial({ color: def.color });
    var im = new THREE.InstancedMesh(sg, sm, validFeatures.length);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    var needsColor = (layerName === 'power_plants');
    if (needsColor) {
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(validFeatures.length * 3), 3);
    }
    var col = new THREE.Color();
    validFeatures.forEach(function (f, i) {
      var pos = latLonTo3D(f.lat, f.lon, SURFACE_R);
      _dummy.position.copy(pos);
      _dummy.updateMatrix();
      im.setMatrixAt(i, _dummy.matrix);
      if (needsColor) {
        var fuel = f.primary_fuel || f.fuel_type || f.fuel || '';
        col.setHex(FUEL_COLORS[fuel] || def.color);
        im.setColorAt(i, col);
      }
    });
    im.instanceMatrix.needsUpdate = true;
    if (needsColor && im.instanceColor) im.instanceColor.needsUpdate = true;
    grp.add(im);
    def.renderObjs.push(im);
    // Store valid features back so raycaster indices stay in sync
    def.features = validFeatures;

  } else { // line or multiline
    features.forEach(function (f) {
      function makeLine(coords) {
        if (!coords || coords.length < 2) return;
        var pts = coords.map(function (c) { return latLonTo3D(c[1], c[0], SURFACE_R); });
        var line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: def.color, transparent: true, opacity: 0.7 })
        );
        grp.add(line);
        def.renderObjs.push(line);
      }
      if (f.coords)    makeLine(f.coords);
      if (f.segments)  f.segments.forEach(makeLine);
    });
  }
}

function toggleLayer(layerName) {
  var def = LAYER_DEFS[layerName];
  if (def.loading) return;

  if (def.loaded) {
    def.visible = !def.visible;
    if (layerGroups[layerName]) layerGroups[layerName].visible = def.visible;
    refreshLayerBtn(layerName);
    return;
  }

  def.loading = true;
  refreshLayerBtn(layerName);

  window.MonitoringApi.fetchLayer(layerName)
    .then(function (data) {
      def.loading  = false;
      def.loaded   = true;
      def.visible  = true;
      def.features = Array.isArray(data) ? data : [];
      buildLayerRenderObjs(layerName, def.features);
      refreshLayerBtn(layerName);
    })
    .catch(function (err) {
      def.loading = false;
      console.error('[magi-sat] layer load failed:', layerName, err);
      refreshLayerBtn(layerName);
    });
}

function refreshLayerBtn(layerName) {
  var btn = document.querySelector('[data-layer="' + layerName + '"]');
  if (!btn) return;
  var def = LAYER_DEFS[layerName];
  btn.classList.toggle('active',  def.loaded && def.visible);
  btn.classList.toggle('loading', !!def.loading);
}

// ── Loading sequence ──────────────────────────────────────────

var BOOT_MSGS = [
  'MAGI SYSTEM: INITIALIZING SCENE ENGINE...',
  'MAGI SYSTEM: ESTABLISHING CELESTRAK LINK...',
  'MAGI SYSTEM: DOWNLOADING ORBITAL ELEMENTS...',
  'MAGI SYSTEM: COMPUTING SATELLITE POSITIONS...',
  'MAGI SYSTEM: POPULATING ORBITAL GRID...',
  'MAGI SYSTEM: SURVEILLANCE SYSTEM ACTIVE',
];

function setLoading(pct, msgIdx) {
  var bar = document.getElementById('boot-bar');
  var msg = document.getElementById('boot-msg');
  var pEl = document.getElementById('boot-pct');
  if (bar) bar.style.width = pct + '%';
  if (pEl) pEl.textContent = pct + '%';
  if (msg && msgIdx < BOOT_MSGS.length) msg.textContent = BOOT_MSGS[msgIdx];
}

function hideLoading() {
  var el = document.getElementById('panel-loading');
  if (el) el.classList.add('hidden');
  var fs = document.getElementById('footer-status');
  if (fs) { fs.textContent = 'ONLINE'; fs.classList.remove('blink'); }
}

// ── Boot ──────────────────────────────────────────────────────

function boot() {
  simStartReal = Date.now();
  simStartSim  = Date.now();

  setLoading(5, 0);
  initScene();
  setupEvents();
  animate();

  setLoading(20, 1);

  var autoGroups = Object.keys(GROUP_DEFS).filter(function (k) { return GROUP_DEFS[k].autoLoad; });
  var idx = 0;

  function loadNext() {
    if (idx >= autoGroups.length) {
      setLoading(100, 5);
      setTimeout(hideLoading, 900);
      return;
    }
    var gname = autoGroups[idx];
    var pct = 30 + Math.round((idx / autoGroups.length) * 65);
    setLoading(pct, 2 + Math.min(idx, 2));

    window.CelestrakApi.fetchGroup(gname)
      .then(function (data) {
        GROUP_DEFS[gname].loaded  = true;
        GROUP_DEFS[gname].visible = true;
        populateGroup(gname, data);
        refreshGroupBtn(gname);
        idx++;
        setTimeout(loadNext, 100);
      })
      .catch(function (err) {
        console.error('[magi-sat] auto-load failed:', gname, err);
        idx++;
        setTimeout(loadNext, 100);
      });
  }

  setTimeout(loadNext, 350);
}

document.addEventListener('DOMContentLoaded', boot);
