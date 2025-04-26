import { INVOICE_SETTINGS_KEY, defaultInvoiceSettings } from "./invoice-settings";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function ResetInvoiceSettings() {
  const { toast } = useToast();

  const handleResetSettings = () => {
    try {
      // Hapus pengaturan dari local storage
      localStorage.removeItem(INVOICE_SETTINGS_KEY);
      
      // Kemudian terapkan pengaturan default
      localStorage.setItem(INVOICE_SETTINGS_KEY, JSON.stringify(defaultInvoiceSettings));
      
      toast({
        title: "Pengaturan Direset",
        description: "Pengaturan invoice telah dikembalikan ke default yang baru",
      });
      
      // Reload halaman untuk menerapkan perubahan
      window.location.reload();
    } catch (error) {
      console.error("Gagal mereset pengaturan invoice:", error);
      toast({
        title: "Gagal Mereset Pengaturan",
        description: "Pengaturan invoice tidak dapat direset",
        variant: "destructive",
      });
    }
  };

  return (
    <Button 
      onClick={handleResetSettings} 
      variant="outline" 
      className="mt-4 mb-2 w-full"
    >
      Reset ke Template Terbaru
    </Button>
  );
}