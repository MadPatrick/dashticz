.. _toon :

Toon
====

The Toon widget shows the sensors and controls of a Toon thermostat, as the
Domoticz Toon plugin creates them. The data comes from Domoticz: the devices of
the hardware whose name contains "Toon" are found automatically, so there is
nothing to choose.

It shows the room temperature, the thermostat setpoint with - and + buttons,
the boiler pressure, boiler state and modulation (with a bar), the scene
buttons, the program info and a summer mode button. A device that does not
exist is not shown.

Add the widget via the Screen Editor: "Add items" -> Widgets -> Toon.

Settings
--------

.. list-table::
  :header-rows: 1
  :widths: 5 30
  :class: tight-table

  * - Parameter
    - Description
  * - toonmode
    - Always ``'info'``. This makes the block a Toon tile.

Example
-------

.. code-block:: javascript

  blocks['toon_1'] = {
    title: 'Toon',
    icon: 'fas fa-temperature-half',
    toonmode: 'info'
  };
