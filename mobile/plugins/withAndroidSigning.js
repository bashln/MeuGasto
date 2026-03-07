const { withAppBuildGradle, withGradleProperties } = require('@expo/config-plugins');

const withAndroidSigning = (config) => {
  config = withGradleProperties(config, (config) => {
    const props = config.modResults;
    props.push({ type: 'property', key: 'MEUGASTO_STORE_FILE', value: process.env.ANDROID_KEYSTORE_FILE || '' });
    props.push({ type: 'property', key: 'MEUGASTO_STORE_PASSWORD', value: process.env.ANDROID_KEYSTORE_PASSWORD || '' });
    props.push({ type: 'property', key: 'MEUGASTO_KEY_ALIAS', value: process.env.ANDROID_KEY_ALIAS || '' });
    props.push({ type: 'property', key: 'MEUGASTO_KEY_PASSWORD', value: process.env.ANDROID_KEY_PASSWORD || '' });
    return config;
  });

  config = withAppBuildGradle(config, (config) => {
    const gradle = config.modResults.contents;
    if (gradle.includes('MEUGASTO_STORE_FILE')) return config; // idempotente

    const signingConfig = `
    signingConfigs {
        release {
            storeFile file(MEUGASTO_STORE_FILE)
            storePassword MEUGASTO_STORE_PASSWORD
            keyAlias MEUGASTO_KEY_ALIAS
            keyPassword MEUGASTO_KEY_PASSWORD
        }
    }`;

    config.modResults.contents = gradle
      .replace('buildTypes {', signingConfig + '\n    buildTypes {')
      .replace(
        /release \{([^}]*)\}/,
        (match) => match.includes('signingConfig') ? match :
          match.replace('{', '{\n            signingConfig signingConfigs.release')
      );
    return config;
  });

  return config;
};

module.exports = withAndroidSigning;
