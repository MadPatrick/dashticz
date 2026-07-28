<?php
require_once(__DIR__ . '/../vendor/dashticz/security.php');

dashticz_require_same_origin();
dashticz_require_csrf();

if (!isset($_SERVER['REQUEST_METHOD']) || $_SERVER['REQUEST_METHOD'] !== 'POST') {
    dashticz_json_error(405, 'Only POST requests are allowed.');
}

$rawBody = file_get_contents('php://input');
if ($rawBody === false) {
    dashticz_json_error(400, 'Unable to read request body.');
}

$data = json_decode($rawBody, true);
if (json_last_error() !== JSON_ERROR_NONE
    || !is_array($data)
    || !isset($data['widgets'])
    || !is_array($data['widgets'])
) {
    dashticz_json_error(400, 'Invalid widgets list.');
}

// Allowed widget config settings and their types
$allowedSettings = [
    // weather
    'owm_api'                => 'string',
    'owm_city'               => 'string',
    'owm_name'               => 'string',
    'owm_country'            => 'string',
    'owm_lang'               => 'string',
    'owm_days'               => 'bool',
    'owm_cnt'                => 'number',
    'owm_min'                => 'bool',
    'wu_api'                 => 'string',
    'wu_city'                => 'string',
    'wu_name'                => 'string',
    'wu_country'             => 'string',
    'use_fahrenheit'         => 'bool',
    'use_beaufort'           => 'bool',
    'translate_windspeed'    => 'bool',
    'static_weathericons'    => 'bool',
    // clock
    'boss_stationclock'      => 'string',
    'hide_seconds'           => 'bool',
    'hide_seconds_stationclock' => 'bool',
    // garbage
    'garbage_company'        => 'garbage_company',
    'garbage_icalurl'        => 'string',
    'google_api_key'         => 'string',
    'garbage_calendar_id'    => 'string',
    'garbage_zipcode'        => 'string',
    'garbage_street'         => 'string',
    'garbage_housenumber'    => 'string',
    'garbage_housenumberadd' => 'string',
    'garbage_maxitems'       => 'number',
    'garbage_width'          => 'number',
    'garbage_hideicon'       => 'bool',
    'garbage_icon_use_colors'=> 'bool',
    'garbage_use_colors'     => 'bool',
    'garbage_use_names'      => 'bool',
    'garbage_use_cors_prefix'=> 'bool',
    // sonarr
    'sonarr_url'             => 'string',
    'sonarr_apikey'          => 'string',
    'sonarr_maxitems'        => 'number',
    // spotify
    'spot_clientid'          => 'string',
];

$allowedGarbageCompanies = [
    'afvalinfo','afvalalert','afvalstoffendienst','almere','alphenaandenrijn','area',
    'avalex','avri','barafvalbeheer','best','blink','circulusberkel','cure','cyclusnv',
    'dar','deafvalapp','edg','gad','gemeenteberkelland','goes','googlecalendar',
    'groningen','hvc','ical','katwijk','maashorst','meerlanden','mijnafvalwijzer',
    'omrin','purmerend','rd4','recycleapp','rmn','rova','sudwestfryslan','suez',
    'twentemilieu','uden','veldhoven','venlo','venray','vianen','waalre','waardlanden',
];

// Process optional config settings
$configSettings = [];
if (isset($data['settings']) && is_array($data['settings'])) {
    foreach ($data['settings'] as $key => $value) {
        if (!preg_match('/^[A-Za-z0-9_]+$/', $key) || !isset($allowedSettings[$key])) {
            continue; // silently skip unknown keys
        }
        $type = $allowedSettings[$key];
        if ($type === 'bool') {
            $configSettings[$key] = (int)(bool)$value;
        } elseif ($type === 'number') {
            $configSettings[$key] = is_numeric($value) ? (float)$value : 0;
            if ($configSettings[$key] == (int)$configSettings[$key]) {
                $configSettings[$key] = (int)$configSettings[$key];
            }
        } elseif ($type === 'garbage_company') {
            if (in_array((string)$value, $allowedGarbageCompanies, true)) {
                $configSettings[$key] = (string)$value;
            }
        } else {
            // string: sanitize
            $str = (string)$value;
            if (strlen($str) <= 2048) {
                $configSettings[$key] = $str;
            }
        }
    }
}

$catalog = [
    'weather' => ['key' => 'widget_weather', 'width' => 12],
    'garbage' => ['key' => 'widget_garbage', 'width' => 6],
    'spotify' => ['key' => 'widget_spotify', 'width' => 6],
    'sonarr' => ['key' => 'widget_sonarr', 'width' => 8],
    'clock' => ['key' => 'widget_clock', 'width' => 4],
    'calendar' => ['key' => 'widget_calendar', 'width' => 8],
];

$widgets = [];
$seen = [];
foreach ($data['widgets'] as $entry) {
    if (!is_array($entry) || !isset($entry['id']) || !is_string($entry['id'])) {
        dashticz_json_error(400, 'Each widget must contain a valid id.');
    }

    $id = $entry['id'];
    if (!isset($catalog[$id])) {
        dashticz_json_error(400, 'Unknown widget id.');
    }
    if (isset($seen[$id])) {
        continue;
    }
    $seen[$id] = true;

    $widget = [
        'id' => $id,
        'key' => $catalog[$id]['key'],
        'width' => isset($entry['width'])
            ? max(1, min(12, (int)$entry['width']))
            : $catalog[$id]['width'],
        'height' => null,
    ];
    if (array_key_exists('height', $entry) && $entry['height'] !== null && $entry['height'] !== '') {
        $height = (int)(round(((int)$entry['height']) / 10) * 10);
        $widget['height'] = max(50, min(2000, $height));
    }

    if ($id === 'weather') {
        $provider = isset($entry['provider']) && is_string($entry['provider'])
            ? $entry['provider']
            : 'openweather';
        if ($provider !== 'openweather' && $provider !== 'wunderground') {
            dashticz_json_error(400, 'Unknown weather provider.');
        }
        $widget['provider'] = $provider;
    }

    if ($id === 'calendar') {
        $icalurl = isset($entry['icalurl']) && is_string($entry['icalurl'])
            ? trim($entry['icalurl'])
            : '';
        if (strlen($icalurl) > 2048 || !preg_match('#^https?://[^\s]+$#i', $icalurl)) {
            dashticz_json_error(400, 'Calendar requires a valid http(s) ICS URL.');
        }
        $widget['icalurl'] = $icalurl;
    }

    if ($id === 'clock') {
        $clockType = isset($entry['clockType']) && is_string($entry['clockType'])
            ? $entry['clockType']
            : 'basicclock';
        $allowedClockTypes = ['basicclock', 'stationclock', 'flipclock', 'haymanclock', 'miniclock'];
        if (!in_array($clockType, $allowedClockTypes, true)) {
            dashticz_json_error(400, 'Unknown clock type.');
        }
        $widget['clockType'] = $clockType;
    }

    $widgets[] = $widget;
}

$customDir = __DIR__ . '/../custom';
$configPath = $customDir . '/CONFIG.js';

if (file_exists($configPath)) {
    $config = @file_get_contents($configPath);
    if ($config === false) {
        dashticz_json_error(500, 'Unable to read CONFIG.js.');
    }
    if (trim($config) === '#EMPTY#') {
        $config = "var config = {}\n";
    }
} else {
    $config = "var config = {}\n";
}

$config = _widgetRemoveSection(
    $config,
    '// [layout-editor-start]',
    '// [layout-editor-end]'
);

$startMarker = '// [widget-editor-start]';
$endMarker = '// [widget-editor-end]';
$startPos = strpos($config, $startMarker);
if ($startPos !== false) {
    $endPos = strpos($config, $endMarker, $startPos);
    if ($endPos !== false) {
        $config = substr($config, 0, $startPos)
            . substr($config, $endPos + strlen($endMarker));
    } else {
        $config = substr($config, 0, $startPos);
    }
}
$config = rtrim($config);

if (!empty($widgets)) {
    $section = "\n\n" . $startMarker . "\n";
    $section .= "if(typeof blocks==='undefined') var blocks={};\n";

    foreach ($widgets as $widget) {
        $width = $widget['width'];
        $height = $widget['height'] !== null
            ? ",height:" . $widget['height']
            : '';
        $section .= "blocks['" . $widget['key'] . "']=";
        switch ($widget['id']) {
            case 'weather':
                $weatherType = $widget['provider'] === 'wunderground'
                    ? 'wunderground'
                    : 'weather';
                $section .= "{type:'" . $weatherType . "',widget_provider:'"
                    . $widget['provider']
                    . "',width:" . $width . ",title:'Weer'" . $height . "}";
                break;
            case 'garbage':
                $section .= "{type:'garbage',width:" . $width . ",title:'Afval'" . $height . "}";
                break;
            case 'spotify':
                $section .= "{type:'spotify',width:" . $width . ",title:'Spotify'" . $height . "}";
                break;
            case 'sonarr':
                $section .= "{type:'sonarr',width:" . $width
                    . ",title:'Sonarr',title_position:'left',view:'banner'" . $height . "}";
                break;
            case 'clock':
                $section .= "{type:'" . $widget['clockType'] . "',width:"
                    . $width . ",title:'Klok'" . $height . "}";
                break;
            case 'calendar':
                $section .= "{type:'calendar',width:" . $width
                    . ",title:'Kalender',icalurl:'"
                    . _widgetJsStringEscape($widget['icalurl'])
                    . "'" . $height . "}";
                break;
        }
        $section .= ";\n";
    }

    $chunks = _widgetChunks($widgets, 12);
    $columnKeys = [];
    $section .= "if(typeof columns==='undefined') var columns={};\n";
    foreach ($chunks as $index => $chunk) {
        $columnKey = 'we_col' . ($index + 1);
        $columnKeys[] = $columnKey;
        $keys = array_map(function ($widget) {
            return $widget['key'];
        }, $chunk);
        $section .= "columns['" . $columnKey . "']={blocks:['"
            . implode("','", $keys)
            . "'],width:12};\n";
    }

    $section .= "if(typeof screens==='undefined') var screens={};\n";
    $section .= "if(typeof screens[1]==='undefined') screens[1]={};\n";
    $section .= "if(!Array.isArray(screens[1]['columns'])) screens[1]['columns']=[];\n";
    foreach ($columnKeys as $columnKey) {
        $section .= "if(screens[1]['columns'].indexOf('" . $columnKey
            . "')<0) screens[1]['columns'].push('" . $columnKey . "');\n";
    }

    // Write widget-specific config settings inside the marker section
    if (!empty($configSettings)) {
        foreach ($configSettings as $key => $value) {
            $section .= 'config[' . json_encode($key) . ']='
                . json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . ";\n";
        }
    }

    $section .= $endMarker;
    $config .= $section;
}

if (!file_exists($configPath) && !is_writable($customDir)) {
    dashticz_json_error(
        500,
        'The directory "custom/" is not writable by the web server'
        . dashticz_owner_info($customDir)
        . '. From the Dashticz directory, run: sh tools/install-dashticz-write-access'
    );
}

if (file_exists($configPath) && !is_writable($configPath)) {
    @chmod($configPath, 0664);
    if (!is_writable($configPath)) {
        dashticz_json_error(
            500,
            'CONFIG.js is not writable'
            . dashticz_owner_info($configPath)
            . '. From the Dashticz directory, run: sh tools/install-dashticz-write-access'
        );
    }
}

if (file_put_contents($configPath, $config . "\n", LOCK_EX) === false) {
    dashticz_json_error(500, 'Unable to write CONFIG.js.');
}
@chmod($configPath, 0664);

header('Content-Type: application/json');
echo json_encode([
    'success' => true,
    'blockKeys' => array_map(function ($widget) {
        return $widget['key'];
    }, $widgets),
]);

function _widgetRemoveSection($config, $startMarker, $endMarker)
{
    $startPos = strpos($config, $startMarker);
    if ($startPos === false) {
        return $config;
    }
    $endPos = strpos($config, $endMarker, $startPos);
    if ($endPos === false) {
        return substr($config, 0, $startPos);
    }
    return substr($config, 0, $startPos)
        . substr($config, $endPos + strlen($endMarker));
}

function _widgetJsStringEscape($value)
{
    return str_replace(['\\', "'"], ['\\\\', "\\'"], $value);
}

function _widgetChunks($widgets, $columnWidth)
{
    $chunks = [];
    $current = [];
    $width = 0;

    foreach ($widgets as $widget) {
        if (!empty($current) && ($width + $widget['width']) > $columnWidth) {
            $chunks[] = $current;
            $current = [];
            $width = 0;
        }
        $current[] = $widget;
        $width += $widget['width'];
    }

    if (!empty($current)) {
        $chunks[] = $current;
    }
    return $chunks;
}
