import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { calculateAge } from "@/lib/utils";
import { Search, Plus, UserRound, Pencil, FileText, CreditCard, Calendar, AlertCircle, CheckCircle2, XCircle, Trash2, Receipt } from "lucide-react";
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
  const [isDeletePatientOpen, setIsDeletePatientOpen] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch patients data
  const { data: patients = [], isLoading } = useQuery<Patient[]>({
    queryKey: ['/api/patients'],
  });
  
  // Deduplicasi pasien dengan membuat Map berdasarkan nama dan nomor telepon
  const patientDeduplication: Map<string, Patient> = new Map();
  
  // Prioritas: ambil yang memiliki ID paling besar (terbaru)
  patients.sort((a, b) => b.id - a.id).forEach(patient => {
    const key = `${patient.name.toLowerCase()}_${patient.phoneNumber}`;
    if (!patientDeduplication.has(key)) {
      patientDeduplication.set(key, patient);
    }
  });
  
  // Konversi Map kembali ke array
  const dedupedPatients = Array.from(patientDeduplication.values());
  
  // Normalisasi nomor telepon untuk pencarian
  const normalizePhoneNumber = (phone: string) => {
    // Hapus semua karakter non-numerik
    const numericOnly = phone.replace(/\D/g, '');
    
    // Normalisasi awalan +62 dan 0
    if (numericOnly.startsWith('62')) {
      return numericOnly; // Format 62xxx
    } else if (numericOnly.startsWith('0')) {
      return '62' + numericOnly.substring(1); // Ubah 0xxx menjadi 62xxx
    } else {
      return numericOnly; // Format lainnya
    }
  };

  // Filter patients based on search term
  const filteredPatients = dedupedPatients.filter(patient => {
    // Jika searchTerm kosong, tampilkan semua pasien
    if (!searchTerm.trim()) {
      return true;
    }
    
    const lowerSearchTerm = searchTerm.toLowerCase().trim();
    
    // Pencarian berdasarkan nama
    if (patient.name && patient.name.toLowerCase().includes(lowerSearchTerm)) {
      return true;
    }
    
    // Pencarian berdasarkan ID pasien
    if (patient.patientId && patient.patientId.toLowerCase().includes(lowerSearchTerm)) {
      return true;
    }
    
    // Pencarian berdasarkan nomor telepon yang dinormalisasi
    if (patient.phoneNumber) {
      const normalizedPatientPhone = normalizePhoneNumber(patient.phoneNumber);
      
      // Hanya normalisasi nomor telepon jika searchTerm berisi angka
      if (/\d/.test(lowerSearchTerm)) {
        const normalizedSearchTerm = normalizePhoneNumber(lowerSearchTerm);
        
        // Pencocokan lengkap atau sebagian nomor telepon
        if (normalizedPatientPhone.includes(normalizedSearchTerm) || 
            normalizedSearchTerm.includes(normalizedPatientPhone)) {
          return true;
        }
      }
    }
    
    // Pencarian berdasarkan alamat
    if (patient.address && patient.address.toLowerCase().includes(lowerSearchTerm)) {
      return true;
    }
    
    // Tidak cocok dengan kriteria pencarian
    return false;
  });

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

  // Mutation for deleting patient
  const deletePatientMutation = useMutation({
    mutationFn: async (patientId: number) => {
      const response = await fetch(`/api/patients/${patientId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Gagal menghapus pasien');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Pasien dihapus",
        description: "Data pasien berhasil dihapus dari sistem",
        variant: "default",
      });
      
      setIsDeletePatientOpen(false);
      setSelectedPatient(null);
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/patients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/activities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/therapy-slots'] });
      queryClient.invalidateQueries({ queryKey: ['/api/today-slots'] });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Gagal menghapus pasien",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleEditPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setIsEditPatientOpen(true);
  };

  const handleDeletePatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setIsDeletePatientOpen(true);
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
  
  const confirmDeletePatient = () => {
    if (selectedPatient) {
      deletePatientMutation.mutate(selectedPatient.id);
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-0">
        <div>
          <h2 className="mobile-heading text-2xl md:text-3xl font-bold tracking-tight">Pasien</h2>
          <p className="text-sm md:text-base text-muted-foreground">
            Kelola catatan pasien dan riwayat medis.
          </p>
        </div>
        <Button 
          onClick={() => setIsAddPatientOpen(true)}
          className="touch-target h-12 md:h-10 w-full md:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" />
          Tambah Pasien
        </Button>
      </div>
      
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-2.5 top-3.5 md:top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Cari pasien..."
          className="w-full pl-8 h-12 md:h-10"
          inputMode="search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div className="text-xs text-muted-foreground mt-1 ml-2">
          Cari berdasarkan nama, ID, atau nomor telepon
        </div>
      </div>
      
      {/* Patients List */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
        </div>
      ) : filteredPatients.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPatients.map((patient) => (
            <Card 
              key={patient.id} 
              className="overflow-hidden mobile-card relative"
              style={{ 
                borderLeft: dedupedPatients.filter(p => 
                  p.phoneNumber === patient.phoneNumber && 
                  p.name.toLowerCase() !== patient.name.toLowerCase()
                ).length > 0
                  ? "4px solid #3b82f6" // Blue border for shared phone numbers (different people)
                  : undefined 
              }}
            >
              {dedupedPatients.filter(p => 
                  p.phoneNumber === patient.phoneNumber && 
                  p.name.toLowerCase() !== patient.name.toLowerCase()
                ).length > 0 && (
                <div className="absolute top-0 right-0 m-2 z-10">
                  <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200">
                    Telepon Sama
                  </Badge>
                </div>
              )}
              <CardHeader 
                className="border-b bg-muted/40 p-3 md:p-4 cursor-pointer hover:bg-muted/60 transition-colors"
                onClick={() => handleNewTransaction(patient)}
              >
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                    <UserRound className="h-4 w-4 text-primary" />
                  </span>
                  {patient.name}
                </CardTitle>
                <div className="mt-1 text-xs text-muted-foreground flex items-center justify-between">
                  <div className="flex items-center">
                    <CreditCard className="h-3 w-3 mr-1" />
                    Klik untuk buat transaksi
                  </div>
                  <Badge variant="outline" className="text-xs font-normal">
                    {patient.patientId}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-3 md:p-4">
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <div className="text-muted-foreground">ID Pasien</div>
                  <div className="font-medium">{patient.patientId}</div>
                  
                  <div className="text-muted-foreground">Telepon</div>
                  <div className="font-medium">
                    <a href={`tel:${patient.phoneNumber}`} className="hover:text-primary">
                      {patient.phoneNumber}
                    </a>
                  </div>
                  
                  <div className="text-muted-foreground">Usia</div>
                  <div className="font-medium">{calculateAge(patient.birthDate)} tahun</div>
                  
                  <div className="text-muted-foreground">Jenis Kelamin</div>
                  <div className="font-medium">{patient.gender}</div>
                  
                  <div className="text-muted-foreground">Terdaftar</div>
                  <div className="font-medium">{format(new Date(patient.createdAt), 'dd/MM/yyyy')}</div>
                </div>
                
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="touch-target h-12 md:h-10 text-sm"
                    onClick={() => navigate(`/patients/${patient.id}`)}
                  >
                    <FileText className="md:mr-1 h-3.5 w-3.5" />
                    <span className="hidden md:inline-block ml-1">Detail</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="touch-target h-12 md:h-10 text-sm"
                    onClick={() => handleEditPatient(patient)}
                  >
                    <Pencil className="md:mr-1 h-3.5 w-3.5" />
                    <span className="hidden md:inline-block ml-1">Edit</span>
                  </Button>
                
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="touch-target h-12 md:h-10 text-sm text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                    onClick={() => handleDeletePatient(patient)}
                  >
                    <Trash2 className="md:mr-1 h-3.5 w-3.5" />
                    <span className="hidden md:inline-block ml-1">Hapus</span>
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    className="touch-target h-12 md:h-10 text-sm justify-center text-primary hover:text-primary"
                    onClick={() => handleViewAppointments(patient)}
                  >
                    <Calendar className="md:mr-1 h-3.5 w-3.5" />
                    <span className="md:inline-block ml-1">Janji Temu</span>
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    className="touch-target h-12 md:h-10 text-sm justify-center text-primary hover:text-primary"
                    onClick={() => navigate(`/transactions?patientId=${patient.id}`)}
                  >
                    <Receipt className="md:mr-1 h-3.5 w-3.5" />
                    <span className="md:inline-block ml-1">Riwayat</span>
                  </Button>
                </div>
                
                {/* WhatsApp quick link for all devices */}
                <div className="mt-3">
                  <a 
                    href={`https://wa.me/${patient.phoneNumber.replace(/^0/, '62')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-full p-2 text-sm text-green-600 bg-green-50 hover:bg-green-100 rounded-md"
                  >
                    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Chat WhatsApp
                  </a>
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
        <DialogContent className="w-[95vw] max-w-[600px] p-4 md:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl">Tambah Pasien Baru</DialogTitle>
          </DialogHeader>
          <PatientForm 
            onSuccess={() => setIsAddPatientOpen(false)} 
          />
        </DialogContent>
      </Dialog>

      {/* Edit Patient Dialog */}
      <Dialog open={isEditPatientOpen} onOpenChange={setIsEditPatientOpen}>
        <DialogContent className="w-[95vw] max-w-[600px] p-4 md:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl">Edit Data Pasien</DialogTitle>
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
        <DialogContent className="w-[95vw] max-w-[600px] p-4 md:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl">Detail Pasien</DialogTitle>
          </DialogHeader>
          {selectedPatient && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Nomor Telepon</div>
                  <div className="font-medium flex items-center">
                    {selectedPatient.phoneNumber}
                    <a 
                      href={`tel:${selectedPatient.phoneNumber}`} 
                      className="text-primary ml-2 md:hidden"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                      </svg>
                    </a>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Email</div>
                  <div className="font-medium">
                    {selectedPatient.email ? (
                      <a href={`mailto:${selectedPatient.email}`} className="text-primary hover:underline">
                        {selectedPatient.email}
                      </a>
                    ) : (
                      "-"
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
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

              {/* WhatsApp link for all devices */}
              <div>
                <a 
                  href={`https://wa.me/${selectedPatient.phoneNumber.replace(/^0/, '62')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-full p-3 bg-green-50 text-green-600 rounded-md hover:bg-green-100"
                >
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Chat WhatsApp
                </a>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 justify-between">
                <Button 
                  variant="outline" 
                  className="flex items-center h-12 md:h-10"
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
                  className="h-12 md:h-10"
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
        <DialogContent className="w-[95vw] max-w-[600px] p-4 md:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl">Janji Temu Pasien</DialogTitle>
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
                <div key={appointment.id} className="rounded-md border p-3 md:p-4">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2">
                    <div className="font-medium text-base">
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
                        className="h-10 w-full sm:w-auto"
                        onClick={() => handleCancelAppointment(appointment)}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Batalkan Janji
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              
              <DialogFooter className="mt-2 sm:mt-4">
                <Button 
                  variant="outline" 
                  className="h-12 md:h-10 w-full sm:w-auto"
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
                  className="h-12 md:h-10 w-full sm:w-auto"
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
      {/* Delete Patient Confirmation */}
      <AlertDialog open={isDeletePatientOpen} onOpenChange={setIsDeletePatientOpen}>
        <AlertDialogContent className="w-[95vw] max-w-[500px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Pasien</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus pasien ini? Tindakan ini tidak dapat dibatalkan.
              Semua data terkait seperti janji temu dan transaksi mungkin juga akan terpengaruh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeletePatient}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Cancel Appointment Confirmation */}
      <AlertDialog open={isConfirmCancelOpen} onOpenChange={setIsConfirmCancelOpen}>
        <AlertDialogContent className="w-[95vw] max-w-[500px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Konfirmasi Pembatalan</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin membatalkan janji temu ini? Tindakan ini akan membebaskan slot terapi untuk pasien lain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
            <AlertDialogCancel className="h-12 md:h-10 mt-0">Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmCancelAppointment}
              className="h-12 md:h-10 bg-destructive text-destructive-foreground hover:bg-destructive/90"
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