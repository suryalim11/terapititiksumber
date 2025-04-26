import React from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DuplicatePatients from "@/components/admin/duplicate-patients";
import { useAuth } from "@/lib/auth"; // Usando o hook de auth que já existe

export default function AdminPage() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();

  // Verificar se o usuário é admin
  if (user?.role !== 'admin') {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold text-red-600">Acesso Negado</h1>
        <p className="mt-2">Você não tem permissão para acessar esta página.</p>
        <Button onClick={() => setLocation("/")} className="mt-4">
          Voltar ao Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Administração do Sistema</h1>
        <Button onClick={() => setLocation("/")} variant="outline">
          Voltar ao Dashboard
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
              <Button variant="outline" className="justify-start">
                Periksa Integritas Sesi
              </Button>
              <Button variant="outline" className="justify-start">
                Sinkronkan Slot Terapi
              </Button>
              <Button variant="outline" className="justify-start">
                Perbaiki Inkonsistensi Tanggal
              </Button>
              <Button variant="outline" className="justify-start">
                Periksa Transaksi Tertunda
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold mb-4">Log Sistem</h2>
            <p className="text-gray-600">Belum diimplementasikan.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}