export type ConsentStatus = 'granted' | 'denied' | 'unknown';
export interface GoogleAdsConsent {
  adUserData?: ConsentStatus;
  adPersonalization?: ConsentStatus;
  isEea?: boolean;
}
export interface PiplConsent {
  personalInformation?: ConsentStatus;
  crossBorderTransfer?: ConsentStatus;
  adsMeasurement?: ConsentStatus;
}
/** Destination-specific permission. Never derive it from Google or ATT status. */
export interface OpenAiAdsConsent {
  measurement?: ConsentStatus;
  userData?: ConsentStatus;
  personalization?: ConsentStatus;
}
export type JsonValue = null | boolean | number | string | JsonValue[] | {[key: string]: JsonValue};
export type EventParameters = Record<string, JsonValue>;
export type SalesPlacement = 'onboarding_placement' | 'inapp_placement' | 'special_placement'
  | 'settings_placement' | 'on_launch_placement' | 'quick_action_placement' | 'transaction_abandonment_placement';
export interface EventOptions {
  callbackParams?: EventParameters;
  partnerParams?: EventParameters;
  deduplicationId?: string;
  ios?: {adAttributionTarget?: 'all' | 'install' | 'reengagement'; conversionTag?: string};
}
export interface TrackHubConfig {
  sdkKey: string;
  environment?: 'production' | {testLabToken: string};
  debugLogging?: boolean;
  countryCode?: string;
  firebaseAppInstanceId?: string;
  googleAdsConsent?: GoogleAdsConsent;
  openAiAdsConsent?: OpenAiAdsConsent;
  piplConsent?: PiplConsent;
  android?: {collectAdvertisingId?: boolean};
  ios?: {
    appleAttributionMode?: 'active' | 'passive';
    attConsentWaitingInterval?: number;
    googleOnDeviceMeasurement?: boolean;
    googleOnDeviceMeasurementTimeout?: number;
    googleOnDeviceMeasurementInfo?: string;
  };
}
/** JavaScript bootstrap options; never sent to the native SDK or server. */
export interface StartOptions {
  /** Automatic owns one app-lifetime Linking listener. Manual navigation owners opt out. */
  linking?: 'automatic' | 'manual';
  /** Maximum initial-link preparation time before starting measurement. Default 1000; 1–5000 ms. */
  initialURLTimeoutMs?: number;
  /** A redacted error; a timeout does not prevent application/SDK startup. */
  onLinkError?: (error: Error) => void;
}
export interface Attribution {
  revision: string; status: string; network: string; channel: string;
  campaignId: string | null; adGroupId: string | null; keywordId: string | null;
  touchpointKind: string | null; source: string | null; data: Record<string, string>;
}
export interface DeliveryFailure {type: 'credentialsRejected'; path: string}
/** Redacted diagnostic: contains no event parameters or original exception. */
export interface CallbackFailure {code: 'E_TRACKHUB_CALLBACK'; event: keyof TrackHubEvents}
export type TrackingAuthorizationStatus = 'notDetermined' | 'restricted' | 'denied' | 'authorized' | 'unavailable';
export interface Subscription {remove(): void}
export interface LinkingSubscription extends Subscription {ready: Promise<void>}
export interface TrackHubEvents {
  attributionChanged: Attribution;
  deferredDeepLink: string | null;
  deliveryFailure: DeliveryFailure;
  erasureCompleted: boolean;
}
