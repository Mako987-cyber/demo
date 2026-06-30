(function (global) {
  const API_BASE = 'https://api.frankfurter.dev/v1';

  async function fetchLatestRates(baseCurrency) {
    const url = API_BASE + '/latest?from=' + encodeURIComponent(baseCurrency);
    return global.ApiHttp.requestJson(url, 'Errore nel recupero dei tassi correnti');
  }

  async function fetchRatesByDate(baseCurrency, dateStr) {
    const url = API_BASE + '/' + dateStr + '?from=' + encodeURIComponent(baseCurrency);
    return global.ApiHttp.requestJson(url, 'Errore nel recupero dei tassi storici');
  }

  async function fetchHistory(from, to, start, end) {
    const url = API_BASE + '/' + start + '..' + end + '?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to);
    return global.ApiHttp.requestJson(url, 'Errore nel recupero dello storico valute');
  }

  async function convert(amount, from, to) {
    const url = API_BASE + '/latest?amount=' + encodeURIComponent(amount) + '&from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to);
    return global.ApiHttp.requestJson(url, 'Errore nella conversione valute');
  }

  global.CurrencyApi = {
    fetchLatestRates,
    fetchRatesByDate,
    fetchHistory,
    convert
  };
})(window);
