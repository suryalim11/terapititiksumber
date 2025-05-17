/**
 * Helper untuk mengambil data slot terapi dengan progressive loading
 * Menggunakan tiga endpoint terpisah untuk performa yang lebih baik
 */

// Tipe data untuk hasil progressive loading
export interface ProgressiveSlotData {
  stage: 'basic' | 'stats' | 'full';
  slot?: any;                // Data dasar slot
  statusCounts?: any;        // Hitungan status
  appointmentCount?: number; // Jumlah appointment
  appointments?: any[];      // Data pasien (hanya pada full)
  timestamp: string;
}

/**
 * Mengambil data slot terapi dengan pendekatan bertahap (progressive)
 * @param slotId ID dari slot terapi
 * @param fetchFn Fungsi fetch dengan timeout
 * @param onProgressCallback Callback untuk setiap tahap yang selesai
 * @returns Promise yang mengembalikan data lengkap
 */
export async function fetchSlotProgressively(
  slotId: number,
  fetchFn: (url: string, options?: RequestInit, timeout?: number, retries?: number) => Promise<Response>,
  onProgressCallback?: (data: ProgressiveSlotData) => void
): Promise<any> {
  const cacheBuster = Date.now();
  let result: any = null;
  
  console.log(`💨 Memulai progressive loading untuk slot ${slotId}`);
  
  // TAHAP 1: Ambil data dasar slot terapi
  try {
    console.log(`🔍 TAHAP 1: Mengambil data dasar slot ID ${slotId}`);
    const basicResponse = await fetchFn(
      `/api/therapy-slots/${slotId}/basic?_t=${cacheBuster}`,
      {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      },
      5000,  // Timeout pendek: 5 detik
      1      // Retry: hanya sekali
    );
    
    if (basicResponse.ok) {
      const basicData = await basicResponse.json();
      console.log(`✓ TAHAP 1 BERHASIL: Data dasar slot diterima`);
      
      // Panggil callback dengan data dasar
      if (onProgressCallback && basicData.success) {
        onProgressCallback({
          stage: 'basic',
          slot: basicData.slot || basicData,
          timestamp: new Date().toISOString()
        });
      }
      
      // Simpan data untuk dikembalikan
      result = { 
        ...basicData,
        stage: 'basic',
        progressiveLoading: true
      };
    } else {
      throw new Error(`Gagal mengambil data dasar: ${basicResponse.status}`);
    }
  } catch (error) {
    console.error(`✗ TAHAP 1 GAGAL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    // Lanjut ke tahap 2 meskipun tahap 1 gagal
  }
  
  // TAHAP 2: Ambil statistik pasien
  try {
    console.log(`📊 TAHAP 2: Mengambil statistik slot ID ${slotId}`);
    const statsResponse = await fetchFn(
      `/api/therapy-slots/${slotId}/stats?_t=${cacheBuster}`,
      {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      },
      5000,  // Timeout pendek: 5 detik
      1      // Retry: hanya sekali
    );
    
    if (statsResponse.ok) {
      const statsData = await statsResponse.json();
      console.log(`✓ TAHAP 2 BERHASIL: Statistik diterima`);
      
      // Panggil callback dengan data dasar + statistik
      if (onProgressCallback && statsData.success && result) {
        onProgressCallback({
          stage: 'stats',
          slot: result.slot || result,
          statusCounts: statsData.statusCounts,
          appointmentCount: statsData.appointmentCount,
          timestamp: new Date().toISOString()
        });
      }
      
      // Gabungkan dengan hasil sebelumnya
      if (result) {
        result = {
          ...result,
          ...statsData,
          stage: 'stats',
          progressiveLoading: true
        };
      } else {
        result = {
          ...statsData,
          stage: 'stats',
          progressiveLoading: true
        };
      }
    } else {
      throw new Error(`Gagal mengambil statistik: ${statsResponse.status}`);
    }
  } catch (error) {
    console.error(`✗ TAHAP 2 GAGAL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    // Lanjut ke tahap 3 meskipun tahap 2 gagal
  }
  
  // TAHAP 3: Ambil data lengkap (minimal untuk performa lebih baik)
  try {
    console.log(`🔄 TAHAP 3: Mengambil data lengkap slot ID ${slotId}`);
    const fullResponse = await fetchFn(
      `/api/therapy-slots/${slotId}/patients?_t=${cacheBuster}&showAll=true&minimal=true`,
      {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      },
      10000,  // Timeout lebih lama: 10 detik
      2       // Retry: 2 kali
    );
    
    if (fullResponse.ok) {
      const fullData = await fullResponse.json();
      console.log(`✓ TAHAP 3 BERHASIL: Data lengkap diterima`);
      
      // Panggil callback dengan data lengkap
      if (onProgressCallback && fullData.success) {
        onProgressCallback({
          stage: 'full',
          slot: fullData.slot,
          appointments: fullData.appointments || [],
          statusCounts: fullData.statusCounts,
          appointmentCount: fullData.appointments?.length || 0,
          timestamp: new Date().toISOString()
        });
      }
      
      // Return data lengkap
      return {
        ...fullData,
        stage: 'full',
        progressiveLoading: true
      };
    } else {
      throw new Error(`Gagal mengambil data lengkap: ${fullResponse.status}`);
    }
  } catch (error) {
    console.error(`✗ TAHAP 3 GAGAL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    // Jika tahap 3 gagal, kembalikan data yang telah diperoleh pada tahap sebelumnya
    if (result) {
      console.log(`⚠️ Mengembalikan data parsial dari tahap ${result.stage}`);
      return result;
    }
    
    // Jika semua tahap gagal, lemparkan error
    throw error;
  }
}