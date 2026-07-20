(function (global) {
  const NASA_API_KEY = 'pi2UlqIi7tEEGb6NrRYhETFeRgKSY3pfMa0RzyZS';
  const NEO_FEED_URL = 'https://api.nasa.gov/neo/rest/v1/feed';
  const JPL_CAD_URL  = 'https://ssd-api.jpl.nasa.gov/cad.api';

  async function fetchNeoFeed(startDate, endDate) {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      api_key: NASA_API_KEY
    });
    const url = NEO_FEED_URL + '?' + params.toString();
    return global.ApiHttp.requestJson(url, 'Errore nel recupero dati NEO da NASA');
  }

  async function fetchJplCad(dateMin, dateMax) {
    const params = new URLSearchParams({
      'dist-max': '0.1',
      'date-min': dateMin,
      'date-max': dateMax,
      sort: 'dist',
      body: 'Earth',
      fullname: 'true',
      diameter: 'true'
    });
    const url = JPL_CAD_URL + '?' + params.toString();
    return global.ApiHttp.requestJson(url, 'Errore nel recupero dati JPL CAD');
  }

  global.NasaApi = {
    fetchNeoFeed,
    fetchJplCad,
    NASA_API_KEY
  };
})(window);
