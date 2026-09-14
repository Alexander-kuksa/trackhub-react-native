// Generate real bindings using the installed React Native version. CI runs
// this separately from mocked JS tests, for each certified RN version.
const assert = require('node:assert/strict');
const {mkdtempSync, readFileSync, readdirSync} = require('node:fs');
const {tmpdir} = require('node:os');
const {dirname, join, resolve} = require('node:path');
const {spawnSync} = require('node:child_process');

const root = resolve(__dirname, '..');
const output = mkdtempSync(join(tmpdir(), 'trackhub-codegen-'));
const cli = join(dirname(require.resolve('react-native/package.json')),
  'scripts/generate-codegen-artifacts.js');
const result = spawnSync(process.execPath, [cli, '--path', root,
  '--targetPlatform', 'all', '--source', 'library', '--outputPath', output],
{cwd: root, stdio: 'inherit'});
assert.ifError(result.error);
assert.equal(result.status, 0, 'React Native Codegen must succeed');
const files = readdirSync(output, {recursive: true}).map(file => join(output, file));
const find = name => {
  const path = files.find(file => file.endsWith(`/${name}`));
  assert.ok(path, `Codegen did not produce ${name}`);
  return readFileSync(path, 'utf8');
};
assert.match(find('NativeTrackHubSpec.java'), /emitOnEvent/);
assert.match(find('TrackHubReactNativeSpec.h'), /NativeTrackHubSpec/);
assert.match(find('TrackHubReactNativeSpec-generated.mm'), /NativeTrackHubSpecJSI/);
console.log(`Verified Android/iOS Codegen with React Native ${require('react-native/package.json').version}; output: ${output}`);
