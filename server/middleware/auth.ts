import { Request, Response, NextFunction } from "express";

/**
 * Middleware untuk memeriksa apakah pengguna sudah terautentikasi
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ 
    success: false, 
    message: "Anda harus login untuk mengakses halaman ini" 
  });
}

/**
 * Middleware untuk memeriksa apakah pengguna memiliki peran admin
 */
export function requireAdminRole(req: Request, res: Response, next: NextFunction) {
  if (req.user && (req.user as any).role === 'admin') {
    return next();
  }
  return res.status(403).json({ 
    success: false, 
    message: "Akses ditolak. Anda tidak memiliki hak akses admin" 
  });
}

/**
 * Middleware untuk mengizinkan akses publik atau pengguna yang terautentikasi
 * Digunakan untuk endpoint yang bisa diakses publik atau pengguna login
 */
export function allowPublicOrAuth(req: Request, res: Response, next: NextFunction) {
  // Jika pengguna sudah login atau menggunakan parameter apiKey yang benar
  if (req.isAuthenticated() || req.query.apiKey === "terapi-titik-sumber-public") {
    return next();
  }
  return res.status(401).json({ 
    success: false, 
    message: "Anda harus login untuk mengakses halaman ini" 
  });
}

/**
 * Middleware untuk endpoint khusus perbaikan appointment
 * Mengizinkan akses publik (tanpa autentikasi) agar dapat digunakan dari halaman publik
 */
export function allowAnyAccess(req: Request, res: Response, next: NextFunction) {
  return next(); // Selalu lanjutkan tanpa memeriksa autentikasi
}