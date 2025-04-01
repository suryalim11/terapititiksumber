import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

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
import PaymentMethods from "./payment-methods";
import Invoice from "./invoice";

type TransactionFormProps = {
  isOpen: boolean;
  onClose: () => void;
};

type Patient = {
  id: number;
  patientId: string;
  name: string;
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

export default function TransactionForm({ isOpen, onClose }: TransactionFormProps) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string>("");
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const { toast } = useToast();

  // Fetch patients
  const { data: patients } = useQuery({
    queryKey: ["/api/patients"],
  });

  // Fetch packages
  const { data: packages } = useQuery({
    queryKey: ["/api/packages"],
  });

  // Fetch products
  const { data: products } = useQuery({
    queryKey: ["/api/products"],
  });

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      patientId: "",
      paymentMethod: "cash",
      items: [],
    },
  });

  // Reset cart when form is closed
  useEffect(() => {
    if (!isOpen) {
      setCartItems([]);
      setSelectedPackage("");
      form.reset();
    }
  }, [isOpen, form]);

  // Create transaction mutation
  const mutation = useMutation({
    mutationFn: async (values: TransactionFormValues) => {
      // Calculate total amount
      const totalAmount = cartItems.reduce(
        (sum, item) => sum + parseFloat(item.price) * item.quantity,
        0
      );

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

      return response.json();
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/activities"] });

      // Prepare invoice data
      const patient = patients?.find((p: Patient) => p.id === parseInt(form.getValues().patientId));
      
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
    onError: (error) => {
      toast({
        title: "Gagal membuat transaksi",
        description: error.message || "Terjadi kesalahan saat memproses transaksi",
        variant: "destructive",
      });
    }
  });

  // Add package to cart
  const handlePackageSelect = (packageId: string) => {
    if (!packageId) return;

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

    const newCartItem = {
      id: pkg.id,
      type: "package" as const,
      name: pkg.name,
      price: pkg.price,
      quantity: 1,
    };
    
    console.log("Adding to cart:", newCartItem);
    
    setCartItems([
      ...cartItems,
      newCartItem,
    ]);
    
    // Setelah menambahkan ke keranjang, kita reset pilihan paket
    // untuk memungkinkan pemilihan paket lain
    setTimeout(() => {
      setSelectedPackage("");
    }, 500);
  };

  // Add/remove product from cart
  const handleProductToggle = (product: Product, isChecked: boolean) => {
    if (isChecked) {
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
    // Prepare items data
    values.items = cartItems.map(item => ({
      id: item.id,
      type: item.type,
      quantity: item.quantity,
    }));

    mutation.mutate(values);
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold font-heading">Buat Transaksi Baru</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Patient Selection */}
            <FormField
              control={form.control}
              name="patientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pilih Pasien</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih pasien..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {patients?.map((patient: Patient) => (
                        <SelectItem key={patient.id} value={patient.id.toString()}>
                          {patient.name} (ID: {patient.patientId})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Package Selection */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Paket Terapi</h4>
              <div className="space-y-4">
                <Select
                  value={selectedPackage}
                  onValueChange={handlePackageSelect}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih paket terapi..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {packages?.map((pkg: Package) => (
                      <SelectItem key={pkg.id} value={pkg.id.toString()}>
                        {pkg.name} ({formatPrice(pkg.price)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                type="submit"
                disabled={mutation.isPending || cartItems.length === 0}
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
