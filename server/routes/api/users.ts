/**
 * API endpoint untuk manajemen pengguna
 */
import { Express, Request, Response } from "express";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import { storage } from "../../storage";
import { z } from "zod";
import { insertUserSchema } from "@shared/schema";
import { comparePasswords } from "../../auth";

/**
 * Mendaftarkan rute-rute untuk pengguna
 */
export function setupUserRoutes(app: Express) {
  // BUG FIX #6: Route /me HARUS didaftarkan SEBELUM /:id
  // agar Express tidak menangkap "me" sebagai nilai :id

  // Mendapatkan data pengguna yang sedang login
  app.get("/api/users/me", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: "Tidak terautentikasi" });
      }
      
      const userId = (req.user as any).id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "Pengguna tidak ditemukan" });
      }
      
      // Hapus password dari response
      const { password, ...userWithoutPassword } = user;
      
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error getting current user:", error);
      res.status(500).json({ error: "Gagal mendapatkan data pengguna" });
    }
  });

  // Mendapatkan pengguna berdasarkan ID (hanya admin)
  // BUG FIX #6: Dipindahkan ke SETELAH /me agar tidak menyerap request /api/users/me
  app.get("/api/users/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const user = await storage.getUser(id);

      if (!user) {
        return res.status(404).json({ error: "Pengguna tidak ditemukan" });
      }

      // Hapus password dari response
      const { password, ...userWithoutPassword } = user;

      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error getting user:", error);
      res.status(500).json({ error: "Gagal mendapatkan data pengguna" });
    }
  });

  // Membuat pengguna baru (hanya admin)
  app.post("/api/users", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Periksa apakah username sudah digunakan
      const existingUser = await storage.getUserByUsername(userData.username);
      
      if (existingUser) {
        return res.status(409).json({ 
          success: false, 
          message: "Username sudah digunakan" 
        });
      }
      
      // Buat pengguna baru
      const newUser = await storage.createUser(userData);
      
      // Hapus password dari response
      const { password, ...userWithoutPassword } = newUser;
      
      return res.status(201).json({
        success: true,
        user: userWithoutPassword,
        message: "Pengguna berhasil dibuat"
      });
    } catch (error) {
      console.error("Error creating user:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false, 
          message: "Data pengguna tidak valid", 
          details: error.errors 
        });
      }
      
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat membuat pengguna baru" 
      });
    }
  });

  // Memperbarui pengguna
  app.put("/api/users/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const userData = req.body;
      
      // Dapatkan pengguna yang ada
      const existingUser = await storage.getUser(id);
      
      if (!existingUser) {
        return res.status(404).json({ 
          success: false, 
          message: "Pengguna tidak ditemukan" 
        });
      }
      
      // Periksa apakah username sudah digunakan oleh pengguna lain
      if (userData.username && userData.username !== existingUser.username) {
        const userWithSameUsername = await storage.getUserByUsername(userData.username);
        
        if (userWithSameUsername && userWithSameUsername.id !== id) {
          return res.status(409).json({ 
            success: false, 
            message: "Username sudah digunakan oleh pengguna lain" 
          });
        }
      }
      
      // Perbarui pengguna
      const updatedUser = await storage.updateUser(id, userData);
      
      if (!updatedUser) {
        return res.status(500).json({ 
          success: false, 
          message: "Gagal memperbarui data pengguna" 
        });
      }
      
      // Hapus password dari response
      const { password, ...userWithoutPassword } = updatedUser;
      
      return res.status(200).json({
        success: true,
        user: userWithoutPassword,
        message: "Data pengguna berhasil diperbarui"
      });
    } catch (error) {
      console.error("Error updating user:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false, 
          message: "Data pengguna tidak valid", 
          details: error.errors 
        });
      }
      
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat memperbarui data pengguna" 
      });
    }
  });

  // Memperbarui password pengguna (bisa dilakukan oleh admin atau pengguna itu sendiri)
  app.put("/api/users/:id/password", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { currentPassword, newPassword } = req.body;
      
      // Hanya admin atau pengguna itu sendiri yang boleh mengubah password
      const isAdmin = (req.user as any).role === 'admin';
      const isSelf = (req.user as any).id === id;
      
      if (!isAdmin && !isSelf) {
        return res.status(403).json({ 
          success: false, 
          message: "Tidak memiliki izin untuk mengubah password pengguna ini" 
        });
      }
      
      // Dapatkan pengguna yang ada
      const existingUser = await storage.getUser(id);
      
      if (!existingUser) {
        return res.status(404).json({ 
          success: false, 
          message: "Pengguna tidak ditemukan" 
        });
      }
      
      // BUG FIX #10: Verifikasi password dengan benar (plaintext atau hashed)
      if (!isAdmin) {
        let passwordValid = false;
        if (existingUser.password.includes('.')) {
          try {
            // Password sudah dihash
            passwordValid = await comparePasswords(currentPassword, existingUser.password);
          } catch (err) {
            console.error('Error comparing hashed password:', err);
            passwordValid = false;
          }
        } else {
          // Password masih plaintext (backward compatibility)
          passwordValid = existingUser.password === currentPassword;
        }

        if (!passwordValid) {
          return res.status(400).json({
            success: false,
            message: "Password saat ini tidak sesuai"
          });
        }
      }
      
      // Perbarui password
      const updatedUser = await storage.updateUserPassword(id, newPassword);
      
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
      console.error("Error updating user password:", error);
      
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat memperbarui password" 
      });
    }
  });

  // Memperbarui profil pengguna yang sedang login
  app.put("/api/users/profile", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: "Tidak terautentikasi" });
      }
      
      const userId = (req.user as any).id;
      const { name, username } = req.body;
      
      if (!name && !username) {
        return res.status(400).json({ 
          success: false, 
          message: "Tidak ada data yang diubah" 
        });
      }
      
      // Periksa apakah username sudah digunakan oleh pengguna lain
      if (username && username !== (req.user as any).username) {
        const existingUser = await storage.getUserByUsername(username);
        
        if (existingUser && existingUser.id !== userId) {
          return res.status(409).json({ 
            success: false, 
            message: "Username sudah digunakan oleh pengguna lain" 
          });
        }
      }
      
      // Perbarui profil
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
            message: "Profil diperbarui tapi gagal memperbarui sesi" 
          });
        }
        
        // Hapus password dari response
        const { password, ...userWithoutPassword } = updatedUser;
        
        return res.status(200).json({
          success: true,
          user: userWithoutPassword,
          message: "Profil berhasil diperbarui"
        });
      });
    } catch (error) {
      console.error("Error updating user profile:", error);
      
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat memperbarui profil" 
      });
    }
  });
}