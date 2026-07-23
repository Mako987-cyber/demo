# Demo — Personal Web Application

Personal multi-purpose web application by **Aniello Mollo**, Cloud Engineer based in Monza, Italy. Serves two purposes under one roof:

1. **Professional portfolio** — Cloud Engineering services (Azure, Microsoft 365, Intune, Entra ID, Terraform, PowerShell).
2. **Interactive projects showcase** — API dashboards, 3D WebGL visualizations, retro game.

Deployed on **Vercel**. Written entirely in **vanilla HTML/CSS/JavaScript** — no frontend framework, no build toolchain.

---

## Project Structure

```
/
├── index.html               ← Root entry point: binary choice (Portfolio / Progetti)
├── vercel.json              ← Deployment config (cleanUrls, headers, serverless discovery)
│
├── scripts/
│   └── main.js              ← Shared UI: theme toggle, mobile nav, sticky header, scroll reveal
│
├── styles/
│   ├── tokens.css           ← All CSS custom properties (design tokens)
│   ├── base.css             ← CSS reset + global element defaults
│   ├── components.css       ← Reusable UI components (buttons, cards, nav, reveal animation)
│   └── layout.css           ← Grid/layout structures (hero, service grid, contact, etc.)
│
├── api/                     ← Vercel serverless Node.js proxy functions
│   ├── celestrak.js         ← Proxies CelesTrak NORAD TLE data (allowlist-validated GROUP param)
│   ├── monitoring.js        ← Proxies Supabase infrastructure layer data (WKB geometry parser)
│   └── nasa-neo.js          ← Proxies NASA NeoWs near-Earth object feed
│
├── pages/
│   ├── projects.html        ← Projects gallery/index
│   │
│   ├── api/                 ← Client-side API modules (IIFE globals, loaded via <script defer>)
│   │   ├── http.js          ← ApiHttp.requestJson(url, errorMessage) — base fetch wrapper
│   │   ├── celestrakApi.js  ← CelestrakApi.fetchGroup(groupName)
│   │   ├── cryptoApi.js     ← CryptoApi.fetchPrices / fetchHistory / fetchCandles
│   │   ├── currencyApi.js   ← CurrencyApi.fetchLatestRates / fetchHistory / convert
│   │   ├── monitoringApi.js ← MonitoringApi.fetchLayer(layerName)
│   │   ├── naasApi.js       ← NaasApi.fetchNoReason()
│   │   ├── nasaApi.js       ← NasaApi.fetchNeoFeed / fetchJplCad
│   │   └── weatherApi.js    ← WeatherApi.geocodeCity / fetchWeatherForecast
│   │
│   ├── portfolio/           ← Professional portfolio section
│   │   ├── home.html        ← Hero, metric grid, info cards, featured sectors panel
│   │   ├── services.html    ← Six service panels (M365, Entra ID, Intune, PowerShell, Azure, Hybrid IT)
│   │   ├── profile.html     ← Bio, skill cards, full work history
│   │   └── contact.html     ← Contact links (email placeholder, LinkedIn, GitHub, location)
│   │
│   ├── weather/             ← Weather forecast tool (Open-Meteo)
│   ├── crypto/              ← Cryptocurrency price dashboard (CoinGecko + Binance)
│   ├── currency/            ← Forex rate dashboard (Frankfurter.dev)
│   ├── neo/                 ← NEO Tracker 3D — teal theme (NASA + JPL)
│   ├── magi-neo/            ← NEO Tracker 3D — Evangelion NERV/MAGI theme
│   ├── magi-sat/            ← Satellite Orbital Tracker — NERV theme (CelesTrak + Supabase)
│   ├── naas/                ← No-as-a-Service joke tool
│   └── space-invaders/      ← Retro Canvas 2D game (vaporwave aesthetic)
│
├── assets/
│   ├── textures/            ← Earth/globe textures for Three.js scenes
│   └── vendor/
│       ├── three.min.js     ← Three.js r128 (bundled locally, no CDN)
│       └── OrbitControls.js ← Three.js OrbitControls addon
│
├── data/
│   ├── processed/           ← airports.csv, landing-points.csv, submarine-cables.csv
│   └── raw/                 ← Source GeoJSON/CSV (global-power-plants, cables, landing-points)
│
└── js/                      ← Empty (reserved)
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML5, CSS3, JavaScript ES6+ (no transpiling) |
| 3D Rendering | Three.js r128 (UMD global from `assets/vendor/`) + OrbitControls |
| Charts | Custom Canvas 2D API (hand-rolled line + candlestick, no Chart.js/D3) |
| Fonts | Cabinet Grotesk + General Sans via Fontshare (main); Share Tech Mono + Rajdhani via Google Fonts (MAGI pages) |
| Deployment | Vercel (static hosting + serverless functions) |
| Backend | Vercel Serverless Functions — Node.js ESM (`export default handler`) |
| Database | Supabase PostgREST (`monitoring` schema) for infrastructure overlay data |

---

## External APIs

| API | Used By | Notes |
|---|---|---|
| Open-Meteo geocoding + forecast | `weather/` | No auth required |
| CoinGecko `/simple/price` + `/market_chart` | `crypto/` | No auth required |
| Binance `/api/v3/klines` | `crypto/` | Candlestick data, no auth |
| Frankfurter.dev `/v1/*` | `currency/` | No auth required |
| NASA NeoWs `/neo/rest/v1/feed` | `neo/`, `magi-neo/` | Requires `NASA_API_KEY` env var (server-side only) |
| JPL SSD Close Approach API | `neo/`, `magi-neo/` | Direct from client, no auth |
| CelesTrak NORAD GP data | `magi-sat/` | Proxied via `/api/celestrak` (CORS + caching) |
| Supabase PostgREST | `magi-sat/` | Requires `STORAGE_SUPABASE_URL` + `STORAGE_SUPABASE_SERVICE_ROLE_KEY` env vars (server-side only) |
| naas.isalman.dev/no | `naas/` | No auth required |

---

## Routing & Navigation

No client-side router. Navigation is plain `<a href>` links between HTML files. Vercel's `cleanUrls: true` strips `.html` extensions from URLs.

```
index.html
├── → pages/portfolio/home.html  (→ services, profile, contact)
└── → pages/projects.html
    ├── → pages/weather/
    ├── → pages/crypto/
    ├── → pages/currency/
    ├── → pages/neo/
    ├── → pages/magi-neo/
    ├── → pages/magi-sat/
    ├── → pages/naas/
    └── → pages/space-invaders/
```

**Script load order per page** (all `defer`):
1. `../../scripts/main.js` — shared UI bootstrap
2. `../api/http.js` — base HTTP utility
3. `../api/<specificApi>.js` — feature API module
4. `./script.js` — page logic

> **Exception:** MAGI pages (`magi-neo/`, `magi-sat/`) do **not** use the shared `styles/` system — they have self-contained `style.css` files and load Three.js from `../../assets/vendor/three.min.js`.

---

## CSS Architecture

The shared stylesheet is split into 4 layers (all linked in `<head>`, except MAGI pages):

### `tokens.css` — Design Tokens
All values as CSS custom properties on `:root`, overridden for `[data-theme="dark"]`.

- **Fonts:** `--font-display: 'Cabinet Grotesk'`, `--font-body: 'General Sans'`
- **Type scale:** `--text-xs` through `--text-3xl` using `clamp()` for fluid sizing
- **Spacing:** `--space-1` (0.25rem) → `--space-24` (6rem)
- **Light palette:** `--color-bg: #f7f6f2`, `--color-primary: #0a6b74`, `--color-text: #22282a`
- **Dark palette:** `--color-bg: #121516`, `--color-primary: #63aab3`
- **Other:** `--radius-*`, `--shadow-*`, `--content-default: 1180px`, `--transition-interactive: 180ms cubic-bezier(0.16, 1, 0.3, 1)`

### `base.css` — Reset & Globals
Universal box-sizing, smooth scroll, body font/color defaults, `:focus-visible` outline, `.skip-link`, `.sr-only`, `prefers-reduced-motion` disables all animations.

### `components.css` — UI Components
`.container`, `.site-header` (sticky + `backdrop-filter: blur`), `.navbar`, `.brand`, `.icon-button`, `.section`, `.eyebrow` (pill label), `.btn` / `.btn--primary` / `.btn--secondary` (pill, 48px min-height), card variants (`.hero-card`, `.info-card`, `.service-panel`, `.profile-card`, `.contact-panel`, `.metric-card`), `.code-card` (macOS traffic lights), `.tag`, `.reveal` → `.is-visible` (IntersectionObserver).

### `layout.css` — Grid Structures
`.hero__grid` (`1.08fr 0.92fr`), `.service-layout` (`repeat(3, 1fr)`), `.profile-grid` (`0.82fr 1.18fr`), `.contact-layout`, `.metric-grid`, etc. All collapse to `1fr` at ≤1024px; `.btn` goes full-width at ≤760px.

---

## Shared `scripts/main.js` Behavior

Single IIFE that runs on every page (except MAGI):

- **Theme:** reads `prefers-color-scheme`, sets `data-theme` on `<html>`. Toggle button swaps `'dark'`/`'light'` and re-renders SVG icon (sun/moon).
- **Mobile nav:** `[data-nav-toggle]` toggles `is-open` on `[data-nav-menu]` + updates `aria-expanded`. Nav links close the menu on click.
- **Sticky header:** adds `.is-scrolled` to `[data-header]` when `scrollY > 12`.
- **Scroll reveal:** `IntersectionObserver` (threshold 0.12) adds `.is-visible` to `.reveal` elements once when entering viewport.

---

## Client-Side API Modules (`pages/api/`)

All modules use the **IIFE global pattern**: `(function(global){ ... })(window)`. They attach objects to `window`. No ES modules. Load order matters — `http.js` must precede all others.

### `http.js`
`ApiHttp.requestJson(url, errorMessage)` — wraps `fetch()`, throws on non-OK status.

### `weatherApi.js`
- `WeatherApi.geocodeCity(city)` → `GET https://geocoding-api.open-meteo.com/v1/search?name=<city>&count=1&language=it`
- `WeatherApi.fetchWeatherForecast(lat, lon)` → `GET https://api.open-meteo.com/v1/forecast` with `current`, `daily`, `hourly`, `forecast_days=7`, `timezone=auto`

### `cryptoApi.js`
- `CryptoApi.fetchPrices(coinIds)` → `GET https://api.coingecko.com/api/v3/simple/price?ids=<ids>&vs_currencies=eur,usd&include_24hr_change=true`
- `CryptoApi.fetchHistory(coinId, vsCurrency, days)` → CoinGecko `/coins/<id>/market_chart`
- `CryptoApi.fetchCandles(symbol, interval, limit)` → `GET https://api4.binance.com/api/v3/klines` (max 1000)

### `currencyApi.js`
Base URL: `https://api.frankfurter.dev/v1`
- `fetchLatestRates(base)` → `/latest?from=<base>`
- `fetchRatesByDate(base, dateStr)` → `/<YYYY-MM-DD>?from=<base>`
- `fetchHistory(from, to, start, end)` → `/<start>..<end>?from=<f>&to=<t>`
- `convert(amount, from, to)` → `/latest?amount=<n>&from=<f>&to=<t>`

### `nasaApi.js`
- `NasaApi.fetchNeoFeed(startDate, endDate)` → `/api/nasa-neo?start_date=<s>&end_date=<e>` (Vercel proxy)
- `NasaApi.fetchJplCad(dateMin, dateMax, distMax)` → direct `GET https://ssd-api.jpl.nasa.gov/cad.api` (no auth)

### `celestrakApi.js`
- `CelestrakApi.fetchGroup(groupName)` → `/api/celestrak?GROUP=<name>` (Vercel proxy)

### `monitoringApi.js`
- `MonitoringApi.fetchLayer(layerName)` → `/api/monitoring?layer=<name>` (Vercel proxy)

### `naasApi.js`
- `NaasApi.fetchNoReason()` → `GET https://naas.isalman.dev/no` → returns `data.reason`

---

## Serverless API Proxies (`api/`)

### `celestrak.js`
- Validates `GROUP` param against an allowlist (~40 group names: `stations`, `starlink`, `gps-ops`, `iridium-NEXT`, debris groups, etc.)
- Proxies to `https://celestrak.org/NORAD/elements/gp.php?GROUP=<g>&FORMAT=json`
- `Cache-Control: s-maxage=300, stale-while-revalidate=600`

### `nasa-neo.js`
- Requires `start_date` and `end_date` params
- Reads `NASA_API_KEY` from env (never exposed to client)
- Proxies to `https://api.nasa.gov/neo/rest/v1/feed`
- Passes upstream HTTP status code through

### `monitoring.js`
- Validates `layer` against allowlist: `chokepoints`, `landing_points`, `airports`, `power_plants`, `submarine_cables`
- Reads `STORAGE_SUPABASE_URL` + `STORAGE_SUPABASE_SERVICE_ROLE_KEY` from env
- Queries Supabase PostgREST: `GET /rest/v1/<layer>?select=*&limit=<300|1000>` with `Accept-Profile: monitoring`
- Includes hand-rolled WKB binary parser (`parseWKB()`) for PostGIS geometry: Point → `{lat, lon}`, LineString → `{coords}`, MultiLineString → `{segments}`
- `Cache-Control: s-maxage=600, stale-while-revalidate=3600`

---

## Page Features

### `weather/`
City search → geocode (Open-Meteo) → 7-day forecast. Displays: current conditions (temp, apparent temp, humidity, wind speed+direction, pressure, cloud cover, UV index), 7-day forecast cards (clickable for hourly drill-down), hourly detail table. WMO weather codes decoded to Italian descriptions + emoji via `WMO_CODES` map.

### `crypto/`
Real-time prices for BTC, ETH, SOL, XRP, ADA in EUR/USD. 24h change badges. Tabbed weekly history with custom Canvas chart (line or candlestick). Timeframes: 7d/1m/3m/6m. Currency converter. Candle data from Binance (fallback to synthetic from CoinGecko). State: `{ prices, vsCurrency, activeCoin, historyCache, candleCache, chartType, timeframeDays }`.

### `currency/`
EUR, USD, GBP, JPY rate cards vs USD. Previous-day comparison for % change (weekend-aware). Canvas line/candlestick chart for pairs: EUR/USD, GBP/USD, USD/JPY, EUR/GBP. Timeframes: 7d/1m/3m/6m. Currency converter with swap button.

### `neo/` and `magi-neo/`
Functionally identical NEO Tracker 3D. Three.js WebGL scene: animated Earth with texture, orbiting Moon, 7000-star background + Milky Way band, 1 Lunar Distance ring. NEOs as sized spheres (diameter-scaled), colored by hazard status. Overlay panels: date range + dist-max controls (0.01/0.05/0.10 AU), stats bar, click info panel, hover tooltip, legend. Searchable/sortable NEO data table below.

`magi-neo/` adds: NERV/MAGI theme (amber/CRT scanlines), MELCHIOR-1/BALTHASAR-2/CASPAR-3 indicators, real-time UTC clock, Japanese labels, HUD corners, MAGI boot sequence loading messages (`MAGI_MSGS` array).

### `magi-sat/`
Real-time satellite orbital tracker. Full Keplerian mechanics: `solveKepler(M, e)` (Newton-Raphson, 50 iter), `satToThree(sat, timeMs)` (ECI→Three.js: `x=ECI.x, y=ECI.z, z=-ECI.y`), `orbitPoints(sat, steps)`. Groups configured in `GROUP_DEFS`: Space Stations, GPS, Visual/Brightest, Starlink (`InstancedMesh`), GLONASS, Galileo, Military, Weather, Recent Launches. Infrastructure layers via `LAYER_DEFS` from Supabase: chokepoints, cable landings, airports, power plants (`FUEL_COLORS` map), submarine cables. Time multiplier: 1×/10×/100×/1000×. Camera altitude zones: LEO/MEO/GEO. Satellite click → detail panel. Sortable/filterable table below.

### `naas/`
"No-as-a-Service" — single button, fetches a random refusal reason, CSS shake animation, in-memory history (last 10 entries).

### `space-invaders/`
Canvas 2D retro game. Vaporwave: teal ship `#3be9ff`, pink enemies `#ff4fcf`, orange bullets `#ffb36b`, neon glow via `ctx.shadowBlur`. `gameState` object with `init()`, `start()`, `togglePause()`, `loop()`. 3×6 enemy grid, direction reversal + descent at walls, 2% random enemy shot chance per frame. Controls: Arrow/WASD + Space to shoot + P to pause. 800×600 canvas.

---

## Deployment

### `vercel.json`
```json
{
  "outputDirectory": ".",
  "cleanUrls": true,
  "trailingSlash": true,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "SAMEORIGIN" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ]
}
```

- No build step — `outputDirectory: "."` serves the workspace root directly
- Serverless functions auto-discovered from `api/` directory

### Required Environment Variables (Vercel dashboard — never commit to repo)
| Variable | Used By |
|---|---|
| `NASA_API_KEY` | `api/nasa-neo.js` |
| `STORAGE_SUPABASE_URL` | `api/monitoring.js` |
| `STORAGE_SUPABASE_SERVICE_ROLE_KEY` | `api/monitoring.js` |

---

## Key Conventions

1. **IIFE global pattern** — all `pages/api/*.js` attach to `window`. No ES modules, no bundler.
2. **Serverless proxy pattern** — secrets (NASA, Supabase) are kept server-side in `api/`. Clients call `/api/*` endpoints only.
3. **Input validation via allowlists** — `celestrak.js` and `monitoring.js` validate all user-supplied params before forwarding requests.
4. **Theme via `data-theme` attribute** — CSS custom properties switch with `[data-theme="dark"]` on `<html>`. MAGI pages opt out entirely.
5. **Custom Canvas charts** — line and candlestick charts drawn manually with Canvas 2D API. DPR-aware scaling (`devicePixelRatio`). `getChartPalette()` returns theme-aware colors.
6. **No build toolchain** — zero `package.json`, no bundler, no transpiler. Vendor JS pre-bundled in `assets/vendor/`.
7. **Language** — UI text is in Italian (`lang="it"`). MAGI pages are in English with Japanese secondary labels.
8. **Script load order matters** — `main.js` → `http.js` → feature API module → page `script.js`, always `defer`.
9. **MAGI isolation** — `magi-neo/` and `magi-sat/` have no dependency on `styles/*.css`. Editing those files does not affect MAGI pages and vice versa.
10. **Scroll reveal** — `.reveal` class gets `.is-visible` once via `IntersectionObserver`. Fully disabled by `prefers-reduced-motion`.