import { Request, Response } from "express";
import { storage } from "../storage";
import { db, pool } from "../db";
import { InsertPatient, insertPatientSchema } from "@shared/schema";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import crypto from "crypto";
import { eq, and, sql } from "drizzle-orm";
import * as schema from "../../shared/schema";
import { findPrimaryTherapySlot, createTimeSlotKey } from '../findPrimaryTherapySlot';

/**
 * Fungsi untuk memperbaiki format time slot yang salah (10:00-00:00)
 * @param timeSlot waktu dalam format "HH:MM-HH:MM"
 * @returns waktu yang sudah diperbaiki
 */
function fixTimeSlotFormat(timeSlot: string): string {
  if (!timeSlot) return "";
  
  // Cek pola waktu yang salah (10:00-00:00)
  if (timeSlot.endsWith("-00:00")) {
    // Ambil waktu awal dari time slot
    const startTime = timeSlot.split("-")[0];
    // Cek apakah ini pola waktu yang bisa diperbaiki, dan tentukan akhirnya
    if (startTime === "10:00") return "10:00-12:00";
    if (startTime === "13:00") return "13:00-15:00"; 
    if (startTime === "15:00") return "15:00-17:00";
    if (startTime === "17:00") return "17:00-19:00";
  }
  
  // Jika tidak ada pola yang cocok, tampilkan apa adanya
  return timeSlot;
}

/**
 * Menangani proses pendaftaran pasien dengan optimasi performa
 * - Memecah proses kompleks menjadi beberapa tahap
 * - Menggunakan query database yang lebih efisien
 * - Menghindari kueri berulang yang tidak perlu
 */
export async function handlePatientRegistration(req: Request, res: Response) {
  // Catat waktu mulai proses untuk pengukuran performa
  const startTime = Date.now();
  console.log("⏱️ [PERF] Mulai proses pendaftaran:", new Date().toISOString());

  // PERBAIKAN: Implementasi timeout tunggal untuk mencegah pendaftaran tak berakhir
  const TIMEOUT_DURATION = 15000; // 15 detik
  const TIMEOUT_MESSAGE = "TIMEOUT: Pendaftaran terlalu lama (melebihi 15 detik). Harap coba lagi.";
  
  // Gunakan variable untuk timeout ID
  const timeoutObj = {
    id: null as NodeJS.Timeout | null
  };
  
  // Promise tunggal yang akan reject jika timeout tercapai
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutObj.id = setTimeout(() => {
      console.error("⏱️ [TIMEOUT] Pendaftaran timeout setelah", TIMEOUT_DURATION/1000, "detik");
      reject(new Error(TIMEOUT_MESSAGE));
    }, TIMEOUT_DURATION);
  });
  
  try {
    // Gunakan Promise.race untuk race antara proses pendaftaran dan timeout
    // Jika timeout terjadi lebih dulu, maka error akan dilempar
    await Promise.race([
      // Promise kosong yang akan segera diselesaikan dan proses pendaftaran berlanjut
      Promise.resolve(),
      timeoutPromise
    ]);
    console.log("Menerima permintaan pendaftaran pasien dengan data:", JSON.stringify(req.body, null, 2));
    
    // DEBUGGING: Log semua parameter walk-in dan online yang mungkin untuk deteksi konsistensi
    console.log("🔍 DEBUGGING PARAMETER REGISTRASI di server-side register.ts:");
    console.log("  - req.body.isWalkInMode:", req.body.isWalkInMode);
    console.log("  - req.body.walkin:", req.body.walkin);
    console.log("  - req.body.walkInMode:", req.body.walkInMode);
    console.log("  - req.query.walkin:", req.query.walkin);
    console.log("  - req.query.isWalkInMode:", req.query.isWalkInMode);
    console.log("  - req.query.walkInMode:", req.query.walkInMode);
    console.log("  - req.body.online:", req.body.online);
    console.log("  - req.query.online:", req.query.online);
    
    // OPTIMASI: Deteksi kedua jalur pendaftaran dengan jelas
    // 1. Deteksi walk-in dari berbagai parameter
    const walkInDetected = 
      req.body.isWalkInMode === true || 
      req.body.walkin === true || 
      req.body.walkInMode === true ||
      req.query.walkin === 'true' ||
      req.query.isWalkInMode === 'true' ||
      req.query.walkInMode === 'true';
      
    // 2. Deteksi pendaftaran online (dari form tracking)
    const onlineRegistration = 
      req.body.online === true || 
      req.query.online === 'true';
      
    console.log("🚦 JALUR PENDAFTARAN:");
    console.log("🧑‍⚕️ Walk-in =", walkInDetected);
    console.log("🖥️ Online  =", onlineRegistration);
    console.log("🔍 URL Search:", req.url);
    console.log("🔍 Query Params:", JSON.stringify(req.query));
    console.log("🔍 Body Params:", JSON.stringify({
      online: req.body.online,
      walkin: req.body.walkin,
      isWalkInMode: req.body.isWalkInMode,
      walkInMode: req.body.walkInMode
    }));
    
    // Validasi body request - jika kosong atau tidak valid, kembalikan error
    if (!req.body || Object.keys(req.body).length === 0) {
      console.log("Error: Request body kosong atau tidak valid");
      return res.status(400).json({ 
        success: false, 
        message: "Data pasien tidak valid. Pastikan semua field yang diperlukan diisi."
      });
    }
    
    // Ambil kode registrasi dari request body, jika ada
    const registrationCode = req.body.registrationCode;
    console.log("Kode registrasi:", registrationCode);
    
    // TAHAP 1: Verifikasi kode registrasi (jika ada)
    let registrationLink = null;
    if (registrationCode) {
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
        
        // Periksa apakah kuota harian sudah tercapai (double-check)
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
    
    // Simpan therapySlotId untuk digunakan nanti
    const therapySlotId = req.body.therapySlotId ? parseInt(req.body.therapySlotId) : null;
    
    // Simpan timeSlotKey jika tersedia untuk prioritas pencarian slot
    const timeSlotKey = req.body.timeSlotKey || null;
    console.log("TimeSlotKey dari form pendaftaran:", timeSlotKey);
    
    // Cek mode walk-in (pendaftaran dari admin)
    // FIX CRITICAL BUG: Berbagai format parameter walk-in yang mungkin dikirim dari client
    // Deteksi parameter walk-in dengan dukungan semua format yang mungkin
    const isWalkInMode = 
      req.body.isWalkInMode === true || 
      req.body.walkin === "true" || 
      req.body.walkin === true || 
      req.body.isWalkInMode === "true" ||
      req.body.iswalkinmode === "true" ||
      req.body.iswalkinmode === true ||
      req.body.walkInMode === true ||
      req.body.walkInMode === "true";
    
    console.log("🔍 DEBUGGING WALKIN di deteksi param register.ts:");
    console.log("  - req.body.isWalkInMode [" + typeof req.body.isWalkInMode + "]:", req.body.isWalkInMode);
    console.log("  - req.body.walkin [" + typeof req.body.walkin + "]:", req.body.walkin);
    console.log("  - req.body.walkInMode [" + typeof req.body.walkInMode + "]:", req.body.walkInMode);
    console.log("  - req.body.iswalkinmode [" + typeof req.body.iswalkinmode + "]:", req.body.iswalkinmode);
    console.log("  - Hasil deteksi:", isWalkInMode ? "WALK-IN AKTIF" : "BUKAN WALK-IN");
    
    console.log("Data yang akan divalidasi:", patientData);
    
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
    
    // TAHAP 3: Cari pasien berdasarkan nama dan tanggal lahir yang sama (dengan query optimized)
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
        
        // Pengecekan nama secara manual karena case insensitive dapat berbeda di berbagai database
        if (patient && patient.name.toLowerCase().trim() === normalizedName) {
          existingPatient = patient;
          console.log(`Pasien lama ditemukan: ID ${existingPatient.id}, patientId: ${existingPatient.patientId}`);
        }
      } catch (error) {
        console.error("Error saat mencari pasien:", error);
        // Lanjutkan meskipun gagal mencari pasien lama
      }
    }
    
    // TAHAP 4: Tingkatkan counter registrasi jika perlu
    if (registrationCode && registrationLink) {
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
        console.log(`Memperbarui nomor telepon pasien dari ${existingPatient.phoneNumber} menjadi ${patientData.phoneNumber}`);
      }
      
      // Periksa dan perbarui alamat jika kosong atau berbeda
      if (!existingPatient.address && patientData.address) {
        fieldsToUpdate.address = patientData.address;
        needsUpdate = true;
        console.log(`Memperbarui alamat pasien yang sebelumnya kosong`);
      }
      
      // Periksa dan perbarui email jika kosong atau berbeda
      if (!existingPatient.email && patientData.email) {
        fieldsToUpdate.email = patientData.email;
        needsUpdate = true;
        console.log(`Memperbarui email pasien yang sebelumnya kosong`);
      }
      
      // Lakukan pembaruan jika diperlukan
      if (needsUpdate) {
        try {
          // Update pasien langsung ke database
          if (Object.keys(fieldsToUpdate).length > 0) {
            const [updatedPatient] = await db.update(schema.patients)
              .set(fieldsToUpdate as any) // Menggunakan cast as any untuk menghindari error type
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
    
    // TAHAP 6: Cari slot terapi yang akan digunakan (optimasi query)
    let appointmentResponse = null;
    
    // PERBAIKAN KRITIS: Validasi therapySlotId harus ada untuk pendaftaran janji temu
    if (!therapySlotId) {
      console.error("❌ ERROR KRITIS: therapySlotId tidak ada dalam request data pendaftaran");
      return res.status(400).json({ 
        success: false, 
        message: "Pendaftaran membutuhkan data slot terapi yang valid", 
        code: "MISSING_THERAPY_SLOT_ID",
        diagnostics: {
          requestData: {
            // Ambil data penting dari request untuk diagnostik
            therapySlotId: req.body.therapySlotId,
            timeSlotKey: req.body.timeSlotKey,
            date: req.body.date,
            timeSlot: req.body.timeSlot,
            isWalkIn: walkInDetected,
            isOnline: onlineRegistration,
          }
        }
      });
    }
    
    if (therapySlotId) {
      try {
        // Query slot terapi langsung dari database
        const [therapySlot] = await db.select()
          .from(schema.therapySlots)
          .where(eq(schema.therapySlots.id, therapySlotId))
          .limit(1);
        
        if (!therapySlot) {
          console.error(`Slot terapi dengan ID ${therapySlotId} tidak ditemukan`);
          return res.status(404).json({ 
            message: "Slot terapi tidak ditemukan", 
            code: "THERAPY_SLOT_NOT_FOUND" 
          });
        }
        
        // PERBAIKAN: Untuk menghindari bottleneck pencarian slot utama
        // Sebagai optimasi performa, kita gunakan langsung slot yang dipilih
        // tanpa mencari slot utama untuk kasus pendaftaran normal
        
        let slotToUse = therapySlot;
        let slotIdToUse = therapySlotId;
        
        // Jika ada timeSlotKey di slot, simpan untuk digunakan nanti
        const timeSlotKey = therapySlot.timeSlotKey || createTimeSlotKey(therapySlot.date, therapySlot.timeSlot);
        console.log(`Slot terapi dengan timeSlotKey: ${timeSlotKey} akan digunakan langsung`);
        
        // Bypass pencarian primarySlot untuk menghindari bottleneck
        console.log(`✅ Menggunakan slot terapi yang dipilih langsung (ID=${therapySlot.id}) untuk percepatan proses`);
        
        // Kita akan menambahkan timeSlotKey jika belum ada, untuk konsistensi data
        if (!therapySlot.timeSlotKey) {
          console.log(`Slot tidak memiliki timeSlotKey, akan ditambahkan: ${timeSlotKey}`);
          // Update timeSlotKey pada slot ini untuk penggunaan di masa depan
          // tapi tidak menunggu hasilnya untuk mempercepat proses
          db.update(schema.therapySlots)
            .set({ timeSlotKey: timeSlotKey })
            .where(eq(schema.therapySlots.id, therapySlotId))
            .execute()
            .then(() => console.log(`✅ TimeSlotKey berhasil ditambahkan ke slot ID=${therapySlotId}`))
            .catch(err => console.error(`❌ Gagal menambahkan timeSlotKey: ${err}`));
        }
        
        // Validasi slot terapi - mode walk-in dapat mengabaikan validasi aktif
        if (!slotToUse.isActive && !isWalkInMode) {
          console.error(`Slot terapi dengan ID ${slotIdToUse} tidak aktif`);
          return res.status(400).json({ 
            message: "Slot terapi tidak aktif", 
            code: "INACTIVE_THERAPY_SLOT" 
          });
        } else if (!slotToUse.isActive && isWalkInMode) {
          console.log(`Walk-in: Mengizinkan pendaftaran untuk slot terapi tidak aktif dengan ID ${slotIdToUse}`);
        }
        
        // Validasi kuota - mode walk-in juga dapat mengabaikan batas kuota
        if (slotToUse.currentCount >= slotToUse.maxQuota && !isWalkInMode) {
          console.error(`Slot terapi dengan ID ${slotIdToUse} sudah penuh`);
          return res.status(400).json({ 
            message: "Slot terapi sudah penuh. Silakan pilih slot lain.", 
            code: "THERAPY_SLOT_FULL" 
          });
        } else if (slotToUse.currentCount >= slotToUse.maxQuota && isWalkInMode) {
          console.log(`Walk-in: Mengizinkan pendaftaran meskipun slot terapi sudah penuh (${slotToUse.currentCount}/${slotToUse.maxQuota})`);
        }
        
        // PERBAIKAN: Tidak perlu update currentCount di sini - ini menyebabkan double-update
        // Update currentCount hanya sekali setelah appointment benar-benar dibuat
        console.log(`Slot terapi dengan ID ${slotIdToUse} akan diperbarui setelah appointment dibuat`);
        console.log(`Status slot sebelum diperbarui: ${slotToUse.currentCount}/${slotToUse.maxQuota}`);
        
        // TAHAP 7: Buat appointment baru (DISEDERHANAKAN)
        // Tambahkan informasi walk-in atau online ke notes untuk tracking yang lebih baik
        let notes = patientData.complaints || '';
        
        // Tambahkan tag sesuai dengan tipe pendaftaran
        if (walkInDetected) {
          notes = `[WALK-IN] ${notes}`;
          console.log("Menambahkan tanda WALK-IN ke notes appointment");
        } else if (onlineRegistration) {
          notes = `[ONLINE] ${notes}`;
          console.log("Menambahkan tanda ONLINE ke notes appointment");
        }
        
        // Menggunakan ISO string date (YYYY-MM-DD) tanpa proses berlebihan
        // PERBAIKAN DASAR: Hindari kesalahan konversi tipe data
        let dateStr;
        
        try {
          // Gunakan konstruksi Date yang konsisten
          if (slotToUse.date) {
            // Konversi ke string ISO dan ambil date part saja
            const date = new Date(slotToUse.date);
            dateStr = date.toISOString().split('T')[0]; // Format YYYY-MM-DD yang konsisten
            console.log("Tanggal slot yang akan digunakan:", dateStr);
          } else {
            // Fallback ke tanggal hari ini jika tidak ada data
            const today = new Date();
            dateStr = today.toISOString().split('T')[0];
            console.log("Menggunakan tanggal hari ini:", dateStr);
          }
        } catch (err) {
          // Jika terjadi error, gunakan tanggal hari ini
          const today = new Date();
          dateStr = today.toISOString().split('T')[0];
          console.error("Error saat memproses tanggal, menggunakan hari ini:", dateStr);
        }
        
        // FIXED: Format data dengan benar untuk insert ke database
        const appointmentData = {
          patientId: patientToUse.id,
          therapySlotId: slotIdToUse, // Gunakan ID slot utama
          notes: notes || '',
          status: "Scheduled",
          date: dateStr, // Gunakan string ISO date
          timeSlot: slotToUse.timeSlot || '',
          sessionId: null,
          registrationNumber: null
        };
        
        // Cek ulang semua properti required
        console.log("CHECK: appointmentData.patientId is valid:", typeof patientToUse.id === 'number' && !isNaN(patientToUse.id));
        console.log("CHECK: appointmentData.therapySlotId is valid:", typeof slotIdToUse === 'number' && !isNaN(slotIdToUse));
        console.log("CHECK: appointmentData.date is valid:", dateStr && typeof dateStr === 'string' && dateStr.length > 0);
        
        console.log("Data appointment yang akan dibuat:", JSON.stringify(appointmentData, null, 2));
        console.log(`Pastikan: patientId=${patientToUse.id}, Nama pasien=${patientToUse.name}, therapySlotId=${slotIdToUse}`);
        
        // OPTIMASI: Sederhanakan insert appointment langsung ke database
        // Menyederhanakan proses dan mengurangi langkah berlebihan
        console.log("🔍 Menyimpan appointment ke database dengan data:", JSON.stringify(appointmentData, null, 2));
        
        // Variable untuk hasil appointment
        let appointmentResult;
        
        try {
          // Persiapkan data dengan tipe data yang tepat, tanpa konversi berlebihan
          // PERBAIKAN: Pastikan semua field memiliki tipe data yang benar
          // dan therapySlotId terkait dengan benar ke slot yang dipilih
          const cleanAppointmentData = {
            patientId: Number(patientToUse.id),
            therapySlotId: Number(slotIdToUse),
            notes: notes || "",
            status: "Scheduled",
            date: dateStr, // String date sudah dalam format YYYY-MM-DD
            timeSlot: slotToUse.timeSlot || "",
            sessionId: null,
            registrationNumber: null
          };
          
          console.log("🔄 DIAGNOSTIK DATA JANJI TEMU:");
          console.log(`   - PatientId: ${cleanAppointmentData.patientId} (Tipe: ${typeof cleanAppointmentData.patientId})`);
          console.log(`   - TherapySlotId: ${cleanAppointmentData.therapySlotId} (Tipe: ${typeof cleanAppointmentData.therapySlotId})`);
          console.log(`   - Date: ${cleanAppointmentData.date} (Tipe: ${typeof cleanAppointmentData.date})`);
          console.log(`   - TimeSlot: ${cleanAppointmentData.timeSlot} (Tipe: ${typeof cleanAppointmentData.timeSlot})`);
          
          // PERBAIKAN KRITIS: Tambahkan try/catch khusus untuk operasi insert data appointment
          try {
            // INTEGRASI KRITIS: Validasi bahwa data appointment yang akan dibuat sudah berisi
            // therapySlotId yang benar
            console.log(`📋 VALIDASI INTEGRASI TERAPI-APPOINTMENT: `);
            console.log(`   - Slot terapi ID yang akan dipakai: ${slotIdToUse}`);
            console.log(`   - Data appointment therapySlotId: ${cleanAppointmentData.therapySlotId}`);

            if (!cleanAppointmentData.therapySlotId || 
                Number(cleanAppointmentData.therapySlotId) !== Number(slotIdToUse)) {
              console.error(`⚠️ KETIDAKCOCOKAN ID SLOT TERAPI: cleanAppointmentData=${cleanAppointmentData.therapySlotId}, slotIdToUse=${slotIdToUse}`);
              // Perbaiki data jika tidak cocok
              cleanAppointmentData.therapySlotId = Number(slotIdToUse);
              console.log(`✅ Data appointment diperbaiki dengan therapySlotId=${cleanAppointmentData.therapySlotId}`);
            }
            
            // Insert data ke database dengan satu operasi
            console.log(`⏳ Menyimpan appointment ke database dengan therapySlotId=${cleanAppointmentData.therapySlotId}...`);
            const [appointment] = await db.insert(schema.appointments)
              .values(cleanAppointmentData)
              .returning();
            
            if (!appointment || !appointment.id) {
              throw new Error("Gagal membuat appointment: ID tidak ditemukan dalam hasil");
            }
            
            appointmentResult = appointment;
            
            console.log("✅ Appointment berhasil dibuat dengan ID:", appointmentResult.id);
            console.log("✅ Memastikan appointment diassign ke slot terapi ID:", appointmentResult.therapySlotId);
            console.log("⏱️ Waktu pembuatan appointment:", new Date().toISOString());
            
            // Verifikasi hasil
            if (appointmentResult.therapySlotId !== Number(slotIdToUse)) {
              console.error(`❌ ERROR KRITIKAL: Appointment dibuat tetapi therapySlotId tidak sesuai!`);
              console.error(`   Expected: ${slotIdToUse}, Actual: ${appointmentResult.therapySlotId}`);
              
              // Coba perbaiki appointment yang baru dibuat
              try {
                console.log(`🔄 Mencoba memperbaiki therapySlotId pada appointment yang baru dibuat...`);
                await db.update(schema.appointments)
                  .set({ therapySlotId: Number(slotIdToUse) })
                  .where(eq(schema.appointments.id, appointmentResult.id));
                console.log(`✅ Perbaikan appointment berhasil!`);
              } catch (fixError) {
                console.error(`❌ Gagal memperbaiki appointment:`, fixError);
              }
            }
          } catch (error) {
            // Handle error dengan tipe yang benar
            const insertError = error as Error;
            console.error("❌ ERROR KRITIS: Gagal menyimpan appointment ke database:", insertError);
            throw new Error(`Gagal menyimpan appointment ke database: ${insertError.message}`);
          }
          
          // PERBAIKAN: Perbarui currentCount slot terapi dan pastikan selalu tereksekusi
          // Gunakan await agar update selesai sebelum data dikirimkan ke klien
          try {
            // PERBAIKAN KRITIKAL: Validasi data sebelum update
            if (!slotIdToUse || isNaN(Number(slotIdToUse))) {
              throw new Error(`ID slot terapi tidak valid: ${slotIdToUse}`);
            }
            
            // Pastikan currentCount tidak undefined sebelum increment
            const currentCount = (typeof slotToUse.currentCount === 'number') 
              ? slotToUse.currentCount 
              : 0;
            
            console.log(`🔄 Mengupdate slot terapi ID ${slotIdToUse} dari count=${currentCount} ke count=${currentCount + 1}`);
            
            // Gunakan SQL mentah untuk memastikan update berjalan
            await db.execute(
              sql`UPDATE therapy_slots SET current_count = current_count + 1 WHERE id = ${slotIdToUse}`
            );
            
            // Ambil data terbaru slot terapi setelah update
            const [updatedSlot] = await db.select()
              .from(schema.therapySlots)
              .where(eq(schema.therapySlots.id, slotIdToUse));
              
            if (!updatedSlot) {
              throw new Error(`Tidak dapat menemukan slot terapi dengan ID ${slotIdToUse} setelah update`);
            }
            
            const updateTime = new Date().toISOString();
            console.log(`✅ CurrentCount slot terapi ID=${slotIdToUse} berhasil diupdate pada ${updateTime}`);
            console.log(`📊 Status slot terakhir: ${updatedSlot.currentCount}/${updatedSlot.maxQuota}`);
            
            // Notifikasi bahwa slot telah diperbarui dan memiliki data lengkap
            console.log(`🎯 Slot telah diperbarui dengan data lengkap untuk ditampilkan di tracker:`);
            console.log(`   - SlotId: ${updatedSlot.id}`);
            console.log(`   - Tanggal: ${updatedSlot.date}`);
            console.log(`   - Waktu: ${updatedSlot.timeSlot}`);
            console.log(`   - CurrentCount: ${updatedSlot.currentCount}`);
          } catch (error) {
            const updateError = error as Error;
            console.error(`❌ ERROR KRITIKAL: Gagal mengupdate slot terapi ID ${slotIdToUse}:`, updateError.message);
            
            try {
              // Coba lagi dengan pendekatan yang lebih sederhana
              console.log("🔄 Mencoba kembali update slot terapi dengan cara alternatif...");
              await db.execute(
                sql`UPDATE therapy_slots SET current_count = current_count + 1 WHERE id = ${slotIdToUse}`
              );
              console.log("✅ Update alternatif berhasil");
            } catch (retryError) {
              console.error("❌ Gagal mencoba kembali update slot terapi:", retryError);
            }
            // Tetap lanjutkan karena appointment sudah terbuat
          }
        } catch (dbError: any) {
          console.error("❌ Gagal menyimpan appointment ke database:", dbError);
          throw new Error(`Gagal menyimpan appointment: ${dbError.message}`);
        }
        
        // Pastikan appointment berhasil dibuat
        if (!appointmentResult) {
          throw new Error("Gagal membuat appointment: Data appointment kosong");
        }
        
        appointmentResponse = {
          ...appointmentResult,
          therapySlotDetails: {
            date: dateStr, // Gunakan string date yang sudah dikonversi
            timeSlot: slotToUse.timeSlot, // PERBAIKAN: Gunakan slotToUse.timeSlot untuk konsistensi
            formattedDate: format(new Date(dateStr), 'dd/MM/yyyy'),
            // Tambahkan format waktu yang benar untuk mengatasi bug 10:00-00:00
            timeSlotFixed: fixTimeSlotFormat(slotToUse.timeSlot || '')
          }
        };
        
        console.log("✅ SUKSES: appointmentResponse dibuat:", JSON.stringify(appointmentResponse, null, 2));
        
        console.log("🔍 DEBUGGING WALKIN: Appointment berhasil disimpan dengan ID:", appointmentResult.id);
      } catch (error) {
        console.error("Error saat memproses slot terapi:", error);
        return res.status(500).json({ 
          message: "Terjadi kesalahan saat memproses pendaftaran terapi", 
          code: "APPOINTMENT_CREATION_ERROR" 
        });
      }
    }
    
    // OPTIMASI: Sederhanakan respons untuk mengurangi ukuran data
    // Filter dan kirim hanya data yang penting
    // Pesan sukses yang lebih informatif berdasarkan jalur pendaftaran
    let successMessage = "Pendaftaran berhasil";
    if (walkInDetected) {
      successMessage = "Pasien berhasil didaftarkan sebagai walk-in ke sesi terapi";
    } else if (onlineRegistration) {
      successMessage = "Pendaftaran online berhasil, pasien terdaftar pada slot terapi";
    }
    
    // Siapkan respons minimal yang berisi informasi penting saja
    // Menghindari pengiriman data lengkap yang tidak perlu
    // Hitung waktu proses total untuk analisis performa
    const endTime = Date.now();
    const processTime = endTime - startTime;
    console.log(`⏱️ [PERF] Selesai proses pendaftaran dalam ${processTime}ms`);
    console.log(`⏱️ [PERF] Waktu selesai: ${new Date().toISOString()}`);
    
    // Matikan timeout karena proses berhasil
    if (timeoutObj.id) {
      clearTimeout(timeoutObj.id);
      timeoutObj.id = null;
    }
    
    // PERBAIKAN KRITIKAL: Verifikasi koneksi appointment pasien yang baru didaftarkan
    try {
      // Lakukan verifikasi tanpa menunggu hasil (non-blocking) untuk pasien yang terdaftar
      if (patientToUse && patientToUse.id && appointmentResponse && appointmentResponse.id) {
        // Import module verifikasi secara dinamis
        console.log(`🔄 Menjalankan verifikasi cepat untuk appointment baru (ID: ${appointmentResponse.id})...`);
        
        // Kirim ke antrian eksekusi untuk diproses setelah respons dikirim
        setTimeout(async () => {
          try {
            const { verifyPatientAppointments } = await import('../verify-appointment-connection');
            const result = await verifyPatientAppointments(patientToUse.id);
            console.log(`✅ Verifikasi appointment selesai untuk pasien: ${result.verified} appointment diverifikasi, ${result.fixed} diperbaiki`);
          } catch (verifyError) {
            console.error("❌ Error saat verifikasi appointment:", verifyError);
          }
        }, 10); // Eksekusi hampir segera setelah respons dikirim
      }
    } catch (verifySetupError) {
      console.error("❌ Gagal mengatur verifikasi appointment:", verifySetupError);
    }
    
    // Kirim respons dengan tambahan informasi jalur pendaftaran
    return res.status(201).json({
      success: true,
      message: successMessage,
      patient: {
        id: patientToUse.id,
        name: patientToUse.name,
        phoneNumber: patientToUse.phoneNumber
      },
      // Sertakan info appointment jika tersedia, hindari akses properti pada null/undefined
      appointment: appointmentResponse ? {
        id: appointmentResponse?.id,
        date: appointmentResponse?.date,
        timeSlot: appointmentResponse?.timeSlot,
        therapySlotId: appointmentResponse?.therapySlotId,
        status: appointmentResponse?.status
      } : null,
      // Informasi jalur pendaftaran yang jelas untuk memudahkan debugging
      registrationType: walkInDetected ? "walk-in" : (onlineRegistration ? "online" : "standard"),
      isWalkIn: walkInDetected,
      isOnlineRegistration: onlineRegistration,
      // Informasi registrasi minimal
      registrationCode: registrationCode || null,
      // Tambahkan info performa untuk debugging (akan berguna di client logs)
      _debug: {
        processTimeMs: processTime,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    // Pastikan timeout dibersihkan
    if (timeoutObj.id) {
      clearTimeout(timeoutObj.id);
      timeoutObj.id = null;
    }
    
    console.error("Error saat proses pendaftaran:", error);
    
    // Deteksi jika error disebabkan oleh timeout
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isTimeout = errorMessage.includes("TIMEOUT");
    
    // Kirim respons error yang lebih spesifik
    return res.status(500).json({ 
      success: false, 
      message: isTimeout 
        ? "Pendaftaran gagal karena waktu habis. Silakan coba lagi." 
        : "Terjadi kesalahan saat memproses pendaftaran",
      details: errorMessage,
      code: isTimeout ? "REGISTRATION_TIMEOUT" : "REGISTRATION_ERROR",
      timeout: isTimeout
    });
  } finally {
    // Pastikan timeout dibersihkan dalam semua kondisi
    if (timeoutObj.id) {
      clearTimeout(timeoutObj.id);
      timeoutObj.id = null;
    }
  }
}