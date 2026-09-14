import type {TurboModule, CodegenTypes} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

// JSON is private to the bridge. The public API validates and types every
// operation, including arbitrary JSON event parameters supported by native SDKs.
export interface Spec extends TurboModule {
  invoke(operation: string, payload: string): Promise<string>;
  readonly onEvent: CodegenTypes.EventEmitter<string>;
}

export default TurboModuleRegistry.get<Spec>('NativeTrackHub');
