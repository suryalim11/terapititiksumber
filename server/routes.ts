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

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes
  const apiRouter = app.route("/api");

  // Auth routes
  app.post("/api/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }
      
      const user = await storage.getUserByUsername(username);
      
      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Create a session
      req.session!.userId = user.id;
      req.session!.username = user.username;
      req.session!.role = user.role;
      
      return res.status(200).json({ 
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
      });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/logout", (req: Request, res: Response) => {
    req.session!.destroy(() => {
      res.status(200).json({ message: "Logged out successfully" });
    });
  });

  // Check auth status
  app.get("/api/auth/status", (req: Request, res: Response) => {
    if (req.session && req.session.userId) {
      return res.status(200).json({
        isAuthenticated: true,
        user: {
          id: req.session.userId,
          username: req.session.username,
          role: req.session.role
        }
      });
    }
    return res.status(200).json({ isAuthenticated: false });
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
      const validatedData = insertPatientSchema.parse(req.body);
      const newPatient = await storage.createPatient(validatedData);
      return res.status(201).json(newPatient);
    } catch (error) {
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
      const validatedData = insertProductSchema.parse(req.body);
      const newProduct = await storage.createProduct(validatedData);
      return res.status(201).json(newProduct);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
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
      
      // No filters specified, return error for now since we're in memory
      return res.status(400).json({ message: "Date or Patient ID is required" });
    } catch (error) {
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
      const validatedData = insertAppointmentSchema.parse(req.body);
      const newAppointment = await storage.createAppointment(validatedData);
      return res.status(201).json(newAppointment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/appointments/:id/status", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!['scheduled', 'completed', 'cancelled'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      const updatedAppointment = await storage.updateAppointmentStatus(id, status);
      
      if (!updatedAppointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      
      return res.status(200).json(updatedAppointment);
    } catch (error) {
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

  // Create an HTTP server to attach both Express and WebSocket
  const httpServer = createServer(app);

  return httpServer;
}
