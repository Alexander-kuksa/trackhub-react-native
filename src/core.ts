import type {
  Attribution, CallbackFailure, EventOptions, GoogleAdsConsent, LinkingSubscription, OpenAiAdsConsent, PiplConsent,
  SalesPlacement, StartOptions, Subscription, TrackHubConfig, TrackHubEvents, TrackingAuthorizationStatus,
} from './types';
import {encodeBoundedJSON as encode} from './bounded-json';

interface NativePort {
  invoke(operation: string, payload: string): Promise<string>;
  onEvent(listener: (event: string) => void): Subscription;
}
interface LinkingPort {
  getInitialURL(): Promise<string | null | undefined>;
  addEventListener(type: 'url', listener: (event: {url: string}) => void): Subscription;
}
const placements = new Set([
  'onboarding_placement', 'inapp_placement', 'special_placement', 'settings_placement',
  'on_launch_placement', 'quick_action_placement', 'transaction_abandonment_placement',
]);
function requireString(value: unknown, label: string, max = 4096): asserts value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) {
    throw new TypeError(`TrackHub: invalid ${label}`);
  }
}
function consent(value: object | undefined): void {
  if (!value) return;
  for (const [key, status] of Object.entries(value)) {
    if (status === undefined) continue;
    if (key === 'isEea' ? typeof status !== 'boolean' : !['granted', 'denied', 'unknown'].includes(status)) {
      throw new TypeError('TrackHub: invalid consent');
    }
  }
}
function validEventData(type: keyof TrackHubEvents, value: unknown): boolean {
  if (type === 'deferredDeepLink') return value === null || typeof value === 'string';
  if (type === 'erasureCompleted') return typeof value === 'boolean';
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  if (type === 'deliveryFailure') return data.type === 'credentialsRejected' && typeof data.path === 'string';
  if (type === 'attributionChanged') {
    return ['revision', 'status', 'network', 'channel'].every(key => typeof data[key] === 'string')
      && ['campaignId', 'adGroupId', 'keywordId', 'touchpointKind', 'source']
        .every(key => data[key] === null || typeof data[key] === 'string')
      && !!data.data && typeof data.data === 'object' && !Array.isArray(data.data)
      && Object.values(data.data).every(item => typeof item === 'string');
  }
  return false;
}
export function createTrackHub(getNative: () => NativePort | null, linking: LinkingPort) {
  let callbackErrorHandler: ((failure: CallbackFailure) => void | Promise<void>) | null = null;
  let erased = false;
  let startup: {signature: string; promise: Promise<void>} | undefined;
  let activeLinking: LinkingSubscription | undefined;
  let initialURLAttempted = false;
  let manualLinkingOwner = false;
  function assertMeasuring(): void {
    if (erased) throw Object.assign(new Error('TrackHub: measurement is stopped after an erasure request.'), {code: 'E_TRACKHUB_ERASED'});
  }
  function native(): NativePort {
    const module = getNative();
    if (!module) throw new Error('TrackHub native module is unavailable. Install pods and rebuild the Android/iOS app. Expo Go and web are unsupported.');
    return module;
  }
  async function invoke<T = void>(operation: string, payload: unknown = {}): Promise<T> {
    if (operation !== 'gdprForgetMe' && operation !== 'getVersions') assertMeasuring();
    return JSON.parse(await native().invoke(operation, encode(payload))) as T;
  }
  async function lookup<T>(operation: string, timeoutMs = 15000): Promise<T> {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120000) {
      throw new TypeError('TrackHub: invalid lookup timeout');
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        invoke<T>(operation),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(Object.assign(
            new Error('TrackHub: lookup timed out; native measurement may still be pending.'),
            {code: 'E_TRACKHUB_TIMEOUT'},
          )), timeoutMs);
        }),
      ]);
    } finally { if (timer !== undefined) clearTimeout(timer); }
  }
  function on<K extends keyof TrackHubEvents>(type: K, handler: (value: TrackHubEvents[K]) => void): Subscription {
    if (typeof handler !== 'function') throw new TypeError('TrackHub: invalid event handler');
    let active = true;
    const subscription = native().onEvent(raw => {
      if (!active || typeof raw !== 'string' || raw.length > 262144) return;
      let event: {type: K; data: TrackHubEvents[K]};
      try { event = JSON.parse(raw); } catch { return; }
      if (!event || event.type !== type || !validEventData(type, event.data)) return;
      const reporter = callbackErrorHandler;
      if (!reporter) {handler(event.data); return;}
      const report = () => {
        try {void Promise.resolve(reporter({code: 'E_TRACKHUB_CALLBACK', event: type})).catch(() => {});}
        catch { /* A failing diagnostic handler must not cause a second failure. */ }
      };
      try {void Promise.resolve(handler(event.data)).catch(report);} catch {report();}
    });
    return {remove() {if (active) {active = false; subscription.remove();}}};
  }
  async function sales(event: string, placement: SalesPlacement | null, options: EventOptions = {}) {
    if (placement !== null && !placements.has(placement)) throw new TypeError('TrackHub: invalid placement');
    await invoke('trackSalesEvent', {...options, event, placement});
  }
  async function handleDeepLink(url: string): Promise<boolean> {
    requireString(url, 'deep link', 16384);
    // Do not use URLSearchParams: oppref is opaque and must retain + and % escapes.
    return invoke<boolean>('handleDeepLink', {url});
  }
  function startLinking(onError: (error: Error) => void, initialURLTimeoutMs = 1000): LinkingSubscription {
    assertMeasuring();
    if (manualLinkingOwner) throw new Error('TrackHub: Linking is owned by the host navigation handler.');
    if (!Number.isFinite(initialURLTimeoutMs) || initialURLTimeoutMs < 1 || initialURLTimeoutMs > 5000) {
      throw new TypeError('TrackHub: invalid initial URL timeout');
    }
    if (activeLinking) return activeLinking;
    let removed = false;
    let warmReceived = false;
    let delivery: Promise<void> = Promise.resolve();
    const forward = (url: string): Promise<void> => {
      delivery = delivery.catch(() => {}).then(async () => {
        if (!removed && !erased) await handleDeepLink(url);
      });
      return delivery;
    };
    const linkError = (error: unknown): Error => {
      // Linking/native errors may contain a URL or credentials. Do not expose it.
      const timeout = error instanceof Error && 'code' in error && error.code === 'E_TRACKHUB_LINK_TIMEOUT';
      return Object.assign(new Error(timeout
        ? 'TrackHub: initial URL preparation timed out; startup continues without a guaranteed cold-link context.'
        : 'TrackHub: could not process an incoming link.'),
      {code: timeout ? 'E_TRACKHUB_LINK_TIMEOUT' : 'E_TRACKHUB_LINK'});
    };
    const notify = (error: unknown) => {
      try { onError(linkError(error)); } catch { /* Host telemetry must not stop measurement. */ }
    };
    const subscription = linking.addEventListener('url', ({url}) => {
      if (removed || erased) return;
      warmReceived = true;
      void forward(url).catch(notify);
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    let preparation: Promise<void> = Promise.resolve();
    if (!initialURLAttempted) {
      initialURLAttempted = true;
      preparation = Promise.resolve().then(() => linking.getInitialURL()).then(async url => {
        // A live URL is newer than the launch URL, including a duplicate launch delivery.
        // Never overwrite it with a slower getInitialURL() result.
        if (!removed && !erased && url && !warmReceived) await forward(url);
        await delivery;
      });
    }
    const ready = Promise.race([
      preparation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error('Initial URL timeout'),
          {code: 'E_TRACKHUB_LINK_TIMEOUT'})), initialURLTimeoutMs);
      }),
    ]).catch(error => { throw linkError(error); }).finally(() => { if (timer !== undefined) clearTimeout(timer); });
    // Preserve late URL delivery after the bounded bootstrap wait, unless removed/erased.
    // Promise.race observes preparation rejection even after a timeout.
    void ready.catch(notify);
    const owned: LinkingSubscription = {ready, remove() {
      if (removed) return;
      removed = true;
      subscription.remove();
      if (activeLinking === owned) activeLinking = undefined;
    }};
    activeLinking = owned;
    return owned;
  }
  return {
    /** Opt in to callback isolation; null restores normal exception propagation. */
    setCallbackErrorHandler(handler: ((failure: CallbackFailure) => void | Promise<void>) | null): void {
      if (handler !== null && typeof handler !== 'function') throw new TypeError('TrackHub: invalid callback error handler');
      callbackErrorHandler = handler;
    },
    async start(config: TrackHubConfig, options: StartOptions = {}): Promise<void> {
      assertMeasuring();
      requireString(config.sdkKey, 'SDK Key', 8192);
      if (!config.sdkKey.startsWith('thcfg_v1_')) throw new TypeError('TrackHub: invalid SDK Key');
      if (config.environment !== undefined && config.environment !== 'production') {
        requireString(config.environment?.testLabToken, 'Test Lab token', 128);
        if (config.environment.testLabToken.length < 20) throw new TypeError('TrackHub: invalid Test Lab token');
      }
      if (config.countryCode !== undefined && !/^[A-Za-z]{2}$/.test(config.countryCode)) throw new TypeError('TrackHub: invalid country');
      for (const value of [config.ios?.attConsentWaitingInterval, config.ios?.googleOnDeviceMeasurementTimeout]) {
        if (value !== undefined && (!Number.isFinite(value) || value < 0)) throw new TypeError('TrackHub: invalid waiting interval');
      }
      consent(config.googleAdsConsent); consent(config.openAiAdsConsent); consent(config.piplConsent);
      const mode = options.linking ?? 'automatic';
      if (!['automatic', 'manual'].includes(mode)) throw new TypeError('TrackHub: invalid linking owner');
      const timeout = options.initialURLTimeoutMs ?? 1000;
      if (!Number.isFinite(timeout) || timeout < 1 || timeout > 5000) throw new TypeError('TrackHub: invalid initial URL timeout');
      if (options.onLinkError !== undefined && typeof options.onLinkError !== 'function') throw new TypeError('TrackHub: invalid link error handler');
      // Snapshot before the async initial URL lookup so a caller cannot mutate startup consent.
      const snapshot = JSON.parse(encode(config)) as TrackHubConfig;
      const signature = JSON.stringify({config: snapshot, mode}, (_key, value) =>
        value && typeof value === 'object' && !Array.isArray(value)
          ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value);
      if (startup) {
        if (startup.signature !== signature) throw Object.assign(
          new Error('TrackHub: already starting or started with another configuration. Use update APIs or restart the app.'),
          {code: 'E_TRACKHUB_ALREADY_STARTED'});
        return startup.promise;
      }
      if (mode === 'manual' && activeLinking) throw new Error('TrackHub: remove automatic Linking before choosing a manual owner.');
      manualLinkingOwner = mode === 'manual';
      const promise = Promise.resolve().then(async () => {
        assertMeasuring();
        let links: LinkingSubscription | undefined;
        if (mode === 'automatic') {
          links = startLinking(options.onLinkError ?? (() => {}), timeout);
          // Link errors are reported independently. They must not prevent basic SDK startup.
          await links.ready.catch(() => {});
        }
        assertMeasuring();
        try { await invoke('start', snapshot); }
        catch (error) { links?.remove(); throw error; }
      });
      startup = {signature, promise};
      return promise;
    },
    async trackEvent(name: string, options: EventOptions = {}): Promise<void> {
      requireString(name, 'event name', 128);
      await invoke('trackEvent', {...options, name});
    },
    trackOnboardingShown: (options?: EventOptions) => sales('ob_shown', null, options),
    trackPaywallShown: (placement: SalesPlacement, options?: EventOptions) => sales('pw_shown', placement, options),
    trackPurchaseCtaTapped: (placement: SalesPlacement, options?: EventOptions) => sales('purchase_cta_tapped', placement, options),
    async setExternalIdentity(provider: string, userId: string | null): Promise<void> {
      requireString(provider, 'identity provider', 128);
      if (userId !== null) requireString(userId, 'external identity', 256);
      await invoke('setExternalIdentity', {provider, userId});
    },
    async trackPurchaseObserved(transactionId: string, productId?: string): Promise<void> {
      requireString(transactionId, 'transaction ID');
      await invoke('trackPurchaseObserved', {transactionId, productId});
    },
    handleDeepLink,
    async handleAdAttributionReengagement(url: string): Promise<string | null> {
      requireString(url, 'Apple reengagement link', 16384);
      return invoke<string | null>('handleAdAttributionReengagement', {url});
    },
    async setGoogleClickIds(ids: {gclid?: string; gbraid?: string; wbraid?: string}): Promise<void> {
      await invoke('setGoogleClickIds', ids);
    },
    async updateGoogleAdsConsent(value: GoogleAdsConsent): Promise<void> {consent(value); await invoke('updateGoogleAdsConsent', value);},
    async updateOpenAiAdsConsent(value: OpenAiAdsConsent): Promise<void> {consent(value); await invoke('updateOpenAiAdsConsent', value);},
    async updatePiplConsent(value: PiplConsent): Promise<void> {consent(value); await invoke('updatePiplConsent', value);},
    async updateFirebaseAppInstanceId(value: string): Promise<void> {requireString(value, 'Firebase instance ID'); await invoke('updateFirebaseAppInstanceId', {value});},
    async updateCountryCode(value: string): Promise<void> {
      if (!/^[A-Za-z]{2}$/.test(value)) throw new TypeError('TrackHub: invalid country');
      await invoke('updateCountryCode', {value});
    },
    async updateGoogleOnDeviceMeasurementInfo(value: string): Promise<void> {requireString(value, 'ODM info', 16384); await invoke('updateGoogleOnDeviceMeasurementInfo', {value});},
    async setPushToken(token: string, environment: 'production' | 'sandbox' = 'production'): Promise<void> {
      requireString(token, 'push token'); await invoke('setPushToken', {token, environment});
    },
    getAttribution: (timeoutMs?: number) => lookup<Attribution | null>('getAttribution', timeoutMs),
    resolveDeferredDeepLink: (timeoutMs?: number) => lookup<string | null>('resolveDeferredDeepLink', timeoutMs),
    requestAppTrackingTransparency: () => invoke<TrackingAuthorizationStatus>('requestAppTrackingTransparency'),
    getVersions: () => invoke<{reactNative: string; native: string; platform: 'ios' | 'android'}>('getVersions'),
    async gdprForgetMe(reason = 'user_requested'): Promise<void> {
      requireString(reason, 'erasure reason', 256);
      erased = true;
      activeLinking?.remove();
      // Resolves after requesting the durable native stop. Server confirmation
      // is separate and can arrive after an offline retry or next launch.
      await invoke('gdprForgetMe', {reason});
    },
    onAttributionChanged: (handler: (value: Attribution) => void) => on('attributionChanged', handler),
    onDeferredDeepLink: (handler: (value: string | null) => void) => on('deferredDeepLink', handler),
    onDeliveryFailure: (handler: (value: TrackHubEvents['deliveryFailure']) => void) => on('deliveryFailure', handler),
    onErasureCompleted: (handler: (value: boolean) => void) => on('erasureCompleted', handler),
    /** Normally owned by start(). Initial URL is attempted once, even after unsubscribe/remount. */
    startLinking,
  };
}
