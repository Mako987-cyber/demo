(function (global) {
  const NASA_API_KEY = 'pi2UlqIi7tEEGb6NrRYhETFeRgKSY3pfMa0RzyZS';
  const NEO_FEED_URL = 'https://api.nasa.gov/neo/rest/v1/feed';

  async function fetchNeoFeed(startDate, endDate) {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      api_key: NASA_API_KEY
    });

    const url = NEO_FEED_URL + '?' + params.toString();
    const data = await global.ApiHttp.requestJson(url, 'Errore nel recupero dati NEO da NASA');
    return data;
  }

  global.NasaApi = {
    fetchNeoFeed
  };
})(window);
