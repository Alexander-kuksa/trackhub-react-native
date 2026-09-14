package com.trackhub.reactnative

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class TrackHubPackage : BaseReactPackage() {
    override fun getModule(name: String, context: ReactApplicationContext): NativeModule? =
        if (name == TrackHubModule.NAME) TrackHubModule(context) else null

    override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
        mapOf(TrackHubModule.NAME to ReactModuleInfo(
            TrackHubModule.NAME, TrackHubModule.NAME, false, false, false, true,
        ))
    }
}
