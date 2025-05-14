/**
 * Modul untuk verifikasi koneksi antara pasien dan appointment
 * Mencari pasien dengan therapySlotId tapi tidak memiliki appointment
 * dan otomatis membuat appointment untuk pasien tersebut
 */

import { db } from './db';
import { sql } from 'drizzle-orm';
import * as schema from '@shared/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { format } from 'date-fns';

interface VerificationResult {
  verified: number;
  fixed: number;
  skipped: number;
  errors: any[];
}

/**
 * Memeriksa dan memperbaiki koneksi pasien dengan appointment
 * @returns Hasil verifikasi dengan jumlah pasien yang diverifikasi dan diperbaiki
 */
export async function verifyPatientAppointmentConnections(): Promise<VerificationResult> {
  const result: VerificationResult = {
    verified: 0,
    fixed: 0,
    skipped: 0,
    errors: []
  };

  console.log("🔍 Memulai verifikasi koneksi pasien-appointment...");
  
  try {
    // Cari pasien yang memiliki therapySlotId tapi tidak memiliki appointment
    const query = `
      SELECT p.id, p.name, p.therapy_slot_id, ts.date, ts.time_slot
      FROM patients p
      JOIN therapy_slots ts ON p.therapy_slot_id = ts.id
      LEFT JOIN appointments a ON a.patient_id = p.id AND a.therapy_slot_id = p.therapy_slot_id
      WHERE p.therapy_slot_id IS NOT NULL
      AND a.id IS NULL
    `;
    
    const { rows: patientsWithoutAppointments } = await db.execute(sql.raw(query));
    
    console.log(`✅ Ditemukan ${patientsWithoutAppointments.length} pasien yang perlu diperbaiki koneksi appointmentnya`);
    result.verified = patientsWithoutAppointments.length;
    
    // Jika tidak ada pasien yang perlu diperbaiki, kembalikan hasil
    if (patientsWithoutAppointments.length === 0) {
      return result;
    }
    
    // Perbaiki setiap pasien dengan membuat appointment
    for (const patient of patientsWithoutAppointments) {
      try {
        // Buat appointment baru untuk pasien
        console.log(`⏳ Membuat appointment untuk pasien: ${patient.name} (ID: ${patient.id}) pada slot terapi ID: ${patient.therapy_slot_id}`);
        
        const [appointment] = await db.insert(schema.appointments)
          .values({
            patientId: patient.id,
            therapySlotId: patient.therapy_slot_id,
            date: patient.date,
            timeSlot: patient.time_slot,
            status: "Scheduled",
            notes: "Dibuat otomatis oleh sistem verifikasi",
            sessionId: null,
            registrationNumber: null
          })
          .returning();
        
        if (appointment && appointment.id) {
          console.log(`✅ Berhasil membuat appointment dengan ID: ${appointment.id}`);
          result.fixed++;
          
          // Update currentCount pada therapy slot
          try {
            await db.execute(
              sql`UPDATE therapy_slots SET current_count = current_count + 1 WHERE id = ${patient.therapy_slot_id}`
            );
            console.log(`✅ Berhasil mengupdate current_count pada slot terapi ID: ${patient.therapy_slot_id}`);
          } catch (updateError) {
            console.error(`❌ Gagal mengupdate current_count:`, updateError);
            result.errors.push({
              type: 'update_current_count_error',
              patientId: patient.id,
              therapySlotId: patient.therapy_slot_id,
              error: updateError
            });
          }
        } else {
          console.error(`❌ Gagal membuat appointment untuk pasien ID: ${patient.id}`);
          result.skipped++;
          result.errors.push({
            type: 'appointment_creation_failed',
            patientId: patient.id,
            therapySlotId: patient.therapy_slot_id
          });
        }
      } catch (error) {
        console.error(`❌ Error saat membuat appointment untuk pasien ID: ${patient.id}:`, error);
        result.skipped++;
        result.errors.push({
          type: 'appointment_creation_error',
          patientId: patient.id,
          therapySlotId: patient.therapy_slot_id,
          error
        });
      }
    }
    
    console.log(`🏁 Verifikasi selesai: ${result.verified} pasien diverifikasi, ${result.fixed} diperbaiki, ${result.skipped} dilewati`);
    return result;
  } catch (error) {
    console.error("❌ Error saat melakukan verifikasi koneksi pasien-appointment:", error);
    result.errors.push({
      type: 'verification_error',
      error
    });
    return result;
  }
}

/**
 * Verifikasi koneksi untuk pasien tertentu
 * @param patientId ID pasien yang akan diverifikasi
 * @returns Hasil verifikasi untuk pasien tersebut
 */
export async function verifyAppointmentConnectionForPatient(patientId: number): Promise<VerificationResult> {
  const result: VerificationResult = {
    verified: 1,
    fixed: 0,
    skipped: 0,
    errors: []
  };
  
  console.log(`🔍 Memverifikasi koneksi appointment untuk pasien ID: ${patientId}`);
  
  try {
    // Cari detail pasien
    const [patient] = await db.select()
      .from(schema.patients)
      .where(eq(schema.patients.id, patientId))
      .limit(1);
    
    if (!patient) {
      console.error(`❌ Pasien dengan ID ${patientId} tidak ditemukan`);
      result.skipped = 1;
      result.errors.push({
        type: 'patient_not_found',
        patientId
      });
      return result;
    }
    
    // Jika pasien tidak memiliki therapySlotId, lewati
    if (!patient.therapySlotId) {
      console.log(`ℹ️ Pasien ID: ${patientId} tidak memiliki therapySlotId, dilewati`);
      result.skipped = 1;
      return result;
    }
    
    // Cari appointment yang sudah ada
    const [existingAppointment] = await db.select()
      .from(schema.appointments)
      .where(
        and(
          eq(schema.appointments.patientId, patientId),
          eq(schema.appointments.therapySlotId, patient.therapySlotId)
        )
      )
      .limit(1);
    
    if (existingAppointment) {
      console.log(`✅ Pasien ID: ${patientId} sudah memiliki appointment (ID: ${existingAppointment.id})`);
      return result;
    }
    
    // Cari detail therapy slot
    const [therapySlot] = await db.select()
      .from(schema.therapySlots)
      .where(eq(schema.therapySlots.id, patient.therapySlotId))
      .limit(1);
    
    if (!therapySlot) {
      console.error(`❌ Slot terapi dengan ID ${patient.therapySlotId} tidak ditemukan`);
      result.skipped = 1;
      result.errors.push({
        type: 'therapy_slot_not_found',
        patientId,
        therapySlotId: patient.therapySlotId
      });
      return result;
    }
    
    // Buat appointment baru
    console.log(`⏳ Membuat appointment untuk pasien: ${patient.name} (ID: ${patientId}) pada slot terapi ID: ${patient.therapySlotId}`);
    
    // Format tanggal yang benar untuk appointment
    const appointmentDate = typeof therapySlot.date === 'string' 
      ? therapySlot.date 
      : format(therapySlot.date, 'yyyy-MM-dd');
    
    const [appointment] = await db.insert(schema.appointments)
      .values({
        patientId,
        therapySlotId: patient.therapySlotId,
        date: appointmentDate,
        timeSlot: therapySlot.timeSlot || "",
        status: "Scheduled",
        notes: "Dibuat oleh verifikasi pasien otomatis",
        sessionId: null,
        registrationNumber: null
      })
      .returning();
    
    if (appointment && appointment.id) {
      console.log(`✅ Berhasil membuat appointment dengan ID: ${appointment.id}`);
      result.fixed = 1;
      
      // Update currentCount pada therapy slot
      try {
        await db.execute(
          sql`UPDATE therapy_slots SET current_count = current_count + 1 WHERE id = ${patient.therapySlotId}`
        );
        console.log(`✅ Berhasil mengupdate current_count pada slot terapi ID: ${patient.therapySlotId}`);
      } catch (updateError) {
        console.error(`❌ Gagal mengupdate current_count:`, updateError);
        result.errors.push({
          type: 'update_current_count_error',
          patientId,
          therapySlotId: patient.therapySlotId,
          error: updateError
        });
      }
    } else {
      console.error(`❌ Gagal membuat appointment untuk pasien ID: ${patientId}`);
      result.skipped = 1;
      result.errors.push({
        type: 'appointment_creation_failed',
        patientId,
        therapySlotId: patient.therapySlotId
      });
    }
    
    return result;
  } catch (error) {
    console.error(`❌ Error saat memverifikasi pasien ID: ${patientId}:`, error);
    result.skipped = 1;
    result.errors.push({
      type: 'verification_error',
      patientId,
      error
    });
    return result;
  }
}