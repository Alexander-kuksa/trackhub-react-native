# Validation — Daively React Native wrapper

## Release 0.1.3 — 17 September 2026

GitHub release/tag 0.1.3 is published. Anonymous installation of its final archive
passed with the exact tested integrity. npm publication is pending account
reauthentication after the previous CLI session returned HTTP 401; use the GitHub
installation in the current README. The tagged archive is not being replaced.
Archive SHA-256: `bb065471a2bd3b584667b6a5e432397c0131ce9cb1c6a0f1130e6df7bcda06b6`.

This release pins Android SDK 3.0.9 and retains iOS SDK 3.1.4. It includes the
previously prepared bounded JS serializer, native bridge depth/size checks, and
optional redacted callback error containment. Published Android 3.0.9 is available
from JitPack; no local native dependency override belongs in the release package.

Verification for this release:

- **38/38 package tests**, TypeScript compilation and real Android/iOS Codegen
  passed on both **React Native 0.85.3** and **0.87.1** in separate directories.
- The release tarball was installed in a React Native **0.85.3** / React **19.2.3**
  host. TypeScript and CLI autolinking passed with exactly one Daively native module.
- A complete arm64 Android debug APK built with **JDK 17, Gradle 9.3.1,
  AGP 8.12.0, Kotlin 2.1.20, compile/target SDK 36, minimum SDK 26**.
  Gradle resolved native **3.0.9 directly from public JitPack**, without a local
  Maven source or dependency override. The published AAR SHA-256 is
  `9219ab1c34d8c41ad22fec7257e8ecc8e2e44bcd40c42daeed1fcee12dbe243f`.
- Android **API 34** runtime smoke passed with reported wrapper **0.1.3** and
  native SDK **3.0.9**. Checks include native registration, Promise results,
  nullable snapshots, subscription removal, timeout before startup, separate
  OpenAI consent, malformed/oversized/deep JSON rejection, quoted-bracket parsing
  and redacted errors. The smoke test does not start measurement or send ad events.
- The iOS bridge passed Swift syntax parsing. This release does not claim a new
  iOS native host build/runtime check; its bridge containment logic was previously
  built and smoke-tested on RN 0.87.1 with the same published iOS SDK **3.1.4**.
  No native iOS SDK version was changed.

Rebuild the host application to deliver the new Android native library.
A JavaScript reload or OTA update is insufficient. Physical-device/store builds,
Flux AI integration and live paid-ad attribution still require host-app QA.
The earlier evidence below retains its original versions and dates.

## Package identity release 0.1.2 — 14 September 2026

The package identity is now `@daively/react-native`. Version 0.1.2 is available
from public npm and GitHub Releases. Anonymous npm metadata and clean registry
installation were verified on 15 September 2026. The registry and GitHub archives
are byte-identical and match
SHA-256 `96fe99287d290637762b3daf3a0ce82b9d99601c5c194ddaf1ee27328e7d5935`.
Use the npm command in the README, or its GitHub archive alternative. The 0.1.2 release changes
package identity, examples, developer documentation and reported wrapper version;
the adapter methods, Codegen module identity and exact native SDK pins are unchanged.
Remove `@trackhub/react-native` before installing the new package to avoid duplicate
native autolinking. Native builds below are historical 0.1.1 evidence, not claims
that the renamed package was already rebuilt on a device.

For the current package, run `npm test`, `npm run codegen:check` and `npm pack`.
Local 0.1.2 verification passed **31/31 package tests**, TypeScript compilation
and actual Android/iOS Codegen on React Native **0.85.3**. Publication also requires
inspection of the final tarball and a clean consumer installation under the new scope.
Install the resulting `daively-react-native-0.1.2.tgz` into a clean RN 0.85.3 host
and verify that CLI autolinking lists only `@daively/react-native` with the
`TrackHubReactNative` pod and Android module. Use the current examples (which import
`Daively`) and expect wrapper `0.1.2` after rebuilding the native app. The older
version-specific evidence and reproduction instructions are retained below.

The first user-authorized npm retry on 15 September restored the expired CLI
login, then was rejected with HTTP 403 while account 2FA was disabled. After the
user enabled 2FA and confirmed a fresh browser publication request, npm published
the original archive at `2026-09-15T09:10:41.843Z`, with `latest` pointing to 0.1.2.
The package index briefly returned HTTP 404 during propagation; ordinary anonymous
`npm view` and `npm install` subsequently passed. The clean distribution check used
`--ignore-scripts --omit=peer --no-audit --no-fund`; it does not claim a new native
host build or peer-compatibility certification. Tags and release assets were not replaced.

## React Native 0.85.3 compatibility — 14 September 2026

The 0.1.1 candidate was installed as a tarball into separate clean Community
CLI apps using **React Native 0.85.3**, **React 19.2.3**, Hermes and the New
Architecture. Installation passed without `--force` or `--legacy-peer-deps`.
Native dependencies resolved from their public sources with no local overrides:
**iOS TrackHub 3.1.4**, **Google ODM 3.7.0**, **Android TrackHub 3.0.8**.
The iOS TrackHub SPM lock resolved 3.1.4 to
`6207742380af865e0af76de28b5f3956f5900e11`.

| Platform | Actual host configuration | Result |
| --- | --- | --- |
| Android | JDK 17.0.20, Gradle 9.3.1, AGP 8.12.0, Kotlin 2.1.20; compile/target SDK 36, minimum 26; arm64 debug APK | Full host build passed; native smoke PASS on Android API 34 emulator, native 3.0.8 / wrapper 0.1.1 |
| iOS | Xcode 26.6, CocoaPods 1.16.2, dynamic frameworks; deployment target 15.1; arm64 + x86_64 simulator | Full workspace build passed; native smoke PASS on iPhone 17 Pro / iOS 26.5, native 3.1.4 / wrapper 0.1.1 |

Both hosts passed TypeScript checks, CLI autolinking and their real native
Codegen/build steps. The smoke app used an embedded JS bundle to avoid a
different React Native version's Metro server. It exercises native
registration, promises, nullable snapshots, subscriptions, separate OpenAI
consent, input guards, timeouts and error redaction. It does not start
measurement, send TrackHub requests or prove paid-ad attribution.

Package verification: **29/29 tests** and TypeScript compilation passed on
both RN **0.85.3** and **0.87.1**. `npm run codegen:check` generated and checked
the actual Android Java and iOS Objective-C++ TurboModule bindings on both
versions. CI now runs that same two-version matrix; it does not run native
host builds. `npm pack` and `git diff --check` passed. The previous 0.87.1
native build/runtime evidence below is for wrapper 0.1.0; native host builds
of wrapper 0.1.1 were repeated on the requested 0.85.3.

No adapter API changes were necessary. This patch adds exact 0.85.3 to the
peer range, pins development to 0.85.3, and synchronizes wrapper version
reporting to 0.1.1; native SDK pins and measurement behavior are unchanged.
The peer range remains conservative: `0.85.3 || >=0.87.0 <0.88.0`.
Other 0.85 patches, 0.86.x, Legacy Architecture, Expo prebuild, static Pods,
physical-device/store-signed builds and live ad-provider delivery are not
certified by these checks. Dynamic frameworks are still required on iOS.

### Reproduce the 0.85.3 checks

1. In this package: `npm ci`, `npm test`, `npm run codegen:check`, `npm pack`.
2. Create a fresh app with
   `npx @react-native-community/cli@20.1.0 init TrackHubSmoke --version 0.85.3`,
   then install the local `trackhub-react-native-0.1.1.tgz` without peer overrides.
3. Replace `App.tsx` with `example/SmokeTest.tsx`; run `npx tsc --noEmit`.
4. Android: add JitPack and raise the template's `minSdkVersion` to 26.
   Preserve its Gradle/AGP/Kotlin versions; AGP 9 opt-outs are not required.
   In `android`, run
   `./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a`.
5. iOS: run `USE_FRAMEWORKS=dynamic bundle exec pod install`, preserving the
   standard `react_native_post_install` hook, and build the `.xcworkspace`
   for an iOS simulator. Keep the exact SPM resolution and dynamic linkage.
6. Start this host's own Metro server, or embed its bundle and disable dev-server
   loading in this isolated smoke host. Launch fresh test installations and
   expect `PASS`, wrapper `0.1.1`, and the pinned native versions above.

## Previous wrapper 0.1.0 validation (retained release evidence)

Release-candidate validation on 14 September 2026 used iOS TrackHub **3.1.4**,
Google ODM **3.7.0**, and Android TrackHub **3.0.8**. Both native adapters were
rebuilt and smoke-tested after the cold-link and consent corrections. Since
the native release tags were being prepared in parallel, these builds used
isolated local copies of the exact new SDK sources; public dependency/tag
resolution is a separate publication check. No local dependency overrides are
included in the release tarball.

## Automated checks

- `npm test`: 26 passing Node tests after TypeScript compilation. Coverage:
  consent including false/unknown, SDK Key error redaction, canonical sales
  events, deduplication and nested parameters, billing unlink, raw `oppref`,
  Apple link forwarding, subscription cleanup, cold/warm URL races, privacy
  stop, missing native module, bounded lookups and late deferred-link events.
  Additional release-fix regressions cover cold URL before native start,
  same-config concurrent/remounted initialization, startup config snapshotting,
  initial URL timeout and late delivery, newer warm URL precedence, redacted
  failure diagnostics, explicit manual linking ownership, no initial URL replay
  after listener teardown, erasure during bootstrap/no resurrection and separate
  OpenAI consent transport/validation and listener cleanup after native startup
  failure. Tests use a mocked native port.
- React Native Codegen generated both Android and iOS bindings.
- CLI autolinking identified the Android package and iOS podspec automatically.
- The initial package was installed as an npm tarball in a fresh Community CLI
  app. The corrected release tarball was unpacked into an isolated copy of
  that host; autolinking was regenerated to discard old absolute paths.
- `npm pack --dry-run` verified the package file allowlist and compiled JS/type
  declarations; Swift adapter syntax parsing and `git diff --check` passed.
- Native SDK checks: **76/76 XCTest** and **42/42 Android JVM tests**, plus an
  Android release AAR build. New consent tests exercise true/false/unknown,
  explicit null revocation, provider independence, startup revision stability,
  explicit-update revisions and overflow saturation.
- Local iOS delivery E2E passed in active and passive Apple modes. It verifies
  signed install/session/event/identity/purchase-context delivery, exactly one
  first-open across repeated startup, startup-consent refresh, stable revisions
  for unchanged cached decisions, explicit unknown revocation and Apple schema
  isolation. The receiver is synthetic loopback only, not Google/OpenAI.
- The host TrackHub web project's TypeScript check passed with this separate
  mobile package excluded from its compilation and Docker build context.

## Native builds and runtime after release corrections

Test app: React Native **0.87.1**, React **19.2.7**, Hermes, New Architecture.

| Platform | Build / runtime configuration | Result |
| --- | --- | --- |
| Android | JDK 17, Gradle 9.4.1, AGP 9.2.1, Kotlin 2.2.0; API 37 compile SDK, minimum 26; arm64 debug APK with embedded smoke JS | Built; smoke PASS with native 3.0.8 on Android API 34 emulator |
| iOS | Xcode 26.6; iOS deployment target 15.1; CocoaPods 1.16.2, dynamic frameworks; arm64 + x86_64 simulator build | Built; smoke PASS with native 3.1.4 on iPhone 17 Pro, iOS 26.5 |

`example/SmokeTest.tsx` verifies actual native registration, version pinning,
Promise results, nullable attribution, event subscription, malformed-input
rejection and error redaction. It checks Android's bounded deferred lookup
before initialization and platform-specific API behavior. On iOS it also
checks delivery of a native deferred-resolution event. Both platforms exercise
the new OpenAI consent bridge and reject malformed consent values. It does not initialize
measurement or send requests to TrackHub.

The iOS adapter hides C++ Codegen declarations from Swift's underlying module
import. Dynamic frameworks are required for the transitive Google ODM binary
to reach the app linker; default static CocoaPods linkage is unsupported in
this initial release. Do not remove this setup step from the README.

## Reproduce in an isolated app

1. In this package: `npm ci`, `npm test`, then `npm pack`.
2. Generate a React Native 0.87.1 Community CLI app and install the tarball.
3. Replace its `App.tsx` with `example/SmokeTest.tsx`.
4. Android: add JitPack, set minimum SDK 26, retain the template's
   `android.builtInKotlin=false` and `android.newDsl=false`. Run
   `./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a` in Android.
5. iOS: `USE_FRAMEWORKS=dynamic bundle exec pod install`, then build the
   workspace for an iOS simulator. Keep `react_native_post_install` enabled.
6. Start Metro and launch the application. Expect `PASS` and the pinned native
   versions. Use a fresh test app installation for this smoke test.

## Scope and release status

- The original 0.1.0 distribution was a versioned GitHub Release tarball.
  Current 0.1.2 is also published to npm; follow the current README.
- Release/store signing, physical devices, older React Native versions, Expo
  prebuild and static-framework configurations have not been certified.
- Live Firebase ingestion, billing webhooks, Play referrer attribution,
  actual ChatGPT Ads conversions, Apple postbacks, ATT prompts and remote GDPR
  acknowledgement require the host application's integration QA. These were
  not exercised by the wrapper smoke test.
- The package reuses native persistence, signing, privacy state and delivery
  code. JS unit tests are not evidence of server delivery or paid attribution.
- No host application binary was changed. Integrating this package requires
  rebuilding and releasing the host application.
- A timed-out initial URL can be forwarded after startup, but tests do not
  claim that it retroactively enriches an already dispatched first install.
  Strict cold-capture hosts must use native pre-start forwarding and one manual
  owner; validate actual first-install payloads before increasing ad spend.
