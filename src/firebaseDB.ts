import { getDatabase, ref, onValue, set, off } from 'firebase/database';
import { app } from './googleAuth';
import { setStoredData } from './data';
import { AttendanceRecord } from './types';

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
  return set(settingRef, value).catch((err) => {
    console.error(`Gagal menyimpan setting "${key}" ke Firebase:`, err);
    throw err;
  });
};

// --- Attendance (disimpan per NIP karyawan) ---

const attendanceBase = () => ref(db, 'presensi-settings/attendance');

export const listenOwnAttendance = (
  nip: string,
  callback: (records: AttendanceRecord[]) => void
) => {
  return onValue(ref(db, `presensi-settings/attendance/${nip}`), (snapshot) => {
    const val = snapshot.val();
    callback(Array.isArray(val) ? val : []);
  });
};

export const listenAllAttendance = (callback: (records: AttendanceRecord[]) => void) => {
  return onValue(attendanceBase(), (snapshot) => {
    const val = snapshot.val();
    if (Array.isArray(val)) {
      // Legacy: data lama berbentuk array flat
      callback(val);
      return;
    }
    const map = (val as Record<string, AttendanceRecord[]> | null) ?? {};
    const all = Object.values(map).flat();
    all.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
    callback(all);
  });
};

export const saveOwnAttendance = (nip: string, records: AttendanceRecord[]) => {
  return set(ref(db, `presensi-settings/attendance/${nip}`), records).catch((err) => {
    console.error(`Gagal menyimpan absensi NIP ${nip} ke Firebase:`, err);
    throw err;
  });
};

export const saveAttendanceByNip = (records: AttendanceRecord[]) => {
  const byNip: Record<string, AttendanceRecord[]> = {};
  for (const r of records) {
    if (!byNip[r.nip]) byNip[r.nip] = [];
    byNip[r.nip].push(r);
  }
  return Promise.all(Object.entries(byNip).map(([nip, recs]) => saveOwnAttendance(nip, recs)));
};
