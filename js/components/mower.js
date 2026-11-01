/* global Dashticz DT_function Domoticz language */
//# sourceURL=js/components/mower.js
/* Mower widget: a Husqvarna robotic mower, as the Husqvarna plugin of Domoticz
 * creates its devices. The block (dispatched on mowermode, added with the
 * Widgets menu's Mower card) has no devices to choose: the devices of the
 * hardware whose name contains "Husqvarna" are found by name:
 *   state and location (texts), the battery level of the mower with a bar,
 *   the run switch (mowing on/off) and the actions (buttons).
 * Only the devices that exist are drawn.
 */
var DT_mower = (function () {
  var FINDERS = {
    state: function (d) {
      return /[- ]state$/i.test(d.Name);
    },
    location: function (d) {
      return /[- ]location$/i.test(d.Name);
    },
    schedule: function (d) {
      return /next schedule/i.test(d.Name);
    },
    run: function (d) {
      return /[- ]run$/i.test(d.Name) && d.Type === 'Light/Switch';
    },
    // The Husqvarna plugin reports the battery of the mower as the battery
    // level of its devices (255 = no battery information).
    battery: function (d) {
      var level = parseInt(d.BatteryLevel, 10);
      return level >= 0 && level <= 100;
    },
    actions: function (d) {
      return /[- ]actions$/i.test(d.Name) && !!d.LevelNames;
    },
  };
  var ORDER = ['state', 'location', 'schedule', 'run', 'battery', 'actions'];

  return {
    name: 'mower',
    canHandle: function (block) {
      return !!(block && block.mowermode === 'info');
    },
    defaultCfg: {
      width: 6,
      icon: 'fas fa-robot',
      containerClass: 'mower-block',
      template: 1,
    },
    run: function (me) {
      var devices = findDevices();
      ORDER.forEach(function (key) {
        if (devices[key])
          Dashticz.subscribeDevice(me, devices[key].idx, false, function () {
            render(me);
          });
      });
      bind(me);
      render(me);
    },
    refresh: render,
    // Exposed for the tests.
    render: render,
    findDevices: findDevices,
    levels: levels,
    actionButtons: actionButtons,
    cleanText: cleanText,
  };

  function esc(value) {
    return DT_function.escapeHtml(value);
  }

  function label(key, fallback) {
    var misc = (typeof language !== 'undefined' && language.misc) || {};
    return misc['mower_' + key] || fallback;
  }

  // {state: device, location: device, ...} of the Husqvarna hardware.
  function findDevices() {
    var all =
      (typeof Domoticz !== 'undefined' && Domoticz.getAllDevices()) || {};
    var mower = Object.keys(all)
      .map(function (idx) {
        return all[idx];
      })
      .filter(function (d) {
        return (
          d &&
          d.idx !== undefined &&
          /husqvarna|mower/i.test(d.HardwareName || '')
        );
      });
    var result = {};
    ORDER.forEach(function (key) {
      result[key] = mower.filter(FINDERS[key])[0] || null;
    });
    return result;
  }

  // The text of a device, without html tags: ['Tomorrow 11:00', 'Grass too short'].
  function cleanText(value) {
    return String(value === undefined ? '' : value)
      .split('\n')
      .map(function (line) {
        return line.replace(/<[^>]*>/g, '').trim();
      })
      .filter(Boolean);
  }

  // [[level, name], ...] of a selector switch, without the hidden off level.
  function levels(dev) {
    var names = '';
    try {
      names = atob(dev.LevelNames || '');
    } catch (e) {
      names = '';
    }
    return names
      .split('|')
      .map(function (name, i) {
        return [i * 10, name];
      })
      .filter(function (item) {
        return item[1] !== '' && item[0] > 0 && !/^\(.*\)$/.test(item[1]);
      });
  }

  // Only the Start and Park buttons are shown; the other actions of the
  // selector (pause, resume schedule, ...) are left out.
  function actionButtons(dev) {
    var all = levels(dev);
    function find(re) {
      return all.filter(function (item) {
        return re.test(item[1]);
      })[0];
    }
    var start = find(/^start/i);
    var park = find(/^parkuntilnextschedule$/i) || find(/^park/i);
    return [
      start && { level: start[0], label: label('start', 'Start') },
      park && { level: park[0], label: label('park', 'Park') },
    ].filter(Boolean);
  }

  function pair(key, fallback, lines) {
    return (
      '<div class="mower-pair mower-' +
      key +
      '"><span class="mower-caption">' +
      esc(label(key, fallback)) +
      '</span><span class="mower-value">' +
      lines
        .map(function (line) {
          return esc(line);
        })
        .join('<br>') +
      '</span></div>'
    );
  }

  function render(me) {
    var dev = findDevices();
    var $state = me.$mountPoint.find('.dt_state');
    var html = '';
    var buttons = '';
    if (dev.state)
      html +=
        '<div class="mower-state">' +
        esc(cleanText(dev.state.Data).join(' ') || '-') +
        '</div>';
    if (dev.location)
      html += pair('location', 'Location', cleanText(dev.location.Data));
    if (dev.battery) {
      var level = parseInt(dev.battery.BatteryLevel, 10);
      html +=
        pair('battery', 'Battery', [level + ' %']) +
        '<div class="mower-bar"><span class="mower-bar-fill" style="width:' +
        level +
        '%"></span></div>';
    }
    if (dev.run) {
      var on = /^on$/i.test(dev.run.Status || dev.run.Data);
      buttons +=
        '<button type="button" class="mower-btn mower-toggle' +
        (on ? ' active' : '') +
        '" data-act="run" aria-pressed="' +
        on +
        '">' +
        esc(label('run', 'Mowing')) +
        ': ' +
        esc(on ? label('on', 'On') : label('off', 'Off')) +
        '</button>';
    }
    if (dev.actions)
      buttons += actionButtons(dev.actions)
        .map(function (item) {
          return (
            '<button type="button" class="mower-btn" data-act="action" data-level="' +
            item.level +
            '">' +
            esc(item.label) +
            '</button>'
          );
        })
        .join('');
    if (buttons)
      html += '<div class="mower-actions" role="group">' + buttons + '</div>';
    $state.html(
      html
        ? '<div class="mower-widget">' + html + '</div>'
        : '<div class="mower-empty">' +
            esc(label('not_found', 'No mower devices found in Domoticz.')) +
            '</div>'
    );
  }

  // The buttons of the tile, handled on the tile itself so that they keep
  // working when the tile is drawn again.
  function bind(me) {
    me.$mountPoint.on('click', '.mower-btn', function () {
      var dev = findDevices();
      var act = $(this).attr('data-act');
      if (act === 'run' && dev.run) {
        var on = /^on$/i.test(dev.run.Status || dev.run.Data);
        Domoticz.request(
          'type=command&param=switchlight&idx=' +
            dev.run.idx +
            '&switchcmd=' +
            (on ? 'Off' : 'On')
        );
      } else if (act === 'action' && dev.actions) {
        Domoticz.request(
          'type=command&param=switchlight&idx=' +
            dev.actions.idx +
            '&switchcmd=Set%20Level&level=' +
            parseInt($(this).attr('data-level'), 10)
        );
      }
    });
  }
})();

Dashticz.register(DT_mower);
