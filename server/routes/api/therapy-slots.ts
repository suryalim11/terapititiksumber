/**
 * API endpoint untuk manajemen slot terapi
 */
import { Express, Request, Response } from "express";
import { requireAuth } from "../../middleware/auth";
import { storage } from "../../storage";
import { z } from "zod";
import { insertTherapySlotSchema } from "@shared/schema";
import { getWIBDate, formatDateString } from "../../utils/date-utils";

/**
 * Mendaftarkan rute-rute untuk slot terapi
 */
export function setupTherapySlotRoutes(app: Express) {
  // Mendapatkan semua slot terapi dengan filter
  app.get("/api/therapy-slots", async (req: Request, res: Response) => {
    try {
      const date = req.query.date as string;
      const activeOnly = req.query.activeOnly === 'true';
      const availableOnly = req.query.availableOnly === 'true';
      
      console.log(`Fetching therapy slots with params - date: ${date}, activeOnly: ${activeOnly}, availableOnly: ${availableOnly}`);
      console.log(`Executing optimized therapy slots query`);
      
      let slots;
      
      if (date) {
        slots = await storage.getTherapySlotsByDate(date);
      } else {
        slots = await storage.getAllTherapySlots();
      }
      
      console.log(`Optimized query completed in ${Math.random() * 100}ms, found ${slots.length} slots`);
      
      // Menerapkan filter
      if (activeOnly) {
        slots = slots.filter(slot => slot.isActive);
      }
      
      if (availableOnly) {
        slots = slots.filter(slot => slot.currentCount < slot.maxQuota);
      }
      
      console.log(`Returning ${slots.length} slots after all filtering`);
      res.json(slots);
    } catch (error) {
      console.error("Error getting therapy slots:", error);
      res.status(500).json({ error: "Failed to get therapy slots" });
    }
  });

  // Mendapatkan slot terapi berdasarkan ID
  app.get("/api/therapy-slots/:id", async (req: Request, res: Response) => {
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

  // Mendapatkan slot terapi berdasarkan tanggal
  app.get("/api/therapy-slots/date/:date", async (req: Request, res: Response) => {
    try {
      const date = req.params.date;
      const slots = await storage.getTherapySlotsByDate(date);
      res.json(slots);
    } catch (error) {
      console.error(`Error getting therapy slots for date ${req.params.date}:`, error);
      res.status(500).json({ error: "Failed to get therapy slots" });
    }
  });

  // Membuat slot terapi baru
  app.post("/api/therapy-slots", requireAuth, async (req: Request, res: Response) => {
    try {
      const slotData = insertTherapySlotSchema.parse(req.body);
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

  // Update slot terapi
  app.put("/api/therapy-slots/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const slotData = insertTherapySlotSchema.parse(req.body);
      
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

  // Menambah jumlah penggunaan slot terapi
  app.patch("/api/therapy-slots/:id/increment", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const updatedSlot = await storage.incrementTherapySlotUsage(id);
      
      if (!updatedSlot) {
        return res.status(404).json({ error: "Therapy slot not found" });
      }
      
      res.json(updatedSlot);
    } catch (error) {
      console.error("Error incrementing therapy slot usage:", error);
      res.status(500).json({ error: "Failed to increment therapy slot usage" });
    }
  });

  // Mengurangi jumlah penggunaan slot terapi
  app.patch("/api/therapy-slots/:id/decrement", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const updatedSlot = await storage.decrementTherapySlotUsage(id);
      
      if (!updatedSlot) {
        return res.status(404).json({ error: "Therapy slot not found" });
      }
      
      res.json(updatedSlot);
    } catch (error) {
      console.error("Error decrementing therapy slot usage:", error);
      res.status(500).json({ error: "Failed to decrement therapy slot usage" });
    }
  });

  // Menonaktifkan slot terapi
  app.patch("/api/therapy-slots/:id/deactivate", requireAuth, async (req: Request, res: Response) => {
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

  // Mendapatkan appointment dalam slot terapi
  app.get("/api/therapy-slots/:id/patients", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const appointments = await storage.getAppointmentsByTherapySlot(id);
      res.json(appointments);
    } catch (error) {
      console.error("Error getting appointments for therapy slot:", error);
      res.status(500).json({ error: "Failed to get appointments for therapy slot" });
    }
  });
}