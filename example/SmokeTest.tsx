import React, {useEffect, useState} from 'react';
import {Platform, ScrollView, Text, TurboModuleRegistry, type TurboModule} from 'react-native';
import TrackHub from '@trackhub/react-native';

// Isolated fresh-app smoke test. Does not initialize measurement, prompt for
// consent, contact TrackHub or erase data. The private port tests native guards.
interface TestPort extends TurboModule {
  invoke(operation: string, payload: string): Promise<string>;
}

export default function SmokeTest() {
  const [result, setResult] = useState('RUNNING');
  useEffect(() => {
    let mounted = true;
    async function run() {
      const native = TurboModuleRegistry.getEnforcing<TestPort>('NativeTrackHub');
      const versions = await TrackHub.getVersions();
      const expected = Platform.OS === 'ios' ? '3.1.4' : '3.0.8';
      if (versions.native !== expected || versions.reactNative !== '0.1.1' || versions.platform !== Platform.OS) {
        throw new Error('Unexpected native versions');
      }
      const subscription = TrackHub.onDeferredDeepLink(() => {});
      subscription.remove();
      // Unknown is not a measurement grant. Exercise the new native API without starting it.
      await TrackHub.updateOpenAiAdsConsent({measurement: 'unknown', userData: 'denied', personalization: 'unknown'});
      if (await TrackHub.getAttribution() !== null) throw new Error('Expected fresh-install attribution');
      if (Platform.OS === 'ios') {
        let finishEvent!: (value: string | null) => void;
        const event = new Promise<string | null>(resolve => {finishEvent = resolve;});
        const events = TrackHub.onDeferredDeepLink(finishEvent);
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const values = await Promise.race([
            Promise.all([TrackHub.resolveDeferredDeepLink(), event]),
            new Promise<never>((_resolve, reject) => {
              timer = setTimeout(() => reject(new Error('Native event was not delivered')), 3000);
            }),
          ]);
          if (values.some(value => value !== null)) throw new Error('Expected no deferred link');
        } finally {events.remove(); if (timer !== undefined) clearTimeout(timer);}
        if (await TrackHub.handleAdAttributionReengagement('flux://smoke') !== null) {
          throw new Error('Expected no Apple reengagement tag');
        }
      } else {
        // Android's native resolver waits for initialized install context.
        let timedOut = false;
        try {await TrackHub.resolveDeferredDeepLink(200);} catch (error) {
          timedOut = (error as {code?: string}).code === 'E_TRACKHUB_TIMEOUT';
        }
        if (!timedOut) throw new Error('Expected bounded lookup before native start');
      }
      const secret = 'thcfg_v1_smoke_secret_do_not_log';
      for (const [operation, payload, code] of [
        ['start', JSON.stringify({sdkKey: secret, debugLogging: 'invalid'}), 'E_TRACKHUB_INPUT'],
        ['trackEvent', JSON.stringify({name: 'smoke', callbackParams: []}), 'E_TRACKHUB_INPUT'],
        ['getVersions', '{invalid JSON', 'E_TRACKHUB_INPUT'],
        ['updateOpenAiAdsConsent', JSON.stringify({measurement: 'allow'}), 'E_TRACKHUB_INPUT'],
        ['unknown_smoke_operation', '{}', 'E_TRACKHUB_OPERATION'],
      ]) {
        let rejected = false;
        try {await native.invoke(operation!, payload!);} catch (error) {
          const failure = error as {code?: string; message?: string};
          if (failure.code !== code || failure.message?.includes(secret)) throw new Error('Unsafe native rejection');
          rejected = true;
        }
        if (!rejected) throw new Error('Native input guard did not reject');
      }
      if (Platform.OS === 'android' && await TrackHub.requestAppTrackingTransparency() !== 'unavailable') {
        throw new Error('Android ATT must be unavailable');
      }
      if (Platform.OS === 'android') {
        let unsupported = false;
        try {await TrackHub.handleAdAttributionReengagement('flux://smoke');} catch (error) {
          unsupported = (error as {code?: string}).code === 'E_UNSUPPORTED_PLATFORM';
        }
        if (!unsupported) throw new Error('Apple-only API must reject on Android');
      }
      return `PASS ${JSON.stringify(versions)}\nNative registration, Promise results, nullable snapshots, event subscription, input guards and error redaction verified.`;
    }
    void run().then(value => {if (mounted) setResult(value);})
      .catch(error => {if (mounted) setResult(`FAIL ${error.message}`);});
    return () => {mounted = false;};
  }, []);
  return <ScrollView contentContainerStyle={{padding: 24, paddingTop: 100}}>
    <Text accessibilityLabel={result} testID="trackhub-smoke-result" style={{fontSize: 20}}>{result}</Text>
  </ScrollView>;
}
