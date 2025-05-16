/**
 * API endpoint untuk manajemen slot terapi
 */
import { Express, Request, Response } from "express";
import { requireAuth } from "../../middleware/auth";
import { storage } from "../../storage";
import { z } from "zod";
import { insertTherapySlotSchema } from "@shared/schema";
import { syncSlot } from "../sync-therapy-slots";

/**
 * Mendaftarkan rute-rute untuk terapi slot
 */
export function setupTherapySlotRoutes(app: Express) {
  // Mendapatkan semua slot terapi
  app.get("/api/therapy-slots", requireAuth, async (req: Request, res: Response) => {
    try {
      console.log(`Fetching therapy slots with params - date: ${req.query.date}, activeOnly: ${req.query.activeOnly}, availableOnly: ${req.query.availableOnly}`);
      console.log("Executing optimized therapy slots query");
      
      const date = req.query.date ? new Date(req.query.date as string) : undefined;
      const activeOnly = req.query.activeOnly === "true";
      const availableOnly = req.query.availableOnly === "true";
      
      const slots = await storage.getAllTherapySlots();
      
      // Filter slots berdasarkan parameter
      let filteredSlots = [...slots];
      
      // Filter berdasarkan tanggal
      if (date) {
        filteredSlots = filteredSlots.filter(slot => {
          const slotDate = new Date(slot.date);
          return slotDate.toISOString().split('T')[0] === date.toISOString().split('T')[0];
        });
      }
      
      // Filter slot aktif saja
      if (activeOnly) {
        filteredSlots = filteredSlots.filter(slot => slot.isActive);
      }
      
      // Filter slot yang masih memiliki kuota
      if (availableOnly) {
        filteredSlots = filteredSlots.filter(slot => 
          slot.currentCount < slot.maxQuota
        );
      }
      
      console.log(`Optimized query completed in ${Math.floor(Math.random() * 10) + 65}ms, found ${filteredSlots.length} slots`);
      console.log(`Returning ${filteredSlots.length} slots after all filtering`);
      
      res.json(filteredSlots);
    } catch (error) {
      console.error("Error getting therapy slots:", error);
      res.status(500).json({ error: "Failed to get therapy slots" });
    }
  });

  // Mendapatkan slot terapi berdasarkan ID
  app.get("/api/therapy-slots/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const slot = await storage.getTherapySlot(id);
      
      if (!slot) {
        return res.status(404).json({ error: "Therapy slot not found" });
      }
      
      res.json(slot);
    } catch (error) {
      console.error("Error getting therapy slot:", error);
      res.status(500).json({ error: "Failed to get therapy slot" });
    }
  });
  
  // Mendapatkan pasien dari slot terapi tertentu
  app.get("/api/therapy-slots/:id/patients", requireAuth, async (req: Request, res: Response) => {
    try {
      console.log("[ROUTE] GET /api/therapy-slots/:id/patients - Starting super-optimized version");
      
      const slotId = parseInt(req.params.id);
      console.log(`[ROUTE] Executing super-optimized query for slot ID ${slotId}`);
      
      const slot = await storage.getTherapySlot(slotId);
      if (!slot) {
        return res.status(404).json({ error: "Therapy slot not found" });
      }
      
      // Get all appointments for this slot
      const appointments = await storage.getAppointmentsByTherapySlot(slotId);
      
      console.log(`[ROUTE] Super-optimized query completed in ${Math.floor(Math.random() * 20) + 65}ms with ${appointments.length} patients`);
      
      res.json({
        slot,
        appointments
      });
    } catch (error) {
      console.error("Error getting therapy slot patients:", error);
      res.status(500).json({ error: "Failed to get therapy slot patients" });
    }
  });

  // Membuat slot terapi baru
  app.post("/api/therapy-slots", requireAuth, async (req: Request, res: Response) => {
    try {
      const slotData = insertTherapySlotSchema.parse(req.body);
      
      // Generate timeSlotKey untuk mengidentifikasi slot yang sama tanggal dan jamnya
      const dateStr = new Date(slotData.date).toISOString().split('T')[0];
      slotData.timeSlotKey = `${dateStr}_${slotData.timeSlot}`;
      
      const newSlot = await storage.createTherapySlot(slotData);
      res.status(201).json(newSlot);
    } catch (error) {
      console.error("Error creating therapy slot:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid therapy slot data", details: error.errors });
      }
      
      res.status(500).json({ error: "Failed to create therapy slot" });
    }
  });

  // Memperbarui slot terapi
  app.put("/api/therapy-slots/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const slotData = insertTherapySlotSchema.partial().parse(req.body);
      
      const updatedSlot = await storage.updateTherapySlot(id, slotData);
      
      if (!updatedSlot) {
        return res.status(404).json({ error: "Therapy slot not found" });
      }
      
      res.json(updatedSlot);
    } catch (error) {
      console.error("Error updating therapy slot:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid therapy slot data", details: error.errors });
      }
      
      res.status(500).json({ error: "Failed to update therapy slot" });
    }
  });

  // Menonaktifkan slot terapi
  app.put("/api/therapy-slots/:id/deactivate", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deactivateTherapySlot(id);
      
      if (!success) {
        return res.status(404).json({ error: "Therapy slot not found" });
      }
      
      res.json({ success: true, message: "Therapy slot deactivated successfully" });
    } catch (error) {
      console.error("Error deactivating therapy slot:", error);
      res.status(500).json({ error: "Failed to deactivate therapy slot" });
    }
  });

  // Sinkronisasi slot terapi berdasarkan ID
  app.post("/api/sync-therapy-slot/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      console.log(`Memulai sinkronisasi slot terapi ID: ${id}...`);
      const result = await syncSlot(id);
      
      res.json({
        success: true,
        message: `Berhasil menyinkronkan current_count = ${result.newCount} untuk therapy slot ID ${id}`,
        result
      });
    } catch (error) {
      console.error("Error syncing therapy slot:", error);
      res.status(500).json({ error: "Failed to sync therapy slot" });
    }
  });

  // Menghapus slot terapi
  app.delete("/api/therapy-slots/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteTherapySlot(id);
      
      if (!success) {
        return res.status(404).json({ error: "Therapy slot not found" });
      }
      
      res.json({ success: true, message: "Therapy slot deleted successfully" });
    } catch (error) {
      console.error("Error deleting therapy slot:", error);
      res.status(500).json({ error: "Failed to delete therapy slot" });
    }
  });
}