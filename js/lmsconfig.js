/* LMS-specific Device Config enhancement.
 *
 * Adds a Player controls On/Off switch to an LMS Device Config popup and
 * stores the value as the normal block property `player_controls` through
 * the Device Editor's existing custom-field save path.
 *
 * This module deliberately does not use MutationObserver and does not touch
 * the main Dashticz loader. It is safe to execute before the dashboard has
 * finished loading; the small polling loop only acts when the LMS popup or
 * an LMS block actually exists.
 */
(function () {
  'use strict';

  var FIELD = 'player_controls';
  var SWITCH_ID = 'de-config-lms-player-controls';
  var POLL_MS = 500;

  function findFieldRow(popup) {
    var rows = popup.querySelectorAll('.de-custom-field-row');
    for (var i = 0; i < rows.length; i++) {
      var input = rows[i].querySelector('.de-custom-field-name');
      var field = input ? String(input.value || '').trim().toLowerCase() : '';
      if (field === FIELD) return rows[i];
    }
    return null;
  }

  function storedEnabled(popup) {
    var row = findFieldRow(popup);
    if (!row) return true;
    var setting = row.querySelector('.de-custom-field-setting');
    var value = setting
      ? String(setting.value || '').trim().toLowerCase()
      : 'true';
    return value !== 'false' && value !== '0';
  }

  function ensureStorageRow(popup, enabled) {
    var row = findFieldRow(popup);
    if (!row) {
      var fields = popup.querySelector('.de-custom-fields');
      if (!fields) return null;

      row = document.createElement('div');
      row.className =
        'de-custom-field-row input-group input-group-sm mb-2 d-none de-lms-player-controls-storage';
      row.innerHTML =
        '<input type="text" class="form-control de-custom-field-name" value="' +
        FIELD +
        '">' +
        '<input type="text" class="form-control de-custom-field-setting" value="true">';
      fields.appendChild(row);
    }

    row.classList.add('d-none', 'de-lms-player-controls-storage');
    var nameInput = row.querySelector('.de-custom-field-name');
    var settingInput = row.querySelector('.de-custom-field-setting');
    if (nameInput) nameInput.value = FIELD;
    if (settingInput) settingInput.value = enabled ? 'true' : 'false';
    return row;
  }

  function enhanceLmsPopup() {
    var popup = document.getElementById('de-config-popup');
    if (!popup) return;

    var hideWhenOff = popup.querySelector('#de-config-lms-hide-when-off');
    if (!hideWhenOff) return;
    if (popup.querySelector('#' + SWITCH_ID)) return;

    var enabled = storedEnabled(popup);
    ensureStorageRow(popup, enabled);

    var option = document.createElement('label');
    option.className =
      'form-check form-switch mb-3 lms-player-controls-option';
    option.innerHTML =
      '<input class="form-check-input de-lms-switch" type="checkbox" id="' +
      SWITCH_ID +
      '"' +
      (enabled ? ' checked' : '') +
      '>' +
      '<span class="form-check-label">Player controls</span>';

    var host = hideWhenOff.closest('label.form-switch');
    if (host && host.parentNode) {
      host.parentNode.insertBefore(option, host.nextSibling);
    } else {
      hideWhenOff.parentNode.appendChild(option);
    }

    var toggle = option.querySelector('#' + SWITCH_ID);
    if (toggle) {
      toggle.addEventListener('change', function () {
        ensureStorageRow(popup, toggle.checked);
      });
    }
  }

  function applyRuntimeVisibility() {
    var definitions = window.blocks;
    if (!definitions) return;

    var lmsBlocks = document.querySelectorAll('.lms-block[data-id]');
    for (var i = 0; i < lmsBlocks.length; i++) {
      var block = lmsBlocks[i];
      var key = String(block.getAttribute('data-id') || '');
      var definition = key ? definitions[key] : null;
      var hidden = !!(definition && definition.player_controls === false);
      block.classList.toggle('lms-player-controls-hidden', hidden);
    }
  }

  function tick() {
    enhanceLmsPopup();
    applyRuntimeVisibility();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tick);
  } else {
    tick();
  }
  window.setInterval(tick, POLL_MS);
})();

//# sourceURL=js/lmsconfig.js
