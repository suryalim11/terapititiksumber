-- Menambahkan kolom baru ke tabel medical_histories tanpa menghapus data yang ada
ALTER TABLE medical_histories 
  ADD COLUMN IF NOT EXISTS before_blood_pressure TEXT,
  ADD COLUMN IF NOT EXISTS after_blood_pressure TEXT,
  ADD COLUMN IF NOT EXISTS heart_rate TEXT,
  ADD COLUMN IF NOT EXISTS pulse_rate TEXT,
  ADD COLUMN IF NOT EXISTS weight TEXT;

-- Menambahkan indeks untuk pencarian yang lebih cepat
CREATE INDEX IF NOT EXISTS idx_medical_histories_patient_id ON medical_histories(patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_histories_appointment_id ON medical_histories(appointment_id);
CREATE INDEX IF NOT EXISTS idx_medical_histories_treatment_date ON medical_histories(treatment_date);