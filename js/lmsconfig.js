/* global blocks */
// LMS-specific Device Config enhancement.
// Adds a Player controls On/Off switch without changing the generic Device
// Editor option model. The value is stored as the normal LMS block property
// `player_controls`; omitted/true means controls remain visible.
(function () {
  'use strict';

  var FIELD = 'player_controls';
  var SWITCH_ID = 'de-config-lms-player-controls';

  function _findCustomFieldRow($popup) {
    var $found = $();
    $popup.find('.de-custom-field-row').each(function () {
      var $row = $(this);
      var field = $.trim(String($row.find('.de-custom-field-name').val() || ''));
      if (field.toLowerCase() === FIELD) $found = $row;
    });
    return $found.first();
  }

  function _ensureStorageRow($popup, enabled) {
    var $row = _findCustomFieldRow($popup);
    if (!$row.length) {
      $row = $(
        '<div class="de-custom-field-row input-group input-group-sm mb-2 d-none lms-player-controls-storage">' +
          '<input type="text" class="form-control de-custom-field-name" value="' +
          FIELD +
          '">' +
          '<input type="text" class="form-control de-custom-field-setting" value="true">' +
          '</div>'
      );
      var $fields = $popup.find('.de-custom-fields').first();
      if ($fields.length) $fields.append($row);
    }
    $row.addClass('d-none lms-player-controls-storage');
    $row.find('.de-custom-field-name').val(FIELD);
    $row.find('.de-custom-field-setting').val(enabled ? 'true' : 'false');
    return $row;
  }

  function _storedValue($popup) {
    var $row = _findCustomFieldRow($popup);
    if (!$row.length) return true;
    var raw = $.trim(String($row.find('.de-custom-field-setting').val() || '')).toLowerCase();
    return raw !== 'false' && raw !== '0';
  }

  function _enhancePopup() {
    var $popup = $('#de-config-popup');
    if (!$popup.length || !$popup.find('#de-config-lms-hide-when-off').length) return;
    if ($popup.find('#' + SWITCH_ID).length) return;

    var enabled = _storedValue($popup);
    _ensureStorageRow($popup, enabled);

    var $hideWhenOff = $popup.find('#de-config-lms-hide-when-off').closest('label.form-switch');
    var html =
      '<label class="form-check form-switch mb-3 lms-player-controls-option">' +
      '<input class="form-check-input de-lms-switch" type="checkbox" id="' +
      SWITCH_ID +
      '"' +
      (enabled ? ' checked' : '') +
      '>' +
      '<span class="form-check-label">Player controls</span></label>';
    if ($hideWhenOff.length) $hideWhenOff.after(html);

    $popup.on('change.lmsPlayerControls', '#' + SWITCH_ID, function () {
      _ensureStorageRow($popup, $(this).is(':checked'));
    });
  }

  function _applyRuntimeVisibility() {
    $('.lms-block').each(function () {
      var $block = $(this);
      var key = String($block.attr('data-id') || '');
      var definition = key && typeof blocks !== 'undefined' ? blocks[key] : null;
      var hidden = !!(definition && definition.player_controls === false);
      $block.toggleClass('lms-player-controls-hidden', hidden);
    });
  }

  var observer = new MutationObserver(function () {
    _enhancePopup();
    _applyRuntimeVisibility();
  });

  function start() {
    observer.observe(document.body, { childList: true, subtree: true });
    _enhancePopup();
    _applyRuntimeVisibility();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();

//# sourceURL=js/lmsconfig.js
