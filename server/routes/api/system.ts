/**
 * API endpoint untuk operasi sistem
 */
import { Express, Request, Response } from "express";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import { storage } from "../../storage";
import { getWIBDate, formatDateString, getTodayDateString } from "../../utils/date-utils";
import { consolidateSlots, mergeSlots } from "../slot-consolidator";

/**
 * Mendaftarkan rute-rute untuk operasi sistem
 */
export function setupSystemRoutes(app: Express) {
  // Mendapatkan statistik dashboard
  app.get("/api/system/stats", requireAuth, async (req: Request, res: Response) => {
    try {
      const stats = await storage.getDailyStats();
      res.json(stats);
    } catch (error) {
      console.error("Error getting system stats:", error);
      res.status(500).json({ error: "Failed to get system stats" });
    }
  });

  // Mendapatkan aktivitas terbaru
  app.get("/api/system/activities", requireAuth, async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const activities = await storage.getRecentActivities(limit);
      res.json(activities);
    } catch (error) {
      console.error("Error getting recent activities:", error);
      res.status(500).json({ error: "Failed to get recent activities" });
    }
  });

  // Mendapatkan slot terapi yang dapat digabungkan (duplikat)
  app.get("/api/system/duplicate-slots", requireAuth, async (req: Request, res: Response) => {
    try {
      const allSlots = await storage.getAllTherapySlots();
      
      // Mengelompokkan slot berdasarkan kombinasi date+timeSlot
      const slotGroups = new Map();
      
      for (const slot of allSlots) {
        const key = `${slot.date}_${slot.timeSlot}`;
        
        if (!slotGroups.has(key)) {
          slotGroups.set(key, []);
        }
        
        slotGroups.get(key).push(slot);
      }
      
      // Mengidentifikasi kelompok dengan lebih dari satu slot (duplikat)
      const duplicateGroups = [];
      
      for (const [key, slots] of slotGroups.entries()) {
        if (slots.length > 1) {
          duplicateGroups.push({
            key,
            slots: slots.map(s => ({
              id: s.id,
              date: s.date,
              timeSlot: s.timeSlot,
              currentCount: s.currentCount,
              maxQuota: s.maxQuota,
              isActive: s.isActive
            }))
          });
        }
      }
      
      res.json({
        duplicateGroupCount: duplicateGroups.length,
        duplicateGroups
      });
    } catch (error) {
      console.error("Error getting duplicate slots:", error);
      res.status(500).json({ error: "Failed to get duplicate slots" });
    }
  });

  // Konsolidasi slot terapi duplikat
  app.post("/api/system/consolidate-slots", requireAdmin, async (req: Request, res: Response) => {
    try {
      const result = await consolidateSlots();
      res.json(result);
    } catch (error) {
      console.error("Error consolidating slots:", error);
      res.status(500).json({ error: "Failed to consolidate slots" });
    }
  });

  // Menggabungkan slot terapi yang dipilih
  app.post("/api/system/merge-slots", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { targetSlotId, sourceSlotIds } = req.body;
      
      if (!targetSlotId || !sourceSlotIds || !Array.isArray(sourceSlotIds) || sourceSlotIds.length === 0) {
        return res.status(400).json({ error: "Target slot ID and source slot IDs are required" });
      }
      
      const result = await mergeSlots(targetSlotId, sourceSlotIds);
      res.json(result);
    } catch (error) {
      console.error("Error merging slots:", error);
      res.status(500).json({ error: "Failed to merge slots" });
    }
  });

  // Menyinkronkan kuota slot terapi
  app.post("/api/system/sync-slot-quota", requireAdmin, async (req: Request, res: Response) => {
    try {
      const result = await storage.syncTherapySlotQuota();
      res.json(result);
    } catch (error) {
      console.error("Error syncing slot quota:", error);
      res.status(500).json({ error: "Failed to sync slot quota" });
    }
  });

  // Memperbaiki tanggal appointment yang tidak konsisten
  app.post("/api/system/resync-appointment-dates", requireAdmin, async (req: Request, res: Response) => {
    try {
      const result = await storage.resyncAppointmentDates();
      res.json(result);
    } catch (error) {
      console.error("Error resyncing appointment dates:", error);
      res.status(500).json({ error: "Failed to resync appointment dates" });
    }
  });
}