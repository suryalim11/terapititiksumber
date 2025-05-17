/**
 * Endpoint API langsung tanpa middleware yang dapat mengintervensi Content-Type
 */

const http = require('http');
const url = require('url');
const { storage } = require('./storage');

/**
 * Fungsi untuk menangani request endpoint API secara langsung
 * 
 * @param {http.IncomingMessage} req Request object
 * @param {http.ServerResponse} res Response object 
 */
function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  
  console.log(`Direct endpoint request: ${req.method} ${path}`);
  
  // Route handler untuk slot basic info
  if (path.match(/^\/api\/direct\/simple-slot\/(\d+)\/basic$/)) {
    const slotId = parseInt(path.split('/')[4]);
    return handleSlotBasic(slotId, res);
  }
  
  // Route handler untuk slot appointments
  if (path.match(/^\/api\/direct\/simple-slot\/(\d+)\/appointments$/)) {
    const slotId = parseInt(path.split('/')[4]);
    return handleSlotAppointments(slotId, res);
  }
  
  // Route handler untuk slot patients
  if (path.match(/^\/api\/direct\/simple-slot\/(\d+)\/patients$/)) {
    const slotId = parseInt(path.split('/')[4]);
    return handleSlotPatients(slotId, res);
  }
  
  // Default case: 404 Not Found
  res.writeHead(404, {
    'Content-Type': 'application/json'
  });
  res.end(JSON.stringify({ error: 'Not Found' }));
}

/**
 * Handle slot basic info
 * 
 * @param {number} slotId Slot ID
 * @param {http.ServerResponse} res Response object
 */
async function handleSlotBasic(slotId, res) {
  try {
    if (isNaN(slotId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'ID slot terapi tidak valid' }));
    }

    console.log(`🔍 Direct endpoint mengambil data dasar slot ${slotId}`);
    
    // Ambil data dasar slot terapi dari database
    const therapySlot = await storage.getTherapySlot(slotId);
    
    if (!therapySlot) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
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
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(basicInfo));
  } catch (error) {
    console.error('Error mendapatkan info dasar slot terapi:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Gagal mengambil informasi slot terapi' }));
  }
}

/**
 * Handle slot appointments
 * 
 * @param {number} slotId Slot ID
 * @param {http.ServerResponse} res Response object
 */
async function handleSlotAppointments(slotId, res) {
  try {
    if (isNaN(slotId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'ID slot terapi tidak valid' }));
    }
    
    console.log(`📅 Direct endpoint mengambil appointments untuk slot ${slotId}`);
    
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
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(simplifiedAppointments));
  } catch (error) {
    console.error('Error mendapatkan appointment slot terapi:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Gagal mengambil data appointment' }));
  }
}

/**
 * Handle slot patients
 * 
 * @param {number} slotId Slot ID
 * @param {http.ServerResponse} res Response object
 */
async function handleSlotPatients(slotId, res) {
  try {
    if (isNaN(slotId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'ID slot terapi tidak valid' }));
    }
    
    console.log(`👥 Direct endpoint mengambil data pasien untuk slot ${slotId}`);
    
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
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(patients));
  } catch (error) {
    console.error('Error mendapatkan data pasien slot terapi:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Gagal mengambil data pasien' }));
  }
}

// Direct HTTP server
const directServer = http.createServer(handleRequest);

module.exports = { directServer, handleRequest };