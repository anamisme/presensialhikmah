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
import { ShieldCheck, User, Sparkles, RefreshCw } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState<'employee' | 'admin'>('employee');
  
  // App-level state initialized from localStorage
  const [employees, setEmployees] = useState<Employee[]>(() => getStoredData('employees', INITIAL_EMPLOYEES));
  const [geofences, setGeofences] = useState<Geofence[]>(() => getStoredData('geofences', INITIAL_GEOFENCES));
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => getStoredData('attendance', INITIAL_ATTENDANCE));
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>(() => getStoredData('activities', INITIAL_ACTIVITIES));
  const [limitTime, setLimitTime] = useState<string>(() => getStoredData('limit_time', '07:00'));

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

  // Pre-selected default employee "Ahmad"
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
    const newActivity: RecentActivity = {
      id: `act-${Date.now()}`,
      nip: record.nip,
      nama: record.nama,
      tipe: record.keluar ? 'keluar' : 'masuk',
      waktu: 'Baru saja',
      keterangan: record.keluar ? 'melakukan presensi keluar' : 'melakukan presensi masuk'
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
      
      setStoredData('employees', INITIAL_EMPLOYEES);
      setStoredData('geofences', INITIAL_GEOFENCES);
      setStoredData('attendance', INITIAL_ATTENDANCE);
      setStoredData('activities', INITIAL_ACTIVITIES);
      setStoredData('limit_time', '07:00');
      
      alert('Data demo berhasil disetel ulang!');
    }
  };

  return (
    <div className="relative min-h-screen">
      
      {/* Floating Interactive Role Switcher Banner */}
      <div className="fixed top-20 right-4 z-[100] flex flex-col gap-2">
        <div className="bg-white/95 backdrop-blur-md px-3.5 py-2.5 rounded-2xl shadow-xl border border-gray-100 flex flex-col gap-1.5 max-w-[210px]">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wide">
            <Sparkles className="w-3.5 h-3.5 text-[#005bc1]" />
            Sistem Role Portal
          </div>
          
          <button 
            onClick={() => setCurrentView(currentView === 'employee' ? 'admin' : 'employee')}
            className="w-full text-left flex items-center justify-between gap-3 text-xs bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-xl border border-gray-100 font-bold transition-all active:scale-95"
          >
            {currentView === 'employee' ? (
              <>
                <span className="text-amber-700 flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  Admin Panel
                </span>
                <span className="text-[10px] bg-amber-50 text-amber-800 px-1 py-0.5 rounded">Tukar</span>
              </>
            ) : (
              <>
                <span className="text-[#0058bc] flex items-center gap-1">
                  <User className="w-4 h-4 text-[#0058bc]" />
                  App Pegawai
                </span>
                <span className="text-[10px] bg-[#0058bc]/5 text-[#0058bc] px-1 py-0.5 rounded">Tukar</span>
              </>
            )}
          </button>

          {/* Reset Demo button */}
          <button 
            onClick={handleResetDemoData}
            title="Setel Ulang Data Demo"
            className="w-full text-center flex items-center justify-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 transition-colors py-1 mt-1 border-t border-gray-100 font-medium"
          >
            <RefreshCw className="w-2.5 h-2.5 animate-spin" style={{ animationDuration: '6s' }} />
            Setel Ulang Demo
          </button>
        </div>
      </div>

      {currentView === 'employee' ? (
        <EmployeeApp 
          currentUser={defaultEmployee}
          geofences={geofences}
          attendanceRecords={attendanceRecords}
          onAddAttendance={handleAddAttendance}
          onNavigateToAdmin={() => setCurrentView('admin')}
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
          onBackToEmployee={() => setCurrentView('employee')}
        />
      )}
    </div>
  );
}
