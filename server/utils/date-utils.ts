/**
 * Utilitas untuk menangani tanggal dan waktu dalam aplikasi
 * Terutama untuk konversi ke zona waktu WIB (GMT+7)
 */

/**
 * Mengkonversi tanggal ke zona waktu WIB (GMT+7)
 * @param date Tanggal yang akan dikonversi
 * @returns Tanggal dalam zona waktu WIB
 */
export function getWIBDate(date: Date): Date {
  // Timezone WIB = GMT+7
  const WIB_OFFSET = 7 * 60 * 60 * 1000; // 7 jam dalam milidetik
  
  // UTC timestamp
  const utcTimestamp = date.getTime() + (date.getTimezoneOffset() * 60 * 1000);
  
  // WIB timestamp
  const wibTimestamp = utcTimestamp + WIB_OFFSET;
  
  return new Date(wibTimestamp);
}

/**
 * Format tanggal menjadi string dengan format YYYY-MM-DD
 * @param dateStr Tanggal dalam bentuk string atau objek Date
 * @returns String tanggal dalam format YYYY-MM-DD
 */
export function formatDateString(dateStr: string | Date): string {
  let dateObj: Date;
  
  if (typeof dateStr === 'string') {
    // Jika input adalah string, parse menjadi Date
    dateObj = new Date(dateStr);
  } else {
    // Jika input adalah Date, gunakan langsung
    dateObj = dateStr;
  }
  
  // Pastikan tanggal valid
  if (isNaN(dateObj.getTime())) {
    throw new Error("Invalid date");
  }
  
  // Format tanggal menjadi YYYY-MM-DD
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Mengkonversi string tanggal ke objek Date dan menambahkan waktu default (12:00)
 * @param dateStr String tanggal dalam format YYYY-MM-DD
 * @returns Objek Date dengan waktu default
 */
export function stringToDate(dateStr: string): Date {
  if (!dateStr) {
    throw new Error("Date string is required");
  }
  
  // Format default untuk waktu adalah tengah hari (12:00)
  return new Date(`${dateStr}T12:00:00`);
}

/**
 * Memeriksa apakah tanggal 1 sama dengan tanggal 2 (hanya tanggal, mengabaikan waktu)
 * @param date1 Tanggal pertama
 * @param date2 Tanggal kedua
 * @returns True jika tanggal sama, false jika berbeda
 */
export function isSameDate(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Mendapatkan tanggal hari ini dalam format YYYY-MM-DD
 * @returns String tanggal hari ini
 */
export function getTodayDateString(): string {
  return formatDateString(new Date());
}

/**
 * Format rupiah untuk angka
 * @param amount Jumlah dalam angka
 * @returns String dalam format Rupiah
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', { 
    style: 'currency', 
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}