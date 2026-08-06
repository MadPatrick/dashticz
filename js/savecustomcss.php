<?php
require_once(__DIR__ . '/../vendor/dashticz/security.php');

// This endpoint manages isolated editor-owned sections in custom.css. Any CSS
// outside these markers remains untouched, including hand-written rules.
dashticz_require_same_origin();
dashticz_require_csrf();

if (!isset($_SERVER['REQUEST_METHOD']) || $_SERVER['REQUEST_METHOD'] !== 'POST') {
    dashticz_json_error(405, 'Only POST requests are allowed.');
}

$input = file_get_contents('php://input');
$data = json_decode($input, true);
if (json_last_error() !== JSON_ERROR_NONE || !is_array($data)) {
    dashticz_json_error(400, 'Invalid JSON body.');
}

$updateVars = array_key_exists('vars', $data);
$vars = $updateVars ? $data['vars'] : [];
if ($updateVars && !is_array($vars)) {
    dashticz_json_error(400, 'vars must be an object.');
}
$deviceAlignments = isset($data['deviceAlignments']) ? $data['deviceAlignments'] : [];
if (!is_array($deviceAlignments)) {
    dashticz_json_error(400, 'deviceAlignments must be an object.');
}
$removeDeviceAlignments = isset($data['removeDeviceAlignments'])
    ? $data['removeDeviceAlignments']
    : [];
if (!is_array($removeDeviceAlignments)) {
    dashticz_json_error(400, 'removeDeviceAlignments must be an array.');
}

$allowed = [
    '--main-bg', '--home-bg',
    '--border-color-inactive', '--border-color-active', '--border-color-block',
    '--button-bg', '--button-hover', '--button-active',
    '--text-light', '--text-normal', '--text-inactive',
    '--selector-bg', '--blocktitle',
    '--text-title', '--text-status',
    '--font-small', '--font-large',
];

$sanitized = [];
foreach ($vars as $name => $value) {
    if (!in_array($name, $allowed, true)) {
        dashticz_json_error(400, 'Unknown CSS variable: ' . $name);
    }
    $value = trim((string)$value);
    if ($value !== '' && !preg_match('/^[a-zA-Z0-9#(). ,%\/_\-]+$/', $value)) {
        dashticz_json_error(400, 'Invalid CSS value for ' . $name);
    }
    if ($value !== '') {
        $sanitized[$name] = $value;
    }
}

function _validate_block_key($key)
{
    $key = trim((string)$key);
    // Block references are JavaScript string keys and may contain spaces or
    // punctuation. Reject only empty, oversized or control-character values;
    // the selector and marker use independent escaping/encoding below.
    if ($key === '' || strlen($key) > 240 || preg_match('/[\x00-\x1F\x7F]/', $key)) {
        dashticz_json_error(400, 'Invalid device block key.');
    }
    return $key;
}

function _alignment_token($key)
{
    return rtrim(strtr(base64_encode($key), '+/', '-_'), '=');
}

function _remove_alignment_block($css, $key)
{
    $token = _alignment_token($key);
    $start = '/* dashticz-device-align:start:' . $token . ' */';
    $end = '/* dashticz-device-align:end:' . $token . ' */';
    $pattern = '/' . preg_quote($start, '/') . '.*?' . preg_quote($end, '/') . '\s*/s';
    return preg_replace($pattern, '', $css);
}

function _css_attribute_value($value)
{
    // Escape the two characters that can terminate or alter a quoted CSS
    // attribute selector. Control characters have already been rejected.
    return str_replace(['\\', '"'], ['\\\\', '\\"'], $value);
}

$validatedAlignments = [];
foreach ($deviceAlignments as $key => $alignment) {
    $key = _validate_block_key($key);
    $alignment = strtolower(trim((string)$alignment));
    if (!in_array($alignment, ['left', 'center', 'right'], true)) {
        dashticz_json_error(400, 'Invalid text alignment for ' . $key);
    }
    $validatedAlignments[$key] = $alignment;
}

$validatedRemovals = [];
foreach ($removeDeviceAlignments as $key) {
    $validatedRemovals[] = _validate_block_key($key);
}

$customDir = __DIR__ . '/../custom';
$cssPath = $customDir . '/custom.css';
$existing = '';
if (file_exists($cssPath)) {
    $existing = file_get_contents($cssPath);
    if ($existing === false) {
        dashticz_json_error(500, 'Could not read custom.css.');
    }
}

// Replace the theme section only when the caller explicitly posted `vars`.
// Device Editor alignment saves therefore cannot clear Theme settings.
$marker = '/* dashticz-theme-vars */';
$markerEnd = '/* /dashticz-theme-vars */';
$themePattern = '/' . preg_quote($marker, '/') . '.*?' . preg_quote($markerEnd, '/') . '\s*/s';
$themeBlock = '';
if ($updateVars) {
    $existing = preg_replace($themePattern, '', $existing);
}

if ($updateVars && !empty($sanitized)) {
    $lines = [];
    foreach ($sanitized as $name => $value) {
        $lines[] = '  ' . $name . ': ' . $value . ';';
    }
    $themeBlock = $marker . "\n:root {\n" . implode("\n", $lines) . "\n}\n" . $markerEnd . "\n\n";
}

foreach (array_unique($validatedRemovals) as $key) {
    $existing = _remove_alignment_block($existing, $key);
}

foreach ($validatedAlignments as $key => $alignment) {
    $existing = _remove_alignment_block($existing, $key);
    // Left is the Dashticz default, so no generated override is needed.
    if ($alignment === 'left') {
        continue;
    }
    $token = _alignment_token($key);
    $existing = rtrim($existing) . "\n\n";
    $existing .= '/* dashticz-device-align:start:' . $token . " */\n";
    $rootSelector = '.dt_block[data-id="' . _css_attribute_value($key) . '"]';
    $selectors = [
        $rootSelector,
        $rootSelector . ' .dt_title',
        $rootSelector . ' .title',
        $rootSelector . ' .dt_state',
        $rootSelector . ' .state',
        $rootSelector . ' .value',
        $rootSelector . ' .lastupdate',
        $rootSelector . ' .titlegroups h3',
        $rootSelector . ' .SonarrBigTitle',
    ];
    $existing .= implode(",\n", $selectors) . " {\n";
    $existing .= '  text-align: ' . $alignment . ";\n";
    $existing .= "}\n";
    $existing .= '/* dashticz-device-align:end:' . $token . " */\n";
}

$output = $themeBlock . ltrim($existing, "\r\n");
if (!is_dir($customDir) && !mkdir($customDir, 0775, true)) {
    dashticz_json_error(500, 'Could not create custom directory.');
}
if (file_put_contents($cssPath, $output, LOCK_EX) === false) {
    dashticz_json_error(500, 'Could not write custom.css.');
}

header('Content-Type: application/json');
echo json_encode(['success' => true]);
