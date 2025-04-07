import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Schema untuk form catatan medis
const medicalHistoryFormSchema = z.object({
  patientId: z.number({
    required_error: "ID Pasien diperlukan",
  }),
  appointmentId: z.number().optional(),
  complaint: z.string().min(2, {
    message: "Keluhan pasien harus diisi minimal 2 karakter",
  }),
  beforeBloodPressure: z.string().optional(),
  afterBloodPressure: z.string().optional(),
  heartRate: z.string().optional(),
  pulseRate: z.string().optional(),
  weight: z.string().optional(),
  notes: z.string().optional(),
  treatmentDate: z.date({
    required_error: "Tanggal terapi diperlukan",
  }),
});

// Tipe untuk form data
type MedicalHistoryFormValues = z.infer<typeof medicalHistoryFormSchema>;

interface MedicalHistoryFormProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: number;
  appointmentId?: number;
  onSubmitSuccess?: () => void;
  // Data untuk mode edit
  editData?: {
    id: number;
    complaint: string;
    beforeBloodPressure?: string | null;
    afterBloodPressure?: string | null;
    heartRate?: string | null;
    pulseRate?: string | null;
    weight?: string | null;
    notes?: string | null;
    treatmentDate: string;
  };
}

export function MedicalHistoryForm({
  isOpen,
  onClose,
  patientId,
  appointmentId,
  onSubmitSuccess,
  editData,
}: MedicalHistoryFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = !!editData;
  
  // Default values untuk form
  const defaultValues: Partial<MedicalHistoryFormValues> = {
    patientId,
    appointmentId,
    treatmentDate: editData 
      ? new Date(editData.treatmentDate) 
      : new Date(),
    complaint: editData?.complaint || "",
    beforeBloodPressure: editData?.beforeBloodPressure || "",
    afterBloodPressure: editData?.afterBloodPressure || "",
    heartRate: editData?.heartRate || "",
    pulseRate: editData?.pulseRate || "",
    weight: editData?.weight || "",
    notes: editData?.notes || "",
  };
  
  // Setup form dengan react-hook-form dan validasi zod
  const form = useForm<MedicalHistoryFormValues>({
    resolver: zodResolver(medicalHistoryFormSchema),
    defaultValues,
  });
  
  // Fungsi submit form
  const onSubmit = async (data: MedicalHistoryFormValues) => {
    try {
      setIsSubmitting(true);
      
      // Parser untuk tekanan darah untuk membuat format yang konsisten
      if (data.beforeBloodPressure) {
        const [systolic, diastolic] = data.beforeBloodPressure.split("/").map(val => val.trim());
        if (systolic && diastolic) {
          data.beforeBloodPressure = `${systolic}/${diastolic}`;
        }
      }
      
      if (data.afterBloodPressure) {
        const [systolic, diastolic] = data.afterBloodPressure.split("/").map(val => val.trim());
        if (systolic && diastolic) {
          data.afterBloodPressure = `${systolic}/${diastolic}`;
        }
      }
      
      // Pastikan tanggal terapi valid
      console.log("Tanggal terapi original:", data.treatmentDate);
      
      // Jika tanggal terapi adalah objek Date valid, gunakan; jika tidak, gunakan tanggal saat ini
      if (!(data.treatmentDate instanceof Date) || isNaN(data.treatmentDate.getTime())) {
        console.warn("Tanggal terapi tidak valid, menggunakan tanggal saat ini");
        data.treatmentDate = new Date();
      }
      
      // Untuk memastikan data tanggal yang dikirim valid
      console.log("Tanggal terapi setelah validasi:", data.treatmentDate);
      console.log("ISO String:", data.treatmentDate.toISOString());
      
      // Persiapkan URL dan method berdasarkan mode (edit atau tambah)
      const url = isEditMode 
        ? `/api/medical-histories/${editData!.id}` 
        : "/api/medical-histories";
      const method = isEditMode ? "PUT" : "POST";
      
      // Siapkan payload untuk dikirim
      const payload = {
        ...data,
        // Pastikan treatmentDate dikirm dalam format ISO String yang benar
        treatmentDate: data.treatmentDate.toISOString()
      };
      
      console.log("Payload yang dikirim ke server:", payload);
      
      // Kirim data ke API
      const response = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Gagal menyimpan catatan medis");
      }
      
      toast({
        title: isEditMode ? "Catatan medis berhasil diperbarui" : "Catatan medis berhasil disimpan",
        description: isEditMode 
          ? "Data catatan medis pasien telah diperbarui" 
          : "Data catatan medis pasien telah ditambahkan",
      });
      
      form.reset(defaultValues);
      
      if (onSubmitSuccess) {
        onSubmitSuccess();
      }
      
      onClose();
    } catch (error) {
      console.error("Error submitting medical history:", error);
      toast({
        title: isEditMode ? "Gagal memperbarui catatan medis" : "Gagal menyimpan catatan medis",
        description: error instanceof Error ? error.message : "Terjadi kesalahan, silakan coba lagi",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md w-[95vw] md:w-auto max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-xl">{isEditMode ? "Edit Catatan Medis" : "Tambah Catatan Medis"}</DialogTitle>
          <DialogDescription className="text-sm">
            {isEditMode 
              ? "Perbarui data catatan medis pasien" 
              : "Tambahkan catatan medis baru untuk pasien"
            }
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            {/* Tanggal Terapi */}
            <FormField
              control={form.control}
              name="treatmentDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-sm font-medium mb-1">Tanggal Terapi</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "pl-3 text-left font-normal h-10 w-full",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "dd/MM/yyyy", { locale: idLocale })
                          ) : (
                            <span>Pilih tanggal</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            
            {/* Keluhan */}
            <FormField
              control={form.control}
              name="complaint"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium mb-1">Keluhan</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Masukkan keluhan pasien"
                      className="resize-none min-h-[60px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            
            {/* Grid untuk tekanan darah */}
            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              {/* Tekanan Darah (Sebelum) */}
              <FormField
                control={form.control}
                name="beforeBloodPressure"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium mb-1">Tekanan Darah (Sebelum)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Contoh: 120/80"
                        className="h-10"
                        {...field}
                        inputMode="numeric"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Sistolik/Diastolik
                    </FormDescription>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
              
              {/* Tekanan Darah (Sesudah) */}
              <FormField
                control={form.control}
                name="afterBloodPressure"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium mb-1">Tekanan Darah (Sesudah)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Contoh: 120/80"
                        className="h-10"
                        {...field}
                        inputMode="numeric"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Sistolik/Diastolik
                    </FormDescription>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Grid untuk parameter vital - 2 baris di mobile, 3 kolom di desktop */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4">
              {/* Detak Jantung */}
              <FormField
                control={form.control}
                name="heartRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium mb-1">Detak Jantung</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Masukkan detak"
                        className="h-10"
                        {...field}
                        inputMode="numeric"
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
              
              {/* Tekanan Nadi */}
              <FormField
                control={form.control}
                name="pulseRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium mb-1">Tekanan Nadi</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Masukkan nadi"
                        className="h-10"
                        {...field}
                        inputMode="numeric"
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
              
              {/* Berat Badan */}
              <FormField
                control={form.control}
                name="weight"
                render={({ field }) => (
                  <FormItem className="col-span-2 md:col-span-1">
                    <FormLabel className="text-sm font-medium mb-1">Berat Badan</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Masukkan berat"
                        className="h-10"
                        {...field}
                        inputMode="numeric"
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Catatan */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium mb-1">Catatan</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Catatan tambahan tentang terapi"
                      className="resize-none min-h-[60px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            
            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0 pt-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                className="sm:mr-2 w-full sm:w-auto h-10"
              >
                Batal
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full sm:w-auto h-10"
              >
                {isSubmitting ? "Menyimpan..." : isEditMode ? "Perbarui Catatan" : "Tambah Catatan"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}