/**
 * API Khusus Pendaftaran Walkin
 */

import { Request, Response } from 'express';
import { storage } from '../../storage';

// Endpoint untuk pendaftaran walk-in
export async function registerWalkinPatient(req: Request, res: Response) {
  console.log("🚶 API Walkin: Mencoba pendaftaran pasien walk-in...");
  console.log("📦 API Walkin: Data yang diterima:", req.body);
  
  try {
    // Ambil data pasien
    const patientData = {
      name: req.body.name,
      phoneNumber: req.body.phoneNumber,
      email: req.body.email || null,
      birthDate: req.body.birthDate,
      gender: req.body.gender || "Laki-laki",
      address: req.body.address || "",
      complaints: req.body.complaints || "",
      therapySlotId: req.body.slotId || req.body.therapySlotId
    };
    
    console.log("📝 API Walkin: Data pasien yang akan didaftarkan:", patientData);
    
    // Validasi data
    if (!patientData.name || !patientData.phoneNumber) {
      console.log("❌ API Walkin: Validasi gagal: Nama atau telepon kosong");
      return res.status(400).json({
        success: false,
        message: "Nama dan telepon wajib diisi"
      });
    }
    
    if (!patientData.therapySlotId) {
      console.log("❌ API Walkin: Validasi gagal: Slot terapi tidak ada");
      return res.status(400).json({
        success: false,
        message: "Slot terapi wajib diisi"
      });
    }
    
    // Cari slot terapi
    const therapySlot = await storage.getTherapySlot(patientData.therapySlotId);
    console.log("🔍 API Walkin: Slot terapi yang ditemukan:", therapySlot);
    
    if (!therapySlot) {
      console.log("❌ API Walkin: Slot terapi tidak ditemukan");
      return res.status(404).json({
        success: false,
        message: "Slot terapi tidak ditemukan"
      });
    }
    
    // Cek apakah slot sudah penuh
    if (therapySlot.currentCount >= therapySlot.maxQuota) {
      console.log("❌ API Walkin: Slot terapi sudah penuh");
      return res.status(400).json({
        success: false,
        message: `Slot terapi sudah penuh (${therapySlot.currentCount}/${therapySlot.maxQuota})`
      });
    }
    
    // Buat pasien baru
    console.log("👤 API Walkin: Membuat pasien baru...");
    const patient = await storage.createPatient(patientData);
    console.log("✅ API Walkin: Pasien berhasil dibuat:", patient);
    
    // Buat appointment
    console.log("📅 API Walkin: Membuat appointment baru...");
    const appointmentData = {
      patientId: patient.id,
      date: therapySlot.date.split(" ")[0],
      timeSlot: therapySlot.timeSlot,
      therapySlotId: therapySlot.id,
      sessionId: null,
      status: "Active", // Walk-in selalu active
      registrationNumber: `WI-${Date.now()}`,
      notes: patientData.complaints || "Walk-in appointment"
    };
    
    console.log("📝 API Walkin: Data appointment:", appointmentData);
    const appointment = await storage.createAppointment(appointmentData);
    console.log("✅ API Walkin: Appointment berhasil dibuat:", appointment);
    
    // Update kuota
    console.log("🔄 API Walkin: Mengupdate kuota slot terapi...");
    await storage.incrementTherapySlotUsage(therapySlot.id);
    
    // Verifikasi bahwa data benar-benar tersimpan
    const verifyPatient = await storage.getPatient(patient.id);
    const verifyAppointment = await storage.getAppointment(appointment.id);
    const verifySlot = await storage.getTherapySlot(therapySlot.id);
    
    console.log("🔍 API Walkin: Verifikasi pasien:", verifyPatient);
    console.log("🔍 API Walkin: Verifikasi appointment:", verifyAppointment);
    console.log("🔍 API Walkin: Verifikasi slot (updated count):", verifySlot?.currentCount);
    
    // Respons sukses sederhana
    console.log("🎉 API Walkin: Pendaftaran walk-in berhasil!");
    return res.status(200).json({
      success: true,
      message: "Pendaftaran walk-in berhasil",
      patient: verifyPatient,
      appointment: verifyAppointment,
      currentQuota: verifySlot?.currentCount
    });
  } catch (error: any) {
    console.error("❌ API Walkin: Error pendaftaran walk-in:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal mendaftarkan pasien walk-in",
      error: error.message || "Unknown error"
    });
  }
}