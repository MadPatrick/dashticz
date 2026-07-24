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
if (json_last_error() !== JSON_ERROR_NONE || !is_array($data) || !array_key_exists('devices', $data)) {
    dashticz_json_error(400, 'Invalid request body.');
}

$devices = $data['devices'];
if (!is_array($devices)) {
    dashticz_json_error(400, 'Invalid devices list.');
}

foreach ($devices as $idx) {
    if (!is_int($idx) || $idx <= 0) {
        dashticz_json_error(400, 'Device index must be a positive integer.');
    }
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

$startMarker = '// [device-editor-start]';
$endMarker   = '// [device-editor-end]';

$startPos = strpos($config, $startMarker);
if ($startPos !== false) {
    $endPos = strpos($config, $endMarker, $startPos);
    if ($endPos !== false) {
        $after = substr($config, $endPos + strlen($endMarker));
        $config = substr($config, 0, $startPos) . $after;
    } else {
        $config = substr($config, 0, $startPos);
    }
}

$config = rtrim($config);

if (!empty($devices)) {
    $idxJson = '[' . implode(',', $devices) . ']';
    $section  = "\n\n" . $startMarker . "\n";
    $section .= "if(typeof columns['device_editor']==='undefined') columns['device_editor']={};\n";
    $section .= "columns['device_editor']['blocks']=" . $idxJson . ";\n";
    $section .= "if(typeof screens!=='undefined'&&typeof screens[1]!=='undefined'){\n";
    $section .= "  if(!Array.isArray(screens[1]['columns'])) screens[1]['columns']=[];\n";
    $section .= "  if(screens[1]['columns'].indexOf('device_editor')<0) screens[1]['columns'].push('device_editor');\n";
    $section .= "}\n";
    $section .= $endMarker;
    $config  .= $section;
}

if (!file_exists($configPath) && !is_writable($customDir)) {
    dashticz_json_error(500, 'The directory "custom/" is not writable by the web server' .
        dashticz_owner_info($customDir) .
        '. From the Dashticz directory, run: sh tools/install-dashticz-write-access');
}

if (file_exists($configPath) && !is_writable($configPath)) {
    @chmod($configPath, 0664);
    if (!is_writable($configPath)) {
        dashticz_json_error(500, 'CONFIG.js is not writable' .
            dashticz_owner_info($configPath) .
            '. From the Dashticz directory, run: sh tools/install-dashticz-write-access');
    }
}

if (file_put_contents($configPath, $config . "\n", LOCK_EX) === false) {
    dashticz_json_error(500, 'Unable to write CONFIG.js.');
}
@chmod($configPath, 0664);

header('Content-Type: application/json');
echo json_encode(array('success' => true));
