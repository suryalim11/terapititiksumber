/**
 * Helper untuk mengambil data slot terapi secara bertahap
 * dengan pendekatan loading progresif
 */

// Struktur data slot terapi progresif
export interface ProgressiveSlotData {
  // Informasi dasar
  id: number;
  date: string;
  timeSlot: string;
  maxQuota: number;
  currentCount: number;
  isActive: boolean;
  
  // Data pasien dan appointment (diisi kemudian)
  patients: any[];
  appointments: any[];
  
  // Status loading
  stage: 'basic' | 'full';
  patientsLoaded: boolean;
  appointmentsLoaded: boolean;
  
  // Detail progress
  timeElapsed?: number;
  requestStartTime?: number;
}

// Tipe fungsi fetch
type FetchFunction = (url: string, options?: any) => Promise<Response>;

/**
 * Mengambil data slot terapi secara bertahap
 * @param slotId ID slot terapi
 * @param fetchFn Fungsi fetch
 * @param onProgress Callback untuk update progress
 * @returns Promise dengan data slot terapi
 */
export async function fetchSlotProgressively(
  slotId: number,
  fetchFn: FetchFunction,
  onProgress: (data: ProgressiveSlotData) => void
): Promise<ProgressiveSlotData> {
  const startTime = Date.now();
  
  // Struktur awal data progresif
  let progressiveData: ProgressiveSlotData = {
    id: slotId,
    date: '',
    timeSlot: '',
    maxQuota: 0,
    currentCount: 0,
    isActive: true,
    patients: [],
    appointments: [],
    stage: 'basic',
    patientsLoaded: false,
    appointmentsLoaded: false,
    requestStartTime: startTime,
  };
  
  try {
    // Step 1: Fetch data dasar slot terapi (cepat)
    console.log(`🚀 Request untuk basic slot ${slotId} info`);
    
    // Caching untuk mengoptimalkan performa
    const cacheKey = `therapy_slot_basic_${slotId}_${Date.now()}`;
    let cachedData = sessionStorage.getItem(cacheKey);
    
    let basicSlotData;
    if (cachedData) {
      console.log(`✅ Cache hit untuk ${cacheKey}, menggunakan data cache`);
      basicSlotData = JSON.parse(cachedData);
    } else {
      console.log(`❌ Cache miss untuk ${cacheKey}, mengambil data baru...`);
      console.log(`🔍 Mengambil data dasar therapy slot ID: ${slotId}`);
      
      const basicResponse = await fetchFn(`/api/simple-slot/${slotId}/basic`, {
        timeout: 5000, // Timeout pendek karena harusnya cepat
      });
      
      if (!basicResponse.ok) {
        throw new Error(`Error mengambil data dasar slot: ${basicResponse.status}`);
      }
      
      basicSlotData = await basicResponse.json();
      
      // Simpan ke cache untuk penggunaan selanjutnya
      sessionStorage.setItem(cacheKey, JSON.stringify(basicSlotData));
    }
    
    // Update data progresif dengan info dasar
    progressiveData = {
      ...progressiveData,
      ...basicSlotData,
      stage: 'basic',
      timeElapsed: Date.now() - startTime,
    };
    
    // Panggil callback progress dengan data dasar
    onProgress(progressiveData);
    
    // Step 2: Fetch data appointment (opsional, bisa saja gagal)
    try {
      console.log(`📅 Mengambil appointments untuk slot ${slotId}`);
      const appointmentsResponse = await fetchFn(`/api/simple-slot/${slotId}/appointments`, {
        timeout: 8000,
      });
      
      if (appointmentsResponse.ok) {
        const appointmentsData = await appointmentsResponse.json();
        progressiveData = {
          ...progressiveData,
          appointments: appointmentsData,
          appointmentsLoaded: true,
          timeElapsed: Date.now() - startTime,
        };
        
        // Update progress
        onProgress(progressiveData);
      }
    } catch (error) {
      console.warn("Gagal mengambil data appointments:", error);
      // Tidak menggagalkan seluruh proses
    }
    
    // Step 3: Fetch data pasien (bisa menjadi lambat)
    try {
      console.log(`👥 Mengambil data pasien untuk slot ${slotId}`);
      const patientsResponse = await fetchFn(`/api/simple-slot/${slotId}/patients`, {
        timeout: 15000, // Timeout lebih lama
      });
      
      if (patientsResponse.ok) {
        const patientsData = await patientsResponse.json();
        progressiveData = {
          ...progressiveData,
          patients: patientsData,
          patientsLoaded: true,
          stage: 'full',
          timeElapsed: Date.now() - startTime,
        };
        
        // Final update
        onProgress(progressiveData);
      }
    } catch (error) {
      console.warn("Gagal mengambil data pasien:", error);
      // Tidak menggagalkan seluruh proses
    }
    
    // Mengembalikan data apapun yang kita dapatkan
    return progressiveData;
    
  } catch (error) {
    console.error("Error dalam fetchSlotProgressively:", error);
    throw error;
  }
}