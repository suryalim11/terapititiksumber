/**
 * Router utama yang mengatur semua rute API
 */
import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupPatientRoutes } from "./api/patients";
import { setupProductRoutes } from "./api/products";
import { setupPackageRoutes } from "./api/packages";
import { setupTransactionRoutes } from "./api/transactions";
import { setupSessionRoutes } from "./api/sessions";
import { setupAppointmentRoutes } from "./api/appointments";
import { setupTherapySlotRoutes } from "./api/therapy-slots";
import { setupAdminRoutes } from "./api/admin";
import { setupAuthRoutes } from "./api/auth";
import { setupUtilityRoutes } from "./api/utilities";
import { setupReportRoutes } from "./api/reports";
import { setupBackupRoutes } from "./api/backup";
import { setupWebhookRoutes } from "./api/webhook";
import { setupSystemRoutes } from "./api/system";

import { setupAuth } from "../auth";
import multer from "multer";
import path from "path";

// Setup multer untuk file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

export const upload = multer({ storage });

/**
 * Fungsi utama untuk mendaftarkan semua rute API
 */
export async function setupRoutes(app: Express): Promise<Server> {
  // Setup autentikasi
  setupAuth(app);
  
  // Setup rute-rute API berdasarkan domain
  setupSystemRoutes(app); // Ping, status server, dll
  setupAuthRoutes(app);
  setupPatientRoutes(app);
  setupProductRoutes(app);
  setupPackageRoutes(app);
  setupTransactionRoutes(app);
  setupSessionRoutes(app);
  setupAppointmentRoutes(app);
  setupTherapySlotRoutes(app);
  setupAdminRoutes(app);
  setupReportRoutes(app);
  setupBackupRoutes(app);
  setupUtilityRoutes(app);
  setupWebhookRoutes(app);
  
  // Buat dan kembalikan server HTTP
  const server = createServer(app);
  return server;
}