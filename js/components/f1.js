/* global Dashticz settings language */
//# sourceURL=js/components/f1.js
/* F1 widget: shows the upcoming Formula 1 race weekend, based on the
 * domoticz_F1 plugin (https://github.com/MadPatrick/domoticz_F1). It is
 * standalone - no Domoticz device needed. The calendar (ICS feed) is
 * downloaded and parsed by vendor/dashticz/f1/index.php, a same-origin PHP
 * bridge like the PostNL and HP iLO widgets; the filtering and formatting
 * below mirror the plugin's settings:
 *
 *   f1_language        'en' | 'nl'  (weekday/month names and feed)
 *   f1_url_en/_nl      ICS feed per language (defaults: the plugin's feeds)
 *   f1_utcoffset       hours added to the (UTC) session times
 *   f1_pollminutes     how often the feed is downloaded
 *   f1_sessions        'all' | 'sprint_race' | 'race'
 *   f1_visibility      show the weekend this many days before its first
 *                      upcoming session; otherwise the 'no-event' text
 *   f1_emptytext       text shown when there is no event (may be empty)
 *   f1_hideimageonempty  hide the tile image while there is no event
 *   f1_fontsize        font size of the rows
 *
 * The tile shows the plugin's 'next event' text, centered: the Grand Prix
 * name, and below it the next session ("Do 24 Sep 10:30 : Vrije Training 1").
 */
var DT_f1 = (function () {
  var DEFAULT_URLS = {
    en: 'https://files-f1.motorsportcalendars.com/f1-calendar_p1_p2_p3_qualifying_sprint_gp.ics',
    nl: 'https://files-f1.motorsportcalendars.com/nl/f1-calendar_p1_p2_p3_qualifying_sprint_gp.ics',
  };
  var WEEKDAYS = {
    en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    nl: ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'],
  };
  var MONTHS = {
    en: [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ],
    nl: [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'Mei',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Okt',
      'Nov',
      'Dec',
    ],
  };

  return {
    name: 'f1',
    canHandle: function (block) {
      return !!(block && block.type === 'f1');
    },
    defaultCfg: {
      width: 4,
      icon: 'fas fa-flag-checkered',
      refresh: 60,
      containerClass: 'f1-block',
    },
    run: function (me) {
      refresh(me);
    },
    refresh: refresh,
  };

  function misc() {
    return (typeof language !== 'undefined' && language.misc) || {};
  }

  function num(key, def, min, max) {
    var value = parseFloat(settings[key]);
    return isNaN(value) ? def : Math.min(max, Math.max(min, value));
  }

  function flag(key) {
    var value = settings[key];
    return value === true || value === 1 || String(value) === '1';
  }

  function lang() {
    return settings['f1_language'] === 'nl' ? 'nl' : 'en';
  }

  function feedUrl() {
    return (
      String(settings['f1_url_' + lang()] || '').trim() || DEFAULT_URLS[lang()]
    );
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

  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }

  // Unix time -> "Sat 5 Jul 12:30", shifted by the UTC offset.
  function formatWhen(ts) {
    var d = new Date((ts + num('f1_utcoffset', 1, -24, 24) * 3600) * 1000);
    return (
      WEEKDAYS[lang()][d.getUTCDay()] +
      ' ' +
      d.getUTCDate() +
      ' ' +
      MONTHS[lang()][d.getUTCMonth()] +
      ' ' +
      pad(d.getUTCHours()) +
      ':' +
      pad(d.getUTCMinutes())
    );
  }

  function isTraining(event) {
    return /training|practice|^fp\d/i.test(event.session);
  }

  function isRace(event) {
    return /grand prix/i.test(event.session);
  }

  function passesFilter(event) {
    var mode = settings['f1_sessions'];
    if (mode === 'race') return isRace(event);
    if (mode === 'sprint_race') return !isTraining(event);
    return true;
  }

  // The next (or running) session, or null when there is nothing to show.
  function nextEvent(events, now) {
    var next = events.filter(passesFilter).filter(function (event) {
      return event.end > now;
    })[0];
    if (!next) return null;
    if (next.start - now > num('f1_visibility', 3, 0, 365) * 86400) return null;
    return next;
  }

  // Grand Prix name, and below it "Do 24 Sep 10:30 : Vrije Training 1".
  function eventHtml(event) {
    var head = event.gp || event.location;
    return (
      '<div class="f1-rows">' +
      (head ? '<div class="f1-heading">' + esc(head) + '</div>' : '') +
      '<div class="f1-session">' +
      esc(formatWhen(event.start) + ' : ' + event.session) +
      '</div>' +
      '</div>'
    );
  }

  // Same behaviour as the hideimageonempty block option of Domoticz blocks
  // (js/components/domoticzblock.js): only the tile image is hidden.
  function setImageVisible(me, visible) {
    me.$mountPoint.find('.col-icon img').each(function () {
      if (visible) this.style.removeProperty('display');
      else this.style.setProperty('display', 'none', 'important');
    });
  }

  function showEmpty(me) {
    var text = String(settings['f1_emptytext'] || '').trim();
    me.$mountPoint
      .find('.dt_state')
      .html(
        text ? '<div class="f1-rows f1-empty">' + esc(text) + '</div>' : ''
      );
    setImageVisible(me, !flag('f1_hideimageonempty'));
  }

  function showError(me, text) {
    me.$mountPoint
      .find('.dt_state')
      .html('<div class="f1-rows f1-error">' + esc(text) + '</div>');
    setImageVisible(me, true);
  }

  function refresh(me) {
    me.$mountPoint
      .find('.dt_state')
      .css('font-size', num('f1_fontsize', 14, 8, 60) + 'px');
    $.ajax({
      url: settings['dashticz_php_path'] + 'f1/index.php',
      method: 'POST',
      contentType: 'application/json',
      dataType: 'json',
      data: JSON.stringify({
        url: feedUrl(),
        pollMinutes: num('f1_pollminutes', 60, 5, 1440),
      }),
    }).then(
      function (res) {
        var now = Math.floor(Date.now() / 1000);
        var event = nextEvent((res && res.events) || [], now);
        if (!event) return showEmpty(me);
        me.$mountPoint.find('.dt_state').html(eventHtml(event));
        setImageVisible(me, true);
      },
      function (jqXHR) {
        showError(
          me,
          (jqXHR && jqXHR.responseJSON && jqXHR.responseJSON.error) ||
            misc().f1_error ||
            'Unable to fetch the F1 calendar.'
        );
      }
    );
  }
})();

Dashticz.register(DT_f1);
