/**
 * Modul untuk menangani konsolidasi slot terapi
 */
import { storage } from "../storage";
import { getWIBDate, formatDateString } from "../utils/date-utils";

/**
 * Fungsi untuk mengkonsolidasikan slot terapi yang duplikat
 * @returns Hasil konsolidasi
 */
export async function consolidateSlots() {
  console.log("Memulai proses konsolidasi slot terapi...");
  
  try {
    // Mendapatkan semua slot terapi aktif
    const allSlots = await storage.getAllTherapySlots();
    
    // Menghitung jumlah slot sebelum konsolidasi
    const initialSlotCount = allSlots.length;
    console.log(`Total slot sebelum konsolidasi: ${initialSlotCount}`);
    
    // Mengelompokkan slot berdasarkan kombinasi date+timeSlot
    const slotGroups = new Map();
    
    for (const slot of allSlots) {
      const key = `${slot.date}_${slot.timeSlot}`;
      
      if (!slotGroups.has(key)) {
        slotGroups.set(key, []);
      }
      
      slotGroups.get(key).push(slot);
    }
    
    // Mengidentifikasi kelompok dengan lebih dari satu slot (duplikat)
    const duplicateGroups = [];
    
    for (const [key, slots] of slotGroups.entries()) {
      if (slots.length > 1) {
        duplicateGroups.push({ key, slots });
      }
    }
    
    console.log(`Ditemukan ${duplicateGroups.length} kelompok slot duplikat`);
    
    // Array untuk menyimpan hasil konsolidasi
    const consolidationResults = [];
    
    // Melakukan konsolidasi untuk setiap kelompok duplikat
    for (const group of duplicateGroups) {
      const { key, slots } = group;
      
      console.log(`Memproses kelompok duplikat ${key} dengan ${slots.length} slot`);
      
      // Mengurutkan slot berdasarkan ID (yang lebih rendah biasanya lebih lama)
      slots.sort((a, b) => a.id - b.id);
      
      // Slot pertama akan menjadi slot utama
      const primarySlot = slots[0];
      const secondarySlots = slots.slice(1);
      
      console.log(`Slot utama: ID ${primarySlot.id}, kuota ${primarySlot.maxQuota}, penggunaan ${primarySlot.currentCount}`);
      
      let totalAppointments = 0;
      
      // Memproses setiap slot sekunder
      for (const slot of secondarySlots) {
        console.log(`Memproses slot sekunder: ID ${slot.id}, kuota ${slot.maxQuota}, penggunaan ${slot.currentCount}`);
        
        try {
          // Mendapatkan semua appointment dalam slot sekunder
          const appointments = await storage.getAppointmentsByTherapySlot(slot.id);
          totalAppointments += appointments.length;
          
          console.log(`Ditemukan ${appointments.length} appointment dalam slot ID ${slot.id}`);
          
          // Memindahkan semua appointment ke slot utama
          for (const appointment of appointments) {
            try {
              // Update appointment ke slot utama
              await storage.updateAppointment(appointment.id, {
                ...appointment,
                therapySlotId: primarySlot.id
              });
              
              console.log(`Memindahkan appointment ID ${appointment.id} dari slot ID ${slot.id} ke slot ID ${primarySlot.id}`);
            } catch (updateErr) {
              console.error(`Error saat memindahkan appointment ID ${appointment.id}:`, updateErr);
              consolidationResults.push({
                success: false,
                message: `Gagal memindahkan appointment ID ${appointment.id}`,
                error: String(updateErr)
              });
            }
          }
          
          // Memperbarui jumlah penggunaan pada slot utama
          const updatedPrimarySlot = await storage.incrementTherapySlotUsageByCount(primarySlot.id, slot.currentCount);
          
          if (updatedPrimarySlot) {
            console.log(`Slot utama ID ${primarySlot.id} diperbarui, penggunaan baru: ${updatedPrimarySlot.currentCount}`);
          }
          
          // Menonaktifkan slot sekunder
          try {
            await storage.deactivateTherapySlot(slot.id);
            console.log(`Slot sekunder ID ${slot.id} dinonaktifkan`);
            
            consolidationResults.push({
              success: true,
              message: `Berhasil mengkonsolidasikan slot ID ${slot.id} ke ID ${primarySlot.id} dengan ${appointments.length} appointment`,
              primarySlotId: primarySlot.id,
              secondarySlotId: slot.id,
              appointmentCount: appointments.length
            });
          } catch (slotErr) {
            console.error(`Error saat menonaktifkan slot ID ${slot.id}:`, slotErr);
            consolidationResults.push({
              success: false,
              message: `Gagal menonaktifkan slot ID ${slot.id}`,
              error: String(slotErr)
            });
          }
        } catch (error) {
          console.error(`Error saat mengkonsolidasikan slot ID ${slot.id}:`, error);
          consolidationResults.push({
            success: false,
            message: `Gagal mengkonsolidasikan slot ID ${slot.id}`,
            error: String(error)
          });
        }
      }
      
      console.log(`Total ${totalAppointments} appointment dipindahkan ke slot utama ID ${primarySlot.id}`);
    }
    
    // Mendapatkan jumlah slot setelah konsolidasi
    const finalSlots = await storage.getActiveTherapySlots();
    const finalSlotCount = finalSlots.length;
    
    console.log(`Konsolidasi selesai. Slot aktif sebelum: ${initialSlotCount}, setelah: ${finalSlotCount}`);
    
    return {
      success: true,
      initialSlotCount,
      finalSlotCount,
      consolidatedGroups: duplicateGroups.length,
      details: consolidationResults
    };
  } catch (error) {
    console.error("Error saat proses konsolidasi:", error);
    return {
      success: false,
      message: "Terjadi kesalahan saat mengkonsolidasikan slot",
      error: String(error)
    };
  }
}

/**
 * Fungsi untuk menggabungkan slot terapi yang dipilih ke dalam slot target
 * @param targetSlotId ID slot target (utama)
 * @param sourceSlotIds Array ID slot yang akan digabungkan
 * @returns Hasil penggabungan
 */
export async function mergeSlots(targetSlotId: number, sourceSlotIds: number[]) {
  console.log(`Memulai penggabungan slot: ${sourceSlotIds.length} slot ke slot target ID ${targetSlotId}`);
  
  try {
    // Validasi input
    if (!targetSlotId || !sourceSlotIds || sourceSlotIds.length === 0) {
      return {
        success: false,
        message: "ID slot target dan sumber diperlukan"
      };
    }
    
    // Validasi bahwa slot target ada dan aktif
    const targetSlot = await storage.getTherapySlot(targetSlotId);
    
    if (!targetSlot) {
      return {
        success: false,
        message: "Slot target tidak ditemukan"
      };
    }
    
    if (!targetSlot.isActive) {
      return {
        success: false,
        message: "Slot target tidak aktif"
      };
    }
    
    console.log(`Slot target: ID ${targetSlot.id}, tanggal ${targetSlot.date}, waktu ${targetSlot.timeSlot}`);
    
    // Array untuk menyimpan hasil penggabungan
    const mergeResults = [];
    let totalAppointments = 0;
    
    // Memproses setiap slot sumber
    for (const sourceId of sourceSlotIds) {
      // Pastikan kita tidak mencoba menggabungkan slot dengan dirinya sendiri
      if (sourceId === targetSlotId) {
        console.log(`Melewati slot ID ${sourceId} karena sama dengan slot target`);
        continue;
      }
      
      try {
        // Validasi bahwa slot sumber ada
        const sourceSlot = await storage.getTherapySlot(sourceId);
        
        if (!sourceSlot) {
          mergeResults.push({
            slotId: sourceId,
            success: false,
            message: "Slot sumber tidak ditemukan"
          });
          continue;
        }
        
        console.log(`Memproses slot sumber: ID ${sourceSlot.id}, tanggal ${sourceSlot.date}, waktu ${sourceSlot.timeSlot}, penggunaan ${sourceSlot.currentCount}`);
        
        // Mendapatkan semua appointment dalam slot sumber
        const appointments = await storage.getAppointmentsByTherapySlot(sourceId);
        console.log(`Ditemukan ${appointments.length} appointment dalam slot ID ${sourceId}`);
        
        // Memindahkan semua appointment ke slot target
        for (const appointment of appointments) {
          try {
            // Update appointment ke slot target
            await storage.updateAppointment(appointment.id, {
              ...appointment,
              therapySlotId: targetSlotId
            });
            
            console.log(`Memindahkan appointment ID ${appointment.id} dari slot ID ${sourceId} ke slot ID ${targetSlotId}`);
            totalAppointments++;
          } catch (updateErr) {
            console.error(`Error saat memindahkan appointment ID ${appointment.id}:`, updateErr);
            mergeResults.push({
              appointmentId: appointment.id,
              success: false,
              message: `Gagal memindahkan appointment`,
              error: String(updateErr)
            });
          }
        }
        
        // Memperbarui jumlah penggunaan pada slot target
        const updatedTargetSlot = await storage.incrementTherapySlotUsageByCount(targetSlotId, sourceSlot.currentCount);
        
        if (updatedTargetSlot) {
          console.log(`Slot target ID ${targetSlotId} diperbarui, penggunaan baru: ${updatedTargetSlot.currentCount}`);
        }
        
        // Menonaktifkan slot sumber
        await storage.deactivateTherapySlot(sourceId);
        console.log(`Slot sumber ID ${sourceId} dinonaktifkan`);
        
        mergeResults.push({
          slotId: sourceId,
          success: true,
          message: `Berhasil menggabungkan ke slot target ID ${targetSlotId}`,
          appointmentCount: appointments.length
        });
      } catch (error) {
        console.error(`Error saat menggabungkan slot ID ${sourceId}:`, error);
        mergeResults.push({
          slotId: sourceId,
          success: false,
          message: "Gagal menggabungkan slot",
          error: String(error)
        });
      }
    }
    
    return {
      success: true,
      targetSlotId,
      totalAppointmentsMoved: totalAppointments,
      details: mergeResults
    };
  } catch (error) {
    console.error("Error saat proses penggabungan:", error);
    return {
      success: false,
      message: "Terjadi kesalahan saat menggabungkan slot",
      error: String(error)
    };
  }
}