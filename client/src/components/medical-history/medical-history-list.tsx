import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FilePenLine, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AddMedicalHistoryDialog } from "./add-medical-history-dialog";
import { MedicalHistoryForm } from "./medical-history-form";

interface MedicalHistory {
  id: number;
  patientId: number;
  complaint: string;
  beforeBloodPressure: string | null;
  afterBloodPressure: string | null;
  heartRate: string | null;
  pulseRate: string | null;
  weight: string | null;
  notes: string | null;
  treatmentDate: string;
  createdAt: string;
  appointmentId: number | null;
}

interface MedicalHistoryListProps {
  patientId: number;
}

export function MedicalHistoryList({ patientId }: MedicalHistoryListProps) {
  const { toast } = useToast();
  const [editingHistory, setEditingHistory] = useState<MedicalHistory | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  
  // Fetch medical history for the patient
  const { data: medicalHistories, isLoading, isError, refetch } = useQuery<MedicalHistory[]>({
    queryKey: [`/api/medical-histories/patient/${patientId}`],
    enabled: !!patientId,
  });
  
  const handleEditClick = (history: MedicalHistory) => {
    setEditingHistory(history);
    setIsEditDialogOpen(true);
  };
  
  const handleDeleteClick = (id: number) => {
    setDeletingId(id);
    setIsDeleteDialogOpen(true);
  };
  
  const handleConfirmDelete = async () => {
    if (deletingId === null) return;
    
    try {
      const response = await fetch(`/api/medical-histories/${deletingId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Gagal menghapus riwayat medis");
      }
      
      toast({
        title: "Berhasil menghapus",
        description: "Riwayat medis telah dihapus",
      });
      
      refetch();
    } catch (error) {
      toast({
        title: "Gagal menghapus",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setDeletingId(null);
    }
  };
  
  const handleEditSuccess = () => {
    refetch();
    setIsEditDialogOpen(false);
    setEditingHistory(null);
  };
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Riwayat Medis</span>
            <AddMedicalHistoryDialog 
              patientId={patientId} 
              onSuccess={refetch}
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Memuat data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Riwayat Medis</span>
            <AddMedicalHistoryDialog 
              patientId={patientId} 
              onSuccess={refetch}
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-destructive">
            <p>Gagal memuat data riwayat medis.</p>
            <Button variant="outline" onClick={() => refetch()} className="mt-2">
              Coba Lagi
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Riwayat Medis</span>
          <AddMedicalHistoryDialog 
            patientId={patientId} 
            onSuccess={refetch}
          />
        </CardTitle>
        <CardDescription>
          Daftar catatan medis pasien
        </CardDescription>
      </CardHeader>
      <CardContent>
        {medicalHistories && medicalHistories.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Keluhan</TableHead>
                  <TableHead>Tekanan Darah (Sebelum)</TableHead>
                  <TableHead>Tekanan Darah (Sesudah)</TableHead>
                  <TableHead>Detak Jantung</TableHead>
                  <TableHead>Tekanan Nadi</TableHead>
                  <TableHead>Berat Badan</TableHead>
                  <TableHead>Catatan</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {medicalHistories.map((history) => (
                  <TableRow key={history.id}>
                    <TableCell>
                      {format(new Date(history.treatmentDate), "dd/MM/yyyy", {
                        locale: idLocale,
                      })}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {history.complaint}
                    </TableCell>
                    <TableCell>{history.beforeBloodPressure || "-"}</TableCell>
                    <TableCell>{history.afterBloodPressure || "-"}</TableCell>
                    <TableCell>{history.heartRate || "-"}</TableCell>
                    <TableCell>{history.pulseRate || "-"}</TableCell>
                    <TableCell>{history.weight || "-"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {history.notes || "-"}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditClick(history)}
                      >
                        <FilePenLine className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(history.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Hapus</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>Belum ada riwayat medis.</p>
          </div>
        )}
      </CardContent>
      
      {/* Dialog Konfirmasi Hapus */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus catatan medis ini? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Dialog Edit Riwayat Medis */}
      {editingHistory && (
        <MedicalHistoryForm
          isOpen={isEditDialogOpen}
          onClose={() => {
            setIsEditDialogOpen(false);
            setEditingHistory(null);
          }}
          patientId={editingHistory.patientId}
          appointmentId={editingHistory.appointmentId || undefined}
          onSubmitSuccess={handleEditSuccess}
        />
      )}
    </Card>
  );
}