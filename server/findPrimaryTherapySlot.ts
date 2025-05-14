/**
 * Modul khusus untuk menangani pencarian slot terapi utama
 * untuk menyelesaikan masalah duplikasi slot
 */

import { db } from './db';
import { eq, and, or, isNull, not } from 'drizzle-orm';
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
 * Mencari slot terapi utama berdasarkan timeSlotKey
 * Atau tanggal + waktu jika timeSlotKey tidak tersedia
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
    let result: TherapySlotResult | null = null;
    let candidateSlots: TherapySlotResult[] = [];

    // 1. Coba cari berdasarkan timeSlotKey jika tersedia
    if (timeSlotKey) {
      console.log(`Mencari slot terapi berdasarkan timeSlotKey: ${timeSlotKey}`);
      
      const slotsWithSameKey = await db.select().from(schema.therapySlots)
        .where(
          eq(schema.therapySlots.timeSlotKey, timeSlotKey)
        )
        .orderBy(schema.therapySlots.isActive, 'desc') // Prioritaskan slot aktif
        .orderBy(schema.therapySlots.id);
        
      if (slotsWithSameKey.length > 0) {
        candidateSlots = slotsWithSameKey as TherapySlotResult[];
      }
    }
    
    // 2. Jika tidak ditemukan dengan timeSlotKey, coba cari berdasarkan tanggal dan waktu
    if (candidateSlots.length === 0 && date && timeSlot) {
      console.log(`Mencari slot terapi berdasarkan tanggal: ${date} dan waktu: ${timeSlot}`);
      
      // Normalisasi format tanggal
      let dateString: string;
      if (typeof date === 'string') {
        // Jika tanggal sudah berbentuk string
        if (date.includes('T')) {
          // Format ISO
          dateString = date.split('T')[0];
        } else if (date.includes(' ')) {
          // Format dengan spasi
          dateString = date.split(' ')[0];
        } else {
          // Asumsikan sudah format YYYY-MM-DD
          dateString = date;
        }
      } else {
        // Jika tanggal berbentuk Date, konversi ke format YYYY-MM-DD
        dateString = format(date, 'yyyy-MM-dd');
      }
      
      const slotsWithSameDateAndTime = await db.select().from(schema.therapySlots)
        .where(
          and(
            eq(schema.therapySlots.date, dateString),
            eq(schema.therapySlots.timeSlot, timeSlot)
          )
        )
        .orderBy(schema.therapySlots.isActive, 'desc') // Prioritaskan slot aktif
        .orderBy(schema.therapySlots.id);
      
      if (slotsWithSameDateAndTime.length > 0) {
        candidateSlots = slotsWithSameDateAndTime as TherapySlotResult[];
      }
    }
    
    // Pilih slot terbaik dari kandidat yang ditemukan
    if (candidateSlots.length > 0) {
      // Prioritaskan slot aktif jika diminta
      if (prioritizeActive) {
        // Pilih slot aktif dengan ID terkecil jika ada
        const activeSlots = candidateSlots.filter(slot => slot.isActive);
        
        if (activeSlots.length > 0) {
          // Ambil slot aktif dengan ID terkecil
          result = activeSlots[0];
          console.log(`Prioritas: Menggunakan slot AKTIF dengan ID=${result.id}`);
        } else {
          // Jika tidak ada slot aktif, ambil ID terkecil sebagai fallback
          result = candidateSlots[0];
          console.log(`Fallback: Tidak ada slot aktif, menggunakan slot ID=${result.id}`);
        }
      } else {
        // Ambil slot dengan ID terkecil sebagai slot utama tanpa memprioritaskan status aktif
        result = candidateSlots[0];
        console.log(`Standar: Menggunakan slot ID=${result.id} sebagai slot utama`);
      }
      
      if (candidateSlots.length > 1) {
        console.log(`PERINGATAN: Ditemukan ${candidateSlots.length} slot dengan tanggal dan waktu yang sama.`);
        console.log(`Menggunakan slot ID=${result.id} sebagai slot utama.`);
        console.log(`Slot lainnya: ${candidateSlots.slice(1).map(s => s.id).join(', ')}`);
      }
      
      return result;
    }
    
    // Tidak ditemukan slot yang cocok
    console.log("Tidak ditemukan slot terapi yang cocok");
    return null;
  } catch (error) {
    console.error("Error dalam findPrimaryTherapySlot:", error);
    return null;
  }
}

/**
 * Membuat timeSlotKey dari tanggal dan waktu
 * 
 * @param date Tanggal slot (string atau Date)
 * @param timeSlot Waktu slot (format: "HH:MM-HH:MM")
 * @returns String timeSlotKey dengan format "YYYY-MM-DD_HH:MM-HH:MM"
 */
export function createTimeSlotKey(date: string | Date, timeSlot: string): string {
  let dateString: string;
  
  if (typeof date === 'string') {
    // Jika tanggal sudah berbentuk string
    if (date.includes('T')) {
      // Format ISO
      dateString = date.split('T')[0];
    } else if (date.includes(' ')) {
      // Format dengan spasi
      dateString = date.split(' ')[0];
    } else {
      // Asumsikan sudah format YYYY-MM-DD
      dateString = date;
    }
  } else {
    // Jika tanggal berbentuk Date, konversi ke format YYYY-MM-DD
    dateString = format(date, 'yyyy-MM-dd');
  }
  
  return `${dateString}_${timeSlot}`;
}