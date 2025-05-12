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
        // Tanggal sudah berupa string, langsung gunakan
        const existingSlots = await storage.getTherapySlotsByDate(slotData.date);
        console.log(`Ditemukan ${existingSlots.length} slot yang sudah ada pada tanggal ${slotData.date}`);
        
        const slotExists = existingSlots.some(slot => {
          // Untuk perbandingan, gunakan string langsung karena kolom date sudah berupa string
          const isSameTimeSlot = slot.timeSlot === slotData.timeSlot;
          const isSameDate = slot.date === slotData.date;
          console.log(`Perbandingan: existingDate=${slot.date}, newDate=${slotData.date}, isSameTimeSlot=${isSameTimeSlot}, isSameDate=${isSameDate}`);
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
        
        // Karena kita sekarang menggunakan string untuk date di schema, pastikan tanggal dalam format YYYY-MM-DD
        let dateStr;
        
        // Cek jika tanggal sudah dalam format string YYYY-MM-DD
        if (typeof slotData.date === 'string' && slotData.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Gunakan string langsung jika sudah dalam format YYYY-MM-DD
          dateStr = slotData.date;
          console.log(`Menggunakan string tanggal langsung: ${dateStr}`);
        } else {
          // Konversi ke tanggal jika bukan format yang benar
          const slotDate = new Date(slotData.date);
          
          // Format tanggal sebagai YYYY-MM-DD
          const year = slotDate.getFullYear();
          const month = (slotDate.getMonth() + 1).toString().padStart(2, '0');
          const day = slotDate.getDate().toString().padStart(2, '0');
          dateStr = `${year}-${month}-${day}`;
          
          console.log(`Konversi tanggal: ${slotData.date} -> ${dateStr}`);
        }
        
        console.log(`Membuat slot terapi dengan tanggal: ${dateStr} (${typeof dateStr})`);
        
        const newSlot = await storage.createTherapySlot({
          date: dateStr, // Pastikan selalu string format YYYY-MM-DD
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