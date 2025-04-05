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
      
      // Persiapkan URL dan method berdasarkan mode (edit atau tambah)
      const url = isEditMode 
        ? `/api/medical-histories/${editData!.id}` 
        : "/api/medical-histories";
      const method = isEditMode ? "PUT" : "POST";
      
      // Kirim data ke API
      const response = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
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
      <DialogContent className="max-w-md w-[95vw] md:w-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Catatan Medis" : "Tambah Catatan Medis"}</DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? "Perbarui data catatan medis pasien" 
              : "Tambahkan catatan medis baru untuk pasien"
            }
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Tanggal Terapi */}
            <FormField
              control={form.control}
              name="treatmentDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Tanggal Terapi</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "pl-3 text-left font-normal",
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
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Keluhan */}
            <FormField
              control={form.control}
              name="complaint"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Keluhan</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Masukkan keluhan pasien"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Grid untuk tekanan darah */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tekanan Darah (Sebelum) */}
              <FormField
                control={form.control}
                name="beforeBloodPressure"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tekanan Darah (Sebelum)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Contoh: 120/80"
                        {...field}
                        inputMode="numeric"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Format: Sistolik/Diastolik
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Tekanan Darah (Sesudah) */}
              <FormField
                control={form.control}
                name="afterBloodPressure"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tekanan Darah (Sesudah)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Contoh: 120/80"
                        {...field}
                        inputMode="numeric"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Format: Sistolik/Diastolik
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Grid untuk parameter vital */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Detak Jantung */}
              <FormField
                control={form.control}
                name="heartRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Detak Jantung</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Masukkan detak"
                        {...field}
                        inputMode="numeric"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Tekanan Nadi */}
              <FormField
                control={form.control}
                name="pulseRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tekanan Nadi</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Masukkan nadi"
                        {...field}
                        inputMode="numeric"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Berat Badan */}
              <FormField
                control={form.control}
                name="weight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Berat Badan</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Masukkan berat"
                        {...field}
                        inputMode="numeric"
                      />
                    </FormControl>
                    <FormMessage />
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
                  <FormLabel>Catatan</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Catatan tambahan tentang terapi"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                className="sm:mr-2 w-full sm:w-auto"
              >
                Batal
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full sm:w-auto"
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