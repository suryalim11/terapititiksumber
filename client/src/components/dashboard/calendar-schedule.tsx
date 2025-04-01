import { useQuery } from "@tanstack/react-query";
import { format, addDays, subDays } from "date-fns";
import { id } from "date-fns/locale";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Appointment = {
  id: number;
  patientId: number;
  sessionId?: number;
  date: string;
  status: string;
  notes?: string;
  patient?: {
    name: string;
  };
  session?: {
    sessionsUsed: number;
    totalSessions: number;
  };
};

export default function CalendarSchedule() {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const { data: appointments, isLoading } = useQuery({
    queryKey: [`/api/appointments?date=${format(currentDate, 'yyyy-MM-dd')}`],
  });

  const goToPreviousDay = () => {
    setCurrentDate(subDays(currentDate, 1));
  };

  const goToNextDay = () => {
    setCurrentDate(addDays(currentDate, 1));
  };

  const formatAppointmentTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'HH:mm', { locale: id });
    } catch (e) {
      return "--:--";
    }
  };

  const getSessionInfo = (appointment: Appointment) => {
    if (appointment.session) {
      const { sessionsUsed, totalSessions } = appointment.session;
      return `Terapi Sesi #${sessionsUsed} (${totalSessions === 1 ? 'Sesi Tunggal' : `Paket ${totalSessions} Sesi`})`;
    }
    return "Sesi Terapi";
  };

  const getAppointmentColor = (index: number) => {
    const colors = [
      "border-primary bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 text-primary dark:text-primary-light",
      "border-amber-500 bg-amber-50 dark:bg-amber-900 dark:bg-opacity-20 text-amber-600 dark:text-amber-400",
      "border-green-500 bg-green-50 dark:bg-green-900 dark:bg-opacity-20 text-green-600 dark:text-green-400",
      "border-purple-500 bg-purple-50 dark:bg-purple-900 dark:bg-opacity-20 text-purple-600 dark:text-purple-400"
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold font-heading text-gray-800 dark:text-white">Jadwal Hari Ini</h3>
      </div>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium text-gray-800 dark:text-white">
            {format(currentDate, 'EEEE, d MMMM yyyy', { locale: id })}
          </h4>
          <div className="flex space-x-1">
            <button 
              onClick={goToPreviousDay}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button 
              onClick={goToNextDay}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="p-3 border-l-4 border-gray-300 rounded-r-lg bg-gray-100 dark:bg-gray-700 animate-pulse">
                <div className="flex justify-between mb-1">
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/3"></div>
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/4"></div>
                </div>
                <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : !appointments || appointments.length === 0 ? (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400">
            Tidak ada jadwal untuk hari ini.
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.map((appointment: Appointment, index: number) => (
              <div 
                key={appointment.id} 
                className={cn(
                  "p-3 border-l-4 rounded-r-lg",
                  getAppointmentColor(index)
                )}
              >
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-semibold text-gray-800 dark:text-white">
                    {appointment.patient?.name || "Pasien"}
                  </span>
                  <span className="text-xs font-medium">
                    {formatAppointmentTime(appointment.date)}
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  {getSessionInfo(appointment)}
                </p>
              </div>
            ))}
          </div>
        )}

        <button className="mt-4 w-full py-2 bg-primary hover:bg-primary-dark text-white rounded-lg text-sm font-medium transition duration-150 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Tambah Jadwal Baru
        </button>
      </div>
    </div>
  );
}
