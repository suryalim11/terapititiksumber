/**
 * Helper teroptimasi untuk pengambilan data slot terapi
 * Dirancang untuk mengatasi masalah timeout dan meningkatkan pengalaman pengguna
 */

/**
 * Mengambil data slot terapi secara bertahap
 * @param slotId ID dari slot terapi
 * @param fetchFn Fungsi fetch dengan timeout
 * @returns Promise dengan data slot dan pasien
 */
export async function fetchTherapySlotFast(
  slotId: number,
  fetchFn: (url: string, options?: RequestInit, timeout?: number, retries?: number) => Promise<Response>
): Promise<any> {
  if (!slotId) {
    throw new Error("ID slot terapi diperlukan");
  }
  
  console.log(`🔍 Mengambil data teroptimasi untuk slot ID ${slotId}`);
  
  try {
    const cacheBuster = Date.now();
    const url = `/api/simple-slot/${slotId}?_t=${cacheBuster}`;
    
    // Gunakan timeout lebih pendek untuk API yang cepat
    const fastResponse = await fetchFn(
      url,
      {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      },
      5000, // 5 detik timeout
      1     // hanya 1 retry
    );
    
    if (!fastResponse.ok) {
      throw new Error(`Gagal mengambil data cepat: ${fastResponse.status} ${fastResponse.statusText}`);
    }
    
    // Ambil data pasien juga
    const fastData = await fastResponse.json();
    
    if (!fastData.success) {
      throw new Error(fastData.message || "Terjadi kesalahan saat mengambil data slot");
    }
    
    // Ambil data pasien sebagai langkah kedua
    const patientsUrl = `/api/simple-slot/${slotId}/patients?_t=${cacheBuster}`;
    
    try {
      const patientsResponse = await fetchFn(
        patientsUrl,
        {
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        },
        8000, // 8 detik timeout untuk pasien
        2     // 2 retry untuk data pasien
      );
      
      if (patientsResponse.ok) {
        const patientsData = await patientsResponse.json();
        
        if (patientsData.success) {
          // Gabungkan data slot dan pasien
          return {
            success: true,
            slot: fastData.data,
            appointments: patientsData.data || [],
            patientCount: patientsData.count || 0,
            combined: true
          };
        }
      }
    } catch (error) {
      console.error(`❌ Error saat mengambil data pasien: ${error instanceof Error ? error.message : 'Unknown'}`);
      // Lanjutkan dengan data slot saja, tanpa data pasien
    }
    
    // Kembalikan data slot saja jika tidak bisa mendapatkan data pasien
    return {
      success: true,
      slot: fastData.data,
      appointments: [],
      patientCount: 0,
      combined: false
    };
    
  } catch (error) {
    console.error(`❌ Error saat mengambil data slot cepat: ${error instanceof Error ? error.message : 'Unknown'}`);
    throw error;
  }
}