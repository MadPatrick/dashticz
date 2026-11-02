/* global Dashticz Domoticz DT_function */
//# sourceURL=js/components/carstatus.js
/* Car status widget: the status of a (BMW, MINI, ...) car, read from the Domoticz
 * devices that hold its data (dummy devices fed by the car integration). One
 * block shows one car; place the widget once per car.
 *
 * It is a repeatable block (Widgets -> Car status, multiple per screen), configured
 * per block, and dispatched on csmode ('status'). The block title is the name
 * of the car. Every option is the idx of a Domoticz device:
 *
 *   csdoor        door state: 'Open' (or On) = a door is open
 *   cswindows     window state: 'Open' (or On) = a window is open
 *   csmileage     mileage (km)
 *   cscharging    charging: On while the car charges
 *   cschargetime  minutes until the car is charged
 *   csbattery     battery level (%)
 *   csdriving     On while the car is driving
 *   cshome        On while the car is at home
 *   csfontsize    optional font size in px (8-60); empty = the theme's
 *
 * What the tile shows:
 *
 *   driving        "On the road", with the battery level and mileage
 *   at home        the battery level and mileage; while charging "Charging
 *                  until HH:MM" (now + the charge minutes); a warning for an
 *                  open door or window
 *   not at home    "Not home", or "Car is not home" plus the warning when a
 *                  door or window is open
 *
 * The battery level is a progress bar like the one of the Mower widget. The
 * colour follows the level: below 15% blinking red, below 30% red, below 50%
 * orange, from 50% the green bar of the mower with a white percentage, and
 * 100% a light green percentage.
 */
var DT_carstatus = (function () {
  var IDX_FIELDS = [
    'door',
    'windows',
    'mileage',
    'charging',
    'chargetime',
    'battery',
    'driving',
    'home',
  ];

  return {
    name: 'carstatus',
    canHandle: function (block) {
      return !!(block && block.csmode === 'status');
    },
    defaultCfg: {
      width: 4,
      icon: 'fas fa-car',
      // The clock time of "Charging until" moves along every minute.
      refresh: 60,
      containerClass: 'carstatus-block dt-widget-rows',
      template: 1,
    },
    run: function (me) {
      IDX_FIELDS.forEach(function (field) {
        var idx = deviceIdx(me.block, field);
        if (idx) {
          Dashticz.subscribeDevice(me, idx, false, function () {
            render(me);
          });
        }
      });
    },
    refresh: render,
    // Exposed for the tests.
    render: render,
    carstatusHtml: carstatusHtml,
    batteryClass: batteryClass,
    timePlus: timePlus,
  };

  function esc(value) {
    return DT_function.escapeHtml(value);
  }

  function tr(key, fallback) {
    return esc(DT_function.t(key, fallback));
  }

  function deviceIdx(block, field) {
    var idx = parseInt(block['cs' + field], 10);
    return idx > 0 ? String(idx) : '';
  }

  function device(block, field) {
    var idx = deviceIdx(block, field);
    return idx ? Domoticz.getAllDevices()[idx] : null;
  }

  // The state text of a device in lower case ('on', 'open', ...), or ''.
  function stateOf(block, field) {
    var dev = device(block, field);
    if (!dev) return '';
    var raw =
      dev.Status !== undefined && dev.Status !== '' ? dev.Status : dev.Data;
    return String(raw === undefined || raw === null ? '' : raw)
      .trim()
      .toLowerCase();
  }

  // The number in the data of a device ('87 %', '12345 km'), 0 when unknown.
  function numberOf(block, field) {
    var dev = device(block, field);
    if (!dev) return 0;
    var number = parseFloat(String(dev.Data).replace(',', '.'));
    return isNaN(number) ? 0 : number;
  }

  function isOn(state) {
    return state === 'on' || state === 'true' || state === '1';
  }

  function isOpen(state) {
    return state === 'open' || isOn(state);
  }

  // HH:MM of now + minutes.
  function timePlus(minutes, now) {
    var date = new Date((now || Date.now()) + minutes * 60000);
    return (
      ('0' + date.getHours()).slice(-2) +
      ':' +
      ('0' + date.getMinutes()).slice(-2)
    );
  }

  // The colour class of a battery level.
  function batteryClass(pct) {
    if (pct > 99) return 'carstatus-batt-full';
    if (pct < 15) return 'carstatus-batt-critical';
    if (pct < 30) return 'carstatus-batt-low';
    if (pct < 50) return 'carstatus-batt-mid';
    return 'carstatus-batt-ok';
  }

  function batteryHtml(pct, mileage, charging) {
    var level = Math.max(0, Math.min(100, Math.round(pct)));
    return (
      '<div class="carstatus-battery ' +
      batteryClass(level) +
      (charging ? ' carstatus-charging' : '') +
      '"><div class="carstatus-battery-text"><span class="carstatus-pct">' +
      level +
      '%</span><span class="carstatus-km">' +
      esc(Math.round(mileage)) +
      ' km</span></div><div class="carstatus-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' +
      level +
      '"><span class="carstatus-bar-fill" style="width:' +
      level +
      '%"></span></div></div>'
    );
  }

  function warningsHtml(doorOpen, windowOpen) {
    var html = '';
    var open = tr('carstatus_open', 'Open');
    if (doorOpen) {
      html +=
        '<div class="carstatus-warning"><i class="fas fa-door-open" aria-hidden="true"></i> ' +
        tr('carstatus_doors', 'Doors') +
        ': <b>' +
        open +
        '</b></div>';
    }
    if (windowOpen) {
      html +=
        '<div class="carstatus-warning"><i class="fas fa-window-maximize" aria-hidden="true"></i> ' +
        tr('carstatus_windows', 'Windows') +
        ': <b>' +
        open +
        '</b></div>';
    }
    return html;
  }

  // The content of the tile for the current device states.
  function carstatusHtml(block, now) {
    var pct = numberOf(block, 'battery');
    var mileage = numberOf(block, 'mileage');
    var chargeMinutes = numberOf(block, 'chargetime');
    var charging = isOn(stateOf(block, 'charging'));
    var doorOpen = isOpen(stateOf(block, 'door'));
    var windowOpen = isOpen(stateOf(block, 'windows'));

    if (isOn(stateOf(block, 'driving'))) {
      return (
        '<div class="carstatus-status carstatus-driving">' +
        tr('carstatus_driving', 'On the road') +
        '</div>' +
        batteryHtml(pct, mileage, false)
      );
    }

    if (isOn(stateOf(block, 'home'))) {
      var html = batteryHtml(pct, mileage, charging);
      if (charging && chargeMinutes > 0) {
        html +=
          '<div class="carstatus-chargetime">' +
          tr('carstatus_charging_until', 'Charging until') +
          ' ' +
          timePlus(chargeMinutes, now) +
          '</div>';
      }
      return html + warningsHtml(doorOpen, windowOpen);
    }

    if (doorOpen || windowOpen) {
      return (
        '<div class="carstatus-status carstatus-away">' +
        tr('carstatus_away_warning', 'Car is not home') +
        '</div>' +
        warningsHtml(doorOpen, windowOpen)
      );
    }
    return (
      '<div class="carstatus-away">' +
      tr('carstatus_away', 'Not home') +
      '</div>'
    );
  }

  function render(me) {
    var block = me.block;
    var fontSize = parseInt(block.csfontsize, 10);
    me.$mountPoint
      .find('.dt_state')
      .css('font-size', fontSize >= 8 && fontSize <= 60 ? fontSize + 'px' : '')
      .html(
        '<div class="carstatus-content">' + carstatusHtml(block) + '</div>'
      );
  }
})();

Dashticz.register(DT_carstatus);
