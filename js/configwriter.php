<?php
/**
 * Shared helpers for writing readable CONFIG.js sections from the editors.
 */

function configwriter_read_config($configPath)
{
    if (file_exists($configPath)) {
        $config = @file_get_contents($configPath);
        if ($config === false) {
            return [null, 'Unable to read CONFIG.js.'];
        }
        if (trim($config) === '#EMPTY#') {
            return ["var config = {}\n", null];
        }
        return [$config, null];
    }

    return ["var config = {}\n", null];
}

function configwriter_write_config($configPath, $customDir, $config)
{
    if (!file_exists($configPath) && !is_writable($customDir)) {
        return 'The directory "custom/" is not writable by the web server'
            . dashticz_owner_info($customDir)
            . '. From the Dashticz directory, run: sh tools/install-dashticz-write-access';
    }

    if (file_exists($configPath) && !is_writable($configPath)) {
        @chmod($configPath, 0664);
        if (!is_writable($configPath)) {
            return 'CONFIG.js is not writable'
                . dashticz_owner_info($configPath)
                . '. From the Dashticz directory, run: sh tools/install-dashticz-write-access';
        }
    }

    if (file_put_contents($configPath, rtrim($config) . "\n", LOCK_EX) === false) {
        return 'Unable to write CONFIG.js.';
    }

    @chmod($configPath, 0664);
    return null;
}

function configwriter_remove_section($config, $startMarker, $endMarker)
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

function configwriter_remove_editor_sections($config)
{
    $markers = [
        ['// [device-editor-start]', '// [device-editor-end]'],
        ['// [widget-editor-start]', '// [widget-editor-end]'],
        ['// [layout-editor-start]', '// [layout-editor-end]'],
    ];

    foreach ($markers as $markerPair) {
        $config = configwriter_remove_section($config, $markerPair[0], $markerPair[1]);
    }

    return rtrim($config);
}

/**
 * Extract config['key'] = value; lines from a marked CONFIG.js section.
 * Returns an associative array of setting name => raw JS value expression.
 */
function configwriter_extract_section_config_settings($config, $startMarker, $endMarker)
{
    $settings = [];
    $startPos = strpos($config, $startMarker);
    if ($startPos === false) {
        return $settings;
    }
    $endPos = strpos($config, $endMarker, $startPos);
    if ($endPos === false) {
        return $settings;
    }

    $section = substr($config, $startPos, $endPos - $startPos);
    if (!preg_match_all(
        "/config\\[(['\\\"])([A-Za-z0-9_]+)\\1\\]\\s*=\\s*([^;]+);/",
        $section,
        $matches,
        PREG_SET_ORDER
    )) {
        return $settings;
    }

    foreach ($matches as $match) {
        $settings[$match[2]] = trim($match[3]);
    }

    return $settings;
}

/**
 * Emit config['key'] = value; lines from either PHP scalars or raw JS expressions.
 */
function configwriter_emit_config_settings($settings, $raw = false)
{
    if (empty($settings)) {
        return '';
    }

    $out = "\n" . configwriter_section_header('WIDGET SETTINGS') . "\n";
    foreach ($settings as $key => $value) {
        if ($raw) {
            $out .= 'config[' . json_encode((string)$key) . '] = ' . $value . ";\n";
            continue;
        }
        $out .= 'config[' . json_encode((string)$key) . '] = '
            . json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . ";\n";
    }

    return $out;
}

function configwriter_js_string_escape($value)
{
    return str_replace(['\\', "'"], ['\\\\', "\\'"], $value);
}

function configwriter_managed_column_pattern()
{
    return '/^(?:de|we|le)_col\\d+$|^col_\\d+$/';
}

function configwriter_section_header($title)
{
    return "// --------------------------------------------------------------------------------------------\n"
        . '// ' . strtoupper($title) . "\n"
        . "// --------------------------------------------------------------------------------------------\n";
}

function configwriter_format_props($props)
{
    $parts = [];
    foreach ($props as $key => $value) {
        if ($value === null) {
            continue;
        }
        if (is_bool($value)) {
            $parts[] = $key . ':' . ($value ? 'true' : 'false');
            continue;
        }
        if (is_int($value) || is_float($value)) {
            $parts[] = $key . ':' . $value;
            continue;
        }
        $parts[] = $key . ":'" . configwriter_js_string_escape((string)$value) . "'";
    }

    return '{' . implode(', ', $parts) . '}';
}

function configwriter_emit_block_line($key, $props)
{
    return "blocks['" . $key . "'] = " . configwriter_format_props($props) . ";\n";
}

function configwriter_emit_column_line($key, $blockKeys, $width)
{
    $quotedBlocks = array_map(function ($blockKey) {
        return "'" . configwriter_js_string_escape($blockKey) . "'";
    }, $blockKeys);

    return "columns['" . $key . "'] = {blocks: ["
        . implode(', ', $quotedBlocks)
        . '], width: ' . (int)$width . "};\n";
}

/**
 * Emit screens[N] column wiring.
 * - merge (default): push column keys if missing (device/widget editors)
 * - replace: drop managed editor columns, then push the provided keys (layout editor)
 */
function configwriter_emit_screen_columns($screenNumber, $columnKeys, $mode = 'merge')
{
    $n = (int)$screenNumber;
    $out = "if(typeof screens==='undefined') var screens={};\n"
        . "if(typeof screens[{$n}]==='undefined') screens[{$n}]={};\n"
        . "if(!Array.isArray(screens[{$n}]['columns'])) screens[{$n}]['columns']=[];\n";

    if ($mode === 'replace') {
        $out .= "screens[{$n}]['columns']=screens[{$n}]['columns'].filter(function(columnKey){"
            . "return !/^(de|we|le)_col\\d+$|^col_\\d+$/.test(String(columnKey));});\n";
        foreach ($columnKeys as $columnKey) {
            $out .= "screens[{$n}]['columns'].push('"
                . configwriter_js_string_escape($columnKey) . "');\n";
        }
        return $out;
    }

    foreach ($columnKeys as $columnKey) {
        $safe = configwriter_js_string_escape($columnKey);
        $out .= "if(screens[{$n}]['columns'].indexOf('{$safe}')<0) "
            . "screens[{$n}]['columns'].push('{$safe}');\n";
    }

    return $out;
}

function configwriter_emit_columns_standby($blockKeys, $width = 12)
{
    $quotedBlocks = array_map(function ($blockKey) {
        return "'" . configwriter_js_string_escape($blockKey) . "'";
    }, $blockKeys);

    $section = configwriter_section_header('STANDBY SCREEN') . "\n";
    $section .= "if(typeof columns_standby==='undefined') var columns_standby={};\n";
    $section .= "columns_standby[1] = {}\n";
    $section .= "columns_standby[1]['blocks'] = ["
        . implode(', ', $quotedBlocks)
        . "]\n";
    $section .= "columns_standby[1]['width'] = " . max(1, min(12, (int)$width)) . ";\n";

    return $section;
}

function configwriter_extract_block_lines($config)
{
    $blocks = [];
    if (!preg_match_all(
        "/blocks\\['([^']+)'\\]\\s*=\\s*(\\{[^;]*\\})\\s*;/",
        $config,
        $matches,
        PREG_SET_ORDER
    )) {
        return $blocks;
    }

    foreach ($matches as $match) {
        $blocks[$match[1]] = $match[2];
    }

    return $blocks;
}

function configwriter_chunk_items_by_width($items, $columnWidth)
{
    $chunks = [];
    $current = [];
    $width = 0;

    foreach ($items as $item) {
        $itemWidth = isset($item['width']) ? (int)$item['width'] : 3;
        $itemWidth = max(1, min($columnWidth, $itemWidth));

        if (!empty($current) && ($width + $itemWidth) > $columnWidth) {
            $chunks[] = $current;
            $current = [];
            $width = 0;
        }

        $current[] = $item;
        $width += $itemWidth;
    }

    if (!empty($current)) {
        $chunks[] = $current;
    }

    return $chunks;
}

function configwriter_build_layout_section($blockLines, $items, $screenNumber = 1, $columnWidth = 12)
{
    $section = configwriter_section_header('BLOCKS') . "\n";
    $section .= "if(typeof blocks==='undefined') var blocks={};\n";

    $usedRefs = [];
    foreach ($items as $item) {
        if (!isset($item['ref']) || !is_string($item['ref'])) {
            continue;
        }
        $ref = $item['ref'];
        if (isset($blockLines[$ref]) && !isset($usedRefs[$ref])) {
            $section .= "blocks['" . $ref . "'] = " . $blockLines[$ref] . ";\n";
            $usedRefs[$ref] = true;
        }
    }

    $section .= "\n" . configwriter_section_header('COLUMNS') . "\n";
    $section .= "if(typeof columns==='undefined') var columns={};\n";

    $columnKeys = [];
    $chunks = configwriter_chunk_items_by_width($items, $columnWidth);
    foreach ($chunks as $index => $chunk) {
        $columnKey = 'le_col' . ($index + 1);
        $columnKeys[] = $columnKey;
        $refs = array_map(function ($item) {
            return $item['ref'];
        }, $chunk);
        $section .= configwriter_emit_column_line($columnKey, $refs, $columnWidth);
    }

    $section .= "\n" . configwriter_section_header('SCREENS') . "\n";
    $section .= configwriter_emit_screen_columns($screenNumber, $columnKeys, 'replace');

    return [$section, $columnKeys];
}

function configwriter_wrap_section($startMarker, $endMarker, $body)
{
    return "\n\n" . $startMarker . "\n" . $body . $endMarker;
}

function configwriter_make_block_key($name, &$usedKeys)
{
    $key = preg_replace('/[^a-zA-Z0-9_]/', '_', $name);
    $key = preg_replace('/_+/', '_', $key);
    $key = trim($key, '_');
    if ($key === '' || ctype_digit(substr($key, 0, 1))) {
        $key = 'd' . $key;
    }

    $base = $key;
    $suffix = 2;
    while (in_array($key, $usedKeys, true)) {
        $key = $base . '_' . $suffix++;
    }
    $usedKeys[] = $key;

    return $key;
}

function configwriter_device_block_props($device, $defaultWidth = 3)
{
    $idx = (int)$device['idx'];
    $title = isset($device['name']) ? (string)$device['name'] : ('Device ' . $idx);
    $width = isset($device['width']) ? (int)$device['width'] : $defaultWidth;
    $width = max(1, min(12, $width));

    $props = [
        'width' => $width,
        'hide_data' => true,
        'last_update' => false,
        'title' => $title,
    ];

    if (!empty($device['subidx']) && (int)$device['subidx'] > 0) {
        $props['idx'] = $idx . '_' . (int)$device['subidx'];
    } else {
        $props['idx'] = $idx;
    }

    if (isset($device['height']) && is_int($device['height'])) {
        $props['height'] = $device['height'];
    }

    return $props;
}
