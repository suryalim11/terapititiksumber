import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, addHours, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { id } from "date-fns/locale";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
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
import { ArrowUpDown, ArrowUp, ArrowDown, Search, PlusCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import TransactionForm from "@/components/transactions/transaction-form";
import Invoice from "@/components/transactions/invoice";

type Transaction = {
  id: number;
  transactionId: string;
  patientId: number;
  totalAmount: string;
  paymentMethod: string;
  items: any[];
  createdAt: string;
  discount?: string | number;
  subtotal?: string | number;
  creditAmount?: string | number;
  paidAmount?: string | number;
  isPaid?: boolean;
  patient?: {
    name: string;
    patientId: string;
  };
};

export default function Transactions() {
  const [location] = useLocation();
  const { toast } = useToast();
  
  // Extract patient ID from URL if present
  const urlParams = new URLSearchParams(location.split("?")[1] || "");
  const patientIdFromUrl = urlParams.get("patientId");
  
  // States
  const [searchTerm, setSearchTerm] = useState("");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  
  const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  
  // Debug untuk parameter pasien
  console.log("URL parameters:", {
    location,
    params: location.split("?")[1] || "",
    patientIdFromUrl,
    patientIdNumber: patientIdFromUrl ? parseInt(patientIdFromUrl) : null
  });
  
  // State untuk dialog konfirmasi hapus
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<number | null>(null);
  
  // State untuk invoice
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  
  // Fetch patients
  const { data: patients = [] } = useQuery<any[]>({
    queryKey: ["/api/patients"],
    staleTime: 30000,
  });
  
  // Effect untuk auto-show form jika ada patientId di URL
  useEffect(() => {
    if (patientIdFromUrl) {
      const patientIdNumber = parseInt(patientIdFromUrl);
      console.log("Ditemukan patientId di URL:", patientIdNumber);
      
      // Jangan lakukan apa-apa sampai patients sudah terload
      if (!patients || patients.length === 0) {
        console.log("Menunggu data pasien tersedia...");
        return;
      }
      
      console.log("Data pasien tersedia, jumlah:", patients.length);
      
      // Verifikasi pasien ada dalam data
      const patientExists = patients.some((p: any) => p.id === patientIdNumber);
      console.log("Pasien ditemukan:", patientExists);
      
      if (patientExists) {
        // Set selected patient ID
        setSelectedPatientId(patientIdNumber);
        
        // Buka form transaksi
        setIsTransactionFormOpen(true);
        
        // Tampilkan toast notifikasi untuk membantu pengguna
        toast({
          title: "Membuat transaksi baru",
          description: "Form transaksi dibuka dengan data pasien"
        });
      } else {
        toast({
          title: "Pasien tidak ditemukan",
          description: `Tidak dapat menemukan pasien dengan ID ${patientIdNumber}`,
          variant: "destructive"
        });
      }
    }
  }, [patientIdFromUrl, patients, toast]);
  
  // Custom Event Listener untuk menerima notifikasi dari sidebar
  useEffect(() => {
    const handleOpenTransactionForm = (event: CustomEvent) => {
      const patientId = event.detail?.patientId;
      
      if (patientId) {
        // Parse patientId ke number untuk memastikan tipe data
        const patientIdNumber = typeof patientId === 'string' ? parseInt(patientId) : patientId;
        setSelectedPatientId(patientIdNumber);
        
        console.log("Membuka form transaksi dengan patient ID:", patientIdNumber);
      } else {
        setSelectedPatientId(null);
      }
      
      setIsTransactionFormOpen(true);
    };
    
    window.addEventListener('openTransactionForm' as any, handleOpenTransactionForm);
    
    return () => {
      window.removeEventListener('openTransactionForm' as any, handleOpenTransactionForm);
    };
  }, []);
  
  // Fetch data transactions
  const { 
    data: transactions, 
    isLoading, 
    refetch: refetchTransactions,
    error: transactionsError
  } = useQuery({
    queryKey: ["/api/transactions"],
    staleTime: 0, // Tidak menggunakan cache untuk memastikan data selalu terbaru
    queryFn: async () => {
      console.log("Fetching all transactions");
      try {
        const data = await apiRequest<Transaction[]>("/api/transactions");
        console.log(`Retrieved ${data.length} transactions from API`);
        if (data.length > 0) {
          console.log("First transaction:", data[0].transactionId);
        }
        return data;
      } catch (error) {
        console.error("Error fetching transactions:", error);
        throw error;
      }
    }
  });
  
  // Fetch packages & products
  const { data: packages = [] } = useQuery<any[]>({
    queryKey: ["/api/packages"],
    staleTime: 30000,
  });
  
  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["/api/products"],
    staleTime: 30000,
  });
  
  // Mutation untuk menghapus transaksi
  const deleteTransactionMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/transactions/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({
        title: "Transaksi berhasil dihapus",
        description: "Data transaksi telah dihapus dari sistem",
      });
      
      // Invalidate query untuk merefresh data
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      
      // Reset state
      setSelectedTransaction(null);
      setIsDeleteDialogOpen(false);
    },
    onError: (error) => {
      console.error("Error deleting transaction:", error);
      toast({
        title: "Gagal menghapus transaksi",
        description: "Terjadi kesalahan saat menghapus data. Silakan coba lagi.",
        variant: "destructive"
      });
    }
  });
  
  const confirmDeleteTransaction = () => {
    if (transactionToDelete) {
      deleteTransactionMutation.mutate(transactionToDelete);
    }
  };
  
  const setSelectedTransaction = (id: number | null) => {
    setTransactionToDelete(id);
  };
  
  const getPatientName = (patientId: number) => {
    const patient = patients?.find((p: any) => p.id === patientId);
    return patient ? patient.name : "-";
  };
  
  const formatDate = (dateString: string) => {
    try {
      console.log("Formatting date string:", dateString);
      
      // KOREKSI ZONA WAKTU:
      // Dari pengujian, tanggal dari database perlu dikurangi 14 jam
      // kemudian ditambahkan 7 jam untuk mendapatkan waktu WIB yang benar
      let date;
      if (dateString.includes('T')) {
        // Format ISO (2025-04-03T12:56:44.699Z)
        date = new Date(dateString);
        // Kurangi 14 jam sesuai koreksi
        date = new Date(date.getTime() - (14 * 60 * 60 * 1000));
        // Tambahkan 7 jam untuk WIB
        date = new Date(date.getTime() + (7 * 60 * 60 * 1000));
      } else {
        // Format SQL (2025-04-03 12:56:44.699)
        const parts = dateString.split(' ');
        if (parts.length === 2) {
          const [datePart, timePart] = parts;
          const isoString = `${datePart}T${timePart}Z`; // Tambahkan Z untuk UTC
          date = new Date(isoString);
          // Kurangi 14 jam sesuai koreksi
          date = new Date(date.getTime() - (14 * 60 * 60 * 1000));
          // Tambahkan 7 jam untuk WIB
          date = new Date(date.getTime() + (7 * 60 * 60 * 1000));
        } else {
          // Fallback untuk format lain
          date = new Date(dateString);
          // Kurangi 14 jam sesuai koreksi
          date = new Date(date.getTime() - (14 * 60 * 60 * 1000));
          // Tambahkan 7 jam untuk WIB
          date = new Date(date.getTime() + (7 * 60 * 60 * 1000));
        }
      }
      
      console.log("Original:", dateString, "-> Corrected date (WIB):", date.toISOString());
      
      // Format dengan locale Indonesia
      return format(date, "dd/MM/yyyy HH:mm", { locale: id });
    } catch (error) {
      console.error("Error formatting date:", error, dateString);
      return dateString;
    }
  };
  
  const formatPaymentMethod = (method: string) => {
    switch (method) {
      case "bank_transfer":
        return "Transfer Bank";
      case "qris":
        return "QRIS";
      case "cash":
        return "Tunai";
      default:
        return method;
    }
  };
  
  const formatPrice = (price: string) => {
    return `Rp${parseInt(price).toLocaleString("id-ID")}`;
  };
  
  // Get patient dari URL jika ada
  const patientFromUrl = patientIdFromUrl ? 
    patients?.find((p: any) => p.id === parseInt(patientIdFromUrl)) : null;
  
  // Fungsi untuk mengelola sorting
  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    
    // Jika sudah ada sorting pada kolom yang sama, toggle arah sorting
    if (sortConfig && sortConfig.key === key) {
      direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    }
    
    setSortConfig({ key, direction });
  };
  
  // Fungsi untuk mendapatkan icon sorting yang sesuai
  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="h-4 w-4" /> 
      : <ArrowDown className="h-4 w-4" />;
  };
  
  // Fungsi untuk memfilter berdasarkan periode
  const getFilteredByPeriod = (transaction: Transaction) => {
    try {
      const now = new Date();
      const txDate = new Date(transaction.createdAt);
      
      switch (periodFilter) {
        case "today": {
          const todayStart = startOfDay(now);
          const todayEnd = endOfDay(now);
          return isWithinInterval(txDate, { start: todayStart, end: todayEnd });
        }
        case "week": {
          const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Start on Monday
          const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
          return isWithinInterval(txDate, { start: weekStart, end: weekEnd });
        }
        case "month": {
          const monthStart = startOfMonth(now);
          const monthEnd = endOfMonth(now);
          return isWithinInterval(txDate, { start: monthStart, end: monthEnd });
        }
        default:
          return true;
      }
    } catch (error) {
      console.error("Error filtering transaction by period:", error);
      return true;
    }
  };
  
  // Filter dan sort transaksi berdasarkan pencarian, periode, dan urutan
  // Log data yang diterima
  useEffect(() => {
    if (transactions) {
      console.log("Data transaksi tersedia:", transactions.length);
    } else {
      console.log("Data transaksi belum tersedia");
    }
    
    if (patients) {
      console.log("Data pasien tersedia:", patients.length);
    }
  }, [transactions, patients]);
  
  const filteredTransactions = transactions 
    ? transactions
        .filter((transaction: Transaction) => {
          // Filter by search term
          if (searchTerm) {
            const patientName = getPatientName(transaction.patientId).toLowerCase();
            const txId = transaction.transactionId.toLowerCase();
            
            return patientName.includes(searchTerm.toLowerCase()) || 
                  txId.includes(searchTerm.toLowerCase());
          }
          return true;
        })
        .filter(getFilteredByPeriod)
        .sort((a: Transaction, b: Transaction) => {
          if (!sortConfig) {
            // Default sort by date (newest first)
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          }
          
          const direction = sortConfig.direction === 'asc' ? 1 : -1;
          
          switch (sortConfig.key) {
            case 'transactionId':
              return direction * a.transactionId.localeCompare(b.transactionId);
            case 'patient':
              return direction * getPatientName(a.patientId).localeCompare(getPatientName(b.patientId));
            case 'date':
              return direction * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            case 'paymentMethod':
              return direction * a.paymentMethod.localeCompare(b.paymentMethod);
            case 'subtotal':
              const aSubtotal = parseFloat(a.subtotal?.toString() || "0");
              const bSubtotal = parseFloat(b.subtotal?.toString() || "0");
              return direction * (aSubtotal - bSubtotal);
            case 'discount':
              const aDiscount = parseFloat(a.discount?.toString() || "0");
              const bDiscount = parseFloat(b.discount?.toString() || "0");
              return direction * (aDiscount - bDiscount);
            case 'total':
              const aTotal = parseFloat(a.totalAmount.toString());
              const bTotal = parseFloat(b.totalAmount.toString());
              
              // Menghitung total yang sudah dikurangi kredit/utang
              const aActualTotal = a.creditAmount && parseFloat(a.creditAmount.toString()) > 0
                ? aTotal - parseFloat(a.creditAmount.toString())
                : aTotal;
              
              const bActualTotal = b.creditAmount && parseFloat(b.creditAmount.toString()) > 0
                ? bTotal - parseFloat(b.creditAmount.toString())
                : bTotal;
                
              return direction * (aActualTotal - bActualTotal);
            case 'credit':
              const aCredit = parseFloat(a.creditAmount?.toString() || "0");
              const bCredit = parseFloat(b.creditAmount?.toString() || "0");
              return direction * (aCredit - bCredit);
            case 'status':
              // Sort by isPaid status
              const aStatus = a.isPaid ? "1" : (a.creditAmount && parseFloat(a.creditAmount.toString()) > 0 ? "2" : "1");
              const bStatus = b.isPaid ? "1" : (b.creditAmount && parseFloat(b.creditAmount.toString()) > 0 ? "2" : "1");
              return direction * aStatus.localeCompare(bStatus);
            default:
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          }
        })
    : [];
  
  // Fungsi untuk melihat detail transaksi dan membuka invoice
  const handleViewTransaction = (transaction: any) => {
    try {
      // Cari data pasien untuk transaksi ini
      const patient = patients?.find((p: any) => p.id === transaction.patientId);
      
      // Set invoice data dengan data transaksi yang lengkap
      const invoiceData = {
        ...transaction,
        patient: patient || { name: "Pasien tidak ditemukan", patientId: "-" }
      };
      
      setInvoiceData(invoiceData);
      setIsInvoiceOpen(true);
    } catch (error) {
      console.error("Error viewing transaction:", error);
      toast({
        title: "Gagal melihat detail transaksi",
        description: "Terjadi kesalahan. Silakan coba lagi.",
        variant: "destructive"
      });
    }
  };
  
  // Fungsi untuk menghapus transaksi
  const handleDeleteTransaction = (transaction: Transaction) => {
    setSelectedTransaction(transaction.id);
    setIsDeleteDialogOpen(true);
  };
  
  // Fungsi untuk mencetak invoice
  const handlePrintTransaction = (transaction: Transaction) => {
    try {
      // Cari data pasien untuk transaksi ini
      const patient = patients?.find((p: any) => p.id === transaction.patientId);
      
      // Set invoice data dengan data transaksi yang lengkap
      const invoiceData = {
        ...transaction,
        patient: patient || { name: "Pasien tidak ditemukan", patientId: "-" }
      };
      
      setInvoiceData(invoiceData);
      setIsInvoiceOpen(true);
      
      // Print setelah invoice terbuka
      setTimeout(() => {
        window.print();
      }, 500);
    } catch (error) {
      console.error("Error printing transaction:", error);
      toast({
        title: "Gagal mencetak transaksi",
        description: "Terjadi kesalahan. Silakan coba lagi.",
        variant: "destructive"
      });
    }
  };
  
  // Render
  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Transaksi</h1>
          <p className="text-muted-foreground">Kelola semua transaksi pasien</p>
        </div>
        <div className="mt-4 md:mt-0 flex flex-col sm:flex-row gap-2">
          <Button onClick={() => {
            setSelectedPatientId(null);
            setIsTransactionFormOpen(true);
          }}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Transaksi Baru
          </Button>
        </div>
      </div>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filter & Pencarian</CardTitle>
          <CardDescription>
            Cari transaksi berdasarkan nama pasien atau ID transaksi
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari nama pasien atau ID transaksi..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="w-full md:w-[200px]">
              <Select
                value={periodFilter}
                onValueChange={(value) => setPeriodFilter(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih periode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Waktu</SelectItem>
                  <SelectItem value="today">Hari Ini</SelectItem>
                  <SelectItem value="week">Minggu Ini</SelectItem>
                  <SelectItem value="month">Bulan Ini</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {isLoading ? (
        <div className="w-full flex justify-center items-center py-8">
          <p>Memuat data transaksi...</p>
        </div>
      ) : transactionsError ? (
        <div className="w-full flex justify-center items-center py-8">
          <p className="text-red-500">Gagal memuat data transaksi. Silakan refresh halaman.</p>
        </div>
      ) : (
        <>
          {/* Tampilan Desktop */}
          <div className="hidden md:block overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]" onClick={() => requestSort('transactionId')}>
                    <div className="flex items-center cursor-pointer">
                      ID Transaksi
                      {getSortIcon('transactionId')}
                    </div>
                  </TableHead>
                  <TableHead onClick={() => requestSort('patient')}>
                    <div className="flex items-center cursor-pointer">
                      Pasien
                      {getSortIcon('patient')}
                    </div>
                  </TableHead>
                  <TableHead onClick={() => requestSort('date')}>
                    <div className="flex items-center cursor-pointer">
                      Tanggal
                      {getSortIcon('date')}
                    </div>
                  </TableHead>
                  <TableHead onClick={() => requestSort('paymentMethod')}>
                    <div className="flex items-center cursor-pointer">
                      Metode Pembayaran
                      {getSortIcon('paymentMethod')}
                    </div>
                  </TableHead>
                  <TableHead className="text-right" onClick={() => requestSort('total')}>
                    <div className="flex items-center justify-end cursor-pointer">
                      Total
                      {getSortIcon('total')}
                    </div>
                  </TableHead>
                  <TableHead className="text-right" onClick={() => requestSort('credit')}>
                    <div className="flex items-center justify-end cursor-pointer">
                      Kredit
                      {getSortIcon('credit')}
                    </div>
                  </TableHead>
                  <TableHead onClick={() => requestSort('status')}>
                    <div className="flex items-center cursor-pointer">
                      Status
                      {getSortIcon('status')}
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-4">
                      Tidak ada transaksi yang ditemukan
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((transaction: Transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-medium">
                        {transaction.transactionId}
                      </TableCell>
                      <TableCell>{getPatientName(transaction.patientId)}</TableCell>
                      <TableCell>{formatDate(transaction.createdAt)}</TableCell>
                      <TableCell>{formatPaymentMethod(transaction.paymentMethod)}</TableCell>
                      <TableCell className="text-right">{formatPrice(transaction.totalAmount)}</TableCell>
                      <TableCell className="text-right">
                        {transaction.creditAmount ? formatPrice(transaction.creditAmount.toString()) : "-"}
                      </TableCell>
                      <TableCell>
                        {transaction.isPaid ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Lunas
                          </span>
                        ) : transaction.creditAmount && parseFloat(transaction.creditAmount.toString()) > 0 ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            Kredit
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Lunas
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewTransaction(transaction)}
                        >
                          Detail
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteTransaction(transaction)}
                        >
                          Hapus
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Tampilan Mobile */}
          <div className="md:hidden space-y-4">
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-4 border rounded-md">
                Tidak ada transaksi yang ditemukan
              </div>
            ) : (
              filteredTransactions.map((transaction: Transaction) => (
                <Card key={transaction.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-md flex justify-between">
                      <span>{transaction.transactionId}</span>
                      {transaction.isPaid ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Lunas
                        </span>
                      ) : transaction.creditAmount && parseFloat(transaction.creditAmount.toString()) > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          Kredit
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Lunas
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription>{formatDate(transaction.createdAt)}</CardDescription>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <div className="grid grid-cols-2 gap-1">
                      <div className="text-sm font-medium">Pasien</div>
                      <div className="text-sm">{getPatientName(transaction.patientId)}</div>
                      
                      <div className="text-sm font-medium">Metode</div>
                      <div className="text-sm">{formatPaymentMethod(transaction.paymentMethod)}</div>
                      
                      <div className="text-sm font-medium">Total</div>
                      <div className="text-sm font-semibold">{formatPrice(transaction.totalAmount)}</div>
                      
                      {transaction.creditAmount && parseFloat(transaction.creditAmount.toString()) > 0 && (
                        <>
                          <div className="text-sm font-medium">Kredit</div>
                          <div className="text-sm">{formatPrice(transaction.creditAmount.toString())}</div>
                        </>
                      )}
                    </div>
                    <div className="mt-4 flex justify-between">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewTransaction(transaction)}
                      >
                        Detail
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteTransaction(transaction)}
                      >
                        Hapus
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </>
      )}
      
      {/* Form transaksi */}
      <TransactionForm 
        isOpen={isTransactionFormOpen} 
        onClose={() => setIsTransactionFormOpen(false)} 
        selectedPatientId={selectedPatientId}
      />
      
      {/* Invoice modal */}
      <Invoice
        isOpen={isInvoiceOpen}
        onClose={() => setIsInvoiceOpen(false)}
        data={invoiceData}
      />
      
      {/* Dialog konfirmasi hapus */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Hapus Transaksi</AlertDialogTitle>
            <AlertDialogDescription>
              Anda yakin ingin menghapus transaksi ini? Tindakan ini tidak dapat dibatalkan
              dan akan menghapus semua data terkait transaksi ini.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTransaction}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}