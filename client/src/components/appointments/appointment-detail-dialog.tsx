import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Calendar, ClipboardList } from "lucide-react";
import { Label } from "@/components/ui/label";

interface AppointmentDetailDialogProps {
  appointment: any;
  isOpen: boolean;
  onClose: () => void;
}

export function AppointmentDetailDialog({ appointment, isOpen, onClose }: AppointmentDetailDialogProps) {
  const [status, setStatus] = useState(appointment?.status || "Scheduled");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      return await apiRequest(`/api/appointments/${appointment.id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Status diperbarui",
        description: `Status janji temu berhasil diubah menjadi "${status}"`,
      });
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/therapy-slots'] });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      onClose(); // Close the dialog after successful update
    },
    onError: (error: any) => {
      toast({
        title: "Gagal mengubah status",
        description: error.message || "Terjadi kesalahan saat mengubah status",
        variant: "destructive",
      });
    }
  });

  const handleSaveStatus = () => {
    updateStatusMutation.mutate(status);
  };

  if (!appointment) return null;

  const formattedDate = new Date(appointment.date).toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Janji Temu Pasien
            <DialogClose className="ml-auto">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </DialogTitle>
          <DialogDescription>
            Detail dan manajemen janji temu pasien
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Appointment Information */}
          <div className="grid gap-3">
            <div className="rounded-lg bg-muted p-3">
              <div className="font-medium mb-2">Informasi Pasien</div>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nama:</span>
                  <span className="font-medium">{appointment.patient?.name || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">No. HP:</span>
                  <span>{appointment.patient?.phoneNumber || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ID Pasien:</span>
                  <span>{appointment.patient?.patientId || '-'}</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-muted p-3">
              <div className="font-medium mb-2">Informasi Janji Temu</div>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tanggal:</span>
                  <span>{formattedDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Waktu:</span>
                  <span>{appointment.timeSlot || appointment.therapySlot?.timeRange || '-'}</span>
                </div>
                {appointment.notes && (
                  <div className="flex flex-col mt-1">
                    <span className="text-muted-foreground">Catatan:</span>
                    <span className="mt-1 p-2 bg-background rounded">{appointment.notes}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Status Management */}
          <div className="border rounded-lg p-3">
            <div className="flex items-center mb-3">
              <ClipboardList className="h-4 w-4 mr-2" />
              <span className="font-medium">Ubah Status</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status-select">Status Janji Temu</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status-select">
                  <SelectValue placeholder="Pilih status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Scheduled">Scheduled</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={handleSaveStatus} disabled={updateStatusMutation.isPending}>
            {updateStatusMutation.isPending ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}