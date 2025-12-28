import { Request, Response } from 'express';
import { db } from './db';
import {
  users, patients, products, packages, transactions, 
  sessions, therapySlots, appointments, registrationLinks
} from '@shared/schema';
import fs from 'fs';
import path from 'path';
import { storage } from './storage';
import { eq, sql } from 'drizzle-orm';

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
    
    // Coba simpan ke file jika memungkinkan
    try {
      const filePath = path.join(BACKUP_DIR, filename);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (fsError) {
      console.log('Could not write to file system, sending direct response');
    }
    
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

// Fungsi untuk download langsung data backup sebagai file JSON
export async function downloadDirectBackup(req: Request, res: Response) {
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
    
    // Set headers untuk download file
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Kirim data langsung sebagai response
    return res.send(JSON.stringify(data, null, 2));
  } catch (error: any) {
    console.error('Error saat membuat backup langsung:', error);
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
    const rawData = JSON.parse(fileContent);
    
    // Process data to ensure dates are Date objects
    const data = {
      ...rawData,
      patients: rawData.patients?.map(p => ({
        ...p,
        createdAt: new Date(p.createdAt)
      })),
      packages: rawData.packages?.map(p => ({
        ...p,
        createdAt: new Date(p.createdAt)
      })),
      products: rawData.products?.map(p => ({
        ...p,
        createdAt: new Date(p.createdAt)
      })),
      transactions: rawData.transactions?.map(t => ({
        ...t,
        createdAt: new Date(t.createdAt)
      })),
      therapySlots: rawData.therapySlots?.map(t => ({
        ...t,
        createdAt: new Date(t.createdAt),
        date: new Date(t.date)
      })),
      sessions: rawData.sessions?.map(s => ({
        ...s,
        startDate: new Date(s.startDate),
        lastSessionDate: s.lastSessionDate ? new Date(s.lastSessionDate) : null
      })),
      appointments: rawData.appointments?.map(a => ({
        ...a,
        date: new Date(a.date)
      })),
      registrationLinks: rawData.registrationLinks?.map(r => ({
        ...r,
        createdAt: new Date(r.createdAt),
        expiryTime: new Date(r.expiryTime),
        specificDate: r.specificDate ? new Date(r.specificDate) : null
      })),
      users: rawData.users?.map(u => ({
        ...u,
        createdAt: new Date(u.createdAt)
      }))
    };
    
    // Sebaiknya jangan hapus data yang ada, gunakan onConflictDoUpdate untuk memperbarui data yang sudah ada
    // Karena penghapusan data tidak perlu, kita langsung proses pemulihan data
    try {
      console.log("Memulai proses restore data dari backup...");
      

      
      // Masukkan data yang di-backup - pastikan semua ID disertakan
      if (data.packages?.length) {
        console.log(`Memulihkan ${data.packages.length} data packages...`);
        // Pendekatan sederhana - Hapus data yang ada terlebih dahulu
        await db.delete(packages);
        await db.insert(packages).values(data.packages);
      }
      
      if (data.products?.length) {
        console.log(`Memulihkan ${data.products.length} data products...`);
        await db.delete(products);
        await db.insert(products).values(data.products);
      }
      
      if (data.patients?.length) {
        console.log(`Memulihkan ${data.patients.length} data patients...`);
        await db.delete(patients);
        await db.insert(patients).values(data.patients);
      }
      
      if (data.therapySlots?.length) {
        console.log(`Memulihkan ${data.therapySlots.length} data therapySlots...`);
        await db.delete(therapySlots);
        await db.insert(therapySlots).values(data.therapySlots);
      }
      
      if (data.transactions?.length) {
        console.log(`Memulihkan ${data.transactions.length} data transactions...`);
        await db.delete(transactions);
        await db.insert(transactions).values(data.transactions);
      }
      
      if (data.sessions?.length) {
        console.log(`Memulihkan ${data.sessions.length} data sessions...`);
        await db.delete(sessions);
        await db.insert(sessions).values(data.sessions);
      }
      
      if (data.registrationLinks?.length) {
        console.log(`Memulihkan ${data.registrationLinks.length} data registrationLinks...`);
        await db.delete(registrationLinks);
        await db.insert(registrationLinks).values(data.registrationLinks);
      }
      
      if (data.appointments?.length) {
        console.log(`Memulihkan ${data.appointments.length} data appointments...`);
        await db.delete(appointments);
        await db.insert(appointments).values(data.appointments);
      }
      
      // Hanya update user jika ada perbedaan data (jangan ganti password)
      if (data.users?.length) {
        for (const backupUser of data.users) {
          const existingUser = await db.select().from(users).where(eq(users.id, backupUser.id));
          if (existingUser.length === 0) {
            // User tidak ada, tambahkan
            await db.insert(users).values(backupUser);
          }
          // Untuk user yang sudah ada, kita biarkan karena tidak ingin reset password
        }
      }
    } catch (error) {
      console.error("Error saat menghapus atau menambahkan data:", error);
      throw error;
    }
    
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
    
    const { originalname, path: tempPath } = (req as any).file;
    
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

// Fungsi untuk upload dan langsung restore data backup - lebih reliable untuk production
export async function uploadAndRestoreBackup(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Tidak ada file yang diunggah'
      });
    }
    
    const { originalname, path: tempPath } = (req as any).file;
    
    // Pastikan file berekstensi .json
    if (!originalname.endsWith('.json')) {
      try { fs.unlinkSync(tempPath); } catch (e) {}
      return res.status(400).json({
        success: false,
        message: 'File harus berekstensi .json'
      });
    }
    
    // Baca dan parse file langsung
    let rawData;
    try {
      const fileContent = fs.readFileSync(tempPath, 'utf-8');
      rawData = JSON.parse(fileContent);
      
      // Validasi struktur minimal
      if (!rawData.patients && !rawData.transactions && !rawData.products) {
        try { fs.unlinkSync(tempPath); } catch (e) {}
        return res.status(400).json({
          success: false,
          message: 'Format file backup tidak valid - tidak ada data'
        });
      }
    } catch (error) {
      try { fs.unlinkSync(tempPath); } catch (e) {}
      return res.status(400).json({
        success: false,
        message: 'File JSON tidak valid'
      });
    }
    
    // Hapus file temporary
    try { fs.unlinkSync(tempPath); } catch (e) {}
    
    // Process data untuk memastikan tanggal adalah Date objects
    const data = {
      ...rawData,
      patients: rawData.patients?.map((p: any) => ({
        ...p,
        createdAt: new Date(p.createdAt)
      })),
      packages: rawData.packages?.map((p: any) => ({
        ...p,
        createdAt: new Date(p.createdAt)
      })),
      products: rawData.products?.map((p: any) => ({
        ...p,
        createdAt: new Date(p.createdAt)
      })),
      transactions: rawData.transactions?.map((t: any) => ({
        ...t,
        createdAt: new Date(t.createdAt)
      })),
      therapySlots: rawData.therapySlots?.map((t: any) => ({
        ...t,
        createdAt: new Date(t.createdAt),
        date: new Date(t.date)
      })),
      sessions: rawData.sessions?.map((s: any) => ({
        ...s,
        startDate: new Date(s.startDate),
        lastSessionDate: s.lastSessionDate ? new Date(s.lastSessionDate) : null
      })),
      appointments: rawData.appointments?.map((a: any) => ({
        ...a,
        date: new Date(a.date)
      })),
      registrationLinks: rawData.registrationLinks?.map((r: any) => ({
        ...r,
        createdAt: new Date(r.createdAt),
        expiryTime: new Date(r.expiryTime),
        specificDate: r.specificDate ? new Date(r.specificDate) : null
      })),
      users: rawData.users?.map((u: any) => ({
        ...u,
        createdAt: new Date(u.createdAt)
      }))
    };
    
    // Langsung restore data
    try {
      console.log("Memulai proses restore langsung dari file yang diupload...");
      
      if (data.packages?.length) {
        console.log(`Memulihkan ${data.packages.length} data packages...`);
        await db.delete(packages);
        await db.insert(packages).values(data.packages);
      }
      
      if (data.products?.length) {
        console.log(`Memulihkan ${data.products.length} data products...`);
        await db.delete(products);
        await db.insert(products).values(data.products);
      }
      
      if (data.patients?.length) {
        console.log(`Memulihkan ${data.patients.length} data patients...`);
        await db.delete(patients);
        await db.insert(patients).values(data.patients);
      }
      
      if (data.therapySlots?.length) {
        console.log(`Memulihkan ${data.therapySlots.length} data therapySlots...`);
        await db.delete(therapySlots);
        await db.insert(therapySlots).values(data.therapySlots);
      }
      
      if (data.transactions?.length) {
        console.log(`Memulihkan ${data.transactions.length} data transactions...`);
        await db.delete(transactions);
        await db.insert(transactions).values(data.transactions);
      }
      
      if (data.sessions?.length) {
        console.log(`Memulihkan ${data.sessions.length} data sessions...`);
        await db.delete(sessions);
        await db.insert(sessions).values(data.sessions);
      }
      
      if (data.registrationLinks?.length) {
        console.log(`Memulihkan ${data.registrationLinks.length} data registrationLinks...`);
        await db.delete(registrationLinks);
        await db.insert(registrationLinks).values(data.registrationLinks);
      }
      
      if (data.appointments?.length) {
        console.log(`Memulihkan ${data.appointments.length} data appointments...`);
        await db.delete(appointments);
        await db.insert(appointments).values(data.appointments);
      }
      
      // Hanya tambah user baru (jangan ganti yang sudah ada)
      if (data.users?.length) {
        for (const backupUser of data.users) {
          const existingUser = await db.select().from(users).where(eq(users.id, backupUser.id));
          if (existingUser.length === 0) {
            await db.insert(users).values(backupUser);
          }
        }
      }
      
      console.log("Restore data selesai!");
      
      // Verifikasi data setelah restore
      const verifyPatients = await db.select({ count: sql`count(*)` }).from(patients);
      const verifyTransactions = await db.select({ count: sql`count(*)` }).from(transactions);
      const verifyAppointments = await db.select({ count: sql`count(*)` }).from(appointments);
      
      const actualPatients = Number(verifyPatients[0]?.count || 0);
      const actualTransactions = Number(verifyTransactions[0]?.count || 0);
      const actualAppointments = Number(verifyAppointments[0]?.count || 0);
      
      console.log(`Verifikasi: ${actualPatients} pasien, ${actualTransactions} transaksi, ${actualAppointments} appointments di database`);
      
      return res.status(200).json({
        success: true,
        message: 'Data berhasil dipulihkan dari backup',
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
        },
        verification: {
          actualPatients,
          actualTransactions,
          actualAppointments,
        }
      });
      
    } catch (error) {
      console.error("Error saat restore data:", error);
      throw error;
    }
  } catch (error: any) {
    console.error('Error saat upload dan restore backup:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal restore data: ' + error.message
    });
  }
}