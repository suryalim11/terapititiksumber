import { db } from './db';
import { eq, and, like, or } from 'drizzle-orm';
import * as schema from '@shared/schema';

/**
 * Script untuk memperbaiki session paket Darukni yang mungkin tidak terupdate dengan benar
 */
export async function fixDarukniSession() {
  try {
    console.log("Mencari session untuk pasien Darukni...");
    
    // Cari ID pasien Darukni dulu
    const darukniPatients = await db.select()
      .from(schema.patients)
      .where(
        or(
          like(schema.patients.name, '%darukni%'),
          like(schema.patients.patientId, '%darukni%')
        )
      );
    
    console.log(`Ditemukan ${darukniPatients.length} pasien dengan nama/ID containing "darukni"`);
    
    if (darukniPatients.length === 0) {
      return { 
        success: false, 
        message: 'Tidak ditemukan pasien dengan nama Darukni' 
      };
    }
    
    const patientId = darukniPatients[0].id;
    console.log(`Menggunakan pasien ID: ${patientId}, nama: ${darukniPatients[0].name}`);
    
    // Cari session aktif untuk pasien Darukni
    const sessions = await db.select()
      .from(schema.sessions)
      .where(
        and(
          eq(schema.sessions.patientId, patientId),
          eq(schema.sessions.status, 'active')
        )
      );
    
    console.log(`Ditemukan ${sessions.length} session aktif untuk pasien Darukni`);
    
    if (sessions.length === 0) {
      return { 
        success: false, 
        message: 'Tidak ditemukan session aktif untuk pasien Darukni' 
      };
    }
    
    // Ambil session pertama (yang paling relevan)
    const targetSession = sessions[0];
    console.log(`Target session ID: ${targetSession.id}, sesi saat ini: ${targetSession.sessionsUsed}/${targetSession.totalSessions}`);
    
    // Update session: set sessionsUsed = 2
    const updatedSession = await db
      .update(schema.sessions)
      .set({ 
        sessionsUsed: 2,
        lastSessionDate: new Date() // Set ke tanggal sekarang
      })
      .where(eq(schema.sessions.id, targetSession.id))
      .returning();
    
    if (updatedSession.length === 0) {
      console.log('Gagal memperbarui session Darukni');
      return { success: false, message: 'Gagal memperbarui session Darukni' };
    }
    
    console.log(`Berhasil memperbarui session Darukni. Sessions used sekarang: ${updatedSession[0].sessionsUsed}/${updatedSession[0].totalSessions}`);
    
    return { 
      success: true, 
      message: `Berhasil memperbarui session Darukni. Sessions used sekarang: ${updatedSession[0].sessionsUsed}/${updatedSession[0].totalSessions}`,
      session: updatedSession[0]
    };
    
  } catch (error) {
    console.error('Error saat memperbaiki session Darukni:', error);
    return { 
      success: false, 
      message: `Error: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}