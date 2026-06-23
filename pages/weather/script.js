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

  fetchWeather(city) {
    fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`)
      .then(response => {
        console.log('Status:', response.status);
        if (!response.ok) {
          throw new Error('Città non trovata');
        }
        return response.json();
      })
      .then(data => {
        console.log('Data:', data);
        this.elements.loadingDiv.innerHTML = '';
        this.displayWeather(data);
      })
      .catch(error => {
        console.error('Errore:', error);
        this.elements.loadingDiv.innerHTML = '';
        this.elements.errorDiv.innerHTML =
          '<div class="error">⚠️ Città non trovata. Prova con un altro nome.</div>';
      });
  },

  displayWeather(data) {
    try {
      const current = data.current_condition[0];
      const area = data.nearest_area[0];

      const cityName = area.areaName[0].value;
      const country = area.country[0].value;
      const region = area.region?.[0]?.value || '';

      const temp = current.temp_C;
      const feelsLike = current.FeelsLikeC;
      const humidity = current.humidity;
      const windSpeed = current.windspeedKmph;
      const windDir = current.winddir16Point;
      const weatherDesc = current.weatherDesc[0].value;
      const pressure = current.pressure;
      const visibility = current.visibility;
      const uvIndex = current.uvIndex;

      this.elements.resultDiv.innerHTML = `
        <div class="weather-result reveal">
          <div class="weather-header">
            <div class="weather-city">
              <h2>${cityName}</h2>
              <p>${region ? region + ', ' : ''}${country}</p>
              <p style="font-size: 0.85rem; margin-top: 0.5rem;">Lat: ${area.latitude}° | Lon: ${area.longitude}°</p>
            </div>
            <div style="font-size: 3rem;">🌍</div>
          </div>

          <div class="weather-main">
            <div class="weather-stat">
              <div class="weather-stat-value">${temp}°C</div>
              <div class="weather-stat-label">Temperatura</div>
            </div>
            <div class="weather-stat">
              <div class="weather-stat-value">${feelsLike}°C</div>
              <div class="weather-stat-label">Percepita</div>
            </div>
            <div class="weather-stat">
              <div class="weather-stat-value">${humidity}%</div>
              <div class="weather-stat-label">Umidità</div>
            </div>
            <div class="weather-stat">
              <div class="weather-stat-value">${windSpeed}</div>
              <div class="weather-stat-label">Vento (km/h)</div>
            </div>
          </div>

          <div class="weather-condition">
            <p><strong>Condizioni:</strong> ${weatherDesc}</p>
            <p><strong>Direzione vento:</strong> ${windDir}</p>
            <p><strong>Pressione:</strong> ${pressure} mb</p>
            <p><strong>Visibilità:</strong> ${visibility} km</p>
            <p><strong>Indice UV:</strong> ${uvIndex}</p>
          </div>

          <div style="font-size: 0.85rem; color: var(--color-text-secondary); text-align: center; margin-top: 1rem;">
            Dati da wttr.in
          </div>
        </div>
      `;
    } catch (error) {
      console.error('Errore nel parsing:', error);
      this.elements.errorDiv.innerHTML =
        '<div class="error">❌ Errore nell\'elaborazione dei dati.</div>';
    }
  },

  clearMessages() {
    this.elements.errorDiv.innerHTML = '';
    this.elements.loadingDiv.innerHTML = '';
    this.elements.resultDiv.innerHTML = '';
  }
};

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => weatherApp.init());
} else {
  weatherApp.init();
}
