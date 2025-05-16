/**
 * API endpoint untuk manajemen appointment
 */
import { Express, Request, Response } from "express";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import { storage } from "../../storage";
import { z } from "zod";
import { insertAppointmentSchema } from "@shared/schema";
import crypto from "crypto";

/**
 * Mendaftarkan rute-rute untuk appointment
 */
export function setupAppointmentRoutes(app: Express) {
  // Mendapatkan semua appointment
  app.get("/api/appointments", requireAuth, async (req: Request, res: Response) => {
    try {
      const appointments = await storage.getAllAppointments();
      res.json(appointments);
    } catch (error) {
      console.error("Error getting appointments:", error);
      res.status(500).json({ error: "Gagal mendapatkan daftar appointment" });
    }
  });

  // Mendapatkan appointment berdasarkan ID
  app.get("/api/appointments/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const appointment = await storage.getAppointment(id);
      
      if (!appointment) {
        return res.status(404).json({ error: "Appointment tidak ditemukan" });
      }
      
      res.json(appointment);
    } catch (error) {
      console.error("Error getting appointment:", error);
      res.status(500).json({ error: "Gagal mendapatkan data appointment" });
    }
  });

  // Mendapatkan appointment berdasarkan tanggal
  app.get("/api/appointments/date/:date", requireAuth, async (req: Request, res: Response) => {
    try {
      const date = req.params.date;
      
      if (!date) {
        return res.status(400).json({ 
          success: false, 
          message: "Parameter tanggal diperlukan" 
        });
      }
      
      const appointments = await storage.getAppointmentsByDate(date);
      
      return res.status(200).json({
        success: true,
        appointments
      });
    } catch (error) {
      console.error("Error getting appointments by date:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat mengambil data appointment" 
      });
    }
  });

  // Mendapatkan appointment berdasarkan pasien
  app.get("/api/appointments/patient/:patientId", requireAuth, async (req: Request, res: Response) => {
    try {
      const patientId = parseInt(req.params.patientId);
      
      if (isNaN(patientId)) {
        return res.status(400).json({ 
          success: false, 
          message: "ID pasien tidak valid" 
        });
      }
      
      const appointments = await storage.getAppointmentsByPatient(patientId);
      
      return res.status(200).json({
        success: true,
        appointments
      });
    } catch (error) {
      console.error("Error getting appointments by patient:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat mengambil data appointment" 
      });
    }
  });

  // Mendapatkan appointment berdasarkan slot terapi
  app.get("/api/appointments/slot/:slotId", requireAuth, async (req: Request, res: Response) => {
    try {
      const slotId = parseInt(req.params.slotId);
      
      if (isNaN(slotId)) {
        return res.status(400).json({ 
          success: false, 
          message: "ID slot terapi tidak valid" 
        });
      }
      
      const appointments = await storage.getAppointmentsByTherapySlot(slotId);
      
      return res.status(200).json({
        success: true,
        appointments
      });
    } catch (error) {
      console.error("Error getting appointments by therapy slot:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat mengambil data appointment" 
      });
    }
  });

  // Membuat appointment baru
  app.post("/api/appointments", requireAuth, async (req: Request, res: Response) => {
    try {
      // Log untuk debugging
      console.log(`📝 Menerima request pendaftaran appointment dengan data:`, 
        JSON.stringify({
          walkin: req.body.walkin,
          notes: req.body.notes,
          status: req.body.status,
          patientId: req.body.patientId,
          date: req.body.date
        }, null, 2)
      );
      
      const appointmentData = insertAppointmentSchema.parse(req.body);
      
      // Deteksi apakah pendaftaran ini adalah walk-in (tambahkan deteksi dari notes atau parameter walkin)
      const isWalkIn = Boolean(req.body.walkin === true || appointmentData.notes?.toLowerCase().includes('walk-in'));
      
      // Set status default yang sesuai dengan jalur pendaftaran
      if (!appointmentData.status) {
        appointmentData.status = isWalkIn ? 'Active' : 'Confirmed';
        console.log(`📋 Status default disetel ke "${appointmentData.status}" (isWalkIn: ${isWalkIn})`);
      }
      
      // Pastikan notes mencerminkan jalur pendaftaran
      if (isWalkIn && (!appointmentData.notes || !appointmentData.notes.toLowerCase().includes('walk-in'))) {
        appointmentData.notes = appointmentData.notes 
          ? `${appointmentData.notes} (walk-in)`
          : "Pendaftaran walk-in";
      }
      
      // Periksa apakah pasien ada
      const patient = await storage.getPatient(appointmentData.patientId);
      
      if (!patient) {
        return res.status(404).json({ 
          success: false, 
          message: "Pasien tidak ditemukan" 
        });
      }
      
      // Periksa apakah slot terapi ada dan aktif
      if (appointmentData.therapySlotId) {
        const therapySlot = await storage.getTherapySlot(appointmentData.therapySlotId);
        
        if (!therapySlot) {
          return res.status(404).json({ 
            success: false, 
            message: "Slot terapi tidak ditemukan" 
          });
        }
        
        if (!therapySlot.isActive) {
          return res.status(400).json({ 
            success: false, 
            message: "Slot terapi tidak aktif" 
          });
        }
        
        // Periksa kuota jika bukan walk-in (periksa dari parameter walkin atau notes)
        if (!isWalkIn && therapySlot.currentCount >= therapySlot.maxQuota) {
          console.log(`⚠️ Slot terapi ${therapySlot.id} sudah penuh: ${therapySlot.currentCount}/${therapySlot.maxQuota}`);
          return res.status(400).json({ 
            success: false, 
            message: "Slot terapi sudah penuh" 
          });
        }
        
        // Log informasi kuota untuk monitoring
        console.log(`📊 Slot terapi ${therapySlot.id} - kuota: ${therapySlot.currentCount}/${therapySlot.maxQuota}, pendaftaran: ${isWalkIn ? 'walk-in' : 'online'}`);
        
        
        // Set tanggal dan waktu dari slot terapi
        appointmentData.date = therapySlot.date;
        appointmentData.timeSlot = therapySlot.timeSlot;
      }
      
      // Set status default jika tidak diberikan
      if (!appointmentData.status) {
        appointmentData.status = appointmentData.walkin ? 'Active' : 'Confirmed';
      }
      
      // Generate nomor registrasi jika tidak ada
      if (!appointmentData.registrationNumber) {
        appointmentData.registrationNumber = generateRegistrationNumber();
      }
      
      // Buat appointment baru
      const newAppointment = await storage.createAppointment(appointmentData);
      
      // Tambahkan sessions jika pasien memiliki sesi aktif
      const sessions = await storage.getActiveSessionsByPatient(appointmentData.patientId);
      
      if (sessions.length > 0 && !appointmentData.sessionId) {
        // Gunakan sesi pertama yang aktif
        const session = sessions[0];
        
        // Update appointment dengan sessionId
        const updatedAppointment = await storage.updateAppointment(newAppointment.id, {
          ...newAppointment,
          sessionId: session.id
        });
        
        // Update penggunaan sesi
        await storage.updateSessionUsage(session.id, session.sessionsUsed + 1);
        
        if (updatedAppointment) {
          return res.status(201).json({
            success: true,
            appointment: updatedAppointment,
            sessionUpdated: true,
            registrationType: isWalkIn ? "walk-in" : "online",
            message: isWalkIn 
              ? "Appointment walk-in berhasil dibuat dengan status 'Active' dan dihubungkan dengan sesi yang ada"
              : "Appointment online berhasil dibuat dengan status 'Confirmed' dan dihubungkan dengan sesi yang ada",
            timestamp: new Date().toISOString()
          });
        }
      }
      
      // Respons yang lebih informatif dengan kategori pendaftaran
      return res.status(201).json({
        success: true,
        appointment: newAppointment,
        registrationType: isWalkIn ? "walk-in" : "online",
        message: isWalkIn 
          ? "Appointment walk-in berhasil dibuat dengan status 'Active'" 
          : "Appointment online berhasil dibuat dengan status 'Confirmed'",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error creating appointment:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false, 
          message: "Data appointment tidak valid", 
          details: error.errors 
        });
      }
      
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat membuat appointment baru" 
      });
    }
  });

  // Memperbarui status appointment
  app.patch("/api/appointments/:id/status", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!status || typeof status !== 'string') {
        return res.status(400).json({ 
          success: false, 
          message: "Status appointment diperlukan" 
        });
      }
      
      // Dapatkan appointment yang ada
      const existingAppointment = await storage.getAppointment(id);
      
      if (!existingAppointment) {
        return res.status(404).json({ 
          success: false, 
          message: "Appointment tidak ditemukan" 
        });
      }
      
      // Validasi status
      const validStatuses = ['Confirmed', 'Active', 'Completed', 'Cancelled', 'No Show'];
      
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ 
          success: false, 
          message: `Status tidak valid. Status yang valid: ${validStatuses.join(', ')}` 
        });
      }
      
      // Update status appointment
      const updatedAppointment = await storage.updateAppointmentStatus(id, status);
      
      if (!updatedAppointment) {
        return res.status(500).json({ 
          success: false, 
          message: "Gagal memperbarui status appointment" 
        });
      }
      
      // Lakukan tindakan berdasarkan perubahan status
      if ((status === 'Cancelled' || status === 'No Show') && 
          (existingAppointment.status === 'Confirmed' || existingAppointment.status === 'Active')) {
        
        // Jika dibatalkan, kurangi jumlah penggunaan slot terapi
        if (existingAppointment.therapySlotId) {
          await storage.decrementTherapySlotUsage(existingAppointment.therapySlotId);
        }
        
        // Jika ada session yang digunakan, kembalikan
        if (existingAppointment.sessionId) {
          const session = await storage.getSession(existingAppointment.sessionId);
          
          if (session && session.sessionsUsed > 0) {
            await storage.updateSessionUsage(session.id, session.sessionsUsed - 1);
          }
        }
      }
      
      return res.status(200).json({
        success: true,
        appointment: updatedAppointment,
        message: `Status appointment berhasil diperbarui menjadi ${status}`
      });
    } catch (error) {
      console.error("Error updating appointment status:", error);
      
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat memperbarui status appointment" 
      });
    }
  });

  // Memperbarui appointment
  app.put("/api/appointments/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const appointmentData = req.body;
      
      // Dapatkan appointment yang ada
      const existingAppointment = await storage.getAppointment(id);
      
      if (!existingAppointment) {
        return res.status(404).json({ 
          success: false, 
          message: "Appointment tidak ditemukan" 
        });
      }
      
      // Periksa apakah slot terapi diubah
      if (appointmentData.therapySlotId && existingAppointment.therapySlotId !== appointmentData.therapySlotId) {
        // Kurangi jumlah penggunaan slot terapi lama
        if (existingAppointment.therapySlotId) {
          await storage.decrementTherapySlotUsage(existingAppointment.therapySlotId);
        }
        
        // Periksa slot terapi baru
        const newTherapySlot = await storage.getTherapySlot(appointmentData.therapySlotId);
        
        if (!newTherapySlot) {
          return res.status(404).json({ 
            success: false, 
            message: "Slot terapi baru tidak ditemukan" 
          });
        }
        
        if (!newTherapySlot.isActive) {
          return res.status(400).json({ 
            success: false, 
            message: "Slot terapi baru tidak aktif" 
          });
        }
        
        // Periksa kuota jika bukan walk-in
        if (!appointmentData.walkin && !existingAppointment.walkin && 
            newTherapySlot.currentCount >= newTherapySlot.maxQuota) {
          return res.status(400).json({ 
            success: false, 
            message: "Slot terapi baru sudah penuh" 
          });
        }
        
        // Update tanggal dan waktu dari slot terapi baru
        appointmentData.date = newTherapySlot.date;
        appointmentData.timeSlot = newTherapySlot.timeSlot;
        
        // Tambah jumlah penggunaan slot terapi baru
        await storage.incrementTherapySlotUsage(appointmentData.therapySlotId);
      }
      
      // Perbarui appointment
      const updatedAppointment = await storage.updateAppointment(id, appointmentData);
      
      if (!updatedAppointment) {
        return res.status(500).json({ 
          success: false, 
          message: "Gagal memperbarui data appointment" 
        });
      }
      
      return res.status(200).json({
        success: true,
        appointment: updatedAppointment,
        message: "Data appointment berhasil diperbarui"
      });
    } catch (error) {
      console.error("Error updating appointment:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false, 
          message: "Data appointment tidak valid", 
          details: error.errors 
        });
      }
      
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat memperbarui data appointment" 
      });
    }
  });

  // Menyinkronkan tanggal appointment dengan tanggal therapy slot
  app.post("/api/appointments/sync-dates", requireAdmin, async (req: Request, res: Response) => {
    try {
      const result = await storage.resyncAppointmentDates();
      
      return res.status(200).json({
        success: true,
        message: `Berhasil menyinkronkan ${result.fixed} appointment`,
        fixed: result.fixed,
        errors: result.errors
      });
    } catch (error) {
      console.error("Error syncing appointment dates:", error);
      
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat menyinkronkan tanggal appointment" 
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