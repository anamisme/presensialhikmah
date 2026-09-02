/**
 * QR Code Scanner - menggunakan `qr-scanner` (WebAssembly) sebagai SATU-SATUNYA
 * mesin untuk kedua platform (Android & iOS).
 *
 * Mengapa tidak pakai BarcodeDetector lagi:
 *  - Di Android WebView, BarcodeDetector memang tersedia tapi `detect()`-nya
 *    lambat & tidak konsisten, sehingga deteksi QR terasa berat/susah tertangkap.
 *  - iOS (WKWebView) tidak punya BarcodeDetector, jadi otomatis memakai
 *    qr-scanner WASM yang justru cepat.
 *  - Dengan memakai qr-scanner di keduanya, perilakunya konsisten & cepat.
 *
 * Anti-race / cleanup:
 *  - Hanya SATU scanner aktif dalam satu waktu; instance lama di-stop & destroy
 *    sebelum membuat yang baru.
 *  - `maxScansPerSecond` membatasi jumlah decode (tidak ada overlap berlebihan).
 *  - Kamera & resource di-stop saat unmount maupun saat isActive berubah.
 */

import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (error: string) => void;
  isActive: boolean;
}

function mapError(err: any): string {
  const msg = err?.message || String(err);
  if (msg.includes('NotAllowedError') || msg.includes('Permission') || msg.includes('NotAllowed')) {
    return 'Izinkan akses kamera di pengaturan browser.';
  }
  if (msg.includes('NotFoundError') || msg.includes('Requested device not found') || msg.includes('No matching device')) {
    return 'Kamera tidak ditemukan.';
  }
  if (msg.includes('NotReadableError') || msg.includes('in use')) {
    return 'Kamera sedang digunakan aplikasi lain.';
  }
  return msg;
}

export default function QRScanner({ onScanSuccess, onScanError, isActive }: QRScannerProps) {
  const qrScannerRef = useRef<QrScanner | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hasScannedRef = useRef(false);
  const mountedRef = useRef(true);
  const onScanSuccessRef = useRef(onScanSuccess);
  onScanSuccessRef.current = onScanSuccess;
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const idRef = useRef('qr-' + Math.random().toString(36).slice(2, 8));

  const stopScanner = async () => {
    const scanner = qrScannerRef.current;
    if (scanner) {
      qrScannerRef.current = null;
      try { scanner.stop(); } catch { /* ignore */ }
      try { scanner.destroy(); } catch { /* ignore */ }
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    const container = document.getElementById(idRef.current);
    // Selalu sediakan <video> untuk qr-scanner.
    if (container && !container.querySelector('video')) {
      const v = document.createElement('video');
      v.setAttribute('playsinline', 'true');
      v.setAttribute('muted', 'true');
      v.autoplay = true;
      v.className = 'w-full h-full object-cover';
      container.appendChild(v);
    }
    return () => {
      mountedRef.current = false;
      stopScanner();
      if (container) {
        const v = container.querySelector('video');
        if (v) (v as HTMLVideoElement).srcObject = null;
        // Hapus tambahan yang dibuat qr-scanner (region/outlines).
        container.querySelectorAll('canvas').forEach((c) => c.remove());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isActive) {
      if (mountedRef.current) {
        // Hentikan scanner lama lalu buka yang baru (single-instance).
        stopScanner().then(() => { if (mountedRef.current) startScanner(); });
      }
      return;
    }
    stopScanner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const startScanner = async () => {
    if (qrScannerRef.current || isStarting) return;
    const container = document.getElementById(idRef.current);
    if (!container) return;
    hasScannedRef.current = false;
    setCameraError(null);
    setIsStarting(true);

    let video = container.querySelector('video') as HTMLVideoElement | null;
    if (!video) {
      const v = document.createElement('video');
      v.setAttribute('playsinline', 'true');
      v.setAttribute('muted', 'true');
      v.autoplay = true;
      v.className = 'w-full h-full object-cover';
      container.appendChild(v);
      video = v;
    }
    videoRef.current = video;

    try {
      const scanner = new QrScanner(
        video,
        (result) => {
          const decodedText = result?.data ?? String(result);
          if (!hasScannedRef.current) {
            hasScannedRef.current = true;
            onScanSuccessRef.current(decodedText);
            stopScanner();
          }
        },
        {
          onDecodeError: () => {},
          // preferredCamera 'environment' -> pakai kamera belakang.
          preferredCamera: "environment",
          maxScansPerSecond: 30,
          highlightScanRegion: true,
          highlightCodeOutline: true,
        }
      );
      qrScannerRef.current = scanner;
      await scanner.start();
      if (mountedRef.current) setIsStarting(false);
    } catch (err: any) {
      if (!mountedRef.current) return;
      const msg = mapError(err);
      setCameraError(msg);
      try { qrScannerRef.current?.destroy(); } catch {}
      qrScannerRef.current = null;
      if (onScanError) onScanError(msg);
      setIsStarting(false);
    }
  };

  return (
    <div className="relative w-full h-full">
      <div id={idRef.current} className="w-full h-full" style={{ minHeight: '250px' }} />

      {cameraError && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6 text-center z-10">
          <p className="text-white text-sm font-bold mb-2">⚠️ Kamera Error</p>
          <p className="text-gray-300 text-xs mb-4">{cameraError}</p>
          <button
            onClick={() => { setCameraError(null); startScanner(); }}
            className="px-4 py-2 bg-white/10 text-white text-xs font-bold rounded-xl"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {isStarting && !cameraError && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-10">
          <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin mb-2" />
          <p className="text-white text-xs">Membuka kamera...</p>
        </div>
      )}
    </div>
  );
}