import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yayasanbaitulhikmah.presensi',
  appName: 'Presensi Al Hikmah',
  webDir: 'dist',
  server: {
    // This makes Firebase Auth popup open in system browser (Chrome)
    // instead of embedded WebView — fixes "disallowed_useragent" error
    androidScheme: 'https',
    hostname: 'presensialhikmah.pages.dev',
    allowNavigation: [
      'presensi-alhikmah.firebaseapp.com',
      'accounts.google.com',
      '*.google.com',
      '*.googleapis.com',
      '*.gstatic.com'
    ]
  },
  plugins: {
    Camera: {},
    Geolocation: {}
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
