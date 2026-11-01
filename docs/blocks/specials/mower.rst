.. _mower :

Mower
=====

The Mower widget shows a Husqvarna robotic mower, as the Domoticz Husqvarna
plugin creates its devices. The data comes from Domoticz: the devices of the
hardware whose name contains "Husqvarna" are found automatically, so there is
nothing to choose.

It shows the state, the location, the battery level (with a bar), a switch to
turn mowing on or off, and the buttons Start and Park. A device that does not
exist is not shown.

Add the widget via the Screen Editor: "Add items" -> Widgets -> Mower.

Settings
--------

.. list-table::
  :header-rows: 1
  :widths: 5 30
  :class: tight-table

  * - Parameter
    - Description
  * - mowermode
    - Always ``'info'``. This makes the block a Mower tile.

Example
-------

.. code-block:: javascript

  blocks['mower_1'] = {
    title: 'Husqvarna',
    icon: 'fas fa-robot',
    mowermode: 'info'
  };
