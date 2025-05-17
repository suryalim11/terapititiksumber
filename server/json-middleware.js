/**
 * Middleware khusus untuk memastikan respons selalu JSON
 * dengan header yang benar
 */
function ensureJsonResponse(req, res, next) {
  // Simpan referensi ke fungsi asli
  const originalJson = res.json;
  const originalSend = res.send;
  const originalEnd = res.end;
  
  // Override fungsi json
  res.json = function(body) {
    // Set header dengan tegas
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return originalJson.call(this, body);
  };
  
  // Override fungsi send untuk kasus ketika send digunakan langsung
  res.send = function(body) {
    // Jika body adalah objek atau array, pastikan header adalah JSON
    if (body !== null && typeof body === 'object') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
    return originalSend.call(this, body);
  };
  
  // Override fungsi end
  res.end = function(data) {
    // Jika konten yang dikirim adalah string JSON, paksa header
    if (data && 
        typeof data === 'string' && 
        (data.startsWith('{') || data.startsWith('['))) {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
    return originalEnd.call(this, data);
  };
  
  // Tambahkan hook sebelum respons selesai
  res.on('finish', () => {
    // Tidak ada tindakan tambahan diperlukan di sini
    // Header sudah di-override di atas
  });
  
  next();
}

module.exports = { ensureJsonResponse };