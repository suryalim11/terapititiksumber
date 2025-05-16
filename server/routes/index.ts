/**
 * File utama untuk setup rute API
 */
import { Express } from "express";
import { setupAppointmentRoutes } from "./api/appointments";
import { setupTherapySlotsRoutes } from "./api/therapy-slots";
import { setupPatientRoutes } from "./api/patients";
import { setupAuthRoutes } from "./api/auth";
import { setupSystemRoutes } from "./api/system";
import { setupProductRoutes } from "./api/products";
import { setupPackageRoutes } from "./api/packages";
import { setupTransactionRoutes } from "./api/transactions";
import { setupUserRoutes } from "./api/users";
import { setupMedicalHistoryRoutes } from "./api/medical-histories";

/**
 * Setup semua rute API dan middleware
 * @param app Express app instance
 */
export function setupRoutes(app: Express) {
  // Setup rute untuk setiap domain aplikasi
  setupAuthRoutes(app);
  setupUserRoutes(app);
  setupPatientRoutes(app);
  setupTherapySlotsRoutes(app);
  setupAppointmentRoutes(app);
  setupProductRoutes(app);
  setupPackageRoutes(app);
  setupTransactionRoutes(app);
  setupSystemRoutes(app);
  setupMedicalHistoryRoutes(app);
}