/**
 * QR Code Scanner - optimized for fast detection
 */

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (error: string) => void;
  isActive: boolean;
}

export default function QRScanner({ onScanSuccess, onScanError, isActive }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const hasScannedRef = useRef(false);
  const mountedRef = useRef(true);
  const idRef = useRef('qr-' + Math.random().toString(36).slice(2, 8));

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopScanner();
    };
  }, []);

  useEffect(() => {
    if (isActive) {
      if (mountedRef.current) startScanner();
      return;
    } else {
      stopScanner();
    }
  }, [isActive]);

  const startScanner = async () => {
    if (scannerRef.current || isStarting) return;
    
    const container = document.getElementById(idRef.current);
    if (!container) return;

    setIsStarting(true);
    setCameraError(null);
    hasScannedRef.current = false;

    try {
      const scanner = new Html5Qrcode(idRef.current);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 30,
          videoConstraints: {
            facingMode: "environment",
            width: { min: 480, ideal: 1280, max: 1920 },
            height: { min: 360, ideal: 720, max: 1080 },
            aspectRatio: { ideal: 1 }
          },
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          if (!hasScannedRef.current) {
            hasScannedRef.current = true;
            onScanSuccess(decodedText);
            stopScanner();
          }
        },
        () => {} // ignore not-found frames
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
        setCameraError('Gagal mengakses kamera.');
      }
      
      if (onScanError) onScanError(msg);
      setIsStarting(false);
    }
  };

  const stopScanner = async () => {
    const scanner = scannerRef.current;
    if (scanner) {
      scannerRef.current = null;
      try {
        await scanner.stop();
        scanner.clear();
      } catch {
        try { scanner.clear(); } catch {}
      }
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
