import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, CalendarIcon, ShoppingCart, X, Ban, CheckCircle, ChevronDown, User, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { formatWhatsAppNumber, generateWhatsAppLink } from "@/lib/utils";

interface SlotPatientsDialogProps {
  slotId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

// Helpers functions outside of component to avoid hooks issues
function formatDate(dateString?: string): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return format(date, 'dd MMMM yyyy', { locale: localeId });
  } catch (error) {
    console.error("Error formatting date:", error);
    return 'Invalid date';
  }
}

function getStatusClass(status?: string): string {
  if (!status) return 'bg-gray-100 text-gray-800';
  
  const statusLower = status.toLowerCase();
  if (statusLower.includes('booked')) {
    return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
  } else if (statusLower.includes('confirmed')) {
    return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
  } else if (statusLower.includes('scheduled')) {
    return 'bg-purple-100 text-purple-800 hover:bg-purple-200';
  } else {
    return 'bg-green-100 text-green-800 hover:bg-green-200';
  }
}

function isActiveStatus(status?: string): boolean {
  if (!status) return false;
  const statusLower = status.toLowerCase();
  const activeStatusPatterns = ['active', 'booked', 'confirmed', 'scheduled'];
  return activeStatusPatterns.some(pattern => statusLower.includes(pattern));
}

function filterActiveAppointments(appointments?: any[]): any[] {
  if (!Array.isArray(appointments)) return [];
  return appointments.filter(appointment => 
    appointment && appointment.status && isActiveStatus(appointment.status)
  );
}

// Komponen StatusChanger untuk mengubah status appointment
interface AppointmentStatusChangerProps {
  appointment: any;
  updateStatus: (status: string) => void;
  isUpdating: boolean;
  stopPropagation?: boolean;
}

function AppointmentStatusChanger({ 
  appointment, 
  updateStatus, 
  isUpdating,
  stopPropagation = false
}: AppointmentStatusChangerProps) {
  const statusOptions = ["Scheduled", "Active", "Completed", "Cancelled"];
  const currentStatus = appointment?.status || "Unknown";
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-6 px-2 text-xs"
          disabled={isUpdating}
          onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
        >
          {isUpdating ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <>
              <span>Status</span>
              <ChevronDown className="h-3 w-3 ml-1" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32">
        {statusOptions.map((status) => (
          <DropdownMenuItem
            key={status}
            onClick={(e) => {
              if (stopPropagation) e.stopPropagation();
              updateStatus(status);
            }}
            disabled={isUpdating || status === currentStatus}
            className={status === currentStatus ? "bg-muted font-medium" : ""}
          >
            {status === currentStatus && (
              <CheckCircle className="h-3 w-3 mr-1 text-primary" />
            )}
            {status}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SlotPatientsDialog({ slotId, isOpen, onClose }: SlotPatientsDialogProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Dialog states
  const [isConfirmCancelOpen, setIsConfirmCancelOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  // State untuk dialog pendaftaran pasien
  const [isRegisterPatientOpen, setIsRegisterPatientOpen] = useState(false);
  
  // Data fetching
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/therapy-slots', slotId, 'patients'],
    queryFn: async () => {
      if (!slotId) return null;
      if (process.env.NODE_ENV === 'development') {
        console.log("Fetching patients for therapy slot:", slotId);
      }
      try {
        const res = await fetch(`/api/therapy-slots/${slotId}/patients`);
        if (!res.ok) {
          throw new Error('Failed to fetch patients');
        }
        return await res.json();
      } catch (error) {
        console.error("Error fetching patients:", error);
        throw error;
      }
    },
    enabled: !!slotId && isOpen,
    refetchOnWindowFocus: true,
    refetchInterval: isOpen ? 2000 : false, // Refresh data every 2 seconds when dialog is open
    staleTime: 0 // Consider data always stale to ensure fresh content
  });
  
  // Mutations
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
      
      // Invalidate all related queries to ensure fresh data everywhere
      queryClient.invalidateQueries();  // Invalidate all queries to force refresh
    },
    onError: (error: Error) => {
      toast({
        title: "Gagal",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await fetch(`/api/appointments/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Gagal mengubah status ke ${status}`);
      }
      
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Status diperbarui",
        description: `Status janji temu berhasil diubah menjadi "${variables.status}"`
      });
      
      // Refresh data setelah update status
      refetch();
      
      // Invalidate all related queries to ensure fresh data everywhere
      queryClient.invalidateQueries();  // Invalidate all queries to force refresh
      
      // Optional: If above is too aggressive, use these specific invalidations instead
      // queryClient.invalidateQueries({ queryKey: ['/api/today-slots'] });
      // queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      // queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      // queryClient.invalidateQueries({ queryKey: ['/api/therapy-slots'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Gagal mengubah status",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Handlers
  function handleCancelAppointment(appointment: any, event: React.MouseEvent) {
    try {
      event.stopPropagation();
      
      if (!appointment || !appointment.id) {
        toast({
          title: "Terjadi kesalahan",
          description: "Data janji temu tidak ditemukan atau tidak valid.",
          variant: "destructive",
        });
        return;
      }
      
      setSelectedAppointment(appointment);
      setIsConfirmCancelOpen(true);
    } catch (error) {
      console.error("Error handling cancel appointment:", error);
      toast({
        title: "Terjadi kesalahan", 
        description: "Gagal memproses pembatalan. Silakan coba lagi.",
        variant: "destructive",
      });
    }
  }
  
  function confirmCancelAppointment() {
    try {
      if (selectedAppointment && selectedAppointment.id) {
        cancelAppointmentMutation.mutate(selectedAppointment.id);
        setIsConfirmCancelOpen(false);
      } else {
        toast({
          title: "Terjadi kesalahan",
          description: "Data janji temu tidak ditemukan atau tidak valid.",
          variant: "destructive",
        });
        setIsConfirmCancelOpen(false);
      }
    } catch (error) {
      console.error("Error confirming appointment cancellation:", error);
      toast({
        title: "Terjadi kesalahan",
        description: "Gagal membatalkan janji temu. Silakan coba lagi.",
        variant: "destructive",
      });
      setIsConfirmCancelOpen(false);
    }
  }
  
  // Fungsi navigateToTransaction dengan event parameter didefinisikan di bawah
  // Versi simpel ini akan diganti dengan yang memiliki parameter event
  function dummyNavigate() {}
  
  function navigateToPatientDetail(patient: any) {
    if (!patient || !patient.id) {
      toast({
        title: "Error",
        description: "Data pasien tidak lengkap atau tidak ditemukan.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Tutup dialog terlebih dahulu
      onClose();
      
      // Arahkan ke halaman detail pasien
      navigate(`/patients/${patient.id}`);
      
      // Tambahkan notifikasi untuk feedback
      toast({
        title: "Melihat detail pasien",
        description: `Membuka detail pasien: ${patient.name || 'pasien terpilih'}`,
      });
    } catch (error) {
      console.error("Error navigating to patient detail:", error);
      toast({
        title: "Terjadi kesalahan",
        description: "Gagal membuka detail pasien. Silakan coba lagi.",
        variant: "destructive",
      });
    }
  }
  
  // Fungsi untuk mengarahkan ke halaman transaksi dengan pasien yang dipilih
  function navigateToTransaction(patient: any, event: React.MouseEvent) {
    if (!patient || !patient.id) {
      toast({
        title: "Error",
        description: "Data pasien tidak lengkap atau tidak ditemukan.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Hindari event bubbling
      event.stopPropagation();
      
      // Tutup dialog terlebih dahulu
      onClose();
      
      // Navigasi ke halaman transaksi
      navigate(`/transactions`);
      
      // Tunggu sebentar untuk memastikan halaman transaksi sudah dimuat
      setTimeout(() => {
        // Buat custom event untuk membuka form transaksi
        // Konversi patient.id ke number untuk memastikan tipe data konsisten
        const patientIdNumber = typeof patient.id === 'string' ? parseInt(patient.id) : patient.id;
        
        const openFormEvent = new CustomEvent('openTransactionForm', {
          detail: { 
            patientId: patientIdNumber,
            patientName: patient.name 
          }
        });
        
        // Log untuk debugging
        console.log("Mengirim event dengan data:", {
          patientId: patientIdNumber,
          patientIdType: typeof patientIdNumber,
          patientName: patient.name
        });
        
        // Dispatch event ke window sehingga halaman transaksi bisa menangkapnya
        window.dispatchEvent(openFormEvent);
        
        console.log("Dispatched openTransactionForm event with patientId:", patientIdNumber);
      }, 1000); // Delay 1000ms (1 detik) untuk memastikan halaman transaksi sudah benar-benar dimuat
      
      // Tambahkan notifikasi untuk feedback
      toast({
        title: "Membuat transaksi baru",
        description: `Form transaksi untuk ${patient.name || 'pasien terpilih'} akan segera dibuka`,
      });
    } catch (error) {
      console.error("Error navigating to transaction:", error);
      toast({
        title: "Terjadi kesalahan",
        description: "Gagal membuka form transaksi. Silakan coba lagi.",
        variant: "destructive",
      });
    }
  }
  
  // Handler untuk mengirim pengingat janji temu melalui WhatsApp
  function sendAppointmentReminder(appointment: any, event: React.MouseEvent) {
    try {
      event.stopPropagation(); // Mencegah event bubbling ke parent div
      
      if (!appointment || !appointment.patient || !appointment.patient.phoneNumber) {
        toast({
          title: "Terjadi kesalahan",
          description: "Nomor telepon pasien tidak tersedia.",
          variant: "destructive",
        });
        return;
      }
      
      // Format tanggal dan waktu slot terapi
      const slotDate = data?.slot?.date ? formatDate(data.slot.date) : 'yang telah dijadwalkan';
      const slotTime = data?.slot?.timeSlot || '';
      
      // Membuat template pesan untuk pengingat
      const message = 
        `Halo ${appointment.patient.name || 'Pasien Terhormat'},\n\n` +
        `*Pengingat Janji Terapi*\n` +
        `Kami ingin mengingatkan Anda tentang jadwal terapi Anda:\n\n` +
        `Tanggal: ${slotDate}\n` +
        `Waktu: ${slotTime}\n\n` +
        `Mohon konfirmasi kehadiran Anda dengan membalas pesan ini. Terima kasih.\n\n` +
        `Salam,\nTim Terapi Titik Sumber`;
      
      // Buka link WhatsApp dengan pesan yang sudah disiapkan
      const whatsappLink = generateWhatsAppLink(appointment.patient.phoneNumber, message);
      window.open(whatsappLink, '_blank');
      
      toast({
        title: "Pengingat dikirim",
        description: `WhatsApp untuk ${appointment.patient.name || 'pasien'} telah dibuka`,
      });
    } catch (error) {
      console.error("Error sending appointment reminder:", error);
      toast({
        title: "Terjadi kesalahan",
        description: "Gagal mengirim pengingat. Silakan coba lagi.",
        variant: "destructive",
      });
    }
  }
  
  // Prepare data
  const activeAppointments = data?.appointments ? filterActiveAppointments(data.appointments) : [];
  
  // Debug logging in development
  if (process.env.NODE_ENV === 'development' && data?.appointments?.length > 0) {
    console.log("Debug - Appointments data:", data.appointments.map((a: any) => `${a.id}: ${a.status}`));
  }
  
  // Early return
  if (!isOpen) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto p-4 md:p-6">
          <DialogHeader className="px-0">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <CalendarIcon className="h-5 w-5 text-primary" />
              Detail Slot Terapi
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
          ) : !data || !data.slot ? (
            <div className="text-center py-6 text-muted-foreground">
              <p>Data slot tidak tersedia</p>
            </div>
          ) : (
            <div className="space-y-4 mt-2">
              {/* Slot Information */}
              <div className="rounded-lg bg-muted/50 p-3 border">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="text-muted-foreground">Tanggal:</div>
                  <div className="font-medium">{formatDate(data.slot.date)}</div>
                  
                  <div className="text-muted-foreground">Waktu:</div>
                  <div className="font-medium">{data.slot.timeSlot || '-'}</div>
                  
                  <div className="text-muted-foreground">Kuota:</div>
                  <div className="font-medium">
                    {typeof data.slot.currentCount === 'number' ? data.slot.currentCount : 0}/
                    {typeof data.slot.maxQuota === 'number' ? data.slot.maxQuota : 0}
                  </div>
                  
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
              
              {/* Appointments List */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-medium">Daftar Pasien Aktif</h3>
                  {/* Tombol untuk mendaftarkan pasien baru */}
                  {data.slot && data.slot.isActive && 
                   data.slot.currentCount < data.slot.maxQuota && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="h-8 px-2 text-xs bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                      onClick={() => {
                        // Simpan ID slot ke sessionStorage
                        sessionStorage.setItem('selectedSlotId', String(slotId));
                        // Redirect ke halaman pendaftaran dengan parameter walk-in dan slotId
                        navigate(`/register?walkin=true&slotId=${slotId}`);
                      }}
                    >
                      <User className="h-3 w-3 mr-1" />
                      Daftarkan Pasien
                    </Button>
                  )}
                </div>
                {!activeAppointments.length ? (
                  <p className="text-center py-4 text-sm text-muted-foreground border rounded">
                    Belum ada pasien aktif
                  </p>
                ) : (
                  <div className="border rounded-md divide-y">
                    {activeAppointments.map((appointment: any) => (
                      <div 
                        key={appointment.id} 
                        className="p-3 text-sm hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => navigateToPatientDetail(appointment.patient)}
                      >
                        <div className="font-medium flex items-center justify-between">
                          <span>{appointment.patient?.name || 'Pasien tidak diketahui'}</span>
                          <Badge className={getStatusClass(appointment.status)}>
                            {appointment.status || 'Unknown'}
                          </Badge>
                        </div>
                        <div className="text-muted-foreground text-xs mt-1 mb-2">
                          {appointment.patient?.phoneNumber || '-'}
                        </div>
                        
                        {/* Action buttons - mobile friendly layout */}
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs flex-none"
                            onClick={(e) => {
                              e.stopPropagation(); // Mencegah event bubbling ke parent div
                              navigateToPatientDetail(appointment.patient);
                            }}
                          >
                            <User className="h-3 w-3 mr-1" />
                            Detail
                          </Button>
                          
                          <AppointmentStatusChanger
                            appointment={appointment}
                            updateStatus={(status) => updateStatusMutation.mutate({ id: appointment.id, status })}
                            isUpdating={updateStatusMutation.isPending}
                            stopPropagation={true}
                          />
                          
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs flex-none text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={(e) => navigateToTransaction(appointment.patient, e)}
                          >
                            <ShoppingCart className="h-3 w-3 mr-1" />
                            Transaksi
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 flex-none"
                            onClick={(e) => sendAppointmentReminder(appointment, e)}
                            disabled={!appointment.patient?.phoneNumber}
                            title={appointment.patient?.phoneNumber ? "Kirim pengingat via WhatsApp" : "Nomor telepon tidak tersedia"}
                          >
                            <MessageSquare className="h-3 w-3 mr-1" />
                            Pengingat
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={isConfirmCancelOpen} onOpenChange={setIsConfirmCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Pembatalan</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin membatalkan janji temu pasien ini?
              {selectedAppointment && (
                <div className="mt-2 p-2 border rounded-md bg-muted">
                  <p className="font-medium">{selectedAppointment.patient?.name || 'Pasien tidak diketahui'}</p>
                  <p className="text-sm text-muted-foreground">{selectedAppointment.patient?.phoneNumber || '-'}</p>
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