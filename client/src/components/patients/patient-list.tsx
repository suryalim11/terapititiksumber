import { useQuery } from "@tanstack/react-query";
import { format, differenceInYears } from "date-fns";
import { id } from "date-fns/locale";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import PatientForm from "./patient-form";

type Patient = {
  id: number;
  patientId: string;
  name: string;
  birthDate: string;
  address: string;
  complaints: string;
  createdAt: string;
};

export default function PatientList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isPatientFormOpen, setIsPatientFormOpen] = useState(false);
  
  const { data: patients, isLoading, error } = useQuery({
    queryKey: ["/api/patients"],
  });

  const filteredPatients = patients
    ? patients.filter((patient: Patient) =>
        patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        patient.patientId.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  const calculateAge = (birthDate: string) => {
    try {
      const birthDateObj = new Date(birthDate);
      return differenceInYears(new Date(), birthDateObj);
    } catch (e) {
      return "N/A";
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "d MMMM yyyy", { locale: id });
    } catch (e) {
      return dateString;
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl font-heading">Daftar Pasien</CardTitle>
            <CardDescription>
              Kelola semua pasien terdaftar di Terapi Titik Sumber
            </CardDescription>
          </div>
          <Button
            onClick={() => setIsPatientFormOpen(true)}
            className="flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Tambah Pasien
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Cari pasien berdasarkan nama atau ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">
              Terjadi kesalahan saat memuat data pasien.
            </div>
          ) : !filteredPatients || filteredPatients.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {searchTerm ? "Tidak ada pasien yang sesuai dengan pencarian." : "Belum ada pasien terdaftar."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID Pasien</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Umur</TableHead>
                    <TableHead>Alamat</TableHead>
                    <TableHead>Keluhan</TableHead>
                    <TableHead>Terdaftar</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPatients.map((patient: Patient) => (
                    <TableRow key={patient.id}>
                      <TableCell className="font-medium">{patient.patientId}</TableCell>
                      <TableCell>{patient.name}</TableCell>
                      <TableCell>{calculateAge(patient.birthDate)} tahun</TableCell>
                      <TableCell className="max-w-[200px] truncate">{patient.address}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{patient.complaints}</TableCell>
                      <TableCell>{formatDate(patient.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <PatientForm
        isOpen={isPatientFormOpen}
        onClose={() => setIsPatientFormOpen(false)}
      />
    </>
  );
}
