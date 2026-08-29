/* global Dashticz settings language */
/**
 * Lyrion Music Server (LMS) "Now Playing" block.
 * Shows player state, artist, title, album, and artwork for one configured player.
 * Refreshed on Dashticz's per-block polling schedule.
 *
 * Exposes transport/volume/power buttons that send commands to LMS through the
 * same backend bridge used for status polling (vendor/dashticz/lms/index.php).
 * Configured via the Screen Editor's "Lyrion Music Server" quick-add popup,
 * which discovers players through this same backend bridge, avoiding CORS or
 * mixed-content issues regardless of deployment.
 *
 * STATUS POLLING ARCHITECTURE:
 * There is no timer owned by this component. Dashticz already calls
 * refresh(me) on every configured block on its own schedule (block.refresh
 * seconds); DT_lms_scheduler simply rides that cycle instead of running a
 * second, redundant one of its own.
 *
 * When several LMS blocks share the same server:port (e.g. one block per
 * player on the same LMS instance), their refresh() calls land in the same
 * Dashticz tick. Instead of each block issuing its own network calls,
 * DT_lms_scheduler deduplicates:
 *   - Tier 1: the server-wide 'players' CLI query (power/connected/name per
 *     player) is cached per server:port for a short TTL. The first block to
 *     ask in a given tick triggers the HTTP call; every other block asking
 *     while it's in flight, or shortly after it lands, is served from that
 *     same result instead of firing a new request.
 *   - Tier 2: the detailed per-player 'status' call (tags:aclK - mode,
 *     artist, title, album, artwork) is cached/deduplicated the same way,
 *     keyed by playerid, so two blocks pointed at the same player never
 *     double-fetch it either.
 *
 * This still reduces N periodic HTTP calls down to 1 + (number of powered-on
 * players) per Dashticz tick, without this file maintaining its own
 * setInterval/setTimeout loop.
 */

/**
 * Shared LMS backend bridge.
 * Mirrors the NZBGET object pattern. Reused by js/deviceeditor.js for player
 * discovery and "Test connection", ensuring a single implementation of fetch
 * and error handling. Component scripts are loaded unconditionally at dashboard
 * startup, making this available when needed.
 */
// eslint-disable-next-line no-unused-vars
var DT_lms_api = {
  /**
   * Extracts the backend's error string (e.g. LMS_CURL_REQUIRED_ERROR) from
   * a failed ajax call, so callers can distinguish a missing PHP extension
   * from a plain network/server failure.
   */
  _errorMessage: function (jqXHR) {
    return (jqXHR && jqXHR.responseJSON && jqXHR.responseJSON.error) || '';
  },

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
    })
      .then(function (res) {
        return res && res.result;
      })
      .catch(function (jqXHR) {
        throw DT_lms_api._errorMessage(jqXHR);
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

  /**
   * Fetches the server-wide list of players, including basic state
   * (playerid, power, connected, mac, name, etc.) in a single call.
   */
  getPlayers: function (block) {
    return this.request(block, ['players', 0, 100], '').then(function (result) {
      return (result && result.players_loop) || [];
    });
  },
};

/**
 * DT_lms_scheduler
 * No timer of its own: refresh(me) below calls poll() on every Dashticz
 * tick, and this object's job is purely to deduplicate the network calls
 * that would otherwise happen once per block instead of once per
 * server:port / playerid.
 */
var STATUS_TAGS = 'tags:aclK'; // artist, album, coverid, artwork_url

// eslint-disable-next-line no-unused-vars
var DT_lms_scheduler = {
  CACHE_TTL_MS: 1000, // long enough to coalesce same-tick calls from sibling blocks

  playersCache: {}, // key(server:port) -> { data, ts, inFlight }
  statusCache: {}, // playerid -> { data, ts, inFlight }

  _key: function (block) {
    return block.server + ':' + block.port;
  },

  /**
   * Resolves the current status for one player, sharing/deduplicating the
   * underlying 'players' and 'status' CLI calls with any other block that
   * asks for the same server:port / playerid around the same time.
   *
   * cb is called exactly once with either a status-shaped object or null
   * (server/network failure).
   */
  poll: function (block, playerid, cb) {
    var self = this;
    this._getPlayersMap(block)
      .then(function (playersMap) {
        var playerInfo = playersMap[playerid];

        if (!playerInfo || Number(playerInfo.connected) === 0) {
          cb({
            playerid: playerid,
            connected: 0,
            power: 0,
            known: true,
          });
          return;
        }

        if (Number(playerInfo.power) === 0) {
          cb({
            playerid: playerid,
            connected: 1,
            power: 0,
            player_name: playerInfo.name || playerInfo.player_name || '',
            known: true,
          });
          return;
        }

        self
          ._getStatus(block, playerid)
          .then(function (detail) {
            var merged = $.extend({}, playerInfo, detail || {});
            merged.known = true;
            cb(merged);
          })
          .catch(function () {
            // Fallback to basic info if detailed status fails, preserving
            // the knowledge that the player is at least on.
            cb(playerInfo);
          });
      })
      .catch(function (serverError) {
        cb(null, serverError);
      });
  },

  /**
   * Drops any cached/in-flight data for this block's server and player, so
   * the next poll() issues a fresh request instead of serving a stale
   * cached result. Used right after sending a command, to reflect its
   * effect without waiting out the TTL.
   */
  invalidate: function (block, playerid) {
    delete this.playersCache[this._key(block)];
    if (playerid) delete this.statusCache[playerid];
  },

  _getPlayersMap: function (block) {
    var self = this;
    var key = this._key(block);
    var entry = this.playersCache[key];
    var now = Date.now();

    if (entry && entry.inFlight) return entry.inFlight;
    if (entry && now - entry.ts < this.CACHE_TTL_MS) {
      return $.Deferred().resolve(entry.data).promise();
    }

    var req = DT_lms_api.getPlayers(block)
      .then(function (playersLoop) {
        var map = self._indexPlayersLoop(playersLoop);
        self.playersCache[key] = { data: map, ts: Date.now() };
        return map;
      })
      .catch(function (err) {
        delete self.playersCache[key];
        throw err;
      });

    this.playersCache[key] = {
      data: (entry && entry.data) || {},
      ts: 0,
      inFlight: req,
    };
    req.always(function () {
      if (self.playersCache[key] && self.playersCache[key].inFlight === req) {
        delete self.playersCache[key].inFlight;
      }
    });
    return req;
  },

  _getStatus: function (block, playerid) {
    var self = this;
    var entry = this.statusCache[playerid];
    var now = Date.now();

    if (entry && entry.inFlight) return entry.inFlight;
    if (entry && now - entry.ts < this.CACHE_TTL_MS) {
      return $.Deferred().resolve(entry.data).promise();
    }

    var req = DT_lms_api.request(
      block,
      ['status', '-', 1, STATUS_TAGS],
      playerid
    )
      .then(function (detail) {
        self.statusCache[playerid] = { data: detail, ts: Date.now() };
        return detail;
      })
      .catch(function (err) {
        delete self.statusCache[playerid];
        throw err;
      });

    this.statusCache[playerid] = {
      data: (entry && entry.data) || null,
      ts: 0,
      inFlight: req,
    };
    req.always(function () {
      if (
        self.statusCache[playerid] &&
        self.statusCache[playerid].inFlight === req
      ) {
        delete self.statusCache[playerid].inFlight;
      }
    });
    return req;
  },

  _indexPlayersLoop: function (playersLoop) {
    var map = {};
    (playersLoop || []).forEach(function (p) {
      if (p && p.playerid) {
        map[p.playerid] = p;
      }
    });
    return map;
  },
};

(function (Dashticz) {
  'use strict';

  var VOLUME_STEP = 2; // percentage points per volume button press
  var ARTWORK_RETRY_MS = 30000;
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

  /**
   * Normalization layer: The only place that reads raw LMS 'status' fields.
   * Ensures the renderer below never has to know how local tracks and
   * internet radio streams differ in LMS's response shape.
   */
  function normalizeStatus(status, fallbackName) {
    status = status || {};

    // Explicitly handle disconnected state
    if (status.connected === 0 || Number(status.connected) === 0) {
      return {
        playerName: fallbackName || '',
        known: true,
        power: false,
        connected: false,
        state: 'disconnected',
        remote: false,
        station: '',
        artist: '',
        title: '',
        album: '',
        coverid: '',
        artworkUrl: '',
        volume: null,
      };
    }

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
      connected: true,
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
      // 'mixer volume' can come back negative when muted; clamp for display only.
      volume:
        typeof status['mixer volume'] !== 'undefined'
          ? Math.max(0, Math.min(100, Number(status['mixer volume'])))
          : null,
    };

    if (!power || meta.state === 'stop') {
      // A stopped/off player must not keep showing the last track.
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
    // A broken/expired data URL must fall back to the placeholder.
    $img.on('error', function () {
      $cover.html(
        '<div class="lms-cover-placeholder"><em class="fas fa-music" aria-hidden="true"></em></div>'
      );
    });
    $img.attr('src', dataUrl);
    $cover.html($img);
  }

  /**
   * Write an inline style with !important when hiding the whole block.
   * Several Dashticz themes intentionally use !important for their glass/panel
   * background, border, and shadow, so a normal jQuery .css() assignment would
   * not reliably make hide_when_off fully transparent.
   */
  function _setImportantStyle($nodes, property, value) {
    $nodes.each(function () {
      if (!this || !this.style) return;
      if (value === null) this.style.removeProperty(property);
      else this.style.setProperty(property, value, 'important');
    });
  }

  /**
   * Keep an off player in the layout but make the complete tile visually
   * disappear. Removing these inline overrides when the player returns hands
   * styling back to the active theme without changing the saved config.
   */
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

  /**
   * Build a key from visible metadata as well as LMS's artwork fields. Radio
   * stations often keep the same coverid/artwork_url while the programme or
   * song changes; including textual metadata ensures current-cover is refreshed
   * when the actual now-playing item changes.
   */
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
    {
      action: 'power',
      icon: 'fas fa-small fa-power-off',
      labelKey: 'lms_power',
      fallback: 'Power',
    },
    {
      action: 'prev',
      icon: 'fas fa-small fa-step-backward',
      labelKey: 'lms_prev',
      fallback: 'Previous',
    },
    {
      action: 'playpause',
      icon: 'fa-small fa-play',
      labelKey: 'lms_playpause',
      fallback: 'Play/Pause',
    },
    {
      action: 'next',
      icon: 'fa-small fa-step-forward',
      labelKey: 'lms_next',
      fallback: 'Next',
    },
    {
      action: 'voldown',
      icon: 'fa-small fa-volume-down',
      labelKey: 'lms_vol_down',
      fallback: 'Volume down',
    },
    {
      action: 'volup',
      icon: 'fa-small fa-volume-up',
      labelKey: 'lms_vol_up',
      fallback: 'Volume up',
    },
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

  /**
   * Send a single LMS CLI command for the currently configured player, then
   * invalidate the scheduler's cache for this server/player and immediately
   * re-render, so the UI reflects the change without waiting for the next
   * Dashticz refresh tick.
   */
  function _sendCommand(me, params) {
    DT_lms_api.request(me.block, params, me.block.player).always(function () {
      DT_lms_scheduler.invalidate(me.block, me.block.player);
      DT_lms.refresh(me);
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

  /**
   * Delegated click handler bound once per block instance. Buttons are
   * re-rendered on every refresh tick, so delegation on the stable
   * .dt_state container avoids rebinding/leaking a handler each time.
   */
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

    // Always hide controls if the player is disconnected, or if hide_when_off is active
    var hideControls = hideWhenOff || meta.state === 'disconnected';

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
      } else if (meta.state === 'disconnected') {
        lines = _line(
          'lms-state-label text-center',
          _lmsText('lms_player_disconnected', 'Player disconnected')
        );
      } else if (!meta.power) {
        lines = _line(
          'lms-state-label text-center',
          _lmsText('lms_player_off', 'Player off')
        );
      } else if (meta.state === 'stop') {
        lines = _line(
          'lms-state-label text-center',
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

      // Only render controls if NOT disconnected and NOT hideWhenOff
      if (hideControls) {
        $controls.empty();
      } else {
        $controls.html(_controlsHtml(meta));
      }
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
    // for a newly selected item. Retry throttling belongs to the artwork key.
    if (me.lmsArtworkRetryKey !== artworkKey) {
      me.lmsArtworkRetryKey = '';
      me.lmsArtworkRetryAt = 0;
    }

    me.lmsArtworkRequestKey = artworkKey;
    DT_lms_api.cover(me.block, me.block.player, meta.coverid, meta.artworkUrl)
      .then(function (dataUrl) {
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
    name: 'lms',
    canHandle: function (block) {
      return block && block.type === 'lms';
    },
    defaultCfg: {
      containerClass: 'lms-block',
      width: 6,
      port: 9000,
      refresh: 5,
    },
    defaultContent: _skeletonHtml,

    /**
     * Called by the Dashticz framework on every tick (block.refresh
     * seconds). Delegates to DT_lms_scheduler.poll(), which deduplicates
     * the underlying network calls against any sibling block asking for
     * the same server:port / playerid in the same tick, then renders
     * whatever status comes back.
     */
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

      DT_lms_scheduler.poll(
        me.block,
        me.block.player,
        function (rawStatus, serverError) {
          if (!rawStatus) {
            // null = server/network failure; a missing PHP curl extension
            // gets its own, more actionable message.
            _setHiddenOff(me, false);
            var message =
              serverError === LMS_CURL_REQUIRED_ERROR
                ? _lmsText('lms_curl_required', LMS_CURL_REQUIRED_ERROR)
                : _lmsText('lms_server_unavailable', 'LMS unavailable');
            me.$mountPoint
              .find('.dt_state')
              .html(_line('lms-state-label text-center', message));
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
