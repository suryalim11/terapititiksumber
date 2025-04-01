import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { calculateAge } from "@/lib/utils";
import { Search, Plus, UserRound, Pencil, FileText, CreditCard } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PatientForm } from "@/components/patients/patient-form";
import { Input } from "@/components/ui/input";

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

export default function Patients() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  const [isEditPatientOpen, setIsEditPatientOpen] = useState(false);
  const [isViewPatientOpen, setIsViewPatientOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [, navigate] = useLocation();
  
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

              <div className="flex justify-end">
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
    </div>
  );
}