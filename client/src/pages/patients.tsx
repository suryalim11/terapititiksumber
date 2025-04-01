import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { calculateAge } from "@/lib/utils";
import { Search, Plus, UserRound, Pencil, FileText, CreditCard, Calendar, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { PatientForm } from "@/components/patients/patient-form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface Patient {
  id: number;
  patientId: string;
  name: string;
  phoneNumber: string;
  email?: string;
  birthDate: string;
  address?: string;
  gender: string;
  complaints: string;
  createdAt: string;
}

interface Appointment {
  id: number;
  patientId: number;
  therapySlotId: number | null;
  date: string;
  timeSlot: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes: string | null;
  sessionId: number | null;
  therapySlot?: {
    date: string;
    timeSlot: string;
    maxQuota: number;
    currentCount: number;
  };
}

export default function Patients() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  const [isEditPatientOpen, setIsEditPatientOpen] = useState(false);
  const [isViewPatientOpen, setIsViewPatientOpen] = useState(false);
  const [isAppointmentsOpen, setIsAppointmentsOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isConfirmCancelOpen, setIsConfirmCancelOpen] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch patients data
  const { data: patients = [], isLoading } = useQuery<Patient[]>({
    queryKey: ['/api/patients'],
  });
  
  // Filter patients based on search term
  const filteredPatients = patients.filter(patient => 
    patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.patientId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.phoneNumber.includes(searchTerm)
  );

  // Fetch appointments data for selected patient
  const { data: appointments = [], isLoading: isLoadingAppointments } = useQuery<Appointment[]>({
    queryKey: ['/api/appointments', selectedPatient?.id],
    queryFn: async () => {
      if (!selectedPatient) return [];
      const response = await fetch(`/api/patients/${selectedPatient.id}/appointments`);
      if (!response.ok) {
        throw new Error('Failed to fetch appointments');
      }
      return response.json();
    },
    enabled: !!selectedPatient && isAppointmentsOpen
  });

  // Mutation for cancelling appointment
  const cancelAppointmentMutation = useMutation({
    mutationFn: async (appointmentId: number) => {
      const response = await fetch(`/api/appointments/${appointmentId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Gagal membatalkan janji temu');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Janji temu dibatalkan",
        description: "Janji temu pasien berhasil dibatalkan",
        variant: "default",
      });
      
      setIsConfirmCancelOpen(false);
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments', selectedPatient?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/therapy-slots'] });
      queryClient.invalidateQueries({ queryKey: ['/api/today-slots'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Gagal membatalkan janji",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleEditPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setIsEditPatientOpen(true);
  };

  const handleViewPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setIsViewPatientOpen(true);
  };
  
  const handleNewTransaction = (patient: Patient) => {
    // Navigasi ke halaman transaksi dengan parameter patientId
    navigate(`/transactions/new?patientId=${patient.id}`);
  };
  
  const handleViewAppointments = (patient: Patient) => {
    setSelectedPatient(patient);
    setIsAppointmentsOpen(true);
  };
  
  const handleCancelAppointment = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setIsConfirmCancelOpen(true);
  };
  
  const confirmCancelAppointment = () => {
    if (selectedAppointment) {
      cancelAppointmentMutation.mutate(selectedAppointment.id);
    }
  };
  
  // Helper function to format appointment date and time
  const formatAppointmentDateTime = (date: string, timeSlot: string | null) => {
    const formattedDate = format(new Date(date), 'dd MMM yyyy');
    return timeSlot ? `${formattedDate}, ${timeSlot}` : formattedDate;
  };
  
  // Helper function to get status badge variant
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge variant="outline" className="bg-blue-50 text-blue-600 hover:bg-blue-100">Terjadwal</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-50 text-green-600 hover:bg-green-100">Selesai</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="bg-red-50 text-red-600 hover:bg-red-100">Dibatalkan</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Pasien</h2>
          <p className="text-muted-foreground">
            Kelola catatan pasien dan riwayat medis.
          </p>
        </div>
        <Button onClick={() => setIsAddPatientOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Tambah Pasien
        </Button>
      </div>
      
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Cari pasien berdasarkan nama, ID, atau nomor telepon..."
          className="w-full pl-8"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      
      {/* Patients List */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
        </div>
      ) : filteredPatients.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPatients.map((patient) => (
            <Card key={patient.id} className="overflow-hidden">
              <CardHeader 
                className="border-b bg-muted/40 p-4 cursor-pointer hover:bg-muted/60 transition-colors"
                onClick={() => handleNewTransaction(patient)}
              >
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                    <UserRound className="h-4 w-4 text-primary" />
                  </span>
                  {patient.name}
                </CardTitle>
                <div className="mt-1 text-xs text-muted-foreground flex items-center">
                  <CreditCard className="h-3 w-3 mr-1" />
                  Klik untuk buat transaksi
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <div className="text-muted-foreground">ID Pasien</div>
                  <div className="font-medium">{patient.patientId}</div>
                  
                  <div className="text-muted-foreground">Telepon</div>
                  <div className="font-medium">{patient.phoneNumber}</div>
                  
                  <div className="text-muted-foreground">Usia</div>
                  <div className="font-medium">{calculateAge(patient.birthDate)} tahun</div>
                  
                  <div className="text-muted-foreground">Jenis Kelamin</div>
                  <div className="font-medium">{patient.gender}</div>
                </div>
                
                <div className="mt-4 flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleViewPatient(patient)}
                  >
                    <FileText className="mr-1 h-3.5 w-3.5" />
                    Detail
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleEditPatient(patient)}
                  >
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    Edit
                  </Button>
                </div>
                
                <div className="mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-center text-primary hover:text-primary"
                    onClick={() => handleViewAppointments(patient)}
                  >
                    <Calendar className="mr-1 h-3.5 w-3.5" />
                    Janji Temu
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <UserRound className="h-6 w-6 text-primary" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">Tidak ada pasien ditemukan</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm">
            {searchTerm ? "Tidak ada pasien yang sesuai dengan kriteria pencarian Anda. Coba kata kunci lain." : "Anda belum menambahkan pasien. Klik 'Tambah Pasien' untuk memulai."}
          </p>
        </div>
      )}

      {/* Add Patient Dialog */}
      <Dialog open={isAddPatientOpen} onOpenChange={setIsAddPatientOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Tambah Pasien Baru</DialogTitle>
          </DialogHeader>
          <PatientForm 
            onSuccess={() => setIsAddPatientOpen(false)} 
          />
        </DialogContent>
      </Dialog>

      {/* Edit Patient Dialog */}
      <Dialog open={isEditPatientOpen} onOpenChange={setIsEditPatientOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Data Pasien</DialogTitle>
          </DialogHeader>
          {selectedPatient && (
            <PatientForm 
              onSuccess={() => setIsEditPatientOpen(false)}
              defaultValues={{
                name: selectedPatient.name,
                phoneNumber: selectedPatient.phoneNumber,
                email: selectedPatient.email || "",
                birthDate: selectedPatient.birthDate,
                gender: selectedPatient.gender as "Laki-laki" | "Perempuan",
                address: selectedPatient.address || "",
                complaints: selectedPatient.complaints || "",
              }}
              isEditing={true}
              patientId={selectedPatient.id}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* View Patient Dialog */}
      <Dialog open={isViewPatientOpen} onOpenChange={setIsViewPatientOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Detail Pasien</DialogTitle>
          </DialogHeader>
          {selectedPatient && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Nama Lengkap</div>
                  <div className="font-medium">{selectedPatient.name}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">ID Pasien</div>
                  <div className="font-medium">{selectedPatient.patientId}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Tanggal Terdaftar</div>
                  <div className="font-medium">{new Date(selectedPatient.createdAt).toLocaleDateString('id-ID')}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Nomor Telepon</div>
                  <div className="font-medium">{selectedPatient.phoneNumber}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Email</div>
                  <div className="font-medium">{selectedPatient.email || "-"}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Tanggal Lahir</div>
                  <div className="font-medium">{new Date(selectedPatient.birthDate).toLocaleDateString('id-ID')}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Jenis Kelamin</div>
                  <div className="font-medium">{selectedPatient.gender}</div>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground">Alamat</div>
                <div className="font-medium">{selectedPatient.address || "-"}</div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground">Keluhan Pasien</div>
                <div className="rounded-md border p-3 mt-1">
                  {selectedPatient.complaints || "Tidak ada keluhan yang tercatat."}
                </div>
              </div>

              <div className="flex justify-between">
                <Button 
                  variant="outline" 
                  className="flex items-center"
                  onClick={() => {
                    setIsViewPatientOpen(false);
                    handleViewAppointments(selectedPatient);
                  }}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Lihat Janji Temu
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsViewPatientOpen(false)}
                >
                  Tutup
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Appointments Dialog */}
      <Dialog open={isAppointmentsOpen} onOpenChange={setIsAppointmentsOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Janji Temu Pasien</DialogTitle>
            <DialogDescription>
              {selectedPatient ? `Daftar janji temu untuk pasien ${selectedPatient.name}` : 'Memuat data janji temu...'}
            </DialogDescription>
          </DialogHeader>
          
          {isLoadingAppointments ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
            </div>
          ) : appointments.length > 0 ? (
            <div className="space-y-4">
              {appointments.map((appointment) => (
                <div key={appointment.id} className="rounded-md border p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-medium">
                      {formatAppointmentDateTime(appointment.date, appointment.timeSlot)}
                    </div>
                    <div>{getStatusBadge(appointment.status)}</div>
                  </div>
                  
                  {appointment.notes && (
                    <div className="text-sm text-muted-foreground mt-2">
                      <span className="font-medium">Catatan:</span> {appointment.notes}
                    </div>
                  )}
                  
                  {appointment.status === 'scheduled' && (
                    <div className="mt-4 flex justify-end">
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleCancelAppointment(appointment)}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Batalkan Janji
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setIsAppointmentsOpen(false)}
                >
                  Tutup
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="mb-4 flex justify-center">
                <Calendar className="h-12 w-12 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">Tidak ada janji temu</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Pasien ini belum memiliki jadwal janji temu.
              </p>
              <DialogFooter className="mt-6">
                <Button 
                  variant="outline" 
                  onClick={() => setIsAppointmentsOpen(false)}
                >
                  Tutup
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Cancel Appointment Confirmation Dialog */}
      <AlertDialog open={isConfirmCancelOpen} onOpenChange={setIsConfirmCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Pembatalan</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin membatalkan janji temu ini? Tindakan ini akan membebaskan slot terapi untuk pasien lain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmCancelAppointment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelAppointmentMutation.isPending ? (
                <>
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent"></span>
                  Memproses...
                </>
              ) : (
                "Ya, Batalkan Janji"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}