const GEO_API = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_API = 'https://api.open-meteo.com/v1/forecast';

const WMO_CODES = {
  0: { desc: 'Sereno', icon: '\u2600\uFE0F' },
  1: { desc: 'Prevalentemente sereno', icon: '\uD83C\uDF24\uFE0F' },
  2: { desc: 'Parzialmente nuvoloso', icon: '\u26C5' },
  3: { desc: 'Coperto', icon: '\u2601\uFE0F' },
  45: { desc: 'Nebbia', icon: '\uD83C\uDF2B\uFE0F' },
  48: { desc: 'Nebbia con brina', icon: '\uD83C\uDF2B\uFE0F' },
  51: { desc: 'Pioviggine leggera', icon: '\uD83C\uDF26\uFE0F' },
  53: { desc: 'Pioviggine moderata', icon: '\uD83C\uDF26\uFE0F' },
  55: { desc: 'Pioviggine intensa', icon: '\uD83C\uDF27\uFE0F' },
  61: { desc: 'Pioggia leggera', icon: '\uD83C\uDF27\uFE0F' },
  63: { desc: 'Pioggia moderata', icon: '\uD83C\uDF27\uFE0F' },
  65: { desc: 'Pioggia intensa', icon: '\uD83C\uDF27\uFE0F' },
  66: { desc: 'Pioggia gelata leggera', icon: '\uD83C\uDF28\uFE0F' },
  67: { desc: 'Pioggia gelata intensa', icon: '\uD83C\uDF28\uFE0F' },
  71: { desc: 'Neve leggera', icon: '\uD83C\uDF28\uFE0F' },
  73: { desc: 'Neve moderata', icon: '\u2744\uFE0F' },
  75: { desc: 'Neve intensa', icon: '\u2744\uFE0F' },
  77: { desc: 'Granuli di neve', icon: '\u2744\uFE0F' },
  80: { desc: 'Rovesci leggeri', icon: '\uD83C\uDF26\uFE0F' },
  81: { desc: 'Rovesci moderati', icon: '\uD83C\uDF27\uFE0F' },
  82: { desc: 'Rovesci violenti', icon: '\u26C8\uFE0F' },
  85: { desc: 'Rovesci di neve leggeri', icon: '\uD83C\uDF28\uFE0F' },
  86: { desc: 'Rovesci di neve intensi', icon: '\u2744\uFE0F' },
  95: { desc: 'Temporale', icon: '\u26C8\uFE0F' },
  96: { desc: 'Temporale con grandine leggera', icon: '\u26C8\uFE0F' },
  99: { desc: 'Temporale con grandine forte', icon: '\u26C8\uFE0F' }
};

function getWeatherInfo(code) {
  return WMO_CODES[code] || { desc: 'Sconosciuto', icon: '\uD83C\uDF21\uFE0F' };
}

function getWindDirection(degrees) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  return dirs[Math.round(degrees / 45) % 8];
}

function getDayName(dateStr, index) {
  if (index === 0) return 'Oggi';
  if (index === 1) return 'Domani';
  const date = new Date(dateStr);
  return date.toLocaleDateString('it-IT', { weekday: 'short' }).replace('.', '');
}

async function geocodeCity(city) {
  const res = await fetch(`${GEO_API}?name=${encodeURIComponent(city)}&count=1&language=it`);
  if (!res.ok) throw new Error('Errore nella geocodifica');
  const data = await res.json();
  if (!data.results || data.results.length === 0) {
    throw new Error('Città non trovata. Controlla il nome e riprova.');
  }
  return data.results[0];
}

async function fetchWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,cloud_cover,uv_index',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,uv_index_max,precipitation_probability_max',
    timezone: 'auto'
  });
  const res = await fetch(`${WEATHER_API}?${params}`);
  if (!res.ok) throw new Error('Errore nel recupero dati meteo');
  return await res.json();
}

function renderCurrent(weather, location) {
  const c = weather.current;
  const info = getWeatherInfo(c.weather_code);
  const windDir = getWindDirection(c.wind_direction_10m);

  return `
    <div class="current-card">
      <div class="current-header">
        <div class="current-location">
          <h2>${location.name}</h2>
          <p>${[location.admin1, location.country].filter(Boolean).join(', ')}</p>
        </div>
        <div class="current-icon">${info.icon}</div>
      </div>

      <div class="current-main">
        <div class="current-temp">${Math.round(c.temperature_2m)}°C</div>
        <div class="current-details">
          <div class="current-condition">${info.desc}</div>
          <div class="current-feels">Percepita ${Math.round(c.apparent_temperature)}°C</div>
        </div>
      </div>

      <div class="current-grid">
        <div class="current-item">
          <div class="current-item-label">Umidità</div>
          <div class="current-item-value">${c.relative_humidity_2m}%</div>
        </div>
        <div class="current-item">
          <div class="current-item-label">Vento</div>
          <div class="current-item-value">${Math.round(c.wind_speed_10m)} km/h</div>
        </div>
        <div class="current-item">
          <div class="current-item-label">Direzione</div>
          <div class="current-item-value">${windDir}</div>
        </div>
        <div class="current-item">
          <div class="current-item-label">Pressione</div>
          <div class="current-item-value">${Math.round(c.pressure_msl)} hPa</div>
        </div>
        <div class="current-item">
          <div class="current-item-label">Nuvolosità</div>
          <div class="current-item-value">${c.cloud_cover}%</div>
        </div>
        <div class="current-item">
          <div class="current-item-label">Indice UV</div>
          <div class="current-item-value">${c.uv_index}</div>
        </div>
      </div>
    </div>
  `;
}

function renderForecast(weather) {
  const d = weather.daily;

  const cards = d.time.map((date, i) => {
    const info = getWeatherInfo(d.weather_code[i]);
    const day = getDayName(date, i);
    const precip = d.precipitation_sum[i];
    const precipProb = d.precipitation_probability_max ? d.precipitation_probability_max[i] : null;

    let precipHtml = '';
    if (precip > 0) {
      precipHtml = `<div class="forecast-detail forecast-precip">${precip.toFixed(1)} mm</div>`;
    } else if (precipProb !== null && precipProb > 0) {
      precipHtml = `<div class="forecast-detail forecast-precip">${precipProb}% pioggia</div>`;
    }

    return `
      <div class="forecast-card${i === 0 ? ' today' : ''}">
        <div class="forecast-day">${day}</div>
        <div class="forecast-icon">${info.icon}</div>
        <div class="forecast-temps">
          <span class="forecast-max">${Math.round(d.temperature_2m_max[i])}°</span>
          <span class="forecast-min">${Math.round(d.temperature_2m_min[i])}°</span>
        </div>
        <div class="forecast-detail">${info.desc}</div>
        ${precipHtml}
        <div class="forecast-detail">Vento max ${Math.round(d.wind_speed_10m_max[i])} km/h</div>
      </div>
    `;
  }).join('');

  return `
    <div class="forecast-section">
      <h2>Previsioni 7 Giorni</h2>
      <div class="forecast-grid">${cards}</div>
    </div>
  `;
}

async function search(city) {
  const output = document.getElementById('weather-output');
  output.innerHTML = '<div class="loading-state">Caricamento...</div>';

  try {
    const location = await geocodeCity(city);
    const weather = await fetchWeather(location.latitude, location.longitude);
    output.innerHTML = renderCurrent(weather, location) + renderForecast(weather);
  } catch (err) {
    output.innerHTML = `<div class="error-state">${err.message}</div>`;
  }
}

document.getElementById('load').addEventListener('click', () => {
  const city = document.getElementById('city').value.trim();
  if (city) search(city);
});

document.getElementById('city').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const city = document.getElementById('city').value.trim();
    if (city) search(city);
  }
});
