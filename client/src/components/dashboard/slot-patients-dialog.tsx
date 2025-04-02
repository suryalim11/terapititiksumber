import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CalendarIcon, ShoppingCart, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

interface SlotPatientsDialogProps {
  slotId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SlotPatientsDialog({ slotId, isOpen, onClose }: SlotPatientsDialogProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const { data, isLoading, error, refetch } = useQuery({
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
  
  // Refetch data saat dialog dibuka
  useEffect(() => {
    if (isOpen && slotId) {
      refetch();
    }
  }, [isOpen, slotId, refetch]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'dd MMMM yyyy');
  };
  
  // Fungsi untuk mengarahkan ke halaman transaksi dan langsung membuka form baru
  const navigateToTransaction = (patient: any) => {
    console.log("Navigating to transaction for patient:", patient);
    
    // Tutup dialog terlebih dahulu
    onClose();
    
    // Alih-alih menggunakan URL parameter, kita akan menggunakan url state
    // Arahkan ke halaman transaksi
    navigate("/transactions");
    
    // Tunggu sebentar untuk memastikan komponen transactions sudah di-mount
    setTimeout(() => {
      // Gunakan event system untuk berkomunikasi antar komponen
      const transactionEvent = new CustomEvent('open-transaction-form', {
        detail: { patientId: patient.id }
      });
      window.dispatchEvent(transactionEvent);
      
      // Tambahkan notifikasi untuk feedback
      toast({
        title: "Membuat transaksi baru",
        description: `Form transaksi untuk ${patient.name} akan segera dibuka`,
      });
    }, 500);
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
          <DialogDescription>
            Menampilkan detail slot terapi dan daftar pasien yang terdaftar.
          </DialogDescription>
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
                  {/* Filter hanya pasien dengan status aktif (booked atau active) */}
                  {(() => {
                    console.log("Appointments data:", data.appointments);
                    const activeAppointments = data.appointments.filter(
                      (appointment: any) => appointment.status.toLowerCase() === 'active' || 
                                            appointment.status.toLowerCase() === 'booked'
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
                            <div className="font-medium flex items-center justify-between">
                              <span>{appointment.patient.name}</span>
                              <Badge className={appointment.status.toLowerCase() === 'booked' ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' : 'bg-green-100 text-green-800 hover:bg-green-200'}>
                                {appointment.status}
                              </Badge>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-xs mt-1">
                              <span>{appointment.patient.phoneNumber}</span>
                              <span className="inline-flex items-center text-xs text-teal-600">
                                <ShoppingCart className="h-3 w-3 mr-1" />
                                Klik untuk transaksi
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