var DashticzTopbar = (function () {
  'use strict';

  var autoHideTimer = null;
  var initialized = false;
  var paused = false;
  var autoHideMs = 0;
  var barSelectors = ['.colbar', '.topbar', '#topbar', '.navbar', '.header'];

  function getBars() {
    for (var i = 0; i < barSelectors.length; i++) {
      var $bars = $(barSelectors[i]);
      if ($bars.length) return $bars;
    }
    return $();
  }

  function resetTimer() {
    if (paused || !autoHideMs) return;
    clearTimeout(autoHideTimer);
    autoHideTimer = setTimeout(function () {
      autoHideTimer = null;
      getBars().slideUp(400);
    }, autoHideMs);
  }

  function showBars() {
    getBars().slideDown(400, function () {
      // slideDown restores display:block; flex keeps the topbar alignment.
      $(this).css('display', 'flex');
    });
    resetTimer();
  }

  function init() {
    if (initialized) return;

    var timeout = parseFloat(settings['topbar_timeout']);
    if (!timeout || timeout <= 0) return;

    initialized = true;
    autoHideMs = timeout * 1000;

    resetTimer();

    $(document).on('mousemove.topbarAutoHide', function (event) {
      var $bars = getBars();
      if (!$bars.length || event.clientY >= 20) return;

      if ($bars.is(':visible')) {
        resetTimer();
      } else {
        showBars();
      }
    });
  }

  // Keep the topbar visible and stop its auto-hide timer while some other
  // UI needs it to stay put - the Layout Editor both relies on the
  // topbar's own icons and measures its rendered height once, on open, to
  // work out how much of the target screen height the grid itself gets;
  // an auto-hide firing later (nothing resets the idle timer on a
  // touch-only tablet, which never fires mousemove) would silently make
  // that measurement stale without ever recomputing it.
  function pause() {
    if (paused) return;
    paused = true;
    clearTimeout(autoHideTimer);
    autoHideTimer = null;
    getBars().stop(true, true).show().css('display', 'flex');
  }

  function resume() {
    if (!paused) return;
    paused = false;
    resetTimer();
  }

  return { init: init, pause: pause, resume: resume };
})();

//# sourceURL=js/topbar.js
