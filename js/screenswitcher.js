/* global settings toSlide buildStandby disableStandby standbyActive myswiper isCustomConfigMode */
// eslint-disable-next-line no-unused-vars
var DashticzScreenSwitcher = (function () {
  'use strict';

  var initialized = false;
  var addingScreen = false;

  function getScreenNumbers() {
    var nums = [];
    $('.dt-container .screen[data-screenindex]').each(function () {
      var n = parseInt($(this).attr('data-screenindex'), 10);
      if (n > 0 && nums.indexOf(n) < 0) nums.push(n);
    });
    nums.sort(function (a, b) {
      return a - b;
    });
    return nums.length ? nums : [1];
  }

  function getActiveScreenNumber() {
    if (typeof standbyActive !== 'undefined' && standbyActive) {
      return 'standby';
    }
    var $active = $('.dt-container .screen.swiper-slide-active[data-screenindex]');
    if (!$active.length) {
      $active = $('.dt-container .screen[data-screenindex]:visible').first();
    }
    var n = parseInt($active.attr('data-screenindex'), 10);
    return n > 0 ? n : 1;
  }

  function slideIndexForScreen(screenNumber) {
    var idx = -1;
    $('.dt-container .screen[data-screenindex]').each(function (i) {
      if (String($(this).attr('data-screenindex')) === String(screenNumber)) {
        idx = i;
        return false;
      }
    });
    return idx;
  }

  function enterStandbyManual() {
    if (typeof standbyActive !== 'undefined' && standbyActive) {
      updateActive();
      return;
    }
    $('body').addClass('standby');
    $('.dt-container').hide();
    if (typeof buildStandby === 'function') {
      buildStandby();
    }
    // Mark active without firing idle standby call URLs.
    if (typeof standbyActive !== 'undefined') {
      standbyActive = true;
    }
    mountIntoStandby();
    updateActive();
  }

  function goToScreen(screenNumber) {
    if (screenNumber === 'standby' || screenNumber === 'S') {
      enterStandbyManual();
      return;
    }

    var num = parseInt(screenNumber, 10);
    if (!(num > 0)) return;

    if (typeof standbyActive !== 'undefined' && standbyActive) {
      if (typeof disableStandby === 'function') {
        disableStandby();
      }
    }

    var idx = slideIndexForScreen(num);
    if (idx < 0) {
      updateActive();
      return;
    }

    if (typeof myswiper !== 'undefined' && myswiper) {
      if (typeof toSlide === 'function') {
        toSlide(idx);
      } else {
        myswiper.slideTo(idx, 0, true);
      }
    } else {
      $('.dt-container .screen').hide();
      $('.dt-container .screen[data-screenindex="' + num + '"]').show();
    }
    updateActive();
  }

  function buildButtonsHtml() {
    var screens = getScreenNumbers();
    var active = getActiveScreenNumber();
    var customMode =
      typeof isCustomConfigMode === 'function' && isCustomConfigMode();
    var html =
      '<div class="dt-screen-switcher" role="group" aria-label="Screens">';

    html +=
      '<button type="button" class="dt-screen-btn' +
      (active === 'standby' ? ' active' : '') +
      '" data-screen="standby" title="Standby">S</button>';

    screens.forEach(function (n) {
      html +=
        '<button type="button" class="dt-screen-btn' +
        (String(active) === String(n) ? ' active' : '') +
        '" data-screen="' +
        n +
        '" title="Screen ' +
        n +
        '">' +
        n +
        '</button>';
    });

    if (!customMode) {
      html +=
        '<button type="button" class="dt-screen-btn dt-screen-add" data-screen="add" ' +
        'title="Screen toevoegen" aria-label="Screen toevoegen">+</button>';
    }

    html += '</div>';
    return html;
  }

  function renderInto($host) {
    if (!$host || !$host.length) return;
    $host.find('.dt-screen-switcher').remove();
    $host.prepend(buildButtonsHtml());
  }

  function refreshAll() {
    $('.dt-screen-switcher-host, .dt-screen-switcher-bar').each(function () {
      renderInto($(this));
    });
    updateActive();
  }

  function updateActive() {
    var active = getActiveScreenNumber();
    $('.dt-screen-btn').removeClass('active');
    $('.dt-screen-btn[data-screen="' + active + '"]').addClass('active');
  }

  function mountIntoStandby() {
    var $standby = $('.screenstandby .row').first();
    if (!$standby.length) return;
    if (!$standby.children('.dt-screen-switcher-bar').length) {
      $standby.prepend(
        '<div class="dt-screen-switcher-bar col-xs-12"></div>'
      );
    }
    renderInto($standby.children('.dt-screen-switcher-bar'));
  }

  function addScreen() {
    if (addingScreen) return;
    if (typeof _PHP_INSTALLED !== 'undefined' && !_PHP_INSTALLED) {
      alert('PHP not available — adding a screen is disabled.');
      return;
    }

    var next = 1;
    getScreenNumbers().forEach(function (n) {
      if (n >= next) next = n + 1;
    });

    addingScreen = true;
    $('.dt-screen-add').prop('disabled', true);

    $.getJSON(settings['dashticz_php_path'] + 'info.php?get=csrf')
      .then(function (data) {
        return $.ajax({
          url: 'js/savescreens.php',
          method: 'POST',
          contentType: 'application/json',
          data: JSON.stringify({ action: 'add', screen: next }),
          dataType: 'json',
          headers: { 'X-Dashticz-CSRF': data.token },
        });
      })
      .done(function () {
        window.location.reload();
      })
      .fail(function (xhr) {
        addingScreen = false;
        $('.dt-screen-add').prop('disabled', false);
        var msg =
          xhr.responseJSON && xhr.responseJSON.error
            ? xhr.responseJSON.error
            : 'Could not add screen.';
        alert('Error: ' + msg);
      });
  }

  function init() {
    if (initialized) {
      refreshAll();
      return;
    }
    initialized = true;

    $('.dt-screen-switcher-host, .topbar-settings-wrap').each(function () {
      var $host = $(this).hasClass('dt-screen-switcher-host')
        ? $(this)
        : $(this).children('.dt-screen-switcher-host');
      if (!$host.length) $host = $(this);
      renderInto($host);
    });

    $(document)
      .off('click.screenswitcher')
      .on('click.screenswitcher', '.dt-screen-btn', function (event) {
        event.preventDefault();
        event.stopPropagation();
        var screen = String($(this).data('screen') || '');
        if (screen === 'add') {
          addScreen();
          return;
        }
        goToScreen(screen);
      });

    if (typeof myswiper !== 'undefined' && myswiper) {
      myswiper.on('slideChange transitionEnd', updateActive);
    } else {
      // Swiper may initialize shortly after topbar.
      setTimeout(function () {
        if (typeof myswiper !== 'undefined' && myswiper) {
          myswiper.on('slideChange transitionEnd', updateActive);
        }
      }, 500);
    }

    updateActive();
  }

  return {
    init: init,
    refresh: refreshAll,
    updateActive: updateActive,
    goToScreen: goToScreen,
    getActiveScreenNumber: getActiveScreenNumber,
    getScreenNumbers: getScreenNumbers,
    mountIntoStandby: mountIntoStandby,
    buildButtonsHtml: buildButtonsHtml,
  };
})();

//# sourceURL=js/screenswitcher.js
