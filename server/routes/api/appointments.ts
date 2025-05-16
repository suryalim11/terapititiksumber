/**
 * API endpoint untuk manajemen appointment
 */
import { Express, Request, Response } from "express";
import { requireAuth } from "../../middleware/auth";
import { storage } from "../../storage";
import { z } from "zod";
import { insertAppointmentSchema } from "@shared/schema";
import { getWIBDate, formatDateString } from "../../utils/date-utils";

/**
 * Mendaftarkan rute-rute untuk appointment
 */
export function setupAppointmentRoutes(app: Express) {
  // Mendapatkan semua appointment
  app.get("/api/appointments", requireAuth, async (req: Request, res: Response) => {
    try {
      const appointments = await storage.getAllAppointments();
      res.json(appointments);
    } catch (error) {
      console.error("Error getting appointments:", error);
      res.status(500).json({ error: "Failed to get appointments" });
    }
  });

  // Mendapatkan appointment berdasarkan ID
  app.get("/api/appointments/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const appointment = await storage.getAppointment(id);
      
      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      
      res.json(appointment);
    } catch (error) {
      console.error("Error getting appointment:", error);
      res.status(500).json({ error: "Failed to get appointment" });
    }
  });

  // Mendapatkan appointment berdasarkan tanggal
  app.get("/api/appointments/date/:date", requireAuth, async (req: Request, res: Response) => {
    try {
      const date = req.params.date;
      const appointments = await storage.getAppointmentsByDate(date);
      res.json(appointments);
    } catch (error) {
      console.error("Error getting appointments by date:", error);
      res.status(500).json({ error: "Failed to get appointments" });
    }
  });

  // Mendapatkan appointment berdasarkan pasien
  app.get("/api/appointments/patient/:patientId", requireAuth, async (req: Request, res: Response) => {
    try {
      const patientId = parseInt(req.params.patientId);
      const appointments = await storage.getAppointmentsByPatient(patientId);
      res.json(appointments);
    } catch (error) {
      console.error("Error getting appointments for patient:", error);
      res.status(500).json({ error: "Failed to get appointments" });
    }
  });

  // Mendapatkan appointment berdasarkan slot terapi
  app.get("/api/appointments/slot/:therapySlotId", requireAuth, async (req: Request, res: Response) => {
    try {
      const therapySlotId = parseInt(req.params.therapySlotId);
      const appointments = await storage.getAppointmentsByTherapySlot(therapySlotId);
      res.json(appointments);
    } catch (error) {
      console.error("Error getting appointments for therapy slot:", error);
      res.status(500).json({ error: "Failed to get appointments" });
    }
  });

  // Membuat appointment baru
  app.post("/api/appointments", requireAuth, async (req: Request, res: Response) => {
    try {
      const appointmentData = insertAppointmentSchema.parse(req.body);
      const newAppointment = await storage.createAppointment(appointmentData);
      
      // Jika appointment berhasil dibuat, perbarui jumlah penggunaan slot terapi
      if (newAppointment && newAppointment.therapySlotId) {
        await storage.incrementTherapySlotUsage(newAppointment.therapySlotId);
      }
      
      res.status(201).json(newAppointment);
    } catch (error) {
      console.error("Error creating appointment:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid appointment data", details: error.errors });
      }
      
      res.status(500).json({ error: "Failed to create appointment" });
    }
  });

  // Update status appointment
  app.patch("/api/appointments/:id/status", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }
      
      const updatedAppointment = await storage.updateAppointmentStatus(id, status);
      
      if (!updatedAppointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      
      res.json(updatedAppointment);
    } catch (error) {
      console.error("Error updating appointment status:", error);
      res.status(500).json({ error: "Failed to update appointment status" });
    }
  });

  // Update appointment (untuk verifikasi walk-in)
  app.put("/api/appointments/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const appointmentData = req.body;
      
      // Dapatkan appointment yang ada
      const existingAppointment = await storage.getAppointment(id);
      
      if (!existingAppointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      
      // Perbarui appointment
      const updatedAppointment = await storage.updateAppointment(id, {
        ...existingAppointment,
        ...appointmentData
      });
      
      // Handle kasus perubahan slot terapi jika perlu
      
      res.json(updatedAppointment);
    } catch (error) {
      console.error("Error updating appointment:", error);
      res.status(500).json({ error: "Failed to update appointment" });
    }
  });

  // Menghapus appointment
  app.delete("/api/appointments/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Dapatkan appointment sebelum dihapus
      const appointment = await storage.getAppointment(id);
      
      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      
      // Simpan therapySlotId untuk dikurangi penggunaannya nanti
      const therapySlotId = appointment.therapySlotId;
      
      // Hapus appointment
      const success = await storage.deleteAppointment(id);
      
      if (!success) {
        return res.status(500).json({ error: "Failed to delete appointment" });
      }
      
      // Kurangi jumlah penggunaan slot terapi jika ada
      if (therapySlotId) {
        await storage.decrementTherapySlotUsage(therapySlotId);
      }
      
      res.json({ success: true, message: "Appointment deleted successfully" });
    } catch (error) {
      console.error("Error deleting appointment:", error);
      res.status(500).json({ error: "Failed to delete appointment" });
    }
  });
}