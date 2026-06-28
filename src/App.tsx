/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  getStoredData, 
  setStoredData, 
  INITIAL_EMPLOYEES, 
  INITIAL_GEOFENCES, 
  INITIAL_ATTENDANCE, 
  INITIAL_ACTIVITIES 
} from './data';
import { Employee, AttendanceRecord, Geofence, RecentActivity } from './types';
import EmployeeApp from './components/EmployeeApp';
import AdminPanel from './components/AdminPanel';
import LoginScreen from './components/LoginScreen';
import { ShieldCheck, User, Sparkles, RefreshCw, LogOut } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState<'employee' | 'admin'>('employee');
  
  // App-level state initialized from localStorage
  const [employees, setEmployees] = useState<Employee[]>(() => getStoredData('employees', INITIAL_EMPLOYEES));
  const [geofences, setGeofences] = useState<Geofence[]>(() => getStoredData('geofences', INITIAL_GEOFENCES));
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => getStoredData('attendance', INITIAL_ATTENDANCE));
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>(() => getStoredData('activities', INITIAL_ACTIVITIES));
  const [limitTime, setLimitTime] = useState<string>(() => getStoredData('limit_time', '07:00'));
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('darkMode') === 'true';
  });

  // Session state (null means logged out, shows Login screen)
  const [session, setSession] = useState<{ role: 'employee' | 'admin'; user: any } | null>(() => {
    return getStoredData('session', null);
  });

  // Admin profile state
  const [adminProfile, setAdminProfile] = useState(() => getStoredData('admin_profile', {
    nama: "Admin Baitul Hikmah",
    foto: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80",
    role: "Super Admin"
  }));

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  // Sync state to localStorage on update
  const updateEmployees = (newEmployees: Employee[]) => {
    setEmployees(newEmployees);
    setStoredData('employees', newEmployees);
  };

  const updateGeofences = (newGeofences: Geofence[]) => {
    setGeofences(newGeofences);
    setStoredData('geofences', newGeofences);
  };

  const updateAttendance = (newAttendance: AttendanceRecord[]) => {
    setAttendanceRecords(newAttendance);
    setStoredData('attendance', newAttendance);
  };

  const updateActivities = (newActivities: RecentActivity[]) => {
    setRecentActivities(newActivities);
    setStoredData('activities', newActivities);
  };

  const updateLimitTimeValue = (newTime: string) => {
    setLimitTime(newTime);
    setStoredData('limit_time', newTime);
  };

  const handleLoginSuccess = (newSession: { role: 'employee' | 'admin'; user: any }) => {
    setSession(newSession);
    setStoredData('session', newSession);
    setCurrentView(newSession.role);
  };

  const handleLogout = () => {
    setSession(null);
    setStoredData('session', null);
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
      const updatedSession = {
        ...session,
        user: { ...session.user, foto: newFoto }
      };
      setSession(updatedSession);
      setStoredData('session', updatedSession);
    }
  };

  const handleChangeAdminProfilePicture = (newFoto: string) => {
    const updatedAdmin = { ...adminProfile, foto: newFoto };
    setAdminProfile(updatedAdmin);
    setStoredData('admin_profile', updatedAdmin);

    // Sync session
    if (session && session.role === 'admin') {
      const updatedSession = {
        ...session,
        user: { ...session.user, foto: newFoto }
      };
      setSession(updatedSession);
      setStoredData('session', updatedSession);
    }
  };

  // Pre-selected default employee for dev purposes
  const defaultEmployee = employees.find(e => e.nip === '19920801') || employees[0] || INITIAL_EMPLOYEES[0];

  const handleAddAttendance = (record: AttendanceRecord) => {
    // Check if record exists for update (checkout) or append (checkin)
    const existsIdx = attendanceRecords.findIndex(r => r.id === record.id || (r.nip === record.nip && r.tanggal === record.tanggal));
    
    let updated: AttendanceRecord[];
    if (existsIdx > -1) {
      updated = [...attendanceRecords];
      updated[existsIdx] = record;
    } else {
      updated = [record, ...attendanceRecords];
    }
    
    updateAttendance(updated);

    // Append to recent activities log
    const activityType = record.status === 'Izin' ? 'tambah' : record.keluar ? 'keluar' : 'masuk';
    const activityDesc = record.status === 'Izin' 
      ? `mengajukan izin hadir (${record.keterangan})` 
      : record.keluar 
      ? 'melakukan presensi keluar' 
      : 'melakukan presensi masuk';

    const newActivity: RecentActivity = {
      id: `act-${Date.now()}`,
      nip: record.nip,
      nama: record.nama,
      tipe: activityType,
      waktu: 'Baru saja',
      keterangan: activityDesc
    };
    updateActivities([newActivity, ...recentActivities]);
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

  const handleDeleteGeofence = (id: string) => {
    const updated = geofences.filter(g => g.id !== id);
    updateGeofences(updated);
  };

  // Reset demo states to initial setup
  const handleResetDemoData = () => {
    if (confirm('Apakah Anda ingin menyetel ulang semua data demo ke konfigurasi awal?')) {
      localStorage.clear();
      setEmployees(INITIAL_EMPLOYEES);
      setGeofences(INITIAL_GEOFENCES);
      setAttendanceRecords(INITIAL_ATTENDANCE);
      setRecentActivities(INITIAL_ACTIVITIES);
      setLimitTime('07:00');
      setSession(null);
      setAdminProfile({
        nama: "Admin Baitul Hikmah",
        foto: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80",
        role: "Super Admin"
      });
      
      setStoredData('employees', INITIAL_EMPLOYEES);
      setStoredData('geofences', INITIAL_GEOFENCES);
      setStoredData('attendance', INITIAL_ATTENDANCE);
      setStoredData('activities', INITIAL_ACTIVITIES);
      setStoredData('limit_time', '07:00');
      
      alert('Data demo berhasil disetel ulang!');
    }
  };

  // If no active session, show Login Screen
  if (!session) {
    return (
      <LoginScreen 
        employees={employees}
        onLoginSuccess={handleLoginSuccess}
        onAddEmployee={handleAddEmployee}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />
    );
  }

  return (
    <div className="relative min-h-screen bg-[#F2F2F7] dark:bg-[#121214] text-gray-900 dark:text-gray-100 transition-colors duration-300">
      
      {/* Floating Interactive Role Switcher Banner */}
      <div className="fixed top-20 right-4 z-[100] flex flex-col gap-2">
        <div className="bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-md px-3.5 py-2.5 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-800 flex flex-col gap-1.5 max-w-[210px] transition-colors duration-300">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
            <Sparkles className="w-3.5 h-3.5 text-[#005bc1] dark:text-[#3b82f6]" />
            Sistem Role Portal
          </div>
          
          <button 
            onClick={() => {
              const target = currentView === 'employee' ? 'admin' : 'employee';
              setCurrentView(target);
              // Auto-fill active session with admin or default employee if switching manually
              if (target === 'admin' && session.role !== 'admin') {
                setSession({
                  role: 'admin',
                  user: {
                    nama: adminProfile.nama,
                    foto: adminProfile.foto,
                    role: adminProfile.role
                  }
                });
              } else if (target === 'employee' && session.role !== 'employee') {
                setSession({
                  role: 'employee',
                  user: defaultEmployee
                });
              }
            }}
            className="w-full text-left flex items-center justify-between gap-3 text-xs bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 px-3 py-2 rounded-xl border border-gray-100 dark:border-zinc-800 font-bold transition-all active:scale-95 text-gray-800 dark:text-gray-200"
          >
            {currentView === 'employee' ? (
              <>
                <span className="text-amber-700 dark:text-amber-500 flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                  Admin Panel
                </span>
                <span className="text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 px-1 py-0.5 rounded">Tukar</span>
              </>
            ) : (
              <>
                <span className="text-[#0058bc] dark:text-[#3b82f6] flex items-center gap-1">
                  <User className="w-4 h-4 text-[#0058bc] dark:text-[#3b82f6]" />
                  App Pegawai
                </span>
                <span className="text-[10px] bg-[#0058bc]/5 dark:bg-blue-950/40 text-[#0058bc] dark:text-[#3b82f6] px-1 py-0.5 rounded">Tukar</span>
              </>
            )}
          </button>

          {/* Real Logout option in panel */}
          <button
            onClick={handleLogout}
            className="w-full text-left flex items-center justify-between gap-3 text-xs bg-rose-50 dark:bg-rose-950/10 hover:bg-rose-100/75 dark:hover:bg-rose-950/30 px-3 py-2 rounded-xl border border-rose-100/50 dark:border-rose-900/30 font-bold transition-all active:scale-95 text-rose-600 dark:text-rose-400"
          >
            <span className="flex items-center gap-1">
              <LogOut className="w-4 h-4" />
              Keluar Sesi
            </span>
            <span className="text-[10px] px-1 py-0.5 rounded">Exit</span>
          </button>

          {/* Reset Demo button */}
          <button 
            onClick={handleResetDemoData}
            title="Setel Ulang Data Demo"
            className="w-full text-center flex items-center justify-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors py-1 mt-1 border-t border-gray-100 dark:border-zinc-800 font-medium"
          >
            <RefreshCw className="w-2.5 h-2.5 animate-spin" style={{ animationDuration: '6s' }} />
            Setel Ulang Demo
          </button>
        </div>
      </div>

      {currentView === 'employee' ? (
        <EmployeeApp 
          currentUser={session.role === 'employee' ? session.user : defaultEmployee}
          geofences={geofences}
          attendanceRecords={attendanceRecords}
          onAddAttendance={handleAddAttendance}
          onNavigateToAdmin={() => {
            setCurrentView('admin');
            setSession({
              role: 'admin',
              user: {
                nama: adminProfile.nama,
                foto: adminProfile.foto,
                role: adminProfile.role
              }
            });
          }}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          onLogout={handleLogout}
          onChangeProfilePicture={handleChangeProfilePicture}
        />
      ) : (
        <AdminPanel 
          employees={employees}
          attendanceRecords={attendanceRecords}
          geofences={geofences}
          recentActivities={recentActivities}
          limitTime={limitTime}
          onSetLimitTime={updateLimitTimeValue}
          onAddEmployee={handleAddEmployee}
          onDeleteEmployee={handleDeleteEmployee}
          onAddGeofence={handleAddGeofence}
          onDeleteGeofence={handleDeleteGeofence}
          onBackToEmployee={() => {
            setCurrentView('employee');
            setSession({
              role: 'employee',
              user: defaultEmployee
            });
          }}
          adminProfile={adminProfile}
          onChangeAdminProfilePicture={handleChangeAdminProfilePicture}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}
