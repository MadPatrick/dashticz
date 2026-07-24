/* global Domoticz settings columns blocks */
// eslint-disable-next-line no-unused-vars
var DashticzDeviceEditor = (function () {
  'use strict';

  /* ── state ──────────────────────────────────────────────────── */
  var managedDevices = [];   // IDX values managed by the device editor column

  /* ── public API ─────────────────────────────────────────────── */
  function open() {
    _init();
    _buildAndShowModal();
  }

  /* ── initialise managed-device list from existing config ──── */
  function _init() {
    managedDevices = [];
    if (
      typeof columns !== 'undefined' &&
      columns['device_editor'] &&
      Array.isArray(columns['device_editor']['blocks'])
    ) {
      columns['device_editor']['blocks'].forEach(function (b) {
        var idx = _toNumericIdx(b);
        if (idx && managedDevices.indexOf(idx) < 0) managedDevices.push(idx);
      });
    }
  }

  /* ── collect every device IDX currently used in any column ── */
  function _getAllDashticzDeviceIdxs() {
    var seen = {};
    if (typeof columns !== 'undefined') {
      Object.keys(columns).forEach(function (colKey) {
        var col = columns[colKey];
        if (col && Array.isArray(col.blocks)) {
          col.blocks.forEach(function (b) {
            var idx = _toNumericIdx(b);
            if (idx) seen[idx] = true;
          });
        }
      });
    }
    return Object.keys(seen)
      .map(Number)
      .sort(function (a, b) { return a - b; });
  }

  /* ── convert a block reference to a positive numeric IDX ──── */
  function _toNumericIdx(b) {
    if (typeof b === 'number' && b > 0) return b;
    if (typeof b === 'string') {
      var n = parseInt(b, 10);
      if (n > 0 && String(n) === b) return n;
    }
    if (typeof b === 'object' && b !== null && typeof b.idx === 'number' && b.idx > 0) {
      return b.idx;
    }
    return 0;
  }

  /* ── build available device list (Domoticz minus Dashticz) ── */
  function _getAvailableDevices(dashticzIdxs) {
    var all = Domoticz.getAllDevices();
    return Object.keys(all)
      .filter(function (key) {
        if (!key || key[0] === '_') return false;   // internal entries
        var idx = parseInt(key, 10);
        return idx > 0 && String(idx) === String(key) && dashticzIdxs.indexOf(idx) < 0;
      })
      .map(function (key) {
        var d = all[key];
        return {
          idx:  parseInt(key, 10),
          name: d.Name || ('Device ' + key),
          type: d.Type  || '',
        };
      })
      .sort(function (a, b) { return a.name.localeCompare(b.name); });
  }

  /* ── build and display the modal ───────────────────────────── */
  function _buildAndShowModal() {
    $('#deviceeditorpopup').remove();

    var dashticzIdxs   = _getAllDashticzDeviceIdxs();
    var allDomoticz    = Domoticz.getAllDevices();
    var available      = _getAvailableDevices(dashticzIdxs);

    $('body').append(_buildModalHtml(dashticzIdxs, available, allDomoticz));
    _attachHandlers(available, allDomoticz);

    var el = document.getElementById('deviceeditorpopup');
    if (window.bootstrap && window.bootstrap.Modal) {
      window.bootstrap.Modal.getOrCreateInstance(el).show();
    }
  }

  /* ── build the full modal HTML string ──────────────────────── */
  function _buildModalHtml(dashticzIdxs, available, allDomoticz) {
    var html = '';
    html += '<div class="modal fade" id="deviceeditorpopup" tabindex="-1"';
    html += ' aria-labelledby="de-title" aria-hidden="true">';
    html += '<div class="modal-dialog modal-lg modal-dialog-scrollable">';
    html += '<div class="modal-content">';

    /* header */
    html += '<div class="modal-header">';
    html += '<h5 class="modal-title" id="de-title">';
    html += '<i class="fas fa-pencil-alt me-2" aria-hidden="true"></i>Device Editor';
    html += '</h5>';
    html += '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>';
    html += '</div>';

    /* body */
    html += '<div class="modal-body">';

    /* section 1 – current devices */
    html += '<h6 class="de-section-title">Devices in Dashticz</h6>';
    html += '<div id="de-device-list" class="de-device-list">';
    if (dashticzIdxs.length === 0) {
      html += '<div class="de-empty">No devices configured in Dashticz.</div>';
    } else {
      dashticzIdxs.forEach(function (idx) {
        html += _deviceItemHtml(idx, allDomoticz, false);
      });
    }
    html += '</div>';

    /* section 2 – add devices */
    html += '<h6 class="de-section-title mt-3">Add device from Domoticz</h6>';
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
    html += '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>';
    html += '<button type="button" class="btn btn-primary" id="de-save-btn"';
    if (typeof _PHP_INSTALLED !== 'undefined' && !_PHP_INSTALLED) {
      html += ' disabled';
    }
    html += '>Save</button>';
    html += '</div>';

    html += '</div></div></div>'; /* content, dialog, modal */
    return html;
  }

  /* ── HTML for a single device-list row ─────────────────────── */
  function _deviceItemHtml(idx, allDomoticz, isNew) {
    var device = allDomoticz[String(idx)] || allDomoticz[idx];
    var name   = device ? _esc(device.Name)  : 'Unknown device';
    var type   = device ? _esc(device.Type)  : '';
    var cls    = 'de-device-item' + (isNew ? ' de-device-item-new' : '');
    var html   = '<div class="' + cls + '" data-idx="' + idx + '">';
    html += '<span class="de-device-idx">IDX\u00a0' + idx + '</span>';
    html += '<span class="de-device-name">' + name + '</span>';
    if (type) html += '<span class="de-device-type">' + type + '</span>';
    html += '</div>';
    return html;
  }

  /* ── HTML for one add-row (select + button) ─────────────────── */
  function _addRowHtml(deviceList) {
    if (deviceList.length === 0) {
      return '<div class="de-empty">All Domoticz devices are already in Dashticz.</div>';
    }
    var html = '<div class="de-add-row">';
    html += '<select class="form-select de-device-select" aria-label="Select device to add">';
    html += '<option value="">— Select a device —</option>';
    deviceList.forEach(function (d) {
      html += '<option value="' + d.idx + '">' + _esc(d.name) + ' (IDX\u00a0' + d.idx + ')</option>';
    });
    html += '</select>';
    html += '<button type="button" class="btn btn-success btn-sm de-add-btn ms-2" title="Add device">';
    html += '<i class="fas fa-plus" aria-hidden="true"></i>';
    html += '</button>';
    html += '</div>';
    return html;
  }

  /* ── wire up event handlers ─────────────────────────────────── */
  function _attachHandlers(available, allDomoticz) {
    /* + button */
    $('#de-add-rows').on('click', '.de-add-btn', function () {
      var $row    = $(this).closest('.de-add-row');
      var $select = $row.find('.de-device-select');
      var idx     = parseInt($select.val(), 10);
      if (!idx) return;

      if (managedDevices.indexOf(idx) < 0) managedDevices.push(idx);

      /* update device-list section */
      $('#de-device-list .de-empty').remove();
      $('#de-device-list').append(_deviceItemHtml(idx, allDomoticz, true));

      /* remove the completed row */
      $row.remove();

      /* remove added device from every remaining select */
      $('#de-add-rows .de-device-select option[value="' + idx + '"]').remove();

      /* add a fresh row only when there are still options left */
      var remaining = available.filter(function (d) {
        return managedDevices.indexOf(d.idx) < 0;
      });
      if (remaining.length > 0) {
        $('#de-add-rows .de-empty').remove();
        var $newRow = $(_addRowHtml(remaining));
        /* remove already-managed IDXs from the new select */
        managedDevices.forEach(function (mid) {
          $newRow.find('option[value="' + mid + '"]').remove();
        });
        $('#de-add-rows').append($newRow);
      } else if ($('#de-add-rows .de-add-row').length === 0) {
        $('#de-add-rows').html('<div class="de-empty">All Domoticz devices are already in Dashticz.</div>');
      }
    });

    /* save button */
    $('#deviceeditorpopup').on('click', '#de-save-btn', _save);

    /* cleanup on hide */
    $('#deviceeditorpopup').one('hidden.bs.modal', function () {
      $('#deviceeditorpopup').remove();
    });
  }

  /* ── save to CONFIG.js via PHP ──────────────────────────────── */
  function _save() {
    var $btn = $('#de-save-btn').prop('disabled', true).text('Saving\u2026');

    $.getJSON(settings['dashticz_php_path'] + 'info.php?get=csrf')
      .then(function (data) {
        return $.ajax({
          url:         'js/saveblocks.php',
          method:      'POST',
          contentType: 'application/json',
          data:        JSON.stringify({ devices: managedDevices }),
          dataType:    'json',
          headers:     { 'X-Dashticz-CSRF': data.token },
        });
      })
      .done(function () {
        $btn.removeClass('btn-primary').addClass('btn-success').text('Saved!');
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
          : 'Devices could not be saved automatically.';
        $btn.prop('disabled', false).text('Save');
        alert('Error: ' + msg);
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

  return { open: open };
}());

//# sourceURL=js/deviceeditor.js
