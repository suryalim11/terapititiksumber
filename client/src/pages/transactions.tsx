import { useState, useEffect, useRef } from "react";
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
import CreditPaymentForm from "@/components/transactions/credit-payment-form";

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
  metadata?: {
    displayName?: 'original' | 'alternative';
    isDebtPayment?: boolean;
    relatedTransactionId?: number;
    paymentAmount?: string | number;     // Jumlah pembayaran hutang
    debtTransactionId?: number;          // ID transaksi hutang yang dibayar
    originalTransactionId?: number;      // ID transaksi asli jika ini adalah pembayaran hutang
    notes?: string;                     // Catatan tambahan untuk pembayaran hutang
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
  
  // Parameter pasien dari URL (tidak perlu log debug)
  
  // State untuk dialog konfirmasi hapus
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<number | null>(null);
  
  // State untuk invoice
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  
  // State untuk dialog pembayaran hutang/kredit
  const [isCreditPaymentOpen, setIsCreditPaymentOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  
  // Fetch patients
  const { data: patients = [] } = useQuery<any[]>({
    queryKey: ["/api/patients"],
    staleTime: 30000,
  });
  
  // Effect untuk auto-show form jika ada patientId di URL
  // Buat ref untuk melacak apakah form sudah pernah dibuka untuk patientId ini
  const hasOpenedFormRef = useRef(false);
  const localStorageCheckedRef = useRef(false);
  
  // Dapatkan parameter delay dari URL jika ada
  const delayParamFromUrl = urlParams.get("delay");
  
  // State untuk menandai penggunaan fixed endpoints
  const [useFixedEndpoints, setUseFixedEndpoints] = useState(false);

  // Effect untuk langsung membuka form transaksi saat patientId ada di URL
  useEffect(() => {
    // Selalu cek localStorage dulu setiap kali komponen dimounting
    if (!localStorageCheckedRef.current) {
      // Cek localStorage untuk flag endpoint fixed
      const useFixed = localStorage.getItem('use_fixed_endpoints') === 'true';
      setUseFixedEndpoints(useFixed);
      
      // Cek URL parameter untuk useFixed
      const useFixedParam = urlParams.get("useFixed") === 'true';
      if (useFixedParam) {
        setUseFixedEndpoints(true);
      }
      
      const storedPatientId = localStorage.getItem('pendingTransactionPatientId');
      const storedPatientName = localStorage.getItem('pendingTransactionPatientName');
      const shouldOpenForm = localStorage.getItem('openTransactionFormDirectly');
      
      if (storedPatientId && shouldOpenForm === 'true') {
        const patientIdNumber = parseInt(storedPatientId);
        setSelectedPatientId(patientIdNumber);
        setIsTransactionFormOpen(true);
        
        toast({
          title: "Form transaksi dibuka",
          description: `Silahkan lengkapi data transaksi untuk ${storedPatientName || 'pasien'}`
        });
        
        // Hapus data dari localStorage setelah digunakan
        localStorage.removeItem('pendingTransactionPatientId');
        localStorage.removeItem('pendingTransactionPatientName');
        localStorage.removeItem('openTransactionFormDirectly');
      }
      
      localStorageCheckedRef.current = true;
    }
    
    // Tetap memproses URL parameter seperti sebelumnya
    if (patientIdFromUrl && patients.length > 0 && !isTransactionFormOpen) {
      const patientIdNumber = parseInt(patientIdFromUrl);
      const patient = patients.find((p: any) => p.id === patientIdNumber);
      
      if (patient) {
        // Set ID pasien
        setSelectedPatientId(patientIdNumber);
        
        // Buka form transaksi langsung
        setIsTransactionFormOpen(true);
        
        // Notifikasi
        toast({
          title: "Form transaksi dibuka",
          description: `Silahkan lengkapi data transaksi untuk ${patient.name}`
        });
      }
    }
  }, [patientIdFromUrl, patients, isTransactionFormOpen, toast]);
  
  // Effect untuk memeriksa localStorage (recovery mechanism)
  useEffect(() => {
    // Skip jika form sudah dibuka dari URL param atau localStorage sudah diperiksa
    if (patientIdFromUrl || localStorageCheckedRef.current) {
      return;
    }
    
    // Tandai bahwa localStorage sudah diperiksa
    localStorageCheckedRef.current = true;
    
    // Cek apakah ada pending patient ID dari localStorage
    const pendingPatientId = localStorage.getItem('pendingTransactionPatientId');
    const pendingPatientName = localStorage.getItem('pendingTransactionPatientName');
    
    if (pendingPatientId) {
      console.log("Menemukan pending patient ID di localStorage:", pendingPatientId);
      const patientIdNumber = parseInt(pendingPatientId);
      
      // Tunggu data patients tersedia
      if (patients && patients.length > 0) {
        // Cari pasien dalam data dengan pendekatan yang lebih fleksibel
        const patient = patients.find((p: any) => {
          // Konversi ID untuk perbandingan string-to-string
          const pIdStr = p.id.toString();
          const searchIdStr = patientIdNumber.toString();
          return p.id === patientIdNumber || pIdStr === searchIdStr;
        });
        
        if (patient) {
          console.log("Pasien dari localStorage ditemukan:", patient.name);
          
          // Hapus dari localStorage
          localStorage.removeItem('pendingTransactionPatientId');
          localStorage.removeItem('pendingTransactionPatientName');
          
          // Set selectedPatientId
          setSelectedPatientId(patientIdNumber);
          
          // Tampilkan feedback
          toast({
            title: "Data pasien ditemukan",
            description: `Memuat data pasien: ${patient.name}`,
          });
          
          // Buka form transaksi dengan delay
          setTimeout(() => {
            setIsTransactionFormOpen(true);
            toast({
              title: "Form transaksi dibuka",
              description: `Silahkan lengkapi transaksi untuk ${patient.name}`,
            });
          }, 500);
        } else {
          console.log("Pasien dengan ID", patientIdNumber, "tidak ditemukan dalam data lokal");
          
          // Coba ambil langsung dari API
          apiRequest<any>(`/api/patients/${patientIdNumber}`)
            .then(patient => {
              if (patient && patient.id) {
                console.log("Berhasil mengambil data pasien dari API:", patient);
                
                // Hapus dari localStorage 
                localStorage.removeItem('pendingTransactionPatientId');
                localStorage.removeItem('pendingTransactionPatientName');
                
                // Set selectedPatientId
                setSelectedPatientId(patientIdNumber);
                
                // Buka form transaksi
                setTimeout(() => {
                  setIsTransactionFormOpen(true);
                  toast({
                    title: "Form transaksi dibuka",
                    description: `Silahkan lengkapi transaksi untuk ${patient.name}`,
                  });
                }, 500);
              } else {
                console.error("Pasien tidak ditemukan di API");
                toast({
                  title: "Pasien tidak ditemukan",
                  description: "Tidak dapat menemukan data pasien yang tersimpan",
                  variant: "destructive"
                });
                
                // Hapus data yang tidak valid dari localStorage
                localStorage.removeItem('pendingTransactionPatientId');
                localStorage.removeItem('pendingTransactionPatientName');
              }
            })
            .catch(err => {
              console.error("Error fetching patient from API:", err);
              toast({
                title: "Terjadi kesalahan",
                description: "Gagal memuat data pasien dari server",
                variant: "destructive"
              });
              
              // Hapus data dari localStorage
              localStorage.removeItem('pendingTransactionPatientId');
              localStorage.removeItem('pendingTransactionPatientName');
            });
        }
      }
    }
  }, [patients, toast, apiRequest]);
  
  useEffect(() => {
    if (patientIdFromUrl) {
      const patientIdNumber = parseInt(patientIdFromUrl);
      // Ditemukan patientId di URL
      
      // Jangan lakukan apa-apa sampai patients sudah terload
      if (!patients || patients.length === 0) {
        // Menunggu data pasien tersedia
        // Kirim toast untuk memberitahu pengguna
        toast({
          title: "Membuat transaksi baru",
          description: `Form transaksi untuk ${patientIdFromUrl ? "pasien ini" : ""} akan segera dibuka`
        });
        return;
      }
      
      // Jika form sudah pernah dibuka untuk patientId ini, jangan buka lagi
      if (hasOpenedFormRef.current) {
        // Form sudah pernah dibuka untuk patientId ini
        return;
      }
      
      // Verifikasi pasien ada dalam data
      const patientExists = patients.some((p: any) => p.id === patientIdNumber);
      
      if (patientExists) {
        // Set flag bahwa form sudah pernah dibuka
        hasOpenedFormRef.current = true;
        
        // Set selected patient ID
        setSelectedPatientId(patientIdNumber);
        
        // Buka form transaksi dengan delay yang didapat dari URL atau default 500ms
        const delayTime = delayParamFromUrl ? parseInt(delayParamFromUrl) : 500;
        console.log(`Membuka form transaksi dalam ${delayTime}ms...`);
        
        // Tampilkan toast untuk memberitahu pengguna
        toast({
          title: "Menyiapkan transaksi",
          description: `Form transaksi akan dibuka dalam ${delayTime}ms`,
        });
        
        // Buka form transaksi dengan delay untuk memastikan komponen sudah siap
        setTimeout(() => {
          setIsTransactionFormOpen(true);
          console.log("Form transaksi dibuka untuk pasien ID:", patientIdNumber);
          
          // Tampilkan toast notifikasi untuk membantu pengguna
          toast({
            title: "Form transaksi dibuka",
            description: `Silahkan lengkapi data transaksi untuk pasien ini`,
          });
        }, delayTime);
      } else {
        toast({
          title: "Pasien tidak ditemukan",
          description: `Tidak dapat menemukan pasien dengan ID ${patientIdNumber}`,
          variant: "destructive"
        });
      }
    }
  }, [patientIdFromUrl, patients, toast, delayParamFromUrl]);
  
  // Custom Event Listener untuk menerima notifikasi dari sidebar atau komponen lain
  useEffect(() => {
    const handleOpenTransactionForm = (event: CustomEvent) => {
      const patientId = event.detail?.patientId;
      const patientName = event.detail?.patientName;
      const eventTimestamp = event.detail?.timestamp || Date.now();
      
      console.log("Event openTransactionForm diterima:", {
        rawPatientId: patientId,
        patientIdType: typeof patientId,
        patientName,
        timestamp: eventTimestamp
      });
      
      // Periksa timestamp terakhir untuk mencegah event duplikat atau basi diterima
      const lastEventTimestamp = localStorage.getItem('lastProcessedTransactionPageEvent');
      if (lastEventTimestamp && parseInt(lastEventTimestamp) >= eventTimestamp) {
        console.log("Mengabaikan event duplikat atau basi:", {
          lastProcessed: lastEventTimestamp,
          currentEvent: eventTimestamp
        });
        return; // Event lebih lama atau sama, abaikan
      }
      
      // Update timestamp terakhir
      localStorage.setItem('lastProcessedTransactionPageEvent', String(eventTimestamp));
      
      if (patientId) {
        // Parse patientId ke number untuk memastikan tipe data
        const patientIdNumber = typeof patientId === 'string' ? parseInt(patientId) : patientId;
        
        console.log("Event openTransactionForm diterima dengan patientId:", patientIdNumber, "type:", typeof patientIdNumber);
        
        // Bersihkan localStorage karena event sudah diterima dengan baik
        if (localStorage.getItem('pendingTransactionPatientId')) {
          console.log("Menghapus data pendingTransactionPatientId dari localStorage");
          localStorage.removeItem('pendingTransactionPatientId');
          localStorage.removeItem('pendingTransactionPatientName');
        }
        
        // Verifikasi pasien ada dalam data
        // Memeriksa ketersediaan data pasien
        if (patients && patients.length > 0) {
          // Pasien tersedia dalam sistem
        }
        
        // Gunakan pendekatan yang lebih fleksibel untuk menemukan pasien
        const patient = patients.find((p: any) => {
          // Konversi ID untuk perbandingan string-to-string
          const pIdStr = p.id.toString();
          const searchIdStr = patientIdNumber.toString();
          return p.id === patientIdNumber || pIdStr === searchIdStr;
        });
        
        if (patient) {
          console.log("Pasien ditemukan:", patient.name, "dengan ID:", patient.id);
          
          // Set selected patient ID hanya jika belum diset atau berbeda
          if (!selectedPatientId || selectedPatientId !== patientIdNumber) {
            setSelectedPatientId(patientIdNumber);
            
            // Segera buka form transaksi
            console.log("Segera membuka form transaksi untuk pasien ID:", patientIdNumber);
            
            // Gunakan setTimeout untuk memastikan bahwa state selectedPatientId sudah terupdate
            setTimeout(() => {
              setIsTransactionFormOpen(true);
              
              // Log debugging
              console.log("Form transaksi seharusnya sudah terbuka sekarang");
              
              // Tampilkan toast untuk konfirmasi hanya sekali
              toast({
                title: "Form transaksi dibuka",
                description: `Silahkan lengkapi data transaksi untuk ${patient.name}`,
              });
            }, 300);
          } else {
            console.log("Patient ID sudah diset, tidak perlu update ulang:", patientIdNumber);
          }
        } else {
          console.error("Pasien dengan ID", patientIdNumber, "tidak ditemukan dalam data");
          console.log("Mencoba memuat data pasien secara langsung...");
          
          // Coba ambil data pasien secara langsung dari server
          apiRequest<any>(`/api/patients/${patientIdNumber}`)
            .then(directPatient => {
              if (directPatient && directPatient.id) {
                console.log("Pasien berhasil dimuat langsung dari API:", directPatient.name);
                setSelectedPatientId(directPatient.id);
                
                setTimeout(() => {
                  setIsTransactionFormOpen(true);
                  toast({
                    title: "Form transaksi dibuka",
                    description: `Silahkan lengkapi data transaksi untuk ${directPatient.name}`,
                  });
                }, 300);
              } else {
                throw new Error("Pasien tidak ditemukan di API");
              }
            })
            .catch(err => {
              console.error("Gagal mendapatkan data pasien langsung:", err);
              toast({
                title: "Pasien tidak ditemukan",
                description: `Tidak dapat menemukan pasien dengan ID ${patientIdNumber}`,
                variant: "destructive"
              });
            });
        }
      } else {
        // Jika tidak ada patientId, buka form kosong
        setSelectedPatientId(null);
        setIsTransactionFormOpen(true);
      }
    };
    
    // Pasang event listener untuk menangkap event openTransactionForm
    window.addEventListener('openTransactionForm' as any, (event: Event) => {
      handleOpenTransactionForm(event as unknown as CustomEvent);
    });
    
    return () => {
      // Cabut event listener saat komponen unmount
      window.removeEventListener('openTransactionForm' as any, handleOpenTransactionForm);
    };
  }, [patients, toast, apiRequest]); // Tambahkan dependensi yang diperlukan
  
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
      try {
        const data = await apiRequest<Transaction[]>("/api/transactions");
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
  
  const setTransactionToBeDeleted = (id: number | null) => {
    setTransactionToDelete(id);
  };
  
  const getPatientName = (patientId: number, transaction?: Transaction) => {
    const patient = patients?.find((p: any) => p.id === patientId);
    if (!patient) return "-";
    
    // Perbaikan: Gunakan pendekatan string comparison untuk semua kemungkinan nilai displayName alternatif
    const displayName = transaction?.metadata?.displayName;
    if (displayName && 
        ['alternative', 'alias', 'Syafliana', 'syafliana'].includes(String(displayName))) {
      // Kita mencoba mencari data pasien alternatif (dengan nomor telepon yang sama)
      try {
        // Cari pasien terkait dengan nama berbeda (alternatif)
        const relatedPatients = patients.filter((p: any) => 
          p.id !== patientId && p.phoneNumber === patient.phoneNumber
        );
        
        if (relatedPatients.length > 0) {
          // Gunakan nama dari pasien alternatif pertama yang ditemukan
          return relatedPatients[0].name;
        }
      } catch (err) {
        // Error silenced
      }
    }
    
    // Jika tidak ada pengaturan khusus atau tidak menemukan nama alternatif, gunakan nama asli
    return patient.name;
  };
  
  const formatDate = (dateString: string) => {
    try {
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
      
      // Format dengan locale Indonesia
      return format(date, "dd/MM/yyyy HH:mm", { locale: id });
    } catch (error) {
      // Jika terjadi error, kembalikan string asli
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
  // Pemeriksaan data dilakukan tanpa logging untuk performa yang lebih baik
  
  const filteredTransactions = transactions 
    ? transactions
        .filter((transaction: Transaction) => {
          // Filter by search term
          if (searchTerm) {
            const patientName = getPatientName(transaction.patientId, transaction).toLowerCase();
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
              return direction * getPatientName(a.patientId, a).localeCompare(getPatientName(b.patientId, b));
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
  // Fungsi untuk menangani pembayaran hutang
  const handlePayDebt = async (transaction: Transaction) => {
    try {
      console.log(`Persiapan pembayaran hutang untuk transaksi ID ${transaction.id}`);
      let updatedTransaction = {...transaction};
      
      // Ambil detail transaksi terbaru dari API
      const detailTransaction = await apiRequest<any>(`/api/transactions/${transaction.id}`);
      if (detailTransaction) {
        updatedTransaction = detailTransaction;
      }
      
      // Set transaction data dan buka form pembayaran
      setSelectedTransaction(updatedTransaction);
      setIsCreditPaymentOpen(true);
    } catch (error) {
      console.error(`Error fetching transaction details for debt payment ID ${transaction.id}:`, error);
      toast({
        title: "Gagal mengambil data transaksi",
        description: "Terjadi kesalahan saat mempersiapkan pembayaran hutang",
        variant: "destructive"
      });
    }
  };
  
  const handleViewTransaction = async (transaction: any) => {
    try {
      console.log("Detail transaksi yang dibuka:", transaction);
      
      // Selalu coba ambil detail transaksi segar dari API untuk memastikan data lengkap
      console.log(`Mengambil detail terbaru untuk transaksi ID ${transaction.id}`);
      let updatedTransaction = {...transaction};
      
      try {
        // Ambil detail transaksi lengkap dari API
        const detailTransaction = await apiRequest<any>(`/api/transactions/${transaction.id}`);
        if (detailTransaction) {
          console.log("Detail transaksi dari API:", detailTransaction);
          updatedTransaction = detailTransaction;
        }
      } catch (fetchError) {
        console.error("Gagal mengambil detail transaksi dari API:", fetchError);
        // Lanjutkan dengan data yang sudah ada
      }
      
      // Proses items untuk memastikan format yang benar
      let processedItems = [];
      
      // Cek apakah items sudah dalam bentuk array yang valid
      if (updatedTransaction.items && Array.isArray(updatedTransaction.items)) {
        console.log("Items sudah dalam bentuk array:", updatedTransaction.items);
        processedItems = updatedTransaction.items;
      } 
      // Jika items adalah string, coba parse sebagai JSON
      else if (updatedTransaction.items && typeof updatedTransaction.items === 'string') {
        try {
          console.log("Items dalam bentuk string, mencoba parse:", updatedTransaction.items);
          processedItems = JSON.parse(updatedTransaction.items);
          console.log("Hasil parsing items:", processedItems);
          
          // Pastikan hasil parsing adalah array
          if (!Array.isArray(processedItems)) {
            console.warn("Hasil parsing bukan array, konversi ke array jika mungkin");
            if (typeof processedItems === 'object') {
              processedItems = Object.values(processedItems);
            } else {
              processedItems = [];
            }
          }
        } catch (parseError) {
          console.error("Gagal mem-parsing items:", parseError);
          processedItems = [];
        }
      }
      
      // Pastikan kembali bahwa items adalah array
      if (!Array.isArray(processedItems)) {
        console.warn("Items masih bukan array setelah pemrosesan, set ke array kosong");
        processedItems = [];
      }
      
      console.log("Items final yang akan ditampilkan:", processedItems);
      
      // Cari data pasien untuk transaksi ini
      const patient = patients?.find((p: any) => p.id === updatedTransaction.patientId);
      
      // Pastikan struktur data sesuai dengan yang diharapkan di komponen Invoice
      // Membuat objek dengan properti yang tepat sesuai InvoiceProps
      const invoiceData = {
        transaction: updatedTransaction, // Gunakan transaksi yang sudah diupdate
        patient: patient || { name: "Pasien tidak ditemukan", patientId: "-" },
        items: processedItems, // Gunakan items yang sudah diproses
        paymentMethod: updatedTransaction.paymentMethod || 'cash',
        discount: updatedTransaction.discount || 0,
        subtotal: updatedTransaction.subtotal || 0,
        isPaid: updatedTransaction.isPaid,
        creditAmount: updatedTransaction.creditAmount || 0,
        paidAmount: updatedTransaction.paidAmount || 0
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
    setTransactionToBeDeleted(transaction.id);
    setIsDeleteDialogOpen(true);
  };
  
  // Fungsi untuk membagikan transaksi melalui WhatsApp
  const handleShareWhatsApp = async (transaction: Transaction) => {
    try {
      console.log("Memulai pengiriman WhatsApp untuk transaksi:", transaction.transactionId);
      
      // Selalu ambil data transaksi terbaru dari API untuk memastikan data lengkap
      let updatedTransaction = {...transaction};
      try {
        console.log(`Mengambil detail transaksi ID ${transaction.id} dari API`);
        const detailTransaction = await apiRequest<any>(`/api/transactions/${transaction.id}`);
        if (detailTransaction) {
          console.log("Detail transaksi dari API:", detailTransaction);
          updatedTransaction = detailTransaction;
        }
      } catch (fetchError) {
        console.error("Gagal mengambil detail transaksi dari API:", fetchError);
        // Lanjutkan dengan data yang sudah ada
      }
      
      // Cari data pasien untuk transaksi ini
      const patient = patients?.find((p: any) => p.id === updatedTransaction.patientId);
      
      if (!patient) {
        toast({
          title: "Gagal membagikan invoice",
          description: "Data pasien tidak ditemukan",
          variant: "destructive"
        });
        return;
      }
      
      // Ambil setting invoice dari localStorage
      let settings: any = {};
      try {
        const settingsString = localStorage.getItem("invoice_settings");
        if (settingsString) {
          settings = JSON.parse(settingsString);
          console.log("Loaded invoice settings:", settings);
        }
      } catch (err) {
        console.error("Error loading invoice settings:", err);
      }
      
      // Cari paket aktif untuk pasien
      let activeSessions: any[] = [];
      try {
        // Fetch active sessions for this patient
        const response = await fetch(`/api/sessions?patientId=${patient.id}&active=true&includeRelated=true`);
        if (response.ok) {
          activeSessions = await response.json();
          console.log("Active sessions for WhatsApp message:", activeSessions);
        } else {
          console.error("Failed to fetch active sessions");
        }
      } catch (err) {
        console.error("Error fetching active sessions:", err);
      }
      
      // Parse items dari transaksi yang sudah diupdate
      let items: any[] = [];
      if (updatedTransaction.items) {
        try {
          if (typeof updatedTransaction.items === 'string') {
            items = JSON.parse(updatedTransaction.items);
          } else if (Array.isArray(updatedTransaction.items)) {
            items = updatedTransaction.items;
          }
        } catch (e) {
          console.error("Error parsing items:", e);
        }
      }
      
      // Menyiapkan items untuk pesan WhatsApp
      
      // Format pesan WhatsApp sesuai template yang diminta
      let message = `Yth. ${patient.name},\n\n`;
      message += `Terima kasih telah mengunjungi Klinik Terapi Titik Sumber.\n\n`;
      message += `Berikut adalah detail invoice Anda:\n`;
      message += `No. Invoice: ${updatedTransaction.transactionId}\n`;
      
      // Cek apakah transaksi ini adalah pembayaran utang dari metadata
      const isDebtPayment = updatedTransaction?.metadata && (
        (typeof updatedTransaction.metadata === 'object' && updatedTransaction.metadata?.isDebtPayment) || 
        (typeof updatedTransaction.metadata === 'string' && updatedTransaction.metadata.includes('isDebtPayment'))
      );

      let debtTransactionId = '';
      let debtAmount = 0;
      
      // Jika transaksi pembayaran utang, tampilkan informasi pembayaran hutang
      if (isDebtPayment) {
        const meta = updatedTransaction.metadata;
        try {
          let metaObj = typeof meta === 'string' ? JSON.parse(meta) : meta;
          debtTransactionId = metaObj.originalTransactionId || metaObj.debtTransactionId || '';
          debtAmount = parseFloat(metaObj.debtAmount || '0');
            
          message += `Pembayaran Hutang: ${formatPrice(debtAmount.toString())}\n`;
          if (debtTransactionId) {
            message += `Untuk Invoice: #${debtTransactionId}\n`;
          }
        } catch (e) {
          console.error("Error parsing metadata:", e);
        }
      }
      
      message += `Total: ${formatPrice(updatedTransaction.totalAmount)}\n\n`;
      
      // Tambahkan informasi pembayaran
      message += `Informasi Pembayaran:\n\n`;
      message += `Bank: ${settings.bankName || 'BCA'}\n`;
      message += `No. Rekening: ${settings.bankAccountNumber || '1234567890'}\n`;
      message += `Atas Nama: ${settings.bankAccountName || 'Klinik TTS'}\n\n`;
      
      // Tambahkan detail item
      message += `Detail Item:\n\n`;
      if (items && items.length > 0) {
        // Jika ada pembayaran hutang, tambahkan sebagai item pertama
        if (isDebtPayment && debtAmount > 0) {
          message += `1 x Pembayaran Hutang ${debtTransactionId ? `(Invoice #${debtTransactionId})` : ''} - ${formatPrice(debtAmount.toString())}\n`;
        }
        
        items.forEach((item: any) => {
          const qty = item.quantity || 1;
          const itemName = item.name || "Item"; // Gunakan nilai default jika name tidak ada
          console.log("Item transaksi untuk WhatsApp:", item); // Debug log
          message += `${qty} x ${itemName} - ${formatPrice(item.price)}\n`;
        });
      }
      
      // Tambahkan informasi paket aktif jika ada
      if (activeSessions && activeSessions.length > 0) {
        // Filter hanya paket multi-sesi (lebih dari 1 sesi)
        const multiSessionsOnly = activeSessions.filter((session: any) => {
          const totalSessions = session.totalSessions || 0;
          return totalSessions > 1; // Hanya tampilkan paket dengan lebih dari 1 sesi
        });
        
        if (multiSessionsOnly.length > 0) {
          message += `\nInformasi Paket Aktif:\n\n`;
          
          multiSessionsOnly.forEach((session: any) => {
            const packageName = session.package?.name || "Paket";
            const used = session.sessionsUsed || 0;
            const total = session.totalSessions || 0;
            const remaining = total - used;
            const percentUsed = Math.round((used / total) * 100);
            
            message += `• ${packageName}\n`;
            message += `${used}/${total} Sesi (${percentUsed}%)\n`;
            message += `${remaining} sesi tersisa\n\n`;
          });
        }
      }
      
      message += `Semoga sehat selalu!\n\n`;
      message += `Salam,\nTim Klinik Terapi Titik Sumber`;
      
      // Encode pesan untuk URL WhatsApp
      const encodedMessage = encodeURIComponent(message);
      
      // Buka WhatsApp dengan pesan yang sudah disiapkan
      // Jika nomor pasien tersedia, gunakan nomor tersebut dan format dengan benar
      let phoneNumber = '';
      if (patient.phoneNumber) {
        // Hapus semua karakter non-digit
        phoneNumber = patient.phoneNumber.replace(/\D/g, '');
        
        // Pastikan format nomor dimulai dengan kode negara Indonesia (62)
        if (phoneNumber.startsWith('0')) {
          // Ganti 0 di awal dengan 62 (kode negara Indonesia)
          phoneNumber = '62' + phoneNumber.substring(1);
        } else if (!phoneNumber.startsWith('62')) {
          // Jika tidak dimulai dengan 0 atau 62, tambahkan 62 di depan
          phoneNumber = '62' + phoneNumber;
        }
      }
      
      const whatsappUrl = phoneNumber 
        ? `https://wa.me/${phoneNumber}?text=${encodedMessage}`
        : `https://wa.me/?text=${encodedMessage}`;
      
      window.open(whatsappUrl, '_blank');
      
      toast({
        title: "WhatsApp terbuka",
        description: "Invoice telah disiapkan untuk dikirim melalui WhatsApp",
      });
    } catch (error) {
      console.error("Error sending WhatsApp message:", error);
      toast({
        title: "Gagal mengirim ke WhatsApp",
        description: "Terjadi kesalahan saat mengirim pesan WhatsApp",
        variant: "destructive",
      });
    }
  };
  

  
  // Fungsi untuk mencetak invoice
  const handlePrintTransaction = async (transaction: Transaction) => {
    try {
      console.log("Transaksi yang akan dicetak:", transaction);
      
      // Selalu coba ambil detail transaksi segar dari API untuk memastikan data lengkap
      console.log(`Mengambil detail terbaru untuk transaksi ID ${transaction.id} untuk cetak`);
      let updatedTransaction = {...transaction};
      
      try {
        // Ambil detail transaksi lengkap dari API
        const detailTransaction = await apiRequest<any>(`/api/transactions/${transaction.id}`);
        if (detailTransaction) {
          console.log("Detail transaksi dari API untuk print:", detailTransaction);
          updatedTransaction = detailTransaction;
        }
      } catch (fetchError) {
        console.error("Gagal mengambil detail transaksi dari API untuk print:", fetchError);
        // Lanjutkan dengan data yang sudah ada
      }
      
      // Proses items untuk memastikan format yang benar
      let processedItems = [];
      
      // Cek apakah items sudah dalam bentuk array yang valid
      if (updatedTransaction.items && Array.isArray(updatedTransaction.items)) {
        console.log("Items untuk print sudah dalam bentuk array:", updatedTransaction.items);
        processedItems = updatedTransaction.items;
      } 
      // Jika items adalah string, coba parse sebagai JSON
      else if (updatedTransaction.items && typeof updatedTransaction.items === 'string') {
        try {
          console.log("Items dalam bentuk string, mencoba parse untuk print:", updatedTransaction.items);
          processedItems = JSON.parse(updatedTransaction.items);
          console.log("Hasil parsing items untuk print:", processedItems);
          
          // Pastikan hasil parsing adalah array
          if (!Array.isArray(processedItems)) {
            console.warn("Hasil parsing bukan array, konversi ke array jika mungkin");
            if (typeof processedItems === 'object') {
              processedItems = Object.values(processedItems);
            } else {
              processedItems = [];
            }
          }
        } catch (parseError) {
          console.error("Gagal mem-parsing items untuk print:", parseError);
          processedItems = [];
        }
      }
      
      // Pastikan kembali bahwa items adalah array
      if (!Array.isArray(processedItems)) {
        console.warn("Items masih bukan array setelah pemrosesan untuk print, set ke array kosong");
        processedItems = [];
      }
      
      console.log("Items final yang akan dicetak:", processedItems);
      
      // Cari data pasien untuk transaksi ini
      const patient = patients?.find((p: any) => p.id === updatedTransaction.patientId);
      
      // Pastikan struktur data sesuai dengan yang diharapkan di komponen Invoice
      const invoiceData = {
        transaction: updatedTransaction, // Gunakan transaksi yang sudah diupdate
        patient: patient || { name: "Pasien tidak ditemukan", patientId: "-" },
        items: processedItems, // Gunakan items yang sudah diproses
        paymentMethod: updatedTransaction.paymentMethod || 'cash',
        discount: updatedTransaction.discount || 0,
        subtotal: updatedTransaction.subtotal || 0,
        isPaid: updatedTransaction.isPaid,
        creditAmount: updatedTransaction.creditAmount || 0,
        paidAmount: updatedTransaction.paidAmount || 0
      };
      
      setInvoiceData(invoiceData);
      setIsInvoiceOpen(true);
      
      // Print setelah invoice terbuka dengan delay lebih lama untuk memastikan render selesai
      setTimeout(() => {
        window.print();
      }, 800);
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
            // Reset selectedPatientId dan buka form
            setSelectedPatientId(null);
            // Hapus flag hidePatientDropdown dari localStorage jika ada
            localStorage.removeItem('hidePatientDropdown');
            // Buka form transaksi - tanpa mengirim prop hidePatientSearch
            setIsTransactionFormOpen(true);
            
            // Log untuk debugging
            console.log("Membuka form transaksi dari tombol Transaksi Baru - selectedPatientId:", null);
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
                      <TableCell>{getPatientName(transaction.patientId, transaction)}</TableCell>
                      <TableCell>{formatDate(transaction.createdAt)}</TableCell>
                      <TableCell>{formatPaymentMethod(transaction.paymentMethod)}</TableCell>
                      <TableCell className="text-right">
                        {transaction.metadata?.isDebtPayment 
                          ? formatPrice(transaction.metadata.paymentAmount || transaction.totalAmount) 
                          : formatPrice(transaction.totalAmount)
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        {transaction.creditAmount ? formatPrice(transaction.creditAmount.toString()) : "-"}
                      </TableCell>
                      <TableCell>
                        {transaction.metadata?.isDebtPayment ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Pembayaran Utang
                          </span>
                        ) : transaction.isPaid ? (
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
                        
                        {transaction.creditAmount && parseFloat(transaction.creditAmount.toString()) > 0 && !transaction.isPaid && (
                          <Button
                            size="sm"
                            className="bg-orange-600 hover:bg-orange-700 text-white"
                            onClick={() => handlePayDebt(transaction)}
                          >
                            Bayar Hutang
                          </Button>
                        )}
                        
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleShareWhatsApp(transaction)}
                        >
                          <span className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            WhatsApp
                          </span>
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
                      {transaction.metadata?.isDebtPayment ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Pembayaran Utang
                        </span>
                      ) : transaction.isPaid ? (
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
                      <div className="text-sm">{getPatientName(transaction.patientId, transaction)}</div>
                      
                      <div className="text-sm font-medium">Metode</div>
                      <div className="text-sm">{formatPaymentMethod(transaction.paymentMethod)}</div>
                      
                      <div className="text-sm font-medium">Total</div>
                      <div className="text-sm font-semibold">
                        {transaction.metadata?.isDebtPayment 
                          ? formatPrice(transaction.metadata.paymentAmount || transaction.totalAmount) 
                          : formatPrice(transaction.totalAmount)
                        }
                      </div>
                      
                      {transaction.creditAmount && parseFloat(transaction.creditAmount.toString()) > 0 && (
                        <>
                          <div className="text-sm font-medium">Kredit</div>
                          <div className="text-sm">{formatPrice(transaction.creditAmount.toString())}</div>
                        </>
                      )}
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewTransaction(transaction)}
                      >
                        Detail
                      </Button>
                      
                      {transaction.creditAmount && parseFloat(transaction.creditAmount.toString()) > 0 && !transaction.isPaid && (
                        <Button
                          size="sm"
                          className="bg-orange-600 hover:bg-orange-700 text-white"
                          onClick={() => handlePayDebt(transaction)}
                        >
                          Bayar
                        </Button>
                      )}
                      
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => handleShareWhatsApp(transaction)}
                      >
                        <span className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          WA
                        </span>
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
      {isTransactionFormOpen && (
        <TransactionForm 
          isOpen={true} 
          onClose={() => {
            setIsTransactionFormOpen(false);
            console.log("Form transaksi ditutup");
            // Reset form setelah ditutup
            if (patientIdFromUrl) {
              // Jika ada patientId di URL, reset flag agar bisa dibuka lagi
              hasOpenedFormRef.current = false;
            }
          }} 
          selectedPatientId={selectedPatientId}
          // Periksa parameter hideDropdown dari URL
          hidePatientSearch={
            (selectedPatientId !== null && selectedPatientId !== undefined) || 
            urlParams.get("hideDropdown") === "true"
          }
          // Tambahkan properti useFixedEndpoints
          useFixedEndpoints={useFixedEndpoints}
        />
      )}
      
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
      
      {/* Dialog pembayaran hutang/kredit */}
      <CreditPaymentForm 
        isOpen={isCreditPaymentOpen}
        onClose={() => setIsCreditPaymentOpen(false)}
        transaction={selectedTransaction}
        onSuccess={() => {
          toast({
            title: "Pembayaran Hutang Berhasil",
            description: "Pembayaran hutang telah berhasil diproses",
          });
          // Refresh data transaksi
          refetchTransactions();
          // Tutup dialog
          setIsCreditPaymentOpen(false);
        }}
      />
    </div>
  );
}