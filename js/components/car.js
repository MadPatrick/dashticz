/* global Dashticz Domoticz DT_function */
//# sourceURL=js/components/car.js
/* Car widget: the status of a (BMW, MINI, ...) car, read from the Domoticz
 * devices that hold its data (dummy devices fed by the car integration). One
 * block shows one car; place the widget once per car.
 *
 * It is a repeatable block (Widgets -> Car, multiple per screen), configured
 * per block, and dispatched on carmode ('status'). The block title is the name
 * of the car. Every option is the idx of a Domoticz device:
 *
 *   cardoor        door state: 'Open' (or On) = a door is open
 *   carwindows     window state: 'Open' (or On) = a window is open
 *   carmileage     mileage (km)
 *   carcharging    charging: On while the car charges
 *   carchargetime  minutes until the car is charged
 *   carbattery     battery level (%)
 *   cardriving     On while the car is driving
 *   carhome        On while the car is at home
 *   carfontsize    optional font size in px (8-60); empty = the theme's
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
 * The battery level is a progress bar of 10 segments, like the Bar display
 * mode of a device. The colour follows the level: below 15% blinking red,
 * below 30% red, below 50% orange, from 50% the text colour and 100% green.
 */
var DT_car = (function () {
  var SEGMENTS = 10;
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
    name: 'car',
    canHandle: function (block) {
      return !!(block && block.carmode === 'status');
    },
    defaultCfg: {
      width: 4,
      icon: 'fas fa-car',
      // The clock time of "Charging until" moves along every minute.
      refresh: 60,
      containerClass: 'car-block dt-widget-rows',
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
    carHtml: carHtml,
    batteryClass: batteryClass,
    segmentsFilled: segmentsFilled,
    timePlus: timePlus,
  };

  function esc(value) {
    return DT_function.escapeHtml(value);
  }

  function tr(key, fallback) {
    return esc(DT_function.t(key, fallback));
  }

  function deviceIdx(block, field) {
    var idx = parseInt(block['car' + field], 10);
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
    if (pct > 99) return 'car-batt-full';
    if (pct < 15) return 'car-batt-critical';
    if (pct < 30) return 'car-batt-low';
    if (pct < 50) return 'car-batt-mid';
    return 'car-batt-ok';
  }

  // The filled segments of the progress bar, in steps of 10%; a level above 0
  // always fills at least the first segment.
  function segmentsFilled(pct) {
    if (!(pct > 0)) return 0;
    return Math.min(SEGMENTS, Math.max(1, Math.round((pct / 100) * SEGMENTS)));
  }

  function batteryHtml(pct, mileage, charging) {
    var level = Math.max(0, Math.min(100, Math.round(pct)));
    var filled = segmentsFilled(level);
    var bar = '';
    for (var i = 0; i < SEGMENTS; i++) {
      bar +=
        '<span class="car-segment' +
        (i < filled ? ' filled' : '') +
        '"></span>';
    }
    return (
      '<div class="car-battery ' +
      batteryClass(level) +
      (charging ? ' car-charging' : '') +
      '"><div class="car-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' +
      level +
      '">' +
      bar +
      '</div><div class="car-battery-text"><span class="car-pct">' +
      level +
      '%</span><span class="car-km">' +
      esc(Math.round(mileage)) +
      ' km</span></div></div>'
    );
  }

  function warningsHtml(doorOpen, windowOpen) {
    var html = '';
    var open = tr('car_open', 'Open');
    if (doorOpen) {
      html +=
        '<div class="car-warning"><i class="fas fa-door-open" aria-hidden="true"></i> ' +
        tr('car_doors', 'Doors') +
        ': <b>' +
        open +
        '</b></div>';
    }
    if (windowOpen) {
      html +=
        '<div class="car-warning"><i class="fas fa-window-maximize" aria-hidden="true"></i> ' +
        tr('car_windows', 'Windows') +
        ': <b>' +
        open +
        '</b></div>';
    }
    return html;
  }

  // The content of the tile for the current device states.
  function carHtml(block, now) {
    var pct = numberOf(block, 'battery');
    var mileage = numberOf(block, 'mileage');
    var chargeMinutes = numberOf(block, 'chargetime');
    var charging = isOn(stateOf(block, 'charging'));
    var doorOpen = isOpen(stateOf(block, 'door'));
    var windowOpen = isOpen(stateOf(block, 'windows'));

    if (isOn(stateOf(block, 'driving'))) {
      return (
        '<div class="car-status car-driving">' +
        tr('car_driving', 'On the road') +
        '</div>' +
        batteryHtml(pct, mileage, false)
      );
    }

    if (isOn(stateOf(block, 'home'))) {
      var html = batteryHtml(pct, mileage, charging);
      if (charging && chargeMinutes > 0) {
        html +=
          '<div class="car-chargetime">' +
          tr('car_charging_until', 'Charging until') +
          ' ' +
          timePlus(chargeMinutes, now) +
          '</div>';
      }
      return html + warningsHtml(doorOpen, windowOpen);
    }

    if (doorOpen || windowOpen) {
      return (
        '<div class="car-status car-away">' +
        tr('car_away_warning', 'Car is not home') +
        '</div>' +
        warningsHtml(doorOpen, windowOpen)
      );
    }
    return '<div class="car-away">' + tr('car_away', 'Not home') + '</div>';
  }

  function render(me) {
    var block = me.block;
    var fontSize = parseInt(block.carfontsize, 10);
    me.$mountPoint
      .find('.dt_state')
      .css('font-size', fontSize >= 8 && fontSize <= 60 ? fontSize + 'px' : '')
      .html('<div class="car-content">' + carHtml(block) + '</div>');
  }
})();

Dashticz.register(DT_car);
