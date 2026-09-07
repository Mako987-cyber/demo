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
│   ├── tokens.css           ← All CSS custom properties (design tokens + compat aliases)
│   ├── base.css             ← CSS reset + global element defaults
│   ├── components.css       ← Reusable UI components (buttons, cards, nav, rack, reveal)
│   ├── layout.css           ← Grid/layout structures (hero, service grid, contact, footer)
│   └── hero-fx.css          ← Hero scene: cable/cloud SVG decoration behind the headline
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
│   ├── orbit/               ← Orbital Tracker — site theme, cobe globe (CelesTrak + Supabase)
│   ├── naas/                ← No-as-a-Service joke tool
│   └── space-invaders/      ← Retro Canvas 2D game (site palette)
│
├── assets/
│   ├── logo.svg             ← Logo mark (graphite + fiber orange)
│   ├── logo-mark.svg        ← Mark only
│   ├── logo-lockup.svg      ← Mark + wordmark, light theme
│   ├── logo-lockup-dark.svg ← Mark + wordmark, dark theme
│   ├── favicon.svg          ← SVG favicon (+ favicon.ico, apple-touch-icon.png at root/assets)
│   ├── textures/            ← Earth/globe textures for Three.js scenes
│   └── vendor/
│       ├── three.min.js     ← Three.js r128 (bundled locally, no CDN)
│       ├── OrbitControls.js ← Three.js OrbitControls addon
│       ├── cobe.esm.js      ← cobe 2.0.1 WebGL globe (ESM, MIT) — used by orbit/
│       └── cobe.LICENSE     ← cobe MIT license text
│
├── logo-explore/            ← Logo exploration workspace (SVG variants + Python build scripts)
│   ├── build/               ← build_logo.py, build_raster.py — regenerate SVG/PNG artifacts
│   ├── variants.js          ← Variant definitions
│   └── preview.html         ← Side-by-side variant preview
│
├── data/
│   ├── processed/           ← airports.csv, landing-points.csv, submarine-cables.csv
    └── raw/                 ← Source GeoJSON/CSV (global-power-plants, cables, landing-points)
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML5, CSS3, JavaScript ES6+ (no transpiling) |
| 3D Rendering | Three.js r128 (UMD global from `assets/vendor/`) + OrbitControls |
| Charts | Custom Canvas 2D API (hand-rolled line + candlestick, no Chart.js/D3) |
| Fonts | Archivo (variable, `wdth` axis) + IBM Plex Mono via Google Fonts (main); Share Tech Mono + Rajdhani via Google Fonts (MAGI pages) |
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
| CelesTrak NORAD GP data | `magi-sat/`, `orbit/` | Proxied via `/api/celestrak` (CORS + caching) |
| Supabase PostgREST | `magi-sat/`, `orbit/` | Requires `STORAGE_SUPABASE_URL` + `STORAGE_SUPABASE_SERVICE_ROLE_KEY` env vars (server-side only) |
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
    ├── → pages/orbit/
    ├── → pages/naas/
    └── → pages/space-invaders/
```

**Script load order per page** (all `defer`):
1. `../../scripts/main.js` — shared UI bootstrap
2. `../api/http.js` — base HTTP utility
3. `../api/<specificApi>.js` — feature API module
4. `./script.js` — page logic

> **Exception:** MAGI pages (`magi-neo/`, `magi-sat/`) do **not** use the shared `styles/` system — they have self-contained `style.css` files and load Three.js from `../../assets/vendor/three.min.js`.
>
> **Exception:** `orbit/` keeps the shared styles but loads its page logic as `<script type="module">` (after the deferred classic scripts, so `window.CelestrakApi` and `window.MonitoringApi` are already there). It is the only ES module page: cobe ships as ESM.

---

## CSS Architecture

The shared stylesheet is split into 4 layers (all linked in `<head>`, except MAGI pages):

### `tokens.css` — Design Tokens
All values as CSS custom properties on `:root` / `[data-theme="light"]`, overridden for `[data-theme="dark"]`. Art direction: **"Anodized"** — flat printed surfaces, cold zinc/graphite neutrals, fiber-optic orange as the single accent, green reserved for *state* (verified/positive) rather than decoration.

- **Fonts:** `--font-display` / `--font-body: 'Archivo'` (same family, two widths via `font-stretch`: `--width-display: 118%`, `--width-body: 100%`), `--font-mono: 'IBM Plex Mono'`
- **Type scale:** `--text-xs` through `--text-3xl` using `clamp()` for fluid sizing
- **Spacing:** `--space-1` (0.25rem) → `--space-24` (6rem)
- **Radii:** deliberately near-square — `--radius-sm: 0.125rem` → `--radius-xl: 0.3125rem`, plus `--radius-full: 9999px`
- **Other:** `--shadow-sm/md/lg`, `--content-default: 1180px`, `--transition-interactive: 160ms cubic-bezier(0.2, 0, 0, 1)`
- **Compat aliases:** the six shared mini-apps still reference the old `--glass-*` / `--data-*` / `--color-primary*` names; these are remapped onto the flat tokens at the bottom of `tokens.css`, and `--glass-filter: none` kills every `backdrop-filter` at once. Full hex values in [Color Palette](#color-palette) below.

### `base.css` — Reset & Globals
Universal box-sizing, smooth scroll, body font/color defaults, `:focus-visible` outline, `.skip-link`, `.sr-only`, `prefers-reduced-motion` disables all animations.

### `components.css` — UI Components
`.container`, `.site-header` (sticky, solid — no blur anywhere in the system), `.navbar`, `.brand` (`.brand__mark`, `.brand__text`, `.brand__tagline`), `.icon-button`, `.section` (`--hero`, `--tight`, `--bordered`), `.eyebrow` (mono label), `.btn` / `.btn--primary` / `.btn--secondary` / `.btn--nav` (46px min-height, `--radius-sm`), `.rack` + `.rack-unit` (the signature rack-elevation element, U42→U01), `.info-card`, `.metric-card`, `.proof-strip` / `.proof-item`, `.cta-band`, `.contact-link`, `.status`, `.unit-kit`, `.code-card` (traffic lights), `.tag`, `.back-link`, `.reveal` → `.is-visible` (IntersectionObserver).

### `layout.css` — Grid Structures
`.page-hero` / `.hero__content` / `.hero__lead` / `.hero__qualifier`, `.service-layout` (`repeat(3, 1fr)`, `--pairs` variant at `repeat(2, 1fr)`), `.card-grid--split` (`repeat(3, 1fr)`), `.profile-grid` (`0.85fr 1.15fr`), `.contact-layout` (`0.9fr 1.1fr`), `.metric-grid` (`repeat(3, 1fr)`), `.featured-panel`, `.definition-list`, `.feature-list`, `.tag-row`, `.button-row`, `.site-footer` / `.footer__inner`. All collapse to `1fr` at ≤1024px.

### `hero-fx.css` — Hero Scene
Decorative SVG band behind the homepage headline: six structured-cabling runs into a double cloud silhouette. Neutral steel tints (`#3e5a6b`, `#7f97a8`) so it never competes with the accent. Fully suppressed under `prefers-reduced-motion`.

---

## Color Palette

Source of truth: [`styles/tokens.css`](styles/tokens.css). Dark is the default theme; light is a cold zinc, deliberately not cream.

### Core tokens

| Token | Light (`:root`, `[data-theme="light"]`) | Dark (`[data-theme="dark"]`) | Role |
|---|---|---|---|
| `--color-bg` | `#e6e9eb` | `#101418` | Page ground (cold zinc / cold graphite) |
| `--color-surface` | `#f2f4f5` | `#161b20` | Default panel |
| `--color-surface-2` | `#ffffff` | `#1c2228` | Raised panel |
| `--color-surface-offset` | `#dae0e3` | `#222930` | Recessed / striped surface |
| `--color-border` | `#cdd4d9` | `#272e35` | Panel border |
| `--color-divider` | `#dbe1e4` | `#1f262c` | Hairline rule |
| `--color-rail` | `#b9c2c8` | `#2b333a` | Rack rail / structural line |
| `--color-text` | `#12171b` | `#e6eaec` | Body text |
| `--color-text-muted` | `#4a555d` | `#9aa5ad` | Secondary text |
| `--color-text-faint` | `#58636a` | `#78838b` | Tertiary / metadata |
| `--color-text-inverse` | `#ffffff` | `#101418` | Text on filled accent |

### Accent — fiber orange

The accent is the OM multimode patch-cord orange. It is *not* the same hex in both themes: `#ff7a1a` only hits 2.1:1 on zinc, so the light theme uses a burnt variant that carries 4.9:1 on the background and 6.1:1 knocked out inside a filled CTA. Dark-theme `#ff7a1a` reaches 7.0:1, so it is usable as text and not just as fill.

| Token | Light | Dark |
|---|---|---|
| `--color-accent` | `#a84200` | `#ff7a1a` |
| `--color-accent-hover` | `#8e3800` | `#ff9042` |
| `--color-accent-wash` | `rgba(168, 66, 0, 0.09)` | `rgba(255, 122, 26, 0.12)` |
| `--color-accent-line` | `rgba(168, 66, 0, 0.28)` | `rgba(255, 122, 26, 0.34)` |

### Status colors

Non-negotiable rule of the system: **color means state, never ornament.** An element with no state to report stays achromatic.

| Token | Light | Dark | Meaning |
|---|---|---|---|
| `--color-verified` | `#0f7a4e` | `#3fd68c` | Verified / confirmed |
| `--color-positive` | `#0f7a4e` | `#3fd68c` | Gain, up |
| `--color-negative` | `#a82a19` | `#ff8f7a` | Loss, down, alert |
| `--color-info` | `#1d4ed8` | `#79b8ff` | Informational |

### Shadows

| Token | Light | Dark |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(18, 23, 27, 0.06)` | `0 1px 2px rgba(0, 0, 0, 0.4)` |
| `--shadow-md` | `0 2px 8px rgba(18, 23, 27, 0.08)` | `0 2px 8px rgba(0, 0, 0, 0.45)` |
| `--shadow-lg` | `0 8px 24px rgba(18, 23, 27, 0.12)` | `0 8px 24px rgba(0, 0, 0, 0.55)` |

### Inverse HUD (`neo/`)

Panels floating over a WebGL canvas whose background is deep space in *both* themes, so they stay dark in light mode. Theme-independent values:

| Token | Value |
|---|---|
| `--glass-inverse-bg` | `rgba(10, 14, 18, 0.86)` |
| `--glass-inverse-bg-strong` | `rgba(6, 9, 12, 0.94)` |
| `--glass-inverse-border` | `rgba(255, 122, 26, 0.22)` |
| `--glass-inverse-border-hover` | `rgba(255, 122, 26, 0.55)` |
| `--glass-inverse-text` | `#d2d8db` |
| `--glass-inverse-text-bright` | `#ffb27a` |
| `--glass-inverse-text-dim` | `rgba(210, 216, 219, 0.62)` |
| `--glass-inverse-accent` | `#ff7a1a` |
| `--glass-inverse-hazard` | `#ff4d2e` |

### Brand assets

| Asset | Colors |
|---|---|
| `assets/logo.svg`, `logo-mark.svg`, `favicon.svg` | `#101418` (graphite) + `#ff7a1a` (fiber orange) |
| `assets/logo-lockup.svg` | `#101418` + `#ff7a1a` |
| `assets/logo-lockup-dark.svg` | `#e6eaec` (wordmark) + `#ff7a1a` on `#101418` |

---

## Page-Specific Palettes

### Charts (`crypto/`, `currency/`)

`getChartPalette()` in both `script.js` files, aligned to `--color-positive` / `--color-negative`:

| Element | Dark | Light |
|---|---|---|
| Line | `#2ecc8f` | `#05704a` |
| Candle up | `#3fce90` | `#05704a` |
| Candle down | `#ff8f7a` | `#a82a19` |
| Grid | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.06)` |
| Axis text | `rgba(255,255,255,0.62)` | `rgba(0,0,0,0.58)` |
| Area fill (top stop) | `rgba(46,204,143,0.22)` | `rgba(5,112,74,0.12)` |

### `orbit/` — satellite groups

Mid-luminosity tints, given as `[dark, light]` pairs and swapped on `data-theme`:

| Group | Dark | Light |
|---|---|---|
| Space stations | `#fb923c` | `#c2410c` |
| GPS | `#34d399` | `#047857` |
| 100 brightest | `#fbbf24` | `#a16207` |
| Starlink | `#38bdf8` | `#0369a1` |
| GLONASS | `#c4b5fd` | `#6d28d9` |
| Galileo | `#60a5fa` | `#1d4ed8` |
| Military | `#f87171` | `#b91c1c` |
| Weather | `#22d3ee` | `#0e7490` |
| Last 30 days | `#f472b6` | `#be185d` |

### `orbit/` — infrastructure layers

| Layer | Dark | Light |
|---|---|---|
| Submarine cables | `#60a5fa` | `#1d4ed8` |
| Cable landings | `#38bdf8` | `#0369a1` |
| Chokepoints | `#fb7185` | `#be123c` |
| Airports | `#fbbf24` | `#a16207` |
| Power plants | `#34d399` | `#047857` |

Power plants recolor by fuel (`FUEL_COLORS`, single series, theme-independent): Solar `#facc15`, Wind `#5eead4`, Hydro `#38bdf8`, Nuclear `#f87171`, Gas `#fb923c`, Coal `#94a3b8`, Oil `#a16207`, Biomass `#4ade80`, Geothermal `#fb7185`, Waste `#a8a29e`.

### `orbit/` — cobe globe

Normalized RGB, tuned to the site accent (anodized-steel sphere, fiber-orange markers):

| Channel | Dark | Light |
|---|---|---|
| `baseColor` | `[0.22, 0.27, 0.31]` | `[0.66, 0.70, 0.73]` |
| `glowColor` | `[0.13, 0.08, 0.04]` | `[0.90, 0.92, 0.93]` |
| `markerColor` | `[1.00, 0.48, 0.10]` (`#ff7a1a`) | `[0.66, 0.26, 0.00]` (`#a84200`) |
| `dark` / `diffuse` / `mapBrightness` | `1` / `1.3` / `7` | `0` / `1.4` / `5` |

### `space-invaders/`

Ship `#5ee7a8`, enemies `#e8746b`, bullets `#e8c15e`, enemy-hit flash `#ffd9d4`, field `#0b0f14`.

### `neo/` — WebGL scene

Canvas background `#020508`; Earth material tints `#1060a0` / `#0b2e5c`, landmass `#3d7a43`, cloud `#cce4f5`, moon `#b0c8b0`. Overlay panels use the inverse-HUD tokens above.

### `hero-fx.css`

Steel decoration tints: `#3e5a6b`, `#7f97a8`.

### MAGI pages — self-contained, outside the token system

`magi-neo/` and `magi-sat/` keep the NERV/MAGI amber CRT identity and do **not** read `styles/tokens.css`.

| Token | `magi-neo/` | `magi-sat/` |
|---|---|---|
| `--c-bg` | `#080402` | `#060301` |
| `--c-bg-deep` / `--c-bg2` | `#050301` | `#0a0402` |
| `--c-orange` | `#ff6600` | `#ff6600` |
| `--c-amber` | `#ffaa00` | `#ffaa00` |
| `--c-bright` | `#ffcc44` | `#ffcc44` |
| `--c-red` | `#ff2200` | `#ff2200` |
| `--c-safe` | `#44ff88` | `#44ff88` |
| `--c-text` | `#ff9933` | `#ff9933` |
| `--c-text-dim` / `--c-text2` | `#996633` | `#cc6600` |
| `--c-dim` | `#5a3010` | — |
| `--c-border` | `rgba(255,102,0,0.45)` | `rgba(255,102,0,0.4)` |
| `--c-border-hi` / `--c-border2` | `rgba(255,170,0,0.8)` | `rgba(255,102,0,0.15)` |
| panel background | `rgba(10, 5, 2, 0.94)` | `rgba(8, 4, 1, 0.94)` |

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

### `orbit/`
Real-time orbital tracker on the shared `styles/` system — the site-themed counterpart of `magi-sat/`. The planet is rendered by **cobe** (`assets/vendor/cobe.esm.js`, MIT); satellites, orbit traces and infrastructure layers are drawn on a 2D overlay canvas that replicates cobe's projection: orthographic sphere of radius `0.8`, same `phi`/`theta` rotation matrix and `scale` factor. Two reference frames share one camera angle — satellites are inertial (ECI, `phi = view`), geography rotates with the Earth (`phi = view + GMST`, which is also the `phi` handed to cobe), so the map turns under fixed orbits. Keplerian math ported from `magi-sat/`: `solveKepler(M, e)`, `satPosition(sat, timeMs, out, i)` (ECI→cobe axes: `x=ECI.x, y=ECI.z, z=-ECI.y`), `orbitPath(sat, steps)`, plus `gmst(ms)`. Same nine CelesTrak groups (`GROUPS`) and five Supabase layers (`LAYERS`, `FUEL_COLORS`) as `magi-sat/`. Colors are `[dark, light]` pairs swapped on `data-theme`, globe parameters included. Picking is a linear scan over the positions projected in the current frame, using cobe's own behind-the-sphere test; propagation is throttled while projection runs every frame. Time multiplier 1×/10×/100×/1000×, LEO/MEO/GEO framing presets, drag to rotate, wheel/pinch to zoom. Italian UI.

### `naas/`
"No-as-a-Service" — single button, fetches a random refusal reason, CSS shake animation, in-memory history (last 10 entries).

### `space-invaders/`
Canvas 2D retro game, re-tinted to the site palette: mint ship `#5ee7a8`, clay enemies `#e8746b`, amber bullets `#e8c15e` on a `#0b0f14` field, soft glow via `ctx.shadowBlur`. `gameState` object with `init()`, `start()`, `togglePause()`, `loop()`. 3×6 enemy grid, direction reversal + descent at walls, 2% random enemy shot chance per frame. Controls: Arrow/WASD + Space to shoot + P to pause. 800×600 canvas.

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
9. **MAGI isolation** — `magi-neo/` and `magi-sat/` have no dependency on `styles/*.css`. Editing those files does not affect MAGI pages and vice versa. `orbit/` is the opposite case: it covers the same data as `magi-sat/` while living entirely inside the shared token system.
10. **Scroll reveal** — `.reveal` class gets `.is-visible` once via `IntersectionObserver`. Fully disabled by `prefers-reduced-motion`.