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
    const saved = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    });
    await Share.share({
      url: saved.uri,
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
