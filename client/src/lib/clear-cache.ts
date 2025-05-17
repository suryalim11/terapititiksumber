/**
 * Fungsi untuk membersihkan cache browser (localStorage) yang berkaitan dengan data pasien
 * yang sudah tidak ada di database tapi masih tertampil di UI
 */
export function clearPatientDataCache(): boolean {
  try {
    // Hapus semua data dari localStorage
    console.log("🧹 Membersihkan cache data...");
    
    // 1. Hapus cache status appointment
    const keys = Object.keys(localStorage);
    console.log(`Ditemukan ${keys.length} item di localStorage`);
    
    // Hapus semua cache appointment status
    const appointmentStatusKeys = keys.filter(key => key.startsWith('appointment-status-'));
    console.log(`Menghapus ${appointmentStatusKeys.length} cache status appointment`);
    appointmentStatusKeys.forEach(key => {
      localStorage.removeItem(key);
    });
    
    // 2. Hapus cache data slot terapi
    const slotDataKeys = keys.filter(key => key.startsWith('slot-') || key.includes('slots'));
    console.log(`Menghapus ${slotDataKeys.length} cache data slot`);
    slotDataKeys.forEach(key => {
      localStorage.removeItem(key);
    });
    
    // 3. Hapus data pasien yang mungkin disimpan
    const patientDataKeys = keys.filter(key => 
      key.includes('patient') || 
      key.includes('appointment') ||
      key.includes('slots')
    );
    console.log(`Menghapus ${patientDataKeys.length} cache data pasien/appointment`);
    patientDataKeys.forEach(key => {
      localStorage.removeItem(key);
    });

    // 4. Hapus semua cache React Query
    // Tambahkan flag untuk menandai bahwa halaman sudah dibersihkan
    localStorage.setItem('cache-cleared', Date.now().toString());
    
    // Logging untuk debugging
    console.log("✅ Pembersihan cache selesai, merefresh halaman...");
    
    // 5. Trigger hard refresh untuk memastikan semua data dimuat ulang
    window.location.href = window.location.pathname + '?refresh=' + Date.now();
    return true;
  } catch (error) {
    console.error("❌ Gagal membersihkan cache:", error);
    return false;
  }
}