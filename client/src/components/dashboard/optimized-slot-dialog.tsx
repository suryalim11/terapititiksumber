import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CalendarIcon, User, ShoppingCart, MessageSquare, Check, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { formatWhatsAppNumber, generateWhatsAppLink } from "@/lib/utils";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

interface OptimizedSlotDialogProps {
  slotId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

// Tipe data untuk slot terapi
interface SlotData {
  id: number;
  date: string | Date;
  timeSlot: string;
  timeSlotKey?: string; // Kunci unik berdasarkan tanggal+waktu
  maxQuota: number;
  currentCount: number;
  status: string;
  isActive?: boolean; // Status keaktifan slot
}

// Formatting helper functions
function formatDate(dateInput?: string | Date): string {
  if (!dateInput) return '-';
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return format(date, 'dd MMMM yyyy', { locale: localeId });
  } catch (error) {
    return 'Format tanggal tidak valid';
  }
}

export function OptimizedSlotDialog({ slotId, isOpen, onClose }: OptimizedSlotDialogProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  // State
  const [slotData, setSlotData] = useState<SlotData | null>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Prevent duplicate fetch
  const fetchInProgressRef = useRef(false);
  
  // Fetch data method with timeout handler
  const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 8000, retryCount = 2): Promise<Response> => {
    let lastError;
    
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        let timeoutId: number | null = null;
        
        const timeoutPromise = new Promise<Response>((_, reject) => {
          timeoutId = window.setTimeout(() => {
            reject(new Error(`Request timeout (${timeoutMs}ms)`));
          }, timeoutMs);
        });
        
        const fetchPromise = fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'Cache-Control': 'no-cache, no-store',
            'Pragma': 'no-cache',
          },
          credentials: 'include'
        });
        
        const response = await Promise.race([fetchPromise, timeoutPromise]);
        
        if (timeoutId) clearTimeout(timeoutId);
        
        if (!window.navigator.onLine) {
          throw new Error("Perangkat offline");
        }
        
        return response;
      } catch (err: any) {
        lastError = err;
        const waitTime = Math.min(500 * Math.pow(2, attempt), 4000);
        
        if (!window.navigator.onLine) {
          await new Promise<void>(resolve => {
            const onlineHandler = () => {
              window.removeEventListener('online', onlineHandler);
              resolve();
            };
            window.addEventListener('online', onlineHandler);
          });
        }
        else if (attempt < retryCount) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    throw lastError || new Error(`Fetch gagal setelah ${retryCount + 1} percobaan`);
  };
  
  // Main fetch function with optimized approach
  const fetchSlotAndPatients = async (forceRefresh = false) => {
    console.log("📊 Memulai proses load data slot dan pasien", slotId, forceRefresh ? "(Force Refresh)" : "");
    
    // Skip if already fetching, unless force refresh
    if (fetchInProgressRef.current && !forceRefresh) {
      console.log("⚠️ Ada fetch yang sedang berjalan, skip request");
      return;
    }
    
    // Set flag that fetch is in progress
    fetchInProgressRef.current = true;
    
    // Reset state
    setIsLoading(true);
    setError(null);
    
    if (!slotId) {
      // Missing slot ID handling
      console.error("❌ Slot ID tidak tersedia");
      setIsLoading(false);
      setError(new Error("Slot ID tidak tersedia"));
      fetchInProgressRef.current = false;
      return;
    }
    
    const fetchStartTime = Date.now();
    // Tambahkan timestamp untuk mencegah caching
    const cacheBuster = Date.now(); 
    
    try {
      // NEW APPROACH: Use optimized endpoint
      // with single server query for slot + appointments at once
      console.log(`📥 Mengambil data slot dan pasien untuk ID: ${slotId} dari endpoint optimized`);
      
      // Use optimized endpoint with cache buster
      const optimizedEndpoint = `/api/therapy-slots/${slotId}/patients?_t=${cacheBuster}`;
      
      // Set proper cache control and timeout
      const response = await fetchWithTimeout(
        optimizedEndpoint, 
        {
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache, no-store',
            'Pragma': 'no-cache'
          }
        },
        8000,  // 8 second timeout (increased)
        2      // 2 retries
      );
      
      if (response.ok) {
        // Response is { slot: {...}, appointments: [...] }
        const result = await response.json();
        console.log(`✅ Data diterima dari endpoint optimized dengan ${result.appointments ? result.appointments.length : 0} pasien`);
        
        // Debug appointments data
        if (result.appointments && result.appointments.length > 0) {
          console.log("📋 Detail status pasien yang diterima:");
          result.appointments.forEach((app: any) => {
            console.log(`   - Pasien: ${app.patient?.name || 'Unknown'}, Status: ${app.status || 'Unknown'}, ID: ${app.id}`);
          });
        }
        
        // Set data to state
        setSlotData(result.slot);
        setAppointments(result.appointments || []);
        
        const fetchEndTime = Date.now();
        console.log(`⏱️ Slot data fetch selesai dalam ${fetchEndTime - fetchStartTime}ms`);
      } else {
        console.error(`❌ Error respons dari endpoint optimized: ${response.status}`);
        setError(new Error(`Gagal mengambil data: ${response.status}`));
        
        // Tampilkan toast untuk user
        toast({
          title: "Gagal memuat data",
          description: `Server merespons dengan kode: ${response.status}`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("❌ Error saat mengambil data:", error);
      setError(new Error("Terjadi kesalahan saat mengambil data. Coba lagi."));
      
      // Tampilkan toast untuk user
      toast({
        title: "Error",
        description: `${(error as Error).message || 'Gagal memuat data. Silakan coba lagi.'}`,
        variant: "destructive"
      });
    } finally {
      const totalTime = Date.now() - fetchStartTime;
      console.log(`⏱️ Total waktu proses: ${totalTime}ms`);
      
      // Reset loading state
      setIsLoading(false);
      
      // Reset fetch flag
      fetchInProgressRef.current = false;
    }
  };
  
  // Effect to fetch data when dialog opens
  useEffect(() => {
    if (isOpen && slotId) {
      fetchSlotAndPatients();
    }
    
    // Cleanup function
    return () => {
      // No cleanup needed as we're using refs to handle loading state
    };
  }, [isOpen, slotId]);
  
  // Navigasi ke halaman pasien
  const handlePatientClick = (patientId: number) => {
    if (!patientId) return;
    
    onClose();
    navigate(`/patients/${patientId}`);
  };
  
  // Navigasi ke halaman transaksi
  const handleTransactionClick = (patient: any, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    
    if (!patient || !patient.id) {
      toast({
        title: "Error",
        description: "Data pasien tidak lengkap",
        variant: "destructive"
      });
      return;
    }
    
    onClose();
    
    // Gunakan parameter query yang lebih lengkap seperti di SlotPatientsDialog
    const patientIdNumber = Number(patient.id);
    
    // Tambahkan parameter untuk memastikan form transaksi terbuka langsung
    navigate(`/transactions?patientId=${patientIdNumber}&patientName=${encodeURIComponent(patient.name || '')}&hideDropdown=true&delay=2000&source=optimized-dialog&timestamp=${Date.now()}`);
    
    // Tambahkan toast untuk memberikan feedback
    toast({
      title: "Membuat transaksi baru",
      description: `Mempersiapkan transaksi untuk ${patient.name || 'pasien'}`,
      duration: 3000
    });
    
    // Tunggu sebentar untuk memastikan halaman transaksi sudah dimuat, lalu kirim event
    setTimeout(() => {
      // Log yang lebih jelas untuk debugging
      console.log("🚀 Mempersiapkan event openTransactionForm dari OptimizedSlotDialog");
      
      try {
        // Buat custom event untuk membuka form transaksi dengan data pasien
        // PENTING: Gunakan nama event yang sama persis dengan yang digunakan di transactions.tsx
        const evt = new CustomEvent('openTransactionForm', { 
          detail: { 
            patientId: patientIdNumber, 
            patientName: patient.name || 'pasien',
            timestamp: Date.now(),
            source: 'optimized-dialog' 
          }
        });
        
        // Log dan kirim event
        console.log("📤 Mengirim event openTransactionForm dengan detail:", evt.detail);
        window.dispatchEvent(evt);
        console.log("✅ Event openTransactionForm telah terkirim");
        
        // Tambahan: simpan di localStorage sebagai fallback
        localStorage.setItem('pendingTransactionPatientId', String(patientIdNumber));
        localStorage.setItem('pendingTransactionPatientName', patient.name || '');
        
        // Menambahkan notifikasi toast untuk informasi pengguna bahwa proses sedang berlangsung
        toast({
          title: "Membuka form transaksi",
          description: "Mohon tunggu sebentar, halaman transaksi sedang disiapkan...",
          duration: 3000
        });
      } catch (error) {
        console.error("⚠️ Error saat mengirim event openTransactionForm:", error);
        toast({
          title: "Terjadi Kesalahan",
          description: "Gagal membuka form transaksi. Coba lagi nanti.",
          variant: "destructive"
        });
      }
    }, 300);
  };
  
  // Fungsi untuk mengubah status appointment
  const handleStatusChange = async (appointmentId: number, newStatus: string, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    
    console.log(`🔄 handleStatusChange dipanggil dengan ID: ${appointmentId}, status baru: ${newStatus}`);
    
    if (!appointmentId) {
      console.error("ID appointment tidak valid:", appointmentId);
      toast({
        title: "Error",
        description: "ID appointment tidak valid",
        variant: "destructive"
      });
      return;
    }
    
    try {
      console.log(`📤 Mengirim permintaan ke /api/appointments/${appointmentId}/status`);
      
      // Kirim permintaan untuk mengubah status
      const response = await fetch(`/api/appointments/${appointmentId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({ status: newStatus }),
        credentials: 'include'
      });
      
      console.log(`📥 Menerima respons: ${response.status}`);
      
      // Coba ambil body respons untuk informasi lebih detail
      let responseBody = null;
      try {
        responseBody = await response.json();
        console.log("Respons body:", responseBody);
      } catch (e) {
        console.log("Tidak dapat mengambil respons body:", e);
      }
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status} - ${responseBody?.message || 'Unknown error'}`);
      }
      
      // Reload data appointment untuk memperbarui tampilan
      toast({
        title: "Berhasil",
        description: `Status berhasil diubah menjadi: ${newStatus}`,
        variant: "default"
      });
      
      console.log("✅ Status berhasil diperbarui, sekarang memuat ulang data dengan forceRefresh=true");
      
      // Reload data appointment setelah status diubah (paksa refresh)
      await fetchSlotAndPatients(true);
      
    } catch (error) {
      console.error("❌ Gagal mengubah status:", error);
      toast({
        title: "Gagal",
        description: `Gagal mengubah status: ${(error as Error).message || 'Silakan coba lagi.'}`,
        variant: "destructive"
      });
    }
  };
  
  // Komponen StatusDropdown untuk menampilkan dan mengubah status
  const StatusDropdown = ({ appointment, stopPropagation = true }: { appointment: any, stopPropagation?: boolean }) => {
    const [isUpdating, setIsUpdating] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const statusOptions = ["Scheduled", "Completed", "Cancelled", "No-Show"];
    const currentStatus = appointment?.status || "Pending";
    
    // Debug pada render komponen
    useEffect(() => {
      console.log(`🔍 StatusDropdown mounted for ${appointment?.patient?.name || 'Unknown'}`);
      console.log(`   - Current status: ${currentStatus}`);
      console.log(`   - Appointment ID: ${appointment?.id}`);
      
      return () => {
        console.log(`🔍 StatusDropdown unmounted for appointment ID: ${appointment?.id}`);
      };
    }, [appointment?.id, appointment?.patient?.name, currentStatus]);
    
    const updateStatus = async (status: string) => {
      if (status === currentStatus) {
        console.log("🚫 Status tidak berubah, tidak perlu update:", status);
        setIsOpen(false);
        return;
      }
      
      console.log(`🔄 Mencoba mengubah status dari "${currentStatus}" ke "${status}" untuk ID:${appointment.id}`);
      setIsUpdating(true);
      
      try {
        // Feedback visual untuk menunjukkan proses sedang berjalan
        toast({
          title: "Memproses...",
          description: `Mengubah status menjadi ${status}`,
          duration: 3000,
        });
        
        await handleStatusChange(appointment.id, status);
        console.log(`✅ Berhasil mengubah status menjadi: "${status}"`);
      } catch (error) {
        console.error("❌ Gagal mengubah status:", error);
        toast({
          title: "Gagal",
          description: `Error saat mengubah status: ${(error as Error).message}`,
          variant: "destructive",
          duration: 4000,
        });
      } finally {
        setIsUpdating(false);
        setIsOpen(false); // Tutup dropdown setelah perubahan
      }
    };
    
    return (
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 text-xs" 
            disabled={isUpdating}
            onClick={(e) => {
              if (stopPropagation) e.stopPropagation();
              // Toggle dropdown secara manual
              setIsOpen(!isOpen);
            }}
          >
            {isUpdating ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <><Check className="h-3 w-3 mr-1" /> Status</>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-32">
          {statusOptions.map((status) => (
            <DropdownMenuItem
              key={status}
              onSelect={(e) => {
                // Gunakan onSelect alih-alih onClick untuk dropdownmenu
                // Hentikan event default
                e.preventDefault();
                
                console.log(`🖱️ Item status "${status}" diklik`);
                if (status === currentStatus) {
                  console.log(`⚠️ Status "${status}" sama dengan status saat ini, tidak ada tindakan`);
                  return;
                }
                
                // Panggil fungsi update dengan slight delay
                setTimeout(() => {
                  updateStatus(status);
                }, 10);
              }}
              disabled={isUpdating || status === currentStatus}
              className={`${status === currentStatus ? "bg-muted font-medium" : ""} ${
                status === "Completed" ? "text-green-600" : 
                status === "Cancelled" ? "text-red-600" : 
                status === "No-Show" ? "text-amber-600" : ""
              }`}
            >
              {status === currentStatus ? `✓ ${status}` : status}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };
  
  // Fungsi untuk mengirim pengingat via WhatsApp
  const handleReminderClick = (patient: any, appointment: any, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    
    if (!patient || !patient.phoneNumber) {
      toast({
        title: "Error",
        description: "Nomor telepon pasien tidak tersedia",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // Format nomor telepon untuk WhatsApp
      const formattedNumber = formatWhatsAppNumber(patient.phoneNumber);
      
      // Template pesan pengingat
      const message = `Halo ${patient.name || 'Bapak/Ibu'}, kami mengingatkan jadwal terapi Anda pada ${formatDate(slotData?.date)} pukul ${slotData?.timeSlot}. Terima kasih.`;
      
      // Buka WhatsApp
      const whatsappLink = generateWhatsAppLink(formattedNumber, message);
      window.open(whatsappLink, '_blank');
    } catch (error) {
      toast({
        title: "Gagal",
        description: "Gagal mengirim pengingat. Silakan coba lagi.",
        variant: "destructive"
      });
    }
  };
  
  // If not open, don't render anything
  if (!isOpen) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Detail Slot Terapi
          </DialogTitle>
          <DialogDescription>
            Menampilkan detail slot terapi dan daftar pasien
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Memuat data slot dan pasien...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8 space-y-3">
            <p className="text-destructive">{error.message}</p>
            <Button size="sm" onClick={() => fetchSlotAndPatients(true)}>Coba Lagi</Button>
          </div>
        ) : !slotData ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Data slot tidak tersedia</p>
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            {/* Slot info */}
            <div className="bg-muted/50 rounded-lg p-3 border">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="text-muted-foreground">Tanggal:</div>
                <div className="font-medium">{formatDate(slotData.date)}</div>
                
                <div className="text-muted-foreground">Waktu:</div>
                <div className="font-medium">{slotData.timeSlot || '-'}</div>
                
                <div className="text-muted-foreground">Kuota:</div>
                <div className="font-medium">
                  {appointments.length || 0} / {slotData.maxQuota || 0}
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
            
            {/* Patient list */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">Daftar Pasien</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {appointments.length} pasien
                  </span>
                  <Button 
                    size="sm" 
                    onClick={() => {
                      onClose();
                      if (slotData?.id) {
                        // Simpan ID slot ke sessionStorage
                        sessionStorage.setItem('selectedSlotId', String(slotData.id));
                        
                        // Siapkan parameter untuk pendaftaran
                        let queryParams = new URLSearchParams();
                        queryParams.append('walkin', 'true');
                        queryParams.append('isWalkInMode', 'true'); // Tambahkan parameter isWalkInMode
                        queryParams.append('slotId', String(slotData.id));
                        
                        // Tambahkan timeSlotKey jika tersedia
                        if (slotData.timeSlotKey) {
                          queryParams.append('timeSlotKey', slotData.timeSlotKey);
                        } 
                        // Jika tidak ada timeSlotKey, tapi ada tanggal dan waktu, generate timeSlotKey
                        else if (slotData.date && slotData.timeSlot) {
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
                          
                          // Tambahkan ke parameter URL
                          queryParams.append('timeSlotKey', generatedTimeSlotKey);
                        }
                        
                        // Gunakan URL yang benar: /daftar
                        window.open(`/daftar?${queryParams.toString()}`, '_blank');
                      }
                    }}
                    className="h-7 text-xs"
                  >
                    Daftarkan Pasien
                  </Button>
                </div>
              </div>
              
              {appointments.length === 0 ? (
                <div className="text-center py-8 border rounded-md">
                  <p className="text-muted-foreground text-sm">Belum ada pasien terdaftar</p>
                </div>
              ) : (
                <div className="border rounded-md divide-y">
                  {appointments.map((appointment) => (
                    <div 
                      key={appointment.id}
                      className="p-3 hover:bg-muted/50"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">
                            {appointment.patient?.name || 'Pasien'}
                            {appointment.notes?.includes('walk-in') && (
                              <Badge className="ml-2 bg-blue-100 text-blue-800">WALK-IN</Badge>
                            )}
                          </div>
                          <div className="text-muted-foreground text-xs mt-1">
                            {appointment.patient?.phoneNumber || '-'}
                          </div>
                        </div>
                        <Badge>{appointment.status || 'Pending'}</Badge>
                      </div>
                      
                      <div className="flex flex-wrap gap-1 mt-2">
                        {/* Detail Pasien */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handlePatientClick(appointment.patient?.id || appointment.patientId)}
                        >
                          <User className="h-3 w-3 mr-1" />
                          Detail
                        </Button>
                        
                        {/* Dropdown Status */}
                        <StatusDropdown appointment={appointment} />
                        
                        {/* Transaksi */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={(e) => handleTransactionClick(appointment.patient, e)}
                        >
                          <ShoppingCart className="h-3 w-3 mr-1" />
                          Transaksi
                        </Button>
                        
                        {/* Pengingat */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={(e) => handleReminderClick(appointment.patient, appointment, e)}
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
            
            {/* Refresh data button */}
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchSlotAndPatients(true)}
                className="w-full"
              >
                Refresh Data
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}