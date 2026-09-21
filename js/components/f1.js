/* global Dashticz Domoticz settings language */
//# sourceURL=js/components/f1.js
/* F1 widget: shows the race weekend schedule of the domoticz_F1 plugin
 * (https://github.com/MadPatrick/domoticz_F1). The plugin writes its schedule
 * into a Domoticz text device, one session per line:
 *
 *   Sat 5 Jul 12:30 : Qualifying
 *
 * The device idx (f1_idx) and the font size are global settings (Settings ->
 * Widgets -> F1, see js/widgeteditor.js), same as Weather, Garbage or PostNL.
 * Icon, title and background of the tile are the usual block options.
 *
 * Every row is: the session name and the date/time right-aligned. A line
 * without the ' : ' separator (for example the location line of the plugin's
 * 'next event' device) is shown as a heading.
 */
var DT_f1 = (function () {
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

  function fontSize() {
    var size = parseInt(settings['f1_fontsize'], 10);
    return size >= 8 && size <= 60 ? size : 14;
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

  // Plugin text -> [{when, what}]; 'when' is empty for a heading line.
  function parseLines(text) {
    return String(text || '')
      .split(/<br\s*\/?>|\r?\n/i)
      .map(function (line) {
        return line.trim();
      })
      .filter(Boolean)
      .map(function (line) {
        var pos = line.indexOf(' : ');
        return pos < 0
          ? { when: '', what: line }
          : {
              when: line.slice(0, pos).trim(),
              what: line.slice(pos + 3).trim(),
            };
      });
  }

  function rowsHtml(lines) {
    return lines
      .map(function (line) {
        if (!line.when) {
          return '<div class="f1-row f1-heading">' + esc(line.what) + '</div>';
        }
        return (
          '<div class="f1-row">' +
          '<span class="f1-label">' +
          esc(line.what) +
          '</span>' +
          '<span class="f1-value">' +
          esc(line.when) +
          '</span>' +
          '</div>'
        );
      })
      .join('');
  }

  function showMessage(me, text) {
    me.$mountPoint
      .find('.dt_state')
      .html('<div class="f1-rows f1-error">' + esc(text) + '</div>');
  }

  function refresh(me) {
    me.$mountPoint.find('.dt_state').css('font-size', fontSize() + 'px');
    var idx = parseInt(settings['f1_idx'], 10);
    if (!idx) {
      showMessage(
        me,
        misc().f1_not_configured ||
          'Configure the F1 device in Settings -> Widgets -> F1.'
      );
      return;
    }
    var device = Domoticz.getAllDevices(idx);
    if (!device) {
      showMessage(me, misc().f1_error || 'F1 device not found.');
      return;
    }
    me.$mountPoint
      .find('.dt_state')
      .html(
        '<div class="f1-rows">' + rowsHtml(parseLines(device.Data)) + '</div>'
      );
  }
})();

Dashticz.register(DT_f1);
