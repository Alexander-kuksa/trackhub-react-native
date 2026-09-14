package com.trackhub.reactnative

import android.net.Uri
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import com.trackhub.*
import org.json.JSONObject
import org.json.JSONArray
import java.lang.ref.WeakReference
import java.util.concurrent.atomic.AtomicBoolean

@ReactModule(name = TrackHubModule.NAME)
class TrackHubModule(context: ReactApplicationContext) : NativeTrackHubSpec(context) {
    companion object { const val NAME = "NativeTrackHub" }
    private val active = AtomicBoolean(true)
    override fun getName() = NAME
    override fun invalidate() { active.set(false); super.invalidate() }

    private fun event(type: String, data: Any?) {
        if (active.get() && reactApplicationContext.hasActiveReactInstance()) {
            emitOnEvent(JSONObject().put("type", type).put("data", data ?: JSONObject.NULL).toString())
        }
    }

    override fun invoke(operation: String, payload: String, promise: Promise) {
        try {
            require(active.get() && payload.toByteArray(Charsets.UTF_8).size <= 262144)
            val p = JSONObject(payload)
            val weak = WeakReference(this)
            when (operation) {
                "start" -> {
                    val key = p.required("sdkKey")
                    require(key.startsWith("thcfg_v1_") && key.length <= 8192)
                    val env = p.opt("environment")
                    val environment = when {
                        env == null || env == JSONObject.NULL || env == "production" -> TrackHubEnvironment.Production
                        env is JSONObject -> {
                            val token = env.required("testLabToken")
                            require(token.length in 20..128)
                            TrackHubEnvironment.TestLab(token)
                        }
                        else -> throw IllegalArgumentException()
                    }
                    TrackHub.start(reactApplicationContext, TrackHubConfig(
                        sdkKey = key, environment = environment,
                        debugLogging = p.boolean("debugLogging") ?: false,
                        countryCode = p.text("countryCode"),
                        collectAdvertisingId = p.obj("android").boolean("collectAdvertisingId") ?: true,
                        firebaseAppInstanceId = p.text("firebaseAppInstanceId"),
                        googleAdsConsent = googleConsent(p.obj("googleAdsConsent")),
                        openAiAdsConsent = openAiConsent(p.obj("openAiAdsConsent")),
                        piplConsent = piplConsent(p.obj("piplConsent")),
                        attributionChangedHandler = { weak.get()?.event("attributionChanged", attribution(it)) },
                        deferredDeepLinkHandler = { weak.get()?.event("deferredDeepLink", it) },
                        deliveryFailureHandler = {
                            when (it) {
                                is TrackHubDeliveryFailure.CredentialsRejected -> weak.get()?.event("deliveryFailure",
                                    JSONObject().put("type", "credentialsRejected").put("path", it.path))
                            }
                        },
                    ))
                }
                "trackEvent" -> TrackHub.trackEvent(p.required("name"), p.params("callbackParams"), p.params("partnerParams"), p.text("deduplicationId"))
                "trackSalesEvent" -> {
                    val event = TrackHubSalesEvent.entries.firstOrNull { it.value == p.required("event") }
                        ?: throw IllegalArgumentException()
                    val placementValue = p.text("placement")
                    val placement = placementValue?.let { value ->
                        TrackHubSalesPlacement.entries.firstOrNull { it.value == value } ?: throw IllegalArgumentException()
                    }
                    require(event == TrackHubSalesEvent.ONBOARDING_SHOWN || placement != null)
                    TrackHub.trackSalesEvent(event, placement, p.params("callbackParams"), p.params("partnerParams"), p.text("deduplicationId"))
                }
                "setExternalIdentity" -> TrackHub.setExternalIdentity(p.required("provider"), p.text("userId"))
                "trackPurchaseObserved" -> TrackHub.trackPurchaseObserved(p.required("transactionId"), p.text("productId"))
                "handleDeepLink" -> { promise.resolve(json(TrackHub.handleDeepLink(reactApplicationContext, Uri.parse(p.required("url"))))); return }
                "setGoogleClickIds" -> TrackHub.setGoogleClickIds(p.text("gclid"), p.text("gbraid"), p.text("wbraid"))
                "updateGoogleAdsConsent" -> TrackHub.updateGoogleAdsConsent(googleConsent(p))
                "updateOpenAiAdsConsent" -> TrackHub.updateOpenAiAdsConsent(openAiConsent(p))
                "updatePiplConsent" -> TrackHub.updatePiplConsent(piplConsent(p))
                "updateCountryCode" -> TrackHub.updateCountryCode(p.required("value"))
                "updateFirebaseAppInstanceId" -> TrackHub.updateFirebaseAppInstanceId(p.required("value"))
                "setPushToken" -> TrackHub.setPushToken(reactApplicationContext, p.required("token"))
                "getAttribution" -> { TrackHub.attribution { promise.resolve(json(it?.let(::attribution))) }; return }
                "resolveDeferredDeepLink" -> {
                    TrackHub.resolveDeferredDeepLink {
                        // Native may retain this callback until install acknowledgement.
                        // Preserve late delivery even if the JS lookup already timed out.
                        weak.get()?.event("deferredDeepLink", it)
                        promise.resolve(json(it))
                    }
                    return
                }
                "gdprForgetMe" -> TrackHub.gdprForgetMe(reactApplicationContext, p.required("reason")) {
                    weak.get()?.event("erasureCompleted", it)
                }
                "requestAppTrackingTransparency" -> { promise.resolve(json("unavailable")); return }
                "updateGoogleOnDeviceMeasurementInfo", "handleAdAttributionReengagement" -> {
                    promise.reject("E_UNSUPPORTED_PLATFORM", "This API is available on iOS only."); return
                }
                "getVersions" -> {
                    promise.resolve(JSONObject().put("reactNative", "0.1.1").put("native", TrackHub.SDK_VERSION).put("platform", "android").toString())
                    return
                }
                else -> { promise.reject("E_TRACKHUB_OPERATION", "Unsupported TrackHub operation."); return }
            }
            promise.resolve("null")
        } catch (_: Exception) {
            // Do not include input, exceptions, tokens or SDK keys in bridge errors.
            promise.reject("E_TRACKHUB_INPUT", "Invalid TrackHub request or unavailable native module.")
        }
    }
}

private fun JSONObject.text(key: String): String? {
    val value = opt(key)
    if (value == null || value == JSONObject.NULL) return null
    require(value is String)
    return value
}
private fun JSONObject.required(key: String): String = text(key)?.takeIf { it.isNotEmpty() } ?: throw IllegalArgumentException()
private fun JSONObject.boolean(key: String): Boolean? {
    val value = opt(key)
    if (value == null || value == JSONObject.NULL) return null
    require(value is Boolean)
    return value
}
private fun JSONObject.obj(key: String): JSONObject {
    val value = opt(key)
    if (value == null || value == JSONObject.NULL) return JSONObject()
    require(value is JSONObject)
    return value
}
private fun JSONObject.params(key: String): Map<String, Any?> = obj(key).let { value ->
    value.keys().asSequence().associateWith { unwrap(value.get(it)) }
}
private fun unwrap(value: Any?): Any? = when (value) {
    null, JSONObject.NULL -> null
    is JSONObject -> value.keys().asSequence().associateWith { unwrap(value.get(it)) }
    is JSONArray -> (0 until value.length()).map { unwrap(value.get(it)) }
    else -> value
}
private fun status(p: JSONObject, key: String): TrackHubConsentStatus = when (p.text(key)) {
    null, "unknown" -> TrackHubConsentStatus.UNKNOWN
    "granted" -> TrackHubConsentStatus.GRANTED
    "denied" -> TrackHubConsentStatus.DENIED
    else -> throw IllegalArgumentException()
}
private fun googleConsent(p: JSONObject) = TrackHubGoogleAdsConsent(status(p, "adUserData"), status(p, "adPersonalization"), p.boolean("isEea"))
private fun openAiConsent(p: JSONObject) = TrackHubOpenAiAdsConsent(status(p, "measurement"), status(p, "userData"), status(p, "personalization"))
private fun piplConsent(p: JSONObject) = TrackHubPiplConsent(status(p, "personalInformation"), status(p, "crossBorderTransfer"), status(p, "adsMeasurement"))
private fun attribution(value: TrackHubAttribution): JSONObject = JSONObject()
    .put("revision", value.revision).put("status", value.status).put("network", value.network).put("channel", value.channel)
    .put("campaignId", value.campaignId ?: JSONObject.NULL).put("adGroupId", value.adGroupId ?: JSONObject.NULL)
    .put("keywordId", value.keywordId ?: JSONObject.NULL).put("touchpointKind", value.touchpointKind ?: JSONObject.NULL)
    .put("source", value.source ?: JSONObject.NULL).put("data", JSONObject(value.data))
private fun json(value: Any?): String = when (value) {
    null -> "null"
    is String -> JSONObject.quote(value)
    else -> value.toString()
}
