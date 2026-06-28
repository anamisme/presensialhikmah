/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Employee, AttendanceRecord, Geofence, RecentActivity } from './types';

// Hotlinked Asset URLs
export const ASSETS = {
  genericAvatar: "https://ui-avatars.com/api/?name=User&background=0058bc&color=fff&size=150"
};

// Initial Employees (kosong - akan diisi otomatis saat karyawan login pertama kali)
export const INITIAL_EMPLOYEES: Employee[] = [];

// Initial Geofences
export const INITIAL_GEOFENCES: Geofence[] = [
  {
    id: "geo-1",
    nama: "Rumah",
    lat: -6.932299522617215,
    lng: 109.65582552262504,
    radius: 50
  },
  {
    id: "geo-2",
    nama: "Kantor Yayasan",
    lat: -6.945395233828707,
    lng: 109.63843346975865,
    radius: 100
  }
];

// Initial Attendance History (kosong)
export const INITIAL_ATTENDANCE: AttendanceRecord[] = [];

// Initial Recent Activities (kosong)
export const INITIAL_ACTIVITIES: RecentActivity[] = [];

// LocalStorage Helper functions
export const getStoredData = <T>(key: string, initialValue: T): T => {
  try {
    const item = localStorage.getItem(`baitul_hikmah_${key}`);
    return item ? JSON.parse(item) : initialValue;
  } catch (error) {
    console.error(`Error reading localStorage key "${key}":`, error);
    return initialValue;
  }
};

export const setStoredData = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(`baitul_hikmah_${key}`, JSON.stringify(value));
  } catch (error) {
    console.error(`Error setting localStorage key "${key}":`, error);
  }
};
