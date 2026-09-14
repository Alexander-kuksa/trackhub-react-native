require 'json'
package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name = 'TrackHubReactNative'
  s.version = package['version']
  s.summary = package['description']
  s.homepage = 'https://github.com/Alexander-kuksa/trackhub-react-native'
  s.license = { :type => 'MIT', :file => 'LICENSE' }
  s.author = 'TrackHub'
  s.source = { :git => 'https://github.com/Alexander-kuksa/trackhub-react-native.git', :tag => s.version.to_s }
  s.platforms = { :ios => min_ios_version_supported }
  s.source_files = 'ios/**/*.{h,m,mm,swift}'
  s.public_header_files = 'ios/RCTTrackHub.h'
  s.swift_version = '5.9'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  install_modules_dependencies(s)
  spm_dependency(s,
    url: 'https://github.com/Alexander-kuksa/trackhub-sdk.git',
    requirement: {kind: 'exactVersion', version: '3.1.4'},
    products: ['TrackHub', 'TrackHubGoogleODM'])
end
