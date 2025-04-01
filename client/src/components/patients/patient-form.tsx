import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format, differenceInYears } from "date-fns";
import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type PatientFormProps = {
  isOpen: boolean;
  onClose: () => void;
};

// Extended form schema with additional validation rules
const patientFormSchema = z.object({
  name: z.string().min(3, "Nama harus minimal 3 karakter"),
  birthDate: z.string().refine(val => {
    return !isNaN(Date.parse(val));
  }, {
    message: "Format tanggal lahir tidak valid",
  }),
  address: z.string().min(5, "Alamat harus minimal 5 karakter"),
  complaints: z.string().min(5, "Keluhan harus minimal 5 karakter"),
});

type PatientFormValues = z.infer<typeof patientFormSchema>;

export default function PatientForm({ isOpen, onClose }: PatientFormProps) {
  const [age, setAge] = useState<number | null>(null);
  const { toast } = useToast();

  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: {
      name: "",
      birthDate: format(new Date(), "yyyy-MM-dd"),
      address: "",
      complaints: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: PatientFormValues) => {
      return apiRequest("POST", "/api/patients", values);
    },
    onSuccess: async () => {
      // Invalidate patients query to refetch the data
      await queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      
      toast({
        title: "Pasien berhasil ditambahkan",
        description: "Data pasien baru telah disimpan dengan sukses",
      });
      
      onClose();
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Gagal menambahkan pasien",
        description: error.message || "Terjadi kesalahan saat menyimpan data pasien",
        variant: "destructive",
      });
    }
  });

  // Calculate age when birthDate changes
  useEffect(() => {
    const birthDate = form.watch("birthDate");
    if (birthDate) {
      try {
        const birthDateObj = new Date(birthDate);
        const ageYears = differenceInYears(new Date(), birthDateObj);
        setAge(ageYears);
      } catch (e) {
        setAge(null);
      }
    }
  }, [form.watch("birthDate")]);

  const onSubmit = (values: PatientFormValues) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold font-heading">Pendaftaran Pasien Baru</DialogTitle>
          <DialogDescription>
            Masukkan data lengkap untuk mendaftarkan pasien baru
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Lengkap</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Masukkan nama lengkap" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="birthDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tanggal Lahir</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  {age !== null && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Umur: {age} tahun
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alamat</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder="Masukkan alamat lengkap" 
                      rows={2} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="complaints"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Keluhan</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder="Deskripsikan keluhan yang dialami" 
                      rows={3} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                disabled={mutation.isPending}
              >
                Batal
              </Button>
              <Button 
                type="submit" 
                disabled={mutation.isPending}
              >
                {mutation.isPending ? "Menyimpan..." : "Daftar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
