import { db } from './db';
import * as schema from '@shared/schema';
import { eq, and, like, desc, asc } from 'drizzle-orm';

/**
 * Sistem pencarian pasien yang kuat dengan berbagai opsi pencarian
 * Bisa digunakan kembali di berbagai tempat di aplikasi untuk mencari pasien
 */
export async function findPatientByNameOrId(searchTerm: string) {
  // Coba berbagai metode pencarian secara berurutan
  try {
    // 1. Coba cari dengan ID pasien persis
    const patientsByPatientId = await db
      .select()
      .from(schema.patients)
      .where(eq(schema.patients.patientId, searchTerm));
    
    if (patientsByPatientId.length > 0) {
      return patientsByPatientId[0];
    }
    
    // 2. Coba cari dengan ID numerik
    let numericId = parseInt(searchTerm);
    if (!isNaN(numericId)) {
      const patientsByNumericId = await db
        .select()
        .from(schema.patients)
        .where(eq(schema.patients.id, numericId));
      
      if (patientsByNumericId.length > 0) {
        return patientsByNumericId[0];
      }
    }
    
    // 3. Coba cari dengan nama persis
    const patientsByExactName = await db
      .select()
      .from(schema.patients)
      .where(eq(schema.patients.name, searchTerm));
    
    if (patientsByExactName.length > 0) {
      return patientsByExactName[0];
    }
    
    // 4. Coba cari dengan nama mengandung term
    const patientsByPartialName = await db
      .select()
      .from(schema.patients)
      .where(like(schema.patients.name, `%${searchTerm}%`));
    
    if (patientsByPartialName.length > 0) {
      return patientsByPartialName[0];
    }
    
    // 5. Coba cari dengan nomor telepon
    const patientsByPhone = await db
      .select()
      .from(schema.patients)
      .where(like(schema.patients.phone, `%${searchTerm}%`));
    
    if (patientsByPhone.length > 0) {
      return patientsByPhone[0];
    }
    
    // Tidak ditemukan dengan metode di atas
    return null;
    
  } catch (error) {
    console.error("Error dalam mencari pasien:", error);
    return null;
  }
}

/**
 * Sistem pencarian sesi paket terapi yang kuat dan fleksibel
 * Bisa digunakan kembali untuk berbagai kebutuhan
 */
export async function findPatientSessionPackages(patientId: number, options: {
  status?: string;
  packageId?: number;
  sortByTotalSessions?: 'asc' | 'desc';
} = {}) {
  try {
    let query = db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.patientId, patientId));
    
    // Filter berdasarkan status jika ada
    if (options.status) {
      query = query.where(eq(schema.sessions.status, options.status));
    }
    
    // Filter berdasarkan package ID jika ada
    if (options.packageId) {
      query = query.where(eq(schema.sessions.packageId, options.packageId));
    }
    
    // Pengurutan berdasarkan total sesi jika ada
    if (options.sortByTotalSessions === 'desc') {
      query = query.orderBy(desc(schema.sessions.totalSessions));
    } else if (options.sortByTotalSessions === 'asc') {
      query = query.orderBy(asc(schema.sessions.totalSessions));
    }
    
    const sessions = await query;
    return sessions;
    
  } catch (error) {
    console.error("Error dalam mencari sesi paket terapi:", error);
    return [];
  }
}

/**
 * Fungsi untuk memperbaiki perhitungan jumlah sesi yang terpakai pada paket terapi
 * Solusi jangka panjang dengan pendekatan generik yang bisa digunakan kembali
 */
export async function fixSessionUsageCount(sessionId: number, newUsageCount: number) {
  try {
    // Validasi input
    if (isNaN(sessionId) || sessionId <= 0) {
      throw new Error("ID sesi tidak valid");
    }
    
    if (isNaN(newUsageCount) || newUsageCount < 0) {
      throw new Error("Jumlah penggunaan sesi tidak valid");
    }
    
    // Cek apakah sesi ada
    const existingSession = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, sessionId));
    
    if (!existingSession || existingSession.length === 0) {
      throw new Error(`Sesi dengan ID ${sessionId} tidak ditemukan`);
    }
    
    const session = existingSession[0];
    
    // Validasi jumlah sesi baru tidak melebihi total sesi
    if (newUsageCount > session.totalSessions) {
      throw new Error(`Jumlah penggunaan (${newUsageCount}) melebihi total sesi paket (${session.totalSessions})`);
    }
    
    // Update sesi dengan jumlah penggunaan baru
    const [updatedSession] = await db
      .update(schema.sessions)
      .set({ sessionsUsed: newUsageCount })
      .where(eq(schema.sessions.id, sessionId))
      .returning();
    
    console.log(`Berhasil memperbarui sesi ID ${sessionId}. Nilai baru: ${updatedSession.sessionsUsed}/${updatedSession.totalSessions}`);
    
    return {
      success: true,
      message: `Berhasil memperbarui jumlah sesi terpakai dari ${session.sessionsUsed} menjadi ${updatedSession.sessionsUsed}`,
      before: session,
      after: updatedSession
    };
    
  } catch (error) {
    console.error("Error dalam memperbaiki jumlah sesi paket terapi:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Function untuk kasus spesifik Darukni - memanfaatkan fungsi umum di atas
 * Ini tetap ada untuk kompatibilitas dengan endpoint yang sudah dibuat
 */
export async function fixDarukniSession() {
  console.log("Starting Darukni session fix...");
  
  try {
    // Gunakan fungsi pencarian pasien yang telah dibuat
    const patient = await findPatientByNameOrId("Darukni");
    
    if (!patient) {
      console.log("No patient found with name Darukni");
      return {
        success: false,
        message: "No patient found with name Darukni"
      };
    }
    
    console.log(`Found patient with ID ${patient.id} and name ${patient.name}`);
    
    // Gunakan fungsi pencarian sesi paket yang telah dibuat
    const sessions = await findPatientSessionPackages(patient.id, {
      status: "active",
      sortByTotalSessions: "desc"
    });
    
    if (!sessions || sessions.length === 0) {
      console.log(`No active sessions found for patient ${patient.name}`);
      return {
        success: false,
        message: `No active sessions found for patient ${patient.name}`
      };
    }
    
    console.log(`Found ${sessions.length} active sessions for ${patient.name}`);
    
    // Log semua sesi yang ditemukan untuk debugging
    console.log("Found sessions:", sessions.map(s => ({
      id: s.id,
      totalSessions: s.totalSessions,
      sessionsUsed: s.sessionsUsed,
      status: s.status
    })));
    
    // Pilih sesi dengan jumlah sesi terbanyak (karena sudah diurutkan di fungsi findPatientSessionPackages)
    const targetSession = sessions[0];
    
    if (!targetSession) {
      console.log(`Tidak dapat menemukan paket aktif apapun untuk ${patient.name}`);
      return {
        success: false,
        message: `Tidak dapat menemukan paket aktif apapun untuk ${patient.name}`
      };
    }
    
    console.log(`Found target session ID ${targetSession.id} with ${targetSession.sessionsUsed}/${targetSession.totalSessions}`);
    
    // Gunakan fungsi perbaikan sesi yang telah dibuat
    return await fixSessionUsageCount(targetSession.id, 2);
    
  } catch (error) {
    console.error("Error fixing Darukni session:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}