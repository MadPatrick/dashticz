/* global Dashticz settings language */
// Lyrion Music Server (LMS) "Now Playing" block. Shows player
// state/artist/title/album/artwork for one configured player, refreshed on
// Dashticz's own per-block polling (see me.block.refresh below). It also
// exposes a row of transport/volume/power buttons that send commands to LMS
// through the same backend bridge used for status polling
// (vendor/dashticz/lms/index.php). Configured via the Screen Editor's
// "Lyrion Music Server" quick-add popup (js/deviceeditor.js), which discovers
// players through the same backend bridge this component polls
// (vendor/dashticz/lms/index.php) rather than talking to LMS directly, so
// this never hits a CORS or mixed-content wall regardless of deployment -
// see docs/blocks/specials/lms.rst.
//
// STATUS POLLING ARCHITECTURE (updated):
// Instead of each block instance polling its own player's 'status' every
// me.block.refresh seconds, all LMS blocks for a given server:port share a
// single DT_lms_scheduler that:
//   - Tier 1: polls the server-wide 'serverstatus' CLI query once per tick
//     (one HTTP call total, regardless of how many players/blocks exist).
//     serverstatus only exposes 'power' per player (confirmed against
//     https://lyrion.org/reference/cli/compoundqueries/) - no mode, no
//     track metadata.
//   - Tier 2: for every player serverstatus reports as powered ON, issues
//     the existing per-player 'status' call (tags:aclK) to get mode/
//     artist/title/album/artwork - unchanged from before, just no longer
//     called for powered-off players.
// This cuts N periodic HTTP calls down to 1 + (number of powered-on
// players) per tick, instead of N regardless of power state.
//
// Shared LMS backend bridge, kept as its own global (mirroring the NZBGET
// object in js/components/nzbget.js) rather than nested inside DT_lms's own
// closure below: js/deviceeditor.js's Lyrion Music Server quick-add/edit
// popup reuses DT_lms_api.request() for player discovery/"Test connection",
// posting the very same request shape this block polls with, so both share
// one implementation of the fetch/error handling instead of two. Component
// scripts are all loaded unconditionally at dashboard startup (well before
// the Screen Editor can lazy-load deviceeditor.js), so this is available by
// the time it's needed.
// eslint-disable-next-line no-unused-vars
var DT_lms_api = {
  request: function (block, params, player) {
    return $.ajax({
      url: settings['dashticz_php_path'] + 'lms/index.php',
      method: 'POST',
      contentType: 'application/json',
      dataType: 'json',
      data: JSON.stringify({
        action: 'rpc',
        server: block.server,
        port: block.port,
        username: block.username || '',
        password: block.password || '',
        player: player || '',
        params: params,
      }),
    }).then(function (res) {
      return res && res.result;
    });
  },
  cover: function (block, player, coverid, artworkUrl) {
    return $.ajax({
      url: settings['dashticz_php_path'] + 'lms/index.php',
      method: 'POST',
      contentType: 'application/json',
      dataType: 'json',
      data: JSON.stringify({
        action: 'cover',
        server: block.server,
        port: block.port,
        username: block.username || '',
        password: block.password || '',
        player: player || '',
        coverid: coverid || '',
        artworkUrl: artworkUrl || '',
      }),
    }).then(function (res) {
      return res && res.dataUrl;
    });
  },
  // Server-wide status for every player known to LMS, in one call. No new
  // PHP action needed: the existing bridge already accepts player: '' for
  // a server-wide 'rpc' query (see dashticz_lms_read_input()'s handling of
  // an empty player id). Returns the raw players_loop array as documented
  // at https://lyrion.org/reference/cli/compoundqueries/#serverstatus
  // (playerid/power/name/... - no mode, no track metadata).
  serverStatus: function (block) {
    return DT_lms_api.request(block, ['serverstatus', 0, 999], '').then(
      function (result) {
        return (result && result.players_loop) || [];
      }
    );
  },
};

/* ----------------------------------------------------------------------
 * DT_lms_scheduler
 *
 * One shared poller per server:port instead of one per block/player. See
 * the architecture note above DT_lms_api for the tier 1/tier 2 split.
 * ---------------------------------------------------------------------- */
// eslint-disable-next-line no-unused-vars
var DT_lms_scheduler = {
  timers: {}, // key(server:port) -> intervalId
  intervalsMs: {}, // key -> current interval in ms (le plus court demandé)
  subscribers: {}, // key -> { playerid: [callback, ...] }
  blocksByKey: {}, // key -> block (un exemplaire, pour server/port/user/pass)
  inFlight: {}, // key -> boolean, évite le chevauchement si LMS répond lentement

  _key: function (block) {
    return block.server + ':' + block.port;
  },

  /* S'abonner aux mises à jour d'un player donné sur un serveur donné.
     Retourne une fonction de désabonnement à appeler quand le bloc est
     détruit/rechargé, pour ne pas accumuler de callbacks fantômes. */
  subscribe: function (block, playerid, cb) {
    var key = this._key(block);
    this.blocksByKey[key] = block;
    this.subscribers[key] = this.subscribers[key] || {};
    this.subscribers[key][playerid] =
      this.subscribers[key][playerid] || [];
    this.subscribers[key][playerid].push(cb);

    this._ensureTimer(key, block.refresh || 5);

    var self = this;
    return function unsubscribe() {
      var list = (self.subscribers[key] || {})[playerid];
      if (!list) return;
      var idx = list.indexOf(cb);
      if (idx !== -1) list.splice(idx, 1);
      self._maybeStopTimer(key);
    };
  },

  _ensureTimer: function (key, refreshSeconds) {
    var wantedMs = Math.max(1, refreshSeconds) * 1000;

    // Si un timer tourne déjà mais qu'un bloc demande un refresh plus
    // rapide, on le redémarre avec le nouvel intervalle (le plus exigeant
    // gagne). On ne redémarre pas pour un intervalle plus lent : pas la
    // peine de ralentir tout le monde pour un bloc qui s'en fiche.
    if (this.timers[key] && this.intervalsMs[key] <= wantedMs) return;
    if (this.timers[key]) clearInterval(this.timers[key]);

    var self = this;
    var tick = function () {
      self._poll(key);
    };
    this.intervalsMs[key] = wantedMs;
    this.timers[key] = setInterval(tick, wantedMs);
    tick(); // premier appel immédiat, pas d'attente du premier tick
  },

  _maybeStopTimer: function (key) {
    var subs = this.subscribers[key] || {};
    var hasAny = Object.keys(subs).some(function (pid) {
      return subs[pid] && subs[pid].length > 0;
    });
    if (hasAny) return;
    if (this.timers[key]) clearInterval(this.timers[key]);
    delete this.timers[key];
    delete this.intervalsMs[key];
    delete this.subscribers[key];
    delete this.blocksByKey[key];
  },

  /* Tier 1: un appel groupé 'serverstatus' donne l'état basique
     (playerid/power uniquement - voir _basicIsActive) de TOUS les
     players en une requête.
     Tier 2: pour les players que le tier 1 signale comme ALLUMÉS
     (serverstatus ne dit pas s'ils jouent vraiment, voir _basicIsActive),
     on va chercher le détail complet (mode/artiste/titre/album/pochette)
     via l'appel 'status' par player déjà existant - inchangé. */
  _poll: function (key) {
    if (this.inFlight[key]) return; // évite l'empilement si LMS répond lentement
    var block = this.blocksByKey[key];
    if (!block) return;

    var self = this;
    this.inFlight[key] = true;

    DT_lms_api
      .serverStatus(block)
      .then(function (playersLoop) {
        var basicByPlayerId = self._indexPlayersLoop(playersLoop);
        var subs = self.subscribers[key] || {};
        var activeIds = Object.keys(subs).filter(function (pid) {
          return self._basicIsActive(basicByPlayerId[pid]);
        });

        if (!activeIds.length) {
          self._dispatch(key, basicByPlayerId);
          return;
        }

        // Un appel 'status' détaillé par player allumé (comme avant),
        // mais seulement pour ceux-là - pas pour les players éteints qui
        // composent souvent la majorité à un instant donné.
        var detailCalls = activeIds.map(function (pid) {
          return DT_lms_api
            .request(block, ['status', '-', 1, 'tags:aclK'], pid)
            .then(function (detail) {
              basicByPlayerId[pid] = detail || basicByPlayerId[pid];
            })
            .catch(function () {
              // Le détail a échoué: on garde le statut basique du tier 1
              // plutôt que de perdre complètement l'info power.
            });
        });

        $.when.apply($, detailCalls).always(function () {
          self._dispatch(key, basicByPlayerId);
        });
      })
      .catch(function () {
        // Panne serveur/réseau: on notifie chaque abonné avec 'null' pour
        // que le bloc puisse afficher son propre message d'indisponibilité,
        // au lieu de rester bloqué sur le dernier état connu indéfiniment.
        self._dispatch(key, null);
      })
      .always(function () {
        self.inFlight[key] = false;
      });
  },

  /* serverstatus (confirmé via https://lyrion.org/reference/cli/compoundqueries/)
     ne renvoie PAS de champ 'mode'/'isplaying' par player - seulement
     'power'. Impossible donc de savoir depuis le tier 1 si un player
     allumé est réellement en train de jouer ou juste à l'arrêt: le
     tier 2 doit se déclencher pour tout player ALLUMÉ, pas seulement
     ceux en lecture. Le gain reste réel pour les players éteints
     (souvent la majorité à un instant donné), mais c'est une limite de
     l'API LMS elle-même, pas de cette implémentation. */
  _basicIsActive: function (basic) {
    if (!basic) return false;
    return Number(basic.power) === 1;
  },

  /* serverstatus renvoie players_loop sous forme de tableau, pas d'objet
     indexé par playerid comme le fait déjà le reste du scheduler -
     on convertit une fois ici. */
  _indexPlayersLoop: function (playersLoop) {
    var map = {};
    (playersLoop || []).forEach(function (p) {
      if (p && p.playerid) map[p.playerid] = p;
    });
    return map;
  },

  _dispatch: function (key, players) {
    var subs = this.subscribers[key] || {};
    Object.keys(subs).forEach(function (playerid) {
      var status = players ? players[playerid] : null;
      (subs[playerid] || []).forEach(function (cb) {
        cb(status);
      });
    });
  },

  /* Force un refresh immédiat de tous les players d'un serveur, utile
     juste après l'envoi d'une commande (play/pause/volume/...) pour
     refléter le changement sans attendre le prochain tick. */
  pokeByBlock: function (block) {
    this._poll(this._key(block));
  },
};

(function (Dashticz) {
  'use strict';

  var STATUS_TAGS = 'tags:aclK'; // artist, album, coverid, artwork_url - see docs/blocks/specials/lms.rst
  var ARTWORK_RETRY_MS = 30000;
  var VOLUME_STEP = 2; // percentage points per volume button press
  // Must match vendor/dashticz/lms/index.php's fixed message exactly - see
  // the try block's function_exists('curl_init') check there.
  var LMS_CURL_REQUIRED_ERROR =
    'The PHP curl extension is required for the Lyrion Music Server block.';

  function _esc(value) {
    return $('<div>')
      .text(value === null || typeof value === 'undefined' ? '' : String(value))
      .html();
  }

  function _lmsText(key, fallback) {
    return (language.misc && language.misc[key]) || fallback;
  }

  /* Normalization layer: the only place that reads raw LMS 'status' fields
     (remote/current_title/remoteMeta/playlist_loop/...), so the renderer
     below never has to know how local tracks and internet radio streams
     differ in LMS's response shape. */
  function normalizeStatus(status, fallbackName) {
    status = status || {};
    var power = Number(status.power) === 1;
    var mode = status.mode || 'stop';
    var remote = Number(status.remote) === 1;
    var track =
      (Array.isArray(status.playlist_loop) && status.playlist_loop[0]) || {};
    var remoteMeta = status.remoteMeta || {};
    var currentTitle = status.current_title || '';

    var meta = {
      playerName: status.player_name || fallbackName || '',
      known:
        typeof status.mode !== 'undefined' ||
        typeof status.power !== 'undefined',
      power: power,
      state: !power
        ? 'off'
        : mode === 'play' || mode === 'pause'
          ? mode
          : 'stop',
      remote: remote,
      station: '',
      artist: '',
      title: '',
      album: '',
      coverid: track.coverid || '',
      artworkUrl: track.artwork_url || remoteMeta.artwork_url || '',
      // 'mixer volume' can come back negative when the player is muted;
      // clamp for display/button-state purposes only (raw value is never
      // sent back to LMS).
      volume:
        typeof status['mixer volume'] !== 'undefined'
          ? Math.max(0, Math.min(100, Number(status['mixer volume'])))
          : null,
    };

    if (!power || meta.state === 'stop') {
      // A stopped/off player must not keep showing the last track (#18).
      return meta;
    }

    if (remote) {
      meta.station = currentTitle;
      meta.artist = remoteMeta.artist || '';
      meta.title = remoteMeta.title || (meta.station ? '' : currentTitle);
      meta.album = remoteMeta.album || '';
    } else {
      meta.artist = track.artist || '';
      meta.title = track.title || currentTitle;
      meta.album = track.album || '';
    }
    return meta;
  }

  function _line(cls, text) {
    return text ? '<div class="' + cls + '">' + _esc(text) + '</div>' : '';
  }

  function _skeletonHtml() {
    return (
      '<div class="lms-block-inner">' +
      '<div class="lms-cover"><div class="lms-cover-placeholder"><em class="fas fa-music" aria-hidden="true"></em></div></div>' +
      '<div class="lms-info"><div class="lms-title">' +
      _esc(_lmsText('loading', 'Loading...')) +
      '</div></div>' +
      '<div class="lms-controls"></div>' +
      '</div>'
    );
  }

  function _renderCover($cover, dataUrl) {
    if (!dataUrl) {
      $cover.html(
        '<div class="lms-cover-placeholder"><em class="fas fa-music" aria-hidden="true"></em></div>'
      );
      return;
    }
    var $img = $('<img class="lms-cover-img" alt="">');
    // A broken/expired data URL must fall back to the placeholder instead of
    // the browser's own broken-image icon (#9's "sensible placeholder").
    $img.on('error', function () {
      $cover.html(
        '<div class="lms-cover-placeholder"><em class="fas fa-music" aria-hidden="true"></em></div>'
      );
    });
    $img.attr('src', dataUrl);
    $cover.html($img);
  }

  /* Write an inline style with !important when hiding the whole block.
     Several optional Dashticz themes intentionally use !important for their
     glass/panel background, border and shadow, so a normal jQuery .css()
     assignment would not reliably make hide_when_off fully transparent. */
  function _setImportantStyle($nodes, property, value) {
    $nodes.each(function () {
      if (!this || !this.style) return;
      if (value === null) this.style.removeProperty(property);
      else this.style.setProperty(property, value, 'important');
    });
  }

  /* Keep an off player in the layout but make the complete tile visually
     disappear. This includes generic title/icon content and every panel
     effect. Removing these inline overrides when the player returns hands
     styling back to the active theme without changing the saved config. */
  function _setHiddenOff(me, hidden) {
    var $block = me.$mountPoint
      .find('.lms-block')
      .addBack('.lms-block')
      .first();
    if (!$block.length) $block = me.$mountPoint;
    var $content = $block.find('.col-icon, .dt_content');

    if (hidden) {
      _setImportantStyle($block, 'background', 'transparent');
      _setImportantStyle($block, 'border-color', 'transparent');
      _setImportantStyle($block, 'box-shadow', 'none');
      _setImportantStyle($block, 'backdrop-filter', 'none');
      _setImportantStyle($block, '-webkit-backdrop-filter', 'none');
      _setImportantStyle($content, 'visibility', 'hidden');
      _setImportantStyle($content, 'pointer-events', 'none');
      return;
    }

    [
      'background',
      'border-color',
      'box-shadow',
      'backdrop-filter',
      '-webkit-backdrop-filter',
    ].forEach(function (property) {
      _setImportantStyle($block, property, null);
    });
    ['visibility', 'pointer-events'].forEach(function (property) {
      _setImportantStyle($content, property, null);
    });
  }

  /* Build a key from visible metadata as well as LMS's artwork fields. Radio
     stations often keep the same coverid/artwork_url while the programme or
     song changes; including the textual metadata ensures current-cover is
     refreshed when the actual now-playing item changes. */
  function _artworkKey(meta) {
    if (meta.state !== 'play' && meta.state !== 'pause') return '';
    return [
      meta.remote ? 'remote' : 'local',
      meta.station,
      meta.artist,
      meta.title,
      meta.album,
      meta.coverid,
      meta.artworkUrl,
    ].join('|');
  }

  function _resetArtworkState(me) {
    me.lmsArtworkCurrentKey = '';
    me.lmsArtworkLoadedKey = '';
    me.lmsArtworkRequestKey = '';
    me.lmsArtworkRetryKey = '';
    me.lmsArtworkRetryAt = 0;
  }

  /* ---- Transport / power / volume controls ------------------------------- */

  // Buttons are described declaratively so both the markup and the click
  // handler read off the same list instead of two hand-kept copies.
  var CONTROL_BUTTONS = [
    { action: 'power', icon: 'fas fa-small fa-power-off', labelKey: 'lms_power', fallback: 'Power' },
    { action: 'prev', icon: 'fas fa-small fa-step-backward', labelKey: 'lms_prev', fallback: 'Previous' },
    { action: 'playpause', icon: 'fa-small fa-play', labelKey: 'lms_playpause', fallback: 'Play/Pause' },
    { action: 'next', icon: 'fa-small fa-step-forward', labelKey: 'lms_next', fallback: 'Next' },
    { action: 'voldown', icon: 'fa-small fa-volume-down', labelKey: 'lms_vol_down', fallback: 'Volume down' },
    { action: 'volup', icon: 'fa-small fa-volume-up', labelKey: 'lms_vol_up', fallback: 'Volume up' },
  ];

  function _controlsHtml(meta) {
    // No point offering transport controls for a player LMS doesn't know
    // about, or while the tile is fully hidden (hide_when_off).
    if (!meta.known) return '';

    var html = '';
    CONTROL_BUTTONS.forEach(function (def) {
      var icon = def.icon;
      var active = false;
      if (def.action === 'playpause') {
        icon = meta.state === 'play' ? 'fa-small fa-pause' : 'fa-small fa-play';
      } else if (def.action === 'power') {
        active = meta.power;
      }
      var label = _esc(_lmsText(def.labelKey, def.fallback));
      html +=
        '<button type="button" class="transbg hover lms-btn lms-btn-' +
        def.action +
        (active ? ' lms-btn-active' : '') +
        '" data-action="' +
        def.action +
        '" title="' +
        label +
        '" aria-label="' +
        label +
        '"><em class="fas ' +
        icon +
        '" aria-hidden="true"></em></button>';
    });
    return html;
  }

  /* Send a single LMS CLI command for the currently configured player, then
     immediately re-poll status via the shared scheduler so the UI reflects
     the change without waiting for the next scheduled refresh tick. This
     re-polls the whole server:port in one call (all players), not just
     this one - the scheduler dispatches the result to every subscribed
     block regardless. */
  function _sendCommand(me, params) {
    DT_lms_api.request(me.block, params, me.block.player)
      .then(function () {
        DT_lms_scheduler.pokeByBlock(me.block);
      })
      .catch(function () {
        // A failed command still deserves a status re-poll: it tells the
        // user the real current state instead of a stale optimistic one.
        DT_lms_scheduler.pokeByBlock(me.block);
      });
  }

  function _handleControlClick(me, action) {
    var meta = me.lmsLastMeta || {};
    switch (action) {
      case 'power':
        _sendCommand(me, ['power', meta.power ? 0 : 1]);
        break;
      case 'playpause':
        // Pause with an explicit force flag toggles LMS play<->pause in one
        // call regardless of current mode; 'play' alone is used for a fully
        // stopped player, which 'pause' cannot resume from.
        _sendCommand(me, meta.state === 'play' ? ['pause'] : ['play']);
        break;
      case 'next':
        _sendCommand(me, ['playlist', 'index', '+1']);
        break;
      case 'prev':
        _sendCommand(me, ['playlist', 'index', '-1']);
        break;
      case 'volup':
        _sendCommand(me, ['mixer', 'volume', '+' + VOLUME_STEP]);
        break;
      case 'voldown':
        _sendCommand(me, ['mixer', 'volume', '-' + VOLUME_STEP]);
        break;
    }
  }

  /* Delegated click handler bound once per block instance. Buttons are
     re-rendered on every refresh tick, so delegation on the stable
     .dt_state container (rather than binding to the buttons themselves)
     avoids rebinding/leaking a handler each time. */
  function _bindControls(me) {
    if (me.lmsControlsBound) return;
    me.lmsControlsBound = true;
    me.$mountPoint.find('.dt_state').on('click', '.lms-btn', function (e) {
      e.preventDefault();
      e.stopPropagation();
      _handleControlClick(me, $(this).data('action'));
    });
  }

  function render(me, meta) {
    _bindControls(me);
    me.lmsLastMeta = meta;

    var $state = me.$mountPoint.find('.dt_state');
    var $existing = $state.find('.lms-block-inner');
    if (!$existing.length) {
      $state.html(
        '<div class="lms-block-inner"><div class="lms-cover"></div><div class="lms-info"></div><div class="lms-controls"></div></div>'
      );
      $existing = $state.find('.lms-block-inner');
    }
    $existing
      .attr('data-lms-state', meta.state)
      .toggleClass('lms-remote', !!meta.remote);

    // hide_when_off means the complete LMS tile is visually absent while
    // preserving its grid/column footprint, so surrounding layout never jumps.
    var hideWhenOff =
      me.block.hide_when_off === true && meta.known && !meta.power;
    _setHiddenOff(me, hideWhenOff);

    var $info = $existing.find('.lms-info');
    var $controls = $existing.find('.lms-controls');
    if (hideWhenOff) {
      $info.empty();
      $controls.empty();
    } else {
      var lines = '';
      if (!meta.known) {
        lines = _line(
          'lms-state-label text-center',
          _lmsText('lms_player_unavailable', 'Player unavailable')
        );
      } else if (!meta.power) {
        lines = _line(
          'lms-state-label text-center',
          _lmsText('lms_player_off', 'Player off')
        );
      } else if (meta.state === 'stop') {
        lines = _line(
          'lms-state-label text center',
          _lmsText(
            'mediaplayer_nothing_playing',
            'Nothing is playing right now'
          )
        );
      } else {
        lines += _line('lms-title', meta.title);
        lines += _line('lms-artist', meta.artist);
        lines += _line('lms-album', meta.album);
        lines += _line('lms-station', meta.station);
        if (meta.state === 'pause') {
          lines += _line(
            'lms-state-label lms-paused',
            _lmsText('lms_paused', 'Paused')
          );
        }
      }
      $info.html(
        lines ||
          _line(
            'lms-state-label text-center',
            _lmsText('lms_player_unavailable', 'Player unavailable')
          )
      );
      $controls.html(_controlsHtml(meta));
    }

    var $cover = $existing.find('.lms-cover');
    if (hideWhenOff) {
      $cover.empty();
      _resetArtworkState(me);
      return;
    }

    var artworkKey = _artworkKey(meta);
    me.lmsArtworkCurrentKey = artworkKey;

    if (!artworkKey) {
      _resetArtworkState(me);
      _renderCover($cover, null);
      return;
    }

    // A successfully loaded cover is cached until the now-playing metadata
    // changes. Failed artwork is deliberately not marked as loaded: it gets
    // one retry after a quiet period so a temporary LMS image-proxy/network
    // failure can recover without issuing a cover request every refresh tick.
    if (me.lmsArtworkLoadedKey === artworkKey) return;
    if (me.lmsArtworkRequestKey === artworkKey) return;
    if (
      me.lmsArtworkRetryKey === artworkKey &&
      me.lmsArtworkRetryAt &&
      Date.now() < me.lmsArtworkRetryAt
    )
      return;

    // A failure for the previous station/track must never postpone artwork
    // for a newly selected item. Retry throttling therefore belongs to the
    // artwork key, not to the LMS block globally.
    if (me.lmsArtworkRetryKey !== artworkKey) {
      me.lmsArtworkRetryKey = '';
      me.lmsArtworkRetryAt = 0;
    }

    me.lmsArtworkRequestKey = artworkKey;
    DT_lms_api.cover(me.block, me.block.player, meta.coverid, meta.artworkUrl)
      .then(function (dataUrl) {
        // Always release this request key, even when a slow result became
        // stale because the player already moved to another track.
        if (me.lmsArtworkRequestKey === artworkKey)
          me.lmsArtworkRequestKey = '';
        if (me.lmsArtworkCurrentKey !== artworkKey) return;
        if (dataUrl) {
          me.lmsArtworkLoadedKey = artworkKey;
          me.lmsArtworkRetryKey = '';
          me.lmsArtworkRetryAt = 0;
          _renderCover($cover, dataUrl);
        } else {
          me.lmsArtworkLoadedKey = '';
          me.lmsArtworkRetryKey = artworkKey;
          me.lmsArtworkRetryAt = Date.now() + ARTWORK_RETRY_MS;
          _renderCover($cover, null);
        }
      })
      .catch(function () {
        if (me.lmsArtworkRequestKey === artworkKey)
          me.lmsArtworkRequestKey = '';
        if (me.lmsArtworkCurrentKey !== artworkKey) return;
        me.lmsArtworkLoadedKey = '';
        me.lmsArtworkRetryKey = artworkKey;
        me.lmsArtworkRetryAt = Date.now() + ARTWORK_RETRY_MS;
        _renderCover($cover, null);
      });
  }

  var DT_lms = {
    init: function () {
      return DT_function.loadCSS('./js/components/lms.css');
    },
    name: 'lms',
    canHandle: function (block) {
      return block && block.type === 'lms';
    },
    defaultCfg: {
      containerClass: 'lms-block',
      icon: 'fas fa-broadcast-tower',
      width: 6,
      port: 9000,
      refresh: 5,
    },
    defaultContent: _skeletonHtml,

    // refresh() is still invoked by the Dashticz framework on every tick,
    // but it no longer performs any network call itself: it just ensures
    // a (idempotent) subscription to the shared DT_lms_scheduler. Actual
    // rendering happens asynchronously whenever the scheduler's callback
    // fires with a fresh status for this player.
    refresh: function (me) {
      if (!me.block.server || !me.block.player) {
        _setHiddenOff(me, false);
        me.$mountPoint
          .find('.dt_state')
          .html(
            _line(
              'lms-state-label text-center',
              _lmsText('lms_server_unavailable', 'LMS unavailable')
            )
          );
        return;
      }

      if (me.lmsUnsubscribe) return; // déjà abonné, rien à refaire

      me.lmsUnsubscribe = DT_lms_scheduler.subscribe(
        me.block,
        me.block.player,
        function (rawStatus) {
          if (!rawStatus) {
            // null = panne serveur/réseau signalée par le scheduler
            _setHiddenOff(me, false);
            me.$mountPoint
              .find('.dt_state')
              .html(
                _line(
                  'lms-state-label text-center',
                  _lmsText('lms_server_unavailable', 'LMS unavailable')
                )
              );
            return;
          }
          render(me, normalizeStatus(rawStatus, me.block.title));
        }
      );
    },
  };

  Dashticz.register(DT_lms);
})(Dashticz);

//# sourceURL=js/components/lms.js