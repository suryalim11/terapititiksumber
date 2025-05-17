/**
 * Fungsi untuk membersihkan cache browser (localStorage) yang berkaitan dengan data pasien
 * yang sudah tidak ada di database tapi masih tertampil di UI
 */
export function clearPatientDataCache(): boolean {
  try {
    // Hapus cache status appointment
    const keys = Object.keys(localStorage);
    const appointmentStatusKeys = keys.filter(key => key.startsWith('appointment-status-'));
    
    appointmentStatusKeys.forEach(key => {
      localStorage.removeItem(key);
    });
    
    // Hapus cache data slot terapi
    const slotDataKeys = keys.filter(key => key.startsWith('slot-data-'));
    slotDataKeys.forEach(key => {
      localStorage.removeItem(key);
    });

    // Hapus cache query dari React Query
    if (window.caches) {
      window.caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
          if (cacheName.includes('query')) {
            window.caches.delete(cacheName);
          }
        });
      });
    }

    // Trigger refresh
    window.location.reload();
    return true;
  } catch (error) {
    console.error("Gagal membersihkan cache:", error);
    return false;
  }
}