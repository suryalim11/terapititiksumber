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
export const INVOICE_SETTINGS_KEY = "invoice_settings";

// Schema validasi untuk form pengaturan invoice
const invoiceSettingsSchema = z.object({
  companyName: z.string().min(1, "Nama perusahaan harus diisi"),
  companyTagline: z.string().optional(),
  companyAddress: z.string().optional(),
  companyPhone: z.string().optional(),
  companyEmail: z.string().email("Email harus valid").optional().or(z.literal("")),
  companyWebsite: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankAccountName: z.string().optional(),
  invoiceFooterNote: z.string().optional(),
  invoicePrefix: z.string().optional(),
  invoiceThankYouMessage: z.string().optional(),
  
  // Pengaturan template WhatsApp
  whatsappTemplate: z.string().optional(),
  whatsappGreeting: z.string().optional(),
  whatsappSignature: z.string().optional(),
  includeDetailedItems: z.boolean().optional(),
  includeAppointmentReminder: z.boolean().optional(),
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
  bankName: "",
  bankAccountNumber: "",
  bankAccountName: "",
  invoiceFooterNote: "Terima kasih atas kepercayaan Anda. Paket terapi yang telah dibeli dapat digunakan sesuai jadwal yang telah disepakati.",
  invoicePrefix: "",
  invoiceThankYouMessage: "Terima kasih telah mengunjungi Klinik Terapi Titik Sumber.",
  
  // Pengaturan WhatsApp default
  whatsappTemplate: "Terima kasih telah mengunjungi *{{companyName}}*.\n\nBerikut adalah detail invoice Anda:\nNo. Invoice: *{{invoiceId}}*\nTotal: *{{totalAmount}}*\n\n{{bankInfo}}\n\n{{items}}\n\nSemoga sehat selalu!",
  whatsappGreeting: "Yth. {{patientName}},",
  whatsappSignature: "Salam,\nTim {{companyName}}",
  includeDetailedItems: true,
  includeAppointmentReminder: true,
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

              <div className="pt-4 pb-2">
                <h3 className="text-md font-semibold mb-2">Informasi Rekening Bank</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  Informasi rekening bank untuk pembayaran (opsional)
                </p>
                
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="bankName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nama Bank</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Contoh: BCA, Mandiri, BRI" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="bankAccountNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nomor Rekening</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Contoh: 1234567890" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="bankAccountName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Atas Nama</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Nama pemilik rekening" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
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
            
            <div className="pt-6 pb-2 space-y-4">
              <h3 className="text-md font-semibold">Pengaturan WhatsApp</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                Kustomisasi pesan WhatsApp untuk pengiriman invoice
              </p>
              
              <FormField
                control={form.control}
                name="whatsappGreeting"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Salam Pembuka</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Yth. [Nama Pasien]," 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="whatsappTemplate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template Pesan WhatsApp</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        className="min-h-[120px]"
                        placeholder="Template pesan WhatsApp dengan variabel yang didukung sistem"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-1">
                      Gunakan variabel: &#123;&#123;companyName&#125;&#125;, &#123;&#123;invoiceId&#125;&#125;, &#123;&#123;totalAmount&#125;&#125;, &#123;&#123;bankInfo&#125;&#125;, &#123;&#123;items&#125;&#125;, &#123;&#123;patientName&#125;&#125;
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="whatsappSignature"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tanda Tangan Pesan</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Salam, Tim Klinik" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <FormField
                  control={form.control}
                  name="includeDetailedItems"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Detail Item</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Sertakan daftar item transaksi
                        </p>
                      </div>
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value === true}
                          onChange={(e) => field.onChange(e.target.checked)}
                          className="form-checkbox h-5 w-5 text-primary border-gray-300 rounded focus:ring-primary"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="includeAppointmentReminder"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Reminder Jadwal</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Sertakan pengingat jadwal terapi
                        </p>
                      </div>
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value === true}
                          onChange={(e) => field.onChange(e.target.checked)}
                          className="form-checkbox h-5 w-5 text-primary border-gray-300 rounded focus:ring-primary"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900 rounded-md">
                <h4 className="text-sm font-medium mb-2">Contoh Format Pesan</h4>
                <div className="text-xs bg-white dark:bg-slate-800 p-3 rounded border">
                  <p>Yth. [Nama Pasien],</p>
                  <p className="mt-2">Terima kasih telah mengunjungi <strong>Klinik Terapi Titik Sumber</strong>.</p>
                  <p className="mt-2">Berikut adalah detail invoice Anda:<br />
                  No. Invoice: <strong>TTS-1234</strong><br />
                  Total: <strong>Rp500.000</strong></p>
                  <div className="mt-2">
                    <p>Informasi Pembayaran:</p>
                    <p>Bank: BCA<br />
                    No. Rekening: 1234567890<br />
                    Atas Nama: Klinik TTS</p>
                  </div>
                  <div className="mt-2">
                    <p>Detail Item:</p>
                    <p>1 x Paket 5 Sesi - Rp500.000</p>
                  </div>
                  <p className="mt-2">Semoga sehat selalu!</p>
                  <p className="mt-2">Salam,<br />Tim Klinik Terapi Titik Sumber</p>
                </div>
              </div>
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