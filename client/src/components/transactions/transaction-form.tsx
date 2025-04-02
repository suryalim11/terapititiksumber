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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      patientId: "",
      paymentMethod: "cash",
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

  // Reset cart when form is closed
  useEffect(() => {
    if (!isOpen) {
      setCartItems([]);
      setSelectedPackage("");
      form.reset();
    }
  }, [isOpen, form]);
  
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
      // Calculate total amount
      const totalAmount = cartItems.reduce(
        (sum, item) => sum + parseFloat(item.price) * item.quantity,
        0
      );

      try {
        console.log("Mengirim request ke API dengan data:", {
          patientId: parseInt(values.patientId),
          totalAmount: totalAmount.toString(),
          paymentMethod: values.paymentMethod,
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
      
      setInvoiceData({
        transaction: data,
        patient,
        items: cartItems,
        paymentMethod: form.getValues().paymentMethod,
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

    // Log untuk debugging
    console.log("Package selected with ID:", packageId);
    
    // Simpan nilai packageId yang dipilih
    setSelectedPackage(packageId);

    const pkg = packages?.find((p: Package) => p.id === parseInt(packageId));
    if (!pkg) {
      console.log("Package not found for ID:", packageId);
      return;
    }

    console.log("Found package:", pkg);

    // Check if package already in cart
    const existingPackageIndex = cartItems.findIndex(
      item => item.type === "package" && item.id === pkg.id
    );

    if (existingPackageIndex >= 0) {
      toast({
        title: "Paket sudah dipilih",
        description: "Paket terapi sudah ada dalam transaksi",
        variant: "destructive",
      });
      return;
    }

    // Cek apakah sudah ada paket lain di keranjang
    const existingPackage = cartItems.find(item => item.type === "package");
    if (existingPackage) {
      // Konfirmasi penggantian paket
      if (confirm(`Paket ${existingPackage.name} sudah dipilih. Ganti dengan ${pkg.name}?`)) {
        // Hapus paket yang ada
        setCartItems(cartItems.filter(item => item.type !== "package"));
      } else {
        // Batal pilih paket baru
        setSelectedPackage("");
        return;
      }
    }

    const newCartItem = {
      id: pkg.id,
      type: "package" as const,
      name: pkg.name,
      price: pkg.price,
      quantity: 1,
    };
    
    console.log("Adding to cart:", newCartItem);
    
    setCartItems([
      ...cartItems.filter(item => item.type !== "package"),
      newCartItem,
    ]);
    
    // Notifikasi berhasil ditambahkan
    toast({
      title: "Paket terapi ditambahkan",
      description: `${pkg.name} telah ditambahkan ke transaksi`,
    });
    
    // Setelah menambahkan ke keranjang, kita reset pilihan paket
    // untuk memungkinkan pemilihan paket lain
    setTimeout(() => {
      setSelectedPackage("");
    }, 500);
  };

  // Add/remove product from cart
  const handleProductToggle = (product: Product, isChecked: boolean) => {
    if (isChecked) {
      // Validasi stok produk
      if (product.stock <= 0) {
        toast({
          title: "Stok tidak tersedia",
          description: `Produk ${product.name} sedang habis stok`,
          variant: "destructive",
        });
        return;
      }
      
      // Add product to cart
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
    } else {
      // Remove product from cart
      setCartItems(
        cartItems.filter(item => !(item.type === "product" && item.id === product.id))
      );
    }
  };

  // Update product quantity
  const updateProductQuantity = (productId: number, newQuantity: number) => {
    if (newQuantity < 1) return;
    
    const product = products?.find((p: Product) => p.id === productId);
    if (!product) return;
    
    if (newQuantity > product.stock) {
      toast({
        title: "Stok tidak cukup",
        description: `Stok ${product.name} hanya tersisa ${product.stock}`,
        variant: "destructive",
      });
      return;
    }

    setCartItems(
      cartItems.map(item =>
        item.type === "product" && item.id === productId
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  };

  // Calculate total amount
  const calculateTotal = () => {
    return cartItems.reduce(
      (sum, item) => sum + parseFloat(item.price) * item.quantity,
      0
    );
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
  
  // Handler untuk submit form secara manual
  const handleSubmitForm = async () => {
    console.log("Manual submit triggered");
    const formValues = form.getValues();
    console.log("Form values:", formValues);
    
    // Handle using session from package if selectedSession exists
    if (useExistingPackage && selectedSession) {
      // Confirm before proceeding
      if (!confirm(`Konfirmasi penggunaan satu sesi dari paket ${selectedSession.package?.name}?`)) {
        return; // User canceled
      }
      
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
        
        // Buat transaksi dengan total 0 untuk mencatat penggunaan sesi
        const transactionData = {
          patientId: parseInt(formValues.patientId),
          totalAmount: "0",
          paymentMethod: formValues.paymentMethod || "cash",
          items: [{
            id: selectedSession.packageId,
            type: "package",
            quantity: 1,
            description: "(menggunakan sisa paket)"
          }],
          notes: `Penggunaan sesi paket: ${selectedSession.package?.name}. Sesi ke-${newSessionsUsed} dari ${selectedSession.totalSessions}.`
        };
        
        // Simpan transaksi dengan nilai 0
        const transactionResponse = await fetch('/api/transactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(transactionData),
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
        return; // Stop execution on error
      }
    }
    
    // Proceed with normal transaction if we're not using session from package
    // Siapkan data
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
  };

  if (showInvoice && invoiceData) {
    return (
      <Invoice
        isOpen={showInvoice}
        onClose={() => {
          setShowInvoice(false);
          onClose();
        }}
        data={invoiceData}
      />
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold font-heading">Buat Transaksi Baru</DialogTitle>
        </DialogHeader>

        <Form {...form}>
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
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Pilih pasien dari daftar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {patients?.length === 0 ? (
                            <div className="px-2 py-4 text-center text-sm">
                              Belum ada data pasien
                            </div>
                          ) : (
                            patients?.map((patient: Patient) => (
                              <SelectItem 
                                key={patient.id} 
                                value={patient.id.toString()}
                              >
                                {patient.name} (ID: {patient.patientId})
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
                      .filter(session => session.package && session.package.sessions > 1 && session.remainingSessions > 0)
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
                      Pasien memiliki {activeSessions.filter(session => session.package && session.package.sessions > 1 && session.remainingSessions > 0).length} paket terapi 12 sesi aktif. 
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
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih paket terapi..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent position="popper" className="z-50 w-[200px]">
                    {packages?.map((pkg: Package) => (
                      <SelectItem key={pkg.id} value={pkg.id.toString()}>
                        {pkg.name} ({formatPrice(pkg.price)})
                      </SelectItem>
                    ))}
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
