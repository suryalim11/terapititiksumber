import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// UI components
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const formSchema = z.object({
  amount: z.string().min(1, "Masukkan jumlah pembayaran"),
  paymentMethod: z.enum(["cash", "bank_transfer", "qris"], {
    required_error: "Pilih metode pembayaran",
  }),
  notes: z.string().optional(),
});

export default function CreditPaymentForm({
  isOpen,
  onClose,
  transaction,
  onSuccess,
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate remaining debt
  const remainingDebt = transaction
    ? parseFloat(transaction.totalAmount) - parseFloat(transaction.paidAmount)
    : 0;

  // Form setup
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: remainingDebt.toString(),
      paymentMethod: "cash",
      notes: "",
    },
  });

  // Reset form when transaction changes
  useEffect(() => {
    if (transaction) {
      const debt = parseFloat(transaction.totalAmount) - parseFloat(transaction.paidAmount);
      form.setValue("amount", debt.toString());
    }
  }, [transaction, form]);

  // Payment mutation
  const mutation = useMutation({
    mutationFn: async (values) => {
      return await apiRequest(`/api/transactions/debt-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transactionId: transaction.id,
          amount: values.amount,
          paymentMethod: values.paymentMethod,
          isPaidOff: parseFloat(values.amount) >= remainingDebt,
          notes: values.notes || "Pembayaran hutang",
        }),
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Pembayaran berhasil",
        description: `Pembayaran sebesar ${formatCurrency(form.getValues().amount)} telah berhasil dicatat.`,
      });
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/unpaid"] });
      
      // Close dialog and run success callback
      onClose();
      if (onSuccess) {
        onSuccess(data);
      }
    },
    onError: (error) => {
      console.error("Error processing payment:", error);
      toast({
        title: "Gagal memproses pembayaran",
        description: error.message || "Terjadi kesalahan saat memproses pembayaran",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  // Handle form submission
  const onSubmit = async (values) => {
    // Validate payment amount
    const paymentAmount = parseFloat(values.amount);
    
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      toast({
        title: "Jumlah tidak valid",
        description: "Masukkan jumlah pembayaran yang valid",
        variant: "destructive",
      });
      return;
    }
    
    if (paymentAmount > remainingDebt) {
      toast({
        title: "Jumlah melebihi hutang",
        description: `Jumlah pembayaran melebihi sisa hutang (${formatCurrency(remainingDebt)})`,
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    mutation.mutate(values);
  };

  if (!transaction) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Pembayaran Hutang</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <div className="bg-muted/40 p-3 rounded-md space-y-2 text-sm border">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ID Transaksi</span>
                  <span className="font-medium">{transaction.transactionId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tanggal</span>
                  <span className="font-medium">
                    {new Date(transaction.createdAt).toLocaleDateString("id-ID")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-medium">
                    {formatCurrency(transaction.totalAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sudah Dibayar</span>
                  <span className="font-medium">
                    {formatCurrency(transaction.paidAmount)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t font-medium text-amber-600 dark:text-amber-500">
                  <span>Sisa Hutang</span>
                  <span>{formatCurrency(remainingDebt)}</span>
                </div>
              </div>

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jumlah Pembayaran (Rp)</FormLabel>
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
                          
                          // Don't exceed remaining debt
                          const validValue = Math.min(value, remainingDebt);
                          field.onChange(validValue.toString());
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Metode Pembayaran</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-1"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="cash" id="cash" />
                          <Label htmlFor="cash">Tunai</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="bank_transfer" id="bank_transfer" />
                          <Label htmlFor="bank_transfer">Transfer Bank</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="qris" id="qris" />
                          <Label htmlFor="qris">QRIS</Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Catatan (Opsional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Catatan pembayaran" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Memproses..." : "Bayar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}