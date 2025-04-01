import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { insertPatientSchema } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DialogClose } from "@/components/ui/dialog";
import { useEffect } from "react";

// Extend the patient schema with form validations
const patientFormSchema = insertPatientSchema.extend({
  name: z.string().min(3, {
    message: "Nama harus minimal 3 karakter",
  }),
  phoneNumber: z.string().min(10, {
    message: "Nomor telepon tidak valid",
  }),
  birthDate: z.string().refine((date) => {
    try {
      return !isNaN(new Date(date).getTime());
    } catch {
      return false;
    }
  }, {
    message: "Format tanggal lahir tidak valid",
  }),
  gender: z.enum(["Laki-laki", "Perempuan"]),
  email: z.string().email({
    message: "Email tidak valid",
  }).optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  medicalHistory: z.string().optional().or(z.literal("")),
});

type PatientFormValues = z.infer<typeof patientFormSchema>;

interface PatientFormProps {
  onSuccess?: () => void;
  defaultValues?: Partial<PatientFormValues>;
  isEditing?: boolean;
  patientId?: number;
}

export function PatientForm({ 
  onSuccess, 
  defaultValues, 
  isEditing = false,
  patientId
}: PatientFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: defaultValues || {
      name: "",
      phoneNumber: "",
      birthDate: "",
      gender: "Laki-laki",
      email: "",
      address: "",
      medicalHistory: "",
    },
  });

  useEffect(() => {
    if (defaultValues) {
      Object.entries(defaultValues).forEach(([key, value]) => {
        form.setValue(key as any, value as any);
      });
    }
  }, [defaultValues, form]);

  async function onSubmit(values: PatientFormValues) {
    try {
      console.log("Form submission started with values:", values);
      console.log("Form state:", form.formState);
      
      // Cek validasi form
      const isValid = await form.trigger();
      console.log("Form validation result:", isValid);
      
      if (!isValid) {
        console.log("Form validation errors:", form.formState.errors);
        return;
      }
      
      if (isEditing && patientId) {
        console.log("Editing existing patient with ID:", patientId);
        const response = await apiRequest(`/api/patients/${patientId}`, {
          method: "PUT",
          body: JSON.stringify(values),
        });
        console.log("Update response:", response);
        
        toast({
          title: "Pasien diperbarui",
          description: "Data pasien berhasil diperbarui",
        });
      } else {
        console.log("Creating new patient");
        const response = await apiRequest("/api/patients", {
          method: "POST",
          body: JSON.stringify(values),
        });
        console.log("Create response:", response);
        
        toast({
          title: "Pasien baru ditambahkan",
          description: "Pasien berhasil didaftarkan",
        });
      }
      
      // Invalidate patients query to refetch the data
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      
      // Reset form
      form.reset();
      
      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error saving patient:", error);
      toast({
        title: "Gagal menyimpan data",
        description: "Terjadi kesalahan, silakan coba lagi",
        variant: "destructive",
      });
    }
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Manual form submission triggered");
    try {
      // Trigger validation
      const isValid = await form.trigger();
      if (!isValid) {
        console.log("Form validation failed", form.formState.errors);
        return;
      }
      
      // Get current form values
      const values = form.getValues();
      console.log("Form values:", values);
      
      // Directly call the onSubmit handler
      await onSubmit(values);
    } catch (error) {
      console.error("Error in manual form submission:", error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={(e) => {
        e.preventDefault();
        handleFormSubmit(e);
      }} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nama Lengkap</FormLabel>
              <FormControl>
                <Input placeholder="Masukkan nama lengkap" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="phoneNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nomor Telepon</FormLabel>
                <FormControl>
                  <Input placeholder="08xxxxxxxxxx" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email (opsional)</FormLabel>
                <FormControl>
                  <Input placeholder="email@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="birthDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tanggal Lahir</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="gender"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Jenis Kelamin</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih jenis kelamin" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Laki-laki">Laki-laki</SelectItem>
                    <SelectItem value="Perempuan">Perempuan</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Alamat (opsional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Masukkan alamat" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="medicalHistory"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Riwayat Medis (opsional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Riwayat penyakit, alergi, dll." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={(e) => {
            e.preventDefault();
            if (onSuccess) onSuccess(); // Close dialog by calling onSuccess 
          }}>
            Batal
          </Button>
          <Button 
            type="button" 
            disabled={form.formState.isSubmitting}
            onClick={(e) => {
              e.preventDefault();
              console.log("Submit button clicked directly");
              handleFormSubmit(e);
            }}
          >
            {form.formState.isSubmitting ? "Menyimpan..." : isEditing ? "Perbarui" : "Simpan"}
          </Button>
        </div>
      </form>
    </Form>
  );
}