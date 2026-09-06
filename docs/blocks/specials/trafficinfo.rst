.. _trafficinfo :

Traffic info
################

With a traffic info block you can show Dutch traffic info, from RWS (Rijkswaterstaat, the
default, no API key needed), ANWB (requires an API key, and ANWB no longer issues new ones),
or your own custom JSON endpoint.

For public transport info see :ref:`publictransport`.

A traffic info block can be configured as follows::

    var trafficinfo = {}
    trafficinfo.rwsA1 = {
        trafficJams: true,
        roadWorks: false,
        radars: false,
        road:'A1',
        provider: 'rws',
        show_lastupdate:true,
        icon: 'fas fa-car',
        width:12,
        results: 100 };

segStart and segEnd can also be provided to filter the results even more (ANWB only).

.. image :: img/trafficinfo.jpg


Parameters
----------

.. list-table:: 
  :header-rows: 1
  :widths: 5, 30
  :class: tight-table
      
  * - Parameter
    - Description
  * - road
    - Name of the road(s) to show, comma seperated (Example: "A1, A73")
  * - title
    - Title of the block
  * - show_lastupdate
    - ``false`` , ``true``. To display the time of the last update.
  * - provider
    - | Traffic info provider to use. Choose from
      | ``'rws'`` Rijkswaterstaat (the Netherlands, default, no API key needed, no radar data)
      | ``'anwb'`` ANWB (the Netherlands, requires ``settings['anwb_apikey']``; ANWB no longer issues new API keys)
      | ``'custom'`` Your own JSON endpoint, set via ``customUrl``. See :ref:`trafficinfo_custom`.
  * - customUrl
    - URL of your own JSON endpoint, only used when ``provider`` is ``'custom'``. See :ref:`trafficinfo_custom`.
  * - maxDistance
    - | Only show items within this distance, in km straight-line, from ``latitude``/``longitude``. Leave unset to show everything (the default).
      | Currently only filters the ``rws`` provider, and ``custom`` items that provide their own ``lat``/``lon``. Also configurable from the Widget editor's Traffic information quick-add.
  * - latitude, longitude
    - | Reference location for ``maxDistance``. Leave both unset to use Domoticz's own configured system location (Settings > System > Location) - only set these yourself if that isn't configured.
  * - icon
    - | The font-awesome icon (including ``fas fa-``)
      | ``'fas fa-car'``, ...
  * - refresh 
    - time in seconds for refreshing the data
  * - results 
    - Number of results to show 
  * - width
    - To customize the width. It's not recommended to change the default value (``12``) because of the size of the output.
  * - trafficJams
    - ``false`` , ``true``.  To show traffic jam info
  * - roadWorks
    - ``false`` , ``true``.  To show road work info
  * - radars
    - ``false`` , ``true``.  To show radar info. Only supported by the ``anwb`` provider and a ``custom`` endpoint that reports ``type: 'radar'`` items - the ``rws`` provider has no radar data.
  * - showempty
    - | Control text to show in case of no traffic announcements
      | ``false``: Don't show a message in case of no traffic announcements
      | ``true``: Display default message in case of no traffic announcements
      | ``'<text>'``: Display <text> in case of no traffic announcements
  * - showemptyroads
    - | Control text to show in case of no traffic announcements for a certain road (only applicable in combination with block parameter ``road``)
      | ``false``: Don't show a message in case of no traffic announcements for a certain road.
      | ``true``: Display default message in case of no traffic announcements for a certain road.
      | ``'<text>'``: Display <text> in case of no traffic announcements for a certain road.  
  * - url
    - ``'<url>'``: URL of the page to open in a popup frame or new window on click. 
  * - newwindow
    - | ``0``: open in current window
      | ``1``: open in new window
      | ``2``: open in new frame (default, to prevent a breaking change in default behavior)
      | ``3``: no new window/frame (for intent handling, api calls). HTTP get request.
      | ``4``: no new window/frame (for intent handling, api calls). HTTP post request. (forcerefresh not supported)

.. _trafficinfo_custom:

Custom provider
----------------

With ``provider: 'custom'`` and ``customUrl`` set to your own URL, Dashticz expects a JSON
array of items, one per jam/roadwork/radar::

    [
      {
        "road": "A27",
        "type": "jam",
        "from": "Utrecht",
        "to": "Hooipolder",
        "delay": 12,
        "distance": 3.4,
        "reason": "Ongeval",
        "lat": 52.09,
        "lon": 5.12
      },
      {
        "road": "A2",
        "type": "roadworks",
        "from": "Vianen",
        "to": "Everdingen",
        "reason": "Wegwerkzaamheden"
      }
    ]

.. list-table::
  :header-rows: 1
  :widths: 5, 30
  :class: tight-table

  * - Field
    - Description
  * - road
    - Road name, matched against the block's ``road`` filter (e.g. ``"A27"``)
  * - type
    - ``'jam'``, ``'roadworks'`` or ``'radar'`` - matched against the ``trafficJams``/``roadWorks``/``radars`` toggles
  * - from
    - Start location (optional)
  * - to
    - End location (optional)
  * - delay
    - Delay in minutes (optional, typically only for jams)
  * - distance
    - Length in km (optional)
  * - reason
    - Free text reason/description (optional)
  * - lat, lon
    - Coordinates (optional) - only items that provide both can be filtered by the block's ``maxDistance``

The endpoint is fetched the same way as the built-in providers (through Dashticz's CORS
proxy), so it doesn't need to send permissive CORS headers itself.

Styling
--------

In case no info is available then the CSS class ``empty`` will be added to block.
This can be used to adjust the styling of an empty block via ``custom.css``

