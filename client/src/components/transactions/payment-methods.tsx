import { cn } from "@/lib/utils";
import { ControllerRenderProps } from "react-hook-form";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

type PaymentMethodsProps = {
  field: ControllerRenderProps<any, "paymentMethod">;
  error?: boolean;
  totalAmount?: number;
};

type PaymentMethod = {
  id: string;
  name: string;
  icon: React.ReactNode;
};

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function PaymentMethods({ field, error, totalAmount = 0 }: PaymentMethodsProps) {
  const { value, onChange } = field;

  const paymentMethods: PaymentMethod[] = [
    {
      id: "bank_transfer",
      name: "Transfer Bank",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
    },
    {
      id: "qris",
      name: "QRIS",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
        </svg>
      ),
    },
    {
      id: "cash",
      name: "Tunai",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex space-x-3">
        {paymentMethods.map((method) => (
          <div
            key={method.id}
            className={cn(
              "flex-1 border rounded-lg p-3 text-center flex flex-col items-center justify-center cursor-pointer transition-colors",
              value === method.id
                ? "border-primary bg-primary/10 dark:bg-primary/20"
                : error && !value
                  ? "border-destructive"
                  : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
            )}
            onClick={() => onChange(method.id)}
          >
            {method.icon}
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{method.name}</span>
          </div>
        ))}
      </div>

      {value === "qris" && (
        <div className="border-2 border-primary rounded-xl p-4 bg-white dark:bg-gray-900 text-center space-y-3 shadow-sm">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              Total yang harus dibayar
            </p>
            <p className="text-3xl font-bold text-primary tabular-nums">
              {formatRupiah(totalAmount)}
            </p>
          </div>

          <div className="flex justify-center">
            <div className="relative">
              <img
                src="/qris.png"
                alt="QRIS Terapi Titik Sumber"
                className="w-56 h-56 object-contain rounded-lg border border-gray-200"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = "none";
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = "flex";
                }}
              />
              <div
                className="w-56 h-56 border-2 border-dashed border-gray-300 rounded-lg items-center justify-center flex-col text-muted-foreground text-sm gap-2"
                style={{ display: "none" }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                <span className="text-center px-4">Tambahkan file qris.png ke folder client/public/</span>
              </div>
            </div>
          </div>

          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">TERAPI TITIK SUMBER</p>
            <p className="text-xs text-muted-foreground">NMID: ID1026502478542</p>
          </div>

          <div className="bg-green-50 dark:bg-green-950 rounded-lg p-3 flex items-start gap-2 text-left">
            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
            <p className="text-xs text-green-700 dark:text-green-400">
              Tunjukkan QR ini ke pasien. Masukkan nominal <strong>{formatRupiah(totalAmount)}</strong> saat membayar, lalu konfirmasi setelah pembayaran berhasil.
            </p>
          </div>
        </div>
      )}

      {error && !value && (
        <div className="text-sm text-destructive flex items-center gap-1">
          <AlertTriangle className="h-4 w-4" />
          <span>Pilih metode pembayaran</span>
        </div>
      )}
    </div>
  );
}
