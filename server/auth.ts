import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { logLoginActivity, logLogoutActivity } from "./middleware/system-logger";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "terapi-titik-sumber-secret-key",
    resave: true, // Ubah menjadi true untuk memastikan session selalu disimpan ulang
    saveUninitialized: true, // Ubah menjadi true untuk mempertahankan session baru
    store: storage.sessionStore,
    cookie: {
      secure: false, // Disable secure untuk development
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 hari (dalam milidetik)
      path: '/'
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false);
        }
        
        // Pengecekan sementara - jika password belum dihash (dari MemStorage)
        if (user.password === password) {
          return done(null, user);
        }
        
        // Pengecekan untuk password yang sudah dihash (untuk implementasi selanjutnya)
        try {
          if (user.password.includes('.') && await comparePasswords(password, user.password)) {
            return done(null, user);
          }
        } catch (err) {
          console.error('Error comparing hashed passwords:', err);
        }
        
        return done(null, false);
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ success: false, message: "Username sudah terdaftar" });
      }

      // Hash password sebelum menyimpan ke database
      const hashedPassword = await hashPassword(req.body.password);
      const user = await storage.createUser({
        ...req.body,
        password: hashedPassword,
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json({ success: true, user });
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || "Gagal mendaftar" });
    }
  });

  app.post("/api/login", logLoginActivity, (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ 
          success: false, 
          message: "Username atau password salah" 
        });
      }
      
      // Debug: log user data for debugging
      console.log("Login - User object:", user);
      console.log("Login - User role:", user.role);
      
      // Gunakan opsi remember_me jika disediakan
      const rememberMe = req.body.remember_me === true;
      
      req.login(user, (err) => {
        if (err) return next(err);
        
        // Debug: after login
        console.log("Login - req.user after login:", req.user);
        if (req.user) {
          console.log("Login - req.user.role after login:", req.user.role);
        }
        
        // Set cookie maxAge berdasarkan pilihan "Ingat Saya"
        if (req.session) {
          if (rememberMe) {
            // Jika remember_me dicentang, perpanjang masa cookie session
            req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 hari
            console.log("Login dengan 'Remember Me': Cookie akan berlaku selama 30 hari");
          } else {
            // Jika tidak dicentang, tetapkan masa cookie lebih pendek tetapi tidak hilang segera
            // Kita tetapkan 24 jam sebagai default
            req.session.cookie.maxAge = 24 * 60 * 60 * 1000; // 24 jam
            console.log("Login tanpa 'Remember Me': Cookie akan berlaku selama 24 jam");
          }
          
          // Simpan session secara eksplisit
          req.session.save(err => {
            if (err) {
              console.error("Error saving session:", err);
              return next(err);
            }
            
            console.log("Session tersimpan dengan sukses. Session ID:", req.sessionID);
            res.status(200).json({ success: true, user });
          });
        } else {
          console.error("Session tidak tersedia setelah login!");
          res.status(200).json({ success: true, user });
        }
      });
    })(req, res, next);
  });

  app.post("/api/logout", logLogoutActivity, (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.status(200).json({ success: true });
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ success: false, message: "Tidak terautentikasi" });
    }
    res.json({ success: true, user: req.user });
  });
  
  // Alias for auth status to maintain backward compatibility
  app.get("/api/auth/status", (req, res) => {
    // Re-fetch user from session to ensure data integrity
    if (req.isAuthenticated() && req.user && req.user.id) {
      storage.getUser(req.user.id)
        .then(freshUser => {
          if (freshUser) {
            // Update session user data
            req.user = freshUser;
            
            res.json({ 
              authenticated: true,
              user: freshUser
            });
          } else {
            // User tidak ditemukan di database, logout
            req.logout((err) => {
              if (err) console.error("Error logging out:", err);
              res.json({ 
                authenticated: false,
                user: null
              });
            });
          }
        })
        .catch(err => {
          console.error("Error fetching fresh user data:", err);
          res.json({ 
            authenticated: req.isAuthenticated(),
            user: req.isAuthenticated() ? req.user : null
          });
        });
    } else {
      res.json({ 
        authenticated: req.isAuthenticated(),
        user: req.isAuthenticated() ? req.user : null
      });
    }
  });
}