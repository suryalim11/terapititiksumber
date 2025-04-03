import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format as dateFnsFormat, parseISO, addHours } from "date-fns";
import { id } from "date-fns/locale";

/**
 * Combines multiple class names into a single string using clsx and tailwind-merge.
 * This utility is used to efficiently merge Tailwind CSS classes.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a date string to dd/MM/yyyy format with WIB timezone
 */
export function formatDateDDMMYYYY(dateString: string | Date): string {
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return dateFnsFormat(date, "dd/MM/yyyy", { locale: id }) + " WIB";
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
 */
export function formatDate(date: Date): string {
  return dateFnsFormat(date, "dd/MM/yyyy HH:mm", { locale: id }) + " WIB";
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
    
    // Pengaturan penyesuaian waktu berdasarkan sumber data
    if (activityType === "transaction") {
      // Transaksi dari server memerlukan penyesuaian -7 jam
      adjustedDate = addHours(date, -7);
    } else if (!isLocalTime) {
      // Recent activities dari server memerlukan penyesuaian -14 jam
      adjustedDate = addHours(date, -14);
    } else {
      // Gunakan waktu apa adanya jika sudah dalam format lokal
      adjustedDate = date;
    }
    
    // Format tanggal dan waktu dengan konsisten
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(adjustedDate) + " WIB";
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