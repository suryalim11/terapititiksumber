/**
 * Modul khusus untuk menangani pencarian slot terapi utama
 * untuk menyelesaikan masalah duplikasi slot
 */

import { db } from './db';
import { eq } from 'drizzle-orm';
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
 * @returns Slot terapi utama atau null jika tidak ditemukan
 */
export async function findPrimaryTherapySlot(
  timeSlotKey?: string | null, 
  date?: string | Date, 
  timeSlot?: string
): Promise<TherapySlotResult | null> {
  try {
    let result: TherapySlotResult | null = null;

    // 1. Coba cari berdasarkan timeSlotKey jika tersedia
    if (timeSlotKey) {
      console.log(`Mencari slot terapi berdasarkan timeSlotKey: ${timeSlotKey}`);
      
      const slotsWithSameKey = await db.query.therapySlots.findMany({
        where: eq(schema.therapySlots.timeSlotKey, timeSlotKey),
        orderBy: [{ column: schema.therapySlots.id, order: 'asc' }]
      });
      
      if (slotsWithSameKey.length > 0) {
        // Ambil slot dengan ID terkecil sebagai "slot utama"
        result = slotsWithSameKey[0] as TherapySlotResult;
        
        if (slotsWithSameKey.length > 1) {
          console.log(`PERINGATAN: Ditemukan ${slotsWithSameKey.length} slot dengan timeSlotKey yang sama.`);
          console.log(`Menggunakan slot ID=${result.id} sebagai slot utama.`);
          console.log(`Slot lainnya: ${slotsWithSameKey.slice(1).map(s => s.id).join(', ')}`);
        }
        
        return result;
      }
    }
    
    // 2. Jika tidak ditemukan dengan timeSlotKey, coba cari berdasarkan tanggal dan waktu
    if (date && timeSlot) {
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
      
      const slotsWithSameDateAndTime = await db.query.therapySlots.findMany({
        where: (criterias) => {
          return criterias.and(
            criterias.eq(schema.therapySlots.date, dateString),
            criterias.eq(schema.therapySlots.timeSlot, timeSlot)
          );
        },
        orderBy: [{ column: schema.therapySlots.id, order: 'asc' }]
      });
      
      if (slotsWithSameDateAndTime.length > 0) {
        // Ambil slot dengan ID terkecil sebagai "slot utama"
        result = slotsWithSameDateAndTime[0] as TherapySlotResult;
        
        if (slotsWithSameDateAndTime.length > 1) {
          console.log(`PERINGATAN: Ditemukan ${slotsWithSameDateAndTime.length} slot dengan tanggal dan waktu yang sama.`);
          console.log(`Menggunakan slot ID=${result.id} sebagai slot utama.`);
          console.log(`Slot lainnya: ${slotsWithSameDateAndTime.slice(1).map(s => s.id).join(', ')}`);
        }
        
        return result;
      }
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