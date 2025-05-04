import { cn } from "@/lib/utils";
import { ControllerRenderProps } from "react-hook-form";
import { AlertTriangle } from "lucide-react";

type PaymentMethodsProps = {
  field: ControllerRenderProps<any, "paymentMethod">;
  error?: boolean; // Add error prop to show validation error
};

type PaymentMethod = {
  id: string;
  name: string;
  icon: React.ReactNode;
};

export default function PaymentMethods({ field, error }: PaymentMethodsProps) {
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
    <div className="space-y-2">
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
      
      {/* Error message */}
      {error && !value && (
        <div className="text-sm text-destructive flex items-center gap-1">
          <AlertTriangle className="h-4 w-4" />
          <span>Pilih metode pembayaran</span>
        </div>
      )}
    </div>
  );
}
