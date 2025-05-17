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
    
    // Tambahkan nocache parameter untuk memastikan browser tidak cache
    const nocache = req.query.nocache;
    console.log(`👥 Mengambil data pasien untuk slot ${slotId} (DIRECT SQL QUERY) - nocache: ${nocache}`);
    
    // Gunakan query langsung ke database untuk memastikan data yang akurat
    const { pool } = require('../../db');
    
    // Periksa appointment yang benar menggunakan query SQL
    const appointmentSql = `
      SELECT a.id, a.patient_id, a.therapy_slot_id, a.status, a.walkin
      FROM appointments a
      WHERE a.therapy_slot_id = $1
    `;
    const appointmentResult = await pool.query(appointmentSql, [slotId]);
    const appointments = appointmentResult.rows;
    
    console.log(`Ditemukan ${appointments.length} appointment untuk slot ${slotId}:`);
    appointments.forEach(app => {
      console.log(`- Appointment ID: ${app.id}, Patient ID: ${app.patient_id}, Status: ${app.status}, Walkin: ${app.walkin}`);
    });
    
    // Ambil data pasien berdasarkan appointment yang ditemukan
    const patients = [];
    for (const app of appointments) {
      // Ambil detail pasien
      const patientSql = `
        SELECT 
          p.id, 
          p.patient_id as "patientId", 
          p.name, 
          p.phone_number as "phone", 
          p.email, 
          p.gender, 
          p.address, 
          p.birth_date as "dateOfBirth"
        FROM 
          patients p 
        WHERE 
          p.id = $1
      `;
      const patientResult = await pool.query(patientSql, [app.patient_id]);
      
      if (patientResult.rows.length > 0) {
        const patient = patientResult.rows[0];
        // Tambahkan status appointment ke data pasien
        const patientWithStatus = {
          ...patient,
          appointmentStatus: app.status,
          appointmentId: app.id,
          walkin: app.walkin || false
        };
        
        console.log(`📊 Data pasien terverifikasi: ${patientWithStatus.name} (ID: ${patientWithStatus.id}), AppointmentID: ${patientWithStatus.appointmentId}, Status: ${patientWithStatus.appointmentStatus}`);
        patients.push(patientWithStatus);
      }
    }
    
    console.log(`Mengirim data ${patients.length} pasien ke client, data telah diverifikasi dari database`);
    return res.json(patients);
  } catch (error) {
    console.error('Error mendapatkan data pasien slot terapi:', error);
    return res.status(500).json({ error: 'Gagal mengambil data pasien' });
  }
}