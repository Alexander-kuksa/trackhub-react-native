module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: './android',
        packageImportPath: 'import com.trackhub.reactnative.TrackHubPackage;',
        packageInstance: 'new TrackHubPackage()',
      },
      ios: {},
    },
  },
};
