import React, { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Check, Trash2, ArrowLeft } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Spinner } from "@/components/ui/spinner";
import Layout from "@/components/layout/layout";

export default function DataCleanupPage() {
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Fungsi untuk menjalankan pembersihan data
  async function handleCleanupData() {
    if (!confirm("Apakah Anda yakin ingin menghapus semua data pasien contoh?\nTindakan ini tidak dapat dibatalkan!")) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Ambil ID pasien yang didaftarkan pengguna (bisa disesuaikan)
      // Di contoh ini, kami anggap pasien yang ingin dipertahankan adalah yang ID-nya >= 300
      const keepPatientIds = Array.from({ length: 100 }, (_, i) => i + 300);
      
      // Panggil API untuk membersihkan data
      const response = await apiRequest("/api/data-cleanup/sample-patients", {
        method: "POST",
        data: { keepPatientIds }
      });
      
      if (response && response.success) {
        setResult(response.results);
        toast({
          title: "Pembersihan Data Berhasil",
          description: `Berhasil menghapus ${response.results?.deletedPatients || 0} pasien contoh dan data terkait`,
        });
      } else {
        setError(response?.message || "Gagal membersihkan data");
      }
    } catch (err) {
      console.error("Error:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }
  
  return (
    <Layout>
      <div className="container px-4 py-6">
        <div className="flex flex-col space-y-1.5 mb-8">
          <h1 className="text-3xl font-bold">Pembersihan Data</h1>
          <p className="text-muted-foreground">
            Hapus data contoh dari sistem
          </p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pembersihan Data Pasien Contoh</CardTitle>
              <CardDescription>
                Hapus semua data pasien contoh yang dihasilkan sistem. Gunakan dengan hati-hati,
                tindakan ini tidak dapat dibatalkan.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Peringatan</AlertTitle>
                <AlertDescription>
                  Ini akan menghapus semua data pasien contoh beserta janji temu, transaksi, 
                  dan riwayat medis terkait. Hanya pasien yang Anda daftarkan sendiri yang akan dipertahankan.
                </AlertDescription>
              </Alert>
              
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              {result && (
                <div className="bg-green-50 p-4 rounded-md mb-4 dark:bg-green-900 dark:text-green-50">
                  <h3 className="text-green-800 dark:text-green-100 font-semibold flex items-center">
                    <Check className="mr-2 h-4 w-4" /> Pembersihan Data Berhasil
                  </h3>
                  <div className="mt-2">
                    <p>Total pasien dalam sistem: {result.totalPatients}</p>
                    <p>Pasien yang dihapus: {result.deletedPatients}</p>
                    <p>Janji temu yang dihapus: {result.deletedAppointments}</p>
                    <p>Transaksi yang dihapus: {result.deletedTransactions}</p>
                    <p>Sesi yang dihapus: {result.deletedSessions}</p>
                    <p>Riwayat medis yang dihapus: {result.deletedMedicalHistories}</p>
                    
                    {result.errors && result.errors.length > 0 && (
                      <div className="mt-2">
                        <p className="text-red-600 dark:text-red-300 font-semibold">Error yang terjadi:</p>
                        <ul className="list-disc pl-5">
                          {result.errors.map((error: any, idx: number) => (
                            <li key={idx}>{error.patientId} - {error.name}: {error.error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke Dashboard
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleCleanupData} 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Spinner className="mr-2" /> Sedang memproses...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" /> Hapus Data Pasien Contoh
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </Layout>
  );
}