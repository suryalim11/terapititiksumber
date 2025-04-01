import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { format, addDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TherapySlot } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
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
import { CalendarIcon, PlusCircle, RefreshCw, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
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

  // Query untuk mendapatkan slot terapi
  const { data: therapySlots = [], isLoading } = useQuery<TherapySlot[]>({
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
  const createBatchSlots = async (days: number, timeSlot: string, maxQuota: number) => {
    try {
      const baseDate = date || new Date();
      const creationPromises = [];

      for (let i = 0; i < days; i++) {
        const slotDate = addDays(baseDate, i);
        const slotData = {
          date: slotDate,
          timeSlot,
          maxQuota,
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
        description: `${days} slot terapi baru telah dibuat.`,
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
    // Gabungkan startTime dan endTime menjadi timeSlot
    const timeSlot = `${data.startTime}-${data.endTime}`;
    
    // Menggunakan fetch API langsung karena mutation tidak mendukung properti timeSlot
    fetch("/api/therapy-slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: data.date,
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

  // Format tanggal untuk ditampilkan
  const formatSlotDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, "dd MMMM yyyy");
  };

  // Quick actions untuk membuat batch slot
  const quickActions = [
    { days: 7, label: "7 hari", timeSlot: "10:00-11:00", quota: 6 },
    { days: 14, label: "14 hari", timeSlot: "10:00-11:00", quota: 6 },
    { days: 30, label: "30 hari", timeSlot: "10:00-11:00", quota: 6 },
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
                    selected={date}
                    onSelect={setDate}
                    className="rounded-md border"
                  />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>
                    Slot Terapi: {date && format(date, "dd MMMM yyyy")}
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
                        <p>Waktu: {action.timeSlot}</p>
                        <p>Kuota: {action.quota} orang per sesi</p>
                        <p>Mulai dari: {date ? format(date, "dd MMMM yyyy") : "hari ini"}</p>
                      </CardContent>
                      <CardFooter>
                        <Button 
                          className="w-full"
                          onClick={() => createBatchSlots(action.days, action.timeSlot, action.quota)}
                        >
                          Buat {action.days} Hari
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
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