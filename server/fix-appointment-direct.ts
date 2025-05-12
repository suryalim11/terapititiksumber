import { pool } from "./db";

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
    // 1. Verifikasi patient
    const patientResult = await pool.query(
      `SELECT * FROM patients WHERE id = $1`,
      [patientId]
    );
    
    if (patientResult.rows.length === 0) {
      throw new Error(`Patient with ID ${patientId} not found`);
    }
    
    const patient = patientResult.rows[0];
    console.log(`Patient verified: ${patient.name}`);
    
    // 2. Verifikasi therapy slot
    const therapySlotResult = await pool.query(
      `SELECT * FROM therapy_slots WHERE id = $1`,
      [therapySlotId]
    );
      
    if (therapySlotResult.rows.length === 0) {
      throw new Error(`Therapy slot with ID ${therapySlotId} not found`);
    }
    
    const therapySlot = therapySlotResult.rows[0];
    console.log(`Therapy slot verified: ${therapySlot.date} ${therapySlot.time_slot}`);
    
    // 3. Periksa apakah appointment sudah ada
    const existingAppointmentsResult = await pool.query(
      `SELECT * FROM appointments WHERE patient_id = $1 AND therapy_slot_id = $2`,
      [patientId, therapySlotId]
    );
      
    if (existingAppointmentsResult.rows.length > 0) {
      throw new Error(`Appointment already exists for patient ${patientId} on therapy slot ${therapySlotId}`);
    }
    
    // 4. Buat appointment baru
    const appointmentData = {
      patient_id: patient.id,
      therapy_slot_id: therapySlot.id,
      notes: "Appointment dibuat ulang dengan fix-appointment-direct.ts",
      status: "Scheduled",
      date: therapySlot.date,
      time_slot: therapySlot.time_slot,
      session_id: null,
      registration_number: null
    };
    
    console.log(`Creating appointment with data:`, appointmentData);
    
    // 5. Insert appointment ke database menggunakan SQL
    const appointmentResult = await pool.query(
      `INSERT INTO appointments 
        (patient_id, therapy_slot_id, notes, status, date, time_slot, session_id, registration_number) 
       VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [
        appointmentData.patient_id,
        appointmentData.therapy_slot_id,
        appointmentData.notes,
        appointmentData.status,
        appointmentData.date,
        appointmentData.time_slot,
        appointmentData.session_id,
        appointmentData.registration_number
      ]
    );
      
    const appointment = appointmentResult.rows[0];
    console.log(`Appointment successfully created with ID ${appointment.id}`);
    
    // 6. Update therapy slot's currentCount
    await pool.query(
      `UPDATE therapy_slots 
       SET current_count = current_count + 1 
       WHERE id = $1`,
      [therapySlotId]
    );
      
    console.log(`Therapy slot ${therapySlotId} current count updated`);
    
    return {
      success: true,
      appointment,
      message: `Appointment berhasil dibuat untuk pasien ${patient.name} pada slot ${therapySlot.date} ${therapySlot.time_slot}`
    };
    
  } catch (error) {
    console.error(`Error creating missing appointment: ${error}`);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      message: `Gagal membuat appointment: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}