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
 * Mencari therapySlot yang cocok berdasarkan tanggal dan waktu appointment
 * @param appointmentDate - Tanggal appointment
 * @param timeSlot - Waktu slot (format: "10:00-12:00")
 * @returns TherapySlot ID yang ditemukan atau null jika tidak ada
 */
export async function findMatchingTherapySlot(appointmentDate: Date | string, timeSlot?: string): Promise<number | null> {
  try {
    // Convert appointmentDate menjadi format tanggal YYYY-MM-DD
    let dateStr: string;
    if (typeof appointmentDate === 'string') {
      // Jika sudah string, ambil bagian tanggalnya saja (YYYY-MM-DD)
      dateStr = appointmentDate.split('T')[0].split(' ')[0];
    } else {
      // Jika Date object, convert ke string format YYYY-MM-DD
      dateStr = appointmentDate.toISOString().split('T')[0];
    }
    
    console.log(`Mencari therapy slot untuk tanggal ${dateStr} dengan waktu ${timeSlot || 'any'}`);
    
    // Query untuk menemukan therapy slot yang sesuai
    const queryConditions = [];
    
    // Filter berdasarkan tanggal (mencari therapy slot dengan tanggal yang sama)
    queryConditions.push(sql`DATE(${schema.therapySlots.date}) = ${dateStr}`);
    
    // Jika timeSlot ditentukan, tambahkan filter waktu
    if (timeSlot) {
      queryConditions.push(eq(schema.therapySlots.timeSlot, timeSlot));
    }
    
    // Cari therapy slot yang aktif
    queryConditions.push(eq(schema.therapySlots.isActive, true));
    
    // Eksekusi query
    const therapySlots = await db.query.therapySlots.findMany({
      where: and(...queryConditions),
      orderBy: [desc(schema.therapySlots.id)] // Ambil yang terbaru jika ada beberapa
    });
    
    if (!therapySlots || therapySlots.length === 0) {
      console.log(`Tidak ditemukan therapy slot untuk tanggal ${dateStr} dengan waktu ${timeSlot || 'any'}`);
      return null;
    }
    
    console.log(`Ditemukan ${therapySlots.length} therapy slot untuk tanggal ${dateStr}`);
    
    // Ambil therapy slot pertama yang ditemukan (yang paling baru)
    return therapySlots[0].id;
    
  } catch (error) {
    console.error(`Error saat mencari therapy slot yang cocok:`, error);
    return null;
  }
}

/**
 * Menghubungkan appointment dengan sesi paket terapi yang tersedia dan mengupdate therapySlotId
 * @param appointmentId - ID appointment 
 * @param patientId - ID pasien
 * @returns True jika berhasil dihubungkan, false jika gagal
 */
export async function connectAppointmentWithDetails(appointmentId: number, patientId: number): Promise<boolean> {
  try {
    console.log(`Menghubungkan appointment ID ${appointmentId} dengan sesi paket terapi dan slot terapi...`);
    
    // Dapatkan appointment terlebih dahulu untuk verifikasi
    const appointment = await db.query.appointments.findFirst({
      where: eq(schema.appointments.id, appointmentId)
    });
    
    if (!appointment) {
      console.error(`Appointment ID ${appointmentId} tidak ditemukan`);
      return false;
    }
    
    let shouldUpdate = false;
    const updateData: any = {};
    
    // Cek dan update sessionId jika belum ada
    if (!appointment.sessionId) {
      // Cari sesi yang tersedia untuk pasien
      const sessionId = await findAvailableSessionForPatient(patientId);
      
      if (sessionId) {
        updateData.sessionId = sessionId;
        shouldUpdate = true;
        console.log(`Mendapatkan sessionId ${sessionId} untuk appointment ID ${appointmentId}`);
      } else {
        console.log(`Tidak ada sesi paket terapi tersedia untuk pasien ID ${patientId}`);
      }
    } else {
      console.log(`Appointment ID ${appointmentId} sudah terhubung dengan sesi ID ${appointment.sessionId}`);
    }
    
    // Cek dan update therapySlotId jika belum ada
    if (!appointment.therapySlotId) {
      // Cari therapy slot yang cocok berdasarkan tanggal dan waktu
      const therapySlotId = await findMatchingTherapySlot(appointment.date, appointment.timeSlot);
      
      if (therapySlotId) {
        updateData.therapySlotId = therapySlotId;
        shouldUpdate = true;
        console.log(`Mendapatkan therapySlotId ${therapySlotId} untuk appointment ID ${appointmentId}`);
      } else {
        console.log(`Tidak ditemukan therapy slot yang cocok untuk appointment ID ${appointmentId}`);
      }
    } else {
      console.log(`Appointment ID ${appointmentId} sudah terhubung dengan slot terapi ID ${appointment.therapySlotId}`);
    }
    
    // Jika tidak ada yang perlu diupdate, return true karena sudah terhubung
    if (!shouldUpdate) {
      return true;
    }
    
    // Update appointment dengan sessionId dan/atau therapySlotId
    const result = await db.update(schema.appointments)
      .set(updateData)
      .where(eq(schema.appointments.id, appointmentId))
      .returning();
    
    if (result && result.length > 0) {
      console.log(`Berhasil mengupdate appointment ID ${appointmentId} dengan data:`, updateData);
      return true;
    }
    
    console.error(`Gagal mengupdate appointment ID ${appointmentId}`);
    return false;
    
  } catch (error) {
    console.error(`Error saat menghubungkan appointment dengan detail:`, error);
    return false;
  }
}

/**
 * Mencoba otomatis menghubungkan semua appointment yang belum memiliki sessionId
 * dengan sesi paket terapi yang tersedia dan slot terapi
 * @returns Jumlah appointment yang berhasil dihubungkan
 */
export async function autoConnectAppointmentsToSessions(): Promise<number> {
  try {
    console.log(`Memulai proses auto-connect untuk semua appointment yang belum lengkap...`);
    
    // Dapatkan appointment yang perlu diupdate:
    // 1. Yang belum memiliki sessionId (belum terhubung dengan paket terapi)
    // 2. Yang belum memiliki therapySlotId (belum terhubung dengan slot terapi)
    // 3. Yang memiliki status "Scheduled" atau "Active" (masih relevan)
    const appointments = await db.query.appointments.findMany({
      where: and(
        or(
          // Yang belum punya sessionId
          sql`${schema.appointments.sessionId} IS NULL`,
          // Atau belum punya therapySlotId
          sql`${schema.appointments.therapySlotId} IS NULL`
        ),
        // Dan statusnya aktif/terjadwal
        or(
          eq(schema.appointments.status, "Scheduled"),
          eq(schema.appointments.status, "Active")
        )
      )
    });
    
    if (!appointments || appointments.length === 0) {
      console.log(`Tidak ada appointment yang perlu dihubungkan dengan sesi atau slot terapi`);
      return 0;
    }
    
    console.log(`Ditemukan ${appointments.length} appointment yang perlu dihubungkan dengan sesi atau slot terapi`);
    
    let connectedCount = 0;
    
    // Proses setiap appointment
    for (const appointment of appointments) {
      const connected = await connectAppointmentWithDetails(appointment.id, appointment.patientId);
      
      if (connected) {
        connectedCount++;
      }
    }
    
    console.log(`Berhasil menghubungkan ${connectedCount} dari ${appointments.length} appointment`);
    return connectedCount;
    
  } catch (error) {
    console.error(`Error saat auto-connect appointment dengan detail:`, error);
    return 0;
  }
}