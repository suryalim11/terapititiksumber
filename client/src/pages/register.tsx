// JALUR PENDAFTARAN ONLINE UTAMA - Versi Sederhana
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { formatDateDDMMYYYY, formatBirthDate } from "@/lib/utils";

// UI Components
import { Calendar } from "@/components/ui/calendar";
import { RegistrationPDF } from "@/components/registration/registration-pdf";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
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
  AlertTriangle,
  CalendarIcon, 
  CheckCircle, 
  Clock, 
  MapPin,
  RefreshCw,
  Search, 
  User
} from "lucide-react";

// Form validation schema
const registerFormSchema = z.object({
  name: z.string().min(3, "Nama harus minimal 3 karakter"),
  phoneNumber: z.string().min(10, "Nomor telepon harus minimal 10 digit"),
  email: z.string().email("Format email tidak valid").optional().or(z.literal("")),
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
  timeSlotKey: z.string().optional(), // Format YYYY-MM-DD_HH:MM-HH:MM
});

type RegisterFormValues = z.infer<typeof registerFormSchema>;

// Type definitions
type RegistrationResponse = {
  id?: number;
  name?: string;
  phoneNumber?: string;
  email?: string | null; 
  birthDate?: string;
  gender?: string;
  address?: string;
  appointment?: {
    id: number;
    patientId: number;
    therapySlotId: number;
    therapySlotDetails: {
      date: string;
      timeSlot: string;
      formattedDate: string;
    };
    date: string;
    timeSlot: string;
    status: string;
  };
  confirmationLink?: string;
  code?: string;
  message?: string;
  registrationInfo?: {
    currentRegistrations: number;
    dailyLimit: number;
  }
}

// Format date utilities
const formatDate = (date: string | Date) => {
  try {
    return format(new Date(date), "dd/MM/yyyy", { locale: idLocale });
  } catch (e) {
    return "Invalid date";
  }
};

export default function RegisterPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  // State untuk pendaftaran
  const [registrationCode, setRegistrationCode] = useState<string | null>(null);
  const [registrationStatus, setRegistrationStatus] = useState<"idle" | "submitting" | "success" | "error" | "quota-reached" | "expired">("idle");
  const [registrationResult, setRegistrationResult] = useState<RegistrationResponse | null>(null);
  
  // State untuk pencarian pasien
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [foundPatient, setFoundPatient] = useState<any>(null);
  
  // State untuk slot terapi
  const [selectedSlot, setSelectedSlot] = useState<{id: number, date: string, timeSlot: string} | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWalkInMode, setIsWalkInMode] = useState(false);
  
  // Form handling
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
      timeSlotKey: undefined,
    },
  });

  // Mendapatkan data slot terapi yang tersedia
  const { data: therapySlots, isLoading: isLoadingSlots, refetch: refetchTherapySlots } = useQuery({
    queryKey: ['/api/therapy-slots', 'available-active'],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/therapy-slots?available=true&active=true`, {
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error(`Gagal mengambil data slot terapi: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error("Tidak ada slot terapi yang tersedia saat ini");
        }
        
        // Filter lagi di client-side untuk memastikan tidak ada slot dengan kuota penuh
        const filteredSlots = data.filter((slot: any) => slot.currentCount < slot.maxQuota);
        
        if (filteredSlots.length === 0) {
          throw new Error("Semua slot terapi sudah penuh");
        }
        
        // Urutkan berdasarkan tanggal dan waktu
        return filteredSlots.sort((a: any, b: any) => {
          // Bandingkan tanggal terlebih dahulu
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          if (dateA !== dateB) return dateA - dateB;
          
          // Jika tanggal sama, bandingkan jam mulai
          return a.timeSlot.localeCompare(b.timeSlot);
        });
      } catch (error) {
        console.error("Error dalam mengambil data slot terapi:", error);
        throw error;
      }
    },
    enabled: (registrationStatus === "idle" && !!registrationCode) || isWalkInMode,
    staleTime: 30000, // 30 detik
  });

  // Cek parameter URL saat halaman dimuat
  useEffect(() => {
    // Reset data penyimpanan sebelumnya
    localStorage.removeItem('selectedTherapySlotId');
    sessionStorage.removeItem('selectedSlotId');
    
    const params = new URLSearchParams(window.location.search);
    // Mendukung parameter "code" dan "kode" untuk backward compatibility
    const code = params.get("code") || params.get("kode");
    
    // Periksa parameter walk-in dari URL atau localStorage
    let isWalkInParam = params.get("walkin") === "true";
      
    // Cek juga localStorage untuk parameter temporary dari redirect
    const tempWalkin = localStorage.getItem('temp_redirect_walkin');
    if (tempWalkin === 'true') {
      isWalkInParam = true;
      localStorage.removeItem('temp_redirect_walkin');
    }
      
    // Set mode pendaftaran berdasarkan parameter
    setIsWalkInMode(isWalkInParam);
    
    if (isWalkInParam) {
      toast({
        title: "Mode Pendaftaran Walk-in",
        description: "Anda berada di mode pendaftaran langsung (walk-in)",
      });
    }
    
    // Mendapatkan slotId dari URL jika ada
    const slotIdParam = params.get("slotId");
    if (slotIdParam) {
      const slotId = parseInt(slotIdParam);
      if (!isNaN(slotId)) {
        sessionStorage.setItem("selectedSlotId", slotId.toString());
      }
    }
    
    // Mendapatkan patientId dari URL atau localStorage
    let patientIdParam = params.get("patientId");
    const tempPatientId = localStorage.getItem('temp_redirect_patientId');
    if (!patientIdParam && tempPatientId) {
      patientIdParam = tempPatientId;
      localStorage.removeItem('temp_redirect_patientId');
    }
    
    if (patientIdParam) {
      searchPatientById(parseInt(patientIdParam));
    }
    
    // Menetapkan kode registrasi dari URL
    if (code) {
      setRegistrationCode(code);
      verifyRegistrationCode(code);
    } else if (isWalkInParam) {
      // Mode walk-in tidak memerlukan kode registrasi
      // Gunakan kode default untuk walk-in
      setRegistrationCode("WALKIN");
    } else {
      // Jika tidak ada kode registrasi dan bukan mode walk-in, redirect ke halaman tidak ditemukan
      navigate("/404");
    }
  }, []);

  // Mengatur nilai therapySlot di form ketika data slot sudah tersedia
  useEffect(() => {
    if (therapySlots && therapySlots.length > 0) {
      // Cek apakah ada slotId yang disimpan sebelumnya
      const savedSlotId = sessionStorage.getItem("selectedSlotId");
      
      if (savedSlotId) {
        const slotId = parseInt(savedSlotId);
        // Cari slot yang sesuai dengan ID yang disimpan
        const matchingSlot = therapySlots.find((slot: any) => slot.id === slotId);
        
        if (matchingSlot) {
          setSelectedSlot(matchingSlot);
          form.setValue("therapySlotId", matchingSlot.id);
        }
      }
    }
  }, [therapySlots, form]);

  // Isi data form ketika pasien ditemukan dari pencarian
  useEffect(() => {
    if (foundPatient) {
      form.setValue("name", foundPatient.name || "");
      form.setValue("phoneNumber", foundPatient.phoneNumber || "");
      form.setValue("email", foundPatient.email || "");
      form.setValue("birthDate", foundPatient.birthDate || "");
      form.setValue("gender", foundPatient.gender || "Laki-laki");
      form.setValue("address", foundPatient.address || "");
      form.setValue("complaints", foundPatient.complaints || "");
    }
  }, [foundPatient, form]);

  // Verifikasi kode registrasi
  const verifyRegistrationCode = async (code: string) => {
    try {
      // Untuk mode walk-in, kita tidak perlu verifikasi kode
      if (isWalkInMode) {
        return;
      }
      
      const response = await fetch(`/api/registration-links/verify?code=${code}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          setRegistrationStatus("expired");
          toast({
            variant: "destructive",
            title: "Kode Tidak Valid",
            description: "Kode pendaftaran tidak ditemukan atau sudah tidak aktif.",
          });
        } else {
          setRegistrationStatus("error");
          toast({
            variant: "destructive",
            title: "Gagal Memverifikasi",
            description: "Terjadi kesalahan saat memverifikasi kode pendaftaran.",
          });
        }
        return;
      }
      
      const data = await response.json();
      
      if (data.isExpired) {
        setRegistrationStatus("expired");
        toast({
          variant: "destructive",
          title: "Kode Kadaluarsa",
          description: "Kode pendaftaran sudah tidak aktif atau sudah melewati batas waktu.",
        });
        return;
      }
      
      if (data.isQuotaReached) {
        setRegistrationStatus("quota-reached");
        toast({
          variant: "destructive",
          title: "Kuota Pendaftaran Penuh",
          description: `Kuota pendaftaran hari ini sudah penuh (${data.currentRegistrations}/${data.dailyLimit}).`,
        });
        return;
      }
      
      // Kode valid
      setRegistrationStatus("idle");
      
      // Verifikasi berhasil, refresh data slot terapi
      refetchTherapySlots();
      
    } catch (error) {
      console.error("Error verifying registration code:", error);
      setRegistrationStatus("error");
      toast({
        variant: "destructive",
        title: "Terjadi Kesalahan",
        description: "Tidak dapat memverifikasi kode pendaftaran. Silakan coba lagi.",
      });
    }
  };

  // Cari pasien berdasarkan nomor telepon
  const searchPatientByPhone = async () => {
    if (!searchQuery) {
      toast({
        title: "Input Kosong",
        description: "Masukkan nomor telepon untuk mencari",
      });
      return;
    }
    
    setIsSearching(true);
    
    try {
      const response = await fetch(`/api/patients/search?q=${encodeURIComponent(searchQuery)}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.found && data.patient) {
        setFoundPatient(data.patient);
        toast({
          title: "Pasien Ditemukan",
          description: `Pasien ${data.patient.name} telah ditemukan dan data diisi otomatis.`,
        });
      } else {
        setFoundPatient(null);
        toast({
          title: "Pasien Tidak Ditemukan",
          description: "Tidak ada pasien yang cocok dengan nomor telepon tersebut.",
        });
      }
    } catch (error) {
      console.error("Error searching for patient:", error);
      toast({
        variant: "destructive",
        title: "Gagal Mencari",
        description: "Terjadi kesalahan saat mencari pasien.",
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Cari pasien berdasarkan ID
  const searchPatientById = async (patientId: number) => {
    setIsSearching(true);
    
    try {
      const response = await fetch(`/api/patients/${patientId}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const patient = await response.json();
      
      setFoundPatient(patient);
      toast({
        title: "Data Pasien Dimuat",
        description: `Data pasien ${patient.name} berhasil dimuat.`,
      });
    } catch (error) {
      console.error("Error fetching patient:", error);
      toast({
        variant: "destructive",
        title: "Gagal Memuat Data",
        description: "Terjadi kesalahan saat memuat data pasien.",
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Daftar pasien
  const onSubmit = async (values: RegisterFormValues) => {
    setIsSubmitting(true);
    
    // Validasi kode pendaftaran untuk registrasi online
    if (!isWalkInMode && !registrationCode) {
      toast({
        variant: "destructive",
        title: "Kode Pendaftaran Tidak Valid",
        description: "Kode pendaftaran tidak tersedia. Silakan reload halaman atau gunakan link yang valid.",
      });
      setIsSubmitting(false);
      return;
    }
    
    // Validasi slot terapi
    if (!selectedSlot && !isWalkInMode) {
      toast({
        variant: "destructive",
        title: "Pilih Jadwal Terapi",
        description: "Silakan pilih slot jadwal terapi yang tersedia.",
      });
      setIsSubmitting(false);
      return;
    }
    
    try {
      // Buat payload untuk API
      const formData = {
        ...values,
        registrationCode: registrationCode,
        therapySlotId: selectedSlot ? selectedSlot.id : (values.therapySlotId || null),
        walkin: isWalkInMode, // Flag untuk walk-in
      };
      
      // Buat permintaan ke API
      const response = await apiRequest('/api/register', {
        method: 'POST',
        data: formData
      });
      
      // API berhasil, tampilkan hasil pendaftaran
      setRegistrationResult(response);
      setRegistrationStatus("success");
      
      // Simpan data pendaftaran ke localStorage untuk fallback
      localStorage.setItem('registrationData', JSON.stringify(response));
      localStorage.setItem('registrationStatus', 'success');
      
      // Tambahkan toast
      toast({
        title: "Pendaftaran Berhasil",
        description: isWalkInMode 
          ? "Pasien walk-in berhasil didaftarkan" 
          : "Pendaftaran berhasil, silakan cek email untuk konfirmasi.",
        className: "bg-green-50 border-green-200 text-green-800",
      });
      
    } catch (error: any) {
      console.error("Error submitting registration:", error);
      
      // Set status error
      setRegistrationStatus("error");
      
      // Tampilkan pesan kesalahan
      toast({
        variant: "destructive",
        title: "Pendaftaran Gagal",
        description: error.message || "Terjadi kesalahan saat mendaftarkan pasien.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tampilkan hasil pendaftaran yang berhasil
  if (registrationStatus === "success" && registrationResult) {
    return (
      <div className="container max-w-3xl mx-auto py-6 px-4">
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-4">
            <div className="mx-auto rounded-full bg-green-100 p-3 w-12 h-12 flex items-center justify-center mb-2">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="text-center text-xl text-green-800">Pendaftaran Berhasil</CardTitle>
            <CardDescription className="text-center text-green-700">
              Data pendaftaran Anda telah berhasil disimpan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-4 bg-white">
              <h3 className="font-semibold text-lg mb-2">Detail Pasien</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <p className="text-sm text-muted-foreground">Nama</p>
                  <p className="font-medium">{registrationResult.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">No. Telepon</p>
                  <p className="font-medium">{registrationResult.phoneNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tanggal Lahir</p>
                  <p className="font-medium">{formatBirthDate(registrationResult.birthDate || "")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Jenis Kelamin</p>
                  <p className="font-medium">{registrationResult.gender}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Alamat</p>
                  <p className="font-medium">{registrationResult.address}</p>
                </div>
              </div>
            </div>
            
            {registrationResult.appointment && (
              <div className="rounded-lg border p-4 bg-white">
                <h3 className="font-semibold text-lg mb-2">Detail Janji Temu</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start space-x-2">
                    <CalendarIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Tanggal</p>
                      <p className="font-medium">
                        {registrationResult.appointment.therapySlotDetails.formattedDate}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Waktu</p>
                      <p className="font-medium">
                        {registrationResult.appointment.therapySlotDetails.timeSlot}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2 col-span-2">
                    <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Lokasi</p>
                      <p className="font-medium">
                        RSU Prof. W.Z. Johannes Kupang
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-3">
            {registrationResult && <RegistrationPDF registrationData={registrationResult} />}
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Tampilkan pesan jika registrasi sudah penuh atau link kadaluarsa
  if (registrationStatus === "quota-reached" || registrationStatus === "expired") {
    return (
      <div className="container max-w-3xl mx-auto py-6 px-4">
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-center text-yellow-800">
              {registrationStatus === "quota-reached" ? "Kuota Pendaftaran Penuh" : "Kode Pendaftaran Kadaluarsa"}
            </CardTitle>
            <CardDescription className="text-center text-yellow-700">
              {registrationStatus === "quota-reached" 
                ? "Maaf, kuota pendaftaran untuk hari ini sudah penuh. Silakan coba lagi besok."
                : "Maaf, kode pendaftaran sudah tidak valid atau kadaluarsa."}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Button 
              variant="outline" 
              onClick={() => navigate("/")}
              className="border-yellow-500 text-yellow-700 hover:bg-yellow-100"
            >
              Kembali ke Beranda
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Tampilkan form pendaftaran
  return (
    <div className="container max-w-3xl mx-auto py-6 px-4">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>
            {isWalkInMode ? "Pendaftaran Pasien Walk-in" : "Pendaftaran Pasien Baru"}
          </CardTitle>
          <CardDescription>
            {isWalkInMode
              ? "Formulir pendaftaran pasien yang datang langsung ke klinik"
              : "Formulir pendaftaran pasien baru untuk janji temu terapi"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Pencarian Pasien Lama */}
            <div className="p-4 rounded-lg border border-blue-200 bg-blue-50">
              <h3 className="font-medium mb-2 flex items-center text-blue-800">
                <User className="mr-2 h-4 w-4" />
                Pasien Lama?
              </h3>
              <p className="text-sm text-blue-700 mb-3">
                Jika Anda pernah terdaftar sebelumnya, cari dengan nomor telepon
              </p>
              <div className="flex space-x-2">
                <Input
                  placeholder="Masukkan nomor telepon"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-white"
                />
                <Button 
                  type="button" 
                  variant="secondary" 
                  disabled={isSearching} 
                  onClick={searchPatientByPhone}
                >
                  {isSearching ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  Cari
                </Button>
              </div>
            </div>

            {/* Form Pendaftaran */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Nama */}
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

                  {/* Nomor Telepon */}
                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nomor Telepon</FormLabel>
                        <FormControl>
                          <Input placeholder="Contoh: 081234567890" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Email */}
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email (Opsional)</FormLabel>
                        <FormControl>
                          <Input placeholder="email@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Tanggal Lahir */}
                  <FormField
                    control={form.control}
                    name="birthDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Tanggal Lahir</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={`w-full pl-3 text-left font-normal ${
                                  !field.value ? "text-muted-foreground" : ""
                                }`}
                              >
                                {field.value ? (
                                  formatDate(field.value)
                                ) : (
                                  <span>Pilih tanggal lahir</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value ? new Date(field.value) : undefined}
                              onSelect={(date) => field.onChange(date ? date.toISOString() : "")}
                              disabled={(date) => date > new Date()}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Jenis Kelamin */}
                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>Jenis Kelamin</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex space-x-4"
                          >
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="Laki-laki" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                Laki-laki
                              </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="Perempuan" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                Perempuan
                              </FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Alamat */}
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Alamat</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Masukkan alamat lengkap"
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Keluhan */}
                  <FormField
                    control={form.control}
                    name="complaints"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Keluhan</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Jelaskan keluhan yang dialami"
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Pilih Slot Terapi */}
                  {!isWalkInMode && (
                    <FormField
                      control={form.control}
                      name="therapySlotId"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Jadwal Terapi</FormLabel>
                          <Select 
                            onValueChange={(value) => {
                              field.onChange(parseInt(value))
                              // Update selected slot
                              const selected = therapySlots?.find((slot: any) => slot.id === parseInt(value));
                              if (selected) {
                                setSelectedSlot(selected);
                              }
                            }}
                            defaultValue={field.value?.toString()}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih jadwal terapi" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {isLoadingSlots ? (
                                <div className="p-2 text-center">
                                  <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2" />
                                  <p className="text-sm">Memuat jadwal...</p>
                                </div>
                              ) : therapySlots && therapySlots.length > 0 ? (
                                therapySlots.map((slot: any) => (
                                  <SelectItem key={slot.id} value={slot.id.toString()}>
                                    {formatDateDDMMYYYY(slot.date)} ({slot.timeSlot}) - 
                                    Tersisa {slot.maxQuota - slot.currentCount} slot
                                  </SelectItem>
                                ))
                              ) : (
                                <div className="p-2 text-center">
                                  <AlertTriangle className="h-4 w-4 mx-auto mb-2" />
                                  <p className="text-sm">Tidak ada jadwal tersedia</p>
                                </div>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                {/* Error Messages */}
                {registrationStatus === "error" && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>
                      Terjadi kesalahan saat proses pendaftaran.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Submit Button */}
                <Button 
                  type="submit" 
                  className="w-full md:w-auto"
                  disabled={isSubmitting || (registrationStatus !== "idle" && registrationStatus !== "error")}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      {isWalkInMode ? "Daftarkan Pasien Walk-in" : "Daftar"}
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}