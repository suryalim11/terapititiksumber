/**
 * File utama untuk setup rute API
 */
import { Express } from "express";
import { setupAppointmentRoutes } from "./api/appointments";
import { setupTherapySlotsRoutes } from "./api/therapy-slots";
import { setupPatientRoutes } from "./api/patients";
import { setupAuthRoutes } from "./api/auth";
import { setupUserRoutes } from "./api/users";
import { setupRegistrationLinkRoutes } from "./api/registration-links";
import { setupDashboardRoutes } from "./api/dashboard";

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
  setupRegistrationLinkRoutes(app);
  setupDashboardRoutes(app);
  
  // Add API ping/health check endpoint
  app.get('/api/ping', (req, res) => {
    res.status(200).json({ 
      status: 'ok', 
      time: new Date().toISOString(),
      message: 'Server berjalan dengan baik'
    });
  });
}