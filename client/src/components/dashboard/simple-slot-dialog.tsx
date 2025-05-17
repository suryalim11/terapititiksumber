import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Loader2, CalendarIcon, User, ShoppingCart, MessageSquare, Check, AlertCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { generateWhatsAppLink } from "@/lib/utils";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

interface SimpleSlotDialogProps {
  slotId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

// Tipe data untuk slot terapi
interface SlotData {
  id: number;
  date: string | Date;
  timeSlot: string;
  maxQuota: number;
  currentCount: number;
  isActive?: boolean;
}

// Tipe data untuk pasien
interface PatientData {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  gender?: string;
  appointmentStatus?: string;
  appointmentId?: number;
  walkin?: boolean;
}

/**
 * Dialog komponen yang lebih sederhana untuk menampilkan detail slot terapi
 * dan daftar pasien yang terdaftar
 */
export function SimpleSlotDialog({ slotId, isOpen, onClose }: SimpleSlotDialogProps) {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  
  const [slotData, setSlotData] = useState<SlotData | null>(null);
  const [patients, setPatients] = useState<PatientData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    if (isOpen && slotId !== null) {
      loadSlotData(slotId);
    } else {
      // Reset state ketika dialog ditutup
      setSlotData(null);
      setPatients([]);
      setError(null);
    }
  }, [isOpen, slotId]);
  
  async function loadSlotData(slotId: number) {
    setIsLoading(true);
    setError(null);
    
    try {
      // 1. Mengambil data basic slot terapi
      const basicResponse = await fetch(`/api/simple-slot/${slotId}/basic?_t=${Date.now()}`);
      
      if (!basicResponse.ok) {
        throw new Error(`Gagal mendapatkan data dasar slot: ${basicResponse.status}`);
      }
      
      const basicData = await basicResponse.json();
      setSlotData(basicData);
      
      // 2. Mengambil data pasien untuk slot terapi
      const patientsResponse = await fetch(`/api/simple-slot/${slotId}/patients?_t=${Date.now()}`);
      
      if (!patientsResponse.ok) {
        throw new Error(`Gagal mendapatkan data pasien: ${patientsResponse.status}`);
      }
      
      const patientsData = await patientsResponse.json();
      setPatients(patientsData);
      
    } catch (err) {
      console.error("Error loading slot data:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }
  
  // Format tanggal untuk tampilan
  function formatDisplayDate(dateStr: string | Date | undefined): string {
    if (!dateStr) return '-';
    try {
      const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
      return format(date, 'EEEE, dd MMMM yyyy', { locale: localeId });
    } catch (e) {
      return String(dateStr);
    }
  }
  
  // Handler untuk navigasi ke halaman pasien
  function handleGoToPatient(patientId: number) {
    navigate(`/patients/${patientId}`);
  }
  
  // Render status pasien dengan badge yang sesuai
  function renderAppointmentStatus(status?: string) {
    if (!status) return <Badge variant="outline">Tidak Ada Status</Badge>;
    
    switch (status) {
      case 'Active':
        return <Badge variant="success">Aktif</Badge>;
      case 'Scheduled':
        return <Badge variant="secondary">Terjadwal</Badge>;
      case 'Completed':
        return <Badge variant="default">Selesai</Badge>;
      case 'Cancelled':
        return <Badge variant="destructive">Dibatalkan</Badge>;
      case 'No-Show':
        return <Badge variant="destructive">Tidak Hadir</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }
  
  // Handler untuk daftarkan pasien baru ke slot
  function handleRegisterNewPatient() {
    if (!slotId) return;
    navigate(`/register-patient/${slotId}`);
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon size={18} />
            <span>Detail Slot Terapi</span>
          </DialogTitle>
          <DialogClose />
        </DialogHeader>
        
        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Memuat data slot dan pasien...</p>
          </div>
        )}
        
        {/* Error state */}
        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-12 text-destructive">
            <AlertCircle className="h-8 w-8 mb-4" />
            <p className="font-medium">Terjadi kesalahan</p>
            <p className="text-sm text-muted-foreground">{error.message}</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => slotId && loadSlotData(slotId)}
            >
              Coba Lagi
            </Button>
          </div>
        )}
        
        {/* Content when data is loaded */}
        {!isLoading && !error && slotData && (
          <>
            {/* Slot information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 border-b">
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground">Tanggal</h3>
                <p className="text-base">{formatDisplayDate(slotData.date)}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground">Waktu</h3>
                <p className="text-base">{slotData.timeSlot}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground">Kuota</h3>
                <p className="text-base">{slotData.currentCount} / {slotData.maxQuota} Pasien</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground">Status</h3>
                <div className="text-base">
                  {slotData.isActive 
                    ? <Badge variant="success">Aktif</Badge> 
                    : <Badge variant="destructive">Tidak Aktif</Badge>}
                </div>
              </div>
            </div>
            
            {/* Patient list */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Daftar Pasien</h3>
                <Button onClick={handleRegisterNewPatient} size="sm">
                  <User className="mr-2 h-4 w-4" />
                  Daftarkan Pasien
                </Button>
              </div>
              
              {/* No patients */}
              {patients.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Belum ada pasien terdaftar pada slot ini.</p>
                </div>
              )}
              
              {/* Patient list */}
              {patients.length > 0 && (
                <div className="space-y-3">
                  {patients.map((patient) => (
                    <div 
                      key={patient.id} 
                      className="p-4 border rounded-lg hover:bg-accent/5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="h-5 w-5 text-muted-foreground" />
                          <h4 className="font-medium">{patient.name}</h4>
                          {patient.walkin && (
                            <Badge variant="outline" className="ml-2">
                              Walk-In
                            </Badge>
                          )}
                          {renderAppointmentStatus(patient.appointmentStatus)}
                        </div>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontalIcon className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleGoToPatient(patient.id)}>
                              <User className="mr-2 h-4 w-4" />
                              <span>Lihat Profil</span>
                            </DropdownMenuItem>
                            
                            {patient.phone && (
                              <DropdownMenuItem
                                onClick={() => {
                                  const link = generateWhatsAppLink(patient.phone || '', 'Informasi terapi');
                                  window.open(link, '_blank');
                                }}
                              >
                                <MessageSquare className="mr-2 h-4 w-4" />
                                <span>WhatsApp</span>
                              </DropdownMenuItem>
                            )}
                            
                            {patient.appointmentId && (
                              <DropdownMenuItem onClick={() => navigate(`/appointments/${patient.appointmentId}`)}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                <span>Lihat Appointment</span>
                              </DropdownMenuItem>
                            )}
                            
                            <DropdownMenuItem onClick={() => navigate(`/transactions/patient/${patient.id}`)}>
                              <ShoppingCart className="mr-2 h-4 w-4" />
                              <span>Lihat Transaksi</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      
                      {patient.phone && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Telp: {patient.phone}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Diperlukan untuk dropdown
const MoreHorizontalIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
  </svg>
);