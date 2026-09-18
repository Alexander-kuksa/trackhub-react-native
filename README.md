# Daively for React Native

Version **0.1.3** requires exactly **iOS 3.1.4** and **Android 3.0.9**.
The TypeScript API uses a Codegen TurboModule. Native SDKs own installation
identity, signatures, session lifecycle, durable queues, consent, retries,
Play Install Referrer, Apple attribution and erasure. No billing SDK is imported.

This package targets **React Native 0.85.3 and 0.87.x, New Architecture**;
minimum iOS 15.1 and Android API 26. Use the React Native template's JDK,
Gradle and Android SDK versions. Expo requires a native development/production
build with the native configuration below; Expo Go and web are unsupported.
React Native 0.85.3 is the exact supported 0.85 patch; other 0.85 patches,
0.86.x and versions below 0.85.3 have not been certified and are not included
in the peer range. Keep React compatible with your RN release (19.2.3 in the
0.85.3 template). Legacy Architecture is unsupported.

Version 0.1.3 includes Android first-install ordering, durable late Firebase
identity updates, and payload/storage bounds from native SDK 3.0.9. The wrapper
also bounds JSON data and offers optional callback error containment on both
platforms. The exact iOS SDK dependency remains 3.1.4.

## Install

Install the exact public npm package
[@daively/react-native 0.1.3](https://www.npmjs.com/package/@daively/react-native/v/0.1.3).
Anonymous registry installation was verified on 18 September 2026; `latest` is 0.1.3.

```sh
npm install --save-exact @daively/react-native@0.1.3
```

The byte-identical archive is also available on
[GitHub Releases](https://github.com/Alexander-kuksa/trackhub-react-native/releases/tag/0.1.3):

```sh
npm install --save-exact https://github.com/Alexander-kuksa/trackhub-react-native/releases/download/0.1.3/daively-react-native-0.1.3.tgz
```

### Upgrade from the earlier package

Remove the old package first so React Native cannot autolink two copies of the
same native module, then install the new name and update all JS/TS imports:

```sh
npm uninstall @trackhub/react-native
npm install --save-exact @daively/react-native@0.1.3
```

Use `import Daively from '@daively/react-native'`. The default import name is
your choice; the methods are unchanged. Reinstall iOS Pods and rebuild both
native apps; a Metro reload or OTA JavaScript update is not sufficient.
Daively is the product name. Existing repository URLs, native `TrackHub` symbols,
the `TrackHubReactNative` pod and Codegen module names remain stable for compatibility.

For local artifact validation, install the supplied tarball with
`npm install /path/to/daively-react-native-0.1.3.tgz`. Registry and archive installs
use the same `@daively/react-native` import shown below. Commit your package
manager lockfile. The wrapper archive does not bundle the native SDK binaries:
a clean application build must also resolve exactly iOS **3.1.4** and Android
**3.0.9** from the native dependency sources below. A host-app canary must
verify signed delivery and the running server's destination/consent behavior
before enabling live OpenAI delivery; a wrapper build alone does not prove it.

Android: add `maven { url "https://jitpack.io" }` to your dependency repositories
and set the application's minimum SDK to 26. The package pins
`com.github.Alexander-kuksa:trackhub-android:3.0.9` and autolinks its module.
Keep the toolchain from your exact React Native template. React Native 0.85.3
uses Gradle 9.3.1, AGP 8.12.0, Kotlin 2.1.20 and compile SDK 36; no AGP 9
opt-outs are needed. For React Native 0.87, retain that template's AGP 9
Kotlin/DSL compatibility properties. Both require the Daively minimum SDK 26.

iOS: enable `use_frameworks! :linkage => :dynamic` in your Podfile (or use the
standard template's `USE_FRAMEWORKS=dynamic bundle exec pod install`), then
build the `.xcworkspace`. This release requires dynamic frameworks: with
static Pods, the transitive Google ODM binary does not reach the app linker.
Keep the standard `react_native_post_install` hook: React Native's
`spm_dependency` support attaches the exact TrackHub Swift package and its
`TrackHub`/`TrackHubGoogleODM` products. Commit `Podfile.lock` and
`Package.resolved`. Configure the Apple attribution Info.plist entries using
your app's Daively Setup instructions. Add `NSUserTrackingUsageDescription`
before explicitly requesting ATT. Neither the wrapper nor start displays ATT
or notification permission dialogs automatically.

Avoid also embedding a different copy/version of the native Daively SDK.
Firebase can coexist; use the same billing identity provider and avoid double
reporting product events if importing them from Firebase.

## Upgrade from 0.1.2

Install 0.1.3, commit the updated package-manager lockfile, reinstall iOS Pods
if you build iOS, and rebuild the native application. Android now resolves
`com.github.Alexander-kuksa:trackhub-android:3.0.9` directly; remove any test-only
Gradle override that forces 3.0.8. A Metro reload or OTA JavaScript update cannot
replace the native SDK. Existing JS calls and native module names remain compatible.

Firebase does not automatically supply its app-instance ID to this wrapper.
Pass it in `firebaseAppInstanceId` at startup or call
`await Daively.updateFirebaseAppInstanceId(appInstanceId)` when it becomes available.
Android 3.0.9 persists the supplied ID and sends the late update after the install.

## Payload and callback safety

SDK calls accept plain JSON data. Cycles, accessors, custom objects such as `Date`,
non-finite numbers, excessive depth and oversized payloads reject before native
dispatch with a redacted error. Convert custom values before passing them, and
handle Promise rejections. Both native bridges also check size and depth before
parsing direct TurboModule calls.

Application callback errors keep their normal behavior by default. To contain
synchronous exceptions and rejected Promises from SDK event callbacks, configure:

```ts
Daively.setCallbackErrorHandler(({code, event}) => {
  reportSdkCallbackFailure({code, event});
});
```

Only the error code and event name reach this diagnostic handler. Set the handler
to `null` to restore normal propagation. This does not install a global crash
handler or recover fatal native process failures.

## Start and events

Register callbacks before start. SDK Key is app-specific; never log it.
Use actual CMP results in place of these `unknown` examples.

```ts
import Daively from '@daively/react-native';

const failures = Daively.onDeliveryFailure(failure => {
  // Final credentialsRejected after clock recovery. Update the SDK Key and
  // restart the app; do not spin in a start() retry loop.
  showIntegrationError(failure.type);
});
const attribution = Daively.onAttributionChanged(value => {
  updateAcquisitionUI(value.network);
});

await Daively.start({
  sdkKey: APP_TRACKHUB_SDK_KEY,
  googleAdsConsent: {adUserData: 'unknown', adPersonalization: 'unknown'},
  // Separate destination-specific CMP/policy result. Unknown blocks OpenAI delivery.
  openAiAdsConsent: {measurement: 'unknown', userData: 'unknown', personalization: 'unknown'},
  // Optional: environment: {testLabToken: TRACKHUB_TEST_LAB_TOKEN},
  ios: {
    appleAttributionMode: 'active', // passive when another MMP owns Apple CVs
    googleOnDeviceMeasurement: true, // enable for Google-promoted iOS apps
  },
}, {
  // Default: capture initial URL before native start; retain one warm-link listener.
  linking: 'automatic',
  initialURLTimeoutMs: 1000,
  onLinkError: error => reportIntegrationWarning(error.message), // redacted; never log URLs
});

await Daively.setExternalIdentity('apphud', actualApphudUserId);
await Daively.trackOnboardingShown({deduplicationId: 'onboarding-v1'});
await Daively.trackPaywallShown('onboarding_placement');
await Daively.trackPurchaseCtaTapped('inapp_placement');
await Daively.trackEvent('generation_finished', {
  callbackParams: {model: 'flux', duration_ms: 850},
  deduplicationId: generationId,
});

// On teardown:
failures.remove();
attribution.remove();
```

Promises for start/tracking/configuration resolve after dispatch to the native
SDK; they do **not** confirm server delivery or ad attribution. Native SDKs
remain authoritative for full SDK Key validation, report limits and privacy
state. Initialize once during application bootstrap, before tracking events.
Do not gate rendering or navigation on attribution/SDK network results. The
initial-link preparation wait is bounded to 1000 ms by default (1–5000 ms);
failure/timeout reports `onLinkError` and proceeds with SDK startup. Late links
are still forwarded, but they are **not guaranteed to enrich the original
first-install request**. A real paid-click cold-start test is a release gate.

Concurrent/repeated `start` calls with the same configuration share one native
initialization. A changed configuration or linking owner is rejected; use the
consent/context update APIs or restart the app rather than reinitializing from
React view callbacks. This also prevents component remounts from creating a
second listener/initial URL delivery. Native persistence still owns session
and install deduplication across process/JavaScript reloads.

Sales helpers send engagement/intent (`ob_shown`, `pw_shown`,
`purchase_cta_tapped`). Onboarding drops placement; other sales events require
typed canonical placement. They do not create financial transactions.
`trackPurchaseObserved(transactionId, productId?)` only attaches device context
to an authoritative billing transaction. Trial, revenue and refund truth still
comes from the configured Apphud/RevenueCat/S2S/store source.

## Google Ads and ChatGPT Ads links

Forward URLs exactly as received. Do not decode, lowercase, trim or rebuild
`oppref`. Configure Android intent filters and iOS URL schemes/Universal Links
in the host app and wire React Native's native Linking handlers.

```ts
// Recommended default: start(config) already owns initial + warm Linking.
// Do NOT add another startLinking() call in a React useEffect.

// Alternative when navigation already owns Linking:
// Obtain the original initial URL in your app bootstrap/navigation entry point.
if (originalInitialUrl) await Daively.handleDeepLink(originalInitialUrl);
await Daively.start(config, {linking: 'manual'});
// In that same navigation owner's warm URL callback, forward each URL once:
await Daively.handleDeepLink(originalWarmUrl);
```

Automatic and manual forwarding are alternative ownership choices. Do not have
React Navigation, `startLinking`, and AppDelegate forward the same click twice.
The automatic listener lives for the app bootstrap, not a screen lifetime;
`startLinking` remains available for explicit advanced ownership and returns the
existing subscription. Removing/recreating it does not replay the initial URL.
New warm URL events supersede a slower initial-URL lookup, including after timeout.

Forward the raw native URL in AppDelegate/MainActivity **before native SDK
initialization** if capture must be guaranteed before the JS runtime starts,
and use a single manual owner rather than forwarding it again in JS. Configure
the host's native URL handlers; the npm package cannot configure your schemes,
Associated Domains, intent filters or ad destinations. Android Play Install Referrer is captured by the native SDK
independently of JavaScript Linking. Use the Daively measurement URL as the ad
destination so the server carries `oppref` into the Google Play referrer.

`oppref` is the OpenAI click reference. Google uses its own Google/ODM attribution
path; do not manufacture either provider's click IDs or convert `oppref` into
`gclid`/`gbraid`. A URL with both Google and OpenAI references follows the native
provider-precedence contract; avoid mixed-provider measurement links.

On iOS, opening an installed app with a Universal Link can carry `oppref`, but
the ordinary App Store download journey does **not** automatically transfer that
reference to the newly installed app. React Native does not add deferred App
Store matching. Do not promise ChatGPT iOS install attribution based solely on
a working in-app link. Native OpenAI measurement is click-through, not a
view-through or probabilistic matching mechanism.

`onDeferredDeepLink` and `resolveDeferredDeepLink()` return an opaque configured
path or null. iOS 3.1.4 returns null for deferred resolution; it does not perform
probabilistic App Store matching. Android uses the install-referrer capability.
The host validates the path against its navigation routes before
opening it. Daively does not automatically navigate or open arbitrary URLs.

`getAttribution(timeoutMs?)` and `resolveDeferredDeepLink(timeoutMs?)` reject
with `E_TRACKHUB_TIMEOUT` after 15 seconds by default (override: 1–120000 ms).
The Android resolver may wait for the first install acknowledgement. Timeouts
do not cancel native measurement. Keep the deferred-link listener registered
to receive late results; explicit resolution also emits that event, so give
navigation to one handler. An attribution/deferred lookup never blocks app startup.

## Consent, privacy and other APIs

- `updateGoogleAdsConsent`, `updatePiplConsent`: granted/denied/unknown signals;
  false and unknown remain distinct across the bridge.
- `updateOpenAiAdsConsent`: separate `measurement`, `userData`, `personalization`
  granted/denied/unknown results for OpenAI Ads. Omission is unknown. Measurement
  must be granted for OpenAI delivery; denying user data strips optional user
  matching context and denying/unknown personalization opts out of personalization.
  Google consent, ATT and PIPL do not imply OpenAI permission. PIPL can impose
  additional restrictions; follow the platform's destination-specific policy.
  Supply current host/CMP decisions. Startup with unchanged cached consent does
  not create a newer consent revision; an explicit update call does. Do not call
  that update repeatedly on each screen render or use it to restore a withdrawn grant.
- `updateFirebaseAppInstanceId`, `updateCountryCode`, `setGoogleClickIds`:
  explicitly supplied host context; no Firebase dependency or automatic CMP inference.
- `requestAppTrackingTransparency`: explicit iOS prompt; Android returns `unavailable`.
- `handleAdAttributionReengagement(originalUrl)`: iOS Apple reengagement tag
  capture; returns the tag or null. Pass it through `EventOptions.ios.conversionTag`
  with `adAttributionTarget: 'reengagement'`. Android rejects this iOS-only API.
- `updateGoogleOnDeviceMeasurementInfo`: iOS only; Android rejects with
  `E_UNSUPPORTED_PLATFORM`. Automatic native ODM is opt-in at start.
- `setPushToken`: APNs hex on iOS, FCM token on Android. iOS accepts an optional
  `production`/`sandbox` environment; Android does not use that parameter.
- `getAttribution`, `getVersions`: asynchronous snapshots.
- `setExternalIdentity(provider, null)`: clears that billing provider's binding.

```ts
const erasure = Daively.onErasureCompleted(confirmed => {
  updateErasureStatus(confirmed);
});
await Daively.gdprForgetMe();
// Local measurement stop/erasure request has been dispatched. The server may
// confirm later after retry; no network wait is required to stop tracking.
```

Erasure removes the wrapper's active URL listener, cancels a pending bootstrap,
rejects further measurement/link/start calls in this JS process and invokes the native durable
privacy path even before start. It does not resume tracking on failures. Native
erasure survives process death; JS callback subscriptions do not. Treat erasure
confirmation events as process-local notifications, not durable receipts.

## Platform setup for the developer and marketer

All OpenAI CAPI keys, Google Link IDs/credentials and advertiser reporting API
keys stay in Daively server settings. Never ship them in JS, native config,
`.env` files included in an app build, or `callbackParams`/`partnerParams`.
The app-specific SDK Key is the only Daively bootstrap credential in the app.

| Destination | Developer setup | Marketer/platform setup |
| --- | --- | --- |
| Google Ads | Signed native reports, actual Google consent/PIPL, Apphud identity, raw cold/warm Google links when relevant; on iOS configure ATT and shared ODM, below | Link the correct app/account and Google Link ID; import native `first_open` and desired paid/trial actions; choose one primary measurement provider and keep comparison providers secondary |
| ChatGPT Ads | Signed native reports carrying real `oppref`, separate OpenAI consent, billing identity; verify Android referrer and explicitly account for iOS App Store handoff limitations | One OpenAI connection for the app, existing web data source Pixel ID + server CAPI key; Save/Test validates only, then save desired event mappings; linking the app can enable real install/open delivery |

For iOS Google ODM, add `$(inherited) -ObjC` to **Debug and Release** linker flags.
Use one compatible physical Google ODM runtime if Firebase or another MMP also
depends on it; inspect the resolved version and Release archive rather than
adding another binary. The npm bridge reuses native ODM; it does not implement
an independent Google matching algorithm. Configure ATT usage text and the
native wait interval, request ATT once from the host at the appropriate UX
point, and send actual consent updates. Waiting intervals are upper bounds,
not a requirement that the user leave the application open for that duration.

Choose **exactly one** Apple conversion-value writer: `active` when Daively
owns it; `passive` when AppsFlyer/Adjust/Singular or another owner writes Apple
values. Passive does not disable normal SDK events or server measurement.
Copy the Apple postback endpoint plist snippet from the specific app's Setup;
it is independent of ATT/IDFA permission and must be added to the host app.

Events are distinct from ad platform goals: Google `first_open` is the native
install/download path. Renaming a custom event to `install_confirmed` does not
turn it into a native Download. OpenAI maps native first-open to `app_installed`
and clicked openings to `app_opened`; Apphud-confirmed trial/subscription/purchase
mappings are server-side. A purchase CTA is never financial truth.

Before launch, test a **real ad click → correct store/app → first launch →
signed SDK delivery → provider outbox → Ads reporting**, not only a mock URL.
Also test ordinary no-link launch, timeout/late referrer, duplicate initial and
warm URL delivery, process restart, unknown/denied consent and erasure. Verify
Apphud identity before the first billing webhook; do not synthesize a purchase
just to test. `succeeded` confirms API acceptance, **not attributed conversion**.
No live provider test or ad attribution is implied by the package unit/smoke tests.

Current OpenAI setup details: [Conversions API](https://developers.openai.com/ads/conversions-api)
and [supported events](https://developers.openai.com/ads/supported-events).

## Develop

```sh
npm install
npm test
npm run codegen:check
npm pack
```

`example/App.tsx` can replace App.tsx in a new React Native 0.85.3 or 0.87 app after
installing the tarball. See `VALIDATION.md` for performed build checks and limits.
The development lockfile pins RN 0.85.3; CI runs TypeScript, unit/package tests
and actual Android/iOS Codegen with both RN 0.85.3 and 0.87.1. CI Codegen is
not a substitute for the native host builds documented in `VALIDATION.md`.
The private JSON bridge never includes raw arguments in error messages.

Architecture references: [React Native TurboModules](https://reactnative.dev/docs/turbo-native-modules-introduction),
[Swift adapter](https://reactnative.dev/docs/the-new-architecture/turbo-modules-with-swift).
