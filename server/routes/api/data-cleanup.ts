/**
 * API untuk membersihkan data contoh dari database
 */
import { Express, Request, Response } from "express";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import { storage } from "../../storage";
import { db } from "../../db";
import { eq } from "drizzle-orm";
import { 
  patients, 
  appointments, 
  transactions, 
  sessions, 
  medicalHistories 
} from "@shared/schema";

/**
 * Mendaftarkan rute untuk pembersihan data
 */
export function setupDataCleanupRoutes(app: Express) {
  // Endpoint untuk menghapus data pasien contoh yang dibuat otomatis sistem
  app.post("/api/data-cleanup/sample-patients", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      // Mendapatkan semua pasien yang ada
      const allPatients = await storage.getAllPatients();
      
      // Identifikasi pasien yang akan dipertahankan (yang Anda daftarkan sendiri)
      const userCreatedPatientIds = req.body.keepPatientIds || [];
      
      // Pasien yang akan dihapus (semua pasien kecuali yang disebutkan untuk dipertahankan)
      const patientsToDelete = allPatients.filter(patient => 
        !userCreatedPatientIds.includes(patient.id)
      );
      
      console.log(`Menghapus ${patientsToDelete.length} pasien contoh dari total ${allPatients.length} pasien`);
      
      const results = {
        totalPatients: allPatients.length,
        patientsToDelete: patientsToDelete.length,
        deletedPatients: 0,
        deletedAppointments: 0,
        deletedTransactions: 0,
        deletedSessions: 0,
        deletedMedicalHistories: 0,
        errors: []
      };
      
      // Lakukan penghapusan untuk setiap pasien contoh
      for (const patient of patientsToDelete) {
        try {
          const patientId = patient.id;
          
          // 1. Hapus medical histories terkait
          const patientMedicalHistories = await storage.getMedicalHistoriesByPatient(patientId);
          for (const history of patientMedicalHistories) {
            await storage.deleteMedicalHistory(history.id);
            results.deletedMedicalHistories++;
          }
          
          // 2. Hapus appointments terkait
          const patientAppointments = await storage.getAppointmentsByPatient(patientId);
          for (const appointment of patientAppointments) {
            await storage.deleteAppointment(appointment.id);
            results.deletedAppointments++;
          }
          
          // 3. Hapus sessions terkait
          const patientSessions = await storage.getSessionsByPatient(patientId);
          for (const session of patientSessions) {
            // Perhatikan: ini hanya menghapus session, bukan mengurangi kuota paket
            await db.delete(sessions).where(eq(sessions.id, session.id)).execute();
            results.deletedSessions++;
          }
          
          // 4. Hapus transactions terkait
          const patientTransactions = await storage.getTransactionsByPatient(patientId);
          for (const transaction of patientTransactions) {
            await storage.deleteTransaction(transaction.id);
            results.deletedTransactions++;
          }
          
          // 5. Akhirnya hapus pasien
          await storage.deletePatient(patientId);
          results.deletedPatients++;
          
        } catch (err) {
          console.error(`Error menghapus pasien ID ${patient.id}:`, err);
          results.errors.push({
            patientId: patient.id,
            name: patient.name,
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }
      
      res.status(200).json({
        success: true,
        message: `Berhasil menghapus ${results.deletedPatients} pasien contoh dan data terkait`,
        results
      });
      
    } catch (error) {
      console.error("Error saat membersihkan data pasien contoh:", error);
      res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat membersihkan data pasien contoh",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
}