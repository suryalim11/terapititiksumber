import { useState, useEffect, useMemo, useRef, FC } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { id } from "date-fns/locale";

// Komponen PatientDetail untuk menampilkan informasi pasien terpilih
interface PatientDetailProps {
  patientId: string | number;
  patients: any[];
  searchTerm?: string;
}

const PatientDetail: FC<PatientDetailProps> = ({ patientId, patients, searchTerm }) => {
  // Pastikan ID pasien dalam format string yang konsisten
  const patientIdStr = patientId ? String(patientId) : '';
  const patientIdNumber = patientIdStr ? parseInt(patientIdStr, 10) : -1;
  
  // Temukan pasien dari array patients (cara tercepat)
  const selectedPatient = patients.find(p => 
    String(p.id) === patientIdStr || p.id === patientIdNumber
  );
  
  // Periksa apakah ini kasus khusus "Syaflina/Syafliana"
  const isSyaflinaCase = searchTerm?.toLowerCase().includes('syafl');
  const queenzkyPatient = isSyaflinaCase ? 
    patients.find(p => p.name && p.name.includes('Queenzky')) : null;
  const isQueenzkySelected = queenzkyPatient && String(queenzkyPatient.id) === patientIdStr;
  
  // Cek jika ada data pasien dari localStorage
  const getStoredPatient = () => {
    try {
      const storedData = localStorage.getItem(`patient_${patientIdNumber}`);
      if (storedData) {
        const parsed = JSON.parse(storedData);
        if (parsed && parsed.id) {
          return parsed;
        }
      }
      
      // Coba dari API cache
      const apiCache = localStorage.getItem(`temp_api_patient_${patientIdNumber}`);
      if (apiCache) {
        const parsed = JSON.parse(apiCache);
        if (parsed && parsed.id) {
          return parsed;
        }
      }
    } catch (err) {
      console.error("Error retrieving stored patient data:", err);
    }
    return null;
  };
  
  const storedPatient = getStoredPatient();
  const displayPatient = selectedPatient || storedPatient || null;
  
  // Jika ini kasus khusus Queenzky/Syafliana dan ID cocok
  if (isSyaflinaCase && isQueenzkySelected && queenzkyPatient) {
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
  
  // Tampilkan detail pasien jika ditemukan
  if (displayPatient) {
    return (
      <div className="space-y-1">
        <p className="font-medium">
          Pasien terpilih: {displayPatient.name}
        </p>
        <div className="grid grid-cols-2 gap-1">
          <p className="text-xs text-muted-foreground">ID Pasien:</p>
          <p className="text-xs">{displayPatient.patientId}</p>
          
          {displayPatient.phoneNumber && (
            <>
              <p className="text-xs text-muted-foreground">No. WhatsApp:</p>
              <p className="text-xs">{displayPatient.phoneNumber}</p>
            </>
          )}
        </div>
      </div>
    );
  }
  
  // Tampilkan pesan default jika tidak ditemukan
  return (
    <p className="text-sm text-amber-600">
      {isSyaflinaCase ? 
        "Silahkan pilih 'Queenzky Zahwa Aqeela'" : 
        "Menunggu data pasien..."}
    </p>
  );
};


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
  
  // Periksa apakah dropdown harus disembunyikan
  // 1. Periksa localStorage untuk flag yang disetel oleh slot-patients-dialog
  const [hidePatientDropdown, setHidePatientDropdown] = useState<boolean>(false);
  
  useEffect(() => {
    // Jika selectedPatientId sudah ada, maka itu berasal dari slot-patients-dialog, jadi sembunyikan dropdown
    const hasPreselectedPatient = selectedPatientId !== null && selectedPatientId !== undefined;
    // Periksa localStorage
    const hideFromStorage = localStorage.getItem('hidePatientDropdown') === 'true';
    // Periksa URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const hideFromUrl = urlParams.get('hideDropdown') === 'true';
    
    // Set state berdasarkan kondisi-kondisi di atas
    setHidePatientDropdown(hasPreselectedPatient || hideFromStorage || hideFromUrl);
    
    // Hapus flag dari localStorage untuk mencegah efek samping pada pemuatan halaman berikutnya
    if (hideFromStorage) {
      localStorage.removeItem('hidePatientDropdown');
    }
    
    console.log("TransactionForm - Should hide dropdown?", {
      hasPreselectedPatient,
      hideFromStorage,
      hideFromUrl,
      result: hasPreselectedPatient || hideFromStorage || hideFromUrl
    });
  }, [selectedPatientId]);

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

  // Effect to update form value for items when cart changes
  useEffect(() => {
    form.setValue(
      "items",
      cartItems.map((item) => ({
        id: item.id,
        type: item.type,
        quantity: item.quantity,
        price: item.price,
      }))
    );
  }, [cartItems, form]);

  // Effect to update paidAmount when cart or discount changes (if not using credit)
  useEffect(() => {
    if (!useCredit) {
      const subtotal = cartItems.reduce(
        (sum, item) => sum + parseFloat(item.price) * item.quantity,
        0
      );
      const discount = parseFloat(form.getValues().discount || "0");
      const totalAmount = Math.max(0, subtotal - discount);

      form.setValue("subtotal", subtotal.toString());
      form.setValue("totalAmount", totalAmount.toString());
      form.setValue("paidAmount", totalAmount.toString());
      form.setValue("creditAmount", "0");
    }
  }, [cartItems, form, useCredit]);

  // Create transaction mutation
  const createTransaction = useMutation({
    mutationFn: async (values: TransactionFormValues) => {
      console.log("Creating transaction with values:", values);
      
      // Get the patient data
      const patient = patients.find((p: Patient) => p.id === parseInt(form.getValues().patientId));
      if (!patient) throw new Error("Patient not found");
      
      // Get items details
      const itemsWithDetails = values.items.map(item => {
        // For packages
        if (item.type === "package") {
          // If using existing package (session), include the sessionId
          if (useExistingPackage && selectedSession) {
            return {
              ...item,
              sessionId: selectedSession.id,
              name: selectedSession.package?.name || "Paket Terapi",
              totalSessions: selectedSession.package?.sessions || 0,
              useExistingPackage: true
            };
          } else {
            // If not using existing package, get package details
            const pkg = packages.find((p: Package) => p.id === parseInt(String(item.id)));
            return {
              ...item,
              name: pkg?.name || "Paket Terapi", 
              totalSessions: pkg?.sessions || 0,
              useExistingPackage: false
            };
          }
        } 
        // For products
        else {
          const product = products?.find((p: Product) => p.id === item.id);
          return {
            ...item,
            name: product?.name || "Produk",
            stock: product?.stock || 0
          };
        }
      });
      
      // If paying debt, include debt payment info
      const debtPayment = payDebt && selectedDebtTransaction 
        ? {
            transactionId: selectedDebtTransaction.id,
            amount: paymentAmount,
            paymentMethod: values.paymentMethod,
            isPaidOff: parseFloat(paymentAmount) >= parseFloat(selectedDebtTransaction.debt_amount),
            notes: `Pembayaran utang transaksi #${selectedDebtTransaction.id}`
          }
        : null;
      
      const requestData = {
        ...values,
        items: itemsWithDetails,
        patientId: parseInt(values.patientId),
        isPaid: !useCredit, // If using credit, mark as unpaid
        debtPayment, // Include debt payment info if applicable
        // If this is a Syaflina/Queenzky case, include display name preference
        displayName: searchTerm?.toLowerCase().includes('syafl') 
          ? values.displayName || "original"
          : "original" 
      };
      
      console.log("Submitting transaction with data:", requestData);
      
      const response = await apiRequest("/api/transactions", {
        method: "POST",
        data: requestData,
      });
      
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/unpaid"] });
      toast({
        title: "Transaksi berhasil dibuat",
        description: `Transaksi #${data.id} telah dicatat.`,
      });
      
      // Show invoice if needed
      if (data) {
        setInvoiceData(data);
        setShowInvoice(true);
      } else {
        // If no need to show invoice, just close the form
        onClose();
      }
    },
    onError: (error) => {
      console.error("Error creating transaction:", error);
      toast({
        title: "Gagal membuat transaksi",
        description:
          "Terjadi kesalahan saat mencatat transaksi. Silakan coba lagi.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  // Transaction successful, show invoice or close
  const handleInvoiceClose = () => {
    setShowInvoice(false);
    onClose();
  };
  
  // Function to handle adding a package to cart
  const handleAddPackage = (packageId: string) => {
    // Only add if not already in cart
    if (cartItems.some((item) => item.id === parseInt(packageId) && item.type === "package")) {
      toast({
        title: "Paket sudah ditambahkan",
        description: "Paket ini sudah ada di keranjang.",
        variant: "destructive",
      });
      return;
    }
    
    // Find the package
    const pkg = packages.find((p: Package) => p.id === parseInt(packageId));
    if (!pkg) return;
    
    // Add to cart
    setCartItems([
      ...cartItems,
      {
        id: pkg.id,
        type: "package",
        name: pkg.name,
        price: pkg.price,
        quantity: 1,
      },
    ]);
    
    // Reset the select field
    setSelectedPackage("");
  };
  
  // Function to handle using a session from existing package
  const useSessionFromPackage = async (session: ActiveSession) => {
    if (!session) return;
    
    // Check if session has remaining sessions
    if (session.remainingSessions <= 0) {
      toast({
        title: "Tidak ada sesi tersisa",
        description: "Paket ini tidak memiliki sesi tersisa.",
        variant: "destructive",
      });
      return;
    }
    
    // Set selected session
    setSelectedSession(session);
    
    // Get package id
    const packageId = session.packageId?.toString();
    if (!packageId) return;
    
    // Find the package
    const pkg = packages.find((p: Package) => p.id === parseInt(packageId));
    if (!pkg) return;
    
    // Create cart item with zero price (since we're using existing package)
    const cartItem = {
      id: pkg.id,
      type: "package" as const,
      name: `${pkg.name} (Gunakan Sesi)`,
      price: "0", // No charge for using existing package
      quantity: 1,
    };
    
    // Update cart (replace any existing package items)
    const newCart = cartItems.filter(item => item.type !== "package");
    setCartItems([...newCart, cartItem]);
    
    // Provide feedback
    toast({
      title: "Menggunakan sesi dari paket",
      description: `Menggunakan 1 sesi dari paket ${pkg.name}. Tersisa ${session.remainingSessions - 1} sesi.`,
    });
  };
  
  // Function to handle product toggle (add/remove from cart)
  const handleProductToggle = (product: Product, isChecked: boolean) => {
    if (isChecked) {
      // Add product to cart if not already in cart
      if (!cartItems.some((item) => item.id === product.id && item.type === "product")) {
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
      }
    } else {
      // Remove product from cart
      setCartItems(
        cartItems.filter(
          (item) => !(item.id === product.id && item.type === "product")
        )
      );
    }
  };
  
  // Function to update product quantity
  const updateProductQuantity = (productId: number, newQuantity: number) => {
    // Update quantity in cartItems
    setCartItems(
      cartItems.map((item) =>
        item.id === productId && item.type === "product"
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  };
  
  // Function to remove item from cart
  const removeFromCart = (index: number) => {
    // Clear selected session if removing a package
    if (cartItems[index]?.type === "package") {
      setSelectedSession(null);
    }
    
    // Remove from cart
    const newCartItems = [...cartItems];
    newCartItems.splice(index, 1);
    setCartItems(newCartItems);
  };
  
  // Calculate subtotal
  const subtotal = cartItems.reduce(
    (sum, item) => sum + parseFloat(item.price) * item.quantity,
    0
  );
  
  // Handle form submission
  const onSubmit = async (values: TransactionFormValues) => {
    if (isSubmitting) return; // Prevent double submission
    
    // Start submission
    setIsSubmitting(true);
    
    try {
      // For debt-only payment, we don't need to validate cart items
      if (debtOnlyPayment) {
        if (!selectedDebtTransaction) {
          toast({
            title: "Transaksi utang belum dipilih",
            description: "Silakan pilih transaksi utang yang akan dibayar.",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
        
        if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
          toast({
            title: "Jumlah pembayaran tidak valid",
            description: "Silakan masukkan jumlah pembayaran yang valid.",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
        
        // Create debt payment
        const debtPaymentResponse = await apiRequest("/api/transactions/debt-payment", {
          method: "POST",
          data: {
            transactionId: selectedDebtTransaction.id,
            amount: paymentAmount,
            paymentMethod: values.paymentMethod,
            isPaidOff: parseFloat(paymentAmount) >= parseFloat(selectedDebtTransaction.debt_amount),
            notes: `Pembayaran utang transaksi #${selectedDebtTransaction.id}`
          },
        });
        
        // Handle success
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/transactions/unpaid"] });
        
        toast({
          title: "Pembayaran utang berhasil",
          description: `Pembayaran utang untuk transaksi #${selectedDebtTransaction.id} telah dicatat.`,
        });
        
        onClose();
        return;
      }
      
      // For package + product transactions, validate cart items
      if (cartItems.length === 0) {
        toast({
          title: "Keranjang kosong",
          description: "Silakan tambahkan minimal satu paket atau produk.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      
      // If also paying debt, validate debt payment
      if (payDebt && selectedDebtTransaction) {
        if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
          toast({
            title: "Jumlah pembayaran utang tidak valid",
            description: "Silakan masukkan jumlah pembayaran utang yang valid.",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
      }
      
      // Compile final form values
      const submissionData: TransactionFormValues = {
        ...values,
        items: cartItems.map((item) => ({
          id: item.id,
          type: item.type,
          quantity: item.quantity,
          price: item.price,
        })),
      };
      
      // Create final transaction
      await createTransaction.mutateAsync(submissionData);
    } catch (error) {
      console.error("Error creating transaction:", error);
      toast({
        title: "Gagal membuat transaksi",
        description:
          "Terjadi kesalahan saat mencatat transaksi. Silakan coba lagi.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };
  
  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Buat Transaksi Baru</DialogTitle>
          </DialogHeader>
          
          {/* Invoice display (after successful transaction) */}
          {showInvoice && invoiceData ? (
            <Invoice data={invoiceData} onClose={handleInvoiceClose} />
          ) : (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
                key={formKey} // Force re-render when the form key changes
              >
                {/* Patient selection - conditionally rendered based on hidePatientDropdown flag */}
                {hidePatientDropdown ? (
                  /* Jika dropdown disembunyikan, tampilkan hanya detail pasien yang sudah dipilih */
                  <FormField
                    control={form.control}
                    name="patientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pasien</FormLabel>
                        <FormControl>
                          <div className="space-y-2">
                            {/* Tampilkan detail pasien yang dipilih */}
                            <div className="text-sm p-2 border rounded-md bg-muted/40">
                              {/* Gunakan PatientDetail komponen terpisah */}
                              <PatientDetail 
                                patientId={field.value} 
                                patients={patients}
                              />
                            </div>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  /* Jika dropdown tidak disembunyikan, tampilkan pilihan pasien lengkap */
                  <FormField
                    control={form.control}
                    name="patientId"
                    render={({ field }) => {
                      // Tampilkan nilai patientId dari form untuk debugging
                      console.log("Rendering patient field. Current value:", field.value, "type:", typeof field.value);
                      
                      // Pastikan patientId dalam bentuk string untuk select component
                      // Sederhanakan dan buat konsisten konversi nilai ke string
                      const idAsString = field.value ? String(field.value) : '';
                      
                      // Log untuk debugging
                      console.log("Processed ID as string:", idAsString);
                      
                      return (
                        <FormItem>
                          <FormLabel>Pilih Pasien</FormLabel>
                          <FormControl>
                            <div className="space-y-2">
                              {/* List pasien dalam bentuk flat list dengan filter search input */}
                              <div className="relative space-y-2">
                                {/* Search input */}
                                <Input
                                  className="w-full"
                                  placeholder="Cari pasien berdasarkan nama atau ID..."
                                  value={searchTerm || ''}
                                  onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    if (e.target.value === '') {
                                      field.onChange('');
                                    }
                                  }}
                                />
                                
                                {/* Daftar pasien */}
                                <div className="mt-2 border rounded-md max-h-[250px] overflow-y-auto">
                                  {!patients || patients.length === 0 ? (
                                    <div className="p-3 text-center text-sm text-muted-foreground">
                                      Belum ada data pasien
                                    </div>
                                  ) : (
                                    <>
                                      {patients.filter(patient => {
                                        if (!searchTerm) return true;
                                        
                                        const search = searchTerm.toLowerCase();
                                        const name = (patient.name || '').toLowerCase();
                                        const id = (patient.patientId || '').toLowerCase();
                                        const phone = (patient.phoneNumber || '').toLowerCase();
                                        
                                        return name.includes(search) || 
                                               id.includes(search) || 
                                               phone.includes(search);
                                      }).map(patient => {
                                        const isSelected = field.value && String(field.value) === String(patient.id);
                                        const isQueenzky = patient.name && patient.name.includes('Queenzky');
                                        const isForwardedPatient = patient.name && patient.name.includes('(');
                                        
                                        return (
                                          <div
                                            key={patient.id}
                                            className={`flex items-center justify-between p-2 border-b cursor-pointer hover:bg-muted/50
                                              ${isSelected ? 'bg-primary/10 border-primary' : ''}
                                              ${isQueenzky ? 'border-l-4 border-l-amber-500' : 
                                                isForwardedPatient ? 'border-l-4 border-l-blue-500' : ''
                                              }
                                            `}
                                            onClick={() => {
                                              field.onChange(String(patient.id));
                                              console.log("Selected patient:", patient.name, "with ID:", patient.id);
                                            }}
                                          >
                                            <div>
                                              <div className="font-medium">
                                                {patient.name}
                                                {isQueenzky && searchTerm && searchTerm.toLowerCase().includes('syafl') && (
                                                  <span className="ml-2 text-xs text-amber-600">(Syaflina/Syafliana)</span>
                                                )}
                                              </div>
                                              <div className="text-xs text-muted-foreground">
                                                ID: {patient.patientId} - Tel: {patient.phoneNumber || 'N/A'}
                                              </div>
                                            </div>
                                            
                                            {isSelected && (
                                              <Badge variant="outline" className="bg-primary/20">
                                                Dipilih
                                              </Badge>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </>
                                  )}
                                </div>
                              </div>
                              
                              {/* Show selected patient info */}
                              {field.value && (
                                <div className="text-sm p-2 border rounded-md bg-muted/40">
                                  {/* Gunakan PatientDetail komponen terpisah untuk mencegah error */}
                                  <PatientDetail 
                                    patientId={field.value} 
                                    patients={patients}
                                    searchTerm={searchTerm}
                                  />
                                </div>
                              )}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                )}
                
                {/* Display unpaid transactions for the selected patient (if any) */}
                {form.watch("patientId") && unpaidTransactions && unpaidTransactions.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2 text-amber-600">
                      <AlertCircle className="h-4 w-4" />
                      Transaksi dengan utang tertunda
                    </h4>
                    
                    <div className="bg-amber-50 border border-amber-200 rounded-md p-3 space-y-3">
                      {unpaidTransactions.map((tx: any) => (
                        <div key={tx.id} className="flex items-center justify-between text-sm">
                          <div>
                            <span className="font-medium">Transaksi #{tx.id}</span>
                            <div className="text-xs text-muted-foreground">
                              {tx.created_at ? format(new Date(tx.created_at), 'dd MMM yyyy', { locale: id }) : 'Tanggal tidak tersedia'}
                            </div>
                            <div className="text-xs">
                              <span className="font-medium text-amber-600">
                                Utang: {formatPrice(tx.debt_amount)}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedDebtTransaction(tx);
                                setPayDebt(true);
                                setPaymentAmount(tx.debt_amount);
                              }}
                            >
                              Bayar sekarang
                            </Button>
                          </div>
                        </div>
                      ))}
                      
                      {/* Option to pay debt only */}
                      <div className="pt-2 border-t border-amber-200">
                        <Button
                          type="button"
                          variant={debtOnlyPayment ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setDebtOnlyPayment(!debtOnlyPayment);
                            if (!debtOnlyPayment) {
                              // Reset cart when switching to debt-only payment
                              setCartItems([]);
                              setSelectedPackage("");
                              setSelectedSession(null);
                              setUseExistingPackage(false);
                            }
                          }}
                          className={debtOnlyPayment ? "bg-amber-600 hover:bg-amber-700" : ""}
                        >
                          {debtOnlyPayment ? "✓ Mode bayar utang saja" : "Bayar utang saja"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Mode bayar utang */}
                {debtOnlyPayment && (
                  <div className="space-y-4 border rounded-md p-4 bg-muted/20">
                    <h2 className="text-lg font-semibold">Pembayaran Utang</h2>
                    
                    {/* Pilih transaksi yang akan dibayar */}
                    <div className="space-y-2">
                      <Label>Pilih Transaksi</Label>
                      <Select
                        onValueChange={(value) => {
                          const tx = unpaidTransactions.find((t: any) => t.id.toString() === value);
                          setSelectedDebtTransaction(tx);
                          setPaymentAmount(tx?.debt_amount || "0");
                        }}
                        value={selectedDebtTransaction?.id?.toString()}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Pilih transaksi yang akan dibayar" />
                        </SelectTrigger>
                        <SelectContent>
                          {unpaidTransactions.map((tx: any) => (
                            <SelectItem key={tx.id} value={tx.id.toString()}>
                              #{tx.id} - Utang: {formatPrice(tx.debt_amount)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Jumlah pembayaran */}
                    {selectedDebtTransaction && (
                      <div className="space-y-2">
                        <Label>Jumlah Pembayaran</Label>
                        <Input
                          type="number"
                          min="0"
                          max={selectedDebtTransaction.debt_amount}
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                        />
                        <div className="text-xs text-muted-foreground">
                          Total utang: {formatPrice(selectedDebtTransaction.debt_amount)}
                        </div>
                        {parseFloat(paymentAmount) >= parseFloat(selectedDebtTransaction.debt_amount) && (
                          <div className="text-xs text-green-600">Pembayaran penuh ✓</div>
                        )}
                      </div>
                    )}
                    
                    {/* Metode pembayaran utang */}
                    <FormField
                      control={form.control}
                      name="paymentMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Metode Pembayaran</FormLabel>
                          <FormControl>
                            <PaymentMethods field={field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
                
                {!debtOnlyPayment && (
                  <>
                    {/* Packages section */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
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
                        /* Use existing package UI */
                        <div className="space-y-3">
                          <div className="text-sm text-muted-foreground">
                            Pilih paket terapi aktif untuk digunakan sesinya:
                          </div>
                          
                          {activeSessions.length === 0 ? (
                            <div className="text-sm p-2 border rounded-md bg-muted/40">
                              Belum ada paket terapi aktif untuk pasien ini.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {activeSessions.map((session) => {
                                const isSelected = selectedSession?.id === session.id;
                                const isFromOtherPatient = !session.isDirectOwner;
                                
                                return (
                                  <div 
                                    key={session.id}
                                    className={`p-3 border rounded-md ${
                                      isSelected 
                                        ? 'border-primary bg-primary/5' 
                                        : session.remainingSessions > 0 
                                          ? 'hover:border-primary/50 cursor-pointer' 
                                          : 'opacity-50 cursor-not-allowed'
                                    } ${
                                      isFromOtherPatient ? 'border-l-4 border-l-blue-500' : ''
                                    }`}
                                    onClick={() => {
                                      if (session.remainingSessions > 0) {
                                        useSessionFromPackage(session);
                                      }
                                    }}
                                  >
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <h4 className="font-medium">{session.package?.name || 'Paket Terapi'}</h4>
                                        
                                        {isFromOtherPatient && session.owner && (
                                          <div className="text-xs text-blue-600 mb-1">
                                            Dibagikan dari: {session.owner.name} ({session.owner.patientId})
                                          </div>
                                        )}
                                        
                                        <div className="text-sm text-muted-foreground">
                                          <span className="font-medium">
                                            Sesi tersisa: {session.remainingSessions}/{session.totalSessions}
                                          </span>
                                        </div>
                                        
                                        <div className="mt-1">
                                          <Progress value={(session.remainingSessions / session.totalSessions) * 100} className="h-2" />
                                        </div>
                                      </div>
                                      
                                      <div>
                                        {isSelected ? (
                                          <Badge variant="default">Dipilih</Badge>
                                        ) : session.remainingSessions === 0 ? (
                                          <Badge variant="outline" className="text-muted-foreground">Habis</Badge>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Purchase new package UI */
                        <div className="grid grid-cols-1 gap-4">
                          <div className="flex gap-2">
                            <Select
                              value={selectedPackage}
                              onValueChange={setSelectedPackage}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Pilih paket terapi..." />
                              </SelectTrigger>
                              <SelectContent>
                                {packages.map((pkg: Package) => (
                                  <SelectItem 
                                    key={pkg.id} 
                                    value={String(pkg.id)}
                                  >
                                    {pkg.name} - {formatPrice(pkg.price)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleAddPackage(selectedPackage)}
                              disabled={!selectedPackage}
                            >
                              Tambah
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Products section */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium">Produk</h4>
                      
                      <div className="space-y-2">
                        {products && products.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {products?.map((product: Product) => {
                              const isInCart = cartItems.some(
                                (item) => item.id === product.id && item.type === "product"
                              );
                              
                              return (
                                <div key={product.id} className="flex gap-2 items-center">
                                  <Checkbox
                                    id={`product-${product.id}`}
                                    checked={isInCart}
                                    onCheckedChange={(checked) =>
                                      handleProductToggle(product, !!checked)
                                    }
                                    disabled={product.stock <= 0}
                                  />
                                  <Label
                                    htmlFor={`product-${product.id}`}
                                    className={`flex-1 ${
                                      product.stock <= 0 ? "text-muted-foreground" : ""
                                    }`}
                                  >
                                    <div>{product.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {formatPrice(product.price)} - Stok: {product.stock}
                                    </div>
                                  </Label>
                                  
                                  {isInCart && (
                                    <Input 
                                      type="number" 
                                      min="1" 
                                      max={product.stock}
                                      value={cartItems.find(
                                        (item) => item.id === product.id && item.type === "product"
                                      )?.quantity || 1}
                                      onChange={(e) => 
                                        updateProductQuantity(
                                          product.id, 
                                          parseInt(e.target.value) || 1
                                        )
                                      }
                                      className="w-16 h-8 text-xs"
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            Belum ada produk tersedia.
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Cart section */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium">Keranjang</h4>
                      
                      {cartItems.length === 0 ? (
                        <div className="text-sm p-2 border rounded-md bg-muted/40">
                          Belum ada item di keranjang.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="border rounded-md overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/50">
                                <tr>
                                  <th className="text-left p-2">Item</th>
                                  <th className="text-right p-2">Jumlah</th>
                                  <th className="text-right p-2">Harga</th>
                                  <th className="text-right p-2">Subtotal</th>
                                  <th className="p-2 w-10"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {cartItems.map((item, index) => (
                                  <tr key={`${item.type}-${item.id}`} className="border-t">
                                    <td className="p-2">
                                      <div className="font-medium">{item.name}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {item.type === "package" ? "Paket Terapi" : "Produk"}
                                      </div>
                                    </td>
                                    <td className="p-2 text-right">{item.quantity}</td>
                                    <td className="p-2 text-right">{formatPrice(item.price)}</td>
                                    <td className="p-2 text-right">
                                      {formatPrice(
                                        (parseFloat(item.price) * item.quantity).toString()
                                      )}
                                    </td>
                                    <td className="p-2 text-center">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => removeFromCart(index)}
                                      >
                                        &times;
                                      </Button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot className="bg-muted/30">
                                <tr className="border-t">
                                  <td colSpan={3} className="p-2 text-right font-medium">
                                    Subtotal
                                  </td>
                                  <td className="p-2 text-right font-medium">
                                    {formatPrice(subtotal.toString())}
                                  </td>
                                  <td></td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                          
                          {/* Discount */}
                          <div className="flex gap-2 items-center">
                            <FormField
                              control={form.control}
                              name="discount"
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <div className="flex gap-2 items-center">
                                    <FormLabel className="min-w-[80px]">Diskon</FormLabel>
                                    <FormControl>
                                      <Input
                                        {...field}
                                        type="number"
                                        min="0"
                                        max={subtotal}
                                        onChange={(e) => {
                                          field.onChange(e);
                                          // Update paidAmount
                                          if (!useCredit) {
                                            const discount = parseFloat(e.target.value) || 0;
                                            const totalAmount = Math.max(0, subtotal - discount);
                                            form.setValue("paidAmount", totalAmount.toString());
                                          }
                                        }}
                                      />
                                    </FormControl>
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          
                          {/* Total and Payment */}
                          <div className="border-t pt-2 space-y-2">
                            <div className="flex justify-between">
                              <span className="font-medium">Total</span>
                              <span className="font-medium">
                                {formatPrice(
                                  Math.max(
                                    0,
                                    subtotal - parseFloat(form.watch("discount") || "0")
                                  ).toString()
                                )}
                              </span>
                            </div>
                            
                            {/* Credit option (utang) */}
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id="use-credit"
                                checked={useCredit}
                                onCheckedChange={setUseCredit}
                              />
                              <Label htmlFor="use-credit">Bayar dengan utang</Label>
                            </div>
                            
                            {useCredit && (
                              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 space-y-2">
                                <div className="text-sm font-medium text-amber-800">
                                  Pembayaran dengan utang
                                </div>
                                <div className="text-xs text-amber-700">
                                  Transaksi ini akan tercatat sebagai belum lunas, dan pasien memiliki utang.
                                </div>
                                <FormField
                                  control={form.control}
                                  name="creditAmount"
                                  render={({ field }) => (
                                    <FormItem>
                                      <div className="flex gap-2 items-center">
                                        <FormLabel className="min-w-[140px] text-xs">
                                          Jumlah Utang
                                        </FormLabel>
                                        <FormControl>
                                          <Input
                                            {...field}
                                            type="number"
                                            min="0"
                                            className="text-amber-800 bg-amber-50 border-amber-300"
                                          />
                                        </FormControl>
                                      </div>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                
                                <FormField
                                  control={form.control}
                                  name="paidAmount"
                                  render={({ field }) => (
                                    <FormItem>
                                      <div className="flex gap-2 items-center">
                                        <FormLabel className="min-w-[140px] text-xs">
                                          Jumlah Bayar Sekarang
                                        </FormLabel>
                                        <FormControl>
                                          <Input
                                            {...field}
                                            type="number"
                                            min="0"
                                          />
                                        </FormControl>
                                      </div>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            )}
                            
                            {/* Pay debt with this transaction */}
                            {unpaidTransactions && unpaidTransactions.length > 0 && (
                              <div className="flex items-center gap-2 pt-2">
                                <Checkbox
                                  id="pay-debt"
                                  checked={payDebt}
                                  onCheckedChange={setPayDebt}
                                />
                                <Label htmlFor="pay-debt">Bayar utang sekaligus</Label>
                              </div>
                            )}
                            
                            {payDebt && (
                              <div className="bg-green-50 border border-green-200 rounded-md p-3 space-y-3">
                                <div className="text-sm font-medium text-green-800">
                                  Pembayaran utang sekaligus
                                </div>
                                
                                {/* Pilih transaksi yang akan dibayar */}
                                <div className="space-y-2">
                                  <Label className="text-xs">Pilih Transaksi</Label>
                                  <Select
                                    onValueChange={(value) => {
                                      const tx = unpaidTransactions.find((t: any) => t.id.toString() === value);
                                      setSelectedDebtTransaction(tx);
                                      setPaymentAmount(tx?.debt_amount || "0");
                                    }}
                                    value={selectedDebtTransaction?.id?.toString()}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder="Pilih transaksi yang akan dibayar" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {unpaidTransactions.map((tx: any) => (
                                        <SelectItem key={tx.id} value={tx.id.toString()}>
                                          #{tx.id} - Utang: {formatPrice(tx.debt_amount)}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                {/* Jumlah pembayaran */}
                                {selectedDebtTransaction && (
                                  <div className="space-y-2">
                                    <Label className="text-xs">Jumlah Pembayaran</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      max={selectedDebtTransaction.debt_amount}
                                      value={paymentAmount}
                                      onChange={(e) => setPaymentAmount(e.target.value)}
                                    />
                                    <div className="text-xs text-muted-foreground">
                                      Total utang: {formatPrice(selectedDebtTransaction.debt_amount)}
                                    </div>
                                    {parseFloat(paymentAmount) >= parseFloat(selectedDebtTransaction.debt_amount) && (
                                      <div className="text-xs text-green-600">Pembayaran penuh ✓</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
                
                {/* Payment method */}
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Metode Pembayaran</FormLabel>
                      <FormControl>
                        <PaymentMethods field={field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Display name preference (only for Syaflina/Syafliana case) */}
                {form.watch("patientId") && searchTerm?.toLowerCase().includes('syafl') && (
                  <FormField
                    control={form.control}
                    name="displayName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tampilkan Sebagai</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            value={field.value}
                            className="flex flex-col space-y-1"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="original" id="name-original" />
                              <Label htmlFor="name-original">Queenzky Zahwa Aqeela (Asli)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="alternative" id="name-alternative" />
                              <Label htmlFor="name-alternative">Syaflina/Syafliana (Alternatif)</Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                <DialogFooter>
                  <Button variant="outline" type="button" onClick={onClose}>
                    Batal
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isSubmitting || (
                      !debtOnlyPayment && cartItems.length === 0
                    )}
                  >
                    {isSubmitting ? "Memproses..." : "Simpan Transaksi"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}