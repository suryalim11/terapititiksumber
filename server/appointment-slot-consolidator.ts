/**
 * Modul khusus untuk mengkonsolidasikan appointment dengan slot terapi utama
 * Mengatasi masalah dimana pasien yang terdaftar tidak muncul dalam daftar slot
 * karena permasalahan duplikasi slot terapi dengan tanggal dan waktu yang sama.
 */

import { db } from './db';
import { eq, and, isNull, not } from 'drizzle-orm';
import * as schema from '@shared/schema';
import { findPrimaryTherapySlot, createTimeSlotKey } from './findPrimaryTherapySlot';

interface ConsolidationResult {
  fixed: number;
  errors: any[];
  details: string[];
}

/**
 * Mengkonsolidasikan semua appointment ke slot terapi utama (aktif)
 * untuk memastikan semua appointment terhubung dengan slot yang benar
 * @returns Informasi tentang proses konsolidasi
 */
export async function consolidateAppointmentsToMainSlots(): Promise<ConsolidationResult> {
  const result: ConsolidationResult = {
    fixed: 0,
    errors: [],
    details: []
  };

  try {
    // 1. Ambil semua appointment yang masih aktif (Scheduled, Confirmed, dll)
    const appointments = await db.select()
      .from(schema.appointments)
      .where(
        not(eq(schema.appointments.status, 'Cancelled'))
      );

    console.log(`Ditemukan ${appointments.length} appointment aktif untuk dikonsolidasi`);
    
    // 2. Proses setiap appointment
    for (const appointment of appointments) {
      try {
        if (!appointment.therapySlotId) {
          result.details.push(`Appointment ID ${appointment.id} tidak memiliki therapySlotId, dilewati`);
          continue;
        }

        // Ambil informasi slot terapi saat ini
        const [currentSlot] = await db.select()
          .from(schema.therapySlots)
          .where(eq(schema.therapySlots.id, appointment.therapySlotId));

        if (!currentSlot) {
          result.details.push(`Appointment ID ${appointment.id} terhubung ke slot yang tidak ada (${appointment.therapySlotId}), dilewati`);
          continue;
        }

        // Normalisasi timeSlotKey
        const timeSlotKey = currentSlot.timeSlotKey || createTimeSlotKey(currentSlot.date, currentSlot.timeSlot);
        
        // Cari slot terapi utama
        const primarySlot = await findPrimaryTherapySlot(
          timeSlotKey, 
          currentSlot.date, 
          currentSlot.timeSlot,
          true // Prioritaskan slot aktif
        );

        // Jika slot utama ditemukan dan berbeda dari slot saat ini
        if (primarySlot && primarySlot.id !== currentSlot.id) {
          result.details.push(`Appointment ID ${appointment.id} dialihkan dari slot ID ${currentSlot.id} ke slot utama ID ${primarySlot.id}`);
          
          // Update appointment dengan slot utama
          await db.update(schema.appointments)
            .set({ 
              therapySlotId: primarySlot.id,
              // Pastikan tanggal dan waktu konsisten dengan slot utama
              date: primarySlot.date,
              timeSlot: primarySlot.timeSlot
            })
            .where(eq(schema.appointments.id, appointment.id));
          
          // Kurangi penggunaan slot lama
          await db.update(schema.therapySlots)
            .set({
              currentCount: Math.max(0, currentSlot.currentCount - 1)
            })
            .where(eq(schema.therapySlots.id, currentSlot.id));
          
          // Tambahkan penggunaan slot baru
          await db.update(schema.therapySlots)
            .set({
              currentCount: primarySlot.currentCount + 1
            })
            .where(eq(schema.therapySlots.id, primarySlot.id));
          
          result.fixed++;
        } else if (!primarySlot) {
          result.details.push(`Appointment ID ${appointment.id} tetap menggunakan slot ID ${currentSlot.id} (tidak ditemukan slot utama)`);
        } else if (primarySlot.id === currentSlot.id) {
          result.details.push(`Appointment ID ${appointment.id} sudah terhubung dengan slot utama ID ${currentSlot.id}`);
        }
      } catch (error) {
        console.error(`Error saat memproses appointment ID ${appointment.id}:`, error);
        result.errors.push({
          appointmentId: appointment.id,
          error: error?.toString() || 'Unknown error'
        });
      }
    }

    return result;
  } catch (error) {
    console.error("Error saat konsolidasi appointment:", error);
    result.errors.push({
      error: error?.toString() || 'Unknown error'
    });
    return result;
  }
}

/**
 * Memindahkan semua appointment dari slot terapi tertentu ke slot terapi utama
 * @param sourceSlotId ID slot terapi sumber
 * @returns Informasi tentang proses pemindahan
 */
export async function migrateAppointmentsFromSlot(sourceSlotId: number): Promise<ConsolidationResult> {
  const result: ConsolidationResult = {
    fixed: 0,
    errors: [],
    details: []
  };

  try {
    // 1. Periksa slot sumber
    const [sourceSlot] = await db.select()
      .from(schema.therapySlots)
      .where(eq(schema.therapySlots.id, sourceSlotId));

    if (!sourceSlot) {
      result.errors.push({
        error: `Slot terapi dengan ID ${sourceSlotId} tidak ditemukan`
      });
      return result;
    }

    // 2. Cari slot terapi utama
    const timeSlotKey = sourceSlot.timeSlotKey || createTimeSlotKey(sourceSlot.date, sourceSlot.timeSlot);
    const primarySlot = await findPrimaryTherapySlot(
      timeSlotKey, 
      sourceSlot.date, 
      sourceSlot.timeSlot,
      true // Prioritaskan slot aktif
    );

    // Jika slot utama tidak ditemukan atau sama dengan slot sumber
    if (!primarySlot || primarySlot.id === sourceSlotId) {
      result.details.push(`Slot ID ${sourceSlotId} sudah merupakan slot utama atau tidak ditemukan slot utama`);
      return result;
    }

    // 3. Ambil semua appointment yang terhubung dengan slot sumber
    const appointments = await db.select()
      .from(schema.appointments)
      .where(eq(schema.appointments.therapySlotId, sourceSlotId));

    if (appointments.length === 0) {
      result.details.push(`Tidak ada appointment yang terhubung dengan slot ID ${sourceSlotId}`);
      return result;
    }

    // 4. Pindahkan semua appointment ke slot utama
    for (const appointment of appointments) {
      try {
        // Update appointment dengan slot utama
        await db.update(schema.appointments)
          .set({ 
            therapySlotId: primarySlot.id,
            // Pastikan tanggal dan waktu konsisten dengan slot utama
            date: primarySlot.date,
            timeSlot: primarySlot.timeSlot
          })
          .where(eq(schema.appointments.id, appointment.id));
        
        result.details.push(`Appointment ID ${appointment.id} dipindahkan dari slot ID ${sourceSlotId} ke slot utama ID ${primarySlot.id}`);
        result.fixed++;
      } catch (error) {
        console.error(`Error saat memindahkan appointment ID ${appointment.id}:`, error);
        result.errors.push({
          appointmentId: appointment.id,
          error: error?.toString() || 'Unknown error'
        });
      }
    }

    // 5. Update jumlah penggunaan slot
    if (result.fixed > 0) {
      // Kurangi penggunaan slot sumber
      await db.update(schema.therapySlots)
        .set({
          currentCount: 0 // Reset ke 0 karena semua appointment dipindahkan
        })
        .where(eq(schema.therapySlots.id, sourceSlotId));
      
      // Tambahkan penggunaan slot tujuan
      await db.update(schema.therapySlots)
        .set({
          currentCount: primarySlot.currentCount + result.fixed
        })
        .where(eq(schema.therapySlots.id, primarySlot.id));
      
      result.details.push(`Jumlah penggunaan slot diperbarui: slot ID ${sourceSlotId} = 0, slot ID ${primarySlot.id} = ${primarySlot.currentCount + result.fixed}`);
    }

    return result;
  } catch (error) {
    console.error("Error saat migrasi appointment:", error);
    result.errors.push({
      error: error?.toString() || 'Unknown error'
    });
    return result;
  }
}