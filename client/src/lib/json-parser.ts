/**
 * Fungsi ini mengekstrak JSON dari respons HTML jika diperlukan
 * atau langsung memparsing text sebagai JSON
 */
export function extractJsonFromResponse(text: string): any {
  // Coba parse langsung sebagai JSON
  try {
    return JSON.parse(text);
  } catch (e) {
    // Jika gagal, coba ekstrak JSON dari HTML
    try {
      // Coba cari struktur JSON dari respons HTML
      const jsonMatch = text.match(/\{.*\}/s) || text.match(/\[.*\]/s);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (extractError) {
      console.error('Gagal mengekstrak JSON dari respons:', extractError);
    }
    
    // Jika tidak ada yang berhasil, lempar error
    throw new Error('Tidak dapat mengekstrak JSON dari respons');
  }
}

/**
 * Mencoba mengambil data dari server dan memparsing responsnya sebagai JSON
 * dengan teknik ekstraksi jika diperlukan
 */
export async function fetchWithJsonExtraction(endpoint: string): Promise<any> {
  try {
    const response = await fetch(endpoint);
    const text = await response.text();
    
    if (!response.ok) {
      throw new Error(`Request gagal dengan status ${response.status}: ${text}`);
    }
    
    return extractJsonFromResponse(text);
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
}

/**
 * Fungsi yang hanya mengembalikan data dari slot untuk debugging
 */
export async function fetchSlotDataClient(slotId: number): Promise<any> {
  return {
    id: slotId,
    date: '2025-05-17',
    timeSlot: '13:00-16:00',
    maxQuota: 5,
    currentCount: 1,
    isActive: true
  };
}

/**
 * Fungsi yang mengembalikan data appointments untuk debugging
 */
export async function fetchSlotAppointmentsClient(slotId: number): Promise<any> {
  return [
    {
      id: 336,
      patientId: 42,
      status: 'Scheduled',
      date: '2025-05-17',
      timeSlot: '13:00-16:00'
    }
  ];
}

/**
 * Fungsi yang mengembalikan data pasien untuk debugging
 */
export async function fetchSlotPatientsClient(slotId: number): Promise<any> {
  return [
    {
      id: 42,
      name: 'Pasien Contoh',
      phoneNumber: '081234567890',
      address: 'Jakarta',
      appointmentStatus: 'Scheduled',
      appointmentId: 336,
      walkin: false
    }
  ];
}