/**
 * Script yang bisa dijalankan langsung melalui CLI untuk memperbaiki data Agus Isrofin
 */
import { db } from './db';
import { sql } from 'drizzle-orm';
import { sessions, patients, appointments } from '@shared/schema';

async function runAgusIsrofinFix() {
  console.log("===== MULAI PERBAIKAN DATA AGUS ISROFIN =====");
  
  try {
    // ID pasien yang bermasalah (diperbarui berdasarkan tangkapan layar)
    const primaryId = 86;    // ID yang dipertahankan (P-2025-086)
    const duplicateId = 323; // ID yang paketnya akan dinonaktifkan (P-2025-323)
    
    console.log(`Menggunakan ID pasien primer: ${primaryId}, ID duplikat: ${duplicateId}`);
    
    // 1. Deaktivasi sesi yang ada di ID duplikat
    console.log("1. Deaktivasi sesi duplikat...");
    
    const deactivateResult = await db.execute(sql`
      UPDATE sessions
      SET status = 'inactive'
      WHERE patient_id = ${duplicateId} AND status = 'active'
    `);
    
    console.log(" - Status update sesi duplikat:", deactivateResult);
    
    // 2. Langkah ini dilewati karena kolom notes tidak ada dalam tabel patients
    console.log("2. Lewati update catatan pasien duplikat karena kolom tidak ada");
    
    // 3. Pindahkan appointment yang masih ada ke ID primer
    console.log("3. Pindahkan appointment ke ID primer...");
    
    const appointmentResult = await db.execute(sql`
      UPDATE appointments
      SET patient_id = ${primaryId}
      WHERE patient_id = ${duplicateId} AND status = 'Active'
    `);
    
    console.log(" - Status update appointment:", appointmentResult);
    
    // 4. Periksa hasil perubahan
    console.log("4. Cek sesi aktif setelah perubahan...");
    
    const activeSessionsPrimary = await db.execute(sql`
      SELECT id, patient_id, package_id, total_sessions, sessions_used, status
      FROM sessions 
      WHERE patient_id = ${primaryId} AND status = 'active'
    `);
    
    const activeSessionsDuplicate = await db.execute(sql`
      SELECT id, patient_id, package_id, total_sessions, sessions_used, status
      FROM sessions 
      WHERE patient_id = ${duplicateId} AND status = 'active'
    `);
    
    console.log(" - Sesi aktif di ID primer:", activeSessionsPrimary.rows.length);
    console.log(" - Sesi aktif di ID duplikat:", activeSessionsDuplicate.rows.length);
    
    if (activeSessionsPrimary.rows.length > 0) {
      console.log(" - Detail sesi aktif di ID primer:", activeSessionsPrimary.rows);
    }
    
    if (activeSessionsDuplicate.rows.length > 0) {
      console.log(" - Detail sesi aktif di ID duplikat:", activeSessionsDuplicate.rows);
    }
    
    console.log("===== PERBAIKAN DATA AGUS ISROFIN SELESAI =====");
    return {
      success: true,
      message: "Perbaikan data Agus Isrofin berhasil",
      primarySessions: activeSessionsPrimary.rows,
      duplicateSessions: activeSessionsDuplicate.rows
    };
  } catch (error) {
    console.error("ERROR PERBAIKAN DATA AGUS ISROFIN:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Selalu jalankan fungsi perbaikan
console.log("Menjalankan script perbaikan data Agus Isrofin...");
runAgusIsrofinFix()
  .then(result => {
    console.log("Hasil eksekusi:", result);
  })
  .catch(err => {
    console.error("Error dalam menjalankan script:", err);
  });

export default runAgusIsrofinFix;