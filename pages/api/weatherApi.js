(function (global) {
  const GEO_API = 'https://geocoding-api.open-meteo.com/v1/search';
  const WEATHER_API = 'https://api.open-meteo.com/v1/forecast';

  async function geocodeCity(city) {
    const url = GEO_API + '?name=' + encodeURIComponent(city) + '&count=1&language=it';
    const data = await global.ApiHttp.requestJson(url, 'Errore nella geocodifica');

    if (!data.results || data.results.length === 0) {
      throw new Error('Città non trovata. Controlla il nome e riprova.');
    }

    return data.results[0];
  }

  async function fetchWeatherForecast(lat, lon) {
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,cloud_cover,uv_index',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,uv_index_max,precipitation_probability_max',
      hourly: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation_probability,precipitation',
      timezone: 'auto',
      forecast_days: 7
    });

    const url = WEATHER_API + '?' + params.toString();
    return global.ApiHttp.requestJson(url, 'Errore nel recupero dati meteo');
  }

  global.WeatherApi = {
    geocodeCity,
    fetchWeatherForecast
  };
})(window);
