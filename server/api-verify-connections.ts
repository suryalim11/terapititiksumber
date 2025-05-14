/**
 * API untuk memverifikasi dan memperbaiki koneksi pasien-appointment
 */

import { Request, Response } from 'express';
import { verifyPatientAppointmentConnections, verifyAppointmentConnectionForPatient } from './verify-appointment-connection';

/**
 * Menjalankan verifikasi koneksi untuk semua pasien
 * Mencari pasien dengan therapySlotId tapi tidak memiliki appointment
 * dan otomatis membuat appointment untuk pasien tersebut
 */
export async function verifyAllPatientConnections(req: Request, res: Response) {
  console.log("🔄 Memulai proses verifikasi koneksi untuk semua pasien...");
  
  try {
    const result = await verifyPatientAppointmentConnections();
    
    return res.status(200).json({
      success: true,
      message: `Verifikasi selesai: ${result.verified} pasien diverifikasi, ${result.fixed} diperbaiki, ${result.skipped} dilewati, ${result.errors.length} error`,
      details: result
    });
  } catch (error) {
    console.error("❌ Error saat menjalankan verifikasi koneksi:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat menjalankan verifikasi koneksi",
      error: (error as Error).message
    });
  }
}

/**
 * Menjalankan verifikasi koneksi untuk pasien tertentu
 * @param req.params.id ID pasien yang akan diverifikasi
 */
export async function verifyPatientConnection(req: Request, res: Response) {
  const patientId = Number(req.params.id);
  
  if (isNaN(patientId) || patientId <= 0) {
    return res.status(400).json({
      success: false,
      message: "ID pasien tidak valid"
    });
  }
  
  console.log(`🔄 Memulai proses verifikasi koneksi untuk pasien ID: ${patientId}...`);
  
  try {
    const result = await verifyAppointmentConnectionForPatient(patientId);
    
    const statusMessage = result.fixed 
      ? `Berhasil memperbaiki koneksi appointment untuk pasien ID: ${patientId}`
      : result.skipped
        ? `Tidak ada perbaikan yang diperlukan untuk pasien ID: ${patientId}`
        : `Pasien ID: ${patientId} sudah memiliki koneksi appointment yang valid`;
    
    return res.status(200).json({
      success: true,
      message: statusMessage,
      fixed: result.fixed > 0,
      details: result
    });
  } catch (error) {
    console.error(`❌ Error saat menjalankan verifikasi koneksi untuk pasien ID: ${patientId}:`, error);
    return res.status(500).json({
      success: false,
      message: `Terjadi kesalahan saat menjalankan verifikasi koneksi untuk pasien ID: ${patientId}`,
      error: (error as Error).message
    });
  }
}