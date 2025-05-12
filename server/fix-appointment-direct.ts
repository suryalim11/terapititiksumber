import { db } from "./db";
import * as schema from "../shared/schema";
import { eq, and } from "drizzle-orm";

/**
 * JALUR WALKIN REGISTER
 * 
 * Fungsi ini merupakan implementasi untuk jalur pendaftaran walkin
 * yang menghubungkan pasien dan slot terapi secara langsung melalui tombol di halaman detail pasien.
 * 
 * Ini adalah satu dari dua jalur pendaftaran utama dalam sistem:
 * 1. Pendaftaran online (melalui register.tsx)
 * 2. Pendaftaran walkin (melalui fungsi ini)
 */
export async function createMissingAppointmentDirect(patientId: number, therapySlotId: number) {
  console.log(`Pendaftaran walkin: Menghubungkan pasien ${patientId} ke slot terapi ${therapySlotId}`);
  
  try {
    // 1. Verifikasi patient menggunakan Drizzle ORM
    const [patient] = await db
      .select()
      .from(schema.patients)
      .where(eq(schema.patients.id, patientId));
    
    if (!patient) {
      throw new Error(`Patient with ID ${patientId} not found`);
    }
    
    console.log(`Patient verified: ${patient.name}`);
    
    // 2. Verifikasi therapy slot menggunakan Drizzle ORM
    const [therapySlot] = await db
      .select()
      .from(schema.therapySlots)
      .where(eq(schema.therapySlots.id, therapySlotId));
      
    if (!therapySlot) {
      throw new Error(`Therapy slot with ID ${therapySlotId} not found`);
    }
    
    console.log(`Therapy slot verified: ${therapySlot.date} ${therapySlot.timeSlot}`);
    
    // 3. Periksa apakah appointment sudah ada menggunakan Drizzle ORM
    const existingAppointments = await db
      .select()
      .from(schema.appointments)
      .where(
        and(
          eq(schema.appointments.patientId, patientId),
          eq(schema.appointments.therapySlotId, therapySlotId)
        )
      );
      
    if (existingAppointments.length > 0) {
      throw new Error(`Appointment already exists for patient ${patientId} on therapy slot ${therapySlotId}`);
    }
    
    // 4. Siapkan data untuk appointment baru
    const appointmentData = {
      patientId: patient.id,
      therapySlotId: therapySlot.id,
      notes: "Pendaftaran walkin langsung",
      status: "Scheduled",
      date: String(therapySlot.date),  // Pastikan date dalam bentuk string
      timeSlot: therapySlot.timeSlot,
      sessionId: null,
      registrationNumber: null
    };
    
    console.log(`Creating appointment with data:`, appointmentData);
    
    // 5. Insert appointment ke database menggunakan Drizzle ORM
    const [appointment] = await db
      .insert(schema.appointments)
      .values(appointmentData)
      .returning();
      
    console.log(`Appointment successfully created with ID ${appointment.id}`);
    
    // 6. Update therapy slot's currentCount menggunakan Drizzle ORM
    await db
      .update(schema.therapySlots)
      .set({
        currentCount: (therapySlot.currentCount || 0) + 1
      })
      .where(eq(schema.therapySlots.id, therapySlotId));
      
    console.log(`Therapy slot ${therapySlotId} current count updated`);
    
    return {
      success: true,
      appointment,
      message: `Appointment berhasil dibuat untuk pasien ${patient.name} pada slot ${therapySlot.date} ${therapySlot.timeSlot}`
    };
    
  } catch (error) {
    console.error(`Error creating appointment: ${error}`);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      message: `Gagal membuat appointment: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}