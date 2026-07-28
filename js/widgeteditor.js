/* global settings columns blocks screens language */
// eslint-disable-next-line no-unused-vars
var DashticzWidgetEditor = (function () {
  'use strict';

  var catalog = [
    {
      id: 'weather',
      blockKey: 'widget_weather',
      title: 'Weer',
      description: 'Weersverwachting via OpenWeather of Weather Underground.',
      icon: 'fas fa-cloud-sun',
      width: 12,
    },
    {
      id: 'garbage',
      blockKey: 'widget_garbage',
      title: 'Afval',
      description: 'Aankomende afvalinzamelingen.',
      icon: 'fas fa-trash-alt',
      width: 6,
    },
    {
      id: 'spotify',
      blockKey: 'widget_spotify',
      title: 'Spotify',
      description: 'Spotify Connect-afstandsbediening.',
      icon: 'fab fa-spotify',
      width: 6,
    },
    {
      id: 'sonarr',
      blockKey: 'widget_sonarr',
      title: 'Sonarr',
      description: 'Aankomende afleveringen uit Sonarr.',
      icon: 'fas fa-tv',
      width: 8,
    },
    {
      id: 'clock',
      blockKey: 'widget_clock',
      title: 'Klok',
      description: 'Grote klok met datum en weekdag.',
      icon: 'far fa-clock',
      width: 4,
    },
    {
      id: 'calendar',
      blockKey: 'widget_calendar',
      title: 'Kalender (ICS)',
      description: 'Afspraken uit een online ICS-agenda.',
      icon: 'fas fa-calendar-alt',
      width: 8,
    },
    {
      id: 'secpanel',
      blockKey: 'widget_secpanel',
      title: 'Security panel',
      description: 'Domoticz security panel met pincode.',
      icon: 'fas fa-shield-alt',
      width: 12,
    },
    {
      id: 'publictransport',
      blockKey: 'widget_publictransport',
      title: 'Openbaar vervoer',
      description: 'Vertrektijden van treinen, bus of tram.',
      icon: 'fas fa-train',
      width: 12,
    },
    {
      id: 'trafficinfo',
      blockKey: 'widget_trafficinfo',
      title: 'Verkeersinfo',
      description: 'ANWB files, werkzaamheden en radars.',
      icon: 'fas fa-car',
      width: 12,
    },
    {
      id: 'alarmmeldingen',
      blockKey: 'widget_alarmmeldingen',
      title: '112',
      description: 'Nederlandse 112-meldingen (alarmeringen.nl).',
      icon: 'fas fa-bullhorn',
      width: 12,
    },
    {
      id: 'camera',
      blockKey: 'widget_cameras',
      title: "Camera's",
      description: 'Camera-beeld of MJPEG-stream.',
      icon: 'fas fa-video',
      width: 6,
    },
    {
      id: 'map',
      blockKey: 'widget_map',
      title: 'Google Maps',
      description: 'Kaart met optioneel verkeer en route.',
      icon: 'fas fa-map-marked-alt',
      width: 12,
    },
    {
      id: 'longfonds',
      blockKey: 'widget_longfonds',
      title: 'Luchtkwaliteit',
      description: 'Longfonds / RIVM luchtkwaliteit op postcode.',
      icon: 'fas fa-wind',
      width: 6,
    },
    {
      id: 'moon',
      blockKey: 'widget_moon',
      title: 'Maan',
      description: 'Huidige maanstand.',
      icon: 'fas fa-moon',
      width: 3,
    },
    {
      id: 'news',
      blockKey: 'widget_news',
      title: 'Nieuws',
      description: 'RSS-nieuwsfeed met automatische scroll.',
      icon: 'fas fa-newspaper',
      width: 12,
    },
  ];

  var _CALENDAR_LANGUAGES = {
    zh_CN: 'Chinese',
    da_DK: 'Danish',
    de_DE: 'Duits',
    en_US: 'Engels',
    es_ES: 'Spaans',
    fi_FI: 'Fins',
    fr_FR: 'Frans',
    hu_HU: 'Hongaars',
    it_IT: 'Italiaans',
    ja_JP: 'Japans',
    lt_LT: 'Litouws',
    nl_NL: 'Nederlands',
    nb_NO: 'Noors',
    pl_PL: 'Pools',
    pt_PT: 'Portugees',
    ro_RO: 'Roemeens',
    ru_RU: 'Russisch',
    sk_SK: 'Slowaaks',
    sl_SL: 'Sloveens',
    sv_SE: 'Zweeds',
    uk_UA: 'Oekraïens',
  };

  var _GARBAGE_COMPANIES = {
    afvalinfo: '99% coverage in NL',
    afvalalert: 'Afval Alert (NL)',
    afvalstoffendienst: 'Afvalstoffendienst: Hertogenbosch, Vlijmen, ... (NL)',
    almere: 'Almere',
    alphenaandenrijn: 'Alphen aan de Rijn (NL)',
    area: 'Area',
    avalex: 'Avalex (NL)',
    avri: 'Rivierenland (Zaltbommel, ...)(NL)',
    barafvalbeheer: 'Bar-afvalbeheer (Barendrecht, Rhoon)(NL)',
    best: 'Best (NL)',
    blink: 'Blink: Asten, Deurne, Gemert-Bakel, Heeze-Leende, Helmond, Laarbeek, Nuenen, Someren (NL)',
    circulusberkel: 'Circulus Berkel (NL)',
    cure: 'Cure: Eindhoven, Geldrop-Mierlo, Valkenswaard (NL)',
    cyclusnv: 'Cyclus NV: Bodegraven-Reeuwijk, Gouda, Kaag en Braassem, Krimpen aan den IJssel, Krimpenerwaard, Montfoort, Nieuwkoop, Waddinxveen en Zuidplas (NL)',
    dar: 'Dar: Berg en Dal, Beuningen, Druten, Heumen, Nijmegen, Wijchen (NL)',
    deafvalapp: 'Afval App (NL)',
    edg: 'EDG (DE)',
    gad: 'Grondstoffen- en Afvalstoffendienst regio Gooi en Vechtstreek (NL)',
    gemeenteberkelland: 'Berkelland: Borculo, Eibergen, Neede en Ruurlo (NL)',
    goes: 'Goes (NL)',
    googlecalendar: 'Google Calender',
    groningen: 'Groningen (NL)',
    hvc: 'HVC Groep (NL)',
    ical: 'iCal',
    katwijk: 'Katwijk (NL)',
    maashorst: 'Maashorst (NL)',
    meerlanden: 'Meerlanden (NL)',
    mijnafvalwijzer: 'Mijn Afval Wijzer (NL)',
    omrin: 'Omrin (NL)',
    purmerend: 'Purmerend',
    rd4: 'Rd4',
    recycleapp: 'RecycleApp (BE)',
    rmn: 'RMN (NL)',
    rova: 'Rova (NL)',
    sudwestfryslan: 'Sudwest Fryslan (NL)',
    suez: 'Suez: Arnhem (NL)',
    twentemilieu: 'Twente Milieu (NL)',
    uden: 'Uden (NL)',
    veldhoven: 'Veldhoven (NL)',
    venlo: 'Venlo (NL)',
    venray: 'Venray (NL)',
    vianen: 'Vianen (NL)',
    waalre: 'Waalre (NL)',
    waardlanden: 'Waardlanden: Gorinchem, Hardinxveld-Giessendam, Molenlanden en Vijfheerenlanden (NL)',
  };

  var selectedWidgets = {};
  var widgetDimensions = {};
  var layoutOrder = [];
  var weatherProvider = 'openweather';
  var calendarUrl = '';
  var clockType = 'basicclock';
  var publicTransportStation = 'UT';
  var publicTransportProvider = 'treinen';
  var cameraImageUrl = '';
  var cameraVideoUrl = '';
  var alarmRss = 'https://www.alarmeringen.nl/feeds/all.rss';
  var alarmFilter = '';
  var widgetConfigs = {};

  function open() {
    _readConfiguredWidgets();
    _buildAndShowModal();
  }

  function _readConfiguredWidgets() {
    selectedWidgets = {};
    widgetDimensions = {};
    layoutOrder = [];
    weatherProvider =
      settings['owm_api'] || !settings['wu_api']
        ? 'openweather'
        : 'wunderground';
    calendarUrl = '';
    clockType = 'basicclock';
    publicTransportStation = 'UT';
    publicTransportProvider = 'treinen';
    cameraImageUrl = '';
    cameraVideoUrl = '';
    alarmRss = 'https://www.alarmeringen.nl/feeds/all.rss';
    alarmFilter = '';

    function _n(key, def) {
      return typeof settings[key] !== 'undefined' ? Number(settings[key]) : (def !== undefined ? def : 0);
    }
    function _s(key, def) {
      return typeof settings[key] !== 'undefined' && settings[key] !== null
        ? String(settings[key])
        : (def !== undefined ? def : '');
    }

    widgetConfigs = {
      weather: {
        owm_api: _s('owm_api'),
        owm_city: _s('owm_city'),
        owm_name: _s('owm_name'),
        owm_country: _s('owm_country'),
        owm_lang: _s('owm_lang'),
        owm_days: _n('owm_days'),
        owm_cnt: _s('owm_cnt', '4'),
        owm_min: _n('owm_min', 1),
        wu_api: _s('wu_api'),
        wu_city: _s('wu_city', 'Amsterdam'),
        wu_name: _s('wu_name'),
        wu_country: _s('wu_country', 'NL'),
        use_fahrenheit: _n('use_fahrenheit'),
        use_beaufort: _n('use_beaufort'),
        translate_windspeed: _n('translate_windspeed', 1),
        static_weathericons: _n('static_weathericons'),
      },
      clock: {
        boss_stationclock: _s('boss_stationclock', 'RedBoss'),
        hide_seconds: _n('hide_seconds'),
        hide_seconds_stationclock: _n('hide_seconds_stationclock'),
      },
      garbage: {
        garbage_company: _s('garbage_company', 'afvalinfo'),
        garbage_icalurl: _s('garbage_icalurl'),
        google_api_key: _s('google_api_key'),
        garbage_calendar_id: _s('garbage_calendar_id'),
        garbage_zipcode: _s('garbage_zipcode'),
        garbage_street: _s('garbage_street'),
        garbage_housenumber: _s('garbage_housenumber'),
        garbage_housenumberadd: _s('garbage_housenumberadd'),
        garbage_maxitems: _s('garbage_maxitems', '3'),
        garbage_width: _s('garbage_width'),
        garbage_hideicon: _n('garbage_hideicon'),
        garbage_icon_use_colors: _n('garbage_icon_use_colors', 1),
        garbage_use_colors: _n('garbage_use_colors', 1),
        garbage_use_names: _n('garbage_use_names', 1),
        garbage_use_cors_prefix: _n('garbage_use_cors_prefix', 1),
      },
      sonarr: {
        sonarr_url: _s('sonarr_url'),
        sonarr_apikey: _s('sonarr_apikey'),
        sonarr_maxitems: _s('sonarr_maxitems'),
      },
      spotify: {
        spot_clientid: _s('spot_clientid'),
      },
      calendar: {
        calendarformat: _s('calendarformat', 'dd DD.MM HH:mm'),
        calendarlanguage: _s('calendarlanguage', 'en_US'),
      },
      secpanel: {
        security_button_icons: _n('security_button_icons'),
        security_panel_lock: _n('security_panel_lock'),
      },
      trafficinfo: {
        anwb_apikey: _s('anwb_apikey'),
      },
      map: {
        gm_api: _s('gm_api'),
        gm_zoomlevel: _s('gm_zoomlevel'),
        gm_latitude: _s('gm_latitude'),
        gm_longitude: _s('gm_longitude'),
      },
      longfonds: {
        longfonds_zipcode: _s('longfonds_zipcode'),
        longfonds_housenumber: _s('longfonds_housenumber'),
      },
      moon: {
        idx_moonpicture: _s('idx_moonpicture'),
      },
      news: {
        default_news_url: _s('default_news_url', 'https://www.nu.nl/rss/Algemeen'),
        news_scroll_after: _s('news_scroll_after', '7'),
      },
    };

    if (typeof columns === 'undefined') return;

    _readManagedLayoutOrder();

    _orderedColumnKeys().forEach(function (columnKey) {
      var column = columns[columnKey];
      if (!column || !Array.isArray(column.blocks)) return;

      column.blocks.forEach(function (reference) {
        if (typeof reference !== 'string') return;
        var item = _catalogItemByBlockKey(reference);
        if (!item) return;

        selectedWidgets[item.id] = true;
        var definition =
          typeof blocks !== 'undefined' && blocks[reference]
            ? blocks[reference]
            : {};
        widgetDimensions[item.id] = {
          width: parseInt(definition.width, 10) || null,
          height: parseInt(definition.height, 10) || null,
        };
        if (
          item.id === 'weather' &&
          definition.widget_provider === 'wunderground'
        ) {
          weatherProvider = 'wunderground';
        }
        if (
          item.id === 'calendar' &&
          typeof definition.icalurl === 'string'
        ) {
          calendarUrl = definition.icalurl;
        }
        if (
          item.id === 'clock' &&
          /^(basicclock|stationclock|flipclock|haymanclock|miniclock)$/.test(
            definition.type
          )
        ) {
          clockType = definition.type;
        }
        if (item.id === 'publictransport') {
          if (typeof definition.station === 'string') {
            publicTransportStation = definition.station;
          }
          if (typeof definition.provider === 'string') {
            publicTransportProvider = definition.provider;
          }
        }
        if (item.id === 'camera') {
          if (typeof definition.imageUrl === 'string') {
            cameraImageUrl = definition.imageUrl;
          }
          if (typeof definition.videoUrl === 'string') {
            cameraVideoUrl = definition.videoUrl;
          }
        }
        if (item.id === 'alarmmeldingen') {
          if (typeof definition.rss === 'string') {
            alarmRss = definition.rss;
          }
          if (typeof definition.filter === 'string') {
            alarmFilter = definition.filter;
          }
        }
      });
    });
  }

  function _orderedColumnKeys() {
    var result = [];
    if (
      typeof screens !== 'undefined' &&
      screens[1] &&
      Array.isArray(screens[1].columns)
    ) {
      result = screens[1].columns.map(String);
    }
    Object.keys(columns).forEach(function (columnKey) {
      if (result.indexOf(String(columnKey)) < 0) {
        result.push(String(columnKey));
      }
    });
    return result;
  }

  function _catalogItemByBlockKey(blockKey) {
    for (var i = 0; i < catalog.length; i++) {
      if (catalog[i].blockKey === blockKey) return catalog[i];
    }
    return null;
  }

  function _readManagedLayoutOrder() {
    var seen = {};
    _orderedColumnKeys().forEach(function (columnKey) {
      if (!/^(de|we|le)_col\d+$|^col_\d+$/.test(String(columnKey))) return;
      var column = columns[columnKey];
      if (!column || !Array.isArray(column.blocks)) return;

      column.blocks.forEach(function (reference) {
        if (
          typeof reference !== 'string' ||
          !/^[A-Za-z_][A-Za-z0-9_]*$/.test(reference) ||
          seen[reference]
        ) {
          return;
        }
        var definition =
          typeof blocks !== 'undefined' && blocks[reference]
            ? blocks[reference]
            : {};
        var widget = _catalogItemByBlockKey(reference);
        seen[reference] = true;
        layoutOrder.push({
          ref: reference,
          widgetId: widget ? widget.id : null,
          width: Math.max(
            1,
            Math.min(12, parseInt(definition.width, 10) || 3)
          ),
          height: parseInt(definition.height, 10) || null,
        });
      });
    });
  }

  function _buildAndShowModal() {
    $('#widgeteditorpopup').remove();

    var html =
      '<div class="modal fade" id="widgeteditorpopup" tabindex="-1" aria-labelledby="we-title" aria-hidden="true">' +
      '<div class="modal-dialog modal-xl modal-dialog-scrollable">' +
      '<div class="modal-content">' +
      '<div class="modal-header">' +
      '<h5 class="modal-title" id="we-title"><i class="fas fa-puzzle-piece me-2" aria-hidden="true"></i>Widgets</h5>' +
      '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>' +
      '</div>' +
      '<div class="modal-body">' +
      '<p class="text-muted">Kies de functies die als tegel op scherm 1 moeten staan.</p>' +
      '<div class="we-widget-grid">';

    catalog.forEach(function (item) {
      html += _widgetCardHtml(item);
    });

    html +=
      '</div><div class="we-message" role="status"></div></div>' +
      '<div class="modal-footer">' +
      '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Sluiten</button>' +
      '<button type="button" class="btn btn-primary" id="we-save-btn">Opslaan</button>' +
      '</div></div></div></div>';

    $('body').append(html);
    _attachHandlers();
    window.bootstrap.Modal.getOrCreateInstance(
      document.getElementById('widgeteditorpopup')
    ).show();
  }

  function _widgetHasConfig(id) {
    return (
      id === 'weather' ||
      id === 'calendar' ||
      id === 'clock' ||
      id === 'garbage' ||
      id === 'sonarr' ||
      id === 'spotify' ||
      id === 'secpanel' ||
      id === 'publictransport' ||
      id === 'trafficinfo' ||
      id === 'alarmmeldingen' ||
      id === 'camera' ||
      id === 'map' ||
      id === 'longfonds' ||
      id === 'moon' ||
      id === 'news'
    );
  }

  function _widgetCardHtml(item) {
    var selected = !!selectedWidgets[item.id];
    var configBtn = _widgetHasConfig(item.id)
      ? '<button type="button" class="we-config-btn" data-widget-id="' +
        item.id +
        '" title="Instellingen" aria-label="Instellingen voor ' +
        item.title +
        '"><i class="fas fa-cog" aria-hidden="true"></i></button>'
      : '';

    return (
      '<div class="we-widget-card' +
      (selected ? ' we-selected' : '') +
      '" data-widget-id="' +
      item.id +
      '" role="button" tabindex="0" aria-pressed="' +
      (selected ? 'true' : 'false') +
      '">' +
      configBtn +
      '<div class="we-widget-icon"><i class="' +
      item.icon +
      '" aria-hidden="true"></i></div>' +
      '<div class="we-widget-content"><div class="we-widget-title">' +
      item.title +
      '</div><div class="we-widget-description">' +
      item.description +
      '</div></div>' +
      '<div class="we-widget-status">' +
      (selected ? 'Toegevoegd' : 'Klik om toe te voegen') +
      '</div></div>'
    );
  }

  function _cfgField(key, label, type, value, opts, help) {
    var id = 'we-cfg-' + key.replace(/_/g, '-');
    var html = '<div class="mb-3">';
    html += '<label class="form-label we-field-label" for="' + _esc(id) + '">' + label + '</label>';
    if (type === 'text') {
      html += '<input type="text" class="form-control form-control-sm we-widget-field" id="' +
        _esc(id) + '" data-cfg-key="' + _esc(key) + '" value="' + _esc(String(value !== null && value !== undefined ? value : '')) + '">';
    } else if (type === 'checkbox') {
      html += '<div class="form-check form-switch">' +
        '<input class="form-check-input we-widget-field" type="checkbox" id="' +
        _esc(id) + '" data-cfg-key="' + _esc(key) + '" value="1"' +
        (Number(value) === 1 ? ' checked' : '') + '>' +
        '</div>';
    } else if (type === 'select') {
      html += '<select class="form-select form-select-sm we-widget-field" id="' +
        _esc(id) + '" data-cfg-key="' + _esc(key) + '">';
      for (var optVal in opts) {
        html += '<option value="' + _esc(optVal) + '"' +
          (String(value) === String(optVal) ? ' selected' : '') + '>' +
          _esc(opts[optVal]) + '</option>';
      }
      html += '</select>';
    }
    if (help) {
      html += '<div class="form-text" style="font-size:11px;color:#6c757d">' + _esc(help) + '</div>';
    }
    html += '</div>';
    return html;
  }

  function _cfgHeading(text) {
    return '<h6 class="mt-3 mb-2" style="font-size:13px;font-weight:700;color:#495057">' + text + '</h6>';
  }

  function _buildConfigModalHtml(item) {
    var fields = '';
    var lng = (typeof language !== 'undefined' && language.settings) ? language.settings : {};
    var lw = lng.weather || {};
    var ll = lng.localize || {};
    var lg = lng.garbage || {};
    var lm = lng.media || {};

    if (item.id === 'weather') {
      var cfg = widgetConfigs.weather || {};
      fields +=
        '<div class="mb-3">' +
        '<label class="form-label we-field-label" for="we-cfg-weather-provider">Provider</label>' +
        '<select class="form-select form-select-sm we-widget-field" id="we-cfg-weather-provider">' +
        '<option value="openweather"' + (weatherProvider === 'openweather' ? ' selected' : '') + '>OpenWeather</option>' +
        '<option value="wunderground"' + (weatherProvider === 'wunderground' ? ' selected' : '') + '>Weather Underground</option>' +
        '</select></div>';
      fields += _cfgHeading('OpenWeather');
      fields += _cfgField('owm_api', lw.owm_api || 'OpenWeather API key', 'text', cfg.owm_api);
      fields += _cfgField('owm_city', lw.owm_city || 'Stad', 'text', cfg.owm_city);
      fields += _cfgField('owm_name', lw.owm_name || 'Weergavenaam', 'text', cfg.owm_name);
      fields += _cfgField('owm_country', lw.owm_country || 'Landcode', 'text', cfg.owm_country);
      fields += _cfgField('owm_lang', lw.owm_lang || 'Taalcode', 'text', cfg.owm_lang, null, lw.owm_lang_help || '');
      fields += _cfgField('owm_cnt', lw.owm_cnt || 'Aantal perioden', 'text', cfg.owm_cnt, null, lw.owm_cnt_help || '');
      fields += _cfgField('owm_days', lw.owm_days || 'Daagse voorspelling', 'checkbox', cfg.owm_days, null, lw.owm_days_help || '');
      fields += _cfgField('owm_min', lw.owm_min || 'Minimumtemperatuur tonen', 'checkbox', cfg.owm_min, null, lw.owm_min_help || '');
      fields += _cfgHeading('Weather Underground');
      fields += _cfgField('wu_api', lw.wu_api || 'Weather Underground API key', 'text', cfg.wu_api);
      fields += _cfgField('wu_city', lw.wu_city || 'Stad (WU)', 'text', cfg.wu_city);
      fields += _cfgField('wu_name', lw.wu_name || 'Weergavenaam (WU)', 'text', cfg.wu_name);
      fields += _cfgField('wu_country', lw.wu_country || 'Landcode (WU)', 'text', cfg.wu_country);
      fields += _cfgHeading('Weergave');
      fields += _cfgField('use_fahrenheit', lw.use_fahrenheit || 'Fahrenheit gebruiken', 'checkbox', cfg.use_fahrenheit);
      fields += _cfgField('use_beaufort', lw.use_beaufort || 'Beaufort gebruiken', 'checkbox', cfg.use_beaufort);
      fields += _cfgField('translate_windspeed', lw.translate_windspeed || 'Windsnelheid vertalen', 'checkbox', cfg.translate_windspeed, null, lw.translate_windspeed_help || '');
      fields += _cfgField('static_weathericons', lw.static_weathericons || 'Statische weericonen', 'checkbox', cfg.static_weathericons);

    } else if (item.id === 'calendar') {
      var ccal = widgetConfigs.calendar || {};
      fields =
        '<div class="mb-3">' +
        '<label class="form-label we-field-label" for="we-cfg-calendar-url">ICS-URL</label>' +
        '<input type="url" class="form-control form-control-sm we-widget-field" id="we-cfg-calendar-url" ' +
        'placeholder="https://…/calendar.ics" value="' + _esc(calendarUrl) + '"></div>';
      fields += _cfgField('calendarformat', ll.calendarformat || 'Kalender weergave', 'text', ccal.calendarformat);
      fields += _cfgField('calendarlanguage', ll.calendarlanguage || 'Taal van kalender', 'select', ccal.calendarlanguage, _CALENDAR_LANGUAGES);

    } else if (item.id === 'clock') {
      var ccfg = widgetConfigs.clock || {};
      fields +=
        '<div class="mb-3">' +
        '<label class="form-label we-field-label" for="we-cfg-clock-type">Kloktype</label>' +
        '<select class="form-select form-select-sm we-widget-field" id="we-cfg-clock-type">' +
        _clockOption('basicclock', 'Basic clock') +
        _clockOption('stationclock', 'Stationsklok') +
        _clockOption('flipclock', 'Flipclock') +
        _clockOption('haymanclock', 'Hayman clock') +
        _clockOption('miniclock', 'Miniclock') +
        '</select></div>';
      fields += _cfgField('boss_stationclock', ll.boss_stationclock || 'Stationsklok thema', 'text', ccfg.boss_stationclock);
      fields += _cfgField('hide_seconds', ll.hide_seconds || 'Seconden verbergen', 'checkbox', ccfg.hide_seconds);
      fields += _cfgField('hide_seconds_stationclock', ll.hide_seconds_stationclock || 'Seconden verbergen (stationsklok)', 'checkbox', ccfg.hide_seconds_stationclock);

    } else if (item.id === 'garbage') {
      var gcfg = widgetConfigs.garbage || {};
      fields += _cfgField('garbage_company', lg.garbage_company || 'Afvalverwerker', 'select', gcfg.garbage_company, _GARBAGE_COMPANIES);
      fields += _cfgField('garbage_zipcode', lg.garbage_zipcode || 'Postcode', 'text', gcfg.garbage_zipcode);
      fields += _cfgField('garbage_street', lg.garbage_street || 'Straatnaam', 'text', gcfg.garbage_street);
      fields += _cfgField('garbage_housenumber', lg.garbage_housenumber || 'Huisnummer', 'text', gcfg.garbage_housenumber);
      fields += _cfgField('garbage_housenumberadd', lg.garbage_housenumberaddition || 'Huisnummertoevoeging', 'text', gcfg.garbage_housenumberadd);
      fields += _cfgField('garbage_maxitems', lg.garbage_maxitems || 'Maximum items', 'text', gcfg.garbage_maxitems);
      fields += _cfgField('garbage_width', lg.garbage_width || 'Breedte', 'text', gcfg.garbage_width);
      fields += _cfgHeading('iCal / Google');
      fields += _cfgField('garbage_icalurl', lg.garbage_icalurl || 'iCal URL', 'text', gcfg.garbage_icalurl);
      fields += _cfgField('google_api_key', lg.google_api_key || 'Google API key', 'text', gcfg.google_api_key);
      fields += _cfgField('garbage_calendar_id', lg.garbage_calendar_id || 'Google Agenda ID', 'text', gcfg.garbage_calendar_id, null, lg.garbage_calendar_id_help || '');
      fields += _cfgHeading('Weergave');
      fields += _cfgField('garbage_hideicon', lg.garbage_hideicon || 'Icoon verbergen', 'checkbox', gcfg.garbage_hideicon);
      fields += _cfgField('garbage_icon_use_colors', lg.garbage_icon_use_colors || 'Kleur voor icoon', 'checkbox', gcfg.garbage_icon_use_colors);
      fields += _cfgField('garbage_use_colors', lg.garbage_use_colors || 'Kleuren gebruiken', 'checkbox', gcfg.garbage_use_colors);
      fields += _cfgField('garbage_use_names', lg.garbage_use_names || 'Namen gebruiken', 'checkbox', gcfg.garbage_use_names);
      fields += _cfgField('garbage_use_cors_prefix', lg.garbage_use_cors_prefix || 'CORS-prefix gebruiken', 'checkbox', gcfg.garbage_use_cors_prefix);

    } else if (item.id === 'sonarr') {
      var scfg = widgetConfigs.sonarr || {};
      fields += _cfgField('sonarr_url', lm.sonarr_url || 'Sonarr URL', 'text', scfg.sonarr_url);
      fields += _cfgField('sonarr_apikey', lm.sonarr_apikey || 'Sonarr API key', 'text', scfg.sonarr_apikey);
      fields += _cfgField('sonarr_maxitems', lm.sonarr_maxitems || 'Maximum items', 'text', scfg.sonarr_maxitems);

    } else if (item.id === 'spotify') {
      var spcfg = widgetConfigs.spotify || {};
      fields += _cfgField('spot_clientid', lm.spot_clientid || 'Spotify Client ID', 'text', spcfg.spot_clientid);

    } else if (item.id === 'secpanel') {
      var sec = widgetConfigs.secpanel || {};
      var ls = lng.screen || {};
      fields += _cfgField('security_button_icons', ls.security_button_icons || 'Iconen i.p.v. tekst', 'checkbox', sec.security_button_icons);
      fields += _cfgField('security_panel_lock', ls.security_panel_lock || 'Security panel fullscreen', 'checkbox', sec.security_panel_lock, null, ls.security_panel_lock_help || '');

    } else if (item.id === 'publictransport') {
      fields +=
        '<div class="mb-3">' +
        '<label class="form-label we-field-label" for="we-cfg-pt-provider">Provider</label>' +
        '<select class="form-select form-select-sm we-widget-field" id="we-cfg-pt-provider">' +
        _ptOption('treinen', 'Treinen (NL)') +
        _ptOption('ovapi', 'OV API (NL)') +
        _ptOption('drgl', 'DRGL (NL)') +
        _ptOption('irailbe', 'iRail (BE)') +
        _ptOption('delijnbe', 'De Lijn (BE)') +
        '</select></div>';
      fields +=
        '<div class="mb-3">' +
        '<label class="form-label we-field-label" for="we-cfg-pt-station">Station / halte</label>' +
        '<input type="text" class="form-control form-control-sm we-widget-field" id="we-cfg-pt-station" value="' +
        _esc(publicTransportStation) +
        '">' +
        '<div class="form-text" style="font-size:11px;color:#6c757d">Bijv. UT voor Utrecht Centraal (treinen).</div></div>';

    } else if (item.id === 'trafficinfo') {
      var tcfg = widgetConfigs.trafficinfo || {};
      var lwgt = lng.widgets || {};
      fields += _cfgField('anwb_apikey', lwgt.anwb_apikey || 'ANWB API key', 'text', tcfg.anwb_apikey, null, lwgt.anwb_apikey_help || '');

    } else if (item.id === 'alarmmeldingen') {
      fields +=
        '<div class="mb-3">' +
        '<label class="form-label we-field-label" for="we-cfg-alarm-rss">RSS-feed</label>' +
        '<input type="url" class="form-control form-control-sm we-widget-field" id="we-cfg-alarm-rss" value="' +
        _esc(alarmRss) +
        '"></div>';
      fields +=
        '<div class="mb-3">' +
        '<label class="form-label we-field-label" for="we-cfg-alarm-filter">Filter (optioneel)</label>' +
        '<input type="text" class="form-control form-control-sm we-widget-field" id="we-cfg-alarm-filter" value="' +
        _esc(alarmFilter) +
        '">' +
        '<div class="form-text" style="font-size:11px;color:#6c757d">Kommagescheiden zoektermen, bijv. Amsterdam, Utrecht.</div></div>';

    } else if (item.id === 'camera') {
      fields +=
        '<div class="mb-3">' +
        '<label class="form-label we-field-label" for="we-cfg-camera-image">Image URL</label>' +
        '<input type="url" class="form-control form-control-sm we-widget-field" id="we-cfg-camera-image" value="' +
        _esc(cameraImageUrl) +
        '"></div>';
      fields +=
        '<div class="mb-3">' +
        '<label class="form-label we-field-label" for="we-cfg-camera-video">Video URL (optioneel, MJPEG)</label>' +
        '<input type="url" class="form-control form-control-sm we-widget-field" id="we-cfg-camera-video" value="' +
        _esc(cameraVideoUrl) +
        '"></div>';

    } else if (item.id === 'map') {
      var mcfg = widgetConfigs.map || {};
      fields += _cfgField('gm_api', ll.gm_api || 'Google Maps API key', 'text', mcfg.gm_api);
      fields += _cfgField('gm_zoomlevel', ll.gm_zoomlevel || 'Zoomniveau', 'text', mcfg.gm_zoomlevel);
      fields += _cfgField('gm_latitude', ll.gm_latitude || 'Breedtegraad', 'text', mcfg.gm_latitude);
      fields += _cfgField('gm_longitude', ll.gm_longitude || 'Lengtegraad', 'text', mcfg.gm_longitude);

    } else if (item.id === 'longfonds') {
      var lcfg = widgetConfigs.longfonds || {};
      fields += _cfgField('longfonds_zipcode', lw.longfonds_zipcode || 'Postcode', 'text', lcfg.longfonds_zipcode);
      fields += _cfgField('longfonds_housenumber', lw.longfonds_housenumber || 'Huisnummer', 'text', lcfg.longfonds_housenumber);

    } else if (item.id === 'moon') {
      var mooncfg = widgetConfigs.moon || {};
      fields += _cfgField('idx_moonpicture', lw.idx_moonpicture || 'IDX moonpicture', 'text', mooncfg.idx_moonpicture, null, lw.idx_moonpicture_help || '');

    } else if (item.id === 'news') {
      var ncfg = widgetConfigs.news || {};
      var lg2 = lng.general || {};
      fields += _cfgField('default_news_url', lg2.default_news_url || 'News URL', 'text', ncfg.default_news_url);
      fields += _cfgField('news_scroll_after', lg2.news_scroll_after || 'Scroll after (seconds)', 'text', ncfg.news_scroll_after);
    }

    return (
      '<div class="modal fade" id="we-config-popup" tabindex="-1" aria-labelledby="we-cfg-title" aria-hidden="true" data-bs-backdrop="static">' +
      '<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">' +
      '<div class="modal-content">' +
      '<div class="modal-header">' +
      '<h5 class="modal-title" id="we-cfg-title"><i class="fas fa-cog me-2" aria-hidden="true"></i>Instellingen — ' +
      item.title +
      '</h5>' +
      '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Sluiten"></button>' +
      '</div>' +
      '<div class="modal-body">' +
      fields +
      '<div class="we-cfg-message" role="status"></div>' +
      '</div>' +
      '<div class="modal-footer">' +
      '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuleren</button>' +
      '<button type="button" class="btn btn-primary" id="we-cfg-ok-btn">OK</button>' +
      '</div></div></div></div>'
    );
  }

  function _openConfigModal(widgetId) {
    var item = null;
    for (var i = 0; i < catalog.length; i++) {
      if (catalog[i].id === widgetId) {
        item = catalog[i];
        break;
      }
    }
    if (!item) return;

    $('#we-config-popup').remove();
    $('body').append(_buildConfigModalHtml(item));

    var $cfgModal = $('#we-config-popup');

    $cfgModal.on('click', '#we-cfg-ok-btn', function () {
      var valid = true;

      // Collect all generic config fields
      var collected = {};
      $cfgModal.find('[data-cfg-key]').each(function () {
        var key = String($(this).data('cfg-key'));
        if ($(this).attr('type') === 'checkbox') {
          collected[key] = $(this).is(':checked') ? 1 : 0;
        } else {
          collected[key] = $(this).val();
        }
      });

      if (widgetId === 'weather') {
        weatherProvider = $('#we-cfg-weather-provider').val() || 'openweather';
        widgetConfigs.weather = collected;
      } else if (widgetId === 'calendar') {
        var url = $.trim($('#we-cfg-calendar-url').val() || '');
        if (url && !/^https?:\/\/\S+$/i.test(url)) {
          $('.we-cfg-message').addClass('text-danger').text('Vul een geldige http(s)-ICS-URL in.');
          $('#we-cfg-calendar-url').trigger('focus');
          valid = false;
        } else {
          calendarUrl = url;
          widgetConfigs.calendar = collected;
        }
      } else if (widgetId === 'clock') {
        clockType = $('#we-cfg-clock-type').val() || 'basicclock';
        widgetConfigs.clock = collected;
      } else if (widgetId === 'garbage') {
        widgetConfigs.garbage = collected;
      } else if (widgetId === 'sonarr') {
        widgetConfigs.sonarr = collected;
      } else if (widgetId === 'spotify') {
        widgetConfigs.spotify = collected;
      } else if (widgetId === 'secpanel') {
        widgetConfigs.secpanel = collected;
      } else if (widgetId === 'publictransport') {
        publicTransportProvider = $('#we-cfg-pt-provider').val() || 'treinen';
        publicTransportStation = $.trim($('#we-cfg-pt-station').val() || '') || 'UT';
      } else if (widgetId === 'trafficinfo') {
        widgetConfigs.trafficinfo = collected;
      } else if (widgetId === 'alarmmeldingen') {
        var rss = $.trim($('#we-cfg-alarm-rss').val() || '');
        if (!rss || !/^https?:\/\/\S+$/i.test(rss)) {
          $('.we-cfg-message').addClass('text-danger').text('Vul een geldige http(s)-RSS-URL in.');
          valid = false;
        } else {
          alarmRss = rss;
          alarmFilter = $.trim($('#we-cfg-alarm-filter').val() || '');
        }
      } else if (widgetId === 'camera') {
        var imageUrl = $.trim($('#we-cfg-camera-image').val() || '');
        if (!imageUrl || !/^https?:\/\/\S+$/i.test(imageUrl)) {
          $('.we-cfg-message').addClass('text-danger').text('Vul een geldige http(s)-image-URL in.');
          valid = false;
        } else {
          cameraImageUrl = imageUrl;
          cameraVideoUrl = $.trim($('#we-cfg-camera-video').val() || '');
        }
      } else if (widgetId === 'map') {
        widgetConfigs.map = collected;
      } else if (widgetId === 'longfonds') {
        widgetConfigs.longfonds = collected;
      } else if (widgetId === 'moon') {
        widgetConfigs.moon = collected;
      } else if (widgetId === 'news') {
        widgetConfigs.news = collected;
      }

      if (valid) {
        selectedWidgets[widgetId] = true;
        _refreshCard(widgetId);
        window.bootstrap.Modal.getInstance(document.getElementById('we-config-popup')).hide();
      }
    });

    $cfgModal.one('hidden.bs.modal', function () {
      $cfgModal.remove();
    });

    window.bootstrap.Modal.getOrCreateInstance(
      document.getElementById('we-config-popup')
    ).show();
  }

  function _clockOption(value, label) {
    return (
      '<option value="' +
      value +
      '"' +
      (clockType === value ? ' selected' : '') +
      '>' +
      label +
      '</option>'
    );
  }

  function _ptOption(value, label) {
    return (
      '<option value="' +
      value +
      '"' +
      (publicTransportProvider === value ? ' selected' : '') +
      '>' +
      label +
      '</option>'
    );
  }

  function _attachHandlers() {
    var $modal = $('#widgeteditorpopup');

    $modal.on('click', '.we-config-btn', function (event) {
      event.stopPropagation();
      _openConfigModal(String($(this).data('widget-id')));
    });

    $modal.on('keydown', '.we-config-btn', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        _openConfigModal(String($(this).data('widget-id')));
      }
    });

    $modal.on('click', '.we-widget-card', function (event) {
      if ($(event.target).closest('.we-config-btn').length) return;
      _toggleWidget(String($(this).data('widget-id')));
    });

    $modal.on('keydown', '.we-widget-card', function (event) {
      if ($(event.target).closest('.we-config-btn').length) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        _toggleWidget(String($(this).data('widget-id')));
      }
    });

    $modal.on('click', '#we-save-btn', _save);
    $modal.one('hidden.bs.modal', function () {
      $modal.remove();
    });
  }

  function _toggleWidget(id) {
    selectedWidgets[id] = !selectedWidgets[id];
    _refreshCard(id);
  }

  function _refreshCard(id) {
    var selected = !!selectedWidgets[id];
    var $card = $('.we-widget-card[data-widget-id="' + id + '"]');
    $card
      .toggleClass('we-selected', selected)
      .attr('aria-pressed', selected ? 'true' : 'false')
      .find('.we-widget-status')
      .text(selected ? 'Toegevoegd' : 'Klik om toe te voegen');
  }

  function _save() {
    if (
      selectedWidgets.calendar &&
      calendarUrl &&
      !/^https?:\/\/\S+$/i.test(calendarUrl)
    ) {
      $('.we-message')
        .addClass('text-danger')
        .text('Vul voor Kalender een geldige http(s)-ICS-URL in.');
      return;
    }
    if (selectedWidgets.camera && !/^https?:\/\/\S+$/i.test(cameraImageUrl)) {
      $('.we-message')
        .addClass('text-danger')
        .text("Vul bij Camera's een geldige image-URL in (tandwiel).");
      return;
    }

    // Collect flattened config settings from all widget configs
    var configSettings = {};
    var configWidgets = [
      'weather',
      'clock',
      'garbage',
      'sonarr',
      'spotify',
      'calendar',
      'secpanel',
      'trafficinfo',
      'map',
      'longfonds',
      'moon',
      'news',
    ];
    configWidgets.forEach(function (id) {
      if (widgetConfigs[id]) {
        var cfg = widgetConfigs[id];
        Object.keys(cfg).forEach(function (key) {
          configSettings[key] = cfg[key];
        });
      }
    });

    var payload = [];
    catalog.forEach(function (item) {
      if (!selectedWidgets[item.id]) return;
      var entry = { id: item.id };
      var dimensions = widgetDimensions[item.id] || {};
      entry.width = dimensions.width || item.width;
      if (dimensions.height) entry.height = dimensions.height;
      if (item.id === 'weather') entry.provider = weatherProvider;
      if (item.id === 'calendar') entry.icalurl = calendarUrl;
      if (item.id === 'clock') entry.clockType = clockType;
      if (item.id === 'publictransport') {
        entry.station = publicTransportStation;
        entry.provider = publicTransportProvider;
      }
      if (item.id === 'camera') {
        entry.imageUrl = cameraImageUrl;
        if (cameraVideoUrl) entry.videoUrl = cameraVideoUrl;
      }
      if (item.id === 'alarmmeldingen') {
        entry.rss = alarmRss;
        if (alarmFilter) entry.filter = alarmFilter;
      }
      payload.push(entry);
    });

    var $save = $('#we-save-btn').prop('disabled', true).text('Opslaan…');
    $('.we-message').removeClass('text-danger').text('');

    $.getJSON(settings['dashticz_php_path'] + 'info.php?get=csrf')
      .then(function (data) {
        var token = data.token;
        return _postWidgetData(
          'js/savewidgets.php',
          { widgets: payload, settings: configSettings },
          token
        ).then(function (widgetResult) {
          var widgetRefs = {};
          var widgetWidths = {};
          payload.forEach(function (entry, index) {
            widgetRefs[entry.id] = widgetResult.blockKeys[index];
            widgetWidths[entry.id] = entry.width;
          });

          var includedWidgets = {};
          var layoutItems = [];
          layoutOrder.forEach(function (item) {
            if (item.widgetId) {
              if (!selectedWidgets[item.widgetId]) return;
              includedWidgets[item.widgetId] = true;
              var widgetEntry = {
                ref: widgetRefs[item.widgetId],
                width: widgetWidths[item.widgetId],
              };
              var widgetDims = widgetDimensions[item.widgetId] || {};
              if (widgetDims.height) widgetEntry.height = widgetDims.height;
              layoutItems.push(widgetEntry);
              return;
            }
            var deviceEntry = { ref: item.ref, width: item.width };
            if (item.height) deviceEntry.height = item.height;
            layoutItems.push(deviceEntry);
          });

          payload.forEach(function (entry) {
            if (includedWidgets[entry.id]) return;
            var newEntry = {
              ref: widgetRefs[entry.id],
              width: entry.width,
            };
            if (entry.height) newEntry.height = entry.height;
            layoutItems.push(newEntry);
          });

          return _postWidgetData(
            'js/savelayout.php',
            { items: layoutItems },
            token
          );
        });
      })
      .done(function () {
        $save.removeClass('btn-primary').addClass('btn-success').text('Opgeslagen');
        setTimeout(function () {
          window.location.reload();
        }, 700);
      })
      .fail(function (xhr) {
        var message =
          xhr.responseJSON && xhr.responseJSON.error
            ? xhr.responseJSON.error
            : 'De widgets konden niet worden opgeslagen.';
        $('.we-message').addClass('text-danger').text(message);
        $save.prop('disabled', false).text('Opslaan');
      });
  }

  function _postWidgetData(url, payload, token) {
    return $.ajax({
      url: url,
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(payload),
      dataType: 'json',
      headers: { 'X-Dashticz-CSRF': token },
    });
  }

  function _esc(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return {
    open: open,
  };
})();

//# sourceURL=js/widgeteditor.js
