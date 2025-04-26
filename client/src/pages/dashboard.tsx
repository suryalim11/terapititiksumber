import { useState } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
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
  EyeOff
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { SlotPatientsDialog } from "@/components/dashboard/slot-patients-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

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

export default function Dashboard() {
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
  const [showBalance, setShowBalance] = useState(true);
  const queryClient = useQueryClient();
  
  // Format today's date to YYYY-MM-DD for API query with WIB timezone
  const todayWIB = getTodayInWIB(); // Dapatkan hari ini dalam timezone WIB
  const formattedToday = dateToWIBDateString(todayWIB); // Format ke YYYY-MM-DD
  console.log(`Today in WIB timezone: ${formattedToday}`);
  
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
  
  // Gunakan API ini sebagai satu-satunya sumber data slot
  const { data: slotsByPeriod = [], isLoading: isSlotsLoading, refetch: refetchSlotsByPeriod } = useQuery<any[]>({
    queryKey: ['/api/slots-by-period', selectedPeriod],
    queryFn: async () => {
      try {
        // Selalu gunakan period=week untuk mendapatkan data lengkap dari server
        // Kemudian kita akan melakukan filter di client side sesuai selectedPeriod
        console.log(`Fetching slots with fixed period=week to ensure consistency`);
        const response = await fetch(`/api/slots-by-period?period=week`);
        if (!response.ok) {
          throw new Error('Failed to fetch slots by period');
        }
        
        // Ambil semua data dari server dengan period=week
        const rawData = await response.json();
        console.log(`Received ${rawData.length} slots from API`);
        
        // Langkah 1: Deduplikasi berdasarkan ID
        const idSet = new Set();
        const filteredSlots = rawData.filter((slot: any) => {
          if (idSet.has(slot.id)) {
            console.log(`Removing duplicate slot with ID: ${slot.id}`);
            return false;
          }
          idSet.add(slot.id);
          return true;
        });
        console.log(`After ID deduplication: ${filteredSlots.length} slots remaining`);
        
        // Langkah 2: Deduplikasi berdasarkan tanggal+waktu (dengan normalisasi tanggal)
        const dateTimeSet = new Set();
        const uniqueSlots = filteredSlots.filter((slot: any) => {
          // Ekstrak tanggal dari string date (YYYY-MM-DD)
          const datePart = typeof slot.date === 'string' ? slot.date.split(' ')[0] : 
            new Date(slot.date).toISOString().split('T')[0];
            
          // Ambil hanya bagian tanggal (YYYY-MM-DD), buang timestamp
          // Format: YYYY-MM-DD-HH:MM-HH:MM
          const normalizedDate = datePart.split('T')[0];
          const dateTimeKey = `${normalizedDate}-${slot.timeSlot}`;
          
          if (dateTimeSet.has(dateTimeKey)) {
            console.log(`Removing duplicate slot with date+time: ${dateTimeKey}`);
            return false;
          }
          dateTimeSet.add(dateTimeKey);
          return true;
        });
        console.log(`After date+time deduplication: ${uniqueSlots.length} slots remaining`);
        
        // Langkah 3: Filter berdasarkan periode yang dipilih pengguna
        // Gunakan zona waktu WIB untuk semua filter tanggal
        const nowWIB = getStartOfDayWIB(new Date()); // Tanggal hari ini dalam WIB, jam 00:00:00
        
        let filteredByPeriod = [...uniqueSlots];
        
        // Fungsi untuk mendapatkan tanggal dari slot (YYYY-MM-DD) dari format apapun
        const getSlotDateStr = (slot: any): string => {
          if (typeof slot.date === 'string') {
            // Format: "2025-04-07 00:00:00" atau "2025-04-07 03:07:41.562" -> ambil "2025-04-07"
            return slot.date.split(' ')[0];
          } else {
            // Format: Date object -> convert ke string "2025-04-07"
            return new Date(slot.date).toISOString().split('T')[0];
          }
        };
        
        if (selectedPeriod === 'day') {
          // Filter hanya untuk hari ini (dalam zona waktu WIB)
          const todayWIBStr = dateToWIBDateString(nowWIB);
          console.log(`Filter untuk hari ini (WIB): ${todayWIBStr}`);
          
          filteredByPeriod = uniqueSlots.filter((slot: any) => {
            const slotDate = typeof slot.date === 'string' ? new Date(slot.date) : new Date(slot.date);
            // Gunakan fungsi perbandingan yang memperhatikan zona waktu
            return isSameDayInWIB(slotDate, nowWIB);
          });
          
          console.log(`Hasil filter hari ini (WIB): ${filteredByPeriod.length} slot ditemukan`);
          
        } else if (selectedPeriod === 'past-week') {
          // Filter untuk 7 hari terakhir (dalam zona waktu WIB)
          const oneWeekAgoWIB = new Date(nowWIB);
          oneWeekAgoWIB.setDate(oneWeekAgoWIB.getDate() - 7);
          
          filteredByPeriod = uniqueSlots.filter((slot: any) => {
            const slotDate = new Date(getSlotDateStr(slot));
            return slotDate >= oneWeekAgoWIB && slotDate <= nowWIB;
          });
          
        } else if (selectedPeriod === 'month') {
          // Filter untuk bulan ini (dalam zona waktu WIB)
          const startOfMonth = new Date(nowWIB.getFullYear(), nowWIB.getMonth(), 1);
          const endOfMonth = new Date(nowWIB.getFullYear(), nowWIB.getMonth() + 1, 0);
          
          filteredByPeriod = uniqueSlots.filter((slot: any) => {
            const slotDate = new Date(getSlotDateStr(slot));
            return slotDate >= startOfMonth && slotDate <= endOfMonth;
          });
        } else if (selectedPeriod === 'all') {
          // Tampilkan semua slot yang tanggalnya >= hari ini (masa depan)
          // Gunakan nowWIB untuk mendapatkan tanggal saat ini dalam WIB
          
          filteredByPeriod = uniqueSlots.filter((slot: any) => {
            const slotDate = new Date(getSlotDateStr(slot));
            return slotDate >= getStartOfDayWIB(new Date()); // Filter hanya slot yang >= hari ini
          });
          
          console.log(`Mode "Semua Slot": menampilkan ${filteredByPeriod.length} slot dari sekarang ke depan`);
        }
        
        console.log(`After period (${selectedPeriod}) filtering: ${filteredByPeriod.length} slots`);
        
        // Langkah 4: Urutkan berdasarkan tanggal dan waktu
        return filteredByPeriod.sort((a: any, b: any) => {
          // Konversi string tanggal ke objek Date
          const dateA = new Date(a.date);
          const dateB = new Date(b.date);
          
          // Perbandingan tanggal
          const dateComparison = dateA.getTime() - dateB.getTime();
          if (dateComparison !== 0) return dateComparison;
          
          // Jika tanggal sama, bandingkan berdasarkan waktu
          return a.timeSlot.localeCompare(b.timeSlot);
        });
      } catch (error) {
        console.error("Error fetching slots:", error);
        throw error;
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
  
  const handleSlotClick = (slotId: number) => {
    try {
      if (typeof slotId !== 'number' || isNaN(slotId)) {
        console.error("Invalid slot ID:", slotId);
        return;
      }
      
      setSelectedSlotId(slotId);
      setIsDialogOpen(true);
    } catch (error) {
      console.error("Error handling slot click:", error);
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
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
              defaultValue="all" 
              className="w-full" 
              value={selectedPeriod}
              onValueChange={handlePeriodChange}
            >
              <div className="px-4 pt-4">
                <TabsList className="grid w-full grid-cols-4 mb-4">
                  <TabsTrigger value="day">Hari Ini</TabsTrigger>
                  <TabsTrigger value="week">Minggu Ini</TabsTrigger>
                  <TabsTrigger value="month">Bulan Ini</TabsTrigger>
                  <TabsTrigger value="all">Semua Slot</TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value={selectedPeriod} className="mt-0">
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
                              onClick={() => handleSlotClick(slot.id)}
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
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-16">
                                    <Progress 
                                      value={slot.percentage} 
                                      max={100} 
                                      className={cn(
                                        "h-2",
                                        slot.percentage >= 100 ? "bg-red-200" : (slot.percentage > 75 ? "bg-amber-200" : "bg-primary/20")
                                      )}
                                      indicatorClassName={
                                        slot.percentage >= 100 ? "bg-red-500" : (slot.percentage > 75 ? "bg-amber-500" : "bg-primary")
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
                          onClick={() => handleSlotClick(slot.id)}
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
                                slot.percentage >= 100 ? "bg-red-500" : (slot.percentage > 75 ? "bg-amber-500" : "bg-emerald-500")
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
                                slot.percentage >= 100 ? "bg-red-200" : (slot.percentage > 75 ? "bg-amber-200" : "bg-primary/20")
                              )}
                              indicatorClassName={
                                slot.percentage >= 100 ? "bg-red-500" : (slot.percentage > 75 ? "bg-amber-500" : "bg-primary")
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
                <div key={pkg.id} className="border rounded-lg p-3 mobile-card">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 mb-2">
                    <div>
                      <div className="font-medium">{pkg.patient?.name || 'Pasien tidak ditemukan'}</div>
                      <div className="text-xs text-muted-foreground flex gap-1 items-center">
                        <span className="hidden md:inline">ID:</span> {pkg.patient?.patientId || 'N/A'}
                      </div>
                    </div>
                    <div className="bg-primary/10 text-primary px-2 py-1 rounded-md inline-block text-sm font-medium">
                      {pkg.sessionsUsed}/{pkg.totalSessions} Sesi
                    </div>
                  </div>
                  
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
      
      {/* Dialog untuk melihat pasien yang terdaftar di slot */}
      <SlotPatientsDialog 
        slotId={selectedSlotId} 
        isOpen={isDialogOpen} 
        onClose={handleCloseDialog} 
      />
    </div>
  );
}