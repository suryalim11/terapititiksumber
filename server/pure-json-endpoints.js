/**
 * Modul untuk menangani endpoint JSON sederhana yang DIJAMIN mengembalikan JSON
 * Menggunakan respons murni dengan Content-Type yang tepat
 */

const { storage } = require('./storage');

// Fungsi handler untuk diimplementasikan secara terpisah dari Express
// untuk menghindari masalah dengan middleware

exports.handleSimpleSlotBasic = async (req, res) => {
  // Pastikan respons adalah JSON dengan manual setting headers
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff'
  });

  try {
    const slotId = parseInt(req.params.id);
    if (isNaN(slotId)) {
      return res.end(JSON.stringify({ error: 'ID slot terapi tidak valid' }));
    }

    console.log(`🔍 Pure handler mengambil data dasar therapy slot ID: ${slotId}`);
    
    // Ambil data dasar slot terapi dari database
    const therapySlot = await storage.getTherapySlot(slotId);
    
    if (!therapySlot) {
      return res.end(JSON.stringify({ error: 'Slot terapi tidak ditemukan' }));
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
    
    return res.end(JSON.stringify(basicInfo));
  } catch (error) {
    console.error('Error mendapatkan info dasar slot terapi:', error);
    return res.end(JSON.stringify({ error: 'Gagal mengambil informasi slot terapi' }));
  }
};

exports.handleSimpleSlotAppointments = async (req, res) => {
  // Pastikan respons adalah JSON dengan manual setting headers
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff'
  });

  try {
    const slotId = parseInt(req.params.id);
    if (isNaN(slotId)) {
      return res.end(JSON.stringify({ error: 'ID slot terapi tidak valid' }));
    }
    
    console.log(`📅 Pure handler mengambil appointments untuk slot ${slotId}`);
    
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
    
    return res.end(JSON.stringify(simplifiedAppointments));
  } catch (error) {
    console.error('Error mendapatkan appointment slot terapi:', error);
    return res.end(JSON.stringify({ error: 'Gagal mengambil data appointment' }));
  }
};

exports.handleSimpleSlotPatients = async (req, res) => {
  // Pastikan respons adalah JSON dengan manual setting headers
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff'
  });

  try {
    const slotId = parseInt(req.params.id);
    if (isNaN(slotId)) {
      return res.end(JSON.stringify({ error: 'ID slot terapi tidak valid' }));
    }
    
    console.log(`👥 Pure handler mengambil data pasien untuk slot ${slotId}`);
    
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
    
    return res.end(JSON.stringify(patients));
  } catch (error) {
    console.error('Error mendapatkan data pasien slot terapi:', error);
    return res.end(JSON.stringify({ error: 'Gagal mengambil data pasien' }));
  }
};