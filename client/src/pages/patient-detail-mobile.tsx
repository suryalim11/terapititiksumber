import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { 
  ArrowLeft, 
  ChevronDown, 
  Loader2, 
  RefreshCcw, 
  User, 
  Package, 
  Calendar, 
  Receipt, 
  AlertTriangle, 
  Activity, 
  Eye, 
  Phone,
  Mail as MailIcon,
  Trash
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { formatBirthDate } from "@/lib/utils";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { AppointmentDetailDialog } from "@/components/appointments/appointment-detail-dialog";
import { MedicalHistoryList } from "@/components/medical-history/medical-history-list";
import { Progress } from "@/components/ui/progress";

// Fungsi format tanggal untuk Indonesia
const formatDate = (date: string | Date) => {
  try {
    return format(new Date(date), "dd/MM/yyyy", { locale: localeId });
  } catch (e) {
    return "Invalid date";
  }
};

interface Transaction {
  id: number;
  transactionId: string;
  patientId: number;
  totalAmount: string;
  subtotal?: string;
  discount?: string;
  paymentMethod: string;
  items: any[];
  createdAt: string;
}

interface MedicalHistory {
  id: number;
  patientId: number;
  complaint: string;
  beforeBloodPressure: string | null;
  afterBloodPressure: string | null;
  notes: string | null;
  treatmentDate: string;
  createdAt: string;
  appointmentId: number | null;
}

interface Session {
  id: number;
  patientId: number;
  transactionId: number;
  packageId: number;
  totalSessions: number;
  sessionsUsed: number;
  status: string;
  startDate: string;
  lastSessionDate: string | null;
  package?: {
    id: number;
    name: string;
    sessions: number;
    price: string;
    description: string;
  };
  remainingSessions?: number;
}

interface Appointment {
  id: number;
  patientId: number;
  therapySlotId: number | null;
  sessionId: number | null;
  date: string;
  timeSlot: string | null;
  status: string;
  registrationNumber: string | null;
  notes: string | null;
}

interface Patient {
  id: number;
  patientId: string;
  name: string;
  phoneNumber: string;
  email: string | null;
  birthDate: string;
  gender: string;
  address: string;
  complaints: string;
  createdAt: string;
  therapySlotId: number | null;
}

// Placeholder function to maintain compatibility
function AppointmentStatusChanger({ 
  appointmentId, 
  currentStatus, 
  onUpdate 
}: { 
  appointmentId: number; 
  currentStatus: string; 
  onUpdate: () => void; 
}) {
  return (
    <Button 
      variant="outline" 
      size="sm" 
      className="h-8 px-2"
      onClick={onUpdate}
    >
      <ChevronDown className="h-4 w-4" />
    </Button>
  );
}

export default function PatientDetail() {
  const [match, params] = useRoute("/patients/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isAppointmentDetailOpen, setIsAppointmentDetailOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const patientId = params?.id ? parseInt(params.id) : null;

  // Fetch patient data
  const { data: patient, isLoading: isLoadingPatient, refetch: refetchPatient } = useQuery({
    queryKey: [`/api/patients/${patientId}`],
    queryFn: async () => {
      return await apiRequest(`/api/patients/${patientId}`);
    },
    enabled: !!patientId,
  });

  // Fetch transactions
  const { data: transactions, isLoading: isLoadingTransactions, refetch: refetchTransactions } = useQuery({
    queryKey: [`/api/transactions?patientId=${patientId}`],
    queryFn: async () => {
      return await apiRequest(`/api/transactions?patientId=${patientId}`);
    },
    enabled: !!patientId,
  });

  // Fetch active sessions (packages)
  const { data: activeSessions, isLoading: isLoadingSessions, refetch: refetchSessions } = useQuery({
    queryKey: [`/api/sessions?patientId=${patientId}&active=true`],
    queryFn: async () => {
      return await apiRequest(`/api/sessions?patientId=${patientId}&active=true`);
    },
    enabled: !!patientId,
  });

  // Fetch appointments
  const { data: appointments, isLoading: isLoadingAppointments, refetch: refetchAppointments } = useQuery({
    queryKey: [`/api/appointments?patientId=${patientId}`],
    queryFn: async () => {
      return await apiRequest(`/api/appointments?patientId=${patientId}`);
    },
    enabled: !!patientId,
  });
  
  // Fetch medical histories
  const { data: medicalHistories, isLoading: isLoadingMedicalHistories, refetch: refetchMedicalHistories } = useQuery({
    queryKey: [`/api/medical-histories/patient/${patientId}`],
    queryFn: async () => {
      return await apiRequest(`/api/medical-histories/patient/${patientId}`);
    },
    enabled: !!patientId,
  });

  const refreshAll = () => {
    refetchPatient();
    refetchTransactions();
    refetchSessions();
    refetchAppointments();
    refetchMedicalHistories();
    toast({
      title: "Data diperbarui",
      description: "Semua data telah diperbarui",
    });
  };
  
  const openAppointmentDetail = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setIsAppointmentDetailOpen(true);
  };
  
  const deletePatient = async () => {
    try {
      const response = await fetch(`/api/patients/${patientId}`, {
        method: "DELETE",
        credentials: 'include'
      });

      if (response.ok) {
        toast({
          title: "Pasien dihapus",
          description: "Pasien berhasil dihapus dari sistem",
        });
        navigate("/patients");
      } else {
        let errorMessage = "Gagal menghapus pasien";
        
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json();
          if (errorData && errorData.message) {
            errorMessage = errorData.message;
          }
        } else {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText;
          }
        }
        
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error("Error deleting patient:", error);
      toast({
        title: "Gagal menghapus pasien",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  if (!patientId) {
    return (
      <div className="p-4">
        <p>ID Pasien tidak valid</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate("/patients")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali
        </Button>
      </div>
    );
  }

  if (isLoadingPatient) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin mb-2" />
        <p>Memuat data pasien...</p>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="p-4">
        <p>Pasien tidak ditemukan</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate("/patients")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali
        </Button>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'scheduled':
      case 'booked':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'completed':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const calculateAge = (birthDate: string) => {
    const birth = new Date(birthDate);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <div className="pb-20">
      {/* Header bar - fixed at top */}
      <div className="flex justify-between items-center p-4 sticky top-0 bg-background z-30 border-b">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="mr-2"
            onClick={() => navigate("/patients")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-bold">Detail Pasien</h2>
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={refreshAll}
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="text-red-500" size="icon">
                <Trash className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-[90%] rounded-lg">
              <AlertDialogHeader>
                <AlertDialogTitle>Hapus Pasien</AlertDialogTitle>
                <AlertDialogDescription className="text-sm">
                  Apakah Anda yakin ingin menghapus pasien ini?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={deletePatient}
                  className="bg-red-500 hover:bg-red-600 text-white"
                >
                  Hapus
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Patient Info Card */}
      <div className="p-4">
        <Card className="shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30 pb-4">
            <div className="flex justify-between items-start">
              <CardTitle className="text-lg">
                <User className="h-5 w-5 inline-block mr-2 text-primary" />
                Informasi Pasien
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {/* Patient name and basic info */}
            <div className="mb-5 pb-3 border-b">
              <h3 className="text-xl font-bold mb-2">{patient.name}</h3>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className="flex items-center px-2 py-1">
                  <svg viewBox="0 0 24 24" className="h-3 w-3 mr-1" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 15c-.55 0-1-.45-1-1v-4H7c-.55 0-1-.45-1-1s.45-1 1-1h4V6c0-.55.45-1 1-1s1 .45 1 1v4h4c.55 0 1 .45 1 1s-.45 1-1 1h-4v4c0 .55-.45 1-1 1z"/>
                  </svg>
                  {calculateAge(patient.birthDate)} tahun
                </Badge>
                <Badge variant="outline" className="px-2 py-1">
                  {patient.gender}
                </Badge>
              </div>
            </div>
            
            {/* Contact information with icons */}
            <div className="space-y-3 mb-4">
              <div className="flex items-center">
                <Phone className="h-5 w-5 mr-3 text-primary" />
                <a 
                  href={`https://wa.me/${patient.phoneNumber ? patient.phoneNumber.replace(/[^0-9]/g, '') : ''}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-base font-medium hover:underline flex items-center"
                >
                  {patient.phoneNumber}
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="#25D366" 
                    className="ml-2"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </a>
              </div>
              
              {patient.email && (
                <div className="flex items-center">
                  <MailIcon className="h-5 w-5 mr-3 text-primary" />
                  <span>{patient.email}</span>
                </div>
              )}
            </div>
            
            {/* Patient ID dan info lain */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-muted/30 p-2 rounded">
                <p className="text-muted-foreground mb-1">ID Pasien</p>
                <p className="font-medium">{patient.patientId}</p>
              </div>
              <div className="bg-muted/30 p-2 rounded">
                <p className="text-muted-foreground mb-1">Tanggal Lahir</p>
                <p className="font-medium">{formatBirthDate(patient.birthDate)}</p>
              </div>
              <div className="bg-muted/30 p-2 rounded col-span-2">
                <p className="text-muted-foreground mb-1">Alamat</p>
                <p className="font-medium text-xs md:text-sm line-clamp-2">{patient.address || "-"}</p>
              </div>
              <div className="bg-muted/30 p-2 rounded">
                <p className="text-muted-foreground mb-1">Terdaftar</p>
                <p className="font-medium">{formatDate(patient.createdAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="mt-2 px-4">
        <Tabs defaultValue="appointments" className="w-full">
          <div className="border-b overflow-x-auto">
            <TabsList className="w-full p-0 h-auto bg-transparent gap-4">
              <TabsTrigger 
                value="appointments" 
                className="flex-1 pt-3 pb-2 border-b-2 border-transparent data-[state=active]:border-primary rounded-none bg-transparent data-[state=active]:bg-transparent"
              >
                <Calendar className="h-4 w-4 mr-1" />
                <span>Janji Temu</span>
              </TabsTrigger>
              <TabsTrigger 
                value="packages" 
                className="flex-1 pt-3 pb-2 border-b-2 border-transparent data-[state=active]:border-primary rounded-none bg-transparent data-[state=active]:bg-transparent"
              >
                <Package className="h-4 w-4 mr-1" />
                <span>Paket</span>
              </TabsTrigger>
              <TabsTrigger 
                value="transactions" 
                className="flex-1 pt-3 pb-2 border-b-2 border-transparent data-[state=active]:border-primary rounded-none bg-transparent data-[state=active]:bg-transparent"
              >
                <Receipt className="h-4 w-4 mr-1" />
                <span>Transaksi</span>
              </TabsTrigger>
              <TabsTrigger 
                value="medical-history" 
                className="flex-1 pt-3 pb-2 border-b-2 border-transparent data-[state=active]:border-primary rounded-none bg-transparent data-[state=active]:bg-transparent"
              >
                <Activity className="h-4 w-4 mr-1" />
                <span>Medis</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab Contents */}
          <TabsContent value="appointments" className="mt-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold">Janji Temu</h3>
                <Button 
                  size="sm" 
                  className="h-8 text-xs"
                  onClick={() => {
                    toast({
                      title: "Membuat janji temu baru",
                      description: `Mengarahkan ke form pendaftaran pasien`
                    });
                    navigate(`/register?patientId=${patientId}`);
                  }}
                >
                  + Tambah
                </Button>
              </div>

              {isLoadingAppointments ? (
                <div className="flex justify-center p-6">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : !appointments || appointments.length === 0 ? (
                <div className="text-center py-8 bg-muted/30 rounded-lg">
                  <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p>Belum ada janji temu</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {appointments.map((appointment: Appointment) => (
                    <div 
                      key={appointment.id} 
                      className="border rounded-lg p-3 shadow-sm active:bg-muted/10"
                      onClick={() => openAppointmentDetail(appointment)}
                    >
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div>
                          <div className="font-medium">
                            {formatDate(appointment.date)}
                            {appointment.timeSlot && ` · ${appointment.timeSlot}`}
                          </div>
                          {appointment.registrationNumber && (
                            <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                              No. Reg: {appointment.registrationNumber}
                            </div>
                          )}
                        </div>
                        <Badge className={`${getStatusColor(appointment.status)} whitespace-nowrap text-xs`}>
                          {appointment.status}
                        </Badge>
                      </div>
                      {appointment.notes && (
                        <div className="mt-2 text-sm bg-muted/20 p-2 rounded">
                          <span className="text-muted-foreground">Catatan:</span> <span className="line-clamp-2">{appointment.notes}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="packages" className="mt-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold">Paket Aktif</h3>
                <Button 
                  size="sm" 
                  className="h-8 text-xs"
                  onClick={() => {
                    toast({
                      title: "Menambah paket",
                      description: "Mengarahkan ke form transaksi untuk pembelian paket"
                    });
                    navigate(`/transactions/new?patientId=${patientId}`);
                  }}
                >
                  + Tambah
                </Button>
              </div>

              {isLoadingSessions ? (
                <div className="flex justify-center p-6">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : !activeSessions || activeSessions.length === 0 ? (
                <div className="text-center py-8 bg-muted/30 rounded-lg">
                  <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p>Belum ada paket aktif</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeSessions.map((session: Session) => {
                    const remaining = session.totalSessions - session.sessionsUsed;
                    const remainingPercentage = Math.round((remaining / session.totalSessions) * 100);
                    
                    return (
                      <div key={session.id} className="border rounded-lg p-3 shadow-sm">
                        <div className="flex justify-between mb-2">
                          <h4 className="font-medium">{session.package?.name || 'Paket Terapi'}</h4>
                          <Badge variant={session.status === 'Active' ? 'default' : 'secondary'}>
                            {session.status}
                          </Badge>
                        </div>
                        
                        <div className="flex justify-between text-sm mb-1">
                          <span>Sesi Tersisa: </span>
                          <span className="font-medium">{remaining} dari {session.totalSessions}</span>
                        </div>
                        
                        <div className="mt-2 mb-3">
                          <Progress value={remainingPercentage} className="h-2" />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs mt-3 text-muted-foreground">
                          <div>
                            <span>Mulai: </span>
                            <span className="font-medium text-foreground">{formatDate(session.startDate)}</span>
                          </div>
                          <div>
                            <span>Sesi Terakhir: </span>
                            <span className="font-medium text-foreground">
                              {session.lastSessionDate ? formatDate(session.lastSessionDate) : '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="transactions" className="mt-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold">Transaksi</h3>
                <Button 
                  size="sm" 
                  className="h-8 text-xs"
                  onClick={() => {
                    toast({
                      title: "Membuat transaksi baru",
                      description: "Mengarahkan ke form pembuatan transaksi"
                    });
                    navigate(`/transactions/new?patientId=${patientId}`);
                  }}
                >
                  + Tambah
                </Button>
              </div>

              {isLoadingTransactions ? (
                <div className="flex justify-center p-6">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : !transactions || transactions.length === 0 ? (
                <div className="text-center py-8 bg-muted/30 rounded-lg">
                  <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p>Belum ada transaksi</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((transaction: Transaction) => (
                    <div 
                      key={transaction.id} 
                      className="border rounded-lg p-3 shadow-sm"
                      onClick={() => navigate(`/transactions/${transaction.id}`)}
                    >
                      <div className="flex justify-between mb-2">
                        <div className="font-medium">{transaction.transactionId}</div>
                        <Badge variant={transaction.paymentMethod === 'Cash' ? 'default' : 'outline'}>
                          {transaction.paymentMethod}
                        </Badge>
                      </div>
                      
                      <div className="flex justify-between text-xs text-muted-foreground mb-2">
                        <span>{formatDate(transaction.createdAt)}</span>
                        <span>{transaction.items?.length || 0} item</span>
                      </div>
                      
                      <div className="mt-2 pt-2 border-t">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Total</span>
                          <span className="font-semibold">
                            {new Intl.NumberFormat('id-ID', { 
                              style: 'currency', 
                              currency: 'IDR',
                              minimumFractionDigits: 0 
                            }).format(parseInt(transaction.totalAmount))}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="medical-history" className="mt-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold">Riwayat Medis</h3>
              </div>

              {isLoadingMedicalHistories ? (
                <div className="flex justify-center p-6">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <MedicalHistoryList patientId={patientId} />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {isAppointmentDetailOpen && selectedAppointment && (
        <Dialog open={isAppointmentDetailOpen} onOpenChange={setIsAppointmentDetailOpen}>
          <DialogContent className="max-w-[90%] rounded-lg">
            <DialogHeader>
              <DialogTitle>Detail Janji Temu</DialogTitle>
              <DialogDescription>
                Informasi lengkap tentang janji temu pasien
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 my-2 py-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Tanggal</p>
                  <p className="font-medium">{formatDate(selectedAppointment.date)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Waktu</p>
                  <p className="font-medium">{selectedAppointment.timeSlot || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <div className={`${getStatusColor(selectedAppointment.status)} px-2 py-1 rounded text-xs inline-block`}>
                    {selectedAppointment.status}
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground">No. Registrasi</p>
                  <p className="font-medium truncate">{selectedAppointment.registrationNumber || '-'}</p>
                </div>
              </div>
              
              {selectedAppointment.notes && (
                <div>
                  <p className="text-muted-foreground">Catatan</p>
                  <p className="p-2 bg-muted/20 rounded text-sm">{selectedAppointment.notes}</p>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAppointmentDetailOpen(false)}>
                Tutup
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}