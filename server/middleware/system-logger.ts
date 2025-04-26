import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { Session } from 'express-session';

// Definisi tipe untuk user dalam session
interface SessionWithUser extends Session {
  user?: {
    id: number;
    username: string;
    role: string;
    [key: string]: any;
  };
}

// Middleware untuk mencatat aktivitas login
export const logLoginActivity = async (req: Request, res: Response, next: NextFunction) => {
  // Simpan response asli untuk menangkap hasil login
  const originalSend = res.send;
  
  res.send = function(body) {
    // Kembalikan fungsi send ke defaultnya
    res.send = originalSend;
    
    try {
      // Parse response body untuk mengetahui hasil login
      const responseData = JSON.parse(body);
      const success = responseData.success;
      const username = req.body?.username;
      
      if (success && username) {
        // Login berhasil, catat ke log
        storage.createSystemLog({
          userId: responseData.user?.id,
          action: 'login',
          entityType: 'user',
          entityId: responseData.user?.id?.toString(),
          details: {
            username,
            timestamp: new Date().toISOString(),
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }).catch(err => console.error('Error logging login activity:', err));
      } else if (!success && username) {
        // Login gagal, catat ke log
        storage.createSystemLog({
          userId: null,
          action: 'login_failed',
          entityType: 'user',
          entityId: null,
          details: {
            username,
            timestamp: new Date().toISOString(),
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            reason: responseData.message || 'Unknown reason',
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }).catch(err => console.error('Error logging failed login activity:', err));
      }
    } catch (error) {
      console.error('Error processing login log:', error);
    }
    
    // Panggil fungsi send original dengan body yang sama
    return originalSend.call(this, body);
  };
  
  next();
};

// Middleware untuk mencatat aktivitas logout
export const logLogoutActivity = async (req: Request, res: Response, next: NextFunction) => {
  // Periksa apakah ada user dalam sesi
  const user = req.session?.user;
  
  if (user) {
    // Catat aktivitas logout
    storage.createSystemLog({
      userId: user.id,
      action: 'logout',
      entityType: 'user',
      entityId: user.id.toString(),
      details: {
        username: user.username,
        timestamp: new Date().toISOString(),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(err => console.error('Error logging logout activity:', err));
  }
  
  next();
};

// Helper function untuk mencatat aktivitas CRUD
export const logDataActivity = async (
  req: Request,
  action: 'create' | 'update' | 'delete',
  entityType: string,
  entityId: string,
  details?: any
) => {
  try {
    const user = req.session?.user;
    
    await storage.createSystemLog({
      userId: user?.id || null,
      action,
      entityType,
      entityId,
      details: {
        ...details,
        username: user?.username || 'system',
        timestamp: new Date().toISOString(),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  } catch (error) {
    console.error(`Error logging ${action} activity:`, error);
  }
};