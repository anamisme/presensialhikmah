import { getDatabase, ref, onValue, set, off } from 'firebase/database';
import { app } from './googleAuth';
import { setStoredData } from './data';

const db = getDatabase(app);
const settingsRef = ref(db, 'presensi-settings');

type SettingsCallback = (data: Record<string, unknown>) => void;

let currentCallback: SettingsCallback | null = null;

export const listenSettings = (callback: SettingsCallback) => {
  currentCallback = callback;
  onValue(settingsRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      callback(data);
    }
  });
};

export const stopListening = () => {
  off(settingsRef);
  currentCallback = null;
};

export const saveSetting = (key: string, value: unknown) => {
  const settingRef = ref(db, `presensi-settings/${key}`);
  return set(settingRef, value);
};

export const saveAllSettings = (settings: Record<string, unknown>) => {
  return set(settingsRef, settings);
};
