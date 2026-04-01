import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SessionEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  session: {
    id: number;
    totalSessions: number;
    sessionsUsed: number;
    patient?: {
      name: string;
    };
    package?: {
      name: string;
    };
  };
  onSuccess: () => void;
}

export function SessionEditorDialog({
  isOpen,
  onClose,
  session,
  onSuccess
}: SessionEditorDialogProps) {
  const [sessionsUsed, setSessionsUsed] = useState<number>(session?.sessionsUsed || 0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Reset sessionsUsed when session changes
  React.useEffect(() => {
    if (session) {
      setSessionsUsed(session.sessionsUsed);
    }
  }, [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!session) return;

    // Validasi input
    if (sessionsUsed < 0) {
      setError("Jumlah sesi terpakai tidak boleh negatif");
      return;
    }

    if (sessionsUsed > session.totalSessions) {
      setError(`Jumlah sesi terpakai tidak boleh melebihi total sesi (${session.totalSessions})`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Kirim request ke API universal
      const response = await fetch("/api/sessions/fix-usage-count", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId: session.id,
          newUsageCount: sessionsUsed
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal memperbarui jumlah sesi terpakai");
      }

      // Notifikasi sukses
      toast({
        title: "Berhasil",
        description: result.message || `Berhasil memperbarui jumlah sesi terpakai menjadi ${sessionsUsed}`,
        variant: "default",
      });

      // Tutup dialog dan refresh data
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error updating session count:", error);
      setError(error instanceof Error ? error.message : "Terjadi kesalahan");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Jumlah Sesi Terpakai</DialogTitle>
          <DialogDescription>
            Ubah jumlah sesi yang sudah digunakan pada paket terapi ini.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label>Pasien</Label>
              <div className="text-sm font-medium">
                {session?.patient?.name || "Tidak diketahui"}
              </div>
            </div>
            
            <div className="space-y-1">
              <Label>Paket</Label>
              <div className="text-sm font-medium">
                {session?.package?.name || "Tidak diketahui"}
              </div>
            </div>
            
            <div className="space-y-1">
              <Label>Total Sesi</Label>
              <div className="text-sm font-medium">
                {session?.totalSessions || 0}
              </div>
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="sessionsUsed">Jumlah Sesi Terpakai</Label>
              <Input
                id="sessionsUsed"
                type="number"
                inputMode="numeric"
                min={0}
                max={session?.totalSessions || 0}
                value={sessionsUsed}
                onChange={(e) => setSessionsUsed(parseInt(e.target.value) || 0)}
                className="h-12 sm:h-10"
              />
              {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting} className="h-12 sm:h-10">
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting} className="h-12 sm:h-10">
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memproses</>
              ) : (
                "Simpan"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}