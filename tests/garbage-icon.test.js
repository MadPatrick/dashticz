const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('Garbage icon and Kliko layout enhancements stay available', () => {
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
    helper,
    /kliko_width/,
    'Garbage blocks must support a per-widget Kliko width'
  );
  assert.match(
    helper,
    /kliko_height/,
    'Garbage blocks must support a per-widget Kliko height'
  );
  assert.match(
    helper,
    /setProperty\('left', '100px', 'important'\)/,
    'the Kliko image must be shifted 100px to the right'
  );
  assert.match(
    helper,
    /setProperty\('text-align', 'right', 'important'\)/,
    'the Garbage title must be right aligned'
  );
  assert.match(
    helper,
    /rows\[0\]\.style\.setProperty\('font-weight', '700', 'important'\)/,
    'only the first collection row must be made bold'
  );
  assert.match(
    helper,
    /setProperty\('width', width \+ 'px', 'important'\)/,
    'configured Kliko width must override theme sizing'
  );
  assert.match(
    helper,
    /setProperty\('height', height \+ 'px', 'important'\)/,
    'configured Kliko height must override theme sizing'
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
    /<script src="js\/garbageconfig\.js\?t=2"><\/script>/,
    'the updated Garbage helper must be loaded with a fresh cache key'
  );
});
