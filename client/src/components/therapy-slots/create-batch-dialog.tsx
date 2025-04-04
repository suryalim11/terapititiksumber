import { useState } from "react";
import { format, eachDayOfInterval } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, PlusCircle, RefreshCw, TrashIcon } from "lucide-react";
import { cn, fixTimezone, formatDateDDMMYYYY } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";

// Validasi untuk form
const slotTimeSchema = z.object({
  startTime: z.string({
    required_error: "Waktu mulai diperlukan",
  }),
  endTime: z.string({
    required_error: "Waktu selesai diperlukan",
  }),
  quota: z.coerce.number().int().min(1, {
    message: "Kuota minimal 1 orang",
  }),
});

const createBatchSchema = z.object({
  startDate: z.date({
    required_error: "Tanggal mulai diperlukan",
  }),
  endDate: z.date({
    required_error: "Tanggal selesai diperlukan",
  }).refine(
    (endDate) => {
      return true; // Validasi dilakukan dalam bentuk fungsi berikutnya
    },
    {
      message: "Tanggal selesai harus setelah atau sama dengan tanggal mulai",
    }
  ),
  slots: z.preprocess(
    (val) => Array.isArray(val) ? val : [],
    z.array(slotTimeSchema).nonempty({
      message: "Minimal harus ada 1 slot waktu",
    }).max(3, {
      message: "Maksimal 3 slot waktu",
    })
  ),
  isActive: z.boolean().default(true),
});

type SlotTimeValues = z.infer<typeof slotTimeSchema>;
type CreateBatchFormValues = z.infer<typeof createBatchSchema>;

// Props untuk komponen
type CreateBatchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// Komponen utama
export function CreateBatchDialog({ open, onOpenChange }: CreateBatchDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const defaultSlots: SlotTimeValues[] = [
    { startTime: "10:00", endTime: "11:30", quota: 4 }
  ];
  
  const form = useForm<CreateBatchFormValues>({
    resolver: zodResolver(createBatchSchema),
    defaultValues: {
      startDate: new Date(),
      endDate: new Date(),
      slots: defaultSlots,
      isActive: true,
    },
    mode: "onChange"
  });

  // Mutation untuk membuat batch slot terapi
  const createBatchMutation = useMutation({
    mutationFn: async (data: CreateBatchFormValues) => {
      const dates = eachDayOfInterval({
        start: data.startDate,
        end: data.endDate,
      });

      // Buat array request untuk setiap kombinasi tanggal dan slot waktu
      const requests = [];
      
      for (const date of dates) {
        const formattedDate = fixTimezone(date);
        
        for (const slot of data.slots) {
          const timeSlot = `${slot.startTime}-${slot.endTime}`;
          
          requests.push({
            date: formattedDate,
            timeSlot: timeSlot,
            maxQuota: slot.quota,
            isActive: data.isActive
          });
        }
      }
      
      // Kirim semua request dalam satu batch
      const res = await fetch("/api/therapy-slots/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots: requests }),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Gagal membuat slot terapi batch');
      }
      
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/therapy-slots'] });
      toast({
        title: "Berhasil!",
        description: `${data.createdCount || 'Beberapa'} slot terapi telah dibuat.`,
      });
      onOpenChange(false);
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

  // Handler untuk menambah slot waktu baru
  const addSlot = () => {
    const currentSlots = form.getValues("slots");
    if (currentSlots.length >= 3) {
      toast({
        title: "Batas slot waktu",
        description: "Maksimal 3 slot waktu per hari",
        variant: "destructive",
      });
      return;
    }
    
    // Menggunakan spread operator untuk memastikan array tidak rusak
    const newSlot = { startTime: "13:00", endTime: "15:00", quota: 3 };
    form.setValue("slots", [...currentSlots, newSlot] as any);
  };

  // Handler untuk menghapus slot waktu
  const removeSlot = (index: number) => {
    const currentSlots = form.getValues("slots");
    if (currentSlots.length <= 1) {
      toast({
        description: "Minimal harus ada 1 slot waktu",
      });
      return;
    }
    
    let filteredSlots = currentSlots.filter((_, i) => i !== index);
    // Pastikan tidak kosong dengan menambahkan slot default jika perlu
    if (filteredSlots.length === 0) {
      filteredSlots = [{ startTime: "10:00", endTime: "11:30", quota: 4 }];
    }
    form.setValue("slots", filteredSlots as any);
  };

  // Handler submit form
  const onSubmit = (data: CreateBatchFormValues) => {
    createBatchMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Buat Slot Terapi Baru</DialogTitle>
          <DialogDescription>
            Buat slot terapi baru untuk rentang tanggal dengan beberapa waktu sekaligus.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Tanggal Mulai */}
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Tanggal Mulai</FormLabel>
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
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          locale={idLocale}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Tanggal Selesai */}
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Tanggal Selesai</FormLabel>
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
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          locale={idLocale}
                          disabled={(date) => 
                            form.getValues("startDate") && date < form.getValues("startDate")
                          }
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium">Daftar Waktu Slot (Maksimal 3 Slot)</h4>
                <Button type="button" variant="outline" size="sm" onClick={addSlot} 
                  disabled={form.getValues("slots").length >= 3}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Tambah Slot
                </Button>
              </div>
              
              <div className="space-y-4">
                {form.watch("slots").map((_, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h5 className="text-sm font-medium">Slot {index + 1}</h5>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => removeSlot(index)}
                          disabled={form.getValues("slots").length <= 1}
                        >
                          <TrashIcon className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Waktu Mulai */}
                        <FormField
                          control={form.control}
                          name={`slots.${index}.startTime`}
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
                        
                        {/* Waktu Selesai */}
                        <FormField
                          control={form.control}
                          name={`slots.${index}.endTime`}
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
                        
                        {/* Kuota Pasien */}
                        <FormField
                          control={form.control}
                          name={`slots.${index}.quota`}
                          render={({ field }) => (
                            <FormItem className="col-span-full">
                              <FormLabel>Kuota Pasien</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={1}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
            
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
                      Slot terapi ini dapat dipilih oleh pasien saat akan melakukan terapi.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={createBatchMutation.isPending}>
                {createBatchMutation.isPending && (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                )}
                Buat Slot
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}