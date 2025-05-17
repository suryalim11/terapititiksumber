import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { WebSocketSlotProvider } from '../components/dashboard/WebSocketSlotProvider';
import { WebSocketSlotDialog } from '../components/dashboard/WebSocketSlotDialog';
import { Input } from '@/components/ui/input';
import { RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

const WebSocketSlotDashboard: React.FC = () => {
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [manualSlotId, setManualSlotId] = useState<string>('');

  // Ambil daftar slot terapi hari ini untuk demo
  const { data: todaySlots, isLoading } = useQuery<any[]>({
    queryKey: ['/api/therapy-slots'],
    staleTime: 30000, // 30 detik
  });

  const formatTanggal = (tanggalStr: string) => {
    try {
      const tanggal = new Date(tanggalStr);
      return format(tanggal, 'dd MMM yyyy', { locale: localeId });
    } catch (error) {
      return tanggalStr;
    }
  };

  const handleOpenSlot = (slotId: number) => {
    setSelectedSlotId(slotId);
    setIsDialogOpen(true);
  };

  const handleManualOpen = () => {
    if (manualSlotId && !isNaN(parseInt(manualSlotId))) {
      handleOpenSlot(parseInt(manualSlotId));
    }
  };

  return (
    <WebSocketSlotProvider>
      <div className="container py-6">
        <h1 className="text-3xl font-bold mb-6">Dashboard Slot Terapi (WebSocket)</h1>
        
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Coba Langsung WebSocket</CardTitle>
              <CardDescription>
                Masukkan ID slot terapi yang ingin Anda lihat secara real-time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Input 
                  type="number" 
                  placeholder="ID Slot Terapi" 
                  value={manualSlotId}
                  onChange={(e) => setManualSlotId(e.target.value)}
                />
                <Button onClick={handleManualOpen}>
                  Buka Slot
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <h2 className="text-xl font-semibold mb-4">Slot Terapi Hari Ini</h2>
        
        {isLoading ? (
          <div className="flex justify-center my-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Memuat slot terapi...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.isArray(todaySlots) ? todaySlots.map((slot: any) => (
              <Card key={slot.id} className={slot.isActive ? 'border-green-500' : 'border-red-500'}>
                <CardHeader>
                  <CardTitle>
                    {slot.isActive ? '🟢 ' : '🔴 '}
                    Slot {slot.timeSlot}
                  </CardTitle>
                  <CardDescription>
                    {formatTanggal(slot.date)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-500">ID:</span>
                      <span>{slot.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Terisi:</span>
                      <span>{slot.currentCount} / {slot.maxQuota}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Status:</span>
                      <span>{slot.isActive ? 'Aktif' : 'Nonaktif'}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full" 
                    variant="outline" 
                    onClick={() => handleOpenSlot(slot.id)}
                  >
                    Lihat Data Real-time
                  </Button>
                </CardFooter>
              </Card>
            )) : null}
            
            {Array.isArray(todaySlots) && todaySlots.length === 0 && (
              <div className="col-span-full text-center text-gray-500 py-8">
                Tidak ada slot terapi untuk hari ini
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Dialog WebSocket yang menggunakan provider */}
      <WebSocketSlotDialog 
        slotId={selectedSlotId}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
    </WebSocketSlotProvider>
  );
};

export default WebSocketSlotDashboard;