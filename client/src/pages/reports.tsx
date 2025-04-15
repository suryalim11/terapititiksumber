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

type Report = {
  type: "daily" | "monthly";
  startDate: string;
  endDate: string;
};

export default function Reports() {
  const [activeTab, setActiveTab] = useState("financial");
  const [reportPeriod, setReportPeriod] = useState<"daily" | "monthly">("daily");
  const [detailedView, setDetailedView] = useState<boolean>(false);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1); // 1-12
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
  const { data: monthlyFinancialReport, isLoading: isLoadingMonthlyReport } = useQuery({
    queryKey: ["/api/reports/monthly-financial", selectedYear, selectedMonth],
    queryFn: async () => {
      const response = await fetch(`/api/reports/monthly-financial?year=${selectedYear}&month=${selectedMonth}`);
      if (!response.ok) {
        throw new Error("Failed to fetch monthly financial report");
      }
      console.log("Fetched monthly financial report");
      return response.json();
    },
    enabled: activeTab === "financial" && reportPeriod === "monthly" && detailedView
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
    transactions.forEach((transaction: any) => {
      // Menggunakan addHours(-7) untuk menyesuaikan ke zona waktu WIB (UTC+7)
      const adjustedDate = addHours(new Date(transaction.createdAt), -7);
      const monthIndex = adjustedDate.getMonth();
      // Hanya gunakan totalAmount yang sebenarnya, jangan kurangi dengan discount 
      // karena discount sudah termasuk dalam totalAmount
      const total = parseFloat(transaction.totalAmount.toString());
      monthlyData[monthIndex].amount += total;
    });

    return monthlyData;
  };

  // Generate session data for chart (package distribution)
  const generatePackageDistribution = () => {
    if (!sessions) return [];

    const packageCounts = {
      "Sesi Tunggal": 0,
      "Paket 12 Sesi": 0,
    };

    sessions.forEach((session: any) => {
      if (session.totalSessions === 1) {
        packageCounts["Sesi Tunggal"]++;
      } else if (session.totalSessions === 12) {
        packageCounts["Paket 12 Sesi"]++;
      }
    });

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
    } else {
      csvContent = "ID Sesi,Pasien,Paket,Total Sesi,Sesi Terpakai,Status\n";
      
      // Data rows
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
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="financial">Laporan Keuangan</TabsTrigger>
            <TabsTrigger value="therapy">Laporan Terapi</TabsTrigger>
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
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
                            <h3 className="text-lg font-semibold mb-2">Total Pendapatan</h3>
                            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                              Rp{(monthlyFinancialReport?.summary?.totalIncome || 0).toLocaleString('id-ID')}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              Dari {monthlyFinancialReport?.summary?.transactionCount || 0} transaksi
                            </p>
                          </div>
                          
                          <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg">
                            <h3 className="text-lg font-semibold mb-2">Penjualan Produk</h3>
                            <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                              Rp{(monthlyFinancialReport?.summary?.totalProductSales || 0).toLocaleString('id-ID')}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              {monthlyFinancialReport?.summary?.totalIncome
                                ? Math.round((monthlyFinancialReport.summary.totalProductSales / monthlyFinancialReport.summary.totalIncome) * 100)
                                : 0}% dari total
                            </p>
                          </div>
                          
                          <div className="bg-purple-50 dark:bg-purple-900/30 p-4 rounded-lg">
                            <h3 className="text-lg font-semibold mb-2">Penjualan Layanan</h3>
                            <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                              Rp{(monthlyFinancialReport?.summary?.totalServiceSales || 0).toLocaleString('id-ID')}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              {monthlyFinancialReport?.summary?.totalIncome
                                ? Math.round((monthlyFinancialReport.summary.totalServiceSales / monthlyFinancialReport.summary.totalIncome) * 100)
                                : 0}% dari total
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
        </Tabs>
      </div>
    </div>
  );
}
