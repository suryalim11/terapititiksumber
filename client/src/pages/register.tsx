import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, isAfter, isSameDay, addHours } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { formatDateDDMMYYYY, formatBirthDate, cn } from "@/lib/utils";
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
  AlertTriangle,
  CalendarIcon, 
  Clock, 
  CheckCircle, 
  MapPin,
  RefreshCw,
  Search, 
  Users,
  User,
  WifiOff
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

// Patient response types
type PatientSearchResponse = {
  success: boolean;
  found: boolean;
  message?: string;
  patient?: {
    id: number;
    name: string;
    phoneNumber: string;
    email: string | null;
    birthDate: string;
    gender: string;
    address: string;
    complaints?: string;
  }
}

// Registration response types
type TherapySlotDetails = {
  date: string;
  timeSlot: string;
  formattedDate: string;
}

type AppointmentResponse = {
  id: number;
  patientId: number;
  therapySlotId: number;
  therapySlotDetails: TherapySlotDetails;
  date: string;
  timeSlot: string;
  status: string;
}

type RegistrationResponse = {
  id?: number;
  name?: string;
  phoneNumber?: string;
  email?: string | null; 
  birthDate?: string;
  gender?: string;
  address?: string;
  appointment?: AppointmentResponse;
  confirmationLink?: string;
  code?: string;
  message?: string;
  registrationInfo?: {
    currentRegistrations: number;
    dailyLimit: number;
  }
}

export default function RegisterPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [registrationCode, setRegistrationCode] = useState<string | null>(null);
  const [registrationStatus, setRegistrationStatus] = useState<"idle" | "submitting" | "success" | "error" | "quota-reached" | "expired">("idle");
  const [registrationLimit, setRegistrationLimit] = useState<number | null>(null);
  const [currentRegistrations, setCurrentRegistrations] = useState<number | null>(null);
  const [expiryTime, setExpiryTime] = useState<Date | null>(null);
  const [verificationResponse, setVerificationResponse] = useState<any>(null);
  
  // State untuk pencarian pasien dan status koneksi
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [patientFound, setPatientFound] = useState<boolean>(false);
  const [foundPatient, setFoundPatient] = useState<any>(null);
  const [selectedSlot, setSelectedSlot] = useState<{id: number, date: string, timeSlot: string} | null>(null);
  
  // State untuk hasil registrasi
  const [registrationResult, setRegistrationResult] = useState<RegistrationResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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
  const { data: therapySlots, isLoading: isLoadingSlots, refetch: refetchTherapySlots, error: therapySlotsError } = useQuery({
    queryKey: ['/api/therapy-slots', 'available-active', verificationResponse ? 'from-verification' : 'api-direct'],
    queryFn: async () => {
      console.log("Mengambil slot terapi untuk form pendaftaran");
      // Pastikan hanya menampilkan slot yang:
      // 1. Aktif (active=true)
      // 2. Masih tersedia (available=true)
      // 3. Slot yang tanggalnya hari ini atau kemudian
      
      // Gunakan data slot dari respons verifikasi kode pendaftaran jika tersedia
      if (verificationResponse && 
          verificationResponse.availableSlots && 
          Array.isArray(verificationResponse.availableSlots) && 
          verificationResponse.availableSlots.length > 0) {
        console.log("Menggunakan data slot terapi dari respons verifikasi kode");
        console.log("Jumlah slot dari verifikasi:", verificationResponse.availableSlots.length);
        
        // Tampilkan sampel data untuk debugging
        console.log("Sampel data slot dari verifikasi:", 
          JSON.stringify(verificationResponse.availableSlots.slice(0, 2)));
        
        // Filter slot dengan kuota tersedia
        const filteredVerificationSlots = verificationResponse.availableSlots.filter(
          (slot: any) => slot.currentCount < slot.maxQuota
        );
        console.log("Slot terapi yang tersedia setelah filter:", filteredVerificationSlots.length);
        
        if (filteredVerificationSlots.length === 0) {
          throw new Error("Tidak ada slot terapi yang tersedia saat ini");
        }
        
        // Urutkan berdasarkan tanggal dan waktu
        return filteredVerificationSlots.sort((a: any, b: any) => {
          // Bandingkan tanggal terlebih dahulu
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          if (dateA !== dateB) return dateA - dateB;
          
          // Jika tanggal sama, bandingkan jam mulai
          return a.timeSlot.localeCompare(b.timeSlot);
        });
      }
      
      // Fallback ke fetch langsung jika tidak ada data di respons verifikasi
      console.log("Fallback ke fetch langsung untuk slot terapi");
      
      // Penting: Tambahkan parameter waktu untuk menghindari cache browser dan force refresh
      const timestamp = new Date().getTime();
      const randomStr = Math.random().toString(36).substring(2, 15);
      const cacheBuster = `_t=${timestamp}&_r=${randomStr}`;
      
      try {
        const response = await fetch(`/api/therapy-slots?available=true&active=true&${cacheBuster}`, {
          credentials: 'include', // Tambahkan credentials untuk mendukung cookies
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
        
        if (!response.ok) {
          console.error(`Error fetching therapy slots: ${response.status} - ${response.statusText}`);
          throw new Error(`Gagal mengambil data slot terapi: ${response.status} - ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log("Slot terapi yang diterima di form pendaftaran:", data.length, "slot");
        
        if (!Array.isArray(data)) {
          console.error("Respons API bukan array:", typeof data);
          throw new Error("Format data slot terapi tidak valid");
        }
        
        if (data.length === 0) {
          console.log("Tidak ada slot terapi yang tersedia dari API");
          throw new Error("Tidak ada slot terapi yang tersedia saat ini");
        }
        
        // Filter lagi di client-side untuk memastikan tidak ada slot dengan kuota penuh
        const filteredSlots = data.filter((slot: any) => slot.currentCount < slot.maxQuota);
        console.log("Slot terapi setelah filter kuota:", filteredSlots.length, "slot");
        
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
        console.error("Error dalam mengambil atau memproses data slot terapi:", error);
        throw error;
      }
    },
    // Aktifkan query ketika status idle (siap untuk pendaftaran) dan kode pendaftaran sudah ada
    // ATAU ketika ada respons verifikasi yang valid dengan availableSlots
    enabled: (registrationStatus === "idle" && !!registrationCode) || 
             (!!verificationResponse && Array.isArray(verificationResponse.availableSlots)),
    refetchInterval: 30000, // Mempersingkat interval refresh menjadi 30 detik
    refetchOnWindowFocus: true, // Refresh saat window kembali difokuskan
    staleTime: 10000, // Data dianggap stale setelah 10 detik
    retry: 2, // Coba ulang 2 kali jika gagal
    retryDelay: 1000, // Jeda 1 detik antar percobaan
  });

  // Parse the URL for registration code and patientId - untuk link permanen dan navigasi dari halaman detail pasien
  useEffect(() => {
    // Perhatikan: Pada halaman pertama load, window.location.search mungkin belum tersedia
    console.log("Full URL saat akses halaman register:", window.location.href);
    console.log("URL search params:", window.location.search);
    
    const params = new URLSearchParams(window.location.search);
    // Mendukung parameter "code" dan "kode" untuk backward compatibility
    const code = params.get("code") || params.get("kode");
    
    // Cek apakah ada parameter 'status=success' di URL
    const urlStatus = params.get('status');
    
    // Jika status=success, coba pulihkan data dari localStorage
    if (urlStatus === 'success') {
      console.log("Status success terdeteksi di URL, mencoba memulihkan data pendaftaran");
      
      try {
        const savedData = localStorage.getItem('registrationData');
        const savedStatus = localStorage.getItem('registrationStatus');
        
        if (savedData && savedStatus === 'success') {
          console.log("Data pendaftaran ditemukan di localStorage");
          
          // Pulihkan data pendaftaran
          const registrationData = JSON.parse(savedData);
          setRegistrationResult(registrationData);
          setRegistrationStatus('success');
          
          console.log("Berhasil memulihkan data pendaftaran dari localStorage", registrationData);
          
          // Tambahkan toast untuk notifikasi
          toast({
            title: "Pendaftaran Berhasil",
            description: "Data pendaftaran Anda berhasil ditampilkan.",
            className: "bg-green-50 border-green-200 text-green-800",
          });
          
          // Hapus data dari localStorage setelah beberapa saat
          setTimeout(() => {
            localStorage.removeItem('registrationData');
            localStorage.removeItem('registrationStatus');
          }, 5000);
          
          return; // Keluar dari useEffect karena halaman konfirmasi akan ditampilkan
        } else {
          console.log("Tidak ada data pendaftaran yang valid di localStorage");
        }
      } catch (e) {
        console.error("Error memulihkan data pendaftaran:", e);
      }
    }
    
    // Mendapatkan slotId dari URL jika ada (parameter dari admin untuk pasien walk-in)
    const slotIdParam = params.get("slotId");
    if (slotIdParam) {
      console.log("SlotId yang ditemukan di URL:", slotIdParam);
      
      // Simpan slotId untuk digunakan nanti setelah slot terapi dimuat
      const slotId = parseInt(slotIdParam);
      if (!isNaN(slotId)) {
        // Simpan ID slot untuk digunakan saat therapySlots tersedia
        sessionStorage.setItem("selectedSlotId", slotId.toString());
      }
    }
    
    // Mendapatkan patientId dari URL jika ada (navigasi dari halaman detail pasien)
    const patientIdParam = params.get("patientId");
    if (patientIdParam) {
      console.log("PatientId yang ditemukan di URL:", patientIdParam);
      
      // Cari data pasien menggunakan ID yang diberikan
      searchPatientById(parseInt(patientIdParam));
    }
    
    console.log("Kode yang ditemukan di URL:", code);
    
    // Jika tidak ada kode di URL, coba dapatkan secara otomatis link pendaftaran permanen
    if (code) {
      console.log("Menggunakan kode pendaftaran dari URL:", code);
      setRegistrationCode(code);
      // Verifikasi kode pendaftaran dari server
      verifyRegistrationCode(code);
    } else {
      console.log("Tidak ada kode pendaftaran di URL, mencoba mendapatkan link permanen...");
      
      // Coba buat link permanen untuk menangani kasus akses langsung ke halaman pendaftaran
      // tanpa parameter kode
      getActivePermanentLink();
    }
  }, []);

  // Fungsi pencarian pasien berdasarkan ID
  const searchPatientById = async (patientId: number) => {
    try {
      console.log("Mencari pasien dengan ID:", patientId);
      const response = await fetch(`/api/patients/${patientId}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        console.error("Gagal mendapatkan data pasien:", response.status);
        toast({
          variant: "destructive",
          title: "Pasien Tidak Ditemukan",
          description: "Tidak dapat menemukan data pasien dengan ID yang diberikan.",
        });
        return;
      }
      
      const patient = await response.json();
      
      if (patient) {
        console.log("Pasien ditemukan:", patient);
        setPatientFound(true);
        setFoundPatient(patient);
        
        // Isi formulir dengan data pasien dari tab appointment di halaman detail pasien
        form.setValue("name", patient.name);
        form.setValue("phoneNumber", patient.phoneNumber);
        form.setValue("email", patient.email || "");
        form.setValue("birthDate", patient.birthDate);
        form.setValue("gender", patient.gender as "Laki-laki" | "Perempuan");
        form.setValue("address", patient.address);
        if (patient.complaints) {
          form.setValue("complaints", patient.complaints);
        }
        
        toast({
          title: "Data Pasien Ditemukan",
          description: `Data ${patient.name} telah diisi otomatis pada formulir.`,
          className: "bg-green-50 border-green-200 text-green-800",
        });
      } else {
        console.error("Pasien tidak ditemukan dengan ID:", patientId);
        toast({
          variant: "destructive",
          title: "Pasien Tidak Ditemukan",
          description: "Tidak dapat menemukan data pasien. Silakan coba lagi nanti.",
        });
      }
    } catch (error) {
      console.error("Error mendapatkan data pasien:", error);
      toast({
        variant: "destructive",
        title: "Koneksi Gagal",
        description: "Terjadi kesalahan saat mendapatkan data pasien. Silakan coba lagi nanti.",
      });
    }
  };

  // State untuk mode pendaftaran walk-in (dari admin)
  const [isWalkInMode, setIsWalkInMode] = useState<boolean>(false);

  // Effect untuk men-set therapySlotId dari sessionStorage/URL setelah therapySlots dimuat
  useEffect(() => {
    if (therapySlots && therapySlots.length > 0) {
      // Cek parameter dari URL dan sessionStorage
      const savedSlotId = sessionStorage.getItem("selectedSlotId");
      const params = new URLSearchParams(window.location.search);
      const slotIdParam = params.get("slotId");
      const timeSlotKeyParam = params.get("timeSlotKey");
      const isWalkInParam = params.get("walkin") === "true";
      
      console.log("Parameter yang diterima:", {
        savedSlotId, 
        slotIdParam, 
        timeSlotKeyParam, 
        isWalkInParam
      });
      
      let matchingSlot = null;
      
      // PRIORITAS 1: Cari berdasarkan timeSlotKey jika tersedia
      if (timeSlotKeyParam) {
        console.log("Mencari slot berdasarkan timeSlotKey:", timeSlotKeyParam);
        
        // Format timeSlotKey: YYYY-MM-DD_HH:MM-HH:MM
        // Pisahkan bagian tanggal dan waktu
        const [dateString, timeString] = timeSlotKeyParam.split('_');
        
        // Cari slot dengan tanggal dan timeSlot yang sesuai
        matchingSlot = therapySlots.find((slot: any) => {
          // Extract tanggal dari slot, dapat berbentuk "2025-05-08" atau "2025-05-08 00:00:00"
          let slotDateStr;
          if (typeof slot.date === 'string') {
            slotDateStr = slot.date.split(' ')[0]; // Ambil bagian YYYY-MM-DD
          } else {
            const slotDate = new Date(slot.date);
            slotDateStr = `${slotDate.getFullYear()}-${String(slotDate.getMonth() + 1).padStart(2, '0')}-${String(slotDate.getDate()).padStart(2, '0')}`;
          }
          
          // Bandingkan tanggal dan timeSlot
          const isMatch = slotDateStr === dateString && slot.timeSlot === timeString;
          if (isMatch) {
            console.log("Menemukan slot berdasarkan timeSlotKey:", slot);
          }
          return isMatch;
        });
        
        // Jika tidak ditemukan dengan pendekatan parsing, coba cari langsung di timeSlotKey
        if (!matchingSlot) {
          matchingSlot = therapySlots.find((slot: any) => 
            slot.timeSlotKey === timeSlotKeyParam
          );
          
          if (matchingSlot) {
            console.log("Menemukan slot langsung dari timeSlotKey dalam data:", matchingSlot);
          }
        }
      }
      
      // PRIORITAS 2: Cari berdasarkan slotId jika timeSlotKey tidak ditemukan
      if (!matchingSlot && (slotIdParam || savedSlotId)) {
        const slotIdToUse = slotIdParam || savedSlotId;
        console.log("Mencari slot berdasarkan ID:", slotIdToUse);
        
        if (slotIdToUse) {
          const slotId = parseInt(slotIdToUse);
          matchingSlot = therapySlots.find((slot: any) => slot.id === slotId);
          
          if (matchingSlot) {
            console.log("Menemukan slot berdasarkan ID:", matchingSlot);
          }
        }
      }
      
      // Jika slot ditemukan, gunakan untuk form
      if (matchingSlot) {
        console.log("Menggunakan slot terapi:", matchingSlot);
        
        // Set nilai pada form
        form.setValue("therapySlotId", matchingSlot.id);
        
        // Jika ada timeSlotKey, tambahkan ke form
        if (matchingSlot.timeSlotKey) {
          form.setValue("timeSlotKey", matchingSlot.timeSlotKey);
        } else if (timeSlotKeyParam) {
          form.setValue("timeSlotKey", timeSlotKeyParam);
        }
        
        // Simpan data slot untuk tampilan
        setSelectedSlot({
          id: matchingSlot.id,
          date: format(new Date(matchingSlot.date), "dd MMMM yyyy", { locale: idLocale }),
          timeSlot: matchingSlot.timeSlot
        });
        
        // Hapus dari sessionStorage agar tidak digunakan lagi
        sessionStorage.removeItem("selectedSlotId");
        
        // Deteksi apakah ini pendaftaran walk-in dari admin
        if (isWalkInParam) {
          setIsWalkInMode(true);
          toast({
            title: "Mode Pendaftaran Pasien Walk-in",
            description: `Pendaftaran untuk pasien walk-in pada sesi ${matchingSlot.timeSlot}, ${format(new Date(matchingSlot.date), "dd MMMM yyyy", { locale: idLocale })}.`,
            className: "bg-blue-50 border-blue-200 text-blue-800",
          });
        } else {
          toast({
            title: "Sesi Terapi Telah Dipilih",
            description: `Kami telah memilih sesi ${matchingSlot.timeSlot} pada ${format(new Date(matchingSlot.date), "dd MMMM yyyy", { locale: idLocale })} untuk Anda.`,
            className: "bg-teal-50 border-teal-200 text-teal-800",
          });
        }
      } else if (slotIdParam || savedSlotId || timeSlotKeyParam) {
        // Jika slot tidak ditemukan tapi ada parameter, berikan feedback
        console.error("Slot terapi yang diminta tidak ditemukan:", {
          timeSlotKey: timeSlotKeyParam,
          slotId: slotIdParam || savedSlotId
        });
        
        toast({
          title: "Slot Tidak Tersedia",
          description: "Slot terapi yang dipilih tidak tersedia atau telah berubah. Silakan pilih slot terapi lainnya.",
          variant: "destructive",
        });
      }
    }
  }, [therapySlots, form, toast]);

  // Fungsi untuk mendapatkan link pendaftaran permanen yang aktif
  const getActivePermanentLink = async () => {
    try {
      console.log("Mencoba mendapatkan link pendaftaran permanen...");
      // Coba dapatkan (atau buat jika belum ada) link pendaftaran permanen
      const response = await fetch('/api/registration-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Pastikan cookies dikirim
        // Tidak perlu body karena endpoint menggunakan nilai default untuk link permanen
      });
      
      console.log("Respons link permanen:", response.status, response.statusText);
      const data = await response.json();
      console.log("Detail data link permanen:", data);
      
      if (response.ok && data.code) {
        console.log("Mendapatkan link pendaftaran permanen:", data.code);
        setRegistrationCode(data.code);
        // Verifikasi link permanen yang didapat
        verifyRegistrationCode(data.code);
      } else {
        console.error("Gagal mendapatkan link pendaftaran permanen:", data);
        setRegistrationStatus("error");
        toast({
          variant: "destructive",
          title: "Tidak Dapat Mengakses Pendaftaran",
          description: "Terjadi kesalahan saat mempersiapkan halaman pendaftaran. Silakan coba lagi nanti.",
        });
      }
    } catch (error) {
      console.error("Error mendapatkan link pendaftaran permanen:", error);
      setRegistrationStatus("error");
      toast({
        variant: "destructive",
        title: "Koneksi Gagal",
        description: "Terjadi kesalahan saat menghubungi server. Silakan coba lagi nanti.",
      });
    }
  };

  // Function to verify the registration code
  const verifyRegistrationCode = async (code: string) => {
    try {
      const timestamp = new Date().getTime();
      const randomStr = Math.random().toString(36).substring(2, 15);
      const cacheBuster = `_t=${timestamp}&_r=${randomStr}`;
      
      const request = new Request(`/api/verify-registration-link?${cacheBuster}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate, private',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        body: JSON.stringify({ code }),
        credentials: 'include',
      });
      
      const response = await fetch(request);
      
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error("Error parsing JSON response:", parseError);
        const textResponse = await response.clone().text();
        console.log("Response as text:", textResponse);
        
        setRegistrationStatus("error");
        toast({
          variant: "destructive",
          title: "Format Respons Tidak Valid",
          description: "Server mengirimkan format data yang tidak dapat diproses. Silakan coba lagi nanti.",
        });
        return;
      }
      
      if (response.status === 200) {
        console.log("Respons status 200 diterima, menganggap kode valid");
        
        // Simpan data untuk digunakan di query therapy slots
        setVerificationResponse(data);
        console.log("Menyimpan data verifikasi dengan slot:", data.availableSlots?.length || 0, "slots");
        
        setRegistrationStatus("idle");
        
        // Store metadata if available
        if (data.dailyLimit) {
          setRegistrationLimit(data.dailyLimit);
        }
        if (data.currentRegistrations !== undefined) {
          setCurrentRegistrations(data.currentRegistrations);
        }
        if (data.expiryTime) {
          setExpiryTime(new Date(data.expiryTime));
        }
      } else {
        console.error("Kode registrasi tidak valid:", data);
        if (data.expired) {
          setRegistrationStatus("expired");
        } else {
          setRegistrationStatus("error");
        }
        
        toast({
          variant: "destructive",
          title: "Link Tidak Valid",
          description: data.message || "Link pendaftaran yang Anda gunakan tidak valid atau telah kedaluwarsa.",
        });
      }
    } catch (error) {
      console.error("Error verifying registration code:", error);
      setRegistrationStatus("error");
      toast({
        variant: "destructive",
        title: "Koneksi Gagal",
        description: "Terjadi kesalahan saat memverifikasi kode pendaftaran. Silakan coba lagi nanti.",
      });
    }
  };

  // Fungsi pencarian pasien berdasarkan nama atau nomor telepon
  const handleSearchPatient = async () => {
    if (!searchQuery || searchQuery.trim().length < 3) {
      toast({
        variant: "destructive",
        title: "Format Pencarian Tidak Valid",
        description: "Masukkan minimal 3 karakter (nama atau nomor telepon) untuk mencari data pasien.",
      });
      return;
    }
    
    setIsSearching(true);
    
    try {
      const response = await fetch(`/api/patients/search?query=${encodeURIComponent(searchQuery)}`, {
        credentials: 'include',
      });
      
      const data: PatientSearchResponse = await response.json();
      
      if (data.success) {
        if (data.found && data.patient) {
          console.log("Pasien ditemukan:", data.patient);
          setPatientFound(true);
          setFoundPatient(data.patient);
          
          // Isi formulir dengan data pasien
          form.setValue("name", data.patient.name);
          form.setValue("phoneNumber", data.patient.phoneNumber);
          form.setValue("email", data.patient.email || "");
          form.setValue("birthDate", data.patient.birthDate);
          form.setValue("gender", data.patient.gender as "Laki-laki" | "Perempuan");
          form.setValue("address", data.patient.address);
          if (data.patient.complaints) {
            form.setValue("complaints", data.patient.complaints);
          }
          
          toast({
            title: "Data Pasien Ditemukan",
            description: "Data pasien telah diisi otomatis pada formulir.",
            className: "bg-green-50 border-green-200 text-green-800",
          });
        } else {
          console.log("Pasien tidak ditemukan");
          setPatientFound(false);
          setFoundPatient(null);
          
          toast({
            title: "Pasien Baru",
            description: "Nomor telepon belum terdaftar. Silakan isi formulir untuk pendaftaran baru.",
            className: "bg-blue-50 border-blue-200 text-blue-800",
          });
        }
      } else {
        console.error("Gagal mencari pasien:", data.message);
        setPatientFound(false);
        setFoundPatient(null);
        
        toast({
          variant: "destructive",
          title: "Pencarian Gagal",
          description: data.message || "Terjadi kesalahan saat mencari data pasien.",
        });
      }
    } catch (error) {
      console.error("Error searching patient:", error);
      toast({
        variant: "destructive",
        title: "Koneksi Gagal",
        description: "Terjadi kesalahan saat mencari data pasien. Silakan coba lagi nanti.",
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Handling form submission with improved navigation
  const onSubmit = async (values: RegisterFormValues) => {
    console.log("Form submitted with values:", values);
    setIsSubmitting(true);
    
    // Validasi jika kode pendaftaran tidak ada
    if (!registrationCode) {
      toast({
        variant: "destructive",
        title: "Kode Pendaftaran Tidak Valid",
        description: "Kode pendaftaran tidak tersedia. Silakan reload halaman atau gunakan link yang valid.",
      });
      setIsSubmitting(false);
      return;
    }
    
    // Validasi slot terapi jika dibutuhkan (tidak untuk pasien walk-in dari admin)
    if (!isWalkInMode && !values.therapySlotId) {
      toast({
        variant: "destructive",
        title: "Sesi Terapi Belum Dipilih",
        description: "Silakan pilih sesi terapi yang tersedia.",
      });
      setIsSubmitting(false);
      return;
    }
    
    // Validasi waktu terapi (pastikan tidak registrasi untuk waktu yang sudah lewat)
    if (values.therapySlotId && therapySlots) {
      // Definisikan tipe untuk slot
      interface TherapySlotData {
        id: number;
        date: string;
        timeSlot: string;
        maxQuota: number;
        currentCount: number;
        isActive: boolean;
        timeSlotKey?: string | null;
        globalQuota?: number;
        createdAt?: string;
      }
      
      const selectedSlot = therapySlots.find((slot: TherapySlotData) => slot.id === values.therapySlotId);
      if (selectedSlot) {
        const slotDate = new Date(selectedSlot.date);
        const [startHour, startMinute] = selectedSlot.timeSlot.split('-')[0].split(':').map(Number);
        
        // Set jam dan menit dari timeSlot
        slotDate.setHours(startHour, startMinute, 0);
        
        const now = new Date();
        
        // Jika waktu terapi sudah lewat (minimal 30 menit dari sekarang)
        if (slotDate < new Date(now.getTime() + 30 * 60000)) {
          toast({
            variant: "destructive",
            title: "Waktu Terapi Tidak Valid",
            description: "Maaf, Anda tidak dapat mendaftar untuk sesi yang waktunya kurang dari 30 menit dari sekarang atau sudah lewat. Silakan pilih sesi terapi lain.",
          });
          setIsSubmitting(false);
          return;
        }
      }
    }
    
    // Siapkan data untuk server
    const dataToSend = {
      ...values,
      registrationCode,
    };
    
    console.log("Mengirim data pendaftaran ke server");
    
    // Update UI status
    setRegistrationStatus("submitting");
    
    // Siapkan data sederhana terlebih dahulu sebagai fallback
    const simpleData = {
      name: values.name,
      phoneNumber: values.phoneNumber,
      email: values.email || "",
      birthDate: values.birthDate,
      gender: values.gender,
      address: values.address || "",
      slotInfo: selectedSlot ? {
        id: selectedSlot.id,
        date: selectedSlot.date,
        timeSlot: selectedSlot.timeSlot
      } : null,
      timestamp: new Date().toISOString(),
      isComplete: false // Tandai bahwa ini belum complete dari server
    };
    
    // Setup timeout untuk navigasi darurat jika server terlalu lama merespon
    const timeoutId = setTimeout(() => {
      console.log("Timeout terjadi! Melakukan navigasi darurat");
      // Simpan data minimal dan tandai sebagai timeout
      localStorage.setItem('registrationData', JSON.stringify({
        ...simpleData,
        fromTimeout: true
      }));
      localStorage.setItem('registrationStatus', 'pending');
      
      // Force navigasi ke halaman sukses
      const timestamp = new Date().getTime();
      window.location.href = `/registration-success?t=${timestamp}&src=timeout`;
    }, 20000); // 20 detik timeout - lebih lama dari fetch timeout untuk memberi waktu retry
    
    // Implementasi mekanisme retry untuk API call
    const maxRetries = 2;
    let retryCount = 0;
    let success = false;
    
    // Fungsi untuk mencoba mengirim data dengan retry
    const sendRegistrationWithRetry = async () => {
      // Timer untuk timeout
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let timeoutFetch: ReturnType<typeof setTimeout> | null = null;
      
      try {
        // Set timeout untuk request - meningkatkan timeout menjadi 15000ms (15 detik)
        // untuk memberikan waktu yang cukup bagi server untuk menemukan pasien lama
        let requestTimedOut = false;
        timeoutId = setTimeout(() => {
          console.log(`Request timed out after 15000ms (percobaan ke-${retryCount + 1})`);
          requestTimedOut = true;
        }, 15000);
        
        console.log(`Mencoba mengirim data pendaftaran (percobaan ke-${retryCount + 1})`);
        
        // Gunakan AbortController untuk mengatur timeout pada fetch
        const controller = new AbortController();
        timeoutFetch = setTimeout(() => {
          console.log(`Fetch request timeout, aborting (percobaan ke-${retryCount + 1})`);
          controller.abort();
        }, 15000);
        
        const response = await fetch("/api/patients", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(dataToSend),
          signal: controller.signal
        });
        
        // Membersihkan timer timeout
        if (timeoutId) clearTimeout(timeoutId);
        if (timeoutFetch) clearTimeout(timeoutFetch);
        
        // Jika responsnya OK
        if (response.ok) {
          console.log("Pendaftaran berhasil di server");
          success = true;
          
          try {
            // Simpan di localStorage
            localStorage.setItem('registrationData', JSON.stringify({
              ...simpleData,
              isComplete: true
            }));
            localStorage.setItem('registrationStatus', 'success');
          } catch (e) {
            console.error("Error saving to localStorage:", e);
          }
          
          // Navigasi ke halaman sukses, dengan parameter timestamp untuk menghindari cache
          const timestamp = new Date().getTime();
          window.location.href = `/registration-success?t=${timestamp}&src=success`;
          return true;
        } else {
          // Handle error dari server
          let errorMessage = "Terjadi kesalahan saat mendaftarkan pasien.";
          
          try {
            // Coba parse JSON error, jika ada
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
            
            // Cek untuk kuota penuh
            if (errorMessage.includes("kuota") || errorMessage.includes("penuh")) {
              setRegistrationStatus("quota-reached");
              success = true; // Tidak perlu retry untuk kesalahan kuota
              return true;
            }
          } catch (e) {
            console.error("Error parsing error response:", e);
          }
          
          console.log(`Respon error dari server: ${errorMessage}`);
          
          // Jika bukan masalah koneksi, tidak perlu retry
          if (response.status !== 0 && response.status !== 408 && response.status !== 504 && response.status !== 503) {
            // Tampilkan error
            toast({
              variant: "destructive",
              title: "Pendaftaran Gagal",
              description: errorMessage,
            });
            
            setIsSubmitting(false);
            setRegistrationStatus("error");
            success = true; // Tidak perlu retry untuk kesalahan validasi
            return true;
          }
          
          return false; // Retry untuk kesalahan koneksi
        }
      } catch (error: any) {
        // Membersihkan timer timeout
        if (timeoutId) clearTimeout(timeoutId);
        if (timeoutFetch) clearTimeout(timeoutFetch);
        
        // Tangkap error dari fetch
        console.error("Error saat melakukan fetch ke server:", error);
        
        // Jika bukan error timeout atau aborted, tidak perlu retry
        if (error.name !== 'AbortError' && !error.message?.includes('timeout') && !error.message?.includes('network')) {
          toast({
            variant: "destructive",
            title: "Kesalahan",
            description: "Terjadi kesalahan yang tidak terduga. Silakan coba lagi nanti.",
          });
          
          setIsSubmitting(false);
          setRegistrationStatus("error");
          success = true; // Tidak perlu retry untuk kesalahan non-koneksi
          return true;
        }
        
        console.log("Kesalahan koneksi, akan mencoba lagi");
        return false; // Retry untuk kesalahan koneksi
      }
    };
    
    // Eksekusi fungsi retry
    while (retryCount < maxRetries && !success) {
      const result = await sendRegistrationWithRetry();
      if (result) {
        break;
      }
      
      retryCount++;
      if (retryCount < maxRetries && !success) {
        console.log(`Menunggu sebelum mencoba lagi... (${retryCount}/${maxRetries})`);
        // Tunggu sejenak sebelum retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Jika setelah semua percobaan masih gagal
    if (!success) {
      console.log("Semua percobaan gagal, tampilkan pesan error");
      
      // Bersihkan timeout navigasi darurat (biarkan berjalan sesuai jadwal)
      
      // Tampilkan error
      toast({
        variant: "destructive",
        title: "Kesalahan Koneksi",
        description: "Gagal terhubung ke server setelah beberapa percobaan. Mohon periksa koneksi internet Anda.",
      });
      
      setIsSubmitting(false);
      setRegistrationStatus("error");
      
      // Catatan: Kita tidak menghentikan timeoutId untuk navigasi darurat
      // sehingga jika server sebenarnya berhasil memproses data, halaman sukses masih bisa ditampilkan
    }
  };

  // Fungsi untuk mengelompokkan slot berdasarkan tanggal
  function renderSlotsByDateGroups() {
    if (!therapySlots || therapySlots.length === 0) {
      return (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-700" />
          <AlertTitle className="text-amber-700">Tidak ada sesi tersedia</AlertTitle>
          <AlertDescription className="text-amber-600">
            Maaf, saat ini tidak ada sesi terapi yang tersedia. Silakan hubungi admin untuk informasi lebih lanjut.
          </AlertDescription>
        </Alert>
      );
    }

    // Interface untuk data slot terapi
    interface TherapySlotData {
      id: number;
      date: string;
      timeSlot: string;
      maxQuota: number;
      currentCount: number;
      isActive: boolean;
      timeSlotKey?: string | null;
      globalQuota?: number;
      createdAt?: string;
    }
    
    // Fungsi untuk deduplikasi slot dengan timeSlot yang sama
    const deduplicateSlots = (slots: TherapySlotData[]): TherapySlotData[] => {
      // Group slots by date + timeSlot
      const slotMap: Record<string, TherapySlotData[]> = {};
      
      slots.forEach((slot: TherapySlotData) => {
        const dateStr = format(new Date(slot.date), "yyyy-MM-dd");
        const key = `${dateStr}_${slot.timeSlot}`;
        
        if (!slotMap[key]) {
          slotMap[key] = [];
        }
        slotMap[key].push(slot);
      });
      
      // For each group, select the best slot (with highest available quota)
      return Object.values(slotMap).map(slotsGroup => {
        // Sort by available capacity (maxQuota - currentCount) in descending order
        const sortedSlots = [...slotsGroup].sort((a: TherapySlotData, b: TherapySlotData) => 
          (b.maxQuota - b.currentCount) - (a.maxQuota - a.currentCount)
        );
        
        // Return the slot with most available space
        return sortedSlots[0];
      });
    };
    
    // Log jumlah slot sebelum deduplikasi
    console.log(`Slot sebelum deduplikasi: ${therapySlots.length}`);
    
    // Deduplikasi slot terlebih dahulu
    const uniqueSlots = deduplicateSlots(therapySlots);
    
    // Log jumlah slot setelah deduplikasi
    console.log(`Slot setelah deduplikasi: ${uniqueSlots.length}`);
    
    // Kelompokkan slot berdasarkan tanggal
    const groupedByDate: Record<string, TherapySlotData[]> = {};
    
    uniqueSlots.forEach((slot: TherapySlotData) => {
      const dateStr = format(new Date(slot.date), "yyyy-MM-dd");
      if (!groupedByDate[dateStr]) {
        groupedByDate[dateStr] = [];
      }
      groupedByDate[dateStr].push(slot);
    });
    
    // Render grup tanggal dan slot-nya
    return (
      <div className="space-y-4">
        {Object.entries(groupedByDate).map(([dateStr, slots]) => {
          const formattedDate = format(new Date(dateStr), "EEEE, dd MMMM yyyy", { locale: idLocale });
          
          return (
            <div key={dateStr} className="border rounded-md p-3">
              <h4 className="font-medium mb-2 flex items-center">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formattedDate}
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {slots.map((slot: TherapySlotData) => (
                  <div key={slot.id} className="flex">
                    <label
                      htmlFor={`slot-${slot.id}`}
                      className={cn(
                        "flex items-center justify-between w-full p-2 border rounded-md text-sm cursor-pointer",
                        "hover:bg-teal-50 hover:border-teal-200",
                        form.watch("therapySlotId") === slot.id ? "bg-teal-50 border-teal-500 ring-1 ring-teal-500" : ""
                      )}
                    >
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id={`slot-${slot.id}`}
                          value={slot.id}
                          checked={form.watch("therapySlotId") === slot.id}
                          className="sr-only"
                          onChange={() => {
                            form.setValue("therapySlotId", slot.id);
                            setSelectedSlot({
                              id: slot.id,
                              date: format(new Date(slot.date), "dd MMMM yyyy", { locale: idLocale }),
                              timeSlot: slot.timeSlot
                            });
                          }}
                        />
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span>{slot.timeSlot}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {slot.currentCount}/{slot.maxQuota}
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Fungsi untuk mengecek status koneksi internet
  const checkNetworkConnection = () => {
    return navigator.onLine;
  };
  
  // Tampilkan peringatan jika koneksi terputus
  useEffect(() => {
    const handleOffline = () => {
      setIsOnline(false);
      toast({
        variant: "destructive",
        title: "Koneksi Terputus",
        description: "Anda sedang offline. Mohon pastikan koneksi internet aktif untuk pendaftaran.",
      });
    };
    
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: "Koneksi Tersambung",
        description: "Anda kembali online. Silakan lanjutkan pendaftaran.",
      });
      
      // Setelah online kembali, coba muat ulang data slot terapi
      if (registrationCode) {
        console.log("Koneksi kembali tersambung, memuat ulang data slot terapi");
        refetchTherapySlots();
      }
    };
    
    // Periksa status koneksi saat pertama kali component mount
    setIsOnline(navigator.onLine);
    
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [registrationCode]);
  
  // Debug check untuk render success page
  console.log("DEBUG RENDER CONDITION:", { 
    registrationStatus, 
    hasRegistrationResult: !!registrationResult,
    resultContent: registrationResult,
    isOnline: checkNetworkConnection()
  });
  
  if (registrationStatus === "success" && registrationResult) {
    // Debug registrationResult untuk memastikan data lengkap
    console.log("Rendering success page with data:", registrationResult);
    
    return (
      <div id="registration-success-page" className="container max-w-2xl mx-auto p-4">
        <Card className="bg-white shadow-md">
          <CardHeader className="bg-green-50 border-b border-green-100">
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-green-600" />
            </div>
            <CardTitle className="text-center text-2xl text-green-800">Pendaftaran Berhasil!</CardTitle>
            <CardDescription className="text-center text-green-700">
              Terima kasih telah mendaftar di klinik Terapi Titik Sumber
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="border-b pb-4">
                <h3 className="font-medium text-gray-700 mb-2 flex items-center">
                  <User className="mr-2 h-4 w-4" />
                  Data Pasien
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-sm text-gray-500">Nama</p>
                    <p className="font-medium">{registrationResult.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Nomor HP</p>
                    <p className="font-medium">{registrationResult.phoneNumber}</p>
                  </div>
                  {registrationResult.email && (
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="font-medium">{registrationResult.email}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-500">Tanggal Lahir</p>
                    <p className="font-medium">{formatBirthDate(registrationResult.birthDate || "")}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Jenis Kelamin</p>
                    <p className="font-medium">{registrationResult.gender}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-sm text-gray-500">Alamat</p>
                    <p className="font-medium">{registrationResult.address}</p>
                  </div>
                </div>
              </div>

              {registrationResult.appointment && (
                <div className="border-b pb-4">
                  <h3 className="font-medium text-gray-700 mb-2 flex items-center">
                    <Clock className="mr-2 h-4 w-4" />
                    Detail Jadwal Terapi
                  </h3>
                  <div className="bg-blue-50 p-3 rounded-md border border-blue-100 flex flex-col md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center mb-2 md:mb-0">
                      <CalendarIcon className="mr-2 h-4 w-4 text-blue-700" />
                      <span className="text-blue-900 font-medium">
                        {format(new Date(registrationResult.appointment.date), "EEEE, dd MMMM yyyy", { locale: idLocale })}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <Clock className="mr-2 h-4 w-4 text-blue-700" />
                      <span className="text-blue-900 font-medium">
                        {registrationResult.appointment.timeSlot}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="border-b pb-4">
                <h3 className="font-medium text-gray-700 mb-2">Informasi Penting</h3>
                <ul className="list-disc pl-5 space-y-1 text-gray-600">
                  <li>Silakan simpan bukti pendaftaran ini sebagai referensi</li>
                  <li>Mohon datang 15 menit sebelum jadwal terapi</li>
                  <li>Harap lakukan konfirmasi kehadiran melalui WhatsApp</li>
                  <li>Bawa kartu identitas untuk verifikasi</li>
                </ul>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col sm:flex-row gap-3">
            {registrationResult.appointment && (
              <RegistrationPDF
                patientName={registrationResult.name || ""}
                phoneNumber={registrationResult.phoneNumber || ""}
                therapyDate={format(new Date(registrationResult.appointment.date), "dd/MM/yyyy")}
                therapyTime={registrationResult.appointment.timeSlot}
              />
            )}
            <Button onClick={() => window.location.reload()} variant="outline" className="w-full sm:w-auto">
              Pendaftaran Baru
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (registrationStatus === "expired") {
    return (
      <div className="container max-w-md mx-auto p-4">
        <Card className="bg-white shadow-md">
          <CardHeader className="bg-amber-50 border-b border-amber-100">
            <CardTitle className="text-center text-xl text-amber-800">Link Pendaftaran Kedaluwarsa</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex justify-center mb-4">
              <AlertCircle className="h-12 w-12 text-amber-500" />
            </div>
            <p className="text-center mb-4">
              Maaf, link pendaftaran yang Anda gunakan telah kedaluwarsa atau tidak valid.
            </p>
            <p className="text-center text-sm text-gray-600">
              Silakan hubungi admin klinik untuk mendapatkan link pendaftaran yang baru.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (registrationStatus === "error") {
    return (
      <div className="container max-w-md mx-auto p-4">
        <Card className="bg-white shadow-md">
          <CardHeader className="bg-red-50 border-b border-red-100">
            <CardTitle className="text-center text-xl text-red-800">Terjadi Kesalahan</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex justify-center mb-4">
              <AlertCircle className="h-12 w-12 text-red-500" />
            </div>
            <p className="text-center mb-4">
              Maaf, terjadi kesalahan saat menghubungi server pendaftaran.
            </p>
            <p className="text-center text-sm text-gray-600 mb-6">
              Silakan coba lagi nanti atau hubungi admin klinik untuk bantuan.
            </p>
            <div className="flex justify-center">
              <Button onClick={() => window.location.reload()} variant="outline">
                Muat Ulang Halaman
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (registrationStatus === "quota-reached") {
    return (
      <div className="container max-w-md mx-auto p-4">
        <Card className="bg-white shadow-md">
          <CardHeader className="bg-amber-50 border-b border-amber-100">
            <CardTitle className="text-center text-xl text-amber-800">Kuota Pendaftaran Penuh</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex justify-center mb-4">
              <Users className="h-12 w-12 text-amber-500" />
            </div>
            <p className="text-center mb-4">
              Maaf, kuota pendaftaran untuk hari ini telah penuh.
            </p>
            <p className="text-center text-sm text-gray-600 mb-6">
              Silakan coba lagi besok atau hubungi admin klinik untuk informasi lebih lanjut.
            </p>
            <div className="flex justify-center">
              <Button onClick={() => window.location.reload()} variant="outline">
                Muat Ulang Halaman
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="max-w-3xl mx-auto">
        <Card className="bg-white shadow-md">
          <CardHeader className="bg-teal-50 border-b border-teal-100">
            {!isOnline && (
              <Alert variant="destructive" className="mb-4 bg-red-50 border-red-200 text-red-800">
                <WifiOff className="h-4 w-4 mr-2" />
                <AlertTitle>Koneksi Internet Terputus</AlertTitle>
                <AlertDescription>
                  Anda sedang dalam mode offline. Formulir pendaftaran membutuhkan koneksi internet aktif.
                  Mohon aktifkan kembali koneksi internet Anda untuk melanjutkan.
                </AlertDescription>
              </Alert>
            )}
            
            <CardTitle className="text-2xl font-bold text-center text-teal-800">Pendaftaran Terapi Titik Sumber</CardTitle>
            <CardDescription className="text-center text-teal-600">
              Silakan isi formulir di bawah ini untuk mendaftar sebagai pasien
            </CardDescription>

            {(currentRegistrations !== null && registrationLimit !== null) && (
              <div className="mt-2 bg-white border border-teal-200 rounded-md p-2 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-600">Status Pendaftaran:</span>
                  <span className="font-medium">
                    {registrationLimit === 9999 ? "Tidak terbatas" : `${currentRegistrations}/${registrationLimit}`}
                  </span>
                </div>
                {expiryTime && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Masa Berlaku Link:</span>
                    <span className="font-medium">
                      {expiryTime.getFullYear() >= 9999 ? "Permanen" : format(expiryTime, "dd MMM yyyy", { locale: idLocale })}
                    </span>
                  </div>
                )}
              </div>
            )}

            {isWalkInMode && (
              <Alert className="mt-3 bg-blue-50 border-blue-200">
                <AlertCircle className="h-4 w-4 text-blue-700" />
                <AlertTitle className="text-blue-700">Pendaftaran Pasien Walk-in</AlertTitle>
                <AlertDescription className="text-blue-600">
                  Ini adalah mode pendaftaran untuk pasien yang datang langsung ke klinik.
                </AlertDescription>
              </Alert>
            )}
          </CardHeader>

          <CardContent className="pt-6">
            <div className="mb-6">
              <h3 className="text-base font-medium mb-2">Cari Pasien yang Sudah Terdaftar</h3>
              <div className="flex space-x-2">
                <div className="flex-1">
                  <Input 
                    placeholder="Masukkan nama atau nomor telepon" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSearchPatient();
                      }
                    }}
                  />
                </div>
                <Button 
                  onClick={handleSearchPatient} 
                  disabled={isSearching} 
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isSearching ? "Mencari..." : <Search className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Masukkan nama atau nomor telepon untuk mencari data pasien yang sudah terdaftar
              </p>
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
                        <Input placeholder="Masukkan nomor HP (contoh: 08123456789)" {...field} />
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
                        <Input placeholder="Masukkan alamat email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  formatDateDDMMYYYY(field.value)
                                ) : (
                                  <span>Pilih tanggal</span>
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
                </div>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Alamat</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Masukkan alamat lengkap"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedSlot ? (
                  <div className="py-2">
                    <FormLabel className="block mb-2">Sesi Terapi Terpilih</FormLabel>
                    <Alert className="bg-blue-50 border-blue-100">
                      <CalendarIcon className="h-4 w-4 text-blue-700" />
                      <AlertTitle className="text-blue-700">Detail Sesi</AlertTitle>
                      <AlertDescription className="text-blue-600">
                        <p><strong>Tanggal:</strong> {selectedSlot.date}</p>
                        <p><strong>Jam:</strong> {selectedSlot.timeSlot}</p>
                        <div className="mt-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            type="button"
                            onClick={() => {
                              setSelectedSlot(null);
                              form.setValue("therapySlotId", undefined);
                            }}
                            className="text-blue-700 border-blue-300 hover:bg-blue-50"
                          >
                            <RefreshCw className="h-3 w-3 mr-1" /> Ubah Jadwal
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  </div>
                ) : (
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
                          <div className={isLoadingSlots ? "opacity-60" : ""}>
                            {isLoadingSlots ? (
                              <div className="flex justify-center p-4">
                                <div className="animate-spin w-8 h-8 border-4 border-teal-400 border-t-transparent rounded-full"></div>
                              </div>
                            ) : therapySlotsError ? (
                              <div className="bg-red-50 border border-red-200 rounded-md p-4 text-center">
                                <AlertCircle className="h-5 w-5 text-red-500 mx-auto mb-2" />
                                <h4 className="text-red-800 font-medium mb-1">Gagal memuat slot terapi</h4>
                                <p className="text-red-600 text-sm">
                                  {therapySlotsError instanceof Error 
                                    ? therapySlotsError.message 
                                    : "Terjadi kesalahan saat memuat data slot terapi"}
                                </p>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="mt-2 border-red-300 text-red-700 hover:bg-red-100" 
                                  onClick={() => refetchTherapySlots()}
                                >
                                  <RefreshCw className="h-3 w-3 mr-1" /> Coba Lagi
                                </Button>
                              </div>
                            ) : !therapySlots || therapySlots.length === 0 ? (
                              <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-center">
                                <AlertTriangle className="h-5 w-5 text-amber-500 mx-auto mb-2" />
                                <h4 className="text-amber-800 font-medium mb-1">Tidak ada slot terapi yang tersedia</h4>
                                <p className="text-amber-700 text-sm">
                                  Saat ini semua sesi terapi sudah penuh atau belum tersedia. 
                                  Silakan coba lagi nanti atau hubungi klinik untuk informasi lebih lanjut.
                                </p>
                              </div>
                            ) : (
                              renderSlotsByDateGroups()
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

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

                <Button 
                  type="submit" 
                  className="w-full bg-teal-600 hover:bg-teal-700"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Mendaftar..." : "Daftar Terapi"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}