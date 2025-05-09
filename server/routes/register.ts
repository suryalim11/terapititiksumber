import { Request, Response } from "express";
import { storage } from "../storage";
import { db, pool } from "../db";
import { InsertPatient, insertPatientSchema } from "@shared/schema";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import * as schema from "../../shared/schema";

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
  try {
    console.log("Menerima permintaan pendaftaran pasien dengan data:", JSON.stringify(req.body, null, 2));
    
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
    const isWalkInMode = req.body.isWalkInMode === true || req.body.walkin === "true";
    console.log("Mode Walk-in:", isWalkInMode ? "Ya" : "Tidak");
    
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
        
        // Validasi slot terapi - mode walk-in dapat mengabaikan validasi aktif
        if (!therapySlot.isActive && !isWalkInMode) {
          console.error(`Slot terapi dengan ID ${therapySlotId} tidak aktif`);
          return res.status(400).json({ 
            message: "Slot terapi tidak aktif", 
            code: "INACTIVE_THERAPY_SLOT" 
          });
        } else if (!therapySlot.isActive && isWalkInMode) {
          console.log(`Walk-in: Mengizinkan pendaftaran untuk slot terapi tidak aktif dengan ID ${therapySlotId}`);
        }
        
        // Validasi kuota - mode walk-in juga dapat mengabaikan batas kuota
        if (therapySlot.currentCount >= therapySlot.maxQuota && !isWalkInMode) {
          console.error(`Slot terapi dengan ID ${therapySlotId} sudah penuh`);
          return res.status(400).json({ 
            message: "Slot terapi sudah penuh. Silakan pilih slot lain.", 
            code: "THERAPY_SLOT_FULL" 
          });
        } else if (therapySlot.currentCount >= therapySlot.maxQuota && isWalkInMode) {
          console.log(`Walk-in: Mengizinkan pendaftaran meskipun slot terapi sudah penuh (${therapySlot.currentCount}/${therapySlot.maxQuota})`);
        }
        
        // Tingkatkan jumlah penggunaan slot terapi langsung ke database
        await db.update(schema.therapySlots)
          .set({ 
            currentCount: therapySlot.currentCount + 1
          })
          .where(eq(schema.therapySlots.id, therapySlot.id));
        
        console.log(`Slot terapi dengan ID ${therapySlot.id} diperbarui: ${therapySlot.currentCount + 1}/${therapySlot.maxQuota}`);
        
        // TAHAP 7: Buat appointment baru
        // Tambahkan informasi walk-in ke notes jika dalam mode walk-in
        let notes = patientData.complaints || '';
        if (isWalkInMode) {
          // Tambahkan tag walk-in ke notes untuk ditampilkan di slot tracker
          notes = `[WALK-IN] ${notes}`;
          console.log("Menambahkan tanda WALK-IN ke notes appointment");
        }
        
        const appointmentData = {
          patientId: patientToUse.id,
          therapySlotId: therapySlot.id,
          notes: notes,
          status: "Scheduled",
          date: therapySlot.date, // Gunakan langsung dalam format string
          timeSlot: therapySlot.timeSlot,
          sessionId: null,
          registrationNumber: null
        };
        
        console.log("Data appointment yang akan dibuat:", JSON.stringify(appointmentData, null, 2));
        console.log(`Pastikan: patientId=${patientToUse.id}, Nama pasien=${patientToUse.name}, therapySlotId=${therapySlot.id}`);
        
        // Insert appointment langsung ke database
        const [appointment] = await db.insert(schema.appointments)
          .values(appointmentData)
          .returning();
        
        console.log("Appointment berhasil dibuat:", JSON.stringify(appointment, null, 2));
        
        // Simpan appointment untuk digunakan nanti
        appointmentResponse = {
          ...appointment,
          therapySlotDetails: {
            date: therapySlot.date,
            timeSlot: therapySlot.timeSlot,
            formattedDate: format(new Date(therapySlot.date), 'dd/MM/yyyy'),
            // Tambahkan format waktu yang benar untuk mengatasi bug 10:00-00:00
            timeSlotFixed: fixTimeSlotFormat(therapySlot.timeSlot)
          }
        };
      } catch (error) {
        console.error("Error saat memproses slot terapi:", error);
        return res.status(500).json({ 
          message: "Terjadi kesalahan saat memproses pendaftaran terapi", 
          code: "APPOINTMENT_CREATION_ERROR" 
        });
      }
    }
    
    // TAHAP 8: Berikan respons sukses
    return res.status(201).json({
      success: true,
      message: "Pendaftaran berhasil",
      patient: patientToUse,
      appointment: appointmentResponse,
      registrationStatus: {
        code: registrationCode,
        updatedCount: registrationLink ? registrationLink.currentRegistrations + 1 : null
      }
    });
  } catch (error) {
    console.error("Error saat proses pendaftaran:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Terjadi kesalahan saat memproses pendaftaran" 
    });
  }
}