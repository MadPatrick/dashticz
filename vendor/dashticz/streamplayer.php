<?php
// vendor/dashticz/streamplayer.php
//
// Scans the local logo folder once and returns the mapping between each
// tvg-id (filename without extension, lowercased) and the actual filename
// found on disk. Used by streamplayer.js to attach local logos to stations
// coming from the m3u playlist.
//
// Response: { "nostalgie": "nostalgie.png", "npo1": "npo1.jpg", ... }

header('Content-Type: application/json');

// Real path of the logo folder on disk (adjust if needed)
$logoDir = dirname(__DIR__, 2) . '/img/custom/radio/';

$result = [];

if (is_dir($logoDir)) {
    foreach (scandir($logoDir) as $entry) {
        if ($entry === '.' || $entry === '..') {
            continue;
        }
        $path = $logoDir . $entry;
        if (!is_file($path)) {
            continue;
        }
        $name = pathinfo($entry, PATHINFO_FILENAME);
        $result[strtolower($name)] = $entry;
    }
}

echo json_encode($result);