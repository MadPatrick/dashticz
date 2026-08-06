/* global Domoticz settings columns columns_standby blocks blocktypes screens standby_screen DashticzScreenSwitcher standbyActive language */
// eslint-disable-next-line no-unused-vars
var DashticzDeviceEditor = (function () {
  'use strict';

  /* ── state ──────────────────────────────────────────────────── */
  /* Composite keys: '493' for plain devices, '1298_1' for sub-devices */
  var managedDevices = [];   // composite keys managed by the device editor
  var managedOrder   = [];   // device:<ck> and widget:<id> in screen order
  var managedWidgets = {};   // order key -> widget metadata
  var managedSpecials = {};  // order key -> dummy/title block metadata
  var deviceNames    = {};   // composite key -> device name
  var deviceWidths   = {};   // composite key -> block width (1..12)
  var deviceHeights  = {};   // composite key -> optional block height
  var deviceTitles   = {};   // composite key -> optional title override
  var deviceOptions  = {};   // composite key -> icon/hide_data/last_update/switch
  var deviceTitleVisible = {}; // composite key -> title shown/hidden
  var deviceTextAlignment = {}; // composite key -> left/center/right
  var deviceCustomFields = {}; // composite key -> editable extra CONFIG.js fields
  var widgetWidths   = {};   // widget order key -> block width (1..12)
  var widgetHeights  = {};   // widget order key -> optional block height
  var widgetTitles   = {};   // widget order key -> optional title override
  var widgetOptions  = {};   // widget order key -> icon/hide_data/last_update
  var widgetTitleVisible = {}; // widget order key -> title shown/hidden
  var widgetTextAlignment = {}; // widget order key -> left/center/right
  var gridMode       = false;
  var gridConfig     = null;
  var gridPositions  = {};   // order key -> {x,y,w,h}
  var gridRefs       = {};   // order key -> block reference
  var gridExtras     = [];   // non-device/widget blocks
  var initialDeviceReferences = []; // editor-owned refs used to clean generated CSS
  var TITLE_GRID_HEIGHT = 3;

  function _translations() {
    var configured =
      typeof language !== 'undefined' &&
      language.settings && language.settings.deviceeditor
        ? language.settings.deviceeditor
        : {};
    return $.extend(
      {
        editor_title: 'Device Editor',
        configured_items: 'Devices and widgets in Dashticz',
        empty_items: 'No devices or widgets configured in Dashticz.',
        add_item: 'Add device or block',
        select_item: 'Select a device or block',
        dummy_device: 'Dummy device',
        title_block: 'Title',
        enter_idx: 'Enter IDX',
        enter_title: 'Enter title',
        invalid_idx: 'Enter a valid positive IDX.',
        invalid_title: 'Enter a title.',
        width: 'Width',
        title: 'Title',
        icon: 'Icon',
        hide_data: 'Hide data',
        last_update: 'Last update',
        switch: 'Switch',
        show_title: 'Title',
        text_alignment: 'Align',
        align_left: 'Left',
        align_center: 'Center',
        align_right: 'Right',
        device_config: 'Device Config',
        widget_config: 'Widget Config',
        configure: 'Configure',
        custom_fields: 'Custom fields',
        custom_fields_help: 'Field and Setting are written as typed block parameters in CONFIG.js.',
        field: 'Field',
        setting: 'Setting',
        add_field: 'Add field',
        remove_field: 'Remove field',
        invalid_field: 'Enter a valid Field and Setting.',
        duplicate_field: 'This field is duplicated or reserved.',
        invalid_setting: 'Setting contains invalid JSON.',
        cancel: 'Cancel',
        ok: 'OK',
        remove: 'Remove block',
        close: 'Close',
        save: 'Save',
        saving: 'Saving…',
        saved: 'Saved!',
        drag_to_reorder: 'Drag to reorder',
        widget: 'Widget',
        widget_prefix: 'Widget -',
        managed_widget: 'Remove this widget from the Widgets menu',
        select_aria: 'Select device to add',
        column_width: 'Column width (1-12)',
        add_device: 'Add device',
        save_failed: 'Devices could not be saved automatically.',
        error_prefix: 'Error:',
      },
      configured
    );
  }

  /* ── public API ─────────────────────────────────────────────── */
  function open() {
    gridMode = _activeScreenDom().hasClass('dt-grid-screen');
    _init();
    _buildAndShowModal();
  }

  /* ── initialise managed-device list from ALL current Dashticz devices ── */
  function _init() {
    managedDevices = [];
    managedOrder   = [];
    managedWidgets = {};
    managedSpecials = {};
    deviceNames    = {};
    deviceWidths   = {};
    deviceHeights  = {};
    deviceTitles   = {};
    deviceOptions  = {};
    deviceTitleVisible = {};
    deviceTextAlignment = {};
    deviceCustomFields = {};
    widgetWidths   = {};
    widgetHeights  = {};
    widgetTitles   = {};
    widgetOptions  = {};
    widgetTitleVisible = {};
    widgetTextAlignment = {};
    gridPositions  = {};
    gridRefs       = {};
    gridExtras     = [];
    initialDeviceReferences = [];
    gridConfig     = gridMode ? _readGridConfig() : null;

    (gridMode ? _getAllManagedGridItems() : _getAllManagedItems()).forEach(function (item) {
      managedOrder.push(item.orderKey);
      if (gridMode) {
        gridPositions[item.orderKey] = item.grid;
        gridRefs[item.orderKey] = item.reference;
      }
      if (item.kind === 'widget') {
        managedWidgets[item.orderKey] = item;
        widgetWidths[item.orderKey] = _parseWidth(item.definition.width);
        widgetHeights[item.orderKey] = _parseHeight(item.definition.height);
        widgetTitles[item.orderKey] = String(item.definition.title || item.title || '');
        widgetOptions[item.orderKey] = {
          icon: typeof item.definition.icon === 'undefined' || item.definition.icon !== '',
          iconValue: typeof item.definition.icon === 'string' && item.definition.icon !== ''
            ? item.definition.icon
            : null,
          hide_data: item.definition.hide_data === true,
          last_update: item.definition.last_update === true,
        };
        widgetTitleVisible[item.orderKey] = item.definition.hide_title !== true;
        widgetTextAlignment[item.orderKey] = _normaliseTextAlignment(
          item.definition.text_alignment || item.definition.text_align
        );
      } else if (item.kind === 'special') {
        managedSpecials[item.orderKey] = item;
        initialDeviceReferences.push(item.reference);
      } else {
        managedDevices.push(item.ck);
        initialDeviceReferences.push(item.reference || _stableDeviceReference(item.ck));
      }
    });
  }

  /* ── composite key helpers ──────────────────────────────────── */
  /* Build a composite key from a base idx and optional sub-index  */
  function _ck(idx, subidx) {
    return subidx ? (idx + '_' + subidx) : String(idx);
  }

  /* Parse a composite key back into {idx, subidx} */
  function _parseCk(ck) {
    /* group/scene key e.g. 's1' */
    if (/^s\d+$/.test(String(ck))) {
      return { idx: String(ck), subidx: 0 };
    }
    var parts = String(ck).split('_');
    return {
      idx:    parseInt(parts[0], 10),
      subidx: parts.length === 2 ? parseInt(parts[1], 10) : 0,
    };
  }

  /* Return true when ck is a group/scene composite key (e.g. 's1') */
  function _isGroupCk(ck) {
    return /^s\d+$/.test(String(ck));
  }

  /* Sort rank for available-device list: Groups first, Scenes second, Devices last */
  function _typeOrder(type) {
    if (type === 'Group') return 0;
    if (type === 'Scene') return 1;
    return 2;
  }

  /* Sort available[] by category (Group < Scene < Device) then alphabetically */
  function _sortAvailable(list) {
    list.sort(function (a, b) {
      var diff = _typeOrder(a.type) - _typeOrder(b.type);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    });
  }

  /* Convert a block reference (number / string / object) to a composite key */
  function _toCompositeKey(b) {
    if (typeof b === 'number' && b > 0) return String(b);
    if (typeof b === 'string') {
      var n = parseInt(b, 10);
      /* pure numeric string e.g. '493' */
      if (n > 0 && String(n) === b) return b;
      /* group/scene key e.g. 's1' */
      if (/^s\d+$/.test(b)) return b;
      /* compound string e.g. '1298_1' */
      var parts = b.split('_');
      if (parts.length === 2) {
        var base = parseInt(parts[0], 10);
        var sub  = parseInt(parts[1], 10);
        if (base > 0 && sub > 0) return b;
      }
      return null;
    }
    if (typeof b === 'object' && b !== null) {
      /* b.idx may be a compound string like '907_1' written by saveblocks.php */
      if (typeof b.idx === 'string') {
        var ckFromStr = _toCompositeKey(b.idx);
        if (ckFromStr) return ckFromStr;
      }
      var idx = parseInt(b.idx, 10);
      if (idx > 0) {
        var subidx = (typeof b.subidx === 'number' && b.subidx > 0) ? b.subidx : 0;
        return _ck(idx, subidx);
      }
    }
    return null;
  }

  /* ── collect every managed device from all columns ─────────── */
  function _deviceOrderKey(ck) {
    return 'device:' + ck;
  }

  function _widgetOrderKey(id) {
    return 'widget:' + id;
  }

  function _specialOrderKey(reference) {
    return 'special:' + reference;
  }

  /* Build the same immutable reference that saveblocks.php uses. Supplying the
     reference in the initial request keeps a newly added device addressable
     throughout the complete blocks -> layout save chain. */
  function _stableDeviceReference(ck) {
    if (_isGroupCk(ck)) return String(ck);
    var parsed = _parseCk(ck);
    return 'device_' + parsed.idx + (parsed.subidx ? '_' + parsed.subidx : '');
  }

  /* Recognise editor-created dummy and title blocks without treating every
     hand-written block with hide_data as a dummy device. */
  function _specialFromReference(reference) {
    if (
      typeof reference !== 'string' ||
      typeof blocks === 'undefined' ||
      !blocks[reference]
    ) {
      return null;
    }
    var definition = blocks[reference];
    var kind = null;
    if (
      /^Title_\d+$/.test(reference) &&
      String(definition.type || '').toLowerCase() === 'blocktitle'
    ) {
      kind = 'title';
    } else if (/^dummyblock_\d+$/.test(reference)) {
      kind = 'dummy';
    }
    if (!kind) return null;

    return {
      kind: 'special',
      specialType: kind,
      orderKey: _specialOrderKey(reference),
      reference: reference,
      definition: definition,
      idx: kind === 'dummy' ? parseInt(definition.idx, 10) : null,
      title: String(definition.title || (kind === 'title' ? 'Title' : reference)),
      width: _parseWidth(definition.width || (kind === 'title' ? 12 : 3)),
      height: _parseHeight(definition.height),
      options: kind === 'dummy'
        ? {
            icon: typeof definition.icon === 'undefined',
            hide_data: definition.hide_data === true,
            last_update: definition.last_update === true,
            switch: definition.switch === true,
          }
        : null,
      showTitle: definition.hide_title !== true,
      textAlignment: _normaliseTextAlignment(
        definition.text_alignment || definition.text_align
      ),
      customFields: _deviceCustomFieldRows(definition),
    };
  }

  function _widgetFromReference(reference) {
    // Use translations from the active language file (widgetEditorTranslations is defined
    // in settings.js and populated from /lang/<locale>.json settings.widgeteditor section).
    // Fall back to English when the key is missing or the variable is not yet available.
    var t =
      typeof widgetEditorTranslations !== 'undefined' ? widgetEditorTranslations : {};

    // Translated display titles keyed by widget type id.
    // This map is used both for named catalog entries (widget_xxx) and for
    // type-mapped blocks so that language changes always take effect immediately,
    // regardless of any hardcoded title stored in CONFIG.js.
    var translatedTitles = {
      weather:        t.weather_title        || 'Weather',
      garbage:        t.garbage_title        || 'Garbage',
      spotify:        t.spotify_title        || 'Spotify',
      sonarr:         t.sonarr_title         || 'Sonarr',
      clock:          t.clock_title          || 'Clock',
      calendar:       t.calendar_title       || 'Calendar (ICS)',
      secpanel:       t.secpanel_title       || 'Security panel',
      publictransport: t.publictransport_title || 'Public transport',
      trafficinfo:    t.trafficinfo_title    || 'Traffic information',
      alarmmeldingen: t.alarmmeldingen_title || '112',
      camera:         t.camera_title         || 'Cameras',
      map:            t.map_title            || 'Google Maps',
      longfonds:      t.longfonds_title      || 'Air quality',
      moon:           t.moon_title           || 'Moon',
      news:           t.news_title           || 'News',
    };

    var catalog = {
      widget_weather:         { id: 'weather',         title: translatedTitles.weather },
      widget_garbage:         { id: 'garbage',         title: translatedTitles.garbage },
      widget_spotify:         { id: 'spotify',         title: translatedTitles.spotify },
      widget_sonarr:          { id: 'sonarr',          title: translatedTitles.sonarr },
      widget_clock:           { id: 'clock',           title: translatedTitles.clock },
      widget_calendar:        { id: 'calendar',        title: translatedTitles.calendar },
      widget_secpanel:        { id: 'secpanel',        title: translatedTitles.secpanel },
      widget_publictransport: { id: 'publictransport', title: translatedTitles.publictransport },
      widget_trafficinfo:     { id: 'trafficinfo',     title: translatedTitles.trafficinfo },
      widget_alarmmeldingen:  { id: 'alarmmeldingen',  title: translatedTitles.alarmmeldingen },
      widget_cameras:         { id: 'camera',          title: translatedTitles.camera },
      widget_map:             { id: 'map',             title: translatedTitles.map },
      widget_longfonds:       { id: 'longfonds',       title: translatedTitles.longfonds },
      widget_moon:            { id: 'moon',            title: translatedTitles.moon },
      widget_news:            { id: 'news',            title: translatedTitles.news },
    };
    if (typeof blocks === 'undefined' || !blocks[reference]) {
      return null;
    }
    var definition = blocks[reference];
    var catalogItem = catalog[String(reference)];
    if (!catalogItem) {
      var type = String(definition.type || '').toLowerCase();
      var typeMap = {
        weather: 'weather',
        wunderground: 'weather',
        garbage: 'garbage',
        spotify: 'spotify',
        sonarr: 'sonarr',
        calendar: 'calendar',
        secpanel: 'secpanel',
        publictransport: 'publictransport',
        trafficinfo: 'trafficinfo',
        alarmmeldingen: 'alarmmeldingen',
        camera: 'camera',
        map: 'map',
        longfonds: 'longfonds',
        moon: 'moon',
        news: 'news',
        basicclock: 'clock',
        stationclock: 'clock',
        flipclock: 'clock',
        haymanclock: 'clock',
        miniclock: 'clock',
      };
      var id = typeMap[type];
      if (!id) return null;
      // Use the translated title for the widget type; fall back to the CONFIG.js
      // title only if the type is not in the translations map.
      catalogItem = { id: id, title: translatedTitles[id] || definition.title || id };
    }
    return {
      kind: 'widget',
      id: catalogItem.id,
      orderKey: _widgetOrderKey(catalogItem.id),
      reference: String(reference),
      // Always prefer the translated catalog title so that language changes in
      // Settings are immediately reflected, regardless of any title hardcoded
      // in CONFIG.js (e.g. title:'Afval' written in a previous language).
      title: catalogItem.title,
      definition: definition,
    };
  }

  function _copyDefinedWidgetProperties(entry, definition, properties) {
    properties.forEach(function (property) {
      if (typeof definition[property] !== 'undefined') {
        entry[property] = definition[property];
      }
    });
  }

  function _widgetCustomFields(definition) {
    var protectedFields = {
      type: true, id: true, key: true, width: true, height: true, grid: true,
      idx: true, subidx: true, icon: true, hide_data: true, last_update: true,
      hide_title: true, text_alignment: true, text_align: true, title: true,
    };
    var custom = {};
    Object.keys(definition || {}).forEach(function (property) {
      var value = definition[property];
      if (protectedFields[property] || /^_dashticz/.test(property)) return;
      if (typeof value === 'undefined' || typeof value === 'function') return;
      custom[property] = value;
    });
    return custom;
  }

  var protectedCustomDeviceProperties = {
    type: true, id: true, key: true, kind: true, width: true, height: true,
    grid: true, idx: true, subidx: true, title: true, icon: true,
    hide_data: true, last_update: true, switch: true, hide_title: true,
    text_alignment: true, text_align: true, custom_fields: true,
    __proto__: true, prototype: true, constructor: true,
  };

  function _settingToText(value) {
    if (value !== null && typeof value === 'object') {
      try { return JSON.stringify(value); } catch (ignore) { return ''; }
    }
    return String(value);
  }

  function _normaliseCustomFieldName(value) {
    value = $.trim(String(value || '')).replace(/[\s-]+/g, '_');
    if (value) value = value.charAt(0).toLowerCase() + value.slice(1);
    return value;
  }

  function _parseCustomSetting(value) {
    var text = $.trim(String(value || ''));
    if (text === 'true') return { valid: true, value: true };
    if (text === 'false') return { valid: true, value: false };
    if (/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) {
      return { valid: true, value: Number(text) };
    }
    if (/^[\[{]/.test(text)) {
      try {
        var parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object') {
          return { valid: true, value: parsed };
        }
      } catch (ignore) { /* a translated validation message is shown by the popup */ }
      return { valid: false };
    }
    return { valid: true, value: text };
  }

  function _deviceCustomFieldRows(definition) {
    var rows = [];
    Object.keys(definition || {}).forEach(function (property) {
      var lowerProperty = property.toLowerCase();
      if (protectedCustomDeviceProperties[lowerProperty] || /^_dashticz/i.test(property)) return;
      var value = definition[property];
      if (typeof value === 'undefined' || typeof value === 'function') return;
      rows.push({
        field: property,
        setting: _settingToText(value),
        value: value,
      });
    });
    return rows.length ? rows : [{ field: '', setting: '' }];
  }

  function _customFieldsObject(rows) {
    var customFields = {};
    (rows || []).forEach(function (row) {
      if (row && row.field) customFields[row.field] = row.value;
    });
    return customFields;
  }

  function _widgetPayload(orderKey) {
    var widget = managedWidgets[orderKey];
    var definition = widget.definition || {};
    var entry = {
      id: widget.id,
      width: _parseWidth(widgetWidths[orderKey]),
    };
    var title = String(widgetTitles[orderKey] || '').trim();
    if (title) entry.title = title;
    if (widgetHeights[orderKey]) entry.height = widgetHeights[orderKey];
    var displayOptions = widgetOptions[orderKey] || {};
    if (displayOptions.icon === false) {
      entry.icon = '';
    } else if (displayOptions.iconValue) {
      // Preserve a hand-written custom icon while the visible Icon option stays on.
      entry.icon = displayOptions.iconValue;
    }
    entry.hide_data = displayOptions.hide_data === true;
    entry.last_update = displayOptions.last_update === true;
    if (widgetTitleVisible[orderKey] === false) entry.hide_title = true;
    var textAlignment = _normaliseTextAlignment(widgetTextAlignment[orderKey]);
    if (textAlignment !== 'left') entry.text_alignment = textAlignment;
    if (widget.id === 'garbage') {
      entry.displayTitle = widget.title;
      _copyDefinedWidgetProperties(entry, definition, ['maxitems', 'maxdays']);
    }

    if (widget.id === 'weather') {
      entry.provider =
        definition.widget_provider ||
        (definition.type === 'wunderground'
          ? 'wunderground'
          : 'openweather');
      _copyDefinedWidgetProperties(entry, definition, [
        'showRain',
        'showDescription',
        'showWind',
        'showGust',
        'icons',
      ]);
    } else if (widget.id === 'calendar') {
      entry.icalurl = definition.icalurl || '';
      _copyDefinedWidgetProperties(entry, definition, ['maxitems']);
    } else if (widget.id === 'clock') {
      entry.clockType = definition.type || 'basicclock';
      _copyDefinedWidgetProperties(entry, definition, [
        'size',
        'scale',
        'showSeconds',
        'clockFace',
        'body',
        'dial',
        'hourhand',
        'minutehand',
        'secondhand',
        'boss',
        'minutehandbehavior',
        'secondhandbehavior',
      ]);
    } else if (widget.id === 'publictransport') {
      entry.station = definition.station || 'UT';
      entry.provider = definition.provider || 'treinen';
    } else if (widget.id === 'camera') {
      // Multi-camera blocks use a cameras array instead of the legacy URL fields.
      // Preserve that shape so opening Device Config cannot invalidate the block.
      if (Array.isArray(definition.cameras)) {
        entry.cameras = definition.cameras;
      } else {
        entry.imageUrl = definition.imageUrl || '';
        if (definition.videoUrl) entry.videoUrl = definition.videoUrl;
      }
    } else if (widget.id === 'alarmmeldingen') {
      entry.rss =
        definition.rss || 'https://www.alarmeringen.nl/feeds/all.rss';
      if (definition.filter) entry.filter = definition.filter;
    }

    // savewidgets.php rebuilds the managed block section. Re-submit every safe
    // existing property so a Device Editor save cannot erase custom widget
    // parameters created in Widget Config or added by hand.
    entry.custom_fields = _widgetCustomFields(definition);

    return entry;
  }

  function _activeScreenTarget() {
    if (
      typeof DashticzScreenSwitcher !== 'undefined' &&
      DashticzScreenSwitcher.getActiveScreenNumber
    ) {
      return DashticzScreenSwitcher.getActiveScreenNumber();
    }
    if (typeof standbyActive !== 'undefined' && standbyActive) {
      return 'standby';
    }
    var $active = $('.dt-container .screen.swiper-slide-active[data-screenindex]');
    if (!$active.length) {
      $active = $('.dt-container .screen[data-screenindex]:visible').first();
    }
    if ($('.screenstandby:visible').length) return 'standby';
    var fromDom = parseInt($active.attr('data-screenindex'), 10);
    return fromDom > 0 ? fromDom : 1;
  }

  /** Numeric screen for PHP endpoints; standby is sent as the string "standby". */
  function _activeScreenPayload() {
    var target = _activeScreenTarget();
    return target === 'standby' ? 'standby' : parseInt(target, 10) || 1;
  }

  function _activeScreenDom() {
    if (_activeScreenTarget() === 'standby') {
      var $standby = $('.screenstandby:visible');
      if ($standby.length) return $standby;
      return $('.screenstandby').first();
    }
    var num = _activeScreenPayload();
    var $byIndex = $(
      '.dt-container .screen[data-screenindex="' + num + '"]'
    );
    if ($byIndex.length) return $byIndex.first();
    var $active = $('.dt-container .screen.swiper-slide-active');
    if ($active.length) return $active;
    return $('.dt-container .screen:visible').first();
  }

  function _readGridConfig() {
    var $grid = _activeScreenDom().children('.dt-grid-layout').first();
    function number(property, fallback) {
      var value = parseFloat(
        $grid[0] ? getComputedStyle($grid[0]).getPropertyValue(property) : ''
      );
      return isFinite(value) ? value : fallback;
    }
    return {
      gridColumns: number('--dt-grid-columns', 24),
      rowHeight: number('--dt-grid-row-height', 20),
      gap: number('--dt-grid-gap', 0),
      mobileLayout: $grid.hasClass('dt-grid-mobile-stack') ? 'stack' : 'stack',
    };
  }

  function _getAllManagedGridItems() {
    var ordered = [];
    var seen = {};
    _activeScreenDom()
      .children('.dt-grid-layout')
      .children('.dt-grid-item')
      .each(function (index) {
        var reference = String($(this).attr('data-grid-block') || '');
        var definition =
          typeof blocks !== 'undefined' && blocks[reference]
            ? blocks[reference]
            : null;
        if (!definition) return;
        var grid = {
          x: _gridValue(this, '--dt-grid-x', 1),
          y: _gridValue(this, '--dt-grid-y', index + 1),
          w: _gridValue(this, '--dt-grid-w', 1),
          h: _gridValue(this, '--dt-grid-h', 1),
        };
        var special = _specialFromReference(reference);
        if (special && !seen[special.orderKey]) {
          seen[special.orderKey] = true;
          special.grid = grid;
          ordered.push(special);
          return;
        }
        var ck = _toCompositeKey(definition);
        if (ck) {
          var deviceKey = _deviceOrderKey(ck);
          if (!seen[deviceKey]) {
            seen[deviceKey] = true;
            ordered.push({
              kind: 'device',
              ck: ck,
              orderKey: deviceKey,
              reference: reference,
              grid: grid,
            });
          }
          return;
        }
        var widget = _widgetFromReference(reference);
        if (widget && !seen[widget.orderKey]) {
          seen[widget.orderKey] = true;
          widget.reference = reference;
          widget.grid = grid;
          ordered.push(widget);
          return;
        }
        gridExtras.push({ ref: reference, grid: grid });
      });
    return ordered;
  }

  function _gridValue(element, property, fallback) {
    var value = parseInt(element.style.getPropertyValue(property), 10);
    return value > 0 ? value : fallback;
  }

  function _gridOverlap(left, right) {
    return (
      left.x < right.x + right.w &&
      left.x + left.w > right.x &&
      left.y < right.y + right.h &&
      left.y + left.h > right.y
    );
  }

  function _firstFreeGridPosition(occupied, width, height) {
    for (var y = 1; y < 10000; y++) {
      for (var x = 1; x <= gridConfig.gridColumns - width + 1; x++) {
        var candidate = { x: x, y: y, w: width, h: height };
        if (
          !occupied.some(function (position) {
            return _gridOverlap(candidate, position);
          })
        ) {
          return candidate;
        }
      }
    }
    return { x: 1, y: 10000, w: width, h: height };
  }

  function _getAllManagedItems() {
    var seen = {};
    var ordered = [];
    if (typeof columns === 'undefined') return ordered;

    var columnKeys = [];
    var $activeScreen = _activeScreenDom();
    $activeScreen.find('[data-colindex]').each(function () {
      var columnKey = String($(this).attr('data-colindex'));
      if (columnKeys.indexOf(columnKey) < 0) {
        columnKeys.push(columnKey);
      }
    });

    // Standby uses columns_standby, not screens[].
    if (_activeScreenTarget() === 'standby') {
      if (typeof columns_standby !== 'undefined' && columns_standby) {
        Object.keys(columns_standby).forEach(function (colKey) {
          if (columnKeys.indexOf(String(colKey)) < 0) {
            columnKeys.push(String(colKey));
          }
        });
      }
    }

    columnKeys.forEach(function (colKey) {
      var lookupKey = String(colKey);
      if (
        _activeScreenTarget() === 'standby' &&
        /^standby/.test(lookupKey)
      ) {
        lookupKey = lookupKey.replace(/^standby/, '');
      }
      var col =
        _activeScreenTarget() === 'standby' &&
        typeof columns_standby !== 'undefined' &&
        columns_standby[lookupKey]
          ? columns_standby[lookupKey]
          : columns[colKey];
      if (!col && typeof columns !== 'undefined') {
        col = columns[lookupKey];
      }
      if (col && Array.isArray(col.blocks)) {
        col.blocks.forEach(function (b) {
          var special = _specialFromReference(b);
          if (special && !seen[special.orderKey]) {
            seen[special.orderKey] = true;
            ordered.push(special);
            return;
          }
          var ck = _toCompositeKey(b);
          if (
            !ck &&
            typeof b === 'string' &&
            typeof blocks !== 'undefined' &&
            blocks[b]
          ) {
            ck = _toCompositeKey(blocks[b]);
          }
          if (ck) {
            var deviceKey = _deviceOrderKey(ck);
            if (!seen[deviceKey]) {
              seen[deviceKey] = true;
              ordered.push({
                kind: 'device',
                ck: ck,
                orderKey: deviceKey,
                reference: typeof b === 'string'
                  ? b
                  : _stableDeviceReference(ck),
              });
            }
            return;
          }

          var widget = _widgetFromReference(b);
          if (widget && !seen[widget.orderKey]) {
            seen[widget.orderKey] = true;
            ordered.push(widget);
          }
        });
      }
    });
    return ordered;
  }

  /* ── count how many sub-values a device type has (0/1 = single) ── */
  function _getSubValueCount(device) {
    if (typeof blocktypes === 'undefined') return 0;
    var bt = blocktypes[device.Type];
    if (!bt) return 0;
    /* check sub-type first */
    var proto = bt;
    if (bt.SubType && device.SubType && bt.SubType[device.SubType]) {
      proto = bt.SubType[device.SubType];
    }
    if (Array.isArray(proto.values)) return proto.values.length;
    if (Array.isArray(bt.values))    return bt.values.length;
    return 0;
  }

  /* ── build available device list (Domoticz minus Dashticz) ─── */
  function _getAvailableDevices(managedKeys) {
    var all = Domoticz.getAllDevices();

    /* build fast lookup sets */
    var managedSet       = {};   /* all composite keys currently managed */
    var managedFullIdx   = {};   /* base idx that is managed WITHOUT a sub-index */
    managedKeys.forEach(function (ck) {
      managedSet[ck] = true;
      var p = _parseCk(ck);
      if (!p.subidx) managedFullIdx[p.idx] = true;
    });

    var available = [];
    Object.keys(all).forEach(function (key) {
      if (!key || key[0] === '_') return;   /* internal entries */

      /* group/scene key e.g. 's1' */
      if (_isGroupCk(key)) {
        if (managedSet[key]) return;
        var d    = all[key];
        var type = d.Type || 'Group';
        var prefix = type === 'Scene' ? 'Scene_' : 'Group_';
        var plainName = d.Name || key;
        available.push({
          key: key, idx: key, subidx: 0,
          name: prefix + plainName,
          plainName: plainName,
          type: type,
        });
        return;
      }

      var idx = parseInt(key, 10);
      if (!(idx > 0 && String(idx) === String(key))) return;
      if (managedFullIdx[idx]) return;      /* whole base device is already managed */

      var d        = all[key];
      var name     = d.Name || ('Device ' + key);
      var type     = d.Type  || '';
      var subCount = _getSubValueCount(d);

      if (subCount > 1) {
        /* expand into individual sub-device entries */
        for (var s = 1; s <= subCount; s++) {
          var ck = _ck(idx, s);
          if (!managedSet[ck]) {
            available.push({ key: ck, idx: idx, subidx: s,
                             name: name + '\u00a0(' + s + ')', plainName: null, type: type });
          }
        }
      } else {
        var ck = _ck(idx, 0);
        if (!managedSet[ck]) {
          available.push({ key: ck, idx: idx, subidx: 0, name: name, plainName: null, type: type });
        }
      }
    });

    _sortAvailable(available);
    return available;
  }

  /* ── build and display the modal ───────────────────────────── */
  function _buildAndShowModal() {
    $('#deviceeditorpopup').remove();

    var managedKeys = managedDevices.slice();
    var allDomoticz = Domoticz.getAllDevices();
    var available   = _getAvailableDevices(managedKeys);

    /* populate deviceNames / deviceWidths for all managed devices */
    managedKeys.forEach(function (ck) {
      var p = _parseCk(ck);
      var d = allDomoticz[String(p.idx)] || allDomoticz[p.idx];
      deviceNames[ck]  = d ? (d.Name || ('Device ' + p.idx)) : ('Device ' + p.idx);
      deviceWidths[ck] = _getConfiguredWidthForCk(ck);
      deviceHeights[ck] = _getConfiguredHeightForCk(ck);
      var configured = _getConfiguredBlockForCk(ck) || {};
      deviceTitles[ck] = configured._dashticzAutoTitle
        ? ''
        : (typeof configured.title === 'string' ? configured.title : '');
      deviceOptions[ck] = {
        icon: typeof configured.icon === 'undefined',
        hide_data: configured.hide_data === true,
        last_update: configured.last_update === true,
        switch: configured.switch === true,
      };
      deviceTitleVisible[ck] = configured.hide_title !== true;
      deviceTextAlignment[ck] = _normaliseTextAlignment(
        configured.text_alignment || configured.text_align
      );
      deviceCustomFields[ck] = _deviceCustomFieldRows(configured);
    });

    $('body').append(_buildModalHtml(available, allDomoticz));
    _attachHandlers(available, allDomoticz);

    var el = document.getElementById('deviceeditorpopup');
    if (window.bootstrap && window.bootstrap.Modal) {
      window.bootstrap.Modal.getOrCreateInstance(el).show();
    }
  }

  /* ── build the full modal HTML string ──────────────────────── */
  function _buildModalHtml(available, allDomoticz) {
    var t = _translations();
    var html = '';
    html += '<div class="modal fade" id="deviceeditorpopup" tabindex="-1"';
    html += ' aria-labelledby="de-title" aria-hidden="true">';
    html += '<div class="modal-dialog modal-xl modal-dialog-scrollable">';
    html += '<div class="modal-content">';

    /* header */
    html += '<div class="modal-header">';
    html += '<h5 class="modal-title" id="de-title">';
    html += '<i class="fas fa-pencil-alt me-2" aria-hidden="true"></i>' + _esc(t.editor_title);
    html += '</h5>';
    html += '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="' + _esc(t.close) + '"></button>';
    html += '</div>';

    /* body */
    html += '<div class="modal-body">';

    /* section 1 – current devices */
    html += '<h6 class="de-section-title">' + _esc(t.configured_items) + '</h6>';
    html += '<div id="de-device-list" class="de-device-list">';
    if (managedOrder.length === 0) {
      html += '<div class="de-empty">' + _esc(t.empty_items) + '</div>';
    } else {
      managedOrder.forEach(function (orderKey) {
        if (orderKey.indexOf('widget:') === 0) {
          html += _widgetItemHtml(orderKey);
        } else if (orderKey.indexOf('special:') === 0) {
          html += _specialItemHtml(orderKey);
        } else {
          html += _deviceItemHtml(orderKey.slice(7), allDomoticz, false);
        }
      });
    }
    html += '</div>';

    /* section 2 – add devices */
    html += '<h6 class="de-section-title mt-3">' + _esc(t.add_item) + '</h6>';
    html += '<div id="de-add-rows">';
    html += _addRowHtml(available);
    html += '</div>';

    html += '</div>'; /* modal-body */

    /* footer */
    html += '<div class="modal-footer">';
    if (typeof _PHP_INSTALLED !== 'undefined' && !_PHP_INSTALLED) {
      html += '<span class="text-danger me-auto de-nophp">';
      html += '<i class="fas fa-exclamation-triangle me-1" aria-hidden="true"></i>';
      html += 'PHP not available — saving is disabled.';
      html += '</span>';
    }
    html += '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">' + _esc(t.close) + '</button>';
    html += '<button type="button" class="btn btn-primary" id="de-save-btn"';
    if (typeof _PHP_INSTALLED !== 'undefined' && !_PHP_INSTALLED) {
      html += ' disabled';
    }
    html += '>' + _esc(t.save) + '</button>';
    html += '</div>';

    html += '</div></div></div>'; /* content, dialog, modal */
    return html;
  }

  function _configButtonHtml(orderKey, label) {
    var t = _translations();
    return '<button type="button" class="btn btn-outline-secondary btn-sm de-config-btn" ' +
      'data-order-key="' + _esc(orderKey) + '" title="' + _esc(label || t.configure) +
      '" aria-label="' + _esc(label || t.configure) + '">' +
      '<i class="fas fa-cog" aria-hidden="true"></i></button>';
  }

  function _customFieldRowHtml(row) {
    var t = _translations();
    row = row || { field: '', setting: '' };
    return '<div class="de-custom-field-row input-group input-group-sm mb-2">' +
      '<input type="text" class="form-control de-custom-field-name" placeholder="' +
      _esc(t.field) + '" value="' + _esc(row.field || '') + '">' +
      '<input type="text" class="form-control de-custom-field-setting" placeholder="' +
      _esc(t.setting) + '" value="' + _esc(row.setting || '') + '">' +
      '<button type="button" class="btn btn-outline-success de-custom-field-add" title="' +
      _esc(t.add_field) + '"><i class="fas fa-plus" aria-hidden="true"></i></button>' +
      '<button type="button" class="btn btn-outline-danger de-custom-field-remove" title="' +
      _esc(t.remove_field) + '"><i class="fas fa-minus" aria-hidden="true"></i></button>' +
      '</div>';
  }

  /* Hide the Device Editor before opening its child configuration modal. Bootstrap
     otherwise keeps the child behind the editor's modal/backdrop stacking context. */
  function _openConfigPopup(orderKey) {
    var editor = document.getElementById('deviceeditorpopup');
    var editorModal = editor && window.bootstrap && window.bootstrap.Modal
      ? window.bootstrap.Modal.getInstance(editor)
      : null;

    if (editor && editorModal && $(editor).hasClass('show')) {
      $(editor).data('de-config-transition', true);
      $(editor).one('hidden.bs.modal', function () {
        _showConfigPopup(orderKey, editor);
      });
      editorModal.hide();
      return;
    }
    _showConfigPopup(orderKey, editor);
  }

  /* Build a small editor-local popup. Values are committed to state only after
     OK, so closing the popup with Cancel cannot accidentally alter a block. */
  function _showConfigPopup(orderKey, editor) {
    var t = _translations();
    var isWidget = orderKey.indexOf('widget:') === 0;
    var isSpecial = orderKey.indexOf('special:') === 0;
    var supportsCustomFields = !isWidget;
    var ck = orderKey.indexOf('device:') === 0 ? orderKey.slice(7) : '';
    var special = isSpecial ? managedSpecials[orderKey] : null;
    var isTitle = special && special.specialType === 'title';
    var options = isWidget
      ? (widgetOptions[orderKey] || {})
      : isSpecial
        ? (special.options || {})
        : (deviceOptions[ck] || {});
    var showTitle = isWidget
      ? widgetTitleVisible[orderKey] !== false
      : isSpecial
        ? special.showTitle !== false
        : deviceTitleVisible[ck] !== false;
    var alignment = isWidget
      ? widgetTextAlignment[orderKey]
      : isSpecial
        ? special.textAlignment
        : deviceTextAlignment[ck];
    var customRows = supportsCustomFields
      ? (isSpecial ? special.customFields : deviceCustomFields[ck])
      : [];
    if (!customRows || !customRows.length) customRows = [{ field: '', setting: '' }];

    $('#de-config-popup').remove();
    var html = '<div class="modal fade de-config-popup" id="de-config-popup" tabindex="-1" aria-hidden="true">';
    html += '<div class="modal-dialog modal-dialog-centered de-config-dialog"><div class="modal-content">';
    html += '<div class="modal-header"><h5 class="modal-title">' +
      _esc(isWidget ? t.widget_config : t.device_config) + '</h5>';
    html += '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="' + _esc(t.close) + '"></button></div>';
    html += '<div class="modal-body"><div class="de-config-options">';
    if (!isTitle) {
      ['icon', 'hide_data', 'last_update'].forEach(function (option) {
        html += '<label class="form-check"><input class="form-check-input de-config-option" type="checkbox" data-option="' + option + '"';
        if (options[option]) html += ' checked';
        html += '><span class="form-check-label">' + _esc(t[option]) + '</span></label>';
      });
      if (!isWidget) {
        html += '<label class="form-check"><input class="form-check-input de-config-option" type="checkbox" data-option="switch"';
        if (options.switch) html += ' checked';
        html += '><span class="form-check-label">' + _esc(t.switch) + '</span></label>';
      }
    }
    html += '<label class="form-check"><input class="form-check-input" id="de-config-title" type="checkbox"';
    if (showTitle) html += ' checked';
    html += '><span class="form-check-label">' + _esc(t.show_title) + '</span></label>';
    html += '</div><div class="de-alignment-row">';
    html += '<span class="de-alignment-label">' + _esc(t.text_alignment) + '</span>';
    html += '<div class="de-alignment-picker" role="radiogroup" aria-label="' + _esc(t.text_alignment) + '">';
    ['left', 'center', 'right'].forEach(function (value) {
      var icon = value === 'left' ? 'fa-align-left' : value === 'center' ? 'fa-align-center' : 'fa-align-right';
      html += '<input class="btn-check" type="radio" name="de-config-alignment" id="de-config-align-' + value + '" value="' + value + '"';
      if (_normaliseTextAlignment(alignment) === value) html += ' checked';
      html += '><label class="btn btn-outline-secondary" for="de-config-align-' + value + '" title="' + _esc(t['align_' + value]) + '">';
      html += '<i class="fas ' + icon + '" aria-hidden="true"></i><span class="visually-hidden">' + _esc(t['align_' + value]) + '</span></label>';
    });
    html += '</div></div>';
    if (supportsCustomFields) {
      html += '<div class="de-custom-fields-section"><h6>' + _esc(t.custom_fields) + '</h6>';
      html += '<p class="form-text">' + _esc(t.custom_fields_help) + '</p>';
      html += '<div class="de-custom-fields">';
      customRows.forEach(function (row) { html += _customFieldRowHtml(row); });
      html += '</div></div>';
    }
    html += '<div class="de-config-message" role="status"></div></div><div class="modal-footer">';
    html += '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">' + _esc(t.cancel) + '</button>';
    html += '<button type="button" class="btn btn-primary" id="de-config-ok">' + _esc(t.ok) + '</button>';
    html += '</div></div></div></div>';
    $('body').append(html);

    var $popup = $('#de-config-popup');
    function refreshCustomFieldButtons() {
      var count = $popup.find('.de-custom-field-row').length;
      $popup.find('.de-custom-field-remove').prop('disabled', count <= 1);
    }
    $popup.on('click', '.de-custom-field-add', function () {
      $(this).closest('.de-custom-field-row').after(_customFieldRowHtml());
      refreshCustomFieldButtons();
    });
    $popup.on('click', '.de-custom-field-remove', function () {
      if ($popup.find('.de-custom-field-row').length <= 1) return;
      $(this).closest('.de-custom-field-row').remove();
      refreshCustomFieldButtons();
    });
    refreshCustomFieldButtons();

    $('#de-config-ok').on('click', function () {
      var updated = {};
      var pendingCustomFields = [];
      var customKeys = {};
      var valid = true;
      $('#de-config-popup .de-config-option').each(function () {
        updated[String($(this).attr('data-option'))] = $(this).prop('checked');
      });
      if (supportsCustomFields) {
        $popup.find('.de-custom-field-row').each(function () {
          if (!valid) return;
          var rawField = $.trim($(this).find('.de-custom-field-name').val() || '');
          var rawSetting = $.trim($(this).find('.de-custom-field-setting').val() || '');
          if (!rawField && !rawSetting) return;
          var field = _normaliseCustomFieldName(rawField);
          if (!field || !rawSetting || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(field)) {
            valid = false;
            $popup.find('.de-config-message').addClass('text-danger').text(t.invalid_field);
            $(this).find('.de-custom-field-name').trigger('focus');
            return;
          }
          var lowerField = field.toLowerCase();
          if (customKeys[lowerField] || protectedCustomDeviceProperties[lowerField]) {
            valid = false;
            $popup.find('.de-config-message').addClass('text-danger').text(t.duplicate_field);
            $(this).find('.de-custom-field-name').trigger('focus');
            return;
          }
          var parsedSetting = _parseCustomSetting(rawSetting);
          if (!parsedSetting.valid) {
            valid = false;
            $popup.find('.de-config-message').addClass('text-danger').text(t.invalid_setting);
            $(this).find('.de-custom-field-setting').trigger('focus');
            return;
          }
          customKeys[lowerField] = true;
          pendingCustomFields.push({
            field: field,
            setting: rawSetting,
            value: parsedSetting.value,
          });
        });
        if (!valid) return;
        if (!pendingCustomFields.length) {
          pendingCustomFields.push({ field: '', setting: '' });
        }
      }

      var titleVisible = $('#de-config-title').prop('checked');
      var newAlignment = _normaliseTextAlignment(
        $('#de-config-popup input[name="de-config-alignment"]:checked').val()
      );
      if (isWidget) {
        widgetOptions[orderKey] = $.extend({}, widgetOptions[orderKey], updated);
        widgetTitleVisible[orderKey] = titleVisible;
        widgetTextAlignment[orderKey] = newAlignment;
      } else if (isSpecial) {
        if (!isTitle) special.options = $.extend({}, special.options, updated);
        special.showTitle = titleVisible;
        special.textAlignment = newAlignment;
        special.customFields = pendingCustomFields;
      } else {
        deviceOptions[ck] = $.extend({}, deviceOptions[ck], updated);
        deviceTitleVisible[ck] = titleVisible;
        deviceTextAlignment[ck] = newAlignment;
        deviceCustomFields[ck] = pendingCustomFields;
      }
      window.bootstrap.Modal.getInstance(document.getElementById('de-config-popup')).hide();
    });
    var popup = document.getElementById('de-config-popup');
    popup.addEventListener('hidden.bs.modal', function () {
      $(popup).remove();
      if (editor && document.body.contains(editor)) {
        $(editor).removeData('de-config-transition');
        window.bootstrap.Modal.getOrCreateInstance(editor).show();
      }
    });
    window.bootstrap.Modal.getOrCreateInstance(popup).show();
  }

  /* ── HTML for a single device-list row ─────────────────────── */
  function _deviceItemHtml(ck, allDomoticz, isNew) {
    var t = _translations();
    var p      = _parseCk(ck);
    var isGroup = _isGroupCk(ck);
    var device = isGroup ? allDomoticz[ck] : (allDomoticz[String(p.idx)] || allDomoticz[p.idx]);
    var rawName = device ? device.Name : (isGroup ? ck : ('Device ' + p.idx));
    var type   = device ? _esc(device.Type)  : (isGroup ? 'Group' : '');
    var prefix = isGroup ? (type === 'Scene' ? 'Scene_' : 'Group_') : '';
    var name   = _esc(prefix + rawName);
    var dispIdx = isGroup ? ck : (p.subidx ? (p.idx + '_' + p.subidx) : String(p.idx));
    var cls    = 'de-device-item' + (isNew ? ' de-device-item-new' : '');
    var orderKey = _deviceOrderKey(ck);
    var html   = '<div class="' + cls + '" data-ck="' + _esc(ck) +
      '" data-order-key="' + _esc(orderKey) + '" draggable="true">';
    html += '<span class="de-drag-handle" title="' + _esc(t.drag_to_reorder) + '"><i class="fas fa-grip-vertical" aria-hidden="true"></i></span>';
    html += '<span class="de-device-idx">IDX\u00a0' + _esc(dispIdx) + '</span>';
    html += '<span class="de-device-identity"><span class="de-device-name">' + name + (!isGroup && p.subidx ? '\u00a0(' + p.subidx + ')' : '') + '</span>';
    if (type) html += '<span class="de-device-type">' + type + '</span>';
    html += '</span>';
    html += _configButtonHtml(orderKey, t.device_config);
    html += '<span class="de-device-field de-width-wrap">';
    html += '<input type="number" id="de-width-' + _esc(ck) + '" class="form-control form-control-sm de-device-width" ';
    html += 'data-ck="' + _esc(ck) + '" data-order-key="' + _esc(orderKey) +
      '" min="1" max="12" size="2" value="' + _parseWidth(deviceWidths[ck]) + '">';
    html += '<label for="de-width-' + _esc(ck) + '">' + _esc(t.width) + '</label>';
    html += '</span>';
    html += '<span class="de-device-field de-title-field">';
    html += '<input type="text" id="de-title-' + _esc(ck) + '" class="form-control form-control-sm de-device-title" ';
    html += 'data-ck="' + _esc(ck) + '" value="' + _esc(deviceTitles[ck] || '') + '">';
    html += '<label for="de-title-' + _esc(ck) + '">' + _esc(t.title) + '</label>';
    html += '</span>';
    html += '<button type="button" class="btn btn-danger btn-sm de-remove-btn ms-auto" data-ck="' + _esc(ck) + '" title="' + _esc(t.remove) + '">';
    html += '<i class="fas fa-minus" aria-hidden="true"></i>';
    html += '</button>';
    html += '</div>';
    return html;
  }

  function _widgetItemHtml(orderKey) {
    var widget = managedWidgets[orderKey];
    if (!widget) return '';
    var t = _translations();
    var html = '<div class="de-device-item de-widget-item" data-order-key="' +
      _esc(orderKey) + '" draggable="true">';
    html += '<span class="de-drag-handle" title="' + _esc(t.drag_to_reorder) + '"><i class="fas fa-grip-vertical" aria-hidden="true"></i></span>';
    html += '<span class="de-device-idx"><i class="fas fa-puzzle-piece me-1" aria-hidden="true"></i>' + _esc(t.widget) + '</span>';
    html += '<span class="de-device-identity"><span class="de-device-name">' + _esc(t.widget_prefix) + ' ' + _esc(widget.title) + '</span>';
    html += '<span class="de-device-type">' +
      _esc(widget.definition.type || widget.id) + '</span>';
    html += '</span>';
    html += _configButtonHtml(orderKey, t.widget_config);
    html += '<span class="de-device-field de-width-wrap">';
    html += '<input type="number" id="de-width-' + _esc(widget.id) +
      '" class="form-control form-control-sm de-device-width" data-order-key="' +
      _esc(orderKey) + '" min="1" max="12" size="2" value="' +
      _parseWidth(widgetWidths[orderKey]) + '">';
    html += '<label for="de-width-' +
      _esc(widget.id) + '">' + _esc(t.width) + '</label>';
    html += '</span>';
    html += '<span class="de-device-field de-title-field">';
    html += '<input type="text" id="de-title-' + _esc(widget.id) +
      '" class="form-control form-control-sm de-device-title" maxlength="100" data-order-key="' +
      _esc(orderKey) + '" value="' + _esc(widgetTitles[orderKey] || '') + '">';
    html += '<label for="de-title-' + _esc(widget.id) + '">' + _esc(t.title) + '</label>';
    html += '</span>';
    html += '<span class="de-widget-managed" title="' + _esc(t.managed_widget) + '"><i class="fas fa-lock" aria-hidden="true"></i></span>';
    html += '</div>';
    return html;
  }

  function _specialItemHtml(orderKey) {
    var special = managedSpecials[orderKey];
    if (!special) return '';
    var t = _translations();
    var isTitle = special.specialType === 'title';
    var label = isTitle ? t.title_block : t.dummy_device;
    var detail = isTitle ? special.title : 'IDX\u00a0' + special.idx;
    var html = '<div class="de-device-item de-special-item" data-special-key="' +
      _esc(special.reference) + '" data-order-key="' + _esc(orderKey) +
      '" draggable="true">';
    html += '<span class="de-drag-handle" title="' + _esc(t.drag_to_reorder) + '"><i class="fas fa-grip-vertical" aria-hidden="true"></i></span>';
    html += '<span class="de-device-idx"><i class="fas ' +
      (isTitle ? 'fa-heading' : 'fa-cube') + ' me-1" aria-hidden="true"></i>' +
      _esc(label) + '</span>';
    html += '<span class="de-device-identity de-special-identity">';
    html += '<span class="de-device-name">' + _esc(detail) + '</span></span>';
    html += _configButtonHtml(orderKey, t.device_config);
    html += '<span class="de-device-field de-width-wrap">';
    html += '<input type="number" id="de-width-' + _esc(special.reference) +
      '" class="form-control form-control-sm de-device-width" data-order-key="' +
      _esc(orderKey) + '" min="1" max="12" size="2" value="' + special.width + '">';
    html += '<label class="de-device-width-label" for="de-width-' +
      _esc(special.reference) + '">' + _esc(t.width) + '</label>';
    html += '</span>';
    html += '<span class="de-device-field de-title-field">';
    html += '<input type="text" id="de-title-' + _esc(special.reference) +
      '" class="form-control form-control-sm de-device-title" maxlength="100" data-order-key="' +
      _esc(orderKey) + '" value="' + _esc(special.title || '') + '">';
    html += '<label for="de-title-' + _esc(special.reference) + '">' + _esc(t.title) + '</label>';
    html += '</span>';
    html += '<button type="button" class="btn btn-danger btn-sm de-remove-btn ms-auto" data-special-key="' +
      _esc(special.reference) + '" title="' + _esc(t.remove) + '">';
    html += '<i class="fas fa-minus" aria-hidden="true"></i></button></div>';
    return html;
  }

  /* ── HTML for one add-row (select + button) ─────────────────── */
  function _addRowHtml(deviceList) {
    var t = _translations();
    var html = '<div class="de-add-row">';
    html += '<select class="form-select de-device-select" aria-label="' + _esc(t.select_aria) + '">';
    html += '<option value="">— ' + _esc(t.select_item) + ' —</option>';
    html += '<option value="__dummy__">' + _esc(t.dummy_device) + '</option>';
    html += '<option value="" disabled>------</option>';
    html += '<option value="__title__">' + _esc(t.title_block) + '</option>';
    html += '<option value="" disabled>------</option>';
    deviceList.forEach(function (d) {
      var dispIdx = d.subidx ? (d.idx + '_' + d.subidx) : String(d.idx);
      html += '<option value="' + _esc(d.key) + '" data-type-order="' + _typeOrder(d.type) + '">' + _esc(d.name) + ' (IDX\u00a0' + dispIdx + ')</option>';
    });
    html += '</select>';
    html += '<input type="number" class="form-control form-control-sm de-width-input" min="1" max="12" size="2" value="3" title="' + _esc(t.column_width) + '" aria-label="' + _esc(t.width) + '">';
    html += '<input type="text" class="form-control form-control-sm de-special-value d-none" aria-label="">';
    html += '<button type="button" class="btn btn-success btn-sm de-add-btn ms-2" title="' + _esc(t.add_device) + '">';
    html += '<i class="fas fa-plus" aria-hidden="true"></i>';
    html += '</button>';
    html += '</div>';
    return html;
  }

  function _nextSpecialReference(type) {
    var prefix = type === 'title' ? 'Title_' : 'dummyblock_';
    var used = {};
    if (typeof blocks !== 'undefined') {
      Object.keys(blocks).forEach(function (key) {
        used[key] = true;
      });
    }
    Object.keys(managedSpecials).forEach(function (orderKey) {
      used[managedSpecials[orderKey].reference] = true;
    });
    var number = 1;
    while (used[prefix + number]) number++;
    return prefix + number;
  }

  /* ── wire up event handlers ─────────────────────────────────── */
  function _attachHandlers(available, allDomoticz) {
    $('#de-device-list').on('click', '.de-config-btn', function () {
      _openConfigPopup(String($(this).attr('data-order-key') || ''));
    });

    /* - (remove) button */
    $('#de-device-list').on('click', '.de-remove-btn', function () {
      var specialKey = String($(this).attr('data-special-key') || '');
      if (specialKey) {
        var specialOrderKey = _specialOrderKey(specialKey);
        delete managedSpecials[specialOrderKey];
        delete gridPositions[specialOrderKey];
        delete gridRefs[specialOrderKey];
        var specialPos = managedOrder.indexOf(specialOrderKey);
        if (specialPos > -1) managedOrder.splice(specialPos, 1);
        $(this).closest('.de-device-item').remove();
        if ($('#de-device-list .de-device-item').length === 0) {
          $('#de-device-list').html(
            '<div class="de-empty">' + _esc(_translations().empty_items) + '</div>'
          );
        }
        return;
      }
      var ck  = String($(this).attr('data-ck'));
      var pos = managedDevices.indexOf(ck);
      if (pos > -1) managedDevices.splice(pos, 1);
      var orderPos = managedOrder.indexOf(_deviceOrderKey(ck));
      if (orderPos > -1) managedOrder.splice(orderPos, 1);
      delete deviceNames[ck];
      delete deviceWidths[ck];
      delete deviceHeights[ck];
      delete deviceTitles[ck];
      delete deviceOptions[ck];
      delete deviceTitleVisible[ck];
      delete deviceTextAlignment[ck];
      delete deviceCustomFields[ck];
      delete gridPositions[_deviceOrderKey(ck)];
      delete gridRefs[_deviceOrderKey(ck)];

      /* remove item from device-list */
      $(this).closest('.de-device-item').remove();
      if ($('#de-device-list .de-device-item').length === 0) {
        $('#de-device-list').html('<div class="de-empty">' + _esc(_translations().empty_items) + '</div>');
      }

      /* restore device in add-row dropdown and in available[] */
      var p      = _parseCk(ck);
      var isGroup = _isGroupCk(ck);
      var device = isGroup ? allDomoticz[ck] : (allDomoticz[String(p.idx)] || allDomoticz[p.idx]);
      var rawName = device ? device.Name : (isGroup ? ck : ('Device ' + p.idx));
      var type   = device ? (device.Type || '') : (isGroup ? 'Group' : '');
      var groupPrefix = isGroup ? (type === 'Scene' ? 'Scene_' : 'Group_') : '';
      var displayName = groupPrefix + rawName + (!isGroup && p.subidx ? '\u00a0(' + p.subidx + ')' : '');
      var dispIdx     = isGroup ? ck : (p.subidx ? (p.idx + '_' + p.subidx) : String(p.idx));

      /* keep available[] in sync so subsequent + rows include this device */
      if (!available.some(function (d) { return d.key === ck; })) {
        available.push({ key: ck, idx: p.idx, subidx: p.subidx,
                         name: displayName, plainName: isGroup ? rawName : null, type: type });
        _sortAvailable(available);
      }

      var newTypeOrder = _typeOrder(type);
      var newText = displayName + ' (IDX\u00a0' + dispIdx + ')';
      var optHtml = '<option value="' + _esc(ck) + '" data-type-order="' + newTypeOrder + '">' +
                    _esc(displayName) + ' (IDX\u00a0' + dispIdx + ')</option>';

      var $select = $('#de-add-rows .de-device-select');
      if ($select.length) {
        /* insert in category + alphabetical order */
        var inserted = false;
        $select.find('option').each(function () {
          if (!$(this).val() || /^__/.test(String($(this).val()))) return;
          var optTypeOrder = parseInt($(this).attr('data-type-order') || '2', 10);
          var cmp = newTypeOrder !== optTypeOrder
            ? newTypeOrder - optTypeOrder
            : newText.localeCompare($(this).text());
          if (cmp < 0) {
            $(this).before(optHtml);
            inserted = true;
            return false;
          }
        });
        if (!inserted) $select.append(optHtml);
        /* remove "all devices added" message if present */
        $('#de-add-rows .de-empty').remove();
      } else {
        /* no add-row exists yet — create one with this single device */
        $('#de-add-rows').html(_addRowHtml([{ key: ck, idx: p.idx, subidx: p.subidx,
                                              name: displayName, plainName: isGroup ? rawName : null, type: type }]));
      }
    });

    $('#de-device-list').on('input change', '.de-device-width', function () {
      var orderKey = String($(this).attr('data-order-key') || '');
      if (!orderKey) return;
      var width = _parseWidth($(this).val());
      if (orderKey.indexOf('widget:') === 0) {
        widgetWidths[orderKey] = width;
      } else if (orderKey.indexOf('special:') === 0) {
        managedSpecials[orderKey].width = width;
      } else {
        deviceWidths[orderKey.slice(7)] = width;
      }
      $(this).val(width);
    });

    /* Keep the editable title and display options in state for saving. */
    $('#de-device-list').on('input change', '.de-device-title', function () {
      var orderKey = String($(this).attr('data-order-key') || '');
      var value = String($(this).val() || '').trim();
      if (orderKey.indexOf('widget:') === 0) {
        widgetTitles[orderKey] = value;
      } else if (orderKey.indexOf('special:') === 0) {
        if (managedSpecials[orderKey]) managedSpecials[orderKey].title = value;
      } else {
        deviceTitles[String($(this).attr('data-ck') || '')] = value;
      }
    });
    $('#de-add-rows').on('change', '.de-device-select', function () {
      var $row = $(this).closest('.de-add-row');
      var $value = $row.find('.de-special-value');
      var selected = String($(this).val() || '');
      var t = _translations();
      if (selected === '__dummy__') {
        $value.attr({ type: 'number', min: '1', placeholder: t.enter_idx,
          'aria-label': t.enter_idx }).val('').removeClass('d-none');
        $row.find('.de-width-input').val(3);
      } else if (selected === '__title__') {
        $value.removeAttr('min').attr({ type: 'text', placeholder: t.enter_title,
          'aria-label': t.enter_title }).val('').removeClass('d-none');
        $row.find('.de-width-input').val(12);
      } else {
        $value.val('').addClass('d-none');
        $row.find('.de-width-input').val(3);
      }
    });

    /* + button */
    $('#de-add-rows').on('click', '.de-add-btn', function () {
      var $row    = $(this).closest('.de-add-row');
      var $select = $row.find('.de-device-select');
      var ck      = $select.val();
      if (!ck) return;

      if (ck === '__dummy__' || ck === '__title__') {
        var specialType = ck === '__title__' ? 'title' : 'dummy';
        var rawValue = String($row.find('.de-special-value').val() || '').trim();
        var t = _translations();
        var idx = specialType === 'dummy' ? parseInt(rawValue, 10) : null;
        if (specialType === 'dummy' && !(idx > 0 && String(idx) === rawValue)) {
          alert(t.invalid_idx);
          return;
        }
        if (specialType === 'title' && !rawValue) {
          alert(t.invalid_title);
          return;
        }
        var reference = _nextSpecialReference(specialType);
        var specialOrderKey = _specialOrderKey(reference);
        var numberMatch = reference.match(/(\d+)$/);
        var special = {
          kind: 'special',
          specialType: specialType,
          orderKey: specialOrderKey,
          reference: reference,
          definition: {},
          idx: idx,
          title: specialType === 'title'
            ? rawValue.slice(0, 100)
            : 'Dummy_' + (numberMatch ? numberMatch[1] : '1'),
          width: _parseWidth($row.find('.de-width-input').val()),
          height: specialType === 'title' ? 120 : null,
          showTitle: true,
          textAlignment: 'left',
          options: specialType === 'dummy'
            ? { icon: true, hide_data: true, last_update: false, switch: false }
            : null,
          customFields: [{ field: '', setting: '' }],
        };
        managedSpecials[specialOrderKey] = special;
        managedOrder.push(specialOrderKey);
        $('#de-device-list .de-empty').remove();
        $('#de-device-list').append(_specialItemHtml(specialOrderKey));
        $select.val('').trigger('change');
        return;
      }

      if (managedDevices.indexOf(ck) < 0) managedDevices.push(ck);
      if (managedOrder.indexOf(_deviceOrderKey(ck)) < 0) {
        managedOrder.push(_deviceOrderKey(ck));
      }
      deviceWidths[ck] = _parseWidth($row.find('.de-width-input').val());
      deviceTitles[ck] = '';
      deviceOptions[ck] = {
        icon: true, hide_data: true, last_update: false, switch: false,
      };
      deviceTitleVisible[ck] = true;
      deviceTextAlignment[ck] = 'left';
      deviceCustomFields[ck] = [{ field: '', setting: '' }];

      /* record the device name for this composite key */
      /* for groups, use plainName (without Group_/Scene_ prefix) so the block title is clean */
      var addedName = _isGroupCk(ck) ? ck : ('Device ' + _parseCk(ck).idx);
      for (var di = 0; di < available.length; di++) {
        if (available[di].key === ck) {
          addedName = available[di].plainName || available[di].name;
          break;
        }
      }
      deviceNames[ck] = addedName;

      /* update device-list section */
      $('#de-device-list .de-empty').remove();
      $('#de-device-list').append(_deviceItemHtml(ck, allDomoticz, true));

      /* remove the completed row */
      $row.remove();

      /* remove added device from every remaining select */
      $('#de-add-rows .de-device-select option[value="' + ck + '"]').remove();

      /* Always add a fresh row: Dummy and Title remain available even when
         every Domoticz device has already been added. */
      var remaining = available.filter(function (d) {
        return managedDevices.indexOf(d.key) < 0;
      });
      $('#de-add-rows .de-empty').remove();
      var $newRow = $(_addRowHtml(remaining));
      /* remove already-managed keys from the new select */
      managedDevices.forEach(function (mck) {
        $newRow.find('option[value="' + mck + '"]').remove();
      });
      $('#de-add-rows').append($newRow);
    });

    /* drag-and-drop reordering */
    var $list = $('#de-device-list');
    var dragSrcEl = null;

    $list.on('dragstart', '.de-device-item', function (e) {
      dragSrcEl = this;
      e.originalEvent.dataTransfer.effectAllowed = 'move';
      e.originalEvent.dataTransfer.setData(
        'text/plain',
        String($(this).attr('data-order-key'))
      );
      $(this).addClass('de-drag-dragging');
    });

    $list.on('dragend', '.de-device-item', function () {
      $(this).removeClass('de-drag-dragging');
      $list.find('.de-drag-over-top, .de-drag-over-bottom')
        .removeClass('de-drag-over-top de-drag-over-bottom');
    });

    $list.on('dragover', '.de-device-item', function (e) {
      e.preventDefault();
      e.originalEvent.dataTransfer.dropEffect = 'move';
      if (this === dragSrcEl) return;
      var rect  = this.getBoundingClientRect();
      var above = e.originalEvent.clientY < rect.top + rect.height / 2;
      $(this).toggleClass('de-drag-over-top', above)
             .toggleClass('de-drag-over-bottom', !above);
    });

    $list.on('dragleave', '.de-device-item', function (e) {
      /* only clear when leaving the item itself, not a child */
      if (!this.contains(e.originalEvent.relatedTarget)) {
        $(this).removeClass('de-drag-over-top de-drag-over-bottom');
      }
    });

    $list.on('drop', '.de-device-item', function (e) {
      e.preventDefault();
      if (!dragSrcEl || this === dragSrcEl) return;
      var rect  = this.getBoundingClientRect();
      var above = e.originalEvent.clientY < rect.top + rect.height / 2;
      if (above) {
        $(this).before(dragSrcEl);
      } else {
        $(this).after(dragSrcEl);
      }
      $(this).removeClass('de-drag-over-top de-drag-over-bottom');
      /* sync the combined device/widget order from the DOM */
      managedOrder = [];
      $list.find('.de-device-item').each(function () {
        managedOrder.push(String($(this).attr('data-order-key')));
      });
    });

    /* save button */
    $('#deviceeditorpopup').on('click', '#de-save-btn', _save);

    /* cleanup on hide */
    $('#deviceeditorpopup').on('hidden.bs.modal', function () {
      if ($(this).data('de-config-transition')) return;
      $(this).remove();
    });
  }

  function _widthForOrderKey(orderKey) {
    if (orderKey.indexOf('widget:') === 0) {
      return _parseWidth(widgetWidths[orderKey]);
    }
    if (orderKey.indexOf('special:') === 0) {
      return _parseWidth(managedSpecials[orderKey].width);
    }
    return _parseWidth(deviceWidths[orderKey.slice(7)]);
  }

  function _heightForOrderKey(orderKey) {
    if (orderKey.indexOf('widget:') === 0) return widgetHeights[orderKey];
    if (orderKey.indexOf('special:') === 0) {
      return managedSpecials[orderKey].height;
    }
    return deviceHeights[orderKey.slice(7)];
  }

  /* ── save to CONFIG.js via PHP ──────────────────────────────── */
  function _save() {
    var t = _translations();
    var $btn = $('#de-save-btn').prop('disabled', true).text(t.saving);

    var orderedBlockKeys = managedOrder
      .filter(function (orderKey) {
        return orderKey.indexOf('widget:') !== 0;
      });
    var devicePayload = orderedBlockKeys.map(function (orderKey) {
      if (orderKey.indexOf('special:') === 0) {
        var special = managedSpecials[orderKey];
        var specialEntry = {
          kind: special.specialType,
          key: special.reference,
          title: special.title,
          width: _parseWidth(special.width),
        };
        if (special.showTitle === false) specialEntry.hide_title = true;
        var specialCustomFields = _customFieldsObject(special.customFields);
        if (Object.keys(specialCustomFields).length) {
          specialEntry.custom_fields = specialCustomFields;
        }
        var specialTextAlignment = _normaliseTextAlignment(
          special.textAlignment
        );
        if (specialTextAlignment !== 'left') {
          specialEntry.text_alignment = specialTextAlignment;
        }
        if (special.specialType === 'dummy') {
          specialEntry.idx = special.idx;
          var specialOptions = special.options || {};
          if (specialOptions.icon === false) specialEntry.icon = '';
          specialEntry.hide_data = specialOptions.hide_data === true;
          specialEntry.last_update = specialOptions.last_update === true;
          specialEntry.switch = specialOptions.switch === true;
        }
        if (special.height) specialEntry.height = special.height;
        return specialEntry;
      }
      var ck = orderKey.slice(7);
      var p   = _parseCk(ck);
      var entry = {
        idx:   p.idx,
        name:  deviceNames[ck] || ('Device ' + p.idx),
        width: _parseWidth(deviceWidths[ck]),
        key:   _stableDeviceReference(ck),
      };
      var title = String(deviceTitles[ck] || '').trim();
      var options = deviceOptions[ck] || {};
      if (title) entry.title = title;
      if (options.icon === false) entry.icon = '';
      entry.hide_data = options.hide_data === true;
      entry.last_update = options.last_update === true;
      entry.switch = options.switch === true;
      if (deviceTitleVisible[ck] === false) entry.hide_title = true;
      var deviceAlignment = _normaliseTextAlignment(deviceTextAlignment[ck]);
      if (deviceAlignment !== 'left') entry.text_alignment = deviceAlignment;
      var customFields = _customFieldsObject(deviceCustomFields[ck]);
      if (Object.keys(customFields).length) entry.custom_fields = customFields;
      if (p.subidx) entry.subidx = p.subidx;
      if (deviceHeights[ck]) entry.height = deviceHeights[ck];
      // Never retain a legacy name-based reference: Domoticz names may change.
      return entry;
    });

    var orderedWidgetKeys = managedOrder.filter(function (orderKey) {
      return orderKey.indexOf('widget:') === 0;
    });
    var widgetPayload = orderedWidgetKeys.map(function (orderKey) {
      var entry = _widgetPayload(orderKey);
      if (gridMode && gridRefs[orderKey]) entry.key = gridRefs[orderKey];
      return entry;
    });

    $.getJSON(settings['dashticz_php_path'] + 'info.php?get=csrf')
      .then(function (data) {
        var token = data.token;
        return _postEditorData(
          'js/saveblocks.php',
          {
            devices: devicePayload,
            screen: _activeScreenPayload(),
            blocksOnly: gridMode,
          },
          token
        ).then(function (deviceResult) {
          // Widget display options must also be persisted on grid screens.
          // Passing the stable grid key lets savewidgets.php rebuild only the
          // editor-owned widget blocks before savegridlayout.php rewrites order.
          var widgetSave = _postEditorData(
            'js/savewidgets.php',
            {
              widgets: widgetPayload,
              screen: _activeScreenPayload(),
              blocksOnly: gridMode,
            },
            token
          );
          return widgetSave.then(function (widgetResult) {
            var blockRefs = {};
            var widgetRefs = {};
            orderedBlockKeys.forEach(function (orderKey, index) {
              blockRefs[orderKey] = deviceResult.blockKeys[index];
            });
            orderedWidgetKeys.forEach(function (orderKey, index) {
              widgetRefs[orderKey] = widgetResult.blockKeys[index];
            });
            var currentDeviceReferences = [];
            var deviceAlignments = {};
            orderedBlockKeys.forEach(function (orderKey) {
              var reference = blockRefs[orderKey];
              if (!reference) return;
              currentDeviceReferences.push(reference);
              if (orderKey.indexOf('special:') === 0) {
                deviceAlignments[reference] = _normaliseTextAlignment(
                  managedSpecials[orderKey].textAlignment
                );
              } else {
                deviceAlignments[reference] = _normaliseTextAlignment(
                  deviceTextAlignment[orderKey.slice(7)]
                );
              }
            });
            var removedDeviceReferences = initialDeviceReferences.filter(
              function (reference) {
                return currentDeviceReferences.indexOf(reference) < 0;
              }
            );
            var cssSave = _postEditorData(
              'js/savecustomcss.php',
              {
                deviceAlignments: deviceAlignments,
                removeDeviceAlignments: removedDeviceReferences,
              },
              token
            );
            if (gridMode) {
              var occupied = gridExtras
                .map(function (item) {
                  return item.grid;
                })
                .concat(
                  Object.keys(gridPositions).map(function (orderKey) {
                    return gridPositions[orderKey];
                  })
                );
              var gridItems = managedOrder.map(function (orderKey) {
                var isWidget = orderKey.indexOf('widget:') === 0;
                var ref = isWidget
                  ? widgetRefs[orderKey]
                  : blockRefs[orderKey];
                var position = gridPositions[orderKey];
                if (!position) {
                  var width12 = _widthForOrderKey(orderKey);
                  var pixelHeight = _heightForOrderKey(orderKey);
                  var width = Math.max(
                    1,
                    Math.min(
                      gridConfig.gridColumns,
                      Math.round(
                        (width12 * gridConfig.gridColumns) / 12
                      )
                    )
                  );
                  var isTitleBlock =
                    orderKey.indexOf('special:') === 0 &&
                    managedSpecials[orderKey].specialType === 'title';
                  var height = isTitleBlock
                    ? TITLE_GRID_HEIGHT
                    : Math.max(
                        1,
                        Math.ceil(
                          ((pixelHeight || 120) + gridConfig.gap) /
                            (gridConfig.rowHeight + gridConfig.gap)
                        )
                      );
                  position = _firstFreeGridPosition(
                    occupied,
                    width,
                    height
                  );
                  occupied.push(position);
                }
                return { ref: ref, grid: $.extend({}, position) };
              });
              gridItems = gridItems.concat(gridExtras);
              return $.when(
                cssSave,
                _postEditorData(
                  'js/savegridlayout.php',
                  {
                    items: gridItems,
                    screen: _activeScreenPayload(),
                    gridColumns: gridConfig.gridColumns,
                    rowHeight: gridConfig.rowHeight,
                    gap: gridConfig.gap,
                    mobileLayout: gridConfig.mobileLayout,
                  },
                  token
                )
              );
            }
            var layoutItems = managedOrder.map(function (orderKey) {
              var isWidget = orderKey.indexOf('widget:') === 0;
              var entry = {
                ref: isWidget ? widgetRefs[orderKey] : blockRefs[orderKey],
                width: _widthForOrderKey(orderKey),
              };
              var height = _heightForOrderKey(orderKey);
              if (height) entry.height = height;
              return entry;
            });
            if (_activeScreenTarget() === 'standby') {
              layoutItems = _preserveStandbyExtraBlocks(layoutItems);
            }
            return $.when(
              cssSave,
              _postEditorData(
                'js/savelayout.php',
                { items: layoutItems, screen: _activeScreenPayload() },
                token
              )
            );
          });
        });
      })
      .done(function () {
        $btn.removeClass('btn-primary').addClass('btn-success').text(t.saved);
        setTimeout(function () {
          var el = document.getElementById('deviceeditorpopup');
          if (el && window.bootstrap) {
            window.bootstrap.Modal.getInstance(el).hide();
          }
          // eslint-disable-next-line no-self-assign
          window.location.href = window.location.href;
        }, 900);
      })
      .fail(function (xhr) {
        var msg = xhr.responseJSON && xhr.responseJSON.error
          ? xhr.responseJSON.error
          : t.save_failed;
        $btn.prop('disabled', false).text(t.save);
        alert(t.error_prefix + ' ' + msg);
      });
  }

  function _preserveStandbyExtraBlocks(layoutItems) {
    var known = {};
    layoutItems.forEach(function (item) {
      if (item && item.ref) known[item.ref] = true;
    });
    var preserved = [];
    if (
      typeof columns_standby !== 'undefined' &&
      columns_standby &&
      columns_standby[1] &&
      Array.isArray(columns_standby[1].blocks)
    ) {
      columns_standby[1].blocks.forEach(function (ref) {
        if (typeof ref !== 'string' || known[ref]) return;
        // Keep simple/hand-written standby blocks (clock, weather, …).
        if (_toCompositeKey(ref) || _widgetFromReference(ref)) return;
        preserved.push({ ref: ref, width: 12 });
        known[ref] = true;
      });
    }
    return preserved.concat(layoutItems);
  }

  function _postEditorData(url, payload, token) {
    return $.ajax({
      url: configEditorUrl(url),
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(payload),
      dataType: 'json',
      headers: { 'X-Dashticz-CSRF': token },
    });
  }

  /* ── HTML-escape helper ─────────────────────────────────────── */
  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _parseWidth(value) {
    var width = parseInt(value, 10);
    if (!width) width = 3;
    return Math.max(1, Math.min(12, width));
  }

  /* Find the CONFIG.js block definition associated with a composite IDX. */
  function _getConfiguredBlockForCk(ck) {
    if (typeof blocks === 'undefined') return null;
    var keys = Object.keys(blocks);
    for (var i = 0; i < keys.length; i++) {
      if (_toCompositeKey(blocks[keys[i]]) === ck) return blocks[keys[i]];
    }
    return null;
  }

  function _getConfiguredWidthForCk(ck) {
    if (typeof columns !== 'undefined') {
      var colKeys = Object.keys(columns);
      for (var i = 0; i < colKeys.length; i++) {
        var col = columns[colKeys[i]];
        if (!col || !Array.isArray(col.blocks)) continue;
        for (var j = 0; j < col.blocks.length; j++) {
          var ref   = col.blocks[j];
          var block = null;
          var refCk = _toCompositeKey(ref);
          if (typeof ref === 'string' && typeof blocks !== 'undefined' && blocks[ref]) {
            block = blocks[ref];
            if (!refCk) refCk = _toCompositeKey(block);
          } else if (typeof ref === 'object' && ref !== null) {
            block = ref;
          }
          if (refCk === ck && block && typeof block.width !== 'undefined') {
            return _parseWidth(block.width);
          }
        }
      }
    }

    if (typeof blocks !== 'undefined') {
      var blockKeys = Object.keys(blocks);
      for (var bi = 0; bi < blockKeys.length; bi++) {
        var b = blocks[blockKeys[bi]];
        if (_toCompositeKey(b) === ck && b && typeof b.width !== 'undefined') {
          return _parseWidth(b.width);
        }
      }
    }
    return 3;
  }

  function _getConfiguredHeightForCk(ck) {
    if (typeof columns !== 'undefined') {
      var colKeys = Object.keys(columns);
      for (var i = 0; i < colKeys.length; i++) {
        var col = columns[colKeys[i]];
        if (!col || !Array.isArray(col.blocks)) continue;
        for (var j = 0; j < col.blocks.length; j++) {
          var ref = col.blocks[j];
          var block = null;
          var refCk = _toCompositeKey(ref);
          if (typeof ref === 'string' && typeof blocks !== 'undefined' && blocks[ref]) {
            block = blocks[ref];
            if (!refCk) refCk = _toCompositeKey(block);
          } else if (typeof ref === 'object' && ref !== null) {
            block = ref;
          }
          if (refCk === ck && block && typeof block.height !== 'undefined') {
            return _parseHeight(block.height);
          }
        }
      }
    }
    return null;
  }

  function _parseHeight(value) {
    var height = parseInt(value, 10);
    if (!(height > 0)) return null;
    return Math.max(50, Math.min(2000, Math.round(height / 10) * 10));
  }

  function _normaliseTextAlignment(value) {
    value = String(value || '').toLowerCase();
    return ['left', 'center', 'right'].indexOf(value) > -1
      ? value
      : 'left';
  }

  return { open: open };
}());

//# sourceURL=js/deviceeditor.js
