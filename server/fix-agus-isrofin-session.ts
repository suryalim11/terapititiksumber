import { db } from './db';
import { sessions, transactions, packages, appointments } from '@shared/schema';
import { eq, and, or, desc, sql, ne } from 'drizzle-orm';
import { storage } from './storage';

// Fungsi untuk memperbaiki masalah sesi terapi Agus Isrofin agar bisa transaksi hari ini
export async function fixAgusIsrofinSessionToday() {
  console.log("Starting fix for Agus Isrofin session to allow transactions today...");
  
  try {
    // ID pasien Agus Isrofin 
    const patientId = 86;       // ID pasien utama (P-2025-086)
    const packageId = 8;        // ID paket "Paket 12 Sesi"
    
    console.log(`Fixing sessions for Agus Isrofin (Patient ID: ${patientId})`);
    
    // 1. Cari semua sesi aktif pasien
    const activeSessions = await db.query.sessions.findMany({
      where: and(
        eq(sessions.patientId, patientId),
        eq(sessions.status, "active")
      )
    });
    
    console.log(`Found ${activeSessions.length} active sessions for Agus Isrofin`);
    
    // 2. Cek jika ada sesi paket 12 sesi
    const packageSession = activeSessions.find(s => s.packageId === packageId);
    
    if (!packageSession) {
      console.log(`No active session found for package ID ${packageId}, creating new one`);
      
      // Cari transaksi terakhir untuk pasien
      const latestTransaction = await db.query.transactions.findFirst({
        where: eq(transactions.patientId, patientId),
        orderBy: [desc(transactions.createdAt)]
      });
      
      if (!latestTransaction) {
        return {
          success: false,
          message: `No transaction found for patient ${patientId}`
        };
      }
      
      // Cari info paket
      const packageInfo = await db.query.packages.findFirst({
        where: eq(packages.id, packageId) 
      });
      
      if (!packageInfo) {
        return {
          success: false,
          message: `Package with ID ${packageId} not found`
        };
      }
      
      // Buat sesi baru
      const newSessionData = {
        patientId: patientId,
        packageId: packageId,
        transactionId: latestTransaction.id,
        totalSessions: packageInfo.sessions,
        sessionsUsed: 0, // Mulai dengan 0 sesi terpakai
        status: "active" as const,
        startDate: new Date(),
        lastSessionDate: new Date()
      };
      
      // Buat sesi baru dengan metode createSession
      const newSession = await storage.createSession(newSessionData);
      
      console.log(`Created new session (ID: ${newSession.id}) for Agus Isrofin with package ID ${packageId}`);
      
      return {
        success: true,
        message: `Berhasil membuat sesi baru untuk Agus Isrofin`,
        sessionId: newSession.id,
        patientId: patientId,
        packageId: packageId,
        sessionsUsed: newSession.sessionsUsed,
        totalSessions: newSession.totalSessions
      };
    } else {
      // 3. Jika sesi ditemukan, pastikan status dan penggunaan sesi benar
      console.log(`Found existing session (ID: ${packageSession.id}) for package ID ${packageId}`);
      console.log(`Current status: ${packageSession.status}, Sessions used: ${packageSession.sessionsUsed}/${packageSession.totalSessions}`);
      
      // Perbarui sesi yang ada dengan tanggal terakhir 5 Mei 2025
      const may5Date = new Date('2025-05-05T00:00:00.000Z'); // Mengatur tanggal terakhir ke 5 Mei 2025
      
      const updatedSessionData = {
        status: "active" as const,
        lastSessionDate: may5Date, // Memperbarui tanggal terakhir ke 5 Mei 2025
        sessionsUsed: Math.min(packageSession.sessionsUsed, packageSession.totalSessions - 1) // Pastikan masih tersisa sesi
      };
      
      await db.update(sessions)
        .set(updatedSessionData)
        .where(eq(sessions.id, packageSession.id));
      
      // Ambil data terbaru
      const refreshedSession = await db.query.sessions.findFirst({
        where: eq(sessions.id, packageSession.id)
      });
      
      console.log(`Updated session status: ${refreshedSession?.status}, Sessions used: ${refreshedSession?.sessionsUsed}/${refreshedSession?.totalSessions}`);
      
      return {
        success: true,
        message: `Berhasil memperbarui sesi untuk Agus Isrofin`,
        sessionId: packageSession.id,
        patientId: patientId,
        packageId: packageId,
        sessionsUsed: refreshedSession?.sessionsUsed,
        totalSessions: refreshedSession?.totalSessions,
        updated: true
      };
    }
  } catch (error) {
    console.error("Error fixing Agus Isrofin session:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}