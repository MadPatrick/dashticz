/* LMS-specific Device Config enhancement.
 *
 * Adds a Player controls On/Off switch to an LMS Device Config popup and
 * stores the value as the normal block property `player_controls` through
 * the Device Editor's existing custom-field save path.
 *
 * It also restores the normal Dashticz icon column for LMS blocks. The LMS
 * component renders its own dt_state content and therefore does not currently
 * create the generic .col-icon element for Font Awesome icons. A selected
 * custom image could still appear through the old cover-badge path, which is
 * why images and Font Awesome behaved differently. This module makes both use
 * the same normal .col-icon structure.
 *
 * Device Editor auto-generates a default icon row when a stored block has no
 * explicit icon. That row is normally ignored on save while it still carries
 * data-generated-icon="true". For LMS this caused the visible/selected
 * Font Awesome value (for example `fas fa-music`) never to reach CONFIG.js.
 * The LMS popup therefore marks an active non-empty icon row as an explicit
 * user choice before Device Editor validates/saves it.
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

  function fixLmsIconPersistence(popup) {
    var iconToggle = popup.querySelector(
      '.de-config-option[data-option="icon"]'
    );
    var iconRow = popup.querySelector('.de-icon-field-row');
    if (!iconToggle || !iconRow) return;

    var source = iconRow.querySelector('.de-icon-source');
    var setting = iconRow.querySelector('.de-custom-field-setting');
    if (!setting) return;

    function markExplicitIfActive() {
      if (!iconToggle.classList.contains('active')) return;
      if (!String(setting.value || '').trim()) return;
      iconRow.setAttribute('data-generated-icon', 'false');
    }

    // The current Device Editor considers an LMS definition without an
    // explicit `icon` property enabled and shows its generated `fas fa-music`
    // value. If the UI says Icon is active, saving must persist that value.
    markExplicitIfActive();

    if (iconRow.getAttribute('data-lms-icon-persistence-wired') === 'true') {
      return;
    }
    iconRow.setAttribute('data-lms-icon-persistence-wired', 'true');

    setting.addEventListener('input', markExplicitIfActive);
    setting.addEventListener('change', markExplicitIfActive);
    if (source) source.addEventListener('change', markExplicitIfActive);

    // Device Editor's click handler is delegated on the popup, so it toggles
    // .active after this target-level listener runs. Defer one task and then
    // read the final state. When the user enables Icon, the default value is
    // now a real choice and must no longer be discarded as generated.
    iconToggle.addEventListener('click', function () {
      window.setTimeout(markExplicitIfActive, 0);
    });
  }

  function enhanceLmsPopup() {
    var popup = document.getElementById('de-config-popup');
    if (!popup) return;

    var hideWhenOff = popup.querySelector('#de-config-lms-hide-when-off');
    if (!hideWhenOff) return;

    fixLmsIconPersistence(popup);

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

  function normaliseFontAwesomeIcon(value) {
    var icon = String(value || '').trim();
    if (!icon) return '';

    var classes = icon.split(/\s+/);
    var hasFaGlyph = false;
    var hasFamily = false;
    for (var i = 0; i < classes.length; i++) {
      if (/^fa-/.test(classes[i])) hasFaGlyph = true;
      if (
        /^(fas|far|fab|fal|fad|fat|fak|fa-solid|fa-regular|fa-brands|fa-light|fa-thin|fa-duotone)$/.test(
          classes[i]
        )
      ) {
        hasFamily = true;
      }
    }

    // Older/custom Device Config values sometimes contain only `fa-music`.
    // Font Awesome needs a style/family class as well.
    if (hasFaGlyph && !hasFamily) return 'fas ' + icon;
    return icon;
  }

  function ownIconColumn(block) {
    var children = block.children || [];
    for (var i = 0; i < children.length; i++) {
      if (
        children[i].classList &&
        children[i].classList.contains('lms-configured-icon')
      ) {
        return children[i];
      }
    }
    return null;
  }

  function genericIconColumn(block) {
    var children = block.children || [];
    for (var i = 0; i < children.length; i++) {
      if (children[i].classList && children[i].classList.contains('col-icon')) {
        return children[i];
      }
    }
    return null;
  }

  function syncConfiguredIcon(block, definition) {
    var icon = normaliseFontAwesomeIcon(definition && definition.icon);
    var image = String((definition && definition.image) || '').trim();
    var signature = icon ? 'icon:' + icon : image ? 'image:' + image : '';
    var column = ownIconColumn(block);

    if (!signature) {
      if (column && column.parentNode) column.parentNode.removeChild(column);
      return;
    }

    // If the core renderer starts supplying a normal icon column again in a
    // future version, leave that renderer in charge instead of duplicating it.
    var generic = genericIconColumn(block);
    if (generic && generic !== column) return;

    if (!column) {
      column = document.createElement('div');
      column.className = 'col-icon lms-configured-icon';
      var content = null;
      for (var i = 0; i < block.children.length; i++) {
        if (block.children[i].classList.contains('dt_content')) {
          content = block.children[i];
          break;
        }
      }
      block.insertBefore(column, content || block.firstChild);
    }

    if (column.getAttribute('data-lms-icon') === signature) return;
    column.setAttribute('data-lms-icon', signature);
    while (column.firstChild) column.removeChild(column.firstChild);

    if (icon) {
      var em = document.createElement('em');
      em.className = icon + ' icon';
      em.setAttribute('aria-hidden', 'true');
      column.appendChild(em);
      return;
    }

    var img = document.createElement('img');
    img.className = 'icon';
    img.src = 'img/' + image;
    img.alt = '';
    column.appendChild(img);
  }

  function applyRuntimeSettings() {
    var definitions = window.blocks;
    if (!definitions) return;

    var lmsBlocks = document.querySelectorAll('.lms-block[data-id]');
    for (var i = 0; i < lmsBlocks.length; i++) {
      var block = lmsBlocks[i];
      var key = String(block.getAttribute('data-id') || '');
      var definition = key ? definitions[key] : null;
      if (!definition) continue;

      var hidden = definition.player_controls === false;
      block.classList.toggle('lms-player-controls-hidden', hidden);
      syncConfiguredIcon(block, definition);
    }
  }

  function tick() {
    enhanceLmsPopup();
    applyRuntimeSettings();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tick);
  } else {
    tick();
  }
  window.setInterval(tick, POLL_MS);
})();

//# sourceURL=js/lmsconfig.js
