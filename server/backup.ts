import { Request, Response } from 'express';
import { db } from './db';
import {
  users, patients, products, packages, transactions, 
  sessions, therapySlots, appointments, registrationLinks
} from '@shared/schema';
import fs from 'fs';
import path from 'path';
import { storage } from './storage';
import { eq } from 'drizzle-orm';

// Direktori penyimpanan file backup
const BACKUP_DIR = path.join(process.cwd(), 'backups');

// Pastikan direktori backup ada
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Format tanggal untuk nama file
function getFormattedDate(): string {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
}

// Fungsi untuk ekspor data ke file JSON
export async function exportData(req: Request, res: Response) {
  try {
    const data: any = {};
    
    // Ekspor semua tabel
    data.users = await db.select().from(users);
    data.patients = await db.select().from(patients);
    data.products = await db.select().from(products);
    data.packages = await db.select().from(packages);
    data.transactions = await db.select().from(transactions);
    data.sessions = await db.select().from(sessions);
    data.therapySlots = await db.select().from(therapySlots);
    data.appointments = await db.select().from(appointments);
    data.registrationLinks = await db.select().from(registrationLinks);
    
    // Buat nama file dengan format tertentu
    const filename = `backup-${getFormattedDate()}.json`;
    const filePath = path.join(BACKUP_DIR, filename);
    
    // Tulis data ke file
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    
    // Kembalikan informasi file dan data summary
    return res.status(200).json({
      success: true,
      message: 'Backup berhasil dibuat',
      filename,
      summary: {
        users: data.users.length,
        patients: data.patients.length,
        products: data.products.length,
        packages: data.packages.length,
        transactions: data.transactions.length,
        sessions: data.sessions.length,
        therapySlots: data.therapySlots.length,
        appointments: data.appointments.length,
        registrationLinks: data.registrationLinks.length,
      }
    });
  } catch (error: any) {
    console.error('Error saat membuat backup:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal membuat backup: ' + error.message
    });
  }
}

// Fungsi untuk mendapatkan daftar file backup
export async function getBackupFiles(req: Request, res: Response) {
  try {
    // Baca daftar file di direktori backup
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        
        return {
          filename: file,
          size: stats.size,
          created: stats.birthtime
        };
      })
      .sort((a, b) => (b.created as any) - (a.created as any)); // Urutkan dari terbaru
    
    return res.status(200).json({
      success: true,
      files
    });
  } catch (error: any) {
    console.error('Error saat mendapatkan daftar file backup:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mendapatkan daftar file backup: ' + error.message
    });
  }
}

// Fungsi untuk mengunduh file backup
export async function downloadBackup(req: Request, res: Response) {
  try {
    const { filename } = req.params;
    const filePath = path.join(BACKUP_DIR, filename);
    
    // Pastikan file ada
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File backup tidak ditemukan'
      });
    }
    
    // Kirim file sebagai respons
    return res.download(filePath);
  } catch (error: any) {
    console.error('Error saat mengunduh file backup:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengunduh file backup: ' + error.message
    });
  }
}

// Fungsi untuk menghapus file backup
export async function deleteBackup(req: Request, res: Response) {
  try {
    const { filename } = req.params;
    const filePath = path.join(BACKUP_DIR, filename);
    
    // Pastikan file ada
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File backup tidak ditemukan'
      });
    }
    
    // Hapus file
    fs.unlinkSync(filePath);
    
    return res.status(200).json({
      success: true,
      message: 'File backup berhasil dihapus'
    });
  } catch (error: any) {
    console.error('Error saat menghapus file backup:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal menghapus file backup: ' + error.message
    });
  }
}

// Fungsi untuk memulihkan data dari file backup
export async function restoreData(req: Request, res: Response) {
  try {
    const { filename } = req.params;
    const filePath = path.join(BACKUP_DIR, filename);
    
    // Pastikan file ada
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File backup tidak ditemukan'
      });
    }
    
    // Baca konten file
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent);
    
    // Hapus semua data yang ada terlebih dahulu (dalam transaksi)
    // Catatan: Urutan penghapusan penting karena foreign key constraints
    await db.transaction(async (tx) => {
      // Hapus dalam urutan terbalik dari dependensi
      await tx.delete(appointments);
      await tx.delete(registrationLinks);
      await tx.delete(sessions);
      await tx.delete(transactions);
      await tx.delete(therapySlots);
      await tx.delete(patients);
      await tx.delete(products);
      await tx.delete(packages);
      // Jangan hapus users untuk menjaga kredensial login
      
      // Masukkan data yang di-backup
      if (data.products?.length) await tx.insert(products).values(data.products);
      if (data.packages?.length) await tx.insert(packages).values(data.packages);
      if (data.patients?.length) await tx.insert(patients).values(data.patients);
      if (data.therapySlots?.length) await tx.insert(therapySlots).values(data.therapySlots);
      if (data.transactions?.length) await tx.insert(transactions).values(data.transactions);
      if (data.sessions?.length) await tx.insert(sessions).values(data.sessions);
      if (data.registrationLinks?.length) await tx.insert(registrationLinks).values(data.registrationLinks);
      if (data.appointments?.length) await tx.insert(appointments).values(data.appointments);
      
      // Hanya update user jika ada perbedaan data (jangan ganti password)
      if (data.users?.length) {
        for (const backupUser of data.users) {
          const existingUser = await tx.select().from(users).where(eq(users.id, backupUser.id));
          if (existingUser.length === 0) {
            // User tidak ada, tambahkan
            await tx.insert(users).values(backupUser);
          }
          // Untuk user yang sudah ada, kita biarkan karena tidak ingin reset password
        }
      }
    });
    
    return res.status(200).json({
      success: true,
      message: 'Data berhasil dipulihkan',
      summary: {
        users: data.users?.length || 0,
        patients: data.patients?.length || 0,
        products: data.products?.length || 0,
        packages: data.packages?.length || 0,
        transactions: data.transactions?.length || 0,
        sessions: data.sessions?.length || 0,
        therapySlots: data.therapySlots?.length || 0,
        appointments: data.appointments?.length || 0,
        registrationLinks: data.registrationLinks?.length || 0,
      }
    });
  } catch (error: any) {
    console.error('Error saat memulihkan data:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memulihkan data: ' + error.message
    });
  }
}

// Fungsi untuk upload file backup
export async function uploadBackup(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Tidak ada file yang diunggah'
      });
    }
    
    const { originalname, path: tempPath } = req.file;
    
    // Pastikan file berekstensi .json
    if (!originalname.endsWith('.json')) {
      // Hapus file temporary
      fs.unlinkSync(tempPath);
      return res.status(400).json({
        success: false,
        message: 'File harus berekstensi .json'
      });
    }
    
    // Validasi format file
    try {
      const fileContent = fs.readFileSync(tempPath, 'utf-8');
      const data = JSON.parse(fileContent);
      
      // Validasi struktur minimal
      if (!data.patients || !data.transactions || !data.products) {
        fs.unlinkSync(tempPath);
        return res.status(400).json({
          success: false,
          message: 'Format file backup tidak valid'
        });
      }
    } catch (error) {
      // Hapus file temporary jika validasi gagal
      fs.unlinkSync(tempPath);
      return res.status(400).json({
        success: false,
        message: 'File JSON tidak valid'
      });
    }
    
    // Pindahkan file ke direktori backup dengan nama yang sesuai
    const filename = `backup-${getFormattedDate()}.json`;
    const destPath = path.join(BACKUP_DIR, filename);
    
    fs.copyFileSync(tempPath, destPath);
    fs.unlinkSync(tempPath); // Hapus file temporary
    
    return res.status(200).json({
      success: true,
      message: 'File backup berhasil diunggah',
      filename
    });
  } catch (error: any) {
    console.error('Error saat mengunggah file backup:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengunggah file backup: ' + error.message
    });
  }
}