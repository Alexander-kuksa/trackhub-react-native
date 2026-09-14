#import "RCTTrackHub.h"
#if __has_include(<TrackHubReactNative/TrackHubReactNative-Swift.h>)
#import <TrackHubReactNative/TrackHubReactNative-Swift.h>
#else
#import "TrackHubReactNative-Swift.h"
#endif

@implementation RCTTrackHub {
  TRHBridge *_bridge;
}

+ (NSString *)moduleName { return @"NativeTrackHub"; }
+ (BOOL)requiresMainQueueSetup { return YES; }
- (dispatch_queue_t)methodQueue { return dispatch_get_main_queue(); }

- (instancetype)init {
  if ((self = [super init])) {
    __weak RCTTrackHub *weakSelf = self;
    _bridge = [[TRHBridge alloc] initWithEmit:^(NSString *event) {
      [weakSelf emitOnEvent:event];
    }];
  }
  return self;
}

- (void)invoke:(NSString *)operation payload:(NSString *)payload
       resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  [_bridge invoke:operation payload:payload resolve:^(NSString *result) { resolve(result); }
    reject:^(NSString *code, NSString *message) { reject(code, message, nil); }];
}

- (void)invalidate { [_bridge invalidate]; }

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeTrackHubSpecJSI>(params);
}
@end
