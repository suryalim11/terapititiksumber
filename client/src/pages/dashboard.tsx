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
  Loader2
} from "lucide-react";
import { cn, formatRupiah, formatDateDDMMYYYY } from "@/lib/utils";
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
  const [selectedPeriod, setSelectedPeriod] = useState<string>("day");
  const queryClient = useQueryClient();
  
  // Format today's date to YYYY-MM-DD for API query
  const today = new Date();
  const formattedToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
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
        console.log(`Fetching slots for period: ${selectedPeriod}`);
        const response = await fetch(`/api/slots-by-period?period=${selectedPeriod}`);
        if (!response.ok) {
          throw new Error('Failed to fetch slots by period');
        }
        const data = await response.json();
        console.log(`Received ${data.length} slots from API`);
        
        // Langkah 1: Filter duplikasi slot yang memiliki ID sama (untuk mengatasi bug slot duplikat)
        const idSet = new Set();
        const filteredSlots = data.filter((slot: any) => {
          if (idSet.has(slot.id)) {
            console.log(`Removing duplicate slot with ID: ${slot.id}`);
            return false;
          }
          idSet.add(slot.id);
          return true;
        });
        
        console.log(`After deduplication: ${filteredSlots.length} slots remaining`);
        
        // Langkah 2: Juga hapus duplikasi berdasarkan kombinasi tanggal+timeSlot 
        // (untuk kasus dimana ID berbeda tapi tanggal dan jam sama)
        const dateTimeSet = new Set();
        const uniqueSlots = filteredSlots.filter((slot: any) => {
          const dateTimeKey = `${slot.date}-${slot.timeSlot}`;
          if (dateTimeSet.has(dateTimeKey)) {
            console.log(`Removing duplicate slot with date+time: ${dateTimeKey}`);
            return false;
          }
          dateTimeSet.add(dateTimeKey);
          return true;
        });
        
        console.log(`After date+time deduplication: ${uniqueSlots.length} slots remaining`);
        
        // Langkah 3: Urutkan berdasarkan tanggal dan waktu
        return uniqueSlots.sort((a: any, b: any) => {
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
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Welcome to your therapy clinic dashboard.
        </p>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <div className={`${card.bgColor} rounded-md p-2`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dashboard Content */}
      <div className="grid gap-4 md:grid-cols-1">
        {/* Slot Tracker */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <span>Slot Tracker</span>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    refetchSlotsByPeriod();
                  }}
                  className="h-8 w-8 p-0"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span className="sr-only">Refresh</span>
                </Button>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {format(new Date(), "EEEE, dd/MM/yyyy", { locale: localeId })}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs 
              defaultValue="day" 
              className="w-full" 
              value={selectedPeriod}
              onValueChange={handlePeriodChange}
            >
              <TabsList className="grid w-full grid-cols-4 mb-4">
                <TabsTrigger value="day">Hari Ini</TabsTrigger>
                <TabsTrigger value="week">Minggu Ini</TabsTrigger>
                <TabsTrigger value="month">Bulan Ini</TabsTrigger>
                <TabsTrigger value="past-week">7 Hari Terakhir</TabsTrigger>
              </TabsList>
              
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
                          className="border rounded-lg p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => handleSlotClick(slot.id)}
                        >
                          <div className="flex justify-between items-center mb-2">
                            <div>
                              <div className="font-medium">{slot.timeSlot}</div>
                              <div className="text-xs text-muted-foreground">
                                {slot.date ? formatDateDDMMYYYY(slot.date) : '-'}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm">
                                <span className="font-medium">{slot.currentCount}</span>
                                <span className="text-muted-foreground"> / {slot.maxQuota}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 mt-2">
                            <Progress 
                              value={slot.percentage} 
                              max={100} 
                              className={cn(
                                "h-2 flex-1",
                                slot.percentage >= 100 ? "bg-red-200" : (slot.percentage > 75 ? "bg-amber-200" : "bg-primary/20")
                              )}
                              indicatorClassName={
                                slot.percentage >= 100 ? "bg-red-500" : (slot.percentage > 75 ? "bg-amber-500" : "bg-primary")
                              }
                            />
                            <span className={cn(
                              "text-xs font-medium",
                              slot.percentage >= 100 ? "text-red-600" : (slot.percentage > 75 ? "text-amber-600" : "")
                            )}>
                              {Math.round(slot.percentage)}%
                            </span>
                            {slot.percentage >= 100 && (
                              <AlertCircle className="h-3 w-3 text-red-500" />
                            )}
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <span>Paket Aktif Pasien</span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  refetchPackages();
                }}
                className="h-8 w-8 p-0"
              >
                <RefreshCw className="h-4 w-4" />
                <span className="sr-only">Refresh Packages</span>
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Progress paket terapi pasien yang masih aktif
          </p>
        </CardHeader>
        <CardContent>
          {isPackagesLoading ? (
            <div className="flex justify-center items-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : activePackages.length > 0 ? (
            <div className="space-y-4">
              {activePackages.map((pkg) => (
                <div key={pkg.id} className="border rounded-lg p-4 space-y-2">
                  {/* Tampilan desktop dan mobile yang responsif */}
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
                    <div>
                      <div className="font-medium">{pkg.patient?.name || 'Unknown Patient'}</div>
                      <div className="text-sm text-muted-foreground">
                        ID: {pkg.patient?.patientId || 'Unknown'}
                      </div>
                    </div>
                    <div className={cn("md:text-right", "text-left mt-1 md:mt-0")}>
                      <div className="font-medium">{pkg.package?.name || 'Unknown Package'}</div>
                      <div className="text-sm text-muted-foreground">
                        {pkg.sessionsUsed} dari {pkg.totalSessions} sesi
                      </div>
                    </div>
                  </div>
                  
                  <Progress 
                    value={pkg.progress} 
                    max={100} 
                    className="h-2 bg-primary/20"
                    indicatorClassName={pkg.progress >= 90 ? "bg-green-500" : "bg-primary"}
                  />
                  
                  <div className="flex flex-col md:flex-row justify-between text-xs gap-2">
                    <div className="flex gap-1 md:gap-0 md:block">
                      <span className="text-muted-foreground">Mulai: </span>
                      <span>{pkg.startDate ? formatDateDDMMYYYY(pkg.startDate) : '-'}</span>
                    </div>
                    <div className="flex gap-1 md:gap-0 md:block">
                      <span className="text-muted-foreground">Terakhir: </span>
                      <span>{pkg.lastSessionDate ? formatDateDDMMYYYY(pkg.lastSessionDate) : '-'}</span>
                    </div>
                    <div className="font-medium">
                      {pkg.progress}%
                    </div>
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