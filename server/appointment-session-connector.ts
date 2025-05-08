/**
 * Modul untuk menghubungkan appointment dengan sesi paket terapi pasien secara otomatis
 */
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "./db";
import * as schema from "@shared/schema";

/**
 * Mencari sesi paket terapi aktif yang tersedia untuk pasien
 * @param patientId - ID pasien
 * @returns Session ID yang ditemukan atau null jika tidak ada sesi yang tersedia
 */
export async function findAvailableSessionForPatient(patientId: number): Promise<number | null> {
  try {
    console.log(`Mencari sesi paket terapi aktif untuk pasien ID ${patientId}...`);
    
    // Dapatkan semua sesi aktif dari pasien yang memiliki sesi tersisa
    const sessions = await db.query.sessions.findMany({
      where: and(
        eq(schema.sessions.patientId, patientId),
        eq(schema.sessions.status, "active")
      ),
      orderBy: desc(schema.sessions.id) // Prioritaskan sesi terbaru 
    });
    
    if (!sessions || sessions.length === 0) {
      console.log(`Tidak ditemukan sesi paket terapi aktif untuk pasien ID ${patientId}`);
      return null;
    }
    
    console.log(`Ditemukan ${sessions.length} sesi paket terapi untuk pasien ID ${patientId}`);
    
    // Cari sesi dengan sisa kuota
    const availableSession = sessions.find(session => session.sessionsUsed < session.totalSessions);
    
    if (!availableSession) {
      console.log(`Semua sesi paket terapi pasien ID ${patientId} sudah habis terpakai`);
      return null;
    }
    
    console.log(`Ditemukan sesi tersedia: ID ${availableSession.id}, sisa sesi: ${availableSession.totalSessions - availableSession.sessionsUsed}`);
    return availableSession.id;
    
  } catch (error) {
    console.error(`Error saat mencari sesi paket terapi untuk pasien ID ${patientId}:`, error);
    return null;
  }
}

/**
 * Menghubungkan appointment dengan sesi paket terapi yang tersedia
 * @param appointmentId - ID appointment 
 * @param patientId - ID pasien
 * @returns True jika berhasil dihubungkan, false jika gagal
 */
export async function connectAppointmentToSession(appointmentId: number, patientId: number): Promise<boolean> {
  try {
    console.log(`Menghubungkan appointment ID ${appointmentId} dengan sesi paket terapi pasien ID ${patientId}...`);
    
    // Dapatkan appointment terlebih dahulu untuk verifikasi
    const appointment = await db.query.appointments.findFirst({
      where: eq(schema.appointments.id, appointmentId)
    });
    
    if (!appointment) {
      console.error(`Appointment ID ${appointmentId} tidak ditemukan`);
      return false;
    }
    
    // Jika appointment sudah memiliki sessionId, tidak perlu melakukan apa-apa
    if (appointment.sessionId) {
      console.log(`Appointment ID ${appointmentId} sudah terhubung dengan sesi ID ${appointment.sessionId}`);
      return true;
    }
    
    // Cari sesi yang tersedia untuk pasien
    const sessionId = await findAvailableSessionForPatient(patientId);
    
    if (!sessionId) {
      console.log(`Tidak ada sesi paket terapi tersedia untuk pasien ID ${patientId}`);
      return false;
    }
    
    // Update appointment dengan sessionId
    const result = await db.update(schema.appointments)
      .set({ sessionId })
      .where(eq(schema.appointments.id, appointmentId))
      .returning();
    
    if (result && result.length > 0) {
      console.log(`Berhasil menghubungkan appointment ID ${appointmentId} dengan sesi ID ${sessionId}`);
      return true;
    }
    
    console.error(`Gagal menghubungkan appointment ID ${appointmentId} dengan sesi ID ${sessionId}`);
    return false;
    
  } catch (error) {
    console.error(`Error saat menghubungkan appointment dengan sesi paket terapi:`, error);
    return false;
  }
}

/**
 * Mencoba otomatis menghubungkan semua appointment yang belum memiliki sessionId
 * dengan sesi paket terapi yang tersedia
 * @returns Jumlah appointment yang berhasil dihubungkan
 */
export async function autoConnectAppointmentsToSessions(): Promise<number> {
  try {
    console.log(`Memulai proses auto-connect untuk semua appointment yang belum terhubung dengan sesi...`);
    
    // Dapatkan semua appointment aktif tanpa sessionId
    const appointments = await db.query.appointments.findMany({
      where: and(
        // Gunakan SQL untuk mengecek null
        sql`${schema.appointments.sessionId} IS NULL`, // yang belum punya sessionId
        eq(schema.appointments.status, "Scheduled") // yang statusnya aktif
      )
    });
    
    if (!appointments || appointments.length === 0) {
      console.log(`Tidak ada appointment yang perlu dihubungkan dengan sesi paket terapi`);
      return 0;
    }
    
    console.log(`Ditemukan ${appointments.length} appointment yang belum terhubung dengan sesi paket terapi`);
    
    let connectedCount = 0;
    
    // Proses setiap appointment
    for (const appointment of appointments) {
      const connected = await connectAppointmentToSession(appointment.id, appointment.patientId);
      
      if (connected) {
        connectedCount++;
      }
    }
    
    console.log(`Berhasil menghubungkan ${connectedCount} dari ${appointments.length} appointment dengan sesi paket terapi`);
    return connectedCount;
    
  } catch (error) {
    console.error(`Error saat auto-connect appointment dengan sesi paket terapi:`, error);
    return 0;
  }
}