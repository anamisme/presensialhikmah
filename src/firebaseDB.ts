import { getDatabase, ref, onValue, set, off } from 'firebase/database';
import { app } from './googleAuth';
import { AttendanceRecord } from './types';

const db = getDatabase(app);
const settingsRef = ref(db, 'presensi-settings');

type SettingsCallback = (data: Record<string, unknown>) => void;

let currentCallback: SettingsCallback | null = null;

export const listenSettings = (callback: SettingsCallback) => {
  currentCallback = callback;
  onValue(settingsRef, (snapshot) => {
    // Selalu panggil callback (walau null) supaya UI tahu proses muat sudah selesai.
    callback(snapshot.val() ?? {});
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
    // Tampilkan peringatan agar kegagalan tidak tertelan diam-diam
    alert(`⚠️ Gagal menyinkronkan "${key}" ke server.
Data hanya tersimpan di perangkat ini dan tidak akan terlihat pengguna lain.

Penyebab umum: aturan Firebase (Rules) menolak penulisan, atau koneksi terputus.
Detail: ${err?.message || err}`);
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
    alert(`⚠️ Gagal menyinkronkan absensi ke server.
Data hanya tersimpan offline di perangkat ini.

Penyebab umum: aturan Firebase (Rules) menolak penulisan, atau koneksi terputus.
Detail: ${err?.message || err}`);
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
