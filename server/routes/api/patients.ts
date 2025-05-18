/**
 * API endpoint untuk manajemen pasien
 */
import { Express, Request, Response } from "express";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import { storage } from "../../storage";
import { z } from "zod";
import { insertPatientSchema } from "@shared/schema";

/**
 * Mendaftarkan rute-rute untuk pasien
 */
export function setupPatientRoutes(app: Express) {
  // Endpoint khusus untuk pendaftaran walk-in langsung dari dashboard
  app.post("/api/patients/register-walkin", requireAuth, async (req: Request, res: Response) => {
    try {
      console.log("➡️ API Register Walk-in: Menerima permintaan pendaftaran walk-in");
      console.log("📝 API Register Walk-in: Data yang diterima:", req.body);
      
      // Validasi data dasar
      if (!req.body.name || !req.body.phoneNumber || !req.body.slotId) {
        console.log("❌ API Register Walk-in: Data tidak lengkap");
        return res.status(400).json({
          success: false,
          message: "Data pendaftaran tidak lengkap"
        });
      }
      
      // Cek slot terapi
      const slotId = parseInt(req.body.slotId);
      console.log("🔍 API Register Walk-in: Slot ID yang diterima:", slotId);
      const therapySlot = await storage.getTherapySlot(slotId);
      
      console.log("🔍 API Register Walk-in: Slot terapi:", therapySlot);
      
      if (!therapySlot) {
        console.log("❌ API Register Walk-in: Slot terapi tidak ditemukan");
        return res.status(404).json({
          success: false,
          message: "Slot terapi tidak ditemukan"
        });
      }
      
      // Cek kuota
      if (therapySlot.currentCount >= therapySlot.maxQuota) {
        console.log("❌ API Register Walk-in: Kuota slot penuh");
        return res.status(400).json({
          success: false,
          message: `Kuota slot terapi sudah penuh (${therapySlot.currentCount}/${therapySlot.maxQuota})`
        });
      }
      
      // Buat pasien baru
      const patientData = {
        name: req.body.name,
        phoneNumber: req.body.phoneNumber,
        gender: req.body.gender || "Laki-laki",
        birthDate: req.body.birthDate || new Date(),
        address: req.body.address || "Alamat default",
        complaints: req.body.complaints || "Walk-in pasien",
        email: req.body.email || "",
        therapySlotId: slotId
      };
      
      // Buat pasien
      console.log("📋 API Register Walk-in: Membuat pasien baru...");
      const patient = await storage.createPatient(patientData);
      console.log("✅ API Register Walk-in: Pasien berhasil dibuat:", patient);
      
      // Buat appointment
      console.log("📋 API Register Walk-in: Membuat appointment baru...");
      const appointmentData = {
        patientId: patient.id,
        date: therapySlot.date,
        timeSlot: therapySlot.timeSlot,
        therapySlotId: therapySlot.id,
        sessionId: null,
        status: "Active", // Walk-in selalu active
        registrationNumber: `WI-${Date.now()}`,
        notes: patientData.complaints
      };
      
      console.log("📋 API Register Walk-in: Data appointment:", appointmentData);
      const appointment = await storage.createAppointment(appointmentData);
      console.log("✅ API Register Walk-in: Appointment berhasil dibuat:", appointment);
      
      // Update kuota slot
      await storage.incrementTherapySlotUsage(slotId);
      console.log("✅ API Register Walk-in: Kuota slot terapi diupdate");
      
      return res.status(200).json({
        success: true,
        message: "Pendaftaran walk-in berhasil",
        patient: patient,
        appointment: appointment
      });
    } catch (error: any) {
      console.error("❌ API Register Walk-in: Error:", error);
      return res.status(500).json({
        success: false,
        message: "Terjadi kesalahan saat mendaftarkan pasien walk-in",
        error: error.message || "Unknown error"
      });
    }
  });
  // Mendapatkan semua pasien
  app.get("/api/patients", requireAuth, async (req: Request, res: Response) => {
    try {
      const patients = await storage.getAllPatients();
      res.json(patients);
    } catch (error) {
      console.error("Error getting patients:", error);
      res.status(500).json({ error: "Gagal mendapatkan daftar pasien" });
    }
  });

  // Mencari pasien berdasarkan nama atau nomor telepon
  app.get("/api/patients/search", requireAuth, async (req: Request, res: Response) => {
    try {
      const query = req.query.query || req.query.phone;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ 
          success: false, 
          message: "Parameter pencarian diperlukan" 
        });
      }
      
      console.log(`Mencari pasien dengan kata kunci: ${query}`);
      
      const patients = await storage.searchPatientByNameOrPhone(query);
      
      if (patients.length > 0) {
        console.log(`Pasien ditemukan: ${patients.length} hasil dengan kata kunci: ${query}`);
        return res.status(200).json({
          success: true,
          found: true,
          patients: patients,
          count: patients.length
        });
      } else {
        console.log(`Tidak ada pasien ditemukan dengan kata kunci: ${query}`);
        return res.status(200).json({ 
          success: true, 
          found: false,
          message: "Tidak ada pasien ditemukan dengan kata kunci tersebut"
        });
      }
    } catch (error) {
      console.error("Error searching for patient:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat mencari pasien"
      });
    }
  });

  // Mendapatkan pasien berdasarkan nomor telepon
  app.get("/api/patients/phone/:phoneNumber", requireAuth, async (req: Request, res: Response) => {
    try {
      const phoneNumber = req.params.phoneNumber;
      
      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          message: "Nomor telepon diperlukan"
        });
      }
      
      const patients = await storage.searchPatientByNameOrPhone(phoneNumber);
      
      return res.status(200).json({
        success: true,
        patients
      });
    } catch (error) {
      console.error("Error getting patients by phone number:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat mengambil data pasien"
      });
    }
  });

  // Membuat pasien baru
  app.post("/api/patients", requireAuth, async (req: Request, res: Response) => {
    try {
      const patientData = insertPatientSchema.parse(req.body);
      
      // Validasi format nomor telepon
      if (patientData.phoneNumber) {
        // Hapus karakter non-numerik
        patientData.phoneNumber = patientData.phoneNumber.replace(/\D/g, '');
        
        // Tambahkan '0' di depan jika dimulai dengan '8'
        if (patientData.phoneNumber.startsWith('8')) {
          patientData.phoneNumber = '0' + patientData.phoneNumber;
        }
        
        // Tambahkan +62 jika dimulai dengan 0
        if (patientData.phoneNumber.startsWith('0')) {
          patientData.phoneNumber = '+62' + patientData.phoneNumber.substring(1);
        }
      }
      
      // Periksa apakah pasien dengan nomor telepon yang sama sudah ada
      // Namun tetap buat pasien baru karena dalam beberapa kasus anggota keluarga
      // bisa menggunakan nomor yang sama
      const existingPatients = patientData.phoneNumber ? 
        await storage.searchPatientByNameOrPhone(patientData.phoneNumber) : [];
        
      // Buat pasien baru
      const newPatient = await storage.createPatient(patientData);
      
      return res.status(201).json({
        success: true,
        patient: newPatient,
        existingCount: existingPatients.length,
        message: existingPatients.length > 0 
          ? `Pasien berhasil dibuat. Terdapat ${existingPatients.length} pasien lain dengan nomor telepon yang sama.`
          : "Pasien berhasil dibuat"
      });
    } catch (error) {
      console.error("Error creating patient:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false, 
          message: "Data pasien tidak valid", 
          details: error.errors 
        });
      }
      
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat membuat pasien baru" 
      });
    }
  });

  // Memperbarui data pasien
  app.put("/api/patients/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      let patientData = req.body;
      
      // Dapatkan pasien yang ada
      const existingPatient = await storage.getPatient(id);
      
      if (!existingPatient) {
        return res.status(404).json({ 
          success: false, 
          message: "Pasien tidak ditemukan" 
        });
      }
      
      // Validasi format nomor telepon
      if (patientData.phoneNumber) {
        // Hapus karakter non-numerik
        patientData.phoneNumber = patientData.phoneNumber.replace(/\D/g, '');
        
        // Tambahkan '0' di depan jika dimulai dengan '8'
        if (patientData.phoneNumber.startsWith('8')) {
          patientData.phoneNumber = '0' + patientData.phoneNumber;
        }
        
        // Tambahkan +62 jika dimulai dengan 0
        if (patientData.phoneNumber.startsWith('0')) {
          patientData.phoneNumber = '+62' + patientData.phoneNumber.substring(1);
        }
      }
      
      // Perbarui pasien
      const updatedPatient = await storage.updatePatient(id, patientData);
      
      if (!updatedPatient) {
        return res.status(500).json({ 
          success: false, 
          message: "Gagal memperbarui data pasien" 
        });
      }
      
      return res.status(200).json({
        success: true,
        patient: updatedPatient,
        message: "Data pasien berhasil diperbarui"
      });
    } catch (error) {
      console.error("Error updating patient:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false, 
          message: "Data pasien tidak valid", 
          details: error.errors 
        });
      }
      
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat memperbarui data pasien" 
      });
    }
  });

  // Menghapus pasien
  app.delete("/api/patients/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Dapatkan pasien yang akan dihapus
      const patient = await storage.getPatient(id);
      
      if (!patient) {
        return res.status(404).json({ 
          success: false, 
          message: "Pasien tidak ditemukan" 
        });
      }
      
      // Periksa apakah pasien memiliki appointment atau sesi aktif
      const appointments = await storage.getAppointmentsByPatient(id);
      const sessions = await storage.getSessionsByPatient(id);
      
      if (appointments.length > 0 || sessions.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: "Pasien tidak dapat dihapus karena memiliki appointment atau sesi yang aktif" 
        });
      }
      
      // Hapus pasien
      const success = await storage.deletePatient(id);
      
      if (!success) {
        return res.status(500).json({ 
          success: false, 
          message: "Gagal menghapus pasien" 
        });
      }
      
      return res.status(200).json({
        success: true,
        message: "Pasien berhasil dihapus"
      });
    } catch (error) {
      console.error("Error deleting patient:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat menghapus pasien" 
      });
    }
  });
  
  // Mendapatkan riwayat medis pasien
  app.get("/api/patients/:id/medical-histories", requireAuth, async (req: Request, res: Response) => {
    try {
      const patientId = parseInt(req.params.id);
      
      // Verifikasi pasien
      const patient = await storage.getPatient(patientId);
      
      if (!patient) {
        return res.status(404).json({ 
          success: false, 
          message: "Pasien tidak ditemukan" 
        });
      }
      
      const medicalHistories = await storage.getMedicalHistoriesByPatient(patientId);
      
      return res.status(200).json({
        success: true,
        medicalHistories
      });
    } catch (error) {
      console.error("Error getting medical histories:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat mengambil riwayat medis" 
      });
    }
  });
  
  // Mendapatkan appointment pasien
  app.get("/api/patients/:id/appointments", requireAuth, async (req: Request, res: Response) => {
    try {
      const patientId = parseInt(req.params.id);
      
      // Verifikasi pasien
      const patient = await storage.getPatient(patientId);
      
      if (!patient) {
        return res.status(404).json({ 
          success: false, 
          message: "Pasien tidak ditemukan" 
        });
      }
      
      const appointments = await storage.getAppointmentsByPatient(patientId);
      
      return res.status(200).json({
        success: true,
        appointments
      });
    } catch (error) {
      console.error("Error getting patient appointments:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat mengambil appointment pasien" 
      });
    }
  });
  
  // Mendapatkan sesi paket pasien
  app.get("/api/patients/:id/sessions", requireAuth, async (req: Request, res: Response) => {
    try {
      const patientId = parseInt(req.params.id);
      
      // Verifikasi pasien
      const patient = await storage.getPatient(patientId);
      
      if (!patient) {
        return res.status(404).json({ 
          success: false, 
          message: "Pasien tidak ditemukan" 
        });
      }
      
      const sessions = await storage.getSessionsByPatient(patientId);
      
      return res.status(200).json({
        success: true,
        sessions
      });
    } catch (error) {
      console.error("Error getting patient sessions:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat mengambil sesi paket pasien" 
      });
    }
  });
  
  // Mendapatkan sesi paket aktif pasien
  app.get("/api/patients/:id/active-sessions", requireAuth, async (req: Request, res: Response) => {
    try {
      const patientId = parseInt(req.params.id);
      
      // Verifikasi pasien
      const patient = await storage.getPatient(patientId);
      
      if (!patient) {
        return res.status(404).json({ 
          success: false, 
          message: "Pasien tidak ditemukan" 
        });
      }
      
      const activeSessions = await storage.getActiveSessionsByPatient(patientId);
      
      return res.status(200).json({
        success: true,
        activeSessions
      });
    } catch (error) {
      console.error("Error getting patient active sessions:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat mengambil sesi paket aktif pasien" 
      });
    }
  });
  
  // Mendapatkan transaksi pasien
  app.get("/api/patients/:id/transactions", requireAuth, async (req: Request, res: Response) => {
    try {
      const patientId = parseInt(req.params.id);
      
      // Verifikasi pasien
      const patient = await storage.getPatient(patientId);
      
      if (!patient) {
        return res.status(404).json({ 
          success: false, 
          message: "Pasien tidak ditemukan" 
        });
      }
      
      const transactions = await storage.getTransactionsByPatient(patientId);
      
      return res.status(200).json({
        success: true,
        transactions
      });
    } catch (error) {
      console.error("Error getting patient transactions:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat mengambil transaksi pasien" 
      });
    }
  });
  
  // Mendapatkan transaksi belum lunas pasien
  app.get("/api/patients/:id/unpaid-transactions", requireAuth, async (req: Request, res: Response) => {
    try {
      const patientId = parseInt(req.params.id);
      
      // Verifikasi pasien
      const patient = await storage.getPatient(patientId);
      
      if (!patient) {
        return res.status(404).json({ 
          success: false, 
          message: "Pasien tidak ditemukan" 
        });
      }
      
      const unpaidTransactions = await storage.getUnpaidTransactionsByPatient(patientId);
      
      return res.status(200).json({
        success: true,
        unpaidTransactions
      });
    } catch (error) {
      console.error("Error getting patient unpaid transactions:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat mengambil transaksi belum lunas pasien" 
      });
    }
  });
  
  // Verifikasi koneksi appointment pasien
  app.get("/api/patients/:id/verify-connection", async (req: Request, res: Response) => {
    try {
      const patientId = parseInt(req.params.id);
      
      // Verifikasi pasien
      const patient = await storage.getPatient(patientId);
      
      if (!patient) {
        return res.status(404).json({ 
          success: false, 
          message: "Pasien tidak ditemukan" 
        });
      }
      
      // Mendapatkan appointment pasien
      const appointments = await storage.getAppointmentsByPatient(patientId);
      
      // Mendapatkan slot terapi untuk setiap appointment
      const results = [];
      
      for (const appointment of appointments) {
        if (!appointment.therapySlotId) {
          // Jika tidak ada therapySlotId, coba cari slot terapi yang sesuai
          const timeSlot = appointment.timeSlot;
          const date = appointment.date;
          
          if (date && timeSlot) {
            const matchingSlots = await storage.getTherapySlotsByDate(date);
            const matchingSlot = matchingSlots.find(slot => slot.timeSlot === timeSlot);
            
            if (matchingSlot) {
              // Update appointment dengan therapySlotId yang ditemukan
              const updatedAppointment = await storage.updateAppointment(appointment.id, {
                ...appointment,
                therapySlotId: matchingSlot.id
              });
              
              if (updatedAppointment) {
                // Increment slot usage
                await storage.incrementTherapySlotUsage(matchingSlot.id);
                
                results.push({
                  appointmentId: appointment.id,
                  status: "connected",
                  therapySlotId: matchingSlot.id,
                  date: date,
                  timeSlot: timeSlot
                });
              }
            } else {
              results.push({
                appointmentId: appointment.id,
                status: "no_matching_slot",
                date: date,
                timeSlot: timeSlot
              });
            }
          } else {
            results.push({
              appointmentId: appointment.id,
              status: "incomplete_data"
            });
          }
        } else {
          // Appointment sudah memiliki therapySlotId
          results.push({
            appointmentId: appointment.id,
            status: "already_connected",
            therapySlotId: appointment.therapySlotId
          });
        }
      }
      
      return res.status(200).json({
        success: true,
        patientId,
        results,
        appointmentCount: appointments.length,
        fixedCount: results.filter(r => r.status === "connected").length
      });
    } catch (error) {
      console.error("Error verifying patient connections:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat memverifikasi koneksi pasien" 
      });
    }
  });
}