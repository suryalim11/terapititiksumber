/**
 * API endpoint untuk manajemen paket terapi
 */
import { Express, Request, Response } from "express";
import { requireAuth } from "../../middleware/auth";
import { storage } from "../../storage";
import { z } from "zod";
import { insertPackageSchema } from "@shared/schema";

/**
 * Mendaftarkan rute-rute untuk paket terapi
 */
export function setupPackageRoutes(app: Express) {
  // Mendapatkan semua paket
  app.get("/api/packages", async (req: Request, res: Response) => {
    try {
      const packages = await storage.getAllPackages();
      res.json(packages);
    } catch (error) {
      console.error("Error getting packages:", error);
      res.status(500).json({ error: "Failed to get packages" });
    }
  });

  // Mendapatkan paket berdasarkan ID
  app.get("/api/packages/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const packageData = await storage.getPackage(id);
      
      if (!packageData) {
        return res.status(404).json({ error: "Package not found" });
      }
      
      res.json(packageData);
    } catch (error) {
      console.error("Error getting package:", error);
      res.status(500).json({ error: "Failed to get package" });
    }
  });

  // Membuat paket baru
  app.post("/api/packages", requireAuth, async (req: Request, res: Response) => {
    try {
      const packageData = insertPackageSchema.parse(req.body);
      const newPackage = await storage.createPackage(packageData);
      res.status(201).json(newPackage);
    } catch (error) {
      console.error("Error creating package:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid package data", details: error.errors });
      }
      
      res.status(500).json({ error: "Failed to create package" });
    }
  });

  // Update paket
  app.put("/api/packages/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const packageData = insertPackageSchema.parse(req.body);
      
      const updatedPackage = await storage.updatePackage(id, packageData);
      
      if (!updatedPackage) {
        return res.status(404).json({ error: "Package not found" });
      }
      
      res.json(updatedPackage);
    } catch (error) {
      console.error("Error updating package:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid package data", details: error.errors });
      }
      
      res.status(500).json({ error: "Failed to update package" });
    }
  });

  // Menghapus paket
  app.delete("/api/packages/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deletePackage(id);
      
      if (!success) {
        return res.status(404).json({ error: "Package not found" });
      }
      
      res.json({ success: true, message: "Package deleted successfully" });
    } catch (error) {
      console.error("Error deleting package:", error);
      res.status(500).json({ error: "Failed to delete package" });
    }
  });
}