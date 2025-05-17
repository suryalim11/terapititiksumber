/**
 * Aplikasi Express khusus untuk menangani endpoint simple-slot
 * yang memastikan response selalu JSON dengan header yang benar
 */

const express = require('express');
const bodyParser = require('body-parser');
const { storage } = require('./storage');

// Buat aplikasi Express terpisah
const app = express();

// Gunakan middleware JSON parser
app.use(bodyParser.json());

// Middleware untuk log
app.use((req, res, next) => {
  console.log(`Special JSON App request: ${req.method} ${req.url}`);
  next();
});

// Middleware untuk memastikan Content-Type JSON
app.use((req, res, next) => {
  // Ganti metode send() asli
  const originalSend = res.send;
  res.send = function(body) {
    // Pastikan Content-Type diatur ke application/json
    res.header('Content-Type', 'application/json');
    return originalSend.call(this, body);
  };
  
  next();
});

/**
 * GET /:id/basic - Mendapatkan informasi dasar slot terapi
 */
app.get('/:id/basic', async (req, res) => {
  try {
    const slotId = parseInt(req.params.id);
    if (isNaN(slotId)) {
      return res.status(400).send(JSON.stringify({ error: 'ID slot terapi tidak valid' }));
    }

    console.log(`🔍 Mengambil data dasar therapy slot ID: ${slotId}`);
    
    // Ambil data dasar slot terapi dari database
    const therapySlot = await storage.getTherapySlot(slotId);
    
    if (!therapySlot) {
      return res.status(404).send(JSON.stringify({ error: 'Slot terapi tidak ditemukan' }));
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
    
    return res.status(200).send(JSON.stringify(basicInfo));
  } catch (error) {
    console.error('Error mendapatkan info dasar slot terapi:', error);
    return res.status(500).send(JSON.stringify({ error: 'Gagal mengambil informasi slot terapi' }));
  }
});

/**
 * GET /:id/appointments - Mendapatkan appointments untuk slot terapi
 */
app.get('/:id/appointments', async (req, res) => {
  try {
    const slotId = parseInt(req.params.id);
    if (isNaN(slotId)) {
      return res.status(400).send(JSON.stringify({ error: 'ID slot terapi tidak valid' }));
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
    
    return res.status(200).send(JSON.stringify(simplifiedAppointments));
  } catch (error) {
    console.error('Error mendapatkan appointment slot terapi:', error);
    return res.status(500).send(JSON.stringify({ error: 'Gagal mengambil data appointment' }));
  }
});

/**
 * GET /:id/patients - Mendapatkan daftar pasien untuk slot terapi
 */
app.get('/:id/patients', async (req, res) => {
  try {
    const slotId = parseInt(req.params.id);
    if (isNaN(slotId)) {
      return res.status(400).send(JSON.stringify({ error: 'ID slot terapi tidak valid' }));
    }
    
    console.log(`👥 Mengambil data pasien untuk slot ${slotId}`);
    
    // Ambil appointment untuk slot terapi ini
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
    
    return res.status(200).send(JSON.stringify(patients));
  } catch (error) {
    console.error('Error mendapatkan data pasien slot terapi:', error);
    return res.status(500).send(JSON.stringify({ error: 'Gagal mengambil data pasien' }));
  }
});

module.exports = app;