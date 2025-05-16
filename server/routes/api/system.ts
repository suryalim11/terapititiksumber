/**
 * API endpoint untuk fungsi sistem dasar
 */
import { Express, Request, Response } from "express";

/**
 * Mendaftarkan rute-rute sistem dasar
 */
export function setupSystemRoutes(app: Express) {
  // Endpoint health check sederhana
  app.get("/api/ping", (req: Request, res: Response) => {
    res.json({
      status: "ok",
      server: "running",
      timestamp: new Date().toISOString()
    });
  });
}