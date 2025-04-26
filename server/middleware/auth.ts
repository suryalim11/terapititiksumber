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