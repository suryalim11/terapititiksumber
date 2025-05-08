import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

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
  onSuccess,
}: SessionEditorDialogProps) {
  const { toast } = useToast();
  const [newUsageCount, setNewUsageCount] = useState<number>(session.sessionsUsed);

  // Mutation untuk memperbaiki jumlah sesi
  const fixSessionMutation = useMutation({
    mutationFn: async (data: { sessionId: number; newUsageCount: number }) => {
      return await apiRequest<any>("/api/sessions/fix-usage-count", {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json",
        },
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Perubahan berhasil",
        description: data.message || "Jumlah sesi berhasil diperbarui",
      });
      // Invalidate queries yang relevan
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/active-packages"] });
      onSuccess();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Gagal memperbaiki sesi",
        description: error instanceof Error ? error.message : "Terjadi kesalahan saat memperbaiki jumlah sesi",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validasi
    if (newUsageCount < 0) {
      toast({
        title: "Nilai tidak valid",
        description: "Jumlah sesi tidak boleh kurang dari 0",
        variant: "destructive",
      });
      return;
    }

    if (newUsageCount > session.totalSessions) {
      toast({
        title: "Nilai tidak valid",
        description: `Jumlah sesi tidak boleh lebih dari total sesi (${session.totalSessions})`,
        variant: "destructive",
      });
      return;
    }

    // Panggil mutasi
    fixSessionMutation.mutate({
      sessionId: session.id,
      newUsageCount: newUsageCount,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Jumlah Sesi Terpakai</DialogTitle>
          <DialogDescription>
            {session.patient?.name ? `Pasien: ${session.patient.name}` : ""}
            {session.package?.name ? ` - Paket: ${session.package.name}` : ""}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="total-sessions">Total Sesi</Label>
              <Input
                id="total-sessions"
                value={session.totalSessions}
                disabled
                className="bg-muted"
              />
            </div>
            <div>
              <Label htmlFor="used-sessions">Sesi Terpakai</Label>
              <Input
                id="used-sessions"
                type="number"
                min={0}
                max={session.totalSessions}
                value={newUsageCount}
                onChange={(e) => setNewUsageCount(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>
          
          <DialogFooter className="flex justify-between sm:justify-between mt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button 
              type="submit" 
              disabled={fixSessionMutation.isPending}
              className="flex items-center gap-2"
            >
              {fixSessionMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Perbarui Sesi
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}