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
    let gradle = config.modResults.contents;

    const releaseSigningConfig = `
        release {
            storeFile file(MEUGASTO_STORE_FILE)
            storePassword MEUGASTO_STORE_PASSWORD
            keyAlias MEUGASTO_KEY_ALIAS
            keyPassword MEUGASTO_KEY_PASSWORD
        }`;

    if (gradle.includes('signingConfigs {')) {
      if (!gradle.includes('storeFile file(MEUGASTO_STORE_FILE)')) {
        gradle = gradle.replace(
          /signingConfigs\s*\{/,
          `signingConfigs {${releaseSigningConfig}`
        );
      }
    } else {
      gradle = gradle.replace(
        'buildTypes {',
        `signingConfigs {${releaseSigningConfig}\n    }\n    buildTypes {`
      );
    }

    gradle = gradle.replace(
      /(buildTypes\s*\{[\s\S]*?release\s*\{)([\s\S]*?)(\n\s*})/,
      (_, prefix, body, suffix) => {
        let normalizedBody = body;
        normalizedBody = normalizedBody.replace(
          /^\s*signingConfig\s+signingConfigs\.debug\s*$/m,
          ''
        );
        if (!/signingConfig\s+signingConfigs\.release/.test(normalizedBody)) {
          normalizedBody = `\n            signingConfig signingConfigs.release${normalizedBody}`;
        }
        return `${prefix}${normalizedBody}${suffix}`;
      }
    );

    config.modResults.contents = gradle;
    return config;
  });

  return config;
};

module.exports = withAndroidSigning;
