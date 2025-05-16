/**
 * API endpoint untuk manajemen slot terapi
 */
import { Express, Request, Response } from "express";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import { storage } from "../../storage";
import { z } from "zod";
import { insertTherapySlotSchema } from "@shared/schema";
import { getWIBDate } from "../../utils/date-utils";

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
      res.status(500).json({ error: "Gagal mendapatkan data slot terapi" });
    }
  });

  // Mendapatkan slot terapi berdasarkan tanggal
  app.get("/api/therapy-slots/date/:date", requireAuth, async (req: Request, res: Response) => {
    try {
      const date = req.params.date;
      
      if (!date) {
        return res.status(400).json({ 
          success: false, 
          message: "Parameter tanggal diperlukan" 
        });
      }
      
      // Konversi string ke tanggal jika diperlukan
      let dateInput: Date | string = date;
      if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
        dateInput = new Date(date);
      }
      
      const therapySlots = await storage.getTherapySlotsByDate(dateInput);
      
      return res.status(200).json({
        success: true,
        therapySlots
      });
    } catch (error) {
      console.error("Error getting therapy slots by date:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat mengambil data slot terapi" 
      });
    }
  });

  // Membuat slot terapi baru
  app.post("/api/therapy-slots", requireAdmin, async (req: Request, res: Response) => {
    try {
      const therapySlotData = insertTherapySlotSchema.parse(req.body);
      
      // Pastikan format date adalah string (YYYY-MM-DD)
      if (therapySlotData.date instanceof Date) {
        therapySlotData.date = therapySlotData.date.toISOString().split('T')[0];
      }
      
      // Buat timeSlotKey (kombinasi date dan timeSlot)
      therapySlotData.timeSlotKey = `${therapySlotData.date}_${therapySlotData.timeSlot}`;
      
      // Periksa apakah slot terapi dengan date dan timeSlot yang sama sudah ada
      const existingSlots = await storage.getTherapySlotsByDate(therapySlotData.date);
      const existingSlot = existingSlots.find(slot => slot.timeSlot === therapySlotData.timeSlot);
      
      if (existingSlot) {
        return res.status(409).json({ 
          success: false, 
          message: "Slot terapi dengan tanggal dan waktu yang sama sudah ada" 
        });
      }
      
      // Buat slot terapi baru
      const newTherapySlot = await storage.createTherapySlot(therapySlotData);
      
      return res.status(201).json({
        success: true,
        therapySlot: newTherapySlot,
        message: "Slot terapi berhasil dibuat"
      });
    } catch (error) {
      console.error("Error creating therapy slot:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false, 
          message: "Data slot terapi tidak valid", 
          details: error.errors 
        });
      }
      
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat membuat slot terapi baru" 
      });
    }
  });

  // Memperbarui slot terapi
  app.put("/api/therapy-slots/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const therapySlotData = req.body;
      
      // Dapatkan slot terapi yang ada
      const existingTherapySlot = await storage.getTherapySlot(id);
      
      if (!existingTherapySlot) {
        return res.status(404).json({ 
          success: false, 
          message: "Slot terapi tidak ditemukan" 
        });
      }
      
      // Periksa apakah tanggal atau waktu diubah
      if ((therapySlotData.date && therapySlotData.date !== existingTherapySlot.date) || 
          (therapySlotData.timeSlot && therapySlotData.timeSlot !== existingTherapySlot.timeSlot)) {
        
        // Perbarui timeSlotKey
        const date = therapySlotData.date || existingTherapySlot.date;
        const timeSlot = therapySlotData.timeSlot || existingTherapySlot.timeSlot;
        therapySlotData.timeSlotKey = `${date}_${timeSlot}`;
        
        // Periksa apakah slot terapi dengan date dan timeSlot yang sama sudah ada
        const existingSlots = await storage.getTherapySlotsByDate(date);
        const existingSlot = existingSlots.find(slot => 
          slot.timeSlot === timeSlot && slot.id !== id
        );
        
        if (existingSlot) {
          return res.status(409).json({ 
            success: false, 
            message: "Slot terapi dengan tanggal dan waktu yang sama sudah ada" 
          });
        }
      }
      
      // Perbarui slot terapi
      const updatedTherapySlot = await storage.updateTherapySlot(id, therapySlotData);
      
      if (!updatedTherapySlot) {
        return res.status(500).json({ 
          success: false, 
          message: "Gagal memperbarui data slot terapi" 
        });
      }
      
      return res.status(200).json({
        success: true,
        therapySlot: updatedTherapySlot,
        message: "Data slot terapi berhasil diperbarui"
      });
    } catch (error) {
      console.error("Error updating therapy slot:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false, 
          message: "Data slot terapi tidak valid", 
          details: error.errors 
        });
      }
      
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat memperbarui data slot terapi" 
      });
    }
  });

  // Menonaktifkan slot terapi
  app.patch("/api/therapy-slots/:id/deactivate", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Dapatkan slot terapi yang ada
      const existingTherapySlot = await storage.getTherapySlot(id);
      
      if (!existingTherapySlot) {
        return res.status(404).json({ 
          success: false, 
          message: "Slot terapi tidak ditemukan" 
        });
      }
      
      // Nonaktifkan slot terapi
      const success = await storage.deactivateTherapySlot(id);
      
      if (!success) {
        return res.status(500).json({ 
          success: false, 
          message: "Gagal menonaktifkan slot terapi" 
        });
      }
      
      return res.status(200).json({
        success: true,
        message: "Slot terapi berhasil dinonaktifkan"
      });
    } catch (error) {
      console.error("Error deactivating therapy slot:", error);
      
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat menonaktifkan slot terapi" 
      });
    }
  });

  // Menghapus slot terapi
  app.delete("/api/therapy-slots/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Dapatkan slot terapi yang akan dihapus
      const therapySlot = await storage.getTherapySlot(id);
      
      if (!therapySlot) {
        return res.status(404).json({ 
          success: false, 
          message: "Slot terapi tidak ditemukan" 
        });
      }
      
      // Periksa apakah slot terapi memiliki appointment
      const appointments = await storage.getAppointmentsByTherapySlot(id);
      
      if (appointments.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: "Slot terapi tidak dapat dihapus karena memiliki appointment" 
        });
      }
      
      // Hapus slot terapi
      const success = await storage.deleteTherapySlot(id);
      
      if (!success) {
        return res.status(500).json({ 
          success: false, 
          message: "Gagal menghapus slot terapi" 
        });
      }
      
      return res.status(200).json({
        success: true,
        message: "Slot terapi berhasil dihapus"
      });
    } catch (error) {
      console.error("Error deleting therapy slot:", error);
      
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat menghapus slot terapi" 
      });
    }
  });

  // Mendapatkan jumlah pasien aktual dalam slot terapi
  app.get("/api/therapy-slots/:id/count", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Dapatkan slot terapi
      const therapySlot = await storage.getTherapySlot(id);
      
      if (!therapySlot) {
        return res.status(404).json({ 
          success: false, 
          message: "Slot terapi tidak ditemukan" 
        });
      }
      
      // Dapatkan appointment untuk slot terapi
      const appointments = await storage.getAppointmentsByTherapySlot(id);
      
      // Filter berdasarkan status tertentu
      const activeAppointments = appointments.filter(app => 
        app.status === 'Active' || app.status === 'Confirmed'
      );
      
      return res.status(200).json({
        success: true,
        therapySlotId: id,
        date: therapySlot.date,
        timeSlot: therapySlot.timeSlot,
        maxQuota: therapySlot.maxQuota,
        currentCount: therapySlot.currentCount,
        actualCount: activeAppointments.length,
        appointments: activeAppointments
      });
    } catch (error) {
      console.error("Error getting therapy slot count:", error);
      
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat mengambil jumlah pasien dalam slot terapi" 
      });
    }
  });

  // Mendapatkan semua pasien dalam slot terapi
  // Catatan: Endpoint ini hanya stub yang mengarahkan ke implementasi optimized di server/routes.ts
  // Ini mencegah masalah race condition dimana ada dua endpoint yang menangani hal yang sama
  app.get("/api/therapy-slots/:id/patients", requireAuth, async (req: Request, res: Response) => {
    // Redirect ke endpoint optimized di server/routes.ts
    res.redirect(307, `/api/therapy-slots/${req.params.id}/patients`);
  });

  // Mendaftarkan pasien ke slot terapi (walk-in registration)
  app.post("/api/therapy-slots/:id/patients", requireAuth, async (req: Request, res: Response) => {
    try {
      const slotId = parseInt(req.params.id);
      const { patientId, notes } = req.body;
      
      if (!patientId) {
        return res.status(400).json({
          success: false,
          message: "ID pasien diperlukan"
        });
      }
      
      // Dapatkan slot terapi
      const therapySlot = await storage.getTherapySlot(slotId);
      
      if (!therapySlot) {
        return res.status(404).json({ 
          success: false, 
          message: "Slot terapi tidak ditemukan" 
        });
      }
      
      // Dapatkan pasien
      const patient = await storage.getPatient(patientId);
      
      if (!patient) {
        return res.status(404).json({ 
          success: false, 
          message: "Pasien tidak ditemukan" 
        });
      }
      
      // Periksa apakah pasien sudah terdaftar di slot ini
      const appointments = await storage.getAppointmentsByTherapySlot(slotId);
      const existingAppointment = appointments.find(app => app.patientId === patientId);
      
      if (existingAppointment) {
        return res.status(409).json({ 
          success: false, 
          message: "Pasien sudah terdaftar di slot terapi ini",
          appointmentId: existingAppointment.id
        });
      }
      
      // Untuk registrasi walk-in, kita tidak perlu memeriksa kuota
      // Langsung buat appointment dengan status 'Active'
      // Gunakan format registrasi sesuai database
      const registrationNumber = `WLK-${Math.floor(1000 + Math.random() * 9000)}-${new Date().getTime().toString().slice(-4)}`;
      const appointmentData = {
        patientId,
        therapySlotId: slotId,
        date: typeof therapySlot.date === 'string' ? therapySlot.date : new Date(therapySlot.date).toISOString(),
        timeSlot: therapySlot.timeSlot,
        status: 'Active', // Walk-in langsung active
        registrationNumber,
        notes: notes || `Walk-in registration pada ${new Date().toISOString()}`
      };
      
      // Tambahkan informasi walk-in dalam notes untuk tracking
      appointmentData.notes += " [WALKIN]";
      
      const appointment = await storage.createAppointment(appointmentData);
      
      // Tambahkan sessions jika pasien memiliki sesi aktif
      const sessions = await storage.getActiveSessionsByPatient(patientId);
      
      if (sessions.length > 0) {
        // Gunakan sesi pertama yang aktif
        const session = sessions[0];
        
        // Update appointment dengan sessionId menggunakan manual query karena storage
        // tidak memiliki metode updateAppointment
        const { pool } = require('../../db');
        await pool.query(
          `UPDATE appointments SET session_id = $1 WHERE id = $2`, 
          [session.id, appointment.id]
        );
        
        // Update penggunaan sesi
        await storage.updateSessionUsage(session.id, session.sessionsUsed + 1);
      }
      
      return res.status(201).json({
        success: true,
        message: "Pasien berhasil didaftarkan ke slot terapi (walk-in)",
        patientId,
        appointmentId: appointment.id,
        therapySlot: {
          id: therapySlot.id,
          date: therapySlot.date,
          timeSlot: therapySlot.timeSlot
        }
      });
    } catch (error) {
      console.error("Error registering patient to therapy slot:", error);
      
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat mendaftarkan pasien ke slot terapi" 
      });
    }
  });

  // Menyinkronkan jumlah pasien dalam slot terapi
  app.post("/api/therapy-slots/sync", requireAdmin, async (req: Request, res: Response) => {
    try {
      const result = await storage.syncTherapySlotQuota();
      
      return res.status(200).json({
        success: true,
        message: `Berhasil menyinkronkan ${result.updatedSlots} slot terapi`,
        updatedSlots: result.updatedSlots,
        details: result.results
      });
    } catch (error) {
      console.error("Error syncing therapy slot quotas:", error);
      
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat menyinkronkan jumlah pasien dalam slot terapi" 
      });
    }
  });
}

/**
 * Menghasilkan nomor registrasi unik
 * @returns Nomor registrasi dengan format TTS-XXXXXX
 */
function generateRegistrationNumber(): string {
  const prefix = "TTS";
  const randomDigits = Math.floor(100000 + Math.random() * 900000).toString();
  return `${prefix}-${randomDigits}`;
}