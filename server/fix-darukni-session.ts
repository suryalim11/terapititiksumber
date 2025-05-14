/**
 * File ini berisi fungsi-fungsi untuk memperbaiki jumlah sesi terpakai pada paket terapi
 */

import { db } from "./db";
import { storage } from "./storage";
import { sessions, patients } from "@shared/schema";
import { eq, like } from "drizzle-orm";

/**
 * Memperbaiki jumlah sesi terpakai untuk pasien
 * @param sessionId ID sesi yang akan diperbaiki
 * @param newCount Jumlah sesi terpakai yang baru
 * @returns Object dengan status keberhasilan dan hasil pembaruan
 */
export async function fixSessionUsageCount(sessionId: number, newCount: number) {
  try {
    console.log(`Memperbaiki jumlah sesi terpakai untuk sesi ID ${sessionId} menjadi ${newCount}`);
    
    // Validasi input
    if (isNaN(sessionId) || isNaN(newCount) || newCount < 0) {
      return {
        success: false,
        message: "Parameter tidak valid"
      };
    }
    
    // Dapatkan sesi yang ada
    const session = await storage.getSession(sessionId);
    
    if (!session) {
      return {
        success: false,
        message: "Sesi tidak ditemukan"
      };
    }
    
    // Pastikan jumlah sesi baru tidak melebihi total sesi
    if (newCount > session.totalSessions) {
      return {
        success: false,
        message: `Jumlah sesi terpakai (${newCount}) tidak boleh melebihi total sesi (${session.totalSessions})`
      };
    }
    
    // Update sesi dengan jumlah baru
    const updatedSession = await storage.updateSessionUsage(sessionId, newCount);
    
    if (!updatedSession) {
      return {
        success: false,
        message: "Gagal memperbarui jumlah sesi terpakai"
      };
    }
    
    return {
      success: true,
      message: `Berhasil memperbarui jumlah sesi terpakai menjadi ${newCount}`,
      session: updatedSession
    };
  } catch (error) {
    console.error("Error dalam fixSessionUsageCount:", error);
    return {
      success: false,
      message: `Terjadi kesalahan: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Mencari pasien berdasarkan nama atau ID
 * @param searchTerm Kata kunci pencarian (nama atau ID)
 * @returns Array pasien yang ditemukan
 */
export async function findPatientByNameOrId(searchTerm: string) {
  try {
    // Cek apakah searchTerm adalah ID (angka)
    const isNumeric = /^\d+$/.test(searchTerm);
    
    let results = [];
    
    if (isNumeric) {
      // Cari berdasarkan ID
      const id = parseInt(searchTerm);
      const patient = await storage.getPatient(id);
      if (patient) {
        results.push(patient);
      }
    }
    
    // Cari berdasarkan nama (case insensitive)
    const patientsByName = await db.select()
      .from(patients)
      .where(like(patients.name, `%${searchTerm}%`));
    
    // Gabungkan hasil pencarian
    results = [...results, ...patientsByName.filter(p => 
      // Filter duplikat jika pencarian berdasarkan ID juga mengembalikan hasil
      isNumeric ? p.id !== parseInt(searchTerm) : true
    )];
    
    return results;
  } catch (error) {
    console.error("Error dalam findPatientByNameOrId:", error);
    return [];
  }
}