import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { id } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
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
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

type Appointment = {
  id: number;
  patientId: number;
  sessionId?: number;
  date: string;
  status: string;
  notes?: string;
  patient?: {
    id: number;
    name: string;
    patientId: string;
  };
  session?: {
    id: number;
    sessionsUsed: number;
    totalSessions: number;
  };
};

type TimeSlot = {
  hour: number;
  minute: number;
  formatted: string;
  available: boolean;
};

// Form schema
const appointmentFormSchema = z.object({
  patientId: z.string().min(1, "Pilih pasien terlebih dahulu"),
  sessionId: z.string().optional(),
  date: z.date({ required_error: "Pilih tanggal terlebih dahulu" }),
  time: z.string().min(1, "Pilih waktu terlebih dahulu"),
  notes: z.string().optional(),
});

type AppointmentFormValues = z.infer<typeof appointmentFormSchema>;

export default function Schedule() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isAppointmentFormOpen, setIsAppointmentFormOpen] = useState(false);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const { toast } = useToast();

  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: {
      patientId: "",
      sessionId: "",
      date: new Date(),
      time: "",
      notes: "",
    },
  });

  // Fetch patients
  const { data: patients } = useQuery({
    queryKey: ["/api/patients"],
  });

  // Fetch active sessions
  const { data: activeSessions } = useQuery({
    queryKey: ["/api/sessions?active=true"],
  });

  // Fetch appointments for selected date
  const { data: appointments, isLoading: isLoadingAppointments } = useQuery({
    queryKey: [`/api/appointments?date=${format(selectedDate, 'yyyy-MM-dd')}`],
  });

  // Generate time slots
  useEffect(() => {
    const slots: TimeSlot[] = [];
    for (let hour = 8; hour <= 17; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        if (hour === 17 && minute > 0) continue; // Stop at 17:00
        
        const formattedHour = hour.toString().padStart(2, "0");
        const formattedMinute = minute.toString().padStart(2, "0");
        const formatted = `${formattedHour}:${formattedMinute}`;
        
        // Check if slot is available
        let available = true;
        if (appointments) {
          const appointmentExists = appointments.some((appointment: Appointment) => {
            const appointmentDate = new Date(appointment.date);
            return (
              appointmentDate.getHours() === hour && 
              appointmentDate.getMinutes() === minute
            );
          });
          available = !appointmentExists;
        }
        
        slots.push({ hour, minute, formatted, available });
      }
    }
    setTimeSlots(slots);
  }, [appointments, selectedDate]);

  // Create appointment mutation
  const createAppointment = async (values: AppointmentFormValues) => {
    try {
      const appointmentDate = new Date(values.date);
      const [hours, minutes] = values.time.split(':').map(Number);
      appointmentDate.setHours(hours, minutes, 0, 0);
      
      const appointmentData = {
        patientId: parseInt(values.patientId),
        sessionId: values.sessionId ? parseInt(values.sessionId) : undefined,
        date: appointmentDate.toISOString(),
        notes: values.notes,
      };
      
      await apiRequest("POST", "/api/appointments", appointmentData);
      
      // Invalidate queries to refetch data
      await queryClient.invalidateQueries({ queryKey: [`/api/appointments?date=${format(selectedDate, 'yyyy-MM-dd')}`] });
      
      toast({
        title: "Jadwal berhasil dibuat",
        description: "Jadwal terapi telah berhasil ditambahkan",
      });
      
      setIsAppointmentFormOpen(false);
      form.reset();
    } catch (error: any) {
      toast({
        title: "Gagal membuat jadwal",
        description: error.message || "Terjadi kesalahan saat membuat jadwal",
        variant: "destructive",
      });
    }
  };

  // Handle date selection
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
    }
  };

  // Get appointment status class
  const getAppointmentStatusClass = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 dark:bg-green-900 dark:bg-opacity-20 border-green-500 text-green-800 dark:text-green-300";
      case "cancelled":
        return "bg-red-100 dark:bg-red-900 dark:bg-opacity-20 border-red-500 text-red-800 dark:text-red-300";
      default:
        return "bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 border-blue-500 text-blue-800 dark:text-blue-300";
    }
  };

  // Generate week day headers
  const generateWeekDays = () => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Start from Monday
    const days = [];
    
    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i);
      days.push(day);
    }
    
    return days;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold font-heading text-gray-900 dark:text-white">
            Jadwal
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Kelola jadwal terapi dan kunjungan pasien
          </p>
        </div>
        <Button
          onClick={() => setIsAppointmentFormOpen(true)}
          className="flex items-center gap-1"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          Tambah Jadwal
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-xl font-heading">Kalender</CardTitle>
            <CardDescription>
              Pilih tanggal untuk melihat jadwal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              className="rounded-md border"
            />
          </CardContent>
        </Card>

        {/* Daily Schedule */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-xl font-heading">
              Jadwal: {format(selectedDate, "EEEE, d MMMM yyyy", { locale: id })}
            </CardTitle>
            <CardDescription>
              Daftar semua jadwal terapi untuk tanggal yang dipilih
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingAppointments ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : !appointments || appointments.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                Tidak ada jadwal untuk tanggal ini
              </div>
            ) : (
              <div className="space-y-3">
                {appointments.map((appointment: Appointment) => {
                  const appointmentDate = new Date(appointment.date);
                  const timeString = format(appointmentDate, "HH:mm");
                  const patient = appointment.patient || { name: "Pasien" };
                  
                  return (
                    <div 
                      key={appointment.id} 
                      className={cn(
                        "p-3 border-l-4 rounded-r-lg",
                        getAppointmentStatusClass(appointment.status)
                      )}
                    >
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-semibold">
                          {patient.name}
                        </span>
                        <span className="text-xs font-medium">
                          {timeString}
                        </span>
                      </div>
                      <p className="text-xs">
                        {appointment.session 
                          ? `Terapi Sesi #${appointment.session.sessionsUsed + 1} (${appointment.session.totalSessions > 1 ? `Paket ${appointment.session.totalSessions} Sesi` : 'Sesi Tunggal'})`
                          : "Konsultasi"}
                      </p>
                      {appointment.notes && (
                        <p className="text-xs mt-1 italic">
                          "{appointment.notes}"
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Appointment Dialog */}
      <Dialog open={isAppointmentFormOpen} onOpenChange={setIsAppointmentFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold font-heading">Tambah Jadwal Baru</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(createAppointment)} className="space-y-4">
              <FormField
                control={form.control}
                name="patientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pasien</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih pasien..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {patients?.map((patient: any) => (
                          <SelectItem key={patient.id} value={patient.id.toString()}>
                            {patient.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sessionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sesi Terapi (opsional)</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih sesi terapi..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Tanpa sesi terapi</SelectItem>
                        {form.watch("patientId") && activeSessions
                          ? activeSessions
                              .filter((session: any) => 
                                session.patientId === parseInt(form.watch("patientId")) &&
                                session.sessionsUsed < session.totalSessions
                              )
                              .map((session: any) => (
                                <SelectItem key={session.id} value={session.id.toString()}>
                                  Paket {session.totalSessions} Sesi (Sesi ke-{session.sessionsUsed + 1})
                                </SelectItem>
                              ))
                          : null}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tanggal</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          value={field.value ? format(field.value, "yyyy-MM-dd") : ""}
                          onChange={(e) => {
                            const date = e.target.value ? new Date(e.target.value) : undefined;
                            if (date) {
                              field.onChange(date);
                              setSelectedDate(date);
                            }
                          }}
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
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih waktu..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {timeSlots.map((slot, index) => (
                            <SelectItem
                              key={index}
                              value={slot.formatted}
                              disabled={!slot.available}
                            >
                              {slot.formatted} {!slot.available && "(Terisi)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Catatan (opsional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Tambahkan catatan untuk jadwal ini..."
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAppointmentFormOpen(false)}
                >
                  Batal
                </Button>
                <Button type="submit">Simpan Jadwal</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
