(function (global) {
  const JPL_CAD_URL  = 'https://ssd-api.jpl.nasa.gov/cad.api';

  async function fetchNeoFeed(startDate, endDate) {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate
    });
    const url = '/api/nasa-neo?' + params.toString();
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
