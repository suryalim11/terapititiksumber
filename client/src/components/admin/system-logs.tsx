import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { CalendarIcon, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SystemLog {
  id: number;
  createdAt: string;
  userId: number | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: any;
  ipAddress: string | null;
  userAgent: string | null;
}

const SystemLogs: React.FC = () => {
  const [limit, setLimit] = useState<number>(50);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      "/api/admin/system-logs",
      limit,
      actionFilter,
      entityFilter,
      startDate,
      endDate,
    ],
    queryFn: () => {
      const params = new URLSearchParams();
      params.append("limit", limit.toString());
      if (actionFilter && actionFilter !== "all") params.append("action", actionFilter);
      if (entityFilter && entityFilter !== "all") params.append("entityType", entityFilter);
      if (startDate) params.append("fromDate", startDate.toISOString());
      if (endDate) params.append("toDate", endDate.toISOString());

      return fetch(`/api/admin/system-logs?${params.toString()}`)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP error! Status: ${res.status}`);
          }
          return res.json();
        })
        .then((data) => {
          // Memastikan data.logs ada, jika tidak kembalikan array kosong
          if (!data || !data.logs) {
            console.warn("Data logs tidak ditemukan, mengembalikan array kosong");
            return [];
          }
          return data.logs as SystemLog[];
        })
        .catch((error) => {
          console.error("Error fetching system logs:", error);
          return [];
        });
    },
  });

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case "login":
        return "bg-green-500";
      case "login_failed":
        return "bg-red-500";
      case "logout":
        return "bg-yellow-500";
      case "create":
        return "bg-blue-500";
      case "update":
        return "bg-purple-500";
      case "delete":
        return "bg-orange-500";
      default:
        return "bg-gray-500";
    }
  };

  const getEntityBadgeColor = (entityType: string) => {
    switch (entityType) {
      case "user":
        return "bg-cyan-500";
      case "patient":
        return "bg-indigo-500";
      case "appointment":
        return "bg-violet-500";
      case "transaction":
        return "bg-pink-500";
      case "session":
        return "bg-teal-500";
      default:
        return "bg-slate-500";
    }
  };

  const formatDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd MMMM yyyy, HH:mm:ss", {
        locale: id,
      });
    } catch (e) {
      return dateString;
    }
  };

  const renderDetails = (details: any) => {
    if (!details) return "No details";

    try {
      // Jika sudah berupa objek
      if (typeof details === "object") {
        return (
          <div className="max-w-md">
            <pre className="text-xs overflow-auto max-h-24 rounded bg-gray-100 p-2 whitespace-pre-wrap">
              {JSON.stringify(details, null, 2)}
            </pre>
          </div>
        );
      }

      // Jika berupa string JSON
      const detailObj = JSON.parse(details);
      return (
        <div className="max-w-md">
          <pre className="text-xs overflow-auto max-h-24 rounded bg-gray-100 p-2 whitespace-pre-wrap">
            {JSON.stringify(detailObj, null, 2)}
          </pre>
        </div>
      );
    } catch (e) {
      return String(details);
    }
  };

  const handleReset = () => {
    setActionFilter("all");
    setEntityFilter("all");
    setStartDate(undefined);
    setEndDate(undefined);
    setLimit(50);
    refetch();
  };

  const actionOptions = [
    { value: "all", label: "Semua Aksi" },
    { value: "login", label: "Login" },
    { value: "login_failed", label: "Login Gagal" },
    { value: "logout", label: "Logout" },
    { value: "create", label: "Tambah Data" },
    { value: "update", label: "Ubah Data" },
    { value: "delete", label: "Hapus Data" },
  ];

  const entityOptions = [
    { value: "all", label: "Semua Entitas" },
    { value: "user", label: "Pengguna" },
    { value: "patient", label: "Pasien" },
    { value: "appointment", label: "Janji Temu" },
    { value: "transaction", label: "Transaksi" },
    { value: "session", label: "Sesi Terapi" },
  ];

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-500 rounded border border-red-200">
        Terjadi kesalahan saat memuat log sistem. {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-lg shadow mb-4">
        <h3 className="text-md font-medium mb-3">Filter Log</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Jenis Aksi</label>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih Jenis Aksi" />
              </SelectTrigger>
              <SelectContent>
                {actionOptions.map((option) => (
                  <SelectItem key={option.value || "empty"} value={option.value || " "}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Jenis Entitas</label>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih Jenis Entitas" />
              </SelectTrigger>
              <SelectContent>
                {entityOptions.map((option) => (
                  <SelectItem key={option.value || "empty"} value={option.value || " "}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Tanggal Mulai</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "dd MMMM yyyy", { locale: id }) : "Pilih tanggal"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Tanggal Akhir</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "dd MMMM yyyy", { locale: id }) : "Pilih tanggal"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <label className="text-sm whitespace-nowrap">Jumlah data:</label>
            <Select
              value={limit.toString()}
              onValueChange={(val) => setLimit(parseInt(val))}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Limit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="250">250</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex space-x-2">
            <Button variant="outline" onClick={handleReset}>
              Reset Filter
            </Button>
            <Button onClick={() => refetch()}>
              Terapkan Filter
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="text-lg font-medium">Riwayat Log Sistem</h3>
          <p className="text-sm text-gray-500">
            Daftar aktivitas sistem yang dicatat
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center p-8">
            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            <span>Memuat data...</span>
          </div>
        ) : data && data.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Pengguna</TableHead>
                  <TableHead>Aksi</TableHead>
                  <TableHead>Entitas</TableHead>
                  <TableHead>ID Entitas</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </TableCell>
                    <TableCell>
                      {log.userId ? (
                        log.details?.username || `User #${log.userId}`
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          "whitespace-nowrap",
                          getActionBadgeColor(log.action)
                        )}
                      >
                        {log.action === "login" && "Login"}
                        {log.action === "login_failed" && "Login Gagal"}
                        {log.action === "logout" && "Logout"}
                        {log.action === "create" && "Tambah"}
                        {log.action === "update" && "Ubah"}
                        {log.action === "delete" && "Hapus"}
                        {!["login", "login_failed", "logout", "create", "update", "delete"].includes(log.action) && log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "whitespace-nowrap",
                          getEntityBadgeColor(log.entityType)
                        )}
                      >
                        {log.entityType === "user" && "Pengguna"}
                        {log.entityType === "patient" && "Pasien"}
                        {log.entityType === "appointment" && "Janji Temu"}
                        {log.entityType === "transaction" && "Transaksi"}
                        {log.entityType === "session" && "Sesi"}
                        {!["user", "patient", "appointment", "transaction", "session"].includes(log.entityType) && log.entityType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {log.entityId || <span className="text-gray-500">-</span>}
                    </TableCell>
                    <TableCell>{renderDetails(log.details)}</TableCell>
                    <TableCell>{log.ipAddress || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            Tidak ada data log yang ditemukan.
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemLogs;