const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createTrackHub} = require('../lib/core');
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture(initial = Promise.resolve(null)) {
  const calls = [], callbacks = new Set();
  let urlListener, removals = 0;
  const sdk = createTrackHub(() => ({
    async invoke(operation, payload) {calls.push({operation, payload: JSON.parse(payload)}); return 'null';},
    onEvent(callback) {callbacks.add(callback); return {remove() {callbacks.delete(callback);}};},
  }), {
    getInitialURL() {return initial;},
    addEventListener(_type, fn) {urlListener = fn; return {remove() {removals++;}};},
  });
  return {sdk, calls, emit(event) {for (const callback of callbacks) callback(event);},
    url(value) {urlListener?.({url: value});}, get removals() {return removals;}};
}
test('denied/unknown/false consent and platform configuration survive the bridge unchanged', async () => {
  const {sdk, calls} = fixture();
  const config = {sdkKey: 'thcfg_v1_fixture', environment: {testLabToken: 't'.repeat(24)},
    googleAdsConsent: {adUserData: 'denied', adPersonalization: 'unknown', isEea: false},
    openAiAdsConsent: {measurement: 'denied', userData: 'unknown', personalization: 'denied'},
    piplConsent: {adsMeasurement: 'denied'}, android: {collectAdvertisingId: false},
    ios: {appleAttributionMode: 'passive', attConsentWaitingInterval: 0, googleOnDeviceMeasurement: false}};
  await sdk.start(config);
  assert.deepEqual(calls[0], {operation: 'start', payload: config});
});
test('invalid startup values never invoke native and errors do not echo the key', async () => {
  const {sdk, calls} = fixture();
  const secret = 'never-print-this-sdk-key';
  for (const config of [
    {sdkKey: secret}, {sdkKey: 'thcfg_v1_fixture', environment: {testLabToken: 'short'}},
    {sdkKey: 'thcfg_v1_fixture', googleAdsConsent: {adUserData: true}},
    {sdkKey: 'thcfg_v1_fixture', ios: {attConsentWaitingInterval: NaN}},
  ]) await assert.rejects(sdk.start(config), error => !error.message.includes(secret));
  assert.equal(calls.length, 0);
});
test('opaque OpenAI deep links retain mixed case, literal plus, escapes and nesting', async () => {
  const {sdk, calls} = fixture();
  const url = 'flux://offer?oppref=Case%2BValue+raw&path=%2Foffer%3Fid%3D1';
  await sdk.handleDeepLink(url);
  assert.equal(calls[0].payload.url, url);
  await sdk.handleAdAttributionReengagement(url);
  assert.deepEqual(calls[1], {operation: 'handleAdAttributionReengagement', payload: {url}});
});
test('sales helpers preserve dedup and partner data; caller cannot override canonical event/placement', async () => {
  const {sdk, calls} = fixture();
  const options = {deduplicationId: 'once', callbackParams: {placement_name: 'untrusted', a: [null, false, 0]},
    partnerParams: {cohort: 'A'}, event: 'forged', placement: 'forged'};
  await sdk.trackOnboardingShown(options);
  await sdk.trackPaywallShown('onboarding_placement', options);
  await sdk.trackPurchaseCtaTapped('inapp_placement', options);
  assert.deepEqual(calls.map(c => [c.payload.event, c.payload.placement]), [
    ['ob_shown', null], ['pw_shown', 'onboarding_placement'], ['purchase_cta_tapped', 'inapp_placement'],
  ]);
  assert.deepEqual(calls[0].payload.callbackParams, options.callbackParams);
  assert.equal(calls[0].payload.deduplicationId, 'once');
  assert.deepEqual(calls[0].payload.partnerParams, {cohort: 'A'});
  await assert.rejects(sdk.trackPaywallShown('typo'));
});
test('billing identity unlink transmits explicit null without clearing other providers', async () => {
  const {sdk, calls} = fixture();
  await sdk.setExternalIdentity('apphud', null);
  assert.deepEqual(calls[0].payload, {provider: 'apphud', userId: null});
});
test('non-JSON parameters are rejected without logging payload data', async () => {
  const {sdk, calls} = fixture();
  const circular = {}; circular.self = circular;
  for (const value of [NaN, Infinity, 1n, () => {}, circular, 'x'.repeat(65536)]) {
    await assert.rejects(sdk.trackEvent('event', {callbackParams: {value}}), /bounded, JSON-serializable/);
  }
  assert.equal(calls.length, 0);
});
test('event callbacks preserve nullable attribution/deferred values and unsubscribe', () => {
  const {sdk, emit} = fixture();
  const values = [];
  const sub = sdk.onDeferredDeepLink(value => values.push(value));
  emit('{broken'); emit('null'); emit(JSON.stringify({type: 'attributionChanged', data: {}}));
  emit(JSON.stringify({type: 'deferredDeepLink', data: null}));
  emit(JSON.stringify({type: 'deferredDeepLink', data: '/offer'}));
  sub.remove(); emit(JSON.stringify({type: 'deferredDeepLink', data: '/late'}));
  assert.deepEqual(values, [null, '/offer']);
});
test('cold and warm delivery of the same initial URL creates one native call; later repeated taps still count', async () => {
  let resolve;
  const f = fixture(new Promise(r => {resolve = r;}));
  const subscription = f.sdk.startLinking(assert.fail);
  assert.equal(f.sdk.startLinking(assert.fail), subscription);
  f.url('flux://same'); resolve('flux://same'); await subscription.ready;
  assert.equal(f.calls.length, 1);
  f.url('flux://same');
  await tick();
  assert.equal(f.calls.length, 2);
});
test('removing URL forwarding before initial URL resolves prevents late attribution', async () => {
  let resolve;
  const f = fixture(new Promise(r => {resolve = r;}));
  const subscription = f.sdk.startLinking(assert.fail);
  subscription.remove(); subscription.remove(); resolve('flux://late'); await subscription.ready;
  f.url('flux://late');
  assert.equal(f.calls.length, 0); assert.equal(f.removals, 1);
});
test('privacy request removes links immediately and does not await offline server acknowledgement', async () => {
  const f = fixture();
  await f.sdk.startLinking(assert.fail).ready;
  await f.sdk.gdprForgetMe();
  f.url('flux://after-erasure');
  assert.equal(f.removals, 1);
  assert.deepEqual(f.calls, [{operation: 'gdprForgetMe', payload: {reason: 'user_requested'}}]);
});
test('initial URL errors are observable and subscriptions can be removed', async () => {
  const seen = [];
  const f = fixture(Promise.reject(new Error('fixture')));
  const subscription = f.sdk.startLinking(e => seen.push(e.message));
  await assert.rejects(subscription.ready, error => error.code === 'E_TRACKHUB_LINK' && !error.message.includes('fixture'));
  await Promise.resolve();
  assert.deepEqual(seen, ['TrackHub: could not process an incoming link.']); subscription.remove();
});
test('automatic bootstrap captures an opaque cold URL before native initialization', async () => {
  const url = 'app://offer?oppref=CaSe%2Bvalue+raw&gbraid=AbC';
  const f = fixture(Promise.resolve(url));
  await f.sdk.start({sdkKey: 'thcfg_v1_fixture'});
  assert.deepEqual(f.calls.map(call => call.operation), ['handleDeepLink', 'start']);
  assert.equal(f.calls[0].payload.url, url);
  f.url('app://warm?gclid=late'); await tick();
  assert.equal(f.calls[2].operation, 'handleDeepLink');
});
test('concurrent/remounted same-config startup invokes native once and preserves initial consent snapshot', async () => {
  let resolve;
  const f = fixture(new Promise(r => {resolve = r;}));
  const config = {sdkKey: 'thcfg_v1_fixture', googleAdsConsent: {adUserData: 'denied'}};
  const first = f.sdk.start(config);
  const same = f.sdk.start({googleAdsConsent: {adUserData: 'denied'}, sdkKey: config.sdkKey});
  config.googleAdsConsent.adUserData = 'granted';
  resolve(null); await Promise.all([first, same]);
  await f.sdk.start({sdkKey: config.sdkKey, googleAdsConsent: {adUserData: 'denied'}});
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].payload.googleAdsConsent.adUserData, 'denied');
  await assert.rejects(f.sdk.start(config), error => error.code === 'E_TRACKHUB_ALREADY_STARTED');
});
test('a warm URL cannot be replaced by an older asynchronously resolved initial URL', async () => {
  let resolve;
  const f = fixture(new Promise(r => {resolve = r;}));
  const starting = f.sdk.start({sdkKey: 'thcfg_v1_fixture'});
  await tick(); f.url('app://offer?oppref=new'); resolve('app://offer?oppref=old');
  await starting;
  assert.deepEqual(f.calls.map(call => call.operation), ['handleDeepLink', 'start']);
  assert.equal(f.calls[0].payload.url, 'app://offer?oppref=new');
});
test('initial URL timeout is bounded, reports redacted diagnostic, and preserves late context', async () => {
  let resolve;
  const seen = [];
  const f = fixture(new Promise(r => {resolve = r;}));
  await f.sdk.start({sdkKey: 'thcfg_v1_fixture'}, {initialURLTimeoutMs: 5, onLinkError: error => seen.push(error.code)});
  assert.deepEqual(f.calls.map(call => call.operation), ['start']);
  assert.deepEqual(seen, ['E_TRACKHUB_LINK_TIMEOUT']);
  resolve('app://offer?oppref=late'); await tick();
  assert.deepEqual(f.calls.map(call => call.operation), ['start', 'handleDeepLink']);
});
test('a cold URL arriving after timeout does not override a newer warm URL', async () => {
  let resolve;
  const f = fixture(new Promise(r => {resolve = r;}));
  await f.sdk.start({sdkKey: 'thcfg_v1_fixture'}, {initialURLTimeoutMs: 5});
  f.url('app://warm'); resolve('app://cold'); await tick();
  assert.deepEqual(f.calls.filter(call => call.operation === 'handleDeepLink').map(call => call.payload.url), ['app://warm']);
});
test('initial retrieval errors and throwing telemetry do not prevent SDK startup', async () => {
  const f = fixture(Promise.reject(new Error('private-oppref-secret')));
  await f.sdk.start({sdkKey: 'thcfg_v1_fixture'}, {onLinkError(error) {
    assert.equal(error.message.includes('private-oppref-secret'), false);
    throw new Error('host telemetry failure');
  }});
  assert.deepEqual(f.calls.map(call => call.operation), ['start']);
});
test('manual linking owner sends its cold URL first and disables automatic retrieval/subscription', async () => {
  const f = fixture(Promise.resolve('app://must-not-replay'));
  await f.sdk.handleDeepLink('app://manual');
  await f.sdk.start({sdkKey: 'thcfg_v1_fixture'}, {linking: 'manual'});
  f.url('app://must-not-forward'); await tick();
  assert.deepEqual(f.calls.map(call => call.operation), ['handleDeepLink', 'start']);
  assert.throws(() => f.sdk.startLinking(assert.fail), /owned by the host/);
});
test('listener teardown/remount never repeats initial URL and old removal cannot remove new owner', async () => {
  const f = fixture(Promise.resolve('app://initial'));
  const first = f.sdk.startLinking(assert.fail); await first.ready;
  first.remove();
  const second = f.sdk.startLinking(assert.fail); await second.ready;
  first.remove(); f.url('app://warm'); await tick();
  assert.deepEqual(f.calls.map(call => call.payload.url), ['app://initial', 'app://warm']);
  assert.equal(f.removals, 1);
});
test('erasure during initial lookup cancels pending bootstrap and forbids resurrection', async () => {
  let resolve;
  const f = fixture(new Promise(r => {resolve = r;}));
  const starting = f.sdk.start({sdkKey: 'thcfg_v1_fixture'});
  await tick();
  await f.sdk.gdprForgetMe();
  resolve('app://old-oppref');
  await assert.rejects(starting, error => error.code === 'E_TRACKHUB_ERASED');
  await assert.rejects(f.sdk.start({sdkKey: 'thcfg_v1_fixture'}), error => error.code === 'E_TRACKHUB_ERASED');
  assert.throws(() => f.sdk.startLinking(assert.fail), error => error.code === 'E_TRACKHUB_ERASED');
  await assert.rejects(f.sdk.handleDeepLink('app://new'), error => error.code === 'E_TRACKHUB_ERASED');
  await assert.rejects(f.sdk.trackEvent('test'), error => error.code === 'E_TRACKHUB_ERASED');
  assert.deepEqual(f.calls.map(call => call.operation), ['gdprForgetMe']);
});
test('invalid bootstrap options are rejected without native side effects', async () => {
  const f = fixture();
  for (const options of [{linking: 'both'}, {initialURLTimeoutMs: 0}, {initialURLTimeoutMs: 5001}, {initialURLTimeoutMs: NaN}, {onLinkError: true}]) {
    await assert.rejects(f.sdk.start({sdkKey: 'thcfg_v1_fixture'}, options), /invalid/);
  }
  assert.equal(f.calls.length, 0);
});
test('failed native startup removes automatic forwarding rather than collecting future clicks', async () => {
  let listener, removals = 0;
  const calls = [];
  const sdk = createTrackHub(() => ({
    async invoke(operation) {calls.push(operation); throw new Error('Native startup rejected');},
    onEvent() {return {remove() {}};},
  }), {
    getInitialURL: async () => null,
    addEventListener(_type, fn) {listener = fn; return {remove() {removals++;}};},
  });
  await assert.rejects(sdk.start({sdkKey: 'thcfg_v1_fixture'}), /startup rejected/);
  listener({url: 'app://must-not-forward'}); await tick();
  assert.deepEqual(calls, ['start']); assert.equal(removals, 1);
});
test('OpenAI consent is independent of Google consent and updates cross the bridge unchanged', async () => {
  const f = fixture();
  const value = {measurement: 'granted', userData: 'denied', personalization: 'unknown'};
  await f.sdk.updateOpenAiAdsConsent(value);
  assert.deepEqual(f.calls[0], {operation: 'updateOpenAiAdsConsent', payload: value});
  await assert.rejects(f.sdk.updateOpenAiAdsConsent({measurement: true}), /invalid consent/);
  await assert.rejects(f.sdk.start({sdkKey: 'thcfg_v1_fixture', openAiAdsConsent: {measurement: 'allow'}}), /invalid consent/);
  assert.equal(f.calls.length, 1);
});
test('import/factory succeeds without native code, invocation explains the required app rebuild', async () => {
  const sdk = createTrackHub(() => null, {});
  await assert.rejects(sdk.getVersions(), /rebuild.*Expo Go/);
});
test('a pending native lookup times out without suppressing a later deferred-link event', async () => {
  let resolveNative, listener;
  const sdk = createTrackHub(() => ({
    invoke: () => new Promise(resolve => {resolveNative = resolve;}),
    onEvent(callback) {listener = callback; return {remove() {}};},
  }), {});
  const links = [];
  sdk.onDeferredDeepLink(value => links.push(value));
  await assert.rejects(sdk.resolveDeferredDeepLink(5), error => error.code === 'E_TRACKHUB_TIMEOUT');
  listener(JSON.stringify({type: 'deferredDeepLink', data: '/late-offer'}));
  resolveNative('"/late-offer"');
  await Promise.resolve();
  assert.deepEqual(links, ['/late-offer']);
});
test('lookup timeout is validated and successful nullable results are preserved', async () => {
  const {sdk, calls} = fixture();
  for (const value of [0, -1, NaN, Infinity, 120001]) {
    await assert.rejects(sdk.getAttribution(value), /invalid lookup timeout/);
  }
  assert.equal(calls.length, 0);
  assert.equal(await sdk.getAttribution(1000), null);
  assert.equal(await sdk.resolveDeferredDeepLink(1000), null);
});
