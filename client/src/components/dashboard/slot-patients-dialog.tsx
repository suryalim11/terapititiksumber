import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CalendarIcon, ShoppingCart, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useLocation } from "wouter";

interface SlotPatientsDialogProps {
  slotId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SlotPatientsDialog({ slotId, isOpen, onClose }: SlotPatientsDialogProps) {
  const [, navigate] = useLocation();
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/therapy-slots', slotId, 'patients'],
    queryFn: async () => {
      if (!slotId) return null;
      const res = await fetch(`/api/therapy-slots/${slotId}/patients`);
      if (!res.ok) {
        throw new Error('Failed to fetch patients');
      }
      return res.json();
    },
    enabled: !!slotId && isOpen
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'dd MMMM yyyy');
  };
  
  // Fungsi untuk mengarahkan ke halaman transaksi baru dengan data pasien
  const navigateToTransaction = (patient: any) => {
    // Tutup dialog terlebih dahulu
    onClose();
    // Arahkan ke halaman transaksi baru dengan ID pasien
    navigate(`/transactions/new?patientId=${patient.id}`);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Detail Slot Terapi
            <DialogClose className="ml-auto">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-6 text-destructive">
            <p>Error: {(error as Error).message}</p>
          </div>
        ) : !data ? (
          <div className="text-center py-6 text-muted-foreground">
            <p>No data found</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Tanggal:</div>
                <div className="font-medium">{formatDate(data.slot.date)}</div>
                
                <div className="text-muted-foreground">Waktu:</div>
                <div className="font-medium">{data.slot.timeSlot}</div>
                
                <div className="text-muted-foreground">Kuota:</div>
                <div className="font-medium">{data.slot.currentCount}/{data.slot.maxQuota}</div>
                
                <div className="text-muted-foreground">Status:</div>
                <div>
                  {data.slot.isActive ? (
                    <Badge variant="success">Aktif</Badge>
                  ) : (
                    <Badge variant="destructive">Tidak Aktif</Badge>
                  )}
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium mb-2">Daftar Pasien Aktif</h3>
              {data.appointments.length === 0 ? (
                <p className="text-center py-4 text-sm text-muted-foreground border rounded">
                  Belum ada pasien terdaftar
                </p>
              ) : (
                <div>
                  {/* Filter hanya pasien dengan status 'scheduled' (aktif) */}
                  {(() => {
                    const activeAppointments = data.appointments.filter(
                      (appointment: any) => appointment.status === 'scheduled'
                    );
                    
                    return activeAppointments.length === 0 ? (
                      <p className="text-center py-4 text-sm text-muted-foreground border rounded">
                        Belum ada pasien aktif
                      </p>
                    ) : (
                      <div className="border rounded-md divide-y">
                        {activeAppointments.map((appointment: any) => (
                          <div 
                            key={appointment.id} 
                            className="p-3 text-sm hover:bg-teal-50 cursor-pointer transition-colors"
                            onClick={() => navigateToTransaction(appointment.patient)}
                          >
                            <div className="font-medium flex items-center">
                              {appointment.patient.name}
                              <ShoppingCart className="h-3.5 w-3.5 ml-2 text-teal-600" />
                            </div>
                            <div className="text-muted-foreground text-xs">
                              {appointment.patient.phoneNumber}
                              <span className="inline-block ml-1 text-xs text-teal-600">
                                Klik untuk buat transaksi
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}