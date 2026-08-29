const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('LMS Icon display option uses a visible normal block icon column', () => {
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
    /\.lms-block\s*>\s*\.col-icon\s*\{[\s\S]*?display:\s*flex\s*!important;[\s\S]*?z-index:\s*20;/,
    'LMS must keep the regular Dashticz icon column visible above artwork'
  );
  assert.match(
    lmsCss,
    /\.lms-block\s*>\s*\.col-icon\s*>\s*em\.icon\s*\{[\s\S]*?visibility:\s*visible\s*!important;[\s\S]*?opacity:\s*1\s*!important;/,
    'Font Awesome LMS icons must remain visible when album artwork is present'
  );
  assert.match(
    lmsCss,
    /\.lms-block\s+\.lms-cover-icon\s*\{[\s\S]*?display:\s*none\s*!important;/,
    'the configured block icon must not be duplicated as an artwork badge'
  );
  assert.match(
    deviceEditor,
    /_quickOptionsHtml\('lm',\s*\{[\s\S]*?icon:\s*false,[\s\S]*?iconValue:\s*'fas fa-music'/,
    'new LMS blocks should keep Icon off by default and offer fa-music when enabled'
  );
});

test('LMS Device Config can disable player controls', () => {
  const lmsConfig = fs.readFileSync(path.join(root, 'js/lmsconfig.js'), 'utf8');
  const lmsCss = fs.readFileSync(
    path.join(root, 'js/components/lms.css'),
    'utf8'
  );
  const loader = fs.readFileSync(path.join(root, 'js/loader.js'), 'utf8');

  assert.match(
    lmsConfig,
    /var FIELD = 'player_controls';/,
    'the LMS setting must be stored as player_controls'
  );
  assert.match(
    lmsConfig,
    /id=\\?"?' \+\s*SWITCH_ID|SWITCH_ID = 'de-config-lms-player-controls'/,
    'Device Config must expose a dedicated player controls switch'
  );
  assert.match(
    lmsConfig,
    /definition\.player_controls === false/,
    'only explicit false should hide controls so existing configurations stay enabled'
  );
  assert.match(
    lmsCss,
    /\.lms-block\.lms-player-controls-hidden\s+\.lms-controls\s*\{[\s\S]*?display:\s*none\s*!important;/,
    'the runtime setting must hide the controls row'
  );
  assert.match(
    loader,
    /loadScript\('js\/lmsconfig\.js'\)/,
    'the LMS Device Config extension must be loaded at startup'
  );
});
