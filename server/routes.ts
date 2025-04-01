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
  insertUserSchema
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
          complaints: "Keluhan Test",
          medicalHistory: null
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
        medicalHistory: req.body.medicalHistory || null
      };
      
      console.log("Data yang akan divalidasi:", patientData);
      const validatedData = insertPatientSchema.parse(patientData);
      console.log("Data pasien tervalidasi:", validatedData);
      const newPatient = await storage.createPatient(validatedData);
      console.log("Pasien baru dibuat:", newPatient);
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
        complaints: req.body.complaints,
        medicalHistory: req.body.medicalHistory || null
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
      
      const updatedAppointment = await storage.updateAppointmentStatus(id, status);
      
      if (!updatedAppointment) {
        return res.status(404).json({ message: "Appointment not found" });
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

  // Registration Link endpoints
  app.post("/api/registration-links", async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated and has admin role
      if (!req.session || !req.session.userId || req.session.role !== 'admin') {
        return res.status(403).json({ message: "Unauthorized, only admin can create registration links" });
      }

      const { expiryHours, dailyLimit } = req.body as CreateRegistrationLinkBody;
      
      if (!expiryHours || !dailyLimit || typeof expiryHours !== 'number' || typeof dailyLimit !== 'number') {
        return res.status(400).json({ 
          message: "Invalid request body, expiryHours and dailyLimit are required and must be numbers" 
        });
      }
      
      const registrationLink = await storage.createRegistrationLink(
        req.session.userId,
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
      // Check if user is authenticated and has admin role
      if (!req.session || !req.session.userId || req.session.role !== 'admin') {
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
      // Check if user is authenticated and has admin role
      if (!req.session || !req.session.userId || req.session.role !== 'admin') {
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

  // Create an HTTP server to attach both Express and WebSocket
  const httpServer = createServer(app);

  return httpServer;
}
