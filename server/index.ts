import express, { type Request, Response, NextFunction } from "express";
import { setupVite, serveStatic, log } from "./vite";
import { createServer, type Server } from "http";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { storage } from "./storage";
import { comparePasswords } from "./auth";
// Import endpoint JSON mentah
import { setupRawJsonEndpoints } from "./raw-json-endpoint";
import { setupRawProductRoutes } from "./routes/api/raw-products";
import { setupDirectApi } from "./direct-api";
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

        // BUG FIX #10: Verifikasi password dengan benar
        // Cek dulu apakah password sudah dihash (format: hash.salt)
        let passwordValid = false;
        if (user.password.includes('.')) {
          try {
            // Password sudah dihash, gunakan comparePasswords
            passwordValid = await comparePasswords(password, user.password);
          } catch (err) {
            console.error('Error comparing hashed password:', err);
            passwordValid = false;
          }
        } else {
          // Password masih plaintext (untuk backward compatibility dengan data lama)
          passwordValid = user.password === password;
        }

        if (!passwordValid) {
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
  // Deteksi production mode - Replit menggunakan REPL_SLUG untuk production
  const isProduction = process.env.NODE_ENV === 'production' || 
                       !!process.env.REPL_SLUG ||
                       process.env.REPLIT_DEPLOYMENT === '1';
  
  console.log(`Session setup - isProduction: ${isProduction}, NODE_ENV: ${process.env.NODE_ENV}`);
  
  app.use(session({
    secret: process.env.SESSION_SECRET || 'therapy-clinic-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction, // HTTPS only in production
      httpOnly: true,
      sameSite: isProduction ? 'none' : 'lax', // 'none' untuk cross-site cookies di production
      maxAge: 24 * 60 * 60 * 1000 // 24 jam
    },
    proxy: isProduction // Trust proxy di production (Replit uses reverse proxy)
  }));

  // Trust proxy untuk production deployment
  if (isProduction) {
    app.set('trust proxy', 1);
  }

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
    
    // Daftarkan route yang paling spesifik terlebih dahulu
    // Route untuk API produk langsung
    app.get("/api/fixed/products", async (req: Request, res: Response) => {
      try {
        console.log("[FIXED] API products dipanggil");
        const products = await storage.getAllProducts();
        console.log(`[FIXED] Menemukan ${products.length} produk`);
        
        // Kirim array kosong jika tidak ada produk
        if (products.length === 0) {
          res.json([]);
          return;
        }
        
        // Format produk untuk keamanan
        const safeProducts = products.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          stock: p.stock,
          description: p.description || ''
        }));
        
        // Set header yang eksplisit untuk mencegah caching
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        
        // Serialize dan kirim JSON
        res.json(safeProducts);
      } catch (error) {
        console.error("[FIXED] Error mendapatkan produk:", error);
        res.status(500).json([]);
      }
    });
    
    // Route untuk API paket langsung
    app.get("/api/fixed/packages", async (req: Request, res: Response) => {
      try {
        console.log("[FIXED] API packages dipanggil");
        const packages = await storage.getAllPackages();
        console.log(`[FIXED] Menemukan ${packages.length} paket`);
        
        // Kirim array kosong jika tidak ada paket
        if (packages.length === 0) {
          res.json([]);
          return;
        }
        
        // Format paket untuk keamanan
        const safePackages = packages.map(p => ({
          id: p.id,
          name: p.name,
          sessions: p.sessions,
          price: p.price,
          description: p.description || ''
        }));
        
        // Set header yang eksplisit untuk mencegah caching
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        
        // Serialize dan kirim JSON
        res.json(safePackages);
      } catch (error) {
        console.error("[FIXED] Error mendapatkan paket:", error);
        res.status(500).json([]);
      }
    });
    
    // Setup routes SETELAH route-route khusus di atas
    setupRoutes(app);
    
    // Daftarkan JSON endpoints
    log('Fixed API endpoints terdaftar: /api/fixed/*');
    
    // Global error handler  
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
  
      console.error("Global error handler caught:", err);
      res.status(status).json({ message });
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
    });
  } catch (error) {
    console.error("ERROR saat menginisialisasi server:", error);
    process.exit(1);
  }
})();
