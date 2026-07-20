(function (global) {
  // __NASA_API_KEY__ is replaced at build time by build.sh via the Vercel env var DEMO_KEY.
  // Falls back to NASA's public DEMO_KEY (30 req/hour) if not injected (local dev).
  // NEVER commit a real API key here — the placeholder must remain in the repo.
  const NASA_API_KEY = '__NASA_API_KEY__' !== '__NASA_API_KEY__' ? '__NASA_API_KEY__' : 'DEMO_KEY';
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

  async function fetchJplCad(dateMin, dateMax, distMax) {
    const params = new URLSearchParams({
      'dist-max': distMax || '0.1',
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
    fetchJplCad
  };
})(window);
