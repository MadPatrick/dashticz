.. _car :

Car
===

The Car widget shows the status of a car, for example a BMW or a MINI, in its
own tile. The data is read directly from Domoticz devices, for example dummy
devices that are updated by your car integration. Place the widget once per
car; the block title is the name of the car.

What the tile shows:

- **Driving**: *On the road*, with the battery level and the mileage.
- **At home**: the battery level and the mileage. While the car charges it
  also shows *Charging until* followed by the time at which the car is charged
  (now plus the charge time in minutes), and the filled part of the battery
  bar pulses. An open door or window is shown as a warning.
- **Not at home**: *Not home*. When a door or window is open, the tile shows
  *Car is not home* with the warning instead.

The battery level is a progress bar of 10 segments, like the Bar display mode of
a device, with the percentage and the mileage below it. The color follows the
level: below 15% blinking red, below 30% red, below 50% orange, from 50% the
text color of the theme, and 100% green.

Add it via the Screen Editor: "Add items" -> Widgets -> Car. Change the
settings of a placed block with the cog icon.

Settings
--------

These are block properties. The Screen Editor writes only the ones that are
set. Every device option is the idx of a Domoticz device. A device that is not
set is treated as off (or 0).

.. list-table::
  :header-rows: 1
  :widths: 5 30
  :class: tight-table

  * - Setting
    - Description
  * - carmode
    - ``'status'``. Required: this property makes the block a Car widget
  * - carbattery
    - Idx of the device with the battery level in percent
  * - carmileage
    - Idx of the device with the mileage in km
  * - cardriving
    - Idx of the switch that is on while the car is driving
  * - carhome
    - Idx of the switch that is on while the car is at home
  * - carcharging
    - Idx of the switch that is on while the car charges
  * - carchargetime
    - Idx of the device with the minutes until the car is charged
  * - cardoor
    - Idx of the device that is ``Open`` (or on) while a door is open
  * - carwindows
    - Idx of the device that is ``Open`` (or on) while a window is open
  * - carfontsize
    - Optional: font size of the tile in pixels (``8``-``60``). Default: the
      size of the theme

Example:

.. code-block:: javascript

    blocks['bmw'] = {
        title: 'BMW',
        carmode: 'status',
        carbattery: 915,
        carmileage: 912,
        cardriving: 917,
        carhome: 918,
        carcharging: 913,
        carchargetime: 914,
        cardoor: 909,
        carwindows: 910,
        width: 4
    }

The texts (*On the road*, *Not home*, *Charging until*, ...) follow the
language of the dashboard.
