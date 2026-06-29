/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();

let cachedAccessToken: string | null = null;

// Initialize auth state listener — handles redirect result on return
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  getRedirectResult(auth).then((result) => {
    if (result) {
      const credential = GoogleAuthProvider.credentialFromResult(result);
      cachedAccessToken = credential?.accessToken || '';
      if (onAuthSuccess) onAuthSuccess(result.user, cachedAccessToken);
    }
  }).catch(() => {
    if (onAuthFailure) onAuthFailure();
  });

  return onAuthStateChanged(auth, (user: User | null) => {
    if (user && cachedAccessToken !== null) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else if (!user) {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in with Google — uses redirect (compatible with Capacitor WebView)
export const googleSignIn = async (): Promise<void> => {
  try {
    cachedAccessToken = null;
    await signInWithRedirect(auth, provider);
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
};
