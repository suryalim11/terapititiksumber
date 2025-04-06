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
  const urlParams = new URLSearchParams(location.split("?")[1]);
  const patientIdFromUrl = urlParams.get("patientId");
  
  // States
  const [searchTerm, setSearchTerm] = useState("");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  
  const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(patientIdFromUrl ? parseInt(patientIdFromUrl) : null);
  
  // State untuk dialog konfirmasi hapus
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<number | null>(null);
  
  // State untuk invoice
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  
  // Effect untuk auto-show form jika ada patientId di URL
  useEffect(() => {
    if (patientIdFromUrl) {
      setIsTransactionFormOpen(true);
    }
  }, [patientIdFromUrl]);
  
  // Custom Event Listener untuk menerima notifikasi dari sidebar
  useEffect(() => {
    const handleOpenTransactionForm = (event: CustomEvent) => {
      const patientId = event.detail?.patientId;
      
      if (patientId) {
        setSelectedPatientId(patientId);
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
  
  // Fetch patients
  const { data: patients } = useQuery({
    queryKey: ["/api/patients"],
    staleTime: 30000,
  });
  
  const { data: packages } = useQuery({
    queryKey: ["/api/packages"],
    staleTime: 30000,
  });
  
  const { data: products } = useQuery({
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
      
      if (!patient) {
        toast({
          title: "Data tidak lengkap",
          description: "Data pasien tidak ditemukan",
          variant: "destructive"
        });
        return;
      }
      
      // Siapkan data item untuk invoice
      const items = (transaction.items || []).map((item: any) => ({
        id: item.id,
        type: item.type,
        name: item.type === 'package' ? 
          (packages?.find((p: any) => p.id === item.id)?.name || 'Paket Terapi') :
          (products?.find((p: any) => p.id === item.id)?.name || 'Produk'),
        price: item.price,
        quantity: item.quantity
      }));
      
      // Dapatkan subtotal dan diskon dari transaksi
      const subtotalValue = parseFloat(transaction.subtotal?.toString() || "0");
      const subtotal = subtotalValue > 0 ? subtotalValue : parseFloat(transaction.totalAmount.toString());
      const discount = parseFloat(transaction.discount?.toString() || "0");
      
      // Set data untuk invoice
      setInvoiceData({
        transaction,
        patient,
        items,
        paymentMethod: transaction.paymentMethod,
        subtotal: subtotal,
        discount: discount,
        isPaid: transaction.isPaid,
        creditAmount: transaction.creditAmount,
        paidAmount: transaction.paidAmount
      });
      
      // Buka dialog invoice
      setIsInvoiceOpen(true);
    } catch (error) {
      console.error("Error viewing transaction:", error);
      toast({
        title: "Gagal melihat invoice",
        description: "Terjadi kesalahan saat menyiapkan data invoice",
        variant: "destructive"
      });
    }
  };
  
  const handleDeleteTransaction = (transaction: Transaction) => {
    setTransactionToDelete(transaction.id);
    setIsDeleteDialogOpen(true);
  };

  const handlePrintTransaction = (transaction: any) => {
    try {
      // Cari data pasien untuk transaksi ini
      const patient = patients?.find((p: any) => p.id === transaction.patientId);
      
      if (!patient) {
        toast({
          title: "Data tidak lengkap",
          description: "Data pasien tidak ditemukan",
          variant: "destructive"
        });
        return;
      }
      
      // Siapkan data item untuk invoice
      const items = (transaction.items || []).map((item: any) => ({
        id: item.id,
        type: item.type,
        name: item.type === 'package' ? 
          (packages?.find((p: any) => p.id === item.id)?.name || 'Paket Terapi') :
          (products?.find((p: any) => p.id === item.id)?.name || 'Produk'),
        price: item.price,
        quantity: item.quantity
      }));
      
      // Dapatkan subtotal dan diskon dari transaksi
      // Jika subtotal adalah 0 atau null, gunakan totalAmount sebagai subtotal
      const subtotalValue = parseFloat(transaction.subtotal?.toString() || "0");
      const subtotal = subtotalValue > 0 ? subtotalValue : parseFloat(transaction.totalAmount.toString());
      const discount = parseFloat(transaction.discount?.toString() || "0");
      
      console.log("Print Invoice data preparation:", {
        subtotalValue,
        subtotal,
        discount,
        totalInTransaction: transaction.totalAmount,
        subtotalInTransaction: transaction.subtotal
      });
      
      // Set data untuk invoice
      setInvoiceData({
        transaction,
        patient,
        items,
        paymentMethod: transaction.paymentMethod,
        subtotal: subtotal,
        discount: discount,
        isPaid: transaction.isPaid,
        creditAmount: transaction.creditAmount,
        paidAmount: transaction.paidAmount
      });
      
      // Buka dialog invoice dengan flag untuk langsung print
      setTimeout(() => {
        // Buka dialog invoice terlebih dahulu
        setIsInvoiceOpen(true);
      }, 100);
    } catch (error) {
      console.error("Error printing transaction:", error);
      toast({
        title: "Gagal mencetak invoice",
        description: "Terjadi kesalahan saat menyiapkan data invoice",
        variant: "destructive"
      });
    }
  };
  
  return (
    <div className="space-y-4 p-4 pt-0">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center pb-4">
          <div>
            <CardTitle>Transaksi</CardTitle>
            <CardDescription>
              {patientFromUrl 
                ? `Transaksi untuk pasien: ${patientFromUrl.name}`
                : "Daftar transaksi pasien, pembayaran, dan piutang"}
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-3">
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari transaksi..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button 
              className="w-full sm:w-auto"
              onClick={() => {
                setSelectedPatientId(null);
                setIsTransactionFormOpen(true);
              }}
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              Transaksi Baru
            </Button>
            
            <Select
              value={periodFilter}
              onValueChange={(value) => setPeriodFilter(value)}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Transaksi</SelectItem>
                <SelectItem value="today">Hari Ini</SelectItem>
                <SelectItem value="week">Minggu Ini</SelectItem>
                <SelectItem value="month">Bulan Ini</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : !filteredTransactions || filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {searchTerm ? "Tidak ada transaksi yang sesuai dengan pencarian." : "Belum ada transaksi."}
            </div>
          ) : (
            <>
              {/* Desktop view with table (hidden on mobile) */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead 
                        className="cursor-pointer"
                        onClick={() => requestSort('transactionId')}
                      >
                        <div className="flex items-center">
                          ID Transaksi
                          {getSortIcon('transactionId')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer"
                        onClick={() => requestSort('patient')}
                      >
                        <div className="flex items-center">
                          Pasien
                          {getSortIcon('patient')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer"
                        onClick={() => requestSort('date')}
                      >
                        <div className="flex items-center">
                          Tanggal
                          {getSortIcon('date')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer"
                        onClick={() => requestSort('paymentMethod')}
                      >
                        <div className="flex items-center">
                          Metode Pembayaran
                          {getSortIcon('paymentMethod')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer"
                        onClick={() => requestSort('subtotal')}
                      >
                        <div className="flex items-center">
                          Subtotal
                          {getSortIcon('subtotal')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer"
                        onClick={() => requestSort('discount')}
                      >
                        <div className="flex items-center">
                          Diskon
                          {getSortIcon('discount')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer"
                        onClick={() => requestSort('total')}
                      >
                        <div className="flex items-center">
                          Total
                          {getSortIcon('total')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer"
                        onClick={() => requestSort('credit')}
                      >
                        <div className="flex items-center">
                          Kredit
                          {getSortIcon('credit')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer"
                        onClick={() => requestSort('status')}
                      >
                        <div className="flex items-center">
                          Status
                          {getSortIcon('status')}
                        </div>
                      </TableHead>
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((transaction: Transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell className="font-medium">{transaction.transactionId}</TableCell>
                        <TableCell>{getPatientName(transaction.patientId)}</TableCell>
                        <TableCell>{formatDate(transaction.createdAt)}</TableCell>
                        <TableCell>{formatPaymentMethod(transaction.paymentMethod)}</TableCell>
                        <TableCell>
                          {formatPrice(
                            parseFloat(transaction.subtotal?.toString() || "0") > 0 
                              ? transaction.subtotal?.toString() || "0" 
                              : transaction.totalAmount.toString()
                          )}
                        </TableCell>
                        <TableCell className="text-red-500">
                          {transaction.discount && parseFloat(transaction.discount.toString()) > 0 
                            ? formatPrice(transaction.discount.toString())
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {formatPrice(
                            transaction.creditAmount && parseFloat(transaction.creditAmount.toString()) > 0
                              ? (parseFloat(transaction.totalAmount.toString()) - parseFloat(transaction.creditAmount.toString())).toString()
                              : transaction.totalAmount.toString()
                          )}
                        </TableCell>
                        <TableCell>
                          {transaction.creditAmount && parseFloat(transaction.creditAmount.toString()) > 0 ? (
                            <span className="text-red-600 font-medium">{formatPrice(transaction.creditAmount.toString())}</span>
                          ) : (
                            <span>-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {transaction.creditAmount && parseFloat(transaction.creditAmount.toString()) > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Kredit
                            </span>
                          ) : transaction.isPaid ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Lunas
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Belum Lunas
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 w-8 p-0"
                              onClick={() => handleViewTransaction(transaction)}
                              title="Lihat Invoice"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 w-8 p-0"
                              onClick={() => handlePrintTransaction(transaction)}
                              title="Cetak Invoice"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                              </svg>
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-100"
                              onClick={() => handleDeleteTransaction(transaction)}
                              title="Hapus Transaksi"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile view with cards */}
              <div className="md:hidden space-y-4 mt-4">
                {filteredTransactions.map((transaction: Transaction) => (
                  <div key={transaction.id} className="bg-card rounded-lg border shadow-sm p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-medium text-sm">{transaction.transactionId}</div>
                        <div className="text-base font-semibold">{getPatientName(transaction.patientId)}</div>
                        <div className="text-sm text-muted-foreground">{formatDate(transaction.createdAt)}</div>
                      </div>
                      <div className={`text-xs inline-flex items-center font-semibold px-2.5 py-1 rounded-full ${
                        transaction.creditAmount && parseFloat(transaction.creditAmount.toString()) > 0
                          ? 'bg-yellow-100 text-yellow-800'
                          : transaction.isPaid 
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                      }`}>
                        {transaction.creditAmount && parseFloat(transaction.creditAmount.toString()) > 0
                          ? 'Kredit'
                          : transaction.isPaid 
                            ? 'Lunas'
                            : 'Belum Lunas'}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <div>
                        <div className="text-muted-foreground">Metode</div>
                        <div>{formatPaymentMethod(transaction.paymentMethod)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Total</div>
                        <div className="font-medium">{formatPrice(transaction.totalAmount.toString())}</div>
                      </div>
                      
                      {(transaction.subtotal && parseFloat(transaction.subtotal.toString()) > 0) && (
                        <div>
                          <div className="text-muted-foreground">Subtotal</div>
                          <div>{formatPrice(transaction.subtotal.toString())}</div>
                        </div>
                      )}
                      
                      {(transaction.discount && parseFloat(transaction.discount.toString()) > 0) && (
                        <div>
                          <div className="text-muted-foreground">Diskon</div>
                          <div className="text-red-500">{formatPrice(transaction.discount.toString())}</div>
                        </div>
                      )}
                      
                      {(transaction.creditAmount && parseFloat(transaction.creditAmount.toString()) > 0) && (
                        <div>
                          <div className="text-muted-foreground">Kredit</div>
                          <div className="text-red-600 font-medium">{formatPrice(transaction.creditAmount.toString())}</div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm" 
                        variant="outline"
                        onClick={() => handleViewTransaction(transaction)}
                        className="h-10 px-3"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Lihat
                      </Button>
                      <Button
                        size="sm" 
                        variant="outline"
                        onClick={() => handlePrintTransaction(transaction)}
                        className="h-10 px-3"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Cetak
                      </Button>
                      <Button
                        size="sm" 
                        variant="outline"
                        onClick={() => handleDeleteTransaction(transaction)}
                        className="h-10 px-3 text-red-500 border-red-200 hover:text-red-600 hover:bg-red-50"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Hapus
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <TransactionForm
        isOpen={isTransactionFormOpen}
        onClose={() => {
          setIsTransactionFormOpen(false);
          setSelectedPatientId(null);
        }}
        selectedPatientId={selectedPatientId}
      />
      
      {/* Tambahkan Invoice component */}
      {invoiceData && (
        <Invoice 
          isOpen={isInvoiceOpen}
          onClose={() => setIsInvoiceOpen(false)}
          data={invoiceData}
        />
      )}
      
      {/* Dialog konfirmasi hapus transaksi */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Hapus Transaksi</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus transaksi ini? Tindakan ini akan menghapus data transaksi, sesi terapi yang terkait, dan mengembalikan stok produk.
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-400 rounded text-sm">
                <p className="font-semibold">Peringatan:</p>
                <p>Jika transaksi terkait dengan paket terapi yang sedang aktif, semua data sesi terapi juga akan dihapus.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setSelectedTransaction(null);
              }}
            >
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteTransaction}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteTransactionMutation.isPending}
            >
              {deleteTransactionMutation.isPending ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Menghapus...
                </div>
              ) : "Hapus Transaksi"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}