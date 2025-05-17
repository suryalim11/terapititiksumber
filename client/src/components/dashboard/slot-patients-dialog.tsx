import React from "react";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CalendarIcon, User, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { generateWhatsAppLink } from "@/lib/utils";

interface SlotPatientsDialogProps {
  slotId: number | null;
  slotDate?: string;
  slotTimeSlot?: string;
  isOpen: boolean;
  onClose: () => void;
}

// Fungsi helper untuk memformat tanggal
function formatDate(dateInput?: string | Date): string {
  if (!dateInput) return '-';
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return format(date, 'dd MMMM yyyy', { locale: localeId });
  } catch (error) {
    return 'Invalid date';
  }
}

export function SlotPatientsDialog({ slotId, slotDate, slotTimeSlot, isOpen, onClose }: SlotPatientsDialogProps) {
  const { toast } = useToast();
  
  // Mengambil data slot
  const { 
    data: slot,
    isLoading: isSlotLoading,
    error: slotError
  } = useQuery({
    queryKey: ['/api/therapy-slots', slotId],
    queryFn: async () => {
      if (!slotId) return null;
      const response = await fetch(`/api/therapy-slots/${slotId}`);
      if (!response.ok) throw new Error('Gagal mengambil data slot');
      return response.json();
    },
    enabled: !!slotId && isOpen
  });
  
  // Mengambil daftar pasien yang terkait dengan slot ini
  const {
    data: patients,
    isLoading: isPatientsLoading,
    error: patientsError
  } = useQuery({
    queryKey: ['/api/simple-slot', slotId, 'patients'],
    queryFn: async () => {
      if (!slotId) return [];
      const response = await fetch(`/api/simple-slot/${slotId}/patients`);
      if (!response.ok) throw new Error('Gagal mengambil data pasien');
      return response.json();
    },
    enabled: !!slotId && isOpen
  });
  
  const isLoading = isSlotLoading || isPatientsLoading;
  const error = slotError || patientsError;

  // Render dialog
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            <span>Detail Slot Terapi</span>
          </DialogTitle>
          <DialogDescription>
            {slotDate && slotTimeSlot ? (
              <>
                {formatDate(slotDate)} | {slotTimeSlot}
              </>
            ) : (
              "Memuat data slot terapi..."
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 p-6 text-center">
            <p className="text-red-600">
              {error instanceof Error ? error.message : "Terjadi kesalahan saat memuat data"}
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2" 
              onClick={onClose}
            >
              Tutup
            </Button>
          </div>
        )}

        {!isLoading && !error && slot && (
          <div className="space-y-6">
            {/* Informasi slot */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b pb-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Tanggal</h3>
                <p>{formatDate(slot.date)}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Waktu</h3>
                <p>{slot.timeSlot}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Kuota</h3>
                <p>{slot.currentCount} / {slot.maxQuota} Pasien</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Status</h3>
                <div>
                  {slot.isActive 
                    ? <Badge className="bg-green-500">Aktif</Badge> 
                    : <Badge variant="destructive">Tidak Aktif</Badge>}
                </div>
              </div>
            </div>

            {/* Daftar pasien */}
            <div>
              <h3 className="text-lg font-medium mb-3">Daftar Pasien ({patients?.length || 0})</h3>
              
              {isPatientsLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : patients && patients.length > 0 ? (
                <div className="space-y-3">
                  {patients.map((patient: any) => (
                    <div key={patient.id} className="border rounded-lg p-3 hover:bg-muted transition-colors">
                      <div className="flex justify-between">
                        <div>
                          <p className="font-medium">{patient.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {patient.phone || 'Tidak ada nomor telepon'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {patient.phone && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => {
                                const whatsappLink = generateWhatsAppLink(patient.phone);
                                window.open(whatsappLink, '_blank');
                              }}
                              title="Hubungi via WhatsApp"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => {
                              // Navigasi ke halaman detail pasien
                              window.location.href = `/patients/${patient.id}`;
                            }}
                          >
                            <User className="h-4 w-4 mr-1" />
                            Detail
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 border border-dashed rounded-lg">
                  <p className="text-muted-foreground">Belum ada pasien yang terdaftar untuk slot ini</p>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}