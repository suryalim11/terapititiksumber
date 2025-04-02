import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { insertPackageSchema } from "@shared/schema";
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
const packageFormSchema = insertPackageSchema.extend({
  name: z.string().min(3, {
    message: "Nama paket harus minimal 3 karakter",
  }),
  price: z.string().min(1, {
    message: "Harga harus diisi",
  }),
  sessions: z.coerce.number().min(1, {
    message: "Jumlah sesi harus minimal 1",
  }),
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
      if (mode === "create") {
        // Create new package
        await apiRequest("/api/packages", {
          method: "POST",
          body: JSON.stringify(values)
        });
        toast({
          title: "Paket berhasil dibuat",
          description: `${values.name} telah berhasil ditambahkan ke daftar paket`,
        });
      } else if (mode === "edit" && id) {
        // Update existing package
        await apiRequest(`/api/packages/${id}`, {
          method: "PUT",
          body: JSON.stringify(values)
        });
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
    } catch (error) {
      console.error("Error saving package:", error);
      toast({
        title: "Gagal menyimpan paket",
        description: "Terjadi kesalahan saat menyimpan paket. Silakan coba lagi.",
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
                  {...field}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={(e) => {
                    // Format when leaving field
                    const numericValue = e.target.value.replace(/\D/g, "");
                    if (numericValue) {
                      field.onChange(numericValue);
                    }
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
          {onSuccess ? (
            <Button type="submit">
              {mode === "create" ? "Simpan Paket" : "Perbarui Paket"}
            </Button>
          ) : (
            <DialogClose asChild>
              <Button type="submit">
                {mode === "create" ? "Simpan Paket" : "Perbarui Paket"}
              </Button>
            </DialogClose>
          )}
        </div>
      </form>
    </Form>
  );
}