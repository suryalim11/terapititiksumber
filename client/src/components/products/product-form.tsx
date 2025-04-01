import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { insertProductSchema } from "@shared/schema";
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

// Extend the product schema with form validations
const productFormSchema = insertProductSchema.extend({
  name: z.string().min(3, {
    message: "Nama produk harus minimal 3 karakter",
  }),
  price: z.string().min(1, {
    message: "Harga harus diisi",
  }),
  stock: z.coerce.number().min(0, {
    message: "Stok tidak boleh negatif",
  }),
  description: z.string().optional().or(z.literal("")).nullable(),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

interface ProductFormProps {
  onSuccess?: () => void;
  defaultValues?: Partial<ProductFormValues>;
  isEditing?: boolean;
  productId?: number;
}

export function ProductForm({ 
  onSuccess, 
  defaultValues, 
  isEditing = false,
  productId
}: ProductFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: defaultValues || {
      name: "",
      price: "",
      stock: 0,
      description: "",
    },
  });

  useEffect(() => {
    if (defaultValues) {
      // Log untuk debugging
      console.log("Setting default values:", defaultValues);
      
      // Atur nilai form berdasarkan prop defaultValues
      Object.entries(defaultValues).forEach(([key, value]) => {
        form.setValue(key as any, value as any);
      });
    }
  }, [defaultValues, form]);

  // Format price as Rupiah when input changes
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove all non-digit characters
    const rawValue = e.target.value.replace(/\D/g, "");
    // Format the value as rupiah without the currency symbol
    const formattedValue = rawValue ? formatRupiah(rawValue).replace("Rp ", "") : "";
    form.setValue("price", formattedValue);
  };

  async function onSubmit(values: ProductFormValues) {
    try {
      // Log seluruh nilai form untuk debugging
      console.log("Form values pada submit:", values);
      
      // Pastikan semua field yang diperlukan ada
      if (!values.name || !values.price) {
        console.error("Missing required fields:", { name: values.name, price: values.price });
        toast({
          title: "Data tidak lengkap",
          description: "Nama produk dan harga harus diisi",
          variant: "destructive",
        });
        return;
      }
      
      // Clean up price value to only contain digits
      const cleanPrice = values.price.replace(/\D/g, "");
      
      // Siapkan data produk dengan memastikan semua field wajib terisi
      const productData = {
        name: values.name,
        price: cleanPrice,
        stock: typeof values.stock === 'number' ? values.stock : 0,
        description: values.description || null
      };
      
      console.log("Data produk yang akan dikirim:", productData);

      if (isEditing && productId) {
        const response = await apiRequest(`/api/products/${productId}`, {
          method: "PUT",
          body: JSON.stringify(productData),
        });
        
        console.log("Respons update produk:", response);
        
        toast({
          title: "Produk diperbarui",
          description: "Data produk berhasil diperbarui",
        });
      } else {
        const response = await apiRequest("/api/products", {
          method: "POST",
          body: JSON.stringify(productData),
        });
        
        console.log("Respons produk baru:", response);
        
        toast({
          title: "Produk baru ditambahkan",
          description: "Produk berhasil ditambahkan ke inventaris",
        });
      }
      
      // Invalidate products query to refetch the data
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      
      // Reset form
      form.reset();
      
      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error saving product:", error);
      toast({
        title: "Gagal menyimpan data",
        description: "Terjadi kesalahan, silakan coba lagi",
        variant: "destructive",
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nama Produk</FormLabel>
              <FormControl>
                <Input placeholder="Masukkan nama produk" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    onChange={handlePriceChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="stock"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stok</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="Jumlah stok" 
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Deskripsi (opsional)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Masukkan deskripsi produk" 
                  className="resize-none" 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Batal
            </Button>
          </DialogClose>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Menyimpan..." : isEditing ? "Perbarui" : "Simpan"}
          </Button>
        </div>
      </form>
    </Form>
  );
}