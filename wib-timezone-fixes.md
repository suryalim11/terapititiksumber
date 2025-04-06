# Perbaikan Zona Waktu WIB

Berikut adalah perbaikan untuk masalah zona waktu WIB di aplikasi:

## 1. Fungsi getWIBDate()

```typescript
export function getWIBDate(date: Date): Date {
  // Metode yang konsisten untuk konversi ke WIB (UTC+7)
  const originalDate = new Date(date);
  
  // 1. Konversi ke UTC
  const utcMillis = originalDate.getTime() + (originalDate.getTimezoneOffset() * 60000);
  
  // 2. Tambahkan 7 jam untuk WIB (UTC+7)
  const WIB_OFFSET = 7; // dalam jam
  const wibDate = new Date(utcMillis + (WIB_OFFSET * 3600000));
  
  // Log konsisten untuk monitoring
  console.log(`Formatting date string: ${originalDate.toISOString()}`);
  console.log(`Original: ${originalDate.toISOString()} -> Corrected date (WIB): ${wibDate.toISOString()}`);
  
  return wibDate;
}
```

## 2. Fungsi formatDateString()

```typescript
function formatDateString(dateStr: string | Date): string {
  try {
    // Konversi input ke object Date, lalu gunakan getWIBDate untuk mendapat tanggal WIB yang konsisten
    const originalDate = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    
    // Gunakan fungsi getWIBDate yang sudah distandarisasi
    const wibDate = getWIBDate(originalDate);
    
    // Format tanggal menggunakan date-fns
    return format(wibDate, 'dd MMMM yyyy');
  } catch (error) {
    console.error("Error formatting date string:", error, dateStr);
    // Fallback untuk jaga-jaga jika terjadi error
    return typeof dateStr === 'string' ? dateStr : dateStr.toISOString().split('T')[0];
  }
}
```

## 3. Fungsi getTherapySlotsByDate()

```typescript
async getTherapySlotsByDate(date: Date | string): Promise<TherapySlot[]> {
  // Menggunakan fungsi getWIBDate untuk mendapatkan tanggal dalam zona waktu WIB secara konsisten
  let dateString: string;
  
  try {
    // Konversi input ke Date object terlebih dahulu
    let dateObj: Date;
    
    if (date instanceof Date) {
      dateObj = date;
      console.log("Input date untuk getTherapySlotsByDate: Date object -", dateObj.toISOString());
    } else {
      // Parse string menjadi Date
      dateObj = new Date(date);
      
      if (isNaN(dateObj.getTime())) {
        // Jika parsing gagal, gunakan tanggal hari ini
        console.error("Invalid date string, using today's date:", date);
        dateObj = new Date();
      }
      console.log("Input date untuk getTherapySlotsByDate: String -", date, "-> Date object:", dateObj.toISOString());
    }
    
    // Konversi ke WIB menggunakan fungsi helper yang konsisten
    const wibDate = getWIBDate(dateObj);
    
    // Format tanggal ke format YYYY-MM-DD untuk pencarian di database
    const year = wibDate.getFullYear();
    const month = String(wibDate.getMonth() + 1).padStart(2, '0');
    const day = String(wibDate.getDate()).padStart(2, '0');
    dateString = `${year}-${month}-${day}`;
    
    console.log(`Tanggal WIB yang digunakan: ${dateString}`);
  } catch (error) {
    // Jika terjadi error, gunakan tanggal hari ini
    console.error("Error processing date, using today's date:", error);
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    dateString = `${year}-${month}-${day}`;
  }
  
  console.log("Mencari slot terapi dengan date text:", dateString);
  
  // Gunakan fungsi query di Drizzle ORM untuk filter berdasarkan string date 
  // karena kita mengubah kolom date dari timestamp menjadi text
  const slots = await db.query.therapySlots.findMany({
    where: and(
      eq(schema.therapySlots.date, dateString),
      eq(schema.therapySlots.isActive, true)
    ),
    orderBy: [asc(schema.therapySlots.timeSlot)]
  });
  
  // Kode selanjutnya tetap sama...
}
```

## Rekomendasi untuk Sinkronisasi

1. Identifikasi file `database-storage.ts` di aplikasi yang sudah di-deploy
2. Backup file tersebut sebelum melakukan perubahan
3. Ganti fungsi-fungsi yang disebutkan di atas dengan versi yang sudah diperbaiki
4. Restart server aplikasi yang sudah di-deploy
5. Periksa tanggal dan slot terapi apakah sudah ditampilkan dengan benar

## Catatan Tambahan

- Perbaikan ini khusus menangani masalah konversi zona waktu WIB (UTC+7)
- Implementasi ini menggunakan pendekatan yang lebih konsisten dengan menghindari manipulasi waktu yang berbeda-beda di tempat yang berbeda
- Log debug dibuat lebih jelas untuk memudahkan troubleshooting di masa depan