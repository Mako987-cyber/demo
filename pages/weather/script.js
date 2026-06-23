document.getElementById('load').addEventListener('click', async () => {
  const city = document.getElementById('city').value || 'Milano';
  const outElement = document.getElementById('out');

  try {
    outElement.textContent = 'Caricamento...';
    const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
    const data = await res.json();

    // Estrai i dati principali
    const current = data.current_condition[0];
    const area = data.nearest_area[0];

    const cityName = area.areaName[0].value;
    const country = area.country[0].value;
    const region = area.region?.[0]?.value || '';
    const lat = area.latitude;
    const lon = area.longitude;

    const temp = current.temp_C;
    const feelsLike = current.FeelsLikeC;
    const humidity = current.humidity;
    const windSpeed = current.windspeedKmph;
    const windDir = current.winddir16Point;
    const weatherDesc = current.weatherDesc[0].value;
    const pressure = current.pressure;
    const visibility = current.visibility;
    const uvIndex = current.uvIndex;
    const cloudcover = current.cloudcover;

    // Mappa icone emoji per le condizioni meteo
    const weatherEmojis = {
      'Sunny': '☀️',
      'Clear': '🌙',
      'Partly Cloudy': '⛅',
      'Cloudy': '☁️',
      'Overcast': '☁️',
      'Mist': '🌫️',
      'Patchy rain nearby': '🌧️',
      'Patchy rain': '🌧️',
      'Light rain': '🌧️',
      'Moderate rain': '🌧️',
      'Heavy rain': '⛈️',
      'Patchy snow nearby': '❄️',
      'Light snow': '❄️',
      'Moderate snow': '❄️',
      'Heavy snow': '❄️',
      'Thunderstorm': '⛈️'
    };

    const emoji = Object.keys(weatherEmojis).find(key => weatherDesc.includes(key))
      ? weatherEmojis[Object.keys(weatherEmojis).find(key => weatherDesc.includes(key))]
      : '🌡️';

    // Crea HTML formattato
    const html = `
      <div class="weather-card">
        <div class="weather-header">
          <div class="weather-title">
            <h2>${cityName}</h2>
            <p>${region ? region + ', ' : ''}${country}</p>
            <p class="coordinates">📍 ${lat}° N, ${lon}° E</p>
          </div>
          <div class="weather-emoji">${emoji}</div>
        </div>

        <div class="weather-condition-main">
          <div class="condition-text">${weatherDesc}</div>
        </div>

        <div class="weather-grid">
          <div class="weather-item">
            <div class="weather-label">Temperatura</div>
            <div class="weather-value">${temp}°C</div>
          </div>
          <div class="weather-item">
            <div class="weather-label">Percepita</div>
            <div class="weather-value">${feelsLike}°C</div>
          </div>
          <div class="weather-item">
            <div class="weather-label">Umidità</div>
            <div class="weather-value">${humidity}%</div>
          </div>
          <div class="weather-item">
            <div class="weather-label">Vento</div>
            <div class="weather-value">${windSpeed} km/h</div>
          </div>
          <div class="weather-item">
            <div class="weather-label">Direzione</div>
            <div class="weather-value">${windDir}</div>
          </div>
          <div class="weather-item">
            <div class="weather-label">Pressione</div>
            <div class="weather-value">${pressure} mb</div>
          </div>
          <div class="weather-item">
            <div class="weather-label">Visibilità</div>
            <div class="weather-value">${visibility} km</div>
          </div>
          <div class="weather-item">
            <div class="weather-label">Indice UV</div>
            <div class="weather-value">${uvIndex}</div>
          </div>
          <div class="weather-item">
            <div class="weather-label">Nuvolosità</div>
            <div class="weather-value">${cloudcover}%</div>
          </div>
        </div>
      </div>
    `;

    outElement.innerHTML = html;
  } catch (error) {
    outElement.innerHTML = `<div style="color: red; padding: 1rem;"><strong>Errore:</strong> ${error.message}<br><br>Verifica il nome della città e riprova.</div>`;
  }
});

// Permetti di premere Enter
document.getElementById('city').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('load').click();
  }
});
