/**
 * API endpoint untuk manajemen autentikasi
 */
import { Express, Request, Response, NextFunction } from "express";
import { storage } from "../../storage";
import { requireAuth } from "../../middleware/auth";
import passport from "passport";
import { comparePasswords } from "../../auth";

/**
 * Mendaftarkan rute-rute untuk autentikasi
 */
export function setupAuthRoutes(app: Express) {
  // Login pengguna
  app.post("/api/login", (req: Request, res: Response, next: NextFunction) => {
    const { username, password, rememberMe } = req.body;
    
    console.log(`Mencoba login untuk username: ${username}, rememberMe: ${rememberMe}`);
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username dan password diperlukan"
      });
    }
    
    // Gunakan passport untuk autentikasi
    passport.authenticate("local", (err, user, info) => {
      if (err) {
        console.error("Error authenticating user:", err);
        return res.status(500).json({
          success: false,
          message: "Terjadi kesalahan saat autentikasi"
        });
      }
      
      if (!user) {
        console.log(`Login gagal untuk username: ${username}`);
        return res.status(401).json({
          success: false,
          message: info.message || "Username atau password salah"
        });
      }
      
      // Set session cookie
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error("Error logging in user:", loginErr);
          return res.status(500).json({
            success: false,
            message: "Terjadi kesalahan saat melakukan login"
          });
        }
        
        // Set cookie max-age berdasarkan rememberMe
        if (rememberMe) {
          req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 hari
        } else {
          req.session.cookie.maxAge = 24 * 60 * 60 * 1000; // 1 hari
        }
        
        // Kembalikan informasi user (tanpa password)
        const { password, ...userInfo } = user;
        
        console.log(`Login berhasil untuk username: ${username}`);
        
        return res.status(200).json({
          success: true,
          message: "Login berhasil",
          user: userInfo
        });
      });
    })(req, res, next);
  });

  // Logout pengguna
  app.post("/api/logout", (req: Request, res: Response) => {
    if (req.isAuthenticated()) {
      console.log(`Logout untuk user: ${(req.user as any).username}`);
      req.logout((err) => {
        if (err) {
          console.error("Error during logout:", err);
          return res.status(500).json({
            success: false,
            message: "Terjadi kesalahan saat logout"
          });
        }
        
        res.status(200).json({
          success: true,
          message: "Logout berhasil"
        });
      });
    } else {
      res.status(200).json({
        success: true,
        message: "Logout berhasil (tidak ada sesi aktif)"
      });
    }
  });

  // Status autentikasi
  app.get("/api/auth/status", (req: Request, res: Response) => {
    console.log("Memeriksa status autentikasi");
    
    if (req.isAuthenticated()) {
      console.log(`User terautentikasi: ${(req.user as any).username}`);
      
      // Kembalikan informasi user (tanpa password)
      const user = req.user as any;
      const { password, ...userInfo } = user;
      
      return res.status(200).json({
        authenticated: true,
        user: userInfo
      });
    } else {
      console.log("Tidak ada user yang terautentikasi");
      
      return res.status(200).json({
        authenticated: false
      });
    }
  });

  // Mendapatkan profile pengguna
  app.get("/api/auth/profile", requireAuth, (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Tidak terautentikasi"
        });
      }
      
      // Kembalikan informasi user (tanpa password)
      const user = req.user as any;
      const { password, ...userInfo } = user;
      
      return res.status(200).json({
        success: true,
        user: userInfo
      });
    } catch (error) {
      console.error("Error getting user profile:", error);
      
      return res.status(500).json({
        success: false,
        message: "Terjadi kesalahan saat mengambil profil pengguna"
      });
    }
  });

  // Mengubah password
  app.post("/api/auth/change-password", requireAuth, async (req: Request, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "Password saat ini dan password baru diperlukan"
        });
      }
      
      // Dapatkan user dari session
      const userId = (req.user as any).id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Pengguna tidak ditemukan"
        });
      }
      
      // BUG FIX #10: Verifikasi password dengan benar (plaintext atau hashed)
      let passwordValid = false;
      if (user.password.includes('.')) {
        try {
          // Password sudah dihash
          passwordValid = await comparePasswords(currentPassword, user.password);
        } catch (err) {
          console.error('Error comparing hashed password:', err);
          passwordValid = false;
        }
      } else {
        // Password masih plaintext (backward compatibility)
        passwordValid = user.password === currentPassword;
      }

      if (!passwordValid) {
        return res.status(400).json({
          success: false,
          message: "Password saat ini tidak sesuai"
        });
      }
      
      // Update password
      const updatedUser = await storage.updateUserPassword(userId, newPassword);
      
      if (!updatedUser) {
        return res.status(500).json({
          success: false,
          message: "Gagal memperbarui password"
        });
      }
      
      return res.status(200).json({
        success: true,
        message: "Password berhasil diperbarui"
      });
    } catch (error) {
      console.error("Error changing password:", error);
      
      return res.status(500).json({
        success: false,
        message: "Terjadi kesalahan saat mengubah password"
      });
    }
  });
}