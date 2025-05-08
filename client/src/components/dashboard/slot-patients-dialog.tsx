import React, { useState, useEffect, useRef, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, CalendarIcon, ShoppingCart, X, Ban, CheckCircle, ChevronDown, User, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
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
function formatDate(dateInput?: string | Date): string {
  if (!dateInput) return '-';
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
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
  
  // ---- PENDEKATAN LEBIH SEDERHANA DENGAN DIRECT FETCH ----
  // Gunakan state untuk track data dan loading status, bukan useQuery
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [slotData, setSlotData] = useState<any>(null);
  const [appointmentData, setAppointmentData] = useState<any[]>([]);
  
  // Gunakan satu fungsi fetch untuk semua data dengan error handling yang baik
  const fetchSlotAndAppointments = async () => {
    // Reset state
    setIsLoading(true);
    setError(null);
    
    if (!slotId) {
      setIsLoading(false);
      return;
    }
    
    try {
      // STEP 1: Fetch slot data
      console.log("Fetching slot data for ID:", slotId);
      const slotResponse = await fetch(`/api/therapy-slots/${slotId}`);
      
      if (!slotResponse.ok) {
        throw new Error(`Error fetching slot: ${slotResponse.status}`);
      }
      
      const slotResult = await slotResponse.json();
      console.log("Slot data received:", slotResult);
      
      if (!slotResult || !slotResult.date) {
        throw new Error("Invalid slot data received");
      }
      
      // Set slot data terlebih dahulu
      setSlotData(slotResult);
      
      // STEP 2: Coba fetch appointments dengan pendekatan yang berbeda
      console.log("Fetching appointments with improved approach");
      
      // Format tanggal untuk query
      const slotDate = typeof slotResult.date === 'string' 
        ? slotResult.date.split(' ')[0] // YYYY-MM-DD dari format "YYYY-MM-DD HH:MM:SS"
        : new Date(slotResult.date).toISOString().split('T')[0];
      
      console.log(`Fetching appointments for date: ${slotDate}`);
      const dateFallbackResponse = await fetch(`/api/appointments/date/${slotDate}`);
      
      if (!dateFallbackResponse.ok) {
        throw new Error(`Failed to fetch appointments: ${dateFallbackResponse.status}`);
      }
      
      const allDateAppointments = await dateFallbackResponse.json();
      console.log(`Got ${allDateAppointments.length} appointments for date ${slotDate}`);
      
      // Filter appointments untuk slot ini dengan kriteria yang lebih reliable
      const filtered = allDateAppointments.filter((app: any) => {
        // Skip null/undefined
        if (!app) return false;
        
        // Match berdasarkan therapySlotId (kriteria utama)
        if (app.therapySlotId === slotId) return true;
        
        // Fallback untuk appointment tanpa therapySlotId - match berdasarkan waktu
        if (!app.therapySlotId && app.timeSlot === slotResult.timeSlot) return true;
        
        return false;
      });
      
      console.log(`Filtered ${filtered.length} appointments for slot ID ${slotId}`);
      
      // Set appointment data setelah filtering
      setAppointmentData(filtered || []);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(err instanceof Error ? err : new Error("Unknown error fetching data"));
      // Clear data on error
      setSlotData(null);
      setAppointmentData([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Refetch function - langsung fetch ulang dengan metode baru
  const refetch = () => {
    fetchSlotAndAppointments();
  };
  
  // Gunakan ref untuk menghindari multiple refetch
  const hasRefreshedRef = useRef(false);
  const dialogOpenedTimeRef = useRef<number | null>(null);
  
  // Effect untuk menangani loading data pada saat dialog dibuka
  useEffect(() => {
    if (isOpen && slotId) {
      // Catat waktu dialog dibuka
      if (dialogOpenedTimeRef.current === null) {
        dialogOpenedTimeRef.current = Date.now();
      }
      
      // Hanya fetch sekali per dialog open
      if (!hasRefreshedRef.current) {
        console.log('Dialog dibuka dengan slotId:', slotId, '- memulai fetch data');
        hasRefreshedRef.current = true;
        fetchSlotAndAppointments();
      }
    } else if (!isOpen) {
      // Reset flag saat dialog ditutup
      hasRefreshedRef.current = false;
      dialogOpenedTimeRef.current = null;
      
      // Reset data saat dialog ditutup untuk menghindari flash data lama
      setAppointmentData([]);
    }
  }, [isOpen, slotId]);
  
  // Kita tidak perlu variabel activeAppointments lagi karena sudah diganti dengan slotActiveAppointments
  // Dan kita menggunakan enrichAppointment di bawah untuk fungsi yang sama
  
  // Mutations - dengan penyederhanaan kode
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
      
      // Refresh data dengan pendekatan baru
      fetchSlotAndAppointments();
      
      // Tetap invalidate queries untuk halaman lain yang terkait
      queryClient.invalidateQueries({ queryKey: ['/api/therapy-slots'] });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments/date'] });
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
      
      // Refresh data dengan pendekatan baru
      fetchSlotAndAppointments();
      
      // Invalidate queries untuk dashboard dan tampilan lainnya
      queryClient.invalidateQueries({ queryKey: ['/api/therapy-slots'] });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments/date'] });
      queryClient.invalidateQueries({ queryKey: ['/api/today-slots'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
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
      
      // Konversi patient.id ke number untuk memastikan tipe data konsisten
      const patientIdNumber = typeof patient.id === 'string' ? parseInt(patient.id) : patient.id;
      
      // Backup metode: Cek langsung ke API untuk mendapatkan data lengkap pasien
      fetch(`/api/patients/${patientIdNumber}`)
        .then(response => response.json())
        .then(completePatientData => {
          if (!completePatientData || !completePatientData.id) {
            throw new Error("Data pasien tidak ditemukan di server");
          }
          
          console.log("Data lengkap pasien dari API:", completePatientData);
          
          // Simpan data pasien yang sangat lengkap ke localStorage
          // Tapi kita buat objek baru dengan properti yang telah difilter
          // untuk menghindari error objek yang terlalu kompleks atau circular reference
          // Pastikan semua data adalah tipe primitif, bukan objek atau array kompleks
          const patientData = {
            id: Number(patientIdNumber), // Pastikan ID tetap konsisten, tipe number
            name: String(completePatientData.name || ''),
            patientId: String(completePatientData.patientId || ''),
            phoneNumber: String(completePatientData.phoneNumber || ''),
            address: String(completePatientData.address || ''),
            email: completePatientData.email ? String(completePatientData.email) : null,
            birthDate: completePatientData.birthDate ? String(completePatientData.birthDate) : null,
            gender: String(completePatientData.gender || ''),
            therapySlotId: completePatientData.therapySlotId ? Number(completePatientData.therapySlotId) : null
          };
          
          // Simpan ID sebagai string (lebih kompatibel dengan localStorage)
          localStorage.setItem('pendingTransactionPatientId', patientIdNumber.toString());
          // Simpan nama pasien
          localStorage.setItem('pendingTransactionPatientName', completePatientData.name || patient.name);
          // Simpan data JSON lengkap pasien
          localStorage.setItem('pendingTransactionPatientData', JSON.stringify(patientData));
          // Tambahkan satu lagi flag untuk memastikan data bisa diambil dengan ID
          localStorage.setItem(`patient_${patientIdNumber}`, JSON.stringify(patientData));
          
          // Flag ini tidak lagi digunakan (digantikan oleh parameter URL)
          // Tapi tetap disimpan untuk backward compatibility
          localStorage.setItem('hidePatientDropdown', 'true');
          
          // Tutup dialog terlebih dahulu
          onClose();
          
          // Log untuk debugging
          console.log("Persiapan navigasi ke transaksi untuk pasien dengan data lengkap:", patientData);
          
          // Navigasi langsung ke halaman transaksi dengan parameter query yang lebih eksplisit
          navigate(`/transactions?patientId=${patientIdNumber}&patientName=${encodeURIComponent(completePatientData.name)}&hideDropdown=true&delay=2000&source=slot-dialog&timestamp=${Date.now()}`);
          
          // Tambahkan notifikasi untuk feedback
          toast({
            title: "Membuat transaksi baru",
            description: `Mempersiapkan transaksi untuk ${completePatientData.name}`,
          });
          
          // Tunggu sebentar untuk memastikan halaman transaksi sudah dimuat, lalu kirim event
          setTimeout(() => {
            // Buat custom event untuk membuka form transaksi dengan data pasien yang sangat lengkap
            const openFormEvent = new CustomEvent('openTransactionForm', {
              detail: { 
                patientId: patientIdNumber,
                patientName: completePatientData.name,
                patientData: patientData, // Kirim data lengkap sekaligus
                timestamp: Date.now() // Tambahkan timestamp untuk memastikan event unik
              }
            });
            
            // Log untuk debugging
            console.log("Mengirim event dengan data SANGAT lengkap:", {
              patientId: patientIdNumber,
              patientIdType: typeof patientIdNumber,
              patientName: completePatientData.name,
              patientData: JSON.stringify(patientData).substring(0, 100) + "..." // Tampilkan sebagian saja
            });
            
            // Kirim event utama hanya sekali, tanpa retry berkali-kali
            window.dispatchEvent(openFormEvent);
            console.log("Event telah dikirim sekali untuk patientId", patientIdNumber);
            
          }, 2000); // Delay awal
        })
        .catch(err => {
          console.error("Error fetching complete patient data:", err);
          
          // Fallback ke metode lama jika API gagal
          const patientData = {
            id: Number(patientIdNumber),
            name: String(patient.name || ''),
            phoneNumber: String(patient.phoneNumber || ''),
            address: String(patient.address || ''),
            patientId: String(patient.patientId || ''),
            lastVisit: patient.lastVisit ? String(patient.lastVisit) : null
          };
          
          localStorage.setItem('pendingTransactionPatientId', patientIdNumber.toString());
          localStorage.setItem('pendingTransactionPatientName', patient.name);
          localStorage.setItem('pendingTransactionPatientData', JSON.stringify(patientData));
          
          // Tutup dialog terlebih dahulu
          onClose();
          
          // Navigasi dengan metode lama
          navigate(`/transactions?patientId=${patientIdNumber}&patientName=${encodeURIComponent(patient.name)}&delay=2000&source=slot-dialog-fallback`);
          
          toast({
            title: "Membuat transaksi baru",
            description: `Mempersiapkan transaksi untuk ${patient.name} (metode alternatif)`,
          });
          
          // Dispatch event dengan metode sederhana
          // Kita percaya bahwa localStorage akan tersedia dan tidak perlu event retry
          console.log("Menggunakan metode fallback untuk navigasi ke transaksi");
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
      
      // Validasi data pasien yang lebih komprehensif
      if (!appointment || !appointment.patient) {
        toast({
          title: "Terjadi kesalahan",
          description: "Data pasien tidak tersedia.",
          variant: "destructive",
        });
        return;
      }
      
      if (!appointment.patient.phoneNumber) {
        toast({
          title: "Terjadi kesalahan",
          description: "Nomor telepon pasien tidak tersedia.",
          variant: "destructive",
        });
        return;
      }
      
      // Format tanggal dan waktu slot terapi
      const slotDate = slotData?.date ? formatDate(slotData.date) : (appointment.date ? formatDate(appointment.date) : 'yang telah dijadwalkan');
      const slotTime = slotData?.timeSlot || appointment.timeSlot || '';
      
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
  
  // Menerapkan strategi pemrosesan data yang lebih efisien
  // 1. Gunakan useMemo untuk memproses data hanya saat diperlukan
  // 2. Stabilkan state dengan defaultValue yang konsisten
  // 3. Gunakan pengecekan lebih ketat untuk mencegah error null/undefined
  
  // Inisialisasi data appointment dari state, pastikan selalu array
  const allAppointmentsForDate = useMemo(() => {
    return Array.isArray(appointmentData) ? appointmentData : [];
  }, [appointmentData]);
  
  // Logging untuk debug yang efisien
  useEffect(() => {
    if (isOpen && slotId && allAppointmentsForDate.length >= 0) {
      console.log(`Total appointments untuk tanggal ini: ${allAppointmentsForDate.length}`);
    }
  }, [allAppointmentsForDate.length, isOpen, slotId]);
  
  // Filter appointment untuk slot tertentu dengan useMemo untuk caching
  const slotAppointments = useMemo(() => {
    // Early return jika tidak ada data atau slotId
    if (!slotId) return [];
    
    try {
      return allAppointmentsForDate.filter((app: any) => {
        // Skip jika appointment tidak valid
        if (!app) return false;
        
        // Prioritaskan match berdasarkan ID slot
        const matchesSlotId = app.therapySlotId === slotId;
        
        // Fallback ke match berdasarkan waktu slot jika tidak ada therapySlotId
        const matchesTimeSlot = slotData && 
                              app.timeSlot === slotData.timeSlot && 
                              !app.therapySlotId;
        
        return matchesSlotId || matchesTimeSlot;
      });
    } catch (error) {
      console.error("Error saat memfilter appointment untuk slot:", error);
      return [];
    }
  }, [allAppointmentsForDate, slotId, slotData]);
  
  // Filter untuk appointment dengan status aktif saja
  const slotActiveAppointments = useMemo(() => {
    try {
      return filterActiveAppointments(slotAppointments);
    } catch (error) {
      console.error("Error saat memfilter appointment aktif:", error);
      return [];
    }
  }, [slotAppointments]);
  
  // Fungsi untuk memperkaya data appointment dengan data pasien
  const enrichAppointment = (appointment: any) => {
    try {
      // Jika appointment sudah memiliki patient object yang valid, gunakan itu
      if (appointment.patient && (appointment.patient.id || appointment.patient.name)) {
        return {
          ...appointment,
          patient: {
            ...appointment.patient,
            // Tambahkan fallback untuk field penting
            id: appointment.patient.id || appointment.patientId,
            name: appointment.patient.name || `Pasien #${appointment.patientId || '?'}`,
            phoneNumber: appointment.patient.phoneNumber || '-'
          }
        };
      }
      
      // Jika tidak ada patient object tetapi ada patientId, buat objek patient
      if (appointment.patientId) {
        return {
          ...appointment,
          patient: {
            id: appointment.patientId,
            name: appointment.patientName || `Pasien #${appointment.patientId}`,
            phoneNumber: appointment.phoneNumber || '-'
          }
        };
      }
      
      // Default fallback jika data tidak lengkap
      return {
        ...appointment,
        patient: {
          id: null,
          name: 'Pasien tidak diketahui',
          phoneNumber: '-'
        }
      };
    } catch (error) {
      console.error("Error processing appointment data:", error);
      // Fallback paling aman jika terjadi error saat pemrosesan
      return {
        ...appointment,
        patient: { id: null, name: 'Error Data Pasien', phoneNumber: '-' }
      };
    }
  };
  
  // Process appointments data to enrich them with patient data
  // Gunakan useMemo untuk menghindari pemrosesan ulang yang tidak perlu
  const processedAppointments = useMemo(() => {
    // Pastikan slotActiveAppointments adalah array
    if (!Array.isArray(slotActiveAppointments)) return [];
    
    try {
      // Map data dengan enrichAppointment
      return slotActiveAppointments.map(enrichAppointment).filter(Boolean);
    } catch (error) {
      console.error("Error memproses data appointments:", error);
      return [];
    }
  }, [slotActiveAppointments]);
  
  // Buat fetch semua data pasien sekaligus untuk mengurangi beban server
  const patientIds = Array.from(new Set(
    slotActiveAppointments
      .filter((app: any) => !!app.patientId)
      .map((app: any) => app.patientId)
  ));
  
  useEffect(() => {
    // Jika ada patientIds dan dialog terbuka, fetch data pasien
    if (patientIds.length > 0 && isOpen) {
      const fetchPatients = async () => {
        try {
          const patientPromises = patientIds.map(id => 
            fetch(`/api/patients/${id}`).then(res => res.json())
          );
          await Promise.all(patientPromises);
        } catch (error) {
          console.error("Error prefetching patient data:", error);
        }
      };
      
      fetchPatients();
    }
  }, [patientIds.join(','), isOpen]);
  
  // Debug logging in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log("Total appointments for date:", allAppointmentsForDate.length);
      console.log("Debug - Matched slot appointments:", slotAppointments.length);
      console.log("Debug - Active appointments:", slotActiveAppointments.length);
      console.log("Debug - Unique patient IDs:", patientIds.length);
      console.log("Debug - Final processed appointments:", processedAppointments.length);
    }
  }, [
    allAppointmentsForDate.length, 
    slotAppointments.length, 
    slotActiveAppointments.length, 
    patientIds.length, 
    processedAppointments.length
  ]);
  
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
          
          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          
          {!isLoading && error && (
            <div className="text-center py-6 text-destructive">
              <p>Error: {(error as Error).message}</p>
            </div>
          )}
          
          {!isLoading && !error && !slotData && (
            <div className="text-center py-6 text-muted-foreground">
              <p>Data slot tidak tersedia</p>
            </div>
          )}
          
          {!isLoading && !error && slotData && (
            <div className="space-y-4 mt-2">
              {/* Slot Information */}
              <div className="rounded-lg bg-muted/50 p-3 border">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="text-muted-foreground">Tanggal:</div>
                  <div className="font-medium">{formatDate(slotData.date)}</div>
                  
                  <div className="text-muted-foreground">Waktu:</div>
                  <div className="font-medium">{slotData.timeSlot || '-'}</div>
                  
                  <div className="text-muted-foreground">Kuota:</div>
                  <div className="font-medium">
                    {typeof slotData.currentCount === 'number' ? slotData.currentCount : 0}/
                    {typeof slotData.maxQuota === 'number' ? slotData.maxQuota : 0}
                  </div>
                  
                  <div className="text-muted-foreground">Status:</div>
                  <div>
                    {slotData.isActive ? (
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
                  {slotData && slotData.isActive && 
                   slotData.currentCount < slotData.maxQuota && (
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
                {!processedAppointments.length ? (
                  <p className="text-center py-4 text-sm text-muted-foreground border rounded">
                    Belum ada pasien aktif
                  </p>
                ) : (
                  <div className="border rounded-md divide-y">
                    {processedAppointments.map((appointment: any) => (
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
      {isConfirmCancelOpen && (
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
      )}
    </>
  );
}