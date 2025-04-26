import React, { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DuplicatePatients from "@/components/admin/duplicate-patients";
import SystemLogs from "@/components/admin/system-logs";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function AdminPage() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState<{
    sessions: boolean;
    slots: boolean;
    dates: boolean;
    transactions: boolean;
  }>({
    sessions: false,
    slots: false,
    dates: false,
    transactions: false
  });
  
  // Handler untuk memeriksa integritas sesi paket
  const handleCheckSessionIntegrity = async () => {
    try {
      setLoading(prev => ({ ...prev, sessions: true }));
      
      // Endpoint ini perlu dibuat jika belum ada
      const result = await apiRequest("/api/sessions/integrity-check", {
        method: "POST"
      });
      
      toast({
        title: "Pemeriksaan Selesai",
        description: result?.message || "Pemeriksaan integritas sesi selesai",
      });
      
      console.log("Hasil pemeriksaan integritas sesi:", result);
    } catch (error) {
      console.error("Error checking session integrity:", error);
      toast({
        title: "Terjadi Kesalahan",
        description: error instanceof Error ? error.message : "Tidak dapat memeriksa integritas sesi",
        variant: "destructive"
      });
    } finally {
      setLoading(prev => ({ ...prev, sessions: false }));
    }
  };
  
  // Handler untuk mensinkronkan slot terapi
  const handleSyncTherapySlots = async () => {
    try {
      setLoading(prev => ({ ...prev, slots: true }));
      
      const result = await apiRequest("/api/therapy-slots/sync-quota", {
        method: "POST"
      });
      
      toast({
        title: "Sinkronisasi Selesai",
        description: result?.message || "Slot terapi berhasil disinkronkan",
      });
      
      console.log("Hasil sinkronisasi slot terapi:", result);
    } catch (error) {
      console.error("Error syncing therapy slots:", error);
      toast({
        title: "Terjadi Kesalahan",
        description: error instanceof Error ? error.message : "Tidak dapat mensinkronkan slot terapi",
        variant: "destructive"
      });
    } finally {
      setLoading(prev => ({ ...prev, slots: false }));
    }
  };
  
  // Handler untuk memperbaiki inkonsistensi tanggal
  const handleFixDateInconsistencies = async () => {
    try {
      setLoading(prev => ({ ...prev, dates: true }));
      
      const result = await apiRequest("/api/appointments/resync", {
        method: "POST"
      });
      
      toast({
        title: "Perbaikan Selesai",
        description: result?.message || "Inkonsistensi tanggal berhasil diperbaiki",
      });
      
      console.log("Hasil perbaikan inkonsistensi tanggal:", result);
    } catch (error) {
      console.error("Error fixing date inconsistencies:", error);
      toast({
        title: "Terjadi Kesalahan",
        description: error instanceof Error ? error.message : "Tidak dapat memperbaiki inkonsistensi tanggal",
        variant: "destructive"
      });
    } finally {
      setLoading(prev => ({ ...prev, dates: false }));
    }
  };
  
  // Handler untuk memeriksa transaksi tertunda
  const handleCheckPendingTransactions = async () => {
    try {
      setLoading(prev => ({ ...prev, transactions: true }));
      
      // Endpoint ini perlu dibuat jika belum ada
      const result = await apiRequest("/api/transactions/fix-paid-status", {
        method: "POST"
      });
      
      toast({
        title: "Pemeriksaan Selesai",
        description: result?.message || "Transaksi tertunda berhasil diperiksa",
      });
      
      console.log("Hasil pemeriksaan transaksi tertunda:", result);
    } catch (error) {
      console.error("Error checking pending transactions:", error);
      toast({
        title: "Terjadi Kesalahan",
        description: error instanceof Error ? error.message : "Tidak dapat memeriksa transaksi tertunda",
        variant: "destructive"
      });
    } finally {
      setLoading(prev => ({ ...prev, transactions: false }));
    }
  };

  // Memeriksa apakah pengguna adalah admin
  if (user?.role !== 'admin') {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold text-red-600">Akses Ditolak</h1>
        <p className="mt-2">Anda tidak memiliki izin untuk mengakses halaman ini.</p>
        <Button onClick={() => setLocation("/")} className="mt-4">
          Kembali ke Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Administrasi Sistem</h1>
        <Button onClick={() => setLocation("/")} variant="outline">
          Kembali ke Dashboard
        </Button>
      </div>

      <Tabs defaultValue="duplicates" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="duplicates">Pasien Duplikat</TabsTrigger>
          <TabsTrigger value="database">Integritas Database</TabsTrigger>
          <TabsTrigger value="logs">Log Sistem</TabsTrigger>
        </TabsList>

        <TabsContent value="duplicates" className="space-y-4">
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold mb-4">Manajemen Pasien Duplikat</h2>
            <DuplicatePatients />
          </div>
        </TabsContent>

        <TabsContent value="database" className="space-y-4">
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold mb-4">Alat Database</h2>
            <p className="text-gray-600 mb-4">Bagian ini berisi alat untuk memeriksa dan memperbaiki integritas database.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                className="justify-start"
                onClick={handleCheckSessionIntegrity}
                disabled={loading.sessions}
              >
                {loading.sessions ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Memeriksa...
                  </>
                ) : (
                  "Periksa Integritas Sesi"
                )}
              </Button>
              <Button 
                variant="outline" 
                className="justify-start"
                onClick={handleSyncTherapySlots}
                disabled={loading.slots}
              >
                {loading.slots ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Menyinkronkan...
                  </>
                ) : (
                  "Sinkronkan Slot Terapi"
                )}
              </Button>
              <Button 
                variant="outline" 
                className="justify-start"
                onClick={handleFixDateInconsistencies}
                disabled={loading.dates}
              >
                {loading.dates ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Memperbaiki...
                  </>
                ) : (
                  "Perbaiki Inkonsistensi Tanggal"
                )}
              </Button>
              <Button 
                variant="outline" 
                className="justify-start"
                onClick={handleCheckPendingTransactions}
                disabled={loading.transactions}
              >
                {loading.transactions ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Memeriksa...
                  </>
                ) : (
                  "Periksa Transaksi Tertunda"
                )}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold mb-4">Log Sistem</h2>
            <SystemLogs />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}