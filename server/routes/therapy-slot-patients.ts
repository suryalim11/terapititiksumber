import type { Request, Response } from "express";
import { pool } from "../db";
import { storage } from "../storage";

/**
 * Endpoint untuk mendapatkan daftar pasien berdasarkan slot terapi yang dioptimasi
 * Menggunakan SQL query langsung untuk efisiensi dan kecepatan
 */
export async function getTherapySlotPatients(req: Request, res: Response) {
  try {
    const slotId = parseInt(req.params.id);
    
    if (isNaN(slotId)) {
      return res.status(400).json({ message: "Invalid slot ID" });
    }
    
    // Tambahkan log debugging
    console.log(`[ROUTE] GET /api/therapy-slots/:id/patients - Requested slot ID: ${slotId}`);
    
    // Dapatkan slot terapi
    const slot = await storage.getTherapySlot(slotId);
    
    if (!slot) {
      console.log(`[ROUTE] Therapy slot ID ${slotId} not found`);
      return res.status(404).json({ message: "Therapy slot not found" });
    }
    
    console.log(`[ROUTE] Found therapy slot: ${slot.id}, date: ${slot.date}, timeSlot: ${slot.timeSlot}`);
    
    try {
      // Gunakan SQL query langsung untuk mendapatkan daftar appointment sekaligus dengan data pasien
      // Ubah query untuk menampilkan SEMUA pasien tanpa filter status
      // Ini mengatasi masalah dimana appointment dengan status berbeda tidak muncul
      const rawQuery = `
        SELECT 
          a.id as appointment_id,
          a.patient_id,
          a.status,
          a.notes,
          p.id as patient_id,
          p.name as patient_name,
          p.phone_number as patient_phone_number
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        WHERE a.therapy_slot_id = $1
        ORDER BY a.id DESC
      `;
      
      console.log(`[ROUTE] Query SQL untuk slot ID ${slotId} tanpa filter status`);
      
      console.log(`[ROUTE] Execute query for slot ID ${slotId} with optimized query`);
      
      // Execute query langsung dengan pool
      const { rows } = await pool.query(rawQuery, [slotId]);
      
      console.log(`[ROUTE] Direct SQL query found ${rows.length} appointments for slot ID ${slotId}`);
      
      // Perbarui slot currentCount untuk tampilan saja
      slot.currentCount = rows.length;
      
      // Transformasikan hasil query ke format yang diharapkan frontend
      // Transformasi data dengan menambahkan field notes untuk menandai walk-in
      const patientsData = rows.map(row => ({
        id: row.appointment_id,
        patientId: row.patient_id,
        status: row.status,
        notes: row.notes, // Pastikan field notes ikut dikirim ke frontend
        patient: {
          id: row.patient_id,
          name: row.patient_name,
          phoneNumber: row.patient_phone_number
        }
      }));
      
      console.log(`[ROUTE] Ditemukan ${patientsData.length} data pasien untuk slot ID ${slotId}`); // Simplified logging
      
      console.log(`[ROUTE] Prepared ${patientsData.length} patient records for response`);
      
      // Kirim respons
      return res.status(200).json({
        slot,
        appointments: patientsData
      });
    } catch (appointmentError) {
      console.error(`[ROUTE] Error getting appointments: ${appointmentError}`);
      return res.status(500).json({ 
        message: "Failed to get appointments for therapy slot",
        error: appointmentError instanceof Error ? appointmentError.message : String(appointmentError)
      });
    }
  } catch (error) {
    console.error(`[ROUTE] Error getting patients for therapy slot: ${error}`);
    return res.status(500).json({ 
      message: "Failed to get patients for therapy slot",
      error: error instanceof Error ? error.message : String(error)
    });
  }
}