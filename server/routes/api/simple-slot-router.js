/**
 * Router Express terpisah untuk endpoint simple-slot
 * Ini memastikan kita memiliki kontrol penuh atas Content-Type headers
 */

const express = require('express');
const { storage } = require('../../storage');

// Buat router terpisah
const router = express.Router();

/**
 * Middleware khusus untuk memastikan Content-Type adalah application/json
 */
const forceJsonContentType = (req, res, next) => {
  res.header('Content-Type', 'application/json');
  next();
};

// Terapkan middleware di semua endpoint router ini
router.use(forceJsonContentType);

/**
 * GET /api/simple-slot/:id/basic
 * Mendapatkan informasi dasar slot terapi dengan ID tertentu
 */
router.get('/:id/basic', async (req, res) => {
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
 * GET /api/simple-slot/:id/appointments
 * Mendapatkan daftar appointment untuk slot terapi tertentu
 */
router.get('/:id/appointments', async (req, res) => {
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
 * GET /api/simple-slot/:id/patients
 * Mendapatkan daftar pasien untuk slot terapi tertentu
 */
router.get('/:id/patients', async (req, res) => {
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

module.exports = router;