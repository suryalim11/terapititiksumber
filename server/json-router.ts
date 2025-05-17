/**
 * Router khusus untuk endpoint JSON
 * Menggunakan TypeScript dan pendekatan ESModule
 */
import express, { Router, Request, Response } from 'express';
import { storage } from './storage';

// Buat router Express khusus
const jsonRouter = Router();

// Middleware yang memastikan Content-Type selalu application/json
jsonRouter.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function(body) {
    // Set headers yang kuat untuk memastikan browser memperlakukan respons sebagai JSON
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return originalJson.call(this, body);
  };
  
  // Pastikan header dipertahankan
  res.once('finish', () => {
    // Tidak perlu tambahan di sini karena headers sudah diatur
  });
  
  next();
});

// Endpoint untuk info dasar slot terapi
jsonRouter.get('/slot/:id/basic', async (req: Request, res: Response) => {
  try {
    const slotId = parseInt(req.params.id);
    if (isNaN(slotId)) {
      return res.status(400).json({ error: 'ID slot terapi tidak valid' });
    }
    
    console.log(`🔍 JSON Router: mengambil data dasar slot ${slotId}`);
    const therapySlot = await storage.getTherapySlot(slotId);
    
    if (!therapySlot) {
      return res.status(404).json({ error: 'Slot terapi tidak ditemukan' });
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
    
    // Override headers dan kirim respons
    res.setHeader('Content-Type', 'application/json');
    return res.json(basicInfo);
  } catch (error) {
    console.error('Error mendapatkan info dasar slot terapi:', error);
    return res.status(500).json({ error: 'Gagal mengambil informasi slot terapi' });
  }
});

// Endpoint untuk appointments slot terapi
jsonRouter.get('/slot/:id/appointments', async (req: Request, res: Response) => {
  try {
    const slotId = parseInt(req.params.id);
    if (isNaN(slotId)) {
      return res.status(400).json({ error: 'ID slot terapi tidak valid' });
    }
    
    console.log(`📅 JSON Router: mengambil appointments untuk slot ${slotId}`);
    const appointments = await storage.getAppointmentsByTherapySlot(slotId);
    
    // Hanya kembalikan info penting saja
    const simplifiedAppointments = appointments.map(appointment => ({
      id: appointment.id,
      patientId: appointment.patientId,
      status: appointment.status,
      date: appointment.date,
      timeSlot: appointment.timeSlot
    }));
    
    // Override headers dan kirim respons
    res.setHeader('Content-Type', 'application/json');
    return res.json(simplifiedAppointments);
  } catch (error) {
    console.error('Error mendapatkan appointment slot terapi:', error);
    return res.status(500).json({ error: 'Gagal mengambil data appointment' });
  }
});

// Endpoint untuk patients slot terapi
jsonRouter.get('/slot/:id/patients', async (req: Request, res: Response) => {
  try {
    const slotId = parseInt(req.params.id);
    if (isNaN(slotId)) {
      return res.status(400).json({ error: 'ID slot terapi tidak valid' });
    }
    
    console.log(`👥 JSON Router: mengambil data pasien untuk slot ${slotId}`);
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
    
    // Override headers dan kirim respons
    res.setHeader('Content-Type', 'application/json');
    return res.json(patients);
  } catch (error) {
    console.error('Error mendapatkan data pasien slot terapi:', error);
    return res.status(500).json({ error: 'Gagal mengambil data pasien' });
  }
});

export default jsonRouter;