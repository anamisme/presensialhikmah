/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Employee {
  nip: string;
  nama: string;
  jabatan: string;
  lembaga: string;
  foto: string;
  email?: string;
  profileCompleted?: boolean;
}

export interface AttendanceRecord {
  id: string;
  nip: string;
  nama: string;
  foto: string;
  tanggal: string; // formats "YYYY-MM-DD"
  masuk: string;   // format "HH:MM"
  keluar?: string;  // format "HH:MM"
  status: 'Tepat Waktu' | 'Terlambat' | 'Alpa' | 'Izin';
  lokasi?: string;  // geofence name or "Izin"
  keterangan?: string; // reason for permit
  lampiran?: string; // base64 or photo URL for permit proof
  sesi?: 'siang' | 'malam'; // attendance session
  izinMulai?: string; // partial permit start "HH:MM" (izin sebagian hari)
  izinSelesai?: string; // partial permit end "HH:MM"
}

export interface Geofence {
  id: string;
  nama: string;
  lat: number;
  lng: number;
  radius: number; // in meters
}

export interface RecentActivity {
  id: string;
  nip: string;
  nama: string;
  tipe: 'masuk' | 'keluar' | 'tambah';
  waktu: string; // e.g., "5 menit yang lalu", "1 jam yang lalu", etc.
  keterangan: string;
}

export interface SystemSettings {
  batasMasuk: string; // e.g. "07:00"
  geofences: Geofence[];
}
