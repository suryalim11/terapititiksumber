import { Request, Response } from "express";
import { db } from "../../db";
import * as schema from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { storage } from "../../storage";

/**
 * Mengambil data dasar slot terapi (detail utama)
 */
export async function getSimpleSlotBasic(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: "Invalid slot ID" });
    }
    
    const slotId = parseInt(id);
    
    // Ambil data langsung dari database
    const result = await db.select().from(schema.therapySlots).where(eq(schema.therapySlots.id, slotId)).limit(1);
    
    if (result.length === 0) {
      return res.status(404).json({ error: "Slot not found" });
    }
    
    // Kembalikan data asli dari database
    res.json(result[0]);
  } catch (error) {
    console.error("Error fetching simple slot basic:", error);
    res.status(500).json({ error: "Server error" });
  }
}

/**
 * Mengambil daftar pasien yang terdaftar pada slot terapi
 */
export async function getSimpleSlotPatients(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: "Invalid slot ID" });
    }
    
    const slotId = parseInt(id);
    
    // Query untuk mendapatkan pasien dengan appointment untuk slot ini
    const patientQuery = sql`
      SELECT 
        p.id, 
        p."patient_id" as "patientId", 
        p.name, 
        p."phone_number" as phone, 
        p.email, 
        p.gender, 
        p.address, 
        p."birth_date" as "dateOfBirth",
        a.status as "appointmentStatus",
        a.id as "appointmentId",
        CASE WHEN a.status = 'Active' THEN TRUE ELSE FALSE END as walkin
      FROM 
        ${schema.patients} p
      JOIN 
        ${schema.appointments} a ON p.id = a."patient_id"
      WHERE 
        a."therapy_slot_id" = ${slotId}
      AND
        a.status != 'Cancelled'
      ORDER BY 
        a.id ASC
    `;
    
    const result = await db.execute(patientQuery);
    
    // Ambil hanya array rows dari hasil query
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching simple slot patients:", error);
    res.status(500).json({ error: "Server error" });
  }
}