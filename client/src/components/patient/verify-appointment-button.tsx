import { Button } from "@/components/ui/button";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface VerifyAppointmentButtonProps {
  patientId: number;
  label?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  className?: string;
}

export function VerifyAppointmentButton({
  patientId,
  label = "Periksa Janji Temu",
  variant = "outline",
  className = ""
}: VerifyAppointmentButtonProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const { toast } = useToast();

  const handleVerify = async () => {
    if (!patientId) {
      toast({
        title: "Error",
        description: "ID pasien tidak valid",
        variant: "destructive"
      });
      return;
    }

    setIsVerifying(true);
    try {
      const response = await apiRequest({
        url: `/api/maintenance/verify-patient-appointments/${patientId}`,
        method: 'POST',
        credentials: 'include'
      });

      if (response.success) {
        toast({
          title: "Berhasil",
          description: response.message || "Verifikasi janji temu berhasil",
        });
      } else {
        toast({
          title: "Gagal",
          description: response.message || "Gagal melakukan verifikasi janji temu",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error verifying appointment:", error);
      toast({
        title: "Error",
        description: "Terjadi kesalahan saat melakukan verifikasi janji temu",
        variant: "destructive"
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={handleVerify}
      disabled={isVerifying}
      className={className}
    >
      {isVerifying ? "Memeriksa..." : label}
    </Button>
  );
}