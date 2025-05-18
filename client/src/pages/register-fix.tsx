import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { VerifiedIcon, AlertTriangle, RefreshCw, CheckCircle, CalendarIcon, Clock } from "lucide-react";
import { formatDateDDMMYYYY } from "@/lib/dateUtils";

const registerFormSchema = z.object({
  name: z.string().min(3, {
    message: "Nama harus diisi minimal 3 karakter.",
  }),
  phoneNumber: z.string().min(8, {
    message: "Nomor telepon harus diisi minimal 8 karakter.",
  }),
  email: z.string().email({
    message: "Email tidak valid.",
  }).optional().or(z.literal('')),
  birthDate: z.string({
    required_error: "Tanggal lahir harus diisi",
  }),
  gender: z.string({
    required_error: "Jenis kelamin harus dipilih",
  }),
  address: z.string().min(5, {
    message: "Alamat harus diisi minimal 5 karakter.",
  }),
  therapySlotId: z.number({
    required_error: "Slot terapi harus dipilih",
  }),
});

type RegisterFormValues = z.infer<typeof registerFormSchema>;

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

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const { toast } = useToast();
  const [registrationCode, setRegistrationCode] = useState('');
  const [isCodeVerified, setIsCodeVerified] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState<RegistrationResponse | null>(null);

  // Dapatkan kode registrasi dari URL
  useEffect(() => {
    // Cek jika kode ada pada parameter path (/register/:code)
    if (params.code) {
      setRegistrationCode(params.code);
      verifyCode(params.code);
    } else {
      // Cek jika kode ada pada query parameter (/register?code=XXX)
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      if (code) {
        setRegistrationCode(code);
        verifyCode(code);
      }
    }
  }, [params]);

  // Verifikasi kode registrasi
  const verifyCode = async (code: string) => {
    try {
      const response = await apiRequest(`/api/registration-links/verify/${code}`, {
        method: 'GET',
      });

      if (response.success) {
        setIsCodeVerified(true);
        setVerifyError('');
      } else {
        setIsCodeVerified(false);
        setVerifyError(response.message || 'Kode registrasi tidak valid.');
      }
    } catch (error) {
      console.error('Gagal verifikasi kode:', error);
      setIsCodeVerified(false);
      setVerifyError('Gagal verifikasi kode. Silakan coba lagi.');
    }
  };

  // Query untuk mendapatkan slot terapi
  const { data: therapySlots, isLoading: isLoadingSlots } = useQuery({ 
    queryKey: ['/api/therapy-slots'],
    enabled: isCodeVerified // Hanya jalankan query jika kode telah diverifikasi
  });

  // Form definition
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      name: "",
      phoneNumber: "",
      email: "",
      birthDate: "",
      gender: "",
      address: "",
      therapySlotId: undefined as any,
    },
  });

  // Form submission
  const onSubmit = async (values: RegisterFormValues) => {
    setIsSubmitting(true);
    try {
      // Tambahkan kode registrasi ke data yang dikirim
      const response = await apiRequest('/api/register', {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          registrationCode
        }),
      });

      if (response.id) {
        setRegistrationSuccess(response);
        toast({
          title: "Pendaftaran Berhasil",
          description: "Anda telah berhasil mendaftar untuk sesi terapi.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Pendaftaran Gagal",
          description: response.message || "Terjadi kesalahan saat mendaftar. Silakan coba lagi.",
        });
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast({
        variant: "destructive",
        title: "Pendaftaran Gagal",
        description: "Terjadi kesalahan saat mendaftar. Silakan coba lagi.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tampilkan halaman kesalahan jika kode tidak valid
  if (verifyError && !isCodeVerified) {
    return (
      <div className="container max-w-4xl py-8">
        <Card className="mb-8">
          <CardHeader className="pb-2">
            <CardTitle className="text-center text-red-600">Kode Registrasi Tidak Valid</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 text-center">
            <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-red-500" />
            <p className="mb-4">{verifyError}</p>
            <Button onClick={() => window.location.href = "/"}>Kembali ke Halaman Utama</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tampilkan halaman sukses jika pendaftaran berhasil
  if (registrationSuccess) {
    return (
      <div className="container max-w-4xl py-8">
        <Card className="mb-8">
          <CardHeader className="pb-2">
            <CardTitle className="text-center text-green-600">Pendaftaran Berhasil!</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex justify-center mb-6">
              <VerifiedIcon className="h-16 w-16 text-green-500" />
            </div>
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-lg font-semibold mb-4">Terima kasih {registrationSuccess.name}, pendaftaran Anda telah berhasil direkam.</p>
              </div>
              
              <div className="bg-slate-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Detail Janji Terapi:</h3>
                <p><span className="font-medium">Tanggal:</span> {registrationSuccess.appointment?.therapySlotDetails.formattedDate || "-"}</p>
                <p><span className="font-medium">Waktu:</span> {registrationSuccess.appointment?.timeSlot || "-"}</p>
                <p><span className="font-medium">Status:</span> <span className="text-green-600 font-medium">Terkonfirmasi</span></p>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Informasi Penting:</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Harap datang 15 menit sebelum jadwal yang ditentukan</li>
                  <li>Mohon bawa kartu identitas untuk verifikasi</li>
                  <li>Jika Anda berhalangan hadir, silakan hubungi kami minimal 24 jam sebelumnya</li>
                </ul>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button onClick={() => window.location.href = "/"}>Kembali ke Halaman Utama</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      <Card className="mb-8">
        <CardHeader className="pb-2">
          <CardTitle>Pendaftaran Pasien</CardTitle>
          <CardDescription>Silakan isi formulir di bawah ini untuk mendaftar sebagai pasien baru.</CardDescription>
        </CardHeader>
        <CardContent>
          {isCodeVerified ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-4">
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
                  
                  <div className="grid gap-4 md:grid-cols-2">
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
                  
                  <div className="grid gap-4 md:grid-cols-2">
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
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                        <FormLabel>Alamat</FormLabel>
                        <FormControl>
                          <Input placeholder="Masukkan alamat lengkap Anda" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Separator className="my-4" />
                  
                  <div>
                    <h3 className="text-lg font-medium mb-4">Pilih Jadwal Terapi</h3>
                    <FormField
                      control={form.control}
                      name="therapySlotId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Jadwal Tersedia</FormLabel>
                          <FormControl>
                            <div>
                              {isLoadingSlots ? (
                                <div className="py-8 text-center">
                                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-blue-600" />
                                  <p className="text-sm font-medium">Memuat jadwal tersedia...</p>
                                </div>
                              ) : therapySlots && therapySlots.length > 0 ? (
                                <div className="grid gap-3 md:grid-cols-2">
                                  {/* Filter slot yang sudah berlalu */}
                                  {therapySlots
                                    .filter((slot: any) => {
                                      // Dapatkan tanggal dan waktu dari slot
                                      const slotDate = new Date(slot.date);
                                      
                                      // Ekstrak waktu mulai dari format timeSlot (misalnya "15:00-17:00")
                                      const timeRange = slot.timeSlot.split('-');
                                      const startTime = timeRange[0].trim();
                                      const [startHour, startMinute] = startTime.split(':').map(Number);
                                      
                                      // Set waktu ke waktu mulai slot
                                      slotDate.setHours(startHour, startMinute, 0, 0);
                                      
                                      // Hanya tampilkan slot yang waktunya belum berlalu
                                      return slotDate > new Date();
                                    })
                                    .map((slot: any) => (
                                      <div
                                        key={slot.id}
                                        className={`relative p-4 border rounded-lg cursor-pointer transition-all duration-200 hover:border-blue-400 ${
                                          field.value === slot.id 
                                            ? "bg-blue-50 border-blue-500 ring-1 ring-blue-500" 
                                            : "bg-white"
                                        }`}
                                        onClick={() => {
                                          field.onChange(slot.id);
                                          setSelectedSlot(slot);
                                        }}
                                      >
                                        {field.value === slot.id && (
                                          <div className="absolute top-2 right-2">
                                            <CheckCircle className="h-5 w-5 text-blue-600" />
                                          </div>
                                        )}
                                        <div className="flex flex-col">
                                          <div className="flex items-center gap-2 mb-2">
                                            <CalendarIcon className="h-4 w-4 text-blue-600" />
                                            <span className="font-medium text-gray-900">
                                              {(() => {
                                                // Mendapatkan hari dalam bahasa Indonesia
                                                const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                                                const slotDate = new Date(slot.date);
                                                const dayName = days[slotDate.getDay()];
                                                
                                                // Format tanggal ke DD/MM/YYYY
                                                const date = slotDate.getDate();
                                                const month = slotDate.getMonth() + 1; // Januari = 0
                                                const year = slotDate.getFullYear();
                                                
                                                return `${dayName}, ${date.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
                                              })()}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2 mb-2">
                                            <Clock className="h-4 w-4 text-blue-600" />
                                            <span className="text-sm text-gray-700">{slot.timeSlot}</span>
                                          </div>
                                          <div className={`text-sm font-medium rounded-full px-2 py-1 text-center mt-1 ${
                                            (slot.maxQuota - slot.currentCount) > 3 
                                              ? "bg-green-100 text-green-800" 
                                              : "bg-amber-100 text-amber-800"
                                          }`}>
                                            {slot.maxQuota - slot.currentCount} slot tersedia
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              ) : (
                                <div className="p-8 text-center bg-gray-50 border rounded-lg">
                                  <AlertTriangle className="h-8 w-8 mx-auto mb-3 text-amber-500" />
                                  <p className="text-sm font-medium">Tidak ada jadwal terapi tersedia saat ini.</p>
                                </div>
                              )}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                <div className="mt-6">
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Memproses...
                      </>
                    ) : (
                      "Daftar Sekarang"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <div className="py-8 text-center">
              <RefreshCw className="h-10 w-10 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-lg font-medium">Memverifikasi kode registrasi...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}