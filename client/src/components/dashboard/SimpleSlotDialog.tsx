/**
 * Versi sederhana dan teroptimasi dari dialog slot terapi
 * Menggunakan pendekatan loading progresif dan API cepat
 */

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SlotDataProvider, useSlotData } from './SlotDataProvider';
import { ProgressiveLoadingIndicator } from './ProgressiveLoadingIndicator';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Clock, RefreshCw, Users } from 'lucide-react';

// Pemetaan status ke warna badge
const statusColors: Record<string, string> = {
  'Active': 'bg-green-500',
  'Confirmed': 'bg-blue-500',
  'Pending': 'bg-yellow-500',
  'Cancelled': 'bg-red-500',
  'Completed': 'bg-purple-500',
  'Scheduled': 'bg-indigo-500',
  'No-show': 'bg-gray-500',
};

// Props komponen dialog utama
interface SimpleSlotDialogProps {
  slotId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

// Wrapper dialog dengan provider data
export function SimpleSlotDialog({ slotId, isOpen, onClose }: SimpleSlotDialogProps) {
  // Reset bila dialog ditutup
  useEffect(() => {
    if (!isOpen) {
      // Tanpa efek disini, hanya membersihkan dialog bila tertutup
    }
  }, [isOpen]);
  
  if (!isOpen || !slotId) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <SlotDataProvider initialSlotId={slotId}>
          <SimpleSlotDialogContent onClose={onClose} />
        </SlotDataProvider>
      </DialogContent>
    </Dialog>
  );
}

// Konten dialog yang menggunakan SlotDataProvider
function SimpleSlotDialogContent({ onClose }: { onClose: () => void }) {
  const { 
    slotData, 
    appointments, 
    isLoading, 
    error, 
    dataStage,
    refreshData 
  } = useSlotData();
  
  const [activeTab, setActiveTab] = useState('patients');
  
  // Data slot tidak ada
  if (!slotData && !isLoading && dataStage !== 'loading') {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Slot Terapi</DialogTitle>
          <DialogDescription>
            Data slot terapi tidak ditemukan
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end space-x-2 py-4">
          <Button variant="secondary" onClick={onClose}>Tutup</Button>
        </div>
      </>
    );
  }
  
  // Tampilkan error
  if (error) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Error</DialogTitle>
          <DialogDescription>
            Terjadi kesalahan saat memuat data
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {error.message}
            </AlertDescription>
          </Alert>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Tutup</Button>
          <Button onClick={() => refreshData()}>Coba Lagi</Button>
        </DialogFooter>
      </>
    );
  }
  
  // Data slot dari provider
  const slot = slotData;
  
  // Tampilkan loading awal
  if ((isLoading || dataStage === 'loading') && !slot) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Memuat Slot Terapi...</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center py-8">
          <div className="text-center space-y-4">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p>Memuat data slot terapi...</p>
            <ProgressiveLoadingIndicator stage={dataStage} />
          </div>
        </div>
      </>
    );
  }
  
  // Format tanggal dari data
  const formattedDate = slot?.date ? format(
    typeof slot.date === 'string' ? parseISO(slot.date) : slot.date,
    'EEEE, dd MMMM yyyy',
    { locale: id }
  ) : 'Tanggal tidak tersedia';
  
  // Hitung status appointments
  const patientsByStatus: Record<string, number> = {};
  appointments.forEach(appointment => {
    const status = appointment.status || 'Unknown';
    patientsByStatus[status] = (patientsByStatus[status] || 0) + 1;
  });
  
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          Slot Terapi: {slot?.timeSlot}
        </DialogTitle>
        <DialogDescription>
          {formattedDate} • Kuota: {slot?.currentCount || 0}/{slot?.maxQuota || 0}
          
          {/* Indikator loading progresif */}
          {(isLoading || dataStage !== 'full') && (
            <div className="mt-2">
              <ProgressiveLoadingIndicator 
                stage={dataStage}
                patientCount={appointments.length}
                patientsLoaded={appointments.length}
              />
            </div>
          )}
        </DialogDescription>
      </DialogHeader>
      
      <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid grid-cols-2">
          <TabsTrigger value="patients">
            <Users className="h-4 w-4 mr-2" />
            Pasien ({appointments.length})
          </TabsTrigger>
          <TabsTrigger value="details">
            <Clock className="h-4 w-4 mr-2" />
            Detail Slot
          </TabsTrigger>
        </TabsList>
        
        {/* Tab Pasien */}
        <TabsContent value="patients" className="flex-1 overflow-hidden flex flex-col">
          {appointments.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <p className="text-muted-foreground">Belum ada pasien terdaftar</p>
              </div>
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="space-y-2 p-2">
                {/* Status summary */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {Object.entries(patientsByStatus).map(([status, count]) => (
                    <Badge key={status} className={statusColors[status] || 'bg-gray-500'}>
                      {status}: {count}
                    </Badge>
                  ))}
                </div>
                
                {/* Patient list */}
                {appointments.map((appointment) => (
                  <div 
                    key={appointment.id} 
                    className="border rounded-md p-3 hover:bg-accent transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{appointment.patientName || 'Tanpa Nama'}</div>
                        <div className="text-sm text-muted-foreground">{appointment.patientPhone || 'Tanpa Nomor'}</div>
                      </div>
                      <Badge className={statusColors[appointment.status] || 'bg-gray-500'}>
                        {appointment.status || 'Unknown'}
                      </Badge>
                    </div>
                    {appointment.notes && (
                      <div className="mt-2 text-sm border-t pt-1">
                        {appointment.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
        
        {/* Tab Detail Slot */}
        <TabsContent value="details" className="flex-1 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1">
            <div className="space-y-4 p-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium">ID Slot</div>
                  <div className="text-sm">{slot?.id}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">Jam Terapi</div>
                  <div className="text-sm">{slot?.timeSlot}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">Tanggal</div>
                  <div className="text-sm">{formattedDate}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">Status</div>
                  <div className="text-sm">
                    {slot?.isActive ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        Aktif
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                        Tidak Aktif
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">Kuota Maksimal</div>
                  <div className="text-sm">{slot?.maxQuota}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">Pasien Terdaftar</div>
                  <div className="text-sm">{slot?.currentCount || 0}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">Status</div>
                  <div className="text-sm">{slot?.isActive ? 'Aktif' : 'Tidak Aktif'}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">Persentase Isi</div>
                  <div className="text-sm">{slot?.maxQuota > 0 ? Math.round((slot.currentCount / slot.maxQuota) * 100) : 0}%</div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
      
      <DialogFooter className="space-x-2 border-t pt-4">
        <Button 
          variant="outline" 
          onClick={() => refreshData()}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button onClick={onClose}>Tutup</Button>
      </DialogFooter>
    </>
  );
}