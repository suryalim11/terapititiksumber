import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { useState } from "react";

type Session = {
  id: number;
  patientId: number;
  packageId: number;
  totalSessions: number;
  sessionsUsed: number;
  status: string;
  lastSessionDate?: string;
  patient?: {
    id: number;
    name: string;
    patientId: string;
  };
};

export default function SessionTracking() {
  const [filter, setFilter] = useState<string>("all");
  
  const { data: sessions, isLoading, error } = useQuery({
    queryKey: ["/api/sessions?active=true"],
  });

  const filteredSessions = sessions ? sessions.filter((session: Session) => {
    if (filter === "all") return true;
    if (filter === "almost-done") {
      return session.sessionsUsed >= (session.totalSessions * 0.75);
    }
    if (filter === "just-started") {
      return session.sessionsUsed <= (session.totalSessions * 0.25);
    }
    return true;
  }) : [];

  const getProgressPercentage = (used: number, total: number) => {
    return Math.round((used / total) * 100);
  };

  const getStatusLabel = (session: Session) => {
    const percentage = getProgressPercentage(session.sessionsUsed, session.totalSessions);
    
    if (percentage >= 90) {
      return {
        text: "Hampir Selesai",
        className: "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200"
      };
    }
    
    return {
      text: "Aktif",
      className: "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
    };
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-purple-200 dark:bg-purple-900 text-purple-600 dark:text-purple-400",
      "bg-blue-200 dark:bg-blue-900 text-blue-600 dark:text-blue-400",
      "bg-green-200 dark:bg-green-900 text-green-600 dark:text-green-400",
      "bg-red-200 dark:bg-red-900 text-red-600 dark:text-red-400",
      "bg-yellow-200 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-400",
      "bg-pink-200 dark:bg-pink-900 text-pink-600 dark:text-pink-400"
    ];
    
    // Simple hash for consistently getting the same color for the same name
    const charSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return colors[charSum % colors.length];
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), 'd MMM yyyy', { locale: id });
    } catch (e) {
      return dateString;
    }
  };

  return (
    <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h3 className="text-lg font-semibold font-heading text-gray-800 dark:text-white">Status Paket 12 Sesi Aktif</h3>
        <div>
          <select 
            className="text-sm text-gray-500 dark:text-gray-400 bg-transparent border-0 focus:ring-0"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Semua Pasien</option>
            <option value="almost-done">Hampir Selesai</option>
            <option value="just-started">Baru Mulai</option>
          </select>
        </div>
      </div>
      <div className="p-6">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-full mb-4"></div>
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded mb-2 p-3">
                  <div className="flex justify-between">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-4 text-red-500">
              Terjadi kesalahan saat memuat data.
            </div>
          ) : !filteredSessions || filteredSessions.length === 0 ? (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
              Tidak ada paket terapi aktif saat ini.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pasien</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Progress</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sesi Terakhir</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredSessions.map((session: Session) => {
                  const patientName = session.patient?.name || "Pasien";
                  const patientId = session.patient?.patientId || "-";
                  const statusLabel = getStatusLabel(session);
                  const percentage = getProgressPercentage(session.sessionsUsed, session.totalSessions);
                  
                  return (
                    <tr key={session.id}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`flex-shrink-0 h-8 w-8 rounded-full ${getAvatarColor(patientName)} flex items-center justify-center`}>
                            <span className="font-medium text-sm">{getInitials(patientName)}</span>
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{patientName}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">ID: {patientId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                          <div 
                            className={percentage >= 90 ? "bg-yellow-500 h-2.5 rounded-full" : "bg-primary h-2.5 rounded-full"} 
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {session.sessionsUsed}/{session.totalSessions} sesi
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusLabel.className}`}>
                          {statusLabel.text}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(session.lastSessionDate)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <button className="text-primary hover:text-primary-dark dark:text-primary-light dark:hover:text-primary">
                          Detail
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
