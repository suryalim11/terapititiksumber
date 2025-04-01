import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { id } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AppointmentForm } from "@/components/appointments/appointment-form";
import { ClipboardEdit, Plus, CheckCircle, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Appointment {
  id: number;
  patientId: number;
  date: string;
  status: string;
  notes?: string;
  patient?: {
    name: string;
    patientId: string;
  };
  session?: {
    id: number;
    sessionsUsed: number;
    totalSessions: number;
  };
}

export default function Schedule() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isAddAppointmentOpen, setIsAddAppointmentOpen] = useState(false);
  const [isEditAppointmentOpen, setIsEditAppointmentOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch appointments for selected date
  const { data: appointments = [], isLoading } = useQuery<Appointment[]>({
    queryKey: ['/api/appointments', format(selectedDate, 'yyyy-MM-dd')],
  });

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "cancelled":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case "completed":
        return "border-green-500 bg-green-50 dark:bg-green-900/20";
      case "cancelled":
        return "border-red-500 bg-red-50 dark:bg-red-900/20";
      default:
        return "border-blue-500 bg-blue-50 dark:bg-blue-900/20";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "Selesai";
      case "cancelled":
        return "Dibatalkan";
      case "rescheduled":
        return "Dijadwalkan Ulang";
      default:
        return "Terjadwal";
    }
  };

  const handleChangeStatus = async (appointment: Appointment, newStatus: string) => {
    try {
      console.log(`Mencoba mengubah status appointment ${appointment.id} menjadi: ${newStatus}`);
      
      // Tambahkan header untuk memastikan body JSON diproses dengan benar
      const response = await apiRequest(`/api/appointments/${appointment.id}/status`, {
        method: "PUT",
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus }),
      });
      
      console.log("Response dari server:", response);
      
      toast({
        title: "Status diperbarui",
        description: `Status janji temu berhasil diubah menjadi ${getStatusText(newStatus)}`,
      });
      
      // Invalidate appointments queries to refetch the data
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      
      // Invalidate specific date query to ensure calendar view is updated
      queryClient.invalidateQueries({ 
        queryKey: ['/api/appointments', format(selectedDate, 'yyyy-MM-dd')] 
      });
    } catch (error) {
      console.error("Error updating appointment status:", error);
      toast({
        title: "Gagal mengubah status",
        description: "Terjadi kesalahan, silakan coba lagi",
        variant: "destructive",
      });
    }
  };

  const handleEditAppointment = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setIsEditAppointmentOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Jadwal</h2>
          <p className="text-muted-foreground">
            Kelola jadwal terapi dan kunjungan pasien
          </p>
        </div>
        <Button onClick={() => setIsAddAppointmentOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Tambah Jadwal
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Kalender</CardTitle>
            <CardDescription>
              Pilih tanggal untuk melihat jadwal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border"
            />
          </CardContent>
        </Card>

        {/* Daily Schedule */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              Jadwal: {format(selectedDate, "EEEE, d MMMM yyyy", { locale: id })}
            </CardTitle>
            <CardDescription>
              Daftar semua jadwal terapi untuk tanggal yang dipilih
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
              </div>
            ) : (appointments as Appointment[]).length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">Tidak ada jadwal</h3>
                <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                  Tidak ada jadwal terapi untuk tanggal yang dipilih. Klik 'Tambah Jadwal' untuk membuat jadwal baru.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {(appointments as Appointment[]).map((appointment) => {
                  const appointmentDate = new Date(appointment.date);
                  const timeString = format(appointmentDate, "HH:mm");
                  
                  return (
                    <div 
                      key={appointment.id} 
                      className={cn(
                        "p-4 border-l-4 rounded-md shadow-sm",
                        getStatusClass(appointment.status)
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(appointment.status)}
                          <span className="font-medium">{appointment.patient?.name || "Pasien"}</span>
                        </div>
                        <span className="text-sm font-medium">{timeString}</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                        <div>
                          <span className="text-muted-foreground">Status:</span>{" "}
                          <span>{getStatusText(appointment.status)}</span>
                        </div>
                        {appointment.session && (
                          <div>
                            <span className="text-muted-foreground">Sesi:</span>{" "}
                            <span>#{appointment.session.sessionsUsed + 1} dari {appointment.session.totalSessions}</span>
                          </div>
                        )}
                      </div>
                      
                      {appointment.notes && (
                        <div className="text-sm mb-3">
                          <span className="text-muted-foreground">Catatan:</span>{" "}
                          <span className="italic">{appointment.notes}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 mt-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="h-8"
                          onClick={() => handleEditAppointment(appointment)}
                        >
                          <ClipboardEdit className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
                        
                        {appointment.status === "scheduled" && (
                          <>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="h-8 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                              onClick={() => handleChangeStatus(appointment, "completed")}
                            >
                              <CheckCircle className="h-3.5 w-3.5 mr-1" />
                              Selesai
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="h-8 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                              onClick={() => handleChangeStatus(appointment, "cancelled")}
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" />
                              Batal
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Appointment Dialog */}
      <Dialog open={isAddAppointmentOpen} onOpenChange={setIsAddAppointmentOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Tambah Jadwal Baru</DialogTitle>
          </DialogHeader>
          <AppointmentForm
            onSuccess={() => setIsAddAppointmentOpen(false)}
            defaultValues={{
              date: format(selectedDate, 'yyyy-MM-dd')
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Appointment Dialog */}
      <Dialog open={isEditAppointmentOpen} onOpenChange={setIsEditAppointmentOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Jadwal</DialogTitle>
          </DialogHeader>
          {selectedAppointment && (
            <AppointmentForm
              onSuccess={() => setIsEditAppointmentOpen(false)}
              defaultValues={{
                patientId: selectedAppointment.patientId,
                date: format(new Date(selectedAppointment.date), 'yyyy-MM-dd'),
                time: format(new Date(selectedAppointment.date), 'HH:mm'),
                notes: selectedAppointment.notes || "",
                sessionId: selectedAppointment.session?.id,
                status: selectedAppointment.status
              }}
              isEditing={true}
              appointmentId={selectedAppointment.id}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}