import { Request, Response } from "express";
import { storage } from "../storage";

/**
 * Handler untuk endpoint batch processing slot terapi
 * Berfungsi untuk membuat banyak slot terapi sekaligus
 */
export async function handleTherapySlotsBatch(req: Request, res: Response) {
  try {
    console.log("Membuat slot terapi batch");
    const { slots } = req.body;
    
    if (!Array.isArray(slots) || slots.length === 0) {
      return res.status(400).json({ message: "Valid slots array is required" });
    }
    
    console.log(`Memproses ${slots.length} slot terapi`);
    
    // Array untuk menyimpan hasil pembuatan slot
    const creationResults = [];
    const errors = [];
    
    // Proses setiap slot
    for (const slotData of slots) {
      try {
        // Validasi data slot
        if (!slotData.date || !slotData.timeSlot || !slotData.maxQuota) {
          errors.push({
            slot: slotData,
            error: "Missing required fields (date, timeSlot, or maxQuota)"
          });
          continue;
        }
        
        // Cek apakah kombinasi tanggal dan waktu sudah ada
        const existingSlots = await storage.getTherapySlotsByDate(new Date(slotData.date));
        const slotExists = existingSlots.some(slot => 
          slot.timeSlot === slotData.timeSlot && 
          new Date(slot.date).toDateString() === new Date(slotData.date).toDateString()
        );
        
        if (slotExists) {
          errors.push({
            slot: slotData,
            error: "Therapy slot with this date and time already exists"
          });
          continue;
        }
        
        // Buat slot terapi baru
        const newSlot = await storage.createTherapySlot({
          date: slotData.date,
          timeSlot: slotData.timeSlot,
          maxQuota: slotData.maxQuota,
          isActive: slotData.isActive !== undefined ? slotData.isActive : true
        });
        
        creationResults.push(newSlot);
      } catch (slotError) {
        console.error("Error processing individual slot:", slotError);
        errors.push({
          slot: slotData,
          error: (slotError as Error).message
        });
      }
    }
    
    console.log(`Berhasil membuat ${creationResults.length} slot terapi dari ${slots.length} total slot`);
    
    // Kirim respons dengan rangkuman hasil
    return res.status(201).json({
      success: true,
      createdCount: creationResults.length,
      totalAttempted: slots.length,
      createdSlots: creationResults,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error("Error ketika membuat slot terapi batch:", error);
    return res.status(500).json({ 
      message: "Internal server error", 
      error: (error as Error).message 
    });
  }
}