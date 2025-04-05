import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format as dateFnsFormat, parseISO, addHours, parse, isValid, startOfDay } from "date-fns";
import { id } from "date-fns/locale";

/**
 * Combines multiple class names into a single string using clsx and tailwind-merge.
 * This utility is used to efficiently merge Tailwind CSS classes.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Konstanta untuk zona waktu WIB (UTC+7)
 */
export const WIB_OFFSET = 7; // WIB adalah UTC+7

/**
 * Format a date string to dd/MM/yyyy format with day name
 * (for appointment dates - timezone should only be used with times)
 */
export function formatDateDDMMYYYY(dateString: string | Date): string {
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    // Format dengan nama hari (eeee = nama hari lengkap) diikuti tanggal
    return dateFnsFormat(date, "eeee, dd/MM/yyyy", { locale: id });
  } catch (e) {
    return "";
  }
}

/**
 * Format a birth date string to dd/MM/yyyy format without timezone
 * (specifically for birth dates)
 */
export function formatBirthDate(dateString: string | Date): string {
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return dateFnsFormat(date, "dd/MM/yyyy", { locale: id });
  } catch (e) {
    return "";
  }
}

/**
 * Format a price value as Indonesian Rupiah currency
 */
export function formatRupiah(price: string | number): string {
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(numPrice);
}

/**
 * Calculate age from a birthday date string
 */
export function calculateAge(birthDateString: string): number {
  const birthDate = new Date(birthDateString);
  const today = new Date();
  
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDifference = today.getMonth() - birthDate.getMonth();
  
  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Generate patient ID based on pattern P-YYYY-XXX (year-sequence)
 */
export function generatePatientId(id: number): string {
  const year = new Date().getFullYear();
  const paddedId = String(id).padStart(3, "0");
  return `P-${year}-${paddedId}`;
}

/**
 * Generate transaction ID based on pattern T-YYYYMMDD-XXX (date-sequence)
 */
export function generateTransactionId(id: number): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const paddedId = String(id).padStart(3, "0");
  
  return `T-${year}${month}${day}-${paddedId}`;
}

/**
 * Get formatted payment method name
 */
export function getPaymentMethodName(method: string): string {
  const methods: Record<string, string> = {
    cash: "Tunai",
    transfer: "Transfer Bank",
    qris: "QRIS",
    card: "Kartu Kredit/Debit",
  };
  
  return methods[method.toLowerCase()] || method;
}

/**
 * Get initial letters from a name (up to 2 characters)
 */
export function getInitials(name: string): string {
  if (!name) return "";
  
  const parts = name.split(" ");
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Validate if a string is a valid date
 */
export function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * Format a date with time for display with WIB timezone
 * Only add WIB indication when displaying time
 */
export function formatDate(date: Date): string {
  const hasTimeComponent = date.getHours() !== 0 || date.getMinutes() !== 0;
  if (hasTimeComponent) {
    return dateFnsFormat(date, "dd/MM/yyyy HH:mm", { locale: id }) + " WIB";
  } else {
    return dateFnsFormat(date, "dd/MM/yyyy", { locale: id });
  }
}

/**
 * Format ISO date string to a readable format
 * @param dateString - ISO date string to format
 */
export function formatISODate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return dateFnsFormat(date, "dd/MM/yyyy", { locale: id });
  } catch (error) {
    return dateString;
  }
}

/**
 * Format ISO string timestamp to WIB time
 * This function menangani konversi timezone dengan benar untuk semua tipe aktivitas
 * 
 * @param isoString - ISO string timestamp yang akan diformat
 * @param isLocalTime - Set ke true jika timestamp sudah dalam waktu lokal (WIB)
 * @param activityType - Tipe aktivitas, untuk format yang konsisten
 */
export function formatISOtoWIB(isoString: string, isLocalTime: boolean = false, activityType: string = ""): string {
  try {
    // Parse string ISO ke objek date
    const date = parseISO(isoString);
    
    let adjustedDate;
    
    // Pengaturan penyesuaian waktu berdasarkan tipe aktivitas
    if (activityType === "transaction") {
      // Transaksi dari server memerlukan penyesuaian -7 jam
      adjustedDate = addHours(date, -7);
    } else if (activityType === "appointment") {
      // Appointment dari server memerlukan penyesuaian -21 jam (sesuai kebutuhan)
      adjustedDate = addHours(date, -21);
    } else {
      // Semua aktivitas lain dari server memerlukan penyesuaian -21 jam
      adjustedDate = addHours(date, -21);
    }
    
    // Check if there's a time component
    const hasTimeComponent = 
      adjustedDate.getHours() !== 0 || 
      adjustedDate.getMinutes() !== 0 || 
      adjustedDate.getSeconds() !== 0;
    
    // Format the date based on whether it has a time component
    if (hasTimeComponent) {
      // Format with time and WIB timezone
      return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(adjustedDate) + " WIB";
    } else {
      // Format date only without WIB
      return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(adjustedDate);
    }
  } catch (e) {
    console.error("Error formatting ISO date:", e);
    return "";
  }
}

/**
 * Create time slots for scheduling (e.g., 08:00, 08:30, etc.)
 */
export function generateTimeSlots(startHour: number = 8, endHour: number = 17, interval: number = 30): string[] {
  const slots: string[] = [];
  
  for (let hour = startHour; hour <= endHour; hour++) {
    for (let minute = 0; minute < 60; minute += interval) {
      const formattedHour = String(hour).padStart(2, "0");
      const formattedMinute = String(minute).padStart(2, "0");
      slots.push(`${formattedHour}:${formattedMinute}`);
    }
  }
  
  return slots;
}

/**
 * Perbaikan masalah timezone dengan metode tanggal sebagai string YYYY-MM-DD
 * Fungsi ini mencegah pergeseran tanggal akibat konversi timezone dengan
 * melakukan ekstraksi komponen tanggal (tahun, bulan, tanggal) dan
 * menyusunnya ulang sebagai string yang tidak terpengaruh timezone
 * 
 * @param dateValue - Date object yang akan diperbaiki atau string tanggal
 * @returns string format 'YYYY-MM-DD' yang konsisten
 */
/**
 * Mendapatkan tanggal hari ini dalam zona waktu WIB (GMT+7)
 * @returns Date object dengan waktu yang disesuaikan ke zona waktu WIB
 */
export function getTodayInWIB(): Date {
  const now = new Date();
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utcTime + (WIB_OFFSET * 3600000));
}

/**
 * Mengkonversi Date ke string YYYY-MM-DD dengan mempertimbangkan zona waktu WIB
 * @param date - Date object yang akan dikonversi
 * @returns string tanggal dalam format YYYY-MM-DD dengan penyesuaian zona waktu WIB
 */
export function dateToWIBDateString(date: Date): string {
  // Sesuaikan ke zona waktu WIB (GMT+7)
  const wibDate = new Date(date.getTime() + (WIB_OFFSET * 3600000));
  const year = wibDate.getUTCFullYear();
  const month = (wibDate.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = wibDate.getUTCDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Membandingkan apakah dua tanggal berada pada hari yang sama dalam zona waktu WIB
 * Berguna untuk filter "Hari Ini" yang akurat dengan zona waktu Indonesia
 * 
 * @param date1 - Tanggal pertama untuk dibandingkan
 * @param date2 - Tanggal kedua untuk dibandingkan (default: hari ini)
 * @returns boolean - true jika kedua tanggal pada hari yang sama dalam WIB
 */
export function isSameDayInWIB(date1: Date | string, date2: Date | string = new Date()): boolean {
  try {
    const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
    const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
    
    if (!isValid(d1) || !isValid(d2)) return false;
    
    // Konversi kedua tanggal ke string YYYY-MM-DD dalam zona waktu WIB
    const date1Str = dateToWIBDateString(d1);
    const date2Str = dateToWIBDateString(d2);
    
    // Bandingkan string tanggal
    return date1Str === date2Str;
  } catch (error) {
    console.error("Error in isSameDayInWIB:", error);
    return false;
  }
}

/**
 * Mengonversi Date ke startOfDay dalam zona waktu WIB
 * untuk menghindari masalah pergeseran tanggal akibat perbedaan timezone
 * 
 * @param dateValue - Tanggal yang akan dikonversi
 * @returns Date - Objek Date yang menunjukkan awal hari (00:00:00) dalam WIB
 */
export function getStartOfDayWIB(dateValue: Date | string): Date {
  try {
    // Konversi input ke Date jika berupa string
    const inputDate = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
    
    if (!isValid(inputDate)) {
      throw new Error("Invalid date input");
    }
    
    // Dapatkan string YYYY-MM-DD dalam WIB
    const dateStr = dateToWIBDateString(inputDate);
    
    // Buat Date baru dari string tersebut (akan menjadi 00:00:00 di zona waktu lokal)
    // dan sesuaikan ke WIB
    return new Date(`${dateStr}T00:00:00+07:00`);
  } catch (error) {
    console.error("Error in getStartOfDayWIB:", error);
    return getTodayInWIB(); // Fallback ke hari ini jika ada error
  }
}

export function fixTimezone(dateValue: Date | string): string {
  try {
    // Jika input adalah string dalam format YYYY-MM-DD, kembalikan langsung
    if (typeof dateValue === 'string') {
      // Jika sudah dalam format YYYY-MM-DD, kembalikan langsung
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        return dateValue;
      }
      
      // Jika string dalam format lain, parse dulu ke Date
      const parsedDate = new Date(dateValue);
      if (isNaN(parsedDate.getTime())) {
        throw new Error("Invalid date string");
      }
      
      dateValue = parsedDate;
    }
    
    // Ekstrak tahun, bulan, hari tanpa terpengaruh timezone
    const year = dateValue.getFullYear();
    const month = (dateValue.getMonth() + 1).toString().padStart(2, '0');
    const day = dateValue.getDate().toString().padStart(2, '0');
    
    // Format ke YYYY-MM-DD
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error("Error in fixTimezone:", error);
    // Fallback ke hari ini jika ada error
    const today = new Date();
    return `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
  }
}