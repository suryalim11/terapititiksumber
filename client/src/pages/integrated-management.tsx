import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { format, addDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TherapySlot } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { AuthContext } from "@/lib/auth";
import { useContext } from "react";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
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
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CalendarIcon, PencilIcon, PlusCircle, RefreshCw, Trash2, Copy, Link, MoreVertical } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

// Registration Link Types
interface RegistrationLink {
  id: number;
  code: string;
  expiryTime: string;
  dailyLimit: number;
  currentRegistrations: number;
  createdAt: string;
  isActive: boolean;
  createdBy: number;
  specificDate: string | null;
}

interface CreateLinkRequest {
  expiryHours: number;
  dailyLimit: number;
  specificDate?: string;
}

// Form Schema untuk Therapy Slot
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

export default function IntegratedManagement() {
  const auth = useContext(AuthContext);
  const isAuthenticated = auth.isAuthenticated;
  const user = auth.user;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State untuk therapy slots
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TherapySlot | null>(null);
  const [deletingSlotId, setDeletingSlotId] = useState<number | null>(null);

  // State untuk registration links
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [expiryHours, setExpiryHours] = useState(24);
  const [dailyLimit, setDailyLimit] = useState(10);
  const [specificDate, setSpecificDate] = useState<Date | null>(null);
  const [useSpecificDate, setUseSpecificDate] = useState(false);
  const [linkToDeactivate, setLinkToDeactivate] = useState<number | null>(null);
  const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState(false);
  const [linkToDelete, setLinkToDelete] = useState<number | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Form untuk membuat slot terapi baru
  const form = useForm<TherapySlotFormValues>({
    resolver: zodResolver(therapySlotSchema),
    defaultValues: {
      date: new Date(),
      startTime: "10:00",
      endTime: "11:30",
      maxQuota: 4,
      isActive: true,
    },
  });
  
  // Form untuk mengedit slot terapi
  const editForm = useForm<TherapySlotFormValues>({
    resolver: zodResolver(therapySlotSchema),
    defaultValues: {
      date: new Date(),
      startTime: "10:00",
      endTime: "11:30",
      maxQuota: 4,
      isActive: true,
    },
  });

  // Query untuk mendapatkan slot terapi
  const { data: therapySlots = [], isLoading: isLoadingSlots } = useQuery<TherapySlot[]>({
    queryKey: ['/api/therapy-slots', date ? format(date, 'yyyy-MM-dd') : 'all'],
    queryFn: async () => {
      const endpoint = date 
        ? `/api/therapy-slots?date=${format(date, 'yyyy-MM-dd')}` 
        : '/api/therapy-slots';
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Failed to fetch therapy slots');
      return response.json();
    },
  });

  // Query to fetch registration links
  const { data: links, isLoading: isLoadingLinks, error: linksError } = useQuery({
    queryKey: ['/api/registration-links'],
    enabled: isAuthenticated && user?.role === 'admin'
  });

  // Mutation untuk membuat slot terapi baru
  const createSlotMutation = useMutation({
    mutationFn: async (data: TherapySlotFormValues) => {
      const timeSlot = `${data.startTime}-${data.endTime}`;
      
      const res = await fetch("/api/therapy-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: data.date,
          timeSlot: timeSlot,
          maxQuota: data.maxQuota,
          isActive: data.isActive
        })
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

  // Mutation to create a new registration link
  const createLinkMutation = useMutation({
    mutationFn: async (data: CreateLinkRequest) => {
      return apiRequest('/api/registration-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/registration-links'] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Link Pendaftaran Berhasil Dibuat",
        description: "Link pendaftaran baru telah dibuat dan siap digunakan.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Gagal Membuat Link",
        description: error.message || "Terjadi kesalahan saat membuat link pendaftaran.",
      });
    }
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

  // Mutation to deactivate a registration link
  const deactivateLinkMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/registration-links/deactivate/${id}`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/registration-links'] });
      setIsDeactivateDialogOpen(false);
      toast({
        title: "Link Pendaftaran Dinonaktifkan",
        description: "Link pendaftaran berhasil dinonaktifkan.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Gagal Menonaktifkan Link",
        description: error.message || "Terjadi kesalahan saat menonaktifkan link pendaftaran.",
      });
    }
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
  
  // Mutation to delete a registration link
  const deleteLinkMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/registration-links/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/registration-links'] });
      setIsDeleteDialogOpen(false);
      toast({
        title: "Link Pendaftaran Dihapus",
        description: "Link pendaftaran berhasil dihapus permanen.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Gagal Menghapus Link",
        description: error.message || "Terjadi kesalahan saat menghapus link pendaftaran.",
      });
    }
  });

  // Membuat slot terapi untuk beberapa hari ke depan
  const createBatchSlots = async (days: number, timeSlots: {time: string, quota: number}[]) => {
    try {
      const baseDate = date || new Date();
      const creationPromises = [];

      for (let i = 0; i < days; i++) {
        const slotDate = addDays(baseDate, i);
        
        // Skip Sundays (0 = Sunday, 1 = Monday, etc.)
        if (slotDate.getDay() === 0) continue;
        
        // Create all time slots for this day
        for (const slot of timeSlots) {
          const slotData = {
            date: slotDate,
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

  // Handler untuk submit form slot terapi
  const onSubmit = (data: TherapySlotFormValues) => {
    // Gabungkan startTime dan endTime menjadi timeSlot
    createSlotMutation.mutate(data);
  };

  // Handler untuk submit form link pendaftaran
  const handleCreateLink = () => {
    if (expiryHours < 1 || expiryHours > 720) {
      toast({
        variant: "destructive",
        title: "Input Tidak Valid",
        description: "Durasi berlaku harus antara 1 jam sampai 30 hari (720 jam)",
      });
      return;
    }

    if (dailyLimit < 1 || dailyLimit > 100) {
      toast({
        variant: "destructive",
        title: "Input Tidak Valid",
        description: "Batas pendaftaran harian harus antara 1 hingga 100",
      });
      return;
    }

    const linkData: CreateLinkRequest = { expiryHours, dailyLimit };
    
    // Tambahkan tanggal spesifik jika diaktifkan
    if (useSpecificDate && specificDate) {
      linkData.specificDate = format(specificDate, 'yyyy-MM-dd');
    }

    createLinkMutation.mutate(linkData);
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
    
    // Gabungkan startTime dan endTime menjadi timeSlot
    const timeSlot = `${data.startTime}-${data.endTime}`;
    
    // Kirim request update
    fetch(`/api/therapy-slots/${selectedSlot.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: data.date,
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

  const copyLinkToClipboard = (code: string) => {
    const registrationLink = `${window.location.origin}/register?kode=${code}`;
    navigator.clipboard.writeText(registrationLink);
    toast({
      title: "Link Disalin",
      description: "Link pendaftaran berhasil disalin ke clipboard.",
    });
  };

  // Format tanggal untuk ditampilkan
  const formatSlotDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, "dd MMMM yyyy");
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd MMM yyyy, HH:mm");
    } catch (error) {
      return dateString;
    }
  };

  // Quick actions untuk membuat batch slot
  const quickActions = [
    { days: 7, label: "7 hari", timeSlots: [
      { time: "10:00-11:30", quota: 4 },
      { time: "12:30-14:00", quota: 4 },
      { time: "14:00-15:30", quota: 4 },
      { time: "15:30-17:00", quota: 5 }
    ]},
    { days: 14, label: "14 hari", timeSlots: [
      { time: "10:00-11:30", quota: 4 },
      { time: "12:30-14:00", quota: 4 },
      { time: "14:00-15:30", quota: 4 },
      { time: "15:30-17:00", quota: 5 }
    ]},
    { days: 30, label: "30 hari", timeSlots: [
      { time: "10:00-11:30", quota: 4 },
      { time: "12:30-14:00", quota: 4 },
      { time: "14:00-15:30", quota: 4 },
      { time: "15:30-17:00", quota: 5 }
    ]},
  ];

  // Check if user is authenticated and has admin role
  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-[420px]">
          <CardHeader>
            <CardTitle>Akses Tidak Diizinkan</CardTitle>
            <CardDescription>
              Anda harus login sebagai admin untuk mengakses halaman ini.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => window.location.href = "/"} className="w-full">
              Kembali ke Beranda
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Render komponen
  return (
    <>
      <Helmet>
        <title>Manajemen Pendaftaran | Terapi Titik Sumber</title>
      </Helmet>
      
      {/* AlertDialog untuk konfirmasi hapus slot */}
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
      
      {/* Deactivate Link Dialog */}
      <AlertDialog 
        open={isDeactivateDialogOpen} 
        onOpenChange={setIsDeactivateDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nonaktifkan Link Pendaftaran?</AlertDialogTitle>
            <AlertDialogDescription>
              Link yang sudah dinonaktifkan tidak dapat digunakan lagi untuk pendaftaran pasien baru.
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeactivateDialogOpen(false)}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (linkToDeactivate) {
                  deactivateLinkMutation.mutate(linkToDeactivate);
                }
              }}
              className="bg-amber-600 hover:bg-amber-700"
              disabled={deactivateLinkMutation.isPending}
            >
              {deactivateLinkMutation.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Menonaktifkan...
                </>
              ) : (
                "Nonaktifkan"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Delete Link Dialog */}
      <AlertDialog 
        open={isDeleteDialogOpen} 
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Link Pendaftaran?</AlertDialogTitle>
            <AlertDialogDescription>
              Link pendaftaran ini akan dihapus secara permanen dan tidak dapat dikembalikan.
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (linkToDelete) {
                  deleteLinkMutation.mutate(linkToDelete);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteLinkMutation.isPending}
            >
              {deleteLinkMutation.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Menghapus...
                </>
              ) : (
                "Hapus Permanen"
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
                              format(field.value, "PPP")
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
                          selected={field.value}
                          onSelect={field.onChange}
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
                      <Input type="time" {...field} />
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
                      <Input type="time" {...field} />
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
                      <Input type="number" min={1} {...field} />
                    </FormControl>
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
                        Slot terapi ini dapat dipilih oleh pasien saat pendaftaran.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Batal
                </Button>
                <Button type="submit">Simpan Perubahan</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Dialog untuk buat slot terapi */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buat Slot Terapi Baru</DialogTitle>
            <DialogDescription>
              Buat slot terapi baru untuk pasien.
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
                              format(field.value, "PPP")
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
                          selected={field.value}
                          onSelect={field.onChange}
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
                      <Input type="time" {...field} />
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
                      <Input type="time" {...field} />
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
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
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
                        Slot terapi ini dapat dipilih oleh pasien saat pendaftaran.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Batal
                </Button>
                <Button type="submit">Buat Slot</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

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
              <p className="text-sm text-muted-foreground col-span-4">
                Link akan kedaluwarsa setelah {expiryHours} jam (maks. 30 hari / 720 jam)
              </p>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="dailyLimit" className="col-span-4">
                Batas pendaftaran harian
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
              <p className="text-sm text-muted-foreground col-span-4">
                Maksimal {dailyLimit} pendaftaran per hari menggunakan link ini
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsCreateDialogOpen(false)}
            >
              Batal
            </Button>
            <Button 
              onClick={handleCreateLink}
              disabled={createLinkMutation.isPending}
            >
              {createLinkMutation.isPending ? "Membuat..." : "Buat Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="py-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Manajemen Pendaftaran</h1>
            <p className="text-gray-500">Kelola slot terapi dan link pendaftaran pasien</p>
          </div>
        </div>

        <Tabs defaultValue="slots" className="space-y-4">
          <TabsList>
            <TabsTrigger value="slots">Slot Terapi</TabsTrigger>
            <TabsTrigger value="links">Link Pendaftaran</TabsTrigger>
          </TabsList>
          
          {/* Tab Slot Terapi */}
          <TabsContent value="slots" className="space-y-4">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <div className="flex-1 flex flex-col sm:flex-row gap-2 min-w-[300px]">
                <div className="flex-1">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    className="border rounded-md"
                  />
                </div>
                <div className="flex-1 space-y-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Buat Slot Otomatis</CardTitle>
                      <CardDescription>
                        Buat slot terapi otomatis untuk beberapa hari mendatang
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-0">
                      {quickActions.map((action) => (
                        <Button 
                          key={action.days}
                          variant="outline" 
                          className="w-full justify-start"
                          onClick={() => createBatchSlots(action.days, action.timeSlots)}
                        >
                          <PlusCircle className="mr-2 h-4 w-4" />
                          Buat untuk {action.label} ke depan
                        </Button>
                      ))}
                    </CardContent>
                  </Card>
                  
                  <Button 
                    className="w-full" 
                    onClick={() => setDialogOpen(true)}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Buat Slot Manual
                  </Button>
                </div>
              </div>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Daftar Slot Terapi</CardTitle>
                <CardDescription>
                  {date ? `Slot terapi untuk tanggal ${format(date, "dd MMMM yyyy")}` : "Semua slot terapi"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingSlots ? (
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
                ) : therapySlots.length === 0 ? (
                  <div className="text-center py-8">
                    <h3 className="text-lg font-medium">Belum Ada Slot Terapi</h3>
                    <p className="text-gray-500 mt-2 mb-6">
                      Belum ada slot terapi untuk tanggal ini. Klik tombol "Buat Slot Manual" untuk membuat slot baru.
                    </p>
                    <Button 
                      onClick={() => setDialogOpen(true)}
                      className="mx-auto"
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Buat Slot Manual
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableCaption>Daftar slot terapi yang tersedia</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Waktu</TableHead>
                        <TableHead>Kuota</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {therapySlots.map((slot) => (
                        <TableRow key={slot.id}>
                          <TableCell>{formatSlotDate(String(slot.date))}</TableCell>
                          <TableCell>{slot.timeSlot}</TableCell>
                          <TableCell>
                            {slot.currentCount}/{slot.maxQuota}
                            {slot.currentCount >= slot.maxQuota && (
                              <Badge variant="destructive" className="ml-2">Penuh</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {slot.isActive ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-50">
                                Aktif
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-red-50 text-red-700 hover:bg-red-50">
                                Nonaktif
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(slot)}
                              >
                                <PencilIcon className="h-4 w-4" />
                                <span className="sr-only">Edit</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleToggleStatus(slot)}
                              >
                                {slot.isActive ? (
                                  <>
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="h-4 w-4 text-amber-500"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                                      />
                                    </svg>
                                    <span className="sr-only">Nonaktifkan</span>
                                  </>
                                ) : (
                                  <>
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="h-4 w-4 text-green-500"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                      />
                                    </svg>
                                    <span className="sr-only">Aktifkan</span>
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeletingSlotId(slot.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                                <span className="sr-only">Hapus</span>
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
          
          {/* Tab Link Pendaftaran */}
          <TabsContent value="links" className="space-y-4">
            <div className="flex justify-end">
              <Dialog>
                <DialogTrigger asChild>
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Buat Link Baru
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
                        <TableRow key={link.id}>
                          <TableCell className="font-medium">{link.code}</TableCell>
                          <TableCell>
                            {link.isActive ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-50">
                                Aktif
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-gray-100 text-gray-500 hover:bg-gray-100">
                                Nonaktif
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{formatDate(link.createdAt)}</TableCell>
                          <TableCell>{formatDate(link.expiryTime)}</TableCell>
                          <TableCell>{link.dailyLimit}</TableCell>
                          <TableCell>{link.currentRegistrations}/{link.dailyLimit}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Buka menu</span>
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => copyLinkToClipboard(link.code)}
                                  disabled={!link.isActive}
                                >
                                  <Copy className="mr-2 h-4 w-4" />
                                  Salin Link
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-amber-600"
                                  onClick={() => {
                                    setLinkToDeactivate(link.id);
                                    setIsDeactivateDialogOpen(true);
                                  }}
                                  disabled={!link.isActive}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Nonaktifkan
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => {
                                    setLinkToDelete(link.id);
                                    setIsDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Hapus Permanen
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <Link className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium">Belum Ada Link Pendaftaran</h3>
                    <p className="text-gray-500 mt-2 mb-6">
                      Anda belum membuat link pendaftaran. Klik tombol "Buat Link Baru" untuk membuat.
                    </p>
                    <Button 
                      onClick={() => setIsCreateDialogOpen(true)}
                      className="mx-auto"
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
    </>
  );
}