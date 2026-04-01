/**
 * API untuk mengelola data sesi terapi
 */
import { Express, Request, Response } from "express";
import { storage } from "../../storage";

// Setup rute untuk sesi terapi
export function setupSessionsRoutes(app: Express) {
  // Mendapatkan semua sesi terapi (filter by patientId jika diberikan)
  app.get('/api/sessions', async (req: Request, res: Response) => {
    try {
      // BUG FIX #11: Hapus hardcode pasien ID 369
      const patientId = req.query.patientId ? parseInt(req.query.patientId as string) : null;

      let sessions;
      
      if (patientId) {
        const active = req.query.active === 'true';
        
        if (active) {
          sessions = await storage.getActiveSessionsByPatient(patientId);
        } else {
          sessions = await storage.getSessionsByPatient(patientId);
        }
      } else {
        sessions = await storage.getAllActiveSessions();
      }
      
      res.status(200).json(sessions);
    } catch (error) {
      console.error('Error saat mendapatkan data sesi terapi:', error);
      res.status(500).json({ error: 'Gagal mendapatkan data sesi terapi' });
    }
  });

  // Admin: Periksa integritas data sesi (integrity check)
  app.post('/api/sessions/integrity-check', async (req: Request, res: Response) => {
    try {
      const allSessions = await storage.getAllActiveSessions();
      const issues: string[] = [];

      for (const session of allSessions) {
        // Cek apakah sessionsUsed melebihi totalSessions
        if (session.sessionsUsed > session.totalSessions) {
          issues.push(`Sesi ID ${session.id}: sessionsUsed (${session.sessionsUsed}) > totalSessions (${session.totalSessions})`);
        }
        // Cek apakah nilai negatif
        if (session.sessionsUsed < 0) {
          issues.push(`Sesi ID ${session.id}: sessionsUsed bernilai negatif (${session.sessionsUsed})`);
        }
      }

      res.status(200).json({
        success: true,
        message: issues.length === 0
          ? `Pemeriksaan selesai: ${allSessions.length} sesi diperiksa, tidak ada masalah`
          : `Pemeriksaan selesai: ${issues.length} masalah ditemukan`,
        totalChecked: allSessions.length,
        issues
      });
    } catch (error) {
      console.error('Error in session integrity check:', error);
      res.status(500).json({ error: 'Gagal memeriksa integritas sesi' });
    }
  });

  // Admin: Perbaiki sesi untuk paket yang sudah ada
  app.post('/api/sessions/fix-existing-packages', async (req: Request, res: Response) => {
    try {
      const allSessions = await storage.getAllActiveSessions();
      let fixed = 0;

      for (const session of allSessions) {
        // Jika sessionsUsed negatif, reset ke 0
        if (session.sessionsUsed < 0) {
          await storage.updateSession(session.id, { sessionsUsed: 0 });
          fixed++;
        }
        // Jika sessionsUsed > totalSessions, cap ke totalSessions
        else if (session.sessionsUsed > session.totalSessions) {
          await storage.updateSession(session.id, { sessionsUsed: session.totalSessions });
          fixed++;
        }
      }

      res.status(200).json({
        success: true,
        message: `Perbaikan selesai: ${fixed} sesi diperbaiki dari ${allSessions.length} total`,
        fixed,
        total: allSessions.length
      });
    } catch (error) {
      console.error('Error fixing existing packages:', error);
      res.status(500).json({ error: 'Gagal memperbaiki sesi paket' });
    }
  });

  // Admin: Placeholder untuk perbaikan data spesifik
  app.post('/api/sessions/fix-agus-isrofin', async (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'Tidak ada perbaikan khusus yang diperlukan saat ini'
    });
  });

  // Endpoint untuk update jumlah sesi terpakai
  app.post('/api/sessions/fix-usage-count', async (req: Request, res: Response) => {
    try {
      const { sessionId, sessionsUsed } = req.body;
      
      if (!sessionId || sessionsUsed === undefined) {
        return res.status(400).json({ 
          success: false, 
          message: 'sessionId dan sessionsUsed harus disediakan' 
        });
      }
      
      // Update session dengan sessionsUsed baru
      await storage.updateSession(sessionId, { sessionsUsed });
      
      return res.status(200).json({ 
        success: true, 
        message: 'Jumlah sesi berhasil diupdate' 
        });
    } catch (error) {
      console.error('Error saat update session count:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Gagal update jumlah sesi' 
      });
    }
  });
}