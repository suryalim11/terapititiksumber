import { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

// Local storage key untuk menyimpan pengaturan invoice
const INVOICE_SETTINGS_KEY = "invoice_settings";

// Schema validasi untuk form pengaturan invoice
const invoiceSettingsSchema = z.object({
  companyName: z.string().min(1, "Nama perusahaan harus diisi"),
  companyTagline: z.string().optional(),
  companyAddress: z.string().optional(),
  companyPhone: z.string().optional(),
  companyEmail: z.string().email("Email harus valid").optional().or(z.literal("")),
  companyWebsite: z.string().optional(),
  invoiceFooterNote: z.string().optional(),
  invoicePrefix: z.string().optional(),
  invoiceThankYouMessage: z.string().optional(),
});

export type InvoiceSettings = z.infer<typeof invoiceSettingsSchema>;

// Pengaturan default
export const defaultInvoiceSettings: InvoiceSettings = {
  companyName: "Terapinya Terapi Titik Sumber",
  companyTagline: "Klinik Terapi Holistik",
  companyAddress: "",
  companyPhone: "",
  companyEmail: "",
  companyWebsite: "",
  invoiceFooterNote: "Terima kasih atas kepercayaan Anda. Paket terapi yang telah dibeli dapat digunakan sesuai jadwal yang telah disepakati.",
  invoicePrefix: "",
  invoiceThankYouMessage: "Terima kasih telah mengunjungi Klinik Terapi Titik Sumber.",
};

export function InvoiceSettings() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Buat form dengan default pengaturan
  const form = useForm<InvoiceSettings>({
    resolver: zodResolver(invoiceSettingsSchema),
    defaultValues: defaultInvoiceSettings,
  });

  // Load pengaturan dari local storage ketika komponen dimuat
  useEffect(() => {
    const loadSettings = () => {
      try {
        const savedSettings = localStorage.getItem(INVOICE_SETTINGS_KEY);
        if (savedSettings) {
          const parsedSettings = JSON.parse(savedSettings);
          // Terapkan pengaturan ke form
          Object.entries(parsedSettings).forEach(([key, value]) => {
            form.setValue(key as keyof InvoiceSettings, value as any);
          });
        }
      } catch (error) {
        console.error("Gagal memuat pengaturan invoice:", error);
        toast({
          title: "Gagal memuat pengaturan",
          description: "Pengaturan invoice tidak dapat dimuat dari penyimpanan lokal",
          variant: "destructive",
        });
      }
    };

    loadSettings();
  }, [form, toast]);

  // Handle form submission
  const onSubmit = async (data: InvoiceSettings) => {
    setIsLoading(true);
    try {
      // Simpan pengaturan ke local storage
      localStorage.setItem(INVOICE_SETTINGS_KEY, JSON.stringify(data));
      
      toast({
        title: "Pengaturan disimpan",
        description: "Pengaturan invoice berhasil disimpan",
      });
    } catch (error) {
      console.error("Gagal menyimpan pengaturan invoice:", error);
      toast({
        title: "Gagal menyimpan pengaturan",
        description: "Pengaturan invoice tidak dapat disimpan",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle reset to defaults
  const handleResetDefaults = () => {
    try {
      // Reset form ke pengaturan default
      Object.entries(defaultInvoiceSettings).forEach(([key, value]) => {
        form.setValue(key as keyof InvoiceSettings, value as any);
      });
      
      // Hapus pengaturan dari local storage
      localStorage.removeItem(INVOICE_SETTINGS_KEY);
      
      toast({
        title: "Pengaturan direset",
        description: "Pengaturan invoice dikembalikan ke default",
      });
    } catch (error) {
      console.error("Gagal mereset pengaturan invoice:", error);
      toast({
        title: "Gagal mereset pengaturan",
        description: "Pengaturan invoice tidak dapat direset",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pengaturan Invoice</CardTitle>
        <CardDescription>
          Kustomisasi template dan detail invoice untuk transaksi
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-4">
              <h3 className="text-md font-semibold">Informasi Perusahaan</h3>
              
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Perusahaan</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Nama Klinik" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="companyTagline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tagline Perusahaan</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Klinik Terapi Holistik" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="companyPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nomor Telepon</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="0812XXXXXXXX" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="companyEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="info@example.com" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="companyAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alamat</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Jl. Contoh No. 123, Jakarta" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="companyWebsite"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="www.example.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="pt-4 space-y-4">
              <h3 className="text-md font-semibold">Pengaturan Invoice</h3>
              
              <FormField
                control={form.control}
                name="invoicePrefix"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prefix Invoice (Opsional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="TTS-" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="invoiceFooterNote"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Catatan Footer Invoice</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Catatan tambahan di bagian bawah invoice" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="invoiceThankYouMessage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pesan Terima Kasih</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Terima kasih telah mengunjungi klinik kami" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="flex justify-between pt-6">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleResetDefaults}
              >
                Reset ke Default
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Menyimpan..." : "Simpan Pengaturan"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}