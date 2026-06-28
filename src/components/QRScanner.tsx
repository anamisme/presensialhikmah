/**
 * Real QR Code Scanner component using html5-qrcode library.
 * Accesses the device camera and scans QR codes in real-time.
 */

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (error: string) => void;
  isActive: boolean;
  scanMethod: 'qr' | 'wajah';
}

export default function QRScanner({ onScanSuccess, onScanError, isActive, scanMethod }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const hasScannedRef = useRef(false);
  const mountedRef = useRef(true);
  const containerId = 'qr-reader-' + useRef(Math.random().toString(36).slice(2)).current;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopScanner();
    };
  }, []);

  useEffect(() => {
    if (isActive) {
      // Small delay to ensure DOM element is rendered
      const timer = setTimeout(() => {
        if (mountedRef.current) {
          startScanner();
        }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      stopScanner();
    }
  }, [isActive, scanMethod]);

  const startScanner = async () => {
    if (scannerRef.current || isStarting) return;
    
    // Check if container exists in DOM
    const container = document.getElementById(containerId);
    if (!container) {
      console.error('QR Scanner container not found:', containerId);
      return;
    }

    setIsStarting(true);
    setCameraError(null);
    hasScannedRef.current = false;

    try {
      const scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;

      // Use facingMode constraint instead of enumerating cameras
      // This is more reliable on mobile devices
      const cameraConfig = scanMethod === 'qr' 
        ? { facingMode: "environment" }  // Back camera
        : { facingMode: "user" };         // Front camera

      await scanner.start(
        cameraConfig,
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          if (!hasScannedRef.current) {
            hasScannedRef.current = true;
            onScanSuccess(decodedText);
            setTimeout(() => stopScanner(), 300);
          }
        },
        () => {
          // QR code not found in frame - normal, ignore
        }
      );

      if (mountedRef.current) {
        setIsStarting(false);
      }
    } catch (err: any) {
      console.error('Camera start error:', err);
      
      if (!mountedRef.current) return;
      
      const errorMsg = err?.message || String(err);
      
      if (errorMsg.includes('NotAllowedError') || errorMsg.includes('Permission')) {
        setCameraError('Akses kamera ditolak. Silakan izinkan akses kamera di pengaturan browser.');
      } else if (errorMsg.includes('NotFoundError') || errorMsg.includes('Requested device not found')) {
        setCameraError('Kamera tidak ditemukan. Pastikan perangkat memiliki kamera.');
      } else if (errorMsg.includes('NotReadableError') || errorMsg.includes('Could not start video source')) {
        setCameraError('Kamera sedang digunakan oleh aplikasi lain.');
      } else if (errorMsg.includes('OverconstrainedError')) {
        // Fallback: try without specific facing mode
        try {
          await scannerRef.current?.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 220, height: 220 } },
            (decodedText) => {
              if (!hasScannedRef.current) {
                hasScannedRef.current = true;
                onScanSuccess(decodedText);
                setTimeout(() => stopScanner(), 300);
              }
            },
            () => {}
          );
        } catch {
          setCameraError('Gagal mengakses kamera. Coba gunakan browser Chrome.');
        }
      } else {
        setCameraError(`Gagal mengakses kamera: ${errorMsg}`);
      }
      
      if (onScanError) onScanError(errorMsg);
      setIsStarting(false);
    }
  };

  const stopScanner = async () => {
    const scanner = scannerRef.current;
    if (scanner) {
      scannerRef.current = null;
      try {
        const state = scanner.getState();
        if (state === Html5QrcodeScannerState.SCANNING) {
          await scanner.stop();
        }
        scanner.clear();
      } catch (e) {
        // Ignore stop errors
        try { scanner.clear(); } catch {}
      }
    }
  };

  return (
    <div className="relative w-full h-full">
      {/* Scanner container - html5-qrcode renders video here */}
      <div 
        id={containerId} 
        className="w-full h-full overflow-hidden"
        style={{ minHeight: '300px' }}
      />

      {/* Camera error overlay */}
      {cameraError && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6 text-center rounded-3xl z-10">
          <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-white text-sm font-bold mb-2">Kamera Tidak Tersedia</p>
          <p className="text-gray-300 text-xs leading-relaxed max-w-[280px]">{cameraError}</p>
          <button 
            onClick={() => { setCameraError(null); setTimeout(() => startScanner(), 200); }}
            className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-all"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Starting overlay */}
      {isStarting && !cameraError && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center rounded-3xl z-10">
          <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-white text-xs font-semibold">Mengaktifkan kamera...</p>
        </div>
      )}
    </div>
  );
}
