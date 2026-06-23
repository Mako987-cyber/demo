// Weather API Handler
const weatherApp = {
  elements: {
    cityInput: document.getElementById('cityInput'),
    searchBtn: document.getElementById('searchBtn'),
    errorDiv: document.getElementById('errorMessage'),
    loadingDiv: document.getElementById('loadingMessage'),
    resultDiv: document.getElementById('weatherResult')
  },

  init() {
    this.elements.searchBtn.addEventListener('click', () => this.search());
    this.elements.cityInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.search();
    });
  },

  search() {
    const city = this.elements.cityInput.value.trim();
    if (!city) return;

    this.clearMessages();
    this.elements.loadingDiv.innerHTML = '<div class="loading">Ricerca in corso...</div>';

    this.fetchWeather(city);
  },

  async fetchWeather(city) {
    try {
      // First, get coordinates using geocoding
      const geoResponse = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=it&format=json`
      );

      const geoData = await geoResponse.json();

      if (!geoData.results || geoData.results.length === 0) {
        this.elements.loadingDiv.innerHTML = '';
        this.elements.errorDiv.innerHTML =
          '<div class="error">⚠️ Città non trovata. Prova con un altro nome.</div>';
        return;
      }

      const location = geoData.results[0];
      const { latitude, longitude, name, country, admin1 } = location;

      // Then get weather data
      const weatherResponse = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m&timezone=auto`
      );

      const weatherData = await weatherResponse.json();

      this.elements.loadingDiv.innerHTML = '';
      this.displayWeather(weatherData, name, country, admin1, latitude, longitude);
    } catch (error) {
      this.elements.loadingDiv.innerHTML = '';
      this.elements.errorDiv.innerHTML =
        '<div class="error">❌ Errore nella ricerca. Riprova.</div>';
      console.error('Errore:', error);
    }
  },

  displayWeather(data, cityName, country, region, lat, lon) {
    try {
      const current = data.current;

      // Weather descriptions
      const weatherDescriptions = {
        0: '☀️ Sereno',
        1: '🌤️ Principalmente sereno',
        2: '⛅ Parzialmente nuvoloso',
        3: '☁️ Nuvoloso',
        45: '🌫️ Nebbia',
        48: '🌫️ Nebbia gelata',
        51: '🌧️ Pioggia leggera',
        53: '🌧️ Pioggia moderata',
        55: '⛈️ Pioggia forte',
        61: '🌧️ Pioggia',
        63: '🌧️ Pioggia moderata',
        65: '⛈️ Pioggia forte',
        71: '❄️ Neve leggera',
        73: '❄️ Neve moderata',
        75: '❄️ Neve forte',
        77: '❄️ Grani di neve',
        80: '🌧️ Pioggia leggera',
        81: '🌧️ Pioggia moderata',
        82: '⛈️ Pioggia forte',
        85: '❄️ Neve',
        86: '❄️ Neve forte',
        95: '⛈️ Temporale',
        96: '⛈️ Temporale con grandine',
        99: '⛈️ Temporale forte'
      };

      const weatherDesc = weatherDescriptions[current.weather_code] || '🌡️ Sconosciuto';
      const temp = current.temperature_2m;
      const humidity = current.relative_humidity_2m;
      const windSpeed = current.wind_speed_10m;
      const windDir = current.wind_direction_10m;

      this.elements.resultDiv.innerHTML = `
        <div class="weather-result reveal">
          <div class="weather-header">
            <div class="weather-city">
              <h2>${cityName}</h2>
              <p>${region ? region + ', ' : ''}${country}</p>
              <p style="font-size: 0.85rem; margin-top: 0.5rem;">Lat: ${lat.toFixed(2)}° | Lon: ${lon.toFixed(2)}°</p>
            </div>
            <div style="font-size: 3rem;">🌍</div>
          </div>

          <div class="weather-main">
            <div class="weather-stat">
              <div class="weather-stat-value">${temp}°C</div>
              <div class="weather-stat-label">Temperatura</div>
            </div>
            <div class="weather-stat">
              <div class="weather-stat-value">${humidity}%</div>
              <div class="weather-stat-label">Umidità</div>
            </div>
            <div class="weather-stat">
              <div class="weather-stat-value">${windSpeed}</div>
              <div class="weather-stat-label">Vento (km/h)</div>
            </div>
            <div class="weather-stat">
              <div class="weather-stat-value">${windDir}°</div>
              <div class="weather-stat-label">Direzione</div>
            </div>
          </div>

          <div class="weather-condition">
            <p><strong>Condizioni:</strong> ${weatherDesc}</p>
            <p style="margin-bottom: 0;"><strong>Ora UTC:</strong> ${new Date(current.time).toLocaleString('it-IT')}</p>
          </div>

          <div style="font-size: 0.85rem; color: var(--color-text-secondary); text-align: center; margin-top: 1rem;">
            Dati forniti da Open-Meteo · Aggiornamento in tempo reale
          </div>
        </div>
      `;
    } catch (error) {
      this.elements.errorDiv.innerHTML =
        '<div class="error">❌ Errore nell\'elaborazione dei dati.</div>';
      console.error('Errore:', error);
    }
  },

  clearMessages() {
    this.elements.errorDiv.innerHTML = '';
    this.elements.loadingDiv.innerHTML = '';
    this.elements.resultDiv.innerHTML = '';
  }
};

// Initialize the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => weatherApp.init());
} else {
  weatherApp.init();
}
