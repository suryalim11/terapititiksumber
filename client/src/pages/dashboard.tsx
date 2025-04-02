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
import { cn, formatRupiah, formatDateDDMMYYYY, formatISOtoWIB } from "@/lib/utils";
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

  // Fetch recent activities with auto-refresh
  const { data: activities = [], refetch: refetchActivities } = useQuery<RecentActivity[]>({
    queryKey: ['/api/dashboard/activities'],
    refetchInterval: 10000,
  });
  
  // Fetch today's appointments with auto-refresh
  const { data: todayAppointments = [], refetch: refetchAppointments } = useQuery<any[]>({
    queryKey: [`/api/appointments/date/${formattedToday}`],
    refetchInterval: 10000,
  });
  
  // Fetch today's therapy slots (for backward compatibility)
  const { data: todaySlots = [], isLoading: isTodaySlotsLoading } = useQuery<any[]>({
    queryKey: ['/api/today-slots'],
    refetchInterval: 10000,
  });
  
  // Fetch therapy slots by period
  const { data: slotsByPeriod = [], isLoading: isSlotsLoading, refetch: refetchSlotsByPeriod } = useQuery<any[]>({
    queryKey: ['/api/slots-by-period', selectedPeriod],
    queryFn: async () => {
      const response = await fetch(`/api/slots-by-period?period=${selectedPeriod}`);
      if (!response.ok) {
        throw new Error('Failed to fetch slots by period');
      }
      return response.json();
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

      {/* Recent Activities and Today's Schedule */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Activities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>Recent Activities</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activities.length > 0 ? (
                activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 rounded-lg border p-3"
                  >
                    <div className="rounded-full bg-primary/10 p-2">
                      {activity.type === "patient" && (
                        <UserRound className="h-4 w-4 text-primary" />
                      )}
                      {activity.type === "transaction" && (
                        <DollarSign className="h-4 w-4 text-primary" />
                      )}
                      {activity.type === "appointment" && (
                        <Calendar className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm">{activity.description}</p>
                      <time className="text-xs text-muted-foreground">
                        {activity.timestamp ? 
                          formatISOtoWIB(activity.timestamp) :
                          ""}
                      </time>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No recent activities
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

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
                {format(new Date(), "EEEE, dd/MM/yyyy", { locale: localeId })} WIB
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
          <CardTitle className="flex items-center gap-2">
            <span>Paket Aktif Pasien</span>
          </CardTitle>
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
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">{pkg.patient?.name || 'Unknown Patient'}</div>
                      <div className="text-sm text-muted-foreground">
                        ID: {pkg.patient?.patientId || 'Unknown'}
                      </div>
                    </div>
                    <div className="text-right">
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
                  
                  <div className="flex justify-between items-center text-xs">
                    <div>
                      <span className="text-muted-foreground">Mulai: </span>
                      {pkg.startDate ? formatDateDDMMYYYY(pkg.startDate) : '-'}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Terakhir: </span>
                      {pkg.lastSessionDate ? formatDateDDMMYYYY(pkg.lastSessionDate) : '-'}
                    </div>
                    <div className="font-medium">
                      {pkg.progress}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center">
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