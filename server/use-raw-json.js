/**
 * Middleware yang akan mematikan fitur Express dan memanipulasi respons HTTP secara langsung
 * untuk memastikan header Content-Type selalu benar
 */

function useRawJson(req, res, next) {
  // Simpan referensi ke metode asli
  const originalEnd = res.end;
  const originalWrite = res.write;
  const originalSend = res.send;
  const originalJson = res.json;
  
  // Override metode end
  res.end = function(chunk, encoding) {
    // Set header secara manual
    res.setHeader('Content-Type', 'application/json');
    // Hapus header charset untuk mencegah browser mengasumsikan text/html
    res.removeHeader('charset');
    
    // Panggil metode asli
    return originalEnd.call(this, chunk, encoding);
  };
  
  // Override metode write
  res.write = function(chunk, encoding) {
    // Set header secara manual
    res.setHeader('Content-Type', 'application/json');
    // Hapus header charset untuk mencegah browser mengasumsikan text/html
    res.removeHeader('charset');
    
    // Panggil metode asli
    return originalWrite.call(this, chunk, encoding);
  };
  
  // Override metode send
  res.send = function(body) {
    // Set header secara manual
    res.setHeader('Content-Type', 'application/json');
    // Hapus header charset untuk mencegah browser mengasumsikan text/html
    res.removeHeader('charset');
    
    // Jika body adalah objek, stringify secara manual
    if (typeof body === 'object') {
      // Ubah objek menjadi string JSON 
      const jsonString = JSON.stringify(body);
      
      // Setel properti yang dibutuhkan Express
      this.set('Content-Type', 'application/json');
      
      // Kirim respons menggunakan metode write dan end
      this.write(jsonString);
      this.end();
      
      return this;
    }
    
    // Panggil metode asli jika body bukan objek
    return originalSend.call(this, body);
  };
  
  // Override metode json
  res.json = function(obj) {
    // Set header secara manual
    res.setHeader('Content-Type', 'application/json');
    // Hapus header charset untuk mencegah browser mengasumsikan text/html
    res.removeHeader('charset');
    
    // Setel Content-Type header secara manual
    this.set('Content-Type', 'application/json');
    
    // Stringify objek secara manual
    const jsonString = JSON.stringify(obj);
    
    // Kirim respons menggunakan metode write dan end
    this.write(jsonString);
    this.end();
    
    return this;
  };
  
  // Lanjut ke middleware berikutnya
  next();
}

module.exports = useRawJson;