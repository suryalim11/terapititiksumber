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
  // Mendapatkan semua appointment dengan filter patientId jika disediakan
  app.get("/api/appointments", requireAuth, async (req: Request, res: Response) => {
    try {
      // Periksa apakah parameter patientId disediakan
      if (req.query.patientId) {
        const patientId = parseInt(req.query.patientId as string);
        
        if (isNaN(patientId)) {
          return res.status(400).json({ error: "Format patientId tidak valid" });
        }
        
        // Gunakan fungsi getAppointmentsByPatient jika patientId tersedia
        const appointments = await storage.getAppointmentsByPatient(patientId);
        return res.json(appointments);
      } else {
        // Jika tidak ada patientId, kembalikan semua appointment seperti sebelumnya
        const appointments = await storage.getAllAppointments();
        return res.json(appointments);
      }
    } catch (error) {
      console.error("Error getting appointments:", error);
      res.status(500).json({ error: "Gagal mendapatkan daftar appointment" });
    }
  });

  // BUG FIX #5: Route spesifik HARUS didaftarkan SEBELUM route /:id
  // karena Express mencocokkan route secara berurutan.
  // Sebelumnya /:id menyerap request ke /date/xxx, /patient/xxx, /slot/xxx

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

      // Return array langsung (bukan object) agar client bisa langsung .map()
      return res.status(200).json(appointments);
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

  // Mendapatkan appointment berdasarkan ID
  // BUG FIX #5: Dipindahkan ke SETELAH route spesifik (/date, /patient, /slot)
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
        
        // Update penggunaan sesi - gunakan atomic increment (tanpa parameter kedua)
        // BUG FIX: Sebelumnya menggunakan session.sessionsUsed + 1 yang rentan race condition.
        // Jika 2 appointment dibuat bersamaan, keduanya bisa baca nilai lama yang sama.
        // Atomic SQL increment (sessions_used + 1) menghindari masalah ini.
        await storage.updateSessionUsage(session.id);
        
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
            // Gunakan atomic decrement: GREATEST(sessions_used - 1, 0) untuk hindari negatif
            await storage.decrementSessionUsage(session.id);
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

  // Pindah jadwal (reschedule) appointment ke slot terapi lain
  app.post("/api/appointments/:id/reschedule", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { newSlotId } = req.body;

      if (isNaN(id) || !newSlotId) {
        return res.status(400).json({ success: false, message: "appointmentId dan newSlotId diperlukan" });
      }

      // Dapatkan appointment yang akan dipindahkan
      const appointment = await storage.getAppointment(id);
      if (!appointment) {
        return res.status(404).json({ success: false, message: "Appointment tidak ditemukan" });
      }

      // Pastikan appointment masih aktif (belum selesai/dibatalkan)
      if (appointment.status === 'Completed' || appointment.status === 'Cancelled') {
        return res.status(400).json({
          success: false,
          message: `Tidak dapat memindahkan jadwal appointment yang sudah ${appointment.status === 'Completed' ? 'selesai' : 'dibatalkan'}`
        });
      }

      // Dapatkan slot baru yang dituju
      const newSlot = await storage.getTherapySlot(newSlotId);
      if (!newSlot) {
        return res.status(404).json({ success: false, message: "Slot terapi tujuan tidak ditemukan" });
      }

      // Pastikan slot baru masih punya kuota
      if (newSlot.currentCount >= newSlot.maxQuota) {
        return res.status(400).json({ success: false, message: "Slot terapi tujuan sudah penuh" });
      }

      // Pastikan slot baru aktif
      if (!newSlot.isActive) {
        return res.status(400).json({ success: false, message: "Slot terapi tujuan tidak aktif" });
      }

      const oldSlotId = appointment.therapySlotId;

      // Update appointment: pindahkan ke slot baru, update tanggal & waktu
      const updatedAppointment = await storage.updateAppointment(id, {
        ...appointment,
        therapySlotId: newSlotId,
        date: newSlot.date,
        timeSlot: newSlot.timeSlot,
      });

      // Update kuota slot lama: kurangi 1
      if (oldSlotId) {
        const oldSlot = await storage.getTherapySlot(oldSlotId);
        if (oldSlot) {
          await storage.updateTherapySlot(oldSlotId, {
            currentCount: Math.max(0, (oldSlot.currentCount || 0) - 1)
          });
        }
      }

      // Update kuota slot baru: tambah 1
      await storage.updateTherapySlot(newSlotId, {
        currentCount: (newSlot.currentCount || 0) + 1
      });

      console.log(`✅ Reschedule berhasil: appointment ${id} dari slot ${oldSlotId} → slot ${newSlotId}`);

      return res.status(200).json({
        success: true,
        appointment: updatedAppointment,
        message: `Jadwal berhasil dipindahkan ke ${newSlot.timeSlot}`
      });
    } catch (error) {
      console.error("Error rescheduling appointment:", error);
      return res.status(500).json({ success: false, message: "Terjadi kesalahan saat memindahkan jadwal" });
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