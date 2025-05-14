/**
 * Modul khusus untuk menangani pencarian slot terapi utama
 * untuk menyelesaikan masalah duplikasi slot
 */

import { db } from './db';
import { eq, and, or, isNull, not, sql } from 'drizzle-orm';
import * as schema from '@shared/schema';
import { format } from 'date-fns';

/**
 * Struktur data hasil pencarian
 */
export interface TherapySlotResult {
  id: number;
  date: string;
  timeSlot: string;
  maxQuota: number;
  currentCount: number;
  isActive: boolean;
  timeSlotKey: string | null;
}

/**
 * Mencari slot terapi utama dengan pendekatan yang dioptimalkan
 * Menggunakan satu query SQL untuk mencari slot yang cocok secara efisien
 * 
 * @param timeSlotKey Kunci unik dari slot terapi (YYYY-MM-DD_HH:MM-HH:MM)
 * @param date Tanggal slot (YYYY-MM-DD)
 * @param timeSlot Waktu slot (HH:MM-HH:MM)
 * @param prioritizeActive Prioritaskan slot aktif meskipun ID lebih besar
 * @returns Slot terapi utama atau null jika tidak ditemukan
 */
export async function findPrimaryTherapySlot(
  timeSlotKey?: string | null, 
  date?: string | Date, 
  timeSlot?: string,
  prioritizeActive: boolean = true
): Promise<TherapySlotResult | null> {
  try {
    // Siapkan kondisi pencarian dengan query tunggal untuk kinerja lebih baik
    let conditions = [];
    
    // Format tanggal sekali saja jika diperlukan
    let dateString: string | undefined;
    if (date) {
      if (typeof date === 'string') {
        dateString = date.includes('T') ? date.split('T')[0] : 
                     date.includes(' ') ? date.split(' ')[0] : date;
      } else {
        dateString = format(date, 'yyyy-MM-dd');
      }
    }
    
    // Buat kondisi pencarian berdasarkan parameter yang tersedia
    if (timeSlotKey) {
      conditions.push(eq(schema.therapySlots.timeSlotKey, timeSlotKey));
    } else if (dateString && timeSlot) {
      conditions.push(
        and(
          eq(schema.therapySlots.date, dateString),
          eq(schema.therapySlots.timeSlot, timeSlot)
        )
      );
    }
    
    // Jika tidak ada kondisi yang dapat dibuat, kembalikan null
    if (conditions.length === 0) {
      return null;
    }
    
    // Lakukan query tunggal dengan OR untuk semua kondisi
    const slots = await db.select()
      .from(schema.therapySlots)
      .where(or(...conditions))
      .orderBy(
        // Urutkan berdasarkan status aktif (jika prioritas) dan ID terkecil
        prioritizeActive ? 
          schema.therapySlots.isActive : 
          sql`1`, // Dummy expression jika tidak memprioritaskan status aktif
        schema.therapySlots.id
      )
      .limit(10); // Batasi hasil untuk performa
    
    if (slots.length === 0) {
      return null;
    }
    
    // Pilih slot yang tepat (dengan prioritas jika diminta)
    let selectedSlot: TherapySlotResult;
    
    if (prioritizeActive) {
      // Cari slot aktif terlebih dahulu
      const activeSlots = slots.filter(slot => slot.isActive);
      selectedSlot = activeSlots.length > 0 ? activeSlots[0] : slots[0];
    } else {
      // Langsung gunakan slot pertama (sudah diurutkan berdasarkan ID)
      selectedSlot = slots[0];
    }
    
    // Berikan peringatan jika ada lebih dari satu slot yang cocok
    if (slots.length > 1) {
      console.log(`Info: Ditemukan ${slots.length} slot yang cocok. Menggunakan ID=${selectedSlot.id}`);
    }
    
    return selectedSlot as TherapySlotResult;
  } catch (error) {
    console.error("Error dalam findPrimaryTherapySlot:", error);
    return null;
  }
}

/**
 * Membuat timeSlotKey dari tanggal dan waktu dengan metode yang lebih efisien
 * 
 * @param date Tanggal slot (string atau Date)
 * @param timeSlot Waktu slot (format: "HH:MM-HH:MM")
 * @returns String timeSlotKey dengan format "YYYY-MM-DD_HH:MM-HH:MM"
 */
export function createTimeSlotKey(date: string | Date, timeSlot: string): string {
  // Gunakan operator ternary untuk penanganan format tanggal yang lebih efisien
  const dateString = typeof date === 'string' 
    ? (date.includes('T') ? date.split('T')[0] : 
       date.includes(' ') ? date.split(' ')[0] : date)
    : format(date, 'yyyy-MM-dd');
  
  return `${dateString}_${timeSlot}`;
}