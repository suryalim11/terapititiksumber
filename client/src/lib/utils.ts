import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines multiple class names into a single string using clsx and tailwind-merge.
 * This utility is used to efficiently merge Tailwind CSS classes.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a price value as Indonesian Rupiah currency
 */
export function formatRupiah(price: string | number): string {
  const numericPrice = typeof price === 'string' ? parseFloat(price) : price;
  return `Rp${numericPrice.toLocaleString('id-ID')}`;
}

/**
 * Calculate age from a birthday date string
 */
export function calculateAge(birthDateString: string): number {
  try {
    const birthDate = new Date(birthDateString);
    const today = new Date();
    
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  } catch (error) {
    console.error("Error calculating age:", error);
    return 0;
  }
}

/**
 * Generate patient ID based on pattern P-YYYY-XXX (year-sequence)
 */
export function generatePatientId(id: number): string {
  const year = new Date().getFullYear();
  const sequenceNumber = String(id).padStart(3, '0');
  return `P-${year}-${sequenceNumber}`;
}

/**
 * Generate transaction ID based on pattern T-YYYYMMDD-XXX (date-sequence)
 */
export function generateTransactionId(id: number): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const sequenceNumber = String(id).padStart(3, '0');
  
  return `T-${year}${month}${day}-${sequenceNumber}`;
}

/**
 * Get formatted payment method name
 */
export function getPaymentMethodName(method: string): string {
  switch (method) {
    case "bank_transfer": return "Transfer Bank";
    case "qris": return "QRIS";
    case "cash": return "Tunai";
    default: return method;
  }
}

/**
 * Get initial letters from a name (up to 2 characters)
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

/**
 * Validate if a string is a valid date
 */
export function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * Create time slots for scheduling (e.g., 08:00, 08:30, etc.)
 */
export function generateTimeSlots(startHour: number = 8, endHour: number = 17, interval: number = 30): string[] {
  const slots: string[] = [];
  for (let hour = startHour; hour <= endHour; hour++) {
    for (let minute = 0; minute < 60; minute += interval) {
      if (hour === endHour && minute > 0) continue; // Don't go past end hour
      
      const formattedHour = hour.toString().padStart(2, "0");
      const formattedMinute = minute.toString().padStart(2, "0");
      slots.push(`${formattedHour}:${formattedMinute}`);
    }
  }
  return slots;
}
