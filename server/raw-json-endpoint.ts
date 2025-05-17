/**
 * Endpoint JSON langsung tanpa middleware Express
 * Menggunakan pendekatan HTTP mentah untuk memastikan header Content-Type benar
 */
import http from 'http';
import { Express } from 'express';
import { storage } from './storage';

/**
 * Konfigurasi endpoint JSON mentah yang langsung memanipulasi respons HTTP
 * 
 * @param app Express app
 */
export function setupRawJsonEndpoints(app: Express) {
  
  // Handler slot basic
  app.get('/api/raw/slot/:id/basic', async (req, res) => {
    try {
      const slotId = parseInt(req.params.id);
      if (isNaN(slotId)) {
        sendRawJson(res, 400, { error: 'ID slot terapi tidak valid' });
        return;
      }
      
      console.log(`🔍 Raw endpoint mengambil data dasar slot ${slotId}`);
      const therapySlot = await storage.getTherapySlot(slotId);
      
      if (!therapySlot) {
        sendRawJson(res, 404, { error: 'Slot terapi tidak ditemukan' });
        return;
      }
      
      // Kembalikan hanya properti dasar
      const basicInfo = {
        id: therapySlot.id,
        date: therapySlot.date,
        timeSlot: therapySlot.timeSlot,
        maxQuota: therapySlot.maxQuota,
        currentCount: therapySlot.currentCount,
        isActive: therapySlot.isActive
      };
      
      sendRawJson(res, 200, basicInfo);
    } catch (error) {
      console.error('Error mendapatkan info dasar slot terapi:', error);
      sendRawJson(res, 500, { error: 'Gagal mengambil informasi slot terapi' });
    }
  });
  
  // Handler slot appointments
  app.get('/api/raw/slot/:id/appointments', async (req, res) => {
    try {
      const slotId = parseInt(req.params.id);
      if (isNaN(slotId)) {
        sendRawJson(res, 400, { error: 'ID slot terapi tidak valid' });
        return;
      }
      
      console.log(`📅 Raw endpoint mengambil appointments untuk slot ${slotId}`);
      const appointments = await storage.getAppointmentsByTherapySlot(slotId);
      
      // Hanya kembalikan info penting saja
      const simplifiedAppointments = appointments.map(appointment => ({
        id: appointment.id,
        patientId: appointment.patientId,
        status: appointment.status,
        date: appointment.date,
        timeSlot: appointment.timeSlot
      }));
      
      sendRawJson(res, 200, simplifiedAppointments);
    } catch (error) {
      console.error('Error mendapatkan appointment slot terapi:', error);
      sendRawJson(res, 500, { error: 'Gagal mengambil data appointment' });
    }
  });
  
  // Handler slot patients
  app.get('/api/raw/slot/:id/patients', async (req, res) => {
    try {
      const slotId = parseInt(req.params.id);
      if (isNaN(slotId)) {
        sendRawJson(res, 400, { error: 'ID slot terapi tidak valid' });
        return;
      }
      
      console.log(`👥 Raw endpoint mengambil data pasien untuk slot ${slotId}`);
      const appointments = await storage.getAppointmentsByTherapySlot(slotId);
      
      // Lakukan fetch untuk semua pasien
      const patients = [];
      for (const appointment of appointments) {
        if (appointment.patientId) {
          const patient = await storage.getPatient(appointment.patientId);
          if (patient) {
            // Tambahkan status appointment ke data pasien
            const patientWithStatus = {
              ...patient,
              appointmentStatus: appointment.status,
              appointmentId: appointment.id,
              walkin: appointment.status === 'Active',
            };
            patients.push(patientWithStatus);
          }
        }
      }
      
      sendRawJson(res, 200, patients);
    } catch (error) {
      console.error('Error mendapatkan data pasien slot terapi:', error);
      sendRawJson(res, 500, { error: 'Gagal mengambil data pasien' });
    }
  });
  
  console.log('Raw JSON endpoints terdaftar di /api/raw/*');
}

/**
 * Kirim respons JSON mentah tanpa melalui middleware Express
 * 
 * @param res HTTP response object
 * @param statusCode HTTP status code
 * @param data Data yang akan dikirim sebagai JSON
 */
function sendRawJson(res: http.ServerResponse, statusCode: number, data: any) {
  // Konversi data menjadi string JSON
  const jsonString = JSON.stringify(data);
  
  // Set header dengan tegas
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Tulis respons
  res.end(jsonString);
}