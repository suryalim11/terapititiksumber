/**
 * Helper teroptimasi tingkat lanjut untuk pengambilan data slot terapi
 * Dirancang khusus untuk mengatasi masalah timeout dengan pendekatan progresif
 */

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
): Promise<ProgressiveSlotData> {
  // Struktur data progresif yang akan diperbarui di setiap tahap
  const progressiveData: ProgressiveSlotData = {
    stage: 'basic',
    timestamp: new Date().toISOString()
  };
  
  try {
    // 1. TAHAP PERTAMA: Ambil data dasar slot terapi (paling cepat)
    const cacheBuster = Date.now();
    console.log(`🚀 Memulai loading progresif untuk slot ${slotId} - Tahap dasar`);
    
    const simpleSlotResponse = await fetchFn(
      `/api/simple-slot/${slotId}?_t=${cacheBuster}`,
      {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      },
      5000, // 5 detik timeout
      1     // 1 retry
    );
    
    if (!simpleSlotResponse.ok) {
      throw new Error(`Gagal mengambil data dasar: ${simpleSlotResponse.status}`);
    }
    
    const simpleSlotData = await simpleSlotResponse.json();
    
    if (!simpleSlotData.success) {
      throw new Error(simpleSlotData.message || "Error mengambil data dasar slot");
    }
    
    // Perbarui data progresif dengan data dasar
    progressiveData.slot = simpleSlotData.data;
    progressiveData.appointmentCount = simpleSlotData.data.patientCount || 0;
    progressiveData.stage = 'basic';
    progressiveData.timestamp = new Date().toISOString();
    
    // Panggil callback dengan data dasar
    onProgressCallback?.(progressiveData);
    
    // 2. TAHAP KEDUA: Ambil data pasien (bisa memakan waktu lebih lama)
    console.log(`👨‍👩‍👧‍👦 Loading progresif untuk slot ${slotId} - Tahap pasien`);
    
    try {
      const patientsResponse = await fetchFn(
        `/api/simple-slot/${slotId}/patients?_t=${cacheBuster}`,
        {
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        },
        10000, // 10 detik timeout
        2      // 2 retry
      );
      
      if (patientsResponse.ok) {
        const patientsData = await patientsResponse.json();
        
        if (patientsData.success) {
          // Hitung status pasien
          const statusCounts: Record<string, number> = {};
          
          (patientsData.data || []).forEach((appointment: any) => {
            const status = appointment.status || "Unknown";
            statusCounts[status] = (statusCounts[status] || 0) + 1;
          });
          
          // Perbarui data progresif dengan data lengkap
          progressiveData.appointments = patientsData.data || [];
          progressiveData.appointmentCount = patientsData.count || patientsData.data?.length || 0;
          progressiveData.statusCounts = statusCounts;
          progressiveData.stage = 'full';
          progressiveData.timestamp = new Date().toISOString();
          
          // Panggil callback dengan data lengkap
          onProgressCallback?.(progressiveData);
          
          return progressiveData;
        }
      }
    } catch (error) {
      console.error(`❌ Error pada tahap pasien: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Lanjutkan dengan data yang sudah ada meskipun ada error
    }
    
    // Kembalikan data terakhir yang berhasil didapat
    return progressiveData;
    
  } catch (error) {
    console.error(`❌ Error dalam fetchSlotProgressively: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}