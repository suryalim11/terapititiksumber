/**
 * Modul untuk memverifikasi dan memperbaiki koneksi pasien-appointment
 * serta menyinkronkan jumlah pasien di therapy slots
 */
import { pool, db } from "./db";
import * as schema from "../shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { storage } from "./storage";

interface VerificationResult {
  fixed: number;
  errors: any[];
  details: string[];
}

/**
 * Memverifikasi dan memperbaiki koneksi pasien-appointment untuk pasien tertentu
 * @param patientId ID pasien yang akan diverifikasi
 * @returns Hasil verifikasi dan perbaikan
 */
export async function verifyAppointmentConnectionForPatient(patientId: number): Promise<VerificationResult> {
  const result: VerificationResult = {
    fixed: 0,
    errors: [],
    details: []
  };

  try {
    // 1. Cari data pasien
    const patient = await storage.getPatient(patientId);
    if (!patient) {
      result.errors.push({ error: `Pasien dengan ID ${patientId} tidak ditemukan` });
      return result;
    }

    // 2. Cek apakah pasien memiliki therapy_slot_id
    if (!patient.therapySlotId) {
      result.errors.push({ error: `Pasien ${patient.name} (ID: ${patientId}) tidak memiliki therapySlotId` });
      return result;
    }

    // 3. Periksa apakah pasien sudah memiliki appointment untuk therapySlotId tersebut
    const appointments = await db.select()
      .from(schema.appointments)
      .where(and(
        eq(schema.appointments.patientId, patientId),
        eq(schema.appointments.therapySlotId, patient.therapySlotId)
      ));

    if (appointments.length > 0) {
      result.details.push(`Pasien ${patient.name} (ID: ${patientId}) sudah memiliki appointment untuk slot ${patient.therapySlotId}`);
      
      // Lanjutkan ke langkah 5 untuk sinkronisasi current_count
    } else {
      // 4. Jika tidak memiliki appointment, buat appointment baru
      try {
        // Ambil data therapySlot untuk mendapatkan tanggal dan timeSlot
        const therapySlot = await storage.getTherapySlot(patient.therapySlotId);
        if (!therapySlot) {
          result.errors.push({ error: `Slot terapi dengan ID ${patient.therapySlotId} tidak ditemukan` });
          return result;
        }

        // Generate registration number
        const registrationNumber = `REG-${Date.now().toString().slice(-6)}${patientId}`;

        // Buat appointment baru
        const newAppointment = await storage.createAppointment({
          patientId: patientId,
          date: therapySlot.date,
          timeSlot: therapySlot.timeSlot,
          therapySlotId: patient.therapySlotId,
          sessionId: null, // Ini bisa diupdate nanti
          status: "Scheduled", // Default status
          registrationNumber: registrationNumber,
          notes: null
        });

        result.fixed++;
        result.details.push(`✅ Berhasil membuat appointment baru untuk pasien ${patient.name} (ID: ${patientId}) di slot ${therapySlot.date} ${therapySlot.timeSlot}`);
      } catch (error) {
        result.errors.push({ 
          error: `Gagal membuat appointment untuk pasien ${patient.name} (ID: ${patientId})`,
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // 5. Sinkronkan current_count di therapy_slot dengan jumlah actual appointment
    try {
      await syncTherapySlotCount(patient.therapySlotId);
      result.details.push(`✅ Current count pada therapy slot ID ${patient.therapySlotId} telah disinkronkan`);
    } catch (error) {
      result.errors.push({
        error: `Gagal menyinkronkan current_count untuk slot terapi ID ${patient.therapySlotId}`,
        details: error instanceof Error ? error.message : String(error)
      });
    }

    return result;
  } catch (error) {
    result.errors.push({
      error: "Error umum saat verifikasi koneksi",
      details: error instanceof Error ? error.message : String(error)
    });
    return result;
  }
}

/**
 * Menyinkronkan ulang nilai current_count di therapy_slot berdasarkan jumlah appointment aktual
 * @param therapySlotId ID therapy slot yang akan disinkronkan
 */
export async function syncTherapySlotCount(therapySlotId: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Hitung jumlah appointment actual untuk slot tersebut
    const { rows: [countResult] } = await client.query(
      'SELECT COUNT(*) as actual_count FROM appointments WHERE therapy_slot_id = $1',
      [therapySlotId]
    );

    const actualCount = parseInt(countResult.actual_count, 10);

    // Update current_count di therapy_slots
    await client.query(
      'UPDATE therapy_slots SET current_count = $1 WHERE id = $2',
      [actualCount, therapySlotId]
    );

    // Commit transaksi
    await client.query('COMMIT');
    console.log(`✅ Berhasil menyinkronkan current_count = ${actualCount} untuk therapy slot ID ${therapySlotId}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error saat menyinkronkan current_count:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Menyinkronkan ulang nilai current_count untuk semua therapy slots
 * @returns Jumlah slot yang diperbarui
 */
export async function syncAllTherapySlotCounts(): Promise<number> {
  let updatedCount = 0;
  
  try {
    // Dapatkan semua therapy slots
    const therapySlots = await storage.getAllTherapySlots();
    
    // Proses setiap slot
    for (const slot of therapySlots) {
      try {
        await syncTherapySlotCount(slot.id);
        updatedCount++;
      } catch (error) {
        console.error(`❌ Gagal memperbarui slot ID ${slot.id}:`, error);
      }
    }
    
    return updatedCount;
  } catch (error) {
    console.error('❌ Error saat menyinkronkan semua therapy slots:', error);
    throw error;
  }
}