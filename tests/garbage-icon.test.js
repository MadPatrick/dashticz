const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('Garbage Font Awesome icon is persisted without replacing the kliko', () => {
  const helper = fs.readFileSync(
    path.join(root, 'js/garbageconfig.js'),
    'utf8'
  );
  const garbage = fs.readFileSync(
    path.join(root, 'js/components/garbage.js'),
    'utf8'
  );
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

  assert.match(
    helper,
    /\[data-cfg-key="garbage_company"\]/,
    'the helper must only act on the Garbage Widget Config popup'
  );
  assert.match(
    helper,
    /data-generated-icon['"],\s*['"]false/,
    'the selected Garbage Font Awesome icon must be marked explicit before save'
  );
  assert.match(
    garbage,
    /img\/garbage\/kliko\.png/,
    'the existing Garbage kliko image must remain in the component'
  );
  assert.match(
    garbage,
    /me\.block\.icon_use_colors/,
    'the existing dynamic Garbage icon color/image behavior must remain intact'
  );
  assert.match(
    index,
    /<script src="js\/garbageconfig\.js\?t=1"><\/script>/,
    'the Garbage Widget Config helper must be loaded by the dashboard'
  );
});
