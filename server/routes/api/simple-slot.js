/**
 * API sederhana untuk endpoint slot terapi
 * Dirancang untuk performa maksimal dengan respons ringan dan cepat
 */

const { storage } = require('../../storage');
const { getWIBDate } = require('../../../wib-timezone-fixes');

/**
 * Mendapatkan informasi dasar slot terapi dengan ID tertentu
 * Tidak termasuk data pasien atau appointment untuk performa maksimal
 */
async function getBasicSlotInfo(req, res) {
  try {
    const slotId = parseInt(req.params.id);
    if (isNaN(slotId)) {
      return res.status(400).json({ error: 'ID slot terapi tidak valid' });
    }

    console.log(`🔍 Mengambil data dasar therapy slot ID: ${slotId}`);
    
    // Pastikan Content-Type diatur dengan benar untuk response JSON
    res.setHeader('Content-Type', 'application/json');
    
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
async function getSlotAppointments(req, res) {
  try {
    const slotId = parseInt(req.params.id);
    if (isNaN(slotId)) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: 'ID slot terapi tidak valid' });
    }
    
    console.log(`📅 Mengambil appointments untuk slot ${slotId}`);
    
    // Pastikan Content-Type diatur dengan benar untuk response JSON
    res.setHeader('Content-Type', 'application/json');
    
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
    
    // Gunakan cara lain untuk mengirim respons JSON untuk memastikan header terpasang
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(simplifiedAppointments));
  } catch (error) {
    console.error('Error mendapatkan appointment slot terapi:', error);
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ error: 'Gagal mengambil data appointment' });
  }
}

/**
 * Mendapatkan daftar pasien untuk slot terapi tertentu
 * Data ini mungkin berat dan lambat, jadi dipisahkan dari endpoint dasar
 */
async function getSlotPatients(req, res) {
  try {
    const slotId = parseInt(req.params.id);
    if (isNaN(slotId)) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: 'ID slot terapi tidak valid' });
    }
    
    console.log(`👥 Mengambil data pasien untuk slot ${slotId}`);
    
    // Pastikan Content-Type diatur dengan benar untuk response JSON
    res.setHeader('Content-Type', 'application/json');
    
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
    
    // Gunakan cara lain untuk mengirim respons JSON untuk memastikan header terpasang
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(patients));
  } catch (error) {
    console.error('Error mendapatkan data pasien slot terapi:', error);
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ error: 'Gagal mengambil data pasien' });
  }
}

module.exports = {
  getBasicSlotInfo,
  getSlotAppointments,
  getSlotPatients
};