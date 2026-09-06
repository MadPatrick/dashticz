/* global  Dashticz language settings _CORS_PATH Domoticz*/
var DT_trafficinfo = {
  name: 'trafficinfo',
  canHandle: function (block) {
    return block && (block.trafficJams || block.roadWorks || block.radars);
  },
  defaultCfg: function (block) {
    if (block && block.refresh && parseFloat(block.refresh) < 60)
      block.refresh = 60;
    var noTraffic = language.misc.no_traffic || 'No traffic announcements';
    var showempty = block && block.showemptyroads ? false : noTraffic;
    // Same pattern as js/components/map.js's own Domoticz-location default:
    // a block-level latitude/longitude override takes precedence, otherwise
    // fall back to Domoticz's own configured system location.
    var domoticzLocation =
      (Domoticz.getAllDevices()['_settings'] || {}).Location || {};
    return {
      icon: 'fas fa-car',
      containerClass: 'trafficinforow',
      refresh: 300,
      url: 'https://www.anwb.nl/verkeer',
      newwindow: 1,
      clickHandler: true,
      // RWS (Rijkswaterstaat) needs no API key and is always reachable, so
      // it's the default; ANWB is kept for existing configs/API keys, and
      // custom lets a user point at their own JSON endpoint (see
      // docs/blocks/specials/trafficinfo.rst for the expected format).
      provider: settings.traffic_provider || 'rws',
      apikey: settings.anwb_apikey || '',
      customUrl: settings.traffic_custom_url || '',
      // Distance filtering (RWS, and custom items that provide lat/lon):
      // unset maxDistance means "show everything", matching the old
      // behaviour. latitude/longitude default to Domoticz's own location so
      // most users need only set maxDistance.
      maxDistance: block && block.maxDistance,
      latitude:
        block && typeof block.latitude !== 'undefined'
          ? parseFloat(block.latitude)
          : parseFloat(domoticzLocation.Latitude),
      longitude:
        block && typeof block.longitude !== 'undefined'
          ? parseFloat(block.longitude)
          : parseFloat(domoticzLocation.Longitude),
      results: 50,
      showempty: showempty,
      showemptyroads: false,
      trafficJams: true,
      roadWorks: true,
      radars: true,
      width: 4,
      height: 260,
    };
  },
  defaultContent: language.misc.loading,
  refresh: function (me) {
    var provider = me.block.provider || 'rws';
    if (provider === 'anwb') {
      _refreshANWB(me);
    } else if (provider === 'custom') {
      _refreshCustom(me);
    } else {
      _refreshRWS(me);
    }
  },
};

function _refreshANWB(me) {
  if (!me.block.apikey) {
    me.$mountPoint
      .find('.dt_state')
      .text(
        language.misc.traffic_api_missing || 'ANWB API key is not configured.'
      );
    return;
  }
  var dataURL =
    _CORS_PATH +
    'https://api.anwb.nl/v2/incidents?apikey=' +
    encodeURIComponent(me.block.apikey);

  $.getJSON(dataURL, function (data) {
    var result = _buildANWBDataPart(me, data);
    _renderTrafficInfo(me, result.dataPart, result.noData);
  });
}

function _refreshRWS(me) {
  var dataURL = _CORS_PATH + 'https://api.rwsverkeersinfo.nl/api/traffic/';

  $.getJSON(dataURL, function (data) {
    var result = _buildRWSDataPart(me, data);
    _renderTrafficInfo(me, result.dataPart, result.noData);
  });
}

function _refreshCustom(me) {
  if (!me.block.customUrl) {
    me.$mountPoint
      .find('.dt_state')
      .text(
        language.misc.traffic_custom_url_missing ||
          'Custom traffic URL is not configured.'
      );
    return;
  }
  var dataURL = _CORS_PATH + me.block.customUrl;

  $.getJSON(dataURL, function (data) {
    var result = _buildCustomDataPart(me, data);
    _renderTrafficInfo(me, result.dataPart, result.noData);
  });
}

// Pre-seeds dataPart with an empty-road placeholder (showemptyroads) for
// every configured road, and returns the parsed/sorted road filter list -
// shared by all three providers since road filtering/showemptyroads is
// provider-agnostic.
function _seedEmptyRoads(trafficobject) {
  var dataPart = {};
  var roadArray = [];
  if (typeof trafficobject.road != 'undefined') {
    if (trafficobject.road.indexOf(',')) {
      roadArray = trafficobject.road.split(/, |,/);
    } else {
      roadArray.push(trafficobject.road);
    }
    roadArray.sort();
    if (trafficobject.showemptyroads) {
      var showempty =
        typeof trafficobject.showemptyroads === 'string'
          ? trafficobject.showemptyroads
          : language.misc.no_traffic || 'No traffic announcements';
      for (var x = 0; x < roadArray.length; x++) {
        var key = roadArray[x];
        var html =
          '<div><b class="title">' +
          key +
          '</b><br>' +
          showempty +
          '<br></div>';
        dataPart[key] = [html];
      }
    }
  }
  return { dataPart: dataPart, roadArray: roadArray };
}

function _buildANWBDataPart(me, data) {
  var trafficobject = me.block;
  var seed = _seedEmptyRoads(trafficobject);
  var dataPart = seed.dataPart;
  var roadArray = seed.roadArray;
  var i = 0;
  var key;
  var noData = true;
  for (var d in data) {
    if (d == 'roads') {
      for (var t in data[d]) {
        var roadId = data[d][t]['road'];
        key = roadId;
        if (
          typeof trafficobject.road == 'undefined' ||
          roadArray.indexOf(roadId) > -1
        ) {
          var segments = data[d][t]['segments'];
          var header = '';
          i = 0;
          for (var segment in segments) {
            for (var seg in segments[segment]) {
              if (
                (trafficobject.trafficJams && seg == 'jams') ||
                (trafficobject.roadWorks && seg == 'roadworks') ||
                (trafficobject.radars && seg == 'radars')
              ) {
                for (var s in segments[segment][seg]) {
                  if (
                    (typeof trafficobject.segStart == 'undefined' ||
                      (typeof trafficobject.segStart != 'undefined' &&
                        segments[segment]['start'] ==
                          trafficobject.segStart)) &&
                    (typeof trafficobject.segEnd == 'undefined' ||
                      (typeof trafficobject.segEnd != 'undefined' &&
                        segments[segment]['end'] == trafficobject.segEnd))
                  ) {
                    if (typeof dataPart[key] == 'undefined') {
                      dataPart[key] = [];
                    }
                    if (key != header) {
                      dataPart[key][i] =
                        '<div><b class="title">' + roadId + '</b><br>';
                      header = key;
                    } else {
                      dataPart[key][i] = '<div>';
                    }
                    if (segments[segment][seg][s]['from'] != null) {
                      dataPart[key][i] +=
                        '<b>' + segments[segment][seg][s]['from'] + '</b>';
                    }
                    if (
                      segments[segment][seg][s]['to'] != null &&
                      segments[segment][seg][s]['to'] !=
                        segments[segment][seg][s]['from']
                    ) {
                      dataPart[key][i] +=
                        '<b> - ' + segments[segment][seg][s]['to'] + '</b>';
                    }
                    if (
                      segments[segment][seg][s]['from'] != null ||
                      segments[segment][seg][s]['to'] != null
                    ) {
                      dataPart[key][i] += '<br>';
                    }
                    if (segments[segment][seg][s]['delay'] != null) {
                      var delay = segments[segment][seg][s]['delay'] / 60;
                      dataPart[key][i] += '+ ' + Math.round(delay) + 'min';
                    }
                    if (segments[segment][seg][s]['distance'] != null) {
                      var distance =
                        segments[segment][seg][s]['distance'] / 1000;
                      dataPart[key][i] += ' - ' + distance.toFixed(1) + 'km';
                    }
                    if (
                      segments[segment][seg][s]['delay'] != null ||
                      segments[segment][seg][s]['distance'] != null
                    ) {
                      dataPart[key][i] += '<br>';
                    }

                    if (
                      seg == 'jams' &&
                      segments[segment][seg][s]['reason'] == null
                    ) {
                      if (
                        segments[segment][seg][s]['events'][0]['text'] != null
                      ) {
                        dataPart[key][i] +=
                          segments[segment][seg][s]['events'][0]['text'] +
                          '<br>';
                      }
                    } else if (seg == 'radars') {
                      dataPart[key][i] +=
                        segments[segment][seg][s]['events'][0]['text'] +
                        '. ' +
                        segments[segment][seg][s]['reason'] +
                        '<br>';
                    } else if (segments[segment][seg][s]['reason'] != null) {
                      dataPart[key][i] +=
                        segments[segment][seg][s]['reason'] + '<br>';
                    }
                    dataPart[key][i] += '</div>';
                    if (dataPart[key][i] !== '<div></div>') {
                      i++;
                      noData = false;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  return { dataPart: dataPart, noData: noData };
}

// Whether maxDistance filtering is actually configured and usable (a
// reference latitude/longitude - block-level or Domoticz's own - and a
// numeric maxDistance).
function _hasDistanceFilter(trafficobject) {
  return (
    typeof trafficobject.maxDistance !== 'undefined' &&
    trafficobject.maxDistance !== '' &&
    !isNaN(parseFloat(trafficobject.maxDistance)) &&
    !isNaN(trafficobject.latitude) &&
    !isNaN(trafficobject.longitude)
  );
}

// Haversine distance in km between two lat/lon points.
function _distanceKm(lat1, lon1, lat2, lon2) {
  var R = 6371;
  var dLat = ((lat2 - lat1) * Math.PI) / 180;
  var dLon = ((lon2 - lon1) * Math.PI) / 180;
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// An item whose distance can't be determined (no maxDistance/location
// configured, or no coordinates for this item) is always kept - the point
// of this filter is trimming a too-long list, not risking an empty one.
function _isWithinDistance(trafficobject, lat, lon) {
  if (!_hasDistanceFilter(trafficobject) || isNaN(lat) || isNaN(lon)) {
    return true;
  }
  return (
    _distanceKm(trafficobject.latitude, trafficobject.longitude, lat, lon) <=
    parseFloat(trafficobject.maxDistance)
  );
}

// RWS obstruction coordinates. The API's exact field for this isn't fully
// confirmed against live data yet, so several common shapes are tried
// defensively; none matching just means this item can't be distance
// filtered (see _isWithinDistance's fail-open behaviour above).
function _rwsCoords(o) {
  if (o.lat != null && (o.lon != null || o.lng != null)) {
    return {
      lat: parseFloat(o.lat),
      lon: parseFloat(o.lon != null ? o.lon : o.lng),
    };
  }
  if (o.latitude != null && o.longitude != null) {
    return { lat: parseFloat(o.latitude), lon: parseFloat(o.longitude) };
  }
  if (o.location && o.location.lat != null) {
    var lon = o.location.lon != null ? o.location.lon : o.location.lng;
    return { lat: parseFloat(o.location.lat), lon: parseFloat(lon) };
  }
  if (
    o.geometry &&
    Array.isArray(o.geometry.coordinates) &&
    o.geometry.coordinates.length >= 2
  ) {
    return {
      lat: parseFloat(o.geometry.coordinates[1]),
      lon: parseFloat(o.geometry.coordinates[0]),
    };
  }
  return null;
}

// Rijkswaterstaat's public traffic API (no API key). Response shape:
// { obstructions: [{ obstructionType, roadNumber, directionText, cause,
//   title, delay, length, timeStart, timeEnd }, ...] }
// obstructionType 1 = roadworks, 4 = jam. There is no speed-camera/radar
// category in this API, so the radars toggle has no effect for this
// provider.
function _buildRWSDataPart(me, data) {
  var trafficobject = me.block;
  var seed = _seedEmptyRoads(trafficobject);
  var dataPart = seed.dataPart;
  var roadArray = seed.roadArray;
  var noData = true;
  var obstructions = (data && data.obstructions) || [];
  var header = {};
  for (var idx = 0; idx < obstructions.length; idx++) {
    var o = obstructions[idx] || {};
    var isJam = String(o.obstructionType) === '4';
    var isRoadwork = String(o.obstructionType) === '1';
    if (!(
      (trafficobject.trafficJams && isJam) ||
      (trafficobject.roadWorks && isRoadwork)
    )) {
      continue;
    }
    var roadId = o.roadNumber;
    if (
      typeof trafficobject.road != 'undefined' &&
      roadArray.indexOf(roadId) === -1
    ) {
      continue;
    }
    var coords = _rwsCoords(o);
    if (coords && !_isWithinDistance(trafficobject, coords.lat, coords.lon)) {
      continue;
    }
    if (typeof dataPart[roadId] == 'undefined') dataPart[roadId] = [];
    var html;
    if (!header[roadId]) {
      html = '<div><b class="title">' + (roadId || '') + '</b><br>';
      header[roadId] = true;
    } else {
      html = '<div>';
    }
    var direction = String(o.directionText || '')
      .split(/\s*-\s*/)
      .filter(Boolean);
    if (direction[0]) html += '<b>' + direction[0] + '</b>';
    if (direction[1] && direction[1] !== direction[0]) {
      html += '<b> - ' + direction[1] + '</b>';
    }
    if (direction.length) html += '<br>';
    if (isJam && o.delay != null) {
      html += '+ ' + Math.round(o.delay) + 'min';
    }
    if (o.length != null) {
      html +=
        (isJam && o.delay != null ? ' - ' : '') +
        (o.length / 1000).toFixed(1) +
        'km';
    }
    if ((isJam && o.delay != null) || o.length != null) html += '<br>';
    var reason = o.cause || o.title;
    if (reason) html += reason + '<br>';
    html += '</div>';
    dataPart[roadId].push(html);
    noData = false;
  }
  return { dataPart: dataPart, noData: noData };
}

// A custom endpoint (block.customUrl) must return a JSON array of items:
// [{ road: 'A27', type: 'jam', from: 'Utrecht', to: 'Hooipolder',
//    delay: 12, distance: 3.4, reason: 'Ongeval', lat: 52.09, lon: 5.12 },
//    ...]
// type is one of 'jam', 'roadworks' or 'radar'. delay is in minutes,
// distance in km. lat/lon are optional - only items that provide them can
// be filtered by maxDistance. See docs/blocks/specials/trafficinfo.rst.
function _buildCustomDataPart(me, data) {
  var trafficobject = me.block;
  var seed = _seedEmptyRoads(trafficobject);
  var dataPart = seed.dataPart;
  var roadArray = seed.roadArray;
  var noData = true;
  var items = Array.isArray(data) ? data : [];
  var header = {};
  for (var idx = 0; idx < items.length; idx++) {
    var item = items[idx] || {};
    if (!(
      (trafficobject.trafficJams && item.type === 'jam') ||
      (trafficobject.roadWorks && item.type === 'roadworks') ||
      (trafficobject.radars && item.type === 'radar')
    )) {
      continue;
    }
    var roadId = item.road;
    if (
      typeof trafficobject.road != 'undefined' &&
      roadArray.indexOf(roadId) === -1
    ) {
      continue;
    }
    if (
      item.lat != null &&
      item.lon != null &&
      !_isWithinDistance(
        trafficobject,
        parseFloat(item.lat),
        parseFloat(item.lon)
      )
    ) {
      continue;
    }
    if (typeof dataPart[roadId] == 'undefined') dataPart[roadId] = [];
    var html;
    if (!header[roadId]) {
      html = '<div><b class="title">' + (roadId || '') + '</b><br>';
      header[roadId] = true;
    } else {
      html = '<div>';
    }
    if (item.from) html += '<b>' + item.from + '</b>';
    if (item.to && item.to !== item.from) html += '<b> - ' + item.to + '</b>';
    if (item.from || item.to) html += '<br>';
    if (item.delay != null) html += '+ ' + Math.round(item.delay) + 'min';
    if (item.distance != null) {
      html +=
        (item.delay != null ? ' - ' : '') +
        Number(item.distance).toFixed(1) +
        'km';
    }
    if (item.delay != null || item.distance != null) html += '<br>';
    if (item.reason) html += item.reason + '<br>';
    html += '</div>';
    dataPart[roadId].push(html);
    noData = false;
  }
  return { dataPart: dataPart, noData: noData };
}

function _renderTrafficInfo(me, dataPart, noData) {
  var trafficobject = me.block;
  $(me.mountPoint + ' .dt_state').html('');
  var c = 1;
  Object.keys(dataPart).forEach(function (d) {
    for (var p in dataPart[d]) {
      if (c <= trafficobject.results)
        $(me.mountPoint + ' .dt_state').append(dataPart[d][p]);
      c++;
    }
  });

  if (noData && me.block.showempty) {
    var emptyblock =
      typeof me.block.showempty === 'string'
        ? me.block.showempty
        : language.misc.no_traffic || 'No traffic announcements';
    $(me.mountPoint + ' .dt_state').append(
      '<div class="empty">' + emptyblock + '</div>'
    );
  }

  Dashticz.setEmpty(me, noData);

  if (
    typeof trafficobject.show_lastupdate !== 'undefined' &&
    trafficobject.show_lastupdate == true
  ) {
    var dt = new Date();
    $(me.mountPoint + ' .dt_state').append(
      '<em>' +
        language.misc.last_update +
        ': ' +
        _addZeroTraffic(dt.getHours()) +
        ':' +
        _addZeroTraffic(dt.getMinutes()) +
        ':' +
        _addZeroTraffic(dt.getSeconds()) +
        '</em>'
    );
  }
}

function _addZeroTraffic(input) {
  return input < 10 ? '0' + input : input;
}

Dashticz.register(DT_trafficinfo);

//# sourceURL=js/components/trafficinfo.js
