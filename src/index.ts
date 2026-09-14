import {Linking} from 'react-native';
import NativeTrackHub from './specs/NativeTrackHub';
import {createTrackHub} from './core';
export type * from './types';
export const TrackHub = createTrackHub(() => NativeTrackHub ?? null, Linking);
export default TrackHub;
