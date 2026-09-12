.. _cluster :

Cluster
=========

A Cluster block shows a fixed list of Domoticz devices as individual rows in
one block, each with its own on/off toggle. Unlike a :ref:`group`, which
shows one combined status and switches every member device to the same new
state together, each row in a Cluster switches only its own device.

Added via the Screen Editor's "Add items" menu -> Cluster, by picking
devices from the same device list used to add a normal device, filtered to
plain on/off switches (Domoticz's ``On/Off`` switch type) - a cluster row is
only ever a simple toggle.

Block parameters
----------------

.. list-table::
  :header-rows: 1
  :widths: 5 30
  :class: tight-table

  * - Parameter
    - Description
  * - width
    - ``1..12``: The width of the block relative to the column width
  * - title
    - ``'<string>'``: Custom title for the block
  * - icon
    - | Defines the icon for this block, choose from: https://fontawesome.com/icons?d=gallery&m=free
      | ``'fas fa-list-check'``
  * - devices
    - | Domoticz device id's shown as rows in this cluster (required, at least one)
      | ``[ 1, 3, 5]``: Devices 1, 3 and 5 are each shown as their own row
  * - usage
    - | Optional: maps a device's own idx to a companion Domoticz device that
        reports its power consumption, shown next to that row. Many switches
        (Shelly/Zigbee2MQTT/Sonoff plugs, etc.) report their wattage through
        a *separate* Domoticz device (Type ``Usage``, or Type ``General``
        with SubType ``kWh``) rather than a field on the switch itself -
        there is no reliable idx relationship between the two, so this is
        picked per row in the Cluster popup rather than auto-detected.
      | ``{ 12: 13 }``: Device 12's row also shows device 13's consumption

Example
-------

An example of a cluster block::

    blocks['mycluster'] = {
      type: 'cluster',
      title: 'Living room lights',
      devices: [12, 14, 16],
      usage: { 12: 13 }
    }
