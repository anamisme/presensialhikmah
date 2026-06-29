import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yayasanbaitulhikmah.presensi',
  appName: 'Presensi Al Hikmah',
  webDir: 'dist',
  server: {
    // Allow navigation to Firebase auth domain for Google Sign-In
    allowNavigation: [
      'presensi-alhikmah.firebaseapp.com',
      'accounts.google.com',
      '*.google.com',
      '*.googleapis.com'
    ]
  },
  plugins: {
    Camera: {
      // Use native camera for photo upload
    },
    Geolocation: {
      // High accuracy GPS
    }
  },
  android: {
    // Allow mixed content for API calls
    allowMixedContent: true
  }
};

export default config;
