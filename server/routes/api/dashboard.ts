/**
 * API endpoint untuk data dashboard
 */
import { Express, Request, Response } from "express";
import { requireAuth } from "../../middleware/auth";
import { storage } from "../../storage";

/**
 * Mendaftarkan rute-rute untuk dashboard
 */
export function setupDashboardRoutes(app: Express) {
  // Mendapatkan statistik dashboard
  app.get("/api/dashboard/stats", async (req: Request, res: Response) => {
    try {
      const stats = await storage.getDailyStats();
      return res.json(stats);
    } catch (error) {
      console.error("Error getting dashboard stats:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat mengambil statistik dashboard" 
      });
    }
  });

  // Mendapatkan daftar paket terapi aktif
  app.get("/api/dashboard/active-packages", async (req: Request, res: Response) => {
    try {
      const activeSessions = await storage.getAllActiveSessions();
      return res.json(activeSessions);
    } catch (error) {
      console.error("Error getting active packages:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat mengambil daftar paket aktif" 
      });
    }
  });

  // Mendapatkan aktivitas terbaru 
  app.get("/api/dashboard/activities", requireAuth, async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const activities = await storage.getRecentActivities(limit);
      return res.json(activities);
    } catch (error) {
      console.error("Error getting recent activities:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat mengambil aktivitas terbaru" 
      });
    }
  });
}