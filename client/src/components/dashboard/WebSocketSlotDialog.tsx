import React, { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWebSocketSlot } from './WebSocketSlotProvider';
import { Progress } from "@/components/ui/progress";
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toast } from "@/hooks/use-toast";
import { Clipboard, CheckSquare, AlertCircle } from "lucide-react";

interface WebSocketSlotDialogProps {
  slotId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export const WebSocketSlotDialog: React.FC<WebSocketSlotDialogProps> = ({
  slotId, 
  isOpen, 
  onClose
}) => {
  const { 
    slotData, 
    appointments, 
    patients, 
    isConnected,
    isLoading, 
    error, 
    dataStage,
    connectToSlot,
    disconnectFromSlot
  } = useWebSocketSlot();

  // Koneksi ke slot saat dialog dibuka
  useEffect(() => {
    if (isOpen && slotId) {
      connectToSlot(slotId);
    }
    
    return () => {
      disconnectFromSlot();
    };
  }, [isOpen, slotId, connectToSlot, disconnectFromSlot]);

  const handleClose = () => {
    disconnectFromSlot();
    onClose();
  };

  const formatTanggal = (tanggalStr: string) => {
    try {
      const tanggal = new Date(tanggalStr);
      return format(tanggal, 'EEEE, dd MMMM yyyy', { locale: localeId });
    } catch (error) {
      return tanggalStr;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        toast({
          title: "Berhasil disalin",
          description: "Teks telah disalin ke clipboard",
        });
      })
      .catch((err) => {
        console.error('Gagal menyalin: ', err);
        toast({
          title: "Gagal menyalin",
          description: "Terjadi kesalahan saat menyalin ke clipboard",
          variant: "destructive"
        });
      });
  };

  // Tunjukkan placeholder saat loading awal
  if ((isLoading || dataStage === 'loading' || dataStage === 'idle') && !slotData) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Memuat Slot Terapi...</DialogTitle>
            <DialogDescription>
              <div className="flex flex-col items-center justify-center space-y-4 py-8">
                <div className="w-full h-6 bg-gray-200 rounded-full dark:bg-gray-700 animate-pulse" />
                <div className="w-full h-6 bg-gray-200 rounded-full dark:bg-gray-700 animate-pulse" />
                <div className="w-3/4 h-6 bg-gray-200 rounded-full dark:bg-gray-700 animate-pulse" />
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  // Tampilkan error jika terjadi kesalahan
  if (error) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-red-500 flex items-center gap-2">
              <AlertCircle size={18} /> Error
            </DialogTitle>
            <DialogDescription className="text-red-500">
              Terjadi kesalahan saat memuat data slot terapi: {error}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p>Silakan tutup dialog ini dan coba lagi. Jika masalah berlanjut, hubungi administrator.</p>
          </div>
          <DialogFooter>
            <Button onClick={handleClose}>Tutup</Button>
            <Button onClick={() => slotId && connectToSlot(slotId)} variant="outline">
              Coba Lagi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {slotData?.isActive ? '🟢 ' : '🔴 '}
            Slot {slotData?.timeSlot} - {formatTanggal(slotData?.date || '')}
          </DialogTitle>
          <DialogDescription>
            <div className="mt-2 flex items-center gap-2">
              <div className="text-sm">
                Status koneksi: {isConnected ? 
                  <span className="text-green-500 font-medium">Terhubung</span> : 
                  <span className="text-red-500 font-medium">Terputus</span>}
              </div>
              
              {/* Indikator loading progresif */}
              {(isLoading || dataStage !== 'full') && (
                <div className="mt-2 flex-grow">
                  <div className="mb-2 flex justify-between text-xs">
                    <span>
                      {dataStage === 'loading' && 'Memulai koneksi...'}
                      {dataStage === 'basic' && 'Memuat data dasar...'}
                      {dataStage === 'partial' && 'Memuat data appointment...'}
                      {dataStage === 'full' && 'Selesai!'}
                    </span>
                    <span>
                      {dataStage === 'loading' && '25%'}
                      {dataStage === 'basic' && '50%'}
                      {dataStage === 'partial' && '75%'}
                      {dataStage === 'full' && '100%'}
                    </span>
                  </div>
                  <Progress 
                    value={
                      dataStage === 'loading' ? 25 :
                      dataStage === 'basic' ? 50 :
                      dataStage === 'partial' ? 75 : 100
                    } 
                    className="h-2"
                  />
                </div>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="info" className="flex-grow flex flex-col max-h-[calc(80vh-10rem)]">
          <TabsList className="mb-2">
            <TabsTrigger value="info">Informasi Slot</TabsTrigger>
            <TabsTrigger value="patients">
              Daftar Pasien ({patients.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="flex-grow overflow-hidden">
            <ScrollArea className="h-full pr-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">Informasi Umum</h3>
                    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">ID Slot</div>
                        <div className="text-sm flex items-center gap-1">
                          {slotData?.id || '-'}
                          <button 
                            className="text-gray-500 hover:text-gray-700"
                            onClick={() => copyToClipboard(slotData?.id?.toString() || '')}
                          >
                            <Clipboard size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Tanggal</div>
                        <div className="text-sm">{formatTanggal(slotData?.date || '')}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Jam</div>
                        <div className="text-sm">{slotData?.timeSlot || '-'}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Status</div>
                        <div className="text-sm">{slotData?.isActive ? 'Aktif' : 'Tidak Aktif'}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">Kapasitas</h3>
                    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Kuota Maksimal</div>
                        <div className="text-sm">{slotData?.maxQuota || 0}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Terisi</div>
                        <div className="text-sm">{slotData?.currentCount || 0}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Sisa</div>
                        <div className="text-sm">{(slotData?.maxQuota || 0) - (slotData?.currentCount || 0)}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Persentase Isi</div>
                        <div className="text-sm">
                          {slotData?.maxQuota 
                            ? Math.round((slotData.currentCount / slotData.maxQuota) * 100) 
                            : 0}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Status Appointment</h3>
                  <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Total</div>
                      <div className="text-sm">{appointments.length}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Terjadwal</div>
                      <div className="text-sm">
                        {appointments.filter(a => a.status === 'Scheduled').length}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Aktif</div>
                      <div className="text-sm">
                        {appointments.filter(a => a.status === 'Active').length}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Selesai</div>
                      <div className="text-sm">
                        {appointments.filter(a => a.status === 'Completed').length}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="patients" className="flex-grow overflow-hidden">
            <ScrollArea className="h-full pr-4">
              {patients.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-gray-500">Belum ada pasien terdaftar di slot ini</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {patients.map((patient) => (
                    <div 
                      key={`${patient.id}-${patient.appointmentId}`}
                      className="p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-medium flex items-center gap-2">
                          {patient.name}
                          {patient.appointmentStatus === 'Active' && (
                            <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                              Aktif
                            </span>
                          )}
                          {patient.appointmentStatus === 'Scheduled' && (
                            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                              Terjadwal
                            </span>
                          )}
                          {patient.appointmentStatus === 'Completed' && (
                            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">
                              Selesai
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {patient.id}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <div className="text-sm">
                          <span className="text-gray-500">Telepon:</span> {patient.phone}
                        </div>
                        <div className="text-sm">
                          <span className="text-gray-500">Appointment ID:</span> {patient.appointmentId}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button onClick={handleClose} variant="outline">
            Tutup
          </Button>
          <Button 
            onClick={() => slotId && connectToSlot(slotId)} 
            variant="default" 
            disabled={isLoading}
          >
            Segarkan Data
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};