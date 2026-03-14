const appJson = require('./app.json');

const getEnvValue = (name) => {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
};

module.exports = () => {
  const config = appJson.expo;

  return {
    ...config,
    extra: {
      ...config.extra,
      supabaseUrl: getEnvValue('EXPO_PUBLIC_SUPABASE_URL'),
      supabaseAnonKey: getEnvValue('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
    },
  };
};
