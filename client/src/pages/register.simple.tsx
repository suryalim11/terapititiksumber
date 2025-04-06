import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// Form validation schema
const registerFormSchema = z.object({
  name: z.string().min(3, "Nama harus minimal 3 karakter"),
  phoneNumber: z.string().min(10, "Nomor telepon harus minimal 10 digit"),
  complaints: z.string().min(5, "Keluhan harus minimal 5 karakter"),
});

type RegisterFormValues = z.infer<typeof registerFormSchema>;

export default function SimpleRegisterPage() {
  // Form handling
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      name: "",
      phoneNumber: "",
      complaints: "",
    },
  });
  
  const { isSubmitting } = form.formState;
  
  // Handle form submission
  const onSubmit = async (values: RegisterFormValues) => {
    console.log("Form submitted", values);
    
    try {
      // Kirim data ke server
      const response = await fetch("/api/patients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(values),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert("Pendaftaran berhasil!");
        console.log("Pendaftaran berhasil:", data);
      } else {
        alert("Pendaftaran gagal: " + (data.message || "Terjadi kesalahan"));
        console.error("Pendaftaran gagal:", data);
      }
    } catch (error) {
      console.error("Error registering patient:", error);
      alert("Terjadi kesalahan saat menghubungi server. Silakan coba lagi nanti.");
    }
  };
  
  return (
    <div className="container mx-auto py-8 px-4 max-w-md">
      <h1 className="text-2xl font-bold text-center mb-6">Form Pendaftaran Sederhana</h1>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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

          <FormField
            control={form.control}
            name="phoneNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nomor HP</FormLabel>
                <FormControl>
                  <Input placeholder="Masukkan nomor HP" {...field} />
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
                  <Textarea placeholder="Ceritakan keluhan Anda" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button 
            type="submit" 
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Mengirim..." : "Kirim Formulir"}
          </Button>
        </form>
      </Form>
    </div>
  );
}