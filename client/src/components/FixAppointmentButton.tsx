import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle } from "lucide-react";

interface FixAppointmentButtonProps {
  patientId: number;
  therapySlotId: number;
  patientName: string;
  onSuccess?: () => void;
}

export default function FixAppointmentButton({
  patientId,
  therapySlotId,
  patientName,
  onSuccess
}: FixAppointmentButtonProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFixAppointment = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log(`Memperbaiki appointment untuk pasien ${patientName} (${patientId}) pada slot ${therapySlotId}`);
      
      const response = await fetch("/api/fix/appointment-direct", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          patientId,
          therapySlotId
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
        toast({
          title: "Berhasil",
          description: "Appointment berhasil dibuat",
          variant: "default",
        });
        
        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
            setIsOpen(false);
          }, 1500);
        }
      } else {
        setError(data.message || "Gagal membuat appointment");
        toast({
          title: "Gagal",
          description: data.message || "Terjadi kesalahan saat membuat appointment",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Error:", err);
      setError("Terjadi kesalahan saat menghubungi server");
      toast({
        title: "Error",
        description: "Terjadi kesalahan saat menghubungi server",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => setIsOpen(true)}
        className="h-8 px-2 text-xs"
      >
        Daftarkan Walkin
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Daftarkan Pasien Walkin</DialogTitle>
            <DialogDescription>
              Pendaftaran pasien walkin secara langsung ke slot terapi yang tersedia.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <div><strong>Nama Pasien:</strong> {patientName}</div>
              <div><strong>ID Pasien:</strong> {patientId}</div>
              <div><strong>ID Therapy Slot:</strong> {therapySlotId}</div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {result && (
              <Alert variant="default" className="border-green-500 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertTitle>Berhasil</AlertTitle>
                <AlertDescription>{result.message}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isLoading}>
                Tutup
              </Button>
            </DialogClose>
            <Button onClick={handleFixAppointment} disabled={isLoading || !!result}>
              {isLoading ? <Spinner className="mr-2" /> : null}
              {isLoading ? "Memproses..." : "Perbaiki Appointment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}