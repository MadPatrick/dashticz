const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('remote proxy endpoints use the validated fetch helper', () => {
  for (const file of [
    'vendor/dashticz/cors.php',
    'vendor/dashticz/nocache.php',
  ]) {
    const source = read(file);
    assert.match(source, /dashticz_require_same_origin\(\)/);
    assert.match(source, /dashticz_fetch_remote\(/);
    assert.doesNotMatch(source, /Access-Control-Allow-Origin:\s*\*/);
    assert.doesNotMatch(source, /file_get_contents\(\$_SERVER\["QUERY_STRING"\]\)/);
  }
});

test('calendar fetching is URL validated and does not expose stack traces', () => {
  const source = read('vendor/dashticz/ical/index.php');
  assert.match(source, /dashticz_fetch_remote\(/);
  assert.doesNotMatch(source, /debug_backtrace/);
  assert.doesNotMatch(source, /initUrl\(\$ICS/);
  assert.doesNotMatch(source, /die\(\$e\)/);
});

test('settings writes require CSRF and serialize values as JSON', () => {
  const source = read('js/savesettings.php');
  assert.match(source, /dashticz_require_same_origin\(\)/);
  assert.match(source, /dashticz_require_csrf\(\)/);
  assert.match(source, /json_decode\(\$serializedValue/);
  assert.match(source, /file_put_contents\(\$configPath, \$newContents, LOCK_EX\)/);
  assert.doesNotMatch(source, /\$newconf\.="config/);
});

test('first-run config writer never invokes a privileged runtime helper', () => {
  const source = read('js/savecustomjs.php');

  assert.doesNotMatch(source, /exec\(/);
  assert.doesNotMatch(source, /sudo/);
  assert.match(source, /install-dashticz-write-access/);
});

test('Apache write-access installer derives the path and verifies a real write', () => {
  const installer = read('tools/install-dashticz-write-access');

  assert.match(installer, /INSTALL_DIR=.*SCRIPT_DIR\/\.\./);
  assert.match(installer, /chmod 2775/);
  assert.match(installer, /runuser -u .* touch/);
  assert.doesNotMatch(installer, /sudoers/);
  assert.doesNotMatch(installer, /NOPASSWD/);
  assert.doesNotMatch(installer, /\/var\/www\/html/);
});

test('first-run config remains valid without CONFIG_DEFAULT.js', () => {
  const source = read('js/savecustomjs.php');

  assert.match(source, /\$content = "var config = \{\};\\n\\n"/);
  assert.match(source, /file_put_contents\(\$configPath, \$content, LOCK_EX\)/);
});

test('bundled Horizon remote requires POST, CSRF and a key allowlist', () => {
  const source = read('tools/switch_horizon.php');
  assert.match(source, /dashticz_require_csrf\(\)/);
  assert.match(source, /REQUEST_METHOD.*POST/);
  assert.match(source, /\$allowedKeys = array\(/);
  assert.doesNotMatch(source, /\$_GET\['key'\]/);
});
