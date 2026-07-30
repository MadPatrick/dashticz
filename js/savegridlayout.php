<?php
require_once(__DIR__ . '/../vendor/dashticz/security.php');
require_once(__DIR__ . '/configwriter.php');

dashticz_require_same_origin();
dashticz_require_csrf();

if (!isset($_SERVER['REQUEST_METHOD']) || $_SERVER['REQUEST_METHOD'] !== 'POST') {
    dashticz_json_error(405, 'Only POST requests are allowed.');
}

$rawBody = file_get_contents('php://input');
if ($rawBody !== false && strlen($rawBody) > 1048576) {
    dashticz_json_error(413, 'Grid layout request is too large.');
}
$data = json_decode($rawBody ?: '', true);
if (json_last_error() !== JSON_ERROR_NONE
    || !is_array($data)
    || !isset($data['items'])
    || !is_array($data['items'])
) {
    dashticz_json_error(400, 'Invalid grid layout items.');
}
if (count($data['items']) > 500) {
    dashticz_json_error(400, 'A grid screen supports up to 500 blocks.');
}

$screenNumber = configwriter_parse_screen_number($data, 1);
if ($screenNumber === 0) {
    dashticz_json_error(400, 'Grid layout is not available for standby.');
}

$gridColumns = isset($data['gridColumns']) ? (int)$data['gridColumns'] : 24;
$rowHeight = isset($data['rowHeight']) ? (int)$data['rowHeight'] : 40;
if (isset($data['gap']) && !is_numeric($data['gap'])) {
    dashticz_json_error(400, 'gap must be numeric.');
}
$gap = isset($data['gap']) && is_numeric($data['gap'])
    ? (float)$data['gap']
    : 0;
$mobileLayout = isset($data['mobileLayout'])
    ? (string)$data['mobileLayout']
    : 'stack';
if ($gridColumns < 1 || $gridColumns > 100) {
    dashticz_json_error(400, 'gridColumns must be between 1 and 100.');
}
if ($rowHeight < 1 || $rowHeight > 2000) {
    dashticz_json_error(400, 'rowHeight must be between 1 and 2000.');
}
if ($gap < 0 || $gap > 200) {
    dashticz_json_error(400, 'gap must be between 0 and 200.');
}
if ($mobileLayout !== 'stack') {
    dashticz_json_error(400, 'Unsupported mobile layout.');
}

$customDir = __DIR__ . '/../custom';
$configPath = $customDir . '/CONFIG.js';
list($config, $readError) = configwriter_read_config($configPath);
if ($readError !== null) {
    dashticz_json_error(500, $readError);
}
$declaredRefs = configwriter_extract_declared_block_refs($config);
$items = [];
$usedRefs = [];
foreach ($data['items'] as $index => $entry) {
    if (!is_array($entry)
        || !isset($entry['ref'])
        || !is_string($entry['ref'])
        || !preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $entry['ref'])
        || !isset($entry['grid'])
        || !is_array($entry['grid'])
    ) {
        dashticz_json_error(400, 'Each grid item requires a safe block reference and grid position.');
    }
    $ref = $entry['ref'];
    if (!isset($declaredRefs[$ref])) {
        dashticz_json_error(400, 'Grid block "' . $ref . '" is not declared in CONFIG.js.');
    }
    if (isset($usedRefs[$ref])) {
        dashticz_json_error(400, 'Duplicate grid block reference.');
    }
    foreach (['x', 'y', 'w', 'h'] as $property) {
        if (!array_key_exists($property, $entry['grid'])
            || filter_var(
                $entry['grid'][$property],
                FILTER_VALIDATE_INT,
                ['options' => ['min_range' => 1]]
            ) === false
        ) {
            dashticz_json_error(400, 'Grid coordinates must be positive integers.');
        }
    }
    $usedRefs[$ref] = true;
    $items[] = [
        'ref' => $ref,
        'grid' => configwriter_normalise_grid_position(
            $entry['grid'],
            $gridColumns,
            $index + 1
        ),
    ];
}

list($startMarker, $endMarker) = configwriter_editor_markers(
    'grid-layout',
    $screenNumber
);
$config = configwriter_remove_section($config, $startMarker, $endMarker);
$section = configwriter_build_grid_layout_section(
    $items,
    $screenNumber,
    $gridColumns,
    $rowHeight,
    $gap,
    $mobileLayout
);
$config = rtrim($config)
    . configwriter_wrap_section($startMarker, $endMarker, $section);

$writeError = configwriter_write_config($configPath, $customDir, $config);
if ($writeError !== null) {
    dashticz_json_error(500, $writeError);
}

header('Content-Type: application/json');
echo json_encode(['success' => true, 'blocks' => array_keys($usedRefs)]);
