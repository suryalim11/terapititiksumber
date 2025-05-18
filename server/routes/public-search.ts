/**
 * API endpoint untuk pencarian pasien publik (tanpa autentikasi)
 * Hanya digunakan pada halaman pendaftaran
 */
import { Express, Request, Response } from "express";
import { storage } from "../storage";
import { z } from "zod";

/**
 * Mendaftarkan rute publik untuk pencarian pasien
 */
export function setupPublicSearchRoutes(app: Express) {
  // Pencarian pasien berdasarkan nama atau nomor telepon untuk form pendaftaran
  app.get("/api/public/patients/search", async (req: Request, res: Response) => {
    try {
      const query = req.query.query || req.query.phone;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ 
          success: false, 
          message: "Parameter pencarian diperlukan" 
        });
      }
      
      console.log(`Pencarian publik untuk pasien dengan kata kunci: ${query}`);
      
      const patients = await storage.searchPatientByNameOrPhone(query);
      
      if (patients.length > 0) {
        console.log(`Pasien ditemukan: ${patients.length} hasil dengan kata kunci: ${query}`);
        return res.status(200).json({
          success: true,
          found: true,
          patients: patients,
          count: patients.length
        });
      } else {
        console.log(`Tidak ada pasien ditemukan dengan kata kunci: ${query}`);
        return res.status(200).json({ 
          success: true, 
          found: false,
          message: "Tidak ada pasien ditemukan dengan kata kunci tersebut"
        });
      }
    } catch (error) {
      console.error("Error searching for patient:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat mencari pasien"
      });
    }
  });
}