import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, CheckCircle, ChevronDown, Loader2, RefreshCcw, User, Package, Calendar, Receipt, AlertTriangle, Activity, Plus, Edit, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { formatBirthDate } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

// Add formats for Indonesia locale
// Menggunakan formatBirthDate dari utils untuk tanggal lahir
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

// Komponen untuk mengubah status appointment
function AppointmentStatusChanger({ 
  appointmentId, 
  currentStatus, 
  onUpdate 
}: { 
  appointmentId: number; 
  currentStatus: string; 
  onUpdate: () => void; 
}) {
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();
  
  const statusOptions = ["Scheduled", "Active", "Completed", "Cancelled"];
  
  const updateStatus = async (newStatus: string) => {
    if (newStatus === currentStatus) return;
    
    setIsUpdating(true);
    try {
      const response = await apiRequest(`/api/appointments/${appointmentId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (response.ok) {
        toast({
          title: "Status diperbarui",
          description: `Status janji temu berhasil diubah menjadi "${newStatus}"`,
        });
        onUpdate();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Gagal mengubah status");
      }
    } catch (error) {
      console.error("Error updating appointment status:", error);
      toast({
        title: "Gagal mengubah status",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 px-2">
          {isUpdating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <span className="sr-only">Ubah status</span>
              <ChevronDown className="h-4 w-4" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {statusOptions.map((status) => (
          <DropdownMenuItem
            key={status}
            onClick={() => updateStatus(status)}
            disabled={isUpdating || status === currentStatus}
            className={status === currentStatus ? "font-bold" : ""}
          >
            {status === currentStatus && <CheckCircle className="h-4 w-4 mr-2" />}
            {status}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function PatientDetail() {
  const [match, params] = useRoute("/patients/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [medicalHistoryDialogOpen, setMedicalHistoryDialogOpen] = useState(false);
  const [editMedicalHistoryId, setEditMedicalHistoryId] = useState<number | null>(null);
  const [deleteMedicalHistoryId, setDeleteMedicalHistoryId] = useState<number | null>(null);
  const [deleteMedicalHistoryDialogOpen, setDeleteMedicalHistoryDialogOpen] = useState(false);
  const [medicalHistoryForm, setMedicalHistoryForm] = useState({
    complaint: "",
    beforeBloodPressure: "",
    afterBloodPressure: "",
    notes: "",
    treatmentDate: format(new Date(), "yyyy-MM-dd")
  });
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
  
  const openCreateMedicalHistoryDialog = () => {
    setEditMedicalHistoryId(null);
    setMedicalHistoryForm({
      complaint: "",
      beforeBloodPressure: "",
      afterBloodPressure: "",
      notes: "",
      treatmentDate: format(new Date(), "yyyy-MM-dd")
    });
    setMedicalHistoryDialogOpen(true);
  };
  
  const openEditMedicalHistoryDialog = (medicalHistory: MedicalHistory) => {
    setEditMedicalHistoryId(medicalHistory.id);
    setMedicalHistoryForm({
      complaint: medicalHistory.complaint,
      beforeBloodPressure: medicalHistory.beforeBloodPressure || "",
      afterBloodPressure: medicalHistory.afterBloodPressure || "",
      notes: medicalHistory.notes || "",
      treatmentDate: format(new Date(medicalHistory.treatmentDate), "yyyy-MM-dd")
    });
    setMedicalHistoryDialogOpen(true);
  };
  
  const openDeleteMedicalHistoryDialog = (id: number) => {
    setDeleteMedicalHistoryId(id);
    setDeleteMedicalHistoryDialogOpen(true);
  };
  
  const handleMedicalHistorySubmit = async () => {
    try {
      if (!medicalHistoryForm.complaint || !medicalHistoryForm.treatmentDate) {
        toast({
          title: "Form tidak lengkap",
          description: "Keluhan dan tanggal terapi wajib diisi",
          variant: "destructive",
        });
        return;
      }
      
      // Skema di server sudah disiapkan dengan preprocessor untuk handle konversi string ke Date
      const payload = {
        patientId,
        complaint: medicalHistoryForm.complaint,
        beforeBloodPressure: medicalHistoryForm.beforeBloodPressure || null,
        afterBloodPressure: medicalHistoryForm.afterBloodPressure || null,
        notes: medicalHistoryForm.notes || null,
        treatmentDate: medicalHistoryForm.treatmentDate // Kirim string tanggal langsung, preprocessor di server akan menangani
      };
      
      let url = `/api/medical-histories`;
      let method = "POST";
      
      if (editMedicalHistoryId) {
        url = `/api/medical-histories/${editMedicalHistoryId}`;
        method = "PUT";
      }
      
      const response = await apiRequest(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      
      if (response.ok) {
        toast({
          title: editMedicalHistoryId ? "Riwayat medis diperbarui" : "Riwayat medis ditambahkan",
          description: editMedicalHistoryId 
            ? "Data riwayat medis berhasil diperbarui" 
            : "Data riwayat medis baru berhasil ditambahkan",
        });
        setMedicalHistoryDialogOpen(false);
        refetchMedicalHistories();
      } else {
        // Tangani respons error dengan lebih baik
        let errorMessage = "Gagal menyimpan riwayat medis";
        try {
          // Coba parse response sebagai JSON
          const errorData = await response.text();
          if (errorData) {
            try {
              const parsedError = JSON.parse(errorData);
              if (parsedError && parsedError.message) {
                errorMessage = parsedError.message;
              }
            } catch (e) {
              // Jika tidak bisa di-parse sebagai JSON, gunakan text langsung
              errorMessage = errorData;
            }
          }
        } catch (e) {
          console.error("Error parsing error response:", e);
        }
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error("Error submitting medical history:", error);
      toast({
        title: "Gagal menyimpan riwayat medis",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    }
  };
  
  const deleteMedicalHistory = async () => {
    try {
      if (!deleteMedicalHistoryId) return;
      
      const response = await apiRequest(`/api/medical-histories/${deleteMedicalHistoryId}`, {
        method: "DELETE",
      });
      
      if (response.ok) {
        toast({
          title: "Riwayat medis dihapus",
          description: "Data riwayat medis berhasil dihapus",
        });
        setDeleteMedicalHistoryDialogOpen(false);
        refetchMedicalHistories();
      } else {
        // Tangani respons error dengan lebih baik
        let errorMessage = "Gagal menghapus riwayat medis";
        try {
          // Coba parse response sebagai JSON
          const errorData = await response.text();
          if (errorData) {
            try {
              const parsedError = JSON.parse(errorData);
              if (parsedError && parsedError.message) {
                errorMessage = parsedError.message;
              }
            } catch (e) {
              // Jika tidak bisa di-parse sebagai JSON, gunakan text langsung
              errorMessage = errorData;
            }
          }
        } catch (e) {
          console.error("Error parsing error response:", e);
        }
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error("Error deleting medical history:", error);
      toast({
        title: "Gagal menghapus riwayat medis",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setDeleteMedicalHistoryDialogOpen(false);
    }
  };

  const deletePatient = async () => {
    try {
      const response = await apiRequest(`/api/patients/${patientId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast({
          title: "Pasien dihapus",
          description: "Pasien berhasil dihapus dari sistem",
        });
        navigate("/patients");
      } else {
        // Tangani respons error dengan lebih baik
        let errorMessage = "Gagal menghapus pasien";
        try {
          // Coba parse response sebagai JSON
          const errorData = await response.text();
          if (errorData) {
            try {
              const parsedError = JSON.parse(errorData);
              if (parsedError && parsedError.message) {
                errorMessage = parsedError.message;
              }
            } catch (e) {
              // Jika tidak bisa di-parse sebagai JSON, gunakan text langsung
              errorMessage = errorData;
            }
          }
        } catch (e) {
          console.error("Error parsing error response:", e);
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
      <div className="container py-10">
        <h2 className="text-2xl font-bold mb-5">Detail Pasien</h2>
        <p>ID Pasien tidak valid</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate("/patients")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali ke Daftar Pasien
        </Button>
      </div>
    );
  }

  if (isLoadingPatient) {
    return (
      <div className="container py-10">
        <h2 className="text-2xl font-bold mb-5">Detail Pasien</h2>
        <p>Memuat data pasien...</p>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="container py-10">
        <h2 className="text-2xl font-bold mb-5">Detail Pasien</h2>
        <p>Pasien tidak ditemukan</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate("/patients")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali ke Daftar Pasien
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
    <div className="container py-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <Button
            variant="outline"
            size="icon"
            className="mr-4"
            onClick={() => navigate("/patients")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-2xl font-bold">Detail Pasien</h2>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="icon" onClick={refreshAll}>
            <RefreshCcw className="h-4 w-4" />
          </Button>
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Hapus Pasien</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Hapus Pasien</AlertDialogTitle>
                <AlertDialogDescription>
                  Apakah Anda yakin ingin menghapus pasien ini? Tindakan ini tidak dapat dibatalkan.
                  Semua data terkait seperti janji temu dan sesi terapi juga akan dihapus.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={deletePatient}>Hapus</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="h-5 w-5 mr-2" />
              Informasi Pasien
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID Pasien</span>
                <span className="font-medium">{patient.patientId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nama</span>
                <span className="font-medium">{patient.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">No. Telepon</span>
                <span className="font-medium">{patient.phoneNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{patient.email || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tanggal Lahir</span>
                <span className="font-medium">{formatBirthDate(patient.birthDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Usia</span>
                <span className="font-medium">{calculateAge(patient.birthDate)} tahun</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Jenis Kelamin</span>
                <span className="font-medium">{patient.gender}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Alamat</span>
                <span className="font-medium">{patient.address || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Terdaftar pada</span>
                <span className="font-medium">{formatDate(patient.createdAt)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-2">
          <Tabs defaultValue="appointments">
            <TabsList className="grid grid-cols-4 mb-4">
              <TabsTrigger value="appointments">
                <Calendar className="h-4 w-4 mr-2" />
                Janji Temu
              </TabsTrigger>
              <TabsTrigger value="packages">
                <Package className="h-4 w-4 mr-2" />
                Paket Aktif
              </TabsTrigger>
              <TabsTrigger value="transactions">
                <Receipt className="h-4 w-4 mr-2" />
                Transaksi
              </TabsTrigger>
              <TabsTrigger value="medical-history">
                <Activity className="h-4 w-4 mr-2" />
                Riwayat Medis
              </TabsTrigger>
            </TabsList>

            <TabsContent value="appointments">
              <Card>
                <CardHeader>
                  <CardTitle>Riwayat Janji Temu</CardTitle>
                  <CardDescription>
                    Daftar seluruh janji terapi pasien
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingAppointments ? (
                    <p>Memuat data janji temu...</p>
                  ) : !appointments || appointments.length === 0 ? (
                    <div className="text-center py-6">
                      <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                      <p>Tidak ada janji temu yang ditemukan</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {appointments.map((appointment: Appointment) => (
                        <div key={appointment.id} className="flex items-center justify-between border-b pb-4 pt-2">
                          <div>
                            <p className="font-medium">
                              {formatDate(appointment.date)}
                              {appointment.timeSlot && ` · ${appointment.timeSlot}`}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {appointment.registrationNumber || `#${appointment.id}`}
                              {appointment.notes && ` · ${appointment.notes}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusColor(appointment.status)}>
                              {appointment.status}
                            </Badge>
                            <AppointmentStatusChanger 
                              appointmentId={appointment.id} 
                              currentStatus={appointment.status} 
                              onUpdate={() => refetchAppointments()}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="packages">
              <Card>
                <CardHeader>
                  <CardTitle>Paket Terapi Aktif</CardTitle>
                  <CardDescription>
                    Daftar paket terapi yang saat ini masih aktif
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingSessions ? (
                    <p>Memuat data paket terapi...</p>
                  ) : !activeSessions || activeSessions.length === 0 ? (
                    <div className="text-center py-6">
                      <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                      <p>Tidak ada paket terapi aktif</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {activeSessions.map((session: Session) => (
                        <div key={session.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold">{session.package?.name || `Paket #${session.packageId}`}</h3>
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                              Aktif
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-muted-foreground">Total Sesi</p>
                              <p className="font-medium">{session.totalSessions}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Sesi Terpakai</p>
                              <p className="font-medium">{session.sessionsUsed}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Sesi Tersisa</p>
                              <p className="font-medium">{session.totalSessions - session.sessionsUsed}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Mulai Paket</p>
                              <p className="font-medium">{formatDate(session.startDate)}</p>
                            </div>
                            {session.lastSessionDate && (
                              <div>
                                <p className="text-muted-foreground">Sesi Terakhir</p>
                                <p className="font-medium">{formatDate(session.lastSessionDate)}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="transactions">
              <Card>
                <CardHeader>
                  <CardTitle>Riwayat Transaksi</CardTitle>
                  <CardDescription>
                    Seluruh riwayat transaksi pembelian pasien
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingTransactions ? (
                    <p>Memuat data transaksi...</p>
                  ) : !transactions || transactions.length === 0 ? (
                    <div className="text-center py-6">
                      <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                      <p>Tidak ada transaksi yang ditemukan</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {transactions.map((transaction: Transaction) => (
                        <div key={transaction.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold">{transaction.transactionId}</h3>
                            <p className="text-green-600 font-semibold">
                              Rp {Number(transaction.totalAmount).toLocaleString('id-ID')}
                            </p>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {formatDate(transaction.createdAt)}
                          </p>
                          <div className="text-sm">
                            <p className="text-muted-foreground">Metode Pembayaran</p>
                            <p className="font-medium">{transaction.paymentMethod}</p>
                          </div>
                          <div className="mt-3">
                            <p className="text-sm font-medium mb-1">Item:</p>
                            <div className="space-y-1">
                              {Array.isArray(transaction.items) ? transaction.items.map((item, index) => (
                                <div key={index} className="flex justify-between text-sm">
                                  <span>
                                    {item.name} 
                                    {item.quantity > 1 && ` × ${item.quantity}`}
                                  </span>
                                  <span>
                                    Rp {Number(item.price * (item.quantity || 1)).toLocaleString('id-ID')}
                                  </span>
                                </div>
                              )) : (
                                <p className="text-sm">Data item tidak tersedia</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="medical-history">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle>Riwayat Medis</CardTitle>
                    <CardDescription>
                      Catatan riwayat pemeriksaan dan terapi pasien
                    </CardDescription>
                  </div>
                  <Button onClick={openCreateMedicalHistoryDialog}>
                    <Plus className="h-4 w-4 mr-2" />
                    Tambah Catatan
                  </Button>
                </CardHeader>
                <CardContent>
                  {isLoadingMedicalHistories ? (
                    <p>Memuat data riwayat medis...</p>
                  ) : !medicalHistories || medicalHistories.length === 0 ? (
                    <div className="text-center py-6">
                      <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                      <p>Tidak ada riwayat medis yang ditemukan</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {medicalHistories.map((history: MedicalHistory) => (
                        <div key={history.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold">Terapi: {formatDate(history.treatmentDate)}</h3>
                            <div className="flex space-x-2">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => openEditMedicalHistoryDialog(history)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => openDeleteMedicalHistoryDialog(history.id)}
                              >
                                <Trash className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                          <div className="grid gap-3">
                            <div>
                              <p className="text-sm text-muted-foreground">Keluhan</p>
                              <p className="font-medium">{history.complaint}</p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              {history.beforeBloodPressure && (
                                <div>
                                  <p className="text-sm text-muted-foreground">Tekanan Darah (Sebelum)</p>
                                  <p className="font-medium">{history.beforeBloodPressure}</p>
                                </div>
                              )}
                              
                              {history.afterBloodPressure && (
                                <div>
                                  <p className="text-sm text-muted-foreground">Tekanan Darah (Sesudah)</p>
                                  <p className="font-medium">{history.afterBloodPressure}</p>
                                </div>
                              )}
                            </div>
                            
                            {history.notes && (
                              <div>
                                <p className="text-sm text-muted-foreground">Catatan</p>
                                <p className="font-medium">{history.notes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      {/* Dialog untuk tambah/edit catatan medis */}
      <Dialog open={medicalHistoryDialogOpen} onOpenChange={setMedicalHistoryDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editMedicalHistoryId ? "Edit Catatan Medis" : "Tambah Catatan Medis"}
            </DialogTitle>
            <DialogDescription>
              {editMedicalHistoryId 
                ? "Ubah informasi catatan medis pasien" 
                : "Tambahkan catatan medis baru untuk pasien"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="treatmentDate">Tanggal Terapi</Label>
              <Input
                id="treatmentDate"
                type="date"
                value={medicalHistoryForm.treatmentDate}
                onChange={(e) => setMedicalHistoryForm({
                  ...medicalHistoryForm,
                  treatmentDate: e.target.value
                })}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="complaint">Keluhan</Label>
              <Textarea
                id="complaint"
                placeholder="Masukkan keluhan pasien"
                value={medicalHistoryForm.complaint}
                onChange={(e) => setMedicalHistoryForm({
                  ...medicalHistoryForm,
                  complaint: e.target.value
                })}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="beforeBloodPressure">Tekanan Darah (Sebelum)</Label>
                <Input
                  id="beforeBloodPressure"
                  placeholder="Contoh: 120/80"
                  value={medicalHistoryForm.beforeBloodPressure}
                  onChange={(e) => setMedicalHistoryForm({
                    ...medicalHistoryForm,
                    beforeBloodPressure: e.target.value
                  })}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="afterBloodPressure">Tekanan Darah (Sesudah)</Label>
                <Input
                  id="afterBloodPressure"
                  placeholder="Contoh: 120/80"
                  value={medicalHistoryForm.afterBloodPressure}
                  onChange={(e) => setMedicalHistoryForm({
                    ...medicalHistoryForm,
                    afterBloodPressure: e.target.value
                  })}
                />
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="notes">Catatan</Label>
              <Textarea
                id="notes"
                placeholder="Catatan tambahan tentang terapi"
                value={medicalHistoryForm.notes}
                onChange={(e) => setMedicalHistoryForm({
                  ...medicalHistoryForm,
                  notes: e.target.value
                })}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setMedicalHistoryDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleMedicalHistorySubmit}>
              {editMedicalHistoryId ? "Simpan Perubahan" : "Tambah Catatan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog konfirmasi hapus catatan medis */}
      <AlertDialog open={deleteMedicalHistoryDialogOpen} onOpenChange={setDeleteMedicalHistoryDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Catatan Medis</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus catatan medis ini? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={deleteMedicalHistory}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}