import React, {useEffect, useState} from 'react';
import {Button, ScrollView, Text, TextInput} from 'react-native';
import Daively from '@daively/react-native';

export default function App() {
  const [key, setKey] = useState('');
  const [status, setStatus] = useState('Loading native SDK…');
  const [started, setStarted] = useState(false);
  useEffect(() => {
    void Daively.getVersions().then(value => setStatus(JSON.stringify(value))).catch(error => setStatus(error.message));
    const failure = Daively.onDeliveryFailure(() => setStatus('SDK credentials rejected. Update the SDK Key and restart.'));
    const attribution = Daively.onAttributionChanged(value => setStatus(`Attribution: ${value.network}`));
    return () => {failure.remove(); attribution.remove();};
  }, []);
  async function start() {
    try {
      await Daively.start({
        sdkKey: key,
        googleAdsConsent: {adUserData: 'unknown', adPersonalization: 'unknown'},
        openAiAdsConsent: {measurement: 'unknown', userData: 'unknown', personalization: 'unknown'},
        ios: {appleAttributionMode: 'active', googleOnDeviceMeasurement: false},
      }, {
        linking: 'automatic',
        onLinkError: () => setStatus('Initial/click link unavailable. Verify the real advertising flow before launch.'),
      });
      setStarted(true);
      setStatus('Native initialization requested. Verify delivery in Daively Test Lab.');
    } catch {setStatus('Check the SDK Key and native integration.');}
  }
  return <ScrollView contentContainerStyle={{padding: 24, paddingTop: 80, gap: 16}}>
    <Text style={{fontSize: 24}}>Daively React Native</Text>
    <Text>{status}</Text>
    <TextInput secureTextEntry autoCapitalize="none" autoCorrect={false} placeholder="App-specific SDK Key"
      value={key} onChangeText={setKey} style={{borderWidth: 1, padding: 12}} />
    <Button title="Start" onPress={() => void start()} />
    <Button title="Report paywall" disabled={!started} onPress={() => void Daively.trackPaywallShown('inapp_placement')
      .then(() => setStatus('Paywall event dispatched.')).catch(() => setStatus('Could not dispatch event.'))} />
    <Button title="Request privacy erasure" onPress={() => void Daively.gdprForgetMe()
      .then(() => {setStarted(false); setStatus('Tracking stopped; erasure queued.');})
      .catch(() => setStatus('Could not request erasure. Check the native integration.'))} />
  </ScrollView>;
}
