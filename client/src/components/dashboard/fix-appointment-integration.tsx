import React from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

/**
 * Komponen untuk memperbaiki appointment yang hilang dalam sistem
 * Digunakan dalam dashboard, data berasal dari data pasien di therapy slot
 */
interface FixAppointmentIntegrationProps {
  patientId: number;
  patientName: string;
  therapySlotId: number;
  onSuccess?: () => void;
}

export function FixAppointmentIntegration({ 
  patientId, 
  patientName, 
  therapySlotId, 
  onSuccess 
}: FixAppointmentIntegrationProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);

  const handleFixAppointment = async () => {
    if (!patientId || !therapySlotId) {
      toast({
        title: "Data tidak lengkap",
        description: "Informasi pasien atau slot terapi tidak lengkap",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
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
        toast({
          title: "Berhasil",
          description: data.message || "Appointment berhasil diperbaiki",
          variant: "default",
        });
        
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast({
          title: "Gagal",
          description: data.message || "Terjadi kesalahan saat memperbaiki appointment",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error saat memperbaiki appointment:", error);
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
    <Button
      variant="outline"
      size="sm"
      onClick={handleFixAppointment}
      disabled={isLoading}
      className="h-7 px-2 text-xs"
    >
      {isLoading ? "Memproses..." : "Perbaiki"}
    </Button>
  );
}