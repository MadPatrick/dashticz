<?php
/* Helpers of the Fully Kiosk bridge (index.php), kept apart so the tests can
 * load them without running a request. */

/* The tablet's getDeviceInfo JSON -> the few values the widget needs:
 * battery (0-100 or null), plugged (bool) and screenOn (bool). Mirrors the
 * domoticz_fullykiosk plugin, which clamps the battery level to 0-100 and
 * treats anything that is not a number as unknown. */
function dashticz_fullykiosk_summary($info)
{
    if (!is_array($info)) {
        throw new RuntimeException('Fully Kiosk returned an unexpected response.');
    }
    $battery = null;
    if (isset($info['batteryLevel']) && is_numeric($info['batteryLevel'])) {
        $battery = max(0, min(100, (int) round((float) $info['batteryLevel'])));
    }
    return array(
        'battery' => $battery,
        'plugged' => !empty($info['isPlugged']),
        'screenOn' => !empty($info['screenOn']),
    );
}
