/**
 * API endpoint untuk autentikasi
 */
import { Express, Request, Response } from "express";
import { requireAuth, logLoginActivity, logLogoutActivity } from "../../middleware/auth";
import { storage } from "../../storage";
import passport from "passport";

/**
 * Mendaftarkan rute-rute untuk autentikasi
 */
export function setupAuthRoutes(app: Express) {
  // Memeriksa status autentikasi
  app.get("/api/auth/status", (req: Request, res: Response) => {
    if (req.isAuthenticated()) {
      res.json({ 
        authenticated: true, 
        user: req.user 
      });
    } else {
      res.json({ 
        authenticated: false 
      });
    }
  });

  // Login 
  app.post("/api/auth/login", logLoginActivity, (req: Request, res: Response, next) => {
    passport.authenticate('local', (err, user, info) => {
      if (err) {
        console.error('Kesalahan autentikasi:', err);
        return res.status(500).json({ 
          success: false, 
          message: 'Terjadi kesalahan saat mencoba login' 
        });
      }
      
      if (!user) {
        return res.status(401).json({ 
          success: false, 
          message: info?.message || 'Username atau password salah' 
        });
      }
      
      req.login(user, (err) => {
        if (err) {
          console.error('Kesalahan saat membuat sesi login:', err);
          return res.status(500).json({ 
            success: false, 
            message: 'Terjadi kesalahan saat membuat sesi login' 
          });
        }
        
        console.log(`Login berhasil untuk user: ${user.username}`);
        
        return res.json({ 
          success: true, 
          message: 'Login berhasil', 
          user 
        });
      });
    })(req, res, next);
  });

  // Logout
  app.post("/api/auth/logout", logLogoutActivity, (req: Request, res: Response) => {
    const username = req.user ? (req.user as any).username : 'unknown';
    
    req.logout((err) => {
      if (err) {
        console.error(`Gagal logout user ${username}:`, err);
        return res.status(500).json({ 
          success: false, 
          message: 'Terjadi kesalahan saat logout' 
        });
      }
      
      console.log(`User ${username} telah logout`);
      res.json({ 
        success: true, 
        message: 'Logout berhasil' 
      });
    });
  });

  // Memeriksa apakah user memiliki peran admin
  app.get('/api/auth/is-admin', requireAuth, (req: Request, res: Response) => {
    const isAdmin = req.user && (req.user as any).role === 'admin';
    
    res.json({
      isAdmin
    });
  });

  // Pemulihan password (versi sederhana tanpa email)
  app.post('/api/auth/reset-password', requireAuth, async (req: Request, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = (req.user as any).id;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Password saat ini dan password baru diperlukan'
        });
      }
      
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User tidak ditemukan'
        });
      }
      
      // Verifikasi password lama
      if (user.password !== currentPassword) {
        return res.status(400).json({
          success: false,
          message: 'Password saat ini tidak sesuai'
        });
      }
      
      // Update password - dalam implementasi produksi, gunakan fungsi hash
      await storage.updateUserPassword(userId, newPassword);
      
      res.json({
        success: true,
        message: 'Password berhasil diubah'
      });
    } catch (error) {
      console.error('Kesalahan saat mengubah password:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan saat mengubah password'
      });
    }
  });
}