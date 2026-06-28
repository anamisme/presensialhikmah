/**
 * Real QR Code Scanner component using html5-qrcode library.
 * Accesses the device camera and scans QR codes in real-time.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (error: string) => void;
  isActive: boolean;
  scanMethod: 'qr' | 'wajah';
}

export default function QRScanner({ onScanSuccess, onScanError, isActive, scanMethod }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const hasScannedRef = useRef(false);

  useEffect(() => {
    if (!isActive) {
      stopScanner();
      return;
    }

    startScanner();

    return () => {
      stopScanner();
    };
  }, [isActive, scanMethod]);

  const startScanner = async () => {
    if (scannerRef.current || isStarting) return;
    
    setIsStarting(true);
    setCameraError(null);
    hasScannedRef.current = false;

    try {
      const scanner = new Html5Qrcode('qr-reader-container');
      scannerRef.current = scanner;

      const cameras = await Html5Qrcode.getCameras();
      if (!cameras || cameras.length === 0) {
        setCameraError('Tidak ada kamera yang ditemukan di perangkat ini.');
        setIsStarting(false);
        return;
      }

      // Prefer back camera for QR, front camera for face
      let cameraId = cameras[0].id;
      if (scanMethod === 'qr') {
        const backCamera = cameras.find(c => 
          c.label.toLowerCase().includes('back') || 
          c.label.toLowerCase().includes('rear') ||
          c.label.toLowerCase().includes('environment')
        );
        if (backCamera) cameraId = backCamera.id;
      } else {
        const frontCamera = cameras.find(c => 
          c.label.toLowerCase().includes('front') || 
          c.label.toLowerCase().includes('user') ||
          c.label.toLowerCase().includes('facetime')
        );
        if (frontCamera) cameraId = frontCamera.id;
      }

      await scanner.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          if (!hasScannedRef.current) {
            hasScannedRef.current = true;
            onScanSuccess(decodedText);
            // Stop scanner after successful scan
            setTimeout(() => stopScanner(), 500);
          }
        },
        () => {
          // QR code not found in frame - this is normal, ignore
        }
      );
    } catch (err: any) {
      console.error('Camera start error:', err);
      const errorMsg = err?.message || String(err);
      
      if (errorMsg.includes('NotAllowedError') || errorMsg.includes('Permission')) {
        setCameraError('Akses kamera ditolak. Silakan izinkan akses kamera di pengaturan browser Anda.');
      } else if (errorMsg.includes('NotFoundError')) {
        setCameraError('Kamera tidak ditemukan di perangkat ini.');
      } else if (errorMsg.includes('NotReadableError')) {
        setCameraError('Kamera sedang digunakan oleh aplikasi lain.');
      } else {
        setCameraError(`Gagal mengakses kamera: ${errorMsg}`);
      }
      
      if (onScanError) onScanError(errorMsg);
    } finally {
      setIsStarting(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) { // SCANNING state
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        // Ignore stop errors
      }
      scannerRef.current = null;
    }
  };

  return (
    <div className="relative w-full h-full" ref={containerRef}>
      {/* Scanner container - html5-qrcode renders video here */}
      <div 
        id="qr-reader-container" 
        className="w-full h-full overflow-hidden rounded-3xl"
        style={{ minHeight: '300px' }}
      />

      {/* Camera error overlay */}
      {cameraError && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6 text-center rounded-3xl">
          <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-white text-sm font-bold mb-2">Kamera Tidak Tersedia</p>
          <p className="text-gray-300 text-xs leading-relaxed max-w-[280px]">{cameraError}</p>
          <button 
            onClick={() => { setCameraError(null); startScanner(); }}
            className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-all"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Starting overlay */}
      {isStarting && !cameraError && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center rounded-3xl">
          <div className="w-10 h-10 border-3 border-white border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-white text-xs font-semibold">Mengaktifkan kamera...</p>
        </div>
      )}
    </div>
  );
}
