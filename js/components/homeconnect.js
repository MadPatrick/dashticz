/* global Dashticz Domoticz DT_function */
//# sourceURL=js/components/homeconnect.js
/* Home Connect widget: the appliances (washing machine, dryer, coffee machine,
 * ...) of the Domoticz Home Connect plugin
 * (https://github.com/Rouzax/home-connect-domoticz-plugin), in one tile.
 *
 * The block (dispatched on hcmode: 'appliances') has no device ids to fill in.
 * The devices of the hardware whose name contains "Home Connect" are grouped
 * per appliance by their name: the plugin names every device "<appliance>
 * <value>", for example "Washer Progress" / "Wasautomaat Voortgang" (a leading
 * "$" is ignored). The values the widget uses:
 *
 *   power     Power / Aan/uit
 *   progress  Progress / Voortgang
 *   time      Remaining time / Resterende tijd (minutes, or text like
 *             "1h 20min"); Finish time / Eindtijd is read the same way
 *   alert     Notifications / Meldingen (or an alert device named Alert)
 *
 * Options (all optional):
 *
 *   hcfontsize   font size of the tile in pixels (8-60); empty = the theme's
 *   hchardware   part of the hardware name of the plugin; default 'Home Connect'
 *   hcexclude    appliance names to hide, comma separated
 *   hcdevices    per appliance, the idx of a device that is not found by its
 *                name: {'Washer': {power: 12, progress: 13, time: 14,
 *                alert: 15, name: 'Wasmachine', icon: 'washer'}}
 *                (icon: washer, dryer, coffee, dishwasher, oven, fridge,
 *                plug, or a Font Awesome class)
 *
 * What the tile shows, per appliance: the icon and the name; while a program
 * runs the progress and "ready at HH:MM" (now + the remaining time); at 100% a
 * check mark; a warning when there is an alert (not for "no notification").
 * An appliance that is off, or has nothing to show, is left out.
 */
var DT_homeconnect = (function () {
  var FIELDS = ['power', 'progress', 'time', 'alert'];
  // The value of a device, from the end of its name (English and Dutch).
  var SUFFIXES = {
    power: /^(.*?)\s+(power|aan\/uit)$/i,
    progress: /^(.*?)\s+(progress|voortgang)$/i,
    time: /^(.*?)\s+(remaining time|resterende tijd|finish time|eindtijd)$/i,
    alert: /^(.*?)\s+(notifications|meldingen|alert|alerts)$/i,
  };
  // The icon from a word in the name of the appliance: the key of GLYPHS.
  var ICONS = [
    [/wasmachine|wasautomaat|washer|washing|waschmaschine/i, 'washer'],
    [/droger|dryer|trockner/i, 'dryer'],
    [/koffie|coffee|kaffee/i, 'coffee'],
    [/vaatwasser|dishwasher|geschirr/i, 'dishwasher'],
    [/oven|backofen|magnetron|microwave/i, 'oven'],
    [/koelkast|fridge|freezer|vriezer|k[uü]hl/i, 'fridge'],
  ];
  var DEFAULT_ICON = 'plug';
  // The icons: the inside of a 24x24 outline drawing (stroke = the colour of the icon, see the css).
  var GLYPHS = {
    washer:
      '<rect x="4" y="2.5" width="16" height="19" rx="2.5"/><path d="M4 7h16"/>' +
      '<circle cx="7.5" cy="4.8" r=".6"/><path d="M11 4.8h5.5"/>' +
      '<circle cx="12" cy="14.2" r="4.8"/><path d="M8.6 14.6c1.1-1.1 2.2 1.1 3.4 0s2.3 1.1 3.4 0"/>',
    dryer:
      '<rect x="4" y="2.5" width="16" height="19" rx="2.5"/><path d="M4 7h16"/>' +
      '<circle cx="7.5" cy="4.8" r=".6"/><path d="M11 4.8h5.5"/>' +
      '<circle cx="12" cy="14.2" r="4.8"/><path d="M9.8 12.2c1.1.9 1.1 2.2 0 3.1M12.8 12.2c1.1.9 1.1 2.2 0 3.1"/>',
    coffee:
      '<path d="M5 21.5h14M6.5 3h11a1.5 1.5 0 0 1 1.5 1.5v17"/><path d="M6.5 3A1.5 1.5 0 0 0 5 4.5v17"/>' +
      '<path d="M5 8h14"/><path d="M9 11.5h6v3.2a3 3 0 0 1-6 0z"/><path d="M12 8v1.8"/>',
    dishwasher:
      '<rect x="4" y="2.5" width="16" height="19" rx="2.5"/><path d="M4 7h16"/>' +
      '<circle cx="7.5" cy="4.8" r=".6"/><path d="M11 4.8h5.5"/>' +
      '<path d="M7 12h10M7 16.5h10M9 12v-1.5M15 12v-1.5M9 16.5V15M15 16.5V15"/>',
    oven:
      '<rect x="3.5" y="3" width="17" height="18" rx="2.5"/><path d="M3.5 8h17"/>' +
      '<circle cx="7.5" cy="5.5" r=".6"/><circle cx="11" cy="5.5" r=".6"/><circle cx="14.5" cy="5.5" r=".6"/>' +
      '<rect x="6.5" y="10.5" width="11" height="7" rx="1"/>',
    fridge:
      '<rect x="5.5" y="2.5" width="13" height="19" rx="2.5"/><path d="M5.5 9.5h13"/>' +
      '<path d="M8.5 5.5v1.5M8.5 12.5v3"/>',
    plug: '<path d="M9 3v5M15 3v5M6.5 8h11v3.5a5.5 5.5 0 0 1-11 0zM12 17v4"/>',
  };
  // Alert texts that mean: nothing to report.
  var NO_ALERT = /^(no active alerts?|no notifications?|geen meldingen?|-)$/i;

  return {
    name: 'homeconnect',
    canHandle: function (block) {
      return !!(block && block.hcmode === 'appliances');
    },
    defaultCfg: {
      width: 4,
      icon: 'fas fa-home',
      // The ready time moves along with the clock.
      refresh: 60,
      containerClass: 'homeconnect-block dt-widget-rows',
      template: 1,
    },
    run: function (me) {
      var subscribed = {};
      appliances(me.block).forEach(function (app) {
        FIELDS.forEach(function (field) {
          var dev = app[field];
          if (dev && !subscribed[dev.idx]) {
            subscribed[dev.idx] = true;
            Dashticz.subscribeDevice(me, dev.idx, false, function () {
              render(me);
            });
          }
        });
      });
      render(me);
    },
    refresh: render,
    // Exposed for the tests.
    render: render,
    appliances: appliances,
    homeconnectHtml: homeconnectHtml,
    remainingMinutes: remainingMinutes,
    finishTime: finishTime,
    alertText: alertText,
  };

  function esc(value) {
    return DT_function.escapeHtml(value);
  }

  function tr(key, fallback) {
    return esc(DT_function.t(key, fallback));
  }

  function two(number) {
    return ('0' + number).slice(-2);
  }

  // The data of a device as text, without html tags.
  function dataOf(dev) {
    if (!dev) return '';
    var raw = dev.Data !== undefined && dev.Data !== '' ? dev.Data : dev.Status;
    return String(raw === undefined || raw === null ? '' : raw)
      .replace(/<[^>]*>/g, ' ')
      .trim();
  }

  // The minutes in a remaining time: a number ('45', '45 min') or text like
  // '1h 20min'. null when unknown.
  function remainingMinutes(text) {
    text = String(text === undefined || text === null ? '' : text).trim();
    var hours = text.match(/(\d+)\s*h/i);
    var minutes = text.match(/(\d+)\s*min/i);
    if (hours || minutes)
      return (
        (hours ? parseInt(hours[1], 10) * 60 : 0) +
        (minutes ? parseInt(minutes[1], 10) : 0)
      );
    var plain = text.match(/^(\d+)(?:[.,]\d+)?$/);
    return plain ? parseInt(plain[1], 10) : null;
  }

  // HH:MM of now + the remaining time, or '' when unknown.
  function finishTime(text, now) {
    var minutes = remainingMinutes(text);
    if (minutes === null) return '';
    var date = new Date((now || Date.now()) + minutes * 60000);
    return two(date.getHours()) + ':' + two(date.getMinutes());
  }

  // The text of an alert device, or '' when there is nothing to report.
  function alertText(dev) {
    var text = dataOf(dev);
    return NO_ALERT.test(text.replace(/\.$/, '')) ? '' : text;
  }

  function isOff(dev) {
    var state = String(dev && dev.Status).toLowerCase();
    return state === 'off' || state === 'closed';
  }

  // The name of an appliance and the value a device shows, from the device
  // name: 'Washer Progress' -> {appliance: 'Washer', field: 'progress'}.
  function classify(name) {
    name = String(name || '')
      .replace(/^\$/, '')
      .replace(/^home\s*connect\s*[-:]*\s*/i, '');
    for (var i = 0; i < FIELDS.length; i++) {
      var match = name.match(SUFFIXES[FIELDS[i]]);
      if (match && match[1]) return { appliance: match[1], field: FIELDS[i] };
    }
    return null;
  }

  function iconOf(name) {
    for (var i = 0; i < ICONS.length; i++)
      if (ICONS[i][0].test(name)) return ICONS[i][1];
    return DEFAULT_ICON;
  }

  function hardwareFilter(block) {
    var part = String((block && block.hchardware) || 'Home Connect');
    return function (dev) {
      return (
        dev &&
        dev.idx !== undefined &&
        String(dev.HardwareName || '')
          .toLowerCase()
          .indexOf(part.toLowerCase()) >= 0
      );
    };
  }

  // [{name, icon, power, progress, time, alert}, ...]: the appliances found by
  // the names of the devices, plus the ones (or fields) set with hcdevices.
  function appliances(block) {
    var all =
      (typeof Domoticz !== 'undefined' && Domoticz.getAllDevices()) || {};
    var found = {};
    var order = [];
    function entry(name) {
      if (!found[name]) {
        found[name] = { name: name, icon: iconOf(name) };
        order.push(name);
      }
      return found[name];
    }
    Object.keys(all)
      .map(function (idx) {
        return all[idx];
      })
      .filter(hardwareFilter(block))
      .forEach(function (dev) {
        var info = classify(dev.Name);
        if (info && !entry(info.appliance)[info.field])
          found[info.appliance][info.field] = dev;
      });
    var configured = (block && block.hcdevices) || {};
    Object.keys(configured).forEach(function (name) {
      var item = configured[name] || {};
      var app = entry(name);
      FIELDS.forEach(function (field) {
        var dev = all[parseInt(item[field], 10)];
        if (dev) app[field] = dev;
      });
      if (item.name) app.name = String(item.name);
      if (item.icon) app.icon = String(item.icon);
    });
    var excluded = String((block && block.hcexclude) || '')
      .toLowerCase()
      .split(',')
      .map(function (part) {
        return part.trim();
      });
    return order
      .map(function (name) {
        return found[name];
      })
      .filter(function (app) {
        return excluded.indexOf(app.name.toLowerCase()) < 0;
      });
  }

  // An icon key of GLYPHS becomes an svg, anything else is a Font Awesome class.
  function iconHtml(icon) {
    if (GLYPHS[icon])
      return (
        '<svg class="homeconnect-icon homeconnect-icon-' +
        icon +
        '" viewBox="0 0 24 24" fill="none" ' +
        'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" ' +
        'stroke-linejoin="round" aria-hidden="true">' +
        GLYPHS[icon] +
        '</svg>'
      );
    return '<i class="' + esc(icon) + '" aria-hidden="true"></i>';
  }

  function nameHtml(app) {
    return (
      '<span class="homeconnect-name">' +
      iconHtml(app.icon) +
      ' ' +
      esc(app.name) +
      '</span>'
    );
  }

  // The row of one appliance, or '' when it has nothing to show.
  function rowHtml(app, now) {
    // An appliance that is switched off shows nothing.
    if (app.power ? isOff(app.power) : !app.progress && !app.alert) return '';
    var warning = app.alert ? alertText(app.alert) : '';
    if (warning)
      return (
        '<div class="homeconnect-row">' +
        nameHtml(app) +
        '<span class="homeconnect-value homeconnect-warning">' +
        esc(warning) +
        '</span></div>'
      );
    if (!app.progress) return '';
    var progress = parseFloat(dataOf(app.progress).replace(',', '.')) || 0;
    if (progress >= 100)
      return (
        '<div class="homeconnect-row">' +
        nameHtml(app) +
        '<span class="homeconnect-value homeconnect-done" title="' +
        tr('homeconnect_done', 'Finished') +
        '">&#10004;</span></div>'
      );
    var ready = finishTime(dataOf(app.time), now);
    return (
      '<div class="homeconnect-row">' +
      nameHtml(app) +
      '<span class="homeconnect-value"><b>' +
      Math.round(progress) +
      '%</b> ' +
      (ready
        ? tr('homeconnect_ready_at', 'ready at') + ' ' + ready
        : tr('homeconnect_unknown_time', 'time unknown')) +
      '</span></div>'
    );
  }

  // The content of the tile: one row per appliance that has something to show.
  function homeconnectHtml(block, now) {
    var html = appliances(block)
      .map(function (app) {
        return rowHtml(app, now);
      })
      .join('');
    return (
      html ||
      '<div class="homeconnect-empty">' +
        tr('homeconnect_none', 'No active appliances') +
        '</div>'
    );
  }

  function render(me) {
    var fontSize = parseInt(me.block.hcfontsize, 10);
    me.$mountPoint
      .find('.dt_state')
      .css('font-size', fontSize >= 8 && fontSize <= 60 ? fontSize + 'px' : '')
      .html(
        '<div class="homeconnect-content">' +
          homeconnectHtml(me.block) +
          '</div>'
      );
  }
})();

Dashticz.register(DT_homeconnect);
