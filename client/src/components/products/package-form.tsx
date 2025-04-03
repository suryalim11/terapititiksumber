import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatRupiah } from "@/lib/utils";

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
import { DialogClose } from "@/components/ui/dialog";
import { useEffect } from "react";

// Extend the package schema with form validations
const packageFormSchema = z.object({
  name: z.string().min(3, {
    message: "Nama paket harus minimal 3 karakter",
  }),
  price: z.string().min(1, {
    message: "Harga harus diisi",
  }),
  // Pastikan sesi selalu dikonversi ke number, bahkan jika input berupa string
  sessions: z.preprocess(
    (val) => (typeof val === 'string' ? parseInt(val, 10) : val),
    z.number().min(1, { message: "Jumlah sesi harus minimal 1" })
  ),
  description: z.string().nullable().optional(),
});

export type PackageFormValues = z.infer<typeof packageFormSchema>;

type PackageFormProps = {
  initialValues?: PackageFormValues;
  onSuccess?: () => void;
  mode: "create" | "edit";
  id?: number;
  onCancel?: () => void;
};

export function PackageForm({
  initialValues,
  onSuccess,
  mode,
  id,
  onCancel,
}: PackageFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 1. Define the form.
  const form = useForm<PackageFormValues>({
    resolver: zodResolver(packageFormSchema),
    defaultValues: initialValues || {
      name: "",
      price: "",
      sessions: 1,
      description: "",
    },
  });

  // Update form values when initialValues change
  useEffect(() => {
    if (initialValues) {
      form.reset(initialValues);
    }
  }, [initialValues, form]);

  // 2. Define a submit handler.
  async function onSubmit(values: PackageFormValues) {
    try {
      // Ensure we're sending a properly formatted object to the server
      const sanitizedData = {
        name: values.name.trim(),
        // Dengan zod preprocessor, sessions seharusnya sudah berupa angka
        sessions: Number(values.sessions), // Pastikan bertipe number
        // Format price - kirim sebagai string untuk menghindari masalah presisi
        price: values.price.replace(/\D/g, ""),
        description: values.description?.trim() || null
      };
      
      console.log("Data paket yang disiapkan:", sanitizedData);
      
      if (mode === "create") {
        // Create new package
        const response = await apiRequest("/api/packages", {
          method: "POST",
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(sanitizedData)
        });
        
        console.log("Server response:", response);
        
        toast({
          title: "Paket berhasil dibuat",
          description: `${values.name} telah berhasil ditambahkan ke daftar paket`,
        });
      } else if (mode === "edit" && id) {
        // Update existing package
        const response = await apiRequest(`/api/packages/${id}`, {
          method: "PUT",
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(sanitizedData)
        });
        
        console.log("Server response:", response);
        toast({
          title: "Paket berhasil diperbarui",
          description: `${values.name} telah berhasil diperbarui`,
        });
      }

      // Invalidate packages query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });

      // Reset the form
      form.reset();

      // Call onSuccess callback
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error("Error saving package:", error);
      
      let errorMessage = "Terjadi kesalahan saat menyimpan paket. Silakan coba lagi.";
      
      // Cek apakah error memiliki response data
      if (error.response && error.response.data && error.response.data.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        // Gunakan error.message jika ada
        errorMessage = error.message;
      }
      
      toast({
        title: "Gagal menyimpan paket",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }

  // Helper for price formatting as the user types
  const formatPrice = (value: string) => {
    // Remove all non-numeric characters
    const numericValue = value.replace(/\D/g, "");
    // Format as rupiah
    if (numericValue) {
      return formatRupiah(parseInt(numericValue));
    }
    return "";
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nama Paket</FormLabel>
              <FormControl>
                <Input
                  placeholder="Masukkan nama paket"
                  {...field}
                  autoComplete="off"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="sessions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Jumlah Sesi</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="Masukkan jumlah sesi"
                  {...field}
                  min={1}
                  autoComplete="off"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Harga</FormLabel>
              <FormControl>
                <Input
                  placeholder="Masukkan harga"
                  value={field.value ? formatRupiah(parseInt(field.value.replace(/\D/g, "") || "0")) : ""}
                  onChange={(e) => {
                    // Ketika nilai berubah, simpan nilai numerik saja
                    const numericValue = e.target.value.replace(/\D/g, "");
                    field.onChange(numericValue);
                  }}
                  autoComplete="off"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Deskripsi</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Masukkan deskripsi paket"
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                  value={field.value || ''}
                  autoComplete="off"
                  className="resize-none"
                  rows={3}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2 pt-4">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
            >
              Batal
            </Button>
          )}
          {/* If in a Dialog, use DialogClose, otherwise use normal Button */}
          <Button type="submit">
            {mode === "create" ? "Simpan Paket" : "Perbarui Paket"}
          </Button>
        </div>
      </form>
    </Form>
  );
}