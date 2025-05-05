import { db } from './db';
import { sessions, transactions, packages, appointments } from '@shared/schema';
import { eq, and, desc, sql, ne } from 'drizzle-orm';
import { storage } from './storage';

// Fungsi khusus untuk memperbaiki masalah paket ganda Agus Isrofin yang muncul di dashboard
export async function fixAgusIsrofinSessions() {
  console.log("Starting fix for Agus Isrofin duplicate sessions in dashboard...");
  
  try {
    // Agus Isrofin memiliki dua ID pasien dengan sesi paket yang sama
    const primaryPatientId = 86;     // ID pasien utama (P-2025-086)
    const duplicatePatientId = 261;  // ID pasien duplikat (P-2025-261)
    const packageId = 8;             // ID paket "Paket 12 Sesi"
    
    console.log(`Fixing duplicate package display for Agus Isrofin: Primary ID ${primaryPatientId}, Duplicate ID ${duplicatePatientId}`);
    
    // 1. Cari paket aktif dari kedua ID pasien
    const allActiveSessions = await db.query.sessions.findMany({
      where: eq(sessions.status, "active")
    });
    
    console.log(`Total active sessions in system: ${allActiveSessions.length}`);
    
    // Filter sesi untuk Agus Isrofin (kedua ID)
    const primarySessions = allActiveSessions.filter(s => s.patientId === primaryPatientId);
    const duplicateSessions = allActiveSessions.filter(s => s.patientId === duplicatePatientId);
    
    console.log(`Found ${primarySessions.length} active sessions for primary patient ID ${primaryPatientId}`);
    console.log(`Found ${duplicateSessions.length} active sessions for duplicate patient ID ${duplicatePatientId}`);
    
    // Jika tidak ada sesi duplikat, periksa jika perlu membuat tampilan yang benar
    if (duplicateSessions.length === 0) {
      if (primarySessions.length === 0) {
        return {
          success: false,
          message: "Tidak ada sesi aktif untuk Agus Isrofin dengan ID manapun"
        };
      } else {
        // Pastikan sesi primer memiliki nilai yang benar
        const primarySession = primarySessions[0];
        const packageInfo = await db.query.packages.findFirst({
          where: eq(packages.id, packageId)
        });
        
        if (packageInfo) {
          // Perbarui sesi utama dengan nilai yang benar
          const totalSessions = packageInfo.sessions || 12;
          await db.update(sessions)
            .set({
              packageId: packageId,
              totalSessions: totalSessions,
              sessionsUsed: Math.max(1, primarySession.sessionsUsed || 0)
            })
            .where(eq(sessions.id, primarySession.id));
            
          return {
            success: true,
            message: `Paket Agus Isrofin sudah benar dengan ID ${primaryPatientId}`,
            updatedSession: primarySession.id
          };
        }
      }
    }
    
    // 2. Nonaktifkan/hapus semua sesi duplikat dengan mengubah status
    for (const session of duplicateSessions) {
      await db.update(sessions)
        .set({
          status: "merged",
          notes: `Merged with patient ID ${primaryPatientId} (session ${session.id})`
        })
        .where(eq(sessions.id, session.id));
      
      console.log(`Marked duplicate session ${session.id} as merged`);
    }
    
    // 3. Perbarui atau buat sesi primer jika tidak ada
    let primarySession;
    if (primarySessions.length > 0) {
      primarySession = primarySessions[0];
    } else {
      // Jika tidak ada sesi primer, buat satu dari sesi duplikat pertama
      const dupSession = duplicateSessions[0];
      const newSessionData = {
        patientId: primaryPatientId,
        packageId: packageId,
        transactionId: dupSession.transactionId,
        totalSessions: dupSession.totalSessions,
        sessionsUsed: dupSession.sessionsUsed,
        status: "active" as const,
        startDate: new Date(),
        lastSessionDate: new Date()
      };
      
      primarySession = await storage.createSession(newSessionData);
      console.log(`Created new primary session ${primarySession.id} for patient ${primaryPatientId}`);
    }
    
    // 4. Perbarui semua appointment yang terkait dengan ID pasien duplikat
    await db.execute(sql`
      UPDATE appointments
      SET patient_id = ${primaryPatientId}
      WHERE patient_id = ${duplicatePatientId} AND status = 'Active'
    `);
    
    console.log(`Updated appointments from duplicate patient ID to primary patient ID`);
    
    // 5. Tambahkan catatan ke pasien duplikat
    await db.execute(sql`
      UPDATE patients
      SET notes = CONCAT(COALESCE(notes, ''), '\nID ini duplikat dari pasien ID:${primaryPatientId}. Paket terapi telah digabungkan.')
      WHERE id = ${duplicatePatientId}
    `);
    
    // 6. Ambil data terbaru untuk verifikasi
    const updatedActiveSession = await db.query.sessions.findFirst({
      where: and(
        eq(sessions.patientId, primaryPatientId),
        eq(sessions.status, "active"),
        eq(sessions.packageId, packageId)
      )
    });
    
    // Kembalikan hasil perbaikan
    return {
      success: true,
      message: `Berhasil memperbaiki paket ganda Agus Isrofin. Semua sesi dan appointment ID ${duplicatePatientId} telah dipindahkan ke ID ${primaryPatientId}`,
      primaryPatientId,
      duplicatePatientId,
      primarySessionId: updatedActiveSession?.id,
      mergedSessionsCount: duplicateSessions.length
    };
  } catch (error) {
    console.error("Error fixing Agus Isrofin sessions:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}