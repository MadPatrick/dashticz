.. _weatherinfo :

Weather info
============

The Weather Info widget shows the rain forecast and the current weather of a
location. It is standalone (no Domoticz device needed) and based on the
`domoticz_weatherinfo <https://github.com/MadPatrick/domoticz_weatherinfo>`_
plugin, with the same data sources, texts and options: the rain forecast comes
from the Buienradar ``raintext`` feed, the current weather from Open-Meteo.
Both are downloaded server-side (``vendor/dashticz/weatherinfo/index.php``) and
cached, so several connected dashboards share one download.

The tile shows two lines, like the Text device of the plugin:

* the rain status: ``Het regent nu 0,8 mm/u``, ``Regen verwacht 1,2 tot 2,4
  mm/u``, ``2,4 mm/u regen verwacht om 14:35`` or ``Voorlopig droog`` (in
  English ``Raining now``, ``Rain expected``, ``rain expected at`` and ``Dry for
  now``);
* the weather: temperature, description, wind (direction and force in Beaufort,
  for example ``NW4``) and a weather icon, for example ``19,7°C ● Bewolkt ● NW4
  ●`` followed by the icon. Which parts are shown is the *Text* setting.

The plugin's Rainfall device (the current rain intensity) is an optional extra
row, see ``wishowrainfall``. The accumulated rain (mm) of that device is a
running total in Domoticz and is not shown by the widget.

You can place it several times on one screen, for example for two locations.
Add it via the Screen Editor: "Add items" -> Widgets -> Weather info (in the
"Widgets (multiple per screen)" section). Change the settings of a placed tile
with the cog icon.

Settings
--------

These are block properties. The Screen Editor writes only the ones that differ
from the default. The first column shows the matching option of the plugin.

.. list-table::
  :header-rows: 1
  :widths: 5 30
  :class: tight-table

  * - Setting
    - Description
  * - wimode
    - ``'forecast'``. Required: this property makes the block a Weather Info
      widget
  * - wilat, wilon
    - Plugin options *Latitude (lat)* and *Longitude (lon)*. Optional location;
      a comma is accepted as decimal separator. Default: empty, which uses the
      location of Domoticz (Setup -> Settings -> System). Set both or none
  * - wipollminutes
    - Plugin option *Poll-interval (min)*. How often the rain forecast is
      downloaded, ``1``-``60`` minutes. Default: 5. Like in the plugin, the
      current weather is downloaded once every 15 minutes
  * - wilanguage
    - Plugin option *Language*. ``'nl'`` (default) or ``'en'``: the language of
      the status text, the weather description and the wind direction
      (``NO``/``ZW`` or ``NE``/``SW``)
  * - wiformat
    - Plugin option *Text device*: what follows the rain status.
      ``'temp'`` (status - temperature), ``'temp_logo'`` (status - temperature
      - logo), ``'temp_logo_wind'`` (status - temperature - wind - logo) or
      ``'temp_desc_logo_wind'`` (status - temperature - description - wind -
      logo; default)
  * - wishowrainfall
    - ``true``: an extra row with the current rain intensity in mm/h. Default:
      false
  * - wifontsize
    - Optional: font size of the tile in pixels (``8``-``60``), same as the
      font size of the cluster widget. Default: the size of the theme

The plugin's *Debug* option has no equivalent: errors are shown in the tile and
in the browser console.

Example
-------

.. code-block :: javascript

  blocks['weatherinfo_1'] = {
    title: 'Weather',
    width: 4,
    wimode: 'forecast',
    wilanguage: 'en',
    wiformat: 'temp_logo_wind'
  };
