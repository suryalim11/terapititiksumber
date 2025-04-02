import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, CalendarIcon, ShoppingCart, X, Calendar, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface SlotPatientsDialogProps {
  slotId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SlotPatientsDialog({ slotId, isOpen, onClose }: SlotPatientsDialogProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State untuk konfirmasi batalkan janji
  const [isConfirmCancelOpen, setIsConfirmCancelOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);

  // Mutation untuk membatalkan janji
  const cancelAppointmentMutation = useMutation({
    mutationFn: async (appointmentId: number) => {
      const response = await fetch(`/api/appointments/${appointmentId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Gagal membatalkan janji');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Berhasil",
        description: "Janji temu berhasil dibatalkan"
      });
      
      // Refresh data setelah membatalkan janji
      refetch();
      queryClient.invalidateQueries({ queryKey: ['/api/today-slots'] });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Gagal",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Fungsi untuk membuka dialog konfirmasi batalkan janji
  const handleCancelAppointment = (appointment: any, event: React.MouseEvent) => {
    event.stopPropagation(); // Mencegah event propagation ke elemen parent
    setSelectedAppointment(appointment);
    setIsConfirmCancelOpen(true);
  };
  
  // Fungsi untuk konfirmasi batalkan janji
  const confirmCancelAppointment = () => {
    if (selectedAppointment) {
      cancelAppointmentMutation.mutate(selectedAppointment.id);
      setIsConfirmCancelOpen(false);
    }
  };
  
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
    return format(date, 'dd MMMM yyyy', { locale: localeId });
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
    <>
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
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Aktif</Badge>
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
                        (appointment: any) => {
                          const status = appointment.status.toLowerCase();
                          return status === 'active' || status === 'booked' || status === 'confirmed';
                        }
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
                              className="p-3 text-sm hover:bg-teal-50 transition-colors"
                            >
                              <div className="font-medium flex items-center justify-between">
                                <span>{appointment.patient.name}</span>
                                <Badge className={appointment.status.toLowerCase() === 'booked' ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' : 'bg-green-100 text-green-800 hover:bg-green-200'}>
                                  {appointment.status}
                                </Badge>
                              </div>
                              <div className="flex justify-between text-muted-foreground text-xs mt-1">
                                <span>{appointment.patient.phoneNumber}</span>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    className="h-6 px-2 text-xs"
                                    onClick={(e) => handleCancelAppointment(appointment, e)}
                                    disabled={cancelAppointmentMutation.isPending && selectedAppointment?.id === appointment.id}
                                  >
                                    {cancelAppointmentMutation.isPending && selectedAppointment?.id === appointment.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                    ) : (
                                      <Ban className="h-3 w-3 mr-1" />
                                    )}
                                    Batalkan
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs"
                                    onClick={() => navigateToTransaction(appointment.patient)}
                                  >
                                    <ShoppingCart className="h-3 w-3 mr-1" />
                                    Transaksi
                                  </Button>
                                </div>
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

      {/* Dialog Konfirmasi Batalkan Janji */}
      <AlertDialog open={isConfirmCancelOpen} onOpenChange={setIsConfirmCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Pembatalan</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin membatalkan janji temu pasien ini?
              {selectedAppointment && (
                <div className="mt-2 p-2 border rounded-md bg-muted">
                  <p className="font-medium">{selectedAppointment.patient?.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedAppointment.patient?.phoneNumber}</p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancelAppointment} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {cancelAppointmentMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Ya, Batalkan Janji
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}