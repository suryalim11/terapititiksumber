/**
 * API untuk memverifikasi dan memperbaiki koneksi pasien-appointment
 */

import { Request, Response } from "express";
import { verifyPatientAppointmentConnections, verifyAppointmentConnectionForPatient } from "./verify-appointment-connection";

/**
 * Menjalankan verifikasi koneksi untuk semua pasien
 * Mencari pasien dengan therapySlotId tapi tidak memiliki appointment
 * dan otomatis membuat appointment untuk pasien tersebut
 */
export async function verifyAllPatientConnections(req: Request, res: Response) {
  try {
    console.log("🔄 Memulai verifikasi semua koneksi pasien-appointment...");
    
    const result = await verifyPatientAppointmentConnections();
    
    return res.status(200).json({
      success: true,
      message: `Verifikasi selesai: ${result.verified} diverifikasi, ${result.fixed} diperbaiki, ${result.skipped} dilewati`,
      result
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