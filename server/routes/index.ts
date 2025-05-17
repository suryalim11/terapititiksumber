/**
 * File utama untuk setup rute API
 */
import { Express } from "express";
import { setupAppointmentRoutes } from "./api/appointments";
import { setupTherapySlotsRoutes } from "./api/therapy-slots";
import { setupPatientRoutes } from "./api/patients";
import { setupAuthRoutes } from "./api/auth";
import { setupUserRoutes } from "./api/users";
import { setupRegistrationLinkRoutes } from "./api/registration-links";
import { setupDashboardRoutes } from "./api/dashboard";
import { storage } from "../storage";

/**
 * Setup semua rute API dan middleware
 * @param app Express app instance
 */
export function setupRoutes(app: Express) {
  // Setup rute untuk setiap domain aplikasi
  setupAuthRoutes(app);
  setupUserRoutes(app);
  
  // Daftarkan endpoint untuk simple-slot API
  app.get('/api/simple-slot/:id/basic', async (req, res) => {
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
  });
  setupPatientRoutes(app);
  setupTherapySlotsRoutes(app);
  setupAppointmentRoutes(app);
  setupRegistrationLinkRoutes(app);
  setupDashboardRoutes(app);
  
  // Add API ping/health check endpoint
  app.get('/api/ping', (req, res) => {
    res.status(200).json({ 
      status: 'ok', 
      time: new Date().toISOString(),
      message: 'Server berjalan dengan baik'
    });
  });
}