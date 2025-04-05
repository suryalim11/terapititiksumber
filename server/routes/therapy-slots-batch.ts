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
    
    console.log(`Membuat ${slots.length} slot terapi secara batch`);
    
    // Proses setiap slot
    for (const slotData of slots) {
      try {
        // Validasi data slot
        if (!slotData.date || !slotData.timeSlot || !slotData.maxQuota) {
          console.log(`Validasi gagal untuk slot: ${JSON.stringify(slotData)}`);
          errors.push({
            slot: slotData,
            error: "Missing required fields (date, timeSlot, or maxQuota)"
          });
          continue;
        }
        
        // Log detail permintaan
        console.log(`Memproses slot: date=${slotData.date} (${typeof slotData.date}), timeSlot=${slotData.timeSlot}, maxQuota=${slotData.maxQuota}`);
        
        // Cek apakah kombinasi tanggal dan waktu sudah ada
        const existingSlots = await storage.getTherapySlotsByDate(new Date(slotData.date));
        console.log(`Ditemukan ${existingSlots.length} slot yang sudah ada pada tanggal ${slotData.date}`);
        
        const slotExists = existingSlots.some(slot => {
          const existingDate = new Date(slot.date).toDateString();
          const newDate = new Date(slotData.date).toDateString();
          const isSameTimeSlot = slot.timeSlot === slotData.timeSlot;
          const isSameDate = existingDate === newDate;
          console.log(`Perbandingan: existingDate=${existingDate}, newDate=${newDate}, isSameTimeSlot=${isSameTimeSlot}, isSameDate=${isSameDate}`);
          return isSameTimeSlot && isSameDate;
        });
        
        if (slotExists) {
          console.log(`Slot terapi sudah ada untuk date=${slotData.date}, timeSlot=${slotData.timeSlot}`);
          errors.push({
            slot: slotData,
            error: "Therapy slot with this date and time already exists"
          });
          continue;
        }
        
        // Log tanggal sebelum pemrosesan
        console.log(`Processing date: ${slotData.date}, type: ${typeof slotData.date}`);
        
        // Pastikan date dalam format string YYYY-MM-DD
        let formattedDate = slotData.date;
        if (typeof formattedDate === 'object' && formattedDate instanceof Date) {
          const year = formattedDate.getFullYear();
          const month = (formattedDate.getMonth() + 1).toString().padStart(2, '0');
          const day = formattedDate.getDate().toString().padStart(2, '0');
          formattedDate = `${year}-${month}-${day}`;
        }
        
        console.log(`Using formatted date: ${formattedDate}`);
        
        // Buat slot terapi baru
        const newSlot = await storage.createTherapySlot({
          date: formattedDate, // Gunakan string format YYYY-MM-DD
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