/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  CheckCircle,
  Clock,
  UserX,
  Plus,
  Search,
  Trash2,
  Download,
  ChevronLeft,
  ChevronRight,
  MapPin,
  QrCode,
  LogOut,
  LayoutDashboard,
  FileText,
  ArrowLeft,
  Settings,
  UserPlus,
  Check,
  X,
  AlertTriangle,
  Printer,
  Edit3,
  CloudUpload
} from 'lucide-react';
import { Employee, AttendanceRecord, Geofence, RecentActivity } from '../types';
import { ASSETS, localDateString } from '../data';
import { downloadImage, saveTextFile } from '../downloadQR';
import ThemeToggle from './ThemeToggle';

interface AdminPanelProps {
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  geofences: Geofence[];
  recentActivities: RecentActivity[];
  limitTime: string;
  jamPulang: string;
  jamMalamMasuk: string;
  jamMalamPulang: string;
  hariLibur: number[];
  onSetLimitTime: (time: string) => void;
  onSetJamPulang: (time: string) => void;
  onSetJamMalamMasuk: (time: string) => void;
  onSetJamMalamPulang: (time: string) => void;
  onSetHariLibur: (days: number[]) => void;
  onDeleteEmployee: (nip: string) => void;
  onAddGeofence: (geo: Geofence) => void;
  onUpdateGeofence: (id: string, updates: Partial<Geofence>) => void;
  onDeleteGeofence: (id: string) => void;
  onSyncGeofences?: () => Promise<void>;
  onBackToEmployee: () => void;
  adminProfile: { nama: string; foto: string; role: string };
  onChangeAdminProfilePicture: (newFoto: string) => void;
  onLogout: () => void;
  adminEmails?: string[];
  onAddAdminEmail?: (email: string) => void;
  onRemoveAdminEmail?: (email: string) => void;
}

export default function AdminPanel({
  employees,
  attendanceRecords,
  geofences,
  recentActivities,
  limitTime,
  jamPulang: jamPulangProp,
  jamMalamMasuk: jamMalamMasukProp,
  jamMalamPulang: jamMalamPulangProp,
  hariLibur: hariLiburProp,
  onSetLimitTime,
  onSetJamPulang,
  onSetJamMalamMasuk,
  onSetJamMalamPulang,
  onSetHariLibur,
  onDeleteEmployee,
  onAddGeofence,
  onUpdateGeofence,
  onDeleteGeofence,
  onSyncGeofences,
  onBackToEmployee,
  adminProfile,
  onChangeAdminProfilePicture,
  onLogout,
  adminEmails = [],
  onAddAdminEmail,
  onRemoveAdminEmail,
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'karyawan' | 'presensi' | 'pengaturan'>('dashboard');
  
  // Admin email management state
  const [newAdminEmail, setNewAdminEmail] = useState('');

  // Custom QR generation state
  const [customQrNama, setCustomQrNama] = useState('');
  const [customQrLat, setCustomQrLat] = useState('');
  const [customQrLng, setCustomQrLng] = useState('');
  const [customQrRadius, setCustomQrRadius] = useState('100');
  const [customQrGenerated, setCustomQrGenerated] = useState(false);
  const [customQrDataUrl, setCustomQrDataUrl] = useState('');
  const [customQrImgError, setCustomQrImgError] = useState(false);
  const customQrRef = useRef<HTMLDivElement>(null);

  // Sinkronisasi lokasi/geofence ke cloud
  const [geofenceSyncState, setGeofenceSyncState] = useState<'idle' | 'syncing' | 'ok' | 'error'>('idle');

  // State for editing existing QR/location
  const [editingGeoId, setEditingGeoId] = useState<string | null>(null);
  const [editQrNama, setEditQrNama] = useState('');
  const [editQrLat, setEditQrLat] = useState('');
  const [editQrLng, setEditQrLng] = useState('');
  const [editQrRadius, setEditQrRadius] = useState('');

  // Admin custom profile picture states
  const [adminCustomPhotoUrl, setAdminCustomPhotoUrl] = useState('');
  const [isEditingAdminPhoto, setIsEditingAdminPhoto] = useState(false);
  const [viewingAttachment, setViewingAttachment] = useState<string | null>(null);
  const [attachmentTitle, setAttachmentTitle] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');

  // State for QR generation

  // Pagination for Attendance logs
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Filter for attendance logs
  const [monthFilter, setMonthFilter] = useState('Semua');
  const [yearFilter, setYearFilter] = useState('2026');

  // Set Waktu input state
  const [tempLimitTime, setTempLimitTime] = useState(limitTime);
  const [tempJamPulang, setTempJamPulang] = useState(jamPulangProp);
  const [tempJamMalamMasuk, setTempJamMalamMasuk] = useState(jamMalamMasukProp);
  const [tempJamMalamPulang, setTempJamMalamPulang] = useState(jamMalamPulangProp);
  const [hariLibur, setHariLibur] = useState<number[]>(hariLiburProp);

  // Sinkronkan nilai formulari dari data cloud saat prop berubah (misal rubah di admin lain),
  // biar form selalu tampil nilai server terbaru, bukan nilai button yang tamene di app ini.
  useEffect(() => {
    setTempLimitTime(limitTime);
    setTempJamMalamPulang(jamMalamPulangProp);
  }, [limitTime, jamMalamPulangProp]);

  useEffect(() => {
    if (hariLiburProp.length !== hariLibur.length || hariLibur.some((d, i) => d !== hariLiburProp[i])) {
      setHariLibur(hariLiburProp);
    }
  }, [hariLiburProp]);

  // CSV Exporter
  // CSV Exporter with injection prevention
  const sanitizeCSVField = (field: string): string => {
    // Prevent CSV injection: if field starts with =, +, -, @ prepend a single quote
    if (/^[=+\-@]/.test(field)) {
      return `'${field}`;
    }
    // Wrap in quotes if contains comma or quotes
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  };

  const handleExportCSV = async () => {
    if (filteredAttendance.length === 0) {
      alert('Tidak ada data presensi yang cocok dengan filter untuk diexport.');
      return;
    }
    const headers = ['Tanggal', 'NIP', 'Nama', 'Sesi', 'Masuk', 'Keluar', 'Status', 'Lokasi'];
    const rows = filteredAttendance.map(r => [
      r.tanggal,
      r.nip,
      sanitizeCSVField(r.nama),
      r.sesi || 'siang',
      r.masuk,
      r.keluar || '--:--',
      r.status,
      sanitizeCSVField(r.lokasi || 'Kantor Pusat')
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
    try {
      await saveTextFile(csvContent, `rekap_presensi_${monthFilter}_${yearFilter}.csv`, 'text/csv');
    } catch (err: any) {
      console.error('Gagal export CSV:', err);
      alert(err?.message || 'Gagal mengekspor CSV.');
    }
  };

  const handlePrint = () => {
    if (filteredAttendance.length === 0) {
      alert('Tidak ada data presensi yang cocok dengan filter untuk dicetak.');
      return;
    }

    const title = `Rekap Presensi ${monthFilter === 'Semua' ? 'Semua Bulan' : monthFilter} ${yearFilter === 'Semua' ? 'Semua Tahun' : yearFilter}`;
    const tableHeader = `<tr>
      <th>Tanggal</th><th>NIP</th><th>Nama</th><th>Jabatan</th><th>Lembaga</th>
      <th>Sesi</th><th>Masuk</th><th>Keluar</th><th>Status</th><th>Lokasi</th>
    </tr>`;
    const tableBody = filteredAttendance.map(r => {
      const emp = employees.find(e => e.nip === r.nip);
      return `<tr>
        <td>${r.tanggal}</td>
        <td>${r.nip}</td>
        <td>${r.nama}</td>
        <td>${emp?.jabatan || ''}</td>
        <td>${emp?.lembaga || ''}</td>
        <td>${r.sesi || 'siang'}</td>
        <td>${r.masuk}</td>
        <td>${r.keluar || '--:--'}</td>
        <td>${r.status}</td>
        <td>${r.lokasi || 'Kantor Pusat'}</td>
      </tr>`;
    }).join('');

    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) {
      alert('Popup diblokir. Izinkan popup untuk mencetak rekap.');
      return;
    }

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; padding: 24px; color: #111; }
    .header { text-align: center; margin-bottom: 20px; }
    .header h1 { font-size: 18px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
    .header h2 { font-size: 14px; font-weight: 600; margin-top: 4px; }
    .header p { font-size: 11px; color: #555; margin-top: 4px; }
    .meta { font-size: 11px; margin-bottom: 12px; display: flex; justify-content: space-between; }
    table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    th, td { border: 1px solid #999; padding: 5px 6px; text-align: left; }
    th { background: #e2e8f0; font-weight: bold; text-transform: uppercase; font-size: 9.5px; }
    tr:nth-child(even) { background: #f8fafc; }
    .footer { margin-top: 24px; display: flex; justify-content: space-between; font-size: 11px; }
    .signature { text-align: center; }
    .signature .name { margin-top: 56px; font-weight: bold; text-decoration: underline; }
    @media print { body { padding: 12px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>Rekap Presensi Karyawan</h1>
    <h2>Yayasan Baitul Hikmah</h2>
    <p>${title}</p>
  </div>
  <div class="meta">
    <span>Total Data: <strong>${filteredAttendance.length}</strong> baris</span>
    <span>Dicetak: ${localDateString()}</span>
  </div>
  <table>
    <thead>${tableHeader}</thead>
    <tbody>${tableBody}</tbody>
  </table>
  <div class="footer">
    <div class="signature">
      <p>Mengetahui,<br/>Kepala Yayasan Baitul Hikmah</p>
      <div class="name">(____________________)</div>
    </div>
    <div class="signature">
      <p>Pekalongan, ${localDateString()}<br/>Admin Presensi</p>
      <div class="name">(____________________)</div>
    </div>
  </div>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
  };

  // Compute live dashboard metrics
  const totalEmployees = employees.length;
  
  // Attendance metrics matching the 2x2 grid
  const todayStr = localDateString();
  const todayRecords = attendanceRecords.filter(r => r.tanggal === todayStr);
  const totalHadir = todayRecords.length;
  const totalTerlambat = todayRecords.filter(r => r.status === 'Terlambat').length;
  const totalBelumAbsen = Math.max(0, totalEmployees - totalHadir);

  // Filter employees list by search query
  const filteredEmployees = employees.filter(emp => 
    emp.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.nip.includes(searchQuery)
  );

  // Filter attendance records
  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const filteredAttendance = attendanceRecords.filter(rec => {
    // Basic date parsing (guard record tanpa tanggal agar tidak crash)
    const recYear = rec.tanggal?.split('-')[0];
    const recMonthNum = rec.tanggal?.split('-')[1]; // "06"
    
    const recMonthName = monthNames[parseInt(recMonthNum, 10) - 1] || '';

    const matchesYear = yearFilter === 'Semua' || recYear === yearFilter;
    const matchesMonth = monthFilter === 'Semua' || recMonthName.toLowerCase().includes(monthFilter.toLowerCase());

    return matchesYear && matchesMonth;
  });

  // Dynamic year/month options derived from actual attendance data
  const availableYears = [...new Set(attendanceRecords.map(r => r.tanggal?.split('-')[0]).filter(Boolean))].sort().reverse();
  const availableMonths = [...new Set(attendanceRecords.map(r => r.tanggal?.split('-')[1]).filter(Boolean))]
    .map(m => ({ num: m, name: monthNames[parseInt(m, 10) - 1] || '' }))
    .sort((a, b) => parseInt(a.num, 10) - parseInt(b.num, 10));

  // Paginated records
  const totalEntries = filteredAttendance.length;
  const totalPages = Math.ceil(totalEntries / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedAttendance = filteredAttendance.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="flex flex-col min-h-screen bg-[#F9F9FF] text-gray-900 font-sans pb-24 md:pb-0 select-none transition-colors duration-300 dark:bg-gray-950 dark:text-gray-100">
      
      {/* Admin Top App Bar */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100/50 flex justify-between items-center px-4 md:px-6 h-16 shadow-sm dark:bg-gray-900/80 dark:border-gray-800/50">
        <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo Yayasan Baitul Hikmah" className="w-9 h-9 rounded-full object-cover" />
          <h1 className="font-bold text-lg text-gray-800 tracking-tight">Admin Panel</h1>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Quick toggle to Employee Mode */}
          <button 
            onClick={onBackToEmployee}
            className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all active:scale-95 cursor-pointer dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Mode Pegawai
          </button>

          <ThemeToggle className="ml-2" />
        </div>
      </header>

      {/* Main Layout Area - Includes Sidebar on MD+ screen sizes */}
      <div className="flex-grow flex">
        
        {/* Left Sidebar for Desktop Viewports */}
        <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-100 py-6 px-4 shrink-0 gap-1 dark:bg-gray-900 dark:border-gray-800">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'dashboard' 
                ? 'bg-[#00418f]/10 text-[#00418f] font-bold shadow-sm dark:bg-blue-900/30 dark:text-blue-400' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </button>

          <button 
            onClick={() => setActiveTab('karyawan')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'karyawan' 
                ? 'bg-[#00418f]/10 text-[#00418f] font-bold shadow-sm dark:bg-blue-900/30 dark:text-blue-400' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
            }`}
          >
            <Users className="w-4 h-4" />
            Karyawan
          </button>

          <button 
            onClick={() => setActiveTab('presensi')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'presensi' 
                ? 'bg-[#00418f]/10 text-[#00418f] font-bold shadow-sm dark:bg-blue-900/30 dark:text-blue-400' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            Data Presensi
          </button>

          <button 
            onClick={() => setActiveTab('pengaturan')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'pengaturan' 
                ? 'bg-[#00418f]/10 text-[#00418f] font-bold shadow-sm dark:bg-blue-900/30 dark:text-blue-400' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
            }`}
          >
            <Settings className="w-4 h-4" />
            Pengaturan
          </button>

        </aside>

        {/* Content Canvas */}
        <main className="flex-grow p-4 md:p-8 max-w-5xl mx-auto w-full space-y-6 overflow-x-hidden">
          
          {activeTab === 'dashboard' && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }} 
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <h2 className="text-xl md:text-2xl font-extrabold text-gray-800 tracking-tight">Ringkasan Kehadiran</h2>
                <p className="text-xs text-gray-400">Statistik real-time monitoring kehadiran karyawan hari ini.</p>
              </div>

              {/* 2x2 Stats Grid from HTML templates */}
              <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Total Karyawan */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-2 hover:translate-y-[-2px] transition-transform duration-200 dark:bg-gray-900 dark:border-gray-800">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 flex items-center justify-center dark:bg-emerald-900/30 dark:text-emerald-400">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-gray-400 font-semibold text-xs uppercase tracking-wider dark:text-gray-500">Total Karyawan</p>
                    <p className="text-2xl font-black text-gray-800 dark:text-gray-100">{totalEmployees}</p>
                  </div>
                </div>

                {/* Hadir Hari Ini */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-2 hover:translate-y-[-2px] transition-transform duration-200 dark:bg-gray-900 dark:border-gray-800">
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-[#00418f] dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-gray-400 font-semibold text-xs uppercase tracking-wider dark:text-gray-500">Hadir Hari Ini</p>
                    <p className="text-2xl font-black text-[#00418f] dark:text-blue-400">{totalHadir}</p>
                  </div>
                </div>

                {/* Terlambat */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-2 hover:translate-y-[-2px] transition-transform duration-200 dark:bg-gray-900 dark:border-gray-800">
                  <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-gray-400 font-semibold text-xs uppercase tracking-wider">Terlambat</p>
                    <p className="text-2xl font-black text-amber-700 dark:text-amber-400">{totalTerlambat}</p>
                  </div>
                </div>

                {/* Belum Absen */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-2 hover:translate-y-[-2px] transition-transform duration-200 dark:bg-gray-900 dark:border-gray-800">
                  <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 flex items-center justify-center">
                    <UserX className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-gray-400 font-semibold text-xs uppercase tracking-wider">Belum Absen</p>
                    <p className="text-2xl font-black text-rose-600 dark:text-rose-400">{totalBelumAbsen}</p>
                  </div>
                </div>
              </section>

              {/* Bento Row: Live Attendance & Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Kehadiran Hari Ini Card */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden dark:bg-gray-900 dark:border-gray-800">
                  <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 dark:border-gray-800 dark:bg-gray-800/50">
                    <h3 className="font-bold text-gray-800 text-sm dark:text-gray-100">Kehadiran Hari Ini</h3>
                    <button 
                      onClick={() => setActiveTab('presensi')}
                      className="text-xs text-[#00418f] font-bold hover:underline dark:text-blue-400"
                    >
                      Lihat Semua
                    </button>
                  </div>
                  
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {todayRecords.length === 0 ? (
                      <div className="p-8 text-center text-gray-400 text-xs dark:text-gray-500">
                        Belum ada data presensi yang masuk hari ini.
                      </div>
                    ) : (
                      todayRecords.map((rec, idx) => (
                        <div key={idx} className="p-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors dark:hover:bg-gray-800/50">
                          <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-100 dark:border-gray-700">
                            <img className="w-full h-full object-cover" src={rec.foto} alt={rec.nama} />
                          </div>
                          <div className="flex-grow min-w-0">
                            <h4 className="font-bold text-gray-800 text-sm truncate dark:text-gray-100">{rec.nama}</h4>
                            <p className="text-xs text-gray-400 truncate dark:text-gray-500">NIP: {rec.nip}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{rec.masuk} WIB</p>
                            <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                              rec.status === 'Tepat Waktu' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-400'
                            }`}>
                              {rec.status}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Recent Activities Timeline */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5 dark:bg-gray-900 dark:border-gray-800">
                  <h3 className="font-bold text-gray-800 text-sm dark:text-gray-100">Aktivitas Terbaru</h3>
                  
                  <div className="space-y-5 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-[1px] before:bg-gray-200 dark:before:bg-gray-700">
                    {recentActivities.map((act, idx) => (
                      <div key={idx} className="flex gap-4 relative">
                        <div className={`z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm text-white ${
                          act.tipe === 'masuk' ? 'bg-[#00418f]' : act.tipe === 'keluar' ? 'bg-amber-500' : 'bg-emerald-600'
                        }`}>
                          {act.tipe === 'masuk' ? (
                            <Clock className="w-4 h-4" />
                          ) : act.tipe === 'keluar' ? (
                            <LogOut className="w-4 h-4" />
                          ) : (
                            <UserPlus className="w-4 h-4" />
                          )}
                        </div>
                        <div className="pt-0.5 space-y-0.5">
                          <p className="text-xs text-gray-800 dark:text-gray-100">
                            <strong className="font-bold">{act.nama}</strong> {act.keterangan}
                          </p>
                          <span className="text-[10px] text-gray-400 block dark:text-gray-500">{act.waktu}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </motion.div>
          )}

          {activeTab === 'karyawan' && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }} 
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl md:text-2xl font-extrabold text-gray-800 tracking-tight dark:text-gray-100">Data Karyawan</h2>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Total terdaftar {employees.length} karyawan aktif. Karyawan otomatis terdaftar saat login pertama.</p>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 dark:text-gray-500" />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-gray-200/80 rounded-2xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-[#00418f]/20 focus:border-[#00418f] transition-all text-sm outline-none placeholder:text-gray-400 dark:bg-gray-900 dark:border-gray-700 dark:placeholder:text-gray-500"
                  placeholder="Cari nama atau NIP..."
                />
              </div>

              {/* Employees List Grid */}
              <div className="space-y-3">
                {filteredEmployees.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-xs dark:text-gray-500">
                    Karyawan tidak ditemukan. Coba kata kunci pencarian lain.
                  </div>
                ) : (
                  filteredEmployees.map((emp, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 hover:translate-y-[-1px] transition-transform dark:bg-gray-900 dark:border-gray-800">
                      <div className="w-12 h-12 rounded-full overflow-hidden border border-gray-100 shrink-0 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                        <img className="w-full h-full object-cover" src={emp.foto} alt={emp.nama} />
                      </div>
                      <div className="flex-grow min-w-0">
                        <h3 className="font-bold text-gray-800 text-sm truncate dark:text-gray-100">{emp.nama}</h3>
                        <p className="text-xs text-gray-500 truncate dark:text-gray-400">{emp.jabatan} • <span className="text-gray-400 dark:text-gray-500">{emp.lembaga}</span></p>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
<span className="text-[10px] font-bold text-[#00418f] tracking-wide dark:text-blue-400">NIP: {emp.nip}</span>
                          {emp.email ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-blue-50 text-[#00418f] border border-blue-100 font-medium lowercase truncate max-w-[180px] dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800" title={emp.email}>
                              {emp.email}
                            </span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-100 font-medium italic dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
                              Email belum diset
                            </span>
                          )}
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          if (confirm(`Apakah Anda yakin ingin menghapus data ${emp.nama}?`)) {
                            onDeleteEmployee(emp.nip);
                          }
                        }}
                        className="w-9 h-9 flex items-center justify-center rounded-xl text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors dark:text-rose-400 dark:bg-rose-900/30 dark:hover:bg-rose-900/50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'presensi' && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }} 
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl md:text-2xl font-extrabold text-gray-800 tracking-tight dark:text-gray-100">Data Presensi</h2>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Arsip pencatatan rekapitulasi harian kehadiran.</p>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                  <div className="relative">
                    <select 
                      value={monthFilter}
                      onChange={(e) => { setMonthFilter(e.target.value); setCurrentPage(1); }}
                      className="bg-white border border-gray-200/80 rounded-xl py-2 pl-3 pr-8 text-xs font-semibold focus:ring-2 focus:ring-[#00418f]/10 focus:border-[#00418f] outline-none dark:bg-gray-900 dark:border-gray-700"
                    >
                      <option value="Semua">Semua Bulan</option>
                      {monthNames.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div className="relative">
                    <select 
                      value={yearFilter}
                      onChange={(e) => { setYearFilter(e.target.value); setCurrentPage(1); }}
                      className="bg-white border border-gray-200/80 rounded-xl py-2 pl-3 pr-8 text-xs font-semibold focus:ring-2 focus:ring-[#00418f]/10 focus:border-[#00418f] outline-none dark:bg-gray-900 dark:border-gray-700"
                    >
                      <option value="Semua">Semua Tahun</option>
                      {availableYears.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>

                  <button 
                    onClick={handleExportCSV}
                    className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-sm cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </button>

                  <button 
                    onClick={handlePrint}
                    className="flex items-center gap-1.5 bg-sky-600 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-sky-700 active:scale-95 transition-all shadow-sm cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Cetak / PDF
                  </button>
                </div>
              </div>

              {/* Attendance Table */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden dark:bg-gray-900 dark:border-gray-800">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 dark:bg-gray-800 dark:border-gray-700">
                        <th className="px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wider dark:text-gray-500">Tanggal</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wider dark:text-gray-500">NIP</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wider dark:text-gray-500">Nama</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wider dark:text-gray-500">Sesi</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wider dark:text-gray-500">Masuk</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wider dark:text-gray-500">Keluar</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wider dark:text-gray-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {paginatedAttendance.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-12 text-gray-400 text-xs dark:text-gray-500">
                            Tidak ada arsip presensi yang cocok dengan filter yang dipilih.
                          </td>
                        </tr>
                      ) : (
                        paginatedAttendance.map((rec, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/30 transition-colors dark:hover:bg-gray-800/30">
                            <td className="px-5 py-4 text-xs font-semibold text-gray-700 dark:text-gray-300">{rec.tanggal}</td>
                            <td className="px-5 py-4 text-xs text-gray-500 dark:text-gray-400">{rec.nip}</td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-50 shrink-0 border border-gray-100 dark:border-gray-700 dark:bg-gray-800">
                                  <img className="w-full h-full object-cover" src={rec.foto} alt={rec.nama} />
                                </div>
                                <span className="text-xs font-bold text-gray-800 dark:text-gray-100">{rec.nama}</span>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              {rec.sesi ? (
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                  rec.sesi === 'malam'
                                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800'
                                    : 'bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800'
                                }`}>
                                  <span className={`w-1 h-1 rounded-full ${rec.sesi === 'malam' ? 'bg-indigo-500' : 'bg-amber-500'}`} />
                                  {rec.sesi === 'malam' ? 'Malam' : 'Siang'}
                                </span>
                              ) : (
                                <span className="text-[10px] text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-5 py-4 text-xs text-gray-800 font-semibold dark:text-gray-100">{rec.masuk}</td>
                            <td className="px-5 py-4 text-xs text-gray-500 font-semibold dark:text-gray-400">{rec.keluar || '--:--'}</td>
                            <td className="px-5 py-4">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                                rec.status === 'Tepat Waktu' 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' 
                                  : rec.status === 'Izin'
                                  ? 'bg-sky-50 text-sky-700 border border-sky-100 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800'
                                  : 'bg-rose-50 text-rose-700 border border-rose-100 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  rec.status === 'Tepat Waktu' 
                                    ? 'bg-emerald-500' 
                                    : rec.status === 'Izin'
                                    ? 'bg-sky-500'
                                    : 'bg-rose-500'
                                }`} />
                                {rec.status}
                              </span>
                              {rec.status === 'Izin' && (rec.keterangan || rec.izinMulai) && (
                                <div className="mt-1.5 max-w-[200px] text-left text-[10px] font-medium text-gray-500 leading-normal dark:text-gray-400">
                                  {rec.izinMulai && rec.izinSelesai && (
                                    <p className="font-bold text-sky-700 dark:text-sky-400 mb-1">Izin Jam Tertentu {rec.izinMulai} - {rec.izinSelesai}</p>
                                  )}
                                  <p className="italic bg-gray-50 p-1.5 rounded-lg border border-gray-100 dark:bg-gray-800 dark:border-gray-700">{rec.keterangan}</p>
                                  {rec.lampiran && (
                                    <button
                                      onClick={() => {
                                        setViewingAttachment(rec.lampiran!);
                                        setAttachmentTitle(`Lampiran Izin: ${rec.nama}`);
                                      }}
                                      className="inline-flex items-center gap-1 mt-1.5 text-[#00418f] font-bold hover:underline cursor-pointer dark:text-blue-400"
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                      Lihat Lampiran Bukti
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-800/50">
                    <p className="text-xs text-gray-400 font-medium dark:text-gray-500">
                      Menampilkan {startIndex + 1} - {Math.min(startIndex + itemsPerPage, totalEntries)} dari {totalEntries} rekaman
                    </p>
                    <div className="flex items-center gap-2">
                      <button 
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 active:scale-95 transition-all disabled:opacity-40 dark:border-gray-700 dark:hover:bg-gray-800"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Halaman {currentPage} dari {totalPages}</span>
                      <button 
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 active:scale-95 transition-all disabled:opacity-40 dark:border-gray-700 dark:hover:bg-gray-800"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Insight Mini Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 dark:bg-gray-900 dark:border-gray-800">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider dark:text-gray-500">Tingkat Hadir</p>
                    <p className="text-xl font-black text-gray-800 dark:text-gray-100">
                      {attendanceRecords.length > 0 ? ((attendanceRecords.filter(r => r.status !== 'Alpa').length / attendanceRecords.length) * 100).toFixed(1) : '0'}%
                    </p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 dark:bg-gray-900 dark:border-gray-800">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider dark:text-gray-500">Terlambat</p>
                    <p className="text-xl font-black text-gray-800 dark:text-gray-100">
                      {attendanceRecords.filter(r => r.status === 'Terlambat').length} Absen
                    </p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 dark:bg-gray-900 dark:border-gray-800">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#00418f] dark:bg-blue-900/30 dark:text-blue-400">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider dark:text-gray-500">Total Pegawai</p>
                    <p className="text-xl font-black text-gray-800 dark:text-gray-100">{employees.length} Orang</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'pengaturan' && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }} 
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              
              {/* Left Column: Waktu & Geofences */}
              <div className="space-y-6">
                
                {/* Pengaturan Waktu Kerja */}
                <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4 dark:bg-gray-900 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-[#00418f] dark:text-blue-400" />
                    <h3 className="font-bold text-gray-800 text-sm dark:text-gray-100">Pengaturan Waktu Kerja</h3>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1 dark:text-gray-500">Jam Masuk Siang</label>
                      <input 
                        type="time" 
                        value={tempLimitTime}
                        onChange={(e) => setTempLimitTime(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#00418f]/20 focus:border-[#00418f] outline-none dark:bg-gray-800 dark:border-gray-700"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1 dark:text-gray-500">Jam Pulang Siang</label>
                      <input 
                        type="time" 
                        value={tempJamPulang}
                        onChange={(e) => setTempJamPulang(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#00418f]/20 focus:border-[#00418f] outline-none dark:bg-gray-800 dark:border-gray-700"
                      />
                    </div>
                  </div>

                  {/* Jam Malam */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1 dark:text-gray-500">Jam Masuk Malam</label>
                      <input 
                        type="time" 
                        value={tempJamMalamMasuk}
                        onChange={(e) => setTempJamMalamMasuk(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#00418f]/20 focus:border-[#00418f] outline-none dark:bg-gray-800 dark:border-gray-700"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1 dark:text-gray-500">Jam Pulang Malam</label>
                      <input 
                        type="time" 
                        value={tempJamMalamPulang}
                        onChange={(e) => setTempJamMalamPulang(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#00418f]/20 focus:border-[#00418f] outline-none dark:bg-gray-800 dark:border-gray-700"
                      />
                    </div>
                  </div>

                  {/* Hari Libur */}
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2 dark:text-gray-500">Hari Libur (tidak wajib absen)</label>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                      {['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'].map((day, idx) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            if (hariLibur.includes(idx)) {
                              const updated = hariLibur.filter(d => d !== idx);
                              setHariLibur(updated);
                              onSetHariLibur(updated);
                            } else {
                              const updated = [...hariLibur, idx];
                              setHariLibur(updated);
                              onSetHariLibur(updated);
                            }
                          }}
                          className={`py-2 px-1 rounded-lg text-[10px] font-bold border transition-all ${
                            hariLibur.includes(idx)
                              ? 'bg-rose-500 border-rose-500 text-white shadow-sm'
                              : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700'
                          }`}
                        >
                          {day.slice(0, 3)}
                        </button>
                      ))}
                    </div>
                    {hariLibur.length > 0 && (
                      <p className="text-[10px] text-rose-500 font-medium mt-2">
                        Libur: {hariLibur.map(d => ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'][d]).join(', ')}
                      </p>
                    )}
                  </div>

                  <button 
                    onClick={() => {
                      onSetLimitTime(tempLimitTime);
                      onSetJamPulang(tempJamPulang);
                      onSetJamMalamMasuk(tempJamMalamMasuk);
                      onSetJamMalamPulang(tempJamMalamPulang);
                      onSetHariLibur(hariLiburProp);
                      alert(`Pengaturan waktu kerja berhasil disimpan!\nJam Siang: ${tempLimitTime} - ${tempJamPulang}\nJam Malam: ${tempJamMalamMasuk} - ${tempJamMalamPulang}\nHari Libur: ${hariLibur.length > 0 ? hariLibur.map(d => ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'][d]).join(', ') : 'Tidak ada'}`);
                    }}
                    className="w-full bg-[#00418f] text-white py-3 rounded-xl text-xs font-bold uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-md dark:bg-blue-700"
                  >
                    Simpan Pengaturan Waktu
                  </button>
                </section>

                {/* Lokasi Presensi & QR Code (digabung) */}
                <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4 dark:bg-gray-900 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-[#00418f] dark:text-blue-400" />
                    <h3 className="font-bold text-gray-800 text-sm dark:text-gray-100">Lokasi Presensi & QR Code</h3>
                  </div>

                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Tambahkan lokasi gedung sekaligus membuat QR Code presensinya. Setiap lokasi tersimpan otomatis sebagai zona presensi.
                  </p>

                  {onSyncGeofences && (
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={async () => {
                          setGeofenceSyncState('syncing');
                          try {
                            await onSyncGeofences();
                            setGeofenceSyncState('ok');
                            setTimeout(() => setGeofenceSyncState('idle'), 2500);
                          } catch {
                            setGeofenceSyncState('error');
                            setTimeout(() => setGeofenceSyncState('idle'), 4000);
                          }
                        }}
                        disabled={geofenceSyncState === 'syncing'}
                        className="inline-flex items-center justify-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-4 py-2.5 rounded-xl hover:bg-emerald-100 transition-all dark:text-emerald-400 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 disabled:opacity-60"
                      >
                        <CloudUpload className="w-4 h-4" />
                        {geofenceSyncState === 'syncing' ? 'Menyinkronkan...' : 'Sinkronkan Lokasi & QR ke Cloud'}
                      </button>
                      {geofenceSyncState === 'ok' && (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400">✓ Lokasi & QR tersimpan ke cloud. Akan tampil di browser/perangkat lain setelah login.</p>
                      )}
                      {geofenceSyncState === 'error' && (
                        <p className="text-[11px] text-rose-600 dark:text-rose-400">⚠️ Gagal menyinkronkan ke cloud. Periksa koneksi internet lalu coba lagi.</p>
                      )}
                    </div>
                  )}

                  {/* Form tambah lokasi + generate QR */}
                  <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-800/50">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1 dark:text-gray-500">Nama Gedung / Lokasi</label>
                      <input
                        type="text"
                        placeholder="Contoh: Masjid Al Hikmah"
                        value={customQrNama}
                        onChange={(e) => setCustomQrNama(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#00418f]/20 focus:border-[#00418f] outline-none dark:bg-gray-900 dark:border-gray-700 dark:placeholder:text-gray-600"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1 dark:text-gray-500">Latitude</label>
                        <input
                          type="text"
                          placeholder="-6.945395"
                          value={customQrLat}
                          onChange={(e) => setCustomQrLat(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#00418f]/20 outline-none dark:bg-gray-900 dark:border-gray-700 dark:placeholder:text-gray-600"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1 dark:text-gray-500">Longitude</label>
                        <input
                          type="text"
                          placeholder="109.638433"
                          value={customQrLng}
                          onChange={(e) => setCustomQrLng(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#00418f]/20 outline-none dark:bg-gray-900 dark:border-gray-700 dark:placeholder:text-gray-600"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1 dark:text-gray-500">Radius (meter)</label>
                      <input
                        type="number"
                        placeholder="100"
                        value={customQrRadius}
                        onChange={(e) => setCustomQrRadius(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#00418f]/20 outline-none dark:bg-gray-900 dark:border-gray-700 dark:placeholder:text-gray-600"
                      />
                    </div>

                    <button
                      onClick={() => {
                        if (!customQrNama.trim() || !customQrLat.trim() || !customQrLng.trim()) {
                          alert('Lengkapi nama, latitude, dan longitude.');
                          return;
                        }
                        const lat = parseFloat(customQrLat);
                        const lng = parseFloat(customQrLng);
                        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                          alert('Koordinat tidak valid.');
                          return;
                        }
                        const radius = parseInt(customQrRadius, 10) || 100;
                        const geoId = `geo-${Date.now()}`;
                        const nama = customQrNama.trim();
                        // Simpan lokasi gedung otomatis sebagai zona presensi
                        onAddGeofence({
                          id: geoId,
                          nama,
                          lat,
                          lng,
                          radius
                        });
                        const qrData = `P|${geoId}|${nama}|${lat.toFixed(4)}|${lng.toFixed(4)}|${radius}`;
                        setCustomQrDataUrl(`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrData)}`);
                        setCustomQrImgError(false);
                        setCustomQrGenerated(true);
                        setTimeout(() => customQrRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
                      }}
                      className="w-full bg-[#00418f] text-white py-3 rounded-xl text-xs font-bold uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 dark:bg-blue-700"
                    >
                      <QrCode className="w-4 h-4" />
                      Simpan Lokasi & Generate QR
                    </button>

                    {/* QR Preview hasil generate */}
                    {customQrGenerated && customQrDataUrl && (
                      <div ref={customQrRef} className="bg-white rounded-xl p-4 border border-emerald-200 flex flex-col items-center gap-3 dark:bg-gray-900 dark:border-emerald-800/50">
                        <div className="w-40 h-40 bg-white p-2 rounded-lg shadow-sm">
                          {customQrImgError ? (
                            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 gap-2">
                              <AlertTriangle className="w-8 h-8" />
                              <p className="text-[10px] text-center">Gagal memuat QR. Periksa koneksi internet.</p>
                            </div>
                          ) : (
                            <img
                              src={customQrDataUrl}
                              alt={`QR - ${customQrNama}`}
                              className="w-full h-full object-contain"
                              onError={() => setCustomQrImgError(true)}
                              onLoad={() => setCustomQrImgError(false)}
                            />
                          )}
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{customQrNama}</p>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400">{customQrLat}, {customQrLng} • Radius: {customQrRadius || '100'}m</p>
                        </div>
                        <button
                          onClick={() => downloadImage(customQrDataUrl.replace('400x400', '800x800'), `QR_${customQrNama.replace(/\s+/g, '_')}.png`).catch((err) => alert(err.message || 'Gagal mengunduh QR Code.'))}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00418f] bg-[#00418f]/10 px-4 py-2 rounded-lg hover:bg-[#00418f]/20 transition-all dark:text-blue-400 dark:bg-blue-900/30 dark:hover:bg-blue-900/50"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download QR Code
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Daftar lokasi terdaftar + QR */}
                  <div className="space-y-3">
                    {geofences.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4 dark:text-gray-500">Belum ada lokasi. Tambahkan lokasi gedung di atas untuk membuat zona presensi & QR Code.</p>
                    ) : (
                      geofences.map((geo) => {
                        const qrData = `P|${geo.id}|${geo.nama}|${geo.lat.toFixed(4)}|${geo.lng.toFixed(4)}|${geo.radius}`;
                        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrData)}`;
                        return (
                          <div key={geo.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100 dark:bg-gray-800 dark:border-gray-700">
                            <div className="flex items-start gap-4">
                              <div className="w-24 h-24 bg-white p-2 rounded-lg shadow-sm shrink-0">
                                <img 
                                  src={qrUrl}
                                  alt={`QR - ${geo.nama}`}
                                  className="w-full h-full object-contain"
                                />
                              </div>
                              <div className="flex-1 space-y-2 min-w-0">
                                <h4 className="font-bold text-sm text-gray-800 dark:text-gray-100 truncate">{geo.nama}</h4>
                                <div className="space-y-1 text-[10px] text-gray-500 dark:text-gray-400">
                                  <p className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {geo.lat.toFixed(6)}, {geo.lng.toFixed(6)}
                                  </p>
                                  <p>Radius: {geo.radius}m</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    onClick={() => downloadImage(qrUrl.replace('400x400', '800x800'), `QR_Presensi_${geo.nama.replace(/\s+/g, '_')}.png`).catch((err) => alert(err.message || 'Gagal mengunduh QR Code.'))}
                                    className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#00418f] bg-[#00418f]/10 px-3 py-1.5 rounded-lg hover:bg-[#00418f]/20 transition-all dark:text-blue-400 dark:bg-blue-900/30 dark:hover:bg-blue-900/50"
                                  >
                                    <Download className="w-3 h-3" />
                                    Download QR
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingGeoId(geo.id);
                                      setEditQrNama(geo.nama);
                                      setEditQrLat(String(geo.lat));
                                      setEditQrLng(String(geo.lng));
                                      setEditQrRadius(String(geo.radius));
                                    }}
                                    className="inline-flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-all dark:text-indigo-400 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                    Edit QR
                                  </button>
                                  <button 
                                    onClick={() => {
                                      if (confirm(`Hapus lokasi ${geo.nama} beserta QR-nya?`)) {
                                        onDeleteGeofence(geo.id);
                                      }
                                    }}
                                    className="inline-flex items-center gap-1.5 text-[10px] font-bold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg hover:bg-rose-100 transition-all dark:text-rose-400 dark:bg-rose-900/30 dark:hover:bg-rose-900/50"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    Hapus
                                  </button>
                                </div>
                                {editingGeoId === geo.id && (
                                  <div className="mt-3 space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-900 dark:bg-indigo-950/30">
                                    <div>
                                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1 dark:text-gray-500">Nama Gedung / Lokasi</label>
                                      <input
                                        type="text"
                                        value={editQrNama}
                                        onChange={(e) => setEditQrNama(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#00418f]/20 focus:border-[#00418f] outline-none dark:bg-gray-900 dark:border-gray-700"
                                      />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1 dark:text-gray-500">Latitude</label>
                                        <input
                                          type="text"
                                          value={editQrLat}
                                          onChange={(e) => setEditQrLat(e.target.value)}
                                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#00418f]/20 outline-none dark:bg-gray-900 dark:border-gray-700"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1 dark:text-gray-500">Longitude</label>
                                        <input
                                          type="text"
                                          value={editQrLng}
                                          onChange={(e) => setEditQrLng(e.target.value)}
                                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#00418f]/20 outline-none dark:bg-gray-900 dark:border-gray-700"
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1 dark:text-gray-500">Radius (meter)</label>
                                      <input
                                        type="number"
                                        value={editQrRadius}
                                        onChange={(e) => setEditQrRadius(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#00418f]/20 outline-none dark:bg-gray-900 dark:border-gray-700"
                                      />
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => {
                                          if (!editQrNama.trim() || !editQrLat.trim() || !editQrLng.trim()) {
                                            alert('Lengkapi nama, latitude, dan longitude.');
                                            return;
                                          }
                                          const lat = parseFloat(editQrLat);
                                          const lng = parseFloat(editQrLng);
                                          if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                                            alert('Koordinat tidak valid.');
                                            return;
                                          }
                                          const radius = parseInt(editQrRadius, 10) || 100;
                                          onUpdateGeofence(geo.id, { nama: editQrNama.trim(), lat, lng, radius });
                                          setEditingGeoId(null);
                                        }}
                                        className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-[#00418f] px-3 py-2 rounded-lg hover:brightness-110 active:scale-95 transition-all dark:bg-blue-700"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                        Simpan Perubahan
                                      </button>
                                      <button
                                        onClick={() => setEditingGeoId(null)}
                                        className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-gray-600 bg-white border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition-all dark:text-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700"
                                      >
                                        Batal
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>

              </div>

              {/* Right Column: Profil & Info */}
              <div className="space-y-6">
                
                {/* Profil Administrator Customizer */}
                <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4 dark:bg-gray-900 dark:border-gray-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Settings className="w-5 h-5 text-[#00418f] dark:text-blue-400" />
                      <h3 className="font-bold text-gray-800 text-sm dark:text-gray-100">Profil Administrator</h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-800/50">
                    <div className="relative group shrink-0">
                      <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#00418f]/20 shadow-inner">
                        <img className="w-full h-full object-cover" src={adminProfile.foto} alt={adminProfile.nama} />
                      </div>
                      <button 
                        onClick={() => {
                          setIsEditingAdminPhoto(true);
                          setAdminCustomPhotoUrl(adminProfile.foto);
                        }}
                        className="absolute bottom-0 right-0 p-1.5 bg-[#00418f] text-white rounded-full shadow-md hover:brightness-110 active:scale-90 transition-all cursor-pointer"
                        title="Edit Foto Profil"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex-grow min-w-0 text-left">
                      <h4 className="font-bold text-gray-800 text-sm dark:text-gray-100">{adminProfile.nama}</h4>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold dark:text-gray-500">{adminProfile.role}</p>
                    </div>
                  </div>

                  {/* Inline preset editor directly embedded for administrative comfort */}
                  {isEditingAdminPhoto && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="border-t border-gray-100 pt-4 space-y-3 dark:border-gray-800"
                    >
                      <h4 className="text-xs font-bold text-gray-500 text-left dark:text-gray-400">Pilih Foto Preset Administrator:</h4>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80",
                          "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=150&q=80",
                          "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=150&q=80",
                          "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80"
                        ].map((url, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              onChangeAdminProfilePicture(url);
                              setIsEditingAdminPhoto(false);
                            }}
                            className="w-12 h-12 rounded-xl overflow-hidden border-2 border-transparent hover:border-[#00418f] active:scale-95 transition-all cursor-pointer relative animate-none"
                          >
                            <img src={url} className="w-full h-full object-cover" alt="preset" />
                            {adminProfile.foto === url && (
                              <div className="absolute inset-0 bg-[#00418f]/40 flex items-center justify-center">
                                <Check className="w-4 h-4 text-white stroke-[3]" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>

                      <div className="space-y-1 text-left">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider dark:text-gray-500">Atau masukkan URL Foto Kustom:</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="https://example.com/foto.jpg"
                            value={adminCustomPhotoUrl}
                            onChange={(e) => setAdminCustomPhotoUrl(e.target.value)}
                            className="flex-grow bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#00418f]/20 focus:border-[#00418f] outline-none dark:bg-gray-800 dark:border-gray-700"
                          />
                          <button
                            onClick={() => {
                              if (adminCustomPhotoUrl.trim().startsWith('http')) {
                                onChangeAdminProfilePicture(adminCustomPhotoUrl);
                                setIsEditingAdminPhoto(false);
                              } else {
                                alert('Harap masukkan URL yang valid!');
                              }
                            }}
                            className="bg-[#00418f] text-white px-3 py-2 rounded-xl text-xs font-bold hover:brightness-110"
                          >
                            Set
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1 text-left">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Atau Unggah file gambar:</label>
                        <label className="flex items-center justify-center gap-2 border border-dashed border-gray-200 hover:border-[#00418f] rounded-xl p-3 cursor-pointer hover:bg-gray-50 transition-all text-xs font-bold text-gray-600 dark:border-gray-700 dark:hover:border-blue-400 dark:hover:bg-gray-800 dark:text-gray-400">
                          <Download className="w-4 h-4 text-gray-400 dark:text-gray-500" />
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
                                  onChangeAdminProfilePicture(reader.result as string);
                                  setIsEditingAdminPhoto(false);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                      </div>

                      <button
                        onClick={() => setIsEditingAdminPhoto(false)}
                        className="w-full text-center py-2 text-xs text-gray-400 hover:text-gray-600 font-bold dark:text-gray-500 dark:hover:text-gray-300"
                      >
                        Tutup Editor
                      </button>
                    </motion.div>
                  )}
                </section>

              </div>
              
            </motion.div>
          )}

        </main>
      </div>

      {/* Admin Mobile Bottom Tabs Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-t border-gray-100 dark:border-gray-800 flex justify-around items-center px-4 py-2 shadow-lg">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
            activeTab === 'dashboard' ? 'text-[#00418f] dark:text-blue-400 scale-105 font-bold' : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Dashboard</span>
        </button>

        <button 
          onClick={() => setActiveTab('karyawan')}
          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
            activeTab === 'karyawan' ? 'text-[#00418f] dark:text-blue-400 scale-105 font-bold' : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Users className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Karyawan</span>
        </button>

        <button 
          onClick={() => setActiveTab('presensi')}
          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
            activeTab === 'presensi' ? 'text-[#00418f] dark:text-blue-400 scale-105 font-bold' : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <FileText className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Presensi</span>
        </button>

        <button 
          onClick={() => setActiveTab('pengaturan')}
          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
            activeTab === 'pengaturan' ? 'text-[#00418f] dark:text-blue-400 scale-105 font-bold' : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Settings className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Settings</span>
        </button>
      </nav>

      {/* Lightbox Preview Lampiran Bukti untuk Admin */}
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
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative max-w-lg w-full bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl border border-zinc-800/80 p-4 text-center z-10 text-left"
            >
              <div className="flex justify-between items-center text-white mb-3">
                <span className="text-xs font-bold tracking-tight">{attachmentTitle || 'Preview Bukti Lampiran'}</span>
                <button 
                  onClick={() => setViewingAttachment(null)}
                  className="p-1 rounded-full bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="w-full aspect-[4/3] rounded-lg overflow-hidden bg-black flex items-center justify-center">
                <img src={viewingAttachment} className="max-w-full max-h-full object-contain animate-none" alt="Bukti lampiran" referrerPolicy="no-referrer" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
