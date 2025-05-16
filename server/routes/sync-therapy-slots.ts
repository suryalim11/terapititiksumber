/**
 * API routes untuk menyinkronkan data jumlah pasien di therapy slots
 */
import { Request, Response } from "express";
import { syncAllTherapySlotCounts, syncTherapySlotCount } from "../verify-appointment-connection";

/**
 * Menyinkronkan current_count pada semua therapy slots
 * berdasarkan jumlah appointment yang aktual
 */
export async function syncAllSlots(req: Request, res: Response) {
  try {
    console.log("⏳ Memulai proses sinkronisasi current_count untuk semua slot terapi...");
    const updatedCount = await syncAllTherapySlotCounts();
    
    return res.status(200).json({
      success: true,
      message: `Berhasil menyinkronkan ${updatedCount} slot terapi`,
      updatedCount
    });
  } catch (error) {
    console.error("❌ Error saat menyinkronkan therapy slots:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat menyinkronkan therapy slots",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

/**
 * Menyinkronkan current_count untuk therapy slot tertentu
 * @param req.params.id ID therapy slot yang akan disinkronkan
 */
export async function syncSlot(req: Request, res: Response) {
  try {
    const therapySlotId = parseInt(req.params.id, 10);
    
    if (isNaN(therapySlotId)) {
      return res.status(400).json({
        success: false,
        message: "ID therapy slot tidak valid"
      });
    }
    
    console.log(`⏳ Memulai proses sinkronisasi current_count untuk slot terapi ID: ${therapySlotId}...`);
    await syncTherapySlotCount(therapySlotId);
    
    return res.status(200).json({
      success: true,
      message: `Berhasil menyinkronkan slot terapi ID: ${therapySlotId}`
    });
  } catch (error) {
    console.error("❌ Error saat menyinkronkan therapy slot:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat menyinkronkan therapy slot",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}