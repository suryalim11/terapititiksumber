/**
 * Modul khusus untuk sinkronisasi antara slot terapi dan appointment
 * Digunakan untuk memastikan jumlah pasien (current_count) selalu akurat
 */
import { storage } from "../storage";

interface SyncResult {
  slotId: number;
  date: string;
  timeSlot: string;
  oldCount: number;
  newCount: number;
}

/**
 * Sinkronisasi slot terapi berdasarkan ID
 * Menghitung ulang jumlah pasien yang terdaftar secara real-time
 */
export async function syncSlot(slotId: number): Promise<SyncResult> {
  console.log(`Memulai sinkronisasi untuk slot ID: ${slotId}`);
  
  // Dapatkan informasi slot terapi
  const slot = await storage.getTherapySlot(slotId);
  if (!slot) {
    throw new Error(`Therapy slot dengan ID ${slotId} tidak ditemukan`);
  }
  
  // Dapatkan semua appointment untuk slot terapi ini
  const appointments = await storage.getAppointmentsByTherapySlot(slotId);
  
  // Filter appointment yang aktif/terkonfirmasi (tidak dibatalkan)
  const activeAppointments = appointments.filter(appointment =>
    appointment.status !== "Cancelled" && appointment.status !== "Pending"
  );
  
  // Simpan jumlah sebelumnya untuk pelaporan
  const oldCount = slot.currentCount;
  const newCount = activeAppointments.length;
  
  console.log(`Slot ID ${slotId}: mengubah jumlah pasien dari ${oldCount} menjadi ${newCount}`);
  
  // Update jumlah pasien di slot terapi
  if (oldCount !== newCount) {
    await storage.updateTherapySlot(slotId, {
      currentCount: newCount
    });
    console.log(`Berhasil mengupdate jumlah pasien slot ID ${slotId} menjadi ${newCount}`);
  } else {
    console.log(`Tidak ada perubahan jumlah pasien untuk slot ID ${slotId}`);
  }
  
  return {
    slotId,
    date: slot.date,
    timeSlot: slot.timeSlot,
    oldCount,
    newCount
  };
}

/**
 * Sinkronisasi semua slot terapi yang aktif
 * Menghitung ulang jumlah pasien untuk semua slot
 */
export async function syncAllSlots(): Promise<SyncResult[]> {
  console.log("Memulai sinkronisasi semua slot terapi aktif...");
  
  // Dapatkan semua slot terapi aktif
  const slots = await storage.getActiveTherapySlots();
  console.log(`Ditemukan ${slots.length} slot terapi aktif untuk disinkronkan`);
  
  const results: SyncResult[] = [];
  
  // Sinkronisasi satu per satu
  for (const slot of slots) {
    try {
      const result = await syncSlot(slot.id);
      results.push(result);
    } catch (error) {
      console.error(`Error saat sinkronisasi slot ID ${slot.id}:`, error);
    }
  }
  
  console.log(`Sinkronisasi selesai: ${results.length} slot berhasil disinkronkan`);
  return results;
}