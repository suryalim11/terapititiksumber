import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format as dateFnsFormat } from "date-fns";
import { id } from "date-fns/locale";

/**
 * Combines multiple class names into a single string using clsx and tailwind-merge.
 * This utility is used to efficiently merge Tailwind CSS classes.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Get a date adjusted to WIB (GMT+7) timezone
 */
export function getWIBDate(dateInput: Date | string): Date {
  try {
    // Konversi input menjadi objek Date
    const date = typeof dateInput === 'string' ? new Date(dateInput) : new Date(dateInput);
    
    // Tambahkan 7 jam ke UTC untuk mendapatkan waktu WIB
    const jakartaOffset = 7 * 60 * 60 * 1000; // 7 jam dalam milidetik
    
    // Jika objek date sudah dalam timezone lokal, kita perlu:
    // 1. Mengubahnya ke UTC
    // 2. Menambahkan offset Jakarta
    const utcTime = date.getTime() + (date.getTimezoneOffset() * 60 * 1000);
    const jakartaTime = new Date(utcTime + jakartaOffset);
    
    return jakartaTime;
  } catch (error) {
    console.error('Error converting to WIB date:', error);
    return new Date();
  }
}

/**
 * Format a date string to dd/MM/yyyy format with WIB timezone
 */
export function formatDateDDMMYYYY(dateString: string | Date): string {
  try {
    // Konversi ke objek Date dan pastikan menggunakan WIB timezone
    const date = typeof dateString === 'string' ? getWIBDate(dateString) : getWIBDate(dateString);
    return dateFnsFormat(date, "dd/MM/yyyy", { locale: id }) + " WIB";
  } catch (e) {
    console.error('Error formatting date:', e);
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
 */
export function formatDate(date: Date | string): string {
  try {
    // Konversi ke WIB date terlebih dahulu
    const wibDate = getWIBDate(date);
    return dateFnsFormat(wibDate, "dd/MM/yyyy HH:mm", { locale: id }) + " WIB";
  } catch (error) {
    console.error('Error formatting date with time:', error);
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