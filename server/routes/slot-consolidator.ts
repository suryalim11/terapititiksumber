/**
 * Modul untuk mengkonsolidasikan slot terapi dengan waktu yang sama
 * Menggabungkan slot duplikat (seperti 455 dan 475 dengan waktu 15:00-17:00)
 * dan memigrasi semua appointment ke slot utama
 */

import { Request, Response } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import * as schema from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';

interface ConsolidationResult {
  migratedSlots: number;
  migratedAppointments: number;
  details: { 
    originalSlotId: number;
    targetSlotId: number;
    timeSlot: string;
    movedAppointments: number;
  }[];
  errors: any[];
}

/**
 * Mencari semua slot terapi duplikat dengan waktu dan tanggal yang sama
 * @returns Daftar slot duplikat yang ditemukan
 */
export async function findDuplicateSlots() {
  try {
    // Query untuk mencari slot dengan tanggal dan waktu yang sama tetapi ID berbeda
    const duplicates = await db.execute(sql`
      SELECT date, time_slot, COUNT(*) as count, 
      ARRAY_AGG(id) as slot_ids, ARRAY_AGG(current_count) as current_counts
      FROM therapy_slots
      GROUP BY date, time_slot
      HAVING COUNT(*) > 1
      ORDER BY date ASC, time_slot ASC
    `);

    return duplicates.rows;
  } catch (error) {
    console.error("Error saat mencari slot duplikat:", error);
    throw error;
  }
}

/**
 * Mengkonsolidasikan slot terapi duplikat
 * Memigrasi semua appointment dari slot duplikat ke slot utama
 * @param req.body.autoConsolidate Boolean untuk menentukan apakah akan otomatis konsolidasi (true) atau hanya scan (false)
 */
export async function consolidateDuplicateSlots(req: Request, res: Response) {
  try {
    const { autoConsolidate = false } = req.body;
    
    const result: ConsolidationResult = {
      migratedSlots: 0,
      migratedAppointments: 0,
      details: [],
      errors: []
    };

    // Temukan semua slot duplikat
    const duplicates = await findDuplicateSlots();
    
    if (!duplicates || duplicates.length === 0) {
      return res.status(200).json({
        status: "success",
        message: "Tidak ditemukan slot duplikat",
        result
      });
    }

    console.log(`Ditemukan ${duplicates.length} kelompok slot duplikat`);
    
    // Jika hanya scan, kembalikan informasi duplikat saja
    if (!autoConsolidate) {
      return res.status(200).json({
        status: "success",
        message: `Ditemukan ${duplicates.length} kelompok slot duplikat. Gunakan mode autoConsolidate=true untuk menggabungkan secara otomatis.`,
        duplicateGroups: duplicates
      });
    }
    
    // Jika autoConsolidate, lakukan konsolidasi
    for (const group of duplicates) {
      try {
        const slotIds = group.slot_ids;
        if (!slotIds || !Array.isArray(slotIds) || slotIds.length < 2) {
          result.errors.push({
            message: "Format slot_ids tidak valid",
            group
          });
          continue;
        }

        // Pilih ID slot terkecil sebagai target
        const targetSlotId = Math.min(...slotIds);
        const otherSlotIds = slotIds.filter(id => id !== targetSlotId);
        
        console.log(`Mengkonsolidasi ${otherSlotIds.length} slot (${otherSlotIds.join(', ')}) ke slot target ${targetSlotId}`);
        
        // Untuk setiap slot lain, pindahkan appointment ke slot target
        for (const sourceSlotId of otherSlotIds) {
          try {
            // Cari semua appointment di slot yang akan dihapus
            const appointments = await db
              .select()
              .from(schema.appointments)
              .where(eq(schema.appointments.therapySlotId, sourceSlotId));
            
            console.log(`Ditemukan ${appointments.length} appointment di slot ${sourceSlotId}`);
            
            // Pindahkan setiap appointment ke slot target
            let movedCount = 0;
            for (const appointment of appointments) {
              try {
                await db
                  .update(schema.appointments)
                  .set({ therapySlotId: targetSlotId })
                  .where(eq(schema.appointments.id, appointment.id));
                
                movedCount++;
              } catch (error) {
                result.errors.push({
                  message: `Gagal memindahkan appointment ${appointment.id}`,
                  sourceSlotId,
                  targetSlotId,
                  error
                });
              }
            }
            
            // Update counter di slot target
            if (movedCount > 0) {
              await db
                .update(schema.therapySlots)
                .set({
                  currentCount: sql`current_count + ${movedCount}`
                })
                .where(eq(schema.therapySlots.id, targetSlotId));
                
              result.migratedAppointments += movedCount;
            }
            
            // Nonaktifkan slot yang tidak digunakan lagi
            await db
              .update(schema.therapySlots)
              .set({ 
                isActive: false,
                currentCount: 0
              })
              .where(eq(schema.therapySlots.id, sourceSlotId));
            
            // Tambahkan detail ke hasil
            result.details.push({
              originalSlotId: sourceSlotId,
              targetSlotId,
              timeSlot: group.time_slot,
              movedAppointments: movedCount
            });
            
            result.migratedSlots++;
            
          } catch (error) {
            result.errors.push({
              message: `Gagal memproses slot ${sourceSlotId}`,
              sourceSlotId,
              targetSlotId,
              error
            });
          }
        }
      } catch (error) {
        result.errors.push({
          message: "Gagal memproses kelompok duplikat",
          group,
          error
        });
      }
    }
    
    return res.status(200).json({
      status: "success",
      message: `Berhasil mengkonsolidasi ${result.migratedSlots} slot terapi dengan ${result.migratedAppointments} appointment`,
      result
    });
    
  } catch (error) {
    console.error("Error saat konsolidasi slot:", error);
    return res.status(500).json({
      status: "error",
      message: "Terjadi kesalahan saat mengkonsolidasi slot terapi",
      error: error instanceof Error ? error.message : String(error)
    });
  }
}