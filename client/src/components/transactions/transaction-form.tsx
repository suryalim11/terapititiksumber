import { useState, useEffect } from "react";
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
import { Search, Info, AlertCircle, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";

import PaymentMethods from "./payment-methods";
import Invoice from "./invoice";

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
  items: z.array(
    z.object({
      id: z.number(),
      type: z.enum(["package", "product"]),
      quantity: z.number().min(1),
    })
  ).min(1, "Pilih minimal satu paket atau produk"),
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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      patientId: "",
      paymentMethod: "cash",
      discount: "0",
      items: [],
    },
  });

  // Fetch patients
  const { data: patients = [] } = useQuery<Patient[]>({
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

  // Fetch active sessions for a patient
  const { data: activeSessions = [], refetch: refetchActiveSessions } = useQuery<ActiveSession[]>({
    queryKey: ["/api/sessions", form.watch("patientId"), "active"],
    queryFn: async () => {
      const patientId = form.watch("patientId");
      if (!patientId) return [];
      
      const response = await fetch(`/api/sessions?patientId=${patientId}&active=true`);
      if (!response.ok) throw new Error("Failed to fetch active sessions");
      
      const data = await response.json();
      console.log("Active sessions data:", data);
      return data;
    },
    enabled: !!form.watch("patientId"), // hanya jalankan jika patientId ada
  });

  // Reset cart when form is closed or opened
  useEffect(() => {
    if (!isOpen) {
      // Reset form when closed
      setCartItems([]);
      setSelectedPackage("");
      setSelectedSession(null);
      setUseExistingPackage(false);
      setFormKey(Date.now()); // Force a complete re-render on close
      form.reset();
    } else if (isOpen && form.watch("patientId")) {
      // Refresh data when form is opened and patient is selected
      refetchActiveSessions();
    }
  }, [isOpen, form, refetchActiveSessions]);
  
  // Atur pasien otomatis jika selectedPatientId diberikan
  useEffect(() => {
    if (isOpen && selectedPatientId !== null && selectedPatientId !== undefined && patients.length > 0) {
      console.log("TransactionForm - selectedPatientId:", selectedPatientId, "type:", typeof selectedPatientId);
      
      // Temukan pasien berdasarkan ID
      let patientIdToSearch: number;
      
      // Pastikan selectedPatientId adalah number
      if (typeof selectedPatientId === 'string') {
        patientIdToSearch = parseInt(selectedPatientId);
      } else {
        patientIdToSearch = selectedPatientId;
      }
      
      const patient = patients.find((p: Patient) => p.id === patientIdToSearch);
      
      if (patient) {
        console.log("Found patient:", patient);
        
        // Set nilai pada form
        form.setValue("patientId", patientIdToSearch.toString());
        console.log("Patient auto-selected:", patient.name);
        
        // Auto refetch active sessions untuk pasien yang dipilih
        refetchActiveSessions();
        
        // Tampilkan toast notifikasi
        toast({
          title: "Pasien terpilih",
          description: `Data ${patient.name} telah diisi otomatis`,
        });
      } else {
        console.log("Patient not found with ID:", patientIdToSearch);
        console.log("Available patients:", patients);
        
        toast({
          title: "Perhatian",
          description: `Pasien dengan ID ${patientIdToSearch} tidak ditemukan`,
          variant: "destructive"
        });
      }
    }
  }, [isOpen, selectedPatientId, patients, form, refetchActiveSessions, toast]);

  // Create transaction mutation
  const mutation = useMutation({
    mutationFn: async (values: TransactionFormValues) => {
      // Calculate subtotal
      const subtotal = cartItems.reduce(
        (sum, item) => sum + parseFloat(item.price) * item.quantity,
        0
      );
      
      // Get discount amount
      const discount = parseFloat(values.discount || "0");
      
      // Calculate total amount (subtotal - discount)
      const totalAmount = Math.max(0, subtotal - discount);

      try {
        // Use already calculated values
        const discountAmount = parseFloat(values.discount || "0");
        
        console.log("Mengirim request ke API dengan data:", {
          patientId: parseInt(values.patientId),
          totalAmount: totalAmount.toString(),
          paymentMethod: values.paymentMethod,
          discount: discountAmount.toString(),
          subtotal: subtotal.toString(),
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
      const discountAmount = parseInt(form.getValues().discount || "0");
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

  // Calculate total amount with discount
  const calculateTotal = () => {
    // Calculate subtotal
    const subtotal = cartItems.reduce(
      (sum, item) => sum + parseFloat(item.price) * item.quantity,
      0
    );
    
    // Apply discount
    const discountAmount = parseInt(form.watch("discount") || "0");
    const discountedTotal = Math.max(0, subtotal - discountAmount);
    
    return discountedTotal;
  };

  // Format price
  const formatPrice = (price: string) => {
    return `Rp${parseInt(price).toLocaleString('id-ID')}`;
  };

  // Handle form submission
  const onSubmit = (values: TransactionFormValues) => {
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
    
    // Jika dalam mode 'Gunakan sesi' kita skip validasi keranjang kosong
    if (!useExistingPackage && cartItems.length === 0) {
      console.log("Validasi gagal: keranjang kosong");
      toast({
        title: "Gagal memproses pembayaran",
        description: "Silakan pilih minimal satu paket atau produk",
        variant: "destructive",
      });
      return;
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
    
    // Prepare items data
    values.items = cartItems.map(item => ({
      id: item.id,
      type: item.type,
      quantity: item.quantity,
    }));
    
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
      const submissionData: TransactionFormValues = {
        patientId: formValues.patientId || "",
        paymentMethod: formValues.paymentMethod,
        items: cartItems.map(item => ({
          id: item.id,
          type: item.type,
          quantity: item.quantity,
        })),
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
              render={({ field }) => (
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
                            const searchTerm = e.currentTarget.value.toLowerCase();
                            
                            // Find matching patient
                            const matchingPatient = patients.find((patient: Patient) => 
                              patient.name.toLowerCase().includes(searchTerm) || 
                              patient.patientId.toLowerCase().includes(searchTerm)
                            );
                            
                            // Auto-select if we have a match
                            if (matchingPatient && searchTerm.length > 2) {
                              field.onChange(matchingPatient.id.toString());
                              console.log("Auto-selected patient:", matchingPatient.name);
                            }
                          }}
                        />
                      </div>
                      
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
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
                          ) : (
                            patients?.map((patient: Patient) => (
                              <SelectItem 
                                key={patient.id} 
                                value={patient.id.toString()}
                                className="cursor-pointer hover:bg-primary/10"
                              >
                                <span className="font-medium">{patient.name}</span>
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
                            const selectedPatient = patients.find((p: Patient) => p.id.toString() === field.value);
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
                                </div>
                              </div>
                            ) : null;
                          })()}
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
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
                    {/* Only show multi-session packages that have remaining sessions */}
                    {activeSessions
                      .filter(session => 
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
                      )
                      .map(session => (
                      <AccordionItem value={`session-${session.id}`} key={session.id}>
                        <AccordionTrigger className="py-2 text-sm hover:no-underline">
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              <span>{session.package?.name}</span>
                              <Badge variant={session.remainingSessions > 1 ? 'default' : 'destructive'} className="ml-2">
                                {session.remainingSessions} sesi tersisa
                              </Badge>
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
                        const value = Math.max(0, parseInt(e.target.value) || 0);
                        field.onChange(value.toString());
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Transaction Summary */}
            {cartItems.length > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Ringkasan Transaksi</h4>
                <div className="space-y-2 text-sm">
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
                  {parseInt(form.watch("discount") || "0") > 0 && (
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
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={mutation.isPending}
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={handleSubmitForm}
                disabled={mutation.isPending || (!useExistingPackage && cartItems.length === 0)}
              >
                {mutation.isPending ? "Memproses..." : "Proses Pembayaran"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
