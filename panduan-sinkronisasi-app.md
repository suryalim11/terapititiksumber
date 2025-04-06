# Panduan Sinkronisasi Aplikasi Terapi Titik Sumber

## 1. Perubahan Fungsi getWIBDate()

Fungsi `getWIBDate()` telah diperbaiki untuk menangani konversi timezone UTC ke WIB (GMT+7) dengan lebih konsisten:

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

## 2. Perubahan Fungsi formatDateString()

Fungsi `formatDateString()` telah diperbaiki untuk menggunakan `getWIBDate()` secara konsisten:

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

## 3. Perubahan Fungsi getTherapySlotsByDate()

Fungsi `getTherapySlotsByDate()` telah diperbaiki untuk menangani tanggal dengan benar menggunakan WIB timezone:

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

  // Kode lainnya tetap sama...
}
```

## Langkah-langkah Sinkronisasi

Untuk mengaplikasikan perubahan di atas ke aplikasi yang sudah di-deploy, ikuti langkah-langkah berikut:

1. **Download File Backup**
   - Download file `wib-timezone-fixes.ts` dari aplikasi lokal
   - Download file `database-storage-backup.ts` dari aplikasi lokal sebagai referensi

2. **Backup File Sebelum Perubahan di Aplikasi Deployed**
   - Di aplikasi yang sudah di-deploy, backup file `server/database-storage.ts` terlebih dahulu
   - Misalnya dengan menyalin ke `server/database-storage.ts.bak`

3. **Update File di Aplikasi Deployed**
   - Cari dan ganti fungsi-fungsi berikut di `server/database-storage.ts` di aplikasi yang sudah di-deploy:
     - `getWIBDate()`
     - `formatDateString()`
     - `getTherapySlotsByDate()`
   - Ganti dengan implementasi yang ada di file `wib-timezone-fixes.ts`

4. **Restart Server Aplikasi Deployed**
   - Setelah semua perubahan disimpan, restart server aplikasi yang sudah di-deploy

5. **Verifikasi Perbaikan**
   - Login ke aplikasi yang sudah di-deploy
   - Periksa tampilan tanggal di berbagai fitur (dashboard, jadwal terapi, appointment)
   - Pastikan tanggal di slot terapi dan appointment tampil dengan benar dalam zona waktu WIB

## Perhatian

- Selalu backup file sebelum melakukan perubahan
- Periksa secara teliti log server setelah melakukan perubahan
- Perubahan ini fokus pada perbaikan penanganan timezone WIB (GMT+7)
- Jika ada error, segera kembalikan ke file backup yang telah dibuat sebelumnya