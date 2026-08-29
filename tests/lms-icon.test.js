const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('LMS Icon display option uses the normal block icon column', () => {
  const lmsCss = fs.readFileSync(
    path.join(root, 'js/components/lms.css'),
    'utf8'
  );
  const deviceEditor = fs.readFileSync(
    path.join(root, 'js/deviceeditor.js'),
    'utf8'
  );

  assert.match(
    lmsCss,
    /\.lms-block\s*>\s*\.col-icon\s*\{[\s\S]*?display:\s*block;/,
    'LMS must show the regular Dashticz icon column when Icon is enabled'
  );
  assert.match(
    lmsCss,
    /\.lms-block\s+\.lms-cover-icon\s*\{[\s\S]*?display:\s*none;/,
    'the configured block icon must not be duplicated as an artwork badge'
  );
  assert.match(
    deviceEditor,
    /_quickOptionsHtml\('lm',\s*\{[\s\S]*?icon:\s*false,[\s\S]*?iconValue:\s*'fas fa-music'/,
    'new LMS blocks should keep Icon off by default and offer fa-music when enabled'
  );
});
