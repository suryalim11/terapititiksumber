import express, { type Request, Response, NextFunction } from "express";
import { setupVite, serveStatic, log } from "./vite";
import { createServer, type Server } from "http";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { storage } from "./storage";
// Import JSON middleware kustom
const { ensureJsonResponse } = require('./json-middleware');
// Import modul routes yang dibutuhkan
import { setupRoutes } from "./routes/index";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Tambahkan header untuk mencegah caching di sisi client
app.use((req, res, next) => {
  res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.header('Pragma', 'no-cache');
  res.header('Expires', '0');
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Fungsi untuk setup Passport
const setupPassport = () => {
  // Setup strategi otentikasi lokal
  passport.use(new LocalStrategy(
    async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        
        if (!user) {
          return done(null, false, { message: 'Nama pengguna tidak ditemukan' });
        }
        
        // Di produksi, gunakan hashPassword dan comparePasswords
        // untuk saat ini, gunakan perbandingan langsung untuk sederhana
        if (user.password !== password) {
          return done(null, false, { message: 'Password salah' });
        }
        
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  ));

  // Serialize user untuk disimpan di session
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // Deserialize user untuk mendapatkan data user dari id di session
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });
};

// Setup session
const setupSession = () => {
  app.use(session({
    secret: process.env.SESSION_SECRET || 'therapy-clinic-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 jam
    }
  }));

  app.use(passport.initialize());
  app.use(passport.session());
};

(async () => {
  try {
    // Setup session dan passport
    setupSession();
    setupPassport();
    
    // Buat HTTP server
    const httpServer = createServer(app);
    
    // Setup routes
    setupRoutes(app);
  
    // Global error handler  
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
  
      console.error("Global error handler caught:", err);
      res.status(status).json({ message });
      // Don't throw the error again - this causes the server to crash
      // throw err;
    });
  
    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      await setupVite(app, httpServer);
    } else {
      serveStatic(app);
    }
    
    // ALWAYS serve the app on port 5000
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = 5000;
    httpServer.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`Server berjalan di port ${port}`);
      
      // Buat middleware khusus untuk memastikan header Content-Type diatur dengan benar
      app.use('/api/direct', (req, res, next) => {
        // Override metode JSON untuk memastikan header yang benar
        const originalJSON = res.json;
        res.json = function(body) {
          res.setHeader('Content-Type', 'application/json');
          return originalJSON.call(this, body);
        };
        
        // Perkuat header lagi sebelum respons dikirim
        res.once('finish', () => {
          if (!res.headersSent) {
            res.setHeader('Content-Type', 'application/json');
          }
        });
        
        next();
      });
      
      // Definisikan handler khusus untuk slot
      app.get('/api/direct/simple-slot/:id/basic', async (req, res) => {
        try {
          const slotId = parseInt(req.params.id);
          if (isNaN(slotId)) {
            return res.status(400).json({ error: 'ID slot terapi tidak valid' });
          }
          
          console.log(`🔍 Direct endpoint mengambil data dasar slot ${slotId}`);
          const therapySlot = await storage.getTherapySlot(slotId);
          
          if (!therapySlot) {
            return res.status(404).json({ error: 'Slot terapi tidak ditemukan' });
          }
          
          // Pastikan header Content-Type diatur dengan benar
          res.setHeader('Content-Type', 'application/json');
          
          // Kembalikan hanya properti dasar
          return res.json({
            id: therapySlot.id,
            date: therapySlot.date,
            timeSlot: therapySlot.timeSlot,
            maxQuota: therapySlot.maxQuota,
            currentCount: therapySlot.currentCount,
            isActive: therapySlot.isActive
          });
        } catch (error) {
          console.error('Error mendapatkan info dasar slot terapi:', error);
          return res.status(500).json({ error: 'Gagal mengambil informasi slot terapi' });
        }
      });
      
      // Definisikan endpoint untuk appointments
      app.get('/api/direct/simple-slot/:id/appointments', async (req, res) => {
        try {
          const slotId = parseInt(req.params.id);
          if (isNaN(slotId)) {
            return res.status(400).json({ error: 'ID slot terapi tidak valid' });
          }
          
          console.log(`📅 Direct endpoint mengambil appointments untuk slot ${slotId}`);
          const appointments = await storage.getAppointmentsByTherapySlot(slotId);
          
          // Pastikan header Content-Type diatur dengan benar
          res.setHeader('Content-Type', 'application/json');
          
          // Hanya kembalikan info penting saja
          const simplifiedAppointments = appointments.map(appointment => ({
            id: appointment.id,
            patientId: appointment.patientId,
            status: appointment.status,
            date: appointment.date,
            timeSlot: appointment.timeSlot
          }));
          
          return res.json(simplifiedAppointments);
        } catch (error) {
          console.error('Error mendapatkan appointment slot terapi:', error);
          return res.status(500).json({ error: 'Gagal mengambil data appointment' });
        }
      });
      
      // Definisikan endpoint untuk patients
      app.get('/api/direct/simple-slot/:id/patients', async (req, res) => {
        try {
          const slotId = parseInt(req.params.id);
          if (isNaN(slotId)) {
            return res.status(400).json({ error: 'ID slot terapi tidak valid' });
          }
          
          console.log(`👥 Direct endpoint mengambil data pasien untuk slot ${slotId}`);
          const appointments = await storage.getAppointmentsByTherapySlot(slotId);
          
          // Lakukan fetch untuk semua pasien
          const patients = [];
          for (const appointment of appointments) {
            if (appointment.patientId) {
              const patient = await storage.getPatient(appointment.patientId);
              if (patient) {
                // Tambahkan status appointment ke data pasien
                const patientWithStatus = {
                  ...patient,
                  appointmentStatus: appointment.status,
                  appointmentId: appointment.id,
                  walkin: appointment.status === 'Active',
                };
                patients.push(patientWithStatus);
              }
            }
          }
          
          // Pastikan header Content-Type diatur dengan benar
          res.setHeader('Content-Type', 'application/json');
          return res.json(patients);
        } catch (error) {
          console.error('Error mendapatkan data pasien slot terapi:', error);
          return res.status(500).json({ error: 'Gagal mengambil data pasien' });
        }
      });
      
      log('Direct JSON handler terdaftar di /api/direct/*');
    });
  } catch (error) {
    console.error("ERROR saat menginisialisasi server:", error);
    process.exit(1);
  }
})();
