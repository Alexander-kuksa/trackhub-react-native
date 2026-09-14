import Foundation
import TrackHub
import TrackHubGoogleODM

/// SDK callbacks contain data, never executable JavaScript. The generated
/// TurboModule owns the event subscription and this adapter's lifetime.
@objc(TRHBridge)
public final class TRHBridge: NSObject {
    private var emitHandler: ((String) -> Void)?
    @objc public init(emit: @escaping (String) -> Void) {
        self.emitHandler = emit
        super.init()
    }
    @objc public func invalidate() {
        DispatchQueue.main.async { [weak self] in self?.emitHandler = nil }
    }
    private func event(_ type: String, _ value: Any?) {
        DispatchQueue.main.async { [weak self] in
            guard let handler = self?.emitHandler,
                  let encoded = try? encode(["type": type, "data": value ?? NSNull()]) else { return }
            handler(encoded)
        }
    }

    @objc(invoke:payload:resolve:reject:)
    public func invoke(_ operation: String, payload: String,
                       resolve: @escaping (String) -> Void,
                       reject: @escaping (String, String) -> Void) {
        DispatchQueue.main.async { [weak self] in
            guard let self, self.emitHandler != nil else {
                reject("E_TRACKHUB_UNAVAILABLE", "Native module has been invalidated."); return
            }
            do {
                guard let data = payload.data(using: .utf8), data.count <= 262144,
                      let p = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw Input.invalid }
                switch operation {
                case "start":
                    let key = try required(p, "sdkKey")
                    guard key.hasPrefix("thcfg_v1_"), key.count <= 8192 else { throw Input.invalid }
                    let environment: TrackHubEnvironment
                    if let value = p["environment"], !(value is NSNull) {
                        if let value = value as? String, value == "production" { environment = .production }
                        else if let value = value as? [String: Any] {
                            let token = try required(value, "testLabToken")
                            guard (20...128).contains(token.count) else { throw Input.invalid }
                            environment = .testLab(token: token)
                        } else { throw Input.invalid }
                    } else { environment = .production }
                    var config = TrackHubConfig(sdkKey: key, environment: environment)
                    config.debugLogging = try boolean(p, "debugLogging") ?? false
                    config.countryCode = try text(p, "countryCode")
                    config.firebaseAppInstanceId = try text(p, "firebaseAppInstanceId")
                    config.googleAdsConsent = try googleConsent(object(p, "googleAdsConsent"))
                    config.openAiAdsConsent = try openAiConsent(object(p, "openAiAdsConsent"))
                    config.piplConsent = try piplConsent(object(p, "piplConsent"))
                    let ios = try object(p, "ios")
                    if let mode = try text(ios, "appleAttributionMode") {
                        guard let value = TrackHubAppleAttributionMode(rawValue: mode) else { throw Input.invalid }
                        config.appleAttributionMode = value
                    }
                    if let interval = try number(ios, "attConsentWaitingInterval") { config.attConsentWaitingInterval = interval }
                    if let interval = try number(ios, "googleOnDeviceMeasurementTimeout") { config.googleOnDeviceMeasurementTimeout = interval }
                    config.googleOnDeviceMeasurementInfo = try text(ios, "googleOnDeviceMeasurementInfo")
                    config.attributionChangedHandler = { [weak self] in self?.event("attributionChanged", attribution($0)) }
                    config.deferredDeepLinkHandler = { [weak self] in self?.event("deferredDeepLink", $0) }
                    config.deliveryFailureHandler = { [weak self] failure in
                        switch failure {
                        case .credentialsRejected(let path): self?.event("deliveryFailure", ["type": "credentialsRejected", "path": path])
                        }
                    }
                    if try boolean(ios, "googleOnDeviceMeasurement") == true { TrackHubGoogleODM.start(config) }
                    else { TrackHub.start(config) }
                case "trackEvent", "trackSalesEvent":
                    let ios = try object(p, "ios")
                    let target: AdAttributionConversionTarget
                    switch try text(ios, "adAttributionTarget") {
                    case nil, "all": target = .all
                    case "install": target = .install
                    case "reengagement": target = .reengagement
                    default: throw Input.invalid
                    }
                    let callback = try object(p, "callbackParams")
                    let partner = try object(p, "partnerParams")
                    let tag = try text(ios, "conversionTag")
                    let dedup = try text(p, "deduplicationId")
                    if operation == "trackEvent" {
                        TrackHub.trackEvent(try required(p, "name"), callbackParams: callback, partnerParams: partner,
                            adAttributionTarget: target, conversionTag: tag, deduplicationId: dedup)
                    } else {
                        guard let event = TrackHubSalesEvent(rawValue: try required(p, "event")) else { throw Input.invalid }
                        let placement: TrackHubSalesPlacement?
                        if let value = try text(p, "placement") {
                            guard let canonical = TrackHubSalesPlacement(rawValue: value) else { throw Input.invalid }
                            placement = canonical
                        } else { placement = nil }
                        guard event == .onboardingShown || placement != nil else { throw Input.invalid }
                        TrackHub.trackSalesEvent(event, placement: placement, callbackParams: callback, partnerParams: partner,
                            adAttributionTarget: target, conversionTag: tag, deduplicationId: dedup)
                    }
                case "setExternalIdentity": TrackHub.setExternalIdentity(provider: try required(p, "provider"), userId: try text(p, "userId"))
                case "trackPurchaseObserved": TrackHub.trackPurchaseObserved(transactionId: try required(p, "transactionId"), productId: try text(p, "productId"))
                case "handleDeepLink":
                    guard let url = URL(string: try required(p, "url")) else { throw Input.invalid }
                    resolve(try encode(TrackHub.handleDeepLink(url))); return
                case "handleAdAttributionReengagement":
                    guard let url = URL(string: try required(p, "url")) else { throw Input.invalid }
                    resolve(try encode(TrackHub.handleAdAttributionReengagement(url))); return
                case "setGoogleClickIds": TrackHub.setGoogleClickIds(gclid: try text(p, "gclid"), gbraid: try text(p, "gbraid"), wbraid: try text(p, "wbraid"))
                case "updateGoogleAdsConsent": TrackHub.updateGoogleAdsConsent(try googleConsent(p))
                case "updateOpenAiAdsConsent": TrackHub.updateOpenAiAdsConsent(try openAiConsent(p))
                case "updatePiplConsent": TrackHub.updatePIPLConsent(try piplConsent(p))
                case "updateCountryCode": TrackHub.updateCountryCode(try required(p, "value"))
                case "updateFirebaseAppInstanceId": TrackHub.updateFirebaseAppInstanceId(try required(p, "value"))
                case "updateGoogleOnDeviceMeasurementInfo": TrackHub.updateGoogleOnDeviceMeasurementInfo(try required(p, "value"))
                case "setPushToken":
                    guard let environment = TrackHubPushEnvironment(rawValue: try text(p, "environment") ?? "production") else { throw Input.invalid }
                    TrackHub.setPushToken(try required(p, "token"), environment: environment)
                case "getAttribution":
                    TrackHub.attribution { resolve((try? encode($0.map(attribution))) ?? "null") }; return
                case "resolveDeferredDeepLink":
                    TrackHub.resolveDeferredDeepLink { [weak self] in
                        self?.event("deferredDeepLink", $0)
                        resolve((try? encode($0)) ?? "null")
                    }; return
                case "requestAppTrackingTransparency":
                    TrackHub.requestAppTrackingTransparency { resolve((try? encode($0.rawValue)) ?? "\"unavailable\"") }; return
                case "gdprForgetMe":
                    TrackHub.gdprForgetMe(reason: try required(p, "reason")) { [weak self] in self?.event("erasureCompleted", $0) }
                case "getVersions":
                    resolve(try encode(["reactNative": "0.1.1", "native": TrackHub.sdkVersion, "platform": "ios"])); return
                default: reject("E_TRACKHUB_OPERATION", "Unsupported TrackHub operation."); return
                }
                resolve("null")
            } catch {
                reject("E_TRACKHUB_INPUT", "Invalid TrackHub request.")
            }
        }
    }
}

private enum Input: Error { case invalid }
private func text(_ p: [String: Any], _ key: String) throws -> String? {
    guard let value = p[key], !(value is NSNull) else { return nil }
    guard let value = value as? String else { throw Input.invalid }
    return value
}
private func required(_ p: [String: Any], _ key: String) throws -> String {
    guard let value = try text(p, key), !value.isEmpty else { throw Input.invalid }; return value
}
private func object(_ p: [String: Any], _ key: String) throws -> [String: Any] {
    guard let value = p[key], !(value is NSNull) else { return [:] }
    guard let value = value as? [String: Any] else { throw Input.invalid }; return value
}
private func boolean(_ p: [String: Any], _ key: String) throws -> Bool? {
    guard let value = p[key], !(value is NSNull) else { return nil }
    guard let value = value as? NSNumber, CFGetTypeID(value) == CFBooleanGetTypeID() else { throw Input.invalid }
    return value.boolValue
}
private func number(_ p: [String: Any], _ key: String) throws -> Double? {
    guard let value = p[key], !(value is NSNull) else { return nil }
    guard let value = value as? NSNumber, CFGetTypeID(value) != CFBooleanGetTypeID(),
          value.doubleValue.isFinite, value.doubleValue >= 0 else { throw Input.invalid }; return value.doubleValue
}
private func status(_ p: [String: Any], _ key: String) throws -> TrackHubConsentStatus {
    guard let result = TrackHubConsentStatus(rawValue: try text(p, key) ?? "unknown") else { throw Input.invalid }; return result
}
private func googleConsent(_ p: [String: Any]) throws -> TrackHubGoogleAdsConsent {
    try TrackHubGoogleAdsConsent(adUserData: status(p, "adUserData"), adPersonalization: status(p, "adPersonalization"), isEea: boolean(p, "isEea"))
}
private func openAiConsent(_ p: [String: Any]) throws -> TrackHubOpenAiAdsConsent {
    try TrackHubOpenAiAdsConsent(measurement: status(p, "measurement"), userData: status(p, "userData"), personalization: status(p, "personalization"))
}
private func piplConsent(_ p: [String: Any]) throws -> TrackHubPIPLConsent {
    try TrackHubPIPLConsent(personalInformation: status(p, "personalInformation"), crossBorderTransfer: status(p, "crossBorderTransfer"), adsMeasurement: status(p, "adsMeasurement"))
}
private func encode(_ value: Any?) throws -> String {
    let data = try JSONSerialization.data(withJSONObject: value ?? NSNull(), options: [.fragmentsAllowed, .sortedKeys])
    guard let result = String(data: data, encoding: .utf8) else { throw Input.invalid }; return result
}
private func attribution(_ value: TrackHubAttribution) -> [String: Any] {
    ["revision": value.revision, "status": value.status, "network": value.network, "channel": value.channel,
     "campaignId": value.campaignId as Any? ?? NSNull(), "adGroupId": value.adGroupId as Any? ?? NSNull(),
     "keywordId": value.keywordId as Any? ?? NSNull(), "touchpointKind": value.touchpointKind as Any? ?? NSNull(),
     "source": value.source as Any? ?? NSNull(), "data": value.data]
}
