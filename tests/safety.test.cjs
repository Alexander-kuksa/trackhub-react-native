const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createTrackHub} = require('../lib/core');
const {encodeBoundedJSON} = require('../lib/bounded-json');

function fixture() {
  const callbacks = [];
  const sdk = createTrackHub(() => ({
    invoke: async () => 'null',
    onEvent(callback) {callbacks.push(callback); return {remove() {}};},
  }), {});
  return {sdk, emit: raw => callbacks.forEach(callback => callback(raw))};
}
const event = JSON.stringify({type: 'deferredDeepLink', data: '/offer'});
const tick = () => new Promise(resolve => setImmediate(resolve));

test('preflight rejects cycles, deep/wide graphs, escaping expansion and non-data objects', () => {
  const cycle = {}; cycle.self = cycle;
  let deep = null; for (let i = 0; i < 10000; i++) deep = {next: deep};
  for (const data of [cycle, deep, new Array(10000000), {text: '\u0000'.repeat(12000)}, new Date(),
    Object.fromEntries(Array.from({length: 3000}, (_, i) => [i, undefined]))]) {
    assert.throws(() => encodeBoundedJSON(data), /bounded, JSON-serializable/);
  }
});
test('serialization never calls getters or toJSON and allows repeated non-cyclic objects', () => {
  let invoked = 0;
  const getter = {get secret() {invoked++; throw new Error('private');}};
  const hook = {toJSON() {invoked++; return 'private';}};
  assert.throws(() => encodeBoundedJSON(getter));
  assert.throws(() => encodeBoundedJSON(hook));
  assert.equal(invoked, 0);
  const shared = {ok: [true, false, null, 0, -0, 'Case%2B+']};
  const value = {a: shared, b: shared, omitted: undefined, hole: [undefined]};
  assert.deepEqual(JSON.parse(encodeBoundedJSON(value)), JSON.parse(JSON.stringify(value)));
});
test('unsafe event parameters reject before invoking native without reflecting private values', async () => {
  const {sdk} = fixture();
  const custom = {toJSON() {throw new Error('secret-identifier');}};
  await assert.rejects(sdk.trackEvent('event', {callbackParams: {custom}}), error => !error.message.includes('secret-identifier'));
});
test('opt-in callback containment handles throws and async rejections with redacted diagnostics', async () => {
  const {sdk, emit} = fixture();
  const reported = [];
  sdk.setCallbackErrorHandler(failure => {reported.push(failure);});
  sdk.onDeferredDeepLink(() => {throw new Error('private callback token');});
  sdk.onDeferredDeepLink(async () => {throw new Error('private async token');});
  assert.doesNotThrow(() => emit(event));
  await tick();
  assert.deepEqual(reported, [
    {code: 'E_TRACKHUB_CALLBACK', event: 'deferredDeepLink'},
    {code: 'E_TRACKHUB_CALLBACK', event: 'deferredDeepLink'},
  ]);
});
test('throwing and rejecting diagnostic reporters cannot cause secondary failures', async () => {
  const {sdk, emit} = fixture();
  sdk.onDeferredDeepLink(() => {throw new Error('host');});
  sdk.setCallbackErrorHandler(() => {throw new Error('reporter');});
  assert.doesNotThrow(() => emit(event));
  sdk.setCallbackErrorHandler(async () => {throw new Error('async reporter');});
  assert.doesNotThrow(() => emit(event));
  await tick();
});
test('normal callback exception behavior remains available and queued events stop after removal', () => {
  const {sdk, emit} = fixture();
  const sub = sdk.onDeferredDeepLink(() => {throw new Error('visible application bug');});
  assert.throws(() => emit(event), /visible application bug/);
  sdk.setCallbackErrorHandler(() => {});
  sdk.setCallbackErrorHandler(null);
  assert.throws(() => emit(event), /visible application bug/);
  sub.remove(); sub.remove();
  assert.doesNotThrow(() => emit(event));
});
test('malformed native events never invoke typed application callbacks', () => {
  const {sdk, emit} = fixture();
  let calls = 0;
  sdk.onDeferredDeepLink(() => calls++);
  sdk.onErasureCompleted(() => calls++);
  sdk.onAttributionChanged(() => calls++);
  for (const raw of ['{broken', JSON.stringify({type: 'deferredDeepLink', data: {}}),
    JSON.stringify({type: 'erasureCompleted', data: 'false'}),
    JSON.stringify({type: 'attributionChanged', data: {network: 'missing fields'}}),
    JSON.stringify({type: 'deferredDeepLink', data: 'x'.repeat(262145)})]) emit(raw);
  assert.equal(calls, 0);
});
