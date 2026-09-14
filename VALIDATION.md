# Validation — React Native 0.1.0

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

- Distribution is a versioned GitHub Release tarball, not an npm registry
  publication. Follow the exact release URL in the README.
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
