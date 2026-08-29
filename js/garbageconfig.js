/* Garbage Widget Config enhancement.
 *
 * The Widget Editor can show a generated catalog icon such as
 * `fas fa-trash-alt` while leaving data-generated-icon="true" on the row.
 * Generated icons are intentionally skipped by the generic save path, which
 * means the Garbage widget receives no `icon` property and therefore cannot
 * render the selected Font Awesome icon. Custom images do not have that flag,
 * which is why Image already works.
 *
 * Mark the active Garbage icon row as explicit immediately before the Widget
 * Editor handles OK. The Garbage component itself is not changed: its existing
 * img/garbage/kliko.png and waste-type image/color behavior stay untouched.
 */
(function () {
  'use strict';

  function garbagePopup() {
    var popup = document.getElementById('we-config-popup');
    if (!popup || !popup.querySelector('[data-cfg-key="garbage_company"]')) {
      return null;
    }
    return popup;
  }

  function markIconExplicit(popup) {
    var toggle = popup.querySelector('[data-block-option="icon"]');
    var row = popup.querySelector('.we-icon-field-row');
    if (!toggle || !row || !toggle.classList.contains('active')) return;

    var setting = row.querySelector('.we-custom-field-setting');
    if (!setting || !String(setting.value || '').trim()) return;

    row.setAttribute('data-generated-icon', 'false');
  }

  document.addEventListener(
    'click',
    function (event) {
      var popup = garbagePopup();
      if (!popup) return;

      var target = event.target;
      if (!target || !target.closest) return;

      if (target.closest('#we-cfg-ok-btn')) {
        markIconExplicit(popup);
        return;
      }

      if (target.closest('[data-block-option="icon"]')) {
        window.setTimeout(function () {
          var currentPopup = garbagePopup();
          if (currentPopup) markIconExplicit(currentPopup);
        }, 0);
      }
    },
    true
  );
})();

//# sourceURL=js/garbageconfig.js
