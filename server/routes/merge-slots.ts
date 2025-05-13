/**
 * Modul untuk menggabungkan slot terapi duplikat
 * Memigrasi semua appointment dari slot dengan ID lebih tinggi 
 * ke slot dengan ID lebih rendah (primary slot)
 */

import { Request, Response } from "express";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import * as schema from "@shared/schema";
import { findPrimaryTherapySlot } from "../findPrimaryTherapySlot";

/**
 * Endpoint untuk menggabungkan slot terapi yang duplikat
 * berdasarkan timeSlotKey (tanggal dan waktu)
 */
export async function mergeTherapySlots(req: Request, res: Response) {
  try {
    console.log("Memulai proses menggabungkan slot terapi duplikat...");

    // Langkah 1: Temukan semua slot duplikat
    const duplicateSlotsResult = await db.query.therapySlots.findMany({
      orderBy: [{ column: schema.therapySlots.timeSlotKey, order: 'asc' }],
    });

    // Buat index dari slot berdasarkan timeSlotKey
    const slotsByTimeSlotKey: { [key: string]: any[] } = {};
    for (const slot of duplicateSlotsResult) {
      if (!slot.timeSlotKey) continue; // Skip jika tidak ada timeSlotKey

      if (!slotsByTimeSlotKey[slot.timeSlotKey]) {
        slotsByTimeSlotKey[slot.timeSlotKey] = [];
      }
      slotsByTimeSlotKey[slot.timeSlotKey].push(slot);
    }

    // Langkah 2: Proses setiap grup slot duplikat
    const results: any = {
      totalDuplicateGroups: 0,
      totalMergedAppointments: 0,
      totalDeactivatedSlots: 0,
      mergedGroups: []
    };

    for (const timeSlotKey in slotsByTimeSlotKey) {
      const slots = slotsByTimeSlotKey[timeSlotKey];
      
      // Skip jika hanya ada 1 slot dengan timeSlotKey ini
      if (slots.length <= 1) {
        continue;
      }

      // Sort slot berdasarkan ID (dari terkecil ke terbesar)
      slots.sort((a, b) => a.id - b.id);

      // Slot utama adalah yang memiliki ID terkecil
      const primarySlot = slots[0];
      const duplicateSlots = slots.slice(1);

      console.log(`\n[Grup ${results.totalDuplicateGroups + 1}] Menemukan ${slots.length} slot duplikat dengan timeSlotKey: ${timeSlotKey}`);
      console.log(`- Slot utama: ID=${primarySlot.id}, tanggal=${primarySlot.date}, waktu=${primarySlot.timeSlot}`);
      console.log(`- Slot duplikat: ${duplicateSlots.map(s => s.id).join(', ')}`);

      // Langkah 3: Migrasi semua appointment dari slot duplikat ke slot utama
      let totalAppointmentsMerged = 0;
      let groupSummary = {
        timeSlotKey,
        primarySlotId: primarySlot.id,
        duplicateSlotIds: duplicateSlots.map(s => s.id),
        appointmentsMigrated: 0,
        appointmentDetails: [] as any[]
      };

      for (const duplicateSlot of duplicateSlots) {
        // Cari semua appointment dari slot duplikat
        const appointments = await db.select()
          .from(schema.appointments)
          .where(eq(schema.appointments.therapySlotId, duplicateSlot.id));

        console.log(`  [ID=${duplicateSlot.id}] Menemukan ${appointments.length} appointment untuk dimigrasi`);

        // Migrasi setiap appointment ke slot utama
        for (const appointment of appointments) {
          try {
            // Update appointment untuk mengarah ke slot utama
            const [updatedAppointment] = await db.update(schema.appointments)
              .set({ therapySlotId: primarySlot.id })
              .where(eq(schema.appointments.id, appointment.id))
              .returning();

            if (updatedAppointment) {
              console.log(`    ✅ Berhasil migrasi appointment ID=${appointment.id} dari slot ID=${duplicateSlot.id} ke ${primarySlot.id}`);
              totalAppointmentsMerged++;
              groupSummary.appointmentDetails.push({
                appointmentId: appointment.id,
                fromSlotId: duplicateSlot.id,
                toSlotId: primarySlot.id,
                patientId: appointment.patientId,
                status: appointment.status
              });
            } else {
              console.log(`    ❌ Gagal migrasi appointment ID=${appointment.id}`);
            }
          } catch (error) {
            console.error(`    ❌ Error migrasi appointment ID=${appointment.id}:`, error);
          }
        }

        // Langkah 4: Nonaktifkan slot duplikat
        try {
          // Update status slot menjadi tidak aktif
          await db.update(schema.therapySlots)
            .set({ isActive: false })
            .where(eq(schema.therapySlots.id, duplicateSlot.id));
            
          console.log(`  ✅ Nonaktifkan slot duplikat ID=${duplicateSlot.id}`);
          results.totalDeactivatedSlots++;
        } catch (error) {
          console.error(`  ❌ Gagal menonaktifkan slot duplikat ID=${duplicateSlot.id}:`, error);
        }
      }

      // Langkah 5: Update counter pada slot utama
      try {
        // Hitung ulang jumlah appointment aktif untuk slot utama
        const activeAppointments = await db.select({ count: db.fn.count() })
          .from(schema.appointments)
          .where(
            and(
              eq(schema.appointments.therapySlotId, primarySlot.id),
              eq(schema.appointments.status, "Scheduled")
            )
          );
        
        const activeCount = parseInt(activeAppointments[0]?.count?.toString() || "0", 10);
        
        // Update currentCount pada slot utama
        await db.update(schema.therapySlots)
          .set({ currentCount: activeCount })
          .where(eq(schema.therapySlots.id, primarySlot.id));
          
        console.log(`  ✅ Updated counter for primary slot ID=${primarySlot.id} to ${activeCount}`);
      } catch (error) {
        console.error(`  ❌ Failed to update counter for primary slot ID=${primarySlot.id}:`, error);
      }

      // Tambahkan hasil untuk grup ini
      groupSummary.appointmentsMigrated = totalAppointmentsMerged;
      results.totalMergedAppointments += totalAppointmentsMerged;
      results.mergedGroups.push(groupSummary);
      results.totalDuplicateGroups++;
    }

    // Langkah 6: Mengembalikan hasil penggabungan
    console.log("\nSUMMARY:");
    console.log(`- Total grup duplikat: ${results.totalDuplicateGroups}`);
    console.log(`- Total appointment yang dimigrasi: ${results.totalMergedAppointments}`);
    console.log(`- Total slot yang dinonaktifkan: ${results.totalDeactivatedSlots}`);
    
    return res.status(200).json({
      success: true,
      message: `Berhasil menggabungkan ${results.totalDuplicateGroups} grup slot terapi duplikat`,
      totalDuplicateGroups: results.totalDuplicateGroups,
      totalMergedAppointments: results.totalMergedAppointments,
      totalDeactivatedSlots: results.totalDeactivatedSlots,
      details: results.mergedGroups
    });
  } catch (error) {
    console.error("Error saat menggabungkan slot terapi:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat menggabungkan slot terapi",
      error: String(error)
    });
  }
}