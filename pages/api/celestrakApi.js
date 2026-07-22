(function (global) {
  'use strict';

  function fetchGroup(groupName) {
    return global.ApiHttp.requestJson('/api/celestrak?GROUP=' + encodeURIComponent(groupName));
  }

  global.CelestrakApi = { fetchGroup: fetchGroup };
}(window));
