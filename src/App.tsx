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
import { syncAttendanceToSheet } from './googleSheets';
import { ThemeProvider } from './ThemeContext';

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

  // Admin emails list
  const PRIMARY_ADMIN = 'contact@yayasanbaitulhikmah.com';
  const HARDCODED_ADMINS = ['contact@yayasanbaitulhikmah.com', 'anam@yayasanbaitulhikmah.com'];
  const [adminEmails, setAdminEmails] = useState<string[]>(() => {
    const stored = getStoredData('admin_emails', HARDCODED_ADMINS);
    // Merge hardcoded admins with stored ones
    const merged = [...new Set([...HARDCODED_ADMINS, ...stored])];
    return merged;
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
    // Cannot remove hardcoded admins
    if (HARDCODED_ADMINS.includes(email)) return;
    const updated = adminEmails.filter(e => e !== email);
    setAdminEmails(updated);
    setStoredData('admin_emails', updated);
  };

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
    // Find existing record by id only to avoid overwriting different records for same NIP+date
    const existsIdx = attendanceRecords.findIndex(r => r.id === record.id);
    
    let updated: AttendanceRecord[];
    if (existsIdx > -1) {
      // Update existing record (e.g., add checkout time)
      updated = [...attendanceRecords];
      updated[existsIdx] = record;
    } else {
      // Append new record
      updated = [record, ...attendanceRecords];
    }
    
    updateAttendance(updated);

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
    });

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

  return (
    <ThemeProvider>
      <div className="relative min-h-screen bg-[#F2F2F7] text-gray-900 dark:bg-gray-950 dark:text-gray-100 transition-colors duration-300">

      {currentView === 'employee' ? (
        <EmployeeApp 
          currentUser={session.role === 'employee' ? session.user : defaultEmployee}
          geofences={geofences}
          attendanceRecords={attendanceRecords}
          onAddAttendance={handleAddAttendance}
          onLogout={handleLogout}
          onChangeProfilePicture={handleChangeProfilePicture}
          limitTime={limitTime}
          isAdmin={session.role === 'admin' || adminEmails.includes(session.user?.email?.toLowerCase() || '')}
          onNavigateToAdmin={(session.role === 'admin' || adminEmails.includes(session.user?.email?.toLowerCase() || '')) ? () => setCurrentView('admin') : undefined}
        />
      ) : (session.role === 'admin' || adminEmails.includes(session.user?.email?.toLowerCase() || '')) ? (
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
