import { Request, Response } from "express";
import { storage } from "../storage";
import { db, pool } from "../db";
import { InsertPatient, insertPatientSchema } from "@shared/schema";
import { format } from "date-fns";
import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import * as schema from "../../shared/schema";

/**
 * Menangani proses pendaftaran pasien dengan dua jalur yang jelas:
 * 1. Online Registration: Via shared link (tanpa walkin parameter)
 * 2. Walk-in Registration: Via slot tracker dengan walkin parameter
 */
export async function handlePatientRegistration(req: Request, res: Response) {
  const startTime = Date.now();
  console.log("⏱️ [PERF] Mulai proses pendaftaran:", new Date().toISOString());

  // Implementasi timeout tunggal untuk mencegah pendaftaran tak berakhir
  const TIMEOUT_DURATION = 15000; // 15 detik
  const TIMEOUT_MESSAGE = "TIMEOUT: Pendaftaran terlalu lama (melebihi 15 detik). Harap coba lagi.";
  
  // Gunakan variable untuk timeout ID
  const timeoutObj = {
    id: null as NodeJS.Timeout | null
  };
  
  // Promise yang akan reject jika timeout tercapai
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutObj.id = setTimeout(() => {
      console.error("⏱️ [TIMEOUT] Pendaftaran timeout setelah", TIMEOUT_DURATION/1000, "detik");
      reject(new Error(TIMEOUT_MESSAGE));
    }, TIMEOUT_DURATION);
  });
  
  try {
    // Race antara proses pendaftaran dan timeout
    await Promise.race([Promise.resolve(), timeoutPromise]);
    console.log("Menerima permintaan pendaftaran pasien");
    
    // DETEKSI JALUR PENDAFTARAN DENGAN JELAS:
    // ======================================
    
    // 1. Deteksi walk-in (dari admin) - hanya menggunakan satu flag untuk konsistensi
    const isWalkIn = req.body.walkin === true || req.body.walkin === "true";
    
    // 2. Deteksi pendaftaran online (dengan kode registrasi)
    const registrationCode = req.body.registrationCode;
    const isOnlineRegistration = !!registrationCode;
    
    console.log("🚦 JALUR PENDAFTARAN:");
    console.log("🧑‍⚕️ Walk-in =", isWalkIn);
    console.log("🖥️ Online  =", isOnlineRegistration);
    
    // Validasi body request
    if (!req.body || Object.keys(req.body).length === 0) {
      console.log("Error: Request body kosong atau tidak valid");
      return res.status(400).json({ 
        success: false, 
        message: "Data pasien tidak valid. Pastikan semua field yang diperlukan diisi."
      });
    }
    
    // TAHAP 1: Verifikasi kode registrasi (khusus pendaftaran online)
    let registrationLink = null;
    if (isOnlineRegistration) {
      try {
        // Query langsung ke database untuk kecepatan
        const [link] = await db.select()
          .from(schema.registrationLinks)
          .where(eq(schema.registrationLinks.code, registrationCode))
          .limit(1);
        
        registrationLink = link;
        
        if (!link) {
          return res.status(400).json({ 
            message: "Kode pendaftaran tidak valid", 
            code: "INVALID_REGISTRATION_CODE" 
          });
        }
        
        // Periksa apakah link masih aktif
        if (!link.isActive) {
          return res.status(400).json({ 
            message: "Link pendaftaran sudah tidak aktif", 
            code: "INACTIVE_REGISTRATION_LINK" 
          });
        }
        
        // Periksa apakah link expired
        const now = new Date();
        if (now > link.expiryTime) {
          return res.status(400).json({ 
            message: "Link pendaftaran sudah kadaluarsa", 
            code: "EXPIRED_REGISTRATION_LINK" 
          });
        }
        
        // Periksa apakah kuota harian sudah tercapai
        if (link.currentRegistrations >= link.dailyLimit) {
          return res.status(400).json({ 
            message: "Kuota pendaftaran untuk hari ini sudah penuh. Silakan coba lagi besok.",
            dailyLimit: link.dailyLimit,
            currentRegistrations: link.currentRegistrations,
            code: "QUOTA_REACHED" 
          });
        }
      } catch (error) {
        console.error("Error verifikasi kode registrasi:", error);
        return res.status(500).json({ 
          message: "Terjadi kesalahan saat memverifikasi kode pendaftaran", 
          code: "VERIFICATION_ERROR" 
        });
      }
    }
    
    // TAHAP 2: Validasi dan normalisasi data pasien
    const patientData = {
      name: req.body.name || "",
      phoneNumber: req.body.phoneNumber || "",
      email: req.body.email || null,
      birthDate: req.body.birthDate || "",
      gender: req.body.gender || "Laki-laki",
      address: req.body.address || "",
      complaints: req.body.complaints || "",
      therapySlotId: req.body.therapySlotId ? parseInt(req.body.therapySlotId) : undefined
    };
    
    const therapySlotId = req.body.therapySlotId ? parseInt(req.body.therapySlotId) : null;
    
    // Simpan timeSlotKey untuk prioritas pencarian slot
    const timeSlotKey = req.body.timeSlotKey || null;
    console.log("TimeSlotKey dari form pendaftaran:", timeSlotKey);
    
    try {
      const validatedData = insertPatientSchema.parse(patientData);
      console.log("Data pasien tervalidasi:", validatedData);
    } catch (validationError) {
      console.error("Validasi data pasien gagal:", validationError);
      return res.status(400).json({ 
        message: "Data pasien tidak valid", 
        code: "INVALID_PATIENT_DATA",
        errors: validationError 
      });
    }
    
    // TAHAP 3: Cari pasien berdasarkan nama dan tanggal lahir yang sama
    let existingPatient = null;
    if (patientData.name && patientData.birthDate) {
      console.log(`Memverifikasi pasien lama: ${patientData.name}, tanggal lahir: ${patientData.birthDate}`);
      
      try {
        // Normalisasi nama untuk pencarian (lowercase)
        const normalizedName = patientData.name.toLowerCase().trim();
        
        // Query database langsung untuk mencari pasien berdasarkan nama dan tanggal lahir
        const [patient] = await db.select()
          .from(schema.patients)
          .where(
            and(
              eq(schema.patients.birthDate, patientData.birthDate)
            )
          )
          .limit(1);
        
        // Pengecekan nama secara manual
        if (patient && patient.name.toLowerCase().trim() === normalizedName) {
          existingPatient = patient;
          console.log(`Pasien lama ditemukan: ID ${existingPatient.id}, patientId: ${existingPatient.patientId}`);
        }
      } catch (error) {
        console.error("Error saat mencari pasien:", error);
        // Lanjutkan meskipun gagal mencari pasien lama
      }
    }
    
    // TAHAP 4: Tingkatkan counter registrasi untuk jalur online
    if (isOnlineRegistration && registrationLink) {
      try {
        console.log("Incrementing registration count for code:", registrationCode);
        
        // Update langsung ke database untuk kecepatan
        await db.update(schema.registrationLinks)
          .set({ 
            currentRegistrations: registrationLink.currentRegistrations + 1
          })
          .where(eq(schema.registrationLinks.code, registrationCode));
        
        console.log("Updated registration count:", registrationLink.currentRegistrations + 1);
      } catch (error) {
        console.error("Error saat increment registration count:", error);
        return res.status(500).json({ 
          message: "Terjadi kesalahan saat memproses pendaftaran", 
          code: "INCREMENT_ERROR" 
        });
      }
    }
    
    // TAHAP 5: Persiapkan data pasien yang akan digunakan
    let patientToUse;
    
    if (existingPatient) {
      console.log(`Menggunakan pasien yang sudah ada: ${existingPatient.name} (ID: ${existingPatient.id})`);
      patientToUse = existingPatient;
      
      // Periksa apakah perlu memperbarui data pasien yang ada jika ada perubahan
      let needsUpdate = false;
      const fieldsToUpdate: Partial<InsertPatient> = {};
      
      // Periksa dan perbarui informasi kontak jika berbeda
      if (existingPatient.phoneNumber !== patientData.phoneNumber) {
        fieldsToUpdate.phoneNumber = patientData.phoneNumber;
        needsUpdate = true;
      }
      
      // Periksa dan perbarui alamat jika kosong atau berbeda
      if (!existingPatient.address && patientData.address) {
        fieldsToUpdate.address = patientData.address;
        needsUpdate = true;
      }
      
      // Periksa dan perbarui email jika kosong atau berbeda
      if (!existingPatient.email && patientData.email) {
        fieldsToUpdate.email = patientData.email;
        needsUpdate = true;
      }
      
      // Lakukan pembaruan jika diperlukan
      if (needsUpdate) {
        try {
          // Update pasien langsung ke database
          if (Object.keys(fieldsToUpdate).length > 0) {
            const [updatedPatient] = await db.update(schema.patients)
              .set(fieldsToUpdate as any)
              .where(eq(schema.patients.id, existingPatient.id))
              .returning();
              
            if (updatedPatient) {
              console.log(`Data pasien ID ${existingPatient.id} berhasil diperbarui`);
              patientToUse = updatedPatient;
            }
          }
        } catch (error) {
          console.error(`Gagal memperbarui data pasien ID ${existingPatient.id}:`, error);
          // Lanjutkan meskipun gagal update
        }
      }
    } else {
      // Buat pasien baru jika tidak ditemukan
      try {
        patientToUse = await storage.createPatient(patientData);
        console.log("Pasien baru dibuat:", patientToUse);
      } catch (error) {
        console.error("Error saat membuat pasien baru:", error);
        return res.status(500).json({ 
          message: "Terjadi kesalahan saat membuat data pasien baru", 
          code: "PATIENT_CREATION_ERROR" 
        });
      }
    }
    
    // TAHAP 6: Validasi therapySlotId harus ada untuk pendaftaran janji temu
    if (!therapySlotId) {
      console.error("❌ ERROR: therapySlotId tidak ada dalam request data pendaftaran");
      return res.status(400).json({ 
        success: false, 
        message: "Pendaftaran membutuhkan data slot terapi yang valid", 
        code: "MISSING_THERAPY_SLOT_ID"
      });
    }
    
    // TAHAP 7: Membuat appointment
    let appointmentResponse = null;
    
    // Membuat koneksi transaksi database untuk memastikan integritas data
    console.log("⏳ Memulai transaksi database untuk pendaftaran pasien...");
    const client = await pool.connect();
    
    let transactionActive = false;
    
    try {
      // Mulai transaksi database
      await client.query('BEGIN');
      transactionActive = true;
      console.log("✅ Transaksi database dimulai");
      
      // Query slot terapi dalam transaksi yang sama
      const { rows: [therapySlot] } = await client.query(
        'SELECT * FROM therapy_slots WHERE id = $1 LIMIT 1',
        [therapySlotId]
      );
      
      if (!therapySlot) {
        // Rollback dan kembalikan error
        await client.query('ROLLBACK');
        console.error(`❌ Slot terapi dengan ID ${therapySlotId} tidak ditemukan`);
        return res.status(404).json({
          success: false,
          message: "Slot terapi tidak ditemukan",
        });
      }
      
      // Periksa apakah slot terapi memiliki kuota
      const isSlotFull = therapySlot.current_count >= therapySlot.max_quota;
      if (isSlotFull) {
        await client.query('ROLLBACK');
        transactionActive = false;
        console.error(`❌ Slot terapi dengan ID ${therapySlotId} sudah penuh (max_quota: ${therapySlot.max_quota}, current_count: ${therapySlot.current_count})`);
        return res.status(400).json({
          success: false,
          message: "Slot terapi sudah penuh, silakan pilih slot lain",
          code: "SLOT_FULL"
        });
      }
      
      // Gunakan langsung nilai timeSlot dari database
      const timeSlot = therapySlot.time_slot || therapySlot.timeSlot;
      
      // Buat nomor registrasi yang unik (ID-[YYYYMMDD]-[4 angka random])
      const today = new Date();
      const dateStr = format(today, 'yyyyMMdd');
      const randomNum = Math.floor(1000 + Math.random() * 9000); // 4 digit angka random
      const registrationNumber = `ID-${dateStr}-${randomNum}`;
      
      // Buat data appointment baru
      const appointmentDate = new Date(therapySlot.date);
      
      // Tentukan status appointment berdasarkan mode pendaftaran
      let appointmentStatus = "pending";
      
      // Status langsung confirmed untuk walk-in dari admin
      if (isWalkIn) {
        appointmentStatus = "confirmed";
      }
      
      const appointmentData = {
        patientId: patientToUse.id,
        date: appointmentDate.toISOString().split('T')[0], // format: YYYY-MM-DD
        timeSlot,
        therapySlotId: therapySlot.id,
        sessionId: null, // Akan diisi nanti oleh sistem
        status: appointmentStatus,
        registrationNumber,
        notes: patientData.complaints || null
      };
      
      // Simpan appointment ke database
      const { rows: [appointment] } = await client.query(
        `INSERT INTO appointments 
         (patient_id, date, time_slot, therapy_slot_id, session_id, status, registration_number, notes) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         RETURNING *`,
        [
          appointmentData.patientId, 
          appointmentData.date, 
          appointmentData.timeSlot, 
          appointmentData.therapySlotId, 
          appointmentData.sessionId, 
          appointmentData.status, 
          appointmentData.registrationNumber, 
          appointmentData.notes
        ]
      );
      
      // Perbarui current_count untuk slot terapi
      await client.query(
        'UPDATE therapy_slots SET current_count = current_count + 1 WHERE id = $1',
        [therapySlotId]
      );
      
      // Update therapySlotId di data pasien
      await client.query(
        'UPDATE patients SET therapy_slot_id = $1 WHERE id = $2',
        [therapySlotId, patientToUse.id]
      );
      
      // Commit transaksi
      await client.query('COMMIT');
      console.log("✅ Transaksi database berhasil");
      
      appointmentResponse = appointment;
      
      // Kirimkan respon sukses
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      console.log(`⏱️ [PERF] Pendaftaran selesai dalam ${processingTime}ms`);
      
      return res.status(201).json({
        success: true,
        message: `Pendaftaran berhasil${isWalkIn ? ' (Walk-in)' : ''}. Silakan datang sesuai jadwal.`,
        patient: patientToUse,
        appointment: appointment,
        processingTime
      });
    } catch (error) {
      if (transactionActive) {
        // Rollback transaksi jika terjadi error
        await client.query('ROLLBACK');
        console.error("❌ Transaksi database di-rollback karena error:", error);
      }
      
      console.error("Error saat membuat appointment:", error);
      return res.status(500).json({
        success: false,
        message: "Terjadi kesalahan saat membuat janji terapi",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      // Pastikan koneksi dikembalikan ke pool
      client.release();
      
      // Hapus timeout jika masih aktif
      if (timeoutObj.id) {
        clearTimeout(timeoutObj.id);
      }
    }
  } catch (error) {
    console.error("Error saat pendaftaran:", error);
    
    // Hapus timeout jika masih aktif
    if (timeoutObj.id) {
      clearTimeout(timeoutObj.id);
    }
    
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Terjadi kesalahan saat pendaftaran",
    });
  }
}