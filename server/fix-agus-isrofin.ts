import { db } from './db';
import { sessions, transactions, packages } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { storage } from './storage';

// Fungsi khusus untuk memperbaiki sesi Agus Isrofin
export async function fixAgusIsrofinSessions() {
  console.log("Starting fix for Agus Isrofin sessions...");
  
  try {
    const patientId = 261; // Agus Isrofin
    
    // 1. Cari transaksi terbaru
    const lastTransaction = await db.query.transactions.findFirst({
      where: eq(transactions.patientId, patientId),
      orderBy: [desc(transactions.createdAt)]
    });
    
    if (!lastTransaction) {
      return {
        success: false,
        message: "Tidak ada transaksi ditemukan untuk Agus Isrofin"
      };
    }
    
    console.log(`Found last transaction: ${lastTransaction.id} (${lastTransaction.transactionId})`);
    
    // 2. Periksa apakah transaksi memiliki paket
    const items = lastTransaction.items as any[];
    const packageItems = items.filter(item => item.type === 'package');
    
    if (packageItems.length === 0) {
      return {
        success: false,
        message: "Transaksi terakhir tidak memiliki paket"
      };
    }
    
    // 3. Periksa apakah sudah ada sesi untuk transaksi ini
    const existingSession = await db.query.sessions.findFirst({
      where: eq(sessions.transactionId, lastTransaction.id)
    });
    
    if (existingSession) {
      console.log(`Session already exists for transaction: ${existingSession.id}`);
      return {
        success: true,
        message: "Sesi sudah ada untuk transaksi ini",
        sessionId: existingSession.id
      };
    }
    
    // 4. Cari sesi aktif yang sudah ada (jika ada)
    const activeSessions = await db.query.sessions.findMany({
      where: and(
        eq(sessions.patientId, patientId),
        eq(sessions.status, "active")
      )
    });
    
    console.log(`Found ${activeSessions.length} active sessions for Agus Isrofin`);
    
    // 5. Jika tidak ada sesi aktif, buat sesi baru
    if (activeSessions.length === 0) {
      // Buat sesi baru karena tidak ada sesi aktif
      for (const packageItem of packageItems) {
        const package_ = await db.query.packages.findFirst({
          where: eq(packages.id, packageItem.id)
        });
        
        if (package_) {
          // Create the missing session
          const sessionData = {
            patientId: patientId,
            transactionId: lastTransaction.id,
            packageId: packageItem.id,
            totalSessions: package_.sessions || 1,
            status: "active" as const,
            sessionsUsed: 0, // Mulai dari 0
            startDate: new Date(),
          };
          
          const newSession = await storage.createSession(sessionData);
          console.log(`Created new session for Agus Isrofin: ${newSession.id} with package ${packageItem.id}`);
          
          return {
            success: true,
            message: `Berhasil membuat sesi baru untuk Agus Isrofin dengan paket ID ${packageItem.id}`,
            sessionId: newSession.id
          };
        }
      }
    } else {
      // Update sesi yang ada untuk menunjukkan transaksi terbaru
      const latestSession = activeSessions[0];
      const updatedSession = await db.update(sessions)
        .set({
          transactionId: lastTransaction.id,
          lastSessionDate: new Date()
        })
        .where(eq(sessions.id, latestSession.id))
        .returning();
      
      console.log(`Updated existing session: ${latestSession.id} with new transaction ID`);
      
      return {
        success: true,
        message: `Berhasil memperbarui sesi yang ada (ID: ${latestSession.id}) dengan transaksi terbaru`,
        sessionId: latestSession.id
      };
    }
    
    return {
      success: false,
      message: "Tidak dapat membuat atau memperbarui sesi"
    };
  } catch (error) {
    console.error("Error fixing Agus Isrofin sessions:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}