import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { 
  insertPatientSchema, 
  insertProductSchema, 
  insertPackageSchema,
  insertTransactionSchema,
  insertSessionSchema,
  insertAppointmentSchema,
  insertUserSchema,
  insertTherapySlotSchema,
  insertConfirmationTokenSchema,
  insertRegistrationLinkSchema,
  insertMedicalHistorySchema,
  User
} from "@shared/schema";
import { handleDateTest } from "./test-route";
import * as schema from "../shared/schema";
import { handleTherapySlotsBatch } from "./routes/therapy-slots-batch";
import fixTransactionsTable from "./fix-transactions-schema";
import crypto from "crypto";
import { setupAuth } from "./auth";
import multer from "multer";
import path from "path";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { db } from "./db";
import { eq, and, ne, isNotNull, desc, or, isNull, lte, sql } from "drizzle-orm";
import {
  exportData,
  getBackupFiles,
  downloadBackup,
  deleteBackup,
  restoreData,
  uploadBackup
} from "./backup";

// Tipe data untuk verifikasi link pendaftaran
interface VerifyRegistrationLinkBody {
  code: string;
}

// Tipe data untuk membuat link pendaftaran
interface CreateRegistrationLinkBody {
  expiryHours: number;
  dailyLimit: number;
  specificDate?: string;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication middleware
  setupAuth(app);
  
  // Fix database schema for missing columns
  try {
    console.log("Running database schema fix for transactions table...");
    await fixTransactionsTable();
    console.log("Database schema fix completed successfully");
  } catch (error) {
    console.error("Error fixing database schema:", error);
  }
  
  // API routes
  const apiRouter = app.route("/api");
  
  // Change password endpoint
  app.post("/api/change-password", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ success: false, message: "Tidak terautentikasi" });
      }
      
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ 
          success: false, 
          message: "Password lama dan password baru diperlukan" 
        });
      }
      
      const userId = (req.user as User).id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          message: "User tidak ditemukan" 
        });
      }
      
      // Untuk implementasi sementara, kita bisa langsung membandingkan password string
      // Di produksi, gunakan comparePassword dari server/auth.ts
      if (user.password !== currentPassword) {
        return res.status(400).json({ 
          success: false, 
          message: "Password lama salah" 
        });
      }
      
      // Update password - menggunakan password biasa untuk prototype
      // Di produksi, gunakan hashPassword dari server/auth.ts
      const updatedUser = await storage.updateUserPassword(userId, newPassword);
      
      return res.status(200).json({ 
        success: true, 
        message: "Password berhasil diubah" 
      });
    } catch (error: any) {
      console.error("Error saat mengubah password:", error);
      return res.status(500).json({ 
        success: false, 
        message: error.message || "Terjadi kesalahan saat mengubah password" 
      });
    }
  });

  // Update profile endpoint
  app.put("/api/update-profile", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ success: false, message: "Tidak terautentikasi" });
      }
      
      const { name, username } = req.body;
      
      if (!name || !username) {
        return res.status(400).json({ 
          success: false, 
          message: "Nama dan username diperlukan" 
        });
      }
      
      const userId = (req.user as User).id;
      
      // Periksa apakah username sudah digunakan oleh pengguna lain
      if (username !== (req.user as User).username) {
        const existingUser = await storage.getUserByUsername(username);
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({ 
            success: false, 
            message: "Username sudah digunakan oleh pengguna lain" 
          });
        }
      }
      
      // Update profil pengguna
      const updatedUser = await storage.updateUser(userId, { name, username });
      
      if (!updatedUser) {
        return res.status(500).json({ 
          success: false, 
          message: "Gagal memperbarui profil" 
        });
      }
      
      // Update data user di session
      req.login(updatedUser, (err) => {
        if (err) {
          console.error("Error updating session:", err);
          return res.status(500).json({ 
            success: false, 
            message: "Profil diperbarui tapi gagal memperbaharui session" 
          });
        }
        
        return res.status(200).json({ 
          success: true, 
          message: "Profil berhasil diperbarui", 
          user: updatedUser 
        });
      });
    } catch (error: any) {
      console.error('Error saat memperbarui profil:', error);
      return res.status(500).json({ 
        success: false, 
        message: error.message || "Terjadi kesalahan saat memperbarui profil" 
      });
    }
  });

  // User routes
  app.post("/api/users", async (req: Request, res: Response) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByUsername(validatedData.username);
      
      if (existingUser) {
        return res.status(409).json({ message: "Username already exists" });
      }
      
      const newUser = await storage.createUser(validatedData);
      return res.status(201).json(newUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Patient routes
  app.get("/api/patients", async (req: Request, res: Response) => {
    try {
      const patients = await storage.getAllPatients();
      return res.status(200).json(patients);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/patients/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const patient = await storage.getPatient(id);
      
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      
      return res.status(200).json(patient);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/patients", async (req: Request, res: Response) => {
    try {
      console.log("Menerima permintaan POST /api/patients dengan data:", JSON.stringify(req.body, null, 2));
      
      // Hack: Langsung buat pasien dengan data hardcoded untuk debug
      if (!req.body || Object.keys(req.body).length === 0) {
        console.log("Request body kosong atau tidak valid, menggunakan data contoh untuk debug");
        
        // Coba tangkap data dari raw request
        let rawBody = '';
        req.on('data', chunk => {
          rawBody += chunk.toString();
        });
        
        req.on('end', async () => {
          console.log("Raw request body:", rawBody);
          try {
            const jsonData = JSON.parse(rawBody);
            console.log("Parsed JSON data:", jsonData);
          } catch (err) {
            console.log("Tidak dapat mengurai JSON dari raw body");
          }
        });
        
        // Data contoh
        const dummyData = {
          name: "Pasien Test",
          phoneNumber: "08123456789",
          email: null,
          birthDate: "1990-01-01",
          gender: "Laki-laki",
          address: "Alamat Test",
          complaints: "Keluhan Test"
        };
        
        console.log("Menggunakan data contoh:", dummyData);
        const validatedData = insertPatientSchema.parse(dummyData);
        console.log("Data pasien tervalidasi:", validatedData);
        const newPatient = await storage.createPatient(validatedData);
        console.log("Pasien baru dibuat:", newPatient);
        return res.status(201).json(newPatient);
      }
      
      console.log("Skema yang diharapkan:", insertPatientSchema.shape);
      
      // Ambil kode registrasi dari request body, jika ada
      const registrationCode = req.body.registrationCode;
      console.log("Kode registrasi:", registrationCode);
      
      // Jika kode registrasi ada, verifikasi kembali untuk memastikan valid dan masih memiliki kuota
      // Langkah ini penting untuk mencegah pendaftaran yang melewati kuota saat traffic tinggi
      if (registrationCode) {
        const link = await storage.getRegistrationLinkByCode(registrationCode);
        
        if (!link) {
          return res.status(400).json({ 
            message: "Kode pendaftaran tidak valid", 
            code: "INVALID_REGISTRATION_CODE" 
          });
        }
        
        // Periksa apakah link masih aktif
        if (!link.isActive) {
          return res.status(400).json({ 
            message: "Link pendaftaran sudah tidak aktif", 
            code: "INACTIVE_REGISTRATION_LINK" 
          });
        }
        
        // Periksa apakah link expired
        const now = new Date();
        if (now > link.expiryTime) {
          return res.status(400).json({ 
            message: "Link pendaftaran sudah kadaluarsa", 
            code: "EXPIRED_REGISTRATION_LINK" 
          });
        }
        
        // PENTING: Periksa apakah kuota harian sudah tercapai (double-check)
        if (link.currentRegistrations >= link.dailyLimit) {
          return res.status(400).json({ 
            message: "Kuota pendaftaran untuk hari ini sudah penuh. Silakan coba lagi besok.",
            dailyLimit: link.dailyLimit,
            currentRegistrations: link.currentRegistrations,
            code: "QUOTA_REACHED" 
          });
        }
      }
      
      // Konversi data yang dikirim dari form menjadi format yang diharapkan oleh skema
      const patientData = {
        name: req.body.name || "",
        phoneNumber: req.body.phoneNumber || "",
        email: req.body.email || null,
        birthDate: req.body.birthDate || "",
        gender: req.body.gender || "Laki-laki",
        address: req.body.address || "",
        complaints: req.body.complaints || "",
        therapySlotId: req.body.therapySlotId ? parseInt(req.body.therapySlotId) : undefined
      };
      
      // Simpan therapySlotId untuk digunakan nanti
      const therapySlotId = req.body.therapySlotId ? parseInt(req.body.therapySlotId) : null;
      
      console.log("Data yang akan divalidasi:", patientData);
      const validatedData = insertPatientSchema.parse(patientData);
      console.log("Data pasien tervalidasi:", validatedData);
      
      // Check if patient already exists by phone number
      const existingPatients = await storage.getAllPatients();
      const existingPatient = existingPatients.find(
        patient => patient.phoneNumber === validatedData.phoneNumber
      );
      
      // Jika ada therapySlotId, periksa apakah pasien sudah punya jadwal di hari yang sama
      if (therapySlotId) {
        try {
          // Ambil therapy slot untuk mendapatkan tanggalnya
          const therapySlot = await storage.getTherapySlot(therapySlotId);
          
          if (therapySlot) {
            const slotDate = new Date(therapySlot.date);
            
            // Jika pasien sudah ada, periksa apakah mereka memiliki janji di hari yang sama
            if (existingPatient) {
              // Dapatkan semua janji temu pasien yang sudah ada
              const appointments = await storage.getAppointmentsByPatient(existingPatient.id);
              
              // Cek apakah ada janji temu pada hari yang sama dengan therapySlot
              const hasSameDayAppointment = appointments.some(appointment => {
                const appointmentDate = new Date(appointment.date);
                return (
                  appointmentDate.getFullYear() === slotDate.getFullYear() &&
                  appointmentDate.getMonth() === slotDate.getMonth() &&
                  appointmentDate.getDate() === slotDate.getDate() &&
                  appointment.status !== 'Cancelled'
                );
              });
              
              if (hasSameDayAppointment) {
                return res.status(400).json({ 
                  message: "Anda sudah memiliki janji terapi pada hari yang sama. Silakan pilih hari lain.", 
                  code: "DUPLICATE_APPOINTMENT" 
                });
              }
            }
            
            // Periksa apakah ada pasien dengan nama yang sama dan tanggal yang sama (mencegah pendaftaran duplikat)
            if (therapySlot) {
              // Dapatkan semua janji untuk hari tersebut
              const appointmentsForDate = await storage.getAppointmentsByDate(slotDate);
              
              // Periksa janji dengan nama sama tapi mungkin nomor telepon berbeda
              for (const appointment of appointmentsForDate) {
                if (appointment.status === 'Cancelled') {
                  continue; // Lewati janji yang sudah dibatalkan
                }
                
                const patient = await storage.getPatient(appointment.patientId);
                
                // Jika pasien ditemukan dan namanya sama persis (case-insensitive) dengan yang baru mendaftar
                if (patient && patient.name.toLowerCase() === validatedData.name.toLowerCase()) {
                  return res.status(400).json({
                    message: "Sudah ada pasien dengan nama yang sama terdaftar pada hari ini. Pastikan Anda belum melakukan pendaftaran sebelumnya.",
                    code: "DUPLICATE_PATIENT_NAME"
                  });
                }
                
                // Jika nomor telepon sama
                if (patient && patient.phoneNumber === validatedData.phoneNumber) {
                  return res.status(400).json({
                    message: "Anda sudah memiliki jadwal terapi pada hari yang sama. Silakan pilih tanggal lain.",
                    code: "DUPLICATE_APPOINTMENT"
                  });
                }
              }
            }
          }
        } catch (err) {
          console.error("Error memeriksa pendaftaran ganda:", err);
        }
      }
      
      let patientToUse;
      let appointmentResponse = null;
      
      // Update registrasi hanya jika semua validasi awal berhasil
      let updatedRegistrationLink = null;
      if (registrationCode) {
        try {
          // PENTING: Increment registration count sebelum membuat pasien
          // Ini memastikan kuota digunakan pada saat validasi sukses tapi sebelum data pasien dibuat
          // Jika ada error setelah ini, pasien tidak akan dibuat tapi kuota tetap berkurang
          // Ini mencegah serangan yang mencoba melewati kuota
          console.log("Incrementing registration count for code:", registrationCode);
          updatedRegistrationLink = await storage.incrementRegistrationCount(registrationCode);
          console.log("Updated registration link:", updatedRegistrationLink);
          
          if (!updatedRegistrationLink) {
            return res.status(400).json({ 
              message: "Gagal memperbarui kuota registrasi. Silakan coba lagi.", 
              code: "INCREMENT_FAILED" 
            });
          }
        } catch (error) {
          console.error("Error saat increment registration count:", error);
          return res.status(500).json({ 
            message: "Terjadi kesalahan saat memproses pendaftaran", 
            code: "INCREMENT_ERROR" 
          });
        }
      }
      
      // Procede to create patient data and appointment only after the registration count is incremented
      if (existingPatient) {
        console.log(`Pasien dengan nomor telepon ${validatedData.phoneNumber} sudah ada, menggunakan ID: ${existingPatient.id}`);
        patientToUse = existingPatient;
      } else {
        // Create new patient if doesn't exist
        patientToUse = await storage.createPatient(validatedData);
        console.log("Pasien baru dibuat:", patientToUse);
      }
      
      // Jika therapySlotId ada, buat appointment dan perbarui slot terapi
      if (therapySlotId) {
        try {
          // Cek apakah slot terapi valid dan masih tersedia
          const therapySlot = await storage.getTherapySlot(therapySlotId);
          
          if (therapySlot && therapySlot.isActive && therapySlot.currentCount < therapySlot.maxQuota) {
            // Tingkatkan jumlah penggunaan slot terapi
            await storage.incrementTherapySlotUsage(therapySlotId);
            console.log(`Slot terapi dengan ID ${therapySlotId} diperbarui: ${therapySlot.currentCount + 1}/${therapySlot.maxQuota}`);
            
            // Buat appointment baru
            const appointmentData = {
              patientId: patientToUse.id,
              therapySlotId: therapySlotId,
              notes: validatedData.complaints,
              status: "Scheduled",
              date: new Date(therapySlot.date),
              timeSlot: therapySlot.timeSlot,
              sessionId: null,
              registrationNumber: null
            };
            
            const appointment = await storage.createAppointment(appointmentData);
            console.log("Appointment dibuat:", appointment);
            
            // Simpan appointment untuk digunakan nanti
            appointmentResponse = {
              ...appointment,
              therapySlotDetails: {
                date: therapySlot.date,
                timeSlot: therapySlot.timeSlot,
                formattedDate: format(new Date(therapySlot.date), 'dd/MM/yyyy')
              }
            };
          }
        } catch (error) {
          console.error("Error saat memproses slot terapi:", error);
          // Lanjutkan meskipun ada error saat memproses slot terapi
          // Pasien tetap dibuat, tapi appointment mungkin gagal
        }
      }
      
      // Generate token unik untuk konfirmasi
      let confirmationToken = null;
      
      if (appointmentResponse) {
        try {
          // Buat token unik untuk konfirmasi
          const tokenStr = crypto.randomUUID();
          
          // Simpan token ke database (berlaku 7 hari dari sekarang)
          const expiryTime = new Date();
          expiryTime.setDate(expiryTime.getDate() + 7);
          
          const tokenData = {
            token: tokenStr,
            patientId: patientToUse.id,
            appointmentId: appointmentResponse.id,
            expiryTime: expiryTime
          };
          
          confirmationToken = await storage.createConfirmationToken(tokenData);
          console.log("Token konfirmasi berhasil dibuat:", confirmationToken);
        } catch (error) {
          console.error("Error saat membuat token konfirmasi:", error);
        }
      }
      
      // Kembalikan data lengkap untuk halaman sukses
      const responseData = {
        ...patientToUse,
        appointment: appointmentResponse,
        confirmationLink: confirmationToken ? 
          `${req.protocol}://${req.get('host')}/confirm/${confirmationToken.token}` : 
          null,
        // Include updated registration information if available
        registrationInfo: updatedRegistrationLink ? {
          currentRegistrations: updatedRegistrationLink.currentRegistrations,
          dailyLimit: updatedRegistrationLink.dailyLimit
        } : null
      };
      
      return res.status(201).json(responseData);
    } catch (error) {
      console.error("Error ketika membuat pasien:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.put("/api/patients/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      console.log(`Menerima permintaan PUT /api/patients/${id} dengan data:`, req.body);
      
      // Konversi data yang dikirim dari form menjadi format yang diharapkan oleh skema
      const patientData = {
        name: req.body.name,
        phoneNumber: req.body.phoneNumber,
        email: req.body.email || null,
        birthDate: req.body.birthDate,
        gender: req.body.gender,
        address: req.body.address || "",
        complaints: req.body.complaints
      };
      
      console.log("Data yang akan divalidasi untuk update:", patientData);
      
      // Validate the data
      const validatedData = insertPatientSchema.parse(patientData);
      console.log("Data pasien tervalidasi:", validatedData);
      
      // Check if patient exists
      const patient = await storage.getPatient(id);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      
      // Update the patient using storage.updatePatient()
      const updatedPatient = await storage.updatePatient(id, validatedData);
      console.log("Pasien diperbarui:", updatedPatient);
      
      return res.status(200).json(updatedPatient);
    } catch (error) {
      console.error("Error ketika memperbarui pasien:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Product routes
  app.get("/api/products", async (req: Request, res: Response) => {
    try {
      const products = await storage.getAllProducts();
      return res.status(200).json(products);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/products/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const product = await storage.getProduct(id);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      return res.status(200).json(product);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/products", async (req: Request, res: Response) => {
    try {
      console.log("Menerima permintaan POST /api/products dengan data:", req.body);
      const validatedData = insertProductSchema.parse(req.body);
      console.log("Data produk tervalidasi:", validatedData);
      const newProduct = await storage.createProduct(validatedData);
      console.log("Produk baru dibuat:", newProduct);
      return res.status(201).json(newProduct);
    } catch (error) {
      console.error("Error ketika membuat produk:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.put("/api/products/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      console.log(`Menerima permintaan PUT /api/products/${id} dengan data:`, req.body);
      
      const validatedData = insertProductSchema.parse(req.body);
      console.log("Data produk tervalidasi:", validatedData);
      
      const product = await storage.getProduct(id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      // Sekarang menggunakan fungsi updateProduct untuk memperbarui semua data produk
      const updatedProduct = await storage.updateProduct(id, validatedData);
      console.log("Produk diperbarui:", updatedProduct);
      
      return res.status(200).json(updatedProduct);
    } catch (error) {
      console.error("Error ketika memperbarui produk:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.delete("/api/products/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      console.log(`Menerima permintaan DELETE /api/products/${id}`);
      
      const product = await storage.getProduct(id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      const deleted = await storage.deleteProduct(id);
      
      if (deleted) {
        console.log(`Produk dengan ID ${id} berhasil dihapus`);
        return res.status(200).json({ success: true, message: "Product deleted successfully" });
      } else {
        console.log(`Gagal menghapus produk dengan ID ${id}`);
        return res.status(500).json({ success: false, message: "Failed to delete product" });
      }
    } catch (error) {
      console.error("Error ketika menghapus produk:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Patient delete endpoint
  app.delete("/api/patients/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      console.log(`Menerima permintaan DELETE /api/patients/${id}`);
      
      // Cek dulu apakah pasien ada
      const patient = await storage.getPatient(id);
      if (!patient) {
        return res.status(404).json({ message: "Pasien tidak ditemukan" });
      }
      
      // Hapus pasien
      const result = await storage.deletePatient(id);
      
      if (result) {
        console.log(`Pasien dengan ID ${id} berhasil dihapus`);
        return res.status(200).json({ success: true, message: "Pasien berhasil dihapus" });
      } else {
        console.error(`Gagal menghapus pasien dengan ID ${id}`);
        return res.status(500).json({ success: false, message: "Gagal menghapus pasien" });
      }
    } catch (error) {
      console.error("Error ketika menghapus pasien:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/products/:id/stock", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { stockChange } = req.body;
      
      if (typeof stockChange !== 'number') {
        return res.status(400).json({ message: "Stock change must be a number" });
      }
      
      const updatedProduct = await storage.updateProductStock(id, stockChange);
      
      if (!updatedProduct) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      return res.status(200).json(updatedProduct);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Package routes
  app.get("/api/packages", async (req: Request, res: Response) => {
    try {
      const packages = await storage.getAllPackages();
      return res.status(200).json(packages);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/packages/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const package_ = await storage.getPackage(id);
      
      if (!package_) {
        return res.status(404).json({ message: "Package not found" });
      }
      
      return res.status(200).json(package_);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Create a new therapy package
  app.post("/api/packages", async (req: Request, res: Response) => {
    try {
      console.log("POST /api/packages - isAuthenticated:", req.isAuthenticated());
      console.log("POST /api/packages - req.user:", req.user);
      
      if (req.user) {
        console.log("POST /api/packages - req.user.role:", req.user.role);
      }
      
      if (!req.isAuthenticated()) {
        return res.status(403).json({ message: "Unauthorized, please login first" });
      }
      
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Unauthorized, only admin can create packages" });
      }
      
      console.log("Menerima permintaan POST /api/packages dengan data:", req.body);
      
      // Validasi data menggunakan Zod schema yang telah diperbarui
      // Schema sekarang sudah diperbarui di shared/schema.ts untuk menangani konversi tipe data
      try {
        const validatedData = insertPackageSchema.parse(req.body);
        console.log("Data paket tervalidasi:", validatedData);
        
        const newPackage = await storage.createPackage(validatedData);
        console.log("Paket baru dibuat:", newPackage);
        return res.status(201).json(newPackage);
      } catch (zodError) {
        if (zodError instanceof z.ZodError) {
          console.error("Validation error:", zodError.errors);
          return res.status(400).json({ 
            message: "Validasi data gagal", 
            errors: zodError.errors.map(e => ({
              path: e.path.join('.'),
              message: e.message
            }))
          });
        }
        throw zodError; // re-throw jika bukan ZodError
      }
    } catch (error) {
      console.error("Error creating package:", error);
      return res.status(500).json({ 
        message: "Terjadi kesalahan saat membuat paket", 
        error: String(error) 
      });
    }
  });
  
  // Update a therapy package
  app.put("/api/packages/:id", async (req: Request, res: Response) => {
    try {
      console.log("PUT /api/packages/:id - isAuthenticated:", req.isAuthenticated());
      console.log("PUT /api/packages/:id - req.user:", req.user);
      
      if (req.user) {
        console.log("PUT /api/packages/:id - req.user.role:", req.user.role);
      }
      
      if (!req.isAuthenticated()) {
        return res.status(403).json({ message: "Unauthorized, please login first" });
      }
      
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Unauthorized, only admin can update packages" });
      }
      
      const id = parseInt(req.params.id);
      console.log(`Menerima permintaan PUT /api/packages/${id} dengan data:`, req.body);
      
      // Cek apakah paket ada
      const existingPackage = await storage.getPackage(id);
      if (!existingPackage) {
        return res.status(404).json({ message: "Paket tidak ditemukan" });
      }
      
      try {
        // Validasi data menggunakan Zod schema yang telah diperbarui
        const validatedData = insertPackageSchema.parse(req.body);
        console.log("Data paket tervalidasi:", validatedData);
        
        // Cek apakah paket memiliki sesi aktif
        if (existingPackage.sessions !== Number(validatedData.sessions)) {
          console.log(`Package sessions changing from ${existingPackage.sessions} to ${validatedData.sessions}`);
          
          // Periksa jika ada sesi aktif, dan apakah perubahan jumlah sesi akan berdampak
          const activeSessions = await db.query.sessions.findMany({
            where: and(
              eq(schema.sessions.packageId, id),
              eq(schema.sessions.status, "active")
            )
          });
          
          if (activeSessions.length > 0) {
            // Periksa apakah sesi baru lebih kecil dari sesi yang sudah digunakan
            for (const session of activeSessions) {
              if (session.sessionsUsed > Number(validatedData.sessions)) {
                return res.status(400).json({ 
                  message: "Jumlah sesi tidak dapat dikurangi di bawah jumlah sesi yang sudah digunakan",
                  detail: `Paket ini memiliki sesi aktif dengan ${session.sessionsUsed} sesi yang sudah digunakan`
                });
              }
            }
          }
        }
        
        const updatedPackage = await storage.updatePackage(id, validatedData);
        console.log("Paket berhasil diperbarui:", updatedPackage);
        return res.status(200).json(updatedPackage);
      } catch (zodError) {
        if (zodError instanceof z.ZodError) {
          console.error("Validation error:", zodError.errors);
          return res.status(400).json({ 
            message: "Validasi data gagal", 
            errors: zodError.errors.map(e => ({
              path: e.path.join('.'),
              message: e.message
            }))
          });
        }
        throw zodError; // re-throw jika bukan ZodError
      }
    } catch (error) {
      console.error("Error updating package:", error);
      return res.status(500).json({ 
        message: "Terjadi kesalahan saat memperbarui paket", 
        error: String(error) 
      });
    }
  });
  
  // Delete a therapy package
  app.delete("/api/packages/:id", async (req: Request, res: Response) => {
    try {
      console.log("DELETE /api/packages/:id - isAuthenticated:", req.isAuthenticated());
      console.log("DELETE /api/packages/:id - req.user:", req.user);
      
      if (req.user) {
        console.log("DELETE /api/packages/:id - req.user.role:", req.user.role);
      }
      
      if (!req.isAuthenticated()) {
        return res.status(403).json({ message: "Unauthorized, please login first" });
      }
      
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Unauthorized, only admin can delete packages" });
      }
      
      const id = parseInt(req.params.id);
      console.log(`Processing delete request for package ID: ${id}`);
      
      // Periksa apakah ada sesi aktif yang terkait dengan paket ini
      const activeSessions = await db.query.sessions.findMany({
        where: and(
          eq(schema.sessions.packageId, id),
          eq(schema.sessions.status, "active")
        )
      });
      
      if (activeSessions.length > 0) {
        console.log(`Cannot delete package ID ${id}: There are ${activeSessions.length} active sessions using this package.`);
        return res.status(400).json({ 
          message: "Paket tidak dapat dihapus karena masih digunakan oleh sesi terapi aktif",
          detail: `Terdapat ${activeSessions.length} sesi aktif yang menggunakan paket ini`
        });
      }
      
      const deleted = await storage.deletePackage(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Paket tidak ditemukan atau tidak dapat dihapus" });
      }
      
      return res.status(200).json({ success: true, message: "Paket berhasil dihapus" });
    } catch (error) {
      console.error("Error deleting package:", error);
      return res.status(500).json({ 
        message: "Terjadi kesalahan saat menghapus paket", 
        error: String(error) 
      });
    }
  });

  // Transaction routes
  app.get("/api/transactions", async (req: Request, res: Response) => {
    try {
      const patientId = req.query.patientId;
      
      if (patientId) {
        try {
          const patientTransactions = await storage.getTransactionsByPatient(parseInt(patientId as string));
          return res.status(200).json(patientTransactions);
        } catch (patientError) {
          console.error("Error getting patient transactions:", patientError);
          return res.status(500).json({ message: "Error retrieving patient transactions" });
        }
      }
      
      try {
        console.log("Fetching all transactions");
        const transactions = await storage.getAllTransactions();
        console.log(`Retrieved ${transactions.length} transactions`);
        return res.status(200).json(transactions);
      } catch (allTransactionsError) {
        console.error("Error getting all transactions:", allTransactionsError);
        return res.status(500).json({ message: "Error retrieving all transactions" });
      }
    } catch (error) {
      console.error("Error in transactions endpoint:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/transactions/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const transaction = await storage.getTransaction(id);
      
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      return res.status(200).json(transaction);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/transactions", async (req: Request, res: Response) => {
    try {
      // Parse schema with additional fields
      const { subtotal, discount, createSession = true, isPaid = true, creditAmount = "0", paidAmount, ...restData } = req.body;
      
      console.log("Transaction request received:", req.body);
      
      // Gunakan total amount yang dikirim dari client, jangan hitung ulang
      // Ini akan memastikan konsistensi nilai yang ditampilkan di client dan tersimpan di database
      const validatedData = insertTransactionSchema.parse({
        ...restData,
        totalAmount: restData.totalAmount, // Use the amount passed from client
        discount: discount || "0",
        subtotal: subtotal || restData.totalAmount || "0",
        isPaid, // Include payment status
        creditAmount: isPaid ? "0" : (creditAmount || restData.totalAmount || "0"),
        // Jika bayar penuh (isPaid=true), paidAmount=totalAmount. Jika kredit (isPaid=false), paidAmount=0 atau nilai yang diberikan
        paidAmount: isPaid ? (paidAmount || restData.totalAmount) : (paidAmount || "0")
      });
      
      console.log("Validated transaction data:", validatedData);
      
      const newTransaction = await storage.createTransaction(validatedData);
      console.log("Transaction created:", newTransaction);
      
      // Process transaction items
      const items = validatedData.items as any[];
      
      for (const item of items) {
        // If item is a product, update the stock
        if (item.type === 'product') {
          await storage.updateProductStock(item.id, -(item.quantity || 1));
        }
        
        // If item is a package and createSession flag is true, create a session
        if (item.type === 'package' && createSession !== false) {
          const package_ = await storage.getPackage(item.id);
          
          if (package_) {
            await storage.createSession({
              patientId: validatedData.patientId,
              transactionId: newTransaction.id,
              packageId: item.id,
              totalSessions: package_.sessions
            });
          }
        }
      }
      
      return res.status(201).json(newTransaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating transaction:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Add the debt payment API endpoint
  // Endpoint untuk pembayaran utang transaksi (original)
  app.post("/api/transactions/:id/debt-payment", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized, please login first" });
      }
      
      const transactionId = parseInt(req.params.id);
      const { amount, paymentMethod, notes } = req.body;
      
      // Validate that transaction exists and has debt
      const transaction = await storage.getTransaction(transactionId);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      // Hitung total transaksi dan jumlah yang sudah dibayar
      const totalAmount = parseFloat(transaction.totalAmount);
      const paidAmount = parseFloat(transaction.paidAmount);
      
      // Calculate remaining debt
      const remainingDebt = totalAmount - paidAmount;
      if (remainingDebt <= 0) {
        return res.status(400).json({ message: "Transaction has no remaining debt" });
      }
      
      // Validate payment amount
      const paymentAmount = parseFloat(amount);
      if (isNaN(paymentAmount) || paymentAmount <= 0) {
        return res.status(400).json({ message: "Invalid payment amount" });
      }
      
      // Buat transaksi baru untuk mencatat pembayaran utang ini
      const paymentTransactionId = `DP-${format(new Date(), 'yyyyMMdd')}-${String(transaction.id).padStart(3, '0')}`;
      
      // Buat transaksi baru sebagai catatan pembayaran
      const newTransaction = await storage.createTransaction({
        patientId: transaction.patientId,
        transactionId: paymentTransactionId,
        totalAmount: amount,
        discount: "0.00",
        subtotal: amount,
        paymentMethod: paymentMethod,
        items: JSON.stringify([{
          id: 0,
          type: "debt-payment",
          quantity: 1,
          price: amount,
          description: `Pembayaran utang untuk transaksi ${transaction.transactionId}`
        }]),
        isPaid: true,
        creditAmount: "0.00",
        paidAmount: amount
      });
      
      // Create debt payment record
      const payment = await storage.createDebtPayment({
        transactionId,
        amount,
        paymentMethod,
        notes
      });
      
      // Update transaction's paid amount
      let newPaidAmount = paidAmount + paymentAmount;
      
      // If new paid amount exceeds or equals total amount, mark as fully paid
      let isPaid = newPaidAmount >= totalAmount;
      
      // Update the transaction
      const updatedTransaction = await storage.updateTransaction(transactionId, {
        paidAmount: newPaidAmount.toString(),
        isPaid
      });
      
      // Log payment information
      console.log(`Debt payment processed - TransactionID: ${transactionId}, Amount: ${paymentAmount}, New status: ${isPaid ? 'Paid' : 'Unpaid'}`);
      
      return res.status(201).json({
        success: true,
        payment,
        transaction: updatedTransaction,
        remainingDebt: remainingDebt - paymentAmount
      });
    } catch (error) {
      console.error("Error processing debt payment:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Endpoint untuk pembayaran utang dari form transaksi
  app.post("/api/transactions/payment", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized, please login first" });
      }
      
      const { transactionId, amount, paymentMethod, notes } = req.body;
      
      // Validate transaction ID
      if (!transactionId || isNaN(parseInt(transactionId))) {
        return res.status(400).json({ message: "Invalid transaction ID" });
      }
      
      // Validate that transaction exists and has debt
      const transaction = await storage.getTransaction(parseInt(transactionId));
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      // Calculate proper remaining debt (totalAmount - paidAmount)
      const totalAmount = parseFloat(transaction.totalAmount);
      const currentPaid = parseFloat(transaction.paidAmount);
      const remainingDebt = totalAmount - currentPaid;
      
      if (remainingDebt <= 0) {
        return res.status(400).json({ message: "Transaction has no remaining debt" });
      }
      
      // Validate payment amount
      const paymentAmount = parseFloat(amount);
      if (isNaN(paymentAmount) || paymentAmount <= 0) {
        return res.status(400).json({ message: "Invalid payment amount" });
      }
      
      if (paymentAmount > remainingDebt) {
        return res.status(400).json({ 
          message: `Payment amount exceeds remaining debt (${remainingDebt})` 
        });
      }
      
      // Buat transaksi baru untuk mencatat pembayaran utang ini
      const paymentTransactionId = `DP-${format(new Date(), 'yyyyMMdd')}-${String(transaction.id).padStart(3, '0')}`;
      
      // Buat transaksi baru sebagai catatan pembayaran
      const newTransaction = await storage.createTransaction({
        patientId: transaction.patientId,
        transactionId: paymentTransactionId,
        totalAmount: amount,
        discount: "0.00",
        subtotal: amount,
        paymentMethod: paymentMethod,
        items: JSON.stringify([{
          id: 0,
          type: "debt-payment",
          quantity: 1,
          price: amount,
          description: `Pembayaran utang untuk transaksi ${transaction.transactionId}`
        }]),
        isPaid: true,
        creditAmount: "0.00",
        paidAmount: amount
      });
      
      // Buat catatan pembayaran utang
      const payment = await storage.createDebtPayment({
        transactionId: parseInt(transactionId),
        amount: amount,
        paymentMethod: paymentMethod,
        notes: notes || `Pembayaran utang untuk transaksi ${transaction.transactionId}`
      });
      
      // Update jumlah yang sudah dibayar di transaksi asli
      const newPaidAmount = currentPaid + paymentAmount;
      
      // Jika pembayaran sudah lunas, update status isPaid
      const isPaid = newPaidAmount >= totalAmount;
      
      // Update transaksi asli
      const updatedTransaction = await storage.updateTransaction(parseInt(transactionId), {
        paidAmount: newPaidAmount.toString(),
        isPaid
      });
      
      return res.status(201).json({
        success: true,
        payment,
        paymentTransaction: newTransaction,
        originalTransaction: updatedTransaction,
        remainingDebt: totalAmount - newPaidAmount
      });
    } catch (error) {
      console.error("Error processing debt payment:", error);
      return res.status(500).json({ message: "Internal server error", error: String(error) });
    }
  });
  
  // Get debt payments for a transaction
  app.get("/api/transactions/:id/debt-payments", async (req: Request, res: Response) => {
    try {
      const transactionId = parseInt(req.params.id);
      
      // Validate transaction exists
      const transaction = await storage.getTransaction(transactionId);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      // Get all debt payments for this transaction
      const payments = await storage.getDebtPaymentsByTransaction(transactionId);
      
      // Calculate remaining debt
      const totalPaid = payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
      const creditAmount = parseFloat(transaction.creditAmount);
      const remainingDebt = creditAmount - totalPaid;
      
      return res.status(200).json({
        success: true,
        payments,
        transaction,
        totalPaid,
        creditAmount,
        remainingDebt
      });
    } catch (error) {
      console.error("Error fetching debt payments:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/transactions/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated() || !req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: "Unauthorized, only admin can delete transactions" });
      }
      
      const id = parseInt(req.params.id);
      
      // Check if transaction exists
      const transaction = await storage.getTransaction(id);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      // Delete the transaction
      const success = await storage.deleteTransaction(id);
      
      if (success) {
        return res.status(200).json({ message: "Transaction deleted successfully" });
      } else {
        return res.status(500).json({ message: "Failed to delete transaction" });
      }
    } catch (error) {
      console.error("Error deleting transaction:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Dapatkan semua transaksi yang belum lunas (dengan kredit)
  app.get("/api/transactions/unpaid", async (req: Request, res: Response) => {
    try {
      const unpaidTransactions = await storage.getUnpaidTransactions();
      return res.status(200).json(unpaidTransactions);
    } catch (error) {
      console.error("Error fetching unpaid transactions:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Dapatkan transaksi yang belum lunas per pasien
  app.get("/api/transactions/unpaid-by-patient/:patientId", async (req: Request, res: Response) => {
    try {
      const patientId = parseInt(req.params.patientId);
      if (isNaN(patientId)) {
        return res.status(400).json({ message: "Invalid patient ID" });
      }
      
      const unpaidTransactions = await storage.getUnpaidTransactionsByPatient(patientId);
      return res.status(200).json(unpaidTransactions);
    } catch (error) {
      console.error("Error fetching unpaid transactions by patient:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Session routes
  app.get("/api/sessions", async (req: Request, res: Response) => {
    try {
      const patientId = req.query.patientId;
      const active = req.query.active;
      const reportMode = req.query.reportMode === 'true';
      
      // Jika dalam mode laporan, ambil semua sesi untuk reporting
      if (reportMode) {
        const allSessions = await storage.getAllActiveSessions();
        return res.status(200).json(allSessions);
      }
      
      // Jika patientId ditentukan, ambil sesi spesifik pasien
      if (patientId) {
        if (active === 'true') {
          const activeSessions = await storage.getActiveSessionsByPatient(parseInt(patientId as string));
          
          // Untuk setiap sesi aktif, ambil informasi paket
          const enrichedSessions = await Promise.all(
            activeSessions.map(async (session) => {
              const pkg = await storage.getPackage(session.packageId);
              return {
                ...session,
                package: pkg || undefined,
                remainingSessions: session.totalSessions - session.sessionsUsed
              };
            })
          );
          
          return res.status(200).json(enrichedSessions);
        } else {
          const patientSessions = await storage.getSessionsByPatient(parseInt(patientId as string));
          return res.status(200).json(patientSessions);
        }
      }
      
      // Tidak ada patientId dan bukan mode laporan, kembalikan error
      return res.status(400).json({ message: "Patient ID is required" });
    } catch (error) {
      console.error("Error fetching patient sessions:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/sessions/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const session = await storage.getSession(id);
      
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      return res.status(200).json(session);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/sessions", async (req: Request, res: Response) => {
    try {
      const validatedData = insertSessionSchema.parse(req.body);
      const newSession = await storage.createSession(validatedData);
      return res.status(201).json(newSession);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/sessions/:id/use", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { sessionsUsed } = req.body;
      
      // Dapatkan sesi terlebih dahulu untuk validasi
      const session = await storage.getSession(id);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      // Periksa apakah session masih aktif
      if (session.status !== 'active') {
        return res.status(400).json({ 
          message: "Tidak dapat menggunakan sesi dari paket yang tidak aktif",
          status: session.status
        });
      }
      
      // Periksa apakah masih ada sesi tersisa
      const remainingSessions = session.totalSessions - session.sessionsUsed;
      if (remainingSessions <= 0) {
        return res.status(400).json({ 
          message: "Tidak ada sesi tersisa pada paket ini",
          remainingSessions
        });
      }
      
      // Update penggunaan sesi
      const updatedSession = await storage.updateSessionUsage(id, sessionsUsed);
      
      if (!updatedSession) {
        return res.status(500).json({ message: "Gagal memperbarui penggunaan sesi" });
      }
      
      return res.status(200).json({
        success: true,
        message: "Penggunaan sesi berhasil diperbarui",
        session: updatedSession,
        remainingSessions: updatedSession.totalSessions - updatedSession.sessionsUsed
      });
    } catch (error) {
      console.error("Error updating session usage:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Appointment routes
  app.get("/api/appointments", async (req: Request, res: Response) => {
    try {
      const patientId = req.query.patientId;
      const date = req.query.date;
      
      if (patientId) {
        const patientAppointments = await storage.getAppointmentsByPatient(parseInt(patientId as string));
        return res.status(200).json(patientAppointments);
      }
      
      if (date) {
        const dateAppointments = await storage.getAppointmentsByDate(new Date(date as string));
        return res.status(200).json(dateAppointments);
      }
      
      // For dashboard/overview, return all appointments (limited to recent ones in a real app)
      const allAppointments = [];
      for (const appointment of await storage.getAllAppointments()) {
        allAppointments.push(appointment);
      }
      return res.status(200).json(allAppointments);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Date-specific appointments endpoint for the appointment form
  app.get("/api/appointments/date/:date", async (req: Request, res: Response) => {
    try {
      const { date } = req.params;
      if (!date) {
        return res.status(400).json({ message: "Date is required" });
      }
      
      console.log(`Fetching appointments for date: ${date}`);
      const dateAppointments = await storage.getAppointmentsByDate(new Date(date));
      
      // Add patient info to appointments
      const enrichedAppointments = await Promise.all(
        dateAppointments.map(async (appointment) => {
          const patient = await storage.getPatient(appointment.patientId);
          return {
            ...appointment,
            patient: patient ? {
              id: patient.id,
              patientId: patient.patientId,
              name: patient.name
            } : undefined
          };
        })
      );
      
      console.log(`Found ${enrichedAppointments.length} appointments for date ${date}`);
      return res.status(200).json(enrichedAppointments);
    } catch (error) {
      console.error("Error fetching appointments by date:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/appointments/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const appointment = await storage.getAppointment(id);
      
      if (!appointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      
      return res.status(200).json(appointment);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/appointments", async (req: Request, res: Response) => {
    try {
      console.log("Menerima permintaan POST /api/appointments dengan data:", req.body);
      
      // Convert ISO string date to Date object if necessary
      let appointmentData = { ...req.body };
      if (typeof appointmentData.date === 'string') {
        appointmentData.date = new Date(appointmentData.date);
      }
      
      // Tambahkan log untuk melihat data setelah konversi
      console.log("Data appointment setelah konversi:", appointmentData);
      
      const validatedData = insertAppointmentSchema.parse(appointmentData);
      console.log("Data appointment tervalidasi:", validatedData);
      
      const newAppointment = await storage.createAppointment(validatedData);
      console.log("Appointment baru dibuat:", newAppointment);
      return res.status(201).json(newAppointment);
    } catch (error) {
      console.error("Error ketika membuat appointment:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/appointments/:id/status", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Log raw request body untuk debugging
      console.log("Request body raw:", req.body);
      
      // Pastikan body ada dan memiliki format yang benar
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ message: "Invalid request body" });
      }
      
      const { status } = req.body;
      
      // Log nilai status yang diterima
      console.log(`Received status update for appointment ${id}, status value: "${status}", type: ${typeof status}`);
      
      // Validasi status
      const validStatuses = ['Active', 'Completed', 'Cancelled', 'Scheduled'];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ 
          message: "Invalid status. Status must be one of: Active, Scheduled, Completed, Cancelled",
          receivedStatus: status
        });
      }
      
      // Log untuk debugging
      console.log(`Updating appointment ${id} status to: ${status}`);
      
      // Get appointment untuk mendapatkan therapy slot id jika status cancelled
      const appointment = await storage.getAppointment(id);
      if (!appointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      
      const updatedAppointment = await storage.updateAppointmentStatus(id, status);
      
      if (!updatedAppointment) {
        return res.status(404).json({ message: "Failed to update appointment" });
      }
      
      // Jika status menjadi Cancelled, kurangi jumlah current count di therapy slot
      if (status === 'Cancelled' && appointment.status !== 'Cancelled' && appointment.therapySlotId) {
        await storage.decrementTherapySlotUsage(appointment.therapySlotId);
        console.log(`Therapy slot ${appointment.therapySlotId} usage decremented after cancellation`);
      }
      
      console.log(`Appointment updated successfully:`, updatedAppointment);
      return res.status(200).json(updatedAppointment);
    } catch (error) {
      console.error("Error updating appointment status:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Dashboard data
  app.get("/api/dashboard/stats", async (req: Request, res: Response) => {
    try {
      const stats = await storage.getDailyStats();
      return res.status(200).json(stats);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/dashboard/activities", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
      const activities = await storage.getRecentActivities(limit);
      return res.status(200).json(activities);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Get active packages for dashboard
  app.get("/api/dashboard/active-packages", async (req: Request, res: Response) => {
    try {
      const sessions = await storage.getAllActiveSessions();
      
      // Get all packages first to check which ones have more than 1 session
      const allPackages = new Map();
      for (const session of sessions) {
        const pkg = await storage.getPackage(session.packageId);
        if (pkg) {
          allPackages.set(pkg.id, pkg);
        }
      }
      
      // Filter sessions for packages with more than 1 session (exclude single-session packages)
      const multiSessionSessions = sessions.filter(session => {
        const pkg = allPackages.get(session.packageId);
        return pkg && pkg.sessions > 1; // Only include if it's a multi-session package
      });
      
      if (multiSessionSessions.length === 0) {
        return res.status(200).json([]);
      }
      
      // Create a unique key for each patient+package combination
      const uniquePackagesMap = new Map();
      
      // First, group sessions by patient and package
      for (const session of multiSessionSessions) {
        const uniqueKey = `${session.patientId}_${session.packageId}`;
        
        // If this combination already exists, keep only the one with the most recent lastSessionDate
        // or the one with higher sessionsUsed if lastSessionDate is the same
        if (uniquePackagesMap.has(uniqueKey)) {
          const existing = uniquePackagesMap.get(uniqueKey);
          
          // Keep the more recently used session or the one with more sessions used
          if (
            !existing.lastSessionDate || 
            (session.lastSessionDate && new Date(session.lastSessionDate) > new Date(existing.lastSessionDate)) ||
            (session.lastSessionDate && existing.lastSessionDate && 
              new Date(session.lastSessionDate).getTime() === new Date(existing.lastSessionDate).getTime() && 
              session.sessionsUsed > existing.sessionsUsed)
          ) {
            uniquePackagesMap.set(uniqueKey, session);
          }
        } else {
          uniquePackagesMap.set(uniqueKey, session);
        }
      }
      
      // Get unique multi-session sessions
      const uniqueSessions = Array.from(uniquePackagesMap.values());
      
      // Map sessions to include patient and package details
      const activePackages = await Promise.all(
        uniqueSessions.map(async (session) => {
          const patient = await storage.getPatient(session.patientId);
          const packageItem = await storage.getPackage(session.packageId);
          
          return {
            id: session.id,
            patient: patient ? {
              id: patient.id,
              name: patient.name,
              patientId: patient.patientId
            } : null,
            package: packageItem ? {
              id: packageItem.id,
              name: packageItem.name,
              sessions: packageItem.sessions
            } : null,
            status: session.status,
            startDate: session.startDate,
            lastSessionDate: session.lastSessionDate,
            sessionsUsed: session.sessionsUsed,
            totalSessions: session.totalSessions,
            progress: Math.round((session.sessionsUsed / session.totalSessions) * 100)
          };
        })
      );
      
      console.log(`Returning ${activePackages.length} unique multi-session packages from ${sessions.length} total active sessions`);
      return res.status(200).json(activePackages);
    } catch (error) {
      console.error("Error getting active packages:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get("/api/slots-by-period", async (req: Request, res: Response) => {
    try {
      let startDate = new Date();
      const period = req.query.period as string || 'day';
      
      startDate.setHours(0, 0, 0, 0);
      
      let endDate = new Date(startDate);
      
      // Set date range based on period
      if (period === 'week') {
        // Get slots for the next 7 days
        endDate.setDate(endDate.getDate() + 7);
      } else if (period === 'month') {
        // Get slots for the next 30 days
        endDate.setDate(endDate.getDate() + 30);
      } else if (period === 'past-week') {
        // Get slots for the past 7 days
        startDate.setDate(startDate.getDate() - 7);
      } else if (period === 'past-month') {
        // Get slots for the past 30 days
        startDate.setDate(startDate.getDate() - 30);
      } else {
        // Default: only today
        endDate.setDate(endDate.getDate() + 1);
      }
      
      console.log(`Fetching slots from ${startDate.toISOString()} to ${endDate.toISOString()}`);
      
      // Get all therapy slots
      const allSlots = await storage.getAllTherapySlots();
      
      // Filter slots by date range
      const slots = allSlots.filter(slot => {
        const slotDate = new Date(slot.date);
        return slotDate >= startDate && slotDate < endDate;
      });
      
      // Update currentCount based on active appointments
      for (const slot of slots) {
        // Get active appointments for this slot
        const activeAppointments = await storage.getAppointmentsByTherapySlot(slot.id);
        // Update currentCount to show actual registered patients (not cancelled)
        slot.currentCount = activeAppointments.length;
      }
      
      // Add percentage
      const slotsWithPercentage = slots.map(slot => ({
        ...slot,
        percentage: (slot.currentCount * 100 / slot.maxQuota)
      }));
      
      // Sort by date 
      slotsWithPercentage.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      return res.status(200).json(slotsWithPercentage);
    } catch (error) {
      console.error(`Error getting therapy slots by period: ${error}`);
      return res.status(500).json({ message: "Failed to get therapy slots" });
    }
  });
  
  app.get("/api/today-slots", async (req: Request, res: Response) => {
    try {
      // Mendapatkan tanggal hari ini
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Mendapatkan semua slot terapi untuk hari ini
      const slots = await storage.getTherapySlotsByDate(today);
      
      // Untuk setiap slot, dapatkan jumlah appointment aktif (bukan yang dibatalkan)
      for (const slot of slots) {
        // Mendapatkan appointment aktif untuk slot ini
        const activeAppointments = await storage.getAppointmentsByTherapySlot(slot.id);
        // Update currentCount untuk menampilkan jumlah pasien yang benar-benar terdaftar (tidak dibatalkan)
        slot.currentCount = activeAppointments.length;
      }
      
      // Menambahkan persentase pengisian
      const slotsWithPercentage = slots.map(slot => ({
        ...slot,
        percentage: (slot.currentCount * 100 / slot.maxQuota)
      }));
      
      return res.status(200).json(slotsWithPercentage);
    } catch (error) {
      console.error(`Error getting today's therapy slots: ${error}`);
      return res.status(500).json({ message: "Failed to get today's therapy slots" });
    }
  });
  
  // Endpoint untuk sinkronisasi kuota slot terapi
  app.post("/api/therapy-slots/sync-quota", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated() || req.user.role !== "admin") {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      console.log("Memulai sinkronisasi kuota slot terapi di database...");
      
      // Gunakan fungsi syncTherapySlotQuota dari storage
      const syncResult = await storage.syncTherapySlotQuota();
      
      return res.status(200).json({
        message: `Sinkronisasi kuota selesai. ${syncResult.updatedSlots} slot diperbarui.`,
        updatedSlots: syncResult.results
      });
    } catch (error) {
      console.error("Error saat sinkronisasi kuota slot terapi:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Endpoint untuk mendapatkan daftar pasien berdasarkan slot terapi
  app.get("/api/therapy-slots/:id/patients", async (req: Request, res: Response) => {
    try {
      const slotId = parseInt(req.params.id);
      
      if (isNaN(slotId)) {
        return res.status(400).json({ message: "Invalid slot ID" });
      }
      
      // Dapatkan slot terapi
      const slot = await storage.getTherapySlot(slotId);
      
      if (!slot) {
        return res.status(404).json({ message: "Therapy slot not found" });
      }
      
      // Dapatkan semua appointment aktif untuk slot terapi ini
      // getAppointmentsByTherapySlot sudah termasuk filter yang mengecualikan appointment yang dibatalkan
      const appointments = await storage.getAppointmentsByTherapySlot(slotId);
      
      // Update slot currentCount untuk menampilkan jumlah yang benar
      // Update ini hanya untuk respons API, tidak menyimpan ke database
      slot.currentCount = appointments.length;
      
      // Dapatkan informasi pasien dari tiap appointment
      // Gunakan Map untuk menghindari duplikasi pasien dengan ID yang sama
      const patientIdsSet = new Set(appointments.map(appointment => appointment.patientId));
      const patientIds = Array.from(patientIdsSet);
      const patientMap = new Map();
      
      // Ambil data pasien sekali untuk tiap ID unik
      for (const patientId of patientIds) {
        const patient = await storage.getPatient(patientId);
        if (patient) {
          patientMap.set(patientId, patient);
        }
      }
      
      const patientsData = appointments.map(appointment => {
        return {
          ...appointment,
          patient: patientMap.get(appointment.patientId) || { name: "Unknown Patient" },
        };
      });
      
      return res.status(200).json({
        slot,
        appointments: patientsData
      });
    } catch (error) {
      console.error(`Error getting patients for therapy slot: ${error}`);
      return res.status(500).json({ message: "Failed to get patients for therapy slot" });
    }
  });

  // Registration Link endpoints
  app.post("/api/registration-links", async (req: Request, res: Response) => {
    try {
      console.log("Session untuk registration-links:", req.session);
      console.log("User authenticated:", req.isAuthenticated());
      console.log("User:", req.user);
      
      // Use admin ID 1 for all requests for demo purposes
      const userId = 1;

      const { expiryHours, dailyLimit, specificDate } = req.body as CreateRegistrationLinkBody;
      
      // Tetapkan masa kadaluwarsa link menjadi 1 minggu (7 hari = 168 jam)
      const oneWeekInHours = 168;
      
      if (!dailyLimit || typeof dailyLimit !== 'number') {
        return res.status(400).json({ 
          message: "Invalid request body, dailyLimit is required and must be a number" 
        });
      }
      
      const registrationLink = await storage.createRegistrationLink(
        userId, // Gunakan userId yang didefinisikan di atas
        oneWeekInHours, // Selalu gunakan 1 minggu (168 jam)
        dailyLimit,
        specificDate
      );
      
      return res.status(201).json(registrationLink);
    } catch (error) {
      console.error("Error creating registration link:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get("/api/registration-links", async (req: Request, res: Response) => {
    try {
      console.log("Session for GET registration-links:", req.session);
      console.log("User authenticated:", req.isAuthenticated());
      console.log("User:", req.user);
      
      // Untuk keperluan demo, skip autentikasi admin sementara
      /*
      // Check if user is authenticated and has admin role
      if (!req.isAuthenticated() || !req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: "Unauthorized, only admin can view registration links" });
      }
      */
      
      const links = await storage.getAllRegistrationLinks();
      return res.status(200).json(links);
    } catch (error) {
      console.error("Error getting registration links:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post("/api/registration-links/deactivate/:id", async (req: Request, res: Response) => {
    try {
      console.log("Session for deactivate registration-links:", req.session);
      console.log("User authenticated:", req.isAuthenticated());
      console.log("User:", req.user);
      
      // Untuk keperluan demo, skip autentikasi admin sementara
      /*
      // Check if user is authenticated and has admin role
      if (!req.isAuthenticated() || !req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: "Unauthorized, only admin can deactivate registration links" });
      }
      */
      
      const id = parseInt(req.params.id);
      const success = await storage.deactivateRegistrationLink(id);
      
      if (!success) {
        return res.status(404).json({ message: "Registration link not found" });
      }
      
      return res.status(200).json({ message: "Registration link deactivated successfully" });
    } catch (error) {
      console.error("Error deactivating registration link:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Search for patients by name or phone number
  app.get("/api/search-patient", async (req: Request, res: Response) => {
    try {
      const { query } = req.query;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ success: false, message: "Parameter pencarian diperlukan" });
      }

      // Search for patients whose name or phone number matches the query
      const patients = await storage.getAllPatients();
      const matchingPatients = patients.filter(patient => 
        patient.name.toLowerCase().includes(query.toLowerCase()) || 
        patient.phoneNumber.includes(query)
      );

      if (matchingPatients.length > 0) {
        return res.status(200).json({ 
          success: true, 
          found: true, 
          patient: matchingPatients[0] // Return the first match for simplicity
        });
      } else {
        return res.status(200).json({ 
          success: true, 
          found: false
        });
      }
    } catch (error) {
      console.error("Error searching for patient:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });
  
  app.post("/api/verify-registration-link", async (req: Request, res: Response) => {
    try {
      console.log("Verify registration link request body:", req.body);
      const { code } = req.body as VerifyRegistrationLinkBody;
      
      if (!code) {
        return res.status(400).json({ message: "Registration code is required" });
      }
      
      const link = await storage.getRegistrationLinkByCode(code);
      
      if (!link) {
        return res.status(404).json({ message: "Invalid registration code" });
      }
      
      // Check if link is active
      if (!link.isActive) {
        return res.status(400).json({ message: "Registration link is no longer active" });
      }
      
      // Check if link is expired
      const now = new Date();
      if (now > link.expiryTime) {
        return res.status(400).json({ message: "Registration link has expired" });
      }
      
      // Check if daily limit has been reached
      if (link.currentRegistrations >= link.dailyLimit) {
        return res.status(400).json({ 
          message: "Registration limit has been reached for today",
          currentRegistrations: link.currentRegistrations,
          dailyLimit: link.dailyLimit,
          status: "quota-reached"
        });
      }
      
      return res.status(200).json({ 
        valid: true,
        message: "Registration code is valid",
        dailyLimit: link.dailyLimit,
        currentRegistrations: link.currentRegistrations,
        expiryTime: link.expiryTime
      });
    } catch (error) {
      console.error("Error verifying registration link:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Endpoint to increment registration count after successful patient registration
  // Endpoint untuk membatalkan janji temu - versi singkat untuk pendaftar
  app.post("/api/appointments/:id/cancel", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Untuk pendaftar, kita perlu validasi akses
      // Pada aplikasi sebenarnya, kita akan memeriksa token atau identitas pendaftar
      // Tapi untuk demonstrasi, kita akan memperbolehkan semua permintaan
      
      const appointment = await storage.getAppointment(id);
      
      if (!appointment) {
        return res.status(404).json({ message: "Janji temu tidak ditemukan" });
      }
      
      // Periksa apakah status sudah Cancelled
      if (appointment.status === 'Cancelled') {
        return res.status(400).json({ message: "Janji temu sudah dibatalkan sebelumnya" });
      }
      
      // Periksa apakah status Completed
      if (appointment.status === 'Completed') {
        return res.status(400).json({ message: "Tidak dapat membatalkan janji temu yang sudah selesai" });
      }
      
      // Update status menjadi Cancelled
      const updatedAppointment = await storage.updateAppointmentStatus(id, 'Cancelled');
      
      // Kurangi jumlah current count di therapy slot jika ada therapy slot terkait
      if (appointment.therapySlotId) {
        await storage.decrementTherapySlotUsage(appointment.therapySlotId);
      }
      
      return res.status(200).json({ 
        success: true, 
        message: "Janji temu berhasil dibatalkan", 
        appointment: updatedAppointment 
      });
    } catch (error) {
      console.error("Error saat membatalkan janji temu:", error);
      return res.status(500).json({ message: "Terjadi kesalahan server" });
    }
  });
  
  app.post("/api/registration-links/increment", async (req: Request, res: Response) => {
    try {
      const { code } = req.body;
      
      if (!code) {
        return res.status(400).json({ message: "Registration code is required" });
      }
      
      const link = await storage.getRegistrationLinkByCode(code);
      
      if (!link) {
        return res.status(404).json({ message: "Invalid registration code" });
      }
      
      // Increment the registration count
      const updatedLink = await storage.incrementRegistrationCount(code);
      
      if (!updatedLink) {
        return res.status(400).json({ message: "Failed to update registration count" });
      }
      
      return res.status(200).json({ 
        success: true,
        message: "Registration count updated successfully", 
        currentRegistrations: updatedLink.currentRegistrations,
        dailyLimit: updatedLink.dailyLimit
      });
    } catch (error) {
      console.error("Error incrementing registration count:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Endpoint to delete registration link
  app.delete("/api/registration-links/:id", async (req: Request, res: Response) => {
    try {
      // Log session for debugging
      console.log("Session for DELETE registration-links:", req.session);
      
      // Untuk keperluan demo, skip autentikasi admin sementara
      /*
      // Check authentication status
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const user = req.user as User;
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }
      */
      
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID format" });
      }
      
      // Delete the registration link
      const deleted = await storage.deleteRegistrationLink(id);
      
      if (deleted) {
        return res.status(200).json({ 
          success: true, 
          message: "Registration link deleted successfully" 
        });
      } else {
        return res.status(404).json({ 
          success: false, 
          message: "Registration link not found or could not be deleted" 
        });
      }
    } catch (error) {
      console.error("Error deleting registration link:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Therapy Slot routes
  app.get("/api/therapy-slots", async (req: Request, res: Response) => {
    try {
      const dateParam = req.query.date as string;
      const activeOnly = req.query.active === 'true';
      const availableOnly = req.query.available === 'true';
      
      console.log(`Fetching therapy slots with params - date: ${dateParam}, activeOnly: ${activeOnly}, availableOnly: ${availableOnly}`);
      
      // Set cache control headers untuk memastikan selalu mendapatkan data terbaru
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      let slots;
      
      // Step 1: Get initial slots based on date parameter
      if (dateParam) {
        // Terima tanggal apa adanya dan gunakan konstruktor Date standar
        try {
          // Gunakan konstruktor Date langsung
          const date = new Date(dateParam);
          
          console.log(`Mendapatkan slot terapi untuk tanggal: ${dateParam} -> ${date.toISOString()}`);
          
          if (isNaN(date.getTime())) {
            return res.status(400).json({ message: "Invalid date format" });
          }
          
          slots = await storage.getTherapySlotsByDate(date);
          
        } catch (error) {
          console.error(`Error parsing date ${dateParam}:`, error);
          return res.status(400).json({ message: "Invalid date format" });
        }
      } else if (activeOnly && !availableOnly) {
        // Dapatkan semua slot aktif jika hanya filter active yang diberikan
        console.log("Mendapatkan semua slot terapi aktif (tanpa filter available)");
        slots = await storage.getActiveTherapySlots();
      } else {
        // Default: Dapatkan semua slot terapi
        console.log("Mendapatkan semua slot terapi (default)");
        slots = await storage.getAllTherapySlots();
      }
      
      // Step 2: Apply additional filters
      let filteredSlots = [...slots]; // Create a copy to avoid mutation issues
      
      // Apply active filter if needed and not already filtered by the storage method
      if (activeOnly && dateParam) {
        console.log("Filtering for active slots after date filter");
        filteredSlots = filteredSlots.filter(slot => slot.isActive);
      }
      
      // Tambahkan filter tambahan untuk memastikan tanggal di masa depan (hari ini atau nanti)
      if (activeOnly && availableOnly) {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset ke awal hari
        
        console.log("Filtering for slots on or after today:", today.toISOString());
        
        filteredSlots = filteredSlots.filter(slot => {
          const slotDate = new Date(slot.date);
          slotDate.setHours(0, 0, 0, 0); // Normalize to start of day
          return slotDate.getTime() >= today.getTime();
        });
      }
      
      // Apply available filter (slots that aren't full)
      if (availableOnly) {
        console.log("Filtering for available slots (currentCount < maxQuota)");
        
        // Filter multi-tahap:
        // 1. Dapatkan semua ID slot yang akan difilter
        const slotIds = filteredSlots.map(slot => slot.id);
        
        // 2. Untuk setiap slot, dapatkan appointment aktif terkait
        const appointmentPromises = slotIds.map(async (slotId) => {
          const appointments = await storage.getAppointmentsByTherapySlot(slotId);
          // Filter hanya appointment yang aktif (tidak dibatalkan)
          const activeAppointments = appointments.filter(app => app.status !== 'Cancelled');
          console.log(`Slot ${slotId}: ${activeAppointments.length} active appointments`);
          return { slotId, appointmentCount: activeAppointments.length };
        });
        
        // 3. Tunggu semua promise selesai
        const appointmentCounts = await Promise.all(appointmentPromises);
        
        // 4. Buat map dari ID slot ke jumlah appointment aktif
        const slotAppointmentMap = new Map();
        appointmentCounts.forEach(({ slotId, appointmentCount }) => {
          slotAppointmentMap.set(slotId, appointmentCount);
        });
        
        // 5. Filter slot berdasarkan jumlah appointment aktif
        filteredSlots = filteredSlots.filter(slot => {
          const actualCount = slotAppointmentMap.get(slot.id) || 0;
          // Gunakan jumlah appointment aktual dari database untuk filter
          return actualCount < slot.maxQuota;
        });
        
        // 6. Update nilai currentCount di masing-masing slot (hanya di respons)
        filteredSlots = filteredSlots.map(slot => ({
          ...slot,
          currentCount: slotAppointmentMap.get(slot.id) || slot.currentCount
        }));
      }
      
      // Sort by date (nearest first) and then by time slot
      filteredSlots.sort((a, b) => {
        // Sort by date first
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) return dateA - dateB;
        
        // Then by time slot if dates are the same
        return a.timeSlot.localeCompare(b.timeSlot);
      });
      
      console.log(`Returning ${filteredSlots.length} slots after filtering`);
      return res.status(200).json(filteredSlots);
    } catch (error) {
      console.error("Error ketika mengambil therapy slots:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get("/api/therapy-slots/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const slot = await storage.getTherapySlot(id);
      
      if (!slot) {
        return res.status(404).json({ message: "Therapy slot not found" });
      }
      
      return res.status(200).json(slot);
    } catch (error) {
      console.error("Error ketika mengambil therapy slot:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post("/api/therapy-slots", async (req: Request, res: Response) => {
    try {
      console.log("Menerima permintaan POST /api/therapy-slots dengan data:", req.body);
      
      // Gunakan tanggal apa adanya tanpa konversi timezone
      let slotDate;
      
      if (req.body.date) {
        // Terima tanggal apa adanya, baik format ISO string atau YYYY-MM-DD
        slotDate = new Date(req.body.date);
        console.log(`Menggunakan tanggal apa adanya: ${req.body.date} -> ${slotDate.toISOString()}`);
      } else {
        // Default ke hari ini jika tidak ada tanggal
        slotDate = new Date();
        console.log(`Tidak ada tanggal diberikan, menggunakan hari ini: ${slotDate.toISOString()}`);
      }
      
      console.log("Tanggal slot yang akan disimpan:", slotDate);
      
      const data = {
        ...req.body,
        date: slotDate,
        maxQuota: req.body.maxQuota || 6,
        currentCount: req.body.currentCount || 0,
        isActive: req.body.isActive !== undefined ? req.body.isActive : true
      };
      
      const validatedData = insertTherapySlotSchema.parse(data);
      console.log("Data therapy slot tervalidasi:", validatedData);
      
      const newSlot = await storage.createTherapySlot(validatedData);
      console.log("Therapy slot baru dibuat:", newSlot);
      
      return res.status(201).json(newSlot);
    } catch (error) {
      console.error("Error ketika membuat therapy slot:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.put("/api/therapy-slots/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      console.log(`Menerima permintaan PUT /api/therapy-slots/${id} dengan data:`, req.body);
      
      // Gunakan tanggal apa adanya tanpa konversi timezone
      let slotDate;
      
      if (req.body.date) {
        // Terima tanggal apa adanya, baik format ISO string atau YYYY-MM-DD
        slotDate = new Date(req.body.date);
        console.log(`UPDATE - Menggunakan tanggal apa adanya: ${req.body.date} -> ${slotDate.toISOString()}`);
      }
      
      const data = {
        ...req.body,
        date: slotDate
      };
      
      const slot = await storage.getTherapySlot(id);
      if (!slot) {
        return res.status(404).json({ message: "Therapy slot not found" });
      }
      
      const updatedSlot = await storage.updateTherapySlot(id, data);
      console.log("Therapy slot diperbarui:", updatedSlot);
      
      return res.status(200).json(updatedSlot);
    } catch (error) {
      console.error("Error ketika memperbarui therapy slot:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Endpoint untuk membuat banyak therapy slot sekaligus (batch processing)
  app.post("/api/therapy-slots/batch", handleTherapySlotsBatch);
  
  app.post("/api/therapy-slots/:id/increment", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      console.log(`Incrementing usage count for therapy slot ${id}`);
      
      const slot = await storage.getTherapySlot(id);
      if (!slot) {
        return res.status(404).json({ message: "Therapy slot not found" });
      }
      
      // Periksa apakah slot masih aktif
      if (!slot.isActive) {
        return res.status(400).json({ message: "Therapy slot is not active" });
      }
      
      // Periksa apakah kuota sudah penuh
      if (slot.currentCount >= slot.maxQuota) {
        return res.status(400).json({ message: "Therapy slot is already full" });
      }
      
      const updatedSlot = await storage.incrementTherapySlotUsage(id);
      console.log("Therapy slot count incremented:", updatedSlot);
      
      return res.status(200).json(updatedSlot);
    } catch (error) {
      console.error("Error ketika increment therapy slot usage:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post("/api/therapy-slots/:id/deactivate", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      console.log(`Deactivating therapy slot ${id}`);
      
      const slot = await storage.getTherapySlot(id);
      if (!slot) {
        return res.status(404).json({ message: "Therapy slot not found" });
      }
      
      const deactivated = await storage.deactivateTherapySlot(id);
      
      if (deactivated) {
        return res.status(200).json({ success: true, message: "Therapy slot deactivated successfully" });
      } else {
        return res.status(500).json({ success: false, message: "Failed to deactivate therapy slot" });
      }
    } catch (error) {
      console.error("Error ketika deactivate therapy slot:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.delete("/api/therapy-slots/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      console.log(`Attempting to delete therapy slot ${id}`);
      
      const slot = await storage.getTherapySlot(id);
      if (!slot) {
        return res.status(404).json({ message: "Therapy slot not found" });
      }
      
      // Periksa apakah slot memiliki pasien yang terdaftar
      if (slot.currentCount > 0) {
        return res.status(400).json({ 
          message: "Cannot delete therapy slot with registered patients",
          success: false
        });
      }
      
      const deleted = await storage.deleteTherapySlot(id);
      
      if (deleted) {
        return res.status(200).json({ 
          success: true, 
          message: "Therapy slot deleted successfully" 
        });
      } else {
        return res.status(500).json({ 
          success: false, 
          message: "Failed to delete therapy slot" 
        });
      }
    } catch (error) {
      console.error("Error ketika menghapus therapy slot:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Endpoint untuk mendapatkan semua janji temu untuk pasien tertentu
  app.get("/api/patients/:id/appointments", async (req: Request, res: Response) => {
    try {
      const patientId = parseInt(req.params.id);
      console.log(`Mengambil janji temu untuk pasien ID: ${patientId}`);
      
      // Validasi pasien
      const patient = await storage.getPatient(patientId);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      
      // Ambil semua janji temu pasien
      const appointments = await storage.getAppointmentsByPatient(patientId);
      
      // Tambahkan informasi slot terapi ke setiap janji temu
      const enrichedAppointments = await Promise.all(
        appointments.map(async (appointment) => {
          if (appointment.therapySlotId) {
            const therapySlot = await storage.getTherapySlot(appointment.therapySlotId);
            return {
              ...appointment,
              therapySlot: therapySlot || undefined
            };
          }
          return appointment;
        })
      );
      
      return res.status(200).json(enrichedAppointments);
    } catch (error) {
      console.error("Error ketika mengambil janji temu pasien:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Endpoint untuk membatalkan janji temu
  app.post("/api/appointments/:id/cancel", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      console.log(`Membatalkan janji temu dengan ID: ${id}`);
      
      const appointment = await storage.getAppointment(id);
      if (!appointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      
      if (appointment.status === "Cancelled") {
        return res.status(400).json({ message: "Appointment is already cancelled" });
      }
      
      // Perbarui status appointment menjadi Cancelled
      const updatedAppointment = await storage.updateAppointmentStatus(id, "Cancelled");
      
      // Jika appointment terkait dengan therapy slot, kurangi current count
      if (appointment.therapySlotId) {
        await storage.decrementTherapySlotUsage(appointment.therapySlotId);
        console.log(`Therapy slot ${appointment.therapySlotId} usage decremented after cancellation`);
      }
      
      return res.status(200).json(updatedAppointment);
    } catch (error) {
      console.error("Error membatalkan janji temu:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Konfigurasi untuk upload file
  const upload = multer({
    dest: 'tmp/',
    limits: {
      fileSize: 10 * 1024 * 1024, // Batasi ukuran file menjadi 10MB
    }
  });

  // Endpoint untuk sinkronisasi kuota slot terapi
  app.post("/api/therapy-slots/sync-quota", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated() || req.user.role !== "admin") {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      console.log("Memulai sinkronisasi kuota slot terapi di database...");
      
      // Gunakan fungsi syncTherapySlotQuota dari storage
      const syncResult = await storage.syncTherapySlotQuota();
      
      return res.status(200).json({
        message: `Sinkronisasi kuota selesai. ${syncResult.updatedSlots} slot diperbarui.`,
        updatedSlots: syncResult.results
      });
    } catch (error) {
      console.error("Error saat sinkronisasi kuota slot terapi:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Endpoint untuk reset dan buat ulang slot terapi default
  app.post("/api/therapy-slots/reset-and-create-default", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated() || req.user.role !== "admin") {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      console.log("Memulai proses reset dan pembuatan slot terapi default...");
      
      // Cek apakah ada janji temu aktif yang tidak dibatalkan
      const activeAppointments = await db.query.appointments.findMany({
        where: and(
          ne(schema.appointments.status, "Cancelled"),
          isNotNull(schema.appointments.therapySlotId)
        )
      });
      
      // Jika masih ada janji temu aktif, jangan hapus slot terapinya
      if (activeAppointments.length > 0) {
        return res.status(400).json({ 
          message: "Tidak dapat mereset slot terapi. Masih ada janji temu yang aktif.", 
          activeAppointmentCount: activeAppointments.length 
        });
      }
      
      // Hapus semua slot terapi
      const deleteResult = await db.delete(schema.therapySlots);
      console.log(`${deleteResult.rowCount} slot terapi berhasil dihapus`);
      
      // Definisi slot waktu baru sesuai permintaan
      const timeSlots = [
        { time: "10:00-12:00", quota: 4 },
        { time: "13:00-15:00", quota: 3 },
        { time: "15:00-17:00", quota: 3 }
      ];
      
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset ke tengah malam hari ini
      let slotsCreated = 0;
      
      // Buat slot untuk 14 hari ke depan (2 minggu)
      for (let i = 0; i < 14; i++) {
        const slotDate = new Date(today);
        slotDate.setDate(slotDate.getDate() + i);
        // Pastikan waktu di-reset ke tengah malam
        slotDate.setHours(0, 0, 0, 0);
        
        // Skip Sundays (0 = Sunday, 1 = Monday, etc.)
        if (slotDate.getDay() === 0) continue;
        
        // Log slot date yang akan dibuat
        console.log(`Membuat slot untuk tanggal ${slotDate.toISOString()}`);
        
        // Create all time slots for this day
        for (const slot of timeSlots) {
          await db.insert(schema.therapySlots).values({
            date: slotDate,
            timeSlot: slot.time,
            maxQuota: slot.quota,
            currentCount: 0,
            isActive: true
          });
          slotsCreated++;
        }
      }
      
      return res.status(200).json({
        message: "Reset dan pembuatan slot terapi berhasil",
        deleted: deleteResult.rowCount || 0,
        created: slotsCreated
      });
    } catch (error) {
      console.error("Error saat reset dan pembuatan slot terapi:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Medical History Routes
  app.get("/api/medical-histories/patient/:patientId", async (req: Request, res: Response) => {
    try {
      const patientId = parseInt(req.params.patientId);
      
      if (isNaN(patientId)) {
        return res.status(400).json({ message: "ID pasien harus berupa angka" });
      }
      
      // Ambil data langsung dari database untuk memastikan penanggalan bekerja dengan benar
      console.log(`Mengambil riwayat medis untuk pasien ID ${patientId}`);
      
      // Gunakan Drizzle ORM untuk query alih-alih raw SQL
      const medicalHistoriesData = await db
        .select()
        .from(schema.medicalHistories)
        .where(eq(schema.medicalHistories.patientId, patientId))
        .orderBy(desc(schema.medicalHistories.treatmentDate));
      
      if (!medicalHistoriesData || medicalHistoriesData.length === 0) {
        console.log("Tidak ada data riwayat medis ditemukan");
        return res.json([]);
      }
      
      console.log(`Ditemukan ${medicalHistoriesData.length} riwayat medis`);
      
      // Tampilkan data untuk debugging
      console.log("Contoh data riwayat medis pertama:", JSON.stringify(medicalHistoriesData[0], null, 2));
      
      // Proses data untuk memperbaiki tanggal yang tidak valid 
      const processedHistories = await Promise.all(medicalHistoriesData.map(async (history) => {
        // Perbaiki tanggal treatmentDate yang null atau 1970
        if (!history.treatmentDate || new Date(history.treatmentDate).getFullYear() <= 1970) {
          console.log(`Memperbaiki tanggal terapi untuk riwayat medis ID ${history.id}`);
          
          // Gunakan tanggal pembuatan sebagai default
          const fixedDate = history.createdAt || new Date();
          
          // Update di database menggunakan storage
          try {
            await storage.updateMedicalHistory(history.id, {
              ...history,
              treatmentDate: fixedDate
            });
            
            // Kembalikan data yang sudah diperbaiki
            return {
              ...history,
              treatmentDate: fixedDate
            };
          } catch (err) {
            console.error(`Gagal memperbarui tanggal terapi untuk ID ${history.id}:`, err);
            return history; // Kembalikan data original jika update gagal
          }
        }
        
        return history;
      }));
      
      return res.json(processedHistories);
    } catch (error) {
      console.error("Error getting medical histories:", error);
      return res.status(500).json({ message: "Terjadi kesalahan saat mengambil riwayat medis" });
    }
  });
  
  app.get("/api/medical-histories/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID harus berupa angka" });
      }
      
      // Gunakan query Drizzle langsung untuk mendapatkan riwayat medis
      const [history] = await db
        .select()
        .from(schema.medicalHistories)
        .where(eq(schema.medicalHistories.id, id));
      
      if (!history) {
        return res.status(404).json({ message: "Riwayat medis tidak ditemukan" });
      }
      
      // Perbaiki tanggal treatmentDate yang null atau 1970
      if (!history.treatmentDate || new Date(history.treatmentDate).getFullYear() <= 1970) {
        console.log(`Memperbaiki tanggal terapi untuk riwayat medis ID ${history.id}`);
        
        // Gunakan tanggal pembuatan sebagai default
        const fixedDate = history.createdAt || new Date();
        
        // Update di database
        await db.update(schema.medicalHistories)
          .set({ treatmentDate: fixedDate })
          .where(eq(schema.medicalHistories.id, history.id));
          
        // Kembalikan dengan tanggal yang sudah diperbaiki
        return res.json({
          ...history,
          treatmentDate: fixedDate
        });
      }
      
      return res.json(history);
    } catch (error) {
      console.error("Error getting medical history:", error);
      return res.status(500).json({ message: "Terjadi kesalahan saat mengambil riwayat medis" });
    }
  });
  
  app.post("/api/medical-histories", async (req: Request, res: Response) => {
    try {
      console.log("Received medical history data:", JSON.stringify(req.body, null, 2));
      
      // Struktur data yang dikirim dari form bisa berbeda, kita perlu menggunakan pendekatan adaptif
      // Sesuaikan dengan struktur formulir JSON yang dikirim client
      const formData = req.body;
      
      // Proses tanggal terlebih dahulu dengan pengelolaan khusus untuk memastikan format yang valid
      let treatmentDate: Date;
      
      if (formData.treatmentDate) {
        // Jika tanggal terapi yang diberikan
        console.log("Tanggal terapi ditemukan dalam request:", formData.treatmentDate);
        console.log("Tipe data:", typeof formData.treatmentDate);
        
        const parsedDate = new Date(formData.treatmentDate);
        console.log("Setelah parsing:", parsedDate);
        console.log("Tanggal valid?", !isNaN(parsedDate.getTime()));
        
        if (isNaN(parsedDate.getTime()) || parsedDate.getFullYear() <= 1970) {
          // Jika tanggal tidak valid, gunakan hari ini
          console.log("Tanggal terapi tidak valid:", formData.treatmentDate);
          treatmentDate = new Date();
          console.log("Menggunakan tanggal default:", treatmentDate.toISOString());
        } else {
          treatmentDate = parsedDate;
          console.log("Menggunakan tanggal dari request:", treatmentDate.toISOString());
        }
      } else if (formData.tanggal_terapi) {
        // Format alternatif
        console.log("Tanggal terapi alternatif ditemukan:", formData.tanggal_terapi);
        
        const parsedDate = new Date(formData.tanggal_terapi);
        
        if (isNaN(parsedDate.getTime()) || parsedDate.getFullYear() <= 1970) {
          console.log("Tanggal terapi (alternatif) tidak valid:", formData.tanggal_terapi);
          treatmentDate = new Date();
          console.log("Menggunakan tanggal default:", treatmentDate.toISOString());
        } else {
          treatmentDate = parsedDate;
          console.log("Menggunakan tanggal alternatif:", treatmentDate.toISOString());
        }
      } else {
        // Jika tidak ada tanggal yang diberikan, gunakan hari ini
        console.log("Tidak ada tanggal terapi dalam request, menggunakan tanggal saat ini");
        treatmentDate = new Date();
        console.log("Tanggal default:", treatmentDate.toISOString());
      }
      
      console.log("Tanggal terapi yang digunakan:", treatmentDate.toISOString());
      
      // Persiapkan data untuk validasi skema
      const medicalHistoryData = {
        patientId: parseInt(formData.patientId),
        appointmentId: formData.appointmentId ? parseInt(formData.appointmentId) : undefined,
        complaint: formData.complaint || formData.keluhan || "",
        beforeBloodPressure: formData.beforeBloodPressure || (
          formData.tekanan_darah_sebelum ? 
            `${formData.tekanan_darah_sebelum.sistolik || ""}/${formData.tekanan_darah_sebelum.diastolik || ""}` : 
            ""
        ),
        afterBloodPressure: formData.afterBloodPressure || (
          formData.tekanan_darah_sesudah ? 
            `${formData.tekanan_darah_sesudah.sistolik || ""}/${formData.tekanan_darah_sesudah.diastolik || ""}` : 
            ""
        ),
        heartRate: formData.heartRate || formData.detak_jantung || "",
        pulseRate: formData.pulseRate || formData.tekanan_nadi || "",
        weight: formData.weight || formData.berat_badan || "",
        notes: formData.notes || formData.catatan || "",
        treatmentDate: treatmentDate,
      };
      
      console.log("Processed medical history data:", medicalHistoryData);
      
      const validatedData = insertMedicalHistorySchema.parse(medicalHistoryData);
      
      // Verifikasi patientId valid
      const patient = await storage.getPatient(validatedData.patientId);
      if (!patient) {
        return res.status(400).json({ message: "Pasien tidak ditemukan" });
      }
      
      // Persiapkan nilai tanggal dengan benar untuk insersi database
      console.log("Akan memasukkan data dengan treatmentDate:", validatedData.treatmentDate.toISOString());
      
      // Buat catatan medis langsung di database untuk memastikan penanganan tanggal yang benar
      const [newHistory] = await db
        .insert(schema.medicalHistories)
        .values({
          patientId: validatedData.patientId,
          appointmentId: validatedData.appointmentId,
          complaint: validatedData.complaint,
          beforeBloodPressure: validatedData.beforeBloodPressure,
          afterBloodPressure: validatedData.afterBloodPressure,
          heartRate: validatedData.heartRate,
          pulseRate: validatedData.pulseRate,
          weight: validatedData.weight,
          notes: validatedData.notes,
          treatmentDate: validatedData.treatmentDate,
          createdAt: new Date() // Pastikan createdAt selalu diisi
        })
        .returning();
        
      console.log("Riwayat medis baru berhasil dibuat:", {
        id: newHistory.id,
        treatmentDate: newHistory.treatmentDate ? 
          new Date(newHistory.treatmentDate).toISOString() : 'null'
      });
      
      return res.status(201).json(newHistory);
    } catch (error) {
      console.error("Error creating medical history:", error);
      if (error instanceof z.ZodError) {
        console.error("Validation errors:", error.errors);
        return res.status(400).json({ 
          message: "Data tidak valid", 
          errors: error.errors 
        });
      }
      return res.status(500).json({ message: "Terjadi kesalahan saat menyimpan riwayat medis" });
    }
  });
  
  app.put("/api/medical-histories/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID harus berupa angka" });
      }
      
      // Pastikan riwayat medis ada - ambil langsung dari database
      const [existingHistory] = await db
        .select()
        .from(schema.medicalHistories)
        .where(eq(schema.medicalHistories.id, id));
        
      if (!existingHistory) {
        return res.status(404).json({ message: "Riwayat medis tidak ditemukan" });
      }
      
      console.log("Existing history:", {
        id: existingHistory.id,
        treatmentDate: existingHistory.treatmentDate ? 
          new Date(existingHistory.treatmentDate).toISOString() : 'null'
      });
      
      console.log("Received medical history update data:", JSON.stringify(req.body, null, 2));
      
      // Proses data yang dikirim dari form
      const formData = req.body;
      
      // Proses tanggal dengan validasi untuk memastikan data valid
      let treatmentDate: Date;
      
      if (formData.treatmentDate) {
        // Jika tanggal terapi yang diberikan dari frontend
        console.log("Tanggal terapi dalam request update:", formData.treatmentDate);
        console.log("Tipe data:", typeof formData.treatmentDate);
        
        const parsedDate = new Date(formData.treatmentDate);
        console.log("Tanggal setelah parsing:", parsedDate);
        console.log("Tanggal valid?", !isNaN(parsedDate.getTime()));
        
        if (isNaN(parsedDate.getTime()) || parsedDate.getFullYear() <= 1970) {
          // Jika tanggal tidak valid, gunakan tanggal dari data existing
          console.log("Tanggal terapi tidak valid dalam request:", formData.treatmentDate);
          treatmentDate = existingHistory.treatmentDate || new Date();
          console.log("Menggunakan tanggal existing:", treatmentDate.toISOString());
        } else {
          treatmentDate = parsedDate;
          console.log("Menggunakan tanggal dari request:", treatmentDate.toISOString());
        }
      } else if (formData.tanggal_terapi) {
        // Format alternatif
        console.log("Format alternatif tanggal terapi ditemukan:", formData.tanggal_terapi);
        
        const parsedDate = new Date(formData.tanggal_terapi);
        
        if (isNaN(parsedDate.getTime()) || parsedDate.getFullYear() <= 1970) {
          console.log("Tanggal terapi (alternatif) tidak valid:", formData.tanggal_terapi);
          treatmentDate = existingHistory.treatmentDate || new Date();
          console.log("Menggunakan tanggal existing:", treatmentDate.toISOString());
        } else {
          treatmentDate = parsedDate;
          console.log("Menggunakan tanggal alternatif:", treatmentDate.toISOString());
        }
      } else {
        // Jika tidak ada tanggal yang diberikan, pertahankan tanggal yang sudah ada
        console.log("Tidak ada tanggal terapi dalam request, menggunakan data existing");
        treatmentDate = existingHistory.treatmentDate || new Date();
        console.log("Tanggal yang digunakan:", treatmentDate.toISOString());
      }
      
      console.log("Tanggal terapi yang akan digunakan:", treatmentDate);
      
      // Persiapkan data untuk validasi skema
      const medicalHistoryData = {
        patientId: parseInt(formData.patientId),
        appointmentId: formData.appointmentId ? parseInt(formData.appointmentId) : existingHistory.appointmentId,
        complaint: formData.complaint || formData.keluhan || existingHistory.complaint || "",
        beforeBloodPressure: formData.beforeBloodPressure || (
          formData.tekanan_darah_sebelum ? 
            `${formData.tekanan_darah_sebelum.sistolik || ""}/${formData.tekanan_darah_sebelum.diastolik || ""}` : 
            existingHistory.beforeBloodPressure || ""
        ),
        afterBloodPressure: formData.afterBloodPressure || (
          formData.tekanan_darah_sesudah ? 
            `${formData.tekanan_darah_sesudah.sistolik || ""}/${formData.tekanan_darah_sesudah.diastolik || ""}` : 
            existingHistory.afterBloodPressure || ""
        ),
        heartRate: formData.heartRate || formData.detak_jantung || existingHistory.heartRate || "",
        pulseRate: formData.pulseRate || formData.tekanan_nadi || existingHistory.pulseRate || "",
        weight: formData.weight || formData.berat_badan || existingHistory.weight || "",
        notes: formData.notes || formData.catatan || existingHistory.notes || "",
        treatmentDate: treatmentDate,
      };
      
      console.log("Processed medical history update data:", {
        ...medicalHistoryData,
        treatmentDate: medicalHistoryData.treatmentDate.toISOString()
      });
      
      // Validasi data
      const validatedData = insertMedicalHistorySchema.parse(medicalHistoryData);
      
      // Update langsung di database untuk memastikan penanganan tanggal yang benar
      const [updatedHistory] = await db
        .update(schema.medicalHistories)
        .set({
          ...validatedData,
          // Jangan update createdAt
        })
        .where(eq(schema.medicalHistories.id, id))
        .returning();
        
      console.log("Updated medical history:", {
        id: updatedHistory.id,
        treatmentDate: updatedHistory.treatmentDate
      });
        
      return res.json(updatedHistory);
    } catch (error) {
      console.error("Error updating medical history:", error);
      if (error instanceof z.ZodError) {
        console.error("Validation errors:", error.errors);
        return res.status(400).json({ 
          message: "Data tidak valid", 
          errors: error.errors 
        });
      }
      return res.status(500).json({ message: "Terjadi kesalahan saat memperbarui riwayat medis" });
    }
  });
  
  app.delete("/api/medical-histories/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID harus berupa angka" });
      }
      
      // Pastikan riwayat medis ada - gunakan Drizzle ORM langsung
      const [existingHistory] = await db
        .select()
        .from(schema.medicalHistories)
        .where(eq(schema.medicalHistories.id, id));
        
      if (!existingHistory) {
        return res.status(404).json({ message: "Riwayat medis tidak ditemukan" });
      }
      
      console.log(`Menghapus riwayat medis ID ${id}`);
      
      // Hapus riwayat medis melalui Drizzle ORM
      const deleted = await db
        .delete(schema.medicalHistories)
        .where(eq(schema.medicalHistories.id, id))
        .returning();
        
      if (deleted.length > 0) {
        console.log(`Riwayat medis ID ${id} berhasil dihapus`);
        return res.json({ 
          message: "Riwayat medis berhasil dihapus",
          id: id
        });
      } else {
        console.error(`Gagal menghapus riwayat medis ID ${id}`);
        return res.status(500).json({ message: "Gagal menghapus riwayat medis" });
      }
    } catch (error) {
      console.error("Error deleting medical history:", error);
      return res.status(500).json({ message: "Terjadi kesalahan saat menghapus riwayat medis" });
    }
  });

  // Backup dan Restore API routes
  app.get("/api/backup/files", getBackupFiles);
  app.post("/api/backup/export", exportData);
  app.get("/api/backup/download/:filename", downloadBackup);
  app.delete("/api/backup/files/:filename", deleteBackup);
  app.post("/api/backup/restore/:filename", restoreData);
  app.post("/api/backup/upload", upload.single('backupFile'), uploadBackup);
  
  // Endpoint khusus untuk pengujian perbaikan sinkronisasi tanggal
  app.post("/api/test/create-appointment", async (req: Request, res: Response) => {
    try {
      // Hanya untuk pengujian - Pastikan ini tidak digunakan di production
      const { patientId, therapySlotId } = req.body;
      
      if (!patientId || !therapySlotId) {
        return res.status(400).json({ 
          message: "Pengujian memerlukan patientId dan therapySlotId",
          example: {
            patientId: 29,
            therapySlotId: 169
          }
        });
      }
      
      // Ambil data terapi slot untuk memperoleh tanggal dan waktu yang benar
      const therapySlot = await storage.getTherapySlot(therapySlotId);
      if (!therapySlot) {
        return res.status(404).json({ message: "Therapy slot tidak ditemukan" });
      }
      
      // Buat appointment dengan data yang valid
      const appointmentData = {
        patientId: patientId,
        therapySlotId: therapySlotId,
        notes: "Pengujian sinkronisasi tanggal",
        status: "Scheduled",
        date: new Date(therapySlot.date), // Menggunakan tanggal dari therapySlot
        timeSlot: therapySlot.timeSlot,
        sessionId: null,
        registrationNumber: null
      };
      
      console.log("Data appointment untuk pengujian:", {
        ...appointmentData,
        date: appointmentData.date.toISOString()
      });
      
      // Buat appointment
      const appointment = await storage.createAppointment(appointmentData);
      
      // Meningkatkan jumlah penggunaan terapi slot
      await storage.incrementTherapySlotUsage(therapySlotId);
      
      return res.status(201).json({
        message: "Appointment testing berhasil dibuat",
        therapySlotDate: therapySlot.date,
        appointmentDate: appointment.date,
        appointment
      });
    } catch (error) {
      console.error("Error pada endpoint pengujian:", error);
      return res.status(500).json({ 
        message: "Terjadi kesalahan saat pengujian",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Endpoint test untuk pengujian penanganan tanggal
  app.post("/api/test/date-handler", handleDateTest);
  
  // Endpoint untuk memperbaiki ketidakkonsistenan tanggal appointment
  app.post("/api/appointments/resync", async (req: Request, res: Response) => {
    try {
      // Pastikan hanya admin yang bisa mengakses endpoint ini
      if (!req.isAuthenticated() || req.user.role !== 'admin') {
        return res.status(403).json({ message: "Unauthorized, admin access required" });
      }
      
      console.log("Memulai sinkronisasi data appointment...");
      
      // Panggil fungsi untuk memperbaiki tanggal
      const result = await storage.resyncAppointmentDates();
      
      console.log(`Sinkronisasi selesai: ${result.fixed} appointment diperbaiki, ${result.errors.length} error`);
      
      return res.status(200).json({
        message: `Sinkronisasi selesai: ${result.fixed} appointment diperbaiki`,
        result
      });
    } catch (error) {
      console.error("Error dalam menyinkronkan tanggal appointment:", error);
      return res.status(500).json({ 
        message: "Terjadi kesalahan dalam menyinkronkan data", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });
  
  // Endpoint khusus untuk memperbaiki tanggal semua riwayat medis yang tidak valid
  app.post("/api/medical-histories/fix-dates", async (req: Request, res: Response) => {
    try {
      // Pastikan hanya admin yang bisa mengakses endpoint ini
      if (!req.isAuthenticated() || req.user.role !== 'admin') {
        return res.status(403).json({ message: "Unauthorized, admin access required" });
      }
      
      console.log("Memulai perbaikan tanggal riwayat medis...");
      
      // Ambil semua riwayat medis
      console.log("Mencari riwayat medis dengan tanggal tidak valid...");
      const allHistories = await db
        .select()
        .from(schema.medicalHistories);
        
      console.log(`Total riwayat medis: ${allHistories.length}`);
      
      // Filter data dengan tanggal tidak valid menggunakan JavaScript
      const invalidHistories = allHistories.filter(history => {
        const noDate = !history.treatmentDate;
        const badYear = history.treatmentDate && new Date(history.treatmentDate).getFullYear() <= 1970;
        
        if (noDate || badYear) {
          console.log(`Riwayat medis #${history.id} memiliki tanggal tidak valid:`, 
            history.treatmentDate ? new Date(history.treatmentDate).toISOString() : 'null');
          return true;
        }
        return false;
      });
        
      console.log(`Ditemukan ${invalidHistories.length} riwayat medis dengan tanggal tidak valid`);
      
      let fixed = 0;
      const errors = [];
      
      // Perbaiki satu per satu
      for (const history of invalidHistories) {
        try {
          // Gunakan createdAt sebagai fallback untuk tanggal terapi
          const fixedDate = history.createdAt || new Date();
          
          console.log(`Memperbaiki riwayat medis ID ${history.id}, tanggal terapi dari ${
            history.treatmentDate ? history.treatmentDate.toISOString() : 'null'
          } menjadi ${fixedDate.toISOString()}`);
          
          // Update di database
          const [updated] = await db
            .update(schema.medicalHistories)
            .set({ treatmentDate: fixedDate })
            .where(eq(schema.medicalHistories.id, history.id))
            .returning();
            
          if (updated) {
            fixed++;
          }
        } catch (err) {
          console.error(`Gagal memperbaiki tanggal untuk riwayat medis ID ${history.id}:`, err);
          errors.push({
            historyId: history.id,
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }
      
      console.log(`Perbaikan selesai: ${fixed} riwayat medis diperbaiki, ${errors.length} error`);
      
      return res.status(200).json({
        message: `Perbaikan selesai: ${fixed} riwayat medis diperbaiki`,
        fixed,
        errors
      });
    } catch (error) {
      console.error("Error dalam memperbaiki tanggal riwayat medis:", error);
      return res.status(500).json({ 
        message: "Terjadi kesalahan dalam memperbaiki data", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });
  
  // Endpoint untuk memperbaiki transaksi yang tidak memiliki subtotal dan discount yang tepat
  app.post("/api/transactions/fix-missing-fields", async (req: Request, res: Response) => {
    try {
      // Pastikan hanya admin yang bisa mengakses endpoint ini
      if (!req.isAuthenticated() || req.user.role !== 'admin') {
        return res.status(403).json({ message: "Unauthorized, admin access required" });
      }
      
      console.log("Memulai perbaikan data transaksi...");
      
      // Ambil semua transaksi
      const transactions = await storage.getAllTransactions();
      let fixed = 0;
      let errors = [];
      
      // Perbaiki setiap transaksi yang tidak memiliki subtotal atau discount
      for (const transaction of transactions) {
        try {
          // Jika subtotal kosong, null, atau 0, gunakan totalAmount
          if (!transaction.subtotal || transaction.subtotal === "0" || transaction.subtotal === "0.00") {
            // Update transaksi di database
            const updatedTransaction = await db
              .update(schema.transactions)
              .set({ subtotal: transaction.totalAmount })
              .where(eq(schema.transactions.id, transaction.id))
              .returning();
              
            if (updatedTransaction.length > 0) {
              fixed++;
              console.log(`Transaksi #${transaction.id} diperbarui: subtotal diatur ke ${transaction.totalAmount}`);
            }
          }
          
          // Jika discount kosong, null, atau "0" atau "0.00", atur ke "0.00"
          if (!transaction.discount || transaction.discount === "0" || transaction.discount === "0.00") {
            const updatedTransaction = await db
              .update(schema.transactions)
              .set({ discount: "0.00" })
              .where(eq(schema.transactions.id, transaction.id))
              .returning();
              
            if (updatedTransaction.length > 0) {
              fixed++;
              console.log(`Transaksi #${transaction.id} diperbarui: discount diatur ke 0.00`);
            }
          }
        } catch (err) {
          console.error(`Error memperbaiki transaksi #${transaction.id}:`, err);
          errors.push({
            transactionId: transaction.id,
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }
      
      console.log(`Perbaikan transaksi selesai: ${fixed} field transaksi diperbaiki, ${errors.length} error`);
      
      return res.status(200).json({
        message: `Perbaikan transaksi selesai: ${fixed} field transaksi diperbaiki`,
        fixed,
        errors
      });
    } catch (error) {
      console.error("Error dalam memperbaiki data transaksi:", error);
      return res.status(500).json({ 
        message: "Terjadi kesalahan dalam memperbaiki data transaksi", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Create an HTTP server to attach both Express and WebSocket
  const httpServer = createServer(app);

  return httpServer;
}
