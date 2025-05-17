import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { format, addDays, parseISO, set, parse } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TherapySlot, RegistrationLink } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { formatDateDDMMYYYY, fixTimezone, formatISODate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { CreateBatchDialog } from "@/components/therapy-slots/create-batch-dialog";
// Hapus import yang tidak digunakan
import { SimpleSlotDialog } from "@/components/dashboard/simple-slot-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { 
  CalendarIcon, 
  PencilIcon, 
  PlusCircle, 
  RefreshCw, 
  Trash2,
  Link as Link2,
  Copy,
  Ban,
  MoreHorizontal,
  Info
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import Layout from "@/components/layout/layout";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

// Form Schema
const therapySlotSchema = z.object({
  date: z.union([
    z.date({
      required_error: "Tanggal diperlukan",
    }),
    z.string().refine(value => /^\d{4}-\d{2}-\d{2}$/.test(value), {
      message: "Format tanggal harus YYYY-MM-DD",
    })
  ]).transform(value => {
    // Pastikan valu tanggal selalu dikonversi ke string format YYYY-MM-DD
    if (value instanceof Date) {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return value; // Jika sudah string, kembalikan apa adanya
  }),
  startTime: z.string({
    required_error: "Waktu mulai sesi diperlukan",
  }),
  endTime: z.string({
    required_error: "Waktu selesai sesi diperlukan",
  }),
  maxQuota: z.coerce.number().int().min(1, {
    message: "Kuota minimal 1 orang",
  }),
  isActive: z.boolean().default(true),
});

type TherapySlotFormValues = z.infer<typeof therapySlotSchema>;

export default function TherapySlots() {
  const [date, setDate] = useState<string | Date>(format(new Date(), 'yyyy-MM-dd')); // Ubah tipe menjadi string | Date
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [optimizedDialogOpen, setOptimizedDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TherapySlot | null>(null);
  
  // Effect untuk memastikan tanggal selalu terbaru saat komponen dirender
  useEffect(() => {
    // Update tanggal saat komponen pertama kali dimount
    const todayDate = new Date();
    const currentDate = format(todayDate, 'yyyy-MM-dd');
    console.log("Memperbarui tanggal ke hari ini:", currentDate);
    console.log("Hari ini adalah tanggal:", todayDate.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }));
    setDate(currentDate);
  }, []);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deletingSlotId, setDeletingSlotId] = useState<number | null>(null);
  
  // State untuk edit/update operasi dengan timeout handling
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  
  // State untuk link pendaftaran
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [expiryHours, setExpiryHours] = useState(168); // Default 1 minggu (168 jam)
  const [dailyLimit, setDailyLimit] = useState(10);
  const [specificDate, setSpecificDate] = useState<Date | null>(null);
  const [useSpecificDate, setUseSpecificDate] = useState(false);
  const [linkToDeactivate, setLinkToDeactivate] = useState<number | null>(null);
  const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState(false);
  const [linkToDelete, setLinkToDelete] = useState<number | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  // Track which tab is currently active
  const [currentTab, setCurrentTab] = useState('calendar');
  
  // Query untuk mendapatkan link pendaftaran
  const { data: links = [], isLoading: isLoadingLinks, error: linksError } = useQuery({
    queryKey: ['/api/registration-links'],
    queryFn: async () => {
      const response = await fetch('/api/registration-links');
      if (!response.ok) throw new Error('Gagal mengambil data link pendaftaran');
      return response.json();
    },
  });

  // Form untuk membuat slot terapi baru
  const form = useForm<TherapySlotFormValues>({
    resolver: zodResolver(
      therapySlotSchema.refine(
        data => {
          // Validasi tambahan jika diperlukan
          return true;
        },
        {
          message: "Validasi tambahan",
          path: ["date"],
        }
      )
    ),
    defaultValues: {
      date: new Date(),
      startTime: "10:00",
      endTime: "11:00",
      maxQuota: 6,
      isActive: true,
    },
    mode: "onChange"
  });
  
  // Form untuk mengedit slot terapi
  const editForm = useForm<TherapySlotFormValues>({
    resolver: zodResolver(
      therapySlotSchema.refine(
        data => {
          // Validasi tambahan jika diperlukan
          return true;
        },
        {
          message: "Validasi tambahan",
          path: ["date"],
        }
      )
    ),
    defaultValues: {
      date: new Date(),
      startTime: "10:00",
      endTime: "11:00",
      maxQuota: 6,
      isActive: true,
    },
    mode: "onChange"
  });

  // State untuk filter
  const [showActiveOnly, setShowActiveOnly] = useState(false); // Default: tampilkan semua slot
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "tomorrow" | "week" | "custom">("all");
  const [customDateStart, setCustomDateStart] = useState<Date | null>(null);
  const [customDateEnd, setCustomDateEnd] = useState<Date | null>(null);

  // Query untuk mendapatkan slot terapi berdasarkan tanggal atau periode
  const { data: therapySlots = [], isLoading } = useQuery<TherapySlot[]>({
    queryKey: [
      '/api/therapy-slots', 
      date || 'all',
      showActiveOnly ? 'active' : 'all',
      showAvailableOnly ? 'available' : 'all',
      currentTab === 'calendar' || currentTab === 'list' ? 'filtered' : 'all'
    ],
    queryFn: async () => {
      let endpoint: string;
      const params = new URLSearchParams();
      
      // Gunakan endpoint yang berbeda berdasarkan view yang aktif
      if (currentTab === 'calendar' || currentTab === 'list') {
        endpoint = '/api/therapy-slots';
        
        if (date) {
          // Jika date sudah dalam format string 'yyyy-MM-dd', gunakan langsung
          // Jika date dalam format Date object, gunakan format()
          const dateValue = typeof date === 'string' ? date : format(date as Date, 'yyyy-MM-dd');
          params.append('date', dateValue);
        }
      } else {
        // Untuk tampilan lainnya, gunakan endpoint yang mengambil semua data (termasuk semua periode)
        endpoint = '/api/therapy-slots';
      }
      
      if (showActiveOnly) {
        params.append('active', 'true');
      }
      
      if (showAvailableOnly) {
        params.append('available', 'true');
      }
      
      // Menambahkan parameters ke URL jika ada
      if (params.toString()) {
        endpoint += `?${params.toString()}`;
      }
      
      console.log("Fetching therapy slots with URL:", endpoint);
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Gagal mengambil data slot terapi');
      
      // Dapatkan data dari respons
      const data = await response.json();
      
      // Filter untuk menghapus data slot terapi yang tidak dapat diakses
      // Contoh: slot terapi dengan tanggal 2025-04-08 dan waktu 13:00-15:00 ID 182
      const filteredData = data.filter((slot: TherapySlot) => {
        // Saring ID khusus yang diketahui bermasalah
        if (slot.id === 182) {
          return false;
        }
        
        // Filter lainnya bisa ditambahkan di sini jika diperlukan
        
        return true;
      });
      
      // Deduplikasi data berdasarkan kombinasi tanggal + waktu
      const uniqueSlots = new Map<string, TherapySlot>();
      
      // Proses deduplikasi
      filteredData.forEach((slot: TherapySlot) => {
        const key = `${slot.date}-${slot.timeSlot}`;
        
        // Jika slot dengan kombinasi yang sama sudah ada, gunakan yang ID nya lebih besar (biasanya yang lebih baru)
        if (!uniqueSlots.has(key) || uniqueSlots.get(key)!.id < slot.id) {
          uniqueSlots.set(key, slot);
        }
      });
      
      console.log(`Data sebelum deduplikasi: ${data.length} slots, setelah filter: ${filteredData.length}, setelah deduplikasi: ${uniqueSlots.size} slots`);
      
      // Kembalikan array dari nilai-nilai Map (slot-slot unik)
      return Array.from(uniqueSlots.values());
    },
  });

  // Mutation untuk membuat slot terapi baru
  const createSlotMutation = useMutation({
    mutationFn: async (data: TherapySlotFormValues) => {
      // Konversi tanggal dari Date ke format string YYYY-MM-DD
      let dateObj = data.date;
      if (typeof dateObj !== 'string' && dateObj instanceof Date) {
        // Membuat string YYYY-MM-DD secara manual dari komponen tanggal
        const year = dateObj.getFullYear();
        const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
        const day = dateObj.getDate().toString().padStart(2, '0');
        data = {
          ...data,
          date: `${year}-${month}-${day}`
        };
      }
      
      // Tambahkan log untuk debugging
      console.log("Data yang dikirim ke server:", JSON.stringify(data));
      
      const res = await fetch("/api/therapy-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      
      // Tangkap detail error jika ada
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Failed to parse error' }));
        console.error("Error creating therapy slot:", errorData);
        throw new Error(errorData.message || 'Failed to create therapy slot');
      }
      
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/therapy-slots'] });
      toast({
        title: "Berhasil!",
        description: "Slot terapi baru telah dibuat.",
      });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Gagal membuat slot terapi",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation untuk mengaktifkan/nonaktifkan slot
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      let res;
      if (!isActive) {
        // Deactivate endpoint
        res = await fetch(`/api/therapy-slots/${id}/deactivate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        // Update to activate
        res = await fetch(`/api/therapy-slots/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: true })
        });
      }
      
      if (!res.ok) {
        throw new Error('Gagal mengubah status slot');
      }
      
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/therapy-slots'] });
      toast({
        title: "Status diperbarui",
        description: "Status slot terapi telah diperbarui.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Gagal memperbarui status",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Mutation untuk menghapus slot terapi
  const deleteSlotMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/therapy-slots/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Gagal menghapus slot terapi');
      }
      
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/therapy-slots'] });
      toast({
        title: "Slot dihapus",
        description: "Slot terapi berhasil dihapus.",
      });
      setDeletingSlotId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Gagal menghapus slot",
        description: error.message,
        variant: "destructive",
      });
      setDeletingSlotId(null);
    },
  });

  // Membuat slot terapi untuk beberapa hari ke depan
  const createBatchSlots = async (days: number, timeSlots: {time: string, quota: number}[]) => {
    try {
      console.log("------------- MEMBUAT BATCH SLOTS -------------");
      // Pastikan kita menggunakan Date object di sini untuk perhitungan
      const baseDate = typeof date === 'string' ? parseISO(date) : (date || new Date());
      console.log("Base date:", baseDate);
      
      // Kumpulkan semua slot yang akan dibuat
      const slots = [];

      for (let i = 0; i < days; i++) {
        const slotDate = addDays(baseDate, i);
        
        // Skip Sundays (0 = Sunday, 1 = Monday, etc.)
        if (slotDate.getDay() === 0) continue;
        
        // Gunakan fixTimezone untuk mendapatkan format 'yyyy-MM-dd' yang konsisten
        const slotDateString = fixTimezone(slotDate);
        console.log(`Slot date for day ${i}:`, slotDateString);
        
        // Create all time slots for this day
        for (const slot of timeSlots) {
          slots.push({
            date: slotDateString, // Kirim string, bukan Date object
            timeSlot: slot.time,
            maxQuota: slot.quota,
            isActive: true,
          });
        }
      }
      
      console.log(`Membuat ${slots.length} slot terapi secara batch`);
      
      // Kirim semua slot dalam satu request batch
      const response = await fetch("/api/therapy-slots/batch", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Gagal membuat slot terapi batch');
      }
      
      const result = await response.json();
      console.log("Hasil batch creation:", result);
      
      queryClient.invalidateQueries({ queryKey: ['/api/therapy-slots'] });
      toast({
        title: "Berhasil!",
        description: `${result.createdCount || 0} slot terapi untuk ${days} hari ke depan telah dibuat.`,
      });
    } catch (error) {
      console.error("Error dalam createBatchSlots:", error);
      toast({
        title: "Gagal membuat batch slot",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    }
  };

  // Fungsi untuk memeriksa duplikasi slot terapi
  const checkForDuplicateSlot = (date: string, timeSlot: string): TherapySlot | undefined => {
    if (!therapySlots) return undefined;
    
    // Cari slot yang sudah ada dengan tanggal dan waktu yang sama
    return therapySlots.find(slot => 
      slot.date === date && 
      slot.timeSlot === timeSlot && 
      slot.isActive === true
    );
  };
  
  // Handler untuk submit form
  const onSubmit = (data: TherapySlotFormValues) => {
    // Debugging: Periksa tanggal input yang diterima dari form
    console.log("------------ DEBUGGING FORM SUBMISSION ------------");
    console.log("Tanggal dari form (raw):", data.date);
    console.log("Tipe data tanggal:", typeof data.date);
    
    if (data.date instanceof Date) {
      console.log("Date object toString():", data.date.toString());
      console.log("Date object toISOString():", data.date.toISOString());
      console.log("Tahun:", data.date.getFullYear());
      console.log("Bulan:", data.date.getMonth() + 1); // +1 karena getMonth() dimulai dari 0
      console.log("Tanggal:", data.date.getDate());
      console.log("Local timezone offset (menit):", data.date.getTimezoneOffset());
    }
    
    // Gabungkan startTime dan endTime menjadi timeSlot
    const timeSlot = `${data.startTime}-${data.endTime}`;
    console.log("Time slot:", timeSlot);
    
    // Ekstrak tahun, bulan, hari tanpa terpengaruh timezone (manual fix)
    let dateObj = data.date;
    if (typeof dateObj === 'string') {
      dateObj = new Date(dateObj);
    }
    
    // Membuat string YYYY-MM-DD secara manual dari komponen tanggal
    const year = dateObj.getFullYear();
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const day = dateObj.getDate().toString().padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    
    console.log("Date setelah manual formatting:", dateString);
    console.log("Submitting date as string format:", dateString);
    console.log("------------ END DEBUGGING FORM SUBMISSION ------------");
    
    // CEK DUPLIKASI: Periksa di frontend apakah sudah ada slot dengan tanggal dan waktu yang sama
    const existingSlot = checkForDuplicateSlot(dateString, timeSlot);
    
    if (existingSlot) {
      // Tanya pengguna apakah ingin edit slot yang sudah ada atau tetap buat baru
      if (confirm(`PERHATIAN: Slot terapi untuk tanggal ${dateString} dan waktu ${timeSlot} sudah ada (ID: ${existingSlot.id}).\n\nApakah Anda ingin mengedit slot yang sudah ada?\n- Klik OK untuk mengedit slot yang sudah ada\n- Klik Cancel untuk tetap membuat slot baru`)) {
        // Buka dialog edit untuk slot yang sudah ada
        openEditDialog(existingSlot);
        setDialogOpen(false);
        return; // Berhenti karena pengguna memilih edit slot yang sudah ada
      } else {
        // Konfirmasi lagi jika pengguna tetap ingin membuat duplikat
        if (!confirm(`Anda akan membuat DUPLIKAT slot terapi.\nIni dapat menyebabkan kebingungan saat penjadwalan pasien.\n\nLanjutkan pembuatan slot duplikat?`)) {
          return; // Batal jika pengguna membatalkan pembuatan duplikat
        }
        // Lanjutkan jika pengguna mengonfirmasi ingin membuat duplikat
      }
    }
    
    // Menggunakan fetch API langsung karena mutation tidak mendukung properti timeSlot
    fetch("/api/therapy-slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: dateString, // Kirim format string sederhana YYYY-MM-DD, bukan Date object
        timeSlot: timeSlot,
        maxQuota: data.maxQuota,
        isActive: data.isActive
      })
    })
    .then(res => {
      if (!res.ok) {
        // Periksa jika error adalah karena duplikasi dari validasi server
        if (res.status === 409) {
          return res.json().then(data => {
            const errorMsg = data.message || 'Duplikasi slot terapi terdeteksi';
            const slotId = data.existingSlotId;
            
            // Jika ada ID slot yang sudah ada, tawarkan untuk mengedit
            if (slotId && confirm(`${errorMsg}\n\nApakah Anda ingin mengedit slot yang sudah ada?`)) {
              // Cari slot yang sudah ada di data
              const existingSlot = therapySlots.find(s => s.id === slotId);
              if (existingSlot) {
                openEditDialog(existingSlot);
                setDialogOpen(false);
              }
              return; // Berhenti karena pengguna akan mengedit slot yang sudah ada
            }
            throw new Error(errorMsg);
          });
        }
        throw new Error('Failed to create therapy slot');
      }
      return res.json();
    })
    .then((data) => {
      if (!data) return; // Jika tidak ada data, berarti pengguna memilih untuk mengedit slot yang sudah ada
      
      queryClient.invalidateQueries({ queryKey: ['/api/therapy-slots'] });
      toast({
        title: "Berhasil!",
        description: "Slot terapi baru telah dibuat.",
      });
      setDialogOpen(false);
      form.reset();
    })
    .catch(error => {
      toast({
        title: "Gagal membuat slot terapi",
        description: error.message,
        variant: "destructive",
      });
    });
  };

  // Handler untuk mengaktifkan/nonaktifkan slot
  const handleToggleStatus = (slot: TherapySlot) => {
    toggleStatusMutation.mutate({
      id: slot.id,
      isActive: !slot.isActive,
    });
  };
  
  // Handler untuk edit form
  const openEditDialog = (slot: TherapySlot) => {
    // Parse timeSlot ke startTime dan endTime
    const [startTime, endTime] = slot.timeSlot.split('-');
    
    // Set default values pada edit form
    editForm.reset({
      date: new Date(slot.date),
      startTime,
      endTime,
      maxQuota: slot.maxQuota,
      isActive: slot.isActive
    });
    
    // Set selected slot dan buka dialog
    setSelectedSlot(slot);
    setEditDialogOpen(true);
  };
  
  // Handler untuk menampilkan dialog optimized slot
  const openOptimizedDialog = (slot: TherapySlot) => {
    setSelectedSlot(slot);
    setOptimizedDialogOpen(true);
  };
  
  // Mutation untuk edit slot terapi - dioptimalkan untuk kecepatan
  const editSlotMutation = useMutation({
    mutationFn: async (values: TherapySlotFormValues & { id: number }) => {
      // Format tanggal dengan sederhana
      let dateObj = values.date;
      if (typeof dateObj === 'string') {
        dateObj = new Date(dateObj);
      }
      
      // Format tanggal YYYY-MM-DD
      const dateString = dateObj.toISOString().split('T')[0];
      
      // Format time slot
      const timeSlot = `${values.startTime}-${values.endTime}`;
      
      // Kirim permintaan
      return apiRequest(`/api/therapy-slots/${values.id}`, {
        method: "PUT",
        data: {
          date: dateString,
          timeSlot,
          maxQuota: values.maxQuota,
          isActive: values.isActive
        }
      });
    },
    onSuccess: () => {
      // Perbarui data
      queryClient.invalidateQueries({ queryKey: ['/api/therapy-slots'] });
      
      // Notifikasi sukses tanpa delay
      toast({
        title: "Berhasil!",
        description: "Slot terapi telah diperbarui.",
      });
      
      // Reset state
      setIsEditing(false);
      setEditError(null);
      setEditDialogOpen(false);
      setSelectedSlot(null);
    },
    onError: (error: Error) => {
      // Set error state
      setEditError(error.message || "Terjadi kesalahan");
      setIsEditing(false);
      
      // Tampilkan pesan error
      toast({
        title: "Gagal memperbarui slot terapi",
        description: error.message || "Terjadi kesalahan tak terduga",
        variant: "destructive",
      });
      
      // Refresh data untuk memastikan tampilan konsisten
      queryClient.invalidateQueries({ queryKey: ['/api/therapy-slots'] });
    }
  });

  // Handler untuk submit edit form (disederhanakan)
  const onSubmitEdit = (data: TherapySlotFormValues) => {
    if (!selectedSlot) return;
    
    // Tandai bahwa proses edit sedang berlangsung
    setIsEditing(true);
    setEditError(null);
    
    // Eksekusi mutation
    editSlotMutation.mutate({
      ...data,
      id: selectedSlot.id
    });
  };

  // Format tanggal untuk ditampilkan
  // Fungsi untuk memformat tanggal slot terapi dengan benar
  // Menggunakan fixTimezone untuk memastikan format yang konsisten
  const formatSlotDate = (dateStr: string) => {
    try {
      // Ubah string tanggal ke format Date
      const dateObj = new Date(dateStr);
      
      // Gunakan fixTimezone untuk mendapatkan format YYYY-MM-DD yang konsisten
      const fixedDate = fixTimezone(dateObj);
      
      // Format ke tampilan yang lebih user-friendly
      return formatDateDDMMYYYY(fixedDate);
    } catch (error) {
      console.error("Error formatting slot date:", error);
      return formatDateDDMMYYYY(dateStr);
    }
  };
  
  // Fungsi untuk filter data berdasarkan tanggal
  const getFilteredTherapySlots = () => {
    if (!therapySlots || therapySlots.length === 0) return [];
    
    // Jika filter tanggal adalah "all", kembalikan semua data
    if (dateFilter === "all") {
      return therapySlots;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    return therapySlots.filter(slot => {
      const slotDate = new Date(slot.date);
      slotDate.setHours(0, 0, 0, 0);
      
      switch (dateFilter) {
        case "today":
          return slotDate.getTime() === today.getTime();
        case "tomorrow":
          return slotDate.getTime() === tomorrow.getTime();
        case "week":
          return slotDate.getTime() >= today.getTime() && slotDate.getTime() < nextWeek.getTime();
        case "custom":
          if (customDateStart && customDateEnd) {
            const start = new Date(customDateStart);
            start.setHours(0, 0, 0, 0);
            
            const end = new Date(customDateEnd);
            end.setHours(23, 59, 59, 999);
            
            return slotDate.getTime() >= start.getTime() && slotDate.getTime() <= end.getTime();
          }
          return true;
        default:
          return true;
      }
    });
  };

  // Quick actions untuk membuat batch slot
  const quickActions = [
    { days: 1, label: "Test (1 hari)", timeSlots: [
      { time: "13:00-15:00", quota: 3 }
    ]},
    { days: 7, label: "7 hari", timeSlots: [
      { time: "10:00-11:00", quota: 5 },
      { time: "11:00-12:00", quota: 5 },
      { time: "13:00-14:00", quota: 5 },
    ]},
    { days: 14, label: "14 hari", timeSlots: [
      { time: "10:00-11:00", quota: 5 },
      { time: "11:00-12:00", quota: 5 },
      { time: "13:00-14:00", quota: 5 },
    ]},
    { days: 30, label: "30 hari", timeSlots: [
      { time: "10:00-11:00", quota: 5 },
      { time: "11:00-12:00", quota: 5 },
      { time: "13:00-14:00", quota: 5 },
    ]},
  ];

  // Render komponen
  return (
    <>
      <Helmet>
        <title>Manajemen Slot Terapi | Terapi Titik Sumber</title>
      </Helmet>
      
      {/* AlertDialog untuk konfirmasi hapus */}
      <AlertDialog open={deletingSlotId !== null} onOpenChange={(open) => !open && setDeletingSlotId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Slot Terapi</AlertDialogTitle>
            <AlertDialogDescription>
              Anda yakin ingin menghapus slot terapi ini? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingSlotId && deleteSlotMutation.mutate(deletingSlotId)}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteSlotMutation.isPending}
            >
              {deleteSlotMutation.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Menghapus...
                </>
              ) : (
                "Hapus"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Dialog untuk edit slot terapi */}
      <Dialog 
        open={editDialogOpen} 
        onOpenChange={(open) => {
          // Saat dialog ditutup secara manual, juga bersihkan state
          if (!open) {
            setSelectedSlot(null);
            setEditDialogOpen(false);
          }
        }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Slot Terapi</DialogTitle>
            <DialogDescription>
              Edit detail untuk slot terapi ini.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onSubmitEdit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Tanggal</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "pl-3 text-left font-normal",
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
                          selected={typeof field.value === 'string' ? parseISO(field.value) : field.value}
                          onSelect={(date) => {
                            if (date) {
                              // Langsung gunakan date object asli untuk menyederhanakan proses
                              field.onChange(date);
                            }
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Waktu Mulai</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Waktu Selesai</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="maxQuota"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kuota Maksimal</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Jumlah maksimal pasien per sesi
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Aktif
                      </FormLabel>
                      <FormDescription>
                        Slot terapi aktif dapat dipilih oleh pasien
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={isEditing}
                >
                  {isEditing ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : "Simpan Perubahan"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <div className="container mx-auto py-6 px-4">
        {/* Header section with title and action buttons */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h3 className="text-lg font-medium">Manajemen Slot Terapi</h3>
          
          {/* Action buttons container - improved responsive layout */}
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {/* Batch slot creation button */}
            <Button 
              variant="default" 
              onClick={() => setBatchDialogOpen(true)}
              className="flex-1 sm:flex-none h-12 sm:h-10"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              <span className="whitespace-nowrap">Buat Slot Batch</span>
            </Button>
            
            {/* Single slot creation dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex-1 sm:flex-none h-12 sm:h-10">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  <span className="whitespace-nowrap">Buat Slot Terapi</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tambah Slot Terapi Baru</DialogTitle>
                  <DialogDescription>
                    Masukkan detail untuk slot terapi baru.
                  </DialogDescription>
                </DialogHeader>
                
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    {/* Date selection field */}
                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Tanggal</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "pl-3 text-left font-normal",
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
                                selected={typeof field.value === 'string' ? parseISO(field.value) : field.value}
                                onSelect={(date) => {
                                  if (date) {
                                    // Gunakan fixTimezone untuk mendapatkan string tanggal yang konsisten
                                    const dateString = fixTimezone(date);
                                    field.onChange(dateString); // Simpan string, bukan Date object
                                  }
                                }}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {/* Start time field */}
                    <FormField
                      control={form.control}
                      name="startTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Waktu Mulai</FormLabel>
                          <FormControl>
                            <Input
                              type="time"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {/* End time field */}
                    <FormField
                      control={form.control}
                      name="endTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Waktu Selesai</FormLabel>
                          <FormControl>
                            <Input
                              type="time"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {/* Max quota field */}
                    <FormField
                      control={form.control}
                      name="maxQuota"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Kuota Maksimal</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Jumlah maksimal pasien per sesi
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <DialogFooter>
                      <Button type="submit" disabled={createSlotMutation.isPending}>
                        {createSlotMutation.isPending && (
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Simpan
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
            
            {/* Refresh button */}
            <Button 
              variant="outline" 
              onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/therapy-slots'] })}
              className="flex-1 sm:flex-none h-12 sm:h-10"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
        
        {/* Main tabs navigation for different therapy slot management views */}
        <Tabs 
          defaultValue="calendar" 
          onValueChange={(value) => {
            // Update current tab state
            setCurrentTab(value);
            
            // Adjust filter settings based on selected tab
            if (value === "list") {
              // For "List All Slots", clear date filter to show all slots
              // and ensure showActiveOnly is false to display all slots
              setDate("");
              setShowActiveOnly(false);
            } else if (value === "calendar") {
              // For "Calendar" view, use today's date
              setDate(format(new Date(), 'yyyy-MM-dd'));
            }
            
            // Manually trigger re-fetch when tab changes
            queryClient.invalidateQueries({ queryKey: ['/api/therapy-slots'] });
          }}
        >
          {/* Tab navigation buttons */}
          <TabsList className="mb-4">
            <TabsTrigger value="calendar">Kalender</TabsTrigger>
            <TabsTrigger value="quick">Buat Batch</TabsTrigger>
            <TabsTrigger value="list">Daftar Semua Slot</TabsTrigger>
            <TabsTrigger value="filter">Filter & Opsi</TabsTrigger>
            <TabsTrigger value="links">Link Pendaftaran</TabsTrigger>
          </TabsList>
          
          <TabsContent value="calendar" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Pilih Tanggal</CardTitle>
                  <CardDescription>
                    Pilih tanggal untuk melihat slot terapi
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Calendar
                    mode="single"
                    selected={typeof date === 'string' ? parseISO(date) : date}
                    onSelect={(selectedDate) => {
                      if (selectedDate) {
                        // Gunakan fixTimezone untuk mendapatkan string tanggal yang konsisten
                        // dengan format YYYY-MM-DD dan mengatasi masalah timezone
                        const dateString = fixTimezone(selectedDate);
                        setDate(dateString); // Simpan string, bukan Date object
                      }
                    }}
                    className="rounded-md border"
                  />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>
                    Slot Terapi: {date && formatDateDDMMYYYY(date)}
                  </CardTitle>
                  <CardDescription>
                    Daftar slot terapi untuk tanggal yang dipilih
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex justify-center py-6">
                      <RefreshCw className="h-6 w-6 animate-spin" />
                    </div>
                  ) : therapySlots.length > 0 ? (
                    <div className="overflow-auto">
                      {/* Desktop view - gunakan tabel */}
                      <div className="hidden md:block">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Waktu</TableHead>
                              <TableHead>Kuota</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Aksi</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {therapySlots.map((slot) => (
                              <TableRow key={slot.id}>
                                <TableCell>{slot.timeSlot}</TableCell>
                                <TableCell>
                                  {slot.currentCount} / {slot.maxQuota}
                                </TableCell>
                                <TableCell>
                                  {slot.isActive ? (
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                      Aktif
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                                      Non-aktif
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex space-x-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="border-blue-200 text-blue-600 hover:bg-blue-50"
                                      onClick={() => openOptimizedDialog(slot)}
                                    >
                                      <Info className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant={slot.isActive ? "destructive" : "outline"}
                                      size="sm"
                                      onClick={() => handleToggleStatus(slot)}
                                      disabled={toggleStatusMutation.isPending}
                                    >
                                      {slot.isActive ? "Nonaktifkan" : "Aktifkan"}
                                    </Button>
                                    <Button 
                                      variant="outline"
                                      size="sm"
                                      className="border-amber-200 text-amber-600 hover:bg-amber-50"
                                      onClick={() => openEditDialog(slot)}
                                    >
                                      <PencilIcon className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      variant="outline"
                                      size="sm"
                                      className="text-red-600 border-red-200 hover:bg-red-50"
                                      onClick={() => setDeletingSlotId(slot.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      
                      {/* Mobile view - gunakan card */}
                      <div className="grid grid-cols-1 gap-4 md:hidden">
                        {therapySlots.map((slot) => (
                          <Card key={slot.id} className="overflow-hidden">
                            <CardContent className="p-0">
                              <div className="p-4 border-b">
                                <div className="flex justify-between items-center">
                                  <div className="font-medium">Sesi {slot.timeSlot}</div>
                                  {slot.isActive ? (
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                      Aktif
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                                      Non-aktif
                                    </Badge>
                                  )}
                                </div>
                                <div className="mt-2 text-sm text-gray-500">
                                  Kuota: {slot.currentCount} / {slot.maxQuota}
                                </div>
                              </div>
                              <div className="p-4 bg-gray-50 flex flex-wrap gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-12 flex-1 border-blue-200 text-blue-600 hover:bg-blue-50"
                                  onClick={() => openOptimizedDialog(slot)}
                                >
                                  <Info className="h-4 w-4 mr-2" />
                                  Detail
                                </Button>
                                <Button
                                  variant={slot.isActive ? "destructive" : "outline"}
                                  size="sm"
                                  className="h-12 flex-1"
                                  onClick={() => handleToggleStatus(slot)}
                                  disabled={toggleStatusMutation.isPending}
                                >
                                  {slot.isActive ? "Nonaktifkan" : "Aktifkan"}
                                </Button>
                                <Button 
                                  variant="outline"
                                  size="sm"
                                  className="h-12 flex-1 border-amber-200 text-amber-600 hover:bg-amber-50"
                                  onClick={() => openEditDialog(slot)}
                                >
                                  <PencilIcon className="h-4 w-4 mr-2" />
                                  Edit
                                </Button>
                                <Button 
                                  variant="outline"
                                  size="sm"
                                  className="h-12 flex-1 text-red-600 border-red-200 hover:bg-red-50"
                                  onClick={() => setDeletingSlotId(slot.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Hapus
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-muted-foreground">
                        Tidak ada slot terapi untuk tanggal ini
                      </p>
                      <Button 
                        variant="outline" 
                        className="mt-2"
                        onClick={() => setDialogOpen(true)}
                      >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Buat Slot Terapi
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="quick">
            <Card>
              <CardHeader>
                <CardTitle>Buat Beberapa Slot Terapi Sekaligus</CardTitle>
                <CardDescription>
                  Buat slot terapi untuk beberapa hari ke depan dengan cepat
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <p className="text-sm text-muted-foreground mb-4">
                    Gunakan tombol "Buat Slot Batch" di header untuk membuat beberapa slot terapi sekaligus.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {quickActions.map((action, idx) => (
                    <Card key={idx}>
                      <CardHeader>
                        <CardTitle>{action.label}</CardTitle>
                        <CardDescription>
                          Buat slot terapi untuk {action.days} hari ke depan
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="font-medium">5 sesi per hari:</p>
                        <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
                          {action.timeSlots.map((slot, i) => (
                            <li key={i}>
                              {slot.time} ({slot.quota} orang)
                            </li>
                          ))}
                        </ul>
                        <p className="mt-3">Mulai dari: {date ? formatDateDDMMYYYY(date) : "hari ini"}</p>
                        <p className="text-muted-foreground text-xs mt-1">Minggu libur, tidak ada sesi.</p>
                      </CardContent>
                      <CardFooter>
                        <Button 
                          className="w-full"
                          onClick={() => createBatchSlots(action.days, action.timeSlots)}
                        >
                          Buat Jadwal {action.days} Hari
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="filter">
            <Card>
              <CardHeader>
                <CardTitle>Filter & Pengaturan</CardTitle>
                <CardDescription>
                  Atur preferensi tampilan dan filter untuk slot terapi
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Filter Slot Terapi</h3>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="activeOnly" 
                          checked={showActiveOnly}
                          onCheckedChange={() => setShowActiveOnly(!showActiveOnly)}
                        />
                        <label
                          htmlFor="activeOnly"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Tampilkan hanya slot aktif
                        </label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="availableOnly" 
                          checked={showAvailableOnly}
                          onCheckedChange={() => setShowAvailableOnly(!showAvailableOnly)}
                        />
                        <label
                          htmlFor="availableOnly"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Tampilkan hanya slot yang masih tersedia (belum penuh)
                        </label>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Opsi Tampilan</h3>
                      
                      <div className="rounded-md border p-4">
                        <div className="font-medium">Status filter saat ini:</div>
                        <ul className="mt-2 space-y-1">
                          <li className="text-sm">
                            • Tanggal: {date ? formatDateDDMMYYYY(date) : "Semua tanggal"}
                          </li>
                          <li className="text-sm">
                            • Filter aktif: {showActiveOnly ? "Ya" : "Tidak"}
                          </li>
                          <li className="text-sm">
                            • Filter tersedia: {showAvailableOnly ? "Ya" : "Tidak"}
                          </li>
                        </ul>
                        
                        <Button 
                          onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/therapy-slots'] })}
                          className="mt-4 h-12 sm:h-10"
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Refresh Data
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border-t pt-4">
                    <h3 className="text-lg font-medium mb-2">Fitur Pemeliharaan</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Gunakan fitur ini untuk memperbaiki atau mereset sistem jika terjadi masalah.
                    </p>
                    
                    <div className="flex flex-wrap gap-4">
                      <Button 
                        variant="outline" 
                        className="h-12 sm:h-10"
                        onClick={async () => {
                          try {
                            // 1. Sinkronisasi kuota slot terlebih dahulu
                            console.log("Memulai sinkronisasi kuota slot...");
                            const quotaResponse = await fetch('/api/therapy-slots/sync-quota', {
                              method: 'POST',
                              credentials: 'include',
                              headers: {
                                'Cache-Control': 'no-cache, no-store, must-revalidate',
                                'Pragma': 'no-cache',
                                'Content-Type': 'application/json'
                              }
                            });
                            
                            if (!quotaResponse.ok) {
                              const error = await quotaResponse.json().catch(() => ({ message: "Gagal mendapatkan pesan error" }));
                              throw new Error(error.message || "Gagal melakukan sinkronisasi kuota");
                            }
                            
                            const quotaResult = await quotaResponse.json();
                            console.log("Hasil sinkronisasi kuota:", quotaResult);
                            
                            // 2. Kemudian sinkronisasi data appointment
                            const appointmentResponse = await fetch('/api/appointments/resync', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json'
                              },
                              credentials: 'include'
                            });
                            
                            if (!appointmentResponse.ok) {
                              const contentType = appointmentResponse.headers.get("content-type");
                              let errorMessage = "Gagal melakukan sinkronisasi appointment";
                              
                              if (contentType && contentType.includes("application/json")) {
                                const errorData = await appointmentResponse.json();
                                if (errorData && errorData.message) {
                                  errorMessage = errorData.message;
                                }
                              } else {
                                const errorText = await appointmentResponse.text();
                                if (errorText) {
                                  errorMessage = errorText;
                                }
                              }
                              
                              throw new Error(errorMessage);
                            }
                            
                            // 3. Perbarui semua data terkait di UI
                            queryClient.invalidateQueries({ queryKey: ['/api/therapy-slots'] });
                            queryClient.invalidateQueries({ queryKey: ['/api/therapy-slots', 'available-active'] });
                            queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
                            queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
                            queryClient.invalidateQueries({ queryKey: ['/api/today-slots'] });
                            
                            const appResult = await appointmentResponse.json().catch(() => null);
                            
                            // 4. Tampilkan pesan sukses gabungan
                            toast({
                              title: "Sinkronisasi Berhasil",
                              description: `Kuota slot terapi dan data appointment telah diperbarui.
                                ${quotaResult.updatedSlots || 0} slot diperbarui.
                                ${appResult?.result?.fixed || 0} appointment diperbaiki.`,
                            });
                            
                          } catch (err) {
                            console.error("Error saat sinkronisasi:", err);
                            toast({
                              title: "Gagal Sinkronisasi",
                              description: err instanceof Error ? err.message : "Terjadi kesalahan",
                              variant: "destructive"
                            });
                          }
                        }}
                      >
                        Sinkronisasi Sistem
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="list">
            <Card>
              <CardHeader>
                <CardTitle>Semua Slot Terapi</CardTitle>
                <CardDescription>
                  Daftar lengkap semua slot terapi (hari ini dan ke depan)
                </CardDescription>
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mt-4">
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Info className="h-4 w-4" />
                    <p>Tab ini menampilkan semua slot terapi</p>
                  </div>
                  
                  {/* Filter controls */}
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <Select
                      value={dateFilter}
                      onValueChange={(value: "all" | "today" | "tomorrow" | "week" | "custom") => {
                        setDateFilter(value);
                        if (value !== "custom") {
                          setCustomDateStart(null);
                          setCustomDateEnd(null);
                        }
                      }}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter Tanggal" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Tanggal</SelectItem>
                        <SelectItem value="today">Hari Ini</SelectItem>
                        <SelectItem value="tomorrow">Besok</SelectItem>
                        <SelectItem value="week">Minggu Ini</SelectItem>
                        <SelectItem value="custom">Rentang Kustom</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    {dateFilter === "custom" && (
                      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={!customDateStart ? "text-muted-foreground" : ""}>
                              {customDateStart ? formatDateDDMMYYYY(customDateStart) : "Tanggal Mulai"}
                              <CalendarIcon className="ml-2 h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={customDateStart || undefined}
                              onSelect={(date) => setCustomDateStart(date)}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={!customDateEnd ? "text-muted-foreground" : ""}>
                              {customDateEnd ? formatDateDDMMYYYY(customDateEnd) : "Tanggal Akhir"}
                              <CalendarIcon className="ml-2 h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={customDateEnd || undefined}
                              onSelect={(date) => setCustomDateEnd(date)}
                              initialFocus
                              disabled={(date) => customDateStart ? date < customDateStart : false}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="listActiveOnly" 
                        checked={showActiveOnly}
                        onCheckedChange={() => setShowActiveOnly(!showActiveOnly)}
                      />
                      <label
                        htmlFor="listActiveOnly"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Hanya Slot Aktif
                      </label>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-6">
                    <RefreshCw className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableCaption>Daftar semua slot terapi</TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tanggal</TableHead>
                          <TableHead>Waktu</TableHead>
                          <TableHead>Kuota</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getFilteredTherapySlots().length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                              Tidak ada slot terapi yang ditemukan untuk filter yang dipilih
                            </TableCell>
                          </TableRow>
                        ) : (
                          getFilteredTherapySlots().map((slot) => (
                            <TableRow key={slot.id}>
                              <TableCell>{formatSlotDate(slot.date)}</TableCell>
                              <TableCell>{slot.timeSlot}</TableCell>
                              <TableCell>
                                {slot.currentCount} / {slot.maxQuota}
                                {slot.globalQuota && slot.globalQuota !== slot.maxQuota && (
                                  <span className="text-xs text-muted-foreground ml-1 block">
                                    (dari {slot.globalQuota} total)
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                {slot.isActive ? (
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    Aktif
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                                    Non-aktif
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex space-x-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-blue-200 text-blue-600 hover:bg-blue-50"
                                    onClick={() => openOptimizedDialog(slot)}
                                  >
                                    <Info className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant={slot.isActive ? "destructive" : "outline"}
                                    size="sm"
                                    onClick={() => handleToggleStatus(slot)}
                                    disabled={toggleStatusMutation.isPending}
                                  >
                                    {slot.isActive ? "Nonaktifkan" : "Aktifkan"}
                                  </Button>
                                  <Button 
                                    variant="outline"
                                    size="sm"
                                    className="border-amber-200 text-amber-600 hover:bg-amber-50"
                                    onClick={() => openEditDialog(slot)}
                                  >
                                    <PencilIcon className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="outline"
                                    size="sm"
                                    className="text-red-600 border-red-200 hover:bg-red-50"
                                    onClick={() => setDeletingSlotId(slot.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="links" className="space-y-4">
            <div className="flex flex-wrap justify-end gap-2">
              <Button 
                variant="outline"
                className="h-12 sm:h-10 border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                onClick={async () => {
                  try {
                    // Panggil endpoint khusus untuk membuat link permanen
                    const res = await fetch('/api/registration-links/permanent', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' }
                    });
                    
                    if (!res.ok) {
                      const errorData = await res.json();
                      throw new Error(errorData.message || 'Gagal membuat link permanen');
                    }
                    
                    const link = await res.json();
                    
                    // Refresh daftar link
                    queryClient.invalidateQueries({ queryKey: ['/api/registration-links'] });
                    
                    toast({
                      title: "Link Permanen Dibuat",
                      description: `Link permanen dengan kode ${link.code} berhasil dibuat`,
                    });
                  } catch (error) {
                    toast({
                      title: "Gagal Membuat Link Permanen",
                      description: error instanceof Error ? error.message : "Terjadi kesalahan",
                      variant: "destructive",
                    });
                  }
                }}
              >
                <Link2 className="mr-2 h-4 w-4" />
                Buat Link Permanen
              </Button>
              
              <Dialog>
                <DialogTrigger asChild>
                  <Button 
                    onClick={() => setIsCreateDialogOpen(true)}
                    className="h-12 sm:h-10"
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Buat Link Kustom
                  </Button>
                </DialogTrigger>
              </Dialog>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Daftar Link Pendaftaran</CardTitle>
                <CardDescription>
                  Link ini dapat dibagikan kepada calon pasien untuk mendaftar secara mandiri
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingLinks ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex items-center space-x-4">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-[250px]" />
                          <Skeleton className="h-4 w-[200px]" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : linksError ? (
                  <div className="text-center py-4 text-red-500">
                    Terjadi kesalahan saat memuat data. Silakan coba lagi.
                  </div>
                ) : links && Array.isArray(links) && links.length > 0 ? (
                  <>
                    {/* Tampilan Desktop menggunakan Tabel */}
                    <div className="hidden md:block">
                      <Table>
                        <TableCaption>Daftar link pendaftaran pasien</TableCaption>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Kode</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Tanggal Dibuat</TableHead>
                            <TableHead>Berlaku Hingga</TableHead>
                            <TableHead>Batas Harian</TableHead>
                            <TableHead>Pendaftaran</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {links.map((link: RegistrationLink) => (
                            <TableRow key={link.id} className={link.dailyLimit >= 9000 ? "bg-blue-50/40" : ""}>
                              <TableCell className="font-medium">
                                {link.code}
                                {link.dailyLimit >= 9000 && (
                                  <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-700 border-blue-200">
                                    Permanen
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {link.isActive ? (
                                  <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-50">
                                    Aktif
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-red-50 text-red-700 hover:bg-red-50">
                                    Non-aktif
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>{formatISODate(link.createdAt.toString())}</TableCell>
                              <TableCell>
                                {/* Deteksi link permanen */}
                                {link.dailyLimit >= 1000 || 
                                 (new Date(link.expiryTime).getFullYear() > new Date().getFullYear() + 5) ? (
                                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                    Permanen
                                  </Badge>
                                ) : (
                                  formatISODate(link.expiryTime.toString())
                                )}
                              </TableCell>
                              <TableCell>
                                {/* Deteksi batas kuota permanen */}
                                {link.dailyLimit >= 1000 ? (
                                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                    Tidak terbatas
                                  </Badge>
                                ) : (
                                  `${link.dailyLimit} / hari`
                                )}
                              </TableCell>
                              <TableCell>{link.currentRegistrations} pendaftaran</TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <MoreHorizontal className="h-4 w-4" />
                                      <span className="sr-only">Menu</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                                    <DropdownMenuItem 
                                      onClick={() => {
                                        const publicUrl = window.location.origin;
                                        const registrationUrl = `${publicUrl}/register?code=${link.code}`;
                                        navigator.clipboard.writeText(registrationUrl);
                                        toast({
                                          title: "Link Disalin",
                                          description: "Link pendaftaran telah disalin ke clipboard",
                                        });
                                      }}
                                    >
                                      <Copy className="h-4 w-4 mr-2" />
                                      Salin Link
                                    </DropdownMenuItem>
                                    {link.isActive && (
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setLinkToDeactivate(link.id);
                                          setIsDeactivateDialogOpen(true);
                                        }}
                                      >
                                        <Ban className="h-4 w-4 mr-2" />
                                        Nonaktifkan
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setLinkToDelete(link.id);
                                        setIsDeleteDialogOpen(true);
                                      }}
                                      className="text-red-600"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Hapus Link
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    
                    {/* Tampilan Mobile menggunakan Card */}
                    <div className="grid gap-4 md:hidden">
                      {links.map((link: RegistrationLink) => {
                        // Deteksi apakah ini link permanen
                        const isPermanent = link.dailyLimit >= 1000 || 
                          (new Date(link.expiryTime).getFullYear() > new Date().getFullYear() + 5);
                        
                        return (
                          <Card key={link.id} className={isPermanent ? "border-blue-200 bg-blue-50/30" : ""}>
                            <CardHeader className="pb-2">
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <CardTitle className="text-base">{link.code}</CardTitle>
                                  {isPermanent && (
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                      Permanen
                                    </Badge>
                                  )}
                                </div>
                                <Badge variant={link.isActive ? "outline" : "destructive"} className={link.isActive ? "bg-green-50 text-green-700 border-green-200" : ""}>
                                  {link.isActive ? "Aktif" : "Non-aktif"}
                                </Badge>
                              </div>
                              <CardDescription>
                                Dibuat: {formatISODate(link.createdAt.toString())}
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="pb-2">
                              <div className="text-sm space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Berlaku hingga:</span>
                                  <span className="font-medium">
                                    {isPermanent ? "Permanen" : formatISODate(link.expiryTime.toString())}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Batas pendaftaran:</span>
                                  <span className="font-medium">
                                    {isPermanent ? "Tidak terbatas" : `${link.dailyLimit} / hari`}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Total pendaftaran:</span>
                                  <span className="font-medium">{link.currentRegistrations}</span>
                                </div>
                              </div>
                            </CardContent>
                            <CardFooter className="flex justify-between pt-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-12 sm:h-10"
                                onClick={() => {
                                  const publicUrl = window.location.origin;
                                  const registrationUrl = `${publicUrl}/register?code=${link.code}`;
                                  navigator.clipboard.writeText(registrationUrl);
                                  toast({
                                    title: "Link Disalin",
                                    description: "Link pendaftaran telah disalin ke clipboard",
                                  });
                                }}
                              >
                                <Copy className="h-4 w-4 mr-2" />
                                Salin Link
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="icon" className="h-12 sm:h-10 ml-2">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                                  {link.isActive && (
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setLinkToDeactivate(link.id);
                                        setIsDeactivateDialogOpen(true);
                                      }}
                                    >
                                      <Ban className="h-4 w-4 mr-2" />
                                      Nonaktifkan
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setLinkToDelete(link.id);
                                      setIsDeleteDialogOpen(true);
                                    }}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Hapus Link
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </CardFooter>
                          </Card>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <Link2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium">Belum Ada Link Pendaftaran</h3>
                    <p className="text-gray-500 mt-2 mb-6">
                      Anda belum membuat link pendaftaran. Klik tombol "Buat Link Baru" untuk membuat.
                    </p>
                    <Button 
                      onClick={() => setIsCreateDialogOpen(true)}
                      className="mx-auto h-12 sm:h-10"
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Buat Link Baru
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog untuk membuat batch slot terapi */}
      <CreateBatchDialog 
        open={batchDialogOpen} 
        onOpenChange={setBatchDialogOpen} 
      />
      
      {/* Dialog untuk membuat link pendaftaran */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buat Link Pendaftaran Baru</DialogTitle>
            <DialogDescription>
              Buat link pendaftaran dengan batas waktu dan jumlah pendaftaran tertentu.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Opsi Mode Link Pendaftaran */}
            <div className="grid grid-cols-4 items-center gap-4">
              <div className="col-span-4 flex items-center space-x-2">
                <Checkbox 
                  id="permanentLink"
                  checked={expiryHours === 999999}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      // Tetapkan nilai untuk link permanen
                      setExpiryHours(999999);
                      setDailyLimit(9999);
                      setUseSpecificDate(false);
                      setSpecificDate(null);
                    } else {
                      // Reset ke nilai default
                      setExpiryHours(72);
                      setDailyLimit(10);
                    }
                  }}
                />
                <div className="space-y-1.5">
                  <label
                    htmlFor="permanentLink"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Buat Link Permanen
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Link permanen akan selalu aktif dan tidak memiliki batasan waktu atau kuota harian
                  </p>
                </div>
              </div>
            </div>
            
            {/* Form isian untuk link non-permanen */}
            {expiryHours !== 999999 && (
              <>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="expiryHours" className="col-span-4">
                    Berlaku selama (jam)
                  </Label>
                  <Input
                    id="expiryHours"
                    type="number"
                    min="1"
                    max="720"
                    value={expiryHours}
                    onChange={(e) => setExpiryHours(parseInt(e.target.value))}
                    className="col-span-4"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="dailyLimit" className="col-span-4">
                    Batas pendaftaran per hari
                  </Label>
                  <Input
                    id="dailyLimit"
                    type="number"
                    min="1"
                    max="100"
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(parseInt(e.target.value))}
                    className="col-span-4"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <div className="col-span-4 flex items-center space-x-2">
                    <Checkbox 
                      id="specificDate"
                      checked={useSpecificDate}
                      onCheckedChange={(checked) => {
                        setUseSpecificDate(!!checked);
                        if (!checked) {
                          setSpecificDate(null);
                        }
                      }}
                    />
                    <label
                      htmlFor="specificDate"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Gunakan tanggal tertentu
                    </label>
                  </div>
                </div>
                {useSpecificDate && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="specificDatePicker" className="col-span-4">
                      Pilih Tanggal
                    </Label>
                    <div className="col-span-4">
                      <Calendar
                        mode="single"
                        selected={specificDate || undefined}
                        onSelect={(date) => date && setSpecificDate(date)}
                        className="border rounded-md"
                      />
                    </div>
                  </div>
                )}
              </>
            )}
            
            {/* Informasi ringkasan untuk link permanen */}
            {expiryHours === 999999 && (
              <div className="col-span-4 p-4 border border-blue-100 bg-blue-50 rounded-md">
                <h4 className="text-sm font-medium text-blue-700 flex items-center">
                  <Info className="h-4 w-4 mr-2" />
                  Link Permanen
                </h4>
                <p className="mt-1 text-sm text-blue-600">
                  Anda akan membuat link pendaftaran permanen yang akan selalu aktif dan dapat digunakan
                  untuk semua sesi terapi tanpa batasan.
                </p>
                <ul className="mt-2 space-y-1 text-xs text-blue-700 pl-6 list-disc">
                  <li>Tidak pernah kedaluwarsa</li>
                  <li>Tidak ada batasan jumlah pendaftaran per hari</li>
                  <li>Dapat dimatikan secara manual jika diperlukan</li>
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              className="h-12 sm:h-10"
              onClick={async () => {
                try {
                  const specificDateStr = specificDate 
                    ? fixTimezone(specificDate) 
                    : undefined;
                  
                  const response = await fetch("/api/registration-links", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      expiryHours,
                      dailyLimit,
                      specificDate: specificDateStr,
                    }),
                  });

                  if (response.ok) {
                    const link = await response.json();
                    setIsCreateDialogOpen(false);
                    
                    // Invalidate the query to refresh the list
                    queryClient.invalidateQueries({ queryKey: ["/api/registration-links"] });
                    
                    toast({
                      title: "Link Pendaftaran Dibuat",
                      description: `Link dengan kode ${link.code} berhasil dibuat`,
                    });
                  } else {
                    const error = await response.json();
                    throw new Error(error.message || "Failed to create registration link");
                  }
                } catch (error) {
                  const errorMessage = error instanceof Error ? error.message : "Terjadi kesalahan";
                  toast({
                    title: "Gagal Membuat Link",
                    description: errorMessage,
                    variant: "destructive",
                  });
                }
              }}
            >
              Buat Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog untuk menonaktifkan link */}
      <AlertDialog open={isDeactivateDialogOpen} onOpenChange={setIsDeactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nonaktifkan Link Pendaftaran</AlertDialogTitle>
            <AlertDialogDescription>
              Anda yakin ingin menonaktifkan link pendaftaran ini? Pasien tidak akan dapat menggunakan link ini lagi setelah dinonaktifkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  if (!linkToDeactivate) return;
                  
                  const response = await fetch(`/api/registration-links/deactivate/${linkToDeactivate}`, {
                    method: "POST",
                  });

                  if (response.ok) {
                    // Invalidate the query to refresh the list
                    queryClient.invalidateQueries({ queryKey: ["/api/registration-links"] });
                    
                    toast({
                      title: "Link Dinonaktifkan",
                      description: "Link pendaftaran berhasil dinonaktifkan",
                    });
                    
                    setLinkToDeactivate(null);
                  } else {
                    const error = await response.json();
                    throw new Error(error.message || "Failed to deactivate link");
                  }
                } catch (error) {
                  const errorMessage = error instanceof Error ? error.message : "Terjadi kesalahan";
                  toast({
                    title: "Gagal Menonaktifkan Link",
                    description: errorMessage,
                    variant: "destructive",
                  });
                }
              }}
            >
              Nonaktifkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Dialog untuk menghapus link */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Link Pendaftaran</AlertDialogTitle>
            <AlertDialogDescription>
              Anda yakin ingin menghapus link pendaftaran ini? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600"
              onClick={async () => {
                try {
                  if (!linkToDelete) return;
                  
                  const response = await fetch(`/api/registration-links/${linkToDelete}`, {
                    method: "DELETE",
                  });

                  if (response.ok) {
                    // Invalidate the query to refresh the list
                    queryClient.invalidateQueries({ queryKey: ["/api/registration-links"] });
                    
                    toast({
                      title: "Link Dihapus",
                      description: "Link pendaftaran berhasil dihapus",
                    });
                    
                    setLinkToDelete(null);
                  } else {
                    const error = await response.json();
                    throw new Error(error.message || "Failed to delete link");
                  }
                } catch (error) {
                  const errorMessage = error instanceof Error ? error.message : "Terjadi kesalahan";
                  toast({
                    title: "Gagal Menghapus Link",
                    description: errorMessage,
                    variant: "destructive",
                  });
                }
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Dialog sederhana untuk melihat detail slot dan pasien */}
      <SimpleSlotDialog 
        slotId={selectedSlot?.id || null}
        isOpen={optimizedDialogOpen}
        onClose={() => {
          setOptimizedDialogOpen(false);
          setSelectedSlot(null);
        }}
      />
    </>
  );
}
