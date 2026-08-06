/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { checkMockLocation } from '../mockLocationCheck';
import { 
  Home, 
  History, 
  BarChart2, 
  User, 
  MapPin, 
  QrCode, 
  Camera, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  LogOut,
  Sparkles,
  Info,
  Moon,
  Sun,
  FileText,
  Upload,
  X,
  Calendar,
  Image as ImageIcon,
  Pencil
} from 'lucide-react';
import { Employee, AttendanceRecord, Geofence } from '../types';
import { ASSETS, localDateString } from '../data';
import QRScanner from './QRScanner';
import ThemeToggle from './ThemeToggle';

interface EmployeeAppProps {
  currentUser: Employee;
  geofences: Geofence[];
  attendanceRecords: AttendanceRecord[];
  onAddAttendance: (record: AttendanceRecord) => void;
  onAddAttendanceBatch?: (records: AttendanceRecord[]) => void;
  onLogout: () => void;
  onChangeProfilePicture: (nip: string, newFoto: string) => void;
  onUpdateEmployeeProfile?: (nip: string, updates: Partial<Employee>) => void;
  limitTime?: string;
  jamPulang?: string;
  jamMalamMasuk?: string;
  jamMalamPulang?: string;
  isAdmin?: boolean;
  onNavigateToAdmin?: () => void;
}

export default function EmployeeApp({
  currentUser,
  geofences,
  attendanceRecords,
  onAddAttendance,
  onAddAttendanceBatch,
  onLogout,
  onChangeProfilePicture,
  onUpdateEmployeeProfile,
  limitTime = '07:00',
  jamPulang = '14:00',
  jamMalamMasuk = '18:30',
  jamMalamPulang = '22:00',
  isAdmin = false,
  onNavigateToAdmin
}: EmployeeAppProps) {
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'stats' | 'profile'>('home');
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

  // New State for editing own name
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');

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
  const [scanError, setScanError] = useState<string | null>(null);
  const [rejectMessage, setRejectMessage] = useState<string | null>(null);

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
  
  // Find today's records (multiple sessions possible)
  const todayStr = localDateString();
  const todayRecords = personalRecords.filter(r => r.tanggal === todayStr);

  // Deteksi sesi saat ini: malam bila jam sekarang >= jam masuk malam
  const currentSession: 'siang' | 'malam' = (() => {
    const nightStart = (jamMalamMasuk || '18:30').split(':').map(Number);
    const nowH = currentTime.getHours();
    const nowM = currentTime.getMinutes();
    return nowH > nightStart[0] || (nowH === nightStart[0] && nowM >= nightStart[1]) ? 'malam' : 'siang';
  })();
  const currentLimitTime = currentSession === 'malam' ? jamMalamMasuk : limitTime;
  const currentJamPulang = currentSession === 'malam' ? jamMalamPulang : jamPulang;

  // Active session = open record (without checkout) on the CURRENT session
  const activeSession = todayRecords.find(r => r.masuk !== '--:--' && !r.keluar && r.status !== 'Izin' && (r.sesi ?? 'siang') === currentSession);
  // Records on the current session (for status card display)
  const sessionTodayRecords = todayRecords.filter(r => (r.sesi ?? 'siang') === currentSession);
  // For status display: show active session or last completed on current session
  const todayRecord = activeSession || sessionTodayRecords[sessionTodayRecords.length - 1] || todayRecords[0];

  // Zona presensi yang terjangkau oleh lokasi GPS karyawan saat ini
  const reachableGeofences = userLocation
    ? geofences.filter(g => calculateDistance(userLocation.lat, userLocation.lng, g.lat, g.lng) <= g.radius)
    : [];

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
        
        // Jangan timpa pilihan user bila zona yang dipilih masih terjangkau
        if (nearest) {
          const currentReachable = selectedLocation && geofences.some(g =>
            g.id === selectedLocation.id &&
            calculateDistance(latitude, longitude, g.lat, g.lng) <= g.radius
          );
          if (!currentReachable) {
            setSelectedLocation(nearest);
          }
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

  // Auto-dismiss reject message
  useEffect(() => {
    if (rejectMessage) {
      const timer = setTimeout(() => setRejectMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [rejectMessage]);

  // Handle QR scan success
  const handleQRScanSuccess = (decodedText: string) => {
    setIsCameraActive(false);
    
    // Check for mock/fake GPS first (native Android only)
    checkMockLocation().then(({ isMocked, reason }) => {
      if (isMocked) {
        setRejectMessage(`Fake GPS terdeteksi! ${reason}`);
        return;
      }

      // Force get fresh GPS position before processing
      if (!navigator.geolocation) {
        setRejectMessage('GPS tidak tersedia di perangkat ini.');
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          processAttendanceWithGPS(decodedText, latitude, longitude);
        },
        () => {
          setRejectMessage('Gagal mendapatkan lokasi GPS. Pastikan GPS aktif.');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  // Process attendance with verified GPS position
  const processAttendanceWithGPS = (qrData: string, gpsLat: number, gpsLng: number) => {
    // Parse QR data first to get location info
    let locationName = 'Lokasi Tidak Diketahui';
    let qrGeoId: string | null = null;
    let qrLat: number | null = null;
    let qrLng: number | null = null;
    let qrRadius: number = 100;

    try {
      if (qrData.startsWith('P|')) {
        const parts = qrData.split('|');
        if (parts.length >= 3) {
          qrGeoId = parts[1] || null;
          locationName = parts[2];
          if (parts.length >= 6) {
            qrLat = parseFloat(parts[3]);
            qrLng = parseFloat(parts[4]);
            qrRadius = parseInt(parts[5]) || 100;
          }
        }
      } else {
        const parsed = JSON.parse(qrData);
        if (parsed.type === 'PRESENSI' && parsed.nama) {
          qrGeoId = parsed.geoId || parsed.id || null;
          locationName = parsed.nama;
          qrLat = parsed.lat;
          qrLng = parsed.lng;
          qrRadius = parsed.radius || 100;
        }
      }
    } catch {
      if (qrData.startsWith('PRESENSI:')) {
        const locId = qrData.replace('PRESENSI:', '');
        const matchedGeo = geofences.find(g => g.id === locId || g.nama === locId);
        if (matchedGeo) {
          qrGeoId = matchedGeo.id;
          locationName = matchedGeo.nama;
          qrLat = matchedGeo.lat;
          qrLng = matchedGeo.lng;
          qrRadius = matchedGeo.radius;
        }
      }
    }

    // QR harus milik zona yang dipilih karyawan
    if (selectedLocation) {
      const qrZone = qrGeoId ? geofences.find(g => g.id === qrGeoId || g.nama === qrGeoId) : null;
      const qrBelongsToSelected = qrZone ? qrZone.id === selectedLocation.id : qrLat !== null;
      if (!qrBelongsToSelected) {
        setRejectMessage(`Presensi ditolak! QR ini untuk ${locationName}, bukan zona ${selectedLocation.nama} yang Anda pilih.`);
        return;
      }
    }

    // GPS distance validation — WAJIB dalam radius
    if (qrLat !== null && qrLng !== null) {
      const distance = calculateDistance(gpsLat, gpsLng, qrLat, qrLng);
      if (distance > qrRadius) {
        setRejectMessage(`Presensi ditolak! Anda berada ${Math.round(distance)}m dari ${locationName}. Maksimal ${qrRadius}m.`);
        return;
      }
    } else {
      // QR tanpa koordinat — cek apakah user dekat zona yang dipilih / zona terdaftar
      const isNearSelected = selectedLocation && calculateDistance(gpsLat, gpsLng, selectedLocation.lat, selectedLocation.lng) <= selectedLocation.radius;
      const isNearAny = geofences.some(g => 
        calculateDistance(gpsLat, gpsLng, g.lat, g.lng) <= g.radius
      );
      if (!isNearSelected && !isNearAny) {
        setRejectMessage('Presensi ditolak! Anda tidak berada di area lokasi presensi.');
        return;
      }
    }

    setIsScanning(true);
    setIsCameraActive(false);
    setTimeout(() => {
      setIsScanning(false);
      setScanSuccess(true);
      
      const isCheckIn = !activeSession;
      const currentHrsMins = formatClock(currentTime);

      if (isCheckIn) {
        const checkInHour = currentTime.getHours();
        const checkInMinute = currentTime.getMinutes();
        // Parse limit time from settings (per current session: siang/malam)
        const [limitHour, limitMinute] = (currentLimitTime || '07:00').split(':').map(Number);
        const isLate = checkInHour > limitHour || (checkInHour === limitHour && checkInMinute > limitMinute);
        
        const newRecord: AttendanceRecord = {
          id: `rec-${Date.now()}`,
          nip: currentUser.nip,
          nama: currentUser.nama,
          foto: currentUser.foto,
          tanggal: todayStr,
          masuk: currentHrsMins,
          status: isLate ? 'Terlambat' : 'Tepat Waktu',
          lokasi: locationName,
          sesi: currentSession
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
          ...activeSession,
          keluar: currentHrsMins
        } as AttendanceRecord;

        if (isOnline) {
          onAddAttendance(updatedRecord);
        } else {
          const queueIndex = offlineQueue.findIndex(r => r.tanggal === todayStr && r.nip === currentUser.nip && (r.sesi ?? 'siang') === currentSession);
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
      }, 3500);
    }, 500);
  };

  // Syncing routine when going online
  useEffect(() => {
    if (isOnline && offlineQueue.length > 0) {
      setSyncMessage(`Menyinkronkan ${offlineQueue.length} data presensi offline ke server...`);
      
      const timer = setTimeout(() => {
        // Process all records in the queue in one batch to avoid stale-closure overwrites
        if (onAddAttendanceBatch) {
          onAddAttendanceBatch(offlineQueue);
        } else {
          offlineQueue.forEach(record => {
            onAddAttendance(record);
          });
        }
        
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
  }, [isOnline, offlineQueue, onAddAttendance, onAddAttendanceBatch, currentUser.nip]);

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
    if (todayRecords.some(r => r.status === 'Izin')) return;
    
    // Refresh GPS before opening camera
    getCurrentLocation();
    setIsCameraActive(true);
  };

  const handleSelectZone = (geo: Geofence) => {
    setSelectedLocation(geo);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F2F2F7] dark:bg-gray-950 text-gray-900 dark:text-gray-100 pb-24 font-sans select-none transition-colors duration-300">
      
      {/* TopAppBar with frosted-glass aesthetic */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 dark:bg-gray-900/80 dark:border-gray-800/50 flex justify-between items-center px-4 h-16 shadow-sm transition-colors duration-300">
        <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo Yayasan Baitul Hikmah" className="w-9 h-9 rounded-full object-cover" />
        </div>
        
        {/* User avatar with mini settings portal */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {/* Admin panel button - only for admins */}
          {isAdmin && onNavigateToAdmin && (
            <button
              onClick={onNavigateToAdmin}
              className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-all active:scale-95"
            >
              <ShieldAlert className="w-3 h-3" />
              Admin
            </button>
          )}
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
              className="bg-emerald-50 border border-emerald-100 px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs font-bold text-emerald-800 shadow-sm"
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
              <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200/50 dark:border-amber-800/50 p-4 rounded-2xl flex gap-3 text-xs text-amber-800 text-left">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <div className="space-y-1">
                  <p className="font-bold uppercase tracking-wider text-[10px]">Ada Antrean Presensi Offline</p>
                  <p className="leading-relaxed font-semibold">
                    Terdapat {offlineQueue.length} data presensi disimpan lokal. Hubungkan kembali ke internet untuk sinkronisasi otomatis ke server.
                  </p>
                </div>
              </div>
            )}

            {/* Lokasi Terkini - di atas scanner */}
            <div className="text-center">
              {nearestGeofence && isWithinGeofence ? (
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                  📍 {nearestGeofence.nama}
                </p>
              ) : nearestGeofence ? (
                <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
                  📍 {nearestGeofence.nama} ({distanceToNearest}m)
                </p>
              ) : userLocation ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  📍 {userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)}
                </p>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500">📍 Mendeteksi lokasi...</p>
              )}
            </div>

            {/* QR Scanner */}
            <section className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border-4 border-white shadow-lg bg-neutral-900">
              
              {isCameraActive ? (
                <>
                  <QRScanner
                    isActive={isCameraActive}
                    onScanSuccess={handleQRScanSuccess}
                    onScanError={(err) => {
                      console.error('Scan error:', err);
                      setScanError(err);
                    }}
                  />

                  {/* Viewfinder Frame Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center p-10 pointer-events-none">
                    <div className="w-full h-full max-w-[250px] max-h-[250px] border-2 border-white/30 rounded-2xl relative">
                      <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-[#0058bc] rounded-tl-lg" />
                      <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-[#0058bc] rounded-tr-lg" />
                      <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-[#0058bc] rounded-bl-lg" />
                      <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-[#0058bc] rounded-br-lg" />
                    </div>
                  </div>

                  {/* Guidance text */}
                  <div className="absolute bottom-4 left-0 right-0 text-center px-4 pointer-events-none z-10">
                    <span className="bg-black/60 backdrop-blur-md text-white text-[11px] font-semibold px-3 py-1.5 rounded-full">
                      Arahkan ke QR Code presensi
                    </span>
                  </div>

                  {/* Close button */}
                  <button
                    onClick={() => setIsCameraActive(false)}
                    className="absolute top-3 right-3 z-20 p-2 bg-black/60 backdrop-blur-md rounded-full text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
                  <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
                    <QrCode className="w-8 h-8 text-white/70" />
                  </div>
                  {scanError && (
                    <p className="text-rose-300 text-[10px] text-center mb-3 px-4">{scanError}</p>
                  )}
                  <button
                    onClick={() => { setScanError(null); setIsCameraActive(true); }}
                    className="bg-[#0058bc] text-white font-bold text-sm px-6 py-3 rounded-xl shadow-lg hover:brightness-110 active:scale-95 transition-all"
                  >
                    {activeSession ? 'Scan Keluar' : currentSession === 'malam' ? 'Scan Masuk Malam' : 'Scan Masuk Siang'}
                  </button>
                </div>
              )}

              {/* Disabled overlay when izin */}
              {todayRecords.some(r => r.status === 'Izin') && (
                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-20">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-2" />
                  <p className="text-white font-bold text-sm">Izin Hari Ini</p>
                </div>
              )}

              {/* Processing overlay */}
              {isScanning && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-20">
                  <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-white text-sm font-semibold">Memproses...</p>
                </div>
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
                      className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-xl mb-3"
                    >
                      <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
                    </motion.div>
                    
                    <motion.h2 
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="text-white text-lg font-bold"
                    >
                      Presensi Berhasil
                    </motion.h2>
                    
                    <motion.p 
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="text-emerald-200 text-xs mt-1"
                    >
                      {activeSession ? 'Presensi keluar tercatat' : 'Presensi masuk tercatat'}
                    </motion.p>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            {/* Reject Message Popup */}
            <AnimatePresence>
              {rejectMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-4 flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-5 h-5 text-rose-500 dark:text-rose-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-rose-700 dark:text-rose-400">{rejectMessage}</p>
                  </div>
                  <button
                    onClick={() => setRejectMessage(null)}
                    className="p-1 text-rose-400 hover:text-rose-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Attendance Status Card */}
            <section className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col gap-4 transition-colors duration-300">
              <div className="flex justify-center">
                <span className={`px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider ${
                  todayRecords.some(r => r.status === 'Izin')
                    ? 'bg-sky-100 text-sky-700 border border-sky-100'
                    : activeSession
                    ? 'bg-[#6ffb85]/20 text-[#00732a]'
                    : sessionTodayRecords.length > 0
                    ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                }`}>
                  {todayRecords.some(r => r.status === 'Izin') ? 'Izin' : activeSession ? 'Sedang Bekerja' : sessionTodayRecords.length > 0 ? `Sudah Absen ${currentSession === 'malam' ? 'Malam' : 'Siang'}` : `Belum Absen ${currentSession === 'malam' ? 'Malam' : 'Siang'}`}
                </span>
              </div>

              {todayRecords.some(r => r.status === 'Izin') ? (
                <div className="bg-sky-50/50 p-4 rounded-xl border border-sky-100 text-left">
                  <div className="flex items-center gap-2 text-sky-800 font-bold text-sm mb-1.5">
                    <FileText className="w-4 h-4 shrink-0" />
                    <span>Izin/Sakit Terdaftar</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                    {todayRecords.find(r => r.status === 'Izin')?.keterangan || 'Tanpa keterangan'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Masuk</p>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold text-lg text-emerald-600">
                        {activeSession ? activeSession.masuk : todayRecord?.masuk || '--:--'}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1 border-l border-gray-200 dark:border-gray-700 pl-4">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Keluar</p>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                      <span className="font-bold text-lg text-gray-700 dark:text-gray-300">
                        {activeSession ? '--:--' : todayRecord?.keluar || '--:--'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {todayRecords.length > 1 && (
                <p className="text-[10px] text-center text-gray-400 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-800">
                  {todayRecords.length} sesi kerja hari ini
                </p>
              )}

              <div className="pt-3.5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#0058bc] dark:text-[#3b82f6]" />
                  Jam Kerja <span className="font-semibold">{currentSession === 'malam' ? 'Malam' : 'Siang'}</span>: <span className="font-semibold text-gray-700 dark:text-gray-300">{currentLimitTime} - {currentJamPulang} WIB</span>
                </span>
              </div>
            </section>

            {/* Request Permit Banner */}
            {!todayRecords.some(r => r.status === 'Izin') && !activeSession && (
              <div className="bg-sky-500/10 rounded-2xl p-4 border border-sky-500/20 flex items-center justify-between gap-3 text-left transition-all duration-300">
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-[#0058bc] dark:text-[#3b82f6] uppercase tracking-wider">Berhalangan Hadir?</h4>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Ajukan izin sakit atau keperluan lainnya.</p>
                </div>
                <button
                  onClick={() => setIsPermitModalOpen(true)}
                  className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-[10px] uppercase tracking-wider px-3.5 py-2 rounded-xl shadow-md transition-all active:scale-95 shrink-0"
                >
                  Ajukan Izin
                </button>
              </div>
            )}

            {/* Zona Presensi Terdaftar */}
            <div className="bg-white dark:bg-gray-900 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 space-y-3 transition-colors duration-300">
              {/* Refresh location button */}
              <button
                onClick={getCurrentLocation}
                disabled={isLocating}
                className="w-full py-2 text-xs font-bold text-[#005bc1] dark:text-[#3b82f6] bg-[#005bc1]/5 rounded-lg hover:bg-[#005bc1]/10 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <MapPin className="w-3.5 h-3.5" />
                {isLocating ? 'Memuat lokasi...' : 'Perbarui Lokasi GPS'}
              </button>

              {/* Geofence list — hanya zona yang terjangkau yang ditampilkan & dapat dipilih */}
              {reachableGeofences.length > 0 && (
                <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Pilih Zona Presensi</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {reachableGeofences.map(g => {
                      const isSelected = selectedLocation?.id === g.id;
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => handleSelectZone(g)}
                          className={`text-center p-2 rounded-lg text-[10px] font-medium border transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[#0058bc] dark:border-blue-400 bg-blue-50 dark:bg-blue-950/40 text-[#0058bc] dark:text-blue-400 font-bold ring-2 ring-[#0058bc]/20'
                              : 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:brightness-95'
                          }`}
                        >
                          {g.nama} ({g.radius}m)
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-2 text-center">
                    Pilih zona yang terjangkau lokasi Anda.
                  </p>
                </div>
              )}
              {geofences.length > 0 && reachableGeofences.length === 0 && (
                <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Pilih Zona Presensi</p>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 text-center py-2">
                    Tidak ada zona yang terjangkau. Perbarui lokasi GPS atau mendekat ke area presensi.
                  </p>
                </div>
              )}
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
              <span className="text-xs bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2.5 py-1 rounded-full font-semibold">
                {personalRecords.length} Hari Kerja
              </span>
            </div>

            <div className="space-y-3">
              {personalRecords.map((r, idx) => (
                <div key={idx} className="bg-white dark:bg-gray-900 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 flex justify-between items-center transition-colors duration-300">
                  <div className="space-y-1 text-left">
                    <p className="font-bold text-gray-800 dark:text-gray-100 text-sm flex items-center gap-2">
                      {new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(r.tanggal))}
                      {r.isOfflinePending && (
                        <span className="text-[8px] px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 dark:text-amber-400 border border-amber-200 uppercase font-black tracking-wider animate-pulse shrink-0">
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
                              <span className="w-2 h-2 rounded-full bg-gray-400" />
                              Out: {r.keluar}
                            </span>
                          )}
                          <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                            (r.sesi ?? 'siang') === 'malam'
                              ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300'
                              : 'bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300'
                          }`}>
                            {r.sesi ?? 'siang'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      r.status === 'Tepat Waktu' 
                        ? 'bg-emerald-50 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800' 
                        : r.status === 'Izin'
                        ? 'bg-sky-50 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 border border-sky-100 dark:border-sky-800'
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
          const currentYearMonth = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}`;
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
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 space-y-4 transition-colors duration-300">
                <div className="flex items-center justify-between border-b border-gray-50 pb-3">
                  <div className="text-left">
                    <span className="text-[10px] font-bold text-[#0058bc] dark:text-[#3b82f6] uppercase tracking-wider">Laporan Bulanan</span>
                    <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">{currentMonthName}</h3>
                  </div>
                  <div className="px-2.5 py-1 bg-sky-50 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400 rounded-lg text-[10px] font-bold">
                    {monthlyTotal} Hari Kerja
                  </div>
                </div>

                {/* Simple Chart / Progress Indicator */}
                <div className="space-y-4">
                  {/* Horizontal Stacked Bar Chart */}
                  <div className="space-y-1.5 text-left">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Proporsi Kehadiran Bulanan</span>
                    <div className="h-4 w-full rounded-full bg-gray-100 dark:bg-gray-800 flex overflow-hidden">
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
                        <div className="w-full bg-gray-200 dark:bg-gray-800 text-center text-[10px] text-gray-400 dark:text-gray-500 flex items-center justify-center">
                          Belum ada data bulan ini
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Vertical Bar Chart (Clean programmatically drawn visual component) */}
                  <div className="flex justify-around items-end h-28 pt-4 pb-2 border-b border-gray-50">
                    {/* Tepat Waktu Bar */}
                    <div className="flex flex-col items-center gap-1.5 h-full justify-end w-16">
                      <span className="text-[10px] font-bold text-emerald-600">
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
                      <span className="text-[10px] font-bold text-rose-500">
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
                    <div className="p-2 rounded-xl bg-emerald-50/50 border border-emerald-100/50">
                      <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">Total Hadir</p>
                      <p className="text-base font-black text-emerald-800 mt-0.5">{monthlyTotalHadir}</p>
                      <p className="text-[9px] text-emerald-600">
                        {monthlyTotal > 0 ? ((monthlyTotalHadir / monthlyTotal) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                    <div className="p-2 rounded-xl bg-rose-50/50 border border-rose-100/50">
                      <p className="text-[10px] font-bold text-rose-700 dark:text-rose-400">Terlambat</p>
                      <p className="text-base font-black text-rose-800 mt-0.5">{monthlyTerlambat}</p>
                      <p className="text-[9px] text-rose-600">
                        {monthlyTotal > 0 ? ((monthlyTerlambat / monthlyTotal) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                    <div className="p-2 rounded-xl bg-sky-50/50 border border-sky-100/50">
                      <p className="text-[10px] font-bold text-sky-700">Total Izin</p>
                      <p className="text-base font-black text-sky-800 mt-0.5">{monthlyIzin}</p>
                      <p className="text-[9px] text-sky-600 dark:text-sky-400">
                        {monthlyTotal > 0 ? ((monthlyIzin / monthlyTotal) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Circular summary progress */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col items-center text-center gap-4 transition-colors duration-300">
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
                <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col gap-1 transition-colors duration-300">
                  <span className="text-xs text-gray-400 dark:text-gray-500 font-semibold text-left">Tepat Waktu</span>
                  <span className="text-2xl font-black text-emerald-600 text-left">
                    {personalRecords.filter(r => r.status === 'Tepat Waktu').length} Hari
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 text-left">Datang sebelum batas jam masuk</span>
                </div>
                <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col gap-1 transition-colors duration-300">
                  <span className="text-xs text-gray-400 dark:text-gray-500 font-semibold text-left">Terlambat</span>
                  <span className="text-2xl font-black text-rose-500 text-left">
                    {personalRecords.filter(r => r.status === 'Terlambat').length} Hari
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 text-left">Datang setelah {limitTime} WIB</span>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 flex justify-between items-center transition-colors duration-300">
                <div className="flex flex-col gap-1 text-left">
                  <span className="text-xs text-gray-400 dark:text-gray-500 font-semibold">Izin & Sakit Resmi</span>
                  <span className="text-2xl font-black text-sky-600 dark:text-sky-400">
                    {personalRecords.filter(r => r.status === 'Izin').length} Hari
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">Absen disetujui administrasi lembaga</span>
                </div>
                <div className="p-3 bg-sky-50 dark:bg-sky-900/50 rounded-xl text-sky-600 dark:text-sky-400">
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
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col items-center text-center gap-3 transition-colors duration-300">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-[#0058bc]/20 shadow-inner">
                  <img className="w-full h-full object-cover" src={currentUser.foto} alt={currentUser.nama} />
                </div>
                <button 
                  onClick={() => {
                    setIsEditingPhoto(true);
                    setCustomPhotoUrl(currentUser.foto);
                  }}
                  className="absolute bottom-0 right-0 p-2 bg-[#0058bc] hover:bg-[#00418f] text-white rounded-full shadow-lg transition-all active:scale-90 cursor-pointer"
                  title="Ganti Foto Profil"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>
              <div>
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Nama lengkap"
                      className="w-44 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm text-center focus:ring-2 focus:ring-[#0058bc]/20 outline-none text-gray-800 dark:text-gray-100"
                    />
                    <button
                      onClick={() => {
                        const name = editName.trim();
                        if (!name) return;
                        onUpdateEmployeeProfile?.(currentUser.nip, { nama: name });
                        setIsEditingName(false);
                      }}
                      className="px-3 py-2 rounded-xl text-xs font-bold text-white bg-[#0058bc] hover:bg-[#00418f] transition-colors"
                    >
                      Simpan
                    </button>
                    <button
                      onClick={() => setIsEditingName(false)}
                      className="px-2 py-2 rounded-xl text-xs font-bold text-gray-500 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      Batal
                    </button>
                  </div>
                ) : (
                  <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center justify-center gap-2">
                    {currentUser.nama}
                    <button
                      onClick={() => {
                        setEditName(currentUser.nama);
                        setIsEditingName(true);
                      }}
                      className="p-1 text-gray-400 hover:text-[#0058bc] transition-colors cursor-pointer"
                      title="Ganti Nama"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </h2>
                )}
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{currentUser.jabatan}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{currentUser.lembaga}</p>
              </div>
            </div>

            {/* Edit Jabatan & Lembaga */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-4 space-y-4 transition-colors duration-300">
              <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Profil Kepegawaian</h3>
              
              <div>
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-1">Jabatan</label>
                <select
                  value={currentUser.jabatan}
                  onChange={(e) => {
                    const updated = { ...currentUser, jabatan: e.target.value };
                    onChangeProfilePicture(currentUser.nip, currentUser.foto); // trigger re-render
                    // Update employee data via localStorage
                    const employees = JSON.parse(localStorage.getItem('baitul_hikmah_employees') || '[]');
                    const idx = employees.findIndex((emp: any) => emp.nip === currentUser.nip);
                    if (idx > -1) {
                      employees[idx].jabatan = e.target.value;
                      localStorage.setItem('baitul_hikmah_employees', JSON.stringify(employees));
                    }
                    // Update session
                    const session = JSON.parse(localStorage.getItem('baitul_hikmah_session') || '{}');
                    if (session?.user?.nip === currentUser.nip) {
                      session.user.jabatan = e.target.value;
                      localStorage.setItem('baitul_hikmah_session', JSON.stringify(session));
                    }
                    window.location.reload();
                  }}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#0058bc]/20 outline-none text-gray-800 dark:text-gray-100"
                >
                  <option value="Pendidik">Pendidik</option>
                  <option value="Tenaga Kependidikan">Tenaga Kependidikan</option>
                  <option value="Kepala Lembaga">Kepala Lembaga</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-1">Lembaga</label>
                <select
                  value={currentUser.lembaga}
                  onChange={(e) => {
                    // Update employee data via localStorage
                    const employees = JSON.parse(localStorage.getItem('baitul_hikmah_employees') || '[]');
                    const idx = employees.findIndex((emp: any) => emp.nip === currentUser.nip);
                    if (idx > -1) {
                      employees[idx].lembaga = e.target.value;
                      localStorage.setItem('baitul_hikmah_employees', JSON.stringify(employees));
                    }
                    // Update session
                    const session = JSON.parse(localStorage.getItem('baitul_hikmah_session') || '{}');
                    if (session?.user?.nip === currentUser.nip) {
                      session.user.lembaga = e.target.value;
                      localStorage.setItem('baitul_hikmah_session', JSON.stringify(session));
                    }
                    window.location.reload();
                  }}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#0058bc]/20 outline-none text-gray-800 dark:text-gray-100"
                >
                  <option value="Yayasan Baitul Hikmah">Yayasan Baitul Hikmah</option>
                  <option value="MTS Al-Hikmah">MTS Al-Hikmah</option>
                  <option value="MIS Al-Hikmah">MIS Al-Hikmah</option>
                  <option value="PKBM Al-Hikmah">PKBM Al-Hikmah</option>
                  <option value="KB Al-Hikmah">KB Al-Hikmah</option>
                </select>
              </div>
            </div>

            {/* Info Card */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800 transition-colors duration-300">
              <div className="p-4 flex justify-between items-center">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</span>
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{currentUser.email || '-'}</span>
              </div>
              <div className="p-4 flex justify-between items-center">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Jam Kerja</span>
                <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">{limitTime} WIB</span>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 font-bold text-sm hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-all active:scale-[0.98]"
            >
              <LogOut className="w-4 h-4" />
              Keluar dari Akun
            </button>

          </motion.div>
        )}

      </main>

      {/* Bottom Tab Navigation Bar with frosted glass */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-gray-200/50 dark:bg-gray-900/90 dark:border-gray-800/50 flex justify-around items-center px-4 py-2 shadow-lg transition-colors duration-300">
        <button 
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
            activeTab === 'home' ? 'text-[#0058bc] dark:text-[#3b82f6] scale-105 font-bold' : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-300'
          }`}
        >
          <Home className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Home</span>
        </button>

        <button 
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
            activeTab === 'history' ? 'text-[#0058bc] dark:text-[#3b82f6] scale-105 font-bold' : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-300'
          }`}
        >
          <History className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">History</span>
        </button>

        <button 
          onClick={() => setActiveTab('stats')}
          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
            activeTab === 'stats' ? 'text-[#0058bc] dark:text-[#3b82f6] scale-105 font-bold' : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-300'
          }`}
        >
          <BarChart2 className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Stats</span>
        </button>

        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
            activeTab === 'profile' ? 'text-[#0058bc] dark:text-[#3b82f6] scale-105 font-bold' : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-300'
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
              className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl border border-gray-100 dark:border-gray-800 flex flex-col gap-5 overflow-y-auto max-h-[90vh] transition-colors duration-300 text-left"
            >
              <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#0058bc] dark:text-[#3b82f6]" />
                  <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Form Pengajuan Izin</h3>
                </div>
                <button 
                  onClick={() => setIsPermitModalOpen(false)}
                  className="p-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-400 transition-colors cursor-pointer"
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
                            ? 'border-sky-500 bg-sky-500/10 text-sky-700 font-bold shadow-sm'
                            : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
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
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300">
                    <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500" />
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
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0058bc]/20 text-xs font-medium text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                  />
                </div>

                {/* File Attachment Upload */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Unggah Lampiran Bukti (Opsional)</label>
                  
                  {permitFile ? (
                    <div className="relative rounded-xl overflow-hidden border border-sky-200 bg-sky-50/50 p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img src={permitFile} className="w-10 h-10 object-cover rounded-lg border border-sky-200/50" alt="Attachment" />
                        <div className="min-w-0 text-left">
                          <p className="text-[10px] font-bold text-sky-800 truncate">Dokumen_Izin.jpg</p>
                          <p className="text-[9px] text-sky-600 dark:text-sky-400">File berhasil dipindai</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setPermitFile(null)}
                        className="p-1 rounded-full bg-sky-200/50 text-sky-800 hover:bg-sky-200"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-sky-500 rounded-xl p-4 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-all text-center">
                        <Upload className="w-5 h-5 text-gray-400 dark:text-gray-500 mb-1" />
                        <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">Pilih file / Ambil Foto</span>
                        <span className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5">JPEG, PNG maks 2MB</span>
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
                  className="flex-1 py-3 text-xs font-bold rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
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
                    const todayStr = localDateString();
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
                      lokasi: currentUser.lembaga || 'Umum',
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
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditingPhoto(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div 
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl border border-gray-100 dark:border-gray-800 flex flex-col gap-5 transition-colors duration-300 text-left"
            >
              <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-[#0058bc] dark:text-[#3b82f6]" />
                  <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Ganti Foto Profil</h3>
                </div>
                <button 
                  onClick={() => setIsEditingPhoto(false)}
                  className="p-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-400 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Preview current photo */}
              <div className="flex justify-center">
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-[#0058bc]/20">
                  <img className="w-full h-full object-cover" src={currentUser.foto} alt={currentUser.nama} />
                </div>
              </div>

              {/* Upload from device */}
              <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-[#0058bc] dark:hover:border-[#3b82f6] rounded-2xl p-6 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-all">
                <div className="w-12 h-12 rounded-full bg-[#0058bc]/10 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-[#0058bc] dark:text-[#3b82f6]" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Pilih Foto dari Perangkat</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">Format: JPG, PNG (maks 2MB)</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 2 * 1024 * 1024) {
                        alert('Ukuran file maksimal 2MB.');
                        return;
                      }
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

              <button
                type="button"
                onClick={() => setIsEditingPhoto(false)}
                className="w-full py-2.5 text-xs font-bold rounded-xl border border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              >
                Batal
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
