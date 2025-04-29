import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { id } from "date-fns/locale";


import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Search, Info, AlertCircle, Package, CreditCard, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";

import PaymentMethods from "./payment-methods";
import Invoice from "./invoice";

// Utilitas untuk format harga
const formatPrice = (price: string) => {
  const numericPrice = parseFloat(price);
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(numericPrice);
};

type TransactionFormProps = {
  isOpen: boolean;
  onClose: () => void;
  selectedPatientId?: number | null;
};

type Patient = {
  id: number;
  patientId: string;
  name: string;
  phoneNumber: string;
  email: string | null;
  birthDate?: string;
  gender?: string;
  address?: string;
  complaints?: string;
  therapySlotId?: number | null;
  relatedPatients?: number[]; // ID pasien terkait untuk nomor telepon yang sama
};

type Package = {
  id: number;
  name: string;
  sessions: number;
  price: string;
};

type Product = {
  id: number;
  name: string;
  price: string;
  stock: number;
};

// Tipe data untuk paket terapi aktif pasien
type ActiveSession = {
  id: number;
  patientId: number;
  packageId: number;
  status: string;
  totalSessions: number;
  sessionsUsed: number;
  startDate: Date;
  lastSessionDate: Date | null;
  package?: {
    id: number;
    name: string;
    sessions: number;
    price: string;
  };
  remainingSessions: number;
  // Properti tambahan untuk sesi yang dibagikan dari pasien lain
  isDirectOwner?: boolean;
  sharedFrom?: number | null;
  owner?: {
    id: number;
    name: string;
    patientId: string;
  } | null;
};

type CartItem = {
  id: number;
  type: "package" | "product";
  name: string;
  price: string;
  quantity: number;
};

const transactionFormSchema = z.object({
  patientId: z.string().min(1, "Pilih pasien terlebih dahulu"),
  paymentMethod: z.enum(["bank_transfer", "qris", "cash"], {
    required_error: "Pilih metode pembayaran",
  }),
  discount: z.string().optional().transform(val => val === '' ? '0' : val),
  subtotal: z.string().optional(),
  totalAmount: z.string().optional(),
  items: z.array(
    z.object({
      id: z.number(),
      type: z.enum(["package", "product"]),
      quantity: z.number().min(1),
      price: z.string().optional(),
    })
  ).min(1, "Pilih minimal satu paket atau produk"),
  isPaid: z.boolean().default(true),
  creditAmount: z.string().optional().default("0"),
  paidAmount: z.string().optional().default("0"),
  // Tambahkan field untuk preferensi nama tampilan (khusus untuk Queenzky/Syafliana)
  displayName: z.enum(["original", "alternative"]).optional().default("original"),
});

type TransactionFormValues = z.infer<typeof transactionFormSchema>;

export default function TransactionForm({ isOpen, onClose, selectedPatientId }: TransactionFormProps) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string>("");
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [selectedSession, setSelectedSession] = useState<ActiveSession | null>(null);
  const [useExistingPackage, setUseExistingPackage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // State untuk mengontrol pemrosesan ganda
  const [formKey, setFormKey] = useState(Date.now()); // Kunci unik untuk me-reset form
  const [debtOnlyPayment, setDebtOnlyPayment] = useState(false); // State untuk mode bayar utang saja
  const [searchTerm, setSearchTerm] = useState(""); // State untuk pencarian pasien
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Siapkan default value untuk patientId berdasarkan prop selectedPatientId
  // Pastikan patientId selalu berupa string
  let initialPatientId = '';
  
  if (selectedPatientId !== null && selectedPatientId !== undefined) {
    initialPatientId = typeof selectedPatientId === 'number' 
      ? selectedPatientId.toString() 
      : String(selectedPatientId);
  }
  
  console.log("Setting up form with initialPatientId:", initialPatientId, "from selectedPatientId:", selectedPatientId);
  
  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      patientId: initialPatientId,
      paymentMethod: "cash",
      discount: "0",
      items: [],
      isPaid: true,
      creditAmount: "0",
      paidAmount: "0",
    },
  });
  
  // State untuk menangani kredit/utang
  const [useCredit, setUseCredit] = useState(false);
  // State untuk menangani pembayaran utang sekaligus transaksi baru
  const [payDebt, setPayDebt] = useState(false);
  const [selectedDebtTransaction, setSelectedDebtTransaction] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("0");
  
  // Effect untuk memantau perubahan pada useCredit
  useEffect(() => {
    if (useCredit) {
      // Jika credit diaktifkan, hitung default values
      const subtotal = cartItems.reduce(
        (sum, item) => sum + parseFloat(item.price) * item.quantity, 0
      );
      const discount = parseFloat(form.getValues().discount || "0");
      const totalAmount = Math.max(0, subtotal - discount);
      
      // Set default paidAmount ke 0 dan creditAmount ke totalAmount
      form.setValue("paidAmount", "0");
      form.setValue("creditAmount", totalAmount.toString());
    } else {
      // Jika credit dinonaktifkan, reset nilai
      form.setValue("paidAmount", "0");
      form.setValue("creditAmount", "0");
    }
  }, [useCredit, cartItems, form]);

  // Fetch all patients
  const { data: allPatients = [] } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
  });

  // Fetch packages
  const { data: packages = [] } = useQuery<Package[]>({
    queryKey: ["/api/packages"],
  });

  // Fetch products
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  // Fetch unpaid transactions (with debt) for the selected patient
  const { data: unpaidTransactions = [], refetch: refetchUnpaidTransactions } = useQuery({
    queryKey: ["/api/transactions/unpaid", form.watch("patientId")],
    queryFn: async () => {
      const patientId = form.watch("patientId");
      if (!patientId) return [];
      
      const response = await fetch(`/api/transactions/unpaid-by-patient/${patientId}`);
      if (!response.ok) throw new Error("Failed to fetch unpaid transactions");
      
      const data = await response.json();
      console.log("Unpaid transactions data:", data);
      return data;
    },
    enabled: !!form.watch("patientId"), // hanya jalankan jika patientId ada
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Fetch active sessions for a patient and related patients
  const { data: activeSessions = [], refetch: refetchActiveSessions } = useQuery<ActiveSession[]>({
    queryKey: ["/api/sessions", form.watch("patientId"), "active"],
    queryFn: async () => {
      const patientId = form.watch("patientId");
      if (!patientId) return [];
      
      // Gunakan parameter API baru, API sudah otomatis menampilkan sesi terkait dengan pasien yang memiliki nomor telepon sama
      // includeRelated=true (default) akan membuat API menampilkan sesi dari pasien dengan nomor telepon yang sama
      const response = await fetch(`/api/sessions?patientId=${patientId}&active=true&includeRelated=true`);
      if (!response.ok) throw new Error("Failed to fetch active sessions");
      
      const data = await response.json();
      console.log("Active sessions data (including related patients):", data);
      
      // Data sudah termasuk sesi dari pasien terkait, dan sudah ada informasi isDirectOwner, owner, dll
      return data;
    },
    enabled: !!form.watch("patientId"), // hanya jalankan jika patientId ada
  });

  // Kelompokkan pasien berdasarkan nomor telepon (setelah activeSessions tersedia)
  const patients = useMemo(() => {
    // Kelompokkan pasien berdasarkan nomor telepon
    const patientsGroupedByPhone: { [key: string]: Patient[] } = {};
    
    allPatients.forEach(patient => {
      if (!patient.phoneNumber) return; // Lewati pasien tanpa nomor telepon
      
      if (!patientsGroupedByPhone[patient.phoneNumber]) {
        patientsGroupedByPhone[patient.phoneNumber] = [];
      }
      
      patientsGroupedByPhone[patient.phoneNumber].push(patient);
    });
    
    // Hasil akhir: array dari pasien yang sudah dikelompokkan
    const result: Patient[] = [];
    
    Object.values(patientsGroupedByPhone).forEach(patientGroup => {
      // Jika hanya ada 1 pasien dengan nomor ini, tambahkan langsung
      if (patientGroup.length === 1) {
        result.push(patientGroup[0]);
        return;
      }
      
      // Dapatkan semua pasien dalam grup ini yang memiliki sesi aktif
      // Cek apakah ada session/paket terapi yang aktif untuk salah satu pasien dalam grup
      let patientWithActiveSession = patientGroup.find(patient => {
        // Cari di sessions untuk transaksi id ini
        return activeSessions.some(session => session.patientId === patient.id);
      });
      
      let sortedGroup = [...patientGroup];
      
      // Jika ada pasien dengan sesi aktif, gunakan ID tersebut sebagai prioritas
      // Jika tidak, gunakan pasien terbaru berdasarkan ID seperti biasa
      if (patientWithActiveSession) {
        // Urutan: pasien dengan sesi aktif dulu, sisanya berdasarkan ID terbaru
        sortedGroup = [
          patientWithActiveSession,
          ...patientGroup
            .filter(p => p.id !== patientWithActiveSession!.id)
            .sort((a, b) => b.id - a.id)
        ];
      } else {
        // Jika tidak ada yang punya sesi aktif, urutkan berdasarkan ID (terbaru dulu)
        sortedGroup = sortedGroup.sort((a, b) => b.id - a.id);
      }
      
      // Tambahkan pasien pertama ke hasil final dengan nama yang dimodifikasi
      const patientToShow = sortedGroup[0];
      result.push({
        ...patientToShow,
        name: `${patientToShow.name} (${sortedGroup.length} data)`,
        // Tambahkan properti untuk menyimpan ID pasien terkait
        relatedPatients: sortedGroup.slice(1).map(p => p.id)
      });
    });
    
    // Urutkan hasil akhir berdasarkan ID secara descending (terbaru di atas)
    return result.sort((a, b) => b.id - a.id);
  }, [allPatients, activeSessions]);

  // Reset cart when form is closed or opened
  useEffect(() => {
    if (!isOpen) {
      // Reset form when closed
      setCartItems([]);
      setSelectedPackage("");
      setSelectedSession(null);
      setUseExistingPackage(false);
      setPayDebt(false);
      setSelectedDebtTransaction(null);
      setPaymentAmount("0");
      setFormKey(Date.now()); // Force a complete re-render on close
      form.reset();
    } else if (isOpen && form.watch("patientId")) {
      // Refresh data when form is opened and patient is selected
      refetchActiveSessions();
      refetchUnpaidTransactions();
    }
  }, [isOpen, form, refetchActiveSessions, refetchUnpaidTransactions]);
  
  // Fetch patients di level lokal untuk memastikan data selalu tersedia
  const { 
    data: patientsLocal = [],
    isLoading: isLoadingPatients,
    isSuccess: isPatientsSuccess 
  } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
    staleTime: 5000, // Cached for 5 seconds
  });
  
  // Atur pasien otomatis jika selectedPatientId diberikan
  // Tambahkan log untuk debugging ketika component mount
  useEffect(() => {
    console.log("TransactionForm mounted - isOpen:", isOpen, "selectedPatientId:", selectedPatientId);
  }, []);

  // Gunakan useRef untuk melacak apakah pasien telah diset
  const patientSetRef = useRef(false);
  
  // Efek khusus untuk ketika form pertama kali dibuka dengan selectedPatientId
  useEffect(() => {
    if (isOpen && selectedPatientId && !patientSetRef.current) {
      console.log("Mengatur flag patientSetRef = true untuk mencegah reset berulang");
      patientSetRef.current = true;
    }
    
    if (!isOpen) {
      // Reset flag ketika form ditutup
      console.log("Form ditutup, reset flag patientSetRef = false");
      patientSetRef.current = false;
    }
  }, [isOpen, selectedPatientId]);

  // Effect utama untuk mengatur nilai pasien
  useEffect(() => {
    // Jika form ditutup, jangan lakukan apapun
    if (!isOpen) return;
    
    // Coba ambil data dari allPatients terlebih dahulu, jika tidak ada gunakan patientsLocal
    const allAvailablePatients = allPatients?.length > 0 ? allPatients : patientsLocal;
    
    // Log untuk debugging
    console.log("TransactionForm effect running - isOpen:", isOpen, "selectedPatientId:", selectedPatientId);
    
    // Jika tidak ada selectedPatientId, keluar dari effect
    if (!selectedPatientId) {
      console.log("Tidak ada selectedPatientId, keluar dari effect");
      return;
    }
    
    // Jika pasien sudah diset sebelumnya, jangan set ulang
    if (patientSetRef.current) {
      console.log("Patient sudah diset sebelumnya (patientSetRef=true), tidak melakukan apa-apa");
      return;
    }
    
    // Pastikan selectedPatientId adalah number
    let patientIdToSearch: number;
    if (typeof selectedPatientId === 'string') {
      patientIdToSearch = parseInt(selectedPatientId);
    } else {
      patientIdToSearch = selectedPatientId;
    }
    
    console.log("Mencari pasien dengan ID:", patientIdToSearch);
    
    // Periksa data pasien available
    if (!allAvailablePatients || allAvailablePatients.length === 0) {
      console.log("Data pasien belum tersedia, mencoba ambil dari API langsung");
      
      // Ambil data pasien langsung dari API
      apiRequest<Patient>(`/api/patients/${patientIdToSearch}`)
        .then(patient => {
          if (patient && patient.id) {
            console.log("Berhasil mendapatkan data pasien dari API:", patient.name);
            
            // Set nilai form
            form.setValue("patientId", patient.id.toString());
            
            // Refetch data terkait
            refetchActiveSessions();
            refetchUnpaidTransactions();
            
            // Set flag
            patientSetRef.current = true;
            
            // Feedback
            toast({
              title: "Data pasien dimuat",
              description: `Form transaksi siap untuk ${patient.name}`
            });
          }
        })
        .catch(err => {
          console.error("Gagal mengambil data pasien dari API:", err);
        });
      
      return;
    }
    
    // Cari pasien di data yang ada dengan pendekatan yang lebih komprehensif
    const patient = allAvailablePatients.find(p => {
      // Konversi ID pasien ke string untuk memastikan perbandingan string-to-string akurat
      const patientIdStr = p.id.toString();
      const searchIdStr = patientIdToSearch.toString();
      
      return p.id === patientIdToSearch || patientIdStr === searchIdStr;
    });
    
    if (patient) {
      console.log("Pasien ditemukan:", patient.name, "dengan ID:", patient.id);
      
      // Set nilai form
      form.setValue("patientId", patient.id.toString());
      
      // Reset fields terkait
      setCartItems([]);
      setSelectedPackage("");
      setSelectedSession(null);
      setUseExistingPackage(false);
      
      // Refresh data terkait
      refetchActiveSessions();
      refetchUnpaidTransactions();
      
      // Set flag
      patientSetRef.current = true;
      
      // Feedback
      toast({
        title: "Data pasien dimuat",
        description: `Form transaksi siap untuk ${patient.name}`
      });
    } else {
      // Fallback ke API
      console.log("Pasien tidak ditemukan di cache, mencoba dari API");
      
      apiRequest<Patient>(`/api/patients/${patientIdToSearch}`)
        .then(patient => {
          if (patient && patient.id) {
            console.log("Berhasil mendapatkan data pasien dari API:", patient.name);
            
            // Set nilai form
            form.setValue("patientId", patient.id.toString());
            
            // Reset fields terkait
            setCartItems([]);
            setSelectedPackage("");
            setSelectedSession(null);
            setUseExistingPackage(false);
            
            // Refresh data
            refetchActiveSessions();
            refetchUnpaidTransactions();
            
            // Set flag
            patientSetRef.current = true;
            
            // Feedback
            toast({
              title: "Data pasien dimuat",
              description: `Form transaksi siap untuk ${patient.name}`
            });
          } else {
            throw new Error("Patient not found");
          }
        })
        .catch(err => {
          console.error("Gagal mengambil data pasien dari API:", err);
          toast({
            title: "Error",
            description: "Pasien tidak ditemukan. Silakan pilih pasien manual.",
            variant: "destructive"
          });
        });
    }
  }, [isOpen, selectedPatientId, allPatients, patientsLocal, form, refetchActiveSessions, refetchUnpaidTransactions, toast, apiRequest]);

  // Function to calculate total amount (subtotal - discount)
  const calculateTotal = () => {
    // Calculate subtotal
    const subtotal = cartItems.reduce(
      (sum, item) => sum + parseFloat(item.price) * item.quantity,
      0
    );
    
    // Get discount amount from form - make sure it's non-null
    // Gunakan parseFloat dengan validasi lebih baik untuk mencegah masalah tipe data
    const discountVal = form.watch("discount");
    const discount = discountVal ? parseFloat(discountVal) : 0;
    
    // Return total amount (subtotal - discount)
    return Math.max(0, subtotal - discount);
  };
  
  // Fungsi untuk menangani pemilihan transaksi utang
  const handleDebtSelect = (transaction: any) => {
    setSelectedDebtTransaction(transaction);
    
    // Hitung sisa utang dengan benar (total amount - paid amount)
    const totalAmount = parseFloat(transaction.totalAmount);
    const paidAmount = parseFloat(transaction.paidAmount);
    const remainingDebt = totalAmount - paidAmount;
    
    console.log("Utang yang tersisa:", {
      totalAmount,
      paidAmount,
      remainingDebt
    });
    
    setPaymentAmount(remainingDebt.toString());
    
    toast({
      title: "Transaksi kredit dipilih",
      description: `Transaksi ${transaction.transactionId} dengan sisa utang ${formatPrice(remainingDebt.toString())}`,
    });
  };

  // Function to handle debt payment
  const handleDebtPayment = async () => {
    if (!selectedDebtTransaction || !paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast({
        title: "Error",
        description: "Pilih transaksi dan masukkan jumlah pembayaran",
        variant: "destructive",
      });
      return null;
    }

    try {
      const paymentData = {
        amount: paymentAmount,
        paymentMethod: form.getValues().paymentMethod,
        notes: debtOnlyPayment 
          ? "Pembayaran utang" 
          : "Pembayaran utang bersamaan dengan transaksi baru"
      };

      console.log("Sending debt payment data:", paymentData);

      // Gunakan endpoint yang benar untuk API debt payment
      const response = await apiRequest(`/api/transactions/${selectedDebtTransaction.id}/debt-payment`, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(paymentData)
      });

      console.log("Debt payment response:", response);
      
      // Refresh unpaid transactions data
      await queryClient.invalidateQueries({ queryKey: ["/api/transactions/unpaid"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      
      return response;
    } catch (error) {
      console.error("Error processing debt payment:", error);
      throw error;
    }
  };

  // Create transaction mutation
  const mutation = useMutation({
    mutationFn: async (values: TransactionFormValues) => {
      // Process debt payment first if enabled
      if (payDebt && selectedDebtTransaction) {
        try {
          const paymentResult = await handleDebtPayment();
          if (!paymentResult) return null; // Stop if debt payment failed
          
          toast({
            title: "Pembayaran utang berhasil",
            description: `Utang ${formatPrice(paymentAmount)} telah dibayarkan`,
          });
        } catch (error) {
          console.error("Error during debt payment:", error);
          toast({
            title: "Gagal membayar utang",
            description: error instanceof Error ? error.message : "Terjadi kesalahan saat membayar utang",
            variant: "destructive",
          });
          return null;
        }
      }
      
      // If this is a debt-only payment (no new items) and we've processed the debt payment successfully, return
      if (debtOnlyPayment || cartItems.length === 0) {
        return { message: "Pembayaran utang berhasil" };
      }
      
      // Continue with normal transaction processing
      // Calculate subtotal
      const subtotal = cartItems.reduce(
        (sum, item) => sum + parseFloat(item.price) * item.quantity,
        0
      );
      
      // Get discount amount - dengan validasi lebih baik
      const discountVal = values.discount;
      const discount = discountVal ? parseFloat(discountVal) : 0;
      
      // Calculate total amount (subtotal - discount)
      const totalAmount = Math.max(0, subtotal - discount);

      try {
        // Use the validated discount value from above
        const discountAmount = discount;
        
        // Siapkan kredit data jika menggunakan fitur kredit
        // Jika menggunakan fitur kredit, nilai isPaid = false
        // creditAmount adalah jumlah yang belum dibayar
        // paidAmount adalah jumlah yang sudah dibayar
        const isPaid = !useCredit;
        const creditAmount = useCredit ? values.creditAmount || "0" : "0";
        const paidAmount = useCredit ? values.paidAmount || "0" : totalAmount.toString();
        
        console.log("Mengirim request ke API dengan data:", {
          patientId: parseInt(values.patientId),
          totalAmount: totalAmount.toString(),
          paymentMethod: values.paymentMethod,
          discount: discountAmount.toString(),
          subtotal: subtotal.toString(),
          isPaid: isPaid,
          creditAmount: creditAmount,
          paidAmount: paidAmount,
          displayName: values.displayName || 'original', // Include displayName in API request
          items: cartItems.map(item => ({
            id: item.id,
            type: item.type,
            quantity: item.quantity,
            price: item.price
          }))
        });
        
        const response = await apiRequest("/api/transactions", {
          method: "POST",
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            patientId: parseInt(values.patientId),
            totalAmount: totalAmount.toString(),
            paymentMethod: values.paymentMethod,
            discount: discountAmount.toString(),
            subtotal: subtotal.toString(),
            isPaid: isPaid,
            creditAmount: creditAmount,
            paidAmount: paidAmount,
            displayName: values.displayName || 'original', // Include the displayName preference
            items: cartItems.map(item => ({
              id: item.id,
              type: item.type,
              quantity: item.quantity,
              price: item.price
            }))
          })
        });
        
        // apiRequest sudah meng-handle response JSON, jadi tidak perlu .json() lagi
        return response;
      } catch (error) {
        console.error("Error during transaction submission:", error);
        throw error;
      }
    },
    onSuccess: async (data) => {
      console.log("Transaction created successfully, response:", data);
      
      await queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/activities"] });

      // Prepare invoice data
      const patient = patients.find((p: Patient) => p.id === parseInt(form.getValues().patientId));
      const discountVal = form.getValues().discount;
      const discountAmount = discountVal ? parseFloat(discountVal) : 0;
      const subtotal = cartItems.reduce(
        (sum, item) => sum + parseFloat(item.price) * item.quantity,
        0
      );
      
      setInvoiceData({
        transaction: data,
        patient,
        items: cartItems,
        paymentMethod: form.getValues().paymentMethod,
        discount: discountAmount,
        subtotal: subtotal,
        displayName: form.getValues().displayName || 'original', // Pass the display name preference
      });
      
      setShowInvoice(true);
      
      toast({
        title: "Transaksi berhasil",
        description: "Transaksi telah disimpan dan invoice telah dibuat",
      });
    },
    onError: (error: any) => {
      console.error("Error in mutation:", error);
      toast({
        title: "Gagal membuat transaksi",
        description: error.message || "Terjadi kesalahan saat memproses transaksi",
        variant: "destructive",
      });
    }
  });

  // Fungsi untuk menggunakan sesi dari paket aktif
  const useSessionFromPackage = async (session: ActiveSession) => {
    try {
      // Jangan lakukan apa-apa jika sesi ini sudah terpilih sebelumnya
      if (selectedSession && selectedSession.id === session.id) {
        toast({
          title: "Sesi sudah dipilih",
          description: "Paket terapi ini sudah terpilih untuk digunakan",
        });
        return;
      }
      
      console.log("Memproses penggunaan sesi dari paket aktif:", session);
      
      if (session.remainingSessions <= 0) {
        toast({
          title: "Paket tidak memiliki sesi tersisa",
          description: `Paket ${session.package?.name} sudah digunakan semua sesinya`,
          variant: "destructive",
        });
        return;
      }
      
      // Set session as selected but don't use it immediately - wait for user confirmation
      setSelectedSession(session);
      toast({
        title: "Paket dipilih",
        description: "Klik tombol 'Proses Pembayaran' untuk mencatat penggunaan sesi",
      });
      return;
    } catch (error: any) {
      console.error("Error memilih sesi paket:", error);
      toast({
        title: "Gagal memilih sesi paket",
        description: error.message || "Terjadi kesalahan saat memilih sesi paket",
        variant: "destructive",
      });
    }
  };

  // Add package to cart
  const handlePackageSelect = (packageId: string) => {
    try {
      if (!packageId) return;

      // Validasi form: pastikan pasien sudah dipilih
      if (!form.getValues().patientId) {
        toast({
          title: "Pilih pasien terlebih dahulu",
          description: "Anda harus memilih pasien sebelum menambahkan paket terapi",
          variant: "destructive",
        });
        setSelectedPackage("");
        return;
      }

      // Log untuk debugging hanya dalam mode pengembangan
      if (process.env.NODE_ENV === 'development') {
        console.log("Package selected with ID:", packageId);
      }
      
      // Simpan nilai packageId yang dipilih
      setSelectedPackage(packageId);

      if (!packages || packages.length === 0) {
        toast({
          title: "Data paket tidak tersedia",
          description: "Daftar paket terapi tidak dapat dimuat",
          variant: "destructive",
        });
        return;
      }

      const pkg = packages.find((p: Package) => p.id === parseInt(packageId));
      if (!pkg) {
        toast({
          title: "Paket tidak ditemukan",
          description: "Paket yang dipilih tidak ditemukan. Silahkan pilih paket lain.",
          variant: "destructive",
        });
        return;
      }

      if (process.env.NODE_ENV === 'development') {
        console.log("Found package:", pkg);
      }

      // Check if package already in cart
      const existingPackageIndex = cartItems.findIndex(
        item => item.type === "package" && item.id === pkg.id
      );

      if (existingPackageIndex >= 0) {
        toast({
          title: "Paket sudah dipilih",
          description: "Paket terapi ini sudah ada dalam transaksi",
        });
        return;
      }

      // Cek apakah sudah ada paket lain di keranjang dan gunakan Dialog alih-alih confirm()
      const existingPackage = cartItems.find(item => item.type === "package");
      if (existingPackage) {
        // Hapus paket yang ada dan ganti dengan yang baru
        setCartItems(cartItems.filter(item => item.type !== "package"));
        
        toast({
          title: "Paket diganti",
          description: `Paket ${existingPackage.name} telah diganti dengan ${pkg.name}`,
        });
      }

      const newCartItem = {
        id: pkg.id,
        type: "package" as const,
        name: pkg.name,
        price: pkg.price,
        quantity: 1,
      };
      
      if (process.env.NODE_ENV === 'development') {
        console.log("Adding to cart:", newCartItem);
      }
      
      setCartItems([
        ...cartItems.filter(item => item.type !== "package"),
        newCartItem,
      ]);
      
      // Notifikasi berhasil ditambahkan
      if (!existingPackage) {
        toast({
          title: "Paket terapi ditambahkan",
          description: `${pkg.name} telah ditambahkan ke transaksi`,
        });
      }
    } catch (error) {
      console.error("Error selecting package:", error);
      toast({
        title: "Gagal memilih paket",
        description: "Terjadi kesalahan saat memilih paket terapi. Silahkan coba lagi.",
        variant: "destructive", 
      });
    }
  };

  // Add/remove product from cart
  const handleProductToggle = (product: Product, isChecked: boolean) => {
    try {
      if (isChecked) {
        // Validasi: pastikan pasien sudah dipilih
        if (!form.getValues().patientId) {
          toast({
            title: "Pilih pasien terlebih dahulu",
            description: "Anda harus memilih pasien sebelum menambahkan produk",
            variant: "destructive",
          });
          return;
        }
        
        // Validasi stok produk
        if (!product || product.stock <= 0) {
          toast({
            title: "Stok tidak tersedia",
            description: `Produk ${product?.name || 'yang dipilih'} sedang habis stok`,
            variant: "destructive",
          });
          return;
        }
        
        // Cek apakah produk sudah ada di keranjang
        const existingProductIndex = cartItems.findIndex(
          item => item.type === "product" && item.id === product.id
        );
        
        if (existingProductIndex >= 0) {
          // Produk sudah ada, tambah quantity
          const updatedCartItems = [...cartItems];
          updatedCartItems[existingProductIndex].quantity += 1;
          
          // Validasi: stok cukup untuk quantity yang diinginkan
          if (updatedCartItems[existingProductIndex].quantity > product.stock) {
            toast({
              title: "Stok tidak cukup",
              description: `Stok ${product.name} hanya tersisa ${product.stock}`,
              variant: "destructive",
            });
            return;
          }
          
          setCartItems(updatedCartItems);
          
          toast({
            title: "Jumlah produk ditambah",
            description: `${product.name} sekarang: ${updatedCartItems[existingProductIndex].quantity}`,
          });
        } else {
          // Tambah produk baru ke keranjang
          setCartItems([
            ...cartItems,
            {
              id: product.id,
              type: "product",
              name: product.name,
              price: product.price,
              quantity: 1,
            },
          ]);
          
          // Konfirmasi produk berhasil ditambahkan
          toast({
            title: "Produk ditambahkan",
            description: `${product.name} ditambahkan ke keranjang`,
          });
        }
      } else {
        // Hapus produk dari keranjang
        setCartItems(
          cartItems.filter(item => !(item.type === "product" && item.id === product.id))
        );
        
        toast({
          title: "Produk dihapus",
          description: `${product.name} dihapus dari keranjang`,
          variant: "default",
        });
      }
    } catch (error) {
      console.error("Error toggling product:", error);
      toast({
        title: "Gagal menambahkan produk",
        description: "Terjadi kesalahan saat menambahkan produk. Silahkan coba lagi.",
        variant: "destructive",
      });
    }
  };

  // Update product quantity with error handling
  const updateProductQuantity = (productId: number, newQuantity: number) => {
    try {
      if (newQuantity < 1) {
        // Instead of silently returning, give feedback
        toast({
          title: "Jumlah minimum 1",
          description: "Jumlah produk tidak boleh kurang dari 1",
          variant: "destructive",
        });
        return;
      }
      
      const product = products?.find((p: Product) => p.id === productId);
      if (!product) {
        toast({
          title: "Produk tidak ditemukan",
          description: "Produk yang dipilih tidak valid",
          variant: "destructive",
        });
        return;
      }
      
      if (newQuantity > product.stock) {
        toast({
          title: "Stok tidak cukup",
          description: `Stok ${product.name} hanya tersisa ${product.stock}`,
          variant: "destructive",
        });
        return;
      }

      // Get current quantity to show change message
      const currentItem = cartItems.find(
        item => item.type === "product" && item.id === productId
      );
      const currentQuantity = currentItem?.quantity || 0;
      
      // Update cart items with new quantity
      setCartItems(
        cartItems.map(item =>
          item.type === "product" && item.id === productId
            ? { ...item, quantity: newQuantity }
            : item
        )
      );
      
      // Show feedback on quantity change
      if (newQuantity > currentQuantity) {
        toast({
          title: "Jumlah ditambah",
          description: `${product.name}: ${currentQuantity} → ${newQuantity}`,
        });
      } else if (newQuantity < currentQuantity) {
        toast({
          title: "Jumlah dikurangi",
          description: `${product.name}: ${currentQuantity} → ${newQuantity}`,
        });
      }
    } catch (error) {
      console.error("Error updating product quantity:", error);
      toast({
        title: "Gagal mengubah jumlah",
        description: "Terjadi kesalahan saat mengubah jumlah produk",
        variant: "destructive",
      });
    }
  };



  // Format price
  const formatPrice = (price: string) => {
    return `Rp${parseFloat(price).toLocaleString('id-ID')}`;
  };
  
  // Handle session without package
  const handleNoPackageSession = async () => {
    // Validasi: Pastikan pasien sudah dipilih
    const patientId = form.getValues().patientId;
    if (!patientId) {
      toast({
        title: "Pilih pasien terlebih dahulu",
        description: "Anda harus memilih pasien sebelum melanjutkan",
        variant: "destructive",
      });
      return false;
    }
    
    // Konfirmasi dengan user
    if (!confirm("Catat kunjungan terapi tanpa paket untuk pasien ini?")) {
      return false;
    }
    
    try {
      // Cari data pasien untuk catatan
      const patient = patients.find((p: Patient) => p.id.toString() === patientId.toString());
      if (!patient) {
        throw new Error("Data pasien tidak ditemukan");
      }
      
      // Buat appointment langsung (tanpa paket)
      const today = new Date();
      const formattedDate = today.toISOString().split('T')[0];
      
      const appointmentResponse = await apiRequest("/api/appointments", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          patientId: parseInt(patientId),
          date: formattedDate,
          status: "Active", // Langsung aktif karena ini untuk kunjungan saat ini
          notes: `Terapi tanpa paket untuk ${patient.name} (${patient.patientId})`,
          timeSlot: new Date().toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})
        })
      });
      
      console.log("Appointment berhasil dibuat:", appointmentResponse);
      
      // Membuat catatan riwayat medis
      await apiRequest("/api/medical-histories", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          patientId: parseInt(patientId),
          complaint: "Sesi terapi tanpa paket",
          treatmentDate: formattedDate, // Gunakan string untuk tanggal
          notes: "Terapi individu tanpa paket"
        })
      });
      
      // Invalidate queries untuk refresh data
      await queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/dashboard/activities'] });
      
      // Tampilkan notifikasi sukses
      toast({
        title: "Sesi terapi dicatat",
        description: `Kunjungan terapi untuk ${patient.name} berhasil dicatat tanpa paket`,
      });
      
      return true;
    } catch (error: any) {
      console.error("Error mencatat sesi tanpa paket:", error);
      toast({
        title: "Gagal mencatat sesi",
        description: error.message || "Terjadi kesalahan saat mencatat sesi terapi",
        variant: "destructive",
      });
      return false;
    }
  };

  // Handle form submission
  const onSubmit = async (values: TransactionFormValues) => {
    console.log("Form submission triggered with values:", values);
    
    // Validasi input
    if (!values.patientId) {
      console.log("Validasi gagal: patientId kosong");
      toast({
        title: "Gagal memproses pembayaran",
        description: "Silakan pilih pasien terlebih dahulu",
        variant: "destructive",
      });
      return;
    }
    
    // Mode pembayaran utang sekaligus transaksi baru
    if (payDebt && selectedDebtTransaction) {
      // Validasi pembayaran utang
      if (parseFloat(paymentAmount) <= 0) {
        toast({
          title: "Jumlah pembayaran tidak valid",
          description: "Silakan masukkan jumlah pembayaran utang yang valid",
          variant: "destructive",
        });
        return;
      }
      
      // Hitung sisa utang
      const remainingDebt = parseFloat(selectedDebtTransaction.creditAmount) - parseFloat(selectedDebtTransaction.paidAmount);
      if (parseFloat(paymentAmount) > remainingDebt) {
        toast({
          title: "Jumlah pembayaran melebihi utang",
          description: `Sisa utang hanya ${formatPrice(remainingDebt.toString())}`,
          variant: "destructive",
        });
        return;
      }
      
      try {
        // Kirim pembayaran utang terlebih dahulu
        await apiRequest(`/api/transactions/${selectedDebtTransaction.id}/debt-payment`, {
          method: "POST",
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: paymentAmount,
            paymentMethod: values.paymentMethod,
            notes: cartItems.length > 0 ? 
              `Pembayaran sebagian dengan transaksi baru: ${cartItems.map(item => item.name).join(', ')}` :
              "Pembayaran utang"
          })
        });
        
        toast({
          title: "Pembayaran utang berhasil",
          description: `Utang ${formatPrice(paymentAmount)} telah dibayarkan`,
        });
        
        // Invalidate transaksi yang terlibat
        await queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/transactions/unpaid"] });
        
        // Jika tidak ada item untuk transaksi baru, selesai di sini
        if (cartItems.length === 0 && !useExistingPackage) {
          setShowInvoice(false);
          onClose();
          return;
        }
      } catch (error: any) {
        console.error("Error membayar utang:", error);
        toast({
          title: "Gagal membayar utang",
          description: error.message || "Terjadi kesalahan saat membayar utang",
          variant: "destructive",
        });
        return;
      }
    }
    
    // Validasi keranjang untuk transaksi baru - tapi skip untuk sesi tanpa paket
    // Jika dalam mode 'Gunakan sesi' kita skip validasi keranjang kosong
    // Jika tidak ada item di keranjang dan tidak bayar hutang, ini adalah sesi tanpa paket
    if (!useExistingPackage && cartItems.length === 0 && !payDebt) {
      console.log("Ini adalah sesi tanpa paket - lanjutkan proses");
      // Tidak perlu tampilkan error, karena kode ini akan ditangani di handleSubmitForm
    }
    
    // Jika dalam mode 'Gunakan sesi' tapi tidak ada sesi yang dipilih
    if (useExistingPackage && selectedSession === null && cartItems.length === 0) {
      console.log("Validasi gagal: tidak ada sesi yang dipilih");
      toast({
        title: "Gagal memproses pembayaran",
        description: "Pilih sesi terapi yang ingin digunakan atau tambahkan produk ke keranjang",
        variant: "destructive",
      });
      return;
    }
    
    // Hitung subtotal
    const subtotal = cartItems.reduce(
      (sum, item) => sum + parseFloat(item.price) * item.quantity,
      0
    );

    // Dapatkan nilai diskon dengan validasi
    const discountVal = form.watch("discount");
    const discount = discountVal ? parseFloat(discountVal) : 0;

    // Hitung total setelah diskon
    const totalAmount = Math.max(0, subtotal - discount);

    // Tambahkan informasi lengkap ke values
    values.items = cartItems.map(item => ({
      id: item.id,
      type: item.type,
      quantity: item.quantity,
      price: item.price
    }));
    
    values.subtotal = subtotal.toString();
    values.discount = discount.toString();
    values.totalAmount = totalAmount.toString();

    console.log("Mengirim data transaksi:", values);
    mutation.mutate(values);
  };
  
  // Handler untuk submit form secara manual dengan debounce protection
  const handleSubmitForm = async () => {
    // Ambil nilai form di luar blok try-catch agar tersedia di semua bagian fungsi
    const formValues = form.getValues();
    
    try {
      // Tambahkan semaphore untuk mencegah multiple submit
      if (mutation.isPending || isSubmitting) {
        toast({
          title: "Sedang diproses",
          description: "Mohon tunggu, transaksi sedang diproses",
        });
        return; // Prevent multiple submissions
      }
      
      // Jika hanya membayar utang dan tidak ada item baru di keranjang, atau mode bayar utang saja aktif
      if (payDebt && selectedDebtTransaction && (cartItems.length === 0 || debtOnlyPayment)) {
        setIsSubmitting(true);
        
        try {
          // Panggil fungsi pembayaran utang
          const result = await handleDebtPayment();
          
          if (result) {
            toast({
              title: "Pembayaran utang berhasil",
              description: `Pembayaran utang senilai ${formatPrice(paymentAmount)} telah berhasil dicatat`,
            });
            
            // Invalidate queries to refresh data
            await queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
            await queryClient.invalidateQueries({ queryKey: ["/api/transactions/unpaid"] });
            await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
            await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/activities"] });
            
            // Close form
            onClose();
          }
        } catch (error: any) {
          console.error("Error processing debt payment:", error);
          toast({
            title: "Gagal memproses pembayaran utang",
            description: error.message || "Terjadi kesalahan saat memproses pembayaran utang",
            variant: "destructive"
          });
        } finally {
          setIsSubmitting(false);
        }
        
        return;
      }
      
      // Jika tidak ada barang di keranjang dan tidak menggunakan paket yang ada, ini adalah sesi tanpa paket
      if (!useExistingPackage && cartItems.length === 0 && !payDebt) {
        setIsSubmitting(true);
        try {
          const success = await handleNoPackageSession();
          if (success) {
            // Fungsi handleNoPackageSession sudah menangani toast dan invalidate queries
            onClose();
          }
        } catch (error: any) {
          console.error("Error mencatat sesi tanpa paket:", error);
          toast({
            title: "Gagal mencatat sesi",
            description: error.message || "Terjadi kesalahan saat mencatat sesi terapi",
            variant: "destructive",
          });
        } finally {
          setIsSubmitting(false);
        }
        return;
      }
      
      console.log("Manual submit triggered");
      
      // Handle using session from package if selectedSession exists
      if (useExistingPackage && selectedSession) {
        // Prepare confirmation message based on cart content
        const hasProducts = cartItems.some(item => item.type === "product");
        let confirmMessage = `Konfirmasi penggunaan satu sesi dari paket ${selectedSession.package?.name}`;
        
        if (hasProducts) {
          const totalProductPrice = cartItems
            .filter(item => item.type === "product")
            .reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0);
            
          confirmMessage += ` dan pembelian produk senilai ${formatPrice(totalProductPrice.toString())}`;
        }
        
        confirmMessage += "?";
        
        // Confirm before proceeding
        if (!confirm(confirmMessage)) {
          return; // User canceled
        }
        
        // Disable form interaction during processing
        setIsSubmitting(true);
        
        try {
          // Kirim permintaan ke API untuk menggunakan sesi
          const newSessionsUsed = selectedSession.sessionsUsed + 1;
          const response = await fetch(`/api/sessions/${selectedSession.id}/use`, {
            method: "PUT",
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              sessionsUsed: newSessionsUsed
            })
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Gagal menggunakan sesi paket");
          }
          
          const result = await response.json();
          console.log("Hasil penggunaan sesi:", result);
          
          // Buat transaksi dengan total 0 untuk mencatat penggunaan sesi + produk jika ada
          // Persiapkan items untuk transaksi - mulai dari paket yang digunakan
          const transactionItems = [
            {
              id: selectedSession.packageId,
              type: "package",
              quantity: 1,
              description: "(menggunakan sisa paket)"
            }
          ];
          
          // Tambahkan produk yang dipilih ke dalam items transaksi
          const productItems = cartItems.filter(item => item.type === "product").map(item => ({
            id: item.id,
            type: item.type,
            quantity: item.quantity,
            price: item.price
          }));
          
          // Gabungkan semua item
          const allItems = [...transactionItems, ...productItems];
          
          // Hitung total harga produk (jangan hitung paket karena menggunakan sisa paket)
          const productTotal = productItems.reduce(
            (sum, item) => sum + parseFloat(item.price) * item.quantity, 
            0
          );
          
          const transactionData = {
            patientId: parseInt(formValues.patientId),
            totalAmount: productTotal.toString(), // Gunakan total harga produk
            paymentMethod: formValues.paymentMethod || "cash",
            items: allItems,
            notes: `Penggunaan sesi paket: ${selectedSession.package?.name}. Sesi ke-${newSessionsUsed} dari ${selectedSession.totalSessions}.`
          };
          
          // Simpan transaksi tanpa membuat sesi baru (penting: tambahkan flag createSession: false)
          const transactionResponse = await fetch('/api/transactions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ...transactionData,
              createSession: false // Flag penting untuk mencegah pembuatan sesi baru
            }),
          });
          
          if (!transactionResponse.ok) {
            console.warn("Gagal mencatat transaksi penggunaan sesi, tetapi sesi berhasil digunakan");
          } else {
            const transactionResult = await transactionResponse.json();
            console.log("Transaksi penggunaan sesi berhasil dicatat:", transactionResult);
            
            // Invalidate queries untuk refresh data
            queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
            queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
            queryClient.invalidateQueries({ queryKey: ['/api/dashboard/activities'] });
            queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
            queryClient.invalidateQueries({ queryKey: ['/api/dashboard/active-packages'] });
            
            // Tampilkan notifikasi sukses
            toast({
              title: "Sesi paket berhasil digunakan",
              description: `Tersisa ${selectedSession.remainingSessions - 1} sesi dari paket ${selectedSession.package?.name}`,
            });
            
            // Tutup form
            onClose();
          }
          
          return; // Exit function after handling session use
        } catch (error: any) {
          console.error("Error menggunakan sesi paket:", error);
          toast({
            title: "Gagal menggunakan sesi paket",
            description: error.message || "Terjadi kesalahan saat menggunakan sesi paket",
            variant: "destructive",
          });
        } finally {
          // Re-enable form interaction
          setIsSubmitting(false);
        }
        
        return; // Stop execution after error handling
      }
      
      // Jika kita sampai di sini, berarti kita tidak menggunakan paket yang ada
      // Proceed with normal transaction
      const subtotal = cartItems.reduce(
        (sum, item) => sum + parseFloat(item.price) * item.quantity,
        0
      );

      // Dapatkan nilai diskon dengan validasi (dari form)
      const discountVal = formValues.discount;
      const discount = discountVal ? parseFloat(discountVal) : 0;

      // Hitung total setelah diskon
      const totalAmount = Math.max(0, subtotal - discount);

      // Siapkan data kredit jika menggunakan fitur kredit
      const isPaid = !useCredit;
      const creditAmount = useCredit ? formValues.creditAmount || "0" : "0";
      const paidAmount = useCredit ? formValues.paidAmount || "0" : totalAmount.toString();
      
      const submissionData: TransactionFormValues = {
        patientId: formValues.patientId || "",
        paymentMethod: formValues.paymentMethod,
        items: cartItems.map(item => ({
          id: item.id,
          type: item.type,
          quantity: item.quantity,
          price: item.price,
        })),
        discount: discount.toString(),
        subtotal: subtotal.toString(),
        totalAmount: totalAmount.toString(),
        isPaid: isPaid,
        creditAmount: creditAmount,
        paidAmount: paidAmount,
        displayName: formValues.displayName || 'original', // Tambahkan preferensi nama tampilan
      };
      
      // Eksekusi onSubmit
      onSubmit(submissionData);
      
    } catch (error) {
      console.error("Error handling form submission:", error);
      toast({
        title: "Gagal memproses transaksi",
        description: "Terjadi kesalahan saat memproses transaksi. Silakan coba lagi.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  if (showInvoice && invoiceData) {
    return (
      <Invoice
        isOpen={showInvoice}
        onClose={() => {
          setShowInvoice(false);
          setFormKey(Date.now()); // Force a complete re-render on close
          onClose();
        }}
        data={invoiceData}
      />
    );
  }

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        if (!open) {
          // Reset state on dialog close
          setFormKey(Date.now());
        }
        onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold font-heading">Buat Transaksi Baru</DialogTitle>
        </DialogHeader>

        <Form {...form} key={formKey}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Patient Selection - Simple Approach */}
            <FormField
              control={form.control}
              name="patientId"
              render={({ field }) => {
                // Tampilkan nilai patientId dari form untuk debugging
                console.log("Rendering patient field. Current value:", field.value, "type:", typeof field.value);
                
                // Pastikan patientId dalam bentuk string untuk select component
                let idAsString = '';
                if (field.value) {
                  // Pastikan kita menangani kasus ketika field.value adalah null atau undefined
                  idAsString = field.value === null || field.value === undefined 
                    ? '' 
                    : (typeof field.value === 'number' ? String(field.value) : String(field.value));
                }
                
                // Log untuk debugging
                console.log("Processed ID as string:", idAsString);
                
                return (
                  <FormItem>
                    <FormLabel>Pilih Pasien</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <div className="mb-2">
                          <Input 
                            type="text"
                            placeholder="Cari nama pasien..."
                            onChange={(e) => {
                              // Reset form value when searching
                              if (e.target.value === '') {
                                field.onChange('');
                              }
                            }}
                            onKeyUp={(e) => {
                              const searchValue = e.currentTarget.value.toLowerCase();
                              // Update state for global use
                              setSearchTerm(searchValue);
                              
                              if (searchValue.length < 2) return;
                              
                              // Normalisasi nomor telepon untuk pencarian
                              const normalizePhoneNumber = (phone: string) => {
                                if (!phone) return '';
                                // Hapus semua karakter non-numerik
                                const numericOnly = phone.replace(/\D/g, '');
                                
                                // Normalisasi awalan +62 dan 0
                                if (numericOnly.startsWith('62')) {
                                  return numericOnly; // Format 62xxx
                                } else if (numericOnly.startsWith('0')) {
                                  return '62' + numericOnly.substring(1); // Ubah 0xxx menjadi 62xxx
                                } else {
                                  return numericOnly; // Format lainnya
                                }
                              };
                              
                              // Find matching patient
                              const matchingPatient = patients.find((patient: Patient) => {
                                // Perbaikan: Pastikan ada data pasien dan gunakan konversi string eksplisit
                                const patientName = patient.name ? String(patient.name).toLowerCase() : '';
                                const patientId = patient.patientId ? String(patient.patientId).toLowerCase() : '';
                                
                                console.log(`Checking if "${searchValue}" matches in "${patientName}"`);
                                
                                // Pencarian berdasarkan nama dan ID pasien (metode includes dan equality)
                                if ((patientName.includes(searchValue) || patientName === searchValue) || 
                                    (patientId.includes(searchValue) || patientId === searchValue)) {
                                  console.log(`Found match: "${patientName}"`);
                                  return true;
                                }
                                
                                // Pencarian berdasarkan nomor telepon yang dinormalisasi
                                if (patient.phoneNumber) {
                                  // Gunakan explicit string conversion untuk menghindari error
                                  const phoneNumber = String(patient.phoneNumber);
                                  const normalizedPatientPhone = normalizePhoneNumber(phoneNumber);
                                  const normalizedSearchTerm = normalizePhoneNumber(searchValue);
                                  
                                  // Pencocokan lengkap atau sebagian
                                  if (normalizedPatientPhone.includes(normalizedSearchTerm) || 
                                      normalizedSearchTerm.includes(normalizedPatientPhone)) {
                                    return true;
                                  }
                                }
                                
                                return false;
                              });
                              
                              // Auto-select if we have a match
                              if (matchingPatient) {
                                const patientIdStr = String(matchingPatient.id);
                                console.log("Auto-selected patient:", matchingPatient.name, "ID:", patientIdStr);
                                field.onChange(patientIdStr);
                              }
                            }}
                          />
                        </div>
                        
                        <Select
                          onValueChange={(value) => {
                            console.log("Select changed to value:", value);
                            field.onChange(value);
                            
                            // Log the patient name for debugging
                            const selectedPatient = patients.find((p: Patient) => String(p.id) === value);
                            if (selectedPatient) {
                              console.log("Selected patient:", selectedPatient.name);
                            }
                          }}
                          value={idAsString}
                          defaultValue={idAsString}
                        >
                          <SelectTrigger className="w-full focus:ring-2 focus:ring-primary">
                            <SelectValue placeholder="Pilih pasien dari daftar..." />
                          </SelectTrigger>
                          <SelectContent 
                            position="popper" 
                            side="bottom" 
                            sideOffset={4} 
                            align="start" 
                            className="z-[100] overflow-y-auto max-h-[300px] w-full"
                          >
                            {patients?.length === 0 ? (
                              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                                Belum ada data pasien
                              </div>
                            ) : searchTerm && searchTerm.toLowerCase().includes('syafl') ? (
                              // Khusus untuk pencarian "syaflina" atau "syafliana"
                              (() => {
                                // Temukan pasien Queenzky dan pasien lain yang cocok
                                const queenzkyPatient = patients.find(p => p.name.includes('Queenzky'));
                                const otherPatients = patients.filter(p => 
                                  p.name.toLowerCase().includes('syahl') || 
                                  (queenzkyPatient && p.id !== queenzkyPatient.id)
                                );
                                
                                // Gabungkan hasilnya dengan Queenzky di awal (jika ditemukan)
                                const filteredPatients = queenzkyPatient 
                                  ? [queenzkyPatient, ...otherPatients] 
                                  : otherPatients;
                                
                                return filteredPatients.map((patient: Patient) => (
                                  <SelectItem 
                                    key={patient.id} 
                                    value={String(patient.id)}
                                    className={`cursor-pointer hover:bg-primary/10 ${
                                      queenzkyPatient && patient.id === queenzkyPatient.id 
                                        ? 'border-l-4 border-amber-500 pl-2' 
                                        : patient.name.includes('(') ? 'border-l-4 border-blue-500 pl-2' : ''
                                    }`}
                                  >
                                    <span className="font-medium">
                                      {patient.name}
                                      {queenzkyPatient && patient.id === queenzkyPatient.id && (
                                        <span className="ml-2 text-xs text-amber-600">(Syaflina/Syafliana)</span>
                                      )}
                                    </span>
                                    <span className="ml-2 text-xs text-muted-foreground">({patient.patientId})</span>
                                  </SelectItem>
                                ));
                              })()
                            ) : searchTerm ? (
                              // Filter berdasarkan searchTerm untuk kata kunci lainnya
                              patients
                                .filter(patient => {
                                  // Perbaikan: Gunakan konversi string eksplisit untuk mencegah error
                                  const patientName = patient.name ? String(patient.name).toLowerCase() : '';
                                  const patientId = patient.patientId ? String(patient.patientId).toLowerCase() : '';
                                  const searchTermLower = searchTerm.toLowerCase();
                                  
                                  // Pencarian berdasarkan nama dan ID pasien (metode includes dan equality)
                                  if ((patientName.includes(searchTermLower) || patientName === searchTermLower) ||
                                      (patientId.includes(searchTermLower) || patientId === searchTermLower)) {
                                    return true;
                                  }
                                  
                                  // Pencarian berdasarkan nomor telepon yang dinormalisasi
                                  if (patient.phoneNumber) {
                                    const normalizePhoneNumber = (phone: string) => {
                                      if (!phone) return '';
                                      // Hapus semua karakter non-numerik
                                      const numericOnly = phone.replace(/\D/g, '');
                                      
                                      // Normalisasi awalan +62 dan 0
                                      if (numericOnly.startsWith('62')) {
                                        return numericOnly; // Format 62xxx
                                      } else if (numericOnly.startsWith('0')) {
                                        return '62' + numericOnly.substring(1); // Ubah 0xxx menjadi 62xxx
                                      } else {
                                        return numericOnly; // Format lainnya
                                      }
                                    };
                                    
                                    // Gunakan explicit string conversion untuk mencegah error
                                    const phoneNumber = String(patient.phoneNumber);
                                    const normalizedPatientPhone = normalizePhoneNumber(phoneNumber);
                                    const normalizedSearchTerm = normalizePhoneNumber(searchTerm);
                                    
                                    // Pencocokan lengkap atau sebagian
                                    if (normalizedPatientPhone.includes(normalizedSearchTerm) || 
                                        normalizedSearchTerm.includes(normalizedPatientPhone)) {
                                      return true;
                                    }
                                  }
                                  
                                  return false;
                                })
                                .map((patient: Patient) => (
                                  <SelectItem 
                                    key={patient.id} 
                                    value={String(patient.id)}
                                    className={`cursor-pointer hover:bg-primary/10 ${patient.name.includes('(') ? 'border-l-4 border-blue-500 pl-2' : ''}`}
                                  >
                                    <span className="font-medium">
                                      {patient.name}
                                    </span>
                                    <span className="ml-2 text-xs text-muted-foreground">({patient.patientId})</span>
                                  </SelectItem>
                                ))
                            ) : (
                              // Tampilkan semua pasien jika tidak ada kata kunci pencarian
                              patients?.map((patient: Patient) => (
                                <SelectItem 
                                  key={patient.id} 
                                  value={String(patient.id)}
                                  className={`cursor-pointer hover:bg-primary/10 ${patient.name.includes('(') ? 'border-l-4 border-blue-500 pl-2' : ''}`}
                                >
                                  <span className="font-medium">
                                    {patient.name}
                                  </span>
                                  <span className="ml-2 text-xs text-muted-foreground">({patient.patientId})</span>
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        
                        {/* Show selected patient info */}
                        {field.value && (
                          <div className="text-sm p-2 border rounded-md bg-muted/40">
                            {(() => {
                              const patientIdStr = field.value === null || field.value === undefined
                                ? ''
                                : (typeof field.value === 'number'
                                   ? String(field.value) // Menggunakan String() agar konsisten
                                   : String(field.value));
                                
                              console.log("Looking for patient with ID str:", patientIdStr);
                              console.log("Types of patient IDs available:", patients.slice(0, 3).map(p => typeof p.id));
                              
                              // Perbaikan: Konversi ID pasien dan normalisasi ke both number & string format
                              // Konversi patientIdStr ke number untuk perbandingan yang konsisten
                              const patientIdNumber = patientIdStr ? parseInt(patientIdStr, 10) : -1;
                              
                              // Logging untuk debug
                              console.log("Patient search with ID:", patientIdStr, "as number:", patientIdNumber);
                              
                              // Coba cari pasien dengan pendekatan yang lebih komprehensif dan toleran terhadap perbedaan tipe data
                              // Coba cari dari localStorage dengan key patient_[ID] terlebih dahulu
                              // Ini adalah data yang telah disimpan oleh slot-patients-dialog.tsx
                              try {
                                // Cek apakah ada data pasien lengkap di localStorage
                                const storedPatientData = localStorage.getItem(`patient_${patientIdNumber}`);
                                if (storedPatientData) {
                                  const parsedPatient = JSON.parse(storedPatientData);
                                  if (parsedPatient && parsedPatient.id === patientIdNumber) {
                                    console.log("FOUND patient from localStorage cache:", parsedPatient.name);
                                    
                                    // Selalu buat UI komponen di sini, bukan mengembalikan objek mentah
                                    return (
                                      <div className="space-y-1">
                                        <p className="font-medium">
                                          Pasien terpilih: {parsedPatient.name}
                                        </p>
                                        <div className="grid grid-cols-2 gap-1">
                                          <p className="text-xs text-muted-foreground">ID Pasien:</p>
                                          <p className="text-xs">{parsedPatient.patientId}</p>
                                          
                                          {parsedPatient.phoneNumber && (
                                            <>
                                              <p className="text-xs text-muted-foreground">No. WhatsApp:</p>
                                              <p className="text-xs">{parsedPatient.phoneNumber}</p>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  }
                                }
                              } catch (err) {
                                console.error("Error parsing stored patient data:", err);
                                // Lanjutkan ke metode pencarian biasa
                              }

                              // Lanjut ke metode fallback: coba langsung dari API
                              const apiPatientUrl = `/api/patients/${patientIdNumber}`;
                              console.log(`Mencoba memuat data pasien ${patientIdNumber} dari API: ${apiPatientUrl}`);
                              try {
                                // Gunakan fetch dengan mode sync
                                const apiPatientResponse = localStorage.getItem(`temp_api_patient_${patientIdNumber}`);
                                if (apiPatientResponse) {
                                  try {
                                    const apiPatient = JSON.parse(apiPatientResponse);
                                    console.log("FOUND patient from API quick-cache:", apiPatient.name);
                                    
                                    // Selalu render komponen UI untuk hasil API juga
                                    return (
                                      <div className="space-y-1">
                                        <p className="font-medium">
                                          Pasien terpilih: {apiPatient.name}
                                        </p>
                                        <div className="grid grid-cols-2 gap-1">
                                          <p className="text-xs text-muted-foreground">ID Pasien:</p>
                                          <p className="text-xs">{apiPatient.patientId || '-'}</p>
                                          
                                          {apiPatient.phoneNumber && (
                                            <>
                                              <p className="text-xs text-muted-foreground">No. WhatsApp:</p>
                                              <p className="text-xs">{apiPatient.phoneNumber}</p>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  } catch (err) {
                                    console.error("Error parsing cached API patient:", err);
                                  }
                                }
                                
                                // Jalankan fetch yang asinkron untuk digunakan pada render berikutnya
                                fetch(apiPatientUrl)
                                  .then(response => response.json())
                                  .then(patient => {
                                    if (patient && patient.id) {
                                      console.log("✅ Berhasil memuat pasien dari API:", patient.name);
                                      // Pastikan hanya menyimpan data primitif, bukan objek kompleks
                                      const simplifiedPatient = {
                                        id: Number(patient.id),
                                        name: String(patient.name || ''),
                                        patientId: String(patient.patientId || ''),
                                        phoneNumber: String(patient.phoneNumber || ''),
                                        address: String(patient.address || ''),
                                        email: patient.email ? String(patient.email) : null
                                      };
                                      // Simpan ke cache sementara untuk render berikutnya
                                      localStorage.setItem(`temp_api_patient_${patientIdNumber}`, JSON.stringify(simplifiedPatient));
                                      // Memicu rerender dengan timeout
                                      setTimeout(() => {
                                        // Gunakan force refresh jika dibutuhkan
                                        console.log("API data loaded, will refresh on next render");
                                      }, 100);
                                    }
                                  })
                                  .catch(err => {
                                    console.error("Error fetching patient from API:", err);
                                  });
                              } catch (err) {
                                console.error("Error in direct API loading:", err);
                              }
                            
                              // Gunakan metode pencarian dari array pasien sebagai fallback terakhir
                              const selectedPatient = patients.find(p => {
                                try {
                                  // Konversi kedua ID ke string dan number untuk berbagai jenis perbandingan
                                  const patientStringId = String(p.id);
                                  const patientNumericId = Number(p.id);
                                  const searchStringId = String(patientIdStr).trim();
                                  const searchNumericId = Number(patientIdNumber);
                                  
                                  // Log debugging jika ada kecocokan
                                  if (patientNumericId === searchNumericId || patientStringId === searchStringId) {
                                    console.log(`MATCH FOUND! Patient ${p.name} with ID ${patientStringId} matches search ID ${searchStringId}`);
                                  }
                                  
                                  // Periksa dengan beberapa metode perbandingan (dari yang paling ketat hingga paling longgar)
                                  return (
                                    // Metode 1: Perbandingan numeric ID (paling akurat)
                                    patientNumericId === searchNumericId ||
                                    
                                    // Metode 2: Perbandingan string ID yang ketat
                                    patientStringId === searchStringId ||
                                    
                                    // Metode 3: Perbandingan string ID yang lebih fleksibel (trim whitespace)
                                    patientStringId.trim() === searchStringId.trim() ||
                                    
                                    // Metode 4: Perbandingan string ID dengan parse Int
                                    parseInt(patientStringId, 10) === parseInt(searchStringId, 10)
                                  );
                                } catch (err) {
                                  console.error("Error comparing patient IDs:", err);
                                  // Jika terjadi error, fallback ke perbandingan dasar
                                  return String(p.id) === String(patientIdStr);
                                }
                              });
                              console.log("Selected patient result:", selectedPatient?.name || "Not found");
                              
                              // Jika pencarian termasuk 'syaflina' atau 'syafliana', cek apakah IDs sesuai dengan Queenzky Zahwa Aqeela
                              if (!selectedPatient && searchTerm?.toLowerCase().includes('syafl')) {
                                const queenzkyPatient = patients.find(p => p.name.includes('Queenzky'));
                                
                                if (queenzkyPatient && String(queenzkyPatient.id) === patientIdStr) {
                                  // Tampilkan data Queenzky sebagai "Syafliana"
                                  return (
                                    <div className="space-y-1">
                                      <p className="font-medium">
                                        Pasien terpilih: {queenzkyPatient.name} <span className="text-xs text-amber-600">(Syaflina/Syafliana)</span>
                                      </p>
                                      <div className="grid grid-cols-2 gap-1">
                                        <p className="text-xs text-muted-foreground">ID Pasien:</p>
                                        <p className="text-xs">{queenzkyPatient.patientId}</p>
                                        
                                        {queenzkyPatient.phoneNumber && (
                                          <>
                                            <p className="text-xs text-muted-foreground">No. WhatsApp:</p>
                                            <p className="text-xs">{queenzkyPatient.phoneNumber}</p>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  );
                                }
                              }
                              
                              return selectedPatient ? (
                                <div className="space-y-1">
                                  <p className="font-medium">
                                    Pasien terpilih: {selectedPatient.name}
                                  </p>
                                  <div className="grid grid-cols-2 gap-1">
                                    <p className="text-xs text-muted-foreground">ID Pasien:</p>
                                    <p className="text-xs">{selectedPatient.patientId}</p>
                                    
                                    {selectedPatient.phoneNumber && (
                                      <>
                                        <p className="text-xs text-muted-foreground">No. WhatsApp:</p>
                                        <p className="text-xs">{selectedPatient.phoneNumber}</p>
                                      </>
                                    )}
                                    
                                    {/* Opsi khusus untuk Queenzky/Syafliana */}
                                    {selectedPatient.name.includes('Queenzky') && (
                                      <div className="col-span-2 mt-1 pt-1 border-t">
                                        <p className="text-xs text-muted-foreground">Tampilkan nama di invoice sebagai:</p>
                                        <div className="flex space-x-2 mt-1">
                                          <label className="flex items-center space-x-1 text-xs">
                                            <input 
                                              type="radio" 
                                              name="displayName" 
                                              value="original" 
                                              defaultChecked 
                                              className="h-3 w-3"
                                              onChange={() => {
                                                // Simpan ke state sementara form
                                                form.setValue("displayName", "original");
                                              }}
                                            />
                                            <span>Queenzky Zahwa</span>
                                          </label>
                                          <label className="flex items-center space-x-1 text-xs">
                                            <input 
                                              type="radio" 
                                              name="displayName" 
                                              value="alternative" 
                                              className="h-3 w-3"
                                              onChange={() => {
                                                // Simpan ke state sementara form
                                                form.setValue("displayName", "alternative");
                                              }}
                                            />
                                            <span>Syafliana</span>
                                          </label>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm text-amber-600">
                                  {searchTerm?.toLowerCase().includes('syafl') ? 
                                    "Silahkan pilih 'Queenzky Zahwa Aqeela'" : 
                                    "Menunggu data pasien..."}
                                </p>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            {/* Active Packages Section - Only show for multi-session packages */}
            {form.watch("patientId") && activeSessions && 
             activeSessions.filter(session => session.package && session.package.sessions > 1).length > 0 && (
              <div className="border border-muted rounded-md p-4 bg-muted/10">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    Paket Terapi Multi-Sesi
                  </h4>
                  {/* Only show the switch if there are multi-session packages */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Gunakan sesi?</span>
                    <Switch 
                      checked={useExistingPackage} 
                      onCheckedChange={(checked) => {
                        // When disabling, also clear the selectedSession to prevent it from being reused
                        if (!checked && selectedSession) {
                          setSelectedSession(null);
                        }
                        setUseExistingPackage(checked);
                      }}
                    />
                  </div>
                </div>
                
                {useExistingPackage ? (
                  <Accordion type="single" collapsible className="w-full">
                    {/* Tampilkan semua sesi paket multi-sesi yang masih ada tersisa */}
                    {/* Debug info */}
                    <div className="text-xs text-muted-foreground mb-2">
                      Total sesi aktif: {activeSessions.length} sesi 
                    </div>
                    
                    {activeSessions
                      .filter(session => {
                        // Debugging logging
                        console.log("Checking session:", session.id, "Patient:", session.patientId, "Remaining:", session.remainingSessions, "Package:", session.package?.name);
                        
                        return (
                          session.package && 
                          session.package.sessions > 1 && 
                          session.remainingSessions > 0
                        )
                      })
                      .map(session => (
                      <AccordionItem value={`session-${session.id}`} key={session.id}>
                        <AccordionTrigger className="py-2 text-sm hover:no-underline">
                          <div className="flex items-center justify-between w-full">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span>{session.package?.name}</span>
                                <Badge variant={session.remainingSessions > 1 ? 'default' : 'destructive'} className="ml-2">
                                  {session.remainingSessions} sesi tersisa
                                </Badge>
                              </div>
                              {!session.isDirectOwner && session.owner && (
                                <div className="text-xs text-amber-600 font-medium flex items-center gap-1 mt-1">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                                    <polyline points="16 6 12 2 8 6" />
                                    <line x1="12" y1="2" x2="12" y2="15" />
                                  </svg>
                                  Dibagi dengan {session.owner.name}
                                </div>
                              )}
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <Card className="border-0 shadow-none">
                            <CardContent className="p-2 space-y-3">
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <p className="text-muted-foreground">Mulai tanggal:</p>
                                  <p className="font-medium">{format(new Date(session.startDate), 'dd MMMM yyyy', {locale: id})}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Sesi terakhir:</p>
                                  <p className="font-medium">
                                    {session.lastSessionDate 
                                      ? format(new Date(session.lastSessionDate), 'dd MMMM yyyy', {locale: id})
                                      : '-'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Total sesi:</p>
                                  <p className="font-medium">{session.totalSessions}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Sesi digunakan:</p>
                                  <p className="font-medium">{session.sessionsUsed}</p>
                                </div>
                              </div>
                              
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs">
                                  <span>Progress</span>
                                  <span>{Math.floor((session.sessionsUsed / session.totalSessions) * 100)}%</span>
                                </div>
                                <Progress 
                                  value={(session.sessionsUsed / session.totalSessions) * 100} 
                                  className="h-2"
                                />
                              </div>
                              
                              <Button 
                                onClick={() => {
                                  // Just select the session, actual processing happens on form submit
                                  setSelectedSession(session);
                                  toast({
                                    title: "Paket dipilih",
                                    description: "Klik tombol 'Proses Pembayaran' untuk mencatat penggunaan sesi",
                                  });
                                }}
                                disabled={session.remainingSessions <= 0 || selectedSession?.id === session.id}
                                className="w-full"
                                size="sm"
                                variant={selectedSession?.id === session.id ? "secondary" : "default"}
                              >
                                {selectedSession?.id === session.id ? "Sesi Terpilih" : "Pilih Sesi Ini"}
                              </Button>
                            </CardContent>
                          </Card>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                ) : (
                  <div className="text-sm text-muted-foreground border border-dashed rounded-md p-3 flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    <span>
                      Pasien memiliki {activeSessions.filter(session => 
                        session.package && 
                        session.package.sessions > 1 && 
                        session.remainingSessions > 0 &&
                        // Memastikan hanya menampilkan paket unik berdasarkan packageId
                        // dan mengambil yang memiliki ID terkecil (paket yang paling lama dibeli)
                        !activeSessions.some(s => 
                          s.id < session.id && 
                          s.packageId === session.packageId && 
                          s.patientId === session.patientId &&
                          s.remainingSessions > 0
                        )
                      ).length} paket terapi aktif. 
                      Aktifkan switch untuk menggunakan sesi dari paket yang ada.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Package Selection */}
            <div className={`${useExistingPackage ? 'opacity-50' : ''}`}>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                {useExistingPackage ? 'Beli Paket Terapi Baru' : 'Paket Terapi'}
              </h4>
              <div className="space-y-4">
                <Select
                  value={selectedPackage}
                  onValueChange={handlePackageSelect}
                  disabled={useExistingPackage}
                >
                  <FormControl>
                    <SelectTrigger className="w-full focus:ring-2 focus:ring-primary">
                      <SelectValue placeholder="Pilih paket terapi..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent 
                    position="popper" 
                    side="bottom" 
                    sideOffset={4} 
                    align="start" 
                    className="z-[100] overflow-y-auto max-h-[300px] w-full"
                  >
                    {packages?.length ? (
                      packages.map((pkg: Package) => (
                        <SelectItem 
                          key={pkg.id} 
                          value={pkg.id.toString()}
                          className="cursor-pointer hover:bg-primary/10"
                        >
                          <span className="font-medium">{pkg.name}</span>
                          <span className="ml-2 text-muted-foreground">({formatPrice(pkg.price)})</span>
                        </SelectItem>
                      ))
                    ) : (
                      <div className="py-2 px-2 text-sm text-muted-foreground text-center">
                        Tidak ada paket terapi tersedia
                      </div>
                    )}
                  </SelectContent>
                </Select>
                {useExistingPackage && (
                  <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    <span>Nonaktifkan mode "Gunakan sesi" untuk menambahkan paket baru</span>
                  </div>
                )}
              </div>
            </div>

            {/* Product Selection */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Tambah Produk (opsional)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {products?.map((product: Product) => {
                  const isInCart = cartItems.some(
                    item => item.type === "product" && item.id === product.id
                  );
                  const cartItem = cartItems.find(
                    item => item.type === "product" && item.id === product.id
                  );

                  return (
                    <div
                      key={product.id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 p-3"
                    >
                      <div className="flex items-center">
                        <Checkbox
                          id={`product-${product.id}`}
                          checked={isInCart}
                          onCheckedChange={(checked) =>
                            handleProductToggle(product, checked as boolean)
                          }
                          disabled={product.stock <= 0}
                        />
                        <Label
                          htmlFor={`product-${product.id}`}
                          className="ml-3 flex flex-col"
                        >
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {product.name}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatPrice(product.price)} - Stok: {product.stock}
                          </span>
                        </Label>
                      </div>

                      {isInCart && cartItem && (
                        <div className="flex items-center">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            type="button"
                            onClick={() =>
                              updateProductQuantity(product.id, cartItem.quantity - 1)
                            }
                          >
                            -
                          </Button>
                          <span className="mx-2 text-sm text-gray-800 dark:text-gray-200">
                            {cartItem.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            type="button"
                            onClick={() =>
                              updateProductQuantity(product.id, cartItem.quantity + 1)
                            }
                          >
                            +
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Payment Method */}
            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Metode Pembayaran</FormLabel>
                  <FormControl>
                    <PaymentMethods
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Discount */}
            <FormField
              control={form.control}
              name="discount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Diskon (Rp)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      step="1000"
                      placeholder="0"
                      {...field}
                      onChange={(e) => {
                        // Ensure value is not negative
                        const value = Math.max(0, parseFloat(e.target.value) || 0);
                        field.onChange(value.toString());
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Credit Option Toggle */}
            {/* Bagian Bayar Utang */}
            {form.watch("patientId") && (
              <div className="flex flex-col space-y-3 p-3 border rounded-md border-muted bg-amber-50 dark:bg-amber-950/30 mb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-amber-600 dark:text-amber-400" /> 
                    <span className="text-sm font-medium">Bayar Utang Sebelumnya</span>
                  </div>
                  <Switch
                    checked={payDebt}
                    disabled={!unpaidTransactions.some((tx: any) => parseInt(tx.patientId) === parseInt(form.getValues().patientId || "0"))}
                    onCheckedChange={(checked) => {
                      setPayDebt(checked);
                      setDebtOnlyPayment(checked);
                      if (!checked) {
                        setSelectedDebtTransaction(null);
                        setPaymentAmount("0");
                        setDebtOnlyPayment(false);
                      }
                    }}
                  />
                </div>
                
                <FormDescription className="text-xs mb-2">
                  Aktifkan untuk membayar utang sebelumnya sambil melakukan transaksi baru.
                </FormDescription>
                
                {!unpaidTransactions.some((tx: any) => parseInt(tx.patientId) === parseInt(form.getValues().patientId || "0")) && (
                  <div className="text-sm text-muted-foreground p-2 bg-muted/50 rounded-md">
                    Tidak ada transaksi dengan utang yang tersisa untuk pasien ini.
                  </div>
                )}
                
                {payDebt && (
                  <div className="flex items-center justify-between mt-1 mb-1 pl-6">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Bayar Utang Saja (Tanpa Item Baru)</span>
                    </div>
                    <Switch
                      checked={debtOnlyPayment}
                      onCheckedChange={(checked) => {
                        setDebtOnlyPayment(checked);
                      }}
                    />
                  </div>
                )}
                
                {payDebt && unpaidTransactions.some((tx: any) => parseInt(tx.patientId) === parseInt(form.getValues().patientId || "0")) && (
                  <div className="grid gap-3 pt-2 border-t border-amber-200 dark:border-amber-800">
                    <div className="text-sm font-medium">Pilih Transaksi Kredit:</div>
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      {unpaidTransactions
                        .filter((tx: any) => parseInt(tx.patientId) === parseInt(form.getValues().patientId || "0"))
                        .map((transaction: any) => {
                          // Hitung sisa utang yang benar
                          const totalTransactionAmount = parseFloat(transaction.totalAmount);
                          const paidAmount = parseFloat(transaction.paidAmount);
                          const remainingDebt = totalTransactionAmount - paidAmount;
                          
                          return (
                            <div 
                              key={transaction.id}
                              className={`flex justify-between items-center p-2 rounded-md cursor-pointer border ${
                                selectedDebtTransaction?.id === transaction.id 
                                  ? 'border-primary bg-primary/10' 
                                  : 'border-muted bg-card'
                              }`}
                              onClick={() => handleDebtSelect(transaction)}
                            >
                              <div className="overflow-hidden">
                                <div className="font-medium text-sm truncate">
                                  {transaction.transactionId}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(transaction.createdAt).toLocaleDateString('id-ID')}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-sm">
                                  {formatPrice(remainingDebt.toString())}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Utang tersisa
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                    
                    {selectedDebtTransaction && (
                      <div className="grid gap-2">
                        <FormLabel>Jumlah Pembayaran (Rp)</FormLabel>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            min="0"
                            step="1000"
                            value={paymentAmount}
                            onChange={(e) => {
                              // Pastikan nilai valid dan positif
                              const value = Math.max(0, parseFloat(e.target.value) || 0);
                              
                              // Pastikan nilai tidak melebihi sisa hutang
                              if (selectedDebtTransaction) {
                                const totalAmount = parseFloat(selectedDebtTransaction.totalAmount);
                                const paidAmount = parseFloat(selectedDebtTransaction.paidAmount);
                                const remainingDebt = totalAmount - paidAmount;
                                
                                // Batasi nilai maksimum pembayaran sesuai sisa hutang
                                const validValue = Math.min(value, remainingDebt);
                                setPaymentAmount(validValue.toString());
                              } else {
                                setPaymentAmount(value.toString());
                              }
                            }}
                            className="flex-grow"
                          />
                          <Button 
                            type="button" 
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const totalAmount = parseFloat(selectedDebtTransaction.totalAmount);
                              const paidAmount = parseFloat(selectedDebtTransaction.paidAmount);
                              const remainingDebt = totalAmount - paidAmount;
                              setPaymentAmount(remainingDebt.toString());
                            }}
                          >
                            Bayar Lunas
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
                    
            {/* Bagian Opsi Kredit */}
            <div className="flex flex-col space-y-3 p-3 border rounded-md border-muted bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-primary" /> 
                  <span className="text-sm font-medium">Opsi Kredit/Hutang</span>
                </div>
                <Switch
                  checked={useCredit}
                  onCheckedChange={setUseCredit}
                />
              </div>
              
              <FormDescription className="text-xs mb-2">
                Aktifkan untuk transaksi dengan pembayaran sebagian atau ditunda. 
                Pembayaran kredit akan tercatat sebagai hutang yang dapat dilunasi kemudian.
              </FormDescription>
              
              {useCredit && (
                <div className="grid gap-3 pt-2 border-t border-muted">
                  <FormField
                    control={form.control}
                    name="paidAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jumlah Dibayar Dimuka (Rp)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="1000"
                            placeholder="0"
                            {...field}
                            onChange={(e) => {
                              // Ensure value is not negative
                              const value = Math.max(0, parseFloat(e.target.value) || 0);
                              
                              // Calculate subtotal and discount
                              const subtotal = cartItems.reduce(
                                (sum, item) => sum + parseFloat(item.price) * item.quantity, 0
                              );
                              const discount = parseFloat(form.getValues().discount || "0");
                              const totalAmount = Math.max(0, subtotal - discount);
                              
                              // Ensure paid amount doesn't exceed total
                              const validValue = Math.min(value, totalAmount);
                              
                              // Update paid amount
                              field.onChange(validValue.toString());
                              
                              // Update credit amount automatically - sisa hutang selalu otomatis diupdate
                              // Jika DP = 0, maka seluruh total menjadi kredit
                              // Selalu recalculate sisa hutang berdasarkan pembayaran dimuka
                              const calculatedCredit = Math.max(0, totalAmount - validValue);
                              form.setValue("creditAmount", calculatedCredit.toString());
                            }}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Jumlah yang dibayarkan saat ini.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="creditAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sisa Hutang (Rp)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="1000"
                            placeholder="0"
                            {...field}
                            onChange={(e) => {
                              // Ensure value is not negative
                              const value = Math.max(0, parseFloat(e.target.value) || 0);
                              
                              // Calculate subtotal and discount
                              const subtotal = cartItems.reduce(
                                (sum, item) => sum + parseFloat(item.price) * item.quantity, 0
                              );
                              const discount = parseFloat(form.getValues().discount || "0");
                              const totalAmount = Math.max(0, subtotal - discount);

                              // Validate that credit doesn't exceed total amount
                              const validValue = Math.min(value, totalAmount);
                              
                              // Update credit amount
                              field.onChange(validValue.toString());
                              
                              // Update paid amount automatically - selalu update nilai pembayaran
                              const paidAmount = Math.max(0, totalAmount - validValue);
                              form.setValue("paidAmount", paidAmount.toString());
                            }}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Jumlah hutang yang harus dilunasi. Bisa diubah secara manual.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            {/* Transaction Summary */}
            {(cartItems.length > 0 || (payDebt && selectedDebtTransaction)) && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Ringkasan Transaksi</h4>
                <div className="space-y-2 text-sm">
                  {/* Pembayaran Utang */}
                  {payDebt && selectedDebtTransaction && (
                    <div className="mb-3 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-md border border-amber-200 dark:border-amber-800">
                      <div className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium mb-2">
                        <Receipt className="h-4 w-4" />
                        <span>Pembayaran Utang</span>
                      </div>
                      
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Transaksi ID</span>
                          <span className="font-medium">{selectedDebtTransaction.transactionId}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tanggal Transaksi</span>
                          <span className="font-medium">{new Date(selectedDebtTransaction.createdAt).toLocaleDateString('id-ID')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Utang</span>
                          <span className="font-medium">{formatPrice(selectedDebtTransaction.totalAmount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Sudah Dibayar</span>
                          <span className="font-medium">{formatPrice(selectedDebtTransaction.paidAmount)}</span>
                        </div>
                        <div className="flex justify-between text-amber-800 dark:text-amber-400 font-medium border-t border-amber-200 dark:border-amber-800 pt-1 mt-1">
                          <span>Sisa Utang</span>
                          <span>{formatPrice((parseFloat(selectedDebtTransaction.totalAmount) - parseFloat(selectedDebtTransaction.paidAmount)).toString())}</span>
                        </div>
                        <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-medium border-t border-amber-200 dark:border-amber-800 pt-1 mt-1">
                          <span>Jumlah Dibayar</span>
                          <span>{formatPrice(paymentAmount)}</span>
                        </div>
                        <div className="flex justify-between text-blue-700 dark:text-blue-400 font-medium border-t border-amber-200 dark:border-amber-800 pt-1 mt-1">
                          <span>Sisa Hutang Setelah Pembayaran</span>
                          <span>{formatPrice(Math.max(0, (parseFloat(selectedDebtTransaction.totalAmount) - parseFloat(selectedDebtTransaction.paidAmount) - parseFloat(paymentAmount || "0"))).toString())}</span>
                        </div>
                      </div>
                    </div>
                  )}
                
                  {cartItems.map((item, index) => (
                    <div key={index} className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">
                        {item.name} {item.quantity > 1 ? `(${item.quantity}x)` : ""}
                      </span>
                      <span className="text-gray-800 dark:text-gray-200">
                        {formatPrice((parseFloat(item.price) * item.quantity).toString())}
                      </span>
                    </div>
                  ))}
                  
                  {cartItems.length > 0 && (
                    <>
                      {/* Subtotal */}
                      <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between">
                        <span className="text-gray-700 dark:text-gray-300">Subtotal</span>
                        <span className="text-gray-800 dark:text-gray-200">
                          {formatPrice(
                            cartItems.reduce(
                              (sum, item) => sum + parseFloat(item.price) * item.quantity,
                              0
                            ).toString()
                          )}
                        </span>
                      </div>
                      
                      {/* Discount */}
                      {parseFloat(form.watch("discount") || "0") > 0 && (
                        <div className="flex justify-between text-red-500">
                          <span>Diskon</span>
                          <span>-{formatPrice(form.watch("discount") || "0")}</span>
                        </div>
                      )}
                      
                      {/* Total after discount */}
                      <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between font-semibold">
                        <span className="text-gray-700 dark:text-gray-300">Total</span>
                        <span className="text-primary dark:text-primary-light">
                          {formatPrice(calculateTotal().toString())}
                        </span>
                      </div>
                    </>
                  )}
                  
                  {/* Credit status */}
                  {useCredit && (
                    <div className="mt-3 rounded-md bg-muted/50 p-2 text-xs">
                      <div className="flex justify-between mb-1">
                        <span className="text-muted-foreground">Status</span>
                        <span className="font-medium text-yellow-600 dark:text-yellow-500 flex items-center gap-1">
                          <CreditCard className="h-3 w-3" /> Kredit
                        </span>
                      </div>
                      
                      <div className="flex justify-between mb-1">
                        <span className="text-muted-foreground">Dibayar Dimuka</span>
                        <span className="font-medium">
                          {formatPrice(form.watch("paidAmount") || "0")}
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sisa Hutang</span>
                        <span className="font-medium text-red-600 dark:text-red-500">
                          {formatPrice(form.watch("creditAmount") || "0")}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {/* Total Keseluruhan (Transaksi + Pembayaran Utang) */}
                  {payDebt && selectedDebtTransaction && cartItems.length > 0 && (
                    <div className="mt-3 pt-2 border-t-2 border-gray-300 dark:border-gray-600">
                      <div className="flex justify-between font-bold text-base">
                        <span className="text-gray-800 dark:text-gray-200">Total Keseluruhan</span>
                        <span className="text-primary">
                          {formatPrice((parseFloat(paymentAmount) + calculateTotal()).toString())}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Total pembayaran termasuk barang baru dan pembayaran utang
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <h3 className="font-medium text-primary">Sesi Terapi</h3>
                  <p className="text-sm text-muted-foreground">
                    Pilih jenis transaksi: menggunakan paket atau terapi tanpa paket
                  </p>
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={mutation.isPending || isSubmitting}
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={handleSubmitForm}
                disabled={mutation.isPending || isSubmitting}
              >
                {mutation.isPending || isSubmitting ? "Memproses..." : (!useExistingPackage && cartItems.length === 0 && !(payDebt && selectedDebtTransaction)) ? "Catat Sesi Tanpa Paket" : "Proses Pembayaran"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
