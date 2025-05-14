/**
 * Module untuk memverifikasi dan memperbaiki koneksi antara appointment dan slot terapi
 * Berfungsi untuk memastikan pasien yang terdaftar muncul di slot tracker
 */

import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";
import * as schema from "../shared/schema";

interface VerifyResult {
  verified: number;
  fixed: number;
  errors: any[];
}

/**
 * Memeriksa dan memperbaiki koneksi appointment berdasarkan patientId tertentu
 * @param patientId ID pasien yang akan diperiksa appointmentnya
 * @returns Hasil verifikasi dengan jumlah yang berhasil diperbaiki
 */
export async function verifyPatientAppointments(patientId: number): Promise<VerifyResult> {
  const result: VerifyResult = {
    verified: 0,
    fixed: 0,
    errors: []
  };

  try {
    console.log(`🔍 Memverifikasi appointment untuk pasien ID ${patientId}...`);
    
    // Ambil semua appointment untuk pasien tersebut
    const appointments = await db.select()
      .from(schema.appointments)
      .where(eq(schema.appointments.patientId, patientId));
    
    console.log(`Ditemukan ${appointments.length} appointment untuk pasien ID ${patientId}`);
    result.verified = appointments.length;
    
    if (appointments.length === 0) {
      // Jika tidak ada appointment, kemungkinan belum terdaftar
      console.log(`⚠️ Tidak ditemukan appointment untuk pasien ID ${patientId}`);
      
      // Cek jika pasien ada
      const [patient] = await db.select()
        .from(schema.patients)
        .where(eq(schema.patients.id, patientId));
      
      if (!patient) {
        console.error(`❌ Pasien dengan ID ${patientId} tidak ditemukan`);
        result.errors.push({ message: `Pasien dengan ID ${patientId} tidak ditemukan` });
        return result;
      }
      
      // Jika pasien ada tapi tidak ada appointment, mungkin proses belum selesai
      console.log(`ℹ️ Pasien ${patient.name} (ID: ${patient.patientId}) ada tetapi belum ada janji temu terdaftar`);
    }
    
    // Periksa dan perbaiki setiap appointment
    for (const appointment of appointments) {
      // Verifikasi therapySlotId ada dan valid
      if (!appointment.therapySlotId) {
        console.error(`❌ Appointment ID ${appointment.id} tidak memiliki therapySlotId`);
        result.errors.push({ 
          appointmentId: appointment.id, 
          message: "Appointment tidak memiliki therapySlotId" 
        });
        continue;
      }
      
      // Verifikasi bahwa slot terapi benar-benar ada
      const [therapySlot] = await db.select()
        .from(schema.therapySlots)
        .where(eq(schema.therapySlots.id, appointment.therapySlotId));
      
      if (!therapySlot) {
        console.error(`❌ Slot terapi ID ${appointment.therapySlotId} tidak ditemukan`);
        result.errors.push({ 
          appointmentId: appointment.id, 
          therapySlotId: appointment.therapySlotId,
          message: "Slot terapi tidak ditemukan" 
        });
        continue;
      }
      
      // Verifikasi bahwa currentCount slot terapi sudah diperbarui
      // Jika currentCount masih 0 atau tidak sesuai dengan jumlah appointment, perlu diperbaiki
      const appointmentsForSlot = await db.select()
        .from(schema.appointments)
        .where(eq(schema.appointments.therapySlotId, therapySlot.id));
      
      if (appointmentsForSlot.length > 0 && therapySlot.currentCount === 0) {
        // Perbarui currentCount slot terapi
        console.log(`🔄 Memperbaiki currentCount slot terapi ID ${therapySlot.id} (seharusnya ${appointmentsForSlot.length}, sekarang ${therapySlot.currentCount})`);
        
        try {
          await db.execute(
            sql`UPDATE therapy_slots SET current_count = ${appointmentsForSlot.length} WHERE id = ${therapySlot.id}`
          );
          console.log(`✅ CurrentCount slot terapi ID ${therapySlot.id} berhasil diperbarui ke ${appointmentsForSlot.length}`);
          result.fixed++;
        } catch (error) {
          console.error(`❌ Gagal memperbarui currentCount slot terapi ID ${therapySlot.id}:`, error);
          result.errors.push({ 
            therapySlotId: therapySlot.id, 
            message: `Gagal memperbarui currentCount: ${error}` 
          });
        }
      } else {
        console.log(`✅ Appointment ID ${appointment.id} memiliki koneksi yang valid ke slot terapi ID ${therapySlot.id}`);
      }
    }
    
    return result;
  } catch (error) {
    console.error("❌ Error saat memverifikasi appointment:", error);
    result.errors.push({ message: `Error saat memverifikasi: ${error}` });
    return result;
  }
}

/**
 * Memverifikasi dan memperbaiki semua koneksi appointment untuk semua pasien
 * @returns Hasil verifikasi dengan jumlah yang berhasil diperbaiki
 */
export async function verifyAllAppointments(): Promise<VerifyResult> {
  const result: VerifyResult = {
    verified: 0,
    fixed: 0,
    errors: []
  };
  
  try {
    console.log(`🔍 Memverifikasi semua appointment...`);
    
    // Ambil semua appointment
    const appointments = await db.select()
      .from(schema.appointments);
    
    console.log(`Ditemukan ${appointments.length} appointment total`);
    result.verified = appointments.length;
    
    // Kelompokkan appointment berdasarkan therapySlotId
    const appointmentsBySlot: { [key: number]: number } = {};
    
    for (const appointment of appointments) {
      if (appointment.therapySlotId) {
        const slotId = appointment.therapySlotId;
        appointmentsBySlot[slotId] = (appointmentsBySlot[slotId] || 0) + 1;
      }
    }
    
    // Periksa dan perbaiki currentCount untuk setiap slot terapi
    for (const [slotIdStr, count] of Object.entries(appointmentsBySlot)) {
      const slotId = parseInt(slotIdStr);
      
      // Ambil data slot terapi
      const [therapySlot] = await db.select()
        .from(schema.therapySlots)
        .where(eq(schema.therapySlots.id, slotId));
      
      if (!therapySlot) {
        console.error(`❌ Slot terapi ID ${slotId} tidak ditemukan tetapi memiliki ${count} appointment`);
        result.errors.push({ 
          therapySlotId: slotId, 
          message: "Slot terapi tidak ditemukan" 
        });
        continue;
      }
      
      // Jika currentCount tidak sesuai dengan jumlah appointment, perbarui
      if (therapySlot.currentCount !== count) {
        console.log(`🔄 Memperbaiki currentCount slot terapi ID ${slotId} (seharusnya ${count}, sekarang ${therapySlot.currentCount})`);
        
        try {
          await db.execute(
            sql`UPDATE therapy_slots SET current_count = ${count} WHERE id = ${slotId}`
          );
          console.log(`✅ CurrentCount slot terapi ID ${slotId} berhasil diperbarui ke ${count}`);
          result.fixed++;
        } catch (error) {
          console.error(`❌ Gagal memperbarui currentCount slot terapi ID ${slotId}:`, error);
          result.errors.push({ 
            therapySlotId: slotId, 
            message: `Gagal memperbarui currentCount: ${error}` 
          });
        }
      } else {
        console.log(`✅ Slot terapi ID ${slotId} memiliki currentCount yang benar (${count})`);
      }
    }

    // Deteksi pasien yang memiliki therapySlotId tetapi tidak memiliki appointment
    console.log(`🔍 Mendeteksi pasien yang memiliki therapySlotId tetapi tidak memiliki appointment...`);
    const patientsWithSlot = await db.select()
      .from(schema.patients)
      .where(sql`therapy_slot_id IS NOT NULL`);
    
    console.log(`Ditemukan ${patientsWithSlot.length} pasien dengan therapySlotId`);
    
    // Periksa setiap pasien
    for (const patient of patientsWithSlot) {
      const patientAppointments = await db.select()
        .from(schema.appointments)
        .where(and(
          eq(schema.appointments.patientId, patient.id),
          eq(schema.appointments.therapySlotId, patient.therapySlotId!)
        ));
      
      if (patientAppointments.length === 0) {
        console.log(`⚠️ Pasien ${patient.name} (ID: ${patient.patientId}) memiliki therapySlotId ${patient.therapySlotId} tetapi tidak memiliki appointment terkait`);
        
        // Tambahkan ke daftar error untuk dilaporkan
        result.errors.push({
          patientId: patient.id,
          patientName: patient.name,
          patientCode: patient.patientId,
          therapySlotId: patient.therapySlotId,
          message: "Pasien memiliki therapySlotId tetapi tidak memiliki appointment"
        });
      }
    }
    
    return result;
  } catch (error) {
    console.error("❌ Error saat memverifikasi semua appointment:", error);
    result.errors.push({ message: `Error saat memverifikasi: ${error}` });
    return result;
  }
}