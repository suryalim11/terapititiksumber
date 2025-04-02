import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
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
import TransactionForm from "@/components/transactions/transaction-form";
import Invoice from "@/components/transactions/invoice";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Transaction = {
  id: number;
  transactionId: string;
  patientId: number;
  totalAmount: string;
  paymentMethod: string;
  items: any[];
  createdAt: string;
  patient?: {
    name: string;
    patientId: string;
  };
};

export default function Transactions() {
  const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [location] = useLocation();
  const { toast } = useToast();

  // Event listener untuk membuka form transaksi dari komponen lain
  useEffect(() => {
    // Fungsi untuk menangani event dari slot-patients-dialog
    const handleOpenTransactionForm = (event: CustomEvent) => {
      const { patientId } = event.detail;
      console.log("Received custom event to open transaction form with patient ID:", patientId);
      
      if (patientId) {
        const patientIdNum = typeof patientId === 'string' ? parseInt(patientId) : patientId;
        console.log("Setting selected patient ID:", patientIdNum);
        
        setSelectedPatientId(patientIdNum);
        setIsTransactionFormOpen(true);
        
        // Debug notification
        toast({
          title: "Membuka form transaksi",
          description: `ID Pasien: ${patientIdNum}`,
        });
      }
    };
    
    // Tambahkan event listener
    window.addEventListener('open-transaction-form', handleOpenTransactionForm as EventListener);
    
    // Cleanup event listener ketika komponen unmount
    return () => {
      window.removeEventListener('open-transaction-form', handleOpenTransactionForm as EventListener);
    };
  }, [toast]);

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["/api/transactions"],
  });

  const { data: patients } = useQuery({
    queryKey: ["/api/patients"],
  });
  
  const { data: packages } = useQuery({
    queryKey: ["/api/packages"],
  });
  
  const { data: products } = useQuery({
    queryKey: ["/api/products"],
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
  
  // Fungsi untuk menghapus transaksi
  const handleDeleteTransaction = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsDeleteDialogOpen(true);
  };
  
  const confirmDeleteTransaction = () => {
    if (selectedTransaction) {
      deleteTransactionMutation.mutate(selectedTransaction.id);
    }
  };

  const getPatientName = (patientId: number) => {
    const patient = patients?.find((p: any) => p.id === patientId);
    return patient ? patient.name : "Pasien";
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "d MMMM yyyy, HH:mm", { locale: id });
    } catch (e) {
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

  const filteredTransactions = transactions
    ? transactions
        .filter((transaction: Transaction) => {
          // Search filter
          const transactionId = transaction.transactionId.toLowerCase();
          const patientName = getPatientName(transaction.patientId).toLowerCase();
          const searchLower = searchTerm.toLowerCase();
          
          return (
            transactionId.includes(searchLower) ||
            patientName.includes(searchLower)
          );
        })
        .sort((a: Transaction, b: Transaction) => {
          // Sort by date (newest first)
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
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
      
      // Set data untuk invoice
      setInvoiceData({
        transaction,
        patient,
        items,
        paymentMethod: transaction.paymentMethod
      });
      
      // Buka dialog invoice
      setIsInvoiceOpen(true);
    } catch (error) {
      console.error("Error viewing transaction:", error);
      toast({
        title: "Gagal menampilkan invoice",
        description: "Terjadi kesalahan saat memuat data transaksi",
        variant: "destructive"
      });
    }
  };
  
  // Fungsi untuk mencetak/mengunduh invoice langsung
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
      
      // Set data untuk invoice
      setInvoiceData({
        transaction,
        patient,
        items,
        paymentMethod: transaction.paymentMethod
      });
      
      // Buka dialog invoice
      setIsInvoiceOpen(true);
    } catch (error) {
      console.error("Error printing transaction:", error);
      toast({
        title: "Gagal mencetak invoice",
        description: "Terjadi kesalahan saat memuat data transaksi",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold font-heading text-gray-900 dark:text-white">
            Transaksi
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Kelola transaksi paket terapi dan produk
          </p>
        </div>
        <Button
          onClick={() => setIsTransactionFormOpen(true)}
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
          Buat Transaksi
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl font-heading">Riwayat Transaksi</CardTitle>
            <CardDescription>
              Semua transaksi yang telah diproses
            </CardDescription>
          </div>
          <div className="flex space-x-2">
            <Input
              placeholder="Cari transaksi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-[250px]"
            />
            <Select
              value={filterStatus}
              onValueChange={setFilterStatus}
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID Transaksi</TableHead>
                    <TableHead>Pasien</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Metode Pembayaran</TableHead>
                    <TableHead>Total</TableHead>
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
                      <TableCell>{formatPrice(transaction.totalAmount)}</TableCell>
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
