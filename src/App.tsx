/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  INITIAL_EMPLOYEES, 
  INITIAL_GEOFENCES, 
  INITIAL_ATTENDANCE, 
  INITIAL_ACTIVITIES,
  ASSETS
} from './data';
import { Employee, AttendanceRecord, Geofence, RecentActivity } from './types';
import EmployeeApp from './components/EmployeeApp';
import AdminPanel from './components/AdminPanel';
import LoginScreen from './components/LoginScreen';
import CompleteProfile from './components/CompleteProfile';
import { syncAttendanceToSheet } from './googleSheets';
import { logout as googleLogout } from './googleAuth';
import { ThemeProvider } from './ThemeContext';
import { listenSettings, stopListening, saveSetting, listenOwnAttendance, listenAllAttendance, saveAttendanceByNip } from './firebaseDB';

export default function App() {
  const [currentView, setCurrentView] = useState<'employee' | 'admin'>('employee');
  
  // Cloud-only state: data HANYA dari Firebase, TIDAK dicache di localStorage.
  // Tiap session dibuka data dimuat ulang dari cloud (sumber tunggal antar akun/devices).
  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [geofences, setGeofences] = useState<Geofence[]>(INITIAL_GEOFENCES);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(INITIAL_ATTENDANCE);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>(INITIAL_ACTIVITIES);
  const [limitTime, setLimitTime] = useState<string>('07:00');
  const [jamPulang, setJamPulang] = useState<string>('14:00');
  const [jamMalamMasuk, setJamMalamMasuk] = useState<string>('18:30');
  const [jamMalamPulang, setJamMalamPulang] = useState<string>('22:00');
  const [hariLibur, setHariLibur] = useState<number[]>([6]);

  // Session state (null means logged out, shows Login screen).
  // Sesuai desain cloud-only: sesi tidak disimpan di localStorage,
  // di-restore otomatis oleh Firebase Auth (onAuthStateChanged).
  const [session, setSession] = useState<{ role: 'employee' | 'admin'; user: any } | null>(null);

  // Admin profile state
  const [adminProfile, setAdminProfile] = useState(() => ({
    nama: "Admin Baitul Hikmah",
    foto: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80",
    role: "Super Admin"
  }));

  // Admin emails list
  const PRIMARY_ADMIN = 'contact@yayasanbaitulhikmah.com';
  const HARDCODED_ADMINS = ['contact@yayasanbaitulhikmah.com', 'anam@yayasanbaitulhikmah.com'];
  const [adminEmails, setAdminEmails] = useState<string[]>(HARDCODED_ADMINS);

  // Flags: data cloud sudah termuat (menghindari "flash" data default saat login)
  const [cloudReady, setCloudReady] = useState(false);

  // Firebase Realtime Database sync
  // Dipasang HANYA setelah login: listener yang dipasang sebelum autentikasi
  // ditolak aturan "auth != null" dan tidak ter-refresh setelah login,
  // sehingga data cloud (geofences/QR, karyawan, dll) tidak pernah termuat
  // di browser/perangkat yang membuka aplikasi dalam keadaan belum login.
  useEffect(() => {
    if (!session) return;
    listenSettings((data) => {
      setCloudReady(true);
      if (Array.isArray(data.employees)) {
        setEmployees(data.employees as Employee[]);
      }
      if (Array.isArray(data.geofences)) {
        setGeofences(data.geofences as Geofence[]);
      }
      if (Array.isArray(data.activities)) {
        setRecentActivities(data.activities as RecentActivity[]);
      }
      if (data.limit_time) {
        setLimitTime(data.limit_time as string);
      }
      if (data.jam_pulang) {
        setJamPulang(data.jam_pulang as string);
      }
      if (data.jam_malam_masuk) {
        setJamMalamMasuk(data.jam_malam_masuk as string);
      }
      if (data.jam_malam_pulang) {
        setJamMalamPulang(data.jam_malam_pulang as string);
      }
      if (data.hari_libur) {
        setHariLibur(data.hari_libur as number[]);
      }
      if (data.admin_emails) {
        const emails = data.admin_emails as string[];
        setAdminEmails([...new Set([...HARDCODED_ADMINS, ...emails])]);
      }
      if (data.admin_profile) {
        setAdminProfile(data.admin_profile as { nama: string; foto: string; role: string });
      }
    });
    return () => stopListening();
  }, [session]);

  // Pengaman: kalau cloud tidak kunjung memberi data (mis. jaringan sangat lambat),
  // tetap jalankan aplikasi setelah 8 detik daripada stuck di layar loading.
  useEffect(() => {
    if (!session) return;
    const t = setTimeout(() => setCloudReady(true), 8000);
    return () => clearTimeout(t);
  }, [session]);

  // Attendance listener (per-user: karyawan dengar data sendiri, admin dengar semua)
  useEffect(() => {
    if (!session) return;

    if (session.role === 'employee') {
      const nip = session.user?.nip;
      if (!nip) return;
      const off = listenOwnAttendance(nip, (records) => {
        setAttendanceRecords(records);
      });
      return off;
    }

    // Admin: aggregate semua absensi
    const off = listenAllAttendance((records) => {
      setAttendanceRecords(records);
    });
    return off;
  }, [session]);

  const handleAddAdminEmail = (email: string) => {
    const sanitized = email.toLowerCase().trim();
    if (!sanitized.includes('@') || sanitized.length < 5) return;
    if (adminEmails.includes(sanitized)) return;
    const updated = [...adminEmails, sanitized];
    setAdminEmails(updated);
    saveSetting('admin_emails', updated);
  };

  const handleRemoveAdminEmail = (email: string) => {
    if (HARDCODED_ADMINS.includes(email)) return;
    const updated = adminEmails.filter(e => e !== email);
    setAdminEmails(updated);
    saveSetting('admin_emails', updated);
  };

  // Sync state to cloud Firebase on update (cloud-only, tanpa localStorage)
  const updateEmployees = (newEmployees: Employee[]) => {
    setEmployees(newEmployees);
    saveSetting('employees', newEmployees);
  };

  const updateGeofences = (newGeofences: Geofence[]) => {
    setGeofences(newGeofences);
    return saveSetting('geofences', newGeofences);
  };

  // Paksa kirim ulang data lokasi/geofence ke cloud Firebase.
  // Dipakai tombol "Sinkronkan ke Cloud" di pengaturan agar data
  // yang sudah dibuat tervalidasi tersimpan server (lintas browser/device).
  const syncGeofencesToCloud = async () => {
    await updateGeofences(geofences);
  };

  const updateAttendance = (newAttendance: AttendanceRecord[]) => {
    setAttendanceRecords(newAttendance);
  };

  const updateActivities = (newActivities: RecentActivity[]) => {
    setRecentActivities(newActivities);
    saveSetting('activities', newActivities);
  };

  const updateLimitTimeValue = (newTime: string) => {
    setLimitTime(newTime);
    saveSetting('limit_time', newTime);
  };

  const updateJamPulang = (newTime: string) => {
    setJamPulang(newTime);
    saveSetting('jam_pulang', newTime);
  };

  const updateJamMalamMasuk = (newTime: string) => {
    setJamMalamMasuk(newTime);
    saveSetting('jam_malam_masuk', newTime);
  };

  const updateJamMalamPulang = (newTime: string) => {
    setJamMalamPulang(newTime);
    saveSetting('jam_malam_pulang', newTime);
  };

  const updateHariLibur = (newDays: number[]) => {
    setHariLibur(newDays);
    saveSetting('hari_libur', newDays);
  };

  const handleLoginSuccess = (newSession: { role: 'employee' | 'admin'; user: any }) => {
    setSession(newSession);
    setCurrentView(newSession.role);
  };

  const handleLogout = async () => {
    await googleLogout().catch(() => {});
    setSession(null);
  };

  // Simpan profil kepegawaian pertama kali (pengguna baru) lalu lanjut ke presensi.
  const handleCompleteProfile = (updates: Partial<Employee>) => {
    if (!session) return;
    const user = session.user as Employee;
    const merged: Employee = { ...user, ...updates, profileCompleted: true };
    let updated = employees.map(e => e.nip === user.nip ? { ...e, ...merged } : e);
    if (!employees.some(e => e.nip === user.nip)) {
      updated = [merged, ...updated];
    }
    updateEmployees(updated);
    setSession({ ...session, user: merged });
  };

  const handleChangeProfilePicture = (nip: string, newFoto: string) => {
    const updated = employees.map(emp => {
      if (emp.nip === nip) {
        return { ...emp, foto: newFoto };
      }
      return emp;
    });
    updateEmployees(updated);

    // Sync state if currently logged in as this employee
    if (session && session.role === 'employee' && session.user.nip === nip) {
      setSession({
        ...session,
        user: { ...session.user, foto: newFoto }
      });
    }
  };

  const handleUpdateEmployeeProfile = (nip: string, updates: Partial<Employee>) => {
    const updated = employees.map(emp => {
      if (emp.nip === nip) {
        return { ...emp, ...updates };
      }
      return emp;
    });
    updateEmployees(updated);

    // Sync session if currently logged in as this employee
    if (session && session.role === 'employee' && session.user.nip === nip) {
      setSession({
        ...session,
        user: { ...session.user, ...updates }
      });
    }
  };

  const handleChangeAdminProfilePicture = (newFoto: string) => {
    const updatedAdmin = { ...adminProfile, foto: newFoto };
    setAdminProfile(updatedAdmin);
    saveSetting('admin_profile', updatedAdmin);

    // Sync session
    if (session && session.role === 'admin') {
      const updatedSession = {
        ...session,
        user: { ...session.user, foto: newFoto }
      };
      setSession(updatedSession);
    }
  };

  // Default employee fallback (for admin switching to employee view)
  const defaultEmployee = employees[0] || {
    nip: 'SYSTEM',
    nama: 'User',
    jabatan: 'Pegawai',
    lembaga: 'Yayasan Baitul Hikmah',
    foto: ASSETS.genericAvatar,
    email: ''
  };

  const handleAddAttendance = (record: AttendanceRecord) => {
    handleAddAttendanceBatch([record]);
  };

  const handleAddAttendanceBatch = async (records: AttendanceRecord[]): Promise<boolean> => {
    let updated = [...attendanceRecords];
    records.forEach(record => {
      // Find existing record by id only to avoid overwriting different records for same NIP+date
      const existsIdx = updated.findIndex(r => r.id === record.id);
      if (existsIdx > -1) {
        // Update existing record (e.g., add checkout time)
        updated[existsIdx] = record;
      } else {
        // Append new record
        updated = [record, ...updated];
      }
    });

    updateAttendance(updated);

    const newActivities: RecentActivity[] = [];
    records.forEach(record => {
      // Auto-sync to Google Sheets via webhook
      const emp = employees.find(e => e.nip === record.nip);
      syncAttendanceToSheet({
        tanggal: record.tanggal,
        nama: record.nama,
        jabatan: emp?.jabatan || '',
        lembaga: emp?.lembaga || '',
        masuk: record.masuk,
        keluar: record.keluar,
        status: record.status,
        lokasi: record.lokasi,
        keterangan: record.keterangan,
        sesi: record.sesi || 'siang',
      });

      // Append to recent activities log
      const activityType = record.status === 'Izin' ? 'tambah' : record.keluar ? 'keluar' : 'masuk';
      const activityDesc = record.status === 'Izin' 
        ? `mengajukan izin hadir (${record.keterangan})` 
        : record.keluar 
        ? 'melakukan presensi keluar' 
        : 'melakukan presensi masuk';

      newActivities.push({
        id: `act-${Date.now()}-${record.id}`,
        nip: record.nip,
        nama: record.nama,
        tipe: activityType,
        waktu: 'Baru saja',
        keterangan: activityDesc
      });
    });
    if (newActivities.length > 0) {
      updateActivities([...newActivities, ...recentActivities]);
    }

    try {
      await saveAttendanceByNip(updated);
      return true;
    } catch (err) {
      console.error('Data absen gagal disinkronkan ke Firebase:', err);
      return false;
    }
  };

  const handleAddEmployee = (newEmp: Employee) => {
    const updated = [newEmp, ...employees];
    updateEmployees(updated);

    const newActivity: RecentActivity = {
      id: `act-${Date.now()}`,
      nip: newEmp.nip,
      nama: newEmp.nama,
      tipe: 'tambah',
      waktu: 'Baru saja',
      keterangan: `Karyawan baru ${newEmp.nama} ditambahkan`
    };
    updateActivities([newActivity, ...recentActivities]);
  };

  const handleDeleteEmployee = (nip: string) => {
    const updated = employees.filter(e => e.nip !== nip);
    updateEmployees(updated);
  };

  const handleAddGeofence = (newGeo: Geofence) => {
    const updated = [...geofences, newGeo];
    updateGeofences(updated);
  };

  const handleUpdateGeofence = (id: string, updates: Partial<Geofence>) => {
    const updated = geofences.map(g => g.id === id ? { ...g, ...updates } : g);
    updateGeofences(updated);
  };

  const handleDeleteGeofence = (id: string) => {
    const updated = geofences.filter(g => g.id !== id);
    updateGeofences(updated);
  };

  // If no active session, show Login Screen
  if (!session) {
    return (
      <ThemeProvider>
        <LoginScreen 
          employees={employees}
          onLoginSuccess={handleLoginSuccess}
          onAddEmployee={handleAddEmployee}
          adminEmails={adminEmails}
        />
      </ThemeProvider>
    );
  }

  // Layar loading singkat saat data cloud sedang dimuat (menghindari flash data default)
  if (!cloudReady) {
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-[#F2F2F7] dark:bg-gray-950 flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 border-4 border-[#00418f] border-t-transparent rounded-full animate-spin dark:border-blue-400" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Memuat data terbaru dari cloud...</p>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <div className="relative min-h-screen bg-[#F2F2F7] text-gray-900 dark:bg-gray-950 dark:text-gray-100 transition-colors duration-300">

      {session.role === 'employee' && (session.user as Employee)?.profileCompleted === false ? (
        <CompleteProfile
          user={session.user as Employee}
          onSave={handleCompleteProfile}
          onLogout={handleLogout}
        />
      ) : currentView === 'employee' ? (
        <EmployeeApp 
          currentUser={session.role === 'employee' ? session.user : defaultEmployee}
          geofences={geofences}
          attendanceRecords={attendanceRecords}
          onAddAttendance={handleAddAttendance}
          onAddAttendanceBatch={handleAddAttendanceBatch}
          onLogout={handleLogout}
          onChangeProfilePicture={handleChangeProfilePicture}
          onUpdateEmployeeProfile={handleUpdateEmployeeProfile}
          limitTime={limitTime}
          jamPulang={jamPulang}
          jamMalamMasuk={jamMalamMasuk}
          jamMalamPulang={jamMalamPulang}
          isAdmin={session.role === 'admin' || adminEmails.includes(session.user?.email?.toLowerCase() || '')}
          onNavigateToAdmin={(session.role === 'admin' || adminEmails.includes(session.user?.email?.toLowerCase() || '')) ? () => setCurrentView('admin') : undefined}
          hariLibur={hariLibur}
        />
      ) : (session.role === 'admin' || adminEmails.includes(session.user?.email?.toLowerCase() || '')) ? (
        <AdminPanel 
          employees={employees}
          attendanceRecords={attendanceRecords}
          geofences={geofences}
          recentActivities={recentActivities}
          limitTime={limitTime}
          jamPulang={jamPulang}
          jamMalamMasuk={jamMalamMasuk}
          jamMalamPulang={jamMalamPulang}
          hariLibur={hariLibur}
          onSetLimitTime={updateLimitTimeValue}
          onSetJamPulang={updateJamPulang}
          onSetJamMalamMasuk={updateJamMalamMasuk}
          onSetJamMalamPulang={updateJamMalamPulang}
          onSetHariLibur={updateHariLibur}
          onAddEmployee={handleAddEmployee}
          onDeleteEmployee={handleDeleteEmployee}
          onAddGeofence={handleAddGeofence}
          onUpdateGeofence={handleUpdateGeofence}
          onDeleteGeofence={handleDeleteGeofence}
          onSyncGeofences={syncGeofencesToCloud}
          onBackToEmployee={() => setCurrentView('employee')}
          adminProfile={adminProfile}
          onChangeAdminProfilePicture={handleChangeAdminProfilePicture}
          onLogout={handleLogout}
          adminEmails={adminEmails}
          onAddAdminEmail={handleAddAdminEmail}
          onRemoveAdminEmail={handleRemoveAdminEmail}
        />
      ) : null}
      </div>
    </ThemeProvider>
  );
}
