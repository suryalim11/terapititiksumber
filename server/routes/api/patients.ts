/**
 * API endpoint untuk manajemen pasien
 */
import { Express, Request, Response } from "express";
import { requireAuth } from "../../middleware/auth";
import { storage } from "../../storage";
import { z } from "zod";
import { insertPatientSchema } from "@shared/schema";
import { getWIBDate, formatDateString } from "../../utils/date-utils";

/**
 * Mendaftarkan rute-rute untuk pasien
 */
export function setupPatientRoutes(app: Express) {
  // Mendapatkan semua pasien
  app.get("/api/patients", requireAuth, async (req: Request, res: Response) => {
    try {
      const patients = await storage.getAllPatients();
      res.json(patients);
    } catch (error) {
      console.error("Error getting patients:", error);
      res.status(500).json({ error: "Failed to get patients" });
    }
  });

  // Mendapatkan pasien berdasarkan ID
  app.get("/api/patients/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const patient = await storage.getPatient(id);
      
      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
      }
      
      res.json(patient);
    } catch (error) {
      console.error("Error getting patient:", error);
      res.status(500).json({ error: "Failed to get patient" });
    }
  });

  // Membuat pasien baru
  app.post("/api/patients", requireAuth, async (req: Request, res: Response) => {
    try {
      const patientData = insertPatientSchema.parse(req.body);
      const newPatient = await storage.createPatient(patientData);
      res.status(201).json(newPatient);
    } catch (error) {
      console.error("Error creating patient:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid patient data", details: error.errors });
      }
      
      res.status(500).json({ error: "Failed to create patient" });
    }
  });

  // Update pasien
  app.put("/api/patients/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const patientData = insertPatientSchema.parse(req.body);
      
      const updatedPatient = await storage.updatePatient(id, patientData);
      
      if (!updatedPatient) {
        return res.status(404).json({ error: "Patient not found" });
      }
      
      res.json(updatedPatient);
    } catch (error) {
      console.error("Error updating patient:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid patient data", details: error.errors });
      }
      
      res.status(500).json({ error: "Failed to update patient" });
    }
  });

  // Menghapus pasien
  app.delete("/api/patients/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deletePatient(id);
      
      if (!success) {
        return res.status(404).json({ error: "Patient not found" });
      }
      
      res.json({ success: true, message: "Patient deleted successfully" });
    } catch (error) {
      console.error("Error deleting patient:", error);
      res.status(500).json({ error: "Failed to delete patient" });
    }
  });

  // Pencarian pasien berdasarkan nama atau nomor telepon
  app.get("/api/patients/search/:query", requireAuth, async (req: Request, res: Response) => {
    try {
      const query = req.params.query;
      const patients = await storage.searchPatientByNameOrPhone(query);
      res.json(patients);
    } catch (error) {
      console.error("Error searching patients:", error);
      res.status(500).json({ error: "Failed to search patients" });
    }
  });
}