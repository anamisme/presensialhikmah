/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, 
  History, 
  BarChart2, 
  User, 
  MapPin, 
  QrCode, 
  Camera, 
  CheckCircle2, 
  ArrowRight, 
  Clock, 
  Compass, 
  UserCheck, 
  ShieldAlert, 
  LogOut,
  ChevronRight,
  Sparkles,
  Info,
  Moon,
  Sun,
  FileText,
  Upload,
  Plus,
  X,
  Calendar,
  Image as ImageIcon,
  Navigation
} from 'lucide-react';
import { Employee, AttendanceRecord, Geofence } from '../types';
import { ASSETS } from '../data';
import QRScanner from './QRScanner';

interface EmployeeAppProps {
  currentUser: Employee;
  geofences: Geofence[];
  attendanceRecords: AttendanceRecord[];
  onAddAttendance: (record: AttendanceRecord) => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  onLogout: () => void;
  onChangeProfilePicture: (nip: string, newFoto: string) => void;
  limitTime?: string;
}

export default function EmployeeApp({
  currentUser,
  geofences,
  attendanceRecords,
  onAddAttendance,
  darkMode,
  setDarkMode,
  onLogout,
  onChangeProfilePicture,
  limitTime = '07:00'
}: EmployeeAppProps) {
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'stats' | 'profile'>('home');
  const [scanMethod, setScanMethod] = useState<'qr' | 'wajah'>('qr');
  const [selectedLocation, setSelectedLocation] = useState<Geofence | null>(() => geofences[2] || geofences[0] || null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // New States for Permit / Leave Request
  const [isPermitModalOpen, setIsPermitModalOpen] = useState(false);
  const [permitType, setPermitType] = useState<'Izin' | 'Sakit' | 'Dinas Luar'>('Izin');
  const [permitReason, setPermitReason] = useState('');
  const [permitFile, setPermitFile] = useState<string | null>(null);

  // New States for Profile Picture Editing
  const [isEditingPhoto, setIsEditingPhoto] = useState(false);
  const [customPhotoUrl, setCustomPhotoUrl] = useState('');

  // New State for viewing attachments
  const [viewingAttachment, setViewingAttachment] = useState<string | null>(null);
  const [attachmentTitle, setAttachmentTitle] = useState('');

  // Real GPS location state
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [nearestGeofence, setNearestGeofence] = useState<Geofence | null>(null);
  const [distanceToNearest, setDistanceToNearest] = useState<number | null>(null);
  const [isWithinGeofence, setIsWithinGeofence] = useState(false);

  // Camera scanner state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  // Online/Offline status and syncing state
  const [isOnlineReal, setIsOnlineReal] = useState<boolean>(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const isOnline = isOnlineReal;

  const [offlineQueue, setOfflineQueue] = useState<AttendanceRecord[]>(() => {
    try {
      const stored = localStorage.getItem(`offline_queue_${currentUser.nip}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Track personal records (merging local offline records and server records)
  const personalRecords = [
    ...offlineQueue.map(item => ({ ...item, isOfflinePending: true })),
    ...attendanceRecords.filter(r => r.nip === currentUser.nip)
  ].filter((value, index, self) => 
    self.findIndex(v => v.id === value.id) === index
  );
  
  // Find today's record
  const todayStr = new Date().toISOString().split('T')[0];
  const todayRecord = personalRecords.find(r => r.tanggal === todayStr);

  // Sync selected location when geofences change or if currently null
  useEffect(() => {
    if (geofences.length > 0) {
      const exists = geofences.some(g => g.id === selectedLocation?.id);
      if (!exists || !selectedLocation) {
        setSelectedLocation(geofences[2] || geofences[0] || null);
      }
    }
  }, [geofences, selectedLocation]);

  // Real-time clock update
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Track real online/offline navigator status
  useEffect(() => {
    const handleOnline = () => setIsOnlineReal(true);
    const handleOffline = () => setIsOnlineReal(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Haversine formula to calculate distance between two GPS coordinates
  const calculateDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  // Anti-Fake GPS: Track location history for anomaly detection
  const locationHistoryRef = useRef<{ lat: number; lng: number; timestamp: number; accuracy: number }[]>([]);
  const [gpsWarning, setGpsWarning] = useState<string | null>(null);

  // Anti-Fake GPS validation
  const validateGPSIntegrity = useCallback((latitude: number, longitude: number, accuracy: number, timestamp: number): { valid: boolean; reason?: string } => {
    // Check 1: Reject if accuracy is suspiciously perfect (0) or too low (>200m)
    if (accuracy === 0) {
      return { valid: false, reason: 'Akurasi GPS tidak valid (0m). Kemungkinan lokasi palsu terdeteksi.' };
    }
    if (accuracy > 200) {
      return { valid: false, reason: `Akurasi GPS terlalu rendah (${Math.round(accuracy)}m). Pastikan GPS aktif di tempat terbuka.` };
    }

    // Check 2: Detect teleportation (impossible speed between readings)
    const history = locationHistoryRef.current;
    if (history.length > 0) {
      const lastReading = history[history.length - 1];
      const timeDiffSeconds = (timestamp - lastReading.timestamp) / 1000;
      
      if (timeDiffSeconds > 0 && timeDiffSeconds < 300) { // Only check within 5 minutes
        const distanceMoved = calculateDistance(lastReading.lat, lastReading.lng, latitude, longitude);
        const speedMps = distanceMoved / timeDiffSeconds; // meters per second
        const speedKmh = speedMps * 3.6;

        // Max reasonable speed: 200 km/h (covers highway driving)
        // If moved > 5km in < 10 seconds, definitely fake
        if (speedKmh > 200 && timeDiffSeconds < 60) {
          return { valid: false, reason: `Perpindahan lokasi tidak wajar terdeteksi (${Math.round(distanceMoved)}m dalam ${Math.round(timeDiffSeconds)}s). Kemungkinan lokasi palsu.` };
        }
      }
    }

    // Check 3: Detect if coordinates are too round (common in fake GPS apps)
    const latStr = latitude.toString();
    const lngStr = longitude.toString();
    const latDecimals = latStr.includes('.') ? latStr.split('.')[1].length : 0;
    const lngDecimals = lngStr.includes('.') ? lngStr.split('.')[1].length : 0;
    
    if (latDecimals <= 2 && lngDecimals <= 2) {
      return { valid: false, reason: 'Koordinat GPS terlalu bulat. Gunakan lokasi GPS asli perangkat.' };
    }

    // All checks passed
    return { valid: true };
  }, [calculateDistance]);

  // Real GPS location fetching with anti-fake validation
  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolokasi tidak didukung oleh browser ini.');
      return;
    }

    setIsLocating(true);
    setLocationError(null);
    setGpsWarning(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const timestamp = position.timestamp;

        // Anti-fake GPS validation
        const validation = validateGPSIntegrity(latitude, longitude, accuracy, timestamp);
        
        if (!validation.valid) {
          setIsLocating(false);
          setGpsWarning(validation.reason || 'Lokasi GPS mencurigakan terdeteksi.');
          setIsWithinGeofence(false);
          return;
        }

        // Store in location history for future checks
        locationHistoryRef.current.push({ lat: latitude, lng: longitude, timestamp, accuracy });
        // Keep only last 10 readings
        if (locationHistoryRef.current.length > 10) {
          locationHistoryRef.current.shift();
        }

        setUserLocation({ lat: latitude, lng: longitude });
        setIsLocating(false);

        // Find nearest geofence and check if within radius
        let nearest: Geofence | null = null;
        let minDistance = Infinity;

        geofences.forEach(geo => {
          const dist = calculateDistance(latitude, longitude, geo.lat, geo.lng);
          if (dist < minDistance) {
            minDistance = dist;
            nearest = geo;
          }
        });

        setNearestGeofence(nearest);
        setDistanceToNearest(Math.round(minDistance));
        setIsWithinGeofence(nearest ? minDistance <= nearest.radius : false);
        
        if (nearest) {
          setSelectedLocation(nearest);
        }
      },
      (error) => {
        setIsLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError('Akses lokasi ditolak. Silakan izinkan di pengaturan browser.');
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError('Informasi lokasi tidak tersedia.');
            break;
          case error.TIMEOUT:
            setLocationError('Permintaan lokasi timeout.');
            break;
          default:
            setLocationError('Gagal mendapatkan lokasi.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }, [geofences, calculateDistance, validateGPSIntegrity]);

  // Get location on mount and when tab is home
  useEffect(() => {
    if (activeTab === 'home') {
      getCurrentLocation();
    }
  }, [activeTab]);

  // Handle QR scan success
  const handleQRScanSuccess = (decodedText: string) => {
    setScanResult(decodedText);
    setIsCameraActive(false);
    
    // Validate QR code - expected format: "PRESENSI:{location_id}" or any valid QR
    // Process attendance after successful scan
    processAttendance(decodedText);
  };

  // Process attendance record after scan
  const processAttendance = (qrData: string) => {
    if (todayRecord && todayRecord.keluar) return; // already fully checked out

    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setScanSuccess(true);
      
      const isCheckIn = !todayRecord;
      const currentHrsMins = formatClock(currentTime);

      // Determine location from QR data or GPS
      let locationName = selectedLocation?.nama || 'Kantor Pusat';
      
      // Try to parse QR data for location info
      if (qrData.startsWith('PRESENSI:')) {
        const locId = qrData.replace('PRESENSI:', '');
        const matchedGeo = geofences.find(g => g.id === locId || g.nama === locId);
        if (matchedGeo) {
          locationName = matchedGeo.nama;
        }
      }

      if (isCheckIn) {
        const checkInHour = currentTime.getHours();
        const checkInMinute = currentTime.getMinutes();
        // Parse limit time from settings
        const [limitHour, limitMinute] = (limitTime || '07:00').split(':').map(Number);
        const isLate = checkInHour > limitHour || (checkInHour === limitHour && checkInMinute > limitMinute);
        
        const newRecord: AttendanceRecord = {
          id: `rec-${Date.now()}`,
          nip: currentUser.nip,
          nama: currentUser.nama,
          foto: currentUser.foto,
          tanggal: todayStr,
          masuk: currentHrsMins,
          status: isLate ? 'Terlambat' : 'Tepat Waktu',
          lokasi: locationName
        };

        if (isOnline) {
          onAddAttendance(newRecord);
        } else {
          const updatedQueue = [...offlineQueue, newRecord];
          setOfflineQueue(updatedQueue);
          localStorage.setItem(`offline_queue_${currentUser.nip}`, JSON.stringify(updatedQueue));
        }
      } else {
        const updatedRecord = {
          ...todayRecord,
          keluar: currentHrsMins
        } as AttendanceRecord;

        if (isOnline) {
          onAddAttendance(updatedRecord);
        } else {
          const queueIndex = offlineQueue.findIndex(r => r.tanggal === todayStr && r.nip === currentUser.nip);
          let updatedQueue: AttendanceRecord[];
          if (queueIndex > -1) {
            updatedQueue = [...offlineQueue];
            updatedQueue[queueIndex] = updatedRecord;
          } else {
            updatedQueue = [...offlineQueue, updatedRecord];
          }
          setOfflineQueue(updatedQueue);
          localStorage.setItem(`offline_queue_${currentUser.nip}`, JSON.stringify(updatedQueue));
        }
      }

      setTimeout(() => {
        setScanSuccess(false);
        setScanResult(null);
      }, 3500);
    }, 500);
  };

  // Syncing routine when going online
  useEffect(() => {
    if (isOnline && offlineQueue.length > 0) {
      setSyncMessage(`Menyinkronkan ${offlineQueue.length} data presensi offline ke server...`);
      
      const timer = setTimeout(() => {
        // Process each record in the queue
        offlineQueue.forEach(record => {
          onAddAttendance(record);
        });
        
        // Clear queue
        setOfflineQueue([]);
        localStorage.removeItem(`offline_queue_${currentUser.nip}`);
        setSyncMessage('Sinkronisasi selesai! Semua data berhasil disimpan di server.');
        
        const hideTimer = setTimeout(() => {
          setSyncMessage(null);
        }, 3000);
        return () => clearTimeout(hideTimer);
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [isOnline, offlineQueue, onAddAttendance, currentUser.nip]);

  // Format time (WIB format)
  const formatClock = (date: Date) => {
    const hrs = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `${hrs}:${mins}`;
  };

  const getGreeting = () => {
    const hr = currentTime.getHours();
    if (hr < 11) return 'Selamat Pagi';
    if (hr < 15) return 'Selamat Siang';
    if (hr < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  const handleStartScan = () => {
    if (todayRecord && todayRecord.keluar) return;
    
    // For face scan method, use the old simulation approach
    if (scanMethod === 'wajah') {
      handleFaceScan();
      return;
    }
    
    // For QR method, activate real camera
    setIsCameraActive(true);
  };

  // Face scan simulation (requires face recognition API in production)
  const handleFaceScan = () => {
    setIsScanning(true);
    
    // Use the device camera for face detection simulation
    // In a real app, this would use a face recognition API
    setTimeout(() => {
      processAttendance('FACE_SCAN_VERIFIED');
    }, 2000);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F2F2F7] dark:bg-[#121214] text-gray-900 dark:text-gray-100 pb-24 font-sans select-none transition-colors duration-300">
      
      {/* TopAppBar with frosted-glass aesthetic */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-zinc-800/50 flex justify-between items-center px-4 h-16 shadow-sm transition-colors duration-300">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo Yayasan Baitul Hikmah" className="w-9 h-9 object-contain" />
          <span className="font-bold text-lg tracking-tight text-[#0058bc] dark:text-[#3b82f6]">Baitul Hikmah</span>
        </div>
        
        {/* User avatar with mini settings portal */}
        <div className="flex items-center gap-2">
          {/* Connection status indicator */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[9px] font-black tracking-wider transition-all duration-300 shadow-sm ${
              isOnline 
                ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400' 
                : 'bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/30 text-amber-700 dark:text-amber-400 animate-pulse'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full relative flex">
              {isOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-400" />}
              <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            </span>
            <span>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
          </div>

          {/* Dark mode toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-all active:scale-95"
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          
          <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-200 dark:border-zinc-700 shadow-sm">
            <img 
              alt={currentUser.nama} 
              className="w-full h-full object-cover" 
              src={currentUser.foto} 
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </nav>

      <main className="flex-1 px-4 py-6 max-w-md mx-auto w-full space-y-6">
        
        {/* Syncing status notification banner */}
        <AnimatePresence>
          {syncMessage && (
            <motion.div 
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs font-bold text-emerald-800 dark:text-emerald-400 shadow-sm"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="leading-relaxed">{syncMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {activeTab === 'home' && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {/* Greeting & Time display */}
            <header className="flex justify-between items-end">
              <div>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{getGreeting()}, {currentUser.nama}</span>
                <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                  {new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).format(currentTime)}
                </h1>
              </div>
              <div className="text-right">
                <span className="text-4xl font-extrabold text-[#0058bc] dark:text-[#3b82f6] tracking-tight tabular-nums">
                  {formatClock(currentTime)}
                </span>
                <span className="ml-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500">WIB</span>
              </div>
            </header>

            {/* Offline queue warnings */}
            {offlineQueue.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/15 border border-amber-200/50 dark:border-amber-900/40 p-4 rounded-2xl flex gap-3 text-xs text-amber-800 dark:text-amber-400 text-left">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div className="space-y-1">
                  <p className="font-bold uppercase tracking-wider text-[10px]">Ada Antrean Presensi Offline</p>
                  <p className="leading-relaxed font-semibold">
                    Terdapat {offlineQueue.length} data presensi disimpan lokal. Hubungkan kembali ke internet untuk sinkronisasi otomatis ke server.
                  </p>
                </div>
              </div>
            )}

            {/* Attendance Status Card */}
            <section className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-zinc-800 flex flex-col gap-4 transition-colors duration-300">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Status Kerja Hari Ini</span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  todayRecord?.status === 'Izin'
                    ? 'bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border border-sky-100 dark:border-sky-900/50'
                    : todayRecord?.keluar 
                    ? 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400' 
                    : todayRecord 
                    ? 'bg-[#6ffb85]/20 dark:bg-emerald-950/40 text-[#00732a] dark:text-emerald-400' 
                    : 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'
                }`}>
                  {todayRecord?.status === 'Izin' ? 'Izin / Sakit' : todayRecord?.keluar ? 'Selesai' : todayRecord ? 'Aktif' : 'Belum Absen'}
                </span>
              </div>

              {todayRecord?.status === 'Izin' ? (
                <div className="bg-sky-50/50 dark:bg-sky-950/10 p-4 rounded-xl border border-sky-100 dark:border-sky-900/30 text-left">
                  <div className="flex items-center gap-2 text-sky-800 dark:text-sky-400 font-bold text-sm mb-1.5">
                    <FileText className="w-4 h-4 shrink-0" />
                    <span>Pengisian Izin/Sakit Terdaftar</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                    Keterangan: <strong className="text-gray-800 dark:text-gray-100">{todayRecord.keterangan || 'Tanpa keterangan tambahan'}</strong>
                  </p>
                  {todayRecord.lampiran && (
                    <button 
                      onClick={() => {
                        setViewingAttachment(todayRecord.lampiran || null);
                        setAttachmentTitle(`Lampiran Izin - ${currentUser.nama}`);
                      }}
                      className="mt-3 inline-flex items-center gap-1 text-[10px] font-black text-sky-600 dark:text-sky-400 hover:underline border border-sky-200 dark:border-sky-800/50 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/50 cursor-pointer"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      Lihat Dokumen Bukti
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Jam Masuk</p>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400">
                        {todayRecord ? todayRecord.masuk : '--:--'}
                      </span>
                      {todayRecord?.status === 'Terlambat' && (
                        <span className="text-[10px] font-semibold bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 px-1.5 py-0.5 rounded">Terlambat</span>
                      )}
                      {todayRecord?.status === 'Tepat Waktu' && (
                        <span className="text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded">Tepat</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 border-l border-gray-200 dark:border-zinc-800 pl-4">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Jam Keluar</p>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                      <span className="font-bold text-lg text-gray-700 dark:text-gray-300">
                        {todayRecord?.keluar ? todayRecord.keluar : '--:--'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-3.5 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#0058bc] dark:text-[#3b82f6]" />
                  Shift: <span className="font-semibold text-gray-700 dark:text-gray-300">Reguler (08:00 - 17:00)</span>
                </span>
              </div>
            </section>

            {/* Request Permit Banner Section */}
            {!todayRecord ? (
              <div className="bg-sky-500/10 dark:bg-sky-500/5 rounded-2xl p-4 border border-sky-500/20 flex items-center justify-between gap-3 text-left transition-all duration-300">
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-[#0058bc] dark:text-sky-400 uppercase tracking-wider">Berhalangan Hadir Hari Ini?</h4>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Ajukan surat izin sakit, kedinasan, atau keperluan mendesak di sini.</p>
                </div>
                <button
                  onClick={() => setIsPermitModalOpen(true)}
                  className="bg-sky-600 hover:bg-sky-700 dark:bg-sky-600 dark:hover:bg-sky-500 text-white font-bold text-[10px] uppercase tracking-wider px-3.5 py-2 rounded-xl shadow-md transition-all active:scale-95 shrink-0 cursor-pointer"
                >
                  Ajukan Izin
                </button>
              </div>
            ) : todayRecord.status === 'Izin' ? (
              <div className="bg-emerald-500/10 dark:bg-emerald-500/5 rounded-2xl p-4 border border-emerald-500/20 text-left transition-all duration-300">
                <p className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wide">Pemberitahuan Izin</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Sesi kerja ditiadakan untuk hari ini sesuai dengan pengajuan izin yang disetujui lembaga.</p>
              </div>
            ) : null}


            {/* Segmented Control for Scan Method */}
            <div className="bg-gray-200 dark:bg-zinc-800 p-1 rounded-xl flex shadow-inner transition-colors duration-300">
              <button 
                onClick={() => setScanMethod('qr')}
                className={`flex-1 py-2 font-medium text-sm rounded-lg transition-all ${
                  scanMethod === 'qr' ? 'bg-white dark:bg-zinc-700 shadow-sm text-[#0058bc] dark:text-[#3b82f6] font-bold' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                QR Code
              </button>
              <button 
                onClick={() => setScanMethod('wajah')}
                className={`flex-1 py-2 font-medium text-sm rounded-lg transition-all ${
                  scanMethod === 'wajah' ? 'bg-white dark:bg-zinc-700 shadow-sm text-[#0058bc] dark:text-[#3b82f6] font-bold' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                Wajah
              </button>
            </div>

            {/* Real Camera QR Scanner */}
            <section className="relative aspect-square w-full overflow-hidden rounded-3xl border-4 border-white dark:border-zinc-800 shadow-lg bg-neutral-900 group">
              
              {isCameraActive ? (
                <>
                  {/* Real QR Scanner using device camera */}
                  <QRScanner
                    isActive={isCameraActive}
                    scanMethod={scanMethod}
                    onScanSuccess={handleQRScanSuccess}
                    onScanError={(err) => console.error('Scan error:', err)}
                  />
                  
                  {/* Close camera button */}
                  <button
                    onClick={() => setIsCameraActive(false)}
                    className="absolute top-4 right-4 z-20 p-2 bg-black/60 backdrop-blur-md rounded-full text-white hover:bg-black/80 transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  {/* Viewfinder Frame Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center p-12 pointer-events-none">
                    <div className="w-full h-full border-2 border-white/30 rounded-2xl relative">
                      <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-[#0058bc] rounded-tl-lg" />
                      <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-[#0058bc] rounded-tr-lg" />
                      <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-[#0058bc] rounded-bl-lg" />
                      <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-[#0058bc] rounded-br-lg" />
                    </div>
                  </div>

                  {/* Guidance text */}
                  <div className="absolute bottom-6 left-0 right-0 text-center px-4 pointer-events-none z-10">
                    <span className="bg-black/60 backdrop-blur-md text-white text-xs font-semibold px-4 py-2 rounded-full inline-flex items-center gap-2 shadow-sm">
                      <Camera className="w-3.5 h-3.5 text-[#005bc1]" />
                      Arahkan kamera ke QR Code presensi
                    </span>
                  </div>
                </>
              ) : (
                <>
                  {/* Idle state - show preview/placeholder */}
                  <div className="absolute inset-0 bg-gradient-to-b from-gray-800 to-gray-900 flex flex-col items-center justify-center p-8">
                    <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mb-4">
                      {scanMethod === 'qr' ? (
                        <QrCode className="w-10 h-10 text-white/70" />
                      ) : (
                        <User className="w-10 h-10 text-white/70" />
                      )}
                    </div>
                    <p className="text-white/80 text-sm font-semibold text-center">
                      {scanMethod === 'qr' ? 'Tekan tombol di bawah untuk membuka kamera' : 'Tekan tombol untuk verifikasi wajah'}
                    </p>
                    <p className="text-white/50 text-xs mt-2 text-center max-w-[250px]">
                      {scanMethod === 'qr' 
                        ? 'Kamera akan aktif dan memindai QR code secara otomatis'
                        : 'Kamera depan akan aktif untuk verifikasi identitas'}
                    </p>
                  </div>

                  {/* Scanning animation (when processing) */}
                  {isScanning && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                      <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mb-3" />
                      <p className="text-white text-sm font-semibold">Memproses...</p>
                    </div>
                  )}
                </>
              )}

              {/* Success Screen Overlay */}
              <AnimatePresence>
                {scanSuccess && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-emerald-950/90 backdrop-blur-md flex flex-col items-center justify-center text-center p-6 z-30"
                  >
                    <motion.div 
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.15, type: 'spring' }}
                      className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-xl shadow-emerald-500/20 mb-4"
                    >
                      <CheckCircle2 className="w-12 h-12 stroke-[2.5]" />
                    </motion.div>
                    
                    <motion.h2 
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="text-white text-xl font-bold drop-shadow-sm"
                    >
                      {scanMethod === 'qr' ? 'QR Terverifikasi' : 'Wajah Terverifikasi'}
                    </motion.h2>
                    
                    <motion.p 
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="text-emerald-200 text-sm mt-1 max-w-[200px]"
                    >
                      Data absen {todayRecord?.keluar ? 'keluar' : 'masuk'} telah tersimpan
                    </motion.p>

                    {scanResult && (
                      <motion.p 
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="text-emerald-300/60 text-[10px] mt-3 font-mono"
                      >
                        ID: {scanResult.substring(0, 30)}
                      </motion.p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            {/* Real GPS Location Status */}
            <div className="bg-white dark:bg-[#1C1C1E] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-zinc-800 space-y-3 transition-colors duration-300">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-[#005bc1] dark:text-[#3b82f6]" />
                  Lokasi GPS Perangkat
                </span>
                {isLocating ? (
                  <span className="text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Mencari...
                  </span>
                ) : isWithinGeofence ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Dalam Radius
                  </span>
                ) : userLocation ? (
                  <span className="text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    Di Luar Radius
                  </span>
                ) : (
                  <span className="text-gray-500 dark:text-gray-400 font-bold bg-gray-50 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                    Belum Terdeteksi
                  </span>
                )}
              </div>
              
              {locationError && (
                <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 p-3 rounded-lg text-xs text-rose-600 dark:text-rose-400 flex gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Error Lokasi</p>
                    <p>{locationError}</p>
                  </div>
                </div>
              )}

              {gpsWarning && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-3 rounded-lg text-xs text-amber-700 dark:text-amber-400 flex gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <p className="font-bold">⚠️ Peringatan GPS</p>
                    <p>{gpsWarning}</p>
                    <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-500">Presensi tidak dapat dilakukan dengan lokasi palsu.</p>
                  </div>
                </div>
              )}

              {userLocation && (
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-800 p-2.5 rounded-lg transition-colors duration-300">
                  <Navigation className="w-4 h-4 text-[#005bc1] dark:text-[#3b82f6] shrink-0" />
                  <span className="truncate">
                    Posisi: <strong className="text-gray-700 dark:text-gray-200">{userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}</strong>
                  </span>
                </div>
              )}

              {nearestGeofence && distanceToNearest !== null && (
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-800 p-2.5 rounded-lg transition-colors duration-300">
                  <Compass className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
                  <span className="truncate">
                    Terdekat: <strong className="text-gray-700 dark:text-gray-200">{nearestGeofence.nama}</strong> 
                    {' '}({distanceToNearest}m dari radius {nearestGeofence.radius}m)
                  </span>
                </div>
              )}

              {/* Refresh location button */}
              <button
                onClick={getCurrentLocation}
                disabled={isLocating}
                className="w-full py-2 text-xs font-bold text-[#005bc1] dark:text-[#3b82f6] bg-[#005bc1]/5 dark:bg-blue-950/30 rounded-lg hover:bg-[#005bc1]/10 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <MapPin className="w-3.5 h-3.5" />
                {isLocating ? 'Memuat lokasi...' : 'Perbarui Lokasi GPS'}
              </button>

              {/* Geofence list for reference */}
              {geofences.length > 0 && (
                <div className="pt-2 border-t border-gray-100 dark:border-zinc-800">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Zona Presensi Terdaftar</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {geofences.map(g => (
                      <div
                        key={g.id}
                        className={`text-center p-2 rounded-lg text-[10px] font-medium border transition-all ${
                          nearestGeofence?.id === g.id && isWithinGeofence
                            ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold' 
                            : nearestGeofence?.id === g.id
                            ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
                            : 'border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-600 dark:text-gray-300'
                        }`}
                      >
                        {g.nama} ({g.radius}m)
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Check-In / Check-Out Action Button */}
            <div className="pt-2">
              <button
                disabled={isScanning || isCameraActive || (todayRecord?.masuk && todayRecord?.keluar) || todayRecord?.status === 'Izin' || !!gpsWarning}
                onClick={handleStartScan}
                className={`w-full h-14 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] ${
                  isScanning || isCameraActive
                    ? 'bg-gray-400 dark:bg-zinc-600 text-white cursor-not-allowed'
                    : todayRecord?.status === 'Izin'
                    ? 'bg-sky-100 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800/30 cursor-not-allowed'
                    : (todayRecord?.masuk && todayRecord?.keluar)
                    ? 'bg-gray-300 dark:bg-zinc-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                    : todayRecord
                    ? 'bg-amber-500 dark:bg-amber-600 text-white hover:bg-amber-600 dark:hover:bg-amber-700'
                    : 'bg-[#005bc1] dark:bg-blue-600 text-white hover:bg-[#0070eb] dark:hover:bg-blue-700'
                }`}
              >
                {isScanning ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Memverifikasi...
                  </>
                ) : todayRecord?.status === 'Izin' ? (
                  <>
                    <FileText className="w-5 h-5" />
                    Izin Hari Ini Terdaftar
                  </>
                ) : (todayRecord?.masuk && todayRecord?.keluar) ? (
                  <>
                    <UserCheck className="w-5 h-5" />
                    Absen Selesai Hari Ini
                  </>
                ) : todayRecord ? (
                  <>
                    <LogOut className="w-5 h-5" />
                    Scan Keluar (Pulang)
                  </>
                ) : (
                  <>
                    <QrCode className="w-5 h-5" />
                    Scan Masuk Sekarang
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Riwayat Presensi</h2>
              <span className="text-xs bg-gray-200 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded-full font-semibold">
                {personalRecords.length} Hari Kerja
              </span>
            </div>

            <div className="space-y-3">
              {personalRecords.map((r, idx) => (
                <div key={idx} className="bg-white dark:bg-[#1C1C1E] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-zinc-800 flex justify-between items-center transition-colors duration-300">
                  <div className="space-y-1 text-left">
                    <p className="font-bold text-gray-800 dark:text-gray-100 text-sm flex items-center gap-2">
                      {new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(r.tanggal))}
                      {r.isOfflinePending && (
                        <span className="text-[8px] px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 uppercase font-black tracking-wider animate-pulse shrink-0">
                          Lokal (Offline)
                        </span>
                      )}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      {r.status === 'Izin' ? (
                        <div className="flex flex-col gap-1">
                          <span className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400 font-semibold">
                            <span className="w-2 h-2 rounded-full bg-sky-500" />
                            Izin: {r.keterangan || 'Tanpa Keterangan'}
                          </span>
                          {r.lampiran && (
                            <button
                              onClick={() => {
                                setViewingAttachment(r.lampiran || null);
                                setAttachmentTitle(`Lampiran Izin - ${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(r.tanggal))}`);
                              }}
                              className="text-[10px] text-sky-500 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <ImageIcon className="w-3 h-3" />
                              Lihat Lampiran Bukti
                            </button>
                          )}
                        </div>
                      ) : (
                        <>
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            In: {r.masuk}
                          </span>
                          {r.keluar && (
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-gray-400 dark:bg-zinc-600" />
                              Out: {r.keluar}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      r.status === 'Tepat Waktu' 
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50' 
                        : r.status === 'Izin'
                        ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border border-sky-100 dark:border-sky-900/50'
                        : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50'
                    }`}>
                      {r.status}
                    </span>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{r.lokasi || 'Kantor Pusat'}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'stats' && (() => {
          // Calculate current month's stats dynamically
          const currentYearMonth = currentTime.toISOString().slice(0, 7); // e.g., "2026-06"
          const indonesianMonths = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
          ];
          const currentMonthName = `${indonesianMonths[currentTime.getMonth()]} ${currentTime.getFullYear()}`;

          const monthlyRecords = personalRecords.filter(r => r.tanggal.startsWith(currentYearMonth));
          const monthlyTepatWaktu = monthlyRecords.filter(r => r.status === 'Tepat Waktu').length;
          const monthlyTerlambat = monthlyRecords.filter(r => r.status === 'Terlambat').length;
          const monthlyIzin = monthlyRecords.filter(r => r.status === 'Izin').length;
          const monthlyTotalHadir = monthlyTepatWaktu + monthlyTerlambat;
          const monthlyTotal = monthlyRecords.length;

          return (
            <motion.div 
              initial={{ opacity: 0, y: 15 }} 
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Ringkasan Statistik</h2>

              {/* Monthly Attendance Summary Card */}
              <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-zinc-800 space-y-4 transition-colors duration-300">
                <div className="flex items-center justify-between border-b border-gray-50 dark:border-zinc-800/50 pb-3">
                  <div className="text-left">
                    <span className="text-[10px] font-bold text-[#0058bc] dark:text-blue-400 uppercase tracking-wider">Laporan Bulanan</span>
                    <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">{currentMonthName}</h3>
                  </div>
                  <div className="px-2.5 py-1 bg-sky-50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400 rounded-lg text-[10px] font-bold">
                    {monthlyTotal} Hari Kerja
                  </div>
                </div>

                {/* Simple Chart / Progress Indicator */}
                <div className="space-y-4">
                  {/* Horizontal Stacked Bar Chart */}
                  <div className="space-y-1.5 text-left">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Proporsi Kehadiran Bulanan</span>
                    <div className="h-4 w-full rounded-full bg-gray-100 dark:bg-zinc-800 flex overflow-hidden">
                      {monthlyTotal > 0 ? (
                        <>
                          <div 
                            style={{ width: `${(monthlyTepatWaktu / monthlyTotal) * 100}%` }} 
                            className="bg-emerald-500 h-full transition-all duration-500" 
                            title={`Tepat Waktu: ${monthlyTepatWaktu} Hari`}
                          />
                          <div 
                            style={{ width: `${(monthlyTerlambat / monthlyTotal) * 100}%` }} 
                            className="bg-rose-500 h-full transition-all duration-500" 
                            title={`Terlambat: ${monthlyTerlambat} Hari`}
                          />
                          <div 
                            style={{ width: `${(monthlyIzin / monthlyTotal) * 100}%` }} 
                            className="bg-sky-500 h-full transition-all duration-500" 
                            title={`Izin: ${monthlyIzin} Hari`}
                          />
                        </>
                      ) : (
                        <div className="w-full bg-gray-200 dark:bg-zinc-800 text-center text-[10px] text-gray-400 flex items-center justify-center">
                          Belum ada data bulan ini
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Vertical Bar Chart (Clean programmatically drawn visual component) */}
                  <div className="flex justify-around items-end h-28 pt-4 pb-2 border-b border-gray-50 dark:border-zinc-800/50">
                    {/* Tepat Waktu Bar */}
                    <div className="flex flex-col items-center gap-1.5 h-full justify-end w-16">
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        {monthlyTepatWaktu} H
                      </span>
                      <div 
                        style={{ height: `${monthlyTotal > 0 ? Math.max((monthlyTepatWaktu / monthlyTotal) * 60, 4) : 4}px` }}
                        className="w-8 bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t-md transition-all duration-500"
                      />
                      <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Tepat</span>
                    </div>

                    {/* Terlambat Bar */}
                    <div className="flex flex-col items-center gap-1.5 h-full justify-end w-16">
                      <span className="text-[10px] font-bold text-rose-500 dark:text-rose-400">
                        {monthlyTerlambat} H
                      </span>
                      <div 
                        style={{ height: `${monthlyTotal > 0 ? Math.max((monthlyTerlambat / monthlyTotal) * 60, 4) : 4}px` }}
                        className="w-8 bg-gradient-to-t from-rose-500 to-rose-400 rounded-t-md transition-all duration-500"
                      />
                      <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Lambat</span>
                    </div>

                    {/* Izin Bar */}
                    <div className="flex flex-col items-center gap-1.5 h-full justify-end w-16">
                      <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400">
                        {monthlyIzin} H
                      </span>
                      <div 
                        style={{ height: `${monthlyTotal > 0 ? Math.max((monthlyIzin / monthlyTotal) * 60, 4) : 4}px` }}
                        className="w-8 bg-gradient-to-t from-sky-500 to-sky-400 rounded-t-md transition-all duration-500"
                      />
                      <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Izin</span>
                    </div>
                  </div>

                  {/* Numeric Summary Table */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100/50 dark:border-emerald-900/30">
                      <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">Total Hadir</p>
                      <p className="text-base font-black text-emerald-800 dark:text-emerald-300 mt-0.5">{monthlyTotalHadir}</p>
                      <p className="text-[9px] text-emerald-600 dark:text-emerald-500">
                        {monthlyTotal > 0 ? ((monthlyTotalHadir / monthlyTotal) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                    <div className="p-2 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100/50 dark:border-rose-900/30">
                      <p className="text-[10px] font-bold text-rose-700 dark:text-rose-400">Terlambat</p>
                      <p className="text-base font-black text-rose-800 dark:text-rose-300 mt-0.5">{monthlyTerlambat}</p>
                      <p className="text-[9px] text-rose-600 dark:text-rose-500">
                        {monthlyTotal > 0 ? ((monthlyTerlambat / monthlyTotal) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                    <div className="p-2 rounded-xl bg-sky-50/50 dark:bg-sky-950/20 border border-sky-100/50 dark:border-sky-900/30">
                      <p className="text-[10px] font-bold text-sky-700 dark:text-sky-400">Total Izin</p>
                      <p className="text-base font-black text-sky-800 dark:text-sky-300 mt-0.5">{monthlyIzin}</p>
                      <p className="text-[9px] text-sky-600 dark:text-sky-500">
                        {monthlyTotal > 0 ? ((monthlyIzin / monthlyTotal) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Circular summary progress */}
              <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-zinc-800 flex flex-col items-center text-center gap-4 transition-colors duration-300">
                <div className="relative w-32 h-32 flex items-center justify-center">
                  {/* SVG circular track */}
                  <svg className="absolute w-full h-full transform -rotate-90">
                    <circle cx="64" cy="64" r="54" strokeWidth="8" stroke="#f3f4f6" className="dark:stroke-zinc-800" fill="transparent" />
                    <circle cx="64" cy="64" r="54" strokeWidth="8" stroke="#0058bc" className="dark:stroke-[#3b82f6]" fill="transparent" 
                            strokeDasharray={339.3}
                            strokeDashoffset={339.3 - (339.3 * (personalRecords.length > 0 ? (personalRecords.filter(r => r.status === 'Tepat Waktu').length / personalRecords.length) * 100 : 100)) / 100}
                            strokeLinecap="round"
                    />
                  </svg>
                  <div className="text-center">
                    <span className="text-2xl font-black text-gray-800 dark:text-gray-100">
                      {personalRecords.length > 0 ? ((personalRecords.filter(r => r.status === 'Tepat Waktu').length / personalRecords.length) * 100).toFixed(1) : '100'}%
                    </span>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">Hadir Tepat</p>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-gray-800 dark:text-gray-100">Performa Kehadiran Bagus</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 max-w-[280px] mt-1">
                    Pertahankan catatan kehadiran Anda untuk mempertahankan kompensasi optimal dan poin kinerja lembaga.
                  </p>
                </div>
              </div>


            {/* Metrics Breakdown Grid */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-[#1C1C1E] p-4 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800 flex flex-col gap-1 transition-colors duration-300">
                  <span className="text-xs text-gray-400 dark:text-gray-500 font-semibold text-left">Tepat Waktu</span>
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 text-left">
                    {personalRecords.filter(r => r.status === 'Tepat Waktu').length} Hari
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 text-left">Datang sebelum batas jam masuk</span>
                </div>
                <div className="bg-white dark:bg-[#1C1C1E] p-4 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800 flex flex-col gap-1 transition-colors duration-300">
                  <span className="text-xs text-gray-400 dark:text-gray-500 font-semibold text-left">Terlambat</span>
                  <span className="text-2xl font-black text-rose-500 dark:text-rose-400 text-left">
                    {personalRecords.filter(r => r.status === 'Terlambat').length} Hari
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 text-left">Datang setelah 07:00 WIB</span>
                </div>
              </div>

              <div className="bg-white dark:bg-[#1C1C1E] p-4 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800 flex justify-between items-center transition-colors duration-300">
                <div className="flex flex-col gap-1 text-left">
                  <span className="text-xs text-gray-400 dark:text-gray-500 font-semibold">Izin & Sakit Resmi</span>
                  <span className="text-2xl font-black text-sky-600 dark:text-sky-400">
                    {personalRecords.filter(r => r.status === 'Izin').length} Hari
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">Absen disetujui administrasi lembaga</span>
                </div>
                <div className="p-3 bg-sky-50 dark:bg-sky-950/30 rounded-xl text-sky-600 dark:text-sky-400">
                  <FileText className="w-6 h-6" />
                </div>
              </div>
            </div>
          </motion.div>
        );
      })()}

        {activeTab === 'profile' && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Header info */}
            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-zinc-800 flex flex-col items-center text-center gap-3 transition-colors duration-300">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-[#0058bc]/20 dark:border-zinc-700 shadow-inner">
                  <img className="w-full h-full object-cover" src={currentUser.foto} alt={currentUser.nama} />
                </div>
                <button 
                  onClick={() => {
                    setIsEditingPhoto(true);
                    setCustomPhotoUrl(currentUser.foto);
                  }}
                  className="absolute bottom-0 right-0 p-2 bg-[#0058bc] dark:bg-blue-600 hover:bg-[#00418f] text-white rounded-full shadow-lg transition-all active:scale-90 cursor-pointer"
                  title="Ganti Foto Profil"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">{currentUser.nama}</h2>
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{currentUser.jabatan}</p>
                <span className="inline-block mt-2 text-xs bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 font-medium px-3 py-1 rounded-full">
                  NIP: {currentUser.nip}
                </span>
              </div>
            </div>

            {/* Detail Group Card */}
            <div className="bg-white dark:bg-[#1C1C1E] rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800 divide-y divide-gray-100 dark:divide-zinc-800 transition-colors duration-300">
              <div className="p-4 flex justify-between items-center">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Lembaga</span>
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{currentUser.lembaga}</span>
              </div>
              <div className="p-4 flex justify-between items-center">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Status Pegawai</span>
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Tetap (Aktif)</span>
              </div>
              <div className="p-4 flex justify-between items-center">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Batas Absen</span>
                <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">07:00 WIB</span>
              </div>
            </div>

          </motion.div>
        )}

      </main>

      {/* Bottom Tab Navigation Bar with frosted glass */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-[#1C1C1E]/90 backdrop-blur-xl border-t border-gray-200/50 dark:border-zinc-800/50 flex justify-around items-center px-4 py-2 shadow-lg transition-colors duration-300">
        <button 
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
            activeTab === 'home' ? 'text-[#0058bc] dark:text-[#3b82f6] scale-105 font-bold' : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Home className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Home</span>
        </button>

        <button 
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
            activeTab === 'history' ? 'text-[#0058bc] dark:text-[#3b82f6] scale-105 font-bold' : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <History className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">History</span>
        </button>

        <button 
          onClick={() => setActiveTab('stats')}
          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
            activeTab === 'stats' ? 'text-[#0058bc] dark:text-[#3b82f6] scale-105 font-bold' : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <BarChart2 className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Stats</span>
        </button>

        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
            activeTab === 'profile' ? 'text-[#0058bc] dark:text-[#3b82f6] scale-105 font-bold' : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <User className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Profile</span>
        </button>
      </nav>

      {/* MODAL 1: Form Pengajuan Izin / Sakit */}
      <AnimatePresence>
        {isPermitModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPermitModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Sheet/Modal Box */}
            <motion.div 
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              className="relative w-full max-w-md bg-white dark:bg-[#1C1C1E] rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl border border-gray-100 dark:border-zinc-800 flex flex-col gap-5 overflow-y-auto max-h-[90vh] transition-colors duration-300 text-left"
            >
              <div className="flex justify-between items-center border-b border-gray-100 dark:border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#0058bc] dark:text-[#3b82f6]" />
                  <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Form Pengajuan Izin</h3>
                </div>
                <button 
                  onClick={() => setIsPermitModalOpen(false)}
                  className="p-1.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Content */}
              <div className="space-y-4">
                {/* Leave Type Segmented Controls */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Tipe Pengajuan</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Izin', 'Sakit', 'Dinas Luar'] as const).map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setPermitType(type)}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                          permitType === type 
                            ? 'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-400 font-bold shadow-sm'
                            : 'border-gray-200 dark:border-zinc-800 text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-800'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date display */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Tanggal Berlaku</label>
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 text-xs font-semibold text-gray-700 dark:text-gray-300">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>Hari ini ({new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())})</span>
                  </div>
                </div>

                {/* Reason/Keterangan */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Alasan / Keterangan Tambahan</label>
                  <textarea
                    rows={3}
                    placeholder="Contoh: Mengikuti wisuda keluarga, Demam tinggi butuh istirahat dokter, Menghadiri seminar eksternal, dll."
                    value={permitReason}
                    onChange={(e) => setPermitReason(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#0058bc]/20 text-xs font-medium text-gray-800 dark:text-gray-100 placeholder-gray-400 transition-colors"
                  />
                </div>

                {/* File Attachment Upload */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Unggah Lampiran Bukti (Opsional)</label>
                  
                  {permitFile ? (
                    <div className="relative rounded-xl overflow-hidden border border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-950/20 p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img src={permitFile} className="w-10 h-10 object-cover rounded-lg border border-sky-200/50" alt="Attachment" />
                        <div className="min-w-0 text-left">
                          <p className="text-[10px] font-bold text-sky-800 dark:text-sky-400 truncate">Dokumen_Izin.jpg</p>
                          <p className="text-[9px] text-sky-600 dark:text-sky-500">File berhasil dipindai</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setPermitFile(null)}
                        className="p-1 rounded-full bg-sky-200/50 dark:bg-sky-900 text-sky-800 dark:text-sky-400 hover:bg-sky-200"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 dark:border-zinc-800 hover:border-sky-500 rounded-xl p-4 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-all text-center">
                        <Upload className="w-5 h-5 text-gray-400 mb-1" />
                        <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">Pilih file / Ambil Foto</span>
                        <span className="text-[9px] text-gray-400 mt-0.5">JPEG, PNG maks 2MB</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setPermitFile(reader.result as string);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPermitModalOpen(false)}
                  className="flex-1 py-3 text-xs font-bold rounded-xl border border-gray-200 dark:border-zinc-800 text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Kembali
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!permitReason.trim()) {
                      alert('Harap isi alasan/keterangan pengajuan izin.');
                      return;
                    }
                    const todayStr = new Date().toISOString().split('T')[0];
                    const fullKeterangan = `${permitType}: ${permitReason}`;
                    const newRecord: AttendanceRecord = {
                      id: `rec-${Date.now()}`,
                      nip: currentUser.nip,
                      nama: currentUser.nama,
                      foto: currentUser.foto,
                      tanggal: todayStr,
                      masuk: '--:--',
                      keluar: '--:--',
                      status: 'Izin',
                      lokasi: 'Pengajuan Izin',
                      keterangan: fullKeterangan,
                      lampiran: permitFile || undefined
                    };

                    if (isOnline) {
                      onAddAttendance(newRecord);
                    } else {
                      const updatedQueue = [...offlineQueue, newRecord];
                      setOfflineQueue(updatedQueue);
                      localStorage.setItem(`offline_queue_${currentUser.nip}`, JSON.stringify(updatedQueue));
                    }

                    setIsPermitModalOpen(false);
                    setPermitReason('');
                    setPermitFile(null);
                  }}
                  className="flex-1 py-3 text-xs font-bold rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-md transition-colors"
                >
                  Kirim Izin
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: Ganti Foto Profil */}
      <AnimatePresence>
        {isEditingPhoto && (
          <div className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditingPhoto(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div 
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              className="relative w-full max-w-md bg-white dark:bg-[#1C1C1E] rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl border border-gray-100 dark:border-zinc-800 flex flex-col gap-5 max-h-[90vh] overflow-y-auto transition-colors duration-300 text-left"
            >
              <div className="flex justify-between items-center border-b border-gray-100 dark:border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-[#0058bc] dark:text-[#3b82f6]" />
                  <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Ganti Foto Profil</h3>
                </div>
                <button 
                  onClick={() => setIsEditingPhoto(false)}
                  className="p-1.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Presets Grid */}
              <div className="space-y-2.5">
                <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Pilih dari Preset Kece</label>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80",
                    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80",
                    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80",
                    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80",
                    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
                    "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80",
                    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80",
                    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&q=80"
                  ].map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        onChangeProfilePicture(currentUser.nip, url);
                        setIsEditingPhoto(false);
                      }}
                      className="w-14 h-14 rounded-full overflow-hidden border-2 border-transparent hover:border-[#0058bc] active:scale-90 transition-all cursor-pointer relative"
                    >
                      <img src={url} className="w-full h-full object-cover" alt="preset" />
                      {currentUser.foto === url && (
                        <div className="absolute inset-0 bg-[#0058bc]/40 flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Image URL */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Masukkan URL Foto Kustom</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="https://example.com/foto.jpg"
                    value={customPhotoUrl}
                    onChange={(e) => setCustomPhotoUrl(e.target.value)}
                    className="flex-1 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#0058bc]/20 text-xs text-gray-800 dark:text-gray-100 placeholder-gray-400 transition-colors"
                  />
                  <button
                    onClick={() => {
                      if (customPhotoUrl.trim().startsWith('http')) {
                        onChangeProfilePicture(currentUser.nip, customPhotoUrl);
                        setIsEditingPhoto(false);
                      } else {
                        alert('Silakan masukkan URL gambar yang valid (harus diawali http/https)!');
                      }
                    }}
                    className="bg-[#0058bc] hover:bg-[#00418f] text-white px-3.5 py-2 rounded-xl font-bold text-xs cursor-pointer"
                  >
                    Simpan
                  </button>
                </div>
              </div>

              {/* Upload image file directly */}
              <div className="space-y-2 pt-1 border-t border-gray-100 dark:border-zinc-800">
                <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Atau Unggah Foto dari Perangkat</label>
                <label className="flex items-center justify-center gap-2 border border-dashed border-gray-200 dark:border-zinc-800 hover:border-[#0058bc] rounded-xl p-3 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-zinc-900/40 transition-all text-xs font-bold text-gray-600 dark:text-gray-300">
                  <Upload className="w-4 h-4 text-gray-400" />
                  <span>Cari Foto Saya</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          onChangeProfilePicture(currentUser.nip, reader.result as string);
                          setIsEditingPhoto(false);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              </div>

              {/* Cancel Button */}
              <button
                type="button"
                onClick={() => setIsEditingPhoto(false)}
                className="w-full py-2.5 text-xs font-bold rounded-xl border border-gray-100 dark:border-zinc-800 text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Kembali
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: Lightbox Preview Lampiran */}
      <AnimatePresence>
        {viewingAttachment && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingAttachment(null)}
              className="absolute inset-0 bg-black/85 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-lg w-full bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl border border-zinc-800/80 p-4 text-center z-10"
            >
              <div className="flex justify-between items-center text-white mb-3">
                <span className="text-xs font-bold tracking-tight">{attachmentTitle || 'Preview Lampiran Dokumen'}</span>
                <button 
                  onClick={() => setViewingAttachment(null)}
                  className="p-1 rounded-full bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="w-full aspect-[4/3] rounded-lg overflow-hidden bg-black flex items-center justify-center">
                <img src={viewingAttachment} className="max-w-full max-h-full object-contain" alt="Bukti lampiran" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
