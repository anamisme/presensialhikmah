/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();

let cachedAccessToken: string | null = null;

const WEB_CLIENT_ID = '146025221328-me5hhrfvtd63p7nrd6pl0mon1inhh360.apps.googleusercontent.com';

// Detect if running in Capacitor (Android/iOS)
const isNativeApp = () => Capacitor.isNativePlatform();

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken || '');
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in with Google
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    if (isNativeApp()) {
      // Native Android/iOS: use Capacitor plugin for native account picker
      const { GoogleSignIn } = await import('@capawesome/capacitor-google-sign-in');
      await GoogleSignIn.initialize({
        clientId: WEB_CLIENT_ID,
        scopes: ['https://www.googleapis.com/auth/userinfo.profile'],
      });

      const result = await GoogleSignIn.signIn();

      if (!result.idToken) {
        throw new Error('No ID token returned from Google Sign-In');
      }

      // Exchange the Google ID token for Firebase Auth
      const credential = GoogleAuthProvider.credential(result.idToken);
      const firebaseResult = await signInWithCredential(auth, credential);
      cachedAccessToken = result.accessToken || '';

      return { user: firebaseResult.user, accessToken: cachedAccessToken };
    }

    // Web browser: popup works fine
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || '';
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  if (isNativeApp()) {
    try {
      const { GoogleSignIn } = await import('@capawesome/capacitor-google-sign-in');
      await GoogleSignIn.signOut();
    } catch (e) {
      // Ignore sign-out errors from the plugin
    }
  }
};

export { isNativeApp };
export { app, auth };
