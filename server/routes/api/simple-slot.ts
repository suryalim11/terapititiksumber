/**
 * API endpoint sederhana dan cepat untuk mendapatkan data slot terapi
 * Dirancang untuk performa maksimal dan ukuran payload minimal
 */

import type { Express, Request, Response } from "express";
import { db } from "../../db";
import { therapySlots, appointments, patients } from "@shared/schema";
import { eq, and, desc, ne, isNull } from "drizzle-orm";
import { requireAuth } from "../../middleware/auth";

/**
 * Setup rute-rute untuk akses cepat slot terapi
 */
export function setupSimpleSlotRoutes(app: Express) {
  // Endpoint sederhana untuk mendapatkan data dasar slot
  app.get("/api/simple-slot/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const slotId = parseInt(req.params.id);
      
      if (isNaN(slotId)) {
        return res.status(400).json({ 
          success: false, 
          message: "ID slot tidak valid" 
        });
      }
      
      console.log(`📋 API Sederhana: Mengambil data untuk slot ID ${slotId}`);
      
      // Ambil data slot dasar dengan performa maksimal
      const slotData = await db.select({
        id: therapySlots.id,
        date: therapySlots.date,
        timeSlot: therapySlots.timeSlot,
        timeSlotKey: therapySlots.timeSlotKey,
        maxQuota: therapySlots.maxQuota,
        currentCount: therapySlots.currentCount,
        isActive: therapySlots.isActive,
        globalQuota: therapySlots.globalQuota
      })
      .from(therapySlots)
      .where(eq(therapySlots.id, slotId))
      .limit(1);
      
      if (!slotData || slotData.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: "Slot terapi tidak ditemukan" 
        });
      }
      
      // Hitung jumlah pasien secara terpisah
      const countResult = await db.select({
        count: db.$count(appointments.id)
      })
      .from(appointments)
      .where(eq(appointments.therapySlotId, slotId));
      
      const patientCount = countResult[0]?.count || 0;
      
      // Kembalikan data minimal dan cepat
      return res.json({
        success: true,
        data: {
          ...slotData[0],
          patientCount
        }
      });
      
    } catch (error) {
      console.error("Error dalam simple-slot API:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat mengambil data slot" 
      });
    }
  });
  
  // Endpoint untuk mendapatkan daftar pasien dalam slot
  app.get("/api/simple-slot/:id/patients", requireAuth, async (req: Request, res: Response) => {
    try {
      const slotId = parseInt(req.params.id);
      
      if (isNaN(slotId)) {
        return res.status(400).json({ 
          success: false, 
          message: "ID slot tidak valid" 
        });
      }
      
      console.log(`👥 API Sederhana: Mengambil data pasien untuk slot ID ${slotId}`);
      
      // Ambil data appointment dengan join minimal ke tabel pasien
      const appointmentData = await db.select({
        id: appointments.id,
        patientId: appointments.patientId,
        status: appointments.status,
        notes: appointments.notes,
        date: appointments.date,
        // Data pasien minimal
        patientName: patients.name,
        patientPhone: patients.phoneNumber,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .where(eq(appointments.therapySlotId, slotId))
      .orderBy(desc(appointments.id));
      
      // Hitung jumlah pasien
      const count = appointmentData.length;
      
      // Kembalikan data dengan format yang konsisten
      return res.json({
        success: true,
        count,
        data: appointmentData
      });
      
    } catch (error) {
      console.error("Error dalam simple-slot/patients API:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat mengambil data pasien" 
      });
    }
  });
}