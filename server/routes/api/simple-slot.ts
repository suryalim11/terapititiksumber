/**
 * API endpoint sederhana dan cepat untuk mendapatkan data slot terapi
 * Dirancang untuk performa maksimal dan ukuran payload minimal
 */
import { Express, Request, Response } from "express";
import { storage } from "../../storage";
import { requireAuth } from "../../middleware/auth";

// Memory cache untuk menyimpan data sementara
const SIMPLE_CACHE: Record<string, any> = {};

/**
 * Setup rute-rute untuk akses cepat slot terapi
 */
export function setupSimpleSlotRoutes(app: Express) {
  // Endpoint untuk mendapatkan data dasar slot terapi (Sangat Cepat)
  app.get("/api/simple-slot/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const startTime = Date.now();
      const slotId = parseInt(req.params.id);
      const cacheBuster = req.query._t || Date.now();
      
      // Nama kunci cache
      const cacheKey = `simple_slot_${slotId}_${cacheBuster}`;
      
      // Periksa coba ada di cache (30 detik)
      if (SIMPLE_CACHE[cacheKey] && (Date.now() - SIMPLE_CACHE[cacheKey].timestamp) < 30000) {
        console.log(`🔥 Cache hit untuk simple-slot/${slotId}`);
        
        // Set header cache
        res.set('Cache-Control', 'private, max-age=30');
        
        return res.status(200).json({
          success: true,
          data: SIMPLE_CACHE[cacheKey].data,
          fromCache: true,
          responseTime: Date.now() - startTime
        });
      }
      
      // Ambil data slot terapi
      const therapySlot = await storage.getTherapySlot(slotId);
      
      if (!therapySlot) {
        return res.status(404).json({
          success: false,
          message: "Slot terapi tidak ditemukan"
        });
      }
      
      // Hitung jumlah pasien terdaftar
      const appointments = await storage.getAppointmentsByTherapySlot(slotId);
      
      // Data minimal yang dibutuhkan
      const simpleData = {
        id: therapySlot.id,
        date: therapySlot.date,
        timeSlot: therapySlot.timeSlot,
        maxQuota: therapySlot.maxQuota,
        currentCount: therapySlot.currentCount,
        isActive: therapySlot.isActive,
        patientCount: appointments.length,
        statusCounts: appointments.reduce((acc, a) => {
          acc[a.status] = (acc[a.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      };
      
      // Simpan di cache
      SIMPLE_CACHE[cacheKey] = {
        timestamp: Date.now(),
        data: simpleData
      };
      
      // Set header cache
      res.set('Cache-Control', 'private, max-age=30');
      
      const responseTime = Date.now() - startTime;
      console.log(`✅ Simple-slot/${slotId} loaded in ${responseTime}ms`);
      
      return res.status(200).json({
        success: true,
        data: simpleData,
        fromCache: false,
        responseTime
      });
    } catch (error) {
      console.error(`❌ Error getting simple slot ${req.params.id}:`, error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error 
          ? error.message 
          : "Terjadi kesalahan saat mengambil data slot terapi"
      });
    }
  });

  // Endpoint untuk mendapatkan hanya daftar pasien dari slot terapi (tanpa data slot)
  app.get("/api/simple-slot/:id/patients", requireAuth, async (req: Request, res: Response) => {
    try {
      const startTime = Date.now();
      const slotId = parseInt(req.params.id);
      
      // Ambil data appointment saja
      const appointments = await storage.getAppointmentsByTherapySlot(slotId);
      
      // Data minimal yang dibutuhkan
      const simpleAppointments = appointments.map(a => ({
        id: a.id,
        patientId: a.patientId,
        status: a.status
      }));
      
      const responseTime = Date.now() - startTime;
      console.log(`✅ Simple-slot/${slotId}/patients loaded in ${responseTime}ms`);
      
      return res.status(200).json({
        success: true,
        data: simpleAppointments,
        count: simpleAppointments.length,
        responseTime
      });
    } catch (error) {
      console.error(`❌ Error getting patients for simple slot ${req.params.id}:`, error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error 
          ? error.message 
          : "Terjadi kesalahan saat mengambil data pasien slot terapi"
      });
    }
  });
}