/**
 * Fungsi fetch dengan batas waktu dan mekanisme coba lagi
 */

// Opsi untuk fetch timeout
interface FetchWithTimeoutOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Fungsi fetch dengan batas waktu
 * @param url URL untuk di-fetch
 * @param options Opsi fetch, termasuk timeout dalam milidetik
 * @returns Promise Response
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { 
    timeout = 15000, // Default timeout 15 detik
    retries = 3,     // Default coba lagi 3 kali
    retryDelay = 1000, // Default jeda 1 detik
    onRetry,
    ...fetchOptions 
  } = options;

  // Implementasi timeout dengan AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  // Tambahkan signal ke fetch options
  const fetchOptionsWithSignal = {
    ...fetchOptions,
    signal: controller.signal
  };

  // Fungsi untuk melakukan fetch dengan retry
  async function performFetchWithRetry(attempt: number = 0): Promise<Response> {
    try {
      const response = await fetch(url, fetchOptionsWithSignal);
      
      // Bersihkan timeout bila berhasil
      clearTimeout(timeoutId);
      
      // Jika respons bukan 2xx, anggap sebagai error untuk retry
      if (!response.ok && attempt < retries) {
        const error = new Error(`HTTP error! Status: ${response.status}`);
        return handleRetry(attempt, error);
      }
      
      return response;
    } catch (error: any) {
      // Bersihkan timeout untuk menghindari memory leak
      clearTimeout(timeoutId);
      
      // Jika sudah mencapai batas retry atau bukan error timeout, lempar error
      if (attempt >= retries || (error.name !== 'AbortError' && error.name !== 'TimeoutError')) {
        throw error;
      }
      
      // Untuk error timeout atau koneksi, coba lagi
      return handleRetry(attempt, error);
    }
  }

  // Handler untuk retry
  async function handleRetry(attempt: number, error: Error): Promise<Response> {
    const nextAttempt = attempt + 1;
    
    // Panggil callback onRetry bila ada
    if (onRetry) {
      onRetry(nextAttempt, error);
    }
    
    // Tunggu sebelum coba lagi, dengan exponential backoff
    const delay = retryDelay * Math.pow(1.5, attempt);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Coba lagi dengan controller baru
    const newController = new AbortController();
    const newTimeoutId = setTimeout(() => newController.abort(), timeout);
    
    try {
      return await performFetchWithRetry(nextAttempt);
    } finally {
      clearTimeout(newTimeoutId);
    }
  }

  // Mulai fetch dengan retry
  return performFetchWithRetry();
}

/**
 * Fungsi fetch yang mendukung cache
 * @param url URL untuk di-fetch
 * @param options Opsi fetch, termasuk timeout
 * @param cacheKey Kunci cache
 * @param cacheDuration Durasi cache dalam milidetik
 * @returns 
 */
export async function fetchWithCache(
  url: string,
  options: FetchWithTimeoutOptions = {},
  cacheKey?: string,
  cacheDuration: number = 60000 // Default 1 menit
): Promise<Response> {
  // Gunakan URL sebagai cache key bila tidak diberikan
  const key = cacheKey || `cache_${url}_${Date.now()}`;
  
  // Cek apakah ada data di cache dan masih fresh
  const cachedData = localStorage.getItem(key);
  if (cachedData) {
    try {
      const { data, timestamp, headers } = JSON.parse(cachedData);
      const age = Date.now() - timestamp;
      
      // Jika cache masih fresh, gunakan
      if (age < cacheDuration) {
        console.log(`✅ Cache hit untuk ${key}, umur ${age}ms`);
        
        // Buat response dari cache
        const cachedResponse = new Response(JSON.stringify(data), {
          status: 200,
          headers: new Headers(headers)
        });
        
        // Set properti khusus untuk menandai dari cache
        Object.defineProperty(cachedResponse, 'fromCache', {
          value: true,
          writable: false
        });
        
        return cachedResponse;
      }
      
      console.log(`❌ Cache miss untuk ${key}, cache terlalu tua (${age}ms > ${cacheDuration}ms)`);
    } catch (error) {
      console.error('Error parsing cache:', error);
      localStorage.removeItem(key);
    }
  } else {
    console.log(`❌ Cache miss untuk ${key}, mengambil data baru...`);
  }
  
  // Jika tidak ada cache atau cache terlalu tua, fetch data baru
  const response = await fetchWithTimeout(url, options);
  
  // Simpan ke cache jika sukses
  if (response.ok) {
    try {
      // Clone response karena response.json() akan mengkonsumsi body stream
      const clone = response.clone();
      const data = await clone.json();
      
      // Ekstrak header untuk disimpan
      const headers: Record<string, string> = {};
      clone.headers.forEach((value, key) => {
        headers[key] = value;
      });
      
      // Simpan di cache
      localStorage.setItem(key, JSON.stringify({
        data,
        timestamp: Date.now(),
        headers
      }));
    } catch (error) {
      console.error('Error caching response:', error);
    }
  }
  
  return response;
}

/**
 * Membersihkan semua cache
 */
export function clearAllCache(): void {
  const keysToRemove: string[] = [];
  
  // Identifikasi semua kunci cache
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('cache_')) {
      keysToRemove.push(key);
    }
  }
  
  // Hapus kunci-kunci cache
  keysToRemove.forEach(key => localStorage.removeItem(key));
  
  console.log(`Berhasil menghapus ${keysToRemove.length} item cache`);
}

/**
 * Membersihkan cache untuk URL tertentu
 * @param urlPattern Pola URL untuk dihapus cachenya
 */
export function clearCacheForUrl(urlPattern: string): void {
  const keysToRemove: string[] = [];
  
  // Identifikasi kunci cache yang cocok dengan pola
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('cache_') && key.includes(urlPattern)) {
      keysToRemove.push(key);
    }
  }
  
  // Hapus kunci-kunci cache
  keysToRemove.forEach(key => localStorage.removeItem(key));
  
  console.log(`Berhasil menghapus ${keysToRemove.length} item cache untuk ${urlPattern}`);
}