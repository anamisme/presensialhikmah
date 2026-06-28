/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  ShieldCheck, 
  LogIn, 
  Fingerprint, 
  Sparkles, 
  Moon, 
  Sun,
  Building2,
  Mail,
  ShieldAlert,
  HelpCircle
} from 'lucide-react';
import { Employee } from '../types';
import { ASSETS } from '../data';
import { googleSignIn } from '../googleAuth';

interface LoginScreenProps {
  employees: Employee[];
  onLoginSuccess: (session: { role: 'employee' | 'admin'; user: any }) => void;
  onAddEmployee?: (emp: Employee) => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
}

export default function LoginScreen({
  employees,
  onLoginSuccess,
  onAddEmployee,
  darkMode,
  setDarkMode
}: LoginScreenProps) {
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Dev simulation state
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [simulatedEmail, setSimulatedEmail] = useState('ahmad@yayasanbaitulhikmah.com');

  const handleLoginSuccessWithDetails = (googleUser: any) => {
    const email = googleUser.email;
    if (!email) {
      setError('Gagal membaca alamat email dari akun Google Anda.');
      return;
    }

    const emailLower = email.toLowerCase();
    
    // 1. Check if Administrator (contact@yayasanbaitulhikmah.com or admin@)
    if (emailLower === 'contact@yayasanbaitulhikmah.com' || emailLower === 'admin@yayasanbaitulhikmah.com') {
      setSuccessMsg('Autentikasi Berhasil! Masuk sebagai Super Admin...');
      setTimeout(() => {
        onLoginSuccess({
          role: 'admin',
          user: {
            nama: googleUser.displayName || "Admin Baitul Hikmah",
            foto: googleUser.photoURL || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80",
            role: "Super Admin",
            email: emailLower
          }
        });
      }, 1000);
      return;
    }

    // 2. Check if email belongs to the allowed organization domain
    const isOrgEmail = emailLower.endsWith('@yayasanbaitulhikmah.com');
    if (!isOrgEmail) {
      setError('Akses ditolak. Silakan gunakan akun Google Workspace dengan email organisasi resmi (@yayasanbaitulhikmah.com).');
      return;
    }

    // 3. Find if employee is already registered in our list
    const foundEmployee = employees.find(emp => emp.email?.toLowerCase() === emailLower);

    if (foundEmployee) {
      setSuccessMsg(`Selamat datang kembali, ${foundEmployee.nama}!`);
      setTimeout(() => {
        onLoginSuccess({
          role: 'employee',
          user: foundEmployee
        });
      }, 1000);
    } else {
      // 4. Dynamic Auto-Registration for new organization emails
      const generatedNip = `YBH-${Math.floor(10000000 + Math.random() * 90000000)}`;
      const newEmpName = googleUser.displayName || emailLower.split('@')[0].replace(/[^a-zA-Z]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      
      const newEmp: Employee = {
        nip: generatedNip,
        nama: newEmpName,
        jabatan: "Staf Organisasi",
        lembaga: "Lembaga IT & Digital",
        foto: googleUser.photoURL || ASSETS.genericAvatar,
        email: emailLower
      };

      setSuccessMsg(`Email organisasi baru terdeteksi. Mendaftarkan ${newEmpName} sebagai identitas karyawan resmi...`);
      
      // Save new employee via app callback
      if (onAddEmployee) {
        onAddEmployee(newEmp);
      }

      setTimeout(() => {
        onLoginSuccess({
          role: 'employee',
          user: newEmp
        });
      }, 1800);
    }
  };

  const handleGoogleSignInClick = async () => {
    setError(null);
    setSuccessMsg(null);
    setIsAuthenticating(true);

    try {
      const res = await googleSignIn();
      if (res && res.user) {
        handleLoginSuccessWithDetails(res.user);
      } else {
        setError('Proses masuk Google dibatalkan atau gagal.');
        setIsAuthenticating(false);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Gagal terhubung dengan layanan Google Auth.');
      setIsAuthenticating(false);
    }
  };

  // Simulation for Dev Workspace testing purposes
  const handleSimulateLogin = (email: string) => {
    setError(null);
    setSuccessMsg(null);
    setIsAuthenticating(true);

    setTimeout(() => {
      const nameFromEmail = email.split('@')[0].replace(/\b\w/g, c => c.toUpperCase());
      const mockGoogleUser = {
        email: email,
        displayName: nameFromEmail + " (Simulated)",
        photoURL: email.includes('ahmad') ? ASSETS.ahmadProfile 
                : email.includes('budi') ? ASSETS.budiProfile 
                : email.includes('siti') ? ASSETS.sitiProfile 
                : ASSETS.genericAvatar
      };
      handleLoginSuccessWithDetails(mockGoogleUser);
    }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#F2F2F7] dark:bg-[#121214] px-4 py-12 transition-colors duration-300">
      
      {/* Decorative Blur Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-blue-400/10 dark:bg-blue-600/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-emerald-400/10 dark:bg-emerald-600/5 blur-[120px] pointer-events-none" />

      {/* Theme Switcher top right */}
      <div className="absolute top-6 right-6">
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-3 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-zinc-800 text-gray-500 dark:text-gray-400 shadow-sm hover:brightness-95 active:scale-95 transition-all cursor-pointer"
        >
          {darkMode ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-indigo-600" />}
        </button>
      </div>

      <div className="w-full max-w-md z-10 space-y-6">
        
        {/* Main Logo & Headline */}
        <div className="text-center space-y-3">
          <div className="inline-flex p-4 rounded-3xl bg-gradient-to-tr from-[#005bc1] to-blue-500 text-white shadow-xl shadow-blue-500/10">
            <Fingerprint className="w-10 h-10 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-black tracking-tight text-gray-800 dark:text-gray-100 uppercase">
              PRESENSI YAYASAN
            </h1>
            <p className="text-xs font-bold text-[#005bc1] dark:text-[#3b82f6] uppercase tracking-widest flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Baitul Hikmah Smart Portal
            </p>
          </div>
        </div>

        {/* Card Container */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-zinc-800 rounded-[32px] p-8 shadow-2xl shadow-gray-200/50 dark:shadow-black/20 transition-all duration-300"
        >
          <div className="space-y-6 text-center">
            
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 dark:bg-blue-950/30 text-[#005bc1] dark:text-blue-400">
                <Building2 className="w-3.5 h-3.5" />
                Google Workspace Access Only
              </span>
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Portal Kehadiran Pegawai</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 max-w-[280px] mx-auto leading-relaxed">
                Silakan masuk menggunakan email resmi organisasi Anda untuk memverifikasi identitas dan melakukan presensi geofence.
              </p>
            </div>

            {/* Error Message Banner */}
            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 p-4 rounded-2xl text-left flex gap-3 text-xs text-rose-600 dark:text-rose-400"
              >
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">Akses Tidak Diizinkan</p>
                  <p className="leading-relaxed font-medium">{error}</p>
                </div>
              </motion.div>
            )}

            {/* Success Message Banner */}
            {successMsg && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 p-4 rounded-2xl text-left flex gap-3 text-xs text-emerald-700 dark:text-emerald-400"
              >
                <div className="w-5 h-5 shrink-0 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-[10px] animate-bounce">
                  ✓
                </div>
                <div className="space-y-1">
                  <p className="font-bold">Berhasil</p>
                  <p className="leading-relaxed font-medium">{successMsg}</p>
                </div>
              </motion.div>
            )}

            {/* Main Google Login Button */}
            <button
              onClick={handleGoogleSignInClick}
              disabled={isAuthenticating}
              className="w-full bg-slate-900 hover:bg-black dark:bg-zinc-800 dark:hover:bg-zinc-700 disabled:opacity-50 text-white font-bold py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 text-sm cursor-pointer border border-zinc-800/80 dark:border-zinc-700/80"
            >
              {isAuthenticating ? (
                <>
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Memverifikasi Akun...</span>
                </>
              ) : (
                <>
                  {/* Colorful Flat Vector Google "G" Icon */}
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.47 14.98 1 12 1 7.35 1 3.39 3.65 1.56 7.56l3.87 3C6.35 7.67 8.92 5.04 12 5.04z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.43c-.28 1.44-1.09 2.66-2.32 3.49l3.61 2.8c2.11-1.95 3.34-4.81 3.34-8.18.01-.26-.02-.5-.07-.26z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.43 14.44c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29l-3.87-3C.72 8.52 0 10.18 0 12s.72 3.48 1.56 5.15l3.87-3.01z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c3.24 0 5.95-1.08 7.93-2.91l-3.61-2.8c-1.12.75-2.52 1.19-4.32 1.19-3.08 0-5.65-2.63-6.57-5.52l-3.87 3C3.39 20.35 7.35 23 12 23z"
                    />
                  </svg>
                  <span>Masuk dengan Google Workspace</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">
              <Mail className="w-3.5 h-3.5" />
              domain: @yayasanbaitulhikmah.com
            </div>

          </div>
        </motion.div>

        {/* Development Helper Panel (Bypass/Simulasi Login) */}
        <div className="bg-gray-200/50 dark:bg-zinc-900/30 border border-gray-300/30 dark:border-zinc-800/50 rounded-2xl p-4 text-center transition-all duration-300">
          <button 
            onClick={() => setShowDevPanel(!showDevPanel)}
            className="inline-flex items-center gap-1 text-xs font-bold text-[#005bc1] dark:text-blue-400 hover:underline cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
            {showDevPanel ? 'Sembunyikan Menu Simulasi' : 'Tampilkan Simulasi Akun (Testing)'}
          </button>

          {showDevPanel && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 pt-3 border-t border-gray-300/40 dark:border-zinc-800/60 text-left space-y-3"
            >
              <p className="text-[10px] text-gray-500 leading-normal font-medium">
                Gunakan dropdown di bawah untuk mensimulasikan login Google Workspace tanpa membuka jendela pop-up Google asli. Cocok untuk menguji identitas admin atau karyawan yang berbeda.
              </p>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Pilih Akun Simulasi</label>
                <div className="flex gap-2">
                  <select 
                    value={simulatedEmail}
                    onChange={(e) => setSimulatedEmail(e.target.value)}
                    className="flex-grow bg-white dark:bg-[#1C1C1E] border border-gray-300/40 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 outline-none"
                  >
                    <optgroup label="Super Admin">
                      <option value="contact@yayasanbaitulhikmah.com">contact@yayasanbaitulhikmah.com (Admin)</option>
                    </optgroup>
                    <optgroup label="Daftar Karyawan Bawaan">
                      <option value="ahmad@yayasanbaitulhikmah.com">ahmad@yayasanbaitulhikmah.com (Ahmad - IT)</option>
                      <option value="budi@yayasanbaitulhikmah.com">budi@yayasanbaitulhikmah.com (Budi - Kepala Bagian)</option>
                      <option value="siti@yayasanbaitulhikmah.com">siti@yayasanbaitulhikmah.com (Siti - Keuangan)</option>
                      <option value="dian@yayasanbaitulhikmah.com">dian@yayasanbaitulhikmah.com (Dian - Logistik)</option>
                      <option value="agus@yayasanbaitulhikmah.com">agus@yayasanbaitulhikmah.com (Agus - Operator)</option>
                    </optgroup>
                    <optgroup label="Pendaftaran Otomatis Baru">
                      <option value="hasan.basri@yayasanbaitulhikmah.com">hasan.basri@yayasanbaitulhikmah.com (Baru)</option>
                      <option value="zainab.nur@yayasanbaitulhikmah.com">zainab.nur@yayasanbaitulhikmah.com (Baru)</option>
                    </optgroup>
                    <optgroup label="Eksklusif (Ditolak / Non-Organisasi)">
                      <option value="hacker@gmail.com">hacker@gmail.com (Personal Gmail - Blokir)</option>
                    </optgroup>
                  </select>
                  <button 
                    onClick={() => handleSimulateLogin(simulatedEmail)}
                    disabled={isAuthenticating}
                    className="px-3.5 py-2 bg-[#005bc1] hover:bg-blue-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer"
                  >
                    Simulasikan
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Footer info */}
        <p className="text-center text-[10px] text-gray-400 dark:text-gray-500 font-semibold">
          YAYASAN BAITUL HIKMAH © 2026 • Sistem Presensi Geofence Terintegrasi
        </p>
      </div>
    </div>
  );
}
