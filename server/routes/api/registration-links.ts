/**
 * API endpoint untuk manajemen link registrasi
 */
import { Express, Request, Response } from "express";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import { storage } from "../../storage";
import { z } from "zod";
import { insertRegistrationLinkSchema } from "@shared/schema";
import crypto from "crypto";

/**
 * Mendaftarkan rute-rute untuk link registrasi
 */
export function setupRegistrationLinkRoutes(app: Express) {
  // Membuat link registrasi baru (hanya admin)
  app.post("/api/registration-links", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { expiryHours, dailyLimit, specificDate } = req.body;
      
      if (!expiryHours || expiryHours <= 0) {
        return res.status(400).json({
          success: false,
          message: "Masa berlaku link harus lebih dari 0 jam"
        });
      }
      
      if (!dailyLimit || dailyLimit <= 0) {
        return res.status(400).json({
          success: false,
          message: "Batas pendaftaran harian harus lebih dari 0"
        });
      }
      
      // Buat link registrasi untuk user yang sedang login
      const userId = (req.user as any).id;
      const registrationLink = await storage.createRegistrationLink(
        userId, 
        expiryHours, 
        dailyLimit, 
        specificDate
      );
      
      return res.status(201).json({
        success: true,
        registrationLink
      });
    } catch (error) {
      console.error("Error creating registration link:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false, 
          message: "Data link registrasi tidak valid", 
          details: error.errors 
        });
      }
      
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat membuat link registrasi" 
      });
    }
  });

  // Mendapatkan semua link registrasi (hanya admin)
  app.get("/api/registration-links", requireAdmin, async (req: Request, res: Response) => {
    try {
      const registrationLinks = await storage.getAllRegistrationLinks();
      
      return res.status(200).json({
        success: true,
        registrationLinks
      });
    } catch (error) {
      console.error("Error getting registration links:", error);
      
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat mengambil daftar link registrasi" 
      });
    }
  });

  // Verifikasi link registrasi
  app.get("/api/registration-links/verify/:code", async (req: Request, res: Response) => {
    try {
      const code = req.params.code;
      
      if (!code) {
        return res.status(400).json({
          success: false,
          valid: false,
          message: "Kode registrasi tidak diberikan"
        });
      }
      
      const registrationLink = await storage.getRegistrationLinkByCode(code);
      
      if (!registrationLink) {
        return res.status(404).json({
          success: false,
          valid: false,
          message: "Link registrasi tidak ditemukan"
        });
      }
      
      // Periksa apakah link masih aktif
      if (!registrationLink.isActive) {
        return res.status(400).json({
          success: false,
          valid: false,
          message: "Link registrasi tidak aktif"
        });
      }
      
      // Periksa apakah link belum kedaluwarsa
      const now = new Date();
      const expiryDate = new Date(registrationLink.expiryDate);
      
      if (now > expiryDate) {
        return res.status(400).json({
          success: false,
          valid: false,
          message: "Link registrasi telah kedaluwarsa"
        });
      }
      
      // Periksa apakah batas harian belum tercapai
      const today = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
      const registrationsToday = registrationLink.dailyRegistrationCount || 0;
      
      if (registrationsToday >= registrationLink.dailyLimit) {
        return res.status(400).json({
          success: false,
          valid: false,
          message: "Batas pendaftaran harian telah tercapai"
        });
      }
      
      // Periksa apakah link untuk tanggal tertentu dan tanggal hari ini
      if (registrationLink.specificDate) {
        const specificDate = new Date(registrationLink.specificDate).toISOString().split('T')[0];
        
        if (specificDate !== today) {
          return res.status(400).json({
            success: false,
            valid: false,
            message: `Link registrasi hanya berlaku untuk tanggal ${specificDate}`
          });
        }
      }
      
      // Link registrasi valid
      return res.status(200).json({
        success: true,
        valid: true,
        message: "Link registrasi valid",
        remainingSlots: registrationLink.dailyLimit - registrationsToday,
        specificDate: registrationLink.specificDate
      });
    } catch (error) {
      console.error("Error verifying registration link:", error);
      
      return res.status(500).json({ 
        success: false, 
        valid: false,
        message: "Terjadi kesalahan saat memverifikasi link registrasi" 
      });
    }
  });

  // Menonaktifkan link registrasi (hanya admin)
  app.patch("/api/registration-links/:id/deactivate", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deactivateRegistrationLink(id);
      
      if (!success) {
        return res.status(404).json({
          success: false,
          message: "Link registrasi tidak ditemukan atau gagal dinonaktifkan"
        });
      }
      
      return res.status(200).json({
        success: true,
        message: "Link registrasi berhasil dinonaktifkan"
      });
    } catch (error) {
      console.error("Error deactivating registration link:", error);
      
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat menonaktifkan link registrasi" 
      });
    }
  });

  // Menghapus link registrasi (hanya admin)
  app.delete("/api/registration-links/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteRegistrationLink(id);
      
      if (!success) {
        return res.status(404).json({
          success: false,
          message: "Link registrasi tidak ditemukan atau gagal dihapus"
        });
      }
      
      return res.status(200).json({
        success: true,
        message: "Link registrasi berhasil dihapus"
      });
    } catch (error) {
      console.error("Error deleting registration link:", error);
      
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat menghapus link registrasi" 
      });
    }
  });

  // Registrasi pasien melalui link (public)
  app.post("/api/register/:code", async (req: Request, res: Response) => {
    try {
      const code = req.params.code;
      const patientData = req.body;
      
      if (!code) {
        return res.status(400).json({
          success: false,
          message: "Kode registrasi tidak diberikan"
        });
      }
      
      // Validasi data pasien
      if (!patientData.name || !patientData.phoneNumber) {
        return res.status(400).json({
          success: false,
          message: "Data pasien tidak lengkap, nama dan nomor telepon diperlukan"
        });
      }
      
      // Verifikasi link registrasi
      const registrationLink = await storage.getRegistrationLinkByCode(code);
      
      if (!registrationLink) {
        return res.status(404).json({
          success: false,
          message: "Link registrasi tidak ditemukan"
        });
      }
      
      // Periksa apakah link masih aktif
      if (!registrationLink.isActive) {
        return res.status(400).json({
          success: false,
          message: "Link registrasi tidak aktif"
        });
      }
      
      // Periksa apakah link belum kedaluwarsa
      const now = new Date();
      const expiryDate = new Date(registrationLink.expiryDate);
      
      if (now > expiryDate) {
        return res.status(400).json({
          success: false,
          message: "Link registrasi telah kedaluwarsa"
        });
      }
      
      // Periksa apakah batas harian belum tercapai
      const today = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
      const registrationsToday = registrationLink.dailyRegistrationCount || 0;
      
      if (registrationsToday >= registrationLink.dailyLimit) {
        return res.status(400).json({
          success: false,
          message: "Batas pendaftaran harian telah tercapai"
        });
      }
      
      // Periksa apakah link untuk tanggal tertentu dan tanggal hari ini
      if (registrationLink.specificDate) {
        const specificDate = new Date(registrationLink.specificDate).toISOString().split('T')[0];
        
        if (specificDate !== today) {
          return res.status(400).json({
            success: false,
            message: `Link registrasi hanya berlaku untuk tanggal ${specificDate}`
          });
        }
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
      
      // Periksa apakah pasien dengan nomor telepon dan nama yang sama sudah terdaftar
      const existingPatients = await storage.searchPatientByNameOrPhone(patientData.phoneNumber);
      const exactMatch = existingPatients.find(
        p => p.name.toLowerCase() === patientData.name.toLowerCase() && 
             p.phoneNumber === patientData.phoneNumber
      );
      
      let patientId;
      
      if (exactMatch) {
        // Gunakan pasien yang sudah ada
        patientId = exactMatch.id;
      } else {
        // Buat pasien baru
        const newPatient = await storage.createPatient({
          name: patientData.name,
          phoneNumber: patientData.phoneNumber,
          address: patientData.address || '',
          gender: patientData.gender || '',
          birthdate: patientData.birthdate || null,
          email: patientData.email || '',
          occupation: patientData.occupation || '',
          emergencyContact: patientData.emergencyContact || '',
          notes: patientData.notes || '',
          registrationDate: new Date()
        });
        
        patientId = newPatient.id;
      }
      
      // Cari slot terapi berdasarkan tanggal
      const dateToSearch = registrationLink.specificDate || today;
      const therapySlots = await storage.getTherapySlotsByDate(dateToSearch);
      
      // Filter slot terapi yang masih tersedia
      const availableSlots = therapySlots.filter(slot => {
        return slot.isActive && slot.currentCount < slot.maxQuota;
      });
      
      if (availableSlots.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Tidak ada slot terapi yang tersedia untuk tanggal ini"
        });
      }
      
      // Buat appointment
      const therapySlot = availableSlots[0]; // Gunakan slot pertama yang tersedia
      const appointment = await storage.createAppointment({
        patientId,
        therapySlotId: therapySlot.id,
        date: dateToSearch,
        timeSlot: therapySlot.timeSlot,
        status: 'Confirmed', // Status default untuk pendaftaran online
        registrationNumber: generateRegistrationNumber(),
        notes: `Pendaftaran online melalui link registrasi: ${code}`
      });
      
      // Incrementing therapySlot akan terjadi di dalam createAppointment
      // Update jumlah penggunaan link registrasi
      await storage.incrementRegistrationCount(code);
      
      return res.status(201).json({
        success: true,
        message: "Pendaftaran berhasil",
        patientId,
        appointmentId: appointment.id,
        therapySlot: {
          date: therapySlot.date,
          timeSlot: therapySlot.timeSlot
        }
      });
    } catch (error) {
      console.error("Error registering patient:", error);
      
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat mendaftarkan pasien" 
      });
    }
  });
}

/**
 * Menghasilkan nomor registrasi unik
 * @returns Nomor registrasi dengan format TTS-XXXXXX
 */
function generateRegistrationNumber(): string {
  const randomStr = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `TTS-${randomStr}`;
}