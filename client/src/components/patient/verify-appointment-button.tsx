import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCcw } from "lucide-react";
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

interface VerifyButtonProps {
  patientId?: number;
  onSuccess?: () => void;
}

/**
 * Tombol untuk verifikasi koneksi pasien-appointment
 * Dapat digunakan untuk verifikasi semua pasien (tanpa patientId)
 * atau verifikasi pasien tertentu (dengan patientId)
 */
export function VerifyAppointmentButton({ patientId, onSuccess }: VerifyButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const handleVerify = async () => {
    setIsLoading(true);
    try {
      // URL untuk endpoint verifikasi
      const url = patientId 
        ? `/api/verify/patient/${patientId}` 
        : "/api/verify/appointments";
      
      // Panggil API verifikasi  
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        credentials: "include"
      });
      
      if (!response.ok) {
        throw new Error(`Verifikasi gagal dengan status: ${response.status}`);
      }
      
      const data = await response.json();
      
      setResult(data);
      setIsDialogOpen(true);
      
      toast({
        title: "Verifikasi berhasil",
        description: data.message
      });
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error saat verifikasi:", error);
      toast({
        title: "Verifikasi gagal",
        description: error instanceof Error ? error.message : "Terjadi kesalahan saat verifikasi",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={handleVerify}
        disabled={isLoading}
        className="border-green-500 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950 dark:border-green-600"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Verifikasi...
          </>
        ) : (
          <>
            <RefreshCcw className="mr-2 h-4 w-4" />
            {patientId ? "Verifikasi & Perbaiki Janji Temu" : "Verifikasi Semua Koneksi"}
          </>
        )}
      </Button>
      
      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hasil Verifikasi</AlertDialogTitle>
            <AlertDialogDescription>
              {result?.message}
              
              {result?.result && (
                <div className="mt-4 p-4 bg-muted rounded-md text-xs">
                  <p><strong>Diverifikasi:</strong> {result.result.verified}</p>
                  <p><strong>Diperbaiki:</strong> {result.result.fixed}</p>
                  <p><strong>Dilewati:</strong> {result.result.skipped}</p>
                  {result.result.errors && result.result.errors.length > 0 && (
                    <div className="mt-2">
                      <p><strong>Error:</strong> {result.result.errors.length}</p>
                      <details>
                        <summary>Detail Error</summary>
                        <pre className="text-xs overflow-auto max-h-40 p-2 bg-background mt-2">
                          {JSON.stringify(result.result.errors, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Tutup</AlertDialogCancel>
            <AlertDialogAction onClick={() => setIsDialogOpen(false)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}