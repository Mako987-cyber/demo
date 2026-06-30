(function (global) {
  const requestJson = async function requestJson(url, errorMessage) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(errorMessage || ('HTTP ' + response.status));
    }
    return response.json();
  };

  global.ApiHttp = {
    requestJson
  };
})(window);
