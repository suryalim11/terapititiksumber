import { useState } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Link } from "wouter";

// Fungsi perbaikan format waktu dihapus untuk menghindari kebingungan
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart3, 
  Calendar, 
  DollarSign,
  PackageIcon, 
  UserRound,
  Users,
  AlertCircle,
  RefreshCw,
  Loader2,
  Eye,
  EyeOff,
  RefreshCcw,
  Database,
  Edit3,
  PencilLine,
  Link2
} from "lucide-react";
import { 
  cn, 
  formatRupiah, 
  formatDateDDMMYYYY, 
  getTodayInWIB,
  dateToWIBDateString,
  isSameDayInWIB,
  getStartOfDayWIB
} from "@/lib/utils";
import { clearPatientDataCache } from "@/lib/clear-cache";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { SlotPatientsDialog } from "@/components/dashboard/slot-patients-dialog";
// Import komponen dialog yang lebih sederhana
import { SimpleSlotDialog } from "@/components/dashboard/simple-slot-dialog";
import { SessionEditorDialog } from "@/components/dashboard/session-editor-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

interface DashboardStats {
  patientsToday: number;
  incomeToday: number;
  productsSold: number;
  activePackages: number;
}

interface RecentActivity {
  id: number;
  type: string;
  description: string;
  timestamp: string;
}

interface ActivePackage {
  id: number;
  patient: {
    id: number;
    name: string;
    patientId: string;
  } | null;
  package: {
    id: number;
    name: string;
    sessions: number;
  } | null;
  status: string;
  startDate: string;
  lastSessionDate: string | null;
  sessionsUsed: number;
  totalSessions: number;
  progress: number;
}

// Define therapy slot interface
interface TherapySlot {
  id: number;
  date: string;
  timeSlot: string;
  isActive: boolean;
  maxQuota: number;  // Kuota standar slot individu
  currentCount: number;
  percentage?: number;
  createdAt?: string | Date;
  totalMaxQuota?: number; // Total kuota gabungan dari beberapa slot dengan jam yang sama
}

export default function Dashboard() {
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isOptimizedDialogOpen, setIsOptimizedDialogOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("today"); // Default to "today" view
  const [showBalance, setShowBalance] = useState(false); // Default: hide balance
  const [isSyncing, setIsSyncing] = useState(false); // State untuk status sinkronisasi
  const [isSessionEditorOpen, setIsSessionEditorOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [isAutoConnecting, setIsAutoConnecting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null); // State untuk tanggal yang dipilih
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Format today's date to YYYY-MM-DD for API query with WIB timezone
  const todayWIB = getTodayInWIB(); // Dapatkan hari ini dalam timezone WIB
  const formattedToday = dateToWIBDateString(todayWIB); // Format ke YYYY-MM-DD
  
  // Format selected date if available
  const formattedSelectedDate = selectedDate ? dateToWIBDateString(selectedDate) : formattedToday;
  

  
  // Fetch dashboard stats with auto-refresh (every 10 seconds)
  const { data: stats = { patientsToday: 0, incomeToday: 0, productsSold: 0, activePackages: 0 }, refetch: refetchStats } = 
    useQuery<DashboardStats>({
      queryKey: ['/api/dashboard/stats'],
      refetchInterval: 10000, // Refresh every 10 seconds
    });

  // Tidak lagi menampilkan aktivitas terbaru
  
  // Fetch today's appointments with auto-refresh
  const { data: todayAppointments = [], refetch: refetchAppointments } = useQuery<any[]>({
    queryKey: [`/api/appointments/date/${formattedToday}`],
    refetchInterval: 10000,
  });
  
  // Fungsi untuk mendapatkan tanggal dari slot (YYYY-MM-DD) dari format apapun
  const getSlotDateStr = (slot: TherapySlot): string => {
    if (!slot || !slot.date) {
      console.log("Error: Slot tidak valid atau tidak memiliki tanggal:", slot);
      // Silent error handling
      return '';
    }
    
    try {
      let resultDate = '';
      
      if (typeof slot.date === 'string') {
        // Format: untuk database PostgreSQL biasanya "2025-05-12T00:00:00.000Z"
        if (slot.date.includes('T')) {
          resultDate = slot.date.split('T')[0];
        } else if (slot.date.includes(' ')) {
          // Format lama: "2025-04-07 00:00:00" -> ambil "2025-04-07"
          resultDate = slot.date.split(' ')[0]; 
        } else {
          // Sudah dalam format YYYY-MM-DD
          resultDate = slot.date;
        }
      } else {
        // Format: Date object -> convert ke string "2025-04-07" 
        resultDate = new Date(slot.date).toISOString().split('T')[0];
      }
      
      // Log debug dinonaktifkan untuk mengurangi spam konsol
      // console.log(`Memproses slot ID:${slot.id}, tanggal asli: "${slot.date}" -> hasil format: "${resultDate}"`);
      return resultDate;
    } catch (error) {
      console.error("Error memproses tanggal slot:", error, slot);
      return '';
    }
  };

  // Gunakan API ini sebagai satu-satunya sumber data slot
  const { data: slotsByPeriod = [], isLoading: isSlotsLoading, refetch: refetchSlotsByPeriod, error: slotsError } = useQuery<TherapySlot[]>({
    queryKey: ['/api/slots-by-period', selectedPeriod],
    queryFn: async () => {
      try {
        // Modifikasi endpoint berdasarkan periode yang dipilih
        let apiUrl = '/api/therapy-slots';
        
        // Gunakan zona waktu WIB untuk semua perhitungan tanggal
        const nowWIB = getStartOfDayWIB(new Date()); // Tanggal hari ini dalam WIB, jam 00:00:00
        
        if (selectedPeriod === 'today') {
          // Untuk hari ini, filter berdasarkan tanggal
          apiUrl = `/api/therapy-slots?date=${formattedToday}`;
        } else if (selectedPeriod === 'week') {
          // Untuk minggu ini, ambil semua slot aktif
          apiUrl = `/api/therapy-slots?activeOnly=true`;
        } else if (selectedPeriod === 'month') {
          // Untuk bulan ini, ambil semua slot aktif
          apiUrl = `/api/therapy-slots?activeOnly=true`;
        } else if (selectedPeriod === 'future') {
          // Untuk tab mendatang, ambil semua slot aktif
          apiUrl = `/api/therapy-slots?activeOnly=true`;
        } else if (selectedPeriod === 'all') {
          // Ambil semua slot aktif
          apiUrl = `/api/therapy-slots?activeOnly=true`;
        }
        // Periode "register" dan "selected-date" sudah dihapus dari UI
        
        // Ambil data dari server
        const response = await fetch(apiUrl);
        if (!response.ok) {
          const errorText = await response.text();
          // Silent error handling with error thrown for UI handling
          throw new Error(`Failed to fetch slots: ${response.status} ${errorText}`);
        }
        
        // Ambil semua data dari server
        const rawData = await response.json();
        
        // Simpan data lengkap slot ke localStorage untuk referensi di seluruh aplikasi
        try {
          if (Array.isArray(rawData) && rawData.length > 0) {
            localStorage.setItem('slotsData', JSON.stringify(rawData));
          }
        } catch (cacheError) {
          // Silent error handling - cache error is non-critical
        }
        
        // Verifikasi bahwa rawData adalah array
        if (!Array.isArray(rawData)) {
          // Silent error handling with empty array return
          return []; // Return empty array instead of throwing to prevent UI disruption
        }
        
        // Konversi data mentah ke tipe TherapySlot dengan nilai default untuk bidang yang hilang
        const processedSlots: TherapySlot[] = rawData.map(slot => ({
          id: slot.id || 0,
          date: slot.date || '',
          timeSlot: slot.timeSlot || '',
          isActive: slot.isActive !== undefined ? slot.isActive : true,
          maxQuota: slot.maxQuota || 6,
          currentCount: slot.currentCount || 0,
          percentage: slot.currentCount && slot.maxQuota ? (slot.currentCount / slot.maxQuota) * 100 : 0,
          createdAt: slot.createdAt || ''
        }));
        
        // Langkah 1: Deduplikasi berdasarkan ID
        const idSet = new Set<number>();
        const filteredSlots: TherapySlot[] = processedSlots.filter((slot) => {
          if (idSet.has(slot.id)) {
            return false;
          }
          idSet.add(slot.id);
          return true;
        });
        
        // PERUBAHAN: Gabungkan slot dengan waktu yang sama dan akumulasikan jumlah pasien
        const dateTimeMap = new Map<string, TherapySlot[]>();
        
        // Pertama, kelompokkan slot berdasarkan kombinasi tanggal+waktu
        filteredSlots.forEach(slot => {
          const slotDateStr = getSlotDateStr(slot);
          const key = `${slotDateStr}-${slot.timeSlot}`;
          
          if (!dateTimeMap.has(key)) {
            dateTimeMap.set(key, []);
          }
          
          const slots = dateTimeMap.get(key);
          if (slots) {
            slots.push(slot);
          }
        });
        
        // Untuk setiap kelompok dengan waktu yang sama, gabungkan menjadi satu slot dengan jumlah pasien terakumulasi
        const uniqueSlots: TherapySlot[] = [];
        const combinedSlotsInfo: Record<string, {ids: number[], totalPatients: number, totalQuota: number}> = {};
        
        dateTimeMap.forEach((slots: TherapySlot[], key: string) => {
          // Jika hanya 1 slot untuk kombinasi ini, gunakan langsung
          if (slots.length === 1) {
            uniqueSlots.push(slots[0]);
          } else {
            // Gabungkan informasi dari semua slot dengan waktu yang sama
            // Pilih slot dengan ID terbesar sebagai representasi utama
            slots.sort((a: TherapySlot, b: TherapySlot) => b.id - a.id);
            const primarySlot = slots[0];
            
            // Hitung total pasien dan kuota dari semua slot dengan waktu yang sama
            let totalPatients = 0;
            let totalQuota = 0;
            const slotIds: number[] = [];
            
            slots.forEach(slot => {
              totalPatients += slot.currentCount;
              totalQuota += slot.maxQuota;
              slotIds.push(slot.id);
            });
            
            // Catat informasi gabungan slot untuk digunakan di dialog pasien
            combinedSlotsInfo[primarySlot.id] = {
              ids: slotIds,
              totalPatients,
              totalQuota
            };
            
            // Buat slot gabungan dengan informasi terakumulasi
            // Penting: pertahankan kuota asli dari slot utama untuk tampilan yang konsisten
            const combinedSlot: TherapySlot = {
              ...primarySlot,
              currentCount: totalPatients,
              // Gunakan kuota asli dari slot utama untuk konsistensi dengan setting di Therapy Slots
              // dan tambahkan property totalMaxQuota untuk menyimpan total kuota dari semua slot
              totalMaxQuota: totalQuota
            };
            
            uniqueSlots.push(combinedSlot);
          }
        });
        
        // Simpan informasi slot gabungan ke localStorage untuk diakses di komponen dialog
        localStorage.setItem('combinedSlotsInfo', JSON.stringify(combinedSlotsInfo));
        
        // Filter data berdasarkan periode yang dipilih
        let filteredByPeriod: TherapySlot[] = [];
        
        if (selectedPeriod === 'today') {
          // Untuk hari ini, gunakan tanggal hari ini
          const todayWIBStr = dateToWIBDateString(nowWIB);
          
          // Untuk "Hari Ini", filter berdasarkan tanggal hari ini tanpa memperhatikan waktu
          // Perbaikan: Konversi format tanggal untuk memastikan kesamaan
          // Log debug dinonaktifkan untuk mengurangi noise konsol
          // console.log("Hari ini (WIB):", todayWIBStr);
          
          filteredByPeriod = uniqueSlots.filter((slot: TherapySlot) => {
            const slotDateStr = getSlotDateStr(slot);
            
            // Debug log dinonaktifkan untuk slot khusus (ID 456, 473, 475)
            if ([456, 473, 475].includes(slot.id)) {
              /* Filter slot khusus tanpa log debug */
              
              // Percobaan tanggal alternatif jika format tidak cocok
              const slotDate = new Date(slotDateStr);
              const slotDateAlternative = slotDate.toISOString().split('T')[0];
              // Log debug dimatikan sepenuhnya
              
              // Periksa dengan beberapa cara berbeda untuk memastikan kecocokan
              return slotDateStr === todayWIBStr || slotDateAlternative === todayWIBStr;
            }
            
            // Untuk slot lain yang tidak di-log, lakukan perbandingan langsung
            const slotDate = new Date(slotDateStr);
            const slotDateAlternative = slotDate.toISOString().split('T')[0];
            return slotDateStr === todayWIBStr || slotDateAlternative === todayWIBStr;
          });
          
        } else if (selectedPeriod === 'selected-date' && selectedDate) {
          // Untuk tanggal yang dipilih, filter berdasarkan tanggal yang dipilih
          const selectedDateStr = dateToWIBDateString(selectedDate);
          
          filteredByPeriod = uniqueSlots.filter((slot: TherapySlot) => {
            const slotDateStr = getSlotDateStr(slot);
            return slotDateStr === selectedDateStr;
          });
          
        } else if (selectedPeriod === 'week') {
          // Untuk minggu ini, filter 7 hari ke depan
          const weekEndDate = new Date(nowWIB);
          weekEndDate.setDate(weekEndDate.getDate() + 6); // 7 hari termasuk hari ini
          
          filteredByPeriod = uniqueSlots.filter((slot: TherapySlot) => {
            try {
              const slotDateStr = getSlotDateStr(slot);
              if (!slotDateStr) return false;
              
              const slotDate = new Date(slotDateStr);
              return slotDate >= nowWIB && slotDate <= weekEndDate;
            } catch (err) {
              // Silent error handling
              return false;
            }
          });
          
        } else if (selectedPeriod === 'month') {
          // Untuk bulan ini, gunakan bulan sekarang
          const startOfMonth = new Date(nowWIB.getFullYear(), nowWIB.getMonth(), 1);
          const endOfMonth = new Date(nowWIB.getFullYear(), nowWIB.getMonth() + 1, 0);
          
          filteredByPeriod = uniqueSlots.filter((slot: TherapySlot) => {
            try {
              const slotDateStr = getSlotDateStr(slot);
              if (!slotDateStr) return false;
              
              const slotDate = new Date(slotDateStr);
              return slotDate >= startOfMonth && slotDate <= endOfMonth;
            } catch (err) {
              // Silent error handling
              return false;
            }
          });
          
        } else if (selectedPeriod === 'future') {
          // Untuk mendatang, tampilkan slot esok hari dan ke depan (masa depan)
          // PERBAIKAN: Slot hari ini TIDAK termasuk mendatang, hanya mulai besok
          
          // Gunakan nilai nowWIB untuk tanggal hari ini dan tambah 1 hari untuk besok
          const todayWIBStr = dateToWIBDateString(nowWIB);
          
          // Buat tanggal untuk besok dengan zona waktu yang benar
          const tomorrowWIB = new Date(nowWIB);
          tomorrowWIB.setDate(tomorrowWIB.getDate() + 1);
          const tomorrowWIBStr = dateToWIBDateString(tomorrowWIB);
          
          // Debug log dinonaktifkan untuk mengurangi noise di konsol
          // console.log("Filter mendatang - Hari ini:", todayWIBStr, "Besok:", tomorrowWIBStr);
          
          filteredByPeriod = uniqueSlots.filter((slot: TherapySlot) => {
            try {
              const slotDateStr = getSlotDateStr(slot);
              if (!slotDateStr) return false;
              
              // Log untuk debug dinonaktifkan untuk mengurangi noise di konsol
              // console.log(`Cek slot masa depan - ID:${slot.id}, Tanggal:${slotDateStr}, > Hari ini (${todayWIBStr})? ${slotDateStr > todayWIBStr}`);
              
              // PERBAIKAN: Slot yang tanggalnya setelah hari ini (tanggal lebih besar)
              // Jika tanggal = hari ini, maka false (tidak masuk tab Mendatang)
              // Jika tanggal > hari ini, maka true (masuk tab Mendatang)
              return slotDateStr > todayWIBStr;
            } catch (err) {
              console.error("Error filtering future slots:", err);
              return false;
            }
          });
          
          // Sort by date (ascending)
          filteredByPeriod.sort((a, b) => {
            const dateA = new Date(getSlotDateStr(a));
            const dateB = new Date(getSlotDateStr(b));
            return dateA.getTime() - dateB.getTime();
          });
          
        } else if (selectedPeriod === 'all') {
          // Untuk semua slot, tampilkan semua
          filteredByPeriod = uniqueSlots;
        }
        

        
        // Langkah 4: Urutkan berdasarkan tanggal dan waktu
        const sortedSlots = filteredByPeriod.sort((a: TherapySlot, b: TherapySlot) => {
          try {
            // Konversi string tanggal ke objek Date
            const dateA = new Date(getSlotDateStr(a));
            const dateB = new Date(getSlotDateStr(b));
            
            // Perbandingan tanggal
            const dateComparison = dateA.getTime() - dateB.getTime();
            if (dateComparison !== 0) return dateComparison;
            
            // Jika tanggal sama, bandingkan berdasarkan waktu
            return a.timeSlot.localeCompare(b.timeSlot);
          } catch (err) {
            // Silent error handling
            return 0;
          }
        });
        
        // Hitung persentase penggunaan untuk semua slot berdasarkan maxQuota saja
        // Tidak lagi menggunakan totalMaxQuota untuk konsistensi dengan tampilan
        const slotsWithPercentage = sortedSlots.map(slot => ({
          ...slot,
          percentage: slot.maxQuota ? (slot.currentCount / slot.maxQuota) * 100 : 0
        }));
        
        // Return hasil yang sudah diproses
        return slotsWithPercentage;
      } catch (error) {
        // Silent error handling
        // Don't throw the error, return empty array instead
        // This prevents the UI from crashing and shows "No slots" message
        return [];
      }
    },
    refetchInterval: 10000,
  });
  
  // Fetch active packages with auto-refresh
  const { data: activePackages = [], isLoading: isPackagesLoading, refetch: refetchPackages } = useQuery<ActivePackage[]>({
    queryKey: ['/api/dashboard/active-packages'],
    refetchInterval: 10000,
  });
  
  // Handle period change
  const handlePeriodChange = (period: string) => {
    // Clear cache for the current period to ensure fresh data
    queryClient.invalidateQueries({ queryKey: ['/api/slots-by-period', selectedPeriod] });
    
    // Update selected period
    setSelectedPeriod(period);
  };
  
  // Fungsi untuk auto-connect appointment dengan sesi paket terapi
  const handleAutoConnectSessions = async () => {
    try {
      setIsAutoConnecting(true);
      const response = await fetch('/api/appointments/auto-connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const result = await response.json();
      
      toast({
        title: "Auto-Connect Berhasil",
        description: `${result.connectedCount} appointment berhasil dihubungkan dengan sesi paket terapi.`,
        variant: result.connectedCount > 0 ? "default" : "destructive",
      });
      
      // Refresh semua data terkait
      refetchAppointments();
      refetchPackages();
      refetchSlotsByPeriod();
      
      // Invalidate semua query terkait therapy slots untuk memastikan data diperbarui
      queryClient.invalidateQueries({ queryKey: ['/api/therapy-slots'] });
      
      // Invalidate semua query therapy-slots patient untuk memastikan daftar pasien diperbarui
      queryClient.invalidateQueries({ queryKey: ['/api/therapy-slots', 'patients'] });
      
    } catch (error) {
      // Silent error handling with UI feedback via toast
      toast({
        title: "Auto-Connect Gagal",
        description: error instanceof Error ? error.message : "Terjadi kesalahan saat menghubungkan appointment dengan sesi paket terapi.",
        variant: "destructive",
      });
    } finally {
      setIsAutoConnecting(false);
    }
  };

  // Dashboard stat cards data
  const statCards = [
    {
      title: "Patients Today",
      value: stats.patientsToday,
      icon: Users,
      color: "text-blue-500",
      bgColor: "bg-blue-100",
    },
    {
      title: "Today's Income",
      value: formatRupiah(stats.incomeToday),
      icon: DollarSign,
      color: "text-green-500",
      bgColor: "bg-green-100",
    },
    {
      title: "Products Sold",
      value: stats.productsSold,
      icon: PackageIcon,
      color: "text-amber-500",
      bgColor: "bg-amber-100",
    },
    {
      title: "Active Packages",
      value: stats.activePackages,
      icon: BarChart3,
      color: "text-purple-500",
      bgColor: "bg-purple-100",
    },
  ];
  
  // State tambahan untuk menyimpan tanggal dan waktu slot yang dipilih
  const [selectedSlotDate, setSelectedSlotDate] = useState<string | undefined>();
  const [selectedSlotTime, setSelectedSlotTime] = useState<string | undefined>();

  // Simplified slot handler yang hanya menggunakan OptimizedSlotDialog
  const handleSlotClick = (slotId: number, slotDate?: string, slotTime?: string) => {
    try {
      if (typeof slotId !== 'number' || isNaN(slotId)) {
        return;
      }
      
      // Simpan data slot yang diklik (untuk legacy dialog jika diperlukan)
      setSelectedSlotId(slotId);
      setSelectedSlotDate(slotDate);
      setSelectedSlotTime(slotTime);
      
      // Selalu gunakan dialog yang sudah dioptimasi
      setIsOptimizedDialogOpen(true);
    } catch (error) {
      // Silent error handling
      console.error("Error handling slot click:", error);
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
  };
  
  const handleCloseOptimizedDialog = () => {
    setIsOptimizedDialogOpen(false);
  };

  return (
    <div className="space-y-6 pb-16">
      <div className="mb-6">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-1">Dashboard</h2>
        <p className="text-sm md:text-base text-muted-foreground">
          Selamat datang di dashboard Terapi Titik Sumber.
        </p>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-4 md:gap-4">
        {statCards.map((card, i) => (
          <Card key={i} className="border shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 md:px-4 pt-3 md:pt-4">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <div className={`${card.bgColor} rounded-md p-2 flex items-center justify-center`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent className="pb-3 px-3 md:px-4">
              {/* Special rendering for Today's Income with hide/show feature */}
              {card.title === "Today's Income" ? (
                <div className="flex justify-between items-center">
                  <div className="text-xl md:text-2xl font-bold">
                    {showBalance ? card.value : "Rp ***.**"}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowBalance(!showBalance)}
                    className="h-7 w-7 p-0 rounded-full ml-2"
                  >
                    {showBalance ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="sr-only">
                      {showBalance ? "Hide balance" : "Show balance"}
                    </span>
                  </Button>
                </div>
              ) : (
                <div className="text-xl md:text-2xl font-bold">{card.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dashboard Content */}
      <div className="grid gap-4 md:grid-cols-1">
        {/* Slot Tracker */}
        <Card className="border shadow-sm overflow-hidden">
          <CardHeader className="px-4 py-3 md:p-4 bg-card border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Calendar className="h-5 w-5 text-primary" />
                <span>Slot Tracker</span>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  title="Refresh Data"
                  onClick={() => {
                    refetchSlotsByPeriod();
                  }}
                  className="h-8 w-8 p-0 rounded-full"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span className="sr-only">Refresh</span>
                </Button>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {format(getTodayInWIB(), "EEEE, dd/MM/yyyy", { locale: localeId })}
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs 
              defaultValue="today" 
              className="w-full" 
              value={selectedPeriod}
              onValueChange={handlePeriodChange}
            >
              <div className="px-4 pt-4">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="today">Hari Ini</TabsTrigger>
                  <TabsTrigger value="future">Mendatang</TabsTrigger>
                  <TabsTrigger value="all">Semua Slot</TabsTrigger>
                </TabsList>
              </div>
              
              {/* Tab Pendaftaran telah dihapus */}
              
              {/* Tab content for specific views */}
              <TabsContent value="today" className="mt-0">
                {isSlotsLoading ? (
                  <div className="flex justify-center items-center py-6">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : slotsByPeriod.length > 0 ? (
                  <div className="space-y-4">
                    {slotsByPeriod.map((slot: any) => (
                      <div 
                        key={slot.id}
                        className="border rounded-lg p-4 cursor-pointer transition-colors hover:border-primary/60"
                        onClick={() => handleSlotClick(slot.id, slot.date, slot.timeSlot)}
                      >
                        <div className="flex flex-col space-y-2">
                          <div className="flex justify-between items-center">
                            <div className="text-lg font-medium">{slot.timeSlot}</div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-right">{slot.currentCount} / {slot.maxQuota}</span>
                            </div>
                          </div>
                          
                          <div className="text-sm text-muted-foreground">
                            {slot.date ? formatDateDDMMYYYY(slot.date) : '-'}
                          </div>
                          
                          <div className="mt-1">
                            <div className="flex justify-between items-center mb-1 text-sm">
                              <span className="text-muted-foreground">Kapasitas Terisi</span>
                              <span className={cn(
                                "font-medium",
                                slot.percentage >= 100 ? "text-red-600" : (slot.percentage > 75 ? "text-amber-600" : "")
                              )}>
                                {Math.round(slot.percentage)}%
                              </span>
                            </div>
                            <Progress 
                              value={slot.percentage} 
                              max={100} 
                              className={cn(
                                "h-2",
                                slot.percentage >= 100 ? "bg-red-200" : (slot.percentage > 0 ? "bg-primary/20" : "bg-slate-200")
                              )}
                              indicatorClassName={
                                slot.percentage >= 100 ? "bg-red-500" : (slot.percentage > 0 ? "bg-primary" : "bg-primary/0")
                              }
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-8 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <Calendar className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold">
                      Belum Ada Slot Terapi Hari Ini
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Tidak ada slot terapi untuk hari ini. Kunjungi halaman Therapy Slots untuk mengatur slot terapi baru.
                    </p>
                  </div>
                )}
              </TabsContent>
              
              {/* Tab content for future view */}
              <TabsContent value="future" className="mt-0">
                
                {isSlotsLoading ? (
                  <div className="flex justify-center items-center py-6">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : slotsByPeriod.length > 0 ? (
                  <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                    {/* Table view for desktop */}
                    <div className="hidden md:block">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-background">
                          <tr className="border-b text-muted-foreground">
                            <th className="pb-2 font-medium text-left">Tanggal / Waktu</th>
                            <th className="pb-2 font-medium text-center">Kuota</th>
                            <th className="pb-2 font-medium text-center">Terisi</th>
                            <th className="pb-2 font-medium text-right">Persentase</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {slotsByPeriod.map((slot: any) => (
                            <tr 
                              key={slot.id} 
                              className="py-2 hover:bg-muted/50 cursor-pointer transition-colors"
                              onClick={() => handleSlotClick(slot.id, slot.date, slot.timeSlot)}
                            >
                              <td className="py-3 text-left">
                                <div className="flex flex-col">
                                  <span>{slot.timeSlot}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {slot.date ? formatDateDDMMYYYY(slot.date) : '-'}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 text-center">{slot.maxQuota}</td>
                              <td className="py-3 text-center">{slot.currentCount}</td>
                              <td className="py-3 text-right">
                                <span className={cn(
                                  "font-medium",
                                  slot.percentage >= 100 ? "text-red-600" : (slot.percentage > 75 ? "text-amber-600" : "")
                                )}>
                                  {Math.round(slot.percentage)}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Card view for mobile */}
                    <div className="grid grid-cols-1 gap-3 md:hidden">
                      {slotsByPeriod.map((slot: any) => (
                        <div 
                          key={slot.id}
                          className="border rounded-lg p-3 hover:bg-muted/50 cursor-pointer transition-colors mobile-card"
                          onClick={() => handleSlotClick(slot.id, slot.date, slot.timeSlot)}
                        >
                          <div className="flex justify-between items-center mb-2">
                            <div>
                              <div className="font-medium">{slot.timeSlot}</div>
                              <div className="text-xs text-muted-foreground">
                                {slot.date ? formatDateDDMMYYYY(slot.date) : '-'}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "w-2 h-2 rounded-full",
                                slot.percentage >= 100 ? "bg-red-500" : (slot.percentage > 0 ? "bg-primary" : "bg-slate-300")
                              )}></div>
                              <div className="text-sm">
                                <span className="font-medium">{slot.currentCount}</span>
                                <span className="text-muted-foreground"> / {slot.maxQuota}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-1 mt-2">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-muted-foreground">Kapasitas Terisi</span>
                              <span className={cn(
                                "font-medium",
                                slot.percentage >= 100 ? "text-red-600" : (slot.percentage > 75 ? "text-amber-600" : "")
                              )}>
                                {Math.round(slot.percentage)}%
                              </span>
                            </div>
                            <Progress 
                              value={slot.percentage} 
                              max={100} 
                              className={cn(
                                "h-2 w-full",
                                slot.percentage >= 100 ? "bg-red-200" : (slot.percentage > 0 ? "bg-primary/20" : "bg-slate-200")
                              )}
                              indicatorClassName={
                                slot.percentage >= 100 ? "bg-red-500" : (slot.percentage > 0 ? "bg-primary" : "bg-primary/0")
                              }
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-8 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <Calendar className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold">
                      Belum Ada Slot Terapi Mendatang
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Tidak ada slot terapi mendatang yang ditemukan. Kunjungi halaman Therapy Slots untuk mengatur slot terapi baru.
                    </p>
                  </div>
                )}
              </TabsContent>
              
              {/* Tab content for all views */}
              <TabsContent value="all" className="mt-0">
                
                {isSlotsLoading ? (
                  <div className="flex justify-center items-center py-6">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : slotsByPeriod.length > 0 ? (
                  <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                    {/* Table view for desktop */}
                    <div className="hidden md:block">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-background">
                          <tr className="border-b text-muted-foreground">
                            <th className="pb-2 font-medium text-left">Tanggal / Waktu</th>
                            <th className="pb-2 font-medium text-center">Kuota</th>
                            <th className="pb-2 font-medium text-center">Terisi</th>
                            <th className="pb-2 font-medium text-right">Persentase</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {slotsByPeriod.map((slot: any) => (
                            <tr 
                              key={slot.id} 
                              className="py-2 hover:bg-muted/50 cursor-pointer transition-colors"
                              onClick={() => handleSlotClick(slot.id, slot.date, slot.timeSlot)}
                            >
                              <td className="py-3 text-left">
                                <div className="flex flex-col">
                                  <span>{slot.timeSlot}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {slot.date ? formatDateDDMMYYYY(slot.date) : '-'}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 text-center">
                                {slot.maxQuota}
                              </td>
                              <td className="py-3 text-center">{slot.currentCount}</td>
                              <td className="py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-16">
                                    <Progress 
                                      value={slot.percentage} 
                                      max={100} 
                                      className={cn(
                                        "h-2",
                                        slot.percentage >= 100 ? "bg-red-200" : (slot.percentage > 0 ? "bg-primary/20" : "bg-slate-200")
                                      )}
                                      indicatorClassName={
                                        slot.percentage >= 100 ? "bg-red-500" : (slot.percentage > 0 ? "bg-primary" : "bg-primary/0")
                                      }
                                    />
                                  </div>
                                  <span className={cn(
                                    "text-xs",
                                    slot.percentage >= 100 ? "text-red-600" : (slot.percentage > 75 ? "text-amber-600" : "")
                                  )}>
                                    {Math.round(slot.percentage)}%
                                  </span>
                                  {slot.percentage >= 100 && (
                                    <AlertCircle className="h-3 w-3 text-red-500" />
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Card view for mobile */}
                    <div className="grid grid-cols-1 gap-3 md:hidden">
                      {slotsByPeriod.map((slot: any) => (
                        <div 
                          key={slot.id}
                          className="border rounded-lg p-3 hover:bg-muted/50 cursor-pointer transition-colors mobile-card"
                          onClick={() => handleSlotClick(slot.id, slot.date, slot.timeSlot)}
                        >
                          <div className="flex justify-between items-center mb-2">
                            <div>
                              <div className="font-medium">{slot.timeSlot}</div>
                              <div className="text-xs text-muted-foreground">
                                {slot.date ? formatDateDDMMYYYY(slot.date) : '-'}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "w-2 h-2 rounded-full",
                                slot.percentage >= 100 ? "bg-red-500" : (slot.percentage > 0 ? "bg-primary" : "bg-slate-300")
                              )}></div>
                              <div className="text-sm">
                                <span className="font-medium">{slot.currentCount}</span>
                                <span className="text-muted-foreground"> / {slot.maxQuota}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-1 mt-2">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-muted-foreground">Kapasitas Terisi</span>
                              <span className={cn(
                                "font-medium",
                                slot.percentage >= 100 ? "text-red-600" : (slot.percentage > 75 ? "text-amber-600" : "")
                              )}>
                                {Math.round(slot.percentage)}%
                              </span>
                            </div>
                            <Progress 
                              value={slot.percentage} 
                              max={100} 
                              className={cn(
                                "h-2 w-full",
                                slot.percentage >= 100 ? "bg-red-200" : (slot.percentage > 0 ? "bg-primary/20" : "bg-slate-200")
                              )}
                              indicatorClassName={
                                slot.percentage >= 100 ? "bg-red-500" : (slot.percentage > 0 ? "bg-primary" : "bg-primary/0")
                              }
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-8 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <Calendar className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold">
                      Belum Ada Slot Terapi
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Tidak ada slot terapi untuk periode yang dipilih. Kunjungi halaman Therapy Slots untuk mengatur slot terapi baru.
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      
      {/* Active Packages Section */}
      <Card className="border shadow-sm overflow-hidden">
        <CardHeader className="px-4 py-3 md:p-4 bg-card border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <PackageIcon className="h-5 w-5 text-primary" />
              <span>Paket Aktif Pasien</span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  refetchPackages();
                }}
                className="h-8 w-8 p-0 rounded-full"
              >
                <RefreshCw className="h-4 w-4" />
                <span className="sr-only">Refresh Packages</span>
              </Button>

              <Button 
                variant="outline"
                size="sm" 
                className="text-xs whitespace-nowrap flex items-center gap-1"
                onClick={() => clearPatientDataCache()}
              >
                <Database className="h-3.5 w-3.5" />
                <span>Bersihkan Cache</span>
              </Button>

              <Button 
                variant="outline"
                size="sm"
                className="text-xs whitespace-nowrap flex items-center gap-1"
                onClick={handleAutoConnectSessions}
                disabled={isAutoConnecting}
              >
                <Link2 className="h-3.5 w-3.5" />
                {isAutoConnecting ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Menghubungkan...</span>
                  </>
                ) : (
                  <span>Auto-Connect Sessions</span>
                )}
              </Button>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Progress paket terapi pasien yang masih aktif
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {isPackagesLoading ? (
            <div className="flex justify-center items-center py-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : activePackages.length > 0 ? (
            <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
              {activePackages.map((pkg) => (
                <div 
                  key={pkg.id} 
                  className="border rounded-lg p-3 mobile-card hover:shadow-md transition-all hover:border-primary/60"
                >
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 mb-2">
                    <div>
                      <div className="font-medium">{pkg.patient?.name || 'Pasien tidak ditemukan'}</div>
                      <div className="text-xs text-muted-foreground flex gap-1 items-center">
                        <span className="hidden md:inline">ID:</span> {pkg.patient?.patientId || 'N/A'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="bg-primary/10 text-primary px-2 py-1 rounded-md inline-block text-sm font-medium">
                        {pkg.sessionsUsed}/{pkg.totalSessions} Sesi
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit jumlah sesi terpakai"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedSession({
                            id: pkg.id,
                            totalSessions: pkg.totalSessions,
                            sessionsUsed: pkg.sessionsUsed,
                            patient: pkg.patient,
                            package: pkg.package
                          });
                          setIsSessionEditorOpen(true);
                        }}
                        className="h-7 w-7"
                      >
                        <PencilLine className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  
                  <Link 
                    to={`/patients/${pkg.patient?.id}`}
                    className="block"
                  >
                    <div className="mb-2">
                      <div className="text-sm mb-1 flex justify-between">
                        <span>{pkg.package?.name || 'Paket tidak ditemukan'}</span>
                        <span className="font-medium">{pkg.progress}%</span>
                      </div>
                      <Progress 
                        value={pkg.progress} 
                        max={100} 
                        className="h-2 bg-primary/20"
                        indicatorClassName={pkg.progress >= 90 ? "bg-green-500" : "bg-primary"}
                      />
                    </div>
                    
                    <div className="flex justify-between items-center text-xs text-muted-foreground mt-2">
                      <div>
                        Mulai: {pkg.startDate ? formatDateDDMMYYYY(pkg.startDate) : '-'}
                      </div>
                      {pkg.lastSessionDate && (
                        <div>
                          Terakhir: {formatDateDDMMYYYY(pkg.lastSessionDate)}
                        </div>
                      )}
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 md:p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <PackageIcon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">
                Belum Ada Paket Aktif
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Paket terapi aktif pasien akan muncul di sini.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Dialog fallback (jika diperlukan) - tidak digunakan secara default */}
      <SlotPatientsDialog 
        slotId={selectedSlotId}
        slotDate={selectedSlotDate}
        slotTimeSlot={selectedSlotTime}
        isOpen={isDialogOpen} 
        onClose={handleCloseDialog} 
      />
      
      {/* Dialog yang lebih sederhana dan efisien */}
      <SimpleSlotDialog
        slotId={selectedSlotId}
        isOpen={isOptimizedDialogOpen}
        onClose={handleCloseOptimizedDialog}
      />

      {/* Dialog untuk mengedit jumlah sesi paket */}
      {selectedSession && (
        <SessionEditorDialog
          isOpen={isSessionEditorOpen}
          onClose={() => setIsSessionEditorOpen(false)}
          session={selectedSession}
          onSuccess={() => {
            // Refetch active packages data
            queryClient.invalidateQueries({ queryKey: ['/api/dashboard/active-packages'] });
          }}
        />
      )}
    </div>
  );
}