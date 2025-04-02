import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { formatDateDDMMYYYY } from "@/lib/utils";

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
import { 
  AlertCircle, 
  Calendar, 
  Clock, 
  CheckCircle, 
  Search, 
  Users 
} from "lucide-react";

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
  therapySlotId: z.number({
    required_error: "Pilih sesi terapi",
    invalid_type_error: "Pilih sesi terapi",
  }).optional(),
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
  
  // State untuk pencarian pasien
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [patientFound, setPatientFound] = useState<boolean>(false);
  const [foundPatient, setFoundPatient] = useState<any>(null);
  
  // Mendapatkan data slot terapi yang tersedia
  const { data: therapySlots, isLoading: isLoadingSlots } = useQuery({
    queryKey: ['/api/therapy-slots', { available: true, active: true }],
    queryFn: async () => {
      const response = await fetch('/api/therapy-slots?available=true&active=true');
      if (!response.ok) {
        throw new Error('Gagal mengambil data slot terapi');
      }
      return response.json();
    },
    enabled: registrationStatus === "idle" && !!registrationCode
  });

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

  // Fungsi untuk mencari pasien berdasarkan nama atau nomor HP
  const searchPatient = async () => {
    if (!searchQuery.trim()) {
      toast({
        variant: "destructive",
        title: "Input diperlukan",
        description: "Silakan masukkan nama atau nomor telepon untuk pencarian",
      });
      return;
    }

    setIsSearching(true);
    try {
      const response = await apiRequest(`/api/search-patient?query=${encodeURIComponent(searchQuery)}`, {
        method: "GET",
      });

      if (response.success) {
        if (response.found) {
          setPatientFound(true);
          setFoundPatient(response.patient);
          
          // Prefill form dengan data pasien yang ditemukan
          form.setValue("name", response.patient.name);
          form.setValue("phoneNumber", response.patient.phoneNumber);
          form.setValue("email", response.patient.email || "");
          // Format tanggal lahir sesuai format yang dibutuhkan input type="date" (yyyy-MM-dd)
          form.setValue("birthDate", response.patient.birthDate);
          form.setValue("gender", response.patient.gender);
          form.setValue("address", response.patient.address);
          
          toast({
            title: "Pasien Ditemukan",
            description: `Selamat datang kembali, ${response.patient.name}! Data Anda telah terisi otomatis.`,
            className: "bg-teal-50 border-teal-200 text-teal-800",
          });
        } else {
          setPatientFound(false);
          setFoundPatient(null);
          toast({
            title: "Pasien Baru",
            description: "Kami tidak menemukan data Anda. Silakan isi formulir pendaftaran.",
            className: "bg-amber-50 border-amber-200 text-amber-800",
          });
        }
      } else {
        toast({
          variant: "destructive",
          title: "Pencarian Gagal",
          description: response.message || "Terjadi kesalahan saat mencari data pasien.",
        });
      }
    } catch (error) {
      console.error("Error searching for patient:", error);
      toast({
        variant: "destructive",
        title: "Pencarian Gagal",
        description: "Terjadi kesalahan saat mencari data pasien.",
      });
    } finally {
      setIsSearching(false);
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
      // Validasi apakah pasien telah memilih sesi terapi
      if (!values.therapySlotId) {
        toast({
          variant: "destructive",
          title: "Sesi Terapi Diperlukan",
          description: "Silakan pilih sesi terapi yang tersedia",
        });
        return;
      }
      
      // Create the patient payload
      const payload = {
        ...values, 
        // Convert fields as needed to match schema
        email: values.email || null,
        // Memastikan format tanggal tetap yyyy-MM-dd untuk komunikasi dengan backend
        birthDate: values.birthDate, // Format yyyy-MM-dd sesuai untuk API
        // Add registration code as metadata
        registrationCode,
        // Pastikan therapySlotId dikirim dengan benar
        therapySlotId: values.therapySlotId
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
              {/* Search box for existing patients */}
              <div className="mb-6 pb-6 border-b border-gray-200">
                <h3 className="text-lg font-medium mb-3">Sudah pernah terapi di Titik Sumber?</h3>
                <div className="flex gap-2">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Masukkan nama atau nomor WA Anda"
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        searchPatient();
                      }
                    }}
                  />
                  <Button
                    onClick={searchPatient}
                    disabled={isSearching}
                    type="button"
                    variant="outline"
                    className="flex items-center gap-1"
                  >
                    <Search className="h-4 w-4" />
                    {isSearching ? 'Mencari...' : 'Cari Data'}
                  </Button>
                </div>
                {patientFound && foundPatient && (
                  <Alert className="mt-4 bg-teal-50 border-teal-200">
                    <CheckCircle className="h-4 w-4 text-teal-600" />
                    <AlertTitle>Pasien Ditemukan!</AlertTitle>
                    <AlertDescription>
                      Selamat datang kembali, {foundPatient.name}! Data Anda telah terisi otomatis.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
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
                            <Input 
                              placeholder="email@contoh.com" 
                              {...field} 
                              value={field.value || ''} 
                            />
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
                            <Input 
                              type="date" 
                              className="h-12 px-4 md:h-10"
                              {...field}
                              // Format untuk input date tetap yyyy-MM-dd sesuai standar HTML
                            />
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
                    name="therapySlotId"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel className="text-base">Pilih Sesi Terapi</FormLabel>
                        <FormDescription>
                          Pilih jadwal sesi terapi yang tersedia sesuai dengan kebutuhan Anda
                        </FormDescription>
                        <FormControl>
                          <div className="space-y-4">
                            {isLoadingSlots ? (
                              <div className="w-full py-8 flex items-center justify-center">
                                <div className="animate-spin h-6 w-6 border-2 border-teal-500 rounded-full border-t-transparent"></div>
                              </div>
                            ) : therapySlots && therapySlots.length > 0 ? (
                              <RadioGroup 
                                onValueChange={(value) => field.onChange(parseInt(value))}
                                className="space-y-6"
                              >
                                {/* Mengelompokkan slot berdasarkan tanggal */}
                                {(() => {
                                  // Mengelompokkan slot berdasarkan tanggal (YYYY-MM-DD)
                                  const groupedSlots: {[key: string]: any[]} = {};
                                  
                                  therapySlots.forEach((slot: any) => {
                                    const slotDate = parseISO(slot.date);
                                    const dateKey = format(slotDate, "yyyy-MM-dd");
                                    
                                    if (!groupedSlots[dateKey]) {
                                      groupedSlots[dateKey] = [];
                                    }
                                    
                                    groupedSlots[dateKey].push(slot);
                                  });
                                  
                                  // Mengubah object groupedSlots menjadi array untuk ditampilkan
                                  return Object.entries(groupedSlots).map(([dateKey, slots]) => {
                                    const slotDate = parseISO(dateKey);
                                    const formattedDate = format(slotDate, "EEEE, dd MMMM yyyy", { locale: idLocale });
                                    
                                    return (
                                      <div key={dateKey} className="border rounded-lg overflow-hidden">
                                        <div className="bg-teal-50 px-4 py-2 border-b border-teal-100">
                                          <h3 className="font-medium text-teal-800">{formattedDate}</h3>
                                        </div>
                                        <div className="p-3 space-y-2">
                                          {slots.map((slot: any) => {
                                            const availableSeats = slot.maxQuota - slot.currentCount;
                                            const isAlmostFull = availableSeats <= 2;
                                            
                                            return (
                                              <div key={slot.id} className="flex items-center space-x-3 border border-gray-200 rounded-md p-2 hover:bg-teal-50 cursor-pointer transition-colors">
                                                <RadioGroupItem value={String(slot.id)} id={`slot-${slot.id}`} />
                                                <div className="grid grid-cols-2 w-full gap-1">
                                                  <FormLabel htmlFor={`slot-${slot.id}`} className="font-medium text-sm">
                                                    <Clock className="h-3.5 w-3.5 inline mr-1 text-gray-500" />
                                                    {slot.timeSlot}
                                                  </FormLabel>
                                                  <div className="flex items-center justify-end text-xs">
                                                    <Users className="h-3 w-3 mr-1" />
                                                    <span className={`${isAlmostFull ? 'text-red-600 font-medium' : 'text-amber-700'}`}>
                                                      {availableSeats}/{slot.maxQuota} kursi
                                                    </span>
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  });
                                })()}
                              </RadioGroup>
                            ) : (
                              <Alert className="bg-amber-50 border-amber-200">
                                <AlertCircle className="h-4 w-4 text-amber-700" />
                                <AlertTitle className="text-amber-700">Tidak ada sesi tersedia</AlertTitle>
                                <AlertDescription className="text-amber-600">
                                  Maaf, saat ini tidak ada sesi terapi yang tersedia. Silakan hubungi admin untuk informasi lebih lanjut.
                                </AlertDescription>
                              </Alert>
                            )}
                          </div>
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