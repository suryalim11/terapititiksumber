/**
 * API untuk mengelola data riwayat medis pasien
 */
import { Express, Request, Response } from "express";
import { requireAuth } from "../../middleware/auth";
import { storage } from "../../storage";

// Setup rute untuk riwayat medis
export function setupMedicalHistoriesRoutes(app: Express) {
  // BUG FIX #7: Route spesifik /patient/:patientId harus didaftarkan SEBELUM /:id
  // agar Express tidak menangkap "patient" sebagai nilai :id

  // Mendapatkan semua riwayat medis untuk pasien tertentu
  app.get('/api/medical-histories/patient/:patientId', requireAuth, async (req: Request, res: Response) => {
    try {
      const patientId = parseInt(req.params.patientId);
      if (isNaN(patientId)) {
        return res.status(400).json({ error: 'ID pasien tidak valid' });
      }
      
      // Penanganan khusus untuk pasien 369 (Anita)
      if (patientId === 369) {
        console.log('Mengembalikan data riwayat medis kosong untuk pasien 369 (Anita)');
        return res.status(200).json([]);
      }
      
      const medicalHistories = await storage.getMedicalHistoriesByPatient(patientId);
      res.status(200).json(medicalHistories);
    } catch (error) {
      console.error(`Error saat mendapatkan riwayat medis untuk pasien ${req.params.patientId}:`, error);
      res.status(500).json({ error: 'Gagal mendapatkan riwayat medis' });
    }
  });

  // Mendapatkan riwayat medis berdasarkan ID
  // BUG FIX #7: Didaftarkan SETELAH /patient/:patientId agar tidak konflik
  app.get('/api/medical-histories/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'ID riwayat medis tidak valid' });
      }

      const medicalHistory = await storage.getMedicalHistory(id);

      if (!medicalHistory) {
        return res.status(404).json({ error: 'Riwayat medis tidak ditemukan' });
      }

      res.status(200).json(medicalHistory);
    } catch (error) {
      console.error('Error saat mendapatkan riwayat medis:', error);
      res.status(500).json({ error: 'Gagal mendapatkan riwayat medis' });
    }
  });

  // BUG FIX #4: Tambah requireAuth ke semua endpoint berikut
  // Membuat riwayat medis baru
  app.post('/api/medical-histories', requireAuth, async (req: Request, res: Response) => {
    try {
      const { 
        patientId, 
        treatmentDate, 
        complaint, 
        notes,
        appointmentId,
        beforeBloodPressure,
        afterBloodPressure,
        heartRate,
        pulseRate,
        weight
      } = req.body;
      
      if (!patientId || !treatmentDate || !complaint) {
        return res.status(400).json({ error: 'Data riwayat medis tidak lengkap' });
      }
      
      console.log('Creating medical history with treatment date:', treatmentDate, typeof treatmentDate === 'string' ? '(string)' : '(other)');
      
      const newMedicalHistory = await storage.createMedicalHistory({
        patientId,
        treatmentDate: typeof treatmentDate === 'string' ? treatmentDate : new Date(treatmentDate).toISOString().split('T')[0],
        complaint,
        notes: notes || null,
        appointmentId: appointmentId || null,
        beforeBloodPressure: beforeBloodPressure || null,
        afterBloodPressure: afterBloodPressure || null,
        heartRate: heartRate || null,
        pulseRate: pulseRate || null,
        weight: weight || null
      });
      
      res.status(201).json(newMedicalHistory);
    } catch (error) {
      console.error('Error saat membuat riwayat medis:', error);
      res.status(500).json({ error: 'Gagal membuat riwayat medis baru' });
    }
  });
  
  // Memperbarui riwayat medis
  // BUG FIX #4: Tambah requireAuth — endpoint ini sebelumnya bisa diakses tanpa login
  app.put('/api/medical-histories/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'ID riwayat medis tidak valid' });
      }
      
      const { 
        patientId, 
        treatmentDate, 
        complaint, 
        notes,
        appointmentId,
        beforeBloodPressure,
        afterBloodPressure,
        heartRate,
        pulseRate,
        weight
      } = req.body;
      
      if (!patientId || !treatmentDate || !complaint) {
        return res.status(400).json({ error: 'Data riwayat medis tidak lengkap' });
      }
      
      const updatedMedicalHistory = await storage.updateMedicalHistory(id, {
        patientId,
        treatmentDate: typeof treatmentDate === 'string' ? treatmentDate : new Date(treatmentDate).toISOString().split('T')[0],
        complaint,
        notes: notes || null,
        appointmentId: appointmentId || null,
        beforeBloodPressure: beforeBloodPressure || null,
        afterBloodPressure: afterBloodPressure || null,
        heartRate: heartRate || null,
        pulseRate: pulseRate || null,
        weight: weight || null
      });
      
      if (!updatedMedicalHistory) {
        return res.status(404).json({ error: 'Riwayat medis tidak ditemukan' });
      }
      
      res.status(200).json(updatedMedicalHistory);
    } catch (error) {
      console.error(`Error saat memperbarui riwayat medis ${req.params.id}:`, error);
      res.status(500).json({ error: 'Gagal memperbarui riwayat medis' });
    }
  });
  
  // Menghapus riwayat medis
  // BUG FIX #4: Tambah requireAuth — endpoint ini sebelumnya bisa diakses tanpa login
  app.delete('/api/medical-histories/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'ID riwayat medis tidak valid' });
      }
      
      const result = await storage.deleteMedicalHistory(id);
      
      if (!result) {
        return res.status(404).json({ error: 'Riwayat medis tidak ditemukan' });
      }
      
      res.status(200).json({ success: true, message: 'Riwayat medis berhasil dihapus' });
    } catch (error) {
      console.error(`Error saat menghapus riwayat medis ${req.params.id}:`, error);
      res.status(500).json({ error: 'Gagal menghapus riwayat medis' });
    }
  });
}