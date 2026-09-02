/**
 * QR Code Scanner - optimized for fast detection across devices.
 *
 * Strategy:
 *  1. Gunakan BarcodeDetector asli browser (Chrome/Android) PER FRAME TANPA ZXing.
 *     html5-qrcode menyele-selikan BarcodeDetector & ZXing tiap frame, sehingga
 *     ZXing (lambat, berat CPU) tetap jalan bergantian. Dengan memakai
 *     BarcodeDetector murni + getUserMedia langsung, decoding jauh lebih ringan.
 *  2. Bila BarcodeDetector tidak tersedia, fallback ke html5-qrcode.
 *  3. Kamera belakang dipilih eksplisit via deviceId bila tersedia.
 */

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

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

export default function QRScanner({ onScanSuccess, onScanError, isActive }: QRScannerProps) {
  const fallbackScannerRef = useRef<Html5Qrcode | null>(null);
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

  const stopScanner = async () => {
    if (nativeMode && hasNativeBarcodeDetector()) {
      stopNative();
      return;
    }
    const scanner = fallbackScannerRef.current;
    if (scanner) {
      fallbackScannerRef.current = null;
      try {
        await scanner.stop();
        scanner.clear();
      } catch { try { scanner.clear(); } catch {} }
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    const container = document.getElementById(idRef.current);
    // Pada mode native, inject <video> sekali ke dalam kontainer
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
      if (mountedRef.current) startScanner();
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
    processingRef.current = true;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      processingRef.current = false;
      rafRef.current = requestAnimationFrame(processNativeFrame);
      return;
    }
    // decode pada resolusi sedang (lebih ringan & tetap akurat) bila video lebih besar
    const scale = Math.min(1, 1080 / Math.max(video.videoWidth, video.videoHeight));
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
      const msg = err?.message || String(err);
      if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
        setCameraError('Izinkan akses kamera di pengaturan browser.');
      } else if (msg.includes('NotFoundError') || msg.includes('Requested device not found')) {
        setCameraError('Kamera tidak ditemukan.');
      } else if (msg.includes('NotReadableError')) {
        setCameraError('Kamera sedang digunakan aplikasi lain.');
      } else {
        setCameraError(msg);
      }
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

    try {
      const scanner = new Html5Qrcode(idRef.current, {
        verbose: false,
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      });
      fallbackScannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 8,
          videoConstraints: {
            facingMode: "environment",
            width: { ideal: 960 },
            height: { ideal: 720 },
          },
          qrbox: (vw: number, vh: number) => {
            const size = Math.floor(Math.min(vw * 0.6, vh * 0.6, 260));
            return { width: size, height: size };
          },
        },
        (decodedText) => {
          if (!hasScannedRef.current) {
            hasScannedRef.current = true;
            onScanSuccess(decodedText);
            stopScanner();
          }
        },
        () => {}
      );
      if (mountedRef.current) setIsStarting(false);
    } catch (err: any) {
      if (!mountedRef.current) return;
      const msg = err?.message || String(err);
      if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
        setCameraError('Izinkan akses kamera di pengaturan browser.');
      } else if (msg.includes('NotFoundError') || msg.includes('Requested device not found')) {
        setCameraError('Kamera tidak ditemukan.');
      } else if (msg.includes('NotReadableError')) {
        setCameraError('Kamera sedang digunakan aplikasi lain.');
      } else {
        setCameraError(msg);
      }
      try { fallbackScannerRef.current?.clear(); } catch {}
      fallbackScannerRef.current = null;
      if (onScanError) onScanError(msg);
      setIsStarting(false);
    }
  };

  const startScanner = () => {
    if (fallbackScannerRef.current || isStarting) return;
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