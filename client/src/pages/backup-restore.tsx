import React, { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { AlertCircle, Check, Loader2, Upload, Download, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { formatDate } from "@/lib/utils";

interface BackupFile {
  filename: string;
  size: number;
  created: string;
}

interface BackupSummary {
  users: number;
  patients: number;
  products: number;
  packages: number;
  transactions: number;
  sessions: number;
  therapySlots: number;
  appointments: number;
  registrationLinks: number;
}

export default function BackupRestorePage() {
  const { toast } = useToast();
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [backupFiles, setBackupFiles] = useState<BackupFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [backupSummary, setBackupSummary] = useState<BackupSummary | null>(null);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Ambil daftar file backup saat komponen dimuat
  useEffect(() => {
    fetchBackupFiles();
  }, []);

  const fetchBackupFiles = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      const response = await fetch("/api/backup/files");
      const data = await response.json();
      
      if (data.success && data.files) {
        setBackupFiles(data.files);
      } else {
        throw new Error(data.message || "Gagal mengambil daftar file backup");
      }
    } catch (error: any) {
      console.error("Error fetching backup files:", error);
      setErrorMessage(error.message || "Terjadi kesalahan saat mengambil daftar file backup");
    } finally {
      setIsLoading(false);
    }
  };

  const createBackup = async () => {
    setIsCreatingBackup(true);
    
    try {
      const response = await fetch("/api/backup/export", {
        method: "POST",
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Backup berhasil dibuat",
          description: `File: ${data.filename}`,
        });
        
        // Perbarui daftar file
        fetchBackupFiles();
        
        // Tampilkan ringkasan data
        setBackupSummary(data.summary);
      } else {
        throw new Error(data.message || "Gagal membuat backup");
      }
    } catch (error: any) {
      console.error("Error creating backup:", error);
      toast({
        variant: "destructive",
        title: "Gagal membuat backup",
        description: error.message || "Terjadi kesalahan saat membuat backup",
      });
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const downloadBackup = (filename: string) => {
    // Buat URL untuk mengunduh file
    const downloadUrl = `/api/backup/download/${filename}`;
    
    // Buka URL di tab baru atau unduh langsung
    window.open(downloadUrl, "_blank");
  };

  const deleteBackup = async (filename: string) => {
    try {
      const response = await fetch(`/api/backup/files/${filename}`, {
        method: "DELETE",
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "File backup berhasil dihapus",
        });
        
        // Perbarui daftar file
        fetchBackupFiles();
      } else {
        throw new Error(data.message || "Gagal menghapus file backup");
      }
    } catch (error: any) {
      console.error("Error deleting backup:", error);
      toast({
        variant: "destructive",
        title: "Gagal menghapus file backup",
        description: error.message || "Terjadi kesalahan saat menghapus file backup",
      });
    }
  };

  const restoreBackup = async (filename: string) => {
    setIsRestoring(true);
    
    try {
      const response = await fetch(`/api/backup/restore/${filename}`, {
        method: "POST",
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Data berhasil dipulihkan",
          description: "Sistem telah memulihkan data dari backup yang dipilih.",
        });
        
        // Tampilkan ringkasan data
        setBackupSummary(data.summary);
      } else {
        throw new Error(data.message || "Gagal memulihkan data");
      }
    } catch (error: any) {
      console.error("Error restoring backup:", error);
      toast({
        variant: "destructive",
        title: "Gagal memulihkan data",
        description: error.message || "Terjadi kesalahan saat memulihkan data",
      });
    } finally {
      setIsRestoring(false);
      setSelectedFile(null); // Tutup dialog konfirmasi
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFileToUpload(e.target.files[0]);
    }
  };

  const uploadBackup = async () => {
    if (!fileToUpload) {
      toast({
        variant: "destructive",
        title: "Tidak ada file yang dipilih",
        description: "Silakan pilih file backup untuk diunggah",
      });
      return;
    }
    
    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append("backupFile", fileToUpload);
      
      // Gunakan endpoint upload-and-restore yang langsung merestore data
      const response = await fetch("/api/backup/upload-and-restore", {
        method: "POST",
        body: formData,
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Tampilkan verification jika ada (data aktual di database)
        const verifyInfo = data.verification 
          ? `\n\nVerifikasi Database:\n- Pasien aktual: ${data.verification.actualPatients}\n- Transaksi aktual: ${data.verification.actualTransactions}\n- Janji temu aktual: ${data.verification.actualAppointments}`
          : '';
        
        toast({
          title: "Data berhasil dipulihkan dari backup",
          description: `Berhasil memulihkan ${data.summary?.patients || 0} pasien, ${data.summary?.transactions || 0} transaksi${verifyInfo}`,
        });
        
        // Log verification untuk debugging
        console.log("Restore verification:", data.verification);
        
        // Alert jika ada perbedaan antara summary dan verification
        if (data.verification && data.verification.actualPatients !== data.summary?.patients) {
          alert(`PERHATIAN: Data tidak sinkron!\n\nDari file backup: ${data.summary?.patients} pasien\nDi database: ${data.verification.actualPatients} pasien\n\nSilakan hubungi administrator.`);
        }
        
        // Reset file input
        setFileToUpload(null);
        
        // Tampilkan ringkasan data
        setBackupSummary(data.summary);
        
        // Perbarui daftar file
        fetchBackupFiles();
      } else {
        throw new Error(data.message || "Gagal mengunggah dan memulihkan data");
      }
    } catch (error: any) {
      console.error("Error uploading backup:", error);
      toast({
        variant: "destructive",
        title: "Gagal mengunggah file backup",
        description: error.message || "Terjadi kesalahan saat mengunggah file backup",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Fungsi untuk format ukuran file ke KB, MB, dll
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " bytes";
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    else if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + " MB";
    else return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  };

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Backup & Restore</h1>
        <p className="text-gray-500">
          Buat cadangan data aplikasi atau pulihkan dari backup yang tersedia.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Card untuk membuat backup baru */}
        <Card>
          <CardHeader>
            <CardTitle>Backup Baru</CardTitle>
            <CardDescription>
              Buat cadangan data aplikasi saat ini
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-gray-600">
              Backup akan menyimpan seluruh data aplikasi, termasuk:
            </p>
            <ul className="list-disc pl-5 text-sm text-gray-600 mb-4">
              <li>Data pasien</li>
              <li>Riwayat transaksi</li>
              <li>Produk dan paket</li>
              <li>Slot terapi dan janji temu</li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button onClick={createBackup} disabled={isCreatingBackup} className="w-full">
              {isCreatingBackup ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Membuat Backup...
                </>
              ) : (
                "Buat Backup Sekarang"
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Card untuk upload backup file */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Backup</CardTitle>
            <CardDescription>
              Unggah file backup yang sudah dibuat sebelumnya
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <label htmlFor="backupFile" className="block text-sm font-medium text-gray-700 mb-2">
                Pilih file backup (.json)
              </label>
              <input
                type="file"
                id="backupFile"
                accept=".json"
                onChange={handleFileChange}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
            </div>
            {fileToUpload && (
              <p className="text-sm text-gray-500 mb-4">
                File yang dipilih: {fileToUpload.name} ({formatFileSize(fileToUpload.size)})
              </p>
            )}
          </CardContent>
          <CardFooter>
            <Button 
              onClick={uploadBackup} 
              disabled={isUploading || !fileToUpload} 
              className="w-full"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Mengunggah...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Unggah Backup
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Card untuk menampilkan ringkasan backup */}
        <Card>
          <CardHeader>
            <CardTitle>Ringkasan Data</CardTitle>
            <CardDescription>
              Informasi tentang data yang di-backup/restore terakhir
            </CardDescription>
          </CardHeader>
          <CardContent>
            {backupSummary ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="text-sm">Pengguna:</div>
                <div className="text-sm font-medium">{backupSummary.users}</div>
                
                <div className="text-sm">Pasien:</div>
                <div className="text-sm font-medium">{backupSummary.patients}</div>
                
                <div className="text-sm">Produk:</div>
                <div className="text-sm font-medium">{backupSummary.products}</div>
                
                <div className="text-sm">Paket:</div>
                <div className="text-sm font-medium">{backupSummary.packages}</div>
                
                <div className="text-sm">Transaksi:</div>
                <div className="text-sm font-medium">{backupSummary.transactions}</div>
                
                <div className="text-sm">Sesi:</div>
                <div className="text-sm font-medium">{backupSummary.sessions}</div>
                
                <div className="text-sm">Slot Terapi:</div>
                <div className="text-sm font-medium">{backupSummary.therapySlots}</div>
                
                <div className="text-sm">Janji Temu:</div>
                <div className="text-sm font-medium">{backupSummary.appointments}</div>
                
                <div className="text-sm">Link Pendaftaran:</div>
                <div className="text-sm font-medium">{backupSummary.registrationLinks}</div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                Belum ada informasi tersedia. Buat atau pulihkan backup untuk melihat ringkasan data.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog konfirmasi restore */}
      <Dialog open={!!selectedFile} onOpenChange={(open) => !open && setSelectedFile(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Pemulihan Data</DialogTitle>
            <DialogDescription>
              Anda akan memulihkan data dari file backup: <br />
              <strong>{selectedFile}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Perhatian!</AlertTitle>
              <AlertDescription>
                Proses ini akan menimpa seluruh data aplikasi saat ini dan tidak dapat dibatalkan.
                Data user dan password login tidak akan berubah.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Batal</Button>
            </DialogClose>
            <Button 
              variant="destructive" 
              onClick={() => selectedFile && restoreBackup(selectedFile)}
              disabled={isRestoring}
            >
              {isRestoring ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Memulihkan Data...
                </>
              ) : (
                "Ya, Pulihkan Data"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tabel daftar file backup */}
      <div className="mt-10">
        <h2 className="text-xl font-bold mb-4">Daftar File Backup</h2>
        
        {errorMessage && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}
        
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : backupFiles && backupFiles.length > 0 ? (
          <Table>
            <TableCaption>Daftar file backup yang tersedia</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Nama File</TableHead>
                <TableHead>Ukuran</TableHead>
                <TableHead>Tanggal Dibuat</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {backupFiles.map((file) => (
                <TableRow key={file.filename}>
                  <TableCell className="font-medium">{file.filename}</TableCell>
                  <TableCell>{formatFileSize(file.size)}</TableCell>
                  <TableCell>{formatDate(new Date(file.created))}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadBackup(file.filename)}
                        title="Download backup file"
                      >
                        <Download className="h-4 w-4 mr-1" />
                        <span className="hidden md:inline">Unduh</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedFile(file.filename)}
                        title="Restore data from this backup file"
                        className="text-blue-500 hover:text-blue-700"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        <span className="hidden md:inline">Restore</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteBackup(file.filename)}
                        title="Delete this backup file"
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        <span className="hidden md:inline">Hapus</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center py-8 text-gray-500">
            Belum ada file backup yang tersedia.
          </p>
        )}
      </div>
    </div>
  );
}