import { db } from './db';
import { sessions, transactions, packages } from '@shared/schema';
import { eq, and, desc, sql, ne } from 'drizzle-orm';
import { storage } from './storage';

// Fungsi khusus untuk memperbaiki masalah paket ganda Agus Isrofin
export async function fixAgusIsrofinSessions() {
  console.log("Starting fix for Agus Isrofin duplicate sessions...");
  
  try {
    // Agus Isrofin memiliki dua ID pasien (ID lama dan ID baru)
    const primaryPatientId = 86; // ID pasien utama yang akan dipertahankan
    const duplicatePatientId = 261; // ID pasien duplikat yang menimbulkan masalah
    
    console.log(`Fixing duplicate data for Agus Isrofin: Primary ID ${primaryPatientId}, Duplicate ID ${duplicatePatientId}`);
    
    // 1. Cari sesi aktif dari kedua ID pasien
    const primarySessions = await db.query.sessions.findMany({
      where: and(
        eq(sessions.patientId, primaryPatientId),
        eq(sessions.status, "active")
      )
    });
    
    const duplicateSessions = await db.query.sessions.findMany({
      where: and(
        eq(sessions.patientId, duplicatePatientId),
        eq(sessions.status, "active")
      )
    });
    
    console.log(`Found ${primarySessions.length} active sessions for primary patient ID`);
    console.log(`Found ${duplicateSessions.length} active sessions for duplicate patient ID`);
    
    // Jika tidak ada sesi duplikat, tidak perlu perbaikan
    if (duplicateSessions.length === 0) {
      return {
        success: true,
        message: "Tidak ada sesi duplikat yang perlu diperbaiki",
        primarySessions,
        duplicateSessions: []
      };
    }
    
    // 2. Catat ID transaksi dari sesi duplikat untuk diperbarui nanti
    const duplicateTransactionIds = duplicateSessions.map(session => session.transactionId);
    
    // 3. Nonaktifkan sesi duplikat (ubah status menjadi "merged")
    for (const session of duplicateSessions) {
      await db.update(sessions)
        .set({
          status: "merged" as any, // 'merged' adalah status khusus untuk sesi yang telah digabungkan
          notes: `Merged into patient ID ${primaryPatientId}, session was duplicate`
        })
        .where(eq(sessions.id, session.id));
      
      console.log(`Marked duplicate session ${session.id} as merged`);
    }
    
    // 4. Jika ada sesi primer, perbarui datanya untuk mencerminkan total sesi yang benar
    if (primarySessions.length > 0) {
      const primarySession = primarySessions[0]; // Ambil sesi pertama jika ada beberapa
      
      // Cari informasi paket untuk mendapatkan total sesi yang benar
      const packageInfo = await db.query.packages.findFirst({
        where: eq(packages.id, primarySession.packageId || 0)
      });
      
      if (packageInfo) {
        // Hitung sesi terpakai yang benar (gabungkan dari kedua sesi)
        const totalSessions = packageInfo.sessions || 12; // Default ke 12 jika tidak ada
        const usedSessions = Math.max(1, primarySession.sessionsUsed || 0); // Minimal 1 sesi terpakai
        
        // Perbarui sesi utama dengan nilai yang benar
        await db.update(sessions)
          .set({
            totalSessions: totalSessions,
            sessionsUsed: usedSessions,
            lastSessionDate: new Date() // Perbarui terakhir digunakan
          })
          .where(eq(sessions.id, primarySession.id));
          
        console.log(`Updated primary session ${primarySession.id} with correct session count: ${usedSessions}/${totalSessions}`);
      }
    }
    
    // 5. Perbarui semua appointment yang menggunakan ID pasien duplikat
    await db.execute(sql`
      UPDATE appointments
      SET patient_id = ${primaryPatientId}
      WHERE patient_id = ${duplicatePatientId} AND status = 'Active'
    `);
    
    console.log(`Updated appointments from duplicate patient ID to primary patient ID`);
    
    // 6. Dapatkan hasil akhir untuk dikembalikan
    const updatedPrimarySessions = await db.query.sessions.findMany({
      where: and(
        eq(sessions.patientId, primaryPatientId),
        eq(sessions.status, "active")
      )
    });
    
    return {
      success: true,
      message: `Berhasil memperbaiki paket ganda Agus Isrofin. ID pasien utama: ${primaryPatientId}, ID duplikat: ${duplicatePatientId}`,
      primarySessions: updatedPrimarySessions,
      mergedSessions: duplicateSessions.length
    };
  } catch (error) {
    console.error("Error fixing Agus Isrofin sessions:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}