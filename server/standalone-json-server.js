/**
 * Server HTTP terpisah untuk menangani endpoint JSON murni
 * Berjalan di port 3001 - untuk diakses melalui proxy di frontend
 */
const http = require('http');
const url = require('url');
const { storage } = require('./storage');

// Daftar handler untuk berbagai endpoint
const routes = {
  // Handler untuk mendapatkan info dasar slot
  'GET /slot/basic/:id': async (req, res, params) => {
    try {
      const slotId = parseInt(params.id);
      if (isNaN(slotId)) {
        return sendJsonResponse(res, 400, { error: 'ID slot terapi tidak valid' });
      }
      
      console.log(`🔍 Standalone JSON server: mengambil data dasar slot ${slotId}`);
      const therapySlot = await storage.getTherapySlot(slotId);
      
      if (!therapySlot) {
        return sendJsonResponse(res, 404, { error: 'Slot terapi tidak ditemukan' });
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
      
      return sendJsonResponse(res, 200, basicInfo);
    } catch (error) {
      console.error('Error mendapatkan info dasar slot terapi:', error);
      return sendJsonResponse(res, 500, { error: 'Gagal mengambil informasi slot terapi' });
    }
  },
  
  // Handler untuk mendapatkan appointments slot
  'GET /slot/appointments/:id': async (req, res, params) => {
    try {
      const slotId = parseInt(params.id);
      if (isNaN(slotId)) {
        return sendJsonResponse(res, 400, { error: 'ID slot terapi tidak valid' });
      }
      
      console.log(`📅 Standalone JSON server: mengambil appointments untuk slot ${slotId}`);
      const appointments = await storage.getAppointmentsByTherapySlot(slotId);
      
      // Hanya kembalikan info penting saja untuk respons ringan
      const simplifiedAppointments = appointments.map(appointment => ({
        id: appointment.id,
        patientId: appointment.patientId,
        status: appointment.status,
        date: appointment.date,
        timeSlot: appointment.timeSlot
      }));
      
      return sendJsonResponse(res, 200, simplifiedAppointments);
    } catch (error) {
      console.error('Error mendapatkan appointment slot terapi:', error);
      return sendJsonResponse(res, 500, { error: 'Gagal mengambil data appointment' });
    }
  },
  
  // Handler untuk mendapatkan patients slot
  'GET /slot/patients/:id': async (req, res, params) => {
    try {
      const slotId = parseInt(params.id);
      if (isNaN(slotId)) {
        return sendJsonResponse(res, 400, { error: 'ID slot terapi tidak valid' });
      }
      
      console.log(`👥 Standalone JSON server: mengambil data pasien untuk slot ${slotId}`);
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
      
      return sendJsonResponse(res, 200, patients);
    } catch (error) {
      console.error('Error mendapatkan data pasien slot terapi:', error);
      return sendJsonResponse(res, 500, { error: 'Gagal mengambil data pasien' });
    }
  }
};

/**
 * Fungsi untuk mengirim respons JSON
 * 
 * @param {http.ServerResponse} res Objek respons HTTP
 * @param {number} statusCode Kode status HTTP
 * @param {object} data Data yang akan dikirim sebagai JSON
 */
function sendJsonResponse(res, statusCode, data) {
  const jsonData = JSON.stringify(data);
  
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(jsonData),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'X-Content-Type-Options': 'nosniff'
  });
  
  res.end(jsonData);
}

/**
 * Fungsi untuk mem-parsing url dan mencocokkan dengan pola rute
 * 
 * @param {string} pattern Pola rute
 * @param {string} path Path url yang sebenarnya
 * @returns {object|null} Parameter yang di-extract atau null jika tidak cocok
 */
function matchRoute(pattern, path) {
  // Split pattern into segments, ignoring the HTTP method
  const patternSegments = pattern.split(' ')[1].split('/').slice(1);
  const pathSegments = path.split('/').slice(1);
  
  if (patternSegments.length !== pathSegments.length) {
    return null;
  }
  
  const params = {};
  
  for (let i = 0; i < patternSegments.length; i++) {
    const patternSegment = patternSegments[i];
    const pathSegment = pathSegments[i];
    
    if (patternSegment.startsWith(':')) {
      // This is a parameter
      const paramName = patternSegment.slice(1);
      params[paramName] = pathSegment;
    } else if (patternSegment !== pathSegment) {
      // Non-parameter segments should match exactly
      return null;
    }
  }
  
  return params;
}

// Buat server HTTP
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;
  
  // Handle preflight requests
  if (method === 'OPTIONS') {
    sendJsonResponse(res, 200, {});
    return;
  }
  
  console.log(`[Standalone JSON Server] ${method} ${path}`);
  
  // Coba menemukan handler yang cocok untuk request
  let matchedHandler = null;
  let matchedParams = null;
  
  for (const pattern in routes) {
    const [patternMethod, patternPath] = pattern.split(' ');
    
    if (patternMethod === method) {
      const params = matchRoute(pattern, path);
      if (params) {
        matchedHandler = routes[pattern];
        matchedParams = params;
        break;
      }
    }
  }
  
  if (matchedHandler) {
    // Handler ditemukan, jalankan
    try {
      await matchedHandler(req, res, matchedParams);
    } catch (error) {
      console.error('Error mengeksekusi handler:', error);
      sendJsonResponse(res, 500, { error: 'Server error' });
    }
  } else {
    // Tidak ada handler yang cocok, kembalikan 404
    sendJsonResponse(res, 404, { error: 'Endpoint tidak ditemukan' });
  }
});

// Ekspor fungsi untuk menjalankan server
exports.startJsonServer = (port = 3001) => {
  server.listen(port, () => {
    console.log(`Standalone JSON Server berjalan di port ${port}`);
  });
  
  return server;
};