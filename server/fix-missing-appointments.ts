/**
 * Script untuk memperbaiki pasien yang memiliki therapy_slot_id tapi tidak memiliki appointment
 * 
 * Kasus khusus:
 * - Dewi Lestari (ID 358) dengan therapy_slot_id 449 - tidak memiliki appointment
 */

import { db } from './db';
import * as schema from '@shared/schema';
import { eq, isNotNull, isNull } from 'drizzle-orm';

interface FixResult {
  created: number;
  errors: any[];
  details: string[];
}

/**
 * Fungsi untuk mencari pasien yang memiliki therapy_slot_id tetapi tidak memiliki appointment
 * dan membuat appointment untuk mereka
 */
export async function fixMissingAppointments(): Promise<FixResult> {
  const result: FixResult = {
    created: 0,
    errors: [],
    details: []
  };

  try {
    // Cari semua pasien yang memiliki therapy_slot_id
    const patientsWithSlots = await db.select()
      .from(schema.patients)
      .where(isNotNull(schema.patients.therapySlotId));

    console.log(`Ditemukan ${patientsWithSlots.length} pasien dengan therapy_slot_id yang tidak null`);
    
    // Untuk setiap pasien, periksa apakah mereka memiliki appointment
    for (const patient of patientsWithSlots) {
      try {
        if (!patient.therapySlotId) continue; // Skip jika therapySlotId null (untuk typescript)

        // Cari appointment yang sudah ada untuk pasien ini
        const existingAppointment = await db.select()
          .from(schema.appointments)
          .where(eq(schema.appointments.patientId, patient.id));

        // Jika pasien sudah memiliki appointment, skip
        if (existingAppointment.length > 0) {
          result.details.push(`Pasien ${patient.name} (ID: ${patient.id}) sudah memiliki ${existingAppointment.length} appointment`);
          continue;
        }

        // Ambil informasi slot terapi
        const therapySlot = await db.select()
          .from(schema.therapySlots)
          .where(eq(schema.therapySlots.id, patient.therapySlotId))
          .limit(1);

        if (therapySlot.length === 0) {
          result.details.push(`Slot terapi dengan ID ${patient.therapySlotId} untuk pasien ${patient.name} tidak ditemukan`);
          continue;
        }

        const slot = therapySlot[0];
        
        // Format tanggal dari slot terapi
        let dateStr = '';
        if (slot.date) {
          if (typeof slot.date === 'string') {
            dateStr = slot.date;
          } else if (slot.date instanceof Date) {
            dateStr = slot.date.toISOString().split('T')[0];
          }
        }

        // Buat appointment baru
        const [appointment] = await db.insert(schema.appointments)
          .values({
            patientId: patient.id,
            therapySlotId: patient.therapySlotId,
            notes: patient.complaints || '',
            status: "Scheduled",
            date: dateStr,
            timeSlot: slot.timeSlot || '',
            sessionId: null,
            registrationNumber: null
          })
          .returning();

        result.created += 1;
        result.details.push(`✅ Berhasil membuat appointment untuk pasien ${patient.name} (ID: ${patient.id}) di slot terapi ID ${patient.therapySlotId} pada ${dateStr} ${slot.timeSlot}`);

      } catch (error) {
        console.error(`Error memperbaiki appointment untuk pasien ID ${patient.id}:`, error);
        result.errors.push({
          patientId: patient.id,
          patientName: patient.name,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return result;
  } catch (error) {
    console.error("Error dalam proses perbaikan appointment yang hilang:", error);
    result.errors.push({
      general: true,
      error: error instanceof Error ? error.message : String(error)
    });
    return result;
  }
}

/**
 * Perbaiki appointment khusus untuk Dewi Lestari
 */
export async function fixDewiLestariAppointment(): Promise<FixResult> {
  const result: FixResult = {
    created: 0,
    errors: [],
    details: []
  };

  try {
    // Cari pasien Dewi Lestari
    const [dewiLestari] = await db.select()
      .from(schema.patients)
      .where(eq(schema.patients.id, 358))
      .limit(1);

    if (!dewiLestari) {
      result.details.push("Pasien Dewi Lestari tidak ditemukan");
      return result;
    }

    if (!dewiLestari.therapySlotId) {
      result.details.push("Pasien Dewi Lestari tidak memiliki therapy_slot_id");
      return result;
    }

    // Cari appointment yang sudah ada
    const existingAppointment = await db.select()
      .from(schema.appointments)
      .where(eq(schema.appointments.patientId, dewiLestari.id));

    if (existingAppointment.length > 0) {
      result.details.push(`Dewi Lestari sudah memiliki ${existingAppointment.length} appointment`);
      return result;
    }

    // Ambil informasi slot terapi
    const [therapySlot] = await db.select()
      .from(schema.therapySlots)
      .where(eq(schema.therapySlots.id, dewiLestari.therapySlotId))
      .limit(1);

    if (!therapySlot) {
      result.details.push(`Slot terapi dengan ID ${dewiLestari.therapySlotId} untuk Dewi Lestari tidak ditemukan`);
      return result;
    }

    // Format tanggal dari slot terapi
    let dateStr = '';
    if (therapySlot.date) {
      if (typeof therapySlot.date === 'string') {
        dateStr = therapySlot.date;
      } else if (therapySlot.date instanceof Date) {
        dateStr = therapySlot.date.toISOString().split('T')[0];
      }
    }

    // Buat appointment baru
    const [appointment] = await db.insert(schema.appointments)
      .values({
        patientId: dewiLestari.id,
        therapySlotId: dewiLestari.therapySlotId,
        notes: dewiLestari.complaints || '',
        status: "Scheduled",
        date: dateStr,
        timeSlot: therapySlot.timeSlot || '',
        sessionId: null,
        registrationNumber: null
      })
      .returning();

    result.created += 1;
    result.details.push(`✅ Berhasil membuat appointment untuk Dewi Lestari (ID: ${dewiLestari.id}) di slot terapi ID ${dewiLestari.therapySlotId} pada ${dateStr} ${therapySlot.timeSlot}`);

    return result;
  } catch (error) {
    console.error("Error dalam proses perbaikan appointment Dewi Lestari:", error);
    result.errors.push({
      error: error instanceof Error ? error.message : String(error)
    });
    return result;
  }
}