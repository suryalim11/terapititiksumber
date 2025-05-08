import { db } from './db';
import * as schema from '@shared/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Function to fix Darukni session from 1/12 to 2/12
 * This will update the sessionsUsed field in the specific session for Darukni
 */
export async function fixDarukniSession() {
  console.log("Starting Darukni session fix...");
  
  try {
    // Specific patient ID for Darukni
    const patientName = "Darukni";
    
    // Find Darukni's patient ID - cari dengan nama yang mengandung "Darukni"
    const patients = await db
      .select()
      .from(schema.patients)
      .where(eq(schema.patients.name, patientName));
      
    // Jika tidak ditemukan dengan nama persis, coba cari dengan nama yang mengandung Darukni
    let patient;
    if (patients.length > 0) {
      [patient] = patients;
    } else {
      // Log pencarian alternatif
      console.log("Mencoba pencarian alternatif untuk pasien Darukni...");
      const allPatients = await db
        .select()
        .from(schema.patients);
      
      // Filter manual untuk menemukan nama yang mengandung Darukni
      const darukniPatients = allPatients.filter(p => 
        p.name.toLowerCase().includes("darukni") || 
        p.name.toLowerCase().includes("darukni")
      );
      
      console.log(`Menemukan ${darukniPatients.length} pasien dengan nama mengandung Darukni`);
      
      if (darukniPatients.length > 0) {
        patient = darukniPatients[0];
        console.log(`Menggunakan pasien dengan ID ${patient.id} dan nama ${patient.name}`);
      }
    }
    
    if (!patient) {
      console.log(`No patient found with name ${patientName}`);
      return {
        success: false,
        message: `No patient found with name ${patientName}`
      };
    }
    
    console.log(`Found patient with ID ${patient.id} and name ${patient.name}`);
    
    // Find active session for Darukni
    const sessions = await db
      .select()
      .from(schema.sessions)
      .where(
        and(
          eq(schema.sessions.patientId, patient.id),
          eq(schema.sessions.status, "active")
        )
      );
    
    if (!sessions || sessions.length === 0) {
      console.log(`No active sessions found for patient ${patientName}`);
      return {
        success: false,
        message: `No active sessions found for patient ${patientName}`
      };
    }
    
    console.log(`Found ${sessions.length} active sessions for ${patientName}`);
    
    // Log semua sesi yang ditemukan untuk debugging
    console.log("Found sessions:", sessions.map(s => ({
      id: s.id,
      totalSessions: s.totalSessions,
      sessionsUsed: s.sessionsUsed,
      status: s.status
    })));
    
    // Find the specific session for Darukni
    let targetSession;
    
    // Coba cari paket 12 sesi dulu
    targetSession = sessions.find(s => s.totalSessions === 12);
    
    // Jika tidak ditemukan, ambil paket dengan total sesi tertinggi
    if (!targetSession && sessions.length > 0) {
      console.log("Tidak menemukan paket 12 sesi, mencari paket dengan jumlah sesi tertinggi");
      targetSession = sessions.reduce((prev, current) => 
        (prev.totalSessions > current.totalSessions) ? prev : current
      );
    }
    
    if (!targetSession) {
      console.log(`Tidak dapat menemukan paket aktif apapun untuk ${patientName}`);
      return {
        success: false,
        message: `Tidak dapat menemukan paket aktif apapun untuk ${patientName}`
      };
    }
    
    console.log(`Found target session ID ${targetSession.id} with ${targetSession.sessionsUsed}/${targetSession.totalSessions}`);
    
    // Update session to set sessionsUsed = 2
    const [updatedSession] = await db
      .update(schema.sessions)
      .set({ sessionsUsed: 2 })
      .where(eq(schema.sessions.id, targetSession.id))
      .returning();
    
    console.log(`Successfully updated session. New value: ${updatedSession.sessionsUsed}/${updatedSession.totalSessions}`);
    
    return {
      success: true,
      message: `Successfully updated Darukni's sessions from ${targetSession.sessionsUsed}/12 to 2/12`,
      before: targetSession,
      after: updatedSession
    };
    
  } catch (error) {
    console.error("Error fixing Darukni session:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}