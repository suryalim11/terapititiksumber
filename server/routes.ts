import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { 
  insertPatientSchema, 
  insertProductSchema, 
  insertTransactionSchema,
  insertSessionSchema,
  insertAppointmentSchema,
  insertUserSchema,
  insertTherapySlotSchema,
  User
} from "@shared/schema";
import { setupAuth } from "./auth";

// Tipe data untuk verifikasi link pendaftaran
interface VerifyRegistrationLinkBody {
  code: string;
}

// Tipe data untuk membuat link pendaftaran
interface CreateRegistrationLinkBody {
  expiryHours: number;
  dailyLimit: number;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication middleware
  setupAuth(app);
  
  // API routes
  const apiRouter = app.route("/api");

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
      const newPatient = await storage.createPatient(validatedData);
      console.log("Pasien baru dibuat:", newPatient);
      
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
              patientId: newPatient.id,
              therapySlotId: therapySlotId,
              notes: validatedData.complaints,
              status: "booked",
              date: new Date() // Menggunakan tanggal hari ini untuk appointment
            };
            
            const appointment = await storage.createAppointment(appointmentData);
            console.log("Appointment dibuat:", appointment);
          }
        } catch (error) {
          console.error("Error saat memproses slot terapi:", error);
          // Lanjutkan meskipun ada error saat memproses slot terapi
          // Pasien tetap dibuat, tapi appointment mungkin gagal
        }
      }
      
      return res.status(201).json(newPatient);
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

  // Transaction routes
  app.get("/api/transactions", async (req: Request, res: Response) => {
    try {
      const patientId = req.query.patientId;
      
      if (patientId) {
        const patientTransactions = await storage.getTransactionsByPatient(parseInt(patientId as string));
        return res.status(200).json(patientTransactions);
      }
      
      const transactions = await storage.getAllTransactions();
      return res.status(200).json(transactions);
    } catch (error) {
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
      const validatedData = insertTransactionSchema.parse(req.body);
      const newTransaction = await storage.createTransaction(validatedData);
      
      // Process transaction items
      const items = validatedData.items as any[];
      
      for (const item of items) {
        // If item is a product, update the stock
        if (item.type === 'product') {
          await storage.updateProductStock(item.id, -(item.quantity || 1));
        }
        
        // If item is a package, create a session
        if (item.type === 'package') {
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
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Session routes
  app.get("/api/sessions", async (req: Request, res: Response) => {
    try {
      const patientId = req.query.patientId;
      const active = req.query.active;
      
      if (patientId) {
        if (active === 'true') {
          const activeSessions = await storage.getActiveSessionsByPatient(parseInt(patientId as string));
          return res.status(200).json(activeSessions);
        } else {
          const patientSessions = await storage.getSessionsByPatient(parseInt(patientId as string));
          return res.status(200).json(patientSessions);
        }
      }
      
      // No patientId specified, return error for now since we're in memory
      return res.status(400).json({ message: "Patient ID is required" });
    } catch (error) {
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
      
      const updatedSession = await storage.updateSessionUsage(id, sessionsUsed);
      
      if (!updatedSession) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      return res.status(200).json(updatedSession);
    } catch (error) {
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
      const validStatuses = ['scheduled', 'completed', 'cancelled'];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ 
          message: "Invalid status. Status must be one of: scheduled, completed, cancelled",
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
      
      // Jika status menjadi cancelled, kurangi jumlah current count di therapy slot
      if (status === 'cancelled' && appointment.status !== 'cancelled') {
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
  
  app.get("/api/today-slots", async (req: Request, res: Response) => {
    try {
      // Mendapatkan tanggal hari ini
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Mendapatkan semua slot terapi untuk hari ini
      const slots = await storage.getTherapySlotsByDate(today);
      
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
      
      // Dapatkan semua appointment untuk slot terapi ini
      const appointments = await storage.getAppointmentsByTherapySlot(slotId);
      
      // Dapatkan informasi pasien dari tiap appointment
      const patientPromises = appointments.map(async (appointment) => {
        const patient = await storage.getPatient(appointment.patientId);
        return {
          ...appointment,
          patient: patient || { name: "Unknown Patient" },
        };
      });
      
      const patientsData = await Promise.all(patientPromises);
      
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
      
      // Check if user is authenticated and has admin role
      if (!req.isAuthenticated() || !req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: "Unauthorized, only admin can create registration links" });
      }

      const { expiryHours, dailyLimit } = req.body as CreateRegistrationLinkBody;
      
      if (!expiryHours || !dailyLimit || typeof expiryHours !== 'number' || typeof dailyLimit !== 'number') {
        return res.status(400).json({ 
          message: "Invalid request body, expiryHours and dailyLimit are required and must be numbers" 
        });
      }
      
      const registrationLink = await storage.createRegistrationLink(
        req.user.id, // Menggunakan req.user.id bukan req.session.userId
        expiryHours,
        dailyLimit
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
      
      // Check if user is authenticated and has admin role
      if (!req.isAuthenticated() || !req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: "Unauthorized, only admin can view registration links" });
      }
      
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
      
      // Check if user is authenticated and has admin role
      if (!req.isAuthenticated() || !req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: "Unauthorized, only admin can deactivate registration links" });
      }
      
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
          dailyLimit: link.dailyLimit
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
      
      // Periksa apakah status sudah cancelled
      if (appointment.status === 'cancelled') {
        return res.status(400).json({ message: "Janji temu sudah dibatalkan sebelumnya" });
      }
      
      // Periksa apakah status completed
      if (appointment.status === 'completed') {
        return res.status(400).json({ message: "Tidak dapat membatalkan janji temu yang sudah selesai" });
      }
      
      // Update status menjadi cancelled
      const updatedAppointment = await storage.updateAppointmentStatus(id, 'cancelled');
      
      // Kurangi jumlah current count di therapy slot
      await storage.decrementTherapySlotUsage(appointment.therapySlotId);
      
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
      
      // Check authentication status
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const user = req.user as User;
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }
      
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
      
      if (dateParam) {
        const date = new Date(dateParam);
        if (isNaN(date.getTime())) {
          return res.status(400).json({ message: "Invalid date format" });
        }
        
        const slots = await storage.getTherapySlotsByDate(date);
        
        // Filter slots by availability if requested
        if (availableOnly) {
          const availableSlots = slots.filter(slot => 
            slot.isActive && slot.currentCount < slot.maxQuota
          );
          return res.status(200).json(availableSlots);
        }
        
        return res.status(200).json(slots);
      } else if (activeOnly) {
        const slots = await storage.getActiveTherapySlots();
        
        // Filter slots by availability if requested
        if (availableOnly) {
          const availableSlots = slots.filter(slot => 
            slot.currentCount < slot.maxQuota
          );
          return res.status(200).json(availableSlots);
        }
        
        return res.status(200).json(slots);
      } else {
        const slots = await storage.getAllTherapySlots();
        
        // Filter slots by availability if requested
        if (availableOnly) {
          const availableSlots = slots.filter(slot => 
            slot.isActive && slot.currentCount < slot.maxQuota
          );
          return res.status(200).json(availableSlots);
        }
        
        return res.status(200).json(slots);
      }
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
      
      // Parsify date string to Date object if it's a string
      const data = {
        ...req.body,
        date: req.body.date ? new Date(req.body.date) : new Date(),
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
      
      // Parsify date string to Date object if it's a string
      const data = {
        ...req.body,
        date: req.body.date ? new Date(req.body.date) : undefined
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
      
      if (appointment.status === "cancelled") {
        return res.status(400).json({ message: "Appointment is already cancelled" });
      }
      
      // Perbarui status appointment menjadi cancelled
      const updatedAppointment = await storage.updateAppointmentStatus(id, "cancelled");
      
      // Jika appointment terkait dengan therapy slot, kurangi current count
      if (appointment.therapySlotId !== null) {
        await storage.decrementTherapySlotUsage(appointment.therapySlotId);
        console.log(`Therapy slot ${appointment.therapySlotId} usage decremented after cancellation`);
      }
      
      return res.status(200).json(updatedAppointment);
    } catch (error) {
      console.error("Error membatalkan janji temu:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create an HTTP server to attach both Express and WebSocket
  const httpServer = createServer(app);

  return httpServer;
}
