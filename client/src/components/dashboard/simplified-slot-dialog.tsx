import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CalendarIcon, User, ShoppingCart, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { formatWhatsAppNumber, generateWhatsAppLink } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

interface SlotDialogProps {
  slotId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

// Tipe data untuk slot terapi
interface SlotData {
  id: number;
  date: string | Date;
  timeSlot: string;
  timeSlotKey?: string;
  maxQuota: number;
  currentCount: number;
  status: string;
  isActive?: boolean;
}

// Tipe data untuk appointment
interface AppointmentData {
  id: number;
  patientId: number;
  therapySlotId: number;
  status: string;
  notes?: string;
  patient?: {
    id: number;
    name: string;
    phoneNumber: string;
    isWalkIn?: boolean;
  };
}

// Formatting helper function
function formatDate(dateInput?: string | Date): string {
  if (!dateInput) return '-';
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return format(date, 'dd MMMM yyyy', { locale: localeId });
  } catch (error) {
    return 'Format tanggal tidak valid';
  }
}

export function SlotDialog({ slotId, isOpen, onClose }: SlotDialogProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State
  const [slotData, setSlotData] = useState<SlotData | null>(null);
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Prevent duplicate fetch
  const fetchInProgressRef = useRef(false);
  
  // Sinkronisasi jumlah pasien
  const syncSlotCount = async (id: number) => {
    try {
      const response = await fetch(`/api/sync-therapy-slot/${id}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        console.log(`✅ Berhasil menyinkronkan jumlah pasien untuk slot ID: ${id}`);
      } else {
        console.error(`❌ Gagal menyinkronkan jumlah pasien untuk slot ID: ${id}`);
      }
    } catch (error) {
      console.error('Error saat sinkronisasi slot:', error);
    }
  };
  
  // Fetch slot data and appointments
  const fetchSlotAndPatients = async () => {
    if (!slotId || fetchInProgressRef.current) return;
    
    fetchInProgressRef.current = true;
    setIsLoading(true);
    setError(null);
    
    try {
      const cacheBuster = Date.now();
      const response = await fetch(`/api/therapy-slots/${slotId}/patients?_t=${cacheBuster}`, {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store'
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data || !data.slot) {
        throw new Error("Format data tidak valid");
      }
      
      // Store slot data
      setSlotData(data.slot);
      
      // Process and store appointment data
      const patientData = (data.appointments || []).map((appointment: AppointmentData) => {
        // Add isWalkIn flag based on notes
        const isWalkIn = appointment.notes?.toLowerCase().includes('walk-in') || 
                        appointment.notes?.toLowerCase().includes('walkin');
        
        if (appointment.patient) {
          appointment.patient.isWalkIn = isWalkIn;
        }
        
        return appointment;
      });
      
      setAppointments(patientData);
      
    } catch (error) {
      console.error("Error fetching data:", error);
      setError(error instanceof Error ? error : new Error("Terjadi kesalahan saat mengambil data"));
      
      toast({
        title: "Error",
        description: `${(error as Error).message || 'Gagal memuat data. Silakan coba lagi.'}`,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      fetchInProgressRef.current = false;
    }
  };

  // Effect to fetch data when dialog opens
  useEffect(() => {
    if (isOpen && slotId) {
      // Fetch slot data and appointments
      fetchSlotAndPatients();
      
      // Sync slot count to ensure data consistency
      syncSlotCount(slotId);
    }
  }, [isOpen, slotId]);
  
  // Navigate to patient detail page
  const handlePatientClick = (patientId: number) => {
    if (!patientId) return;
    
    onClose();
    navigate(`/patients/${patientId}`);
  };
  
  // Navigate to transaction page for a patient
  const handleTransactionClick = (patientId: number) => {
    if (!patientId) {
      toast({
        title: "Error",
        description: "Data pasien tidak lengkap",
        variant: "destructive"
      });
      return;
    }
    
    // Find patient name from appointments
    const foundPatient = appointments.find(app => app.patient?.id === patientId);
    const patientName = foundPatient?.patient?.name || 'pasien';
    
    onClose();
    
    // Store patient ID in localStorage for the transaction page
    localStorage.setItem('pendingTransactionPatientId', patientId.toString());
    localStorage.setItem('pendingTransactionPatientName', patientName);
    localStorage.setItem('openTransactionFormDirectly', 'true');
    localStorage.setItem('transactionTimestamp', Date.now().toString());
    
    // Create query params with timestamp to prevent caching
    const params = new URLSearchParams({
      pid: patientId.toString(),
      t: Date.now().toString()
    }).toString();
    
    navigate(`/transactions?${params}`);
  };
  
  // Send WhatsApp reminder
  const handleReminderClick = (patientId: number) => {
    // Find patient data from appointments
    const foundAppointment = appointments.find(app => app.patient?.id === patientId);
    
    if (!foundAppointment?.patient) {
      toast({
        title: "Error",
        description: "Data pasien tidak lengkap",
        variant: "destructive"
      });
      return;
    }
    
    const patient = foundAppointment.patient;
    const phoneNumber = patient.phoneNumber;
    
    if (!phoneNumber) {
      toast({
        title: "Error",
        description: "Nomor telepon pasien tidak tersedia",
        variant: "destructive"
      });
      return;
    }
    
    // Format date and time
    const dateString = slotData ? formatDate(slotData.date) : '';
    const timeString = slotData ? slotData.timeSlot : '';
    
    // Message template
    const message = `Halo ${patient.name},\n\nIni pengingat untuk jadwal terapi Anda di klinik pada:\n\nTanggal: ${dateString}\nJam: ${timeString}\n\nMohon konfirmasi kehadiran Anda. Terima kasih.`;
    
    // Open WhatsApp with the prepared message
    const whatsappUrl = generateWhatsAppLink(phoneNumber, message);
    window.open(whatsappUrl, '_blank');
  };
  
  // Render status badge
  const renderStatusBadge = (status: string) => {
    if (!status) return <Badge>Unknown</Badge>;
    
    switch(status.toLowerCase()) {
      case 'scheduled':
        return <Badge>Scheduled</Badge>;
      case 'confirmed':
        return <Badge className="bg-blue-100 text-blue-800">Confirmed</Badge>;
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      case 'no-show':
        return <Badge variant="destructive">No-Show</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-muted-foreground" />
              {isLoading ? (
                <span>Memuat detail slot...</span>
              ) : (
                <span>
                  {slotData ? (
                    <>
                      {formatDate(slotData.date)} • {slotData.timeSlot}
                    </>
                  ) : (
                    'Detail Slot Terapi'
                  )}
                </span>
              )}
            </div>
            <DialogClose className="rounded-full hover:bg-muted p-1" />
          </DialogTitle>
          {!isLoading && slotData && (
            <DialogDescription className="flex justify-between">
              <span>
                Pasien: <b>{slotData.currentCount || 0}/{slotData.maxQuota || "~"}</b>
              </span>
              <span className={`font-medium ${slotData.isActive ? 'text-green-500' : 'text-red-500'}`}>
                {slotData.isActive ? 'Aktif' : 'Non-aktif'}
              </span>
            </DialogDescription>
          )}
        </DialogHeader>
        
        {isLoading ? (
          <div className="py-8 flex justify-center items-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Memuat data...</span>
          </div>
        ) : error ? (
          <div className="py-8 text-center text-red-500">
            <p>Terjadi kesalahan saat memuat data.</p>
            <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={fetchSlotAndPatients}
            >
              Coba Lagi
            </Button>
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto divide-y">
            {appointments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Belum ada pasien terdaftar pada slot ini
              </div>
            ) : (
              appointments.map((appointment) => {
                if (!appointment.patient) return null;
                
                const patientName = appointment.patient.name;
                const patientPhone = appointment.patient.phoneNumber;
                const patientId = appointment.patient.id;
                const isWalkIn = appointment.patient.isWalkIn || 
                                appointment.notes?.toLowerCase().includes('walk-in') || 
                                appointment.notes?.toLowerCase().includes('walkin');
                
                return (
                  <div key={`appointment-${appointment.id}`} className="p-3 hover:bg-muted/50">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">
                          {patientName}
                          {isWalkIn && <Badge className="ml-2 bg-blue-100 text-blue-800">WALK-IN</Badge>}
                        </div>
                        <div className="text-muted-foreground text-xs mt-1">
                          {formatWhatsAppNumber(patientPhone)}
                        </div>
                      </div>
                      {renderStatusBadge(appointment.status)}
                    </div>
                    
                    <div className="flex flex-wrap gap-1 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handlePatientClick(patientId)}
                      >
                        <User className="h-3 w-3 mr-1" />
                        Detail
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleTransactionClick(patientId)}
                      >
                        <ShoppingCart className="h-3 w-3 mr-1" />
                        Transaksi
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleReminderClick(patientId)}
                      >
                        <MessageSquare className="h-3 w-3 mr-1" />
                        Pengingat
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}