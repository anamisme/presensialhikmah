/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
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
  Info,
  Sliders,
  LogOut,
  LayoutDashboard,
  Map,
  FileText,
  BadgeAlert,
  Database,
  ArrowLeft,
  Settings,
  Edit,
  UserPlus
} from 'lucide-react';
import { Employee, AttendanceRecord, Geofence, RecentActivity } from '../types';
import { ASSETS } from '../data';

interface AdminPanelProps {
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  geofences: Geofence[];
  recentActivities: RecentActivity[];
  limitTime: string;
  onSetLimitTime: (time: string) => void;
  onAddEmployee: (emp: Employee) => void;
  onDeleteEmployee: (nip: string) => void;
  onAddGeofence: (geo: Geofence) => void;
  onDeleteGeofence: (id: string) => void;
  onBackToEmployee: () => void;
}

export default function AdminPanel({
  employees,
  attendanceRecords,
  geofences,
  recentActivities,
  limitTime,
  onSetLimitTime,
  onAddEmployee,
  onDeleteEmployee,
  onAddGeofence,
  onDeleteGeofence,
  onBackToEmployee
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'karyawan' | 'presensi' | 'pengaturan'>('dashboard');
  
  // State for adding employees bottom sheet
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [newNip, setNewNip] = useState('');
  const [newNama, setNewNama] = useState('');
  const [newJabatan, setNewJabatan] = useState('');
  const [newLembaga, setNewLembaga] = useState('Lembaga IT & Digital');
  const [newPassword, setNewPassword] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // State for adding geofence modal
  const [isAddGeofenceOpen, setIsAddGeofenceOpen] = useState(false);
  const [geoNama, setGeoNama] = useState('');
  const [geoLat, setGeoLat] = useState('');
  const [geoLng, setGeoLng] = useState('');
  const [geoRadius, setGeoRadius] = useState('50');

  // State for QR generation
  const [selectedQRLocation, setSelectedQRLocation] = useState<string>(geofences[0]?.nama || '');
  const [isQRGenerated, setIsQRGenerated] = useState(false);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);

  // Pagination for Attendance logs
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Filter for attendance logs
  const [monthFilter, setMonthFilter] = useState('Semua');
  const [yearFilter, setYearFilter] = useState('2026');

  // Set Waktu input state
  const [tempLimitTime, setTempLimitTime] = useState(limitTime);

  // CSV Exporter
  const handleExportCSV = () => {
    const headers = ['Tanggal', 'NIP', 'Nama', 'Masuk', 'Keluar', 'Status', 'Lokasi'];
    const rows = attendanceRecords.map(r => [
      r.tanggal,
      r.nip,
      r.nama,
      r.masuk,
      r.keluar || '--:--',
      r.status,
      r.lokasi || 'Kantor Pusat'
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `rekap_presensi_${monthFilter}_${yearFilter}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Compute live dashboard metrics
  const totalEmployees = employees.length;
  
  // Attendance metrics matching the 2x2 grid
  const todayStr = new Date().toISOString().split('T')[0];
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
  const filteredAttendance = attendanceRecords.filter(rec => {
    // Basic date parsing
    const recYear = rec.tanggal.split('-')[0];
    const recMonthNum = rec.tanggal.split('-')[1]; // "06"
    
    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const recMonthName = monthNames[parseInt(recMonthNum, 10) - 1] || '';

    const matchesYear = yearFilter === 'Semua' || recYear === yearFilter;
    const matchesMonth = monthFilter === 'Semua' || recMonthName.toLowerCase().includes(monthFilter.toLowerCase());

    return matchesYear && matchesMonth;
  });

  // Paginated records
  const totalEntries = filteredAttendance.length;
  const totalPages = Math.ceil(totalEntries / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedAttendance = filteredAttendance.slice(startIndex, startIndex + itemsPerPage);

  const handleAddNewEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNip || !newNama || !newJabatan) return;

    const newEmp: Employee = {
      nip: newNip,
      nama: newNama,
      jabatan: newJabatan,
      lembaga: newLembaga,
      foto: ASSETS.genericAvatar
    };

    onAddEmployee(newEmp);
    
    // Clear inputs and close sheet
    setNewNip('');
    setNewNama('');
    setNewJabatan('');
    setNewPassword('');
    setIsAddEmployeeOpen(false);
  };

  const handleAddNewGeofence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!geoNama || !geoLat || !geoLng) return;

    const newGeo: Geofence = {
      id: `geo-${Date.now()}`,
      nama: geoNama,
      lat: parseFloat(geoLat),
      lng: parseFloat(geoLng),
      radius: parseInt(geoRadius, 10)
    };

    onAddGeofence(newGeo);
    
    // Clear & close
    setGeoNama('');
    setGeoLat('');
    setGeoLng('');
    setGeoRadius('50');
    setIsAddGeofenceOpen(false);
  };

  const triggerQRGeneration = () => {
    setIsGeneratingQR(true);
    setTimeout(() => {
      setIsGeneratingQR(false);
      setIsQRGenerated(true);
    }, 1200);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F9F9FF] text-gray-900 font-sans pb-24 md:pb-0 select-none">
      
      {/* Admin Top App Bar */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100/50 flex justify-between items-center px-4 md:px-6 h-16 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-[#00418f] p-2 rounded-xl text-white flex items-center justify-center shadow-md">
            <Sliders className="w-5 h-5" />
          </div>
          <h1 className="font-bold text-lg text-gray-800 tracking-tight">Admin Panel</h1>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Quick toggle to Employee Mode */}
          <button 
            onClick={onBackToEmployee}
            className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all active:scale-95"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Mode Pegawai
          </button>
        </div>
      </header>

      {/* Main Layout Area - Includes Sidebar on MD+ screen sizes */}
      <div className="flex-grow flex">
        
        {/* Left Sidebar for Desktop Viewports */}
        <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-100 py-6 px-4 shrink-0 gap-1">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'dashboard' 
                ? 'bg-[#00418f]/10 text-[#00418f] font-bold shadow-sm' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </button>

          <button 
            onClick={() => setActiveTab('karyawan')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'karyawan' 
                ? 'bg-[#00418f]/10 text-[#00418f] font-bold shadow-sm' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
            }`}
          >
            <Users className="w-4 h-4" />
            Karyawan
          </button>

          <button 
            onClick={() => setActiveTab('presensi')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'presensi' 
                ? 'bg-[#00418f]/10 text-[#00418f] font-bold shadow-sm' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            Data Presensi
          </button>

          <button 
            onClick={() => setActiveTab('pengaturan')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'pengaturan' 
                ? 'bg-[#00418f]/10 text-[#00418f] font-bold shadow-sm' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
            }`}
          >
            <Settings className="w-4 h-4" />
            Pengaturan
          </button>

          <div className="mt-auto p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Sistem Info</h4>
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-600">
              <Database className="w-3.5 h-3.5 text-[#00418f]" />
              <span>Drizzle ORM + Cloud SQL</span>
            </div>
          </div>
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
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-2 hover:translate-y-[-2px] transition-transform duration-200">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-gray-400 font-semibold text-xs uppercase tracking-wider">Total Karyawan</p>
                    <p className="text-2xl font-black text-gray-800">{totalEmployees}</p>
                  </div>
                </div>

                {/* Hadir Hari Ini */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-2 hover:translate-y-[-2px] transition-transform duration-200">
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-[#00418f] flex items-center justify-center">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-gray-400 font-semibold text-xs uppercase tracking-wider">Hadir Hari Ini</p>
                    <p className="text-2xl font-black text-[#00418f]">{totalHadir}</p>
                  </div>
                </div>

                {/* Terlambat */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-2 hover:translate-y-[-2px] transition-transform duration-200">
                  <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-gray-400 font-semibold text-xs uppercase tracking-wider">Terlambat</p>
                    <p className="text-2xl font-black text-amber-700">{totalTerlambat}</p>
                  </div>
                </div>

                {/* Belum Absen */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-2 hover:translate-y-[-2px] transition-transform duration-200">
                  <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
                    <UserX className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-gray-400 font-semibold text-xs uppercase tracking-wider">Belum Absen</p>
                    <p className="text-2xl font-black text-rose-600">{totalBelumAbsen}</p>
                  </div>
                </div>
              </section>

              {/* Bento Row: Live Attendance & Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Kehadiran Hari Ini Card */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-bold text-gray-800 text-sm">Kehadiran Hari Ini</h3>
                    <button 
                      onClick={() => setActiveTab('presensi')}
                      className="text-xs text-[#00418f] font-bold hover:underline"
                    >
                      Lihat Semua
                    </button>
                  </div>
                  
                  <div className="divide-y divide-gray-100">
                    {todayRecords.length === 0 ? (
                      <div className="p-8 text-center text-gray-400 text-xs">
                        Belum ada data presensi yang masuk hari ini.
                      </div>
                    ) : (
                      todayRecords.map((rec, idx) => (
                        <div key={idx} className="p-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
                          <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-100">
                            <img className="w-full h-full object-cover" src={rec.foto} alt={rec.nama} />
                          </div>
                          <div className="flex-grow min-w-0">
                            <h4 className="font-bold text-gray-800 text-sm truncate">{rec.nama}</h4>
                            <p className="text-xs text-gray-400 truncate">NIP: {rec.nip}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-semibold text-gray-700">{rec.masuk} WIB</p>
                            <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                              rec.status === 'Tepat Waktu' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
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
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
                  <h3 className="font-bold text-gray-800 text-sm">Aktivitas Terbaru</h3>
                  
                  <div className="space-y-5 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-[1px] before:bg-gray-200">
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
                          <p className="text-xs text-gray-800">
                            <strong className="font-bold">{act.nama}</strong> {act.keterangan}
                          </p>
                          <span className="text-[10px] text-gray-400 block">{act.waktu}</span>
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
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl md:text-2xl font-extrabold text-gray-800 tracking-tight">Data Karyawan</h2>
                  <p className="text-xs text-gray-400">Total terdaftar {employees.length} karyawan aktif.</p>
                </div>
                <button 
                  onClick={() => setIsAddEmployeeOpen(true)}
                  className="bg-[#00418f] text-white px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md hover:brightness-110 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span className="text-xs font-bold uppercase tracking-wider">Tambah</span>
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-gray-200/80 rounded-2xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-[#00418f]/20 focus:border-[#00418f] transition-all text-sm outline-none placeholder:text-gray-400"
                  placeholder="Cari nama atau NIP..."
                />
              </div>

              {/* Employees List Grid */}
              <div className="space-y-3">
                {filteredEmployees.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-xs">
                    Karyawan tidak ditemukan. Coba kata kunci pencarian lain.
                  </div>
                ) : (
                  filteredEmployees.map((emp, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 hover:translate-y-[-1px] transition-transform">
                      <div className="w-12 h-12 rounded-full overflow-hidden border border-gray-100 shrink-0 bg-gray-50">
                        <img className="w-full h-full object-cover" src={emp.foto} alt={emp.nama} />
                      </div>
                      <div className="flex-grow min-w-0">
                        <h3 className="font-bold text-gray-800 text-sm truncate">{emp.nama}</h3>
                        <p className="text-xs text-gray-500 truncate">{emp.jabatan} • <span className="text-gray-400">{emp.lembaga}</span></p>
                        <p className="text-[10px] font-semibold text-[#00418f] tracking-wide mt-0.5">NIP: {emp.nip}</p>
                      </div>
                      <button 
                        onClick={() => {
                          if (confirm(`Apakah Anda yakin ingin menghapus data ${emp.nama}?`)) {
                            onDeleteEmployee(emp.nip);
                          }
                        }}
                        className="w-9 h-9 flex items-center justify-center rounded-xl text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors"
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
                  <h2 className="text-xl md:text-2xl font-extrabold text-gray-800 tracking-tight">Data Presensi</h2>
                  <p className="text-xs text-gray-400">Arsip pencatatan rekapitulasi harian kehadiran.</p>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                  <div className="relative">
                    <select 
                      value={monthFilter}
                      onChange={(e) => setMonthFilter(e.target.value)}
                      className="bg-white border border-gray-200/80 rounded-xl py-2 pl-3 pr-8 text-xs font-semibold focus:ring-2 focus:ring-[#00418f]/10 focus:border-[#00418f] outline-none"
                    >
                      <option value="Semua">Semua Bulan</option>
                      <option value="Juni">Juni</option>
                      <option value="Oktober">Oktober</option>
                      <option value="November">November</option>
                    </select>
                  </div>

                  <div className="relative">
                    <select 
                      value={yearFilter}
                      onChange={(e) => setYearFilter(e.target.value)}
                      className="bg-white border border-gray-200/80 rounded-xl py-2 pl-3 pr-8 text-xs font-semibold focus:ring-2 focus:ring-[#00418f]/10 focus:border-[#00418f] outline-none"
                    >
                      <option value="Semua">Semua Tahun</option>
                      <option value="2026">2026</option>
                      <option value="2023">2023</option>
                    </select>
                  </div>

                  <button 
                    onClick={handleExportCSV}
                    className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </button>
                </div>
              </div>

              {/* Attendance Table */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wider">Tanggal</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wider">NIP</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wider">Nama</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wider">Masuk</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wider">Keluar</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {paginatedAttendance.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-12 text-gray-400 text-xs">
                            Tidak ada arsip presensi yang cocok dengan filter yang dipilih.
                          </td>
                        </tr>
                      ) : (
                        paginatedAttendance.map((rec, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/30 transition-colors">
                            <td className="px-5 py-4 text-xs font-semibold text-gray-700">{rec.tanggal}</td>
                            <td className="px-5 py-4 text-xs text-gray-500">{rec.nip}</td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-50 shrink-0 border border-gray-100">
                                  <img className="w-full h-full object-cover" src={rec.foto} alt={rec.nama} />
                                </div>
                                <span className="text-xs font-bold text-gray-800">{rec.nama}</span>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-xs text-gray-800 font-semibold">{rec.masuk}</td>
                            <td className="px-5 py-4 text-xs text-gray-500 font-semibold">{rec.keluar || '--:--'}</td>
                            <td className="px-5 py-4">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                                rec.status === 'Tepat Waktu' 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                  : 'bg-rose-50 text-rose-700 border border-rose-100'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${rec.status === 'Tepat Waktu' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                {rec.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                    <p className="text-xs text-gray-400 font-medium">
                      Menampilkan {startIndex + 1} - {Math.min(startIndex + itemsPerPage, totalEntries)} dari {totalEntries} rekaman
                    </p>
                    <div className="flex items-center gap-2">
                      <button 
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 active:scale-95 transition-all disabled:opacity-40"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-bold text-gray-700">Halaman {currentPage} dari {totalPages}</span>
                      <button 
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 active:scale-95 transition-all disabled:opacity-40"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Insight Mini Cards matching dashboard mockup bottom footer */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Presence Rate</p>
                    <p className="text-xl font-black text-gray-800">94.2%</p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Late Arrivals</p>
                    <p className="text-xl font-black text-gray-800">12 Absen</p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#00418f]">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Active Staff</p>
                    <p className="text-xl font-black text-gray-800">156 Orang</p>
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
                
                {/* Batas Jam Masuk */}
                <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-[#00418f]" />
                    <h3 className="font-bold text-gray-800 text-sm">Batas Jam Masuk</h3>
                  </div>
                  
                  <div className="flex items-end gap-4">
                    <div className="flex-grow">
                      <label className="text-xs font-semibold text-gray-400 block mb-1">Set Waktu Maksimal Presensi</label>
                      <input 
                        type="time" 
                        value={tempLimitTime}
                        onChange={(e) => setTempLimitTime(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#00418f]/20 focus:border-[#00418f] outline-none"
                      />
                    </div>
                    <button 
                      onClick={() => {
                        onSetLimitTime(tempLimitTime);
                        alert(`Batas waktu presensi berhasil disimpan: ${tempLimitTime} WIB`);
                      }}
                      className="bg-[#00418f] text-white px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-md"
                    >
                      Simpan
                    </button>
                  </div>
                </section>

                {/* Lokasi Gedung */}
                <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-[#00418f]" />
                      <h3 className="font-bold text-gray-800 text-sm">Lokasi Gedung</h3>
                    </div>
                    <button 
                      onClick={() => setIsAddGeofenceOpen(true)}
                      className="flex items-center gap-1 text-xs font-bold uppercase bg-[#00418f]/10 text-[#00418f] px-3 py-1.5 rounded-full hover:bg-[#00418f]/20 transition-all active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      Tambah
                    </button>
                  </div>

                  <div className="space-y-3">
                    {geofences.map((geo, idx) => (
                      <div key={idx} className="flex items-start gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50/50">
                        <div className="bg-[#00418f]/10 p-2 rounded-lg text-[#00418f] shrink-0">
                          <MapPin className="w-5 h-5" />
                        </div>
                        <div className="flex-grow min-w-0">
                          <h4 className="font-bold text-gray-800 text-xs truncate">{geo.nama}</h4>
                          <p className="text-[10px] text-gray-400 truncate">{geo.lat}, {geo.lng}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[9px] uppercase">
                              Radius: {geo.radius}m
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <button 
                            onClick={() => {
                              if (confirm(`Apakah Anda yakin ingin menghapus lokasi ${geo.nama}?`)) {
                                onDeleteGeofence(geo.id);
                              }
                            }}
                            className="text-gray-400 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

              </div>

              {/* Right Column: Generate QR & Info */}
              <div className="space-y-6">
                
                {/* Generate QR Code Lokasi */}
                <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-[#00418f]" />
                    <h3 className="font-bold text-gray-800 text-sm">Generate QR Code Lokasi</h3>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-400 block mb-1">Pilih Lokasi</label>
                      <select 
                        value={selectedQRLocation}
                        onChange={(e) => {
                          setSelectedQRLocation(e.target.value);
                          setIsQRGenerated(false); // Reset preview on location swap
                        }}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#00418f]/20 focus:border-[#00418f] outline-none"
                      >
                        {geofences.map((geo, idx) => (
                          <option key={idx} value={geo.nama}>{geo.nama}</option>
                        ))}
                      </select>
                    </div>

                    <button 
                      onClick={triggerQRGeneration}
                      disabled={isGeneratingQR}
                      className="w-full bg-[#00418f] text-white flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold uppercase tracking-wider hover:brightness-110 transition-colors active:scale-95 shadow-md"
                    >
                      {isGeneratingQR ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Generating...
                        </>
                      ) : (
                        <>
                          <QrCode className="w-4 h-4" />
                          Generate QR Code
                        </>
                      )}
                    </button>

                    {/* QR Code Preview Box matching mockup */}
                    <div className="mt-6 flex flex-col items-center bg-gray-50 p-6 rounded-xl border border-dashed border-gray-200">
                      <div className="relative w-44 h-44 bg-white p-3 rounded-lg shadow-sm mb-4">
                        <img 
                          className={`w-full h-full object-contain transition-all duration-300 ${isQRGenerated ? 'opacity-100 filter-none' : 'opacity-20 blur-[1px]'}`} 
                          src={ASSETS.qrStatic} 
                          alt="QR Preview" 
                        />
                        
                        {!isQRGenerated && (
                          <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                            <p className="text-gray-400 text-[10px] font-semibold text-center px-4 leading-normal">
                              Pilih lokasi dan tekan generate untuk pratinjau QR Code
                            </p>
                          </div>
                        )}
                      </div>

                      {isQRGenerated ? (
                        <a 
                          href={ASSETS.qrStatic}
                          download={`qr_code_${selectedQRLocation.replace(/\s+/g, '_')}.png`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-xs font-bold text-[#00418f] hover:underline"
                        >
                          <Download className="w-4 h-4" />
                          Download Image (.png)
                        </a>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-300 cursor-not-allowed">
                          <Download className="w-4 h-4" />
                          Download Image (.png)
                        </span>
                      )}
                    </div>
                  </div>
                </section>

                {/* Info Sistem */}
                <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <Info className="w-5 h-5 text-[#00418f]" />
                    <h3 className="font-bold text-gray-800 text-sm">Info Sistem</h3>
                  </div>

                  <div className="divide-y divide-gray-100 text-xs">
                    <div className="flex justify-between items-center py-2.5">
                      <span className="text-gray-400">Versi Aplikasi</span>
                      <span className="font-semibold text-gray-800">2.1.0</span>
                    </div>
                    <div className="flex justify-between items-center py-2.5">
                      <span className="text-gray-400">Backend Engine</span>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="font-semibold text-gray-800">Node.js</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center py-2.5">
                      <span className="text-gray-400">Database</span>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#00418f]" />
                        <span className="font-semibold text-gray-800">PostgreSQL</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-gray-50 rounded-xl text-[10px] text-gray-400 text-center font-semibold">
                    Terakhir diperbarui: 28 Juni 2026 • 04:09 WIB
                  </div>
                </section>

              </div>
              
            </motion.div>
          )}

        </main>
      </div>

      {/* Adding Karyawan Bottom Sheet Sheet Modal */}
      <AnimatePresence>
        {isAddEmployeeOpen && (
          <>
            {/* Dark overlay backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddEmployeeOpen(false)}
              className="fixed inset-0 bg-black/40 z-[60] backdrop-blur-sm" 
            />

            {/* Inset Grouped Bottom Form Panel Sheet */}
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed bottom-0 left-0 right-0 z-[70] bg-[#F2F2F7] rounded-t-[32px] shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto my-4" />
              
              <div className="px-4 pb-12 max-w-md mx-auto">
                <h2 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-[#00418f]" />
                  Tambah Karyawan Baru
                </h2>
                
                <form onSubmit={handleAddNewEmployee} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-400 ml-1 uppercase">Nomor Induk Pegawai (NIP)</label>
                    <input 
                      type="text"
                      required
                      value={newNip}
                      onChange={(e) => setNewNip(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-[#00418f]/20 focus:border-[#00418f] text-sm outline-none placeholder:text-gray-300"
                      placeholder="Masukkan NIP (misal: 19951102)"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-400 ml-1 uppercase">Nama Lengkap</label>
                    <input 
                      type="text"
                      required
                      value={newNama}
                      onChange={(e) => setNewNama(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-[#00418f]/20 focus:border-[#00418f] text-sm outline-none placeholder:text-gray-300"
                      placeholder="Masukkan nama lengkap"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-400 ml-1 uppercase">Jabatan</label>
                    <input 
                      type="text"
                      required
                      value={newJabatan}
                      onChange={(e) => setNewJabatan(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-[#00418f]/20 focus:border-[#00418f] text-sm outline-none placeholder:text-gray-300"
                      placeholder="Masukkan jabatan"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-400 ml-1 uppercase">Lembaga</label>
                    <select 
                      value={newLembaga}
                      onChange={(e) => setNewLembaga(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-[#00418f]/20 focus:border-[#00418f] text-sm outline-none cursor-pointer"
                    >
                      <option value="Lembaga IT & Digital">Lembaga IT & Digital</option>
                      <option value="Keuangan">Keuangan</option>
                      <option value="Logistik">Logistik</option>
                      <option value="Sarana & Prasarana">Sarana & Prasarana</option>
                      <option value="Rektorat">Rektorat</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-400 ml-1 uppercase">Password Akses</label>
                    <input 
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-[#00418f]/20 focus:border-[#00418f] text-sm outline-none placeholder:text-gray-300"
                      placeholder="••••••••"
                    />
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setIsAddEmployeeOpen(false)}
                      className="flex-1 py-4 rounded-xl text-xs font-bold uppercase tracking-wider text-[#00418f] bg-[#00418f]/10 active:scale-95 transition-transform"
                    >
                      Batal
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 py-4 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-[#00418f] shadow-md hover:brightness-110 active:scale-95 transition-transform"
                    >
                      Simpan Data
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Adding Geofence Modal */}
      <AnimatePresence>
        {isAddGeofenceOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddGeofenceOpen(false)}
              className="fixed inset-0 bg-black/40 z-[60] backdrop-blur-sm" 
            />

            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="fixed inset-4 max-w-md mx-auto my-auto h-fit z-[70] bg-white rounded-3xl p-6 shadow-2xl border border-gray-100"
            >
              <h2 className="text-base font-black text-gray-800 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#00418f]" />
                Tambah Lokasi Gedung Baru
              </h2>
              
              <form onSubmit={handleAddNewGeofence} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Nama Gedung/Lokasi</label>
                  <input 
                    type="text"
                    required
                    value={geoNama}
                    onChange={(e) => setGeoNama(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-[#00418f]/20 focus:border-[#00418f] outline-none"
                    placeholder="misal: Gedung Rektorat Utama"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Latitude</label>
                    <input 
                      type="number"
                      step="any"
                      required
                      value={geoLat}
                      onChange={(e) => setGeoLat(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-[#00418f]/20 focus:border-[#00418f] outline-none"
                      placeholder="-6.1234"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Longitude</label>
                    <input 
                      type="number"
                      step="any"
                      required
                      value={geoLng}
                      onChange={(e) => setGeoLng(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-[#00418f]/20 focus:border-[#00418f] outline-none"
                      placeholder="106.5678"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Radius (Meter)</label>
                  <input 
                    type="number"
                    required
                    value={geoRadius}
                    onChange={(e) => setGeoRadius(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-[#00418f]/20 focus:border-[#00418f] outline-none"
                    placeholder="50"
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsAddGeofenceOpen(false)}
                    className="flex-1 py-3 rounded-xl text-xs font-bold uppercase text-[#00418f] bg-[#00418f]/10 active:scale-95 transition-transform"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 rounded-xl text-xs font-bold uppercase text-white bg-[#00418f] shadow-md hover:brightness-110 active:scale-95 transition-transform"
                  >
                    Simpan
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Admin Mobile Bottom Tabs Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-gray-100 flex justify-around items-center px-4 py-2 shadow-lg">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
            activeTab === 'dashboard' ? 'text-[#00418f] scale-105 font-bold' : 'text-gray-400 hover:text-gray-700'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Dashboard</span>
        </button>

        <button 
          onClick={() => setActiveTab('karyawan')}
          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
            activeTab === 'karyawan' ? 'text-[#00418f] scale-105 font-bold' : 'text-gray-400 hover:text-gray-700'
          }`}
        >
          <Users className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Karyawan</span>
        </button>

        <button 
          onClick={() => setActiveTab('presensi')}
          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
            activeTab === 'presensi' ? 'text-[#00418f] scale-105 font-bold' : 'text-gray-400 hover:text-gray-700'
          }`}
        >
          <FileText className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Presensi</span>
        </button>

        <button 
          onClick={() => setActiveTab('pengaturan')}
          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
            activeTab === 'pengaturan' ? 'text-[#00418f] scale-105 font-bold' : 'text-gray-400 hover:text-gray-700'
          }`}
        >
          <Settings className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Settings</span>
        </button>
      </nav>

    </div>
  );
}
