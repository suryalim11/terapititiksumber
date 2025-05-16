/**
 * Middleware untuk menangani autentikasi dan otorisasi
 */
import { Request, Response, NextFunction } from "express";

/**
 * Middleware untuk memastikan pengguna sudah login
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  
  return res.status(401).json({
    success: false,
    message: "Autentikasi diperlukan untuk mengakses resource ini"
  });
}

/**
 * Middleware untuk memastikan pengguna memiliki peran admin
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({
      success: false,
      message: "Autentikasi diperlukan untuk mengakses resource ini"
    });
  }
  
  const user = req.user as any;
  
  if (user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: "Anda tidak memiliki izin untuk mengakses resource ini"
    });
  }
  
  return next();
}

/**
 * Middleware untuk membolehkan akses publik atau pengguna yang sudah login
 * Berguna untuk endpoint yang mengizinkan akses publik tapi juga mengambil data user jika tersedia
 */
export function allowPublicOrAuth(req: Request, res: Response, next: NextFunction) {
  // Lanjutkan apapun statusnya (publik atau terautentikasi)
  return next();
}

/**
 * Middleware untuk membolehkan semua akses tanpa batasan
 * Berguna untuk endpoint publik
 */
export function allowAnyAccess(req: Request, res: Response, next: NextFunction) {
  return next();
}