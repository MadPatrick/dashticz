/* global Dashticz Domoticz DT_function createDelayedFunction getIconStatusClass switchDevice */
//# sourceURL=js/components/cluster.js
/* Cluster: a Dashticz-only block that renders a fixed list of Domoticz
 * devices as individual rows - name plus its own on/off toggle - inside
 * one tile, added via the Screen Editor's "Add items" -> Cluster quick-add
 * popup (js/deviceeditor.js's _showClusterPopup()). Unlike Group
 * (js/components/group.js), which shows one combined status/icon and
 * switches every member device to the same new state together, each row
 * here switches only its own device - deliberately kept as a separate
 * block type rather than a Group mode, per the user request this was
 * built from. See docs/blocks/specials/cluster.rst.
 */
var DT_cluster = (function () {
  return {
    name: 'cluster',
    defaultCfg: function () {
      return {
        width: 4,
        refresh: 3600,
        containerClass: 'cluster-block',
      };
    },
    run: function (me) {
      me.devices = me.block.devices || [];
      me.devices.forEach(function (idx) {
        Dashticz.subscribeDevice(me, idx, false, function () {
          return refresh(me);
        });
      });
      me.delayed100 = createDelayedFunction(100);
      refresh(me);
    },
    refresh: refresh,
  };

  function refresh(me) {
    me.delayed100(function () {
      doRefresh(me);
    });
  }

  function doRefresh(me) {
    var allDevices = Domoticz.getAllDevices();
    // Cluster is a normal special block: js/dashticz.js's renderBlock()
    // already painted .dt_block's own .col-icon/.dt_title (from the block's
    // configured icon/title) before run()/refresh() ever runs. Writing into
    // .dt_state - the framework's own content slot, same as e.g. OWM/Weather
    // - instead of replacing .dt_block wholesale keeps that icon/title
    // intact instead of wiping it every refresh.
    var html = '<div class="cluster-rows">';
    me.devices.forEach(function (idx) {
      var device = allDevices[idx];
      if (!device) return;
      var status = getIconStatusClass(device.Status);
      html +=
        '<div class="cluster-row ' +
        status +
        '" data-idx="' +
        idx +
        '">' +
        '<span class="cluster-row-title">' +
        (device.Name || idx) +
        '</span>' +
        '<label class="cluster-row-switch">' +
        '<input type="checkbox" class="cluster-row-checkbox"' +
        (status === 'on' ? ' checked' : '') +
        '>' +
        '<span class="cluster-row-slider"></span>' +
        '</label>' +
        '</div>';
    });
    html += '</div>';
    me.$mountPoint.find('.dt_state').html(html);

    me.$mountPoint
      .find('.cluster-row-switch')
      .off('click')
      .on('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        var $row = $(this).closest('.cluster-row');
        var idx = $row.attr('data-idx');
        var device = allDevices[idx];
        if (!device) return;
        var newState =
          getIconStatusClass(device.Status) === 'on' ? 'Off' : 'On';
        switchDevice(
          {
            idx: idx,
            type: 'cluster',
            device: device,
            $mountPoint: me.$mountPoint,
          },
          newState
        );
      });
  }
})();

Dashticz.register(DT_cluster);
