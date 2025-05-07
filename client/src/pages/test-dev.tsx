import { Button } from '@/components/ui/button';
import TestInvoice from '@/components/transactions/TestInvoice';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useState } from 'react';

export default function TestDevPage() {
  const { toast } = useToast();
  const [transactionId, setTransactionId] = useState<number | null>(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [enteredId, setEnteredId] = useState('');
  const [results, setResults] = useState<any[]>([]);
  
  const testDebtPayment = async () => {
    try {
      // Create a debt payment transaction directly through the API
      const payload = {
        transactionId: enteredId || '367', // Default to transaction #367 if not entered
        amount: "50000",
        paymentMethod: "cash",
        isPaidOff: false,
        notes: "Test pembayaran utang dari halaman dev"
      };
      
      setResults(prev => [...prev, {
        action: "Sending debt payment request",
        data: payload,
        timestamp: new Date().toISOString()
      }]);
      
      const response = await apiRequest("/api/transactions/debt-payment", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      setResults(prev => [...prev, {
        action: "Received response",
        data: response,
        timestamp: new Date().toISOString()
      }]);
      
      if (response.success) {
        toast({
          title: "Debt payment created",
          description: `New transaction ID: ${response.newTransaction?.transactionId}`,
        });
        
        // Auto-open the invoice for the new transaction
        if (response.newTransaction?.id) {
          setTransactionId(response.newTransaction.id);
          setShowInvoice(true);
        }
      } else {
        toast({
          title: "Failed to create debt payment",
          description: response.message || "Unknown error",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error creating test debt payment:", error);
      toast({
        title: "Error",
        description: "Failed to create test debt payment. Check console for details.",
        variant: "destructive"
      });
      
      setResults(prev => [...prev, {
        action: "Error occurred",
        data: String(error),
        timestamp: new Date().toISOString()
      }]);
    }
  };
  
  return (
    <div className="container mx-auto py-6 space-y-8">
      <h1 className="text-2xl font-bold">Development Testing Page</h1>
      <p className="text-gray-600">Use this page to test transaction functionality</p>
      
      <div className="bg-white p-4 rounded-md border space-y-4">
        <h2 className="text-lg font-semibold">Debt Payment Test</h2>
        <div className="flex gap-2 items-center">
          <div className="flex-1">
            <input
              type="text"
              value={enteredId}
              onChange={(e) => setEnteredId(e.target.value)}
              placeholder="Enter transaction ID (default: 367)"
              className="w-full p-2 border rounded-md"
            />
          </div>
          <Button onClick={testDebtPayment}>Create Debt Payment</Button>
        </div>
        
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Results</h3>
          <div className="bg-gray-100 p-3 rounded-md max-h-[400px] overflow-auto text-sm">
            {results.length === 0 ? (
              <p className="text-gray-500">No results yet. Run a test to see output.</p>
            ) : (
              results.map((result, index) => (
                <div key={index} className="mb-3 pb-3 border-b border-gray-200">
                  <p className="text-xs text-gray-600">{new Date(result.timestamp).toLocaleTimeString()}: {result.action}</p>
                  <pre className="mt-1 overflow-auto max-h-[100px] p-2 bg-gray-200 rounded text-xs">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
      {/* Test invoice dialog */}
      {showInvoice && transactionId && (
        <TestInvoice 
          isOpen={showInvoice} 
          transactionId={transactionId} 
          onClose={() => setShowInvoice(false)} 
        />
      )}
    </div>
  );
}