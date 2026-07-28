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
    || !isset($data['items'])
    || !is_array($data['items'])
) {
    dashticz_json_error(400, 'Invalid layout items.');
}

$items = [];
foreach ($data['items'] as $entry) {
    if (!is_array($entry)
        || !isset($entry['ref'])
        || !is_string($entry['ref'])
        || !preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $entry['ref'])
    ) {
        dashticz_json_error(400, 'Each layout item requires a safe block reference.');
    }
    $width = isset($entry['width']) ? (int)$entry['width'] : 1;
    $items[] = [
        'ref' => $entry['ref'],
        'width' => max(1, min(12, $width)),
    ];
}

$customDir = __DIR__ . '/../custom';
$configPath = $customDir . '/CONFIG.js';
list($config, $readError) = configwriter_read_config($configPath);
if ($readError !== null) {
    dashticz_json_error(500, $readError);
}

/*
 * Only replace the layout section. Device/widget sections (and their
 * widget-specific config settings) must stay intact.
 */
$startMarker = '// [layout-editor-start]';
$endMarker = '// [layout-editor-end]';
$config = configwriter_remove_section($config, $startMarker, $endMarker);
$config = rtrim($config);

if (!empty($items)) {
    $section = configwriter_section_header('COLUMNS') . "\n";
    $section .= "if(typeof columns==='undefined') var columns={};\n";

    $columnKeys = [];
    foreach (configwriter_chunk_items_by_width($items, 12) as $index => $chunk) {
        $columnKey = 'le_col' . ($index + 1);
        $columnKeys[] = $columnKey;
        $refs = array_map(function ($item) {
            return $item['ref'];
        }, $chunk);
        $section .= configwriter_emit_column_line($columnKey, $refs, 12);
    }

    $section .= "\n" . configwriter_section_header('SCREENS') . "\n";
    $section .= configwriter_emit_screen_columns(1, $columnKeys, 'replace');

    $config .= configwriter_wrap_section($startMarker, $endMarker, $section);
}

$writeError = configwriter_write_config($configPath, $customDir, $config);
if ($writeError !== null) {
    dashticz_json_error(500, $writeError);
}

header('Content-Type: application/json');
echo json_encode(['success' => true]);
