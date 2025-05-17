/**
 * Middleware untuk memastikan semua respons API selalu menyertakan header Content-Type yang benar
 * Mengatasi masalah middleware Express yang mungkin mengganti header yang sudah ditetapkan
 */

function ensureJsonResponse(req, res, next) {
  // Simpan referensi ke method res.json asli
  const originalJson = res.json;
  
  // Override res.json
  res.json = function(body) {
    // Pastikan header Content-Type adalah application/json
    res.setHeader('Content-Type', 'application/json');
    
    // Panggil method json asli
    return originalJson.call(this, body);
  };
  
  // Simpan referensi ke method res.send asli
  const originalSend = res.send;
  
  // Override res.send untuk JSON
  res.send = function(body) {
    // Jika body adalah object atau array, pastikan header Content-Type adalah application/json
    if (body && (typeof body === 'object' || Array.isArray(body))) {
      res.setHeader('Content-Type', 'application/json');
    }
    
    // Panggil method send asli
    return originalSend.call(this, body);
  };
  
  // Lanjutkan ke middleware berikutnya
  next();
}

module.exports = { ensureJsonResponse };