(function (global) {
  const API_BASE = 'https://api.coingecko.com/api/v3';

  async function fetchPrices(coinIds) {
    const ids = coinIds.join(',');
    const url = API_BASE + '/simple/price?ids=' + encodeURIComponent(ids) + '&vs_currencies=eur,usd&include_24hr_change=true';
    return global.ApiHttp.requestJson(url, 'Errore nel recupero prezzi crypto');
  }

  async function fetchHistory(coinId, vsCurrency, days) {
    const numDays = typeof days === 'number' ? days : 7;
    const url = API_BASE + '/coins/' + encodeURIComponent(coinId) + '/market_chart?vs_currency=' + encodeURIComponent(vsCurrency) + '&days=' + encodeURIComponent(numDays);
    return global.ApiHttp.requestJson(url, 'Errore nel recupero storico crypto');
  }

  global.CryptoApi = {
    fetchPrices,
    fetchHistory
  };
})(window);
