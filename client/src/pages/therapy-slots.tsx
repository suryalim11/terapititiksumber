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
  ]),
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
  const [selectedSlot, setSelectedSlot] = useState<TherapySlot | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deletingSlotId, setDeletingSlotId] = useState<number | null>(null);
  
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
  
  // Query untuk mendapatkan link pendaftaran
  const { data: links = [], isLoading: isLoadingLinks, error: linksError } = useQuery({
    queryKey: ['/api/registration-links'],
    queryFn: async () => {
      const response = await fetch('/api/registration-links');
      if (!response.ok) throw new Error('Failed to fetch registration links');
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
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);

  // Query untuk mendapatkan slot terapi
  const { data: therapySlots = [], isLoading } = useQuery<TherapySlot[]>({
    queryKey: [
      '/api/therapy-slots', 
      date || 'all',
      showActiveOnly ? 'active' : 'all',
      showAvailableOnly ? 'available' : 'all'
    ],
    queryFn: async () => {
      let endpoint = '/api/therapy-slots';
      const params = new URLSearchParams();
      
      if (date) {
        // Jika date sudah dalam format string 'yyyy-MM-dd', gunakan langsung
        // Jika date dalam format Date object, gunakan format()
        const dateValue = typeof date === 'string' ? date : format(date as Date, 'yyyy-MM-dd');
        params.append('date', dateValue);
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
      if (!response.ok) throw new Error('Failed to fetch therapy slots');
      return response.json();
    },
  });

  // Mutation untuk membuat slot terapi baru
  const createSlotMutation = useMutation({
    mutationFn: async (data: TherapySlotFormValues) => {
      const res = await fetch("/api/therapy-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create therapy slot');
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
        throw new Error('Failed to update slot status');
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
        throw new Error(errorData.message || 'Failed to delete therapy slot');
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
      if (!res.ok) throw new Error('Failed to create therapy slot');
      return res.json();
    })
    .then(() => {
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
  
  // Handler untuk submit edit form
  const onSubmitEdit = (data: TherapySlotFormValues) => {
    if (!selectedSlot) return;
    
    // Debugging: Periksa tanggal input yang diterima dari form
    console.log("------------ DEBUGGING EDIT FORM SUBMISSION ------------");
    console.log("Tanggal dari form edit (raw):", data.date);
    console.log("Tipe data tanggal edit:", typeof data.date);
    
    if (data.date instanceof Date) {
      console.log("Edit - Date object toString():", data.date.toString());
      console.log("Edit - Date object toISOString():", data.date.toISOString());
      console.log("Edit - Tahun:", data.date.getFullYear());
      console.log("Edit - Bulan:", data.date.getMonth() + 1); // +1 karena getMonth() dimulai dari 0
      console.log("Edit - Tanggal:", data.date.getDate());
      console.log("Edit - Local timezone offset (menit):", data.date.getTimezoneOffset());
    }
    
    // Gabungkan startTime dan endTime menjadi timeSlot
    const timeSlot = `${data.startTime}-${data.endTime}`;
    console.log("Edit - Time slot:", timeSlot);
    
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
    
    console.log("Edit - Date setelah manual formatting:", dateString);
    console.log("Edit - Updating date as string format:", dateString);
    console.log("------------ END DEBUGGING EDIT FORM SUBMISSION ------------");
    
    // Kirim request update
    fetch(`/api/therapy-slots/${selectedSlot.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: dateString, // Kirim format string YYYY-MM-DD yang dihasilkan manual
        timeSlot: timeSlot,
        maxQuota: data.maxQuota,
        isActive: data.isActive
      })
    })
    .then(res => {
      if (!res.ok) throw new Error('Failed to update therapy slot');
      return res.json();
    })
    .then(() => {
      queryClient.invalidateQueries({ queryKey: ['/api/therapy-slots'] });
      toast({
        title: "Berhasil!",
        description: "Slot terapi telah diperbarui.",
      });
      setEditDialogOpen(false);
      setSelectedSlot(null);
    })
    .catch(error => {
      toast({
        title: "Gagal memperbarui slot terapi",
        description: error.message,
        variant: "destructive",
      });
    });
  };

  // Format tanggal untuk ditampilkan
  const formatSlotDate = (dateStr: string) => {
    return formatDateDDMMYYYY(dateStr);
  };

  // Quick actions untuk membuat batch slot
  const quickActions = [
    { days: 7, label: "7 hari", timeSlots: [
      { time: "10:00-11:00", quota: 5 },
      { time: "11:00-12:00", quota: 5 },
      { time: "13:00-14:00", quota: 5 },
      { time: "15:00-16:00", quota: 5 },
      { time: "16:00-17:00", quota: 5 }
    ]},
    { days: 14, label: "14 hari", timeSlots: [
      { time: "10:00-11:00", quota: 5 },
      { time: "11:00-12:00", quota: 5 },
      { time: "13:00-14:00", quota: 5 },
      { time: "15:00-16:00", quota: 5 },
      { time: "16:00-17:00", quota: 5 }
    ]},
    { days: 30, label: "30 hari", timeSlots: [
      { time: "10:00-11:00", quota: 5 },
      { time: "11:00-12:00", quota: 5 },
      { time: "13:00-14:00", quota: 5 },
      { time: "15:00-16:00", quota: 5 },
      { time: "16:00-17:00", quota: 5 }
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
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
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
                              console.log("============= CALENDAR EDIT DEBUG =============");
                              console.log("Raw date yang dipilih dari calendar (edit):", date);
                              console.log("toString():", date.toString());
                              console.log("toISOString():", date.toISOString());
                              console.log("Timezone offset (menit):", date.getTimezoneOffset());
                              
                              // Gunakan fixTimezone untuk mendapatkan string tanggal yang konsisten
                              const dateString = fixTimezone(date);
                              
                              console.log("Calendar (edit): date setelah fixTimezone:", dateString);
                              console.log("============= END CALENDAR EDIT DEBUG =============");
                              
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
                <Button type="submit">
                  Simpan Perubahan
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <div className="container mx-auto py-6 px-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h3 className="text-lg font-medium">Manajemen Slot Terapi</h3>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Button 
              variant="default" 
              onClick={() => setBatchDialogOpen(true)}
              className="flex-1 sm:flex-none h-12 sm:h-10"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              <span className="whitespace-nowrap">Buat Slot Batch</span>
            </Button>
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
                                    console.log("============= CALENDAR DEBUG =============");
                                    console.log("Raw date yang dipilih dari calendar:", date);
                                    console.log("toString():", date.toString());
                                    console.log("toISOString():", date.toISOString());
                                    console.log("Timezone offset (menit):", date.getTimezoneOffset());
                                    
                                    // Gunakan fixTimezone untuk mendapatkan string tanggal yang konsisten
                                    const dateString = fixTimezone(date);
                                    
                                    console.log("Calendar: date setelah fixTimezone:", dateString);
                                    console.log("============= END CALENDAR DEBUG =============");
                                    
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
            {/* Kosongkan - sudah di-render di bagian bawah */}
            <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/therapy-slots'] })}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
        
        <Tabs defaultValue="calendar">
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
                        console.log("============= CALENDAR MAIN DEBUG =============");
                        console.log("Raw date yang dipilih dari calendar main:", selectedDate);
                        console.log("toString():", selectedDate.toString());
                        console.log("toISOString():", selectedDate.toISOString());
                        console.log("Timezone offset (menit):", selectedDate.getTimezoneOffset());
                        
                        // Gunakan fixTimezone untuk mendapatkan string tanggal yang konsisten
                        const dateString = fixTimezone(selectedDate);
                        
                        console.log("Calendar (main): date setelah fixTimezone:", dateString);
                        console.log("============= END CALENDAR MAIN DEBUG =============");
                        
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
                        onClick={() => {
                          fetch('/api/therapy-slots/sync-quota', {
                            method: 'POST',
                            headers: {
                              'Cache-Control': 'no-cache, no-store, must-revalidate',
                              'Pragma': 'no-cache'
                            }
                          })
                          .then(async res => {
                            if (res.ok) {
                              // Invalidate all therapy slots queries to force refresh
                              queryClient.invalidateQueries({ queryKey: ['/api/therapy-slots'] });
                              
                              // Also refresh available slots that might be used in registration form
                              queryClient.invalidateQueries({ queryKey: ['/api/therapy-slots', 'available-active'] });
                              
                              toast({
                                title: "Sinkronisasi Berhasil",
                                description: "Kuota slot terapi telah disinkronisasi dengan janji temu"
                              });
                            } else {
                              const error = await res.json();
                              throw new Error(error.message || "Gagal melakukan sinkronisasi kuota");
                            }
                          })
                          .catch(err => {
                            toast({
                              title: "Gagal Sinkronisasi",
                              description: err.message,
                              variant: "destructive"
                            });
                          });
                        }}
                      >
                        Sinkronisasi Kuota Slot
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        className="h-12 sm:h-10"
                        onClick={async () => {
                          try {
                            // Gunakan endpoint yang benar
                            const response = await fetch('/api/appointments/resync', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json'
                              },
                              credentials: 'include'
                            });
                            
                            // Periksa format respons
                            const contentType = response.headers.get("content-type");
                            
                            if (response.ok) {
                              let result;
                              if (contentType && contentType.includes("application/json")) {
                                result = await response.json();
                                console.log("Hasil sinkronisasi:", result);
                                
                                // Refresh data setelah sinkronisasi
                                queryClient.invalidateQueries({ queryKey: ['/api/therapy-slots'] });
                                queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
                                
                                toast({
                                  title: "Sinkronisasi Appointment Berhasil",
                                  description: `${result.result?.fixed || 0} appointment diperbaiki`
                                });
                              } else {
                                // Jika respons bukan JSON
                                toast({
                                  title: "Sinkronisasi Berhasil",
                                  description: "Data appointment telah disinkronkan"
                                });
                              }
                            } else {
                              let errorMessage = "Gagal melakukan sinkronisasi appointment";
                              
                              if (contentType && contentType.includes("application/json")) {
                                const errorData = await response.json();
                                if (errorData && errorData.message) {
                                  errorMessage = errorData.message;
                                }
                              } else {
                                const errorText = await response.text();
                                if (errorText) {
                                  errorMessage = errorText;
                                }
                              }
                              
                              throw new Error(errorMessage);
                            }
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
                        Sinkronisasi Tanggal Appointment
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
                  Daftar lengkap semua slot terapi
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-6">
                    <RefreshCw className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
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
                      {therapySlots.map((slot) => (
                        <TableRow key={slot.id}>
                          <TableCell>{formatSlotDate(slot.date.toString())}</TableCell>
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
    </>
  );
}
