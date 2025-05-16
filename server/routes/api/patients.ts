/**
 * API Endpoints untuk manajemen pasien
 */
import { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../../storage";
import { requireAuth } from "../../middleware/auth";
import { insertPatientSchema } from "@shared/schema";
import { like } from "drizzle-orm";
import { db } from "../../db";
import { patients } from "@shared/schema";
import { verifyAppointmentConnectionForPatient } from "../../verify-appointment-connection";

/**
 * Mendaftarkan semua rute terkait pasien
 */
export function setupPatientRoutes(app: Express) {
  // Get all patients
  app.get("/api/patients", requireAuth, async (req: Request, res: Response) => {
    try {
      const patients = await storage.getAllPatients();
      res.json(patients);
    } catch (error) {
      console.error("Error getting patients:", error);
      res.status(500).json({ error: "Failed to get patients" });
    }
  });

  // Search patients by name or phone
  app.get("/api/patients/search", requireAuth, async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: "Search query is required" });
      }

      const patients = await storage.searchPatientByNameOrPhone(query);
      res.json(patients);
    } catch (error) {
      console.error("Error searching patients:", error);
      res.status(500).json({ error: "Failed to search patients" });
    }
  });

  // Get patient by ID
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

  // Get related patients by phone
  app.get("/api/patients/:id/related", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const patient = await storage.getPatient(id);
      
      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
      }
      
      // Find other patients with same phone number
      const relatedPatients = await db.select()
        .from(patients)
        .where(like(patients.phoneNumber, patient.phoneNumber))
        .where(id => id.not(patients.id.equals(id)));
      
      res.json(relatedPatients);
    } catch (error) {
      console.error("Error getting related patients:", error);
      res.status(500).json({ error: "Failed to get related patients" });
    }
  });

  // Create new patient
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

  // Update patient
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

  // Delete patient
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

  // Verify patient connection
  app.post("/api/verify-connection/patient/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const patientId = parseInt(req.params.id);
      const result = await verifyAppointmentConnectionForPatient(patientId);
      
      res.json({
        success: true,
        message: "Verifikasi koneksi pasien berhasil",
        result
      });
    } catch (error) {
      console.error("Error verifying patient connection:", error);
      res.status(500).json({ error: "Failed to verify patient connection" });
    }
  });
}