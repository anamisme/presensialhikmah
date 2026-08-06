import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Download an image from a URL.
 * - Web: triggers a normal browser download.
 * - Capacitor (APK): fetches the image, saves to app cache, then opens the
 *   system share sheet so the user can save/share the file.
 */
export async function downloadImage(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Gagal mengunduh gambar (status ${res.status}).`);
  }
  const blob = await res.blob();

  if (Capacitor.isNativePlatform()) {
    const base64 = await blobToBase64(blob);
    await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    });
    const fileUri = await Filesystem.getUri({
      path: filename,
      directory: Directory.Cache,
    });
    await Share.share({
      url: fileUri.uri,
      title: filename,
      dialogTitle: 'Simpan / Bagikan QR Code',
    });
  } else {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Save/download a text file (CSV, TXT, dll).
 * - Web: triggers a normal browser download.
 * - Capacitor (APK): writes to app cache then opens the share sheet so the
 *   user can save/share the file.
 */
export async function saveTextFile(content: string, filename: string, mimeType = 'text/csv'): Promise<void> {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });

  if (Capacitor.isNativePlatform()) {
    const base64 = await blobToBase64(blob);
    await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    });
    const fileUri = await Filesystem.getUri({
      path: filename,
      directory: Directory.Cache,
    });
    await Share.share({
      url: fileUri.uri,
      title: filename,
      dialogTitle: 'Simpan / Bagikan File',
    });
  } else {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}
