/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
  Info
} from 'lucide-react';
import { Employee, AttendanceRecord, Geofence } from '../types';
import { ASSETS } from '../data';

interface EmployeeAppProps {
  currentUser: Employee;
  geofences: Geofence[];
  attendanceRecords: AttendanceRecord[];
  onAddAttendance: (record: AttendanceRecord) => void;
  onNavigateToAdmin: () => void;
}

export default function EmployeeApp({
  currentUser,
  geofences,
  attendanceRecords,
  onAddAttendance,
  onNavigateToAdmin
}: EmployeeAppProps) {
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'stats' | 'profile'>('home');
  const [scanMethod, setScanMethod] = useState<'qr' | 'wajah'>('qr');
  const [selectedLocation, setSelectedLocation] = useState<Geofence | null>(() => geofences[2] || geofences[0] || null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  
  // Track personal records
  const personalRecords = attendanceRecords.filter(r => r.nip === currentUser.nip);
  
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

  const handleSimulateScan = () => {
    if (todayRecord && todayRecord.keluar) return; // already fully checked out

    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setScanSuccess(true);
      
      const isCheckIn = !todayRecord;
      const currentHrsMins = formatClock(currentTime);

      if (isCheckIn) {
        // Formulate check-in status (Limit is 07:00 as per admin settings)
        const checkInHour = currentTime.getHours();
        const checkInMinute = currentTime.getMinutes();
        const isLate = checkInHour > 7 || (checkInHour === 7 && checkInMinute > 0);
        
        const newRecord: AttendanceRecord = {
          id: `rec-${Date.now()}`,
          nip: currentUser.nip,
          nama: currentUser.nama,
          foto: currentUser.foto,
          tanggal: todayStr,
          masuk: currentHrsMins,
          status: isLate ? 'Terlambat' : 'Tepat Waktu',
          lokasi: selectedLocation?.nama || 'Kantor Pusat'
        };
        onAddAttendance(newRecord);
      } else {
        // Checkout today's record
        const updatedRecord = {
          ...todayRecord,
          keluar: currentHrsMins
        } as AttendanceRecord;
        onAddAttendance(updatedRecord);
      }

      // Automatically hide success screen after 3 seconds
      setTimeout(() => {
        setScanSuccess(false);
      }, 3500);

    }, 2000);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F2F2F7] text-gray-900 pb-24 font-sans select-none">
      
      {/* TopAppBar with frosted-glass aesthetic */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 flex justify-between items-center px-4 h-16 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-[#0058bc] p-2 rounded-xl text-white flex items-center justify-center shadow-md">
            <QrCode className="w-5 h-5" />
          </div>
          <span className="font-bold text-lg tracking-tight text-[#0058bc]">Baitul Hikmah</span>
        </div>
        
        {/* User avatar with mini settings portal */}
        <div className="flex items-center gap-2">
          <button 
            onClick={onNavigateToAdmin} 
            className="hidden sm:flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-[#0058bc]/10 text-[#0058bc] hover:bg-[#0058bc]/20 transition-all active:scale-95"
          >
            Portal Admin
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          
          <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-200 shadow-sm">
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
        
        {activeTab === 'home' && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {/* Greeting & Time display matching mockup */}
            <header className="flex justify-between items-end">
              <div>
                <span className="text-sm font-medium text-gray-500">{getGreeting()}, {currentUser.nama}</span>
                <h1 className="text-xl font-bold text-gray-800">
                  {new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).format(currentTime)}
                </h1>
              </div>
              <div className="text-right">
                <span className="text-4xl font-extrabold text-[#0058bc] tracking-tight tabular-nums">
                  {formatClock(currentTime)}
                </span>
                <span className="ml-1.5 text-xs font-semibold text-gray-400">WIB</span>
              </div>
            </header>

            {/* Attendance Status Card */}
            <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Status Kerja Hari Ini</span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  todayRecord?.keluar 
                    ? 'bg-gray-100 text-gray-500' 
                    : todayRecord 
                    ? 'bg-[#6ffb85]/20 text-[#00732a]' 
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {todayRecord?.keluar ? 'Selesai' : todayRecord ? 'Aktif' : 'Belum Absen'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Jam Masuk</p>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-lg text-emerald-600">
                      {todayRecord ? todayRecord.masuk : '--:--'}
                    </span>
                    {todayRecord?.status === 'Terlambat' && (
                      <span className="text-[10px] font-semibold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">Terlambat</span>
                    )}
                    {todayRecord?.status === 'Tepat Waktu' && (
                      <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">Tepat</span>
                    )}
                  </div>
                </div>

                <div className="space-y-1 border-l border-gray-200 pl-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Jam Keluar</p>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="font-bold text-lg text-gray-700">
                      {todayRecord?.keluar ? todayRecord.keluar : '--:--'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3.5 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#0058bc]" />
                  Shift: <span className="font-semibold text-gray-700">Reguler (08:00 - 17:00)</span>
                </span>
              </div>
            </section>

            {/* Segmented Control for Scan Method */}
            <div className="bg-gray-200 p-1 rounded-xl flex shadow-inner">
              <button 
                onClick={() => setScanMethod('qr')}
                className={`flex-1 py-2 font-medium text-sm rounded-lg transition-all ${
                  scanMethod === 'qr' ? 'bg-white shadow-sm text-[#0058bc] font-bold' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                QR Code
              </button>
              <button 
                onClick={() => setScanMethod('wajah')}
                className={`flex-1 py-2 font-medium text-sm rounded-lg transition-all ${
                  scanMethod === 'wajah' ? 'bg-white shadow-sm text-[#0058bc] font-bold' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Wajah
              </button>
            </div>

            {/* Simulated Camera Viewfinder with Success Overlay */}
            <section className="relative aspect-square w-full overflow-hidden rounded-3xl border-4 border-white shadow-lg bg-neutral-900 group">
              
              {/* Background Mock Feed */}
              <div 
                className={`absolute inset-0 bg-cover bg-center transition-all duration-500 ${
                  isScanning ? 'scale-105 brightness-110' : 'scale-100 brightness-75'
                }`}
                style={{
                  backgroundImage: `url(${scanMethod === 'qr' ? ASSETS.cameraPOV : ASSETS.officeBlur})`
                }}
              />

              {/* Laser Scanning Animation */}
              {isScanning && (
                <div className="absolute inset-0 bg-black/20 pointer-events-none">
                  {/* Laser line */}
                  <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#0058bc] to-transparent shadow-[0_0_15px_#0058bc] animate-pulse" 
                       style={{
                         top: '10%',
                         animation: 'scan-motion 2s ease-in-out infinite'
                       }}
                  />
                  <style>{`
                    @keyframes scan-motion {
                      0% { top: 10%; }
                      50% { top: 90%; }
                      100% { top: 10%; }
                    }
                  `}</style>
                </div>
              )}

              {/* Viewfinder Frame Overlay */}
              <div className="absolute inset-0 flex items-center justify-center p-12">
                <div className="w-full h-full border-2 border-white/30 rounded-2xl relative">
                  {/* Corners */}
                  <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-[#0058bc] rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-[#0058bc] rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-[#0058bc] rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-[#0058bc] rounded-br-lg" />
                </div>
              </div>

              {/* Ambient Guidance Indicator */}
              {!isScanning && !scanSuccess && (
                <div className="absolute bottom-6 left-0 right-0 text-center px-4">
                  <span className="bg-black/60 backdrop-blur-md text-white text-xs font-semibold px-4 py-2 rounded-full inline-flex items-center gap-2 shadow-sm">
                    <Camera className="w-3.5 h-3.5 text-[#005bc1]" />
                    Posisikan {scanMethod === 'qr' ? 'QR Code' : 'Wajah'} dalam bingkai
                  </span>
                </div>
              )}

              {/* Success Screen Overlay (Beautifully animated with Framer Motion equivalent) */}
              <AnimatePresence>
                {scanSuccess && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-emerald-950/90 backdrop-blur-md flex flex-col items-center justify-center text-center p-6"
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
                      Scan Berhasil
                    </motion.h2>
                    
                    <motion.p 
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="text-emerald-200 text-sm mt-1 max-w-[200px]"
                    >
                      Data absen {todayRecord?.keluar ? 'keluar' : 'masuk'} telah tersimpan
                    </motion.p>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            {/* Geofence Proximity Proving Ground Selector */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-3">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="flex items-center gap-1 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-[#005bc1]" />
                  Simulasi Lokasi Perangkat
                </span>
                <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Dalam Radius
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                {geofences.map(g => (
                  <button
                    key={g.id}
                    onClick={() => setSelectedLocation(g)}
                    className={`text-center p-2 rounded-lg text-xs font-medium border transition-all ${
                      selectedLocation?.id === g.id 
                        ? 'border-[#0058bc] bg-[#0058bc]/5 text-[#0058bc] font-bold shadow-sm' 
                        : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {g.nama}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 p-2.5 rounded-lg">
                <Compass className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="truncate">
                  Terdeteksi: <strong className="text-gray-700">{selectedLocation?.nama || 'Tidak terdeteksi'}</strong> {selectedLocation ? `(${selectedLocation.lat}, ${selectedLocation.lng})` : ''}
                </span>
              </div>
            </div>

            {/* Check-In / Check-Out Action Button */}
            <div className="pt-2">
              <button
                disabled={isScanning || (todayRecord?.masuk && todayRecord?.keluar)}
                onClick={handleSimulateScan}
                className={`w-full h-14 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] ${
                  isScanning 
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : (todayRecord?.masuk && todayRecord?.keluar)
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : todayRecord
                    ? 'bg-amber-500 text-white hover:bg-amber-600'
                    : 'bg-[#005bc1] text-white hover:bg-[#0070eb]'
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
              <h2 className="text-xl font-bold text-gray-800">Riwayat Presensi</h2>
              <span className="text-xs bg-gray-200 text-gray-600 px-2.5 py-1 rounded-full font-semibold">
                {personalRecords.length} Hari Kerja
              </span>
            </div>

            <div className="space-y-3">
              {personalRecords.map((r, idx) => (
                <div key={idx} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex justify-between items-center">
                  <div className="space-y-1">
                    <p className="font-bold text-gray-800 text-sm">
                      {new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(r.tanggal))}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
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
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      r.status === 'Tepat Waktu' 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                        : 'bg-rose-50 text-rose-700 border border-rose-100'
                    }`}>
                      {r.status}
                    </span>
                    <p className="text-[10px] text-gray-400 mt-1">{r.lokasi || 'Kantor Pusat'}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'stats' && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            <h2 className="text-xl font-bold text-gray-800">Ringkasan Statistik</h2>
            
            {/* Circular summary progress */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col items-center text-center gap-4">
              <div className="relative w-32 h-32 flex items-center justify-center">
                {/* SVG circular track */}
                <svg className="absolute w-full h-full transform -rotate-90">
                  <circle cx="64" cy="64" r="54" strokeWidth="8" stroke="#f3f4f6" fill="transparent" />
                  <circle cx="64" cy="64" r="54" strokeWidth="8" stroke="#0058bc" fill="transparent" 
                          strokeDasharray={339.3}
                          strokeDashoffset={339.3 - (339.3 * 94.2) / 100}
                          strokeLinecap="round"
                  />
                </svg>
                <div className="text-center">
                  <span className="text-2xl font-black text-gray-800">94.2%</span>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Hadir</p>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-gray-800">Performa Kehadiran Bagus</h3>
                <p className="text-xs text-gray-500 max-w-[280px] mt-1">
                  Pertahankan catatan kehadiran Anda untuk mempertahankan kompensasi optimal dan poin kinerja lembaga.
                </p>
              </div>
            </div>

            {/* Metrics Breakdown Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-1">
                <span className="text-xs text-gray-400 font-semibold">Tepat Waktu</span>
                <span className="text-2xl font-black text-emerald-600">
                  {personalRecords.filter(r => r.status === 'Tepat Waktu').length} Hari
                </span>
                <span className="text-[10px] text-gray-400">Datang sebelum batas jam masuk</span>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-1">
                <span className="text-xs text-gray-400 font-semibold">Terlambat</span>
                <span className="text-2xl font-black text-rose-500">
                  {personalRecords.filter(r => r.status === 'Terlambat').length} Hari
                </span>
                <span className="text-[10px] text-gray-400">Datang setelah 07:00 WIB</span>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'profile' && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Header info */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col items-center text-center gap-3">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-[#0058bc]/20 shadow-inner">
                <img className="w-full h-full object-cover" src={currentUser.foto} alt={currentUser.nama} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800">{currentUser.nama}</h2>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{currentUser.jabatan}</p>
                <span className="inline-block mt-2 text-xs bg-gray-100 text-gray-600 font-medium px-3 py-1 rounded-full">
                  NIP: {currentUser.nip}
                </span>
              </div>
            </div>

            {/* Detail Group Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-100">
              <div className="p-4 flex justify-between items-center">
                <span className="text-sm font-medium text-gray-500">Lembaga</span>
                <span className="text-sm font-semibold text-gray-800">{currentUser.lembaga}</span>
              </div>
              <div className="p-4 flex justify-between items-center">
                <span className="text-sm font-medium text-gray-500">Status Pegawai</span>
                <span className="text-sm font-semibold text-emerald-600">Tetap (Aktif)</span>
              </div>
              <div className="p-4 flex justify-between items-center">
                <span className="text-sm font-medium text-gray-500">Batas Absen</span>
                <span className="text-sm font-semibold text-amber-700">07:00 WIB</span>
              </div>
            </div>

            {/* Portal toggle to Admin Panel */}
            <div className="bg-[#0058bc]/5 rounded-xl p-4 border border-[#0058bc]/10 flex justify-between items-center">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-[#0058bc] uppercase tracking-wider">Akses Administrator</p>
                <p className="text-xs text-gray-500">Masuk ke modul panel admin monitoring</p>
              </div>
              <button 
                onClick={onNavigateToAdmin}
                className="bg-[#0058bc] text-white p-2.5 rounded-xl shadow-md hover:bg-[#0070eb] active:scale-95 transition-all"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}

      </main>

      {/* Bottom Tab Navigation Bar with frosted glass */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-gray-200/50 flex justify-around items-center px-4 py-2 shadow-lg">
        <button 
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
            activeTab === 'home' ? 'text-[#0058bc] scale-105 font-bold' : 'text-gray-400 hover:text-gray-700'
          }`}
        >
          <Home className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Home</span>
        </button>

        <button 
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
            activeTab === 'history' ? 'text-[#0058bc] scale-105 font-bold' : 'text-gray-400 hover:text-gray-700'
          }`}
        >
          <History className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">History</span>
        </button>

        <button 
          onClick={() => setActiveTab('stats')}
          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
            activeTab === 'stats' ? 'text-[#0058bc] scale-105 font-bold' : 'text-gray-400 hover:text-gray-700'
          }`}
        >
          <BarChart2 className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Stats</span>
        </button>

        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
            activeTab === 'profile' ? 'text-[#0058bc] scale-105 font-bold' : 'text-gray-400 hover:text-gray-700'
          }`}
        >
          <User className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Profile</span>
        </button>
      </nav>

    </div>
  );
}
