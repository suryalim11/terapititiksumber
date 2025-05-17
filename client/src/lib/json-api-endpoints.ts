/**
 * Utilitas untuk mengakses endpoint API JSON khusus
 * Frontend akan menggunakan endpoint yang mengembalikan JSON murni
 */
import { apiRequest } from './queryClient';

// URL dasar untuk endpoint JSON
// Anda dapat mengubah ini ke path yang berbeda sesuai kebutuhan
const JSON_BASE_URL = '/api/json';

/**
 * Fungsi untuk mendapatkan data dasar slot terapi
 * 
 * @param slotId ID slot terapi
 * @returns Data dasar slot terapi
 */
export async function fetchSlotBasic(slotId: number) {
  // Gunakan fetch langsung untuk menghindari transformasi data
  const response = await fetch(`${JSON_BASE_URL}/slot/${slotId}/basic`);
  
  // Jika respons bukan 2xx, lemparkan error
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gagal mengambil data dasar slot: ${errorText}`);
  }
  
  // Parsing response sebagai JSON
  return await response.json();
}

/**
 * Fungsi untuk mendapatkan data appointment slot terapi
 * 
 * @param slotId ID slot terapi
 * @returns Data appointment slot terapi
 */
export async function fetchSlotAppointments(slotId: number) {
  // Gunakan fetch langsung untuk menghindari transformasi data
  const response = await fetch(`${JSON_BASE_URL}/slot/${slotId}/appointments`);
  
  // Jika respons bukan 2xx, lemparkan error
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gagal mengambil data appointment slot: ${errorText}`);
  }
  
  // Parsing response sebagai JSON
  return await response.json();
}

/**
 * Fungsi untuk mendapatkan data pasien slot terapi
 * 
 * @param slotId ID slot terapi
 * @returns Data pasien slot terapi
 */
export async function fetchSlotPatients(slotId: number) {
  // Gunakan fetch langsung untuk menghindari transformasi data
  const response = await fetch(`${JSON_BASE_URL}/slot/${slotId}/patients`);
  
  // Jika respons bukan 2xx, lemparkan error
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gagal mengambil data pasien slot: ${errorText}`);
  }
  
  // Parsing response sebagai JSON
  return await response.json();
}

/**
 * Versi fetch dengan timeout khusus untuk endpoint JSON
 * 
 * @param url URL yang akan di-fetch
 * @param options Opsi fetch
 * @param timeoutMs Timeout dalam milidetik
 * @returns Hasil fetch
 */
export async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10000) {
  // Buat controller untuk timeout
  const controller = new AbortController();
  const { signal } = controller;
  
  // Setup timeout
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  
  try {
    // Lakukan fetch dengan signal
    const response = await fetch(url, {
      ...options,
      signal,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    
    // Bersihkan timeout
    clearTimeout(timeout);
    
    return response;
  } catch (error) {
    // Bersihkan timeout
    clearTimeout(timeout);
    
    // Lemparkan error yang benar
    if ((error as Error).name === 'AbortError') {
      throw new Error(`Request timeout setelah ${timeoutMs}ms`);
    }
    
    throw error;
  }
}