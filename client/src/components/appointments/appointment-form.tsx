import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { insertAppointmentSchema } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { generateTimeSlots } from "@/lib/utils";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DialogClose } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";

// Extend the appointment schema with form validations
const appointmentFormSchema = insertAppointmentSchema.extend({
  patientId: z.number({
    required_error: "Pilih pasien terlebih dahulu",
  }),
  date: z.string({
    required_error: "Pilih tanggal janji temu",
  }).refine((date) => {
    // Make sure the date is in the future
    const appointmentDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return appointmentDate >= today;
  }, {
    message: "Tanggal janji temu harus di masa depan",
  }),
  time: z.string({
    required_error: "Pilih waktu janji temu",
  }),
  status: z.string().default("scheduled"),
  notes: z.string().optional().or(z.literal("")),
  sessionId: z.number().optional(),
});

type AppointmentFormValues = z.infer<typeof appointmentFormSchema>;

interface AppointmentFormProps {
  onSuccess?: () => void;
  defaultValues?: Partial<AppointmentFormValues>;
  isEditing?: boolean;
  appointmentId?: number;
}

export function AppointmentForm({ 
  onSuccess, 
  defaultValues, 
  isEditing = false,
  appointmentId
}: AppointmentFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  
  // Generate time slots from 8 AM to 5 PM in 30-minute intervals
  const allTimeSlots = generateTimeSlots(8, 17, 30);

  // Fetch patients for the dropdown
  const { data: patients = [] } = useQuery<any[]>({
    queryKey: ['/api/patients'],
  });

  // Fetch active therapy sessions for the selected patient
  const { data: sessions = [] } = useQuery<any[]>({
    queryKey: ['/api/sessions', selectedPatientId],
    enabled: !!selectedPatientId,
  });

  // Fetch appointments for the selected date to check for conflicts
  const { data: dateAppointments = [] } = useQuery<any[]>({
    queryKey: ['/api/appointments/date', selectedDate],
    enabled: !!selectedDate,
  });

  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: defaultValues || {
      patientId: 0,
      date: "",
      time: "",
      status: "scheduled",
      notes: "",
    },
  });

  // When patient is selected, store the ID
  useEffect(() => {
    const patientId = form.watch("patientId");
    if (patientId) {
      setSelectedPatientId(patientId);
    }
  }, [form.watch("patientId")]);

  // When date is selected, update available times
  useEffect(() => {
    const date = form.watch("date");
    if (date) {
      setSelectedDate(date);
      
      // Filter out times that are already booked
      const bookedTimes = (dateAppointments as any[]).map((appointment) => appointment.time);
      const availableSlots = allTimeSlots.filter(time => !bookedTimes.includes(time));
      
      setAvailableTimes(availableSlots);
    }
  }, [form.watch("date"), dateAppointments]);

  // Update form with default values when provided
  useEffect(() => {
    if (defaultValues) {
      Object.entries(defaultValues).forEach(([key, value]) => {
        if (value !== undefined) {
          console.log(`Setting form value for ${key}:`, value);
          form.setValue(key as any, value as any);
        }
      });
      
      if (defaultValues.patientId) {
        setSelectedPatientId(defaultValues.patientId);
      }
      
      if (defaultValues.date) {
        setSelectedDate(defaultValues.date);
      }
    }
  }, [defaultValues, form]);

  async function onSubmit(values: AppointmentFormValues) {
    try {
      console.log("Form submission started with values:", values);
      
      // Validasi form terlebih dahulu
      if (!values.patientId) {
        toast({
          title: "Data tidak lengkap",
          description: "Pastikan Anda memilih pasien",
          variant: "destructive",
        });
        return;
      }

      if (!values.date || !values.time) {
        toast({
          title: "Data tidak lengkap",
          description: "Pastikan Anda memilih tanggal dan waktu",
          variant: "destructive",
        });
        return;
      }
      
      // Combine date and time
      const combinedDate = new Date(`${values.date}T${values.time}`);
      
      // Make sure the request body doesn't include the time field
      const { time, ...requestData } = values;
      const requestBody = {
        ...requestData,
        date: combinedDate.toISOString(),
      };
      
      console.log("Mengirim data jadwal:", requestBody);

      if (isEditing && appointmentId) {
        await apiRequest(`/api/appointments/${appointmentId}`, {
          method: "PUT",
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody),
        });
        
        toast({
          title: "Janji temu diperbarui",
          description: "Data janji temu berhasil diperbarui",
        });
      } else {
        const response = await apiRequest("/api/appointments", {
          method: "POST",
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody),
        });
        
        console.log("Appointment response:", response);
        
        toast({
          title: "Janji temu baru dibuat",
          description: "Janji temu berhasil dijadwalkan",
        });
      }
      
      // Invalidate appointments queries to refetch the data
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      
      // Reset form
      form.reset();
      
      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error("Error saving appointment:", error);
      toast({
        title: "Gagal menyimpan data",
        description: error.message || "Terjadi kesalahan, silakan coba lagi",
        variant: "destructive",
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="patientId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pasien</FormLabel>
              <Select
                onValueChange={(value) => field.onChange(parseInt(value))}
                defaultValue={field.value ? String(field.value) : undefined}
              >
                <FormControl>
                  <SelectTrigger className="h-12 sm:h-10">
                    <SelectValue placeholder="Pilih pasien" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {(patients as any[]).map((patient) => (
                    <SelectItem key={patient.id} value={String(patient.id)}>
                      {patient.name} ({patient.patientId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tanggal</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    className="h-12 sm:h-10"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Waktu</FormLabel>
                <Select 
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={!selectedDate || availableTimes.length === 0}
                >
                  <FormControl>
                    <SelectTrigger className="h-12 sm:h-10">
                      <SelectValue placeholder={
                        !selectedDate ? "Pilih tanggal terlebih dahulu" : 
                        availableTimes.length === 0 ? "Tidak ada slot tersedia" : 
                        "Pilih waktu"
                      } />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableTimes.map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        {selectedPatientId && sessions.length > 0 && (
          <FormField
            control={form.control}
            name="sessionId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sesi Terapi (Opsional)</FormLabel>
                <Select 
                  onValueChange={(value) => field.onChange(parseInt(value))}
                  defaultValue={field.value ? String(field.value) : undefined}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih sesi terapi" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="">Tanpa sesi terapi</SelectItem>
                    {(sessions as any[]).map((session) => (
                      <SelectItem key={session.id} value={String(session.id)}>
                        Paket: {session.totalSessions} sesi (Terpakai: {session.sessionsUsed})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Catatan (Opsional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Tambahkan catatan atau instruksi khusus" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
          <DialogClose asChild>
            <Button type="button" variant="outline" className="h-12 sm:h-10">
              Batal
            </Button>
          </DialogClose>
          <Button type="submit" disabled={form.formState.isSubmitting} className="h-12 sm:h-10">
            {form.formState.isSubmitting ? "Menyimpan..." : isEditing ? "Perbarui" : "Jadwalkan"}
          </Button>
        </div>
      </form>
    </Form>
  );
}