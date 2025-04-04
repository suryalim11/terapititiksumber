import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { format, addDays, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TherapySlot } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { formatDateDDMMYYYY } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
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
import { CalendarIcon, PencilIcon, PlusCircle, RefreshCw, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import Layout from "@/components/layout/layout";

// Form Schema
const therapySlotSchema = z.object({
  date: z.date({
    required_error: "Tanggal diperlukan",
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
  const [selectedSlot, setSelectedSlot] = useState<TherapySlot | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deletingSlotId, setDeletingSlotId] = useState<number | null>(null);

  // Form untuk membuat slot terapi baru
  const form = useForm<TherapySlotFormValues>({
    resolver: zodResolver(therapySlotSchema),
    defaultValues: {
      date: new Date(),
      startTime: "10:00",
      endTime: "11:00",
      maxQuota: 6,
      isActive: true,
    },
  });
  
  // Form untuk mengedit slot terapi
  const editForm = useForm<TherapySlotFormValues>({
    resolver: zodResolver(therapySlotSchema),
    defaultValues: {
      date: new Date(),
      startTime: "10:00",
      endTime: "11:00",
      maxQuota: 6,
      isActive: true,
    },
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
      // Pastikan kita menggunakan Date object di sini untuk perhitungan
      const baseDate = typeof date === 'string' ? parseISO(date) : (date || new Date());
      const creationPromises = [];

      for (let i = 0; i < days; i++) {
        const slotDate = addDays(baseDate, i);
        
        // Skip Sundays (0 = Sunday, 1 = Monday, etc.)
        if (slotDate.getDay() === 0) continue;
        
        // Konversi ke string format 'yyyy-MM-dd'
        const slotDateString = format(slotDate, 'yyyy-MM-dd');
        
        // Create all time slots for this day
        for (const slot of timeSlots) {
          const slotData = {
            date: slotDateString, // Kirim string, bukan Date object
            timeSlot: slot.time,
            maxQuota: slot.quota,
            isActive: true,
          };

          creationPromises.push(
            fetch("/api/therapy-slots", {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(slotData)
            })
          );
        }
      }

      const results = await Promise.all(creationPromises);
      
      // Check if any request failed
      for (const res of results) {
        if (!res.ok) {
          throw new Error('Failed to create one or more therapy slots');
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/therapy-slots'] });
      toast({
        title: "Berhasil!",
        description: `Slot terapi untuk ${days} hari ke depan telah dibuat.`,
      });
    } catch (error) {
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
    
    // PERBAIKAN: Gunakan Date.UTC untuk mengatasi masalah timezone
    let yearMonthDay;
    
    if (typeof data.date === 'string') {
      // String format sudah benar, gunakan langsung
      yearMonthDay = data.date; 
      console.log("Menggunakan string date langsung:", yearMonthDay);
    } else if (data.date instanceof Date) {
      // Ekstrak tahun, bulan, tanggal tanpa timezone offset
      const year = data.date.getFullYear();
      const month = data.date.getMonth() + 1; // +1 karena getMonth() dimulai dari 0
      const day = data.date.getDate();
      
      // Format ke yyyy-MM-dd (pastikan bulan dan tanggal selalu 2 digit)
      yearMonthDay = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      console.log("Dikonversi dari Date object:", yearMonthDay);
    } else {
      console.error("Tipe tanggal tidak dikenali:", typeof data.date);
      yearMonthDay = format(new Date(), 'yyyy-MM-dd'); // Fallback ke hari ini
    }
    
    console.log("Submitting date as string format:", yearMonthDay);
    console.log("------------ END DEBUGGING FORM SUBMISSION ------------");
    
    // Menggunakan fetch API langsung karena mutation tidak mendukung properti timeSlot
    fetch("/api/therapy-slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: yearMonthDay, // Kirim format string sederhana
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
    
    // PERBAIKAN: Gunakan cara yang sama dengan onSubmit
    let yearMonthDay;
    
    if (typeof data.date === 'string') {
      // String format sudah benar, gunakan langsung
      yearMonthDay = data.date; 
      console.log("Edit - Menggunakan string date langsung:", yearMonthDay);
    } else if (data.date instanceof Date) {
      // Ekstrak tahun, bulan, tanggal tanpa timezone offset
      const year = data.date.getFullYear();
      const month = data.date.getMonth() + 1; // +1 karena getMonth() dimulai dari 0
      const day = data.date.getDate();
      
      // Format ke yyyy-MM-dd (pastikan bulan dan tanggal selalu 2 digit)
      yearMonthDay = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      console.log("Edit - Dikonversi dari Date object:", yearMonthDay);
    } else {
      console.error("Edit - Tipe tanggal tidak dikenali:", typeof data.date);
      yearMonthDay = format(new Date(), 'yyyy-MM-dd'); // Fallback ke hari ini
    }
    
    console.log("Edit - Updating date as string format:", yearMonthDay);
    console.log("------------ END DEBUGGING EDIT FORM SUBMISSION ------------");
    
    // Kirim request update
    fetch(`/api/therapy-slots/${selectedSlot.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: yearMonthDay, // Kirim format string sederhana
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
                              console.log("getFullYear():", date.getFullYear());
                              console.log("getMonth() (0-based):", date.getMonth());
                              console.log("getDate():", date.getDate());
                              
                              // Konversi Date ke string format YYYY-MM-DD sebelum update field
                              const year = date.getFullYear();
                              const month = date.getMonth() + 1; // +1 karena getMonth() dimulai dari 0
                              const day = date.getDate();
                              
                              // Format ke yyyy-MM-dd (pastikan bulan dan tanggal selalu 2 digit)
                              const dateString = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                              
                              console.log("Calendar (edit): selected date converted to string format:", dateString);
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
      
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium">Manajemen Slot Terapi</h3>
          <div className="flex gap-2">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Tambah Slot Baru
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
                                    console.log("getFullYear():", date.getFullYear());
                                    console.log("getMonth() (0-based):", date.getMonth());
                                    console.log("getDate():", date.getDate());
                                    
                                    // Konversi Date ke string format YYYY-MM-DD sebelum update field
                                    const year = date.getFullYear();
                                    const month = date.getMonth() + 1; // +1 karena getMonth() dimulai dari 0
                                    const day = date.getDate();
                                    
                                    // Format ke yyyy-MM-dd (pastikan bulan dan tanggal selalu 2 digit)
                                    const dateString = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                                    
                                    console.log("Calendar: selected date converted to string format:", dateString);
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
                        console.log("getFullYear():", selectedDate.getFullYear());
                        console.log("getMonth() (0-based):", selectedDate.getMonth());
                        console.log("getDate():", selectedDate.getDate());
                        
                        // Konversi Date ke string format YYYY-MM-DD sebelum update field
                        const year = selectedDate.getFullYear();
                        const month = selectedDate.getMonth() + 1; // +1 karena getMonth() dimulai dari 0
                        const day = selectedDate.getDate();
                        
                        // Format ke yyyy-MM-dd (pastikan bulan dan tanggal selalu 2 digit)
                        const dateString = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                        
                        console.log("Calendar (main): selected date converted to string format:", dateString);
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
                        Tambahkan Slot Baru
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
                          className="mt-4"
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
                        onClick={() => {
                          fetch('/api/therapy-slots/sync-quota', {
                            method: 'POST'
                          })
                          .then(async res => {
                            if (res.ok) {
                              queryClient.invalidateQueries({ queryKey: ['/api/therapy-slots'] });
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
                        onClick={() => {
                          fetch('/api/resync-appointments', {
                            method: 'POST'
                          })
                          .then(async res => {
                            if (res.ok) {
                              const result = await res.json();
                              console.log("Hasil sinkronisasi:", result);
                              queryClient.invalidateQueries({ queryKey: ['/api/therapy-slots'] });
                              queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
                              toast({
                                title: "Sinkronisasi Appointment Berhasil",
                                description: `${result.result.fixed} appointment diperbaiki`
                              });
                            } else {
                              const error = await res.json();
                              throw new Error(error.message || "Gagal melakukan sinkronisasi appointment");
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
        </Tabs>
      </div>
    </>
  );
}