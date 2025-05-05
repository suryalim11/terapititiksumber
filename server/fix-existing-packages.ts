import { db } from './db';
import { sessions } from '@shared/schema';
import { eq, isNull } from 'drizzle-orm';
import { storage } from './storage';

/**
 * Fungsi untuk memperbaiki sesi paket yang sudah ada yang belum memiliki sesi terpakai
 * Ini akan mengatur sessionsUsed=1 untuk semua paket aktif yang masih memiliki sessionsUsed=0
 */
export async function fixExistingPackages() {
  console.log("Memulai perbaikan paket terapi yang sudah ada dengan sessionsUsed=0...");
  
  try {
    // Cari semua sesi aktif dengan sessionsUsed = 0
    const activeSessions = await db.query.sessions.findMany({
      where: eq(sessions.sessionsUsed, 0),
      orderBy: sessions.id
    });
    
    console.log(`Menemukan ${activeSessions.length} paket terapi yang belum memiliki sesi terpakai (sessionsUsed=0)`);
    
    let updatedCount = 0;
    const results = [];
    
    // Update sessionsUsed untuk setiap sesi yang belum memiliki sesi terpakai
    for (const session of activeSessions) {
      try {
        // Update sessionsUsed menjadi 1 dengan lastSessionDate = startDate (sesuai tanggal pembelian)
        const result = await db
          .update(sessions)
          .set({ 
            sessionsUsed: 1,
            lastSessionDate: session.startDate // Gunakan tanggal mulai sebagai tanggal sesi terakhir
          })
          .where(eq(sessions.id, session.id))
          .returning();
        
        if (result && result.length > 0) {
          updatedCount++;
          console.log(`Berhasil update paket ID ${session.id} untuk pasien ID ${session.patientId}: sessionsUsed diubah menjadi 1`);
          results.push({
            id: session.id,
            patientId: session.patientId,
            packageId: session.packageId,
            status: 'updated'
          });
        }
      } catch (error) {
        console.error(`Gagal mengupdate paket ID ${session.id}:`, error);
        results.push({
          id: session.id,
          patientId: session.patientId,
          packageId: session.packageId,
          status: 'failed',
          error: String(error)
        });
      }
    }
    
    console.log(`Selesai memperbaiki paket terapi yang sudah ada: ${updatedCount} dari ${activeSessions.length} paket berhasil diperbarui`);
    
    return {
      total: activeSessions.length,
      updated: updatedCount,
      results
    };
  } catch (error) {
    console.error("Error during fixing existing packages:", error);
    throw error;
  }
}