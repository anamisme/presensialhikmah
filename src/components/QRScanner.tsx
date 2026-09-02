/**
 * QR Code Scanner - optimized for fast detection across devices.
 *
 * Strategy:
 *  1. Gunakan BarcodeDetector asli browser (Chromium/Android WebView) PER FRAME
 *     TANPA ZXing. Native API jauh lebih ringan & cepat, dan bebas race karena
 *     setiap frame menunggu decode selesai (processNativeFrame guard).
 *  2. Bila BarcodeDetector tidak tersedia (mis. WKWebView iOS), fallback ke
 *     `qr-scanner` (berbasis WebAssembly) — pengganti ZXing yang lebih cepat.
 *  3. Kamera belakang dipilih eksplisit via deviceId bila tersedia.
 *
 * Catatan anti-race / cleanup:
 *  - Hanya SATU scanner aktif dalam satu waktu. Sebelum membuat instance baru,
 *    scanner lama (native / fallback) di-stop & destroy lebih dulu.
 *  - Tidak ada decode yang tumpang-tindih: mode native memakai flag
 *    `processingRef`, sedangkan qr-scanner maksimal `maxScansPerSecond` scan/detik.
 *  - Kamera & resource di-stop saat komponen unmount maupun saat isActive berubah.
 */

import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (error: string) => void;
  isActive: boolean;
}

let detectorInstance: { detect: (s: CanvasImageSource) => Promise<Array<{ rawValue?: string }>> } | null = null;

function hasNativeBarcodeDetector(): boolean {
  return typeof window !== 'undefined' && ('BarcodeDetector' in window);
}

async function getBackCameraId(): Promise<string | null> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const video = devices.filter(d => d.kind === 'videoinput');
    if (!video.length) return null;
    const back = video.find(d => /back|rear|environment/i.test(d.label));
    return back ? back.deviceId : video[0].deviceId;
  } catch {
    return null;
  }
}

async function getSupportedFormats(): Promise<string[]> {
  try {
    const BT = (window as unknown as Record<string, never>).BarcodeDetector as {
      getSupportedFormats?: () => Promise<string[]>;
    };
    if (BT?.getSupportedFormats) {
      const formats = await BT.getSupportedFormats();
      if (formats.includes('qr_code')) return formats;
    }
  } catch { /* ignore */ }
  return ['qr_code'];
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
  const nativeDetectorRef = useRef<{ detect: (s: CanvasImageSource) => Promise<Array<{ rawValue?: string }>> } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const processingRef = useRef(false);
  const hasScannedRef = useRef(false);
  const mountedRef = useRef(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const idRef = useRef('qr-' + Math.random().toString(36).slice(2, 8));
  const nativeMode = hasNativeBarcodeDetector();

  const stopNative = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    processingRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    videoRef.current = null;
  };

  const stopFallback = async () => {
    const scanner = qrScannerRef.current;
    if (scanner) {
      qrScannerRef.current = null;
      try {
        scanner.stop();
      } catch { /* ignore */ }
      scanner.destroy();
    }
  };

  const stopScanner = async () => {
    // Selalu stop & destroy scanner lama (fallback qr-scanner ATAU native)
    // sebelum membuat instance baru, agar hanya 1 scanner aktif.
    if (qrScannerRef.current) await stopFallback();
    if (nativeMode && hasNativeBarcodeDetector()) stopNative();
  };

  useEffect(() => {
    mountedRef.current = true;
    const container = document.getElementById(idRef.current);
    // Pada mode native, inject <video> sekali ke dalam kontainer.
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
        const c = container.querySelector('canvas');
        if (c) c.remove();
        const v = container.querySelector('video');
        if (v) (v as HTMLVideoElement).srcObject = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isActive) {
      if (mountedRef.current) {
        // Hentikan scanner aktif apa pun lalu buka yang baru.
        stopScanner().then(() => { if (mountedRef.current) startScanner(); });
      }
      return;
    }
    stopScanner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, nativeMode]);

  const processNativeFrame = () => {
    if (!mountedRef.current) return;
    if (hasScannedRef.current) return;
    const video = videoRef.current;
    let canvas = canvasRef.current;
    const detector = nativeDetectorRef.current;
    if (!video || !detector || processingRef.current) {
      rafRef.current = requestAnimationFrame(processNativeFrame);
      return;
    }
    if (!video.videoWidth || !video.readyState) {
      rafRef.current = requestAnimationFrame(processNativeFrame);
      return;
    }
    if (!canvas) {
      const container = document.getElementById(idRef.current);
      if (!container) return;
      canvas = document.createElement('canvas');
      canvas.className = 'w-full h-full object-cover';
      container.appendChild(canvas);
      canvasRef.current = canvas;
    }
    // Guard anti race: decode sebelumnya harus selesai dulu sebelum frame berikutnya.
    processingRef.current = true;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      processingRef.current = false;
      rafRef.current = requestAnimationFrame(processNativeFrame);
      return;
    }
    // Decode pada resolusi tinggi (bila video > 1280) supaya QR kecil/jauh/miring
    // tetap terdeteksi. Resolusi yang terlalu rendah membuat QR susah tertangkap
    // dan terasa "tidak responsif" karena harus dekat & diam lama.
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    detector.detect(canvas)
      .then((codes) => {
        if (!mountedRef.current) return;
        const text = codes.find(c => c.rawValue)?.rawValue;
        if (text && !hasScannedRef.current) {
          hasScannedRef.current = true;
          stopNative();
          onScanSuccess(text);
          return;
        }
        processingRef.current = false;
        rafRef.current = requestAnimationFrame(processNativeFrame);
      })
      .catch(() => {
        processingRef.current = false;
        rafRef.current = requestAnimationFrame(processNativeFrame);
      });
  };

  const startNativeScanner = async () => {
    setCameraError(null);
    setIsStarting(true);
    const cameraId = await getBackCameraId();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          deviceId: cameraId ? { exact: cameraId } : undefined,
          facingMode: cameraId ? undefined : { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;

      const formats = await getSupportedFormats();
      if (!detectorInstance) {
        const BT = (window as unknown as Record<string, never>).BarcodeDetector as new (o?: { formats?: string[] }) => {
          detect: (s: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>;
        };
        detectorInstance = new BT({ formats });
      }
      nativeDetectorRef.current = detectorInstance;

      const container = document.getElementById(idRef.current);
      let video = container?.querySelector('video') as HTMLVideoElement | null;
      if (!video || !container) { throw new Error('No video container'); }
      video.srcObject = stream;
      videoRef.current = video;

      await video.play().catch(() => {});
    } catch (err: any) {
      if (!mountedRef.current) return;
      const msg = mapError(err);
      setCameraError(msg);
      if (onScanError) onScanError(msg);
      setIsStarting(false);
      return;
    }
    setIsStarting(false);
    rafRef.current = requestAnimationFrame(processNativeFrame);
  };

  const startFallbackScanner = async () => {
    setCameraError(null);
    setIsStarting(true);
    const container = document.getElementById(idRef.current);
    if (!container) { setIsStarting(false); return; }

    let video = container.querySelector('video') as HTMLVideoElement | null;
    if (!video) {
      video = document.createElement('video');
      video.setAttribute('playsinline', 'true');
      video.setAttribute('muted', 'true');
      video.autoplay = true;
      video.className = 'w-full h-full object-cover';
      container.appendChild(video);
    }

    try {
      const scanner = new QrScanner(
        video,
        (result) => {
          const decodedText = result?.data ?? String(result);
          if (!hasScannedRef.current) {
            hasScannedRef.current = true;
            onScanSuccess(decodedText);
            stopScanner();
          }
        },
        {
          onDecodeError: () => {},
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

  const startScanner = async () => {
    if (qrScannerRef.current || isStarting) return;
    const container = document.getElementById(idRef.current);
    if (!container) return;
    hasScannedRef.current = false;
    if (nativeMode && hasNativeBarcodeDetector()) {
      startNativeScanner();
    } else {
      startFallbackScanner();
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