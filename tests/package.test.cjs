const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const packageJson = require('../package.json');
const source = path => readFileSync(join(__dirname, '..', path), 'utf8');

test('npm publication uses the official Daively scope and public registry', () => {
  assert.equal(packageJson.name, '@daively/react-native');
  assert.equal(packageJson.publishConfig.access, 'public');
  assert.equal(packageJson.publishConfig.registry, 'https://registry.npmjs.org/');
  const lock = JSON.parse(source('package-lock.json'));
  assert.equal(lock.name, packageJson.name);
  assert.equal(lock.version, packageJson.version);
  assert.equal(lock.packages[''].name, packageJson.name);
  assert.equal(lock.packages[''].version, packageJson.version);
});

test('developer examples use the new import and explain migration without double autolinking', () => {
  for (const file of ['README.md', 'example/App.tsx', 'example/SmokeTest.tsx']) {
    const content = source(file);
    assert.ok(content.includes("import Daively from '@daively/react-native'"), file);
    assert.ok(!content.includes("from '@trackhub/react-native'"), file);
  }
  assert.ok(source('README.md').includes(`npm install --save-exact ${packageJson.name}@${packageJson.version}`));
  assert.ok(source('README.md').includes('npm uninstall @trackhub/react-native'));
  assert.ok(source('README.md').includes('Reinstall iOS Pods and rebuild both'));
});

test('compatibility metadata includes exact React Native 0.85.3 without claiming untested 0.86', () => {
  assert.equal(packageJson.peerDependencies['react-native'], '0.85.3 || >=0.87.0 <0.88.0');
  assert.equal(packageJson.devDependencies['react-native'], '0.85.3');
  assert.equal(packageJson.peerDependencies.react, '^19.2.3');
});

test('native version reporting and smoke expectation match the wrapper release', () => {
  const version = packageJson.version;
  assert.ok(source('ios/TRHBridge.swift').includes(`"reactNative": "${version}"`));
  assert.ok(source('android/src/main/java/com/trackhub/reactnative/TrackHubModule.kt')
    .includes(`put("reactNative", "${version}")`));
  assert.ok(source('example/SmokeTest.tsx').includes(`versions.reactNative !== '${version}'`));
});

test('React Native compatibility updates keep exact native SDK pins', () => {
  assert.ok(source('TrackHubReactNative.podspec').includes("requirement: {kind: 'exactVersion', version: '3.1.4'}"));
  assert.ok(source('android/build.gradle').includes("com.github.Alexander-kuksa:trackhub-android:3.0.8"));
});
