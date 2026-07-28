<?php
/**
 * Git-based Dashticz updater.
 *
 * Switches the local repository to an allowlisted branch (beta or master)
 * and fast-forwards it from the configured remote. Intended for the Settings
 * "Update" button — never accepts arbitrary shell input.
 */
require_once(__DIR__ . '/../vendor/dashticz/security.php');

dashticz_require_same_origin();
dashticz_require_csrf();

if (!isset($_SERVER['REQUEST_METHOD']) || $_SERVER['REQUEST_METHOD'] !== 'POST') {
    dashticz_json_error(405, 'Only POST requests are allowed.');
}

$rawBody = file_get_contents('php://input');
$data = $rawBody !== false ? json_decode($rawBody, true) : null;
if (json_last_error() !== JSON_ERROR_NONE || !is_array($data) || !isset($data['branch'])) {
    dashticz_json_error(400, 'Invalid update request.');
}

// UI "Main" maps to the canonical Git branch "master".
$requested = strtolower(trim((string)$data['branch']));
$branchMap = [
    'beta' => 'beta',
    'master' => 'master',
    'main' => 'master',
];
if (!isset($branchMap[$requested])) {
    dashticz_json_error(400, 'Branch must be beta or main.');
}
$branch = $branchMap[$requested];

$repoRoot = realpath(__DIR__ . '/..');
if ($repoRoot === false || !is_dir($repoRoot . DIRECTORY_SEPARATOR . '.git')) {
    dashticz_json_error(500, 'Dashticz does not appear to be a Git checkout.');
}

if (!function_exists('proc_open') || !function_exists('proc_close')) {
    dashticz_json_error(500, 'PHP proc_open is disabled; Git updates cannot run from the web UI.');
}

$git = dashticz_find_git_binary();
if ($git === null) {
    dashticz_json_error(500, 'Git executable not found on the server.');
}

$remote = dashticz_git_preferred_remote($git, $repoRoot);
$log = [];

// Fetch latest refs, check out the allowlisted branch, then pull with --ff-only
// so divergent local commits cannot be overwritten silently.
$steps = [
    [$git, 'fetch', $remote, $branch],
    [$git, 'checkout', $branch],
    [$git, 'pull', '--ff-only', $remote, $branch],
];

foreach ($steps as $command) {
    $result = dashticz_run_git_command($command, $repoRoot);
    $log[] = [
        'command' => implode(' ', array_slice($command, 1)),
        'exit_code' => $result['exit_code'],
        'stdout' => $result['stdout'],
        'stderr' => $result['stderr'],
    ];
    if ($result['exit_code'] !== 0) {
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'branch' => $branch,
            'remote' => $remote,
            'error' => 'Git command failed: ' . implode(' ', array_slice($command, 1)),
            'log' => $log,
        ]);
        exit;
    }
}

header('Content-Type: application/json');
echo json_encode([
    'success' => true,
    'branch' => $branch,
    'remote' => $remote,
    'log' => $log,
]);

/**
 * Locate a usable git binary without relying on PATH alone.
 */
function dashticz_find_git_binary()
{
    $candidates = ['git'];
    if (stripos(PHP_OS, 'WIN') === 0) {
        $candidates[] = 'C:\\Program Files\\Git\\cmd\\git.exe';
        $candidates[] = 'C:\\Program Files (x86)\\Git\\cmd\\git.exe';
    } else {
        $candidates[] = '/usr/bin/git';
        $candidates[] = '/usr/local/bin/git';
    }

    foreach ($candidates as $candidate) {
        $probe = dashticz_run_git_command([$candidate, '--version'], null);
        if ($probe['exit_code'] === 0) {
            return $candidate;
        }
    }

    return null;
}

/**
 * Prefer the maintainer remote "upstream", then fall back to "origin".
 */
function dashticz_git_preferred_remote($git, $repoRoot)
{
    $result = dashticz_run_git_command([$git, 'remote'], $repoRoot);
    $remotes = preg_split('/\r\n|\r|\n/', trim($result['stdout']));
    $remotes = array_values(array_filter(array_map('trim', $remotes)));

    if (in_array('upstream', $remotes, true)) {
        return 'upstream';
    }
    if (in_array('origin', $remotes, true)) {
        return 'origin';
    }

    return 'origin';
}

/**
 * Run one Git command with argument arrays (no shell interpolation).
 *
 * When running inside the Dashticz checkout, pass -c safe.directory=<cwd> so
 * Git accepts the repo even if the web-server user does not own the files
 * (common with Docker / www-data vs root installs). Without this, fetch fails
 * with "detected dubious ownership in repository".
 */
function dashticz_run_git_command(array $command, $cwd)
{
    if ($cwd !== null && isset($command[0])) {
        $safeDirectory = str_replace('\\', '/', $cwd);
        array_splice($command, 1, 0, ['-c', 'safe.directory=' . $safeDirectory]);
    }

    $descriptors = [
        0 => ['pipe', 'r'],
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w'],
    ];

    $process = @proc_open(
        $command,
        $descriptors,
        $pipes,
        $cwd === null ? null : $cwd,
        null,
        ['bypass_shell' => true]
    );

    if (!is_resource($process)) {
        return [
            'exit_code' => 127,
            'stdout' => '',
            'stderr' => 'Unable to start process.',
        ];
    }

    fclose($pipes[0]);
    $stdout = stream_get_contents($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $exitCode = proc_close($process);

    return [
        'exit_code' => (int)$exitCode,
        'stdout' => is_string($stdout) ? trim($stdout) : '',
        'stderr' => is_string($stderr) ? trim($stderr) : '',
    ];
}
