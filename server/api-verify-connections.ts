/**
 * API untuk memverifikasi dan memperbaiki koneksi pasien-appointment
 */

import { Request, Response } from "express";
import { verifyAppointmentConnectionForPatient } from "./verify-appointment-connection";
import { pool } from "./db";

/**
 * Menjalankan verifikasi koneksi untuk semua pasien
 * Mencari pasien dengan therapySlotId tapi tidak memiliki appointment
 * dan otomatis membuat appointment untuk pasien tersebut
 */
export async function verifyAllPatientConnections(req: Request, res: Response) {
  try {
    console.log("🔄 Memulai verifikasi semua koneksi pasien-appointment...");
    
    // Dapatkan semua pasien dari database
    const client = await pool.connect();
    const { rows: patients } = await client.query(
      'SELECT id, name, therapy_slot_id FROM patients WHERE therapy_slot_id IS NOT NULL'
    );
    client.release();
    
    console.log(`🔍 Ditemukan ${patients.length} pasien dengan therapySlotId yang perlu diverifikasi`);
    
    // Proses setiap pasien
    const results = {
      verified: patients.length,
      fixed: 0,
      skipped: 0,
      details: []
    };
    
    for (const patient of patients) {
      try {
        const verifyResult = await verifyAppointmentConnectionForPatient(patient.id);
        if (verifyResult.fixed > 0) {
          results.fixed += verifyResult.fixed;
          results.details.push(`✅ Pasien ${patient.name} (ID: ${patient.id}): ${verifyResult.fixed} koneksi diperbaiki`);
        } else {
          results.skipped++;
          results.details.push(`⏭️ Pasien ${patient.name} (ID: ${patient.id}): Tidak perlu perbaikan`);
        }
      } catch (error) {
        console.error(`Error saat memverifikasi pasien ID: ${patient.id}:`, error);
        results.skipped++;
        results.details.push(`❌ Pasien ID: ${patient.id}: Error - ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    return res.status(200).json({
      success: true,
      message: `Verifikasi selesai: ${results.verified} diverifikasi, ${results.fixed} diperbaiki, ${results.skipped} dilewati`,
      results
    });
  } catch (error) {
    console.error("Error saat verifikasi koneksi:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat verifikasi koneksi",
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Menjalankan verifikasi koneksi untuk pasien tertentu
 * @param req.params.id ID pasien yang akan diverifikasi
 */
export async function verifyPatientConnection(req: Request, res: Response) {
  try {
    const patientId = parseInt(req.params.id);
    
    if (isNaN(patientId)) {
      return res.status(400).json({
        success: false,
        message: "ID pasien tidak valid"
      });
    }
    
    console.log(`🔄 Memulai verifikasi koneksi untuk pasien ID: ${patientId}`);
    
    const result = await verifyAppointmentConnectionForPatient(patientId);
    
    return res.status(200).json({
      success: true,
      message: `Verifikasi selesai: ${result.verified} diverifikasi, ${result.fixed} diperbaiki, ${result.skipped} dilewati`,
      result
    });
  } catch (error) {
    console.error("Error saat verifikasi koneksi pasien:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat verifikasi koneksi pasien",
      error: error instanceof Error ? error.message : String(error)
    });
  }
}