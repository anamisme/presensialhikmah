/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Google Apps Script webhook URL for auto-sync attendance
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbweDY3knm4kaY22-4vFMxJqv_XoidELSbqXdh7i8PDMOJtzYuQEhs40EDYF8Drk-C4d/exec';

/**
 * Send attendance data to Google Sheets via Apps Script webhook.
 * No token needed - always works regardless of session state.
 */
export async function syncAttendanceToSheet(record: {
  tanggal: string;
  nama: string;
  jabatan?: string;
  lembaga?: string;
  masuk: string;
  keluar?: string;
  status: string;
  lokasi?: string;
  keterangan?: string;
}): Promise<boolean> {
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(record),
    });
    return res.ok;
  } catch (err) {
    console.error('Sync to Sheets failed:', err);
    return false;
  }
}
