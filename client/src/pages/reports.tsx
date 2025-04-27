import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, addHours, parseISO } from "date-fns";
import { id } from "date-fns/locale";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type Report = {
  type: "daily" | "monthly";
  startDate: string;
  endDate: string;
};



// Komponen untuk tab laporan pasien harian
function PatientsDaily() {
  // Mendapatkan tahun dan bulan saat ini
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  // State untuk bulan dan tahun yang dipilih
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // Array nama bulan untuk dropdown
  const months = [
    { value: 1, label: 'Januari' },
    { value: 2, label: 'Februari' },
    { value: 3, label: 'Maret' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Mei' },
    { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' },
    { value: 8, label: 'Agustus' },
    { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' },
    { value: 12, label: 'Desember' },
  ];

  // Membuat array tahun untuk dropdown (tahun saat ini dan 2 tahun sebelumnya)
  const years = [currentYear, currentYear - 1, currentYear - 2];
  
  // Fungsi helper untuk mendapatkan nama bulan
  const getMonthName = (monthNumber: number) => {
    return months.find(m => m.value === monthNumber)?.label || '';
  };
  
  // Fungsi untuk menentukan warna berdasarkan hari
  const getDayColor = (dayName: string) => {
    switch (dayName) {
      case 'Minggu':
        return '#ff8a65'; // Merah muda
      case 'Sabtu':
        return '#4fc3f7'; // Biru muda
      default:
        return '#81c784'; // Hijau
    }
  };

  // Fetch data laporan pasien harian
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/reports/patients-per-day', selectedMonth, selectedYear],
    queryFn: async () => {
      const response = await fetch(`/api/reports/patients-per-day?month=${selectedMonth}&year=${selectedYear}&apiKey=terapi-titik-sumber-public`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch patients daily report');
      }
      
      return await response.json();
    }
  });

  // Handler untuk perubahan bulan
  const handleMonthChange = (value: string) => {
    setSelectedMonth(parseInt(value));
  };

  // Handler untuk perubahan tahun
  const handleYearChange = (value: string) => {
    setSelectedYear(parseInt(value));
  };

  // Menyiapkan data untuk grafik
  const chartData = data?.dailyData?.map((item: any) => ({
    ...item,
    day: parseInt(item.date.split('-')[2]), // Mendapatkan tanggal dari format yyyy-MM-dd
  })) || [];

  // Format data untuk tabel dengan pengelompokan mingguan
  const getWeeklyData = () => {
    if (!data?.dailyData) return [];
    
    const result = [];
    const dailyData = [...data.dailyData];
    
    // Mengelompokkan per 7 hari (minggu)
    for (let i = 0; i < dailyData.length; i += 7) {
      const weekData = dailyData.slice(i, i + 7);
      const totalPatients = weekData.reduce((sum, day) => sum + day.patientCount, 0);
      
      result.push({
        weekNumber: Math.ceil((i + 1) / 7),
        startDate: weekData[0]?.date,
        endDate: weekData[weekData.length - 1]?.date,
        totalPatients,
        dailyData: weekData
      });
    }
    
    return result;
  };

  const weeklyData = getWeeklyData();

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="w-full md:w-1/2 lg:w-1/4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium">Bulan</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedMonth.toString()} onValueChange={handleMonthChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih bulan" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value.toString()}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>
        
        <div className="w-full md:w-1/2 lg:w-1/4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium">Tahun</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedYear.toString()} onValueChange={handleYearChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih tahun" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>
        
        {data && (
          <>
            <div className="w-full md:w-1/2 lg:w-1/4">
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium">Total Pasien</CardTitle>
                  <CardDescription>
                    {getMonthName(selectedMonth)} {selectedYear}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.totalPatients}</div>
                </CardContent>
              </Card>
            </div>
            
            <div className="w-full md:w-1/2 lg:w-1/4">
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium">Rata-rata Per Hari</CardTitle>
                  <CardDescription>
                    {getMonthName(selectedMonth)} {selectedYear}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.averagePatientsPerDay}</div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : error ? (
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="text-center text-red-600">
              Terjadi kesalahan saat mengambil data laporan. Silakan coba lagi.
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Grafik Pasien per Hari</CardTitle>
              <CardDescription>
                {getMonthName(selectedMonth)} {selectedYear}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis 
                      dataKey="day" 
                      label={{ 
                        value: 'Tanggal', 
                        position: 'insideBottom', 
                        offset: -10 
                      }} 
                    />
                    <YAxis 
                      label={{ 
                        value: 'Jumlah Pasien', 
                        angle: -90, 
                        position: 'insideLeft' 
                      }} 
                    />
                    <Tooltip 
                      formatter={(value) => [`${value} pasien`, 'Jumlah']}
                      labelFormatter={(day) => `Tanggal ${day}`}
                    />
                    <Legend />
                    <Bar 
                      dataKey="patientCount" 
                      name="Jumlah Pasien"
                      radius={[4, 4, 0, 0]}
                    >
                      {chartData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={getDayColor(entry.dayName)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Laporan Mingguan</CardTitle>
              <CardDescription>
                {getMonthName(selectedMonth)} {selectedYear}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-2 text-left">Minggu</th>
                    <th className="px-4 py-2 text-left">Periode</th>
                    <th className="px-4 py-2 text-right">Total Pasien</th>
                    <th className="px-4 py-2 text-right">Rata-rata/Hari</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyData.map((week) => (
                    <tr key={week.weekNumber} className="border-b">
                      <td className="px-4 py-2 font-medium">
                        Minggu {week.weekNumber}
                      </td>
                      <td className="px-4 py-2">
                        {week.startDate.split('-')[2]} - {week.endDate.split('-')[2]} {getMonthName(selectedMonth)}
                      </td>
                      <td className="px-4 py-2 text-right">{week.totalPatients}</td>
                      <td className="px-4 py-2 text-right">
                        {(week.totalPatients / week.dailyData.length).toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detail Harian</CardTitle>
              <CardDescription>
                {getMonthName(selectedMonth)} {selectedYear}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-2 text-left">Tanggal</th>
                    <th className="px-4 py-2 text-left">Hari</th>
                    <th className="px-4 py-2 text-right">Jumlah Pasien</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.dailyData?.map((day: any, index: number) => (
                    <tr key={index} className="border-b">
                      <td className="px-4 py-2">
                        {day.date.split('-')[2]} {getMonthName(selectedMonth)}
                      </td>
                      <td className="px-4 py-2">
                        {day.dayName}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {day.patientCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState("financial");
  const [reportPeriod, setReportPeriod] = useState<"daily" | "monthly">("daily");
  const [detailedView, setDetailedView] = useState<boolean>(false);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1); // 1-12
  
  // State untuk dialog dan detail transaksi
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"debt" | "debtPayment" | "credit" | "product" | "service" | "discount">("debt");
  const [dialogTitle, setDialogTitle] = useState("");
  const [transactionDetails, setTransactionDetails] = useState<any[]>([]);
  const [currentReport, setCurrentReport] = useState<Report>({
    type: "daily",
    startDate: format(subDays(new Date(), 7), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  });
  const { toast } = useToast();
  const reportRef = useRef<HTMLDivElement>(null);

  // Fetch transactions
  const { data: transactions, isLoading: isLoadingTransactions } = useQuery({
    queryKey: ["/api/transactions"],
  });
  
  // Fetch patients untuk menampilkan nama pasien
  const { data: patients, isLoading: isLoadingPatients } = useQuery({
    queryKey: ["/api/patients"],
  });

  // Fetch sessions
  const { data: sessions, isLoading: isLoadingSessions } = useQuery({
    queryKey: ["/api/sessions"],
    queryFn: async () => {
      const response = await fetch("/api/sessions?reportMode=true");
      if (!response.ok) {
        throw new Error("Failed to fetch sessions for reporting");
      }
      return response.json();
    }
  });
  
  // Fetch monthly financial report
  const { data: monthlyFinancialReport, isLoading: isLoadingMonthlyReport, refetch: refetchMonthlyReport } = useQuery({
    queryKey: ["/api/reports/monthly-financial", selectedYear, selectedMonth],
    queryFn: async () => {
      // Tambahkan timestamp untuk menghindari cache browser
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/reports/monthly-financial?year=${selectedYear}&month=${selectedMonth}&_=${timestamp}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      if (!response.ok) {
        throw new Error("Failed to fetch monthly financial report");
      }
      const data = await response.json();
      console.log("Fetched monthly financial report", data);
      console.log("Service sales:", data.summary.totalServiceSales);
      console.log("Product sales:", data.summary.totalProductSales);
      console.log("Total income:", data.summary.totalIncome);
      console.log("Total hutang:", data.summary.totalDebt);
      return data;
    },
    enabled: activeTab === "financial" && reportPeriod === "monthly" && detailedView,
    // Gunakan refetchInterval untuk memastikan data selalu segar
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });

  // Generate daily financial data for chart
  const generateDailyFinancialData = () => {
    if (!transactions) return [];

    // Create a date range
    const startDate = new Date(currentReport.startDate);
    const endDate = new Date(currentReport.endDate);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    // Initialize data with zero amounts
    const dailyData = days.map(day => ({
      date: format(day, "yyyy-MM-dd"),
      formattedDate: format(day, "dd MMM", { locale: id }),
      amount: 0,
    }));

    // Fill in actual data
    if (transactions && Array.isArray(transactions)) {
      transactions.forEach((transaction: any) => {
        // Menggunakan addHours(-7) untuk menyesuaikan ke zona waktu WIB (UTC+7)
        const adjustedDate = addHours(new Date(transaction.createdAt), -7);
        const transactionDate = format(adjustedDate, "yyyy-MM-dd");
        const dataPoint = dailyData.find(d => d.date === transactionDate);
        if (dataPoint) {
          // Hanya gunakan totalAmount yang sebenarnya, jangan kurangi dengan discount karena
          // discount sudah termasuk dalam totalAmount
          const total = parseFloat(transaction.totalAmount.toString());
          dataPoint.amount += total;
        }
      });
    }

    return dailyData;
  };

  // Generate monthly financial data for chart
  const generateMonthlyFinancialData = () => {
    if (!transactions) return [];

    const monthNames = Array.from({ length: 12 }, (_, i) => 
      format(new Date(2023, i), "MMMM", { locale: id })
    );

    // Initialize data with zero amounts
    const monthlyData = monthNames.map(month => ({
      month,
      amount: 0,
    }));

    // Fill in actual data
    if (transactions && Array.isArray(transactions)) {
      transactions.forEach((transaction: any) => {
        // Menggunakan addHours(-7) untuk menyesuaikan ke zona waktu WIB (UTC+7)
        const adjustedDate = addHours(new Date(transaction.createdAt), -7);
        const monthIndex = adjustedDate.getMonth();
        // Hanya gunakan totalAmount yang sebenarnya, jangan kurangi dengan discount 
        // karena discount sudah termasuk dalam totalAmount
        const total = parseFloat(transaction.totalAmount.toString());
        monthlyData[monthIndex].amount += total;
      });
    }

    return monthlyData;
  };

  // Generate session data for chart (package distribution)
  const generatePackageDistribution = () => {
    if (!sessions) return [];

    const packageCounts = {
      "Sesi Tunggal": 0,
      "Paket 12 Sesi": 0,
    };

    if (sessions && Array.isArray(sessions)) {
      sessions.forEach((session: any) => {
        if (session.totalSessions === 1) {
          packageCounts["Sesi Tunggal"]++;
        } else if (session.totalSessions === 12) {
          packageCounts["Paket 12 Sesi"]++;
        }
      });
    }

    return Object.entries(packageCounts).map(([name, value]) => ({
      name,
      value,
    }));
  };

  const COLORS = ['#4F7CAC', '#7FB069', '#E6AA68', '#FFCA93'];

  // Handle export to CSV
  const exportToCSV = () => {
    if (!transactions) {
      toast({
        title: "Tidak ada data",
        description: "Tidak ada data transaksi untuk diekspor",
        variant: "destructive",
      });
      return;
    }

    let csvContent = "";
    
    // Column headers
    if (activeTab === "financial") {
      csvContent = "Tanggal,ID Transaksi,Pasien,Metode Pembayaran,Total\n";
      
      // Data rows
      if (transactions && Array.isArray(transactions)) {
        transactions.forEach((transaction: any) => {
          const row = [
            format(addHours(new Date(transaction.createdAt), -7), "yyyy-MM-dd"),
            transaction.transactionId,
            "Pasien ID: " + transaction.patientId, // In real app, get patient name
            transaction.paymentMethod,
            parseFloat(transaction.totalAmount.toString()).toString(),
          ].join(",");
          csvContent += row + "\n";
        });
      }
    } else {
      csvContent = "ID Sesi,Pasien,Paket,Total Sesi,Sesi Terpakai,Status\n";
      
      // Data rows
      if (sessions && Array.isArray(sessions)) {
        sessions.forEach((session: any) => {
          const row = [
            session.id,
            "Pasien ID: " + session.patientId, // In real app, get patient name
            session.totalSessions === 1 ? "Sesi Tunggal" : "Paket 12 Sesi",
            session.totalSessions,
            session.sessionsUsed,
            session.status,
          ].join(",");
          csvContent += row + "\n";
        });
      }
    }
    
    // Create download link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${activeTab}_report_${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Laporan diunduh",
      description: "File CSV berhasil diunduh",
    });
  };

  // Fungsi untuk menampilkan dialog dengan detail transaksi berdasarkan tipe
  const showTransactionDetails = (type: "debt" | "debtPayment" | "credit" | "product" | "service" | "discount") => {
    if (!transactions || !Array.isArray(transactions)) {
      toast({
        title: "Tidak dapat memuat detail",
        description: "Data transaksi tidak tersedia",
        variant: "destructive",
      });
      return;
    }
    
    // Inisialisasi judul dialog dan filter transaksi sesuai tipe
    let filteredTransactions: any[] = [];
    let title = "";
    
    const startDate = new Date(selectedYear, selectedMonth - 1, 1);
    const endDate = new Date(selectedYear, selectedMonth, 0); // Hari terakhir bulan ini
    
    // Filter berdasarkan bulan yang dipilih
    const monthlyTransactions = transactions.filter((transaction: any) => {
      const transactionDate = addHours(new Date(transaction.createdAt), -7); // -7 untuk timezone WIB
      return transactionDate >= startDate && transactionDate <= endDate;
    });
    
    if (type === "debt") {
      title = "Detail Hutang";
      // Transaksi dengan hutang > 0 ATAU transaksi kredit (karena kredit = hutang)
      filteredTransactions = monthlyTransactions.filter((t: any) => {
        // Cek apakah transaksi memiliki hutang lebih dari 0
        const hasDebt = parseFloat(t.debtAmount || "0") > 0;
        // Cek apakah transaksi adalah kredit (credit > 0)
        const isCredit = parseFloat(t.creditAmount || "0") > 0;
        // Pertimbangkan kedua kondisi
        return hasDebt || isCredit;
      });
      console.log("Filtered debt transactions:", filteredTransactions.length);
    } else if (type === "debtPayment") {
      title = "Detail Pembayaran Hutang";
      // Ambil transaksi yang memiliki pembayaran hutang
      filteredTransactions = monthlyTransactions.filter((t: any) => {
        // Transaksi kredit yang sudah dibayar sebagian
        const isPaidPartially = parseFloat(t.paidAmount || "0") > 0 && 
                              parseFloat(t.debtAmount || "0") > 0;
        return isPaidPartially;
      });
    } else if (type === "credit") {
      title = "Detail Kredit";
      // Transaksi dengan kredit > 0
      filteredTransactions = monthlyTransactions.filter((t: any) => 
        parseFloat(t.creditAmount || "0") > 0);
    } else if (type === "product") {
      title = "Detail Penjualan Produk";
      // Transaksi yang memiliki item produk
      filteredTransactions = monthlyTransactions.filter((t: any) => {
        if (!t.items) return false;
        try {
          const items = typeof t.items === 'string' ? JSON.parse(t.items) : t.items;
          return Array.isArray(items) && items.some((item: any) => item.type === 'product');
        } catch (e) {
          return false;
        }
      });
    } else if (type === "service") {
      title = "Detail Penjualan Layanan";
      // Transaksi yang memiliki item layanan (service) atau paket (package)
      filteredTransactions = monthlyTransactions.filter((t: any) => {
        if (!t.items) return false;
        try {
          const items = typeof t.items === 'string' ? JSON.parse(t.items) : t.items;
          return Array.isArray(items) && items.some((item: any) => 
            item.type === 'service' || item.type === 'package'
          );
        } catch (e) {
          return false;
        }
      });
    } else if (type === "discount") {
      title = "Detail Diskon";
      // Transaksi yang memiliki diskon
      filteredTransactions = monthlyTransactions.filter((t: any) => {
        const discountAmount = parseFloat(t.discount || "0");
        return discountAmount > 0;
      });
    }
    
    // Format data transaksi untuk ditampilkan di dialog
    const formattedTransactions = filteredTransactions.map((t: any) => {
      // Cari data pasien berdasarkan ID untuk menampilkan nama pasien
      const patient = patients?.find((p: any) => p.id === t.patientId);
      
      // Normalisasi transaksi untuk tampilan di dialog
      return {
        id: t.id,
        transactionId: t.transactionId,
        date: format(addHours(new Date(t.createdAt), -7), "dd MMM yyyy HH:mm", { locale: id }),
        totalAmount: parseFloat(t.totalAmount || "0").toLocaleString('id-ID'),
        paidAmount: parseFloat(t.paidAmount || "0").toLocaleString('id-ID'),
        creditAmount: parseFloat(t.creditAmount || "0").toLocaleString('id-ID'),
        debtAmount: parseFloat(t.debtAmount || "0").toLocaleString('id-ID'),
        discount: (parseFloat(t.discount || "0") * 1000).toLocaleString('id-ID'),
        paymentMethod: t.paymentMethod,
        items: Array.isArray(t.items) ? t.items : [],
        patientId: t.patientId,
        patientName: patient ? patient.name : `Pasien #${t.patientId}`
      };
    });
    
    // Buka dialog dengan detail transaksi
    setDialogType(type);
    setDialogTitle(title);
    setTransactionDetails(formattedTransactions);
    setIsDialogOpen(true);
  };

  // Handle print report
  const printReport = () => {
    if (reportRef.current) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Laporan ${activeTab === "financial" ? "Keuangan" : "Terapi"} - ${format(new Date(), "d MMMM yyyy", { locale: id })}</title>
              <style>
                body { font-family: 'Arial', sans-serif; margin: 0; padding: 20px; }
                .report { max-width: 800px; margin: 0 auto; }
                .report-header { margin-bottom: 20px; text-align: center; }
                .report-title { font-size: 24px; font-weight: bold; color: #4F7CAC; margin: 0; }
                .report-subtitle { font-size: 16px; color: #666; margin: 5px 0 0 0; }
                .report-date { font-size: 14px; color: #666; margin: 5px 0 0 0; }
                .report-section { margin: 20px 0; }
                .report-section-title { font-size: 18px; margin-bottom: 10px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
                th { background-color: #f5f5f5; }
                .total { font-weight: bold; }
                .report-footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="report">
                <div class="report-header">
                  <h1 class="report-title">Terapinya Terapi Titik Sumber</h1>
                  <p class="report-subtitle">Laporan ${activeTab === "financial" ? "Keuangan" : "Terapi"}</p>
                  <p class="report-date">Dicetak pada: ${format(new Date(), "d MMMM yyyy, HH:mm", { locale: id })}</p>
                </div>
                
                ${reportRef.current.innerHTML}
                
                <div class="report-footer">
                  <p>Laporan ini dibuat secara otomatis. Terima kasih.</p>
                </div>
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold font-heading text-gray-900 dark:text-white">
            Laporan
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Lihat laporan keuangan dan statistik terapi
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={exportToCSV}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </Button>
          <Button variant="outline" onClick={printReport}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Cetak
          </Button>
        </div>
      </div>

      <div ref={reportRef}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="financial">Laporan Keuangan</TabsTrigger>
            <TabsTrigger value="therapy">Laporan Terapi</TabsTrigger>
            <TabsTrigger value="patients-daily">Pasien Harian</TabsTrigger>
          </TabsList>

          <TabsContent value="financial" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-heading">Pendapatan</CardTitle>
                <CardDescription>
                  Grafik pendapatan dari transaksi terapi dan produk
                </CardDescription>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button 
                    variant={reportPeriod === "daily" ? "default" : "outline"} 
                    size="sm"
                    onClick={() => {
                      setReportPeriod("daily");
                      setDetailedView(false);
                    }}
                  >
                    Harian
                  </Button>
                  <Button 
                    variant={reportPeriod === "monthly" ? "default" : "outline"} 
                    size="sm"
                    onClick={() => setReportPeriod("monthly")}
                  >
                    Bulanan
                  </Button>
                  
                  {reportPeriod === "monthly" && (
                    <Button
                      variant={detailedView ? "default" : "outline"}
                      size="sm"
                      onClick={() => setDetailedView(!detailedView)}
                      className="ml-auto"
                    >
                      {detailedView ? "Tampilan Sederhana" : "Tampilan Detail"}
                    </Button>
                  )}
                </div>
                
                {reportPeriod === "monthly" && detailedView && (
                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    <div className="flex items-center">
                      <span className="mr-2">Tahun:</span>
                      <Select
                        value={selectedYear.toString()}
                        onValueChange={(value) => setSelectedYear(parseInt(value))}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue placeholder="Pilih Tahun" />
                        </SelectTrigger>
                        <SelectContent>
                          {[2024, 2025, 2026].map((year) => (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex items-center">
                      <span className="mr-2">Bulan:</span>
                      <Select
                        value={selectedMonth.toString()}
                        onValueChange={(value) => setSelectedMonth(parseInt(value))}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue placeholder="Pilih Bulan" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => {
                            const monthNumber = i + 1;
                            const monthName = format(new Date(2025, i, 1), "MMMM", { locale: id });
                            return (
                              <SelectItem key={monthNumber} value={monthNumber.toString()}>
                                {monthName}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {isLoadingTransactions || (detailedView && isLoadingMonthlyReport) ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                  </div>
                ) : detailedView && reportPeriod === "monthly" ? (
                  // Tampilan detail laporan keuangan bulanan
                  <div className="space-y-6">
                    {monthlyFinancialReport ? (
                      <>
                        {/* Ringkasan Finansial */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                          <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                            <h3 className="text-lg font-semibold mb-2">Total Pendapatan</h3>
                            <p className="text-2xl md:text-3xl font-bold text-blue-700 dark:text-blue-300">
                              Rp{(monthlyFinancialReport?.summary?.totalIncome || 0).toLocaleString('id-ID')}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              Dari {monthlyFinancialReport?.summary?.transactionCount || 0} transaksi
                            </p>
                          </div>
                          
                          <div 
                            className="bg-emerald-50 dark:bg-emerald-900/30 p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => showTransactionDetails("discount")}
                          >
                            <h3 className="text-lg font-semibold mb-2">Total Diskon</h3>
                            <p className="text-2xl md:text-3xl font-bold text-emerald-700 dark:text-emerald-300">
                              Rp{(monthlyFinancialReport?.summary?.totalDiscount || 0).toLocaleString('id-ID')}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              Diberikan pada {monthlyFinancialReport?.details?.discountedTransactions || 0} transaksi
                            </p>
                            <p className="text-xs text-blue-500 mt-2 flex items-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Klik untuk melihat detail
                            </p>
                          </div>
                          
                          <div 
                            className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => showTransactionDetails("product")}
                          >
                            <h3 className="text-lg font-semibold mb-2">Penjualan Produk</h3>
                            <p className="text-2xl md:text-3xl font-bold text-green-700 dark:text-green-300">
                              Rp{(monthlyFinancialReport?.summary?.totalProductSales || 0).toLocaleString('id-ID')}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              {monthlyFinancialReport?.summary?.totalIncome
                                ? Math.round((monthlyFinancialReport.summary.totalProductSales / monthlyFinancialReport.summary.totalIncome) * 100)
                                : 0}% dari total
                            </p>
                            <p className="text-xs text-blue-500 mt-2 flex items-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Klik untuk melihat detail
                            </p>
                          </div>
                          
                          <div 
                            className="bg-purple-50 dark:bg-purple-900/30 p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => showTransactionDetails("service")}
                          >
                            <h3 className="text-lg font-semibold mb-2">Penjualan Layanan</h3>
                            <p className="text-2xl md:text-3xl font-bold text-purple-700 dark:text-purple-300">
                              Rp{(monthlyFinancialReport?.summary?.totalServiceSales || 0).toLocaleString('id-ID')}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              {monthlyFinancialReport?.summary?.totalIncome
                                ? Math.round((monthlyFinancialReport.summary.totalServiceSales / monthlyFinancialReport.summary.totalIncome) * 100)
                                : 0}% dari total
                            </p>
                            <p className="text-xs text-blue-500 mt-2 flex items-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Klik untuk melihat detail
                            </p>
                          </div>
                        </div>

                        {/* Ringkasan Hutang & Kredit */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                          <div 
                            className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => showTransactionDetails("debt")}
                          >
                            <h3 className="text-lg font-semibold mb-2">Total Hutang</h3>
                            <p className="text-2xl md:text-3xl font-bold text-red-700 dark:text-red-400">
                              Rp{(monthlyFinancialReport?.summary?.totalDebt || 0).toLocaleString('id-ID')}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              Hutang periode saat ini
                            </p>
                            <p className="text-xs text-blue-500 mt-2 flex items-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Klik untuk melihat detail
                            </p>
                          </div>
                          
                          <div 
                            className="bg-amber-50 dark:bg-amber-900/30 p-4 rounded-lg cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => showTransactionDetails("debtPayment")}
                          >
                            <h3 className="text-lg font-semibold mb-2">Pembayaran Hutang</h3>
                            <p className="text-2xl md:text-3xl font-bold text-amber-700 dark:text-amber-400">
                              Rp{(monthlyFinancialReport?.summary?.totalDebtPayments || 0).toLocaleString('id-ID')}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              Pelunasan hutang periode ini
                            </p>
                            <p className="text-xs text-blue-500 mt-2 flex items-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Klik untuk melihat detail
                            </p>
                          </div>
                          
                          <div 
                            className="bg-sky-50 dark:bg-sky-900/30 p-4 rounded-lg cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => showTransactionDetails("credit")}
                          >
                            <h3 className="text-lg font-semibold mb-2">Total Kredit</h3>
                            <p className="text-2xl md:text-3xl font-bold text-sky-700 dark:text-sky-400">
                              Rp{(monthlyFinancialReport?.summary?.totalCredits || 0).toLocaleString('id-ID')}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              Dari transaksi kredit periode ini
                            </p>
                            <p className="text-xs text-blue-500 mt-2 flex items-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Klik untuk melihat detail
                            </p>
                          </div>
                        </div>
                        
                        
                        {/* Grafik Distribusi Metode Pembayaran */}
                        <div className="mt-6">
                          <h3 className="text-lg font-semibold mb-4">Distribusi Metode Pembayaran</h3>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                {/* Filter data untuk hanya menampilkan metode pembayaran dengan nilai > 0 */}
                                <Pie
                                  data={[
                                    { name: 'Tunai', value: monthlyFinancialReport?.summary?.totalCashTransactions || 0 },
                                    { name: 'Debit', value: monthlyFinancialReport?.summary?.totalDebitTransactions || 0 },
                                    { name: 'Transfer', value: monthlyFinancialReport?.summary?.totalTransferTransactions || 0 },
                                    { name: 'QRIS', value: monthlyFinancialReport?.summary?.totalQRISTransactions || 0 },
                                    { name: 'Lainnya', value: monthlyFinancialReport?.summary?.totalOtherTransactions || 0 }
                                  ].filter(item => item.value > 0)}
                                  cx="50%"
                                  cy="50%"
                                  labelLine={true}
                                  outerRadius={80}
                                  fill="#8884d8"
                                  dataKey="value"
                                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                >
                                  {[
                                    { name: 'Tunai', value: monthlyFinancialReport?.summary?.totalCashTransactions || 0, color: "#2563EB" }, // Blue
                                    { name: 'Debit', value: monthlyFinancialReport?.summary?.totalDebitTransactions || 0, color: "#16A34A" }, // Green
                                    { name: 'Transfer', value: monthlyFinancialReport?.summary?.totalTransferTransactions || 0, color: "#F59E0B" }, // Amber
                                    { name: 'QRIS', value: monthlyFinancialReport?.summary?.totalQRISTransactions || 0, color: "#F97316" }, // Orange
                                    { name: 'Lainnya', value: monthlyFinancialReport?.summary?.totalOtherTransactions || 0, color: "#6366F1" } // Indigo
                                  ]
                                  .filter(item => item.value > 0) // Hanya tampilkan yang ada nilainya
                                  .map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip formatter={(value) => `Rp${(value as number).toLocaleString('id-ID')}`} />
                                <Legend layout="horizontal" verticalAlign="bottom" align="center" />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                        
                        {/* Grafik Pendapatan Harian */}
                        {monthlyFinancialReport?.dailyData?.length > 0 && (
                          <div className="mt-6">
                            <h3 className="text-lg font-semibold mb-4">Pendapatan Harian Bulan {format(new Date(selectedYear, selectedMonth-1, 1), 'MMMM yyyy', { locale: id })}</h3>
                            <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart
                                  data={monthlyFinancialReport.dailyData.map((day: any) => ({
                                    ...day,
                                    formattedDate: format(parseISO(day.date), 'dd'),
                                    total: day.totalAmount
                                  }))}
                                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="formattedDate" />
                                  <YAxis tickFormatter={(value) => `Rp${(value/1000)}k`} />
                                  <Tooltip 
                                    formatter={(value, name) => {
                                      const formattedValue = `Rp${(value as number).toLocaleString('id-ID')}`;
                                      const formattedName = name === 'total' ? 'Total' : 
                                                           name === 'productSales' ? 'Produk' : 
                                                           name === 'serviceSales' ? 'Layanan' : name;
                                      return [formattedValue, formattedName];
                                    }}
                                    labelFormatter={(label) => `Tanggal ${label}`}
                                  />
                                  <Legend />
                                  <Bar dataKey="productSales" name="Produk" fill="#82ca9d" />
                                  <Bar dataKey="serviceSales" name="Layanan" fill="#8884d8" />
                                  <Line type="monotone" dataKey="total" name="Total" stroke="#ff7300" strokeWidth={2} />
                                </ComposedChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                        Tidak ada data untuk periode yang dipilih
                      </div>
                    )}
                  </div>
                ) : (
                  // Tampilan grafik standar
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      {reportPeriod === "daily" ? (
                        <LineChart
                          data={generateDailyFinancialData()}
                          margin={{
                            top: 20,
                            right: 30,
                            left: 20,
                            bottom: 5,
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="formattedDate" />
                          <YAxis 
                            tickFormatter={(value) => `Rp${value.toLocaleString('id-ID')}`} 
                          />
                          <Tooltip 
                            formatter={(value) => [`Rp${(value as number).toLocaleString('id-ID')}`, "Pendapatan"]}
                            labelFormatter={(label) => `Tanggal: ${label}`}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="amount"
                            name="Pendapatan"
                            stroke="#4F7CAC"
                            strokeWidth={2}
                            activeDot={{ r: 8 }}
                          />
                        </LineChart>
                      ) : (
                        <BarChart
                          data={generateMonthlyFinancialData()}
                          margin={{
                            top: 20,
                            right: 30,
                            left: 20,
                            bottom: 5,
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis 
                            tickFormatter={(value) => `Rp${value.toLocaleString('id-ID')}`} 
                          />
                          <Tooltip 
                            formatter={(value) => [`Rp${(value as number).toLocaleString('id-ID')}`, "Pendapatan"]}
                            labelFormatter={(label) => `Bulan: ${label}`}
                          />
                          <Legend />
                          <Bar
                            dataKey="amount"
                            name="Pendapatan"
                            fill="#4F7CAC"
                            barSize={30}
                          />
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-heading">Ringkasan Transaksi</CardTitle>
                <CardDescription>
                  Daftar transaksi terbaru
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingTransactions ? (
                  <div className="flex justify-center py-6">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                  </div>
                ) : !transactions || (Array.isArray(transactions) && transactions.length === 0) ? (
                  <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                    Belum ada data transaksi
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="px-4 py-2 text-left">ID Transaksi</th>
                          <th className="px-4 py-2 text-left">Tanggal</th>
                          <th className="px-4 py-2 text-left">Metode Pembayaran</th>
                          <th className="px-4 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(transactions) && transactions.slice(0, 5).map((transaction: any) => (
                          <tr key={transaction.id} className="border-b">
                            <td className="px-4 py-2">{transaction.transactionId}</td>
                            <td className="px-4 py-2">
                              {format(addHours(new Date(transaction.createdAt), -7), "d MMM yyyy", { locale: id })}
                            </td>
                            <td className="px-4 py-2">
                              {transaction.paymentMethod === "bank_transfer" ? "Transfer Bank" : 
                               transaction.paymentMethod === "qris" ? "QRIS" : "Tunai"}
                            </td>
                            <td className="px-4 py-2 text-right">
                              Rp{parseFloat(transaction.totalAmount.toString()).toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="therapy" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl font-heading">Distribusi Paket</CardTitle>
                  <CardDescription>
                    Perbandingan antara paket terapi
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingSessions ? (
                    <div className="flex justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                    </div>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={generatePackageDistribution()}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {generatePackageDistribution().map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value) => [`${value} pasien`, "Jumlah"]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl font-heading">Status Paket</CardTitle>
                  <CardDescription>
                    Status paket terapi yang terdaftar
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingSessions ? (
                    <div className="flex justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                    </div>
                  ) : !sessions || (Array.isArray(sessions) && sessions.length === 0) ? (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                      Belum ada data sesi terapi
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 p-6 rounded-lg text-center">
                        <div className="text-blue-600 dark:text-blue-400 text-4xl font-bold mb-2">
                          {Array.isArray(sessions) ? sessions.filter((s: any) => s.status === "active").length : 0}
                        </div>
                        <div className="text-gray-700 dark:text-gray-300">Paket Aktif</div>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900 dark:bg-opacity-20 p-6 rounded-lg text-center">
                        <div className="text-green-600 dark:text-green-400 text-4xl font-bold mb-2">
                          {Array.isArray(sessions) ? sessions.filter((s: any) => s.status === "completed").length : 0}
                        </div>
                        <div className="text-gray-700 dark:text-gray-300">Paket Selesai</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-heading">Riwayat Sesi Terapi</CardTitle>
                <CardDescription>
                  Progres sesi terapi pasien
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingSessions ? (
                  <div className="flex justify-center py-6">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                  </div>
                ) : !sessions || (Array.isArray(sessions) && sessions.length === 0) ? (
                  <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                    Belum ada data sesi terapi
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="px-4 py-2 text-left">Pasien ID</th>
                          <th className="px-4 py-2 text-left">Paket</th>
                          <th className="px-4 py-2 text-center">Progress</th>
                          <th className="px-4 py-2 text-center">Status</th>
                          <th className="px-4 py-2 text-right">Sesi Terakhir</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(sessions) && sessions.slice(0, 5).map((session: any) => (
                          <tr key={session.id} className="border-b">
                            <td className="px-4 py-2">{session.patientId}</td>
                            <td className="px-4 py-2">
                              {session.totalSessions === 1 ? "Sesi Tunggal" : `Paket ${session.totalSessions} Sesi`}
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center">
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mr-2">
                                  <div 
                                    className="bg-primary h-2.5 rounded-full" 
                                    style={{ width: `${(session.sessionsUsed / session.totalSessions) * 100}%` }}
                                  ></div>
                                </div>
                                <span className="text-xs whitespace-nowrap">
                                  {session.sessionsUsed}/{session.totalSessions}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-2 text-center">
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                session.status === "active" 
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:bg-opacity-20 dark:text-green-300" 
                                  : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:bg-opacity-20 dark:text-blue-300"
                              }`}>
                                {session.status === "active" ? "Aktif" : "Selesai"}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-right">
                              {session.lastSessionDate 
                                ? format(new Date(session.lastSessionDate), "d MMM yyyy", { locale: id }) 
                                : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="patients-daily" className="space-y-6">
            {activeTab === "patients-daily" && <PatientsDaily />}
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Dialog untuk detail transaksi */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-xl">{dialogTitle}</DialogTitle>
            <DialogDescription>
              {dialogType === "debt" && "Detail transaksi dengan hutang pada periode ini"}
              {dialogType === "debtPayment" && "Detail pembayaran hutang pada periode ini"}
              {dialogType === "credit" && "Detail transaksi kredit pada periode ini"}
            </DialogDescription>
          </DialogHeader>
          
          {transactionDetails.length === 0 ? (
            <div className="py-6 text-center text-gray-500">
              Tidak ada data transaksi untuk ditampilkan
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[50vh] md:max-h-96 border rounded">
              <table className="w-full mt-2 text-sm md:text-base">
                <thead className="sticky top-0 bg-white dark:bg-gray-900">
                  <tr className="border-b">
                    <th className="px-2 py-2 text-left">ID Transaksi</th>
                    <th className="px-2 py-2 text-left">Tanggal</th>
                    <th className="px-2 py-2 text-left">Pasien</th>
                    <th className="px-2 py-2 text-left">Pembayaran</th>
                    <th className="px-2 py-2 text-right">Total</th>
                    {dialogType === "debt" && (
                      <th className="px-2 py-2 text-right">Hutang</th>
                    )}
                    {dialogType === "debtPayment" && (
                      <th className="px-2 py-2 text-right">Dibayar</th>
                    )}
                    {dialogType === "credit" && (
                      <th className="px-2 py-2 text-right">Kredit</th>
                    )}
                    {dialogType === "discount" && (
                      <th className="px-2 py-2 text-right">Diskon</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transactionDetails.map((transaction, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-2 py-2">{transaction.transactionId}</td>
                      <td className="px-2 py-2">{transaction.date}</td>
                      <td className="px-2 py-2 font-medium">{transaction.patientName || `Pasien #${transaction.patientId}`}</td>
                      <td className="px-2 py-2">
                        {transaction.paymentMethod === "cash" ? "Tunai" : 
                         transaction.paymentMethod === "debit" ? "Debit" : 
                         transaction.paymentMethod === "bank_transfer" ? "Transfer" : 
                         transaction.paymentMethod === "qris" ? "QRIS" : transaction.paymentMethod}
                      </td>
                      <td className="px-2 py-2 text-right">Rp{transaction.totalAmount}</td>
                      {dialogType === "debt" && (
                        <td className="px-2 py-2 text-right font-medium text-red-600">
                          {parseFloat(transaction.debtAmount.replace(/\./g, '').replace(',', '.')) > 0 
                            ? `Rp${transaction.debtAmount}` 
                            : parseFloat(transaction.creditAmount.replace(/\./g, '').replace(',', '.')) > 0
                              ? `Rp${transaction.creditAmount}`
                              : "Rp0"}
                        </td>
                      )}
                      {dialogType === "debtPayment" && (
                        <td className="px-2 py-2 text-right font-medium text-green-600">Rp{transaction.paidAmount}</td>
                      )}
                      {dialogType === "credit" && (
                        <td className="px-2 py-2 text-right font-medium text-blue-600">Rp{transaction.creditAmount}</td>
                      )}
                      {dialogType === "discount" && (
                        <td className="px-2 py-2 text-right font-medium text-emerald-600">
                          Rp{transaction.discount}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 bg-gray-50 dark:bg-gray-800">
                  <tr className="font-semibold">
                    <td colSpan={4} className="px-2 py-3 text-right">Total:</td>
                    <td className="px-2 py-3 text-right">
                      Rp{transactionDetails.reduce((sum, t) => sum + parseInt(t.totalAmount.replace(/\./g, '')), 0).toLocaleString('id-ID')}
                    </td>
                    {dialogType === "debt" && (
                      <td className="px-2 py-3 text-right text-red-600">
                        Rp{transactionDetails.reduce((sum, t) => {
                          // Jika ada hutang, gunakan nilai hutang
                          const debtValue = parseFloat(t.debtAmount.replace(/\./g, '').replace(',', '.'));
                          // Jika ada kredit, gunakan nilai kredit
                          const creditValue = parseFloat(t.creditAmount.replace(/\./g, '').replace(',', '.'));
                          
                          // Prioritaskan hutang, jika tidak ada gunakan kredit
                          const totalDebt = debtValue > 0 ? debtValue : (creditValue > 0 ? creditValue : 0);
                          return sum + totalDebt;
                        }, 0).toLocaleString('id-ID')}
                      </td>
                    )}
                    {dialogType === "debtPayment" && (
                      <td className="px-2 py-3 text-right text-green-600">
                        Rp{transactionDetails.reduce((sum, t) => sum + parseInt(t.paidAmount.replace(/\./g, '')), 0).toLocaleString('id-ID')}
                      </td>
                    )}
                    {dialogType === "credit" && (
                      <td className="px-2 py-3 text-right text-blue-600">
                        Rp{transactionDetails.reduce((sum, t) => sum + parseInt(t.creditAmount.replace(/\./g, '')), 0).toLocaleString('id-ID')}
                      </td>
                    )}
                    {dialogType === "discount" && (
                      <td className="px-2 py-3 text-right text-emerald-600">
                        Rp{transactionDetails.reduce((sum, t) => sum + parseInt(t.discount.replace(/\./g, '')), 0).toLocaleString('id-ID')}
                      </td>
                    )}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
