/**
 * Script khusus untuk memperbaiki masalah paket ganda Agus Isrofin
 * Script ini dijalankan secara langsung tanpa endpoint
 */

import { db } from './db';
import { sql } from 'drizzle-orm';
import { sessions, patients } from '@shared/schema';

export async function mergeAgusIsrofinDirectly() {
  console.log("Menjalankan perbaikan langsung untuk paket ganda Agus Isrofin...");
  
  try {
    // ID pasien yang bermasalah (diperbarui berdasarkan tangkapan layar)
    const primaryId = 86;    // ID yang dipertahankan (P-2025-086)
    const duplicateId = 323; // ID yang paketnya akan dinonaktifkan (P-2025-323)
    
    // 1. Tandai semua sesi aktif dengan ID pasien duplikat sebagai "inactive"
    const deactivateResult = await db.execute(sql`
      UPDATE sessions
      SET status = 'inactive', 
          notes = CONCAT(COALESCE(notes, ''), ' Dinonaktifkan pada script merge-agus')
      WHERE patient_id = ${duplicateId} AND status = 'active'
    `);
    
    console.log("Hasil deaktivasi sesi duplikat:", deactivateResult);
    
    // 2. Tambahkan catatan ke pasien duplikat
    await db.execute(sql`
      UPDATE patients
      SET notes = CONCAT(COALESCE(notes, ''), '\nID ini duplikat dari pasien ID:${primaryId}. Paket terapi telah dinonaktifkan.')
      WHERE id = ${duplicateId}
    `);
    
    console.log("Catatan ditambahkan ke pasien duplikat ID:", duplicateId);
    
    // 3. Perbarui appointment yang masih menggunakan ID duplikat
    const appointmentResult = await db.execute(sql`
      UPDATE appointments
      SET patient_id = ${primaryId}
      WHERE patient_id = ${duplicateId} AND status = 'Active'
    `);
    
    console.log("Hasil pembaruan appointment:", appointmentResult);
    
    // 4. Periksa hasil akhir
    const activeSessions = await db.execute(sql`
      SELECT * FROM sessions 
      WHERE (patient_id = ${primaryId} OR patient_id = ${duplicateId})
      AND status = 'active'
    `);
    
    console.log("Sesi yang masih aktif setelah perbaikan:", activeSessions);
    
    console.log("Perbaikan Agus Isrofin selesai!");
    return { success: true, message: "Perbaikan selesai" };
  } catch (error) {
    console.error("Error dalam memperbaiki data Agus Isrofin:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Eksekusi fungsi jika file ini dijalankan secara langsung
if (require.main === module) {
  mergeAgusIsrofinDirectly().then(result => {
    console.log("Hasil eksekusi:", result);
    process.exit(0);
  }).catch(err => {
    console.error("Error executing script:", err);
    process.exit(1);
  });
}