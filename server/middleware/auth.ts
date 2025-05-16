/**
 * Middleware untuk autentikasi dan pengelolaan akses
 */
import { Request, Response, NextFunction } from "express";

/**
 * Middleware untuk memastikan user telah terotentikasi
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ 
      success: false, 
      message: "Anda perlu login untuk mengakses halaman ini" 
    });
  }
  next();
}

/**
 * Middleware untuk memastikan user memiliki peran admin
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ 
      success: false, 
      message: "Anda perlu login untuk mengakses halaman ini" 
    });
  }
  
  // Pastikan pengguna memiliki peran admin
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({ 
      success: false, 
      message: "Anda tidak memiliki izin untuk mengakses halaman ini" 
    });
  }
}

/**
 * Alias untuk requireAdmin untuk kompatibilitas dengan kode lama
 */
export const requireAdminRole = requireAdmin;

/**
 * Middleware yang mengizinkan akses publik atau pengguna terautentikasi
 */
export function allowPublicOrAuth(req: Request, res: Response, next: NextFunction) {
  // Tetap lanjutkan, tanpa memeriksa autentikasi
  next();
}

/**
 * Middleware yang mengizinkan akses untuk semua request tanpa batasan
 */
export function allowAnyAccess(req: Request, res: Response, next: NextFunction) {
  // Tetap lanjutkan, tanpa memeriksa apapun
  next();
}

/**
 * Memeriksa apakah user memiliki peran admin
 */
export function isAdmin(req: Request): boolean {
  return req.isAuthenticated() && req.user && req.user.role === 'admin';
}

/**
 * Mencatat aktivitas login
 */
export function logLoginActivity(req: Request, res: Response, next: NextFunction) {
  const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log(`Login attempt from ${ipAddress} with username: ${req.body.username}`);
  next();
}

/**
 * Mencatat aktivitas logout
 */
export function logLogoutActivity(req: Request, res: Response, next: NextFunction) {
  const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (req.user) {
    console.log(`Logout by user ID: ${req.user.id} from ${ipAddress}`);
  } else {
    console.log(`Logout attempt (no active session) from ${ipAddress}`);
  }
  next();
}