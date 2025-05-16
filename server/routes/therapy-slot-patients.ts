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
    const showAll = req.query.showAll === 'true'; // Parameter untuk menunjukkan semua pasien dari slot dengan waktu yang sama
    
    if (isNaN(slotId)) {
      return res.status(400).json({ message: "Invalid slot ID" });
    }
    
    // Tambahkan log debugging
    console.log(`[ROUTE] GET /api/therapy-slots/:id/patients - Starting super-optimized version`);
    
    // Dapatkan slot terapi
    const slot = await storage.getTherapySlot(slotId);
    
    if (!slot) {
      console.log(`[ROUTE] Therapy slot ID ${slotId} not found`);
      return res.status(404).json({ message: "Therapy slot not found" });
    }
    
    const slotDate = typeof slot.date === 'string' ? slot.date : new Date(slot.date).toISOString().split('T')[0];
    const timeSlot = slot.timeSlot;
    
    console.log(`[ROUTE] Executing super-optimized query for slot ID ${slotId}`);
    
    try {
      // Query untuk mendapatkan semua therapy slot dengan tanggal dan waktu yang sama
      let allSlotsWithSameTime = [];
      let allAppointments = [];
      
      if (showAll) {
        console.log(`[ROUTE] Mencari slot dengan tanggal ${slotDate} dan waktu ${timeSlot}`);
        
        // Jika showAll=true, cari semua slot dengan waktu dan tanggal yang sama
        const slotsQuery = `
          SELECT id, date, time_slot, max_quota, current_count, is_active
          FROM therapy_slots
          WHERE date::date = $1::date AND time_slot = $2 AND is_active = true
          ORDER BY id
        `;
        
        try {
          const { rows: similarSlots } = await pool.query(slotsQuery, [slotDate, timeSlot]);
          console.log(`[ROUTE] Ditemukan ${similarSlots.length} slot dengan waktu ${timeSlot} pada tanggal ${slotDate}`);
          similarSlots.forEach(s => console.log(`[ROUTE] - Slot ID: ${s.id}, waktu: ${s.time_slot}`));
          allSlotsWithSameTime = similarSlots;
        } catch (error) {
          console.error(`[ROUTE] Error saat mencari slot dengan waktu sama: ${error}`);
        }
        
        // Kumpulkan semua ID slot
        const slotIds = similarSlots.map(s => s.id);
        
        if (slotIds.length > 0) {
          // Jika ada slot lain dengan waktu yang sama, ambil semua pasien
          const appointmentsQuery = `
            SELECT 
              a.id as appointment_id,
              a.therapy_slot_id,
              a.patient_id,
              a.status,
              a.notes,
              p.id as patient_id,
              p.name as patient_name,
              p.phone_number as patient_phone_number
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            WHERE a.therapy_slot_id = ANY($1)
            ORDER BY a.id DESC
          `;
          
          const { rows: allAppointmentRows } = await pool.query(appointmentsQuery, [slotIds]);
          allAppointments = allAppointmentRows;
        }
      }
      
      // Gunakan SQL query untuk slot yang sedang dilihat
      const rawQuery = `
        SELECT 
          a.id as appointment_id,
          a.therapy_slot_id,
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
      
      // Query untuk slot yang sedang dilihat
      const { rows } = await pool.query(rawQuery, [slotId]);
      
      // Kasus khusus untuk slot ID 473 dan 454 yang merupakan duplikat dengan waktu sama
      // Ini adalah quick fix untuk mengatasi kasus tertentu yang sudah ada di database
      if (slotId === 473) {
        console.log(`[ROUTE] Kasus khusus untuk slot ID 473, mencari pasien di slot ID 454 juga (waktu sama, tanggal sama)`);
        
        const specialQuery = `
          SELECT 
            a.id as appointment_id,
            a.therapy_slot_id,
            a.patient_id,
            a.status,
            a.notes,
            p.id as patient_id,
            p.name as patient_name,
            p.phone_number as patient_phone_number
          FROM appointments a
          JOIN patients p ON a.patient_id = p.id
          WHERE a.therapy_slot_id = 454
          ORDER BY a.id DESC
        `;
        
        try {
          const { rows: specialRows } = await pool.query(specialQuery);
          console.log(`[ROUTE] Ditemukan ${specialRows.length} pasien di slot ID 454 yang memiliki waktu sama dengan slot 473`);
          
          // Gabungkan hasil
          allAppointments = [...rows, ...specialRows];
        } catch (error) {
          console.error(`[ROUTE] Error saat mengambil data pasien dari slot 454: ${error}`);
          allAppointments = rows;
        }
      } else if (!showAll || allAppointments.length === 0) {
        // Untuk kasus normal, gunakan hasil langsung
        allAppointments = rows;
      }
      
      console.log(`[ROUTE] Super-optimized query completed in ${Date.now() - new Date().getTime()}ms with ${allAppointments.length} patients`);
      
      // Transformasikan hasil query ke format yang diharapkan frontend
      const patientsData = allAppointments.map(row => ({
        id: row.appointment_id,
        therapySlotId: row.therapy_slot_id || slotId,
        patientId: row.patient_id,
        status: row.status,
        notes: row.notes,
        patient: {
          id: row.patient_id,
          name: row.patient_name,
          phoneNumber: row.patient_phone_number
        }
      }));
      
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