import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Calendar, Clock, CheckCircle } from "lucide-react";
import { format } from "date-fns";

// Form validation schema
const registerFormSchema = z.object({
  name: z.string().min(3, "Nama harus minimal 3 karakter"),
  phoneNumber: z.string().min(10, "Nomor telepon harus minimal 10 digit"),
  email: z.string().email("Format email tidak valid").nullable().optional(),
  birthDate: z.string().refine(val => {
    const date = new Date(val);
    return !isNaN(date.getTime());
  }, { message: "Format tanggal lahir tidak valid" }),
  gender: z.enum(["Laki-laki", "Perempuan"], {
    required_error: "Pilih jenis kelamin",
  }),
  address: z.string().min(5, "Alamat harus minimal 5 karakter"),
  complaints: z.string().min(5, "Keluhan harus minimal 5 karakter"),
});

type RegisterFormValues = z.infer<typeof registerFormSchema>;

export default function RegisterPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [registrationCode, setRegistrationCode] = useState<string | null>(null);
  const [registrationStatus, setRegistrationStatus] = useState<"idle" | "success" | "error" | "quota-reached" | "expired">("idle");
  const [registrationLimit, setRegistrationLimit] = useState<number | null>(null);
  const [currentRegistrations, setCurrentRegistrations] = useState<number | null>(null);
  const [expiryTime, setExpiryTime] = useState<Date | null>(null);

  // Parse the URL for registration code
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("kode");
    
    if (code) {
      setRegistrationCode(code);
      // Verify the registration code with the server
      verifyRegistrationCode(code);
    }
  }, []);

  // Function to verify the registration code
  const verifyRegistrationCode = async (code: string) => {
    try {
      const response = await apiRequest(`/api/verify-registration-link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      });
      
      if (response.valid) {
        // Code is valid
        setRegistrationStatus("idle"); // Ready for registration
        
        // Store metadata if available
        if (response.dailyLimit) {
          setRegistrationLimit(response.dailyLimit);
        }
        
        if (response.currentRegistrations !== undefined) {
          setCurrentRegistrations(response.currentRegistrations);
        }
        
        if (response.expiryTime) {
          setExpiryTime(new Date(response.expiryTime));
        }
      } else {
        // Handle various error scenarios based on the message
        if (response.message?.includes("expired")) {
          setRegistrationStatus("expired");
        } else if (response.message?.includes("limit") || response.message?.includes("reached")) {
          setRegistrationStatus("quota-reached");
          
          // Try to extract numbers from the message if available
          if (response.dailyLimit) {
            setRegistrationLimit(response.dailyLimit);
          }
          
          if (response.currentRegistrations) {
            setCurrentRegistrations(response.currentRegistrations);
          }
        } else {
          setRegistrationStatus("error");
        }
      }
    } catch (error) {
      console.error("Error verifying registration code:", error);
      setRegistrationStatus("error");
    }
  };

  // Initialize form
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      name: "",
      phoneNumber: "",
      email: "",
      birthDate: "",
      gender: "Laki-laki",
      address: "",
      complaints: "",
    },
  });

  // Handle form submission
  const onSubmit = async (values: RegisterFormValues) => {
    try {
      // Create the patient payload
      const payload = {
        ...values, 
        // Convert fields as needed to match schema
        email: values.email || null,
        // Add registration code as metadata
        registrationCode
      };

      // Submit the form data to patients endpoint
      const response = await apiRequest("/api/patients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response && response.id) {
        // Successfully created the patient
        setRegistrationStatus("success");
        
        toast({
          title: "Pendaftaran Berhasil",
          description: "Terima kasih telah mendaftar. Anda akan segera dihubungi oleh tim kami.",
        });
        
        // Notify the server about successful usage of registration code
        if (registrationCode) {
          try {
            await apiRequest("/api/registration-links/increment", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ code: registrationCode }),
            });
          } catch (error) {
            console.error("Error updating registration count:", error);
            // Non-critical error, don't show to user
          }
        }
      } else {
        toast({
          variant: "destructive",
          title: "Pendaftaran Gagal",
          description: response?.message || "Terjadi kesalahan saat mendaftar. Silakan coba lagi.",
        });
      }
    } catch (error: any) {
      console.error("Registration error:", error);
      
      // Extract error message if it's a validation error
      let errorMessage = "Terjadi kesalahan saat mendaftar. Silakan coba lagi.";
      if (error.errors && Array.isArray(error.errors)) {
        errorMessage = error.errors.map((err: any) => err.message).join(", ");
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        variant: "destructive",
        title: "Pendaftaran Gagal",
        description: errorMessage,
      });
    }
  };

  // Display status messages based on registration status
  const renderStatusMessage = () => {
    switch (registrationStatus) {
      case "success":
        return (
          <Alert className="my-4 bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle>Pendaftaran Berhasil!</AlertTitle>
            <AlertDescription>
              Terima kasih telah mendaftar di Terapi Titik Sumber. Kami akan segera menghubungi Anda untuk konfirmasi jadwal.
            </AlertDescription>
          </Alert>
        );
      case "error":
        return (
          <Alert variant="destructive" className="my-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Kode Pendaftaran Tidak Valid</AlertTitle>
            <AlertDescription>
              Kode pendaftaran yang Anda gunakan tidak valid. Silakan minta kode baru dari admin kami.
            </AlertDescription>
          </Alert>
        );
      case "quota-reached":
        return (
          <Alert variant="destructive" className="my-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Kuota Pendaftaran Telah Penuh</AlertTitle>
            <AlertDescription>
              Maaf, kuota pendaftaran untuk hari ini telah mencapai batas maksimum ({currentRegistrations}/{registrationLimit}). 
              Silakan kembali besok atau hubungi admin untuk informasi lebih lanjut.
            </AlertDescription>
          </Alert>
        );
      case "expired":
        return (
          <Alert variant="destructive" className="my-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Link Pendaftaran Telah Kedaluwarsa</AlertTitle>
            <AlertDescription>
              Maaf, link pendaftaran ini telah kedaluwarsa. Silakan minta link baru dari admin kami.
            </AlertDescription>
          </Alert>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-teal-700">Terapi Titik Sumber</h1>
          <p className="text-gray-600 mt-2">Formulir Pendaftaran Pasien Baru</p>
        </div>

        {renderStatusMessage()}

        {/* Show current quota if code is valid */}
        {registrationStatus === "idle" && registrationCode && (
          <div className="mb-6 text-center">
            <div className="inline-flex items-center bg-teal-50 rounded-full px-4 py-2 text-sm text-teal-700">
              <Calendar className="w-4 h-4 mr-2" />
              Pendaftaran tersedia: {currentRegistrations}/{registrationLimit}
            </div>
            {expiryTime && (
              <div className="inline-flex items-center bg-amber-50 rounded-full px-4 py-2 text-sm text-amber-700 ml-2">
                <Clock className="w-4 h-4 mr-2" />
                Berlaku hingga: {format(expiryTime, "dd/MM/yyyy HH:mm")}
              </div>
            )}
          </div>
        )}

        {/* Only show the form if the code is valid and quota not reached */}
        {registrationStatus === "idle" && registrationCode && (
          <Card className="shadow-lg border-teal-100">
            <CardHeader className="bg-teal-50 border-b border-teal-100">
              <CardTitle className="text-teal-800">Form Pendaftaran</CardTitle>
              <CardDescription>
                Silakan isi data diri Anda dengan lengkap dan benar
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nama Lengkap</FormLabel>
                        <FormControl>
                          <Input placeholder="Masukkan nama lengkap Anda" {...field} />
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
                          <FormLabel>Nomor HP</FormLabel>
                          <FormControl>
                            <Input placeholder="Contoh: 08123456789" {...field} />
                          </FormControl>
                          <FormDescription>
                            Nomor WhatsApp aktif
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email (Opsional)</FormLabel>
                          <FormControl>
                            <Input placeholder="email@contoh.com" {...field} />
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
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="flex flex-col space-y-1"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Laki-laki" id="male" />
                                <FormLabel htmlFor="male" className="font-normal">
                                  Laki-laki
                                </FormLabel>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Perempuan" id="female" />
                                <FormLabel htmlFor="female" className="font-normal">
                                  Perempuan
                                </FormLabel>
                              </div>
                            </RadioGroup>
                          </FormControl>
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
                        <FormLabel>Alamat</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Masukkan alamat lengkap Anda"
                            {...field}
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
                            placeholder="Ceritakan keluhan yang Anda alami"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />



                  <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700">
                    Daftar Sekarang
                  </Button>
                </form>
              </Form>
            </CardContent>
            <CardFooter className="bg-gray-50 border-t border-gray-100 flex flex-col items-start">
              <p className="text-sm text-gray-600 mt-2">
                Dengan mengisi formulir ini, Anda menyetujui untuk dihubungi oleh tim Terapi Titik Sumber.
              </p>
            </CardFooter>
          </Card>
        )}

        {/* Display message for direct access without code */}
        {!registrationCode && registrationStatus === "idle" && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Kode Pendaftaran Diperlukan</CardTitle>
              <CardDescription>
                Untuk melakukan pendaftaran, Anda memerlukan kode khusus dari admin Terapi Titik Sumber.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Silakan hubungi admin kami untuk mendapatkan link pendaftaran dengan kode unik.
              </p>
              <Button 
                variant="outline"
                onClick={() => window.location.href = "https://wa.me/6281234567890?text=Saya%20ingin%20mendaftar%20Terapi%20Titik%20Sumber"}
                className="w-full"
              >
                Hubungi Admin via WhatsApp
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Show success state after registration */}
        {registrationStatus === "success" && (
          <Card className="shadow-lg bg-teal-50 border-teal-200">
            <CardHeader>
              <CardTitle className="text-teal-800 flex items-center">
                <CheckCircle className="mr-2 h-5 w-5" /> Pendaftaran Berhasil!
              </CardTitle>
              <CardDescription>
                Terima kasih telah mendaftar di Terapi Titik Sumber
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-gray-700">
                Tim kami akan segera menghubungi Anda melalui WhatsApp untuk konfirmasi jadwal terapi.
              </p>
              <Button 
                onClick={() => window.location.href = "/"}
                className="w-full bg-teal-600 hover:bg-teal-700"
              >
                Kembali ke Beranda
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}