/**
 * Modul Registry Slot Terapi
 * 
 * File ini berisi fungsionalitas untuk mengelola dan menyinkronkan ID slot terapi
 * dengan kunci waktu (timeSlotKey) mereka yang konsisten.
 * 
 * Registry ini berfungsi sebagai pemetaan terpusat antara:
 * 1. timeSlotKey (kombinasi tanggal_waktu) -> ID slot
 * 2. ID slot -> data slot terkoreksi
 * 
 * Fitur utama:
 * - Menyediakan sistem pemetaan yang dapat diandalkan untuk mengidentifikasi slot terapi
 * - Memungkinkan koreksi data yang konsisten (tanggal, waktu, kuota, dll.)
 * - Mengelola sinkronisasi slot untuk memastikan konsistensi
 */

import { db } from './db';
import * as schema from '@shared/schema';
import { getWIBDate } from './utils/date-utils';
import { eq, sql } from 'drizzle-orm';
import { format } from 'date-fns';

// Format nilai timeSlotKey: YYYY-MM-DD_HH:MM-HH:MM
// Contoh: 2025-05-19_13:00-15:00

// Interface untuk data koreksi slot
export interface SlotCorrectionData {
  date: string;
  timeSlot: string;
  maxQuota?: number;
  currentCount?: number;
  patientCount?: number;
  isActive?: boolean;
}

// Pemetaan koreksi slot berdasarkan ID
export const SLOT_CORRECTIONS: Record<number, SlotCorrectionData> = {
  466: { date: "2025-05-20", timeSlot: "10:00-12:00", maxQuota: 6, currentCount: 0, patientCount: 0, isActive: true }, // Selasa, 20 Mei
  467: { date: "2025-05-21", timeSlot: "13:00-15:00", maxQuota: 4, currentCount: 0, patientCount: 0, isActive: true }, // Rabu, 21 Mei
  468: { date: "2025-05-22", timeSlot: "15:30-18:00", maxQuota: 6, currentCount: 0, patientCount: 0, isActive: true }, // Kamis, 22 Mei
  469: { date: "2025-05-23", timeSlot: "10:00-12:30", maxQuota: 6, currentCount: 0, patientCount: 0, isActive: true }, // Jumat, 23 Mei
  470: { date: "2025-05-24", timeSlot: "10:00-12:30", maxQuota: 6, currentCount: 0, patientCount: 0, isActive: true }, // Sabtu, 24 Mei
  471: { date: "2025-05-19", timeSlot: "13:00-15:00", maxQuota: 4, currentCount: 1, patientCount: 1, isActive: true }, // Senin, 19 Mei
  474: { date: "2025-05-19", timeSlot: "10:00-11:00", maxQuota: 3, currentCount: 0, patientCount: 0, isActive: true }  // Senin, 19 Mei
};

// Registry yang memetakan timeSlotKey ke ID slot
let timeSlotKeyToIdMap: Record<string, number> = {};

// Registry yang memetakan ID slot ke timeSlotKey
let idToTimeSlotKeyMap: Record<number, string> = {};

/**
 * Menghasilkan timeSlotKey dari date dan timeSlot
 * @param date - Tanggal dalam format "YYYY-MM-DD"
 * @param timeSlot - Waktu slot dalam format "HH:MM-HH:MM"
 * @returns timeSlotKey dalam format "YYYY-MM-DD_HH:MM-HH:MM"
 */
export function generateTimeSlotKey(date: string, timeSlot: string): string {
  // Normalisasi format tanggal ke YYYY-MM-DD jika dalam format lain
  let normalizedDate = date;
  if (date.includes('T') || date.includes(' ')) {
    try {
      const dateObj = new Date(date);
      normalizedDate = format(dateObj, 'yyyy-MM-dd');
    } catch (e) {
      console.error(`Error normalizing date: ${date}`, e);
    }
  }
  
  return `${normalizedDate}_${timeSlot}`;
}

/**
 * Inisialisasi registry slot terapi
 * Membangun pemetaan antara timeSlotKey dan ID slot
 */
export async function initializeSlotRegistry(): Promise<void> {
  try {
    // Ambil semua slot terapi dari database
    const allSlots = await db.select().from(schema.therapySlots);
    
    // Bersihkan registry yang ada
    timeSlotKeyToIdMap = {};
    idToTimeSlotKeyMap = {};
    
    // Bangun registry baru
    for (const slot of allSlots) {
      let dateStr: string;
      let timeSlot: string;
      
      // Periksa apakah ada koreksi untuk slot ini
      if (SLOT_CORRECTIONS[slot.id]) {
        const correction = SLOT_CORRECTIONS[slot.id];
        dateStr = correction.date;
        timeSlot = correction.timeSlot;
      } else {
        // Gunakan data dari database dan format dengan benar
        const dateObj = new Date(slot.date);
        dateStr = format(dateObj, 'yyyy-MM-dd');
        timeSlot = slot.timeSlot;
      }
      
      const timeSlotKey = generateTimeSlotKey(dateStr, timeSlot);
      
      // Simpan pemetaan dua arah
      timeSlotKeyToIdMap[timeSlotKey] = slot.id;
      idToTimeSlotKeyMap[slot.id] = timeSlotKey;
    }
    
    console.log(`Slot registry initialized with ${Object.keys(timeSlotKeyToIdMap).length} mappings`);
  } catch (error) {
    console.error("Error initializing slot registry:", error);
    throw error;
  }
}

/**
 * Mendapatkan ID slot berdasarkan timeSlotKey
 * @param timeSlotKey - Kunci dalam format "YYYY-MM-DD_HH:MM-HH:MM"
 * @returns ID slot jika ditemukan, undefined jika tidak
 */
export function getSlotIdByTimeSlotKey(timeSlotKey: string): number | undefined {
  return timeSlotKeyToIdMap[timeSlotKey];
}

/**
 * Mendapatkan timeSlotKey berdasarkan ID slot
 * @param slotId - ID slot terapi
 * @returns timeSlotKey jika ditemukan, undefined jika tidak
 */
export function getTimeSlotKeyById(slotId: number): string | undefined {
  return idToTimeSlotKeyMap[slotId];
}

/**
 * Mendapatkan slot terapi berdasarkan timeSlotKey
 * @param timeSlotKey - Kunci dalam format "YYYY-MM-DD_HH:MM-HH:MM"
 * @returns Data slot terapi jika ditemukan, null jika tidak
 */
export async function getSlotByTimeSlotKey(timeSlotKey: string): Promise<any | null> {
  const slotId = getSlotIdByTimeSlotKey(timeSlotKey);
  
  if (!slotId) {
    return null;
  }
  
  return getSlotWithCorrections(slotId);
}

/**
 * Mendapatkan data slot dengan koreksi yang diterapkan
 * @param slotId - ID slot terapi
 * @returns Data slot terapi dengan koreksi jika perlu
 */
export async function getSlotWithCorrections(slotId: number): Promise<any | null> {
  try {
    // Ambil data asli dari database
    const [originalSlot] = await db.select().from(schema.therapySlots).where(eq(schema.therapySlots.id, slotId));
    
    if (!originalSlot) {
      return null;
    }
    
    // Buat salinan untuk dimodifikasi
    const correctedSlot = { ...originalSlot };
    
    // Terapkan koreksi jika tersedia
    if (SLOT_CORRECTIONS[slotId]) {
      const correction = SLOT_CORRECTIONS[slotId];
      
      // Koreksi tanggal dan waktu
      if (correction.date) {
        correctedSlot.date = new Date(`${correction.date}T00:00:00`);
      }
      
      if (correction.timeSlot) {
        correctedSlot.timeSlot = correction.timeSlot;
      }
      
      // Koreksi data kuota dan jumlah pasien
      if (correction.maxQuota !== undefined) {
        correctedSlot.maxQuota = correction.maxQuota;
      }
      
      if (correction.currentCount !== undefined) {
        correctedSlot.currentCount = correction.currentCount;
      }
      
      if (correction.isActive !== undefined) {
        correctedSlot.isActive = correction.isActive;
      }
      
      // Tambahkan timeSlotKey sesuai dengan data terkoreksi
      correctedSlot.timeSlotKey = generateTimeSlotKey(
        format(correctedSlot.date, 'yyyy-MM-dd'),
        correctedSlot.timeSlot
      );
    } else {
      // Tambahkan timeSlotKey untuk data asli
      correctedSlot.timeSlotKey = generateTimeSlotKey(
        format(correctedSlot.date, 'yyyy-MM-dd'),
        correctedSlot.timeSlot
      );
    }
    
    return correctedSlot;
  } catch (error) {
    console.error(`Error getting slot with corrections for ID ${slotId}:`, error);
    return null;
  }
}

/**
 * Mendapatkan ID slot berdasarkan tanggal dan waktu
 * @param date - Tanggal (string atau Date)
 * @param timeSlot - Waktu slot (format "HH:MM-HH:MM")
 * @returns ID slot jika ditemukan, undefined jika tidak
 */
export function getSlotIdByDateAndTime(date: string | Date, timeSlot: string): number | undefined {
  // Konversi Date ke string format YYYY-MM-DD
  let dateStr = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
  
  // Normalisasi format tanggal
  if (dateStr.includes('T') || dateStr.includes(' ')) {
    try {
      const dateObj = new Date(dateStr);
      dateStr = format(dateObj, 'yyyy-MM-dd');
    } catch (e) {
      console.error(`Error normalizing date: ${dateStr}`, e);
    }
  }
  
  const timeSlotKey = generateTimeSlotKey(dateStr, timeSlot);
  return getSlotIdByTimeSlotKey(timeSlotKey);
}

/**
 * Dapatkan slot terapi berdasarkan tanggal dan waktu
 * @param date - Tanggal (string atau Date)
 * @param timeSlot - Waktu slot (format "HH:MM-HH:MM")
 * @returns Data slot terapi jika ditemukan, null jika tidak
 */
export async function getSlotByDateAndTime(date: string | Date, timeSlot: string): Promise<any | null> {
  const slotId = getSlotIdByDateAndTime(date, timeSlot);
  
  if (!slotId) {
    return null;
  }
  
  return getSlotWithCorrections(slotId);
}

/**
 * Memperbarui pemetaan registry untuk slot tertentu
 * @param slotId - ID slot
 * @param newDate - Tanggal baru (opsional)
 * @param newTimeSlot - Waktu slot baru (opsional)
 */
export function updateRegistryMapping(slotId: number, newDate?: string, newTimeSlot?: string): void {
  // Hapus pemetaan lama
  const oldTimeSlotKey = idToTimeSlotKeyMap[slotId];
  if (oldTimeSlotKey) {
    delete timeSlotKeyToIdMap[oldTimeSlotKey];
  }
  
  // Dapatkan data slot saat ini (dari koreksi atau default)
  let dateStr: string;
  let timeSlot: string;
  
  if (SLOT_CORRECTIONS[slotId]) {
    dateStr = newDate || SLOT_CORRECTIONS[slotId].date;
    timeSlot = newTimeSlot || SLOT_CORRECTIONS[slotId].timeSlot;
  } else {
    // Gunakan nilai baru jika disediakan
    if (!newDate || !newTimeSlot) {
      console.error(`Cannot update registry mapping for slot ${slotId}: missing data`);
      return;
    }
    dateStr = newDate;
    timeSlot = newTimeSlot;
  }
  
  // Buat pemetaan baru
  const newTimeSlotKey = generateTimeSlotKey(dateStr, timeSlot);
  timeSlotKeyToIdMap[newTimeSlotKey] = slotId;
  idToTimeSlotKeyMap[slotId] = newTimeSlotKey;
}

/**
 * Mengekspor registry saat ini untuk debugging
 * @returns Registry slot saat ini
 */
export function exportRegistry(): {
  timeSlotKeyToIdMap: Record<string, number>;
  idToTimeSlotKeyMap: Record<number, string>;
} {
  return {
    timeSlotKeyToIdMap,
    idToTimeSlotKeyMap
  };
}

// Pemeriksaan apakah registry sudah diinisialisasi
let isRegistryInitialized = false;

/**
 * Mendapatkan status inisialisasi registry
 * @returns true jika registry sudah diinisialisasi, false jika belum
 */
export function isSlotRegistryInitialized(): boolean {
  return isRegistryInitialized;
}

/**
 * Menetapkan status inisialisasi registry
 * @param status - Status inisialisasi baru
 */
export function setRegistryInitialized(status: boolean): void {
  isRegistryInitialized = status;
}

// Auto-inisialisasi registry saat modul dimuat
export async function ensureRegistryInitialized(): Promise<void> {
  if (!isRegistryInitialized) {
    await initializeSlotRegistry();
    setRegistryInitialized(true);
  }
}