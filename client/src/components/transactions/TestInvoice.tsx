import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import React, { useEffect, useRef, useState } from 'react';

// Format price functions
function formatPrice(price: string): string {
  try {
    // Ensure price is a valid number
    const numericPrice = parseFloat(price.toString().replace(/[^\d.-]/g, ''));
    
    if (isNaN(numericPrice)) {
      return 'Rp 0';
    }
    
    // Format as Indonesian currency
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(numericPrice);
  } catch (error) {
    console.error("Error formatting price:", error);
    return 'Rp 0';
  }
}

// Format date function
function formatISODate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return format(date, 'dd MMM yyyy');
  } catch (error) {
    return dateStr || '-';
  }
}

interface InvoiceProps {
  isOpen: boolean;
  transactionId: number;
  onClose: () => void;
}

export default function TestInvoice({ isOpen, transactionId, onClose }: InvoiceProps) {
  const { toast } = useToast();
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Fetch transaction details
  const { data: transaction, isLoading } = useQuery({
    queryKey: [`/api/transactions/${transactionId}`],
    enabled: isOpen && !!transactionId
  });
  
  const generatePDF = () => {
    const element = contentRef.current;
    if (!element) return;
    
    // For debugging purposes, we're just showing text content
    console.log("Would generate PDF for:", transactionId);
    console.log("Transaction data:", transaction);
    
    // Since we removed jspdf dependency, we'll just show an alert instead
    alert(`Would generate PDF for invoice ${transactionId}`);
    
    // In a real implementation, you would use jsPDF to generate the PDF here
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Debug Invoice</DialogTitle>
        </DialogHeader>
        
        <div ref={contentRef} className="p-4 bg-white">
          {isLoading ? (
            <div>Loading transaction data...</div>
          ) : (
            <>
              <h2 className="text-xl font-bold">Transaction ID: {transaction?.transactionId}</h2>
              <p>Total Amount: {transaction?.totalAmount ? formatPrice(transaction.totalAmount) : 'N/A'}</p>
              
              <div className="mt-4">
                <h3 className="font-semibold">Metadata:</h3>
                <pre className="p-2 bg-gray-100 rounded-md">
                  {JSON.stringify(transaction?.metadata, null, 2) || "No metadata"}
                </pre>
              </div>
              
              <div className="mt-4">
                <h3 className="font-semibold">Is Debt Payment?</h3>
                {transaction && transaction.metadata ? (
                  <>
                    {typeof transaction.metadata === 'object' && transaction.metadata?.isDebtPayment === true ? (
                      <div className="p-2 bg-green-100 rounded-md">
                        <p>✓ This is a debt payment transaction</p>
                        <p>Payment Amount: {transaction.metadata.paymentAmount ? formatPrice(String(transaction.metadata.paymentAmount)) : "Unknown"}</p>
                        <p>Original Transaction: {transaction.metadata.originalTransactionId || "Unknown"}</p>
                      </div>
                    ) : typeof transaction.metadata === 'string' && transaction.metadata.includes('"isDebtPayment":true') ? (
                      <div className="p-2 bg-amber-100 rounded-md">
                        <p>⚠️ This is a debt payment transaction (legacy format)</p>
                        <p>Raw Metadata: {transaction.metadata}</p>
                      </div>
                    ) : (
                      <div className="p-2 bg-gray-100 rounded-md">
                        <p>✗ This is not a debt payment transaction</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-2 bg-gray-100 rounded-md">
                    <p>No metadata available</p>
                  </div>
                )}
              </div>
              
              <div className="mt-4">
                <h3 className="font-semibold">Raw Transaction Data:</h3>
                <pre className="p-2 bg-gray-100 rounded-md overflow-auto max-h-60">
                  {JSON.stringify(transaction, null, 2) || "No transaction data"}
                </pre>
              </div>
            </>
          )}
        </div>
        
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={generatePDF}>Download Debug PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}