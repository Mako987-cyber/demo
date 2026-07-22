(function (global) {
  'use strict';

  function fetchLayer(layerName) {
    return global.ApiHttp.requestJson('/api/monitoring?layer=' + encodeURIComponent(layerName));
  }

  global.MonitoringApi = { fetchLayer: fetchLayer };
}(window));
