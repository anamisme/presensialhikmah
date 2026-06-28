/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Employee, AttendanceRecord, Geofence, RecentActivity } from './types';

// Hotlinked Asset URLs from the screenshots
export const ASSETS = {
  ahmadProfile: "https://lh3.googleusercontent.com/aida-public/AB6AXuAKN_g2TuG7cDgXw5NEPy_iQyHy-njJLgePdE7y1qM6Ol4ai9Cil8DIjzoQJbh-7H7pvanKu-4J0VdZYS_pq08lsxZojdhIq33Xi6J6YiR-ctAEV_UTazXZD0MgbTn99PRfloV3ct9YZf26O0uTK7hJlAN2ctQXyGYGStDyG32abOt6-iSx8c5iId-2JgTZR3nv85peylMYZHLl-y3p3UvykYbG3y7_axWHs474jF-Vi7Pg9D-IftV2GGWXT3uZpZcIqudMX22aOuAy",
  budiProfile: "https://lh3.googleusercontent.com/aida-public/AB6AXuA1rv9JMJzyXloSsP5Yp0STL0IxIsB1FNRa7te48YEuYFbjsJgH32JQX0MlO25d8diYyiLSpNx9Uu0nx4PIcIU34fl3tO-LAoYlRuA5YWkEwtM49RAp7kFGTRbyGaYbEaAoWSHcus0_zj_Wl_hWr6bsROqqHkO3O6Jf-ACC7oaAaq28HSGw_uUfOamlhPyHghzhBuKaDBFSWF9qqvFIE4y-Uvgh5yDXaubxHsTP_vPlol8LPGwRfD4ab_KM4MsNIDnaiTdv_8snU2Cc",
  sitiProfile: "https://lh3.googleusercontent.com/aida-public/AB6AXuC979fLp9Pwc7ON5nA1KG5A_aE80VAKxS-h7RQgUqprb3fbmE5Te2QIj02qMI-SNgtgFXovLYza5o0H6P87ej4uo37fYYGPiu-WN9T1e-ObQFbaIQvcPFnbcYpdp8LC7fcfp_WpElfi1hvvqKbphpB_73-dDR2MJMqOWnDrWqH6LKcM0f1GjM4LouQ7O5WjMImdcKcikdF-jdPMgcl6VmyDHr97FZ2Pkj_L7sA9CptekZuJO-Plc0d22w0oiUHEeAIBqcxjfCZKJd8e",
  dianProfile: "https://lh3.googleusercontent.com/aida-public/AB6AXuBo0TcEXI4vQNrJFxJC2gLjX5vCQJsXW2JXJ-nXT2qBoLCUY8bHdh7y0Fz1Ho5MYCAhlYqkaaf__0wyyF5Zn-Bz4c0JYFZApq4swzgvobcmJIUsGRtv8gmPwia2wVHVuToNAtUr7q9T-AGVD3Re6YEBb68kKmRW-zHpQOM3UcuDyqi34kv2t5vfjHcqLMWbSBp1pCsVxOjWsh7AwKrn3Nvky3sYHYI086WZzJHXc6hc2AK44esw_if7k3Sw6P-ogBblOjYnpYnijaRX",
  agusProfile: "https://lh3.googleusercontent.com/aida-public/AB6AXuAvsnjom-GJiJhC987wmuhJv6sHR9Ape3u7qphGroLCgMJcFQ8qDYLVYMnesN5JzszGyTynOg04kiMildObuoEQs89BxhFrW2KkkEZRp74TklciJhTCpxHmJrhScZc5SKFzmPiIP5zUIDFUlrW-bfIRa0eJ1K7Sd-ajbSmi7IH_K3Ae3qeym50vED_N_SvM3N8Q-LEfgqIb4q7TvGPg_yX3hj6hMyXrGeMbHkthVAmBJR6l35qJEM3UvHBhcLEE_nbrhoZS8R3T5SSc",
  qrCameraBg: "https://lh3.googleusercontent.com/aida-public/AB6AXuCThmP-niRSKcaMDXjgYtrnRHKuQnMd0MOLi-ODc_Sse3Ax58hNUQb_EYnqD0o51wroOMxOCdsTYE3im2Kr1YG0_gczOnL8042PXTCvH2WhS9WvnPreiFbg08EJNJXOJuuzNLZyniOf1leJAhOszek5Dpr7KWMbdCTj6bhJ3daNFCxU6a-ynLuIvuvI05bBrMpSFN5-_1lBxs8Gb7UEiEDQXc3Pf0IeUfzH0x874gqwxS9Rn_7d-OS2KBA-gPRmkuIqsmkzGt2BPDLM",
  cameraPOV: "https://lh3.googleusercontent.com/aida-public/AB6AXuCnPlXY3sGoMX4LMK8CGOlDkWcV5kE0vsduILIlQUM-r_4La8cXzj0zwpSmHATwhn5K96IckIM9m-YtyrTKEYO8AZ4WlCkiffGaDmfXxPag87SF-RPtc2JTjS8EajT_yM9rJze22p67gfFFfMjZ6NhAy4FK0G98FVm2f1O5FdS3Wm7T0O9vxEX0SEAOwkJ0GalEcVQ_Ldx0yWA_iAyuom6C2MzfFUevTBQXjQmYQcqRdgjLhp2K3pKXJDzF5RdpXQXvGzHnVX7B95Do",
  qrStatic: "https://lh3.googleusercontent.com/aida-public/AB6AXuDe1eqI6v9Sw-TY_c1q6eApu6moMiNR7wMyy_3pCYGCK8NwvgE5JfmUS-lbAXp6FdydVZj7LyHfhERmuLqvKKCWl7L6CdFPcVjqX1jaAyIlHy75_V5oHcbn4V6okO8_a8Eeuwjc1IhbkYG6hHHWN1RxOfP9uQB0LT73YYsSUfW69YL4WaLTh-UkYgJ78MqX2XYew_h5zZ2lWxBdX9AVoSWal30SYqY3OxrU-J4nsQ21LW-HsdgJ7UE4gr76P5pdRQ7z6RToeza_QOC1",
  officeBlur: "https://lh3.googleusercontent.com/aida-public/AB6AXuAMkWAR-5toY-o-Ouw1hrrmpuefRopvYMwqgFqT0Yc4eICORUNBiIePth2M27LOe198G_22PWyKka7S5dSvf-_X1q5YKXahSvwPtHsmuWyc5_BV8GR66A76QHNj7wrRn_Pkf9Dv3sAj9GB2Bpn3-DDW_RfCxgEIoCBRS_yHf8AvI5L_zenYMKborMGp2RQ0dASFu6Os-_ga4O-mVjPQXr9JtChAegYdvcxzzchqPUxI4IlssOVEoV-jP3ASijEqgGEWpzmtvlr5pyRl",
  genericAvatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80"
};

// Initial Employees
export const INITIAL_EMPLOYEES: Employee[] = [
  {
    nip: "19920801",
    nama: "Ahmad",
    jabatan: "Staf IT",
    lembaga: "Lembaga IT & Digital",
    foto: ASSETS.ahmadProfile,
    email: "ahmad@yayasanbaitulhikmah.com"
  },
  {
    nip: "198504122010011002",
    nama: "Budi Santoso",
    jabatan: "Kepala Bagian",
    lembaga: "Lembaga IT & Digital",
    foto: ASSETS.budiProfile,
    email: "budi@yayasanbaitulhikmah.com"
  },
  {
    nip: "199208242015032004",
    nama: "Siti Aminah",
    jabatan: "Staf Senior",
    lembaga: "Keuangan",
    foto: ASSETS.sitiProfile,
    email: "siti@yayasanbaitulhikmah.com"
  },
  {
    nip: "198011152005011003",
    nama: "Dian Wijaya",
    jabatan: "Staf Logistik",
    lembaga: "Logistik",
    foto: ASSETS.dianProfile,
    email: "dian@yayasanbaitulhikmah.com"
  },
  {
    nip: "197801152005011005",
    nama: "Agus Pratama",
    jabatan: "Operator Utama",
    lembaga: "Sarana & Prasarana",
    foto: ASSETS.agusProfile,
    email: "agus@yayasanbaitulhikmah.com"
  },
  {
    nip: "199511022019022001",
    nama: "Rina Wijaya",
    jabatan: "Sekretaris",
    lembaga: "Rektorat",
    foto: ASSETS.genericAvatar,
    email: "rina@yayasanbaitulhikmah.com"
  }
];

// Initial Geofences
export const INITIAL_GEOFENCES: Geofence[] = [
  {
    id: "geo-1",
    nama: "Gedung Pusat A",
    lat: -6.2088,
    lng: 106.8456,
    radius: 50
  },
  {
    id: "geo-2",
    nama: "Kantor Cabang Sudirman",
    lat: -6.2297,
    lng: 106.8091,
    radius: 100
  },
  {
    id: "geo-3",
    nama: "Kantor Yayasan",
    lat: -6.1751,
    lng: 106.8272,
    radius: 75
  }
];

// Initial Attendance History
export const INITIAL_ATTENDANCE: AttendanceRecord[] = [
  {
    id: "rec-1",
    nip: "19920801",
    nama: "Aris Setiawan",
    foto: ASSETS.genericAvatar,
    tanggal: "2026-06-28",
    masuk: "07:55",
    keluar: "17:05",
    status: "Tepat Waktu",
    lokasi: "Gedung Pusat A"
  },
  {
    id: "rec-2",
    nip: "198504122010011002",
    nama: "Budi Santoso",
    foto: ASSETS.budiProfile,
    tanggal: "2026-06-28",
    masuk: "07:45",
    keluar: "15:05",
    status: "Tepat Waktu",
    lokasi: "Kantor Yayasan"
  },
  {
    id: "rec-3",
    nip: "199208242015032004",
    nama: "Siti Aminah",
    foto: ASSETS.sitiProfile,
    tanggal: "2026-06-28",
    masuk: "08:15",
    keluar: "17:10",
    status: "Terlambat",
    lokasi: "Gedung Pusat A"
  },
  {
    id: "rec-4",
    nip: "198011152005011003",
    nama: "Dian Wijaya",
    foto: ASSETS.dianProfile,
    tanggal: "2026-06-28",
    masuk: "08:00",
    keluar: "17:00",
    status: "Tepat Waktu",
    lokasi: "Gedung Pusat A"
  },
  {
    id: "rec-5",
    nip: "19940212",
    nama: "Budi Pratama",
    foto: ASSETS.genericAvatar,
    tanggal: "2026-06-27",
    masuk: "08:05",
    keluar: "17:02",
    status: "Terlambat",
    lokasi: "Kantor Cabang Sudirman"
  },
  {
    id: "rec-6",
    nip: "19920801",
    nama: "Ahmad",
    foto: ASSETS.ahmadProfile,
    tanggal: "2026-06-27",
    masuk: "07:45",
    keluar: "15:05",
    status: "Tepat Waktu",
    lokasi: "Kantor Yayasan"
  },
  {
    id: "rec-7",
    nip: "19920801",
    nama: "Ahmad",
    foto: ASSETS.ahmadProfile,
    tanggal: "2026-06-26",
    masuk: "08:12",
    keluar: "17:00",
    status: "Terlambat",
    lokasi: "Gedung Pusat A"
  }
];

// Initial Recent Activities
export const INITIAL_ACTIVITIES: RecentActivity[] = [
  {
    id: "act-1",
    nip: "198504122010011002",
    nama: "Budi Santoso",
    tipe: "masuk",
    waktu: "5 menit yang lalu",
    keterangan: "melakukan presensi masuk"
  },
  {
    id: "act-2",
    nip: "199208242015032004",
    nama: "Siti Aminah",
    tipe: "keluar",
    waktu: "12 menit yang lalu",
    keterangan: "melakukan presensi keluar"
  },
  {
    id: "act-3",
    nip: "198011152005011003",
    nama: "Dian Wijaya",
    tipe: "masuk",
    waktu: "25 menit yang lalu",
    keterangan: "melakukan presensi masuk"
  },
  {
    id: "act-4",
    nip: "19951102",
    nama: "Anwar J.",
    tipe: "tambah",
    waktu: "1 jam yang lalu",
    keterangan: "Karyawan baru ditambahkan"
  }
];

// LocalStorage Helper functions
export const getStoredData = <T>(key: string, initialValue: T): T => {
  try {
    const item = localStorage.getItem(`baitul_hikmah_${key}`);
    return item ? JSON.parse(item) : initialValue;
  } catch (error) {
    console.error(`Error reading localStorage key "${key}":`, error);
    return initialValue;
  }
};

export const setStoredData = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(`baitul_hikmah_${key}`, JSON.stringify(value));
  } catch (error) {
    console.error(`Error setting localStorage key "${key}":`, error);
  }
};
