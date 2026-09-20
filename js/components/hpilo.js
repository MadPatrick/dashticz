/* global Dashticz settings language */
//# sourceURL=js/components/hpilo.js
/* HP iLO widget: clustered server info (power, health, uptime, fan speed,
 * temperatures, ...) of an HPE server, read from its iLO Redfish API through
 * vendor/dashticz/hpilo/index.php - a same-origin PHP bridge, like the PostNL
 * and Lyrion widgets, so the LAN-only, self-signed iLO never has to be
 * reachable from the browser. Based on the domoticz_HP_ilo plugin.
 *
 * The iLO host/port/credentials, poll interval, font size and which rows are
 * visible are global settings (Settings -> Widgets -> HP iLO, see
 * js/widgeteditor.js), same as Weather, Garbage or PostNL. Icon, title and
 * background of the tile are the usual block options.
 *
 * Every row is: a small icon, the label and the value right-aligned.
 */
var DT_hpilo = (function () {
  // key: metric (also the backend's result field), icon, English label,
  // formatter and whether it is shown by default.
  var METRICS = [
    { key: 'name', icon: 'fa-server', def: 0 },
    { key: 'model', icon: 'fa-microchip', def: 0 },
    { key: 'power', icon: 'fa-power-off', def: 1, fmt: 'power' },
    { key: 'health', icon: 'fa-heart-pulse', def: 1, fmt: 'health' },
    { key: 'uptime', icon: 'fa-clock', def: 1, unit: ' min' },
    { key: 'fanspeed', icon: 'fa-fan', def: 1, unit: ' %' },
    { key: 'cputemp', icon: 'fa-temperature-half', def: 1, unit: ' °C' },
    { key: 'inlettemp', icon: 'fa-temperature-half', def: 1, unit: ' °C' },
    { key: 'watts', icon: 'fa-bolt', def: 0, unit: ' W' },
    { key: 'storage', icon: 'fa-hard-drive', def: 0, fmt: 'health' },
    { key: 'firmware', icon: 'fa-code-branch', def: 0 },
    { key: 'serial', icon: 'fa-barcode', def: 0 },
  ];
  var LABELS = {
    name: 'Server name',
    model: 'Model',
    power: 'Server power',
    health: 'Server health',
    uptime: 'Server uptime',
    fanspeed: 'Server fanspeed',
    cputemp: 'CPU temperature',
    inlettemp: 'Inlet temperature',
    watts: 'Power usage',
    storage: 'Storage health',
    firmware: 'iLO firmware',
    serial: 'Serial number',
  };
  var VALUES = {
    on: 'On',
    off: 'Off',
    ok: 'OK',
    warning: 'Warning',
    critical: 'Critical',
  };

  return {
    name: 'hpilo',
    canHandle: function (block) {
      return !!(block && block.type === 'hpilo');
    },
    defaultCfg: {
      width: 4,
      icon: 'fas fa-server',
      refresh: pollSeconds(),
      containerClass: 'hpilo-block',
    },
    run: function (me) {
      refresh(me);
    },
    refresh: refresh,
  };

  function misc() {
    return (typeof language !== 'undefined' && language.misc) || {};
  }

  function pollSeconds() {
    return Math.max(30, parseInt(settings['hpilo_pollseconds'], 10) || 300);
  }

  function fontSize() {
    var size = parseInt(settings['hpilo_fontsize'], 10);
    return size >= 8 && size <= 60 ? size : 14;
  }

  function isVisible(metric) {
    var value = parseInt(settings['hpilo_show_' + metric.key], 10);
    return isNaN(value) ? !!metric.def : value !== 0;
  }

  function label(key) {
    return misc()['hpilo_' + key] || LABELS[key];
  }

  function esc(text) {
    return String(text).replace(/[&<>"']/g, function (c) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[c];
    });
  }

  function formatValue(metric, value) {
    if (metric.fmt) {
      var key = String(value).toLowerCase();
      return misc()['hpilo_value_' + key] || VALUES[key] || value;
    }
    return value + (metric.unit || '');
  }

  function rowsHtml(res, metrics) {
    return metrics
      .filter(function (metric) {
        return res[metric.key] !== null && res[metric.key] !== undefined;
      })
      .map(function (metric) {
        var value = res[metric.key];
        var state = metric.fmt
          ? ' hpilo-' +
            String(value)
              .toLowerCase()
              .replace(/[^a-z]/g, '')
          : '';
        return (
          '<div class="hpilo-row' +
          state +
          '">' +
          '<i class="fas ' +
          metric.icon +
          ' hpilo-icon" aria-hidden="true"></i>' +
          '<span class="hpilo-label">' +
          esc(label(metric.key)) +
          '</span>' +
          '<span class="hpilo-value">' +
          esc(formatValue(metric, value)) +
          '</span>' +
          '</div>'
        );
      })
      .join('');
  }

  function showMessage(me, text) {
    me.$mountPoint
      .find('.dt_state')
      .html('<div class="hpilo-rows hpilo-error">' + esc(text) + '</div>');
  }

  function refresh(me) {
    me.$mountPoint.find('.dt_state').css('font-size', fontSize() + 'px');
    var host = settings['hpilo_host'] || '';
    var username = settings['hpilo_username'] || '';
    var password = settings['hpilo_password'] || '';
    if (!host || !username || !password) {
      showMessage(
        me,
        misc().hpilo_not_configured ||
          'Configure your iLO in Settings -> Widgets -> HP iLO.'
      );
      return;
    }
    var metrics = METRICS.filter(isVisible);

    $.ajax({
      url: settings['dashticz_php_path'] + 'hpilo/index.php',
      method: 'POST',
      contentType: 'application/json',
      dataType: 'json',
      data: JSON.stringify({
        host: host,
        port: parseInt(settings['hpilo_port'], 10) || 443,
        username: username,
        password: password,
        pollSeconds: pollSeconds(),
        metrics: metrics.map(function (metric) {
          return metric.key;
        }),
      }),
    }).then(
      function (res) {
        me.$mountPoint
          .find('.dt_state')
          .html(
            '<div class="hpilo-rows">' + rowsHtml(res || {}, metrics) + '</div>'
          );
      },
      function (jqXHR) {
        showMessage(
          me,
          (jqXHR && jqXHR.responseJSON && jqXHR.responseJSON.error) ||
            misc().hpilo_error ||
            'Unable to fetch the iLO data.'
        );
      }
    );
  }
})();

Dashticz.register(DT_hpilo);
