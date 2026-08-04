/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Moon, 
  Sun,
  ShieldAlert,
  WifiOff,
  Clock,
} from 'lucide-react';
import { Employee } from '../types';
import { ASSETS } from '../data';
import { googleSignIn, initAuth } from '../googleAuth';
import ThemeToggle from './ThemeToggle';

interface LoginScreenProps {
  employees: Employee[];
  onLoginSuccess: (session: { role: 'employee' | 'admin'; user: any }) => void;
  onAddEmployee?: (emp: Employee) => void;
  adminEmails?: string[];
}

export default function LoginScreen({
  employees,
  onLoginSuccess,
  onAddEmployee,
  adminEmails = ['contact@yayasanbaitulhikmah.com']
}: LoginScreenProps) {
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Real-time connection tracking on Login Screen
  const [isOnline, setIsOnline] = useState<boolean>(() => 
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Time clock on Login Screen for high-precision vibe
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const clockTimer = setInterval(() => setCurrentTime(new Date()), 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(clockTimer);
    };
  }, []);

  const handleLoginSuccessWithDetails = (googleUser: any) => {
    const email = googleUser.email;
    if (!email) {
      setError('Gagal membaca alamat email dari akun Google Anda.');
      return;
    }

    const emailLower = email.toLowerCase();
    
    // 1. Check if Administrator
    if (adminEmails.includes(emailLower)) {
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

    // 2. Check if email belongs to the allowed organization domains
    const allowedDomains = [
      '@yayasanbaitulhikmah.com',
      '@mtsalhikmahtangkilkulon.sch.id',
      '@misalhikmahtangkilkulon.sch.id',
      '@pkbmalhikmah.com'
    ];
    const isOrgEmail = allowedDomains.some(domain => emailLower.endsWith(domain));
    if (!isOrgEmail) {
      setError('Akses ditolak. Silakan gunakan akun Google Workspace dengan email organisasi resmi.');
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
      const generatedNip = `${Date.now()}`;
      const newEmpName = googleUser.displayName || emailLower.split('@')[0].replace(/[^a-zA-Z]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      
      const newEmp: Employee = {
        nip: generatedNip,
        nama: newEmpName,
        jabatan: "Pendidik",
        lembaga: "Yayasan Baitul Hikmah",
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

  // Handle redirect result on native (user returning from Google)
  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => handleLoginSuccessWithDetails(user),
      () => setIsAuthenticating(false)
    );
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogleSignInClick = async () => {
    if (!isOnline) {
      setError('Autentikasi Google Workspace memerlukan koneksi internet aktif. Silakan hubungkan perangkat Anda ke internet.');
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setIsAuthenticating(true);

    try {
      const res = await googleSignIn();
      if (res?.user) {
        handleLoginSuccessWithDetails(res.user);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Gagal terhubung dengan layanan Google Auth.');
      setIsAuthenticating(false);
    }
  };

  const logoUrl = "/logo.png";

  return (
    <div className="min-h-screen bg-[#F6F3F6] dark:bg-gray-950 text-[#1b1b1d] dark:text-gray-100 font-sans flex flex-col relative overflow-x-hidden transition-colors duration-300">
      
      {/* Neumorphic/Glass custom styles inject */}
      <style>{`
        .stitch-card {
          background: #FCF8FB;
          box-shadow: 20px 20px 60px #d6d3d6, -20px -20px 60px #ffffff;
        }
        .stitch-pill {
          background: #FCF8FB;
          box-shadow: 6px 6px 12px #e5e1e4, -6px -6px 12px #ffffff;
        }
        .stitch-inset {
          background: #FCF8FB;
          box-shadow: inset 4px 4px 8px #e5e1e4, inset -4px -4px 8px #ffffff;
        }
        .stitch-button {
          background: #004494;
          box-shadow: 6px 6px 12px rgba(0, 68, 148, 0.25), -2px -2px 8px rgba(255, 255, 255, 0.1);
        }
        .stitch-halo-blue {
          filter: blur(80px);
          background: radial-gradient(circle, rgba(0, 68, 148, 0.15) 0%, rgba(0, 68, 148, 0) 70%);
        }
        .stitch-halo-emerald {
          filter: blur(80px);
          background: radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0) 70%);
        }
        .dark .stitch-card {
          background: #1e1e2e;
          box-shadow: 20px 20px 60px #0e0e14, -20px -20px 60px #2e2e42;
        }
        .dark .stitch-pill {
          background: #1e1e2e;
          box-shadow: 6px 6px 12px #0e0e14, -6px -6px 12px #2e2e42;
        }
        .dark .stitch-inset {
          background: #1e1e2e;
          box-shadow: inset 4px 4px 8px #0e0e14, inset -4px -4px 8px #2e2e42;
        }
        .dark .stitch-button {
          background: #1a5fc7;
          box-shadow: 6px 6px 12px rgba(0,0,0,0.4), -2px -2px 8px rgba(255,255,255,0.05);
        }
        .dark .stitch-halo-blue {
          background: radial-gradient(circle, rgba(0, 68, 148, 0.30) 0%, rgba(0, 68, 148, 0) 70%);
        }
        .dark .stitch-halo-emerald {
          background: radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0) 70%);
        }
      `}</style>

      {/* Ambient Halo Graphics from Stitch AI */}
      <div className="fixed top-[-10%] right-[-10%] w-[500px] h-[500px] stitch-halo-blue pointer-events-none z-0"></div>
      <div className="fixed bottom-[-10%] left-[-10%] w-[500px] h-[500px] stitch-halo-emerald pointer-events-none z-0"></div>

      {/* Institutional Header Bar */}
      <header className="w-full bg-[#FCF8FB]/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50 sticky top-0 z-50 transition-colors duration-300">
        <div className="max-w-5xl mx-auto h-16 px-6 sm:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="Logo Yayasan Baitul Hikmah" className="w-9 h-9 object-contain" />
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col items-center justify-center px-6 py-12 relative z-10">
        
        {/* Soft Neumorphic Login Container */}
        <motion.div 
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-[440px] stitch-card p-8 sm:p-12 rounded-[2.5rem] flex flex-col items-center transition-all duration-300"
        >
          {/* Logo Section */}
          <div className="mb-8 w-24 h-24 rounded-full bg-white dark:bg-gray-800 shadow-lg overflow-hidden flex items-center justify-center border-2 border-white/50 dark:border-gray-700">
            <img 
              alt="Yayasan Baitul Hikmah Logo" 
              className="w-full h-full object-cover rounded-full" 
              src={logoUrl} 
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Titles */}
          <div className="text-center space-y-2 mb-8">
            <h2 className="text-[10px] font-black text-gray-400 dark:text-gray-500 tracking-[0.25em] uppercase">
              Presensi Online
            </h2>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#004494] dark:text-blue-400 leading-tight tracking-tight uppercase">
              Yayasan Baitul Hikmah
            </h1>
          </div>

          {/* Clock */}
          <div className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-full stitch-inset mb-8">
            <Clock className="w-4 h-4 text-[#004494] dark:text-blue-400" />
            <span className="text-xs text-gray-600 dark:text-gray-400 font-bold tabular-nums">
              {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} WIB
            </span>
          </div>

          {/* Connection Warning Banner when Offline */}
          {!isOnline && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-800/40 p-4 rounded-2xl text-left flex gap-3 text-xs text-amber-800 dark:text-amber-300 mb-6"
            >
              <WifiOff className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div className="space-y-1">
                <p className="font-bold uppercase tracking-wider text-[9px]">Sinyal Terputus</p>
                <p className="leading-relaxed font-medium">
                  Masuk dengan akun Google Workspace memerlukan koneksi internet aktif. Silakan hubungkan perangkat Anda ke internet terlebih dahulu.
                </p>
              </div>
            </motion.div>
          )}

          {/* Error Message Banner */}
          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-800/40 p-4 rounded-2xl text-left flex gap-3 text-xs text-rose-600 dark:text-rose-300 mb-6"
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
              className="w-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-800/40 p-4 rounded-2xl text-left flex gap-3 text-xs text-emerald-700 dark:text-emerald-300 mb-6"
            >
              <div className="w-5 h-5 shrink-0 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-[10px] animate-bounce">
                ✓
              </div>
              <div className="space-y-1">
                <p className="font-bold">Sesi Terverifikasi</p>
                <p className="leading-relaxed font-medium">{successMsg}</p>
              </div>
            </motion.div>
          )}

          {/* Google Sign In Button */}
          <button
            onClick={handleGoogleSignInClick}
            disabled={isAuthenticating}
            className="w-full flex items-center justify-center gap-3 stitch-button text-white py-4 px-6 rounded-full font-bold text-sm transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 cursor-pointer"
          >
            {isAuthenticating ? (
              <>
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Memproses Akun...</span>
              </>
            ) : (
              <>
                <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-sm shrink-0">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
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
                </div>
                <span>Masuk dengan Google</span>
              </>
            )}
          </button>

          {/* Domain Restriction Footer telah dihilangkan */}
        </motion.div>

      </main>

      {/* Global Footer */}
      <footer className="w-full py-8 border-t border-gray-200/30 dark:border-gray-800/30 relative z-10">
        <div className="max-w-5xl mx-auto px-6 flex flex-col items-center gap-4">
          <div className="flex items-center gap-6 text-xs text-gray-500 dark:text-gray-400 font-semibold">
            <a href="/privacy-policy.html" className="hover:text-[#004494] dark:hover:text-blue-400 transition-colors">Kebijakan Privasi</a>
            <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
            <a href="/terms.html" className="hover:text-[#004494] dark:hover:text-blue-400 transition-colors">Syarat & Ketentuan</a>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 font-medium text-center leading-relaxed">
            © {new Date().getFullYear()} Yayasan Baitul Hikmah
          </p>
        </div>
      </footer>
    </div>
  );
}
