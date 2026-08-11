import { Capacitor } from '@capacitor/core';
import { LiveUpdate } from '@capawesome/capacitor-live-update';
import { APP_VERSION } from './version';

const UPDATE_URL = 'https://presensi.yayasanbaitulhikmah.com/update/version.json';

export async function checkForLiveUpdate() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const res = await fetch(UPDATE_URL, { cache: 'no-store' });
    if (!res.ok) return;
    const meta = (await res.json()) as { version: string; url: string };

    if (!meta.version || meta.version === APP_VERSION) return;

    await LiveUpdate.downloadBundle({
      url: meta.url,
      bundleId: meta.version,
    });
    await LiveUpdate.reload();
  } catch (err) {
    console.warn('Live update check failed:', err);
  }
}
