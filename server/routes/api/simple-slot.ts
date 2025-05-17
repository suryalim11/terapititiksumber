/**
 * API sederhana untuk endpoint slot terapi
 * Dirancang untuk performa maksimal dengan respons ringan dan cepat
 */

import { Request, Response } from 'express';
import { storage } from '../../storage';
import { getWIBDate } from '../../../wib-timezone-fixes';

/**
 * Mendapatkan informasi dasar slot terapi dengan ID tertentu
 * Tidak termasuk data pasien atau appointment untuk performa maksimal
 */
export async function getBasicSlotInfo(req: Request, res: Response) {
  try {
    const slotId = parseInt(req.params.id);
    if (isNaN(slotId)) {
      return res.status(400).json({ error: 'ID slot terapi tidak valid' });
    }

    console.log(`🔍 Mengambil data dasar therapy slot ID: ${slotId}`);
    
    // Ambil data dasar slot terapi dari database
    const therapySlot = await storage.getTherapySlot(slotId);
    
    if (!therapySlot) {
      return res.status(404).json({ error: 'Slot terapi tidak ditemukan' });
    }
    
    // Kembalikan hanya properti dasar untuk respons ringan dan cepat
    const basicInfo = {
      id: therapySlot.id,
      date: therapySlot.date,
      timeSlot: therapySlot.timeSlot,
      maxQuota: therapySlot.maxQuota,
      currentCount: therapySlot.currentCount,
      isActive: therapySlot.isActive
    };
    
    return res.json(basicInfo);
  } catch (error) {
    console.error('Error mendapatkan info dasar slot terapi:', error);
    return res.status(500).json({ error: 'Gagal mengambil informasi slot terapi' });
  }
}

/**
 * Mendapatkan daftar appointment untuk slot terapi tertentu
 * Dapat dikonsumsi secara terpisah untuk performa lebih baik
 */
export async function getSlotAppointments(req: Request, res: Response) {
  try {
    const slotId = parseInt(req.params.id);
    if (isNaN(slotId)) {
      return res.status(400).json({ error: 'ID slot terapi tidak valid' });
    }
    
    console.log(`📅 Mengambil appointments untuk slot ${slotId}`);
    
    // Ambil appointment untuk slot terapi ini
    const appointments = await storage.getAppointmentsByTherapySlot(slotId);
    
    // Hanya kembalikan info penting saja untuk respons ringan
    const simplifiedAppointments = appointments.map(appointment => ({
      id: appointment.id,
      patientId: appointment.patientId,
      status: appointment.status,
      date: appointment.date,
      timeSlot: appointment.timeSlot
    }));
    
    return res.json(simplifiedAppointments);
  } catch (error) {
    console.error('Error mendapatkan appointment slot terapi:', error);
    return res.status(500).json({ error: 'Gagal mengambil data appointment' });
  }
}

/**
 * Mendapatkan daftar pasien untuk slot terapi tertentu
 * Data ini mungkin berat dan lambat, jadi dipisahkan dari endpoint dasar
 */
export async function getSlotPatients(req: Request, res: Response) {
  try {
    const slotId = parseInt(req.params.id);
    if (isNaN(slotId)) {
      return res.status(400).json({ error: 'ID slot terapi tidak valid' });
    }
    
    console.log(`👥 Mengambil data pasien untuk slot ${slotId} (VERSI DIRECT QUERY)`);
    
    // Gunakan query langsung ke database untuk memastikan data yang akurat
    const { pool } = require('../../db');
    
    const result = await pool.query(`
      SELECT 
        p.id, 
        p.patient_id as "patientId", 
        p.name, 
        p.phone_number as "phone", 
        p.email, 
        p.gender, 
        p.address, 
        p.birth_date as "dateOfBirth",
        a.status as "appointmentStatus",
        a.id as "appointmentId",
        a.walkin
      FROM 
        appointments a
      JOIN 
        patients p ON a.patient_id = p.id
      WHERE 
        a.therapy_slot_id = $1
    `, [slotId]);
    
    const patients = result.rows;
    console.log(`Ditemukan ${patients.length} pasien dari direct query untuk slot ${slotId}`);
    
    // Log data pasien untuk debugging
    patients.forEach(patient => {
      console.log(`📊 Data pasien: ${patient.name} (ID: ${patient.id}), AppointmentID: ${patient.appointmentId}, Status: ${patient.appointmentStatus}`);
    });
    
    return res.json(patients);
  } catch (error) {
    console.error('Error mendapatkan data pasien slot terapi:', error);
    return res.status(500).json({ error: 'Gagal mengambil data pasien' });
  }
}