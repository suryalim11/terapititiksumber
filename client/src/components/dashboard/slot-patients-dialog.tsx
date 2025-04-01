import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CalendarIcon, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface SlotPatientsDialogProps {
  slotId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SlotPatientsDialog({ slotId, isOpen, onClose }: SlotPatientsDialogProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/therapy-slots', slotId, 'patients'],
    queryFn: async () => {
      if (!slotId) return null;
      const res = await fetch(`/api/therapy-slots/${slotId}/patients`);
      if (!res.ok) {
        throw new Error('Failed to fetch patients');
      }
      return res.json();
    },
    enabled: !!slotId && isOpen
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'dd MMMM yyyy');
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Detail Slot Terapi
            <DialogClose className="ml-auto">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-6 text-destructive">
            <p>Error: {(error as Error).message}</p>
          </div>
        ) : !data ? (
          <div className="text-center py-6 text-muted-foreground">
            <p>No data found</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Tanggal:</div>
                <div className="font-medium">{formatDate(data.slot.date)}</div>
                
                <div className="text-muted-foreground">Waktu:</div>
                <div className="font-medium">{data.slot.timeSlot}</div>
                
                <div className="text-muted-foreground">Kuota:</div>
                <div className="font-medium">{data.slot.currentCount}/{data.slot.maxQuota}</div>
                
                <div className="text-muted-foreground">Status:</div>
                <div>
                  {data.slot.isActive ? (
                    <Badge variant="success">Aktif</Badge>
                  ) : (
                    <Badge variant="destructive">Tidak Aktif</Badge>
                  )}
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium mb-2">Daftar Pasien</h3>
              {data.appointments.length === 0 ? (
                <p className="text-center py-4 text-sm text-muted-foreground border rounded">
                  Belum ada pasien terdaftar
                </p>
              ) : (
                <div className="border rounded-md divide-y">
                  {data.appointments.map((appointment: any) => (
                    <div key={appointment.id} className="p-3 text-sm">
                      <div className="font-medium">{appointment.patient.name}</div>
                      <div className="text-muted-foreground text-xs">
                        {appointment.patient.phoneNumber} | {appointment.status}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}