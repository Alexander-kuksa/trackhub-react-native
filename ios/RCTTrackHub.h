// Swift's underlying-module import must not parse React's C++ Codegen headers.
// Only the Objective-C++ TurboModule adapter needs this declaration.
#ifdef __cplusplus
#import <TrackHubReactNativeSpec/TrackHubReactNativeSpec.h>

@interface RCTTrackHub : NativeTrackHubSpecBase <NativeTrackHubSpec>
@end
#endif
