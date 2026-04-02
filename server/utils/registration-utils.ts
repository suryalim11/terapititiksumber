/**
 * Utilitas untuk fungsi-fungsi pendaftaran pasien
 */
import { storage } from "../storage";
import crypto from "crypto";

/**
 * Menghasilkan nomor registrasi unik
 * @returns Nomor registrasi dengan format TTS-XXXXXX
 */
export function generateRegistrationNumber(): string {
  const prefix = "TTS";
  const randomDigits = Math.floor(100000 + Math.random() * 900000).toString();
  return `${prefix}-${randomDigits}`;
}

/**
 * Memvalidasi dan memformat nomor telepon
 * @param phoneNumber Nomor telepon yang akan diformat
 * @returns Nomor telepon yang sudah diformat
 */
export function formatPhoneNumber(phoneNumber: string): string {
  if (!phoneNumber) return phoneNumber;
  
  // Hapus karakter non-numerik
  let formatted = phoneNumber.replace(/\D/g, '');
  
  // Tambahkan '0' di depan jika dimulai dengan '8'
  if (formatted.startsWith('8')) {
    formatted = '0' + formatted;
  }
  
  // Tambahkan +62 jika dimulai dengan 0
  if (formatted.startsWith('0')) {
    formatted = '+62' + formatted.substring(1);
  }
  
  return formatted;
}

/**
 * Memeriksa apakah pasien sudah terdaftar berdasarkan nama dan nomor telepon
 * @param name Nama pasien
 * @param phoneNumber Nomor telepon pasien
 * @returns Data pasien jika sudah terdaftar, undefined jika belum
 */
export async function checkExistingPatient(name: string, phoneNumber: string): Promise<any> {
  if (!name || !phoneNumber) return undefined;
  
  const formattedPhone = formatPhoneNumber(phoneNumber);
  const existingPatients = await storage.searchPatientByNameOrPhone(formattedPhone);
  
  return existingPatients.find(
    p => p.name.toLowerCase() === name.toLowerCase() && 
         p.phoneNumber === formattedPhone
  );
}

/**
 * Mendapatkan slot terapi yang tersedia untuk tanggal tertentu
 * @param date Tanggal yang dicari (YYYY-MM-DD)
 * @returns Array slot terapi yang tersedia
 */
export async function getAvailableTherapySlots(date: string): Promise<any[]> {
  const therapySlots = await storage.getTherapySlotsByDate(date);
  
  // Filter slot terapi yang masih tersedia
  return therapySlots.filter(slot => {
    return slot.isActive && slot.currentCount < slot.maxQuota;
  });
}

/**
 * Memeriksa apakah link registrasi valid
 * @param code Kode link registrasi
 * @returns Objek validasi {valid, message, remainingSlots?, specificDate?}
 */
export async function validateRegistrationLink(code: string): Promise<{
  valid: boolean;
  message: string;
  remainingSlots?: number;
  specificDate?: string;
  registrationLink?: any;
}> {
  if (!code) {
    return {
      valid: false,
      message: "Kode registrasi tidak diberikan"
    };
  }
  
  const registrationLink = await storage.getRegistrationLinkByCode(code);
  
  if (!registrationLink) {
    return {
      valid: false,
      message: "Link registrasi tidak ditemukan"
    };
  }
  
  // Periksa apakah link masih aktif
  if (!registrationLink.isActive) {
    return {
      valid: false,
      message: "Link registrasi tidak aktif"
    };
  }
  
  // Periksa apakah link belum kedaluwarsa
  const now = new Date();
  const expiryDate = new Date(registrationLink.expiryTime);
  
  if (now > expiryDate) {
    return {
      valid: false,
      message: "Link registrasi telah kedaluwarsa"
    };
  }
  
  // Periksa apakah batas harian belum tercapai
  // Reset counter jika hari ini berbeda dari lastResetDate
  const today = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
  const lastResetDate = registrationLink.lastResetDate;
  const registrationsToday = (lastResetDate === today) ? (registrationLink.currentRegistrations || 0) : 0;
  
  if (registrationsToday >= registrationLink.dailyLimit) {
    return {
      valid: false,
      message: "Batas pendaftaran harian telah tercapai"
    };
  }
  
  // Periksa apakah link untuk tanggal tertentu dan tanggal hari ini
  if (registrationLink.specificDate) {
    const specificDate = new Date(registrationLink.specificDate).toISOString().split('T')[0];
    
    if (specificDate !== today) {
      return {
        valid: false,
        message: `Link registrasi hanya berlaku untuk tanggal ${specificDate}`
      };
    }
  }
  
  // Link registrasi valid
  return {
    valid: true,
    message: "Link registrasi valid",
    remainingSlots: registrationLink.dailyLimit - registrationsToday,
    specificDate: registrationLink.specificDate,
    registrationLink
  };
}