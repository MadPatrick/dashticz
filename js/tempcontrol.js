// eslint-disable-next-line no-unused-vars
/* global sliding:writable number_format _TEMP_SYMBOL language*/
/* from bundle.js */
/* global moment templateEngine*/
/* from settings.js */
/* global settings */
/* from blocks.js */
/* global titleAndValueSwitch showUpdateInformation getBlockTitle*/
/* from domoticz-api.js*/
/* global Domoticz */
/* from dt_function.js*/
/* global DT_function choose*/
/* from dial.js*/
/* global DT_dial */
/* from src/functions.js */
/* global isDefined */
/* exported addThermostatFunctions getThermostatBlock*/

function addThermostatFunctions(block) {
  var $el = block.$mountPoint.find('.block_' + block.key);
  $el.find('.btn-number').on('click', function () {
    var type = $(this).attr('data-type');
    var input = titleAndValueSwitch(block)
      ? $el.find('.title')
      : $el.find('.value');
    var currentVal = input.text().split(block.unit);
    currentVal = parseFloat(currentVal[0].replace(',', '.'));
    var setpointStep = choose(block.device.step, 0.5);
    if (!isNaN(currentVal)) {
      var newValue =
        type === 'minus'
          ? currentVal - setpointStep
          : currentVal + setpointStep;
      if (newValue >= block.min && newValue <= block.max) {
        input.text(number_format(newValue, 1) + block.unit).trigger('change');
        updateSetpointMeter(block, newValue);
        switchThermostat(block, newValue);
      }
      if (newValue <= block.min) {
        $(this).attr('disabled', true);
      }
      if (newValue >= block.max) {
        $(this).attr('disabled', true);
      }
    } else {
      input.text(0);
    }
  });

  $el.find('.input-number').on('focusin', function () {
    $(this).data('oldValue', $(this).text());
  });

  $el.find('.input-number').on('change', function () {
    var minValue = block.min;
    var maxValue = block.max;
    var valueCurrent = parseFloat($(this).text());

    if (valueCurrent >= minValue) {
      $el.find(".btn-number[data-type='minus']").removeAttr('disabled');
    } else {
      $(this).val($(this).data('oldValue'));
    }
    if (valueCurrent <= maxValue) {
      $el.find(".btn-number[data-type='plus']").removeAttr('disabled');
    } else {
      $(this).val($(this).data('oldValue'));
    }
  });
}

function getThermostatBlock(block) {
  block.min = parseFloat(
    choose(block.min, block.device.min, settings['setpoint_min'], 5)
  );
  block.max = parseFloat(
    choose(block.max, block.device.max, settings['setpoint_max'], 40)
  );
  block.unit = choose(block.unit, block.device.vunit, _TEMP_SYMBOL);

  var html = '';
  var device = block.device;
  var idx = block.idx;
  var value = number_format(device.Data, 1) + block.unit;
  var title = getBlockTitle(block);

  if (titleAndValueSwitch(block)) {
    title = [value, (value = title)][0];
  }

  templateEngine.load('thermostat_block').then(function (template) {
    var dataObject = {
      idx: idx,
      value: value,
      title: title,
      buttons: !choose(block.protected, block.subidx && block.subidx === 1),
      showinfo: showUpdateInformation(block) ? true : false,
      lastupdate: moment(device.LastUpdate).format(settings['timeformat']),
      mIcon: isDefined(block.icon) ? block.icon : '',
      mImage: isDefined(block.image) ? block.image : 'heating.png',
      meter: choose(block.setpointbar, true) !== false,
      arcSvg: setpointArcSvg(block, parseFloat(device.Data)),
    };
    html = template(dataObject);
    block.$mountPoint
      .find('.block_' + block.key)
      .toggleClass('setpoint-arc-block', dataObject.meter)
      .html(html);
    addThermostatFunctions(block);
    if (choose(block.setpointgraph, true) !== false) addSetpointGraph(block);
  });
  return true;
}

/* Setpoint meter: a half circle (180 degrees) on the setpoint tile with the
   same colour zones as the temperature block (<12 blue, 12-17 light blue,
   17-23 green, 23-26 yellow, above red) and a marker at the current setpoint.
   The zones only apply to a temperature in degrees; other units get a neutral
   arc. The - and + buttons sit below the two ends of the arc. */
var SETPOINT_ZONES = [
  [12, '#3b82f6'],
  [17, '#7dd3fc'],
  [23, '#4ade80'],
  [26, '#facc15'],
  [Infinity, '#ef4444'],
];

function setpointMeterPos(block, value) {
  var range = block.max - block.min;
  if (isNaN(value) || !(range > 0)) return 0;
  return Math.max(0, Math.min(100, ((value - block.min) / range) * 100));
}

/* Point on the arc (centre 50,50, radius 40) for a position of 0-100%:
   0% is the left end, 100% the right end. */
function setpointArcPoint(pos) {
  var angle = Math.PI * (1 - pos / 100);
  return [50 + 40 * Math.cos(angle), 50 - 40 * Math.sin(angle)];
}

function setpointArcPath(from, to) {
  var p1 = setpointArcPoint(from);
  var p2 = setpointArcPoint(to);
  return (
    'M' +
    p1[0].toFixed(2) +
    ' ' +
    p1[1].toFixed(2) +
    ' A40 40 0 0 1 ' +
    p2[0].toFixed(2) +
    ' ' +
    p2[1].toFixed(2)
  );
}

function setpointArcSvg(block, value) {
  var zones =
    block.unit.indexOf('°') < 0
      ? [[Infinity, 'rgba(255,255,255,0.35)']]
      : SETPOINT_ZONES;
  var paths = '';
  var from = block.min;
  zones.forEach(function (zone) {
    var to = Math.min(zone[0], block.max);
    if (from >= block.max || to <= from) return;
    paths +=
      '<path d="' +
      setpointArcPath(
        setpointMeterPos(block, from),
        setpointMeterPos(block, to)
      ) +
      '" stroke="' +
      zone[1] +
      '" />';
    from = to;
  });
  var m = setpointArcPoint(setpointMeterPos(block, value));
  return (
    '<svg class="setpoint-arc-svg" viewBox="0 0 100 54">' +
    '<g fill="none" stroke-width="10" stroke-linecap="butt">' +
    paths +
    '</g><circle class="setpoint-arc-marker" r="7" cx="' +
    m[0].toFixed(2) +
    '" cy="' +
    m[1].toFixed(2) +
    '" /></svg>'
  );
}

function updateSetpointMeter(block, value) {
  var m = setpointArcPoint(setpointMeterPos(block, value));
  block.$mountPoint
    .find('.setpoint-arc-marker')
    .attr({ cx: m[0].toFixed(2), cy: m[1].toFixed(2) });
}

/* Sparkline of the last 24 hours (on by default, block option setpointgraph: false disables it).
   One request per tile; it uses the setpoint when Domoticz reports it and
   otherwise the measured value. */
function addSetpointGraph(block) {
  var cmd = Domoticz.info.api15330 ? 'type=command&param=graph' : 'type=graph';
  Domoticz.request(
    cmd + '&sensor=temp&idx=' + block.device.idx + '&range=day'
  ).then(function (data) {
    var points = ((data && data.result) || [])
      .map(function (sample) {
        return parseFloat(
          isDefined(sample.sp)
            ? sample.sp
            : isDefined(sample.te)
              ? sample.te
              : sample.v
        );
      })
      .filter(function (v) {
        return !isNaN(v);
      });
    if (points.length < 2) return;
    var lo = Math.min.apply(null, points);
    var hi = Math.max.apply(null, points);
    var span = hi - lo || 1;
    var path = points
      .map(function (v, i) {
        var x = (i / (points.length - 1)) * 100;
        var y = 18 - ((v - lo) / span) * 16;
        return x.toFixed(1) + ',' + y.toFixed(1);
      })
      .join(' ');
    block.$mountPoint
      .find('.setpoint-graph')
      .html(
        '<svg viewBox="0 0 100 20" preserveAspectRatio="none">' +
          '<polyline fill="none" stroke="currentColor" stroke-width="1.5" ' +
          'vector-effect="non-scaling-stroke" points="' +
          path +
          '"/></svg>'
      );
  });
}

function switchThermostat(block, setpoint) {
  var idx = block.device.idx;
  var hasPassword = block.password;
  if (!DT_function.promptPassword(hasPassword)) return;
  Domoticz.syncRequest(
    idx,
    'type=command&param=setsetpoint&idx=' + idx + '&setpoint=' + setpoint
  );
}

function getEvohomeZoneBlock(block) {
  var html = '';
  var device = block.device;
  var value = device.Temp + _TEMP_SYMBOL;
  var title = getBlockTitle(block);

  var faStatus =
    device.Status == 'TemporaryOverride'
      ? 'fas fa-stopwatch'
      : 'far fa-calendar-alt';

  var untilOrLastUpdate =
    device.Status == 'Auto' || device.Status == 'TemporaryOverride'
      ? 'Until ' + moment(device.Until).format('HH:mm')
      : moment(device.LastUpdate).format(settings['timeformat']);

  untilOrLastUpdate =
    device.Status == 'PermanentOverride' ? 'Permanent' : untilOrLastUpdate;

  if (titleAndValueSwitch(block)) {
    title = [value, (value = title)][0];
  }

  templateEngine.load('thermostat_evo_zone').then(function (template) {
    var dataObject = {
      idx: device.idx,
      value: value,
      temp: device.Temp,
      tTemp: title,
      tSetP: device.SetPoint + _TEMP_SYMBOL,
      setpoint: device.SetPoint,
      status: device.Status,
      min: settings['setpoint_min'],
      max: settings['setpoint_max'],
      fa: faStatus,
      update: untilOrLastUpdate,
      mIcon: isDefined(block.icon) ? block.icon : '',
      mImage: isDefined(block.image) ? block.image : 'heating.png',
    };
    html = template(dataObject);
    block.$mountPoint.find('.mh').html(html);
    addEvohomeZoneFunctions(block);
  });
  return true;
}

function addEvohomeZoneFunctions(block) {
  var clickTimeout;
  var idx = block.idx;
  var $div = block.$mountPoint.find('.mh');

  $div.find('.btn-number').on('click', function () {
    clearTimeout(clickTimeout);
    Domoticz.hold(idx);

    var type = $(this).attr('data-type');
    var currentVal = $(this).parents('.col-button1').data('setpoint');
    var input = $div.find('.setpoint');
    var valid = false;

    if (!isNaN(currentVal)) {
      var newValue = type === 'minus' ? currentVal - 0.5 : currentVal + 0.5;
      if (newValue >= input.attr('min') && newValue <= input.attr('max')) {
        input.html(
          '<i class="fas fa-stopwatch small_fa">&nbsp;</i>' +
            newValue +
            _TEMP_SYMBOL
        );
        $(this).parents('.col-button1').data('setpoint', newValue);
        valid = true;
      }

      if (newValue <= input.attr('min')) {
        $(this).attr('disabled', true);
      }

      if (newValue >= input.attr('max')) {
        $(this).attr('disabled', true);
      }

      clickTimeout = setTimeout(function () {
        if (valid) {
          switchEvoZone(block, newValue, true);
        }
        Domoticz.release(block.device.idx);
      }, 2000);
    } else {
      input.text(0);
    }
  });

  $div
    .find('.input-number')
    .on('focusin', function () {
      $(this).data('oldValue', $(this).text());
    })
    .on('change', function () {
      var minValue = parseFloat($(this).attr('min'));
      var maxValue = parseFloat($(this).attr('max'));
      var valueCurrent = parseFloat($(this).text());

      if (valueCurrent >= minValue) {
        $div.find(".btn-number[data-type='minus']").removeAttr('disabled');
      } else {
        $(this).val($(this).data('oldValue'));
      }
      if (valueCurrent <= maxValue) {
        $div.find(".btn-number[data-type='plus']").removeAttr('disabled');
      } else {
        $(this).val($(this).data('oldValue'));
      }
    });

  $div.find('.setpoint').on('click', function () {
    if ($(this).attr('data-status') == 'TemporaryOverride') {
      switchEvoZone(block, $(this).attr('data-setpoint'), false);
    }
  });
}

/* Domoticz copies the digits of the until time as they are (it ignores a time
   zone or Z suffix) into the controller's clock, so the time must be local. */
var EVO_UNTIL_FORMAT = 'YYYY-MM-DDTHH:mm:ss';

function switchEvoZone(block, setpoint, override) {
  var idx = block.device.idx;
  var dial = block.type === 'zone';
  var hasPassword = block.password;
  var mode = override
    ? '&mode=TemporaryOverride&until=' +
      moment()
        .add(choose(settings['evohome_boost_zone'], 60), 'minutes')
        .format(EVO_UNTIL_FORMAT)
    : '&mode=Auto';

  if (!DT_function.promptPassword(hasPassword)) {
    dial ? DT_dial.make(block) : getEvohomeZoneBlock(block);
    return;
  }

  Domoticz.syncRequest(
    idx,
    'type=command&param=setused&idx=' +
      idx +
      '&setpoint=' +
      setpoint +
      mode +
      '&used=true',
    true
  ).then(function () {
    if (override) block.device.SetPoint = setpoint;
    dial ? DT_dial.make(block) : getEvohomeZoneBlock(block);
  });
}

function getEvohomeControllerBlock(block) {
  var html = '';
  var device = block.device;
  var $div = block.$mountPoint.find('.block_' + block.key);
  var title = getBlockTitle(block);

  templateEngine.load('thermostat_evo_cont').then(function (template) {
    var dataObject = {
      idx: device.idx,
      mIcon: isDefined(block.icon) ? block.icon : '',
      mImage: isDefined(block.image) ? block.image : 'evohome.png',
      name: title,
      status: language.evohome[device.Status],
      update: moment(device.LastUpdate).format(settings['timeformat']),
      showUpdate: showUpdateInformation(block),
    };
    html = template(dataObject);
    $div.html(html);

    $div.find('.evoSelect').on('blur', function () {
      Domoticz.release(block.device.idx);
      $div.find('.title').toggleClass('hide');
      $div.find('.evoSelect').toggleClass('hide');
    });

    $div.find('.evoSelect').on('change', function () {
      var newValue = $(this).val();
      changeEvohomeControllerStatus(block, newValue);
      $div
        .find('.input-status')
        .text(language.evohome[newValue])
        .toggleClass('hide');
      $div.find('.evoSelect').toggleClass('hide');
    });

    addEvohomeControllerFunctions(block);
  });
  return true;
}

function addEvohomeControllerFunctions(block) {
  var $div = block.$mountPoint.find('.mh');
  $div.find('.btn-number').on('click', function () {
    $div.find('.evoSelect').toggleClass('hide');
    $div.find('.input-status').toggleClass('hide');
  });

  $div.find('.input-status').on('focusin', function () {
    $(this).data('oldValue', $(this).text());
  });

  $div.find('.input-status').on('change', function () {
    var status = $(this).attr('status');
    var valueCurrent = $(this).text();
    if (valueCurrent != status) {
      $div.find(".btn-number[data-type='status']").removeAttr('disabled');
    } else {
      $(this).val($(this).data('oldValue'));
    }
  });
}

function changeEvohomeControllerStatus(block, status) {
  var idx = block.device.idx;
  var dial = block.type === 'evo';
  var hasPassword = block.password;
  if (!DT_function.promptPassword(hasPassword)) {
    dial ? DT_dial.make(block) : getEvohomeControllerBlock(block);
    return;
  }
  Domoticz.syncRequest(
    idx,
    'type=command&param=switchmodal&idx=' +
      idx +
      '&status=' +
      status +
      '&action=1&used=true',
    true
  ).then(function () {
    block.device.Status = status;
    dial ? DT_dial.make(block) : getEvohomeControllerBlock(block);
  });
}

function getEvohomeHotWaterBlock(block) {
  var html = '';
  var device = block.device;
  var $div = block.$mountPoint.find('.mh');

  var untilOrLastUpdate =
    device.Status == 'Auto' || device.Status == 'TemporaryOverride'
      ? 'Until ' + moment(device.Until).format('HH:mm')
      : moment(device.LastUpdate).format(settings['timeformat']);

  var faStatus =
    device.Status == 'TemporaryOverride'
      ? 'fas fa-stopwatch'
      : 'far fa-calendar-alt';

  var name = getBlockTitle(block);
  var temp = device.Temp + _TEMP_SYMBOL;
  if (titleAndValueSwitch(block)) {
    temp = [name, (name = temp)][0];
  }

  templateEngine.load('thermostat_evo_hw').then(function (template) {
    var dataObject = {
      idx: device.idx,
      toggle: String(choose(device.State, '')).toLowerCase(),
      name: name,
      state: device.State,
      temp: temp,
      fa: faStatus,
      update: untilOrLastUpdate,
      mIcon: isDefined(block.icon) ? block.icon : '',
      mImage: isDefined(block.image) ? block.image : 'hot_water_on.png',
    };
    html = template(dataObject);
    $div.html(html);

    $div.find('.btn-number').on('click', function () {
      Domoticz.hold(block.device.idx);
      var state = device.State === 'Off' ? 'On' : 'Off';
      switchEvoHotWater(block, state, state === 'On');
    });
  });
  return true;
}

function switchEvoHotWater(block, state, override) {
  var idx = block.device.idx;
  var dial = block.type === 'dhw';
  var mode = override
    ? '&mode=TemporaryOverride&until=' +
      moment()
        .add(choose(settings['evohome_boost_hw'], 30), 'minutes')
        .format(EVO_UNTIL_FORMAT)
    : '&mode=Auto';

  var hasPassword = block.password;
  if (!DT_function.promptPassword(hasPassword)) {
    dial ? DT_dial.make(block) : getEvohomeHotWaterBlock(block);
    return;
  }
  Domoticz.syncRequest(
    idx,
    'type=command&param=setused&idx=' +
      idx +
      '&setpoint=60&state=' +
      state +
      mode +
      '&used=true',
    true
  ).then(function () {
    block.device.State = state;
    dial ? DT_dial.make(block) : getEvohomeHotWaterBlock(block);
  });
}
//# sourceURL=js/tempcontrol.js
