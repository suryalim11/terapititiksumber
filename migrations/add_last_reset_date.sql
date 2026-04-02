-- Menambahkan kolom last_reset_date ke tabel registration_links
-- Kolom ini digunakan untuk melacak kapan counter harian terakhir direset
-- sehingga batas pendaftaran harian bisa bekerja dengan benar
ALTER TABLE registration_links
  ADD COLUMN IF NOT EXISTS last_reset_date TEXT;

-- Komentar: kolom ini menyimpan tanggal terakhir counter direset (format YYYY-MM-DD)
-- NULL berarti belum pernah digunakan / counter baru
