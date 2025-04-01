import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { id } from "date-fns/locale";
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
import TransactionForm from "@/components/transactions/transaction-form";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["/api/transactions"],
  });

  const { data: patients } = useQuery({
    queryKey: ["/api/patients"],
  });

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
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
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
        onClose={() => setIsTransactionFormOpen(false)}
      />
    </div>
  );
}
