/**
 * Fungsi fetch dengan timeout dan retry logic terintegrasi
 * Dirancang khusus untuk menangani permintaan yang lambat dengan lebih baik
 */

// Opsi default untuk fetch
const DEFAULT_TIMEOUT = 15000; // 15 detik
const DEFAULT_RETRY_COUNT = 2;
const DEFAULT_RETRY_DELAY = 500; // 500ms

// Opsi yang tersedia untuk fetchWithTimeout
interface FetchWithTimeoutOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  credentials?: RequestCredentials;
  headers?: HeadersInit;
  method?: string;
  body?: any;
}

/**
 * Fungsi fetch dengan timeout dan retry logic
 * @param url URL untuk melakukan fetch
 * @param options Opsi untuk fetch (timeout, retries, headers, dll)
 * @returns Promise dengan response
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const {
    timeout = DEFAULT_TIMEOUT,
    retries = DEFAULT_RETRY_COUNT,
    retryDelay = DEFAULT_RETRY_DELAY,
    ...fetchOptions
  } = options;

  // Jika body adalah object, otomatis stringify dan set header
  let updatedOptions = { ...fetchOptions };
  if (fetchOptions.body && typeof fetchOptions.body === 'object') {
    updatedOptions = {
      ...fetchOptions,
      body: JSON.stringify(fetchOptions.body),
      headers: {
        ...fetchOptions.headers,
        'Content-Type': 'application/json',
      },
    };
  }

  // Menambahkan credentials ke fetch options jika tidak diberikan
  if (!updatedOptions.credentials) {
    updatedOptions.credentials = 'include';
  }

  // Fungsi untuk menjalankan fetch dengan abort controller
  async function executeFetch(): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...updatedOptions,
        signal: controller.signal,
      });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  }

  // Implementasi retry logic
  let lastError: any;
  for (let i = 0; i <= retries; i++) {
    try {
      // Pada percobaan ulang, kita log pesan untuk debugging
      if (i > 0) {
        console.log(`Mencoba ulang request ke ${url} (percobaan ke-${i})`);
      }

      // Eksekusi fetch
      const response = await executeFetch();

      // Jika tidak ok, throw sebuah error
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Jika berhasil, return response
      return response;
    } catch (error: any) {
      lastError = error;

      // Jika ini bukan kasus timeout atau abort, jangan coba ulang
      if (error.name !== 'AbortError' && error.name !== 'TypeError') {
        break;
      }

      // Jika masih ada retry yang tersisa, tunggu sebelum mencoba lagi
      if (i < retries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  // Jika semua percobaan gagal, throw error terakhir
  throw lastError || new Error('Request gagal tanpa alasan yang diketahui');
}

/**
 * Fungsi helper untuk melakukan fetch dan langsung mengkonversi hasil ke JSON
 */
export async function fetchWithTimeoutJSON<T = any>(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<T> {
  const response = await fetchWithTimeout(url, options);
  return response.json();
}