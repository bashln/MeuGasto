const { expo } = require('./app.json');

module.exports = () => ({
  ...expo,
  extra: {
    ...expo.extra,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? null,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? null,
  },
});
