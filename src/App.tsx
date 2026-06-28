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
  INITIAL_ACTIVITIES,
  ASSETS
} from './data';
import { Employee, AttendanceRecord, Geofence, RecentActivity } from './types';
import EmployeeApp from './components/EmployeeApp';
import AdminPanel from './components/AdminPanel';
import LoginScreen from './components/LoginScreen';

export default function App() {
  const [currentView, setCurrentView] = useState<'employee' | 'admin'>(() => {
    const savedSession = getStoredData('session', null) as { role: 'employee' | 'admin' } | null;
    return savedSession?.role || 'employee';
  });
  
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

  // Admin emails list (can be managed from admin panel)
  // Security: validate against hardcoded primary admin on load
  const PRIMARY_ADMIN = 'contact@yayasanbaitulhikmah.com';
  const [adminEmails, setAdminEmails] = useState<string[]>(() => {
    const stored = getStoredData('admin_emails', [PRIMARY_ADMIN]);
    // Ensure primary admin is always present
    if (!stored.includes(PRIMARY_ADMIN)) {
      return [PRIMARY_ADMIN, ...stored];
    }
    return stored;
  });

  const handleAddAdminEmail = (email: string) => {
    const sanitized = email.toLowerCase().trim();
    if (!sanitized.includes('@') || sanitized.length < 5) return;
    if (adminEmails.includes(sanitized)) return;
    const updated = [...adminEmails, sanitized];
    setAdminEmails(updated);
    setStoredData('admin_emails', updated);
  };

  const handleRemoveAdminEmail = (email: string) => {
    // Cannot remove the primary admin
    if (email === PRIMARY_ADMIN) return;
    const updated = adminEmails.filter(e => e !== email);
    setAdminEmails(updated);
    setStoredData('admin_emails', updated);
  };

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

  // If no active session, show Login Screen
  if (!session) {
    return (
      <LoginScreen 
        employees={employees}
        onLoginSuccess={handleLoginSuccess}
        onAddEmployee={handleAddEmployee}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        adminEmails={adminEmails}
      />
    );
  }

  return (
    <div className="relative min-h-screen bg-[#F2F2F7] dark:bg-[#121214] text-gray-900 dark:text-gray-100 transition-colors duration-300">

      {currentView === 'employee' ? (
        <EmployeeApp 
          currentUser={session.role === 'employee' ? session.user : defaultEmployee}
          geofences={geofences}
          attendanceRecords={attendanceRecords}
          onAddAttendance={handleAddAttendance}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          onLogout={handleLogout}
          onChangeProfilePicture={handleChangeProfilePicture}
          limitTime={limitTime}
        />
      ) : session.role === 'admin' ? (
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
          adminEmails={adminEmails}
          onAddAdminEmail={handleAddAdminEmail}
          onRemoveAdminEmail={handleRemoveAdminEmail}
        />
      ) : null}
    </div>
  );
}
