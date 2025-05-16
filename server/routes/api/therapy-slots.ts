/**
 * API endpoint untuk manajemen slot terapi
 */
import { Express, Request, Response } from "express";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import { storage } from "../../storage";
import { z } from "zod";
import { insertTherapySlotSchema } from "@shared/schema";
import { getWIBDate, formatDateString } from "../../utils/date-utils";

/**
 * Mendaftarkan rute-rute untuk slot terapi
 */
export function setupTherapySlotsRoutes(app: Express) {
  // Mendapatkan semua slot terapi
  app.get("/api/therapy-slots", requireAuth, async (req: Request, res: Response) => {
    try {
      const therapySlots = await storage.getAllTherapySlots();
      res.json(therapySlots);
    } catch (error) {
      console.error("Error getting therapy slots:", error);
      res.status(500).json({ error: "Gagal mendapatkan daftar slot terapi" });
    }
  });

  // Mendapatkan slot terapi aktif
  app.get("/api/therapy-slots/active", requireAuth, async (req: Request, res: Response) => {
    try {
      const activeSlots = await storage.getActiveTherapySlots();
      res.json(activeSlots);
    } catch (error) {
      console.error("Error getting active therapy slots:", error);
      res.status(500).json({ error: "Gagal mendapatkan daftar slot terapi aktif" });
    }
  });

  // Mendapatkan slot terapi berdasarkan ID
  app.get("/api/therapy-slots/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const therapySlot = await storage.getTherapySlot(id);
      
      if (!therapySlot) {
        return res.status(404).json({ error: "Slot terapi tidak ditemukan" });
      }
      
      res.json(therapySlot);
    } catch (error) {
      console.error("Error getting therapy slot:", error);
      res.status(500).json({ error: "Gagal mendapatkan detail slot terapi" });
    }
  });

  // Mendapatkan slot terapi berdasarkan tanggal
  app.get("/api/therapy-slots/date/:date", requireAuth, async (req: Request, res: Response) => {
    try {
      const date = req.params.date;
      const therapySlots = await storage.getTherapySlotsByDate(date);
      res.json(therapySlots);
    } catch (error) {
      console.error("Error getting therapy slots by date:", error);
      res.status(500).json({ error: "Gagal mendapatkan slot terapi berdasarkan tanggal" });
    }
  });

  // Membuat slot terapi baru (hanya admin)
  app.post("/api/therapy-slots", requireAdmin, async (req: Request, res: Response) => {
    try {
      const slotData = insertTherapySlotSchema.parse(req.body);
      
      // Generate timeSlotKey jika belum ada
      if (!slotData.timeSlotKey && slotData.date && slotData.timeSlot) {
        slotData.timeSlotKey = `${slotData.date}_${slotData.timeSlot.replace(/\s+/g, '')}`;
      }
      
      // Pastikan nilai default
      if (slotData.currentCount === undefined) slotData.currentCount = 0;
      if (slotData.isActive === undefined) slotData.isActive = true;
      if (slotData.globalQuota === undefined) slotData.globalQuota = slotData.maxQuota || 10;
      
      const newSlot = await storage.createTherapySlot(slotData);
      
      res.status(201).json(newSlot);
    } catch (error) {
      console.error("Error creating therapy slot:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Data slot terapi tidak valid", details: error.errors });
      }
      
      res.status(500).json({ error: "Gagal membuat slot terapi baru" });
    }
  });

  // Memperbarui slot terapi (hanya admin)
  app.put("/api/therapy-slots/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const slotData = req.body;
      
      const existingSlot = await storage.getTherapySlot(id);
      
      if (!existingSlot) {
        return res.status(404).json({ error: "Slot terapi tidak ditemukan" });
      }
      
      // Regenerate timeSlotKey jika tanggal atau waktu diubah
      if ((slotData.date && slotData.date !== existingSlot.date) || 
          (slotData.timeSlot && slotData.timeSlot !== existingSlot.timeSlot)) {
        const date = slotData.date || existingSlot.date;
        const timeSlot = slotData.timeSlot || existingSlot.timeSlot;
        slotData.timeSlotKey = `${date}_${timeSlot.replace(/\s+/g, '')}`;
      }
      
      const updatedSlot = await storage.updateTherapySlot(id, slotData);
      
      res.json(updatedSlot);
    } catch (error) {
      console.error("Error updating therapy slot:", error);
      res.status(500).json({ error: "Gagal memperbarui slot terapi" });
    }
  });

  // Menambah penggunaan slot terapi
  app.post("/api/therapy-slots/:id/increment", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const existingSlot = await storage.getTherapySlot(id);
      
      if (!existingSlot) {
        return res.status(404).json({ error: "Slot terapi tidak ditemukan" });
      }
      
      const updatedSlot = await storage.incrementTherapySlotUsage(id);
      
      res.json(updatedSlot);
    } catch (error) {
      console.error("Error incrementing therapy slot usage:", error);
      res.status(500).json({ error: "Gagal menambah penggunaan slot terapi" });
    }
  });

  // Mengurangi penggunaan slot terapi
  app.post("/api/therapy-slots/:id/decrement", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const existingSlot = await storage.getTherapySlot(id);
      
      if (!existingSlot) {
        return res.status(404).json({ error: "Slot terapi tidak ditemukan" });
      }
      
      const updatedSlot = await storage.decrementTherapySlotUsage(id);
      
      res.json(updatedSlot);
    } catch (error) {
      console.error("Error decrementing therapy slot usage:", error);
      res.status(500).json({ error: "Gagal mengurangi penggunaan slot terapi" });
    }
  });

  // Menonaktifkan slot terapi (hanya admin)
  app.patch("/api/therapy-slots/:id/deactivate", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deactivateTherapySlot(id);
      
      if (!success) {
        return res.status(404).json({ error: "Slot terapi tidak ditemukan atau gagal dinonaktifkan" });
      }
      
      res.json({ success: true, message: "Slot terapi berhasil dinonaktifkan" });
    } catch (error) {
      console.error("Error deactivating therapy slot:", error);
      res.status(500).json({ error: "Gagal menonaktifkan slot terapi" });
    }
  });

  // Menghapus slot terapi (hanya admin)
  app.delete("/api/therapy-slots/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Periksa apakah slot digunakan oleh appointment
      const appointments = await storage.getAppointmentsByTherapySlot(id);
      
      if (appointments.length > 0) {
        return res.status(400).json({ 
          error: "Slot terapi tidak dapat dihapus karena sedang digunakan oleh appointment",
          appointmentCount: appointments.length
        });
      }
      
      const success = await storage.deleteTherapySlot(id);
      
      if (!success) {
        return res.status(404).json({ error: "Slot terapi tidak ditemukan atau gagal dihapus" });
      }
      
      res.json({ success: true, message: "Slot terapi berhasil dihapus" });
    } catch (error) {
      console.error("Error deleting therapy slot:", error);
      res.status(500).json({ error: "Gagal menghapus slot terapi" });
    }
  });

  // Sinkronisasi kuota slot terapi
  app.post("/api/therapy-slots/sync-quota", requireAdmin, async (req: Request, res: Response) => {
    try {
      const result = await storage.syncTherapySlotQuota();
      res.json({
        success: true,
        message: `Berhasil menyinkronkan ${result.updatedSlots} slot terapi`,
        details: result.results
      });
    } catch (error) {
      console.error("Error syncing therapy slot quota:", error);
      res.status(500).json({ error: "Gagal menyinkronkan kuota slot terapi" });
    }
  });

  // Mendapatkan status slot terapi (untuk verifikasi)
  app.get("/api/therapy-slots/:id/status", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const therapySlot = await storage.getTherapySlot(id);
      
      if (!therapySlot) {
        return res.status(404).json({ error: "Slot terapi tidak ditemukan" });
      }
      
      // Mendapatkan jumlah appointment untuk slot ini
      const appointments = await storage.getAppointmentsByTherapySlot(id);
      
      // Menghitung status kuota
      const maxQuota = therapySlot.maxQuota || 0;
      const currentUsage = appointments.length;
      const isAvailable = therapySlot.isActive && currentUsage < maxQuota;
      const remainingQuota = Math.max(0, maxQuota - currentUsage);
      
      res.json({
        id: therapySlot.id,
        date: therapySlot.date,
        timeSlot: therapySlot.timeSlot,
        maxQuota,
        currentUsage,
        remainingQuota,
        isActive: therapySlot.isActive,
        isAvailable,
        appointments: appointments.length
      });
    } catch (error) {
      console.error("Error getting therapy slot status:", error);
      res.status(500).json({ error: "Gagal mendapatkan status slot terapi" });
    }
  });
}