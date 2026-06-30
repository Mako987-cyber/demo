(function (global) {
  const API_URL = 'https://naas.isalman.dev/no';

  async function fetchNoReason() {
    const data = await global.ApiHttp.requestJson(API_URL, 'Errore nel recupero del rifiuto');
    return data.reason;
  }

  global.NaasApi = {
    fetchNoReason
  };
})(window);
