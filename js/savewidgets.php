<?php
require_once(__DIR__ . '/../vendor/dashticz/security.php');
require_once(__DIR__ . '/configwriter.php');

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
    // calendar
    'calendarformat'         => 'string',
    'calendarlanguage'       => 'calendar_language',
    // security panel
    'security_button_icons'  => 'bool',
    'security_panel_lock'    => 'bool',
    // traffic info
    'anwb_apikey'            => 'string',
    // google maps
    'gm_api'                 => 'string',
    'gm_zoomlevel'           => 'number',
    'gm_latitude'            => 'string',
    'gm_longitude'           => 'string',
    // air quality (longfonds)
    'longfonds_zipcode'      => 'string',
    'longfonds_housenumber'  => 'string',
    // moon
    'idx_moonpicture'        => 'string',
    // news
    'default_news_url'       => 'string',
    'news_scroll_after'      => 'number',
];

$allowedGarbageCompanies = [
    'afvalinfo','afvalalert','afvalstoffendienst','almere','alphenaandenrijn','area',
    'avalex','avri','barafvalbeheer','best','blink','circulusberkel','cure','cyclusnv',
    'dar','deafvalapp','edg','gad','gemeenteberkelland','goes','googlecalendar',
    'groningen','hvc','ical','katwijk','maashorst','meerlanden','mijnafvalwijzer',
    'omrin','purmerend','rd4','recycleapp','rmn','rova','sudwestfryslan','suez',
    'twentemilieu','uden','veldhoven','venlo','venray','vianen','waalre','waardlanden',
];

$allowedCalendarLanguages = [
    'zh_CN','da_DK','de_DE','en_US','es_ES','fi_FI','fr_FR','hu_HU','it_IT',
    'ja_JP','lt_LT','nl_NL','nb_NO','pl_PL','pt_PT','ro_RO','ru_RU','sk_SK',
    'sl_SL','sv_SE','uk_UA',
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
        } elseif ($type === 'calendar_language') {
            if (in_array((string)$value, $allowedCalendarLanguages, true)) {
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
    'secpanel' => ['key' => 'widget_secpanel', 'width' => 12],
    'publictransport' => ['key' => 'widget_publictransport', 'width' => 12],
    'trafficinfo' => ['key' => 'widget_trafficinfo', 'width' => 12],
    'alarmmeldingen' => ['key' => 'widget_alarmmeldingen', 'width' => 12],
    'camera' => ['key' => 'widget_cameras', 'width' => 6],
    'map' => ['key' => 'widget_map', 'width' => 12],
    'longfonds' => ['key' => 'widget_longfonds', 'width' => 6],
    'moon' => ['key' => 'widget_moon', 'width' => 3],
    'news' => ['key' => 'widget_news', 'width' => 12],
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

    if ($id === 'publictransport') {
        $station = isset($entry['station']) && is_string($entry['station'])
            ? trim($entry['station'])
            : 'UT';
        if ($station === '' || strlen($station) > 64 || !preg_match('/^[A-Za-z0-9_\-]+$/', $station)) {
            dashticz_json_error(400, 'Invalid public transport station id.');
        }
        $provider = isset($entry['provider']) && is_string($entry['provider'])
            ? $entry['provider']
            : 'treinen';
        $allowedProviders = ['treinen', 'ovapi', 'drgl', 'irailbe', 'delijnbe'];
        if (!in_array($provider, $allowedProviders, true)) {
            dashticz_json_error(400, 'Unknown public transport provider.');
        }
        $widget['station'] = $station;
        $widget['provider'] = $provider;
    }

    if ($id === 'camera') {
        $imageUrl = isset($entry['imageUrl']) && is_string($entry['imageUrl'])
            ? trim($entry['imageUrl'])
            : '';
        if ($imageUrl === '' || strlen($imageUrl) > 2048 || !preg_match('#^https?://[^\s]+$#i', $imageUrl)) {
            dashticz_json_error(400, 'Camera requires a valid http(s) image URL.');
        }
        $widget['imageUrl'] = $imageUrl;
        if (isset($entry['videoUrl']) && is_string($entry['videoUrl'])) {
            $videoUrl = trim($entry['videoUrl']);
            if ($videoUrl !== '' && strlen($videoUrl) <= 2048 && preg_match('#^https?://[^\s]+$#i', $videoUrl)) {
                $widget['videoUrl'] = $videoUrl;
            }
        }
    }

    if ($id === 'alarmmeldingen') {
        $rss = isset($entry['rss']) && is_string($entry['rss'])
            ? trim($entry['rss'])
            : 'https://www.alarmeringen.nl/feeds/all.rss';
        if (strlen($rss) > 2048 || !preg_match('#^https?://[^\s]+$#i', $rss)) {
            dashticz_json_error(400, '112 requires a valid http(s) RSS URL.');
        }
        $widget['rss'] = $rss;
        if (isset($entry['filter']) && is_string($entry['filter']) && strlen($entry['filter']) <= 256) {
            $widget['filter'] = $entry['filter'];
        }
    }

    $widgets[] = $widget;
}

$customDir = __DIR__ . '/../custom';
$configPath = $customDir . '/CONFIG.js';
list($config, $readError) = configwriter_read_config($configPath);
if ($readError !== null) {
    dashticz_json_error(500, $readError);
}

$config = configwriter_remove_section(
    $config,
    '// [layout-editor-start]',
    '// [layout-editor-end]'
);

$startMarker = '// [widget-editor-start]';
$endMarker = '// [widget-editor-end]';

/*
 * Device/layout editors call this endpoint without a settings payload.
 * Keep previously saved widget config settings unless new ones are provided.
 */
$existingSettings = configwriter_extract_section_config_settings(
    $config,
    $startMarker,
    $endMarker
);

$config = configwriter_remove_section($config, $startMarker, $endMarker);
$config = rtrim($config);

if (!empty($widgets)) {
    $section = configwriter_section_header('BLOCKS') . "\n";
    $section .= "if (typeof blocks === 'undefined') var blocks = {}\n";

    foreach ($widgets as $widget) {
        $props = _widgetBlockProps($widget);
        $section .= configwriter_emit_block_line($widget['key'], $props);
    }

    $section .= "\n" . configwriter_section_header('COLUMNS') . "\n";
    $section .= "if (typeof columns === 'undefined') var columns = {}\n";
    $layoutItems = array_map(function ($widget) {
        $item = [
            'ref' => $widget['key'],
            'width' => $widget['width'],
        ];
        if ($widget['height'] !== null) {
            $item['height'] = $widget['height'];
        }
        return $item;
    }, $widgets);
    $columnKeys = [];
    foreach (configwriter_pack_columns_by_height($layoutItems, 12, 'we_col') as $column) {
        $columnKeys[] = $column['key'];
        $section .= configwriter_emit_column_line(
            $column['key'],
            $column['blocks'],
            $column['width']
        );
    }

    $section .= "\n" . configwriter_section_header('SCREENS') . "\n";
    $section .= configwriter_emit_screen_columns(1, $columnKeys, 'merge');

    if (!empty($configSettings)) {
        $section .= configwriter_emit_config_settings($configSettings, false);
    } elseif (!empty($existingSettings)) {
        $section .= configwriter_emit_config_settings($existingSettings, true);
    }

    $config .= configwriter_wrap_section($startMarker, $endMarker, $section);
}

$writeError = configwriter_write_config($configPath, $customDir, $config);
if ($writeError !== null) {
    dashticz_json_error(500, $writeError);
}

header('Content-Type: application/json');
echo json_encode([
    'success' => true,
    'blockKeys' => array_map(function ($widget) {
        return $widget['key'];
    }, $widgets),
]);

function _widgetBlockProps($widget)
{
    $props = [
        'width' => $widget['width'],
        'title' => 'Widget',
    ];
    if ($widget['height'] !== null) {
        $props['height'] = $widget['height'];
    }

    switch ($widget['id']) {
        case 'weather':
            $props['type'] = $widget['provider'] === 'wunderground' ? 'wunderground' : 'weather';
            $props['widget_provider'] = $widget['provider'];
            $props['title'] = 'Weer';
            break;
        case 'garbage':
            $props['type'] = 'garbage';
            $props['title'] = 'Afval';
            break;
        case 'spotify':
            $props['type'] = 'spotify';
            $props['title'] = 'Spotify';
            break;
        case 'sonarr':
            $props['type'] = 'sonarr';
            $props['title'] = 'Sonarr';
            $props['title_position'] = 'left';
            $props['view'] = 'banner';
            break;
        case 'clock':
            $props['type'] = $widget['clockType'];
            $props['title'] = 'Klok';
            break;
        case 'calendar':
            $props['type'] = 'calendar';
            $props['title'] = 'Kalender';
            $props['icalurl'] = $widget['icalurl'];
            break;
        case 'secpanel':
            $props['type'] = 'secpanel';
            $props['title'] = 'Security Panel';
            break;
        case 'publictransport':
            $props['title'] = 'OV';
            $props['provider'] = $widget['provider'];
            $props['station'] = $widget['station'];
            $props['results'] = 5;
            $props['show_via'] = true;
            break;
        case 'trafficinfo':
            $props['title'] = 'Traffic';
            $props['provider'] = 'anwb';
            $props['trafficJams'] = true;
            $props['roadWorks'] = true;
            $props['radars'] = true;
            $props['results'] = 50;
            break;
        case 'alarmmeldingen':
            $props['title'] = '112';
            $props['rss'] = $widget['rss'];
            $props['results'] = 5;
            if (!empty($widget['filter'])) {
                $props['filter'] = $widget['filter'];
            }
            break;
        case 'camera':
            $props['type'] = 'camera';
            $props['title'] = 'Camera';
            $props['imageUrl'] = $widget['imageUrl'];
            if (!empty($widget['videoUrl'])) {
                $props['videoUrl'] = $widget['videoUrl'];
            }
            break;
        case 'map':
            $props['type'] = 'map';
            $props['title'] = 'Google Maps';
            $props['showtraffic'] = true;
            break;
        case 'longfonds':
            $props['type'] = 'longfonds';
            $props['title'] = 'Luchtkwaliteit';
            break;
        case 'moon':
            $props['type'] = 'moon';
            $props['title'] = 'Moon';
            break;
        case 'news':
            $props['type'] = 'news';
            $props['title'] = 'News';
            break;
    }

    return $props;
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
