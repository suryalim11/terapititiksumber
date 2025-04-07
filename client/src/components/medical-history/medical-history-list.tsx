import { useState, useMemo, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { FilePenLine, Trash2, FileText, UserRound, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

interface PatientInfo {
  id: number;
  name: string;
  phoneNumber: string;
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
  const [patientMap, setPatientMap] = useState<Record<number, PatientInfo>>({});
  
  // Fetch all medical histories (including from old system) through our new comprehensive endpoint
  const { data: allMedicalHistories, isLoading, isError, refetch } = useQuery<MedicalHistory[]>({
    queryKey: [`/api/patients/${patientId}/all-medical-histories`],
    enabled: !!patientId,
  });
  
  // Fetch patient data to display source patient names
  useEffect(() => {
    const fetchPatientInfo = async (id: number) => {
      try {
        const response = await fetch(`/api/patients/${id}`);
        if (response.ok) {
          const data = await response.json();
          setPatientMap(prev => ({
            ...prev,
            [id]: {
              id: data.id,
              name: data.name,
              phoneNumber: data.phoneNumber
            }
          }));
        }
      } catch (error) {
        console.error(`Error fetching patient info for ID ${id}:`, error);
      }
    };
    
    // If we have medical histories from other patients, fetch their info
    if (allMedicalHistories && allMedicalHistories.length > 0) {
      // Create an object to deduplicate IDs
      const patientIdsMap: {[key: number]: boolean} = {};
      
      // Collect all unique patient IDs
      allMedicalHistories.forEach(h => {
        patientIdsMap[h.patientId] = true;
      });
      
      // Convert to array and skip the current patient
      const otherPatientIds = Object.keys(patientIdsMap)
        .map(Number)
        .filter(id => id !== patientId);
      
      otherPatientIds.forEach(id => {
        fetchPatientInfo(id);
      });
    }
  }, [allMedicalHistories, patientId]);
  
  // Process medical histories
  const medicalHistories = useMemo(() => {
    console.log(`DEBUG: Raw data from /api/patients/${patientId}/all-medical-histories:`, allMedicalHistories);
    
    if (!allMedicalHistories) {
      console.log(`MedicalHistoryList: No medical histories found for patient ${patientId}`);
      return [];
    }
    
    // Memastikan allMedicalHistories adalah array
    const historiesArray = Array.isArray(allMedicalHistories) ? allMedicalHistories : [];
    console.log(`MedicalHistoryList: Found ${historiesArray.length} medical histories for patient ${patientId}`);
    
    // Debugging informasi lengkap
    historiesArray.forEach((history, index) => {
      console.log(`Medical history ${index + 1}:`, {
        id: history.id,
        patientId: history.patientId,
        complaint: history.complaint?.substring(0, 20) + '...',
        treatmentDate: history.treatmentDate
      });
    });
    
    // Records are already sorted by the API, but in case we need to re-sort
    return historiesArray.sort((a, b) => 
      new Date(b.treatmentDate).getTime() - new Date(a.treatmentDate).getTime()
    );
  }, [allMedicalHistories, patientId]);
  
  const handleEditClick = (history: MedicalHistory) => {
    // Hanya izinkan edit jika riwayat medis milik pasien ini
    if (history.patientId === patientId) {
      setEditingHistory(history);
      setIsEditDialogOpen(true);
    } else {
      toast({
        title: "Tidak dapat mengedit",
        description: "Riwayat medis dari pasien lain tidak dapat diedit.",
        variant: "destructive",
      });
    }
  };
  
  const handleDeleteClick = (id: number, sourcePatientId: number) => {
    // Hanya izinkan hapus jika riwayat medis milik pasien ini
    if (sourcePatientId === patientId) {
      setDeletingId(id);
      setIsDeleteDialogOpen(true);
    } else {
      toast({
        title: "Tidak dapat menghapus",
        description: "Riwayat medis dari pasien lain tidak dapat dihapus.",
        variant: "destructive",
      });
    }
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
  
  // Helper to get patient name
  const getPatientName = (id: number) => {
    if (id === patientId) return null; // Current patient, don't show a label
    return patientMap[id]?.name || `Pasien #${id}`;
  };
  
  const renderSourceBadge = (history: MedicalHistory) => {
    // Deteksi apakah ini adalah riwayat medis virtual dari keluhan pasien (ID negatif)
    if (history.id < 0) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="ml-2 text-xs px-1.5 py-0.5 border bg-amber-100 border-amber-300 text-amber-700 rounded-md cursor-help inline-flex items-center">
                <FileText className="h-3 w-3 mr-1" />
                Dari keluhan awal
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Data ini diambil dari keluhan saat pendaftaran pasien, bukan catatan medis sebenarnya</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    
    // Jika bukan virtual dan dari pasien saat ini, tidak perlu badge
    if (history.patientId === patientId) return null;
    
    // Untuk riwayat dari pasien lain
    const sourceName = getPatientName(history.patientId);
    if (!sourceName) return null;
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="ml-2 text-xs px-1.5 py-0.5 border rounded-md cursor-help inline-flex items-center">
              <UserRound className="h-3 w-3 mr-1" />
              {sourceName}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Data riwayat medis dari pasien lain</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
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
  
  // Add note if we have data from other patients
  const hasDataFromOtherPatients = medicalHistories.some(history => history.patientId !== patientId);
  
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
        <CardDescription className="flex items-center">
          <span>Daftar catatan medis pasien</span>
          {hasDataFromOtherPatients && (
            <span className="inline-flex items-center ml-2 text-xs bg-muted/50 px-2 py-0.5 rounded-md">
              <FileText className="h-3 w-3 mr-1" />
              Termasuk data dari pasien lain
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {medicalHistories && medicalHistories.length > 0 ? (
          <div>
            {/* Tampilan tabel untuk desktop */}
            <div className="overflow-x-auto hidden md:block">
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
                  {medicalHistories.map((history) => {
                    const isFromOtherPatient = history.patientId !== patientId;
                    
                    return (
                      <TableRow 
                        key={history.id}
                        className={isFromOtherPatient ? "bg-muted/30" : ""}
                      >
                        <TableCell>
                          <div className="flex items-center">
                            <div>
                              {history.treatmentDate 
                                ? format(new Date(history.treatmentDate), "EEEE, dd/MM/yyyy", {
                                    locale: idLocale,
                                  })
                                : "Tanggal tidak tersedia"
                              }
                            </div>
                            {renderSourceBadge(history)}
                          </div>
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
                          {!isFromOtherPatient ? (
                            <>
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
                                onClick={() => handleDeleteClick(history.id, history.patientId)}
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Hapus</span>
                              </Button>
                            </>
                          ) : (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-xs px-2 py-1 border rounded-md cursor-help">
                                    Hanya lihat
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Data dari pasien lain hanya dapat dilihat, tidak dapat diedit atau dihapus</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            
            {/* Tampilan card untuk mobile */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {medicalHistories.map((history) => {
                const isFromOtherPatient = history.patientId !== patientId;
                const sourceName = getPatientName(history.patientId);
                
                return (
                  <Card 
                    key={history.id} 
                    className={`overflow-hidden ${isFromOtherPatient ? "border-muted-foreground/30" : ""}`}
                  >
                    <CardHeader className={`p-4 pb-2 ${isFromOtherPatient ? "bg-muted/50" : "bg-muted/30"}`}>
                      <div className="flex justify-between items-center">
                        <div>
                          <CardTitle className="text-base font-medium flex items-center">
                            <Clock className="h-4 w-4 mr-2" />
                            {history.treatmentDate 
                              ? format(new Date(history.treatmentDate), "EEEE, dd/MM/yyyy", {
                                  locale: idLocale,
                                })
                              : "Tanggal tidak tersedia"
                            }
                          </CardTitle>
                          {history.id < 0 ? (
                            <div className="text-xs bg-amber-100 text-amber-700 mt-1 flex items-center px-1.5 py-0.5 rounded-sm inline-block">
                              <FileText className="h-3 w-3 mr-1" />
                              Dari keluhan awal
                            </div>
                          ) : sourceName && (
                            <div className="text-xs text-muted-foreground mt-1 flex items-center">
                              <UserRound className="h-3 w-3 mr-1" />
                              Data dari pasien: {sourceName}
                            </div>
                          )}
                        </div>
                        {!isFromOtherPatient && (
                          <div className="flex space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleEditClick(history)}
                            >
                              <FilePenLine className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleDeleteClick(history.id, history.patientId)}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Hapus</span>
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                      <div className="grid grid-cols-1 gap-1 text-sm">
                        <div>
                          <span className="font-medium">Keluhan:</span>{" "}
                          <span className="line-clamp-2">{history.complaint}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="font-medium">Darah (Sebelum):</span>{" "}
                            {history.beforeBloodPressure || "-"}
                          </div>
                          <div>
                            <span className="font-medium">Darah (Sesudah):</span>{" "}
                            {history.afterBloodPressure || "-"}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <span className="font-medium">Jantung:</span>{" "}
                            {history.heartRate || "-"}
                          </div>
                          <div>
                            <span className="font-medium">Nadi:</span>{" "}
                            {history.pulseRate || "-"}
                          </div>
                          <div>
                            <span className="font-medium">Berat:</span>{" "}
                            {history.weight || "-"}
                          </div>
                        </div>
                        {history.notes && (
                          <div className="mt-2">
                            <span className="font-medium">Catatan:</span>{" "}
                            <span className="line-clamp-3">{history.notes}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>Belum ada riwayat medis.</p>
          </div>
        )}
      </CardContent>
      
      {/* Dialog Konfirmasi Hapus */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="w-[95vw] md:w-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus catatan medis ini? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="w-full sm:w-auto">Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete} 
              className="bg-destructive w-full sm:w-auto"
            >
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
          editData={editingHistory}
        />
      )}
    </Card>
  );
}