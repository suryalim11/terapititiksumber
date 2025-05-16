/**
 * Utilitas untuk manipulasi tanggal dan waktu
 */

/**
 * Mengkonversi tanggal ke zona waktu WIB (Waktu Indonesia Barat)
 * @param date Objek tanggal
 * @returns Objek tanggal dalam zona waktu WIB
 */
export function getWIBDate(date: Date): Date {
  // Offset Jakarta/WIB adalah GMT+7
  const wibOffset = 7 * 60; // dalam menit
  const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
  return new Date(utcDate.getTime() + wibOffset * 60000);
}

/**
 * Format tanggal menjadi string dalam format YYYY-MM-DD
 * @param dateStr Tanggal dalam berbagai format
 * @returns String tanggal terformat
 */
export function formatDateString(dateStr: string | Date): string {
  let dateObj: Date;
  
  if (dateStr instanceof Date) {
    dateObj = dateStr;
  } else {
    // Coba parse string tanggal
    dateObj = new Date(dateStr);
  }
  
  if (isNaN(dateObj.getTime())) {
    throw new Error(`Format tanggal tidak valid: ${dateStr}`);
  }
  
  // Format menjadi YYYY-MM-DD
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0'); 
  const day = String(dateObj.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Format tanggal menjadi string dalam format WIB (Indonesia)
 * @param date Objek tanggal
 * @returns String tanggal terformat dalam bahasa Indonesia
 */
export function formatWIBDateString(date: Date): string {
  const wibDate = getWIBDate(date);
  
  return wibDate.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * Mendapatkan tanggal hari ini dalam format YYYY-MM-DD
 * @returns String tanggal hari ini
 */
export function getTodayDateString(): string {
  return formatDateString(new Date());
}

/**
 * Membandingkan apakah dua tanggal adalah hari yang sama (tanpa memperhatikan waktu)
 * @param date1 Tanggal pertama
 * @param date2 Tanggal kedua
 * @returns true jika sama, false jika berbeda
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Menambahkan sejumlah hari ke tanggal
 * @param date Tanggal awal
 * @param days Jumlah hari yang ditambahkan
 * @returns Tanggal baru
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Mengkonversi string waktu (HH:MM) menjadi objek Date
 * @param dateStr Tanggal dalam format YYYY-MM-DD
 * @param timeStr Waktu dalam format HH:MM
 * @returns Objek Date
 */
export function timeStringToDate(dateStr: string, timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date(dateStr);
  
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/**
 * Mengekstrak jam awal dari string slot waktu (contoh: "10:00-12:00" menjadi "10:00")
 * @param timeSlot String slot waktu (format: "HH:MM-HH:MM")
 * @returns String jam awal
 */
export function extractStartTime(timeSlot: string): string {
  if (!timeSlot || !timeSlot.includes('-')) {
    return '';
  }
  return timeSlot.split('-')[0].trim();
}

/**
 * Mengekstrak jam akhir dari string slot waktu (contoh: "10:00-12:00" menjadi "12:00")
 * @param timeSlot String slot waktu (format: "HH:MM-HH:MM")
 * @returns String jam akhir
 */
export function extractEndTime(timeSlot: string): string {
  if (!timeSlot || !timeSlot.includes('-')) {
    return '';
  }
  return timeSlot.split('-')[1].trim();
}