/**
 * Implementasi fungsi fetch dengan timeout, retry, dan deteksi jaringan
 * Dirancang untuk mengatasi masalah timeout pada jaringan lambat
 */

// Kontrol timeout default (dalam milidetik)
const DEFAULT_TIMEOUT = 15000; // 15 detik
const DEFAULT_RETRIES = 1;

// Error khusus untuk timeout
export class FetchTimeoutError extends Error {
  constructor(message = 'Request timeout') {
    super(message);
    this.name = 'FetchTimeoutError';
  }
}

/**
 * Cek apakah browser online
 * @returns true jika browser terdeteksi online
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine;
}

/**
 * Fungsi fetch dengan timeout dan retry
 * @param url URL untuk fetch
 * @param options Opsi fetch standard
 * @param timeout Timeout dalam milidetik
 * @param retries Jumlah percobaan ulang
 * @returns Promise dengan response
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = DEFAULT_TIMEOUT,
  retries: number = DEFAULT_RETRIES
): Promise<Response> {
  // Verifikasi apakah jaringan tersedia
  if (!isOnline()) {
    throw new Error('Tidak ada koneksi internet');
  }
  
  let lastError: Error | null = null;
  
  // Coba beberapa kali sesuai nilai retries
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Buat controller abort untuk timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      try {
        // Tambahkan signal ke opsi fetch
        const fetchOptions = {
          ...options,
          signal: controller.signal
        };
        
        // Log attempt jika bukan pertama kali
        if (attempt > 0) {
          console.log(`🔄 Mencoba kembali (${attempt}/${retries}) untuk ${url}`);
        }
        
        // Lakukan fetch
        const response = await fetch(url, fetchOptions);
        
        // Jika berhasil, clear timeout dan kembalikan response
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        // Clear timeout untuk mencegah memory leak
        clearTimeout(timeoutId);
        
        // Periksa jenis error
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new FetchTimeoutError(`Request timeout setelah ${timeout}ms`);
        }
        
        // Rethrow error lainnya
        throw error;
      }
    } catch (error) {
      // Simpan error terakhir
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Jika masih ada percobaan tersisa dan bukan error fatal, coba lagi
      if (attempt < retries) {
        // Tunggu sebentar sebelum mencoba lagi (dengan backoff eksponensial)
        const backoffTime = Math.min(1000 * Math.pow(2, attempt), 8000);
        console.log(`⏱️ Menunggu ${backoffTime}ms sebelum percobaan berikutnya...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        
        // Lanjutkan ke percobaan berikutnya
        continue;
      }
      
      // Jika sudah tidak ada percobaan tersisa, lempar error terakhir
      throw lastError;
    }
  }
  
  // Jika kode sampai di sini (seharusnya tidak), throw error generic
  throw new Error('Terjadi kesalahan yang tidak diketahui saat fetch');
}