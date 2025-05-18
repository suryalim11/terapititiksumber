import express, { type Request, Response, NextFunction } from "express";
import { setupVite, serveStatic, log } from "./vite";
import { createServer, type Server } from "http";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { storage } from "./storage";
// Import endpoint JSON mentah
import { setupRawJsonEndpoints } from "./raw-json-endpoint";
import { setupRawProductRoutes } from "./routes/api/raw-products";
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
      
      // Daftarkan endpoint JSON mentah
      setupRawJsonEndpoints(app);
      log('Raw JSON endpoints terdaftar di /api/raw/*');
    });
  } catch (error) {
    console.error("ERROR saat menginisialisasi server:", error);
    process.exit(1);
  }
})();
