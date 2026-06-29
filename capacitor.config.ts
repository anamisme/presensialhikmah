import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yayasanbaitulhikmah.presensi',
  appName: 'Presensi Alhikmah',
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
    Geolocation: {},
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#FFFFFF',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashDarkMode: true,
      splashFullScreen: true,
      splashImmersive: false
    }
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
