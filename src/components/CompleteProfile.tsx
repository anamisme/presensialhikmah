import { useState } from 'react';
import { UserCircle, LogOut, Save } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import { Employee } from '../types';

interface CompleteProfileProps {
  user: Employee;
  onSave: (updates: Partial<Employee>) => void;
  onLogout: () => void;
}

const JABATAN_OPTIONS = ['Pendidik', 'Tenaga Kependidikan', 'Kepala Lembaga'];
const LEMBAGA_OPTIONS = ['Yayasan Baitul Hikmah', 'MTS Al-Hikmah', 'MIS Al-Hikmah', 'PKBM Al-Hikmah', 'KB Al-Hikmah'];

export default function CompleteProfile({ user, onSave, onLogout }: CompleteProfileProps) {
  const [nama, setNama] = useState(user.nama || '');
  const [jabatan, setJabatan] = useState(user.jabatan || JABATAN_OPTIONS[0]);
  const [lembaga, setLembaga] = useState(user.lembaga || LEMBAGA_OPTIONS[0]);
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    const trimmed = nama.trim();
    if (!trimmed) return;
    setSaving(true);
    onSave({ nama: trimmed, jabatan, lembaga });
  };

  const inputClass = "w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#0058bc]/20 focus:border-[#0058bc] outline-none text-gray-800 dark:text-gray-100";
  const labelClass = "text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-1";

  return (
    <div className="min-h-screen bg-[#F6F3F6] dark:bg-gray-950 text-[#1b1b1d] dark:text-gray-100 flex flex-col items-center justify-center px-4 py-8 transition-colors duration-300">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="bg-[#0058bc] dark:bg-blue-800 px-6 py-6 text-white relative">
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-white/20 border-2 border-white/60 flex items-center justify-center">
              {user.foto ? (
                <img src={user.foto} alt="Foto profil" className="w-full h-full object-cover" />
              ) : (
                <UserCircle className="w-12 h-12" />
              )}
            </div>
            <h1 className="mt-3 font-bold text-lg text-center">Lengkapi Profil Kepegawaian</h1>
            <p className="text-xs text-white/80 text-center mt-1">
              Sebelum mulai presensi, lengkapi data kepegawaian Anda terlebih dahulu.
            </p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className={labelClass}>Nama Lengkap</label>
            <input
              type="text"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Nama lengkap"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Jabatan</label>
            <select
              value={jabatan}
              onChange={(e) => setJabatan(e.target.value)}
              className={inputClass}
            >
              {JABATAN_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          <div>
            <label className={labelClass}>Lembaga</label>
            <select
              value={lembaga}
              onChange={(e) => setLembaga(e.target.value)}
              className={inputClass}
            >
              {LEMBAGA_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !nama.trim()}
            className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wider bg-[#0058bc] text-white hover:bg-[#00418f] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Menyimpan...' : 'Simpan & Lanjutkan Presensi'}
          </button>

          <button
            onClick={onLogout}
            className="w-full py-2.5 rounded-xl text-xs font-bold text-gray-500 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Keluar / Ganti Akun
          </button>
        </div>
      </div>
    </div>
  );
}