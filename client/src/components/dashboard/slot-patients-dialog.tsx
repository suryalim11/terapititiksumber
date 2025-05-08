import React, { useState, useEffect, useRef, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  const [combinedSlotInfo, setCombinedSlotInfo] = useState<{ids: number[], totalPatients: number, totalQuota: number} | null>(null);
  
  // Fungsi untuk melakukan fetch dengan timeout dan retry yang lebih robust
  const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs: number = 8000, retryCount: number = 2): Promise<Response> => {
    let lastError;
    
    // Informasi endpoint yang lebih deskriptif untuk log
    const endpoint = url.split('?')[0]; // Hanya tampilkan base path tanpa query string untuk log yang lebih bersih
    console.log(`🔄 Fetching data dari ${endpoint}... (timeout: ${timeoutMs}ms, retry: ${retryCount})`);
    
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        // Tambahkan timeout dengan controller
        const controller = new AbortController();
        let timeoutId: number | null = null;
        
        // Buat promise timeout yang akan reject jika waktu habis
        const timeoutPromise = new Promise<Response>((_, reject) => {
          timeoutId = window.setTimeout(() => {
            controller.abort();
            reject(new Error(`Request timeout (${timeoutMs}ms)`));
            console.log(`⏱️ Request to ${endpoint} aborted after ${timeoutMs}ms`);
          }, timeoutMs);
        });
        
        // Buat fetch promise
        const fetchPromise = fetch(url, {
          ...options,
          signal: controller.signal,
          // Hindari cache
          headers: {
            ...options.headers,
            'Cache-Control': 'no-cache, no-store',
            'Pragma': 'no-cache',
          },
          credentials: 'include'
        });
        
        // Race antara fetch dan timeout
        const response = await Promise.race([fetchPromise, timeoutPromise]);
        
        // Clear timeout jika fetch selesai duluan
        if (timeoutId) clearTimeout(timeoutId);
        
        // Cek network apakah offline
        if (!window.navigator.onLine) {
          console.log("📴 Perangkat sedang offline, menunggu koneksi...");
          throw new Error("Perangkat offline");
        }
        
        // Success log
        console.log(`✅ Fetch sukses [${attempt + 1}/${retryCount + 1}]: ${endpoint} - Status: ${response.status}`);
        return response;
      } catch (err: any) {
        lastError = err;
        const isTimeout = err.name === 'AbortError' || err.message.includes('timeout');
        const waitTime = Math.min(500 * Math.pow(2, attempt), 4000); // Exponential backoff dengan max 4 detik
        
        console.log(
          `❌ Fetch attempt ${attempt + 1}/${retryCount + 1} to ${endpoint} failed:`, 
          isTimeout ? '⏱️ Request timed out' : err.message
        );
        
        // Jika offline, tunggu sampai online
        if (!window.navigator.onLine) {
          console.log("📱 Menunggu perangkat kembali online...");
          await new Promise<void>(resolve => {
            const onlineHandler = () => {
              window.removeEventListener('online', onlineHandler);
              console.log("📶 Perangkat kembali online, melanjutkan request...");
              resolve();
            };
            window.addEventListener('online', onlineHandler);
          });
        }
        // Jika ini bukan percobaan terakhir, tunggu sebentar sebelum mencoba lagi
        else if (attempt < retryCount) {
          console.log(`⏳ Menunggu ${waitTime}ms sebelum retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    console.log(`💥 Fetch gagal setelah ${retryCount + 1} percobaan: ${endpoint}`);
    throw lastError || new Error(`Fetch gagal setelah ${retryCount + 1} percobaan`);
  };
  
  // Gunakan satu fungsi fetch untuk semua data dengan error handling yang baik
  const fetchSlotAndAppointments = async () => {
    // Reset state
    setIsLoading(true);
    setError(null);
    
    if (!slotId) {
      console.error("fetchSlotAndAppointments called without slotId");
      setIsLoading(false);
      setError(new Error("Slot ID tidak tersedia"));
      return;
    }
    
    // Dapatkan tanggal saat ini untuk fallback
    const todayString = new Date().toISOString().split('T')[0];
    
    try {
      // STRATEGI ALTERNATIF: Coba dapatkan semua slot hari ini dulu (lebih ringan & reliable)
      // dan cari slot spesifik dari data lengkap daripada hit endpoint spesifik yang sering timeout
      console.log(`Attempting to get slot ${slotId} data via general slots endpoint first`);
      
      let slotResult = null;
      let appointmentsData = [];
      
      // STEP 1: Coba dapatkan data dari allSlots endpoint (lebih reliabel)
      try {
        // Endpoint untuk semua slot hari ini
        const allSlotsEndpoint = `/api/therapy-slots?date=${todayString}`;
        
        // Gunakan timeout yang lebih pendek & hanya 1 retry untuk fallback ini
        const allSlotsResponse = await fetchWithTimeout(
          allSlotsEndpoint, 
          {
            headers: {
              'Accept': 'application/json',
              'Cache-Control': 'no-cache'
            }
          },
          5000,  // 5 detik timeout
          1      // 1 retry saja
        );
        
        if (allSlotsResponse.ok) {
          const allSlotsData = await allSlotsResponse.json();
          
          if (Array.isArray(allSlotsData) && allSlotsData.length > 0) {
            // Cari slot dengan ID yang sama dari data lengkap
            const foundSlot = allSlotsData.find(slot => Number(slot.id) === Number(slotId));
            
            if (foundSlot) {
              console.log("Successfully found slot data from general endpoint:", foundSlot);
              slotResult = foundSlot;
            }
          }
        }
      } catch (fallbackError) {
        console.log("Fallback approach failed, will try direct fetch:", fallbackError);
        // Lanjutkan ke direct fetch approach
      }
      
      // STEP 2: Jika fallback gagal, coba direct fetch ke endpoint spesifik
      if (!slotResult) {
        console.log("Direct fetch attempt for slot", slotId);
        const endpoint = `/api/therapy-slots/${slotId}`;
        
        try {
          // Kurangi timeout dan retry untuk menghindari UI freezing terlalu lama
          const slotResponse = await fetchWithTimeout(
            endpoint,
            {
              headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
              },
            },
            6000,  // Kurangi timeout menjadi 6 detik
            1      // Kurangi retry menjadi hanya 1 kali
          );
          
          if (slotResponse.ok) {
            slotResult = await slotResponse.json();
            console.log("Direct slot fetch successful:", slotResult);
          } else {
            console.error("Failed direct slot fetch, status:", slotResponse.status);
          }
        } catch (directFetchError) {
          console.error("Network error in direct fetch:", directFetchError);
          // Tetap lanjutkan dengan data minimal
        }
      }
      
      // STEP 3: Jika masih tidak ada data slot, gunakan minimal fallback untuk UI
      if (!slotResult) {
        console.log("Creating minimal slot data fallback for UI");
        
        // Default slot yang cukup untuk menampilkan UI dasar
        slotResult = {
          id: Number(slotId),
          date: todayString,
          timeSlot: "Tidak tersedia",
          currentCount: 0,
          maxQuota: 0,
          isActive: true
        };
        
        // Set warning tapi tetap tampilkan UI
        setError(new Error("Data slot tidak tersedia. Mencoba menampilkan informasi minimal."));
      }
      
      // Set slot data ke state
      setSlotData(slotResult);
      
      // STEP 4: Ambil appointment data (hanya jika slot data valid)
      if (slotResult) {
        // Format tanggal untuk appointment query
        let slotDate: string;
        try {
          slotDate = typeof slotResult.date === 'string' 
            ? slotResult.date.split(' ')[0] // Extract YYYY-MM-DD
            : new Date(slotResult.date).toISOString().split('T')[0];
        } catch (dateError) {
          console.warn("Date formatting error:", dateError);
          slotDate = todayString; // Fallback ke hari ini
        }
        
        console.log("Fetching appointments for date", slotDate);
        
        try {
          // Kurangi timeout dan retry untuk menghindari UI freezing
          const appointmentsResponse = await fetchWithTimeout(
            `/api/appointments/date/${slotDate}`,
            {
              headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
              },
            },
            5000,  // 5 detik timeout
            1      // 1 retry saja
          );
          
          if (appointmentsResponse.ok) {
            const allAppointments = await appointmentsResponse.json();
            
            if (Array.isArray(allAppointments)) {
              // Filter dengan pendekatan lebih komprehensif
              // 1. Pertama filter berdasarkan ID slot yang presisi (primary match)
              const directMatches = allAppointments.filter((app: any) => {
                if (!app) return false;
                return Number(app.therapySlotId) === Number(slotId);
              });
              
              // 2. Juga filter berdasarkan jam yang sama (secondary/additional matches)
              // Ini akan menemukan appointment di slot lain dengan jam yang sama
              const timeMatches = allAppointments.filter((app: any) => {
                if (!app) return false;
                // Hanya ambil yang waktunya sama tetapi bukan di slot ID ini
                return app.timeSlot === slotResult.timeSlot && 
                      Number(app.therapySlotId) !== Number(slotId);
              });
              
              // Debug info untuk melihat potensi duplikasi
              console.log(`Direct matches (by slotId): ${directMatches.length}`);
              console.log(`Time matches (by timeSlot): ${timeMatches.length}`);
              
              // Gabungkan kedua hasil
              appointmentsData = [...directMatches, ...timeMatches];
              
              // Debug untuk melihat hasil akhir
              console.log(`Total appointments: ${appointmentsData.length}`);
              
              // Tambahkan flag untuk membedakan appointment dari slot lain
              appointmentsData = appointmentsData.map(app => ({
                ...app,
                // Tandai appointment yang dari slot lain
                fromOtherSlot: Number(app.therapySlotId) !== Number(slotId)
              }));
            }
          } else {
            console.warn("Appointments fetch failed, status:", appointmentsResponse.status);
          }
        } catch (appointmentError) {
          console.warn("Failed to fetch appointments:", appointmentError);
          // Tetap lanjutkan dengan array kosong
        }
      }
      
      // Set appointment data (kosong jika tidak ditemukan)
      setAppointmentData(appointmentsData);
      
      // Clear error jika sudah berhasil
      setError(null);
      console.log("Data loading complete successfully");
    } catch (err) {
      console.error("Unhandled error in fetchSlotAndAppointments:", err);
      setError(err instanceof Error ? err : new Error("Terjadi kesalahan saat mengambil data"));
    } finally {
      setIsLoading(false);
      hasRefreshedRef.current = true;
    }
  };
  
  // Refetch function - langsung fetch ulang dengan metode baru
  const refetch = () => {
    fetchSlotAndAppointments();
  };
  
  // Gunakan ref untuk menghindari multiple refetch
  const hasRefreshedRef = useRef(false);
  const dialogOpenedTimeRef = useRef<number | null>(null);
  
  // Ambil informasi slot gabungan dari localStorage
  useEffect(() => {
    if (isOpen && slotId) {
      try {
        const storedCombinedInfo = localStorage.getItem('combinedSlotsInfo');
        if (storedCombinedInfo) {
          const combinedSlotsData = JSON.parse(storedCombinedInfo);
          if (combinedSlotsData && combinedSlotsData[slotId]) {
            setCombinedSlotInfo(combinedSlotsData[slotId]);
            console.log("Loaded combined slot info:", combinedSlotsData[slotId]);
          }
        }
      } catch (error) {
        console.error("Error loading combined slots info:", error);
      }
    }
  }, [isOpen, slotId]);
  
  // Logging additional debug info
  useEffect(() => {
    console.log("Current dialog state:", { 
      isOpen, 
      slotId,
      hasSlotData: !!slotData, 
      appointmentCount: appointmentData?.length || 0,
      isLoading,
      hasError: !!error,
      combinedInfo: combinedSlotInfo
    });
  }, [isOpen, slotId, slotData, appointmentData, isLoading, error, combinedSlotInfo]);
  
  // Effect untuk menangani loading data pada saat dialog dibuka dengan pendekatan state-based
  useEffect(() => {
    // Handler fungsi untuk clean up timeout
    let timeoutId: number | null = null;
    
    if (isOpen && slotId) {
      // Reset error saat dialog dibuka
      setError(null);
      setIsLoading(true);
      
      // Catat waktu dialog dibuka untuk analytics
      dialogOpenedTimeRef.current = Date.now();
      
      // Fungsi kecil untuk fetch data dengan proteksi
      const loadData = () => {
        console.log(`Dialog dibuka: loading data untuk slot ID ${slotId}`);
        
        // Gunakan flag untuk menghindari multiple fetch
        if (!hasRefreshedRef.current) {
          hasRefreshedRef.current = true;
          
          // Sedikit delay untuk memastikan dialog sudah terbuka
          // Hindari setTimeout ganda dengan clear sebelumnya jika ada
          if (timeoutId) clearTimeout(timeoutId);
          
          timeoutId = window.setTimeout(() => {
            fetchSlotAndAppointments()
              .catch(err => {
                console.error("Failed to fetch slot data:", err);
                setError(new Error("Gagal mengambil data. Silakan coba lagi."));
                setIsLoading(false);
              });
          }, 150);
        }
      };
      
      // Mulai proses load data
      loadData();
    } else if (!isOpen) {
      // Reset semua state saat dialog ditutup
      hasRefreshedRef.current = false;
      dialogOpenedTimeRef.current = null;
      
      // Clear timeout jika ada
      if (timeoutId) clearTimeout(timeoutId);
      
      // Reset state UI untuk memastikan tidak ada data yang muncul sebentar saat dialog dibuka lagi
      setAppointmentData([]);
      setSlotData(null);
      setError(null);
      setIsLoading(false);
    }
    
    // Cleanup pada unmount
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
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
  
  // Fungsi untuk toggle view mode
  const toggleViewMode = (checked: boolean) => {
    setShowAllSameTimeSlots(checked);
  };
  
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
  
  // State untuk tracking data pasien dari appointments
  const [hasEnrichedPatientData, setHasEnrichedPatientData] = useState(false);
  const patientDataCacheRef = useRef<Record<number, any>>({});

  // Effect untuk fetch pasien dari patientIds saat appointmentData diupdate
  // dengan mekanisme caching dan fallback untuk ketahanan
  useEffect(() => {
    // Jika ada patientIds dan dialog terbuka, fetch data pasien
    if (patientIds.length > 0 && isOpen) {
      // Reset flag enrichment
      setHasEnrichedPatientData(false);
      
      const fetchPatients = async () => {
        try {
          console.log(`Fetching data untuk ${patientIds.length} pasien`);
          
          // Menggunakan Promise.allSettled untuk menangani kasus sebagian request gagal
          const patientPromises = patientIds.map(id => {
            // Cek cache dulu
            if (patientDataCacheRef.current[id]) {
              console.log(`Using cached data for patient ${id}`);
              return Promise.resolve(patientDataCacheRef.current[id]);
            }
            
            // Jika tidak ada di cache, fetch dengan timeout 5 detik
            return new Promise((resolve) => {
              const abortController = new AbortController();
              const timeoutId = setTimeout(() => abortController.abort(), 5000);
              
              fetch(`/api/patients/${id}`, { 
                signal: abortController.signal,
                headers: { 'Cache-Control': 'no-cache' }
              })
                .then(res => res.json())
                .then(data => {
                  clearTimeout(timeoutId);
                  // Simpan ke cache untuk penggunaan berikutnya
                  if (data && data.id) {
                    patientDataCacheRef.current[id] = data;
                  }
                  resolve(data);
                })
                .catch(err => {
                  clearTimeout(timeoutId);
                  console.error(`Error fetching patient ${id}:`, err);
                  resolve(null); // Resolve null alih-alih reject
                });
            });
          });
          
          const patientsResults = await Promise.allSettled(patientPromises);
          const patientsData = patientsResults
            .map(result => result.status === 'fulfilled' ? result.value : null)
            .filter(Boolean);
          
          console.log(`Retrieved ${patientsData.length} of ${patientIds.length} patient records`);
          
          // Update appointment data dengan informasi pasien
          if (patientsData.length > 0) {
            setAppointmentData(prev => 
              prev.map(app => {
                // Cari data pasien dari hasil fetch
                const patientData = patientsData.find(p => p && p.id === app.patientId);
                
                // Jika data pasien ditemukan, update appointment
                // Jika tidak ditemukan, simpan data minimal yang ada di appointment
                if (patientData) {
                  return { ...app, patient: patientData };
                } else if (app.patient && app.patient.id) {
                  // Jika appointment sudah memiliki data pasien minimal, simpan
                  return app;
                } else {
                  // Fallback dengan data minimal
                  return { 
                    ...app, 
                    patient: { 
                      id: app.patientId,
                      name: app.patientName || `Pasien #${app.patientId}`,
                      phoneNumber: app.phoneNumber || '-'
                    } 
                  };
                }
              })
            );
          }
          
          setHasEnrichedPatientData(true);
        } catch (error) {
          console.error("Error enriching patient data:", error);
          // Tetap tandai bahwa proses enrichment sudah selesai meskipun error
          setHasEnrichedPatientData(true);
        }
      };
      
      fetchPatients();
    }
  }, [patientIds.join(','), isOpen]);
  
  // Proses dan enrich data appointment dengan informasi lengkap
  const processAppointmentData = useMemo(() => {
    if (!appointmentData || !Array.isArray(appointmentData)) {
      return [];
    }
    
    // 0. Filter berdasarkan mode tampilan (universal atau slot saat ini saja)
    let filteredAppointments = appointmentData;
    
    // Jika mode tampilan TIDAK universal, filter hanya dari slot saat ini
    if (!showAllSameTimeSlots) {
      filteredAppointments = appointmentData.filter(app => !app.fromOtherSlot);
    }
    
    // 1. Filter hanya appointment aktif
    const activeAppointments = filteredAppointments.filter(app => app && isActiveStatus(app.status));
    console.log("Active appointment count:", activeAppointments.length);
    
    // 2. Urutkan berdasarkan status dan nama pasien (jika tersedia)
    const sortedAppointments = [...activeAppointments].sort((a, b) => {
      // Status: Active lebih dulu, lalu Scheduled/Confirmed
      const statusA = (a.status || '').toLowerCase();
      const statusB = (b.status || '').toLowerCase();
      
      if (statusA === 'active' && statusB !== 'active') return -1;
      if (statusA !== 'active' && statusB === 'active') return 1;
      
      // Urutkan berdasarkan nama pasien
      const nameA = (a.patient?.name || '').toLowerCase();
      const nameB = (b.patient?.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
    
    return sortedAppointments;
  }, [appointmentData, showAllSameTimeSlots]);
  
  // Debug logging in development - versi sederhana
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log("Total appointment data:", appointmentData?.length || 0);
      console.log("Active appointment data:", processAppointmentData.length);
    }
  }, [appointmentData, processAppointmentData]);
  
  // Debug flag untuk troubleshooting UI
  const showDebugInfo = process.env.NODE_ENV === 'development';
  
  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto p-4 md:p-6">
          <DialogHeader className="px-0">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <CalendarIcon className="h-5 w-5 text-primary" />
              Detail Slot Terapi {slotId ? `(ID: ${slotId})` : ''}
            </DialogTitle>
            <DialogDescription>
              {slotData 
                ? `${formatDate(slotData.date)} · ${slotData.timeSlot || '-'}`
                : "Menampilkan detail slot terapi dan daftar pasien"}
            </DialogDescription>
          </DialogHeader>
          
          {/* Server error fallback message - tampil saat ada error server/database */}
          {error && error.message.includes("Internal server error") && (
            <div className="mb-3 p-3 text-sm border rounded bg-amber-50 text-amber-900">
              <div className="font-medium mb-1 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="mr-1" viewBox="0 0 16 16">
                  <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                  <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
                </svg>
                Koneksi Database Sementara Terputus
              </div>
              <p className="text-sm">
                Server sedang sibuk atau mengalami masalah koneksi ke database. 
                Data yang tampil mungkin tidak lengkap atau tidak up-to-date.
              </p>
              <div className="mt-2 flex gap-2">
                <Button 
                  size="sm"
                  variant="secondary"
                  className="text-xs"
                  onClick={() => {
                    setError(null);
                    window.location.reload();
                  }}
                >
                  Reload Halaman
                </Button>
                <Button 
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => {
                    // State loader untuk tombol
                    const btn = document.activeElement as HTMLButtonElement;
                    if (btn) {
                      const originalText = btn.textContent;
                      btn.textContent = '⏳ Memeriksa...';
                      btn.disabled = true;
                      
                      // Manual retry dengan timeout yang sangat singkat
                      fetch(`/api/ping`, { 
                        signal: AbortSignal.timeout(2000),
                        headers: {
                          'Cache-Control': 'no-cache',
                          'Pragma': 'no-cache'
                        }
                      })
                        .then(res => res.json())
                        .then(data => {
                          if (data && data.status === 'ok') {
                            toast({
                              title: "Koneksi Pulih",
                              description: `Server aktif (uptime: ${Math.floor(data.uptime / 60)} menit)`,
                            });
                            setTimeout(() => {
                              setError(null);
                              refetch();
                            }, 500);
                          }
                        })
                        .catch(e => {
                          toast({
                            title: "Server Masih Down",
                            description: "Coba beberapa saat lagi atau refresh halaman",
                            variant: "destructive"
                          });
                        })
                        .finally(() => {
                          // Reset tombol
                          if (btn) {
                            btn.textContent = originalText;
                            btn.disabled = false;
                          }
                        });
                    }
                  }}
                >
                  Coba Koneksi
                </Button>
              </div>
            </div>
          )}
          
          {/* Debug info */}
          {showDebugInfo && (
            <div className="mb-3 p-2 text-xs border rounded bg-yellow-50 text-yellow-900">
              <p>Debug mode: Dialog state</p>
              <div className="grid grid-cols-2 gap-x-2">
                <span>Loading:</span><span>{isLoading ? "Ya" : "Tidak"}</span>
                <span>Error:</span><span>{error ? "Ya" : "Tidak"}</span>
                <span>SlotID:</span><span>{slotId || "None"}</span>
                <span>Slot Data:</span><span>{slotData ? "Loaded" : "Empty"}</span>
                <span>Appointments:</span><span>{appointmentData?.length || 0}</span>
              </div>
              <button 
                className="mt-1 text-xs px-2 py-0.5 bg-yellow-200 hover:bg-yellow-300 rounded"
                onClick={refetch}
              >
                Refresh Data
              </button>
            </div>
          )}
          
          {/* Loading state */}
          {isLoading && (
            <div className="flex flex-col justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <p className="text-sm text-muted-foreground">Memuat data slot terapi...</p>
            </div>
          )}
          
          {/* Error state - dengan opsi fallback dan informasi tambahan */}
          {!isLoading && error && (
            <div className="p-4 rounded-md border border-destructive/20 bg-destructive/10 text-destructive">
              <div className="font-medium mb-1">Terjadi kesalahan:</div>
              <p className="text-sm">{(error as Error).message}</p>
              
              <div className="mt-2 text-xs text-muted-foreground">
                <p>Server mungkin sedang sibuk atau memerlukan waktu untuk merespons.</p>
                {slotData && (
                  <p className="mt-1">
                    Data dasar slot terapi telah dimuat, tetapi data pasien mungkin tidak lengkap.
                  </p>
                )}
              </div>
              
              <div className="flex gap-2 mt-3">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setError(null);
                    fetchSlotAndAppointments();
                  }}
                >
                  <span className="mr-2">↺</span> Coba Lagi
                </Button>
                
                {error.message.includes("timeout") && (
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => {
                      // Reset error tapi jangan reset slot data jika sudah ada
                      setError(null);
                      // Batas waktu lebih pendek untuk retry cepat
                      setTimeout(() => {
                        // Pertama coba retry dengan timeout diperpendek
                        try {
                          fetch(`/api/therapy-slots/${slotId}`, {
                            headers: {
                              'Accept': 'application/json',
                              'Cache-Control': 'no-cache'
                            },
                            signal: AbortSignal.timeout(3000) // 3 detik max
                          })
                          .then(res => res.json())
                          .then(data => {
                            if (data && data.id === slotId) {
                              setSlotData(data);
                              toast({
                                title: "Data Dimuat",
                                description: "Data slot terapi berhasil dimuat",
                              });
                            }
                          })
                          .catch(e => console.error("Quick retry failed:", e));
                        } catch (e) {
                          console.error("Error during quick retry:", e);
                        }
                      }, 500);
                    }}
                  >
                    <span className="mr-2">⚡</span> Retry Cepat
                  </Button>
                )}
              </div>
            </div>
          )}
          
          {/* Empty state */}
          {!isLoading && !error && !slotData && (
            <div className="text-center p-6 border rounded-md bg-muted/20">
              <p className="text-muted-foreground mb-2">Data slot tidak tersedia</p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  fetchSlotAndAppointments();
                }}
              >
                <span className="mr-2">↺</span> Muat Ulang
              </Button>
            </div>
          )}
          
          {/* Slot data loaded successfully */}
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
                  <div>
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      Daftar Pasien
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                        Tampilan Gabungan
                      </Badge>
                    </h3>
                    {combinedSlotInfo && combinedSlotInfo.ids.length > 1 && (
                      <p className="text-xs text-green-600 mt-1">
                        * Menampilkan semua pasien dari {combinedSlotInfo.ids.length} slot pada jam yang sama ({slotData?.timeSlot})
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
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
                          
                          // Siapkan parameter untuk pendaftaran
                          let queryParams = new URLSearchParams();
                          queryParams.append('walkin', 'true');
                          queryParams.append('slotId', String(slotId));
                          
                          // Jika slotData tersedia dan memiliki timeSlotKey, gunakan itu
                          if (slotData && slotData.timeSlotKey) {
                            console.log(`Menggunakan timeSlotKey yang ada: ${slotData.timeSlotKey}`);
                            queryParams.append('timeSlotKey', slotData.timeSlotKey);
                          } 
                          // Jika tidak ada timeSlotKey, tapi ada tanggal dan waktu, generate timeSlotKey
                          else if (slotData && slotData.date && slotData.timeSlot) {
                            // Format tanggal ke YYYY-MM-DD
                            let dateStr;
                            
                            if (typeof slotData.date === 'string') {
                              if (slotData.date.includes('T')) {
                                dateStr = slotData.date.split('T')[0];
                              } else if (slotData.date.includes(' ')) {
                                dateStr = slotData.date.split(' ')[0];
                              } else {
                                dateStr = slotData.date;
                              }
                            } else {
                              // Jika tanggal bukan string, konversi ke string
                              const dateObj = new Date(slotData.date);
                              dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
                            }
                            
                            // Buat timeSlotKey dengan format YYYY-MM-DD_HH:MM-HH:MM
                            const generatedTimeSlotKey = `${dateStr}_${slotData.timeSlot}`;
                            console.log(`Generated timeSlotKey: ${generatedTimeSlotKey}`);
                            
                            // Tambahkan ke parameter URL
                            queryParams.append('timeSlotKey', generatedTimeSlotKey);
                          }
                          
                          // Redirect ke halaman pendaftaran dengan parameter
                          navigate(`/register?${queryParams.toString()}`);
                        }}
                      >
                        <User className="h-3 w-3 mr-1" />
                        Daftarkan Pasien
                      </Button>
                    )}
                  </div>
                </div>
                {!processAppointmentData.length ? (
                  <p className="text-center py-4 text-sm text-muted-foreground border rounded">
                    Belum ada pasien aktif
                  </p>
                ) : (
                  <div className="border rounded-md divide-y">
                    {processAppointmentData.map((appointment: any) => (
                      <div 
                        key={appointment.id} 
                        className={`p-3 text-sm hover:bg-muted/50 transition-colors cursor-pointer ${appointment.fromOtherSlot ? 'border-l-4 border-amber-400' : ''}`}
                        onClick={() => navigateToPatientDetail(appointment.patient)}
                      >
                        <div className="font-medium flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span>{appointment.patient?.name || 'Pasien tidak diketahui'}</span>
                            {appointment.fromOtherSlot && (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                                Slot #{appointment.therapySlotId}
                              </Badge>
                            )}
                          </div>
                          <Badge className={getStatusClass(appointment.status)}>
                            {appointment.status || 'Unknown'}
                          </Badge>
                        </div>
                        <div className="text-muted-foreground text-xs mt-1 mb-2">
                          {appointment.patient?.phoneNumber || '-'}
                          {appointment.fromOtherSlot && (
                            <span className="ml-2 text-amber-600">
                              • Jam yang sama, slot berbeda
                            </span>
                          )}
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